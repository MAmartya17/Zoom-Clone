const MEETING_CODE_LENGTH = 11;
const SEPARATORS = /[\s-]/g;

export interface ParsedMeetingInput {
  code: string;
  passcode?: string;
}

function normalizeCode(raw: string): string | null {
  const digits = raw.replace(SEPARATORS, "");
  return /^\d+$/.test(digits) && digits.length === MEETING_CODE_LENGTH ? digits : null;
}

/**
 * Accepts what users paste into "Meeting ID or Personal Link Name":
 * a raw ID ("123 4567 8901"), or a full invite link
 * ("https://host/meeting/12345678901?pwd=abc").
 */
export function parseMeetingInput(input: string): ParsedMeetingInput | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const direct = normalizeCode(trimmed);
  if (direct) return { code: direct };

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const match = url.pathname.match(/\/(?:meeting|j)\/([\d\s%-]+)\/?$/);
    const code = match ? normalizeCode(decodeURIComponent(match[1])) : null;
    if (!code) return null;
    const passcode = url.searchParams.get("pwd") ?? undefined;
    return passcode ? { code, passcode } : { code };
  } catch {
    return null;
  }
}

export function formatMeetingCode(code: string): string {
  return code.length === MEETING_CODE_LENGTH ? `${code.slice(0, 3)} ${code.slice(3, 7)} ${code.slice(7)}` : code;
}
