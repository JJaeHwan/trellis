import { describe, expect, it } from "vitest";
import type { ProjectSpec } from "../../src/domain/index.js";
import type { FsAdapter } from "../../src/external/index.js";
import { scaffold } from "../../src/service/scaffolder/scaffolder.js";

class FakeFs implements FsAdapter {
  public files = new Map<string, string>();
  public dirs = new Set<string>();

  exists(path: string): boolean {
    return this.files.has(path) || this.dirs.has(path);
  }
  isDirectory(path: string): boolean {
    return this.dirs.has(path);
  }
  isEmptyDirectory(path: string): boolean {
    if (!this.dirs.has(path)) return false;
    const prefix = path.endsWith("/") ? path : path + "/";
    for (const f of this.files.keys()) {
      if (f.startsWith(prefix)) return false;
    }
    return true;
  }
  ensureDir(path: string): void {
    const parts = path.split("/").filter((p) => p.length > 0);
    const isAbs = path.startsWith("/");
    let acc = isAbs ? "" : ".";
    for (const part of parts) {
      acc = `${acc}/${part}`;
      this.dirs.add(acc);
    }
  }
  writeFile(path: string, content: string): void {
    this.files.set(path, content);
  }
  readFile(path: string): string {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`File not found: ${path}`);
    return content;
  }
  listDir(path: string): readonly string[] {
    const prefix = path.endsWith("/") ? path : path + "/";
    const entries = new Set<string>();
    for (const f of this.files.keys()) {
      if (f.startsWith(prefix)) {
        const rest = f.slice(prefix.length);
        const name = rest.split("/")[0];
        if (name) entries.add(name);
      }
    }
    for (const d of this.dirs) {
      if (d.startsWith(prefix)) {
        const rest = d.slice(prefix.length);
        const name = rest.split("/")[0];
        if (name) entries.add(name);
      }
    }
    return [...entries];
  }
}

const FIXED_SPEC: ProjectSpec = {
  projectName: "golden-spec-test",
  rootPath: "/ROOTPATH_PLACEHOLDER",
  playbookId: "cli-tool",
  matchMode: "exact",
  matchScore: 1,
  answers: [
    { questionId: "1", selectedOptionId: "B" },
    { questionId: "2", selectedOptionId: "A" },
  ],
  placeholders: {},
  generatedAt: "2026-01-01T00:00:00.000Z",
  trellisVersion: "0.0.0-golden",
};

/** rootPath/generatedAt/trellisVersion 같은 휘발성 필드를 고정값으로 치환한다. */
function normalizeSpec(raw: string): string {
  return raw
    .replace(/"rootPath":\s*"[^"]*"/, '"rootPath": "/ROOTPATH_PLACEHOLDER"')
    .replace(
      /"generatedAt":\s*"[^"]*"/,
      '"generatedAt": "2026-01-01T00:00:00.000Z"',
    )
    .replace(/"trellisVersion":\s*"[^"]*"/, '"trellisVersion": "0.0.0-golden"');
}

describe("golden — scaffold writes .trellis/spec.json", () => {
  it("includes .trellis/spec.json in the returned tree (dryRun)", () => {
    const tree = scaffold(FIXED_SPEC, { dryRun: true });

    const specFile = tree.find((f) => f.path === ".trellis/spec.json");
    expect(specFile).toBeDefined();
  });

  it(".trellis/spec.json contains valid JSON with required fields", () => {
    const tree = scaffold(FIXED_SPEC, { dryRun: true });

    const specFile = tree.find((f) => f.path === ".trellis/spec.json");
    expect(specFile).toBeDefined();

    const parsed = JSON.parse(specFile!.content) as Record<string, unknown>;
    expect(parsed["playbookId"]).toBe("cli-tool");
    expect(parsed["projectName"]).toBe("golden-spec-test");
    expect(Array.isArray(parsed["answers"])).toBe(true);
    expect(parsed["matchMode"]).toBe("exact");
    expect(parsed["matchScore"]).toBe(1);
    expect(typeof parsed["rootPath"]).toBe("string");
    expect(typeof parsed["generatedAt"]).toBe("string");
    expect(typeof parsed["trellisVersion"]).toBe("string");
  });

  it(".trellis/spec.json content matches snapshot (volatile fields normalized)", () => {
    const tree = scaffold(FIXED_SPEC, { dryRun: true });

    const specFile = tree.find((f) => f.path === ".trellis/spec.json");
    expect(specFile).toBeDefined();

    const normalized = normalizeSpec(specFile!.content);
    expect(normalized).toMatchSnapshot();
  });

  it("writes .trellis/spec.json to disk in non-dryRun mode", () => {
    const fs = new FakeFs();
    scaffold(FIXED_SPEC, { dryRun: false }, fs);

    const specPath = "/ROOTPATH_PLACEHOLDER/.trellis/spec.json";
    expect(fs.files.has(specPath)).toBe(true);

    const content = fs.files.get(specPath)!;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    expect(parsed["playbookId"]).toBe("cli-tool");
    expect(parsed["projectName"]).toBe("golden-spec-test");
  });

  it("spec.json content ends with a newline", () => {
    const tree = scaffold(FIXED_SPEC, { dryRun: true });

    const specFile = tree.find((f) => f.path === ".trellis/spec.json");
    expect(specFile).toBeDefined();
    expect(specFile!.content.endsWith("\n")).toBe(true);
  });
});
