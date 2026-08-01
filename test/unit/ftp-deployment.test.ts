import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const temporaryDirectories: string[] = [];
const templatePath = resolve("deploy/ftp-extract-template.php");
const uploaderPath = resolve("scripts/deploy_ftp.py");

async function projectFile(path: string): Promise<string> {
  return readFile(resolve(path), "utf8");
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "paged-pdf-ftp-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function createZip(
  outputPath: string,
  entries: Readonly<Record<string, string>>
): Promise<void> {
  const source = [
    "import json, sys, zipfile",
    "entries = json.loads(sys.argv[2])",
    "with zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED) as archive:",
    "    for name, content in entries.items():",
    "        archive.writestr(name, content)"
  ].join("\n");

  await execFile("python", [
    "-c",
    source,
    outputPath,
    JSON.stringify(entries)
  ]);
}

function renderExtractor(
  template: string,
  options: {
    readonly archiveName: string;
    readonly archiveSha256: string;
    readonly expectedFiles: readonly string[];
    readonly scriptName: string;
    readonly stagingName: string;
    readonly token: string;
  }
): string {
  const manifest = {
    schemaVersion: 1,
    owner: "apazureck/paged-pdf-js",
    sha: "a".repeat(40),
    files: options.expectedFiles
  };
  const replacements = new Map<string, string>([
    ["__TOKEN__", options.token],
    ["__ARCHIVE_NAME__", options.archiveName],
    ["__ARCHIVE_SHA256__", options.archiveSha256],
    [
      "__EXPECTED_FILES_BASE64__",
      Buffer.from(JSON.stringify(options.expectedFiles)).toString("base64")
    ],
    [
      "__MANIFEST_BASE64__",
      Buffer.from(JSON.stringify(manifest)).toString("base64")
    ],
    ["__SCRIPT_NAME__", options.scriptName],
    ["__STAGING_NAME__", options.stagingName]
  ]);

  return [...replacements].reduce(
    (result, [placeholder, value]) =>
      result.replaceAll(placeholder, value),
    template
  );
}

async function phpArguments(): Promise<string[]> {
  const { stdout } = await execFile("php", ["-m"]);
  return stdout.split(/\r?\n/u).includes("zip")
    ? []
    : ["-d", "extension=zip"];
}

async function invokeExtractor(
  directory: string,
  scriptName: string,
  token: string
): Promise<Record<string, unknown>> {
  const bootstrap = [
    '$_SERVER["REQUEST_METHOD"] = "POST";',
    `$_SERVER["HTTP_X_PAGED_PDF_DEPLOY_TOKEN"] = "${token}";`,
    `require "${scriptName}";`
  ].join(" ");
  const { stdout } = await execFile(
    "php",
    [...(await phpArguments()), "-r", bootstrap],
    { cwd: directory }
  );

  return JSON.parse(stdout) as Record<string, unknown>;
}

async function prepareExtractor(
  entries: Readonly<Record<string, string>>,
  options: {
    readonly directory?: string;
    readonly suffix?: string;
    readonly transformScript?: (script: string) => string;
  } = {}
): Promise<{
  readonly archiveName: string;
  readonly directory: string;
  readonly scriptName: string;
  readonly token: string;
}> {
  const directory = options.directory ?? (await temporaryDirectory());
  const suffix = options.suffix ?? "test";
  const archiveName = `paged-pdf-release-${suffix}.zip`;
  const scriptName = `paged-pdf-release-${suffix}.php`;
  const token = "b".repeat(64);
  const archivePath = join(directory, archiveName);
  await createZip(archivePath, entries);
  const archive = await readFile(archivePath);
  const template = await readFile(templatePath, "utf8");
  const renderedScript = renderExtractor(template, {
    archiveName,
    archiveSha256: createHash("sha256").update(archive).digest("hex"),
    expectedFiles: Object.keys(entries),
    scriptName,
    stagingName: `paged-pdf-release-${suffix}-staging`,
    token
  });
  const script = options.transformScript?.(renderedScript) ?? renderedScript;
  await writeFile(join(directory, scriptName), script, "utf8");

  return { archiveName, directory, scriptName, token };
}

afterEach(async () => {
  const directories = temporaryDirectories.splice(
    0,
    temporaryDirectories.length
  );
  await Promise.all(
    directories.map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  );
});

