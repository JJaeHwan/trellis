import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, sep as pathSep } from "node:path";
import type { Template } from "../domain/index.js";
import { resolveResourcesDir } from "./resources-root.js";

function getTemplatesRoot(): string {
  return resolveResourcesDir("templates");
}

export function loadTemplates(playbookId: string): Template[] {
  const root = resolve(getTemplatesRoot(), playbookId);
  const result: Template[] = [];
  walk(root, root, result);
  // sort for deterministic ordering (helps tests/goldens)
  result.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  return result;
}

function walk(rootDir: string, currentDir: string, accumulator: Template[]): void {
  const entries = readdirSync(currentDir);
  for (const entry of entries) {
    const fullPath = resolve(currentDir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(rootDir, fullPath, accumulator);
    } else if (stat.isFile()) {
      const rel = fullPath.slice(rootDir.length + 1);
      const sourcePath = pathSep === "/" ? rel : rel.split(pathSep).join("/");
      const content = readFileSync(fullPath, "utf-8");
      accumulator.push({ sourcePath, content });
    }
  }
}
