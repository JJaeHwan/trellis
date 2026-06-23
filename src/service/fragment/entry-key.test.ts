import { describe, expect, it } from "vitest";
import { entryKeyPresent } from "./entry-key.js";

describe("entryKeyPresent", () => {
  it("entryKeyPresent_exactDelimitedMatch_true", () => {
    expect(entryKeyPresent('  { href: "/users", label: "Users" },', "/users")).toBe(true);
    expect(entryKeyPresent("  registerGreetCommand(program);", "registerGreetCommand")).toBe(true);
  });

  it("entryKeyPresent_prefixCollision_kebabPath_false", () => {
    // The core bug: '/user' must NOT match when only '/users' is present.
    expect(entryKeyPresent('  { href: "/users" },', "/user")).toBe(false);
  });

  it("entryKeyPresent_prefixCollision_identifier_false", () => {
    expect(entryKeyPresent("  registerUsersCommand(program);", "registerUsersCommand")).toBe(true);
    expect(entryKeyPresent("  registerUsersCommand(program);", "registerUser")).toBe(false);
    expect(entryKeyPresent("  registerUsersCommand(program);", "registerUsers")).toBe(false);
  });

  it("entryKeyPresent_kebabSuffixCollision_false", () => {
    // 'user' must NOT match 'user-profile' (hyphen continues the name).
    expect(entryKeyPresent('  { slug: "user-profile" },', "user")).toBe(false);
  });

  it("entryKeyPresent_bareKeyInsidePath_true", () => {
    // Convention: a bare entryKey identifies a token inside a path ('/' is a
    // separator), so 'reports' is present in '/reports'. Preserves existing usage.
    expect(entryKeyPresent('  { label: "Reports", href: "/reports" },', "reports")).toBe(true);
  });

  it("entryKeyPresent_absent_false", () => {
    expect(entryKeyPresent('  { href: "/billing" },', "/users")).toBe(false);
  });

  it("entryKeyPresent_emptyKey_false", () => {
    expect(entryKeyPresent("anything", "")).toBe(false);
  });

  it("entryKeyPresent_matchesWhenLaterOccurrenceIsBounded_true", () => {
    // First occurrence is a prefix collision ('/users'), a later one is exact.
    expect(entryKeyPresent('"/users", "/user"', "/user")).toBe(true);
  });

  it("entryKeyPresent_startAndEndOfString_true", () => {
    expect(entryKeyPresent("/users", "/users")).toBe(true);
  });
});
