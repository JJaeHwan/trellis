/**
 * Migration Manifest — 한 minor 버전 간 변경 사항 선언.
 *
 * resources/migrations/<from>-to-<to>.json 파일 형식.
 * upgrade 는 manifest 들을 from→to 순차 적용.
 */
export interface MigrationManifest {
  readonly from: string;
  readonly to: string;
  readonly playbooks: Readonly<Record<string, PlaybookMigration>>;
}

export interface PlaybookMigration {
  readonly addSlots?: readonly AddSlotAction[];
  readonly addFiles?: readonly AddFileAction[];
}

/**
 * 새 slot marker 를 풀바디 파일에 자동 삽입.
 * anchor 다음 줄에 marker 쌍을 삽입 (insert-only, 멱등 — entryKey 가 slot 이름).
 */
export interface AddSlotAction {
  readonly file: string;
  readonly slot: string;
  readonly afterLine: string;
  readonly indent?: string;
}

/**
 * 신규 필수 파일 추가. 이미 존재하면 skip (사용자 수정 보호).
 */
export interface AddFileAction {
  readonly path: string;
  readonly content: string;
}
