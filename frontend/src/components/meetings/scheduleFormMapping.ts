import { browserTimeZone, dateToZonedInputs, nextQuarterHour } from "@/lib/datetime";
import {
  scheduledStart,
  totalDuration,
  type ScheduleFormErrors,
  type ScheduleFormValues,
} from "@/lib/validation/scheduleForm";
import type { Meeting, ScheduleMeetingInput } from "@/types/meeting";

function randomPasscode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(6)), (n) => alphabet[n % alphabet.length]).join("");
}

export function defaultScheduleValues(hostName: string | undefined, now: Date = new Date()): ScheduleFormValues {
  const timezone = browserTimeZone();
  const { date, time } = dateToZonedInputs(nextQuarterHour(now), timezone);
  return {
    title: hostName ? `${hostName}'s Zoom Meeting` : "My Meeting",
    description: "",
    date,
    time,
    durationHours: 1,
    durationMinutes: 0,
    timezone,
    passcodeEnabled: true,
    passcode: randomPasscode(),
    hostVideoOn: true,
    participantVideoOn: true,
    muteOnEntry: false,
  };
}

export function meetingToScheduleValues(meeting: Meeting): ScheduleFormValues {
  const { date, time } = dateToZonedInputs(new Date(meeting.start_time), meeting.timezone);
  return {
    title: meeting.title,
    description: meeting.description ?? "",
    date,
    time,
    durationHours: Math.floor(meeting.duration_minutes / 60),
    durationMinutes: meeting.duration_minutes % 60,
    timezone: meeting.timezone,
    passcodeEnabled: true,
    passcode: meeting.passcode,
    hostVideoOn: meeting.host_video_on,
    participantVideoOn: meeting.participant_video_on,
    muteOnEntry: meeting.mute_on_entry,
  };
}

/** Form values -> API payload. Assumes values already passed validation. */
export function scheduleValuesToInput(values: ScheduleFormValues): ScheduleMeetingInput {
  return {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    start_time: scheduledStart(values)!.toISOString(),
    duration_minutes: totalDuration(values),
    timezone: values.timezone,
    // Zoom requires a passcode by default; when unticked the server generates one.
    passcode: values.passcodeEnabled ? values.passcode : undefined,
    host_video_on: values.hostVideoOn,
    participant_video_on: values.participantVideoOn,
    mute_on_entry: values.muteOnEntry,
  };
}

const SERVER_FIELD_TO_FORM: Record<string, keyof ScheduleFormErrors> = {
  title: "title",
  description: "description",
  start_time: "when",
  timezone: "when",
  duration_minutes: "duration",
  passcode: "passcode",
};

/** Maps backend 422 details ({start_time: "..."}) onto form fields. */
export function mapServerErrors(details: Record<string, string> | null): ScheduleFormErrors {
  const errors: ScheduleFormErrors = {};
  Object.entries(details ?? {}).forEach(([field, message]) => {
    const target = SERVER_FIELD_TO_FORM[field];
    if (target && !errors[target]) errors[target] = message;
  });
  return errors;
}
