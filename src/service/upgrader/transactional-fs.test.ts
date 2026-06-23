import { describe, expect, it } from "vitest";
import { HarnessError } from "../../common/errors/index.js";
import type { FsAdapter } from "../../external/fs-adapter.js";
import { applyManifest } from "./applier.js";
import type { MigrationManifest } from "./types.js";
import { createTransactionalFs } from "./transactional-fs.js";

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

describe("createTransactionalFs", () => {
  it("rollback_restoresModifiedFileToOriginal", () => {
    const fs = memFs({ "/a.ts": "original" });
    const tx = createTransactionalFs(fs);
    tx.writeFile("/a.ts", "changed");
    expect(fs.store["/a.ts"]).toBe("changed");
    tx.rollback();
    expect(fs.store["/a.ts"]).toBe("original");
  });

  it("rollback_deletesNewlyCreatedFile", () => {
    const fs = memFs({});
    const tx = createTransactionalFs(fs);
    tx.writeFile("/new.ts", "x");
    expect(fs.exists("/new.ts")).toBe(true);
    tx.rollback();
    expect(fs.exists("/new.ts")).toBe(false);
  });

  it("rollback_usesPreFirstWriteBackup_forMultipleWrites", () => {
    const fs = memFs({ "/a.ts": "v0" });
    const tx = createTransactionalFs(fs);
    tx.writeFile("/a.ts", "v1");
    tx.writeFile("/a.ts", "v2");
    tx.rollback();
    expect(fs.store["/a.ts"]).toBe("v0");
  });

  it("withoutRollback_writesPersist", () => {
    const fs = memFs({ "/a.ts": "v0" });
    const tx = createTransactionalFs(fs);
    tx.writeFile("/a.ts", "v1");
    expect(fs.store["/a.ts"]).toBe("v1");
  });
});

describe("applyManifest rollback (multi-slot, second fails)", () => {
  it("applyManifest_failingSecondSlot_rollbackRestoresFirst", () => {
    const fs = memFs({
      "/proj/a.ts": "ANCHOR_A\n",
      "/proj/b.ts": "no anchor here\n",
    });
    const tx = createTransactionalFs(fs);
    const manifest: MigrationManifest = {
      from: "0.1.0",
      to: "0.2.0",
      playbooks: {
        "cli-tool": {
          addSlots: [
            { file: "a.ts", slot: "s1", afterLine: "ANCHOR_A" },
            { file: "b.ts", slot: "s2", afterLine: "MISSING_ANCHOR" },
          ],
        },
      },
    };

    // First slot writes a.ts, second throws on the missing anchor.
    expect(() => applyManifest(manifest, "cli-tool", "/proj", tx, false)).toThrow(HarnessError);
    expect(fs.store["/proj/a.ts"]).not.toBe("ANCHOR_A\n"); // partially applied before throw

    tx.rollback();
    expect(fs.store["/proj/a.ts"]).toBe("ANCHOR_A\n"); // restored
    expect(fs.store["/proj/b.ts"]).toBe("no anchor here\n"); // untouched
  });
});
