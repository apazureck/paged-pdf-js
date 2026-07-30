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
  entries: Readonly<Record<string, string>>
): Promise<{
  readonly archiveName: string;
  readonly directory: string;
  readonly scriptName: string;
  readonly token: string;
}> {
  const directory = await temporaryDirectory();
  const archiveName = "paged-pdf-release-test.zip";
  const scriptName = "paged-pdf-release-test.php";
  const token = "b".repeat(64);
  const archivePath = join(directory, archiveName);
  await createZip(archivePath, entries);
  const archive = await readFile(archivePath);
  const template = await readFile(templatePath, "utf8");
  const script = renderExtractor(template, {
    archiveName,
    archiveSha256: createHash("sha256").update(archive).digest("hex"),
    expectedFiles: Object.keys(entries),
    scriptName,
    stagingName: "paged-pdf-release-test-staging",
    token
  });
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
  });

  it("uses encrypted FTPS, an unpredictable one-shot token, and POST", async () => {
    const uploader = await readFile(uploaderPath, "utf8");

    expect(uploader).toContain("FTP_TLS");
    expect(uploader).toContain("ssl.create_default_context()");
    expect(uploader).toContain(".prot_p()");
    expect(uploader).toContain("secrets.token_hex(32)");
    expect(uploader).toContain('method="POST"');
    expect(uploader).toContain("X-Paged-Pdf-Deploy-Token");
    expect(uploader).not.toContain("?token=");
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
  });

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
  });

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
  });
});
