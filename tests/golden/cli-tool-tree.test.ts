import { describe, expect, it } from "vitest";
import { loadTemplates } from "../../src/external/index.js";
import { buildContext, renderTree } from "../../src/service/generator/index.js";
import type { ProjectSpec } from "../../src/domain/index.js";

const baseSpec: ProjectSpec = {
  projectName: "my-test-cli",
  rootPath: "/tmp/my-test-cli",
  playbookId: "cli-tool",
  matchMode: "exact",
  matchScore: 1,
  answers: [
    { questionId: "1", selectedOptionId: "B" },
    { questionId: "2", selectedOptionId: "A" },
    { questionId: "5", selectedOptionId: "A" },
  ],
  placeholders: {},
  generatedAt: "2026-04-27T00:00:00.000Z",
  trellisVersion: "0.0.0-golden",
};

describe("golden — cli-tool template tree", () => {
  it("loads the cli-tool template set with expected key files", () => {
    const templates = loadTemplates("cli-tool");
    expect(templates.length).toBeGreaterThan(15);

    const sourcePaths = templates.map((t) => t.sourcePath);
    expect(sourcePaths).toContain("package.json.hbs");
    expect(sourcePaths).toContain("README.md.hbs");
    expect(sourcePaths).toContain("CLAUDE.md.hbs");
    expect(sourcePaths).toContain("LICENSE.hbs");
    expect(sourcePaths).toContain(".gitignore");
    expect(sourcePaths).toContain("tsconfig.json");
    expect(sourcePaths).toContain("src/cmd/index.ts.hbs");
    expect(sourcePaths).toContain("src/cmd/hello.ts.hbs");
    expect(sourcePaths).toContain("src/common/errors/app-error.ts");
    expect(sourcePaths).toContain("src/common/logger/index.ts");
    expect(sourcePaths).toContain(".github/workflows/ci.yml.hbs");
  });

  it("renders templates and strips .hbs extension on output", () => {
    const templates = loadTemplates("cli-tool");
    const ctx = buildContext(baseSpec);
    const tree = renderTree(templates, ctx);

    const paths = tree.map((f) => f.path);
    expect(paths).toContain("package.json");
    expect(paths).toContain("README.md");
    expect(paths).toContain("LICENSE");
    expect(paths).toContain("src/cmd/index.ts");
    expect(paths).toContain(".github/workflows/ci.yml");

    // No .hbs survivors:
    const hbsLeftovers = paths.filter((p) => p.endsWith(".hbs"));
    expect(hbsLeftovers).toEqual([]);
  });

  it("substitutes projectName into package.json", () => {
    const templates = loadTemplates("cli-tool");
    const tree = renderTree(templates, buildContext(baseSpec));
    const pkg = tree.find((f) => f.path === "package.json");
    expect(pkg).toBeDefined();
    const parsed = JSON.parse(pkg!.content) as { name: string; bin: Record<string, string> };
    expect(parsed.name).toBe("my-test-cli");
    expect(parsed.bin["my-test-cli"]).toBe("./dist/cmd/index.js");
  });

  it("substitutes projectName into hello.ts greeting", () => {
    const templates = loadTemplates("cli-tool");
    const tree = renderTree(templates, buildContext(baseSpec));
    const hello = tree.find((f) => f.path === "src/cmd/hello.ts");
    expect(hello).toBeDefined();
    expect(hello!.content).toContain('"Hello from my-test-cli\\n"');
  });

  it("substitutes projectName into CI smoke test", () => {
    const templates = loadTemplates("cli-tool");
    const tree = renderTree(templates, buildContext(baseSpec));
    const ci = tree.find((f) => f.path === ".github/workflows/ci.yml");
    expect(ci).toBeDefined();
    expect(ci!.content).toContain('"Hello from my-test-cli"');
  });
});
