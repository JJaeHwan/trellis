import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Playbook, PlaybookMeta } from "../domain/index.js";
import { resolveResourcesDir } from "./resources-root.js";

function getPlaybooksRoot(): string {
  return resolveResourcesDir("playbooks");
}

export const SUPPORTED_PLAYBOOK_IDS = [
  "cli-tool",
  "b2b-saas",
  "ai-rag-platform",
] as const;

export type SupportedPlaybookId = (typeof SUPPORTED_PLAYBOOK_IDS)[number];

export function loadPlaybook(id: string): Playbook {
  const filePath = resolve(getPlaybooksRoot(), `${id}.json`);
  const text = readFileSync(filePath, "utf-8");
  return JSON.parse(text) as Playbook;
}

export function loadPlaybookMeta(id: string): PlaybookMeta {
  const filePath = resolve(getPlaybooksRoot(), `${id}.meta.json`);
  const text = readFileSync(filePath, "utf-8");
  return JSON.parse(text) as PlaybookMeta;
}

export function loadAllPlaybooks(): Playbook[] {
  return SUPPORTED_PLAYBOOK_IDS.map((id) => loadPlaybook(id));
}
