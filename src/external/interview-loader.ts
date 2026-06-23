import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { InterviewDefinition } from "../domain/index.js";
import { resolveResourcesRoot } from "./resources-root.js";

export function loadInterviewDefinition(): InterviewDefinition {
  const filePath = resolve(resolveResourcesRoot(), "interview.json");
  const text = readFileSync(filePath, "utf-8");
  return JSON.parse(text) as InterviewDefinition;
}
