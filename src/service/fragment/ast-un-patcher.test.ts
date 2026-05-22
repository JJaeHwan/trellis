import { describe, expect, it } from "vitest";
import type { FsAdapter } from "../../external/fs-adapter.js";
import { applyAstPatches } from "./ast-patcher.js";
import { removeAstPatches } from "./ast-un-patcher.js";
import type { AstPatchDecl } from "./types.js";

function makeMemFs(files: Record<string, string> = {}): FsAdapter & {
  store: Record<string, string>;
} {
  const store = { ...files };
  return {
    store,
    exists(p) {
      return p in store;
    },
    isDirectory() {
      return false;
    },
    isEmptyDirectory() {
      return false;
    },
    ensureDir() {
      /* no-op */
    },
    writeFile(p, c) {
      store[p] = c;
    },
    readFile(p) {
      const c = store[p];
      if (c === undefined) throw new Error(`ENOENT: ${p}`);
      return c;
    },
    listDir() {
      return [];
    },
    deleteFile(p) {
      delete store[p];
    },
  };
}

const PROJECT_DIR = "/tmp/test-project";

describe("removeAstPatches — arrayPush", () => {
  const FILE = "src/lib/nav-items.ts";
  const ABS = `${PROJECT_DIR}/${FILE}`;

  it("removeAstPatches_arrayPush_removesMatchingElement", () => {
    const original =
      "export const navItems = [{ label: 'Reports', href: '/reports' }];\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "arrayPush", target: "navItems" },
      entryKey: "/reports",
      content: "{ label: 'Reports', href: '/reports' }",
    };
    const result = removeAstPatches(PROJECT_DIR, [patch], fs);

    expect(result.removed).toHaveLength(1);
    expect(fs.store[ABS]).not.toContain("Reports");
  });

  it("removeAstPatches_arrayPush_alreadyAbsent_notFound", () => {
    const original = "export const navItems = [];\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "arrayPush", target: "navItems" },
      entryKey: "x",
      content: "'x'",
    };
    const result = removeAstPatches(PROJECT_DIR, [patch], fs);

    expect(result.removed).toHaveLength(0);
    expect(result.notFound).toHaveLength(1);
    expect(fs.store[ABS]).toBe(original);
  });

  it("removeAstPatches_arrayPush_targetVarMissing_notFound_noThrow", () => {
    const original = "export const other = [];\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "arrayPush", target: "navItems" },
      entryKey: "x",
      content: "'x'",
    };
    expect(() => removeAstPatches(PROJECT_DIR, [patch], fs)).not.toThrow();
    const result = removeAstPatches(PROJECT_DIR, [patch], fs);
    expect(result.notFound).toHaveLength(1);
  });
});

describe("removeAstPatches — objectKey", () => {
  const FILE = "src/lib/breadcrumb-map.ts";
  const ABS = `${PROJECT_DIR}/${FILE}`;

  it("removeAstPatches_objectKey_removesProperty", () => {
    const original = "export const breadcrumbMap = { reports: 'Reports' };\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "objectKey", target: "breadcrumbMap", key: "reports" },
      entryKey: "reports",
      content: "'Reports'",
    };
    const result = removeAstPatches(PROJECT_DIR, [patch], fs);
    expect(result.removed).toHaveLength(1);
    expect(fs.store[ABS]).not.toContain("reports");
  });

  it("removeAstPatches_objectKey_keyAbsent_notFound", () => {
    const original = "export const breadcrumbMap = {};\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "objectKey", target: "breadcrumbMap", key: "reports" },
      entryKey: "reports",
      content: "'Reports'",
    };
    const result = removeAstPatches(PROJECT_DIR, [patch], fs);
    expect(result.notFound).toHaveLength(1);
    expect(fs.store[ABS]).toBe(original);
  });
});

