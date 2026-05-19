import { describe, expect, it } from "vitest";
import { HarnessError } from "../../common/errors/index.js";
import type { FsAdapter } from "../../external/fs-adapter.js";
import { loadFragment } from "./loader.js";

// ---------------------------------------------------------------------------
// Fake FsAdapter — in-memory filesystem for unit tests
// ---------------------------------------------------------------------------

type FakeFs = Record<string, string>; // absolute path → content

function makeFakeAdapter(files: FakeFs): FsAdapter {
  return {
    exists(path: string): boolean {
      if (path in files) return true;
      // treat as directory if any key starts with path + "/"
      return Object.keys(files).some((k) => k.startsWith(path + "/"));
    },
    isDirectory(path: string): boolean {
      return Object.keys(files).some((k) => k.startsWith(path + "/"));
    },
    isEmptyDirectory(path: string): boolean {
      return (
        Object.keys(files).filter((k) => k.startsWith(path + "/")).length === 0
      );
    },
    ensureDir(_path: string): void {
      // no-op for fake
    },
    writeFile(path: string, content: string): void {
      files[path] = content;
    },
    readFile(path: string): string {
      const content = files[path];
      if (content === undefined) {
        throw new Error(`ENOENT: no such file: ${path}`);
      }
      return content;
    },
    listDir(path: string): readonly string[] {
      const prefix = path + "/";
      const entries = new Set<string>();
      for (const key of Object.keys(files)) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const segment = rest.split("/")[0];
          if (segment !== undefined) entries.add(segment);
        }
      }
      return [...entries];
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers to build fake fragment paths
// The loader resolves paths relative to its own __dirname, so we patch via
// the fs adapter — we just need the adapter to respond correctly to any
// absolute path the loader constructs. We smuggle fragment dir resolution
// by making the fake fs match whatever absolute path the loader builds.
// ---------------------------------------------------------------------------

/**
 * Build a fake FsAdapter that simulates the fragment directory the loader
 * will compute at runtime. Because the loader uses `import.meta.url` to
 * find `resources/templates/`, we intercept by accepting *any* directory
 * path that ends with `resources/templates/<playbookId>/_fragments/<type>/`.
 */
function makeFakeAdapterForFragment(opts: {
  playbookId: string;
  type: string;
  meta?: string | null;       // null = omit meta.json entirely
  extraFiles?: Record<string, string>;
}): FsAdapter {
  const { playbookId, type, meta, extraFiles = {} } = opts;

  // We intercept exists/isDirectory/listDir by matching the suffix pattern
  // rather than exact absolute paths, because the loader builds paths using
  // import.meta.url which differs per environment.
  const fragSuffix = `resources/templates/${playbookId}/_fragments/${type}`;

  const relFiles: Record<string, string> = {};
  if (meta !== null) {
    relFiles["meta.json"] = meta ?? "";
  }
  for (const [k, v] of Object.entries(extraFiles)) {
    relFiles[k] = v;
  }

  return {
    exists(path: string): boolean {
      if (path.endsWith(fragSuffix)) return true;
      for (const rel of Object.keys(relFiles)) {
        if (path.endsWith(`${fragSuffix}/${rel}`)) return true;
      }
      return false;
    },
    isDirectory(path: string): boolean {
      if (path.endsWith(fragSuffix)) return true;
      // sub-dirs of the fragment
      const localSuffix = path.includes(fragSuffix)
        ? path.slice(path.indexOf(fragSuffix) + fragSuffix.length + 1)
        : null;
      if (localSuffix !== null) {
        return Object.keys(relFiles).some((k) => k.startsWith(localSuffix + "/"));
      }
      return false;
    },
    isEmptyDirectory(_path: string): boolean {
      return false;
    },
    ensureDir(_path: string): void { /* no-op */ },
    writeFile(_path: string, _content: string): void { /* no-op */ },
    readFile(path: string): string {
      for (const [rel, content] of Object.entries(relFiles)) {
        if (path.endsWith(`${fragSuffix}/${rel}`)) return content;
      }
      throw new Error(`ENOENT: ${path}`);
    },
    listDir(path: string): readonly string[] {
      if (!path.includes(fragSuffix)) return [];
      // find relative path inside the fragment dir
      const idx = path.indexOf(fragSuffix);
      const localPath = path.slice(idx + fragSuffix.length).replace(/^\//, "");

      const prefix = localPath ? localPath + "/" : "";
      const entries = new Set<string>();
      for (const key of Object.keys(relFiles)) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const segment = rest.split("/")[0];
          if (segment !== undefined && segment !== "") entries.add(segment);
        }
      }
      return [...entries];
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("loadFragment", () => {
  const VALID_META = JSON.stringify({
    description: "A test fragment",
    dependencies: { "some-pkg": "^1.0.0" },
    devDependencies: { "some-dev-pkg": "^2.0.0" },
  });

  it("loadFragment_validMetaAndTemplates_returnsFragment", () => {
    const fs = makeFakeAdapterForFragment({
      playbookId: "b2b-saas",
      type: "api",
      meta: VALID_META,
      extraFiles: {
        "route.ts.hbs": "export {}",
        "test/route.test.ts.hbs": "import {}",
      },
    });

    const fragment = loadFragment("b2b-saas", "api", fs);

    expect(fragment.playbookId).toBe("b2b-saas");
    expect(fragment.type).toBe("api");
    expect(fragment.meta.description).toBe("A test fragment");
    expect(fragment.meta.dependencies).toEqual({ "some-pkg": "^1.0.0" });
    expect(fragment.meta.devDependencies).toEqual({ "some-dev-pkg": "^2.0.0" });
    expect(fragment.templates).toHaveLength(2);
    const paths = fragment.templates.map((t) => t.sourcePath);
    expect(paths).toContain("route.ts.hbs");
    expect(paths).toContain("test/route.test.ts.hbs");
  });

  it("loadFragment_metaJsonMissing_throwsHarnessError", () => {
    const fs = makeFakeAdapterForFragment({
      playbookId: "b2b-saas",
      type: "api",
      meta: null,
    });

    expect(() => loadFragment("b2b-saas", "api", fs)).toThrowError(HarnessError);
    expect(() => loadFragment("b2b-saas", "api", fs)).toThrow(
      /unknown fragment: b2b-saas\/api/,
    );
  });

  it("loadFragment_metaJsonInvalid_throwsHarnessError", () => {
    const fs = makeFakeAdapterForFragment({
      playbookId: "b2b-saas",
      type: "api",
      meta: "{ not valid json %%%",
    });

    expect(() => loadFragment("b2b-saas", "api", fs)).toThrowError(HarnessError);
  });

  it("loadFragment_metaJsonMissingDescription_throwsHarnessError", () => {
    const fs = makeFakeAdapterForFragment({
      playbookId: "b2b-saas",
      type: "api",
      meta: JSON.stringify({ dependencies: {} }),
    });

    expect(() => loadFragment("b2b-saas", "api", fs)).toThrowError(HarnessError);
    expect(() => loadFragment("b2b-saas", "api", fs)).toThrow(/description/);
  });

  it("loadFragment_directoryMissing_throwsHarnessError", () => {
    // Empty fake fs — directory does not exist
    const fs = makeFakeAdapter({});

    expect(() => loadFragment("b2b-saas", "nonexistent", fs)).toThrowError(
      HarnessError,
    );
    expect(() => loadFragment("b2b-saas", "nonexistent", fs)).toThrow(
      /unknown fragment: b2b-saas\/nonexistent/,
    );
  });

  it("loadFragment_noOptionalDeps_returnsFragmentWithoutDeps", () => {
    const fs = makeFakeAdapterForFragment({
      playbookId: "ai-rag-platform",
      type: "page",
      meta: JSON.stringify({ description: "Simple fragment" }),
      extraFiles: { "page.tsx.hbs": "<div />" },
    });

    const fragment = loadFragment("ai-rag-platform", "page", fs);

    expect(fragment.meta.description).toBe("Simple fragment");
    expect(fragment.meta.dependencies).toBeUndefined();
    expect(fragment.meta.devDependencies).toBeUndefined();
    expect(fragment.templates).toHaveLength(1);
    expect(fragment.templates[0]!.sourcePath).toBe("page.tsx.hbs");
    expect(fragment.templates[0]!.content).toBe("<div />");
  });

  it("loadFragment_templatesAreSortedDeterministically", () => {
    const fs = makeFakeAdapterForFragment({
      playbookId: "b2b-saas",
      type: "api",
      meta: VALID_META,
      extraFiles: {
        "z-last.ts.hbs": "",
        "a-first.ts.hbs": "",
        "m-middle.ts.hbs": "",
      },
    });

    const fragment = loadFragment("b2b-saas", "api", fs);
    const paths = fragment.templates.map((t) => t.sourcePath);

    expect(paths).toEqual(["a-first.ts.hbs", "m-middle.ts.hbs", "z-last.ts.hbs"]);
  });
});
