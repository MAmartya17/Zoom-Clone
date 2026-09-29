import { zonedDateTimeToDate } from "@/lib/datetime";

// Mirrors backend rules in app/schemas/meeting.py so users get instant feedback;
// the backend remains the source of truth.
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 2000;
export const DURATION_MIN = 15;
export const DURATION_MAX = 24 * 60;
export const DURATION_STEP = 15;
const PASSCODE_PATTERN = /^[A-Za-z0-9]{1,10}$/;

export interface ScheduleFormValues {
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationHours: number;
  durationMinutes: number;
  timezone: string;
  passcodeEnabled: boolean;
  passcode: string;
  hostVideoOn: boolean;
  participantVideoOn: boolean;
  muteOnEntry: boolean;
}

export type ScheduleFormErrors = Partial<Record<"title" | "description" | "when" | "duration" | "passcode", string>>;

export function scheduledStart(values: Pick<ScheduleFormValues, "date" | "time" | "timezone">): Date | null {
  return zonedDateTimeToDate(values.date, values.time, values.timezone);
}

export function totalDuration(values: Pick<ScheduleFormValues, "durationHours" | "durationMinutes">): number {
  return values.durationHours * 60 + values.durationMinutes;
}

export function validateScheduleForm(values: ScheduleFormValues, now: Date = new Date()): ScheduleFormErrors {
  const errors: ScheduleFormErrors = {};

  const title = values.title.trim();
  if (!title) errors.title = "Please enter a meeting topic.";
  else if (title.length > TITLE_MAX) errors.title = `Topic must be ${TITLE_MAX} characters or fewer.`;

  if (values.description.length > DESCRIPTION_MAX) {
    errors.description = `Description must be ${DESCRIPTION_MAX} characters or fewer.`;
  }

  const start = scheduledStart(values);
  if (!start) errors.when = "Please choose a valid date and time.";
  else if (start.getTime() < now.getTime() - 60_000) errors.when = "Start time must be in the future.";

  const duration = totalDuration(values);
  if (duration < DURATION_MIN || duration > DURATION_MAX) {
    errors.duration = "Duration must be between 15 minutes and 24 hours.";
  } else if (duration % DURATION_STEP) {
    errors.duration = "Duration must be a multiple of 15 minutes.";
  }

  if (values.passcodeEnabled && !PASSCODE_PATTERN.test(values.passcode)) {
    errors.passcode = "Passcode must be 1-10 letters or numbers.";
  }

  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}
