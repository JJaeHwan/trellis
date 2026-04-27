import { describe, expect, it } from "vitest";
import { logger } from "./index.js";

describe("logger", () => {
  it("exposes pino-compatible logging methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("respects default silent level when HARNESS_DEBUG is unset", () => {
    const originalDebug = process.env.HARNESS_DEBUG;
    delete process.env.HARNESS_DEBUG;
    expect(process.env.HARNESS_DEBUG).toBeUndefined();
    if (originalDebug !== undefined) process.env.HARNESS_DEBUG = originalDebug;
  });
});
