#!/usr/bin/env python3
"""Upload and activate the static site through a jailed explicit-FTPS account."""

from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import re
import secrets
import ssl
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections.abc import Callable
from dataclasses import dataclass
from ftplib import FTP_TLS, error_perm
from pathlib import Path, PurePosixPath
from typing import TypeVar


OWNER = "apazureck/paged-pdf-js"
SITE_URL = "https://paged-pdf-js.pazureck.de/"
HOSTNAME = re.compile(r"^[A-Za-z0-9.-]+$")
COMMIT_SHA = re.compile(r"^[0-9a-f]{40}$")
SAFE_PART = re.compile(r"^[A-Za-z0-9._-]+$")
MAX_FILES = 5000
MAX_BYTES = 150 * 1024 * 1024
MANIFEST_PATH = ".well-known/paged-pdf-managed-files.json"
Result = TypeVar("Result")


class ConfigurationError(ValueError):
    """A deployment setting failed validation."""


class DeploymentStageError(RuntimeError):
    """A deployment stage failed without exposing its underlying details."""

    def __init__(self, stage: str):
        self.stage = stage
        super().__init__(f"Deployment failed during {stage}.")


def run_deployment_stage(
    stage: str,
    operation: Callable[[], Result],
) -> Result:
    """Run one operation while exposing only its fixed, non-secret stage."""
    print(f"Deployment stage: {stage}.", flush=True)
    try:
        return operation()
    except Exception as error:
        raise DeploymentStageError(stage) from error


@dataclass(frozen=True)
class Configuration:
    host: str
    port: int
    user: str
    password: str
    server_directory: str
    release_sha: str


def safe_server_directory(raw_path: str) -> str:
    path = raw_path.strip()
    if path in {"", "."}:
        return "."
    if path.startswith("/") or "\\" in path or "\0" in path:
        raise ConfigurationError("FTP_SERVER_DIR must be a relative jailed path.")
    parts = path.split("/")
    if any(
        part in {"", ".", ".."} or SAFE_PART.fullmatch(part) is None
        for part in parts
    ):
        raise ConfigurationError("FTP_SERVER_DIR must be a relative jailed path.")
    return PurePosixPath(*parts).as_posix()


def configuration() -> Configuration:
    host = os.environ.get("FTP_HOST", "").strip()
    port_text = os.environ.get("FTP_PORT", "").strip()
    user = os.environ.get("FTP_USER", "")
    password = os.environ.get("FTP_PASSWORD", "")
    server_directory = safe_server_directory(
        os.environ.get("FTP_SERVER_DIR", "")
    )
    release_sha = os.environ.get("RELEASE_SHA", "").strip()

    if not host or HOSTNAME.fullmatch(host) is None:
        raise ConfigurationError("FTP_HOST must be a hostname.")
    if not port_text.isdigit() or not 1 <= int(port_text) <= 65535:
        raise ConfigurationError("FTP_PORT must be from 1 to 65535.")
    if not user or any(character in user for character in "\r\n\0"):
        raise ConfigurationError("FTP_USER is invalid.")
    if not password or any(character in password for character in "\r\n\0"):
        raise ConfigurationError("FTP_PASSWORD is invalid.")
    if COMMIT_SHA.fullmatch(release_sha) is None:
        raise ConfigurationError("RELEASE_SHA must be a full commit SHA.")

    return Configuration(
        host=host,
        port=int(port_text),
        user=user,
        password=password,
        server_directory=server_directory,
        release_sha=release_sha,
    )


def safe_release_path(raw_path: str) -> str:
    """Validate a relative path before placing it in an FTP command."""
    if not raw_path or raw_path.startswith(("/", "\\")) or "\0" in raw_path:
        raise ValueError("Release path is unsafe.")
    parts = raw_path.split("/")
    if any(
        part in {"", ".", ".."} or SAFE_PART.fullmatch(part) is None
        for part in parts
    ):
        raise ValueError("Release path is unsafe.")
    return PurePosixPath(*parts).as_posix()


