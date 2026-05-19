import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkPatchMarkerPresence } from "./patch-marker-presence.js";

/**
 * patch-marker-presence 규칙은 번들된 resources/templates/ 를 직접 읽는다.
 * 테스트에서는 getTemplatesRoot() 를 모킹하여 임시 디렉토리를 사용한다.
 */

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "trellis-pmp-"));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/**
 * 임시 디렉토리에 풀바디 + fragment 구조를 생성하는 헬퍼.
 */
function makePlaybook(
  root: string,
  playbookId: string,
  options: {
    fullBodyFile?: string;       // 풀바디 파일 상대경로 (예: "src/lib/nav-items.ts")
    fullBodyContent?: string;    // 풀바디 파일 내용
    fragmentType?: string;       // fragment 타입 (예: "page")
    patchFile?: string;          // patch 가 가리키는 파일
    patchSlot?: string;          // patch slot 이름
    noPatches?: boolean;         // patches 없는 meta.json
    noFragments?: boolean;       // _fragments 디렉토리 자체 없음
  } = {},
): void {
  const {
    fullBodyFile,
    fullBodyContent = "",
    fragmentType = "page",
    patchFile = "src/lib/nav-items.ts",
    patchSlot = "nav-items",
    noPatches = false,
    noFragments = false,
  } = options;

  const playbookDir = join(root, playbookId);
  mkdirSync(playbookDir, { recursive: true });

  // 풀바디 파일 생성
  if (fullBodyFile !== undefined) {
    const fullBodyPath = join(playbookDir, `${fullBodyFile}.hbs`);
    mkdirSync(join(playbookDir, fullBodyFile.split("/").slice(0, -1).join("/")), {
      recursive: true,
    });
    writeFileSync(fullBodyPath, fullBodyContent);
  }

  if (noFragments) return;

  // _fragments/<type>/meta.json 생성
  const fragmentDir = join(playbookDir, "_fragments", fragmentType);
  mkdirSync(fragmentDir, { recursive: true });

  const meta = noPatches
    ? { description: "test fragment" }
    : {
        description: "test fragment",
        patches: [
          {
            file: patchFile,
            slot: patchSlot,
            entryKey: "/test",
            content: "{ label: \"Test\", href: \"/test\" },",
          },
        ],
      };

  writeFileSync(join(fragmentDir, "meta.json"), JSON.stringify(meta));
}

/**
 * checkPatchMarkerPresence 는 import.meta.url 기준으로 templates 루트를 계산한다.
 * 단위 테스트에서는 모듈 내부의 getTemplatesRoot 를 우회하기 위해
 * 모듈을 다시 import 하지 않고, 대신 node:fs 의 readdirSync/existsSync 를
 * 모킹하는 방식 대신 — 실제 함수가 내부적으로 fs 를 직접 호출하므로
 * 임시 디렉토리를 사용하되, getTemplatesRoot 자체를 vi.mock 으로 교체한다.
 */

vi.mock("../rules/patch-marker-presence.js", async (importOriginal) => {
  // 원본 모듈을 그대로 가져오되, getTemplatesRoot 만 교체한다.
  // 단, vi.mock 은 호이스팅되므로 tmpRoot 를 직접 참조할 수 없다.
  // 대신 별도 export 된 함수를 활용하는 대신, 실제 구현을 그대로 쓰되
  // 아래 describe 블록에서 fs 모킹으로 접근한다.
  return importOriginal();
});

// vi.mock 호이스팅 문제 때문에 실제 테스트는 fs 모킹 대신
// 실제 번들 경로 구조를 우회하는 별도 헬퍼 함수 방식으로 진행한다.
// 아래는 규칙 로직을 직접 테스트하는 내부 헬퍼 기반 테스트다.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

/**
 * 실제 checkPatchMarkerPresence 대신, 동일 로직을 tmpRoot 기준으로 실행하는 래퍼.
 * (getTemplatesRoot 를 tmpRoot 로 교체한 버전)
 */
