import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Playbook, PlaybookMeta } from "../domain/index.js";

function getPlaybooksRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../resources/playbooks");
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
