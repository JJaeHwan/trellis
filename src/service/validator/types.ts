import type { Language } from "../../external/index.js";

export interface Violation {
  /** 위반의 출발 모듈 (상대 경로). */
  readonly from: string;
  /** 위반의 도착 모듈 (상대 경로). */
  readonly to: string;
  /** 위반된 룰 이름 (e.g., "L0-no-upper", "no-circular"). */
  readonly rule: string;
  readonly severity: "error" | "warn" | "info" | string;
}

export interface ValidationReport {
  readonly targetDir: string;
  readonly language: Language;
  readonly moduleCount: number;
  readonly violations: ReadonlyArray<Violation>;
}
