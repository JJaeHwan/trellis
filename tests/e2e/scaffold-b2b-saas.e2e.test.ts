import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProjectSpec } from "../../src/domain/index.js";
import { scaffold } from "../../src/service/scaffolder/index.js";

let workDir: string;
let projectDir: string;

const spec: ProjectSpec = {
  projectName: "e2e-test-saas",
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

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "trellis-saas-e2e-"));
  projectDir = join(workDir, "e2e-test-saas");
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("E2E — scaffold b2b-saas to a real temp directory", () => {
  it("writes a complete Next.js app tree to disk", () => {
    const tree = scaffold({ ...spec, rootPath: projectDir });
    expect(tree.length).toBeGreaterThan(27);

    expect(existsSync(projectDir)).toBe(true);
    expect(statSync(projectDir).isDirectory()).toBe(true);
  });

  it("produces a valid package.json with Next.js + Prisma + NextAuth", () => {
    const pkgPath = join(projectDir, "package.json");
    expect(existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      name: string;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.name).toBe("e2e-test-saas");
    expect(pkg.dependencies.next).toBeDefined();
    expect(pkg.dependencies["next-auth"]).toBeDefined();
    expect(pkg.dependencies["@prisma/client"]).toBeDefined();
    expect(pkg.dependencies.bcryptjs).toBeDefined();
    expect(pkg.devDependencies.prisma).toBeDefined();
    expect(pkg.devDependencies.tailwindcss).toBeDefined();
  });

  it("renders projectName into layout metadata", () => {
    const layout = readFileSync(join(projectDir, "src/app/layout.tsx"), "utf-8");
    expect(layout).toContain('title: "e2e-test-saas"');
  });

  it("strips .hbs extensions in output (no leftover template files)", () => {
    expect(existsSync(join(projectDir, "package.json.hbs"))).toBe(false);
    expect(existsSync(join(projectDir, "src/app/layout.tsx.hbs"))).toBe(false);
    expect(existsSync(join(projectDir, "prisma/schema.prisma.hbs"))).toBe(false);
  });

  it("preserves layered directory structure (src/lib + src/app)", () => {
    expect(statSync(join(projectDir, "src/lib/common")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/lib/config")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/lib/domain")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/lib/external")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/lib/service")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/app")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/app/api/auth")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/app/(authed)/dashboard")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "src/app/(authed)/admin")).isDirectory()).toBe(true);
    expect(statSync(join(projectDir, "prisma")).isDirectory()).toBe(true);
  });

  it("includes Prisma schema with User model", () => {
    const schema = readFileSync(join(projectDir, "prisma/schema.prisma"), "utf-8");
    expect(schema).toContain("model User");
    expect(schema).toContain("passwordHash");
    expect(schema).toContain("enum Role");
  });

  it("preserves dynamic Next.js route brackets [...nextauth]", () => {
    expect(
      existsSync(join(projectDir, "src/app/api/auth/[...nextauth]/route.ts")),
    ).toBe(true);
  });

  it("nav-items.ts contains trellis slot markers for nav-items", () => {
    const navItems = readFileSync(join(projectDir, "src/lib/nav-items.ts"), "utf-8");
    expect(navItems).toContain("// trellis:slot:nav-items:start");
    expect(navItems).toContain("// trellis:slot:nav-items:end");
  });

  it("schema.prisma contains trellis slot markers for prisma-models", () => {
    const schema = readFileSync(join(projectDir, "prisma/schema.prisma"), "utf-8");
    expect(schema).toContain("// trellis:slot:prisma-models:start");
    expect(schema).toContain("// trellis:slot:prisma-models:end");
  });

  it("services.ts exists and contains trellis slot markers for services", () => {
    const servicesPath = join(projectDir, "src/lib/services.ts");
    expect(existsSync(servicesPath)).toBe(true);
    const services = readFileSync(servicesPath, "utf-8");
    expect(services).toContain("// trellis:slot:services:start");
    expect(services).toContain("// trellis:slot:services:end");
    expect(services).toContain("export const services");
  });
});
