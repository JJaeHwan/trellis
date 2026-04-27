import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProjectSpec } from "../../src/domain/index.js";
import { scaffold } from "../../src/service/scaffolder/index.js";

let workDir: string;
let projectDir: string;

const spec: ProjectSpec = {
  projectName: "e2e-test-rag",
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

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "trellis-rag-e2e-"));
  projectDir = join(workDir, "e2e-test-rag");
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("E2E — scaffold ai-rag-platform to a real temp directory", () => {
  it("writes a complete Next.js + RAG tree to disk", () => {
    const tree = scaffold({ ...spec, rootPath: projectDir });
    expect(tree.length).toBeGreaterThan(35);

    expect(existsSync(projectDir)).toBe(true);
    expect(statSync(projectDir).isDirectory()).toBe(true);
  });

  it("produces a valid package.json with Next.js + Prisma + LLM SDKs", () => {
    const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf-8")) as {
      name: string;
      dependencies: Record<string, string>;
    };
    expect(pkg.name).toBe("e2e-test-rag");
    expect(pkg.dependencies.next).toBeDefined();
    expect(pkg.dependencies["@prisma/client"]).toBeDefined();
    expect(pkg.dependencies["@anthropic-ai/sdk"]).toBeDefined();
    expect(pkg.dependencies.openai).toBeDefined();
    expect(pkg.dependencies["pdf-parse"]).toBeDefined();
    expect(pkg.dependencies.mammoth).toBeDefined();
  });

  it("renders projectName into layout metadata", () => {
    const layout = readFileSync(join(projectDir, "src/app/layout.tsx"), "utf-8");
    expect(layout).toContain('title: "e2e-test-rag"');
  });

  it("strips .hbs extensions in output (no leftover template files)", () => {
    expect(existsSync(join(projectDir, "package.json.hbs"))).toBe(false);
    expect(existsSync(join(projectDir, "src/app/layout.tsx.hbs"))).toBe(false);
    expect(existsSync(join(projectDir, "prisma/schema.prisma.hbs"))).toBe(false);
  });

  it("preserves layered directory structure (provider abstractions)", () => {
    expect(statSync(join(projectDir, "src/lib/external/llm")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/lib/external/embedder")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/lib/service/document")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/lib/service/search")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/lib/service/chat")).isDirectory()).toBe(true);
    expect(
      existsSync(join(projectDir, "src/app/api/chat/sessions/[id]/messages/route.ts")),
    ).toBe(true);
  });

  it("includes Prisma schema with vector type", () => {
    const schema = readFileSync(join(projectDir, "prisma/schema.prisma"), "utf-8");
    expect(schema).toContain("provider   = \"postgresql\"");
    expect(schema).toContain("extensions = [vector]");
    expect(schema).toContain("Unsupported(\"vector\")");
  });

  it("ships all 3 LLM provider implementations", () => {
    expect(existsSync(join(projectDir, "src/lib/external/llm/ollama.ts"))).toBe(true);
    expect(existsSync(join(projectDir, "src/lib/external/llm/openai.ts"))).toBe(true);
    expect(existsSync(join(projectDir, "src/lib/external/llm/anthropic.ts"))).toBe(true);
    expect(existsSync(join(projectDir, "src/lib/external/llm/factory.ts"))).toBe(true);
  });
});
