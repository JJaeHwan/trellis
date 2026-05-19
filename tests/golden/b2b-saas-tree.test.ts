import { describe, expect, it } from "vitest";
import { loadTemplates } from "../../src/external/index.js";
import { buildContext, renderTree } from "../../src/service/generator/index.js";
import type { ProjectSpec } from "../../src/domain/index.js";

const baseSpec: ProjectSpec = {
  projectName: "my-test-saas",
  rootPath: "/tmp/my-test-saas",
  playbookId: "b2b-saas",
  matchMode: "exact",
  matchScore: 1,
  answers: [
    { questionId: "1", selectedOptionId: "A" },
    { questionId: "2", selectedOptionId: "B" },
    { questionId: "5", selectedOptionId: "B" },
  ],
  placeholders: {},
  generatedAt: "2026-04-27T00:00:00.000Z",
  trellisVersion: "0.0.0-golden",
};

describe("golden — b2b-saas template tree", () => {
  it("loads the b2b-saas template set with expected key files", () => {
    const templates = loadTemplates("b2b-saas");
    expect(templates.length).toBeGreaterThan(28);

    const sourcePaths = templates.map((t) => t.sourcePath);
    // Root config
    expect(sourcePaths).toContain("package.json.hbs");
    expect(sourcePaths).toContain("tsconfig.json");
    expect(sourcePaths).toContain("next.config.mjs");
    expect(sourcePaths).toContain("tailwind.config.ts");
    expect(sourcePaths).toContain(".eslintrc.cjs");
    expect(sourcePaths).toContain(".gitignore");
    expect(sourcePaths).toContain(".env.example.hbs");
    expect(sourcePaths).toContain(".github/workflows/ci.yml.hbs");
    // Prisma
    expect(sourcePaths).toContain("prisma/schema.prisma.hbs");
    // App layer
    expect(sourcePaths).toContain("src/app/layout.tsx.hbs");
    expect(sourcePaths).toContain("src/app/page.tsx.hbs");
    expect(sourcePaths).toContain("src/app/globals.css");
    expect(sourcePaths).toContain("src/app/(auth)/login/page.tsx");
    expect(sourcePaths).toContain("src/app/(auth)/register/page.tsx");
    expect(sourcePaths).toContain("src/app/(authed)/layout.tsx.hbs");
    expect(sourcePaths).toContain("src/app/(authed)/dashboard/page.tsx.hbs");
    expect(sourcePaths).toContain("src/app/(authed)/admin/page.tsx");
    expect(sourcePaths).toContain("src/app/api/auth/[...nextauth]/route.ts");
    expect(sourcePaths).toContain("src/app/api/auth/register/route.ts");
    expect(sourcePaths).toContain("src/app/api/me/route.ts");
    expect(sourcePaths).toContain("src/app/api/admin/users/route.ts");
    // Components
    expect(sourcePaths).toContain("src/components/Sidebar.tsx.hbs");
    // Lib layer
    expect(sourcePaths).toContain("src/lib/nav-items.ts.hbs");
    expect(sourcePaths).toContain("src/lib/breadcrumb-map.ts.hbs");
    expect(sourcePaths).toContain("src/lib/services.ts.hbs");
    expect(sourcePaths).toContain("src/lib/common/errors.ts");
    expect(sourcePaths).toContain("src/lib/config/env.ts");
    expect(sourcePaths).toContain("src/lib/domain/user.ts");
    expect(sourcePaths).toContain("src/lib/external/db.ts");
    expect(sourcePaths).toContain("src/lib/service/auth.ts");
    expect(sourcePaths).toContain("src/lib/service/user.ts");
    expect(sourcePaths).toContain("src/lib/service/admin.ts");
    // Middleware
    expect(sourcePaths).toContain("src/middleware.ts");
  });

  it("renders templates and strips .hbs extension on output", () => {
    const templates = loadTemplates("b2b-saas");
    const ctx = buildContext(baseSpec);
    const tree = renderTree(templates, ctx);

    const paths = tree.map((f) => f.path);
    expect(paths).toContain("package.json");
    expect(paths).toContain("README.md");
    expect(paths).toContain("LICENSE");
    expect(paths).toContain("prisma/schema.prisma");
    expect(paths).toContain("src/app/layout.tsx");
    expect(paths).toContain("src/app/api/auth/[...nextauth]/route.ts");

    const hbsLeftovers = paths.filter((p) => p.endsWith(".hbs"));
    expect(hbsLeftovers).toEqual([]);
  });

  it("substitutes projectName into package.json", () => {
    const templates = loadTemplates("b2b-saas");
    const tree = renderTree(templates, buildContext(baseSpec));
    const pkg = tree.find((f) => f.path === "package.json");
    expect(pkg).toBeDefined();
    const parsed = JSON.parse(pkg!.content) as {
      name: string;
      dependencies: Record<string, string>;
    };
    expect(parsed.name).toBe("my-test-saas");
    expect(parsed.dependencies.next).toBeDefined();
    expect(parsed.dependencies["next-auth"]).toBeDefined();
  });

  it("substitutes projectName into layout metadata", () => {
    const templates = loadTemplates("b2b-saas");
    const tree = renderTree(templates, buildContext(baseSpec));
    const layout = tree.find((f) => f.path === "src/app/layout.tsx");
    expect(layout).toBeDefined();
    expect(layout!.content).toContain('title: "my-test-saas"');
  });

  it("includes prisma User model with role enum", () => {
    const templates = loadTemplates("b2b-saas");
    const tree = renderTree(templates, buildContext(baseSpec));
    const schema = tree.find((f) => f.path === "prisma/schema.prisma");
    expect(schema).toBeDefined();
    expect(schema!.content).toContain("model User");
    expect(schema!.content).toContain("enum Role");
    expect(schema!.content).toContain("passwordHash");
  });

  it("nav-items.ts contains trellis slot markers for nav-items and admin-items", () => {
    const templates = loadTemplates("b2b-saas");
    const tree = renderTree(templates, buildContext(baseSpec));
    const navItems = tree.find((f) => f.path === "src/lib/nav-items.ts");
    expect(navItems).toBeDefined();
    expect(navItems!.content).toContain("// trellis:slot:nav-items:start");
    expect(navItems!.content).toContain("// trellis:slot:nav-items:end");
    expect(navItems!.content).toContain("// trellis:slot:admin-items:start");
    expect(navItems!.content).toContain("// trellis:slot:admin-items:end");
  });

  it("breadcrumb-map.ts exists and contains trellis slot markers for breadcrumb", () => {
    const templates = loadTemplates("b2b-saas");
    const tree = renderTree(templates, buildContext(baseSpec));
    const breadcrumbMap = tree.find((f) => f.path === "src/lib/breadcrumb-map.ts");
    expect(breadcrumbMap).toBeDefined();
    expect(breadcrumbMap!.content).toContain("// trellis:slot:breadcrumb:start");
    expect(breadcrumbMap!.content).toContain("// trellis:slot:breadcrumb:end");
    expect(breadcrumbMap!.content).toContain("export const breadcrumbMap");
  });

  it("schema.prisma contains trellis slot markers for prisma-models", () => {
    const templates = loadTemplates("b2b-saas");
    const tree = renderTree(templates, buildContext(baseSpec));
    const schema = tree.find((f) => f.path === "prisma/schema.prisma");
    expect(schema).toBeDefined();
    expect(schema!.content).toContain("// trellis:slot:prisma-models:start");
    expect(schema!.content).toContain("// trellis:slot:prisma-models:end");
  });

  it("services.ts exists and contains trellis slot markers for services", () => {
    const templates = loadTemplates("b2b-saas");
    const tree = renderTree(templates, buildContext(baseSpec));
    const services = tree.find((f) => f.path === "src/lib/services.ts");
    expect(services).toBeDefined();
    expect(services!.content).toContain("// trellis:slot:services:start");
    expect(services!.content).toContain("// trellis:slot:services:end");
    expect(services!.content).toContain("export const services");
  });
});