describe("FTP release workflow", () => {
  it("uses FTPS secrets and never restores the obsolete SSH transport", async () => {
    const workflow = await projectFile(".github/workflows/deploy.yml");

    for (const secret of [
      "FTP_HOST",
      "FTP_PORT",
      "FTP_USER",
      "FTP_PASSWORD",
      "FTP_SERVER_DIR"
    ]) {
      expect(workflow).toContain(`secrets.${secret}`);
    }
    expect(workflow).toContain("python scripts/deploy_ftp.py demo-dist");
    expect(workflow).not.toMatch(/\b(?:ssh|scp)\b/u);
    expect(workflow).not.toContain("DEPLOY_SSH_KEY");
    expect(workflow).toContain(
      "actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1"
    );
    expect(workflow).toContain('python-version: "3.12"');
    expect(workflow).toContain("php --version");
    expect(workflow).toContain("php -m | grep -qx zip");
  });

  it("keeps the retained one-shot extractor controls secret-safe", async () => {
    const uploader = await readFile(uploaderPath, "utf8");

    expect(uploader).toContain("FTP_TLS");
    expect(uploader).toContain("ssl.create_default_context()");
    expect(uploader).toContain(".prot_p()");
    expect(uploader).toContain("secrets.token_hex(32)");
    expect(uploader).toContain('method="POST"');
    expect(uploader).toContain("X-Paged-Pdf-Deploy-Token");
    expect(uploader).not.toContain("?token=");
  });

  it("rejects FTP command injection in release paths", async () => {
    const source = [
      "from scripts.deploy_ftp import safe_release_path",
      "for path in ['assets/app.js\\r\\nDELE index.html', '../index.html', '/index.html']:",
      "    try:",
      "        safe_release_path(path)",
      "    except ValueError:",
      "        print('rejected')"
    ].join("\n");
    const { stdout } = await execFile("python", ["-c", source]);

    expect(stdout.trim().split(/\r?\n/u)).toEqual([
      "rejected",
      "rejected",
      "rejected"
    ]);
  });

  it("reports the failing FTPS stage without exposing server details", async () => {
    const source = [
      "from unittest.mock import patch",
      "from scripts.deploy_ftp import Configuration, DeploymentStageError, Ftps",
      "class FakeFtps:",
      "    def __init__(self, **_kwargs): pass",
      "    def connect(self, *_args): pass",
      "    def login(self, *_args): raise RuntimeError('sensitive-server-detail')",
      "    def close(self): pass",
      "settings = Configuration('example.com', 21, 'user', 'password', '.', 'a' * 40)",
      "with patch('scripts.deploy_ftp.FTP_TLS', FakeFtps):",
      "    try:",
      "        with Ftps(settings): pass",
      "    except DeploymentStageError as error:",
      "        print(str(error))"
    ].join("\n");
    const { stdout } = await execFile("python", ["-c", source]);

    expect(stdout).toContain("Deployment stage: connect.");
    expect(stdout).toContain("Deployment stage: authenticate.");
    expect(stdout).toContain("Deployment failed during authenticate.");
    expect(stdout).not.toContain("sensitive-server-detail");
  });

  it("reports release preparation failures without exposing local details", async () => {
    const source = [
      "from pathlib import Path",
      "from unittest.mock import patch",
      "from scripts.deploy_ftp import Configuration, DeploymentStageError, deploy",
      "settings = Configuration('example.com', 21, 'user', 'password', '.', 'a' * 40)",
      "with patch('scripts.deploy_ftp.configuration', return_value=settings), \\",
      "     patch('scripts.deploy_ftp.release_files', return_value={}), \\",
      "     patch('scripts.deploy_ftp.create_controls', side_effect=RuntimeError('sensitive-local-detail')):",
      "    try:",
      "        deploy(Path('.'))",
      "    except DeploymentStageError as error:",
      "        print(str(error))"
    ].join("\n");
    const { stdout } = await execFile("python", ["-c", source]);

    expect(stdout).toContain("Deployment stage: prepare-release-controls.");
    expect(stdout).toContain(
      "Deployment failed during prepare-release-controls."
    );
    expect(stdout).not.toContain("sensitive-local-detail");
  });

  it("prepares release controls while preserving PHP magic constants", async () => {
    const source = [
      "import tempfile",
      "from pathlib import Path",
      "from scripts.deploy_ftp import Configuration, create_controls, release_files",
      "settings = Configuration('example.com', 21, 'user', 'password', '.', 'a' * 40)",
      "with tempfile.TemporaryDirectory() as site, tempfile.TemporaryDirectory() as controls:",
      "    root = Path(site)",
      "    (root / 'downloads').mkdir()",
      "    (root / 'index.html').write_text('index', encoding='utf-8')",
      "    (root / 'manual.html').write_text('manual', encoding='utf-8')",
      "    (root / 'downloads' / 'paged-pdf.min.js').write_text('bundle', encoding='utf-8')",
      "    archive, script, token = create_controls(release_files(root), settings, Path(controls))",
      "    print(archive.is_file(), script.is_file(), len(token))"
    ].join("\n");
    const { stdout } = await execFile("python", ["-c", source]);

    expect(stdout.trim()).toBe("True True 64");
  });

  it("verifies that the FTPS directory is the public web root", async () => {
    const source = [
      "import tempfile",
      "from pathlib import Path",
      "from unittest.mock import patch",
      "from scripts.deploy_ftp import verify_web_root",
      "class Response:",
      "    status = 200",
      "    def __init__(self, payload): self.payload = payload",
      "    def __enter__(self): return self",
      "    def __exit__(self, *_args): pass",
      "    def read(self, _limit): return self.payload",
      "class FakeFtps:",
      "    def upload(self, source, destination):",
      "        self.destination = destination",
      "        self.payload = source.read_bytes()",
      "    def delete(self, path): self.deleted = path",
      "ftps = FakeFtps()",
      "def open_url(request, timeout):",
      "    assert request.full_url.startswith('https://paged-pdf-js.pazureck.de/')",
      "    assert timeout == 60",
      "    return Response(ftps.payload)",
      "with tempfile.TemporaryDirectory() as directory, patch('scripts.deploy_ftp.urllib.request.urlopen', side_effect=open_url):",
      "    verify_web_root(ftps, Path(directory))",
      "print(ftps.destination == ftps.deleted, ftps.destination.endswith('.txt'), len(ftps.payload))"
    ].join("\n");
    const { stdout } = await execFile("python", ["-c", source]);

    expect(stdout).toContain("Deployment stage: upload-web-root-probe.");
    expect(stdout).toContain("Deployment stage: verify-web-root.");
    expect(stdout.trim()).toMatch(/True True 64$/u);
  });

  it("reports only a fixed category for an activation HTTP failure", async () => {
    const source = [
      "import io",
      "from unittest.mock import patch",
      "from urllib.error import HTTPError",
      "from scripts.deploy_ftp import invoke_extractor",
      "failure = HTTPError('https://sensitive.example/private', 404, 'sensitive-reason', {}, io.BytesIO(b'sensitive-response'))",
      "with patch('scripts.deploy_ftp.urllib.request.urlopen', side_effect=failure):",
      "    try:",
      "        invoke_extractor('release.php', 'secret-token')",
      "    except RuntimeError:",
      "        pass"
    ].join("\n");
    const { stdout } = await execFile("python", ["-c", source]);

    expect(stdout.trim()).toBe("Deployment activation result: http-404.");
    expect(stdout).not.toContain("sensitive");
    expect(stdout).not.toContain("secret-token");
  });

  it("rejects unsafe remote directories before making a connection", async () => {
    await expect(
      execFile("python", [uploaderPath, "--check-config"], {
        env: {
          ...process.env,
          FTP_HOST: "s219.goserver.host",
          FTP_PASSWORD: "not-a-real-password",
          FTP_PORT: "21",
          FTP_SERVER_DIR: "../other-site",
          FTP_USER: "not-a-real-user",
          RELEASE_SHA: "a".repeat(40)
        }
      })
    ).rejects.toMatchObject({ code: 2 });
  });
});

