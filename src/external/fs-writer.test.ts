import { describe, expect, it } from "vitest";
import type { VirtualTree } from "../domain/index.js";
import type { FsAdapter } from "./fs-adapter.js";
import { flush } from "./fs-writer.js";

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
    for (const d of this.dirs) {
      if (d !== path && d.startsWith(prefix)) return false;
    }
    return true;
  }
  ensureDir(path: string): void {
    // Match realFsAdapter (mkdir recursive): creates all intermediate dirs.
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
}

describe("flush", () => {
  it("writes tree files into target directory", () => {
    const fs = new FakeFs();
    const tree: VirtualTree = [
      { path: "package.json", content: "{}" },
      { path: "src/index.ts", content: "export {}" },
    ];
    flush(tree, "/tmp/target", {}, fs);

    expect(fs.files.get("/tmp/target/package.json")).toBe("{}");
    expect(fs.files.get("/tmp/target/src/index.ts")).toBe("export {}");
    expect(fs.dirs.has("/tmp/target")).toBe(true);
    expect(fs.dirs.has("/tmp/target/src")).toBe(true);
  });

  it("creates target dir when it does not exist", () => {
    const fs = new FakeFs();
    flush([{ path: "a.txt", content: "a" }], "/tmp/new-dir", {}, fs);
    expect(fs.dirs.has("/tmp/new-dir")).toBe(true);
    expect(fs.files.get("/tmp/new-dir/a.txt")).toBe("a");
  });

  it("throws when target path is a regular file", () => {
    const fs = new FakeFs();
    fs.files.set("/tmp/target", "not a dir");
    expect(() => flush([], "/tmp/target", {}, fs)).toThrow(/파일입니다/);
  });

  it("throws when target dir is non-empty without --force", () => {
    const fs = new FakeFs();
    fs.dirs.add("/tmp/target");
    fs.files.set("/tmp/target/existing.txt", "x");
    expect(() =>
      flush([{ path: "a.txt", content: "a" }], "/tmp/target", {}, fs),
    ).toThrow(/비어있지 않습니다/);
  });

  it("allows overwrite with force=true", () => {
    const fs = new FakeFs();
    fs.dirs.add("/tmp/target");
    fs.files.set("/tmp/target/existing.txt", "old");
    flush(
      [{ path: "existing.txt", content: "new" }],
      "/tmp/target",
      { force: true },
      fs,
    );
    expect(fs.files.get("/tmp/target/existing.txt")).toBe("new");
  });

  it("ensures parent directories before writing nested files", () => {
    const fs = new FakeFs();
    flush(
      [{ path: "deep/nested/file.txt", content: "x" }],
      "/tmp/target",
      {},
      fs,
    );
    expect(fs.dirs.has("/tmp/target/deep")).toBe(true);
    expect(fs.dirs.has("/tmp/target/deep/nested")).toBe(true);
    expect(fs.files.get("/tmp/target/deep/nested/file.txt")).toBe("x");
  });
});
