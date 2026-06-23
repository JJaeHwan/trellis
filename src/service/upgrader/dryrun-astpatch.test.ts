import { describe, expect, it } from "vitest";
import type { FsAdapter } from "../../external/fs-adapter.js";
import { applyManifest } from "./applier.js";
import type { MigrationManifest } from "./types.js";

function memFs(initial: Record<string, string> = {}): FsAdapter & { store: Record<string, string> } {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    exists: (p) => p in store,
    isDirectory: () => false,
    isEmptyDirectory: () => false,
    ensureDir: () => {},
    readFile: (p) => {
      if (!(p in store)) throw new Error(`ENOENT: ${p}`);
      return store[p]!;
    },
    writeFile: (p, c) => {
      store[p] = c;
    },
    listDir: () => [],
    deleteFile: (p) => {
      delete store[p];
    },
  };
}

function astManifest(entryKey: string): MigrationManifest {
  return {
    from: "0.1.0",
    to: "0.2.0",
    playbooks: {
      "cli-tool": {
        astPatches: [
          {
            file: "items.ts",
            selector: { type: "arrayPush", target: "items" },
            entryKey,
            content: '{ id: "b" }',
          },
        ],
      },
    },
  };
}

// Regression: previously dry-run marked ALL declared astPatches as "applied"
// without running the engine, so it over-reported changes a real run would skip
// and never surfaced target errors. Now dry-run runs ts-morph in-memory.
describe("upgrade dry-run astPatch fidelity", () => {
  it("dryRun_newEntry_reportsApplied_andDoesNotWrite", () => {
    const target = 'export const items = [\n  { id: "a" },\n];\n';
    const fs = memFs({ "/proj/items.ts": target });

    const result = applyManifest(astManifest("b"), "cli-tool", "/proj", fs, true);

    expect(result.astPatchesApplied).toHaveLength(1);
    expect(result.astPatchesSkipped).toHaveLength(0);
    expect(fs.store["/proj/items.ts"]).toBe(target); // not written in dry-run
  });

  it("dryRun_alreadyPresentEntry_reportsSkipped_notOverReported", () => {
    const target = 'export const items = [\n  { id: "b" },\n];\n';
    const fs = memFs({ "/proj/items.ts": target });

    const result = applyManifest(astManifest("b"), "cli-tool", "/proj", fs, true);

    // The key fix: dry-run now SKIPS the already-present entry instead of
    // blindly reporting it as applied.
    expect(result.astPatchesApplied).toHaveLength(0);
    expect(result.astPatchesSkipped).toHaveLength(1);
    expect(fs.store["/proj/items.ts"]).toBe(target);
  });
});
