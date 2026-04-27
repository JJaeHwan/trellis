// 의도적 위반: L0(common) 이 L5(cmd) 를 import — L0-no-upper 룰을 트리거.
import { ENTRY } from "../cmd/main.js";

export const TAG = `common-references-${ENTRY}`;
