import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const canonicalSite = "https://paged-pdf-js.pazureck.de";
const obsoleteHost = "pagedpdf.pazureck.de";

async function readProjectFile(path: string): Promise<string> {
  return readFile(resolve(path), "utf8");
}

describe("public site release configuration", () => {
  it("uses one canonical production hostname", async () => {
    const paths = [
      "package.json",
      "README.md",
      ".github/workflows/deploy.yml",
      "demo/index.html",
      "demo/gallery.html",
      "demo/manual.html"
    ];
    const contents = await Promise.all(paths.map(readProjectFile));
    const packageJson = JSON.parse(contents[0] ?? "{}") as {
      readonly homepage?: string;
    };

    expect(packageJson.homepage).toBe(canonicalSite);
    expect(contents.join("\n")).not.toContain(obsoleteHost);
    expect(contents.join("\n")).toContain(canonicalSite);
  });

  it("builds and smoke-tests the manual and browser download", async () => {
    const workflow = await readProjectFile(".github/workflows/deploy.yml");

    expect(workflow).toContain(`url: ${canonicalSite}`);
    expect(workflow).toContain(`${canonicalSite}/manual.html`);
    expect(workflow).toContain(
      `${canonicalSite}/downloads/paged-pdf.min.js`
    );
    expect(workflow).toMatch(/run: npm run build(?:\s|$)/u);
    expect(workflow).not.toMatch(/run: npm run build:demo/u);
  });

  it("only deploys a trusted push to the current main tip", async () => {
    const workflow = await readProjectFile(".github/workflows/deploy.yml");

    expect(workflow).toContain(
      "github.event.workflow_run.event == 'push'"
    );
    expect(workflow).toContain(
      "github.event.workflow_run.head_repository.full_name == github.repository"
    );
    expect(workflow).toContain(
      "github.event.workflow_run.head_branch == 'main'"
    );
    expect(workflow).toContain(
      'test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"'
    );
  });

  it("supports legacy rollback and bounds server release retention", async () => {
    const workflow = await readProjectFile(".github/workflows/deploy.yml");

    expect(workflow).toContain(
      "([a-f0-9]{40}|[a-f0-9]{40}-[0-9]+-[0-9]+)"
    );
    expect(workflow).toContain("trap cleanup_staging EXIT");
    expect(workflow).toContain("tail -n +6");
    expect(workflow).toContain('rm -r -- \\"\\$candidate\\"');
  });

  it("pins every third-party workflow action to a commit", async () => {
    const workflowPaths = [
      ".github/workflows/ci.yml",
      ".github/workflows/deploy.yml",
      ".github/workflows/release.yml"
    ];
    const workflows = await Promise.all(workflowPaths.map(readProjectFile));

    for (const workflow of workflows) {
      expect(workflow).not.toMatch(/uses:\s+actions\/[^@\s]+@v\d/u);
      const actionUses = [
        ...workflow.matchAll(/uses:\s+actions\/[^@\s]+@([a-f0-9]{40})/gu)
      ];
      expect(actionUses.length).toBeGreaterThan(0);
    }
  });

  it("documents HSTS for every Nginx location with custom headers", async () => {
    const nginx = await readProjectFile(
      "deploy/nginx/paged-pdf-js.conf.example"
    );

    expect(nginx.match(/Strict-Transport-Security/gu)).toHaveLength(3);
    expect(nginx).toContain(
      "Enable HSTS only after HTTPS works reliably for this hostname."
    );
  });
});
