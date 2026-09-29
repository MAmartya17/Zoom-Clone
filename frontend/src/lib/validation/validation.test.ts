import { describe, expect, it } from "vitest";
import { validateDisplayName, validateMeetingInput } from "./joinForm";
import { hasErrors, validateScheduleForm, type ScheduleFormValues } from "./scheduleForm";

const NOW = new Date("2030-01-01T12:00:00Z");

const valid: ScheduleFormValues = {
  title: "Sprint Planning",
  description: "",
  date: "2030-01-02",
  time: "10:00",
  durationHours: 1,
  durationMinutes: 0,
  timezone: "UTC",
  passcodeEnabled: true,
  passcode: "abc123",
  hostVideoOn: true,
  participantVideoOn: true,
  muteOnEntry: false,
};

describe("validateScheduleForm", () => {
  it("accepts a valid meeting", () => {
    expect(hasErrors(validateScheduleForm(valid, NOW))).toBe(false);
  });

  it.each<[Partial<ScheduleFormValues>, string]>([
    [{ title: "   " }, "title"],
    [{ title: "x".repeat(201) }, "title"],
    [{ description: "x".repeat(2001) }, "description"],
    [{ date: "2029-12-31" }, "when"],
    [{ date: "2030-02-30" }, "when"],
    [{ durationHours: 0, durationMinutes: 0 }, "duration"],
    [{ durationHours: 24, durationMinutes: 15 }, "duration"],
    [{ passcode: "has space" }, "passcode"],
    [{ passcode: "" }, "passcode"],
  ])("flags %o on %s", (patch, field) => {
    expect(validateScheduleForm({ ...valid, ...patch }, NOW)).toHaveProperty(field);
  });

  it("ignores the passcode when it is disabled", () => {
    expect(validateScheduleForm({ ...valid, passcodeEnabled: false, passcode: "" }, NOW)).not.toHaveProperty("passcode");
  });

  it("evaluates the start time in the chosen time zone", () => {
    // 2030-01-01 13:00 in Tokyo is 04:00 UTC, i.e. before NOW.
    const values = { ...valid, date: "2030-01-01", time: "13:00", timezone: "Asia/Tokyo" };
    expect(validateScheduleForm(values, NOW)).toHaveProperty("when");
    expect(validateScheduleForm({ ...values, timezone: "America/Los_Angeles" }, NOW)).not.toHaveProperty("when");
  });
});

describe("join form validation", () => {
  it("requires a non-empty display name within limits", () => {
    expect(validateDisplayName("  ")).not.toBeNull();
    expect(validateDisplayName("x".repeat(65))).not.toBeNull();
    expect(validateDisplayName("Priya")).toBeNull();
  });

  it("parses meeting IDs and links and rejects garbage", () => {
    expect(validateMeetingInput("123 4567 8901").parsed).toEqual({ code: "12345678901" });
    expect(validateMeetingInput("").error).toMatch(/enter/i);
    expect(validateMeetingInput("hello").error).toMatch(/not valid/i);
  });
});