def is_reserved_release_path(path: str) -> bool:
    return path == MANIFEST_PATH or any(
        part.startswith((".paged-pdf-stage-", ".paged-pdf-backup-"))
        for part in path.split("/")
    )


def release_files(root: Path) -> dict[str, Path]:
    resolved_root = root.resolve()
    if not resolved_root.is_dir():
        raise ConfigurationError("The deployment directory does not exist.")
    files: dict[str, Path] = {}
    total_bytes = 0
    for path in sorted(resolved_root.rglob("*")):
        if path.is_symlink():
            raise ConfigurationError("The deployment directory contains a symlink.")
        if not path.is_file():
            continue
        relative = path.relative_to(resolved_root).as_posix()
        try:
            relative = safe_release_path(relative)
        except ValueError as error:
            raise ConfigurationError(
                "The deployment directory contains an unsafe path."
            ) from error
        if is_reserved_release_path(relative):
            raise ConfigurationError("The deployment directory contains a reserved path.")
        files[relative] = path
        total_bytes += path.stat().st_size
    if not files or len(files) > MAX_FILES or total_bytes > MAX_BYTES:
        raise ConfigurationError("The deployment directory exceeds release limits.")
    for required in ("index.html", "manual.html", "downloads/paged-pdf.min.js"):
        if required not in files:
            raise ConfigurationError(f"The deployment is missing {required}.")
    return files


def render_extractor(
    template: str,
    *,
    archive_name: str,
    archive_sha256: str,
    expected_files: list[str],
    manifest: dict[str, object],
    script_name: str,
    staging_name: str,
    token: str,
) -> str:
    replacements = {
        "__TOKEN__": token,
        "__ARCHIVE_NAME__": archive_name,
        "__ARCHIVE_SHA256__": archive_sha256,
        "__EXPECTED_FILES_BASE64__": base64.b64encode(
            json.dumps(expected_files, separators=(",", ":")).encode()
        ).decode(),
        "__MANIFEST_BASE64__": base64.b64encode(
            json.dumps(manifest, separators=(",", ":")).encode()
        ).decode(),
        "__SCRIPT_NAME__": script_name,
        "__STAGING_NAME__": staging_name,
    }
    result = template
    for placeholder, value in replacements.items():
        if placeholder not in result:
            raise RuntimeError(f"Extractor template is missing {placeholder}.")
        result = result.replace(placeholder, value)
    if any(placeholder in result for placeholder in replacements):
        raise RuntimeError("Extractor template has unresolved placeholders.")
    return result


def create_controls(
    files: dict[str, Path],
    settings: Configuration,
    directory: Path,
) -> tuple[Path, Path, str]:
    suffix = secrets.token_hex(12)
    token = secrets.token_hex(32)
    archive_name = f"paged-pdf-release-{suffix}.zip"
    script_name = f"paged-pdf-release-{suffix}.php"
    archive_path = directory / archive_name
    script_path = directory / script_name
    expected_files = sorted(files)

    with zipfile.ZipFile(
        archive_path,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=6,
    ) as archive:
        for remote_path, source in sorted(files.items()):
            archive.write(source, remote_path)

    manifest: dict[str, object] = {
        "schemaVersion": 1,
        "owner": OWNER,
        "sha": settings.release_sha,
        "files": expected_files,
    }
    template_path = (
        Path(__file__).resolve().parents[1]
        / "deploy"
        / "ftp-extract-template.php"
    )
    template = template_path.read_text(encoding="utf-8")
    script = render_extractor(
        template,
        archive_name=archive_name,
        archive_sha256=hashlib.sha256(archive_path.read_bytes()).hexdigest(),
        expected_files=expected_files,
        manifest=manifest,
        script_name=script_name,
        staging_name=f"paged-pdf-release-{suffix}-staging",
        token=token,
    )
    script_path.write_text(script, encoding="utf-8", newline="\n")
    return archive_path, script_path, token


