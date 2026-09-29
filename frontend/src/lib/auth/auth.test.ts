import { describe, expect, it } from "vitest";
import { validateAuthForm } from "@/lib/validation/authForm";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it.each(["/", "/meetings?tab=previous", "/meeting/12345678901?host=1"])("keeps same-site path %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
    "rejects %j",
    (value) => {
      expect(safeNextPath(value)).toBe("/");
    },
  );
});

describe("validateAuthForm", () => {
  const valid = { name: "Priya Sharma", email: "priya@example.com", password: "secret123" };

  it("accepts valid sign-up and login values", () => {
    expect(validateAuthForm(valid, "signup")).toEqual({});
    expect(validateAuthForm({ ...valid, name: "" }, "login")).toEqual({});
  });

  it.each([
    [{ email: "nope" }, "email"],
    [{ name: "  " }, "name"],
    [{ password: "short1" }, "password"],
    [{ password: "lettersonly" }, "password"],
  ])("flags %o on sign-up", (patch, field) => {
    expect(validateAuthForm({ ...valid, ...patch }, "signup")).toHaveProperty(field);
  });

  it("only requires a non-empty password on login", () => {
    expect(validateAuthForm({ ...valid, password: "x" }, "login")).toEqual({});
    expect(validateAuthForm({ ...valid, password: "" }, "login")).toHaveProperty("password");
  });
});
