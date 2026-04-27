import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectLanguage } from "./lang-detector.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "trellis-lang-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("detectLanguage", () => {
  it("detects ts-js from package.json", () => {
    writeFileSync(join(dir, "package.json"), "{}");
    expect(detectLanguage(dir)).toBe("ts-js");
  });

  it("detects java from pom.xml", () => {
    writeFileSync(join(dir, "pom.xml"), "<project/>");
    expect(detectLanguage(dir)).toBe("java");
  });

  it("detects java from build.gradle.kts", () => {
    writeFileSync(join(dir, "build.gradle.kts"), "");
    expect(detectLanguage(dir)).toBe("java");
  });

  it("detects python from pyproject.toml", () => {
    writeFileSync(join(dir, "pyproject.toml"), "");
    expect(detectLanguage(dir)).toBe("python");
  });

  it("detects go from go.mod", () => {
    writeFileSync(join(dir, "go.mod"), "module x");
    expect(detectLanguage(dir)).toBe("go");
  });

  it("returns unknown when no manifest exists", () => {
    expect(detectLanguage(dir)).toBe("unknown");
  });

  it("prefers ts-js when multiple manifests are present", () => {
    writeFileSync(join(dir, "package.json"), "{}");
    writeFileSync(join(dir, "go.mod"), "module x");
    expect(detectLanguage(dir)).toBe("ts-js");
  });
});
