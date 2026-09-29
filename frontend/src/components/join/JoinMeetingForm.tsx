"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { errorMessage } from "@/lib/api/client";
import { meetingsApi } from "@/lib/api/meetings";
import { DISPLAY_NAME_MAX, validateDisplayName, validateMeetingInput } from "@/lib/validation/joinForm";
import { useCurrentUser } from "@/providers/AuthProvider";

interface JoinMeetingFormProps {
  onCancel?: () => void;
  initialMeetingInput?: string;
}

/**
 * Step 1 of joining: collect Meeting ID / invite link + display name and
 * validate that the meeting exists, then hand off to the meeting page
 * (which shows the camera preview and asks for a passcode if needed).
 */
export function JoinMeetingForm({ onCancel, initialMeetingInput = "" }: JoinMeetingFormProps) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [meetingInput, setMeetingInput] = useState(initialMeetingInput);
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<{ meeting?: string | null; name?: string | null }>({});
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (user && !name) setName(user.name);
  }, [user, name]);

  const submit = async () => {
    const { parsed, error: meetingError } = validateMeetingInput(meetingInput);
    const nameError = validateDisplayName(name);
    setErrors({ meeting: meetingError, name: nameError });
    if (!parsed || nameError) return;

    setChecking(true);
    try {
      await meetingsApi.preview(parsed.code); // 404 / 410 surface as friendly messages
      const params = new URLSearchParams({ name: name.trim() });
      if (parsed.passcode) params.set("pwd", parsed.passcode);
      router.push(`/meeting/${parsed.code}?${params.toString()}`);
    } catch (err) {
      setErrors({ meeting: errorMessage(err) });
      setChecking(false);
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField
        label="Meeting ID or Invite Link"
        placeholder="Enter meeting ID or invite link"
        value={meetingInput}
        error={errors.meeting}
        onChange={(event) => {
          setMeetingInput(event.target.value);
          setErrors((current) => ({ ...current, meeting: null }));
        }}
        autoFocus
        inputMode="text"
        autoComplete="off"
      />
      <TextField
        label="Your Name"
        placeholder="Enter your name"
        value={name}
        maxLength={DISPLAY_NAME_MAX}
        error={errors.name}
        onChange={(event) => {
          setName(event.target.value);
          setErrors((current) => ({ ...current, name: null }));
        }}
        autoComplete="name"
      />
      <p className="text-xs text-ink-muted">
        By clicking &quot;Join&quot;, you agree to our Terms of Service and Privacy Statement.
      </p>
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={checking} disabled={!meetingInput.trim()}>
          Join
        </Button>
      </div>
    </form>
  );
}