class Ftps:
    def __init__(self, settings: Configuration):
        self.settings = settings
        self.client: FTP_TLS | None = None

    def __enter__(self) -> "Ftps":
        context = ssl.create_default_context()
        client = FTP_TLS(context=context, timeout=60)
        try:
            run_deployment_stage(
                "connect",
                lambda: client.connect(
                    self.settings.host,
                    self.settings.port,
                ),
            )
            run_deployment_stage(
                "authenticate",
                lambda: client.login(
                    self.settings.user,
                    self.settings.password,
                ),
            )
            run_deployment_stage("secure-data-channel", lambda: client.prot_p())
            client.set_pasv(True)
            if self.settings.server_directory != ".":
                run_deployment_stage(
                    "select-server-directory",
                    lambda: client.cwd(self.settings.server_directory),
                )
        except Exception:
            client.close()
            raise
        self.client = client
        return self

    def __exit__(self, *_: object) -> None:
        if self.client is None:
            return
        try:
            self.client.quit()
        except Exception:
            self.client.close()
        finally:
            self.client = None

    def upload(self, source: Path, destination: str) -> None:
        if self.client is None:
            raise RuntimeError("FTPS is not connected.")
        with source.open("rb") as stream:
            self.client.storbinary(f"STOR {destination}", stream)

    def upload_bytes(self, payload: bytes, destination: str) -> None:
        if self.client is None:
            raise RuntimeError("FTPS is not connected.")
        self.client.storbinary(f"STOR {destination}", io.BytesIO(payload))

    def download_optional(self, path: str) -> bytes | None:
        if self.client is None:
            raise RuntimeError("FTPS is not connected.")
        payload = bytearray()
        try:
            self.client.retrbinary(f"RETR {path}", payload.extend)
        except error_perm as error:
            if str(error).startswith("550"):
                return None
            raise
        if len(payload) > 1024 * 1024:
            raise RuntimeError("Remote manifest is too large.")
        return bytes(payload)

    def ensure_directory(self, path: str) -> None:
        if self.client is None:
            raise RuntimeError("FTPS is not connected.")
        current = ""
        for part in path.split("/"):
            current = f"{current}/{part}" if current else part
            try:
                self.client.mkd(current)
            except error_perm as error:
                if not str(error).startswith("550"):
                    raise

    def rename(self, source: str, destination: str) -> None:
        if self.client is None:
            raise RuntimeError("FTPS is not connected.")
        self.client.rename(source, destination)

    def rename_if_exists(self, source: str, destination: str) -> bool:
        if self.client is None:
            raise RuntimeError("FTPS is not connected.")
        try:
            self.client.rename(source, destination)
        except error_perm as error:
            if str(error).startswith("550"):
                return False
            raise
        return True

    def delete(self, path: str) -> None:
        if self.client is None:
            return
        try:
            self.client.delete(path)
        except error_perm as error:
            if not str(error).startswith("550"):
                raise