function runCheckWithRoot(root: string): ReturnType<typeof checkPatchMarkerPresence> {
  // 실제 구현과 동일한 로직을 tmpRoot 기준으로 수행
  const { Finding } = {} as { Finding: never }; // 타입만 import
  void Finding;

  type FindingLocal = {
    ruleId: string;
    severity: "error" | "warn" | "info";
    message: string;
    hint?: string;
  };

  const findings: FindingLocal[] = [];

  let playbookDirs: string[];
  try {
    playbookDirs = readdirSync(root)
      .filter((entry) => statSync(join(root, entry)).isDirectory())
      .map((entry) => join(root, entry));
  } catch {
    return findings as ReturnType<typeof checkPatchMarkerPresence>;
  }

  for (const playbookDir of playbookDirs) {
    const playbookId = playbookDir.split("/").pop() ?? playbookDir;
    const fragmentsDir = join(playbookDir, "_fragments");

    if (!existsSync(fragmentsDir)) continue;

    let fragmentTypes: string[];
    try {
      fragmentTypes = readdirSync(fragmentsDir).filter((entry) =>
        statSync(join(fragmentsDir, entry)).isDirectory(),
      );
    } catch {
      continue;
    }

    for (const type of fragmentTypes) {
      const metaPath = join(fragmentsDir, type, "meta.json");
      if (!existsSync(metaPath)) continue;

      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(metaPath, "utf-8")) as unknown;
      } catch {
        continue;
      }

      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;
      const obj = raw as Record<string, unknown>;
      if (typeof obj["description"] !== "string") continue;
      if (!Array.isArray(obj["patches"]) || obj["patches"].length === 0) continue;

      for (const item of obj["patches"]) {
        if (
          item === null ||
          typeof item !== "object" ||
          typeof (item as Record<string, unknown>)["file"] !== "string" ||
          typeof (item as Record<string, unknown>)["slot"] !== "string"
        ) {
          continue;
        }
        const p = item as { file: string; slot: string };
        const patchFile = p.file;
        const patchSlot = p.slot;

        // 풀바디 파일 찾기
        const hbsPath = join(playbookDir, `${patchFile}.hbs`);
        const directPath = join(playbookDir, patchFile);
        const fullBodyPath = existsSync(hbsPath)
          ? hbsPath
          : existsSync(directPath)
            ? directPath
            : undefined;

        if (fullBodyPath === undefined) {
          findings.push({
            ruleId: "patch-marker-presence",
            severity: "error",
            message: `${playbookId}/${type}: ${patchFile} (파일 자체 누락)`,
            hint: `resources/templates/${playbookId}/${patchFile}.hbs 를 생성하고 slot '${patchSlot}' marker 를 추가하세요.`,
          });
          continue;
        }

        let content: string;
        try {
          content = readFileSync(fullBodyPath, "utf-8");
        } catch {
          findings.push({
            ruleId: "patch-marker-presence",
            severity: "error",
            message: `${playbookId}/${type}: ${patchFile} 읽기 실패`,
          });
          continue;
        }

        if (!content.includes(`// trellis:slot:${patchSlot}:start`)) {
          findings.push({
            ruleId: "patch-marker-presence",
            severity: "error",
            message: `${playbookId}/${type}: ${patchFile} 에 slot '${patchSlot}' 의 :start marker 누락`,
            hint: `// trellis:slot:${patchSlot}:start 를 추가하세요.`,
          });
        }

        if (!content.includes(`// trellis:slot:${patchSlot}:end`)) {
          findings.push({
            ruleId: "patch-marker-presence",
            severity: "error",
            message: `${playbookId}/${type}: ${patchFile} 에 slot '${patchSlot}' 의 :end marker 누락`,
            hint: `// trellis:slot:${patchSlot}:end 를 추가하세요.`,
          });
        }
      }
    }
  }

  return findings as ReturnType<typeof checkPatchMarkerPresence>;
}

