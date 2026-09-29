const MINUTE_MS = 60_000;

// Some browsers still report legacy IANA aliases; show the modern names.
const LEGACY_ZONE_ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
};

export function browserTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return LEGACY_ZONE_ALIASES[zone] ?? zone;
}

export function formatTime(iso: string | Date, timeZone?: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} - ${formatTime(endIso)}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** "Today", "Tomorrow", "Yesterday" or "Mon, Oct 6" (Zoom's list grouping labels). */
export function formatDayLabel(iso: string, now: Date = new Date()): string {
  const days = Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(now).getTime()) / (24 * 60 * MINUTE_MS));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date);
}

export function formatFullDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} min`;
  return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
}

/** Elapsed meeting timer, e.g. "05:09" or "1:02:03". */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// --- form helpers (date input "YYYY-MM-DD", time select "HH:MM") ---

function toTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

function wallClockInZone(date: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const wall = wallClockInZone(date, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  return asUtc - Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS;
}

/**
 * Wall-clock date + time *in a given IANA time zone* -> absolute Date.
 * Returns null when the inputs are malformed (e.g. "2025-02-30").
 */
export function zonedDateTimeToDate(dateValue: string, timeValue: string, timeZone: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!dateMatch || !timeMatch) return null;
  const [y, mo, d] = dateMatch.slice(1).map(Number);
  const [h, mi] = timeMatch.slice(1).map(Number);
  if (h > 23 || mi > 59) return null;

  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(naiveUtc);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;

  try {
    // Two passes settle the offset correctly around DST transitions.
    let guess = naiveUtc - zoneOffsetMs(new Date(naiveUtc), timeZone);
    guess = naiveUtc - zoneOffsetMs(new Date(guess), timeZone);
    return new Date(guess);
  } catch {
    return null; // unknown time zone
  }
}

/** Absolute time -> form values ("YYYY-MM-DD", "HH:MM") as seen in `timeZone`. */
export function dateToZonedInputs(date: Date, timeZone: string): { date: string; time: string } {
  const wall = wallClockInZone(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`, time: `${pad(wall.hour)}:${pad(wall.minute)}` };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Common zones for the picker; the browser's own zone is always included. */
export function timeZoneOptions(current: string = browserTimeZone()): string[] {
  const common = [
    "UTC",
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Africa/Johannesburg",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];
  return common.includes(current) ? common : [current, ...common];
}

/** Next quarter hour after now (Zoom pre-fills the scheduler this way). */
export function nextQuarterHour(now: Date = new Date()): Date {
  const next = new Date(now.getTime() + 15 * MINUTE_MS);
  next.setMinutes(Math.floor(next.getMinutes() / 15) * 15, 0, 0);
  return next;
}

/** "HH:MM" options every 15 minutes, labelled in the user's locale. */
export function timeOptions(stepMinutes = 15): { value: string; label: string }[] {
  const options = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
    options.push({ value: toTimeInputValue(date), label: formatTime(date) });
  }
  return options;
}
