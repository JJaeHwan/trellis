export type Severity = "error" | "warn" | "info";

export interface Finding {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly message: string;
  readonly hint?: string;
}

export interface DoctorReport {
  readonly targetDir: string;
  readonly findings: ReadonlyArray<Finding>;
}
