import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProjectSpec } from "../../src/domain/index.js";
import { HarnessError } from "../../src/common/errors/index.js";
import { scaffold } from "../../src/service/scaffolder/index.js";
import { runAdd } from "../../src/cmd/add.js";
import { realFsAdapter } from "../../src/external/fs-adapter.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const saasSpec: ProjectSpec = {
  projectName: "e2e-patch-saas",
  rootPath: "",
  playbookId: "b2b-saas",
  matchMode: "exact",
  matchScore: 1,
  answers: [
    { questionId: "1", selectedOptionId: "A" },
    { questionId: "2", selectedOptionId: "B" },
    { questionId: "3", selectedOptionId: "B" },
    { questionId: "4", selectedOptionId: "C" },
    { questionId: "5", selectedOptionId: "B" },
    { questionId: "6", selectedOptionId: "B" },
    { questionId: "7", selectedOptionId: "B" },
    { questionId: "8", selectedOptionId: "B" },
    { questionId: "9", selectedOptionId: "B" },
  ],
  placeholders: {},
  generatedAt: "2026-04-27T00:00:00.000Z",
  trellisVersion: "0.0.0-e2e",
};

const ragSpec: ProjectSpec = {
  projectName: "e2e-patch-rag",
  rootPath: "",
  playbookId: "ai-rag-platform",
  matchMode: "exact",
  matchScore: 1,
  answers: [
    { questionId: "1", selectedOptionId: "A" },
    { questionId: "2", selectedOptionId: "C" },
    { questionId: "5", selectedOptionId: "B" },
  ],
  placeholders: {},
  generatedAt: "2026-04-27T00:00:00.000Z",
  trellisVersion: "0.0.0-e2e",
};

// ---------------------------------------------------------------------------
// Shared temp dirs
// ---------------------------------------------------------------------------

let workDir: string;
let saasProjectDir: string;
let ragProjectDir: string;
let brokenProjectDir: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "trellis-patch-e2e-"));

  saasProjectDir = join(workDir, "e2e-patch-saas");
  scaffold({ ...saasSpec, rootPath: saasProjectDir });

  ragProjectDir = join(workDir, "e2e-patch-rag");
  scaffold({ ...ragSpec, rootPath: ragProjectDir });

  brokenProjectDir = join(workDir, "e2e-patch-broken");
  scaffold({ ...saasSpec, rootPath: brokenProjectDir, projectName: "e2e-patch-broken" });
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// describe("patch handling")
// ---------------------------------------------------------------------------

