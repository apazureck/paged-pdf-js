import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { createServer } from "vite";

const PORT = 4173;
const server = await createServer({
  configFile: resolve("vite.demo.config.ts"),
  server: {
    host: "127.0.0.1",
    port: PORT,
    strictPort: true
  }
});

await server.listen();

const playwrightCli = resolve("node_modules/@playwright/test/cli.js");
const child = spawn(
  process.execPath,
  [playwrightCli, "test", ...process.argv.slice(2)],
  {
    env: {
      ...process.env,
      PAGED_PDF_EXTERNAL_SERVER: "1"
    },
    stdio: "inherit"
  }
);

const exitCode = await new Promise((resolveExitCode, reject) => {
  child.once("error", reject);
  child.once("exit", (code) => {
    resolveExitCode(code ?? 1);
  });
});

await server.close();
process.exitCode = exitCode;
