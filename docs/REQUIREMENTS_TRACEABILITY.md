# Requirement Traceability

Every requirement from the assignment PDF, mapped to its implementation and the evidence that it works.
Test evidence: **B** = backend pytest, **F** = frontend Vitest, **E2E** = the local two-browser Playwright run (19/19 steps passed).

## Core features

| # | PDF requirement | Backend | Frontend | Database | Evidence |
|---|---|---|---|---|---|
| 1 | Clean professional Zoom UI | — | `globals.css` (Zoom tokens), `components/ui/*` | — | E2E screenshots |
| 2 | Navbar with profile/settings placeholders | `GET /users/me` | `layout/TopNav.tsx` (avatar menu, settings, notifications, nav items) | `users` | E2E |
| 3 | Buttons: New Meeting / Join / Schedule | `POST /meetings/instant`, `GET /meetings/{code}`, `POST /meetings` | `dashboard/HomeDashboard.tsx`, `ActionTile.tsx` | `meetings` | E2E |
| 4 | Upcoming meetings section | `MeetingRepository.list_upcoming` | `meetings/MeetingList.tsx` (variant upcoming) | index `(host_id,status,scheduled_start_at)` | B `test_upcoming_is_sorted…`, E2E |
| 5 | Recent meetings section | `MeetingRepository.list_recent` | `MeetingList` (variant recent) | `participants.user_id` index | B `test_room_state_…goes_live`, E2E |
| 6 | Create a new meeting instantly | `MeetingService.create_instant` | `hooks/useStartInstantMeeting.ts` | `meetings` row (`instant`) | B `TestInstantMeeting`, E2E |
| 7 | Generate unique Meeting ID | `services/meeting_code.py`, `_insert_with_unique_code` (UNIQUE + retry) | `lib/meetingCode.ts` (format) | `meeting_code UNIQUE` | B `test_code_collision_is_retried`, `test_gives_up_…` |
| 8 | Generate shareable invite link | `schemas/meeting.py::build_invite_link` (`PUBLIC_APP_URL`) | `InviteDialog`, `MeetingInfoButton`, `lib/invitation.ts` | `passcode` | B `test_creates_meeting_with_unique_code_and_invite_link`, E2E |
| 9 | Redirect user to meeting room | — | `router.push('/meeting/{code}?host=1')` | — | E2E |
| 10 | Join using Meeting ID **or** invite link | `normalize_meeting_code`, `POST /join` | `parseMeetingInput`, `/meeting/[code]?pwd=` route | — | B `test_join_accepts_formatted_meeting_id`, F `meetingCode.test.ts`, E2E (both paths) |
| 11 | Enter display name before joining | `JoinMeetingRequest.display_name` (1–64, trimmed) | `JoinMeetingForm`, `PreJoinScreen` | `participants.display_name` | B `test_invalid_display_name_is_rejected`, F, E2E |
| 12 | Validate meeting existence | `MeetingService.get_joinable` → 404/410 | preview call before navigating | — | B `test_unknown_or_malformed_code…`, `test_ended_meeting_is_gone`, E2E |
| 13 | Create scheduled meetings | `MeetingService.schedule` | `ScheduleMeetingModal` | `meetings` row (`scheduled`) | B `test_scheduled_meeting_is_persisted…`, E2E |
| 14 | Title / Description | `Title`, `Description` validators | `ScheduleMeetingForm` | `title`, `description` | B validation matrix, F |
| 15 | Date & time picker | `FutureStart` (tz-aware, future) | native date input + 15-min time select + time zone | `scheduled_start_at`, `timezone` | B, F `datetime.test.ts` (DST) |
| 16 | Duration | `Duration` (15–1440, step 15) | hr/min selects | `scheduled_end_at` (duration derived) | B, F |
| 17 | Auto-generate meeting link | same as #7/#8 | shown in "Meeting scheduled" dialog | — | E2E |
| 18 | Store in database | SQLAlchemy models + repositories | — | 4 tables with FK/CHECK/UNIQUE | B (all) |
| 19 | Show in Upcoming Meetings | `list_upcoming` | dashboard refetch after save | — | B, E2E |
| 20 | Manage participants (description) | `ParticipantService`, `RoomManager`, WS presence | `ParticipantsPanel.tsx` | `participants` | B `test_realtime.py`, E2E |
| 21 | Functional video conferencing | WS signaling relay | `PeerManager` (WebRTC mesh), `useMediaDevices`, `VideoGrid` | — | E2E: decoded video frames both ways |

## Bonus

| PDF bonus | Implementation | Evidence |
|---|---|---|
| Responsive design | Tailwind breakpoints; mobile nav; modals become bottom sheets; room panels go full-screen; gallery best-fit layout (`lib/galleryLayout.ts`) | F `galleryLayout.test.ts`, E2E mobile screenshots |
| Host controls: mute all | WS `mute_all` → `require_host` → `force_mute` broadcast | B `test_host_mute_all…`, `test_attendee_cannot_use_host_controls`, E2E |
| Host controls: remove participant | WS `remove_participant` → status `removed`, close 4403, token unusable | B `test_host_removes_participant`, E2E |
| User authentication (Login/Signup) | Backend: `api/v1/auth.py`, `services/auth_service.py` (scrypt hashing, DB sessions, revocable logout), `api/deps.py::get_current_user` / `get_optional_user`, `auth_sessions` table. Frontend: `/login`, `/signup`, `AuthProvider`, `RequireAuth`, TopNav sign-in/sign-out | B `test_auth.py` (21 tests), F `auth.test.ts`, E2E (redirect, bad password, sign-up, non-host blocked, sign-out) |

Extras beyond the brief: end meeting for all, screen share, persisted chat, Meetings page, active-speaker highlight, meeting info popover, keyboard shortcuts.

## Important notes from the PDF

| Note | How it's met |
|---|---|
| Resemble Zoom's design | Zoom Workplace layout: top nav, orange/blue action tiles, clock card, dark meeting room, bottom toolbar, green share button, red End |
| No login: assume a default user | Seeded demo account "Alex Morgan" with one-click "Use demo account" sign-in; guests join by link without any account |
| Seed the database | `app/seed.py` (upcoming, recent with attendance + chat, cancelled); auto-seed on empty DB |
| Design your own schema | See README "Database design" and `backend/app/models/` |
| README: setup, tech stack, assumptions | `README.md` |
| Original work | Written from scratch for this assignment |
| Public GitHub repo + deployed app | `render.yaml` + Vercel instructions in the README |

## Final audit checklist

- [x] Every mandatory feature implemented (table above)
- [x] Bonus features: responsive design, login/signup/sign-out, mute all, remove participant
- [x] Dashboard · New Meeting · unique ID · invite link · join (ID + link) · validation · display name
- [x] Schedule meeting · Upcoming · Recent · meeting room · participants · meeting controls
- [x] Database persistence · seed data · validation (both sides) · consistent error handling
- [x] Tests: 77 backend + 66 frontend passing; 23-step two-browser E2E passing locally
- [x] README with setup, environment variables, API, schema, deployment, assumptions, limitations
- [x] No unnecessary dependencies (frontend runtime deps: next, react, react-dom, lucide-react)
- [x] No duplicated business logic (rules live in services / model lifecycle methods; the frontend mirrors validation only for UX)
- [x] Architecture consistent with the Phase 3–7 design
