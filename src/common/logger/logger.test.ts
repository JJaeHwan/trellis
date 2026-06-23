import { afterEach, describe, expect, it, vi } from "vitest";

// logger/index.ts reads HARNESS_DEBUG at import time, so each case sets the env
// then re-imports the module via vi.resetModules() to re-evaluate the level.
const ORIGINAL = process.env.HARNESS_DEBUG;

async function freshLogger() {
  vi.resetModules();
  return (await import("./index.js")).logger;
}

describe("logger", () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.HARNESS_DEBUG;
    else process.env.HARNESS_DEBUG = ORIGINAL;
    vi.resetModules();
  });

  it("logger_exposesPinoMethods", async () => {
    const logger = await freshLogger();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("logger_defaultsToSilent_whenHarnessDebugUnset", async () => {
    delete process.env.HARNESS_DEBUG;
    const logger = await freshLogger();
    expect(logger.level).toBe("silent");
  });

  it("logger_usesDebug_whenHarnessDebugIs1", async () => {
    process.env.HARNESS_DEBUG = "1";
    const logger = await freshLogger();
    expect(logger.level).toBe("debug");
  });

  it("logger_staysSilent_whenHarnessDebugIsNot1", async () => {
    process.env.HARNESS_DEBUG = "true";
    const logger = await freshLogger();
    expect(logger.level).toBe("silent");
  });
});