describe("one-shot PHP extractor", () => {
  it("keeps a stable lock and uses reversible release activation", async () => {
    const template = await readFile(templatePath, "utf8");

    expect(template).not.toContain("@unlink($lockPath)");
    expect(template).not.toContain("@unlink($stale)");
    expect(template).toContain("$lockDirectory = sys_get_temp_dir()");
    expect(template).toContain("hash('sha256', __DIR__)");
    expect(template).not.toContain(
      "$lockPath = __DIR__ . DIRECTORY_SEPARATOR . '.paged-pdf-deploy.lock'"
    );
    expect(template).toContain("throw new RuntimeException('lock-unavailable')");
    expect(template).toContain("throw new RuntimeException('deployment-locked')");
    expect(template).toContain("backupLiveFiles");
    expect(template).toContain("rollbackRelease");
    expect(template).toContain("'rollback-failed'");
  });

  it("is valid PHP and limits method, token, archive paths, and archive size", async () => {
    const template = await readFile(templatePath, "utf8");
    await execFile("php", ["-l", templatePath]);

    expect(template).toContain("REQUEST_METHOD");
    expect(template).toContain("HTTP_X_PAGED_PDF_DEPLOY_TOKEN");
    expect(template).toContain("hash_equals");
    expect(template).toContain("hash_file('sha256'");
    expect(template).toContain("ZipArchive::OPSYS_UNIX");
    expect(template).toContain("MAX_ARCHIVE_FILES");
    expect(template).toContain("MAX_UNCOMPRESSED_BYTES");
    expect(template).toContain("str_contains($path, \"\\\\\")");
    expect(template).toContain("str_contains($path, \"\\0\")");
    expect(template).not.toContain("$_GET");
  });

  it("extracts the validated archive and removes both control files", async () => {
    const deployment = await prepareExtractor({
      "assets/app.js": "console.log('vector pdf');",
      "index.html": "<h1>Paged PDF</h1>",
      "manual.html": "<h1>Manual</h1>"
    });

    await expect(
      invokeExtractor(
        deployment.directory,
        deployment.scriptName,
        deployment.token
      )
    ).resolves.toEqual({ ok: true });
    await expect(
      readFile(join(deployment.directory, "index.html"), "utf8")
    ).resolves.toContain("Paged PDF");
    await expect(
      readFile(join(deployment.directory, "assets/app.js"), "utf8")
    ).resolves.toContain("vector pdf");
    await expect(
      access(join(deployment.directory, deployment.archiveName))
    ).rejects.toThrow();
    await expect(
      access(join(deployment.directory, deployment.scriptName))
    ).rejects.toThrow();
  }, 15_000);

  it("returns a generic response and does not extract for an invalid token", async () => {
    const deployment = await prepareExtractor({
      "index.html": "<h1>Must not deploy</h1>"
    });

    await expect(
      invokeExtractor(
        deployment.directory,
        deployment.scriptName,
        "wrong-token"
      )
    ).resolves.toEqual({ error: "not-found" });
    await expect(
      access(join(deployment.directory, "index.html"))
    ).rejects.toThrow();
  }, 15_000);

  it("blocks ZIP path traversal without disclosing filesystem paths", async () => {
    const deployment = await prepareExtractor({
      "../escaped-by-archive.txt": "unsafe"
    });
    const response = await invokeExtractor(
      deployment.directory,
      deployment.scriptName,
      deployment.token
    );

    expect(response).toEqual({ error: "invalid-archive" });
    expect(JSON.stringify(response)).not.toContain(deployment.directory);
    await expect(
      access(join(deployment.directory, "..", "escaped-by-archive.txt"))
    ).rejects.toThrow();
  }, 15_000);

  it("removes stale managed files on a consecutive deployment", async () => {
    const first = await prepareExtractor({
      "assets/old.js": "old",
      "index.html": "<h1>First</h1>"
    });
    await invokeExtractor(first.directory, first.scriptName, first.token);

    const second = await prepareExtractor(
      {
        "assets/new.js": "new",
        "index.html": "<h1>Second</h1>"
      },
      { directory: first.directory, suffix: "second" }
    );
    await expect(
      invokeExtractor(second.directory, second.scriptName, second.token)
    ).resolves.toEqual({ ok: true });
    await expect(
      access(join(first.directory, "assets", "old.js"))
    ).rejects.toThrow();
    await expect(
      readFile(join(first.directory, "assets", "new.js"), "utf8")
    ).resolves.toBe("new");
  }, 15_000);

  it("keeps the live release intact when activation fails", async () => {
    const first = await prepareExtractor({
      "assets/old.js": "old",
      "index.html": "<h1>First</h1>"
    });
    await invokeExtractor(first.directory, first.scriptName, first.token);

    const second = await prepareExtractor(
      {
        "assets/new.js": "new",
        "index.html": "<h1>Second</h1>"
      },
      {
        directory: first.directory,
        suffix: "failed-activation",
        transformScript: (script) =>
          script.replace(
            "        $publishedFiles = [...$publishedFiles, $path];",
            [
              "        $publishedFiles = [...$publishedFiles, $path];",
              "        if ($path === 'assets/new.js') {",
              "            throw new RuntimeException('write-failed');",
              "        }"
            ].join("\n")
          )
      }
    );

    await expect(
      invokeExtractor(second.directory, second.scriptName, second.token)
    ).resolves.toEqual({ error: "write-failed" });
    await expect(
      readFile(join(first.directory, "assets", "old.js"), "utf8")
    ).resolves.toBe("old");
    await expect(
      readFile(join(first.directory, "index.html"), "utf8")
    ).resolves.toContain("First");
    await expect(
      access(join(first.directory, "assets", "new.js"))
    ).rejects.toThrow();
  }, 15_000);

  it("supports managed file-to-directory and directory-to-file changes", async () => {
    const first = await prepareExtractor({
      "index.html": "<h1>First</h1>",
      "legacy": "old file",
      "old-parent/child.txt": "old child"
    });
    await invokeExtractor(first.directory, first.scriptName, first.token);

    const second = await prepareExtractor(
      {
        "index.html": "<h1>Second</h1>",
        "legacy/new.txt": "new child",
        "old-parent": "new file"
      },
      { directory: first.directory, suffix: "transition" }
    );

    await expect(
      invokeExtractor(second.directory, second.scriptName, second.token)
    ).resolves.toEqual({ ok: true });
    await expect(
      readFile(join(first.directory, "legacy", "new.txt"), "utf8")
    ).resolves.toBe("new child");
    await expect(
      readFile(join(first.directory, "old-parent"), "utf8")
    ).resolves.toBe("new file");
  }, 15_000);
});
