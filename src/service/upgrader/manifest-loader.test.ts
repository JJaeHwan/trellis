import { describe, expect, it } from "vitest";
import { HarnessError } from "../../common/errors/index.js";
import type { FsAdapter } from "../../external/fs-adapter.js";
import { listManifests, loadManifest } from "./manifest-loader.js";

// ---------------------------------------------------------------------------
// Fake FsAdapter for manifest tests
// ---------------------------------------------------------------------------

function makeFakeFs(files: Record<string, string>): FsAdapter {
  const store = { ...files };
  return {
    exists(path: string): boolean {
      if (path in store) return true;
      return Object.keys(store).some((k) => k.startsWith(path + "/"));
    },
    isDirectory(path: string): boolean {
      return Object.keys(store).some((k) => k.startsWith(path + "/"));
    },
    isEmptyDirectory(path: string): boolean {
      return Object.keys(store).filter((k) => k.startsWith(path + "/")).length === 0;
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
    listDir(path: string): readonly string[] {
      const prefix = path + "/";
      const entries = new Set<string>();
      for (const key of Object.keys(store)) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const seg = rest.split("/")[0];
          if (seg !== undefined && seg !== "") entries.add(seg);
        }
      }
      return [...entries];
    },
    deleteFile(path: string): void {
      delete store[path];
    },
  };
}

const VALID_MANIFEST = JSON.stringify({
  from: "0.9.0",
  to: "0.10.0",
  playbooks: {
    "cli-tool": {
      addSlots: [
        {
          file: "src/cmd/index.ts",
          slot: "imports",
          afterLine: 'import { registerHelloCommand } from "./hello.js";',
        },
        {
          file: "src/cmd/index.ts",
          slot: "commands",
          afterLine: "  registerHelloCommand(program);",
          indent: "  ",
        },
      ],
    },
  },
});

// Compute path suffix that manifest-loader would use (mirrors getMigrationsRoot logic)
// We use a path that includes the migrations suffix so our fake matches
const MIGRATIONS_SUFFIX = "resources/migrations";

function makeMigrationsFs(
  manifests: Record<string, string>,
  extraFiles: Record<string, string> = {},
): FsAdapter {
  // Build a file map where paths end with resources/migrations/<filename>
  const files: Record<string, string> = { ...extraFiles };
  for (const [filename, content] of Object.entries(manifests)) {
    files[`${MIGRATIONS_SUFFIX}/${filename}`] = content;
  }
  const base = makeFakeFs(files);

  // Wrap to intercept path checks: manifest-loader uses absolute paths from fileURLToPath
  // We wrap exists/readFile/listDir to match by suffix
  return {
    exists(path: string): boolean {
      if (base.exists(path)) return true;
      // Check if any store key ends with the relevant suffix
      for (const key of Object.keys(files)) {
        if (path.endsWith(key)) return true;
      }
      // Check directory existence for migrations root
      if (path.endsWith(MIGRATIONS_SUFFIX)) return true;
      return false;
    },
    isDirectory(path: string): boolean {
      if (base.isDirectory(path)) return true;
      if (path.endsWith(MIGRATIONS_SUFFIX)) return true;
      return false;
    },
    isEmptyDirectory(path: string): boolean {
      return base.isEmptyDirectory(path);
    },
    ensureDir(path: string): void {
      base.ensureDir(path);
    },
    writeFile(path: string, content: string): void {
      base.writeFile(path, content);
    },
    readFile(path: string): string {
      // Try direct lookup first
      try {
        return base.readFile(path);
      } catch {
        // Fall back: find a file whose key is a suffix of path
        for (const [key, content] of Object.entries(files)) {
          if (path.endsWith(key)) return content;
        }
        throw new Error(`ENOENT: ${path}`);
      }
    },
    listDir(path: string): readonly string[] {
      // If path ends with migrations root, return file names
      if (path.endsWith(MIGRATIONS_SUFFIX)) {
        return Object.keys(manifests);
      }
      return base.listDir(path);
    },
    deleteFile(path: string): void {
      base.deleteFile(path);
    },
  };
}

