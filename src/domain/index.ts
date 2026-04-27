export type {
  Answer,
  InterviewDefinition,
  InterviewResult,
  Option,
  Question,
  SelectedOptionId,
} from "./interview.js";
export { FREEFORM_OPTION_ID } from "./interview.js";

export type {
  MatchResult,
  Playbook,
  PlaybookMeta,
  PlaybookScoring,
  PlaybookScoringRule,
} from "./playbook.js";
export { MATCH_MODES, displayMatchMode } from "./playbook.js";
export type { MatchMode } from "./playbook.js";

export type { BuildProjectSpecInput, ProjectSpec } from "./project-spec.js";
export { buildProjectSpec } from "./project-spec.js";
