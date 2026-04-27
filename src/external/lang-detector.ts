import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type Language = "ts-js" | "java" | "python" | "go" | "unknown";

const MANIFESTS: ReadonlyArray<{ file: string; lang: Language }> = [
  { file: "package.json", lang: "ts-js" },
  { file: "pom.xml", lang: "java" },
  { file: "build.gradle", lang: "java" },
  { file: "build.gradle.kts", lang: "java" },
  { file: "pyproject.toml", lang: "python" },
  { file: "requirements.txt", lang: "python" },
  { file: "go.mod", lang: "go" },
];

export function detectLanguage(targetDir: string): Language {
  for (const { file, lang } of MANIFESTS) {
    if (existsSync(resolve(targetDir, file))) {
      return lang;
    }
  }
  return "unknown";
}