describe("removeAstPatches — importAdd", () => {
  const FILE = "src/cmd/index.ts";
  const ABS = `${PROJECT_DIR}/${FILE}`;

  it("removeAstPatches_importAdd_removesDecl", () => {
    const original =
      "import { reports } from './reports.js';\nexport const x = 1;\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "importAdd", from: "./reports.js" },
      entryKey: "reports",
      content: "import { reports } from './reports.js';",
    };
    const result = removeAstPatches(PROJECT_DIR, [patch], fs);
    expect(result.removed).toHaveLength(1);
    expect(fs.store[ABS]).not.toContain("./reports.js");
  });

  it("removeAstPatches_importAdd_fromAbsent_notFound", () => {
    const original = "export const x = 1;\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "importAdd", from: "./reports.js" },
      entryKey: "reports",
      content: "import { reports } from './reports.js';",
    };
    const result = removeAstPatches(PROJECT_DIR, [patch], fs);
    expect(result.notFound).toHaveLength(1);
    expect(fs.store[ABS]).toBe(original);
  });
});

describe("removeAstPatches — edge cases", () => {
  it("removeAstPatches_fileMissing_notFound", () => {
    const fs = makeMemFs({});
    const patch: AstPatchDecl = {
      file: "src/missing.ts",
      selector: { type: "arrayPush", target: "x" },
      entryKey: "y",
      content: "1",
    };
    const result = removeAstPatches(PROJECT_DIR, [patch], fs);
    expect(result.notFound).toHaveLength(1);
    expect(result.removed).toHaveLength(0);
  });

  it("removeAstPatches_emptyPatches_noOp", () => {
    const fs = makeMemFs({});
    const result = removeAstPatches(PROJECT_DIR, [], fs);
    expect(result.removed).toHaveLength(0);
    expect(result.notFound).toHaveLength(0);
  });
});

describe("applyAstPatches → removeAstPatches roundtrip", () => {
  it("roundtrip_arrayPush_restoresOriginal", () => {
    const FILE = "src/lib/nav-items.ts";
    const ABS = `${PROJECT_DIR}/${FILE}`;
    const original = "export const navItems = [{ label: 'Dashboard' }];\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "arrayPush", target: "navItems" },
      entryKey: "/reports",
      content: "{ label: 'Reports', href: '/reports' }",
    };

    applyAstPatches(PROJECT_DIR, [patch], fs);
    expect(fs.store[ABS]).toContain("Reports");

    removeAstPatches(PROJECT_DIR, [patch], fs);
    // 핵심: Reports 요소가 사라져야 함
    expect(fs.store[ABS]).not.toContain("Reports");
    // 원본의 Dashboard 는 여전히 존재
    expect(fs.store[ABS]).toContain("Dashboard");
  });

  it("roundtrip_objectKey_restoresOriginal", () => {
    const FILE = "src/lib/breadcrumb-map.ts";
    const ABS = `${PROJECT_DIR}/${FILE}`;
    const original = "export const breadcrumbMap = { dashboard: 'Dashboard' };\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "objectKey", target: "breadcrumbMap", key: "reports" },
      entryKey: "reports",
      content: "'Reports'",
    };

    applyAstPatches(PROJECT_DIR, [patch], fs);
    expect(fs.store[ABS]).toContain("reports");

    removeAstPatches(PROJECT_DIR, [patch], fs);
    expect(fs.store[ABS]).not.toContain("reports");
    expect(fs.store[ABS]).toContain("dashboard");
  });

  it("roundtrip_importAdd_restoresOriginal", () => {
    const FILE = "src/cmd/index.ts";
    const ABS = `${PROJECT_DIR}/${FILE}`;
    const original = "export const x = 1;\n";
    const fs = makeMemFs({ [ABS]: original });

    const patch: AstPatchDecl = {
      file: FILE,
      selector: { type: "importAdd", from: "./reports.js" },
      entryKey: "reports",
      content: "import { reports } from './reports.js';",
    };

    applyAstPatches(PROJECT_DIR, [patch], fs);
    expect(fs.store[ABS]).toContain("./reports.js");

    removeAstPatches(PROJECT_DIR, [patch], fs);
    expect(fs.store[ABS]).not.toContain("./reports.js");
  });
});
