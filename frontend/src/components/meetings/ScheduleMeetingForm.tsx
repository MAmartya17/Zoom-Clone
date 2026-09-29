"use client";

import { Checkbox, Field, RadioGroup, Select, TextArea, TextField } from "@/components/ui/FormField";
import { timeOptions, timeZoneOptions } from "@/lib/datetime";
import type { ScheduleFormErrors, ScheduleFormValues } from "@/lib/validation/scheduleForm";

interface ScheduleMeetingFormProps {
  values: ScheduleFormValues;
  errors: ScheduleFormErrors;
  onChange: (patch: Partial<ScheduleFormValues>) => void;
  onSubmit: () => void;
}

const HOURS = Array.from({ length: 25 }, (_, hour) => hour);
const MINUTES = [0, 15, 30, 45];
const TIME_OPTIONS = timeOptions(15);
const ON_OFF = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
] as const;

/** Presentational form: all state and submission live in ScheduleMeetingModal. */
export function ScheduleMeetingForm({ values, errors, onChange, onSubmit }: ScheduleMeetingFormProps) {
  const timeChoices = TIME_OPTIONS.some((option) => option.value === values.time)
    ? TIME_OPTIONS
    : [{ value: values.time, label: values.time }, ...TIME_OPTIONS];

  return (
    <form
      id="schedule-meeting-form"
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <TextField
        label="Topic"
        value={values.title}
        maxLength={200}
        error={errors.title}
        placeholder="My Meeting"
        onChange={(event) => onChange({ title: event.target.value })}
        autoFocus
      />

      <TextArea
        label="Description (optional)"
        value={values.description}
        error={errors.description}
        placeholder="Enter your meeting description"
        onChange={(event) => onChange({ description: event.target.value })}
      />

      <Field label="When" error={errors.when}>
        {(id, describedBy) => (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <input
              id={id}
              type="date"
              aria-describedby={describedBy}
              aria-invalid={!!errors.when}
              value={values.date}
              onChange={(event) => onChange({ date: event.target.value })}
              className="h-10 rounded-lg border border-line px-3 text-sm focus:border-zoom-blue focus:outline-none"
            />
            <select
              aria-label="Start time"
              value={values.time}
              onChange={(event) => onChange({ time: event.target.value })}
              className="h-10 rounded-lg border border-line px-3 text-sm focus:border-zoom-blue focus:outline-none"
            >
              {timeChoices.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </Field>

      <Field label="Duration" error={errors.duration}>
        {() => (
          <div className="flex items-center gap-2 text-sm">
            <select
              aria-label="Duration hours"
              value={values.durationHours}
              onChange={(event) => onChange({ durationHours: Number(event.target.value) })}
              className="h-10 rounded-lg border border-line px-3 focus:border-zoom-blue focus:outline-none"
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}
                </option>
              ))}
            </select>
            <span className="text-ink-muted">hr</span>
            <select
              aria-label="Duration minutes"
              value={values.durationMinutes}
              onChange={(event) => onChange({ durationMinutes: Number(event.target.value) })}
              className="h-10 rounded-lg border border-line px-3 focus:border-zoom-blue focus:outline-none"
            >
              {MINUTES.map((minute) => (
                <option key={minute} value={minute}>
                  {minute}
                </option>
              ))}
            </select>
            <span className="text-ink-muted">min</span>
          </div>
        )}
      </Field>

      <Select label="Time Zone" value={values.timezone} onChange={(event) => onChange({ timezone: event.target.value })}>
        {timeZoneOptions(values.timezone).map((zone) => (
          <option key={zone} value={zone}>
            {zone.replace(/_/g, " ")}
          </option>
        ))}
      </Select>

      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <p className="text-sm font-bold">Meeting ID</p>
        <p className="text-sm text-ink-muted">Generate Automatically</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">Security</p>
        <Checkbox label="Passcode" checked={values.passcodeEnabled} onChange={(checked) => onChange({ passcodeEnabled: checked })} />
        {values.passcodeEnabled && (
          <TextField
            aria-label="Passcode"
            value={values.passcode}
            maxLength={10}
            error={errors.passcode}
            onChange={(event) => onChange({ passcode: event.target.value })}
            hint="Only users who have the invite link or passcode can join the meeting."
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">Host video</p>
          <RadioGroup
            name="host-video"
            value={values.hostVideoOn ? "on" : "off"}
            options={[...ON_OFF]}
            onChange={(value) => onChange({ hostVideoOn: value === "on" })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">Participant video</p>
          <RadioGroup
            name="participant-video"
            value={values.participantVideoOn ? "on" : "off"}
            options={[...ON_OFF]}
            onChange={(value) => onChange({ participantVideoOn: value === "on" })}
          />
        </div>
      </div>

      <Checkbox
        label="Mute participants upon entry"
        checked={values.muteOnEntry}
        onChange={(checked) => onChange({ muteOnEntry: checked })}
      />
    </form>
  );
}
