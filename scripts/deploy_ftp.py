#!/usr/bin/env python3
"""Upload and activate the static site through a jailed explicit-FTPS account."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import secrets
import ssl
import sys
import tempfile
import urllib.error
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
        if (
            relative.startswith("/")
            or "\\" in relative
            or "\0" in relative
            or any(part in {"", ".", ".."} for part in relative.split("/"))
        ):
            raise ConfigurationError("The deployment directory contains an unsafe path.")
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
    if re.search(r"__[A-Z0-9_]+__", result):
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

    def delete(self, path: str) -> None:
        if self.client is None:
            return
        try:
            self.client.delete(path)
        except error_perm as error:
            if not str(error).startswith("550"):
                raise


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
        raise RuntimeError(f"Remote extraction failed: {category}.") from error
    if status != 200 or payload != {"ok": True}:
        raise RuntimeError("Remote extraction returned an invalid response.")


def deploy(root: Path) -> None:
    settings = configuration()
    files = release_files(root)
    with tempfile.TemporaryDirectory(prefix="paged-pdf-deploy-") as temporary:
        archive, script, token = create_controls(
            files,
            settings,
            Path(temporary),
        )
        with Ftps(settings) as ftps:
            try:
                run_deployment_stage(
                    "upload-archive",
                    lambda: ftps.upload(archive, archive.name),
                )
                run_deployment_stage(
                    "upload-extractor",
                    lambda: ftps.upload(script, script.name),
                )
                run_deployment_stage(
                    "activate-release",
                    lambda: invoke_extractor(script.name, token),
                )
            finally:
                ftps.delete(archive.name)
                ftps.delete(script.name)


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
