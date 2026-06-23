import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HarnessError } from "../common/errors/index.js";
import { resolveResourcesDir, resolveResourcesRoot } from "./resources-root.js";

describe("resolveResourcesRoot", () => {
  it("resolveResourcesRoot_returnsExistingResourcesDir", () => {
    const root = resolveResourcesRoot();
    expect(existsSync(root)).toBe(true);
    expect(root.endsWith("resources")).toBe(true);
  });

  it("resolveResourcesRoot_containsTheBundledSubdirs", () => {
    const root = resolveResourcesRoot();
    expect(existsSync(resolve(root, "templates"))).toBe(true);
    expect(existsSync(resolve(root, "migrations"))).toBe(true);
    expect(existsSync(resolve(root, "playbooks"))).toBe(true);
  });

  it("resolveResourcesDir_joinsSubdir", () => {
    expect(resolveResourcesDir("migrations")).toBe(
      resolve(resolveResourcesRoot(), "migrations"),
    );
  });

  it("resolveResourcesRoot_throwsHarnessError_whenNoResourcesAboveFromUrl", () => {
    // A file:// URL at the filesystem root has no `resources/` ancestor.
    expect(() => resolveResourcesRoot("file:///nonexistent-xyz/a/b/c.js")).toThrow(
      HarnessError,
    );
  });
});
