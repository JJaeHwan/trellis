import { describe, expect, it } from "vitest";
import { HarnessError } from "../common/errors/index.js";
import type { FsAdapter } from "./fs-adapter.js";
import { loadSpec } from "./spec-loader.js";

class FakeFs implements FsAdapter {
  public files = new Map<string, string>();
  public dirs = new Set<string>();

  exists(path: string): boolean {
    return this.files.has(path) || this.dirs.has(path);
  }
  isDirectory(path: string): boolean {
    return this.dirs.has(path);
  }
  isEmptyDirectory(path: string): boolean {
    if (!this.dirs.has(path)) return false;
    const prefix = path.endsWith("/") ? path : path + "/";
    for (const f of this.files.keys()) {
      if (f.startsWith(prefix)) return false;
    }
    for (const d of this.dirs) {
      if (d !== path && d.startsWith(prefix)) return false;
    }
    return true;
  }
  ensureDir(path: string): void {
    const parts = path.split("/").filter((p) => p.length > 0);
    const isAbs = path.startsWith("/");
    let acc = isAbs ? "" : ".";
    for (const part of parts) {
      acc = `${acc}/${part}`;
      this.dirs.add(acc);
    }
  }
  writeFile(path: string, content: string): void {
    this.files.set(path, content);
  }
  readFile(path: string): string {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`File not found: ${path}`);
    return content;
  }
  listDir(path: string): readonly string[] {
    const prefix = path.endsWith("/") ? path : path + "/";
    const entries = new Set<string>();
    for (const f of this.files.keys()) {
      if (f.startsWith(prefix)) {
        const rest = f.slice(prefix.length);
        const name = rest.split("/")[0];
        if (name) entries.add(name);
      }
    }
    for (const d of this.dirs) {
      if (d.startsWith(prefix)) {
        const rest = d.slice(prefix.length);
        const name = rest.split("/")[0];
        if (name) entries.add(name);
      }
    }
    return [...entries];
  }
}

const VALID_SPEC = {
  projectName: "my-project",
  rootPath: "/tmp/my-project",
  playbookId: "cli-tool",
  matchMode: "exact",
  matchScore: 1,
  answers: [{ questionId: "1", selectedOptionId: "A" }],
  placeholders: {},
  generatedAt: "2026-05-19T00:00:00.000Z",
  trellisVersion: "0.4.0",
};

describe("loadSpec", () => {
  it("loadSpec_specExists_returnsProjectSpec", () => {
    const fs = new FakeFs();
    fs.files.set("/project/.trellis/spec.json", JSON.stringify(VALID_SPEC));

    const result = loadSpec("/project", fs);

    expect(result).toBeDefined();
    expect(result?.projectName).toBe("my-project");
    expect(result?.playbookId).toBe("cli-tool");
    expect(result?.answers).toHaveLength(1);
  });

  it("loadSpec_specMissing_returnsUndefined", () => {
    const fs = new FakeFs();

    const result = loadSpec("/project", fs);

    expect(result).toBeUndefined();
  });

  it("loadSpec_invalidJson_throwsHarnessError", () => {
    const fs = new FakeFs();
    fs.files.set("/project/.trellis/spec.json", "{ not valid json %%% }");

    expect(() => loadSpec("/project", fs)).toThrow(HarnessError);
    expect(() => loadSpec("/project", fs)).toThrow(
      /malformed .trellis\/spec\.json/,
    );
  });

  it("loadSpec_validJsonMissingProjectName_throwsHarnessError", () => {
    const fs = new FakeFs();
    const noProjectName = { ...VALID_SPEC, projectName: undefined };
    fs.files.set("/project/.trellis/spec.json", JSON.stringify(noProjectName));

    expect(() => loadSpec("/project", fs)).toThrow(HarnessError);
    expect(() => loadSpec("/project", fs)).toThrow(/필수 필드/);
  });

  it("loadSpec_validJsonMissingPlaybookId_throwsHarnessError", () => {
    const fs = new FakeFs();
    const noPlaybookId = { ...VALID_SPEC, playbookId: undefined };
    fs.files.set("/project/.trellis/spec.json", JSON.stringify(noPlaybookId));

    expect(() => loadSpec("/project", fs)).toThrow(HarnessError);
    expect(() => loadSpec("/project", fs)).toThrow(/필수 필드/);
  });

  it("loadSpec_validJsonMissingAnswers_throwsHarnessError", () => {
    const fs = new FakeFs();
    const noAnswers = { ...VALID_SPEC, answers: undefined };
    fs.files.set("/project/.trellis/spec.json", JSON.stringify(noAnswers));

    expect(() => loadSpec("/project", fs)).toThrow(HarnessError);
    expect(() => loadSpec("/project", fs)).toThrow(/필수 필드/);
  });

  it("loadSpec_validJsonAnswersWrongType_throwsHarnessError", () => {
    const fs = new FakeFs();
    const wrongAnswers = { ...VALID_SPEC, answers: "not-an-array" };
    fs.files.set("/project/.trellis/spec.json", JSON.stringify(wrongAnswers));

    expect(() => loadSpec("/project", fs)).toThrow(HarnessError);
    expect(() => loadSpec("/project", fs)).toThrow(/필수 필드/);
  });

  it("loadSpec_specExists_returnsAllFields", () => {
    const fs = new FakeFs();
    fs.files.set("/project/.trellis/spec.json", JSON.stringify(VALID_SPEC));

    const result = loadSpec("/project", fs);

    expect(result?.rootPath).toBe("/tmp/my-project");
    expect(result?.matchMode).toBe("exact");
    expect(result?.matchScore).toBe(1);
    expect(result?.trellisVersion).toBe("0.4.0");
  });
});
