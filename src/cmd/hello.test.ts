import { afterEach, describe, expect, it, vi } from "vitest";
import { runHello } from "./hello.js";

function captureStdout(): string[] {
  const out: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out.push(chunk as string);
    return true;
  });
  return out;
}

describe("runHello", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runHello_json_singleLineEnvelope", () => {
    const out = captureStdout();
    runHello(true);
    const lines = out.join("").trim().split("\n");
    expect(lines.length).toBe(1);
    const res = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(res).toEqual({ ok: true, command: "hello", message: "Hello from trellis" });
  });

  it("runHello_nonJson_plainGreeting", () => {
    const out = captureStdout();
    runHello(false);
    expect(out.join("")).toBe("Hello from trellis\n");
  });
});
