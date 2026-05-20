import { describe, expect, it, vi } from "vitest";
import { HarnessError } from "../../common/errors/index.js";
import type { FsAdapter } from "../../external/fs-adapter.js";
import type { MigrationManifest } from "./types.js";
import { applyManifest } from "./applier.js";

// ---------------------------------------------------------------------------
// Fake FsAdapter
// ---------------------------------------------------------------------------

function makeFakeFs(files: Record<string, string>): FsAdapter & { written: Record<string, string> } {
  const store = { ...files };
  const written: Record<string, string> = {};
  return {
    written,
    exists(path: string): boolean {
      if (path in store) return true;
      return Object.keys(store).some((k) => k.startsWith(path + "/"));
    },
    isDirectory(path: string): boolean {
      return Object.keys(store).some((k) => k.startsWith(path + "/"));
    },
    isEmptyDirectory(): boolean {
      return false;
    },
    ensureDir(_path: string): void {
      // no-op
    },
    writeFile(path: string, content: string): void {
      store[path] = content;
      written[path] = content;
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
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT = "/project";

function makeManifest(overrides: Partial<MigrationManifest> = {}): MigrationManifest {
  return {
    from: "0.9.0",
    to: "0.10.0",
    playbooks: {},
    ...overrides,
  };
}

function fileContent(lines: string[]): string {
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// slot insertion
// ---------------------------------------------------------------------------

describe("applyManifest — slot insertion", () => {
  it("applyManifest_slot_insertsMarkersAfterAnchor", () => {
    const content = fileContent([
      'import { a } from "./a.js";',
      'import { b } from "./b.js";',
      "",
    ]);
    const fs = makeFakeFs({ [`${PROJECT}/src/cmd/index.ts`]: content });

    const manifest = makeManifest({
      playbooks: {
        "cli-tool": {
          addSlots: [
            {
              file: "src/cmd/index.ts",
              slot: "imports",
              afterLine: 'import { b } from "./b.js";',
            },
          ],
        },
      },
    });

    const result = applyManifest(manifest, "cli-tool", PROJECT, fs, false);

    expect(result.slotsAdded).toHaveLength(1);
    expect(result.slotsAdded[0]).toEqual({ file: "src/cmd/index.ts", slot: "imports" });
    expect(result.slotsSkipped).toHaveLength(0);

    const written = fs.readFile(`${PROJECT}/src/cmd/index.ts`);
    expect(written).toContain("// trellis:slot:imports:start");
    expect(written).toContain("// trellis:slot:imports:end");
    const lines = written.split("\n");
    const anchorIdx = lines.indexOf('import { b } from "./b.js";');
    expect(lines[anchorIdx + 1]).toBe("// trellis:slot:imports:start");
    expect(lines[anchorIdx + 2]).toBe("// trellis:slot:imports:end");
  });

  it("applyManifest_slot_respectsIndent", () => {
    const content = fileContent([
      "function setup() {",
      "  registerA(program);",
      "}",
    ]);
    const fs = makeFakeFs({ [`${PROJECT}/src/cmd/index.ts`]: content });

    const manifest = makeManifest({
      playbooks: {
        "cli-tool": {
          addSlots: [
            {
              file: "src/cmd/index.ts",
              slot: "commands",
              afterLine: "  registerA(program);",
              indent: "  ",
            },
          ],
        },
      },
    });

    applyManifest(manifest, "cli-tool", PROJECT, fs, false);

    const written = fs.readFile(`${PROJECT}/src/cmd/index.ts`);
    expect(written).toContain("  // trellis:slot:commands:start");
    expect(written).toContain("  // trellis:slot:commands:end");
  });

  it("applyManifest_slot_idempotent_secondCallSkips", () => {
    const content = fileContent([
      'import { a } from "./a.js";',
      "// trellis:slot:imports:start",
      "// trellis:slot:imports:end",
    ]);
    const fs = makeFakeFs({ [`${PROJECT}/src/cmd/index.ts`]: content });

    const manifest = makeManifest({
      playbooks: {
        "cli-tool": {
          addSlots: [
            {
              file: "src/cmd/index.ts",
              slot: "imports",
              afterLine: 'import { a } from "./a.js";',
            },
          ],
        },
      },
    });

    const result = applyManifest(manifest, "cli-tool", PROJECT, fs, false);

    expect(result.slotsAdded).toHaveLength(0);
    expect(result.slotsSkipped).toHaveLength(1);
    expect(result.slotsSkipped[0]).toEqual({ file: "src/cmd/index.ts", slot: "imports" });
  });

  it("applyManifest_slot_anchorNotFound_throwsHarnessError", () => {
    const content = fileContent(["// no anchor here"]);
    const fs = makeFakeFs({ [`${PROJECT}/src/cmd/index.ts`]: content });

    const manifest = makeManifest({
      playbooks: {
        "cli-tool": {
          addSlots: [
            {
              file: "src/cmd/index.ts",
              slot: "imports",
              afterLine: "// missing anchor",
            },
          ],
        },
      },
    });

    expect(() => applyManifest(manifest, "cli-tool", PROJECT, fs, false)).toThrow(HarnessError);
  });

  it("applyManifest_slot_anchorNotFound_hintMentionsManualSlot", () => {
    const content = fileContent(["// no anchor here"]);
    const fs = makeFakeFs({ [`${PROJECT}/src/cmd/index.ts`]: content });

    const manifest = makeManifest({
      playbooks: {
        "cli-tool": {
          addSlots: [
            {
              file: "src/cmd/index.ts",
              slot: "imports",
              afterLine: "// missing anchor",
            },
          ],
        },
      },
    });

    let caught: unknown;
    try {
      applyManifest(manifest, "cli-tool", PROJECT, fs, false);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(HarnessError);
    expect((caught as HarnessError).hint).toBeDefined();
    expect((caught as HarnessError).hint).toContain("수동으로 슬롯");
  });

  it("applyManifest_slot_targetFileMissing_throwsHarnessError", () => {
    const fs = makeFakeFs({});

    const manifest = makeManifest({
      playbooks: {
        "cli-tool": {
          addSlots: [
            {
              file: "src/cmd/index.ts",
              slot: "imports",
              afterLine: "// anchor",
            },
          ],
        },
      },
    });

    expect(() => applyManifest(manifest, "cli-tool", PROJECT, fs, false)).toThrow(HarnessError);
  });

  it("applyManifest_slot_targetFileMissing_hintMentionsDoctor", () => {
    const fs = makeFakeFs({});

    const manifest = makeManifest({
      playbooks: {
        "cli-tool": {
          addSlots: [
            {
              file: "src/cmd/index.ts",
              slot: "imports",
              afterLine: "// anchor",
            },
          ],
        },
      },
    });

    let caught: unknown;
    try {
      applyManifest(manifest, "cli-tool", PROJECT, fs, false);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(HarnessError);
    expect((caught as HarnessError).hint).toContain("trellis doctor");
  });

  it("applyManifest_multiSlot_allApplied", () => {
    const content = fileContent([
      'import { a } from "./a.js";',
      "function setup() {",
      "  registerA(program);",
      "}",
    ]);
    const fs = makeFakeFs({ [`${PROJECT}/src/cmd/index.ts`]: content });

    const manifest = makeManifest({
      playbooks: {
        "cli-tool": {
          addSlots: [
            {
              file: "src/cmd/index.ts",
              slot: "imports",
              afterLine: 'import { a } from "./a.js";',
            },
            {
              file: "src/cmd/index.ts",
              slot: "commands",
              afterLine: "  registerA(program);",
              indent: "  ",
            },
          ],
        },
      },
    });

    const result = applyManifest(manifest, "cli-tool", PROJECT, fs, false);

    expect(result.slotsAdded).toHaveLength(2);
    const slots = result.slotsAdded.map((s) => s.slot);
    expect(slots).toContain("imports");
    expect(slots).toContain("commands");
  });
});

// ---------------------------------------------------------------------------
// file addition
// ---------------------------------------------------------------------------

describe("applyManifest — file addition", () => {
  it("applyManifest_addFile_writesContent", () => {
    const fs = makeFakeFs({});

    const manifest = makeManifest({
      playbooks: {
        "cli-tool": {
          addFiles: [
            {
              path: "src/lib/foo.ts",
              content: "export const foo = 1;\n",
            },
          ],
        },
      },
    });

    const result = applyManifest(manifest, "cli-tool", PROJECT, fs, false);

    expect(result.filesAdded).toHaveLength(1);
    expect(result.filesAdded[0]).toBe("src/lib/foo.ts");
    expect(result.filesSkipped).toHaveLength(0);
    expect(fs.readFile(`${PROJECT}/src/lib/foo.ts`)).toBe("export const foo = 1;\n");
  });

  it("applyManifest_addFile_existingFile_skips", () => {
    const fs = makeFakeFs({ [`${PROJECT}/src/lib/foo.ts`]: "// existing\n" });

    const manifest = makeManifest({
      playbooks: {
        "cli-tool": {
          addFiles: [
            {
              path: "src/lib/foo.ts",
              content: "export const foo = 1;\n",
            },
          ],
        },
      },
    });

    const result = applyManifest(manifest, "cli-tool", PROJECT, fs, false);

    expect(result.filesAdded).toHaveLength(0);
    expect(result.filesSkipped).toHaveLength(1);
    expect(result.filesSkipped[0]).toBe("src/lib/foo.ts");
    // original content preserved
    expect(fs.readFile(`${PROJECT}/src/lib/foo.ts`)).toBe("// existing\n");
  });
});

// ---------------------------------------------------------------------------
// dry-run
// ---------------------------------------------------------------------------

describe("applyManifest — dry-run", () => {
  it("applyManifest_dryRun_doesNotCallWriteFile", () => {
    const content = fileContent(['import { a } from "./a.js";']);
    const fs = makeFakeFs({ [`${PROJECT}/src/cmd/index.ts`]: content });
    const writeSpy = vi.spyOn(fs, "writeFile");

    const manifest = makeManifest({
      playbooks: {
        "cli-tool": {
          addSlots: [
            {
              file: "src/cmd/index.ts",
              slot: "imports",
              afterLine: 'import { a } from "./a.js";',
            },
          ],
          addFiles: [
            {
              path: "src/lib/new.ts",
              content: "// new\n",
            },
          ],
        },
      },
    });

    const result = applyManifest(manifest, "cli-tool", PROJECT, fs, true);

    expect(writeSpy).not.toHaveBeenCalled();
    expect(result.slotsAdded).toHaveLength(1);
    expect(result.filesAdded).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// empty manifest / missing playbook key
// ---------------------------------------------------------------------------

describe("applyManifest — empty / missing playbook", () => {
  it("applyManifest_emptyPlaybooks_returnsEmptyResult", () => {
    const fs = makeFakeFs({});

    const manifest = makeManifest({ playbooks: {} });

    const result = applyManifest(manifest, "cli-tool", PROJECT, fs, false);

    expect(result.slotsAdded).toHaveLength(0);
    expect(result.slotsSkipped).toHaveLength(0);
    expect(result.filesAdded).toHaveLength(0);
    expect(result.filesSkipped).toHaveLength(0);
  });

  it("applyManifest_playbookKeyAbsent_returnsEmptyResult", () => {
    const fs = makeFakeFs({});

    const manifest = makeManifest({
      playbooks: {
        "other-playbook": { addSlots: [] },
      },
    });

    const result = applyManifest(manifest, "cli-tool", PROJECT, fs, false);

    expect(result.slotsAdded).toHaveLength(0);
    expect(result.filesAdded).toHaveLength(0);
  });
});
