import { describe, expect, it } from "vitest";
import { dateToZonedInputs, formatDuration, formatElapsed, nextQuarterHour, zonedDateTimeToDate } from "./datetime";

describe("zonedDateTimeToDate", () => {
  it("interprets wall-clock time in the given zone", () => {
    expect(zonedDateTimeToDate("2030-01-15", "09:30", "Asia/Kolkata")?.toISOString()).toBe("2030-01-15T04:00:00.000Z");
    expect(zonedDateTimeToDate("2030-01-15", "09:30", "UTC")?.toISOString()).toBe("2030-01-15T09:30:00.000Z");
  });

  it("handles daylight saving time", () => {
    // New York is UTC-4 in July and UTC-5 in January.
    expect(zonedDateTimeToDate("2030-07-01", "10:00", "America/New_York")?.toISOString()).toBe("2030-07-01T14:00:00.000Z");
    expect(zonedDateTimeToDate("2030-01-01", "10:00", "America/New_York")?.toISOString()).toBe("2030-01-01T15:00:00.000Z");
  });

  it.each([
    ["2030-02-30", "10:00", "UTC"],
    ["2030-01-01", "25:00", "UTC"],
    ["not-a-date", "10:00", "UTC"],
    ["2030-01-01", "10:00", "Mars/Base"],
  ])("returns null for invalid input %s %s %s", (date, time, zone) => {
    expect(zonedDateTimeToDate(date, time, zone)).toBeNull();
  });

  it("round-trips with dateToZonedInputs", () => {
    const date = new Date("2030-03-10T18:45:00Z");
    const inputs = dateToZonedInputs(date, "Europe/Berlin");
    expect(inputs).toEqual({ date: "2030-03-10", time: "19:45" });
    expect(zonedDateTimeToDate(inputs.date, inputs.time, "Europe/Berlin")?.getTime()).toBe(date.getTime());
  });
});

describe("formatting helpers", () => {
  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(90)).toBe("1 hr 30 min");
  });

  it("formats elapsed meeting time", () => {
    expect(formatElapsed(65_000)).toBe("01:05");
    expect(formatElapsed(3_723_000)).toBe("1:02:03");
  });

  it("rounds up to the next quarter hour", () => {
    const next = nextQuarterHour(new Date(2030, 0, 1, 10, 7));
    expect([next.getHours(), next.getMinutes()]).toEqual([10, 15]);
  });
});
