import { describe, expect, it } from "vitest";
import { HarnessError } from "../../common/errors/index.js";
import type { FsAdapter } from "../../external/fs-adapter.js";
import type { FragmentMeta } from "./types.js";
import { patchPackageJson } from "./dep-patcher.js";

// ---------------------------------------------------------------------------
// In-memory FsAdapter
// ---------------------------------------------------------------------------

function makeMemFs(files: Record<string, string> = {}): FsAdapter & {
  store: Record<string, string>;
} {
  const store = { ...files };
  return {
    store,
    exists(path: string): boolean {
      return path in store;
    },
    isDirectory(_path: string): boolean {
      return false;
    },
    isEmptyDirectory(_path: string): boolean {
      return false;
    },
    ensureDir(_path: string): void {
      // no-op
    },
    writeFile(path: string, content: string): void {
      store[path] = content;
    },
    readFile(path: string): string {
      const content = store[path];
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    listDir(_path: string): readonly string[] {
      return [];
    },
  };
}

const PROJECT_DIR = "/tmp/test-project";
const PKG_PATH = `${PROJECT_DIR}/package.json`;

function makeMeta(
  opts: Partial<Pick<FragmentMeta, "dependencies" | "devDependencies">> = {},
): FragmentMeta {
  return { description: "test fragment", ...opts };
}

function makePkg(
  deps: Record<string, string> = {},
  devDeps: Record<string, string> = {},
): string {
  const pkg: Record<string, unknown> = { name: "test-project", version: "1.0.0" };
  if (Object.keys(deps).length > 0) pkg["dependencies"] = deps;
  if (Object.keys(devDeps).length > 0) pkg["devDependencies"] = devDeps;
  return JSON.stringify(pkg, null, 2) + "\n";
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("patchPackageJson", () => {
  it("patchPackageJson_noPkgJson_throwsHarnessError", () => {
    const fs = makeMemFs();
    const meta = makeMeta({ dependencies: { express: "^4.18.0" } });

    expect(() => patchPackageJson(PROJECT_DIR, meta, fs)).toThrow(HarnessError);
    expect(() => patchPackageJson(PROJECT_DIR, meta, fs)).toThrowError(
      /package\.json not found/,
    );
  });

  it("patchPackageJson_noPkgJson_exitCode3", () => {
    const fs = makeMemFs();
    const meta = makeMeta({ dependencies: { express: "^4.18.0" } });

    try {
      patchPackageJson(PROJECT_DIR, meta, fs);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HarnessError);
      expect((err as HarnessError).exitCode).toBe(3);
    }
  });

  it("patchPackageJson_invalidJson_throwsHarnessError", () => {
    const fs = makeMemFs({ [PKG_PATH]: "{ not valid json" });
    const meta = makeMeta({ dependencies: { express: "^4.18.0" } });

    expect(() => patchPackageJson(PROJECT_DIR, meta, fs)).toThrow(HarnessError);
  });

  it("patchPackageJson_noDepsInMeta_noOp", () => {
    const fs = makeMemFs({ [PKG_PATH]: makePkg() });
    const meta = makeMeta();

    const result = patchPackageJson(PROJECT_DIR, meta, fs);

    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.conflicts).toEqual([]);
    // package.json should not be rewritten
    expect(fs.store[PKG_PATH]).toBe(makePkg());
  });

  it("patchPackageJson_emptyDepsInMeta_noOp", () => {
    const fs = makeMemFs({ [PKG_PATH]: makePkg() });
    const meta = makeMeta({ dependencies: {}, devDependencies: {} });

    const result = patchPackageJson(PROJECT_DIR, meta, fs);

    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it("patchPackageJson_newDep_addedToPkgJson", () => {
    const fs = makeMemFs({ [PKG_PATH]: makePkg() });
    const meta = makeMeta({ dependencies: { express: "^4.18.0" } });

    const result = patchPackageJson(PROJECT_DIR, meta, fs);

    expect(result.added).toEqual(["express"]);
    expect(result.skipped).toEqual([]);
    expect(result.conflicts).toEqual([]);

    const written = JSON.parse(fs.store[PKG_PATH] as string) as Record<string, unknown>;
    expect((written["dependencies"] as Record<string, string>)["express"]).toBe("^4.18.0");
  });

  it("patchPackageJson_sameVersionExists_skipped", () => {
    const fs = makeMemFs({ [PKG_PATH]: makePkg({ express: "^4.18.0" }) });
    const meta = makeMeta({ dependencies: { express: "^4.18.0" } });

    const result = patchPackageJson(PROJECT_DIR, meta, fs);

    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["express"]);
    expect(result.conflicts).toEqual([]);
  });

  it("patchPackageJson_differentVersionExists_conflict", () => {
    const fs = makeMemFs({ [PKG_PATH]: makePkg({ express: "^4.17.0" }) });
    const meta = makeMeta({ dependencies: { express: "^4.18.0" } });

    const result = patchPackageJson(PROJECT_DIR, meta, fs);

    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.conflicts).toEqual([
      { name: "express", existing: "^4.17.0", requested: "^4.18.0" },
    ]);

    // existing version must be preserved
    const written = JSON.parse(fs.store[PKG_PATH] as string) as Record<string, unknown>;
    expect((written["dependencies"] as Record<string, string>)["express"]).toBe("^4.17.0");
  });

  it("patchPackageJson_depsAndDevDepsTogether_bothProcessed", () => {
    const fs = makeMemFs({
      [PKG_PATH]: makePkg({ react: "^18.0.0" }, { vitest: "^1.0.0" }),
    });
    const meta = makeMeta({
      dependencies: { react: "^18.0.0", axios: "^1.6.0" },
      devDependencies: { vitest: "^2.0.0", typescript: "^5.0.0" },
    });

    const result = patchPackageJson(PROJECT_DIR, meta, fs);

    // react: same version → skipped
    expect(result.skipped).toContain("react");
    // axios: new → added
    expect(result.added).toContain("axios");
    // vitest: different version → conflict
    expect(result.conflicts).toContainEqual({
      name: "vitest",
      existing: "^1.0.0",
      requested: "^2.0.0",
    });
    // typescript: new devDep → added
    expect(result.added).toContain("typescript");

    const written = JSON.parse(fs.store[PKG_PATH] as string) as Record<string, unknown>;
    const deps = written["dependencies"] as Record<string, string>;
    const devDeps = written["devDependencies"] as Record<string, string>;
    expect(deps["axios"]).toBe("^1.6.0");
    expect(devDeps["typescript"]).toBe("^5.0.0");
    expect(devDeps["vitest"]).toBe("^1.0.0"); // unchanged
  });

  it("patchPackageJson_indentationAndTrailingNewlinePreserved", () => {
    const original = makePkg(); // JSON.stringify(pkg, null, 2) + "\n"
    const fs = makeMemFs({ [PKG_PATH]: original });
    const meta = makeMeta({ dependencies: { lodash: "^4.17.21" } });

    patchPackageJson(PROJECT_DIR, meta, fs);

    const written = fs.store[PKG_PATH] as string;
    // must end with newline
    expect(written.endsWith("\n")).toBe(true);
    // must use 2-space indent
    expect(written).toContain('  "dependencies"');
  });

  it("patchPackageJson_noCrossSection_depNotMovedToDevDeps", () => {
    // express is in dependencies in pkg, but meta lists it in devDependencies
    const fs = makeMemFs({
      [PKG_PATH]: makePkg({ express: "^4.18.0" }),
    });
    const meta = makeMeta({ devDependencies: { express: "^4.18.0" } });

    const result = patchPackageJson(PROJECT_DIR, meta, fs);

    // express in devDeps of meta: pkg has no devDeps section, so it gets added there
    // But the existing express in deps section remains untouched
    const written = JSON.parse(fs.store[PKG_PATH] as string) as Record<string, unknown>;
    const deps = written["dependencies"] as Record<string, string>;
    const devDeps = written["devDependencies"] as Record<string, string>;

    // original deps entry must remain
    expect(deps["express"]).toBe("^4.18.0");
    // devDeps gets its own entry (no cross-move)
    expect(devDeps["express"]).toBe("^4.18.0");
    expect(result.added).toContain("express");
  });
});
