import type { ProjectSpec, VirtualTree } from "../../domain/index.js";
import { flush, loadTemplates, realFsAdapter, type FsAdapter } from "../../external/index.js";
import { buildContext, renderTree } from "../generator/index.js";

export interface ScaffoldOptions {
  /** true 이면 파일을 디스크에 쓰지 않고 트리만 반환. */
  readonly dryRun?: boolean;
  /** 비어있지 않은 디렉토리 덮어쓰기 허용. */
  readonly force?: boolean;
}

/**
 * ProjectSpec → 템플릿 로드 → 렌더 → (선택적) 디스크 flush.
 *
 * dryRun 모드에서는 fs 인자를 사용하지 않는다.
 * fs 인자는 테스트에서 in-memory fake 로 교체 가능.
 */
export function scaffold(
  spec: ProjectSpec,
  options: ScaffoldOptions = {},
  fs: FsAdapter = realFsAdapter,
): VirtualTree {
  const templates = loadTemplates(spec.playbookId);
  const ctx = buildContext(spec);
  const tree = renderTree(templates, ctx);

  if (!options.dryRun) {
    flush(tree, spec.rootPath, { force: options.force ?? false }, fs);
  }

  return tree;
}
