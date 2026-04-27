import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProjectSpec } from "../../src/domain/index.js";
import { scaffold } from "../../src/service/scaffolder/index.js";

let workDir: string;
let projectDir: string;

const spec: ProjectSpec = {
  projectName: "e2e-test-cli",
  rootPath: "",
  playbookId: "cli-tool",
  matchMode: "exact",
  matchScore: 1,
  answers: [
    { questionId: "1", selectedOptionId: "B" },
    { questionId: "2", selectedOptionId: "A" },
    { questionId: "3", selectedOptionId: "B" },
    { questionId: "4", selectedOptionId: "C" },
    { questionId: "5", selectedOptionId: "A" },
    { questionId: "6", selectedOptionId: "A" },
    { questionId: "7", selectedOptionId: "A" },
    { questionId: "8", selectedOptionId: "A" },
    { questionId: "9", selectedOptionId: "C" },
  ],
  placeholders: {},
  generatedAt: "2026-04-27T00:00:00.000Z",
  trellisVersion: "0.0.0-e2e",
};

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "trellis-e2e-"));
  projectDir = join(workDir, "e2e-test-cli");
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("E2E — scaffold cli-tool to a real temp directory", () => {
  it("writes a complete file tree to disk", () => {
    const tree = scaffold({ ...spec, rootPath: projectDir });
    expect(tree.length).toBeGreaterThan(15);

    expect(existsSync(projectDir)).toBe(true);
    expect(statSync(projectDir).isDirectory()).toBe(true);
  });

  it("produces a valid package.json with the project name", () => {
    const pkgPath = join(projectDir, "package.json");
    expect(existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      name: string;
      bin: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.name).toBe("e2e-test-cli");
    expect(pkg.bin["e2e-test-cli"]).toBe("./dist/cmd/index.js");
    expect(pkg.dependencies.commander).toBeDefined();
    expect(pkg.dependencies.pino).toBeDefined();
  });

  it("renders projectName into entry-point and CI smoke test", () => {
    const hello = readFileSync(join(projectDir, "src/cmd/hello.ts"), "utf-8");
    expect(hello).toContain('"Hello from e2e-test-cli\\n"');

    const ci = readFileSync(join(projectDir, ".github/workflows/ci.yml"), "utf-8");
    expect(ci).toContain('"Hello from e2e-test-cli"');
  });

  it("strips .hbs extensions in output (no leftover template files)", () => {
    expect(existsSync(join(projectDir, "package.json.hbs"))).toBe(false);
    expect(existsSync(join(projectDir, "src/cmd/index.ts.hbs"))).toBe(false);
    expect(existsSync(join(projectDir, "LICENSE.hbs"))).toBe(false);
  });

  it("preserves layered directory structure", () => {
    expect(statSync(join(projectDir, "src/cmd")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/common/errors")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/common/logger")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/config")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/domain")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/external")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/service")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, ".github/workflows")).isDirectory()).toBe(true);
  });
});