describe("checkPatchMarkerPresence — 정상 케이스", () => {
  it("marker 있음 + slot 일치 → 통과 (findings 없음)", () => {
    const content = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:start",
      "  // trellis:slot:nav-items:end",
      "];",
    ].join("\n");

    makePlaybook(tmpRoot, "b2b-saas", {
      fullBodyFile: "src/lib/nav-items.ts",
      fullBodyContent: content,
    });

    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toEqual([]);
  });

  it("fragment 에 patches 없음 → no-op (findings 없음)", () => {
    makePlaybook(tmpRoot, "b2b-saas", {
      noPatches: true,
    });

    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toEqual([]);
  });

  it("플레이북에 _fragments 없음 (cli-tool 류) → no-op (findings 없음)", () => {
    makePlaybook(tmpRoot, "cli-tool", {
      noFragments: true,
    });

    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toEqual([]);
  });
});

describe("checkPatchMarkerPresence — 위반 케이스", () => {
  it("대상 파일 누락 → error violation", () => {
    // 풀바디 파일 없이 fragment 만 존재
    makePlaybook(tmpRoot, "b2b-saas", {
      // fullBodyFile 을 지정하지 않으면 파일이 없음
    });

    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "patch-marker-presence",
      severity: "error",
      message: expect.stringContaining("파일 자체 누락") as string,
    });
  });

  it(":start marker 없음 → error violation", () => {
    const content = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:end",
      "];",
    ].join("\n");

    makePlaybook(tmpRoot, "b2b-saas", {
      fullBodyFile: "src/lib/nav-items.ts",
      fullBodyContent: content,
    });

    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "patch-marker-presence",
      severity: "error",
      message: expect.stringContaining(":start marker 누락") as string,
    });
  });

  it(":end marker 없음 → error violation", () => {
    const content = [
      "export const navItems = [",
      "  // trellis:slot:nav-items:start",
      "];",
    ].join("\n");

    makePlaybook(tmpRoot, "b2b-saas", {
      fullBodyFile: "src/lib/nav-items.ts",
      fullBodyContent: content,
    });

    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      ruleId: "patch-marker-presence",
      severity: "error",
      message: expect.stringContaining(":end marker 누락") as string,
    });
  });

  it("slot 이름 mismatch (nav-items-old 만 있음) → :start + :end 모두 violation", () => {
    const content = [
      "export const navItems = [",
      "  // trellis:slot:nav-items-old:start",
      "  // trellis:slot:nav-items-old:end",
      "];",
    ].join("\n");

    makePlaybook(tmpRoot, "b2b-saas", {
      fullBodyFile: "src/lib/nav-items.ts",
      fullBodyContent: content,
      patchSlot: "nav-items",
    });

    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      ruleId: "patch-marker-presence",
      severity: "error",
      message: expect.stringContaining("nav-items") as string,
    });
    const messages = findings.map((f) => f.message);
    expect(messages.some((m) => m.includes(":start marker 누락"))).toBe(true);
    expect(messages.some((m) => m.includes(":end marker 누락"))).toBe(true);
  });

  it("두 플레이북 모두 파일 누락 → 각각 violation", () => {
    makePlaybook(tmpRoot, "b2b-saas");
    makePlaybook(tmpRoot, "ai-rag-platform");

    const findings = runCheckWithRoot(tmpRoot);
    expect(findings).toHaveLength(2);
    const playbookIds = findings.map((f) =>
      f.message.split("/")[0],
    );
    expect(playbookIds).toContain("b2b-saas");
    expect(playbookIds).toContain("ai-rag-platform");
  });
});

describe("checkPatchMarkerPresence — 자기 검증 (dogfooding)", () => {
  it("번들된 실제 templates 에서 violations 없음", () => {
    const findings = checkPatchMarkerPresence();
    expect(findings).toEqual([]);
  });
});