def verify_web_root(ftps: Ftps, directory: Path) -> None:
    """Verify that the selected FTPS directory is served by the public site."""
    suffix = secrets.token_hex(12)
    expected = secrets.token_hex(32).encode("ascii")
    probe_name = f"paged-pdf-web-root-{suffix}.txt"
    probe_path = directory / probe_name
    probe_path.write_bytes(expected)

    try:
        run_deployment_stage(
            "upload-web-root-probe",
            lambda: ftps.upload(probe_path, probe_name),
        )

        def fetch_probe() -> None:
            request = urllib.request.Request(
                f"{SITE_URL}{urllib.parse.quote(probe_name, safe='')}",
                method="GET",
                headers={"Cache-Control": "no-cache"},
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = response.read(len(expected) + 1)
                if response.status != 200 or payload != expected:
                    raise RuntimeError("The public web root does not match FTPS.")

        run_deployment_stage("verify-web-root", fetch_probe)
    finally:
        ftps.delete(probe_name)


def previous_managed_files(ftps: Ftps) -> tuple[str, ...]:
    payload = ftps.download_optional(MANIFEST_PATH)
    if payload is None:
        return ()
    try:
        manifest = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RuntimeError("Remote manifest is invalid.") from error
    if (
        not isinstance(manifest, dict)
        or manifest.get("schemaVersion") != 1
        or manifest.get("owner") != OWNER
        or not isinstance(manifest.get("files"), list)
    ):
        raise RuntimeError("Remote manifest is invalid.")
    raw_files = manifest["files"]
    if not all(isinstance(path, str) for path in raw_files):
        raise RuntimeError("Remote manifest is invalid.")
    try:
        files = tuple(safe_release_path(path) for path in raw_files)
    except (TypeError, ValueError) as error:
        raise RuntimeError("Remote manifest is invalid.") from error
    if (
        len(files) > MAX_FILES
        or len(files) != len(set(files))
        or any(is_reserved_release_path(path) for path in files)
    ):
        raise RuntimeError("Remote manifest is invalid.")
    return files


def release_manifest(files: dict[str, Path], settings: Configuration) -> bytes:
    manifest = {
        "schemaVersion": 1,
        "owner": OWNER,
        "sha": settings.release_sha,
        "files": sorted(files),
    }
    return (json.dumps(manifest, separators=(",", ":")) + "\n").encode("utf-8")


def publication_order(paths: tuple[str, ...]) -> tuple[str, ...]:
    def rank(path: str) -> tuple[int, str]:
        if path == "index.html":
            return (2, path)
        if path.endswith(".html"):
            return (1, path)
        return (0, path)

    return tuple(sorted(paths, key=rank))


def remote_control_path(path: str, kind: str, suffix: str) -> str:
    source = PurePosixPath(path)
    name = f".paged-pdf-{kind}-{suffix}-{source.name}"
    return (source.parent / name).as_posix()


def rollback_ftps_release(
    ftps: Ftps,
    changes: tuple[tuple[str, str | None], ...],
) -> None:
    for destination, backup in reversed(changes):
        ftps.delete(destination)
        if backup is not None:
            ftps.rename(backup, destination)


def activate_ftps_release(
    ftps: Ftps,
    files: dict[str, Path],
    settings: Configuration,
) -> None:
    previous = run_deployment_stage(
        "read-release-manifest",
        lambda: previous_managed_files(ftps),
    )
    suffix = secrets.token_hex(12)
    release_paths = tuple(sorted(files))
    all_targets = (*release_paths, MANIFEST_PATH)
    staged = tuple(
        (target, remote_control_path(target, "stage", suffix))
        for target in all_targets
    )
    backups = tuple(
        remote_control_path(target, "backup", suffix)
        for target in (*all_targets, *previous)
    )

    print("Deployment stage: stage-release.", flush=True)
    try:
        directories = tuple(
            sorted(
                {
                    PurePosixPath(target).parent.as_posix()
                    for target in all_targets
                    if PurePosixPath(target).parent.as_posix() != "."
                }
            )
        )
        for directory in directories:
            ftps.ensure_directory(directory)
        for target, temporary in staged:
            if target == MANIFEST_PATH:
                ftps.upload_bytes(release_manifest(files, settings), temporary)
            else:
                ftps.upload(files[target], temporary)
    except Exception as error:
        for _, temporary in staged:
            ftps.delete(temporary)
        raise DeploymentStageError("stage-release") from error

    staged_by_target = dict(staged)
    changes: tuple[tuple[str, str | None], ...] = ()
    print("Deployment stage: activate-release.", flush=True)
    try:
        for target in publication_order(release_paths):
            backup = remote_control_path(target, "backup", suffix)
            preserved = backup if ftps.rename_if_exists(target, backup) else None
            changes = (*changes, (target, preserved))
            ftps.rename(staged_by_target[target], target)
        for target in sorted(set(previous) - set(release_paths)):
            backup = remote_control_path(target, "backup", suffix)
            if ftps.rename_if_exists(target, backup):
                changes = (*changes, (target, backup))
        manifest_backup = remote_control_path(MANIFEST_PATH, "backup", suffix)
        preserved_manifest = (
            manifest_backup
            if ftps.rename_if_exists(MANIFEST_PATH, manifest_backup)
            else None
        )
        changes = (*changes, (MANIFEST_PATH, preserved_manifest))
        ftps.rename(staged_by_target[MANIFEST_PATH], MANIFEST_PATH)
    except Exception as error:
        try:
            rollback_ftps_release(ftps, changes)
        except Exception as rollback_error:
            raise DeploymentStageError("rollback-release") from rollback_error
        raise DeploymentStageError("activate-release") from error
    finally:
        for _, temporary in staged:
            ftps.delete(temporary)

    print("Deployment stage: cleanup-release.", flush=True)
    try:
        for backup in backups:
            ftps.delete(backup)
    except Exception as error:
        raise DeploymentStageError("cleanup-release") from error


def invoke_extractor(script_name: str, token: str) -> None:
    request = urllib.request.Request(
        f"{SITE_URL}{script_name}",
        data=b"",
        method="POST",
        headers={
            "Content-Type": "application/octet-stream",
            "X-Paged-Pdf-Deploy-Token": token,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            payload = json.loads(response.read(1024 * 1024).decode("utf-8"))
            status = response.status
    except urllib.error.HTTPError as error:
        try:
            payload = json.loads(error.read(1024 * 1024).decode("utf-8"))
            category = str(payload.get("error", "remote-extraction-failed"))
        except (AttributeError, UnicodeDecodeError, json.JSONDecodeError):
            category = "remote-extraction-failed"
        safe_categories = {
            "archive-checksum-failed",
            "archive-unavailable",
            "lock-unavailable",
            "deployment-locked",
            "invalid-archive",
            "invalid-control",
            "invalid-manifest",
            "not-found",
            "rollback-failed",
            "stale-cleanup-failed",
            "unsafe-destination",
            "unsafe-parent",
            "write-failed",
        }
        result = (
            f"extractor-{category}"
            if category in safe_categories
            else f"http-{error.code}"
            if 400 <= error.code <= 599
            else "http-error"
        )
        print(f"Deployment activation result: {result}.", flush=True)
        raise RuntimeError(f"Remote extraction failed: {category}.") from error
    except urllib.error.URLError as error:
        print("Deployment activation result: network-error.", flush=True)
        raise RuntimeError("Remote extraction request failed.") from error
    if status != 200 or payload != {"ok": True}:
        print("Deployment activation result: invalid-response.", flush=True)
        raise RuntimeError("Remote extraction returned an invalid response.")


def deploy(root: Path) -> None:
    settings = configuration()
    files = run_deployment_stage(
        "prepare-release",
        lambda: release_files(root),
    )
    with tempfile.TemporaryDirectory(prefix="paged-pdf-deploy-") as temporary:
        with Ftps(settings) as ftps:
            verify_web_root(ftps, Path(temporary))
            activate_ftps_release(ftps, files, settings)


def main(arguments: list[str]) -> int:
    try:
        if arguments == ["--check-config"]:
            configuration()
            print(json.dumps({"ok": True}))
            return 0
        if len(arguments) != 1:
            raise ConfigurationError("Usage: deploy_ftp.py <site-directory>")
        deploy(Path(arguments[0]))
        print("FTPS deployment activated successfully.")
        return 0
    except ConfigurationError as error:
        print(f"Deployment configuration is invalid: {error}", file=sys.stderr)
        return 2
    except DeploymentStageError as error:
        print(error, file=sys.stderr)
        return 1
    except Exception:
        print("Deployment failed without exposing connection details.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
