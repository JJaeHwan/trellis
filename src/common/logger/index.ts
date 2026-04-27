import pino from "pino";

const isDebug = process.env.HARNESS_DEBUG === "1";

export const logger = pino(
  {
    level: isDebug ? "debug" : "silent",
  },
  pino.destination(2)
);

export type Logger = typeof logger;