describe("patch handling", () => {
  // -------------------------------------------------------------------------
  // Case 1: b2b-saas page fragment add → nav-items.ts 자동 갱신
  // -------------------------------------------------------------------------

  describe("Case 1: b2b-saas page add updates nav-items.ts", () => {
    it("runAdd page reports succeeds and updates nav-items.ts", async () => {
      await runAdd("page", "reports", { force: false }, realFsAdapter, saasProjectDir);

      const navPath = join(saasProjectDir, "src/lib/nav-items.ts");
      const nav = readFileSync(navPath, "utf-8");

      expect(nav).toContain('label: "Reports"');
      expect(nav).toContain('href: "/reports"');
    });

    // Case 5 baked in here: marker lines must survive the patch
    it("marker lines are preserved after patch (Case 5)", () => {
      const navPath = join(saasProjectDir, "src/lib/nav-items.ts");
      const nav = readFileSync(navPath, "utf-8");

      expect(nav).toContain("// trellis:slot:nav-items:start");
      expect(nav).toContain("// trellis:slot:nav-items:end");
    });
  });

  // -------------------------------------------------------------------------
  // Case 2: 멱등성 — 같은 fragment 같은 name 두 번 add
  // -------------------------------------------------------------------------

  describe("Case 2: idempotency — same fragment added twice", () => {
    it("second runAdd (force: true) does not throw", async () => {
      await expect(
        runAdd("page", "reports", { force: true }, realFsAdapter, saasProjectDir),
      ).resolves.toBeUndefined();
    });

    it('"/reports" appears exactly once in nav-items.ts after two adds', () => {
      const navPath = join(saasProjectDir, "src/lib/nav-items.ts");
      const nav = readFileSync(navPath, "utf-8");

      // Count substring occurrences of the entryKey "/reports"
      const occurrences = nav.split('"/reports"').length - 1;
      expect(occurrences).toBe(1);
    });

    it("nav-items.ts content is identical after second add (or at most same state)", () => {
      const navPath = join(saasProjectDir, "src/lib/nav-items.ts");
      const before = readFileSync(navPath, "utf-8");

      // third add — must not duplicate
      void runAdd("page", "reports", { force: true }, realFsAdapter, saasProjectDir).then(() => {
        const after = readFileSync(navPath, "utf-8");
        const occurrences = after.split('"/reports"').length - 1;
        expect(occurrences).toBe(1);
        expect(after).toBe(before);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Case 3: ai-rag-platform page assistant → nav-items.ts 자동 갱신
  // -------------------------------------------------------------------------

  describe("Case 3: ai-rag-platform page add updates nav-items.ts", () => {
    it("runAdd page assistant adds Assistant entry to nav-items.ts", async () => {
      // The base scaffold already has an 'assistant' page from add-fragments e2e
      // but here we use a fresh ragProjectDir, so force:false is fine for first add.
      // However scaffold for ai-rag may already ship an assistant page — use force:true
      // to be safe against file conflict (the patch dedup handles nav-items).
      await runAdd("page", "assistant", { force: true }, realFsAdapter, ragProjectDir);

      const navPath = join(ragProjectDir, "src/lib/nav-items.ts");
      const nav = readFileSync(navPath, "utf-8");

      expect(nav).toContain('label: "Assistant"');
      expect(nav).toContain('href: "/assistant"');
    });

    it("marker lines are preserved in ai-rag nav-items.ts after patch", () => {
      const navPath = join(ragProjectDir, "src/lib/nav-items.ts");
      const nav = readFileSync(navPath, "utf-8");

      expect(nav).toContain("// trellis:slot:nav-items:start");
      expect(nav).toContain("// trellis:slot:nav-items:end");
    });
  });

  // -------------------------------------------------------------------------
  // Case 4: slot 누락 시 fail-fast → HarnessError exitCode 3
  // -------------------------------------------------------------------------

  describe("Case 4: missing slot → fail-fast with HarnessError exitCode 3", () => {
    it("removes both marker lines from nav-items.ts in brokenProjectDir", () => {
      const navPath = join(brokenProjectDir, "src/lib/nav-items.ts");
      const original = readFileSync(navPath, "utf-8");

      const stripped = original
        .split("\n")
        .filter(
          (line) =>
            !line.includes("trellis:slot:nav-items:start") &&
            !line.includes("trellis:slot:nav-items:end"),
        )
        .join("\n");

      writeFileSync(navPath, stripped, "utf-8");

      // Confirm markers are gone
      const afterStrip = readFileSync(navPath, "utf-8");
      expect(afterStrip).not.toContain("trellis:slot:nav-items:start");
      expect(afterStrip).not.toContain("trellis:slot:nav-items:end");
    });

    it("runAdd throws HarnessError with exitCode 3 when slot is missing", async () => {
      await expect(
        runAdd("page", "broken", { force: false }, realFsAdapter, brokenProjectDir),
      ).rejects.toSatisfy((err: unknown) => {
        return err instanceof HarnessError && err.exitCode === 3;
      });
    });

    it("error message mentions missing slot 'nav-items'", async () => {
      // Use force: true so writeTree doesn't fail on an already-created file from
      // the previous test, allowing execution to reach applyPatches → slot check.
      await expect(
        runAdd("page", "broken", { force: true }, realFsAdapter, brokenProjectDir),
      ).rejects.toSatisfy((err: unknown) => {
        if (!(err instanceof HarnessError)) return false;
        return err.message.toLowerCase().includes("nav-items");
      });
    });
  });
}, { timeout: 30_000 });
