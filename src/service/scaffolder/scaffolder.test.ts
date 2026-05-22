import { describe, expect, it } from "vitest";
import type { ProjectSpec } from "../../domain/index.js";
import type { FsAdapter } from "../../external/index.js";
import { scaffold } from "./scaffolder.js";

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
  deleteFile(path: string): void {
    this.files.delete(path);
  }
}

const baseSpec: ProjectSpec = {
  projectName: "scaffold-test",
  rootPath: "/tmp/scaffold-test",
  playbookId: "cli-tool",
  matchMode: "exact",
  matchScore: 1,
  answers: [
    { questionId: "1", selectedOptionId: "B" },
    { questionId: "2", selectedOptionId: "A" },
  ],
  placeholders: {},
  generatedAt: "2026-04-27T00:00:00.000Z",
  trellisVersion: "0.0.0-test",
};

describe("scaffold", () => {
  it("returns rendered tree without writing in dry-run mode", () => {
    const fs = new FakeFs();
    const tree = scaffold(baseSpec, { dryRun: true }, fs);

    expect(tree.length).toBeGreaterThan(0);
    expect(fs.files.size).toBe(0);
  });

  it("writes templates to fs in non-dry-run mode", () => {
    const fs = new FakeFs();
    const tree = scaffold(baseSpec, { dryRun: false }, fs);

    expect(fs.files.size).toBe(tree.length);
    expect(fs.files.has("/tmp/scaffold-test/package.json")).toBe(true);
    expect(fs.files.has("/tmp/scaffold-test/src/cmd/index.ts")).toBe(true);
  });

  it("renders projectName into output content", () => {
    const fs = new FakeFs();
    scaffold(baseSpec, { dryRun: false }, fs);
    const pkg = fs.files.get("/tmp/scaffold-test/package.json");
    expect(pkg).toBeDefined();
    expect(JSON.parse(pkg!).name).toBe("scaffold-test");
  });
});
