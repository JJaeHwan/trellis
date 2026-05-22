import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDoctor } from "../index.js";
import { checkAstPatchTargetValid } from "./ast-patch-target-valid.js";

const here = dirname(fileURLToPath(import.meta.url));
const trellisRoot = resolve(here, "../../../..");

describe("ast-patch-target-valid", () => {
  // 본 trellis 저장소 자체에 대해 실행 — 시범 fragment 없으므로 findings 0
  // (P15 단계에서는 b2b-saas / ai-rag-platform / cli-tool 모두 astPatches 미사용)
  // P15.10 에서 시범 fragment 추가 후에는 그 fragment 의 selector 가 valid 해야 함.
  it("checkAstPatchTargetValid_currentRepo_noFindings", () => {
    const findings = checkAstPatchTargetValid();
    // 시범 astPatch 가 아직 없다면 빈 배열, 있다면 모두 valid (severity error 0 개)
    const errors = findings.filter((f) => f.severity === "error");
    expect(errors).toEqual([]);
  });

  it("runDoctor_currentRepo_noAstPatchErrors", () => {
    const report = runDoctor(trellisRoot);
    const astErrors = report.findings.filter(
      (f) => f.ruleId === "ast-patch-target-valid" && f.severity === "error",
    );
    expect(astErrors).toEqual([]);
  });
});
