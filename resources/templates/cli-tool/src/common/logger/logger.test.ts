import { describe, expect, it } from "vitest";
import { logger } from "./index.js";

describe("logger", () => {
  it("exposes pino-compatible logging methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });
});
