import { describe, expect, it } from "vitest";
import { loadTemplates } from "../../src/external/index.js";
import { buildContext, renderTree } from "../../src/service/generator/index.js";
import type { ProjectSpec } from "../../src/domain/index.js";

const baseSpec: ProjectSpec = {
  projectName: "my-test-rag",
  rootPath: "/tmp/my-test-rag",
  playbookId: "ai-rag-platform",
  matchMode: "exact",
  matchScore: 1,
  answers: [],
  placeholders: {},
  generatedAt: "2026-04-27T00:00:00.000Z",
  trellisVersion: "0.0.0-golden",
};

describe("golden — ai-rag-platform template tree", () => {
  it("loads the ai-rag-platform template set with expected key files", () => {
    const templates = loadTemplates("ai-rag-platform");
    expect(templates.length).toBeGreaterThan(37);

    const sourcePaths = templates.map((t) => t.sourcePath);
    // Root config
    expect(sourcePaths).toContain("package.json.hbs");
    expect(sourcePaths).toContain("tsconfig.json");
    expect(sourcePaths).toContain("next.config.mjs");
    expect(sourcePaths).toContain(".eslintrc.cjs");
    expect(sourcePaths).toContain(".env.example.hbs");
    expect(sourcePaths).toContain(".github/workflows/ci.yml.hbs");
    // Prisma
    expect(sourcePaths).toContain("prisma/schema.prisma.hbs");
    // Provider abstractions
    expect(sourcePaths).toContain("src/lib/external/llm/interface.ts");
    expect(sourcePaths).toContain("src/lib/external/llm/ollama.ts");
    expect(sourcePaths).toContain("src/lib/external/llm/openai.ts");
    expect(sourcePaths).toContain("src/lib/external/llm/anthropic.ts");
    expect(sourcePaths).toContain("src/lib/external/llm/factory.ts");
    expect(sourcePaths).toContain("src/lib/external/embedder/interface.ts");
    expect(sourcePaths).toContain("src/lib/external/embedder/ollama.ts");
    expect(sourcePaths).toContain("src/lib/external/embedder/openai.ts");
    expect(sourcePaths).toContain("src/lib/external/embedder/factory.ts");
    // Service layer
    expect(sourcePaths).toContain("src/lib/service/document/parser.ts");
    expect(sourcePaths).toContain("src/lib/service/document/chunker.ts");
    expect(sourcePaths).toContain("src/lib/service/document/pipeline.ts");
    expect(sourcePaths).toContain("src/lib/service/search/vector-search.ts");
    expect(sourcePaths).toContain("src/lib/service/chat/rag-chat.ts");
    // Components + lib
    expect(sourcePaths).toContain("src/components/Sidebar.tsx.hbs");
    expect(sourcePaths).toContain("src/lib/nav-items.ts.hbs");
    // App + API
    expect(sourcePaths).toContain("src/app/layout.tsx.hbs");
    expect(sourcePaths).toContain("src/app/documents/page.tsx");
    expect(sourcePaths).toContain("src/app/chat/page.tsx");
    expect(sourcePaths).toContain("src/app/api/documents/route.ts");
    expect(sourcePaths).toContain("src/app/api/chat/sessions/route.ts");
    expect(sourcePaths).toContain(
      "src/app/api/chat/sessions/[id]/messages/route.ts",
    );
  });

  it("renders templates and strips .hbs extension on output", () => {
    const templates = loadTemplates("ai-rag-platform");
    const tree = renderTree(templates, buildContext(baseSpec));

    const paths = tree.map((f) => f.path);
    expect(paths).toContain("package.json");
    expect(paths).toContain("README.md");
    expect(paths).toContain("LICENSE");
    expect(paths).toContain("prisma/schema.prisma");
    expect(paths).toContain("src/app/layout.tsx");
    expect(paths).toContain("src/components/Sidebar.tsx");
    expect(paths).toContain("src/lib/nav-items.ts");
    expect(paths).toContain(
      "src/app/api/chat/sessions/[id]/messages/route.ts",
    );

    const hbsLeftovers = paths.filter((p) => p.endsWith(".hbs"));
    expect(hbsLeftovers).toEqual([]);
  });

  it("substitutes projectName into package.json", () => {
    const templates = loadTemplates("ai-rag-platform");
    const tree = renderTree(templates, buildContext(baseSpec));
    const pkg = tree.find((f) => f.path === "package.json");
    expect(pkg).toBeDefined();
    const parsed = JSON.parse(pkg!.content) as {
      name: string;
      dependencies: Record<string, string>;
    };
    expect(parsed.name).toBe("my-test-rag");
    expect(parsed.dependencies.next).toBeDefined();
    expect(parsed.dependencies["@prisma/client"]).toBeDefined();
    expect(parsed.dependencies["@anthropic-ai/sdk"]).toBeDefined();
    expect(parsed.dependencies.openai).toBeDefined();
    expect(parsed.dependencies["pdf-parse"]).toBeDefined();
    expect(parsed.dependencies.mammoth).toBeDefined();
  });

  it("includes prisma schema with vector + Document models", () => {
    const templates = loadTemplates("ai-rag-platform");
    const tree = renderTree(templates, buildContext(baseSpec));
    const schema = tree.find((f) => f.path === "prisma/schema.prisma");
    expect(schema).toBeDefined();
    expect(schema!.content).toContain("model Document");
    expect(schema!.content).toContain("model DocumentChunk");
    expect(schema!.content).toContain("model ChatSession");
    expect(schema!.content).toContain("model ChatMessage");
    expect(schema!.content).toContain("Unsupported(\"vector\")");
    expect(schema!.content).toContain("extensions = [vector]");
  });

  it("nav-items.ts contains trellis slot markers for nav-items", () => {
    const templates = loadTemplates("ai-rag-platform");
    const tree = renderTree(templates, buildContext(baseSpec));
    const navItems = tree.find((f) => f.path === "src/lib/nav-items.ts");
    expect(navItems).toBeDefined();
    expect(navItems!.content).toContain("// trellis:slot:nav-items:start");
    expect(navItems!.content).toContain("// trellis:slot:nav-items:end");
  });
});
