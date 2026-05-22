import { describe, expect, it } from "vitest";
import { HarnessError } from "../../common/errors/index.js";
import type { FsAdapter } from "../../external/fs-adapter.js";
import { applyAstPatches } from "./ast-patcher.js";
import type { AstPatchDecl } from "./types.js";

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
      /* no-op */
    },
    writeFile(path: string, content: string): void {
      store[path] = content;
    },
    readFile(path: string): string {
      const c = store[path];
      if (c === undefined) throw new Error(`ENOENT: ${path}`);
      return c;
    },
    listDir(_path: string): readonly string[] {
      return [];
    },
    deleteFile(path: string): void {
      delete store[path];
    },
  };
}

const PROJECT_DIR = "/tmp/test-project";

// ---------------------------------------------------------------------------
// arrayPush
// ---------------------------------------------------------------------------

describe("applyAstPatches — arrayPush", () => {
  const FILE = "src/lib/nav-items.ts";
  const ABS = `${PROJECT_DIR}/${FILE}`;

  it("applyAstPatches_arrayPush_addsElement", () => {
    const original = `export const navItems = [{ label: 'Dashboard' }];\n`;
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "arrayPush", target: "navItems" },
      entryKey: "reports",
      content: "{ label: 'Reports', href: '/reports' }",
    };
    const result = applyAstPatches(PROJECT_DIR, [patch], fs);

    expect(result.applied).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(fs.store[ABS]).toContain("Reports");
    expect(fs.store[ABS]).toContain("/reports");
  });

  it("applyAstPatches_arrayPush_idempotent_entryKeyPresent_skipped", () => {
    const original =
      "export const navItems = [{ label: 'Reports', href: '/reports' }];\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "arrayPush", target: "navItems" },
      entryKey: "/reports",
      content: "{ label: 'Reports', href: '/reports' }",
    };
    const result = applyAstPatches(PROJECT_DIR, [patch], fs);

    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(fs.store[ABS]).toBe(original);
  });

  it("applyAstPatches_arrayPush_targetVarMissing_throwsHarnessError", () => {
    const original = "export const other = [];\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "arrayPush", target: "navItems" },
      entryKey: "x",
      content: "{}",
    };
    expect(() => applyAstPatches(PROJECT_DIR, [patch], fs)).toThrow(HarnessError);
  });

  it("applyAstPatches_arrayPush_targetNotArray_throwsHarnessError", () => {
    const original = "export const navItems = {};\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "arrayPush", target: "navItems" },
      entryKey: "x",
      content: "{}",
    };
    expect(() => applyAstPatches(PROJECT_DIR, [patch], fs)).toThrow(HarnessError);
  });
});

// ---------------------------------------------------------------------------
// objectKey
// ---------------------------------------------------------------------------

describe("applyAstPatches — objectKey", () => {
  const FILE = "src/lib/breadcrumb-map.ts";
  const ABS = `${PROJECT_DIR}/${FILE}`;

  it("applyAstPatches_objectKey_addsProperty", () => {
    const original = "export const breadcrumbMap = { dashboard: 'Dashboard' };\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "objectKey", target: "breadcrumbMap", key: "reports" },
      entryKey: "reports",
      content: "'Reports'",
    };
    const result = applyAstPatches(PROJECT_DIR, [patch], fs);

    expect(result.applied).toHaveLength(1);
    expect(fs.store[ABS]).toContain("reports");
    expect(fs.store[ABS]).toContain("'Reports'");
  });

  it("applyAstPatches_objectKey_idempotent_keyExists_skipped", () => {
    const original = "export const breadcrumbMap = { reports: 'Reports' };\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "objectKey", target: "breadcrumbMap", key: "reports" },
      entryKey: "reports",
      content: "'Reports'",
    };
    const result = applyAstPatches(PROJECT_DIR, [patch], fs);

    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(fs.store[ABS]).toBe(original);
  });

  it("applyAstPatches_objectKey_targetNotObject_throwsHarnessError", () => {
    const original = "export const breadcrumbMap = [];\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "objectKey", target: "breadcrumbMap", key: "x" },
      entryKey: "x",
      content: "'X'",
    };
    expect(() => applyAstPatches(PROJECT_DIR, [patch], fs)).toThrow(HarnessError);
  });
});

// ---------------------------------------------------------------------------
// importAdd
// ---------------------------------------------------------------------------

describe("applyAstPatches — importAdd", () => {
  const FILE = "src/cmd/index.ts";
  const ABS = `${PROJECT_DIR}/${FILE}`;

  it("applyAstPatches_importAdd_addsImport", () => {
    const original = "export const x = 1;\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "importAdd", from: "./reports.js" },
      entryKey: "reports",
      content: "import { reports } from './reports.js';",
    };
    const result = applyAstPatches(PROJECT_DIR, [patch], fs);

    expect(result.applied).toHaveLength(1);
    expect(fs.store[ABS]).toContain("import");
    expect(fs.store[ABS]).toContain("./reports.js");
  });

  it("applyAstPatches_importAdd_idempotent_sameFromPresent_skipped", () => {
    const original = "import { reports } from './reports.js';\nexport const x = 1;\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "importAdd", from: "./reports.js" },
      entryKey: "reports",
      content: "import { reports } from './reports.js';",
    };
    const result = applyAstPatches(PROJECT_DIR, [patch], fs);

    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(fs.store[ABS]).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// Multi-patch + caching + empty + file-missing
// ---------------------------------------------------------------------------

describe("applyAstPatches — multi-patch / caching / edge cases", () => {
  it("applyAstPatches_emptyPatches_noOp", () => {
    const fs = makeMemFs({});
    const result = applyAstPatches(PROJECT_DIR, [], fs);
    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it("applyAstPatches_fileMissing_throwsHarnessError", () => {
    const fs = makeMemFs({});
    const patch: AstPatchDecl = {
      file: "src/missing.ts",
      selector: { type: "arrayPush", target: "x" },
      entryKey: "y",
      content: "1",
    };
    expect(() => applyAstPatches(PROJECT_DIR, [patch], fs)).toThrow(HarnessError);
  });

  it("applyAstPatches_sameFileMultiPatch_cachedAndAllApplied", () => {
    const FILE = "src/lib/nav-items.ts";
    const ABS = `${PROJECT_DIR}/${FILE}`;
    const original = "export const navItems = [];\n";
    const fs = makeMemFs({ [ABS]: original });

    let readCount = 0;
    const wrappedFs: FsAdapter = {
      ...fs,
      readFile(p) {
        readCount++;
        return fs.readFile(p);
      },
    };

    const patches: AstPatchDecl[] = [
      {
        file: FILE,
        selector: { type: "arrayPush", target: "navItems" },
        entryKey: "a",
        content: "'a'",
      },
      {
        file: FILE,
        selector: { type: "arrayPush", target: "navItems" },
        entryKey: "b",
        content: "'b'",
      },
    ];
    const result = applyAstPatches(PROJECT_DIR, patches, wrappedFs);

    expect(result.applied).toHaveLength(2);
    // SourceFile 캐싱 → readFile 은 정확히 1번만 호출됐어야 함
    expect(readCount).toBe(1);
    expect(fs.store[ABS]).toContain("'a'");
    expect(fs.store[ABS]).toContain("'b'");
  });
});
