import { parseMeetingInput, type ParsedMeetingInput } from "@/lib/meetingCode";

export const DISPLAY_NAME_MAX = 64;

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Please enter your name.";
  if (trimmed.length > DISPLAY_NAME_MAX) return `Name must be ${DISPLAY_NAME_MAX} characters or fewer.`;
  return null;
}

export function validateMeetingInput(input: string): { parsed: ParsedMeetingInput | null; error: string | null } {
  if (!input.trim()) return { parsed: null, error: "Please enter a meeting ID or invite link." };
  const parsed = parseMeetingInput(input);
  return parsed
    ? { parsed, error: null }
    : { parsed: null, error: "This meeting ID is not valid. Please check and try again." };
}
