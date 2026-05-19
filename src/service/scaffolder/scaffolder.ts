import type { ProjectSpec, VirtualFile, VirtualTree } from "../../domain/index.js";
import { flush, loadTemplates, realFsAdapter, type FsAdapter } from "../../external/index.js";
import { buildContext, renderTree } from "../generator/index.js";

export interface ScaffoldOptions {
  /** true 이면 파일을 디스크에 쓰지 않고 트리만 반환. */
  readonly dryRun?: boolean;
  /** 비어있지 않은 디렉토리 덮어쓰기 허용. */
  readonly force?: boolean;
}

/**
 * ProjectSpec 을 `.trellis/spec.json` 으로 직렬화한 VirtualFile 을 만든다.
 *
 * rootPath 는 환경 의존적 절대 경로이므로 그대로 포함한다.
 * 골든 테스트에서는 호출 측이 placeholder 로 정규화한다.
 */
function buildSpecFile(spec: ProjectSpec): VirtualFile {
  return {
    path: ".trellis/spec.json",
    content: JSON.stringify(spec, null, 2) + "\n",
  };
}

/**
 * ProjectSpec → 템플릿 로드 → 렌더 → (선택적) 디스크 flush.
 *
 * 렌더된 트리에 `.trellis/spec.json` 을 추가한다.
 * dryRun 모드에서도 트리에 포함되므로 검증 가능하다.
 * fs 인자는 테스트에서 in-memory fake 로 교체 가능.
 */
export function scaffold(
  spec: ProjectSpec,
  options: ScaffoldOptions = {},
  fs: FsAdapter = realFsAdapter,
): VirtualTree {
  const templates = loadTemplates(spec.playbookId);
  const ctx = buildContext(spec);
  const templateTree = renderTree(templates, ctx);
  const tree: VirtualTree = [...templateTree, buildSpecFile(spec)];

  if (!options.dryRun) {
    flush(tree, spec.rootPath, { force: options.force ?? false }, fs);
  }

  return tree;
}