// ---------------------------------------------------------------------------
// loadManifest tests
// ---------------------------------------------------------------------------

describe("loadManifest", () => {
  it("loadManifest_validFile_returnsManifest", () => {
    const fs = makeMigrationsFs({ "0.9.0-to-0.10.0.json": VALID_MANIFEST });

    const manifest = loadManifest("0.9.0", "0.10.0", fs);

    expect(manifest.from).toBe("0.9.0");
    expect(manifest.to).toBe("0.10.0");
    expect(manifest.playbooks["cli-tool"]).toBeDefined();
    expect(manifest.playbooks["cli-tool"]?.addSlots?.length).toBe(2);
  });

  it("loadManifest_validFile_addSlotFields", () => {
    const fs = makeMigrationsFs({ "0.9.0-to-0.10.0.json": VALID_MANIFEST });

    const manifest = loadManifest("0.9.0", "0.10.0", fs);
    const slot = manifest.playbooks["cli-tool"]?.addSlots?.[0];

    expect(slot?.file).toBe("src/cmd/index.ts");
    expect(slot?.slot).toBe("imports");
    expect(slot?.afterLine).toBe('import { registerHelloCommand } from "./hello.js";');
  });

  it("loadManifest_validFile_addSlotWithIndent", () => {
    const fs = makeMigrationsFs({ "0.9.0-to-0.10.0.json": VALID_MANIFEST });

    const manifest = loadManifest("0.9.0", "0.10.0", fs);
    const slot = manifest.playbooks["cli-tool"]?.addSlots?.[1];

    expect(slot?.indent).toBe("  ");
  });

  it("loadManifest_missingFile_throwsHarnessError", () => {
    const fs = makeMigrationsFs({});

    expect(() => loadManifest("0.8.0", "0.9.0", fs)).toThrow(HarnessError);
  });

  it("loadManifest_missingFile_exitCode2", () => {
    const fs = makeMigrationsFs({});

    expect(() => loadManifest("0.8.0", "0.9.0", fs)).toThrow(
      expect.objectContaining({ exitCode: 2 }),
    );
  });

  it("loadManifest_missingFile_hintMentionsAdjacentMinor", () => {
    const fs = makeMigrationsFs({});

    let caught: unknown;
    try {
      loadManifest("0.8.0", "0.9.0", fs);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(HarnessError);
    expect((caught as HarnessError).hint).toBeDefined();
    expect((caught as HarnessError).hint).toContain("인접 minor");
  });

  it("loadManifest_malformedJson_throwsHarnessError", () => {
    const fs = makeMigrationsFs({ "0.9.0-to-0.10.0.json": "{ invalid json" });

    expect(() => loadManifest("0.9.0", "0.10.0", fs)).toThrow(HarnessError);
  });

  it("loadManifest_malformedJson_exitCode1", () => {
    const fs = makeMigrationsFs({ "0.9.0-to-0.10.0.json": "{ invalid json" });

    expect(() => loadManifest("0.9.0", "0.10.0", fs)).toThrow(
      expect.objectContaining({ exitCode: 1 }),
    );
  });

  it("loadManifest_fromMismatch_throwsHarnessError", () => {
    const mismatch = JSON.stringify({
      from: "0.8.0",
      to: "0.10.0",
      playbooks: {},
    });
    const fs = makeMigrationsFs({ "0.9.0-to-0.10.0.json": mismatch });

    expect(() => loadManifest("0.9.0", "0.10.0", fs)).toThrow(HarnessError);
  });

  it("loadManifest_toMismatch_throwsHarnessError", () => {
    const mismatch = JSON.stringify({
      from: "0.9.0",
      to: "0.11.0",
      playbooks: {},
    });
    const fs = makeMigrationsFs({ "0.9.0-to-0.10.0.json": mismatch });

    expect(() => loadManifest("0.9.0", "0.10.0", fs)).toThrow(HarnessError);
  });

  it("loadManifest_missingPlaybooks_throwsHarnessError", () => {
    const bad = JSON.stringify({ from: "0.9.0", to: "0.10.0" });
    const fs = makeMigrationsFs({ "0.9.0-to-0.10.0.json": bad });

    expect(() => loadManifest("0.9.0", "0.10.0", fs)).toThrow(HarnessError);
  });

  it("loadManifest_addSlotsNotArray_throwsHarnessError", () => {
    const bad = JSON.stringify({
      from: "0.9.0",
      to: "0.10.0",
      playbooks: { "cli-tool": { addSlots: "not-array" } },
    });
    const fs = makeMigrationsFs({ "0.9.0-to-0.10.0.json": bad });

    expect(() => loadManifest("0.9.0", "0.10.0", fs)).toThrow(HarnessError);
  });

  it("loadManifest_addSlotMissingFile_throwsHarnessError", () => {
    const bad = JSON.stringify({
      from: "0.9.0",
      to: "0.10.0",
      playbooks: {
        "cli-tool": {
          addSlots: [{ slot: "imports", afterLine: "// anchor" }],
        },
      },
    });
    const fs = makeMigrationsFs({ "0.9.0-to-0.10.0.json": bad });

    expect(() => loadManifest("0.9.0", "0.10.0", fs)).toThrow(HarnessError);
  });

  it("loadManifest_addFilesMissingContent_throwsHarnessError", () => {
    const bad = JSON.stringify({
      from: "0.9.0",
      to: "0.10.0",
      playbooks: {
        "cli-tool": {
          addFiles: [{ path: "src/lib/foo.ts" }],
        },
      },
    });
    const fs = makeMigrationsFs({ "0.9.0-to-0.10.0.json": bad });

    expect(() => loadManifest("0.9.0", "0.10.0", fs)).toThrow(HarnessError);
  });

  it("loadManifest_emptyPlaybooks_returnsManifest", () => {
    const manifest = JSON.stringify({
      from: "0.9.0",
      to: "0.10.0",
      playbooks: {},
    });
    const fs = makeMigrationsFs({ "0.9.0-to-0.10.0.json": manifest });

    const result = loadManifest("0.9.0", "0.10.0", fs);

    expect(result.from).toBe("0.9.0");
    expect(result.to).toBe("0.10.0");
    expect(Object.keys(result.playbooks).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// listManifests tests
// ---------------------------------------------------------------------------

describe("listManifests", () => {
  it("listManifests_noDirectory_returnsEmpty", () => {
    const fs = makeFakeFs({});

    const result = listManifests(fs);

    expect(result).toEqual([]);
  });

  it("listManifests_withManifests_returnsAllPairs", () => {
    const fs = makeMigrationsFs({
      "0.9.0-to-0.10.0.json": VALID_MANIFEST,
      "0.8.0-to-0.9.0.json": JSON.stringify({
        from: "0.8.0",
        to: "0.9.0",
        playbooks: {},
      }),
    });

    const result = listManifests(fs);

    expect(result.length).toBe(2);
    const froms = result.map((r) => r.from);
    expect(froms).toContain("0.9.0");
    expect(froms).toContain("0.8.0");
  });

  it("listManifests_schemaJsonIgnored", () => {
    const fs = makeMigrationsFs({
      "0.9.0-to-0.10.0.json": VALID_MANIFEST,
      "schema.json": "{}",
    });

    const result = listManifests(fs);

    expect(result.length).toBe(1);
    expect(result[0]?.from).toBe("0.9.0");
  });

  it("listManifests_malformedFilename_ignored", () => {
    const fs = makeMigrationsFs({
      "0.9.0-to-0.10.0.json": VALID_MANIFEST,
      "not-a-manifest.json": "{}",
    });

    const result = listManifests(fs);

    expect(result.length).toBe(1);
  });
});
