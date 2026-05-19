import { describe, expect, it } from "vitest";
import type { Fragment } from "./types.js";
import { buildFragmentContext, renderFragment } from "./renderer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFragment(templates: Record<string, string>): Fragment {
  return {
    playbookId: "b2b-saas",
    type: "api",
    meta: { description: "test fragment" },
    templates: Object.entries(templates).map(([sourcePath, content]) => ({
      sourcePath,
      content,
    })),
  };
}

// ---------------------------------------------------------------------------
// buildFragmentContext
// ---------------------------------------------------------------------------

describe("buildFragmentContext", () => {
  it("buildFragmentContext_kebabInput_allCasesCorrect", () => {
    const ctx = buildFragmentContext("user-profile");

    expect(ctx.name).toBe("user-profile");
    expect(ctx.nameKebab).toBe("user-profile");
    expect(ctx.namePascal).toBe("UserProfile");
    expect(ctx.nameCamel).toBe("userProfile");
    expect(ctx.nameSnake).toBe("user_profile");
  });

  it("buildFragmentContext_snakeInput_allCasesCorrect", () => {
    const ctx = buildFragmentContext("user_profile");

    expect(ctx.name).toBe("user_profile");
    // toKebab converts underscores to dashes
    expect(ctx.nameKebab).toBe("user-profile");
    expect(ctx.namePascal).toBe("UserProfile");
    expect(ctx.nameCamel).toBe("userProfile");
    expect(ctx.nameSnake).toBe("user_profile");
  });

  it("buildFragmentContext_pascalInput_allCasesCorrect", () => {
    const ctx = buildFragmentContext("UserProfile");

    expect(ctx.name).toBe("UserProfile");
    expect(ctx.nameKebab).toBe("user-profile");
    expect(ctx.namePascal).toBe("UserProfile");
    expect(ctx.nameCamel).toBe("userprofile");
    expect(ctx.nameSnake).toBe("user_profile");
  });

  it("buildFragmentContext_simpleInput_allCasesCorrect", () => {
    const ctx = buildFragmentContext("users");

    expect(ctx.name).toBe("users");
    expect(ctx.nameKebab).toBe("users");
    expect(ctx.namePascal).toBe("Users");
    expect(ctx.nameCamel).toBe("users");
    expect(ctx.nameSnake).toBe("users");
  });

  it("buildFragmentContext_withExtras_mergesExtras", () => {
    const ctx = buildFragmentContext("users", { projectName: "my-app", custom: "val" });

    expect(ctx.name).toBe("users");
    expect(ctx.projectName).toBe("my-app");
    expect(ctx.custom).toBe("val");
  });
});

// ---------------------------------------------------------------------------
// renderFragment — content rendering
// ---------------------------------------------------------------------------

describe("renderFragment_contentRendering", () => {
  it("renderFragment_hbsTemplate_rendersContentAndStripsExtension", () => {
    const fragment = makeFragment({
      "route.ts.hbs": 'export const handler = "{{name}}";',
    });
    const ctx = buildFragmentContext("users");
    const tree = renderFragment(fragment, ctx);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.path).toBe("route.ts");
    expect(tree[0]!.content).toBe('export const handler = "users";');
  });

  it("renderFragment_nonHbsTemplate_preservesVerbatim", () => {
    const fragment = makeFragment({
      ".gitkeep": "",
      "README.md": "# Static content",
    });
    const ctx = buildFragmentContext("users");
    const tree = renderFragment(fragment, ctx);

    expect(tree).toHaveLength(2);
    const gitkeep = tree.find((f) => f.path === ".gitkeep");
    const readme = tree.find((f) => f.path === "README.md");
    expect(gitkeep!.content).toBe("");
    expect(readme!.content).toBe("# Static content");
  });

  it("renderFragment_allCaseHelpers_substitutedInContent", () => {
    const fragment = makeFragment({
      "out.ts.hbs":
        "pascal={{namePascal}} kebab={{nameKebab}} camel={{nameCamel}} snake={{nameSnake}}",
    });
    const ctx = buildFragmentContext("user-profile");
    const tree = renderFragment(fragment, ctx);

    expect(tree[0]!.content).toBe(
      "pascal=UserProfile kebab=user-profile camel=userProfile snake=user_profile",
    );
  });

  it("renderFragment_handlebarsHelpers_worksInContent", () => {
    const fragment = makeFragment({
      "out.ts.hbs": "{{pascal name}} / {{kebab name}} / {{camel name}} / {{snake name}}",
    });
    const ctx = buildFragmentContext("user-profile");
    const tree = renderFragment(fragment, ctx);

    expect(tree[0]!.content).toBe("UserProfile / user-profile / userProfile / user_profile");
  });
});

// ---------------------------------------------------------------------------
// renderFragment — path rendering
// ---------------------------------------------------------------------------

describe("renderFragment_pathRendering", () => {
  it("renderFragment_pathContainsTemplate_substitutesPath", () => {
    const fragment = makeFragment({
      "app/api/{{nameKebab}}/route.ts.hbs": 'export {}',
    });
    const ctx = buildFragmentContext("user-profile");
    const tree = renderFragment(fragment, ctx);

    expect(tree[0]!.path).toBe("app/api/user-profile/route.ts");
  });

  it("renderFragment_pathContainsPascalTemplate_substitutesPath", () => {
    const fragment = makeFragment({
      "src/components/{{namePascal}}/index.tsx.hbs": "<div />",
    });
    const ctx = buildFragmentContext("user-profile");
    const tree = renderFragment(fragment, ctx);

    expect(tree[0]!.path).toBe("src/components/UserProfile/index.tsx");
  });

  it("renderFragment_staticPath_preservedAsIs", () => {
    const fragment = makeFragment({
      "src/utils/helper.ts.hbs": "export const x = 1;",
    });
    const ctx = buildFragmentContext("users");
    const tree = renderFragment(fragment, ctx);

    expect(tree[0]!.path).toBe("src/utils/helper.ts");
  });

  it("renderFragment_multipleTemplates_allRendered", () => {
    const fragment = makeFragment({
      "app/api/{{nameKebab}}/route.ts.hbs": 'import { {{namePascal}} } from "./model";',
      "app/api/{{nameKebab}}/route.test.ts.hbs": 'describe("{{name}}", () => {});',
    });
    const ctx = buildFragmentContext("users");
    const tree = renderFragment(fragment, ctx);

    expect(tree).toHaveLength(2);
    const route = tree.find((f) => f.path === "app/api/users/route.ts");
    const test = tree.find((f) => f.path === "app/api/users/route.test.ts");
    expect(route!.content).toBe('import { Users } from "./model";');
    expect(test!.content).toBe('describe("users", () => {});');
  });
});
