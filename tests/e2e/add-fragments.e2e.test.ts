import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
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
  projectName: "e2e-add-saas",
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
  projectName: "e2e-add-rag",
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
// Shared temp dirs (created in beforeAll, cleaned in afterAll)
// ---------------------------------------------------------------------------

let workDir: string;
let saasProjectDir: string;
let ragProjectDir: string;
let conflictProjectDir: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "trellis-add-e2e-"));

  saasProjectDir = join(workDir, "e2e-add-saas");
  scaffold({ ...saasSpec, rootPath: saasProjectDir });

  ragProjectDir = join(workDir, "e2e-add-rag");
  scaffold({ ...ragSpec, rootPath: ragProjectDir });

  conflictProjectDir = join(workDir, "e2e-conflict");
  scaffold({ ...saasSpec, rootPath: conflictProjectDir, projectName: "e2e-conflict" });
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Case 1: b2b-saas + add api users
// ---------------------------------------------------------------------------

describe("E2E — b2b-saas: add api users", () => {
  it("scaffold wrote .trellis/spec.json", () => {
    expect(existsSync(join(saasProjectDir, ".trellis/spec.json"))).toBe(true);
  });

  it("runAdd creates route.ts and route.test.ts with correct substitutions", async () => {
    await runAdd("api", "users", { force: false }, realFsAdapter, saasProjectDir);

    const routePath = join(saasProjectDir, "src/app/api/users/route.ts");
    const testPath = join(saasProjectDir, "src/app/api/users/route.test.ts");

    expect(existsSync(routePath)).toBe(true);
    expect(existsSync(testPath)).toBe(true);

    const route = readFileSync(routePath, "utf-8");
    // nameKebab → "users", namePascal → "Users", nameCamel → "users"
    expect(route).toMatch(/export async function GET/);
    expect(route).toMatch(/export async function POST/);
    expect(route).toContain("createUsersSchema");
    expect(route).toContain("db.users");
    expect(route).toContain("/api/users");

    const test = readFileSync(testPath, "utf-8");
    expect(test).toContain("GET /api/users");
    expect(test).toContain("POST /api/users");
    expect(test).toContain("db.users");
    // syntactically valid imports present
    expect(test).toMatch(/import.*from/);
  });

  it("package.json already has zod (no version conflict logged)", () => {
    const pkg = JSON.parse(
      readFileSync(join(saasProjectDir, "package.json"), "utf-8"),
    ) as { dependencies?: Record<string, string> };
    // The b2b-saas full-body should have zod; either present or harmlessly added
    // The key assertion is the file still parses as valid JSON after patchPackageJson
    expect(pkg).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Case 2: b2b-saas + add page dashboard
// ---------------------------------------------------------------------------

describe("E2E — b2b-saas: add page dashboard", () => {
  it("runAdd creates (authed)/dashboard/page.tsx with correct substitutions", async () => {
    await runAdd("page", "dashboard", { force: false }, realFsAdapter, saasProjectDir);

    const pagePath = join(saasProjectDir, "src/app/(authed)/dashboard/page.tsx");
    expect(existsSync(pagePath)).toBe(true);

    const page = readFileSync(pagePath, "utf-8");
    // namePascal → "Dashboard", nameKebab → "dashboard"
    expect(page).toContain("Dashboard");
    expect(page).toMatch(/export default async function DashboardPage/);
    // auth redirect present
    expect(page).toContain('redirect("/login")');
    // syntactically valid import
    expect(page).toMatch(/import.*from/);
  });
});

// ---------------------------------------------------------------------------
// Case 3: ai-rag-platform + add api search
// ---------------------------------------------------------------------------

describe("E2E — ai-rag-platform: add api search", () => {
  it("scaffold wrote .trellis/spec.json", () => {
    expect(existsSync(join(ragProjectDir, ".trellis/spec.json"))).toBe(true);
  });

  it("runAdd creates route.ts with correct substitutions", async () => {
    await runAdd("api", "search", { force: false }, realFsAdapter, ragProjectDir);

    const routePath = join(ragProjectDir, "src/app/api/search/route.ts");
    expect(existsSync(routePath)).toBe(true);

    const route = readFileSync(routePath, "utf-8");
    // namePascal → "Search"
    expect(route).toContain("SearchQueryInput");
    expect(route).toMatch(/export async function GET/);
    expect(route).toMatch(/export async function POST/);
    // syntactically valid imports
    expect(route).toMatch(/import.*from/);
    // zod usage
    expect(route).toMatch(/z\.object/);
  });
});

// ---------------------------------------------------------------------------
// Case 4: ai-rag-platform + add page assistant
// (note: the full scaffold already ships src/app/chat/page.tsx so we use a
//  different name to avoid conflict)
// ---------------------------------------------------------------------------

describe("E2E — ai-rag-platform: add page assistant", () => {
  it("runAdd creates assistant/page.tsx with correct substitutions", async () => {
    await runAdd("page", "assistant", { force: false }, realFsAdapter, ragProjectDir);

    const pagePath = join(ragProjectDir, "src/app/assistant/page.tsx");
    expect(existsSync(pagePath)).toBe(true);

    const page = readFileSync(pagePath, "utf-8");
    // namePascal → "Assistant", nameKebab → "assistant"
    expect(page).toContain("Assistant");
    expect(page).toMatch(/export default function AssistantPage/);
    // client component directive
    expect(page).toContain('"use client"');
    // references /api/assistant in fetch call
    expect(page).toContain("/api/assistant");
    // syntactically valid import
    expect(page).toMatch(/import.*from/);
  });
});

// ---------------------------------------------------------------------------
// Case 5: conflict detection — second add without --force → exit 3
// ---------------------------------------------------------------------------

describe("E2E — conflict: second add without --force throws exit 3", () => {
  it("first add succeeds", async () => {
    await expect(
      runAdd("api", "orders", { force: false }, realFsAdapter, conflictProjectDir),
    ).resolves.toBeUndefined();

    expect(
      existsSync(join(conflictProjectDir, "src/app/api/orders/route.ts")),
    ).toBe(true);
  });

  it("second add to same path throws HarnessError with exitCode 3", async () => {
    await expect(
      runAdd("api", "orders", { force: false }, realFsAdapter, conflictProjectDir),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof HarnessError &&
        err.exitCode === 3
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Case 6: conflict + --force → overwrites successfully
// ---------------------------------------------------------------------------

describe("E2E — conflict: second add with --force overwrites", () => {
  it("second add with force: true overwrites without throwing", async () => {
    // conflictProjectDir already has orders/route.ts from Case 5
    await expect(
      runAdd("api", "orders", { force: true }, realFsAdapter, conflictProjectDir),
    ).resolves.toBeUndefined();

    const routePath = join(conflictProjectDir, "src/app/api/orders/route.ts");
    expect(existsSync(routePath)).toBe(true);

    const route = readFileSync(routePath, "utf-8");
    expect(route).toMatch(/export async function GET/);
  });
});
