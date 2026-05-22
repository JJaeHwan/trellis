import { describe, expect, it } from "vitest";
import {
  findExportedVariable,
  findImportSpecifier,
  parseSourceFile,
} from "./ast-parser.js";

describe("parseSourceFile", () => {
  it("parseSourceFile_validTs_returnsSourceFile", () => {
    const sf = parseSourceFile("export const x = 1;\n", "virtual.ts");
    expect(sf.getFilePath()).toContain("virtual.ts");
    expect(sf.getFullText()).toBe("export const x = 1;\n");
  });

  it("parseSourceFile_inMemory_doesNotAccessDisk", () => {
    // 상상의 경로 — 디스크에 절대 존재하지 않는다
    const sf = parseSourceFile("const y = 2;", "/totally/fake/path/virtual.ts");
    expect(sf.getFullText()).toBe("const y = 2;");
  });

  it("parseSourceFile_emptyContent_returnsEmptySourceFile", () => {
    const sf = parseSourceFile("", "empty.ts");
    expect(sf.getFullText()).toBe("");
  });
});

describe("findExportedVariable", () => {
  it("findExportedVariable_exportConst_returnsDecl", () => {
    const sf = parseSourceFile(
      "export const navItems = [1, 2, 3];\n",
      "x.ts",
    );
    const decl = findExportedVariable(sf, "navItems");
    expect(decl).toBeDefined();
    expect(decl?.getName()).toBe("navItems");
  });

  it("findExportedVariable_exportLet_returnsDecl", () => {
    const sf = parseSourceFile("export let foo = {};\n", "x.ts");
    const decl = findExportedVariable(sf, "foo");
    expect(decl).toBeDefined();
  });

  it("findExportedVariable_notExported_returnsUndefined", () => {
    const sf = parseSourceFile("const internal = 1;\n", "x.ts");
    expect(findExportedVariable(sf, "internal")).toBeUndefined();
  });

  it("findExportedVariable_otherName_returnsUndefined", () => {
    const sf = parseSourceFile("export const a = 1;\n", "x.ts");
    expect(findExportedVariable(sf, "b")).toBeUndefined();
  });
});

describe("findImportSpecifier", () => {
  it("findImportSpecifier_existingFrom_returnsImport", () => {
    const sf = parseSourceFile(
      "import { foo } from './foo';\nexport const x = foo;\n",
      "x.ts",
    );
    const decl = findImportSpecifier(sf, "./foo");
    expect(decl).toBeDefined();
    expect(decl?.getModuleSpecifierValue()).toBe("./foo");
  });

  it("findImportSpecifier_missingFrom_returnsUndefined", () => {
    const sf = parseSourceFile(
      "import { foo } from './foo';\n",
      "x.ts",
    );
    expect(findImportSpecifier(sf, "./bar")).toBeUndefined();
  });

  it("findImportSpecifier_noImports_returnsUndefined", () => {
    const sf = parseSourceFile("export const x = 1;\n", "x.ts");
    expect(findImportSpecifier(sf, "./foo")).toBeUndefined();
  });
});
