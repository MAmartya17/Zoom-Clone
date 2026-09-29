import type {
  ChatMessage,
  JoinSession,
  Meeting,
  MeetingPreview,
  ScheduleMeetingInput,
} from "@/types/meeting";
import { apiRequest } from "./client";

const base = "/meetings";

export const meetingsApi = {
  listUpcoming: (limit = 20) => apiRequest<Meeting[]>(base, { query: { scope: "upcoming", limit } }),
  listRecent: (limit = 20) => apiRequest<Meeting[]>(base, { query: { scope: "recent", limit } }),

  createInstant: () => apiRequest<Meeting>(`${base}/instant`, { method: "POST", body: {} }),
  schedule: (input: ScheduleMeetingInput) => apiRequest<Meeting>(base, { method: "POST", body: input }),
  update: (code: string, input: Partial<ScheduleMeetingInput>) =>
    apiRequest<Meeting>(`${base}/${code}`, { method: "PATCH", body: input }),
  cancel: (code: string) => apiRequest<void>(`${base}/${code}`, { method: "DELETE" }),

  preview: (code: string) => apiRequest<MeetingPreview>(`${base}/${encodeURIComponent(code)}`),
  start: (code: string, displayName: string) =>
    apiRequest<JoinSession>(`${base}/${code}/start`, { method: "POST", body: { display_name: displayName } }),
  join: (code: string, displayName: string, passcode: string) =>
    apiRequest<JoinSession>(`${base}/${code}/join`, {
      method: "POST",
      body: { display_name: displayName, passcode },
    }),
  end: (code: string) => apiRequest<Meeting>(`${base}/${code}/end`, { method: "POST" }),

  messages: (code: string) => apiRequest<ChatMessage[]>(`${base}/${code}/messages`),
};
