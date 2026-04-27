import { describe, expect, it } from "vitest";
import {
  buildContext,
  renderTree,
  toCamel,
  toKebab,
  toPascal,
} from "./index.js";
import type { Template } from "./index.js";
import type { ProjectSpec } from "../../domain/index.js";

const baseSpec: ProjectSpec = {
  projectName: "my-cli",
  rootPath: "/tmp/my-cli",
  playbookId: "cli-tool",
  matchMode: "exact",
  matchScore: 1,
  answers: [
    { questionId: "1", selectedOptionId: "B" },
    { questionId: "2", selectedOptionId: "A" },
    { questionId: "5", selectedOptionId: "A" },
  ],
  placeholders: {},
  generatedAt: "2026-04-27T00:00:00.000Z",
  trellisVersion: "1.2.3",
};

describe("toKebab / toPascal / toCamel", () => {
  it("normalizes mixed input correctly", () => {
    expect(toKebab("MyCoolApp")).toBe("my-cool-app");
    expect(toKebab("My_Cool App")).toBe("my-cool-app");
    expect(toPascal("my-cool-app")).toBe("MyCoolApp");
    expect(toPascal("my_cool_app")).toBe("MyCoolApp");
    expect(toCamel("my-cool-app")).toBe("myCoolApp");
    expect(toCamel("MyCoolApp")).toBe("mycoolapp");
  });
});

describe("buildContext", () => {
  it("derives kebab/pascal forms and answer map from a ProjectSpec", () => {
    const ctx = buildContext(baseSpec);

    expect(ctx.projectName).toBe("my-cli");
    expect(ctx.projectNameKebab).toBe("my-cli");
    expect(ctx.projectNamePascal).toBe("MyCli");
    expect(ctx.year).toBe(2026);
    expect(ctx.answers).toEqual({ "1": "B", "2": "A", "5": "A" });
    expect(ctx.playbookId).toBe("cli-tool");
    expect(ctx.trellisVersion).toBe("1.2.3");
  });
});

describe("renderTree", () => {
  it("renders .hbs templates and strips the extension", () => {
    const templates: Template[] = [
      {
        sourcePath: "package.json.hbs",
        content: '{ "name": "{{projectName}}" }',
      },
    ];
    const ctx = buildContext(baseSpec);
    const tree = renderTree(templates, ctx);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.path).toBe("package.json");
    expect(tree[0]!.content).toBe('{ "name": "my-cli" }');
  });

  it("preserves non-.hbs files verbatim", () => {
    const templates: Template[] = [
      { sourcePath: ".gitignore", content: "node_modules\ndist\n" },
      { sourcePath: "src/.gitkeep", content: "" },
    ];
    const ctx = buildContext(baseSpec);
    const tree = renderTree(templates, ctx);

    expect(tree[0]).toEqual({
      path: ".gitignore",
      content: "node_modules\ndist\n",
    });
    expect(tree[1]).toEqual({ path: "src/.gitkeep", content: "" });
  });

  it("supports kebab/pascal/camel/eq helpers", () => {
    const templates: Template[] = [
      { sourcePath: "kebab.hbs", content: "{{kebab projectName}}" },
      { sourcePath: "pascal.hbs", content: "{{pascal projectName}}" },
      {
        sourcePath: "branch.hbs",
        content: '{{#if (eq answers.[5] "A")}}NO_FE{{else}}WITH_FE{{/if}}',
      },
    ];
    const spec: ProjectSpec = { ...baseSpec, projectName: "My_Cool_App" };
    const ctx = buildContext(spec);
    const tree = renderTree(templates, ctx);

    expect(tree[0]!.content).toBe("my-cool-app");
    expect(tree[1]!.content).toBe("MyCoolApp");
    expect(tree[2]!.content).toBe("NO_FE");
  });
});
