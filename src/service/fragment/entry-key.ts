/**
 * entryKey 가 텍스트에 "토큰 경계" 단위로 존재하는지 검사한다.
 *
 * 단순 substring(`text.includes(entryKey)`) 은 prefix 충돌을 일으킨다:
 * entryKey `/user` 가 기존 `/users` 의 substring 이라 멱등 검사가 오탐 skip 하고,
 * 역연산(un-patch)은 더 긴 항목을 잘못 제거한다. 실제 entryKey 가 nameKebab
 * 파생(`/users`, `registerUsersCommand` 등)이라 'user' 다음 'users' 같은 흔한
 * 시나리오에서 발화한다.
 *
 * entryKey 의 앞뒤 문자가 "이름 연속 문자"(식별자/케밥 세그먼트를 이어가는 문자
 * = 영숫자·`_`·`-`)가 아닐 때만 일치로 본다:
 *   - `/user` 는 `/users` 의 뒤(`s`)가 연속 문자라 불일치 → prefix 충돌 차단.
 *   - `user` 는 `user-profile` 의 뒤(`-`)가 연속 문자라 불일치 → kebab 충돌 차단.
 *   - `reports` 는 `/reports`(앞이 `/` = 구분자) 안에서 일치 → 기존 컨벤션
 *     (entryKey 가 경로 내부 토큰을 가리키는 사용법) 보존.
 * `/`·`.`·따옴표·공백 등은 구분자로 본다.
 */
const NAME_CONTINUATION = /[A-Za-z0-9_-]/;

export function entryKeyPresent(text: string, entryKey: string): boolean {
  if (entryKey.length === 0) return false;

  let from = 0;
  for (;;) {
    const idx = text.indexOf(entryKey, from);
    if (idx === -1) return false;

    const before = idx === 0 ? "" : text[idx - 1]!;
    const afterIdx = idx + entryKey.length;
    const after = afterIdx >= text.length ? "" : text[afterIdx]!;

    const boundedLeft = before === "" || !NAME_CONTINUATION.test(before);
    const boundedRight = after === "" || !NAME_CONTINUATION.test(after);
    if (boundedLeft && boundedRight) return true;

    from = idx + 1;
  }
}
