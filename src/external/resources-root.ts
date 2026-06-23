import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ExitCode, HarnessError } from "../common/errors/index.js";

/**
 * 번들된 `resources/` 디렉토리의 절대 경로를 반환한다.
 *
 * tsup 가 전체 소스를 단일 번들(`dist/cmd/index.js`)로 묶기 때문에, 각 loader 가
 * 자기 *소스* 위치 기준 상대경로(`../../..` 등)를 하드코딩하면 번들에서는
 * `import.meta.url` 이 항상 `dist/cmd/index.js` 가 되어 경로가 어긋난다 (소스 깊이
 * != 번들 깊이). `import.meta.url` 위치에서 위로 올라가며 `resources/` 를 포함한
 * 디렉토리를 탐색하면 소스(`src/**`)와 번들(`dist/cmd`) 양쪽에서 동일하게 동작한다.
 *
 * 탐색 시작점은 trellis 설치 위치(`import.meta.url`)이지 사용자 cwd 가 아니므로,
 * 사용자 프로젝트에 우연히 존재하는 `resources/` 디렉토리는 영향을 주지 않는다.
 */
export function resolveResourcesRoot(fromUrl: string = import.meta.url): string {
  let dir = dirname(fileURLToPath(fromUrl));
  for (let i = 0; i < 10; i++) {
    const candidate = resolve(dir, "resources");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break; // 파일시스템 루트 도달
    dir = parent;
  }
  throw new HarnessError(
    "번들된 resources/ 디렉토리를 찾을 수 없습니다.",
    ExitCode.GeneralError,
    "trellis 설치가 손상됐을 수 있습니다. npm i -g @woghks096/trellis 로 재설치하세요.",
  );
}

/** `resources/<sub>` 의 절대 경로. */
export function resolveResourcesDir(sub: string, fromUrl: string = import.meta.url): string {
  return resolve(resolveResourcesRoot(fromUrl), sub);
}
