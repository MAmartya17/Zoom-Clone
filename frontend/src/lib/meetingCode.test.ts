import { describe, expect, it } from "vitest";
import { formatMeetingCode, parseMeetingInput } from "./meetingCode";

describe("parseMeetingInput", () => {
  it.each([
    ["12345678901", { code: "12345678901" }],
    ["123 4567 8901", { code: "12345678901" }],
    ["  123-4567-8901  ", { code: "12345678901" }],
  ])("accepts meeting ID %s", (input, expected) => {
    expect(parseMeetingInput(input)).toEqual(expected);
  });

  it("extracts code and passcode from an invite link", () => {
    expect(parseMeetingInput("https://zoom-clone.app/meeting/12345678901?pwd=Ab3xY9")).toEqual({
      code: "12345678901",
      passcode: "Ab3xY9",
    });
  });

  it("accepts links without protocol or passcode", () => {
    expect(parseMeetingInput("localhost:3000/meeting/12345678901")).toEqual({ code: "12345678901" });
  });

  it.each(["", "   ", "1234", "abcdefghijk", "123456789012", "https://example.com/other/12345678901"])(
    "rejects %j",
    (input) => {
      expect(parseMeetingInput(input)).toBeNull();
    },
  );
});

describe("formatMeetingCode", () => {
  it("groups digits like Zoom", () => {
    expect(formatMeetingCode("12345678901")).toBe("123 4567 8901");
  });
});
