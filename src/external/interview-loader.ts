import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { InterviewDefinition } from "../domain/index.js";

function getResourcesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../resources");
}

export function loadInterviewDefinition(): InterviewDefinition {
  const filePath = resolve(getResourcesRoot(), "interview.json");
  const text = readFileSync(filePath, "utf-8");
  return JSON.parse(text) as InterviewDefinition;
}
