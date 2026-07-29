import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(import.meta.dirname, "..");
const distributionRoot = resolve(projectRoot, "dist");
const downloadRoot = resolve(projectRoot, "demo", "public", "downloads");
const packageMetadata = JSON.parse(
  await readFile(resolve(projectRoot, "package.json"), "utf8")
);
const declarationFiles = (await readdir(distributionRoot))
  .filter((file) => file.endsWith(".d.ts"))
  .sort();
const copiedFiles = [
  "paged-pdf.min.js",
  "paged-pdf.js",
  "paged-pdf.cjs",
  ...declarationFiles
];

await rm(downloadRoot, { recursive: true, force: true });
await mkdir(downloadRoot, { recursive: true });

for (const file of copiedFiles) {
  await copyFile(resolve(distributionRoot, file), resolve(downloadRoot, file));
}

for (const file of ["LICENSE", "README.md", "THIRD_PARTY_NOTICES.md"]) {
  await copyFile(resolve(projectRoot, file), resolve(downloadRoot, file));
}

const npmCli = process.env.npm_execpath;
if (typeof npmCli !== "string" || npmCli.length === 0) {
  throw new Error("Run download preparation through npm.");
}

const { stdout } = await execFileAsync(
  process.execPath,
  [npmCli, "pack", "--json", "--pack-destination", downloadRoot],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      npm_config_cache: resolve(projectRoot, ".npm-cache")
    },
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  }
);
const packResults = JSON.parse(stdout);
const archiveName = packResults[0]?.filename;

if (typeof archiveName !== "string") {
  throw new Error("npm pack did not report a release archive.");
}

const releaseFiles = [...copiedFiles, archiveName];
const manifestFiles = await Promise.all(
  releaseFiles.map(async (file) => {
    const path = resolve(downloadRoot, file);
    const [bytes, fileStats] = await Promise.all([readFile(path), stat(path)]);
    return {
      name: basename(path),
      bytes: fileStats.size,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  })
);

await writeFile(
  resolve(downloadRoot, "manifest.json"),
  `${JSON.stringify(
    {
      name: packageMetadata.name,
      version: packageMetadata.version,
      files: manifestFiles
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(
  `Prepared ${manifestFiles.length} release downloads for ${packageMetadata.name}@${packageMetadata.version}.`
);
