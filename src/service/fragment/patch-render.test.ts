import { describe, expect, it } from "vitest";
import {
  describeSelector,
  renderAstPatch,
  renderHandlebars,
  renderPatch,
  renderSelector,
} from "./patch-render.js";

const ctx = {
  name: "user",
  namePascal: "User",
  nameKebab: "user",
  nameCamel: "user",
  nameSnake: "user",
  projectName: "demo",
};

describe("patch-render", () => {
  it("renderHandlebars_substitutesTokensAndHelpers", () => {
    expect(renderHandlebars("a/{{nameKebab}}/b", ctx)).toBe("a/user/b");
    expect(renderHandlebars("{{pascal name}}", ctx)).toBe("User");
  });

  it("renderPatch_rendersFileEntryKeyContent_keepsSlotStatic", () => {
    const out = renderPatch(
      { file: "src/{{nameKebab}}.ts", slot: "nav-items", entryKey: "/{{nameKebab}}", content: "x{{namePascal}}" },
      ctx,
    );
    expect(out).toEqual({ file: "src/user.ts", slot: "nav-items", entryKey: "/user", content: "xUser" });
  });

  it("renderSelector_objectKey_rendersTargetAndKey", () => {
    expect(
      renderSelector({ type: "objectKey", target: "{{nameCamel}}Map", key: "/{{nameKebab}}" }, ctx),
    ).toEqual({ type: "objectKey", target: "userMap", key: "/user" });
  });

  it("renderAstPatch_rendersAllFields", () => {
    const out = renderAstPatch(
      { file: "{{nameKebab}}.ts", selector: { type: "arrayPush", target: "{{nameCamel}}s" }, entryKey: "{{namePascal}}", content: "c" },
      ctx,
    );
    expect(out.file).toBe("user.ts");
    expect(out.selector).toEqual({ type: "arrayPush", target: "users" });
    expect(out.entryKey).toBe("User");
  });

  it("describeSelector_summaries", () => {
    expect(describeSelector({ type: "arrayPush", target: "items" })).toBe("arrayPush:items");
    expect(describeSelector({ type: "objectKey", target: "m", key: "/a" })).toBe("objectKey:m./a");
    expect(describeSelector({ type: "importAdd", from: "@/x" })).toBe("importAdd:@/x");
  });
});
