import type { Foo } from "../common/types.js";

export function getFoo(id: string): Foo {
  return { id };
}
