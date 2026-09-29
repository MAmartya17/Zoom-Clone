# Interview Guide — Zoom Clone

A walkthrough you can present on a whiteboard. Each section answers "what", "why", and "what would you change at scale". File references point to the code.

---

## 1. Overall architecture (30-second version)

> "It's a Next.js SPA talking to a FastAPI backend over two channels: **REST** for meetings data and **WebSockets** for live room events. Audio and video go **peer-to-peer over WebRTC**. The server never touches media; it only relays the small signaling messages that let browsers find each other. The backend is layered: routers, then services, then repositories, then SQLite."

```
 Browser A ◄════════ WebRTC media (P2P) ════════► Browser B
    │  REST (create/join/schedule)     │  WS (presence, signaling, chat, host controls)
    ▼                                  ▼
 FastAPI:  routers ─► services ─► repositories ─► SQLite
                        ▲
     WS handler ────────┘   RoomManager (in-memory: who is connected right now)
```

**Draw this on the whiteboard first:** the three boxes (Browser, API, DB), then the two arrows (REST, WS), then the dotted P2P media line between two browsers.

## 2. Why this architecture

- **Layered backend.** The same rules are needed from REST and from WebSocket code. Example: "only the host can end a meeting" is triggered by `POST /end` *and* by the `end_meeting` WS message. With the rules in services, both call `ParticipantService` / `MeetingService` and nothing is duplicated.
- **The server relays signaling and never forwards media.** Real video without paying for media servers, and it's the simplest system that is genuinely functional.
- **What I deliberately did not do:** microservices, CQRS, event sourcing, a DI container, or Redux. None of them solves a problem this app has.

## 3. Technology choices

| Tech | Why | Alternative considered |
|---|---|---|
| **FastAPI** | Async-native WebSockets in the same app as REST; Pydantic validation; automatic OpenAPI docs at `/docs`. | Django: heavier, and needs Channels for WebSockets. |
| **SQLAlchemy 2.0 (sync)** | Mature ORM with typed `Mapped[]` models. Swapping SQLite for Postgres is a URL change. | Async SQLAlchemy: extra complexity for a single SQLite file. |
| **Pydantic v2** | Request validation with field-level errors, plus response DTOs. | Manual validation: error-prone. |
| **SQLite** | Required by the brief. Zero setup. | — |
| **Next.js App Router** | Required. All pages are client-rendered and navigation is client-side, so it behaves as an SPA. | — |
| **Tailwind CSS** | Zoom's colors and spacing become design tokens (`globals.css` `@theme`), so styling stays consistent. | MUI or another kit would look like MUI, not Zoom. |
| **lucide-react** | The only UI dependency. Clean icons close to Zoom's. | — |
| **WebRTC** | The browser-native way to do real-time audio and video. | Any hosted SDK would be "fake it with a vendor". |
| **Vitest / pytest** | Fast unit tests of pure logic; FastAPI's `TestClient` covers REST *and* WebSocket. | — |

## 4. Database schema

Four tables. [`backend/app/models/`](../backend/app/models)

- **users**: the default user (and future real users). `email` is UNIQUE.
- **meetings**: `meeting_code` (the public 11-digit ID, UNIQUE), `passcode`, `host_id` FK, `meeting_type`, `status`, `scheduled_start_at` / `scheduled_end_at`, settings, and actual `started_at` / `ended_at`.
- **participants**: one row per **join session**. `user_id` is nullable (guests), `role`, `status`, `session_token_hash`, `joined_at` / `left_at`.
- **chat_messages**: `meeting_id` FK and `participant_id` FK.

Talking points:
1. **The public ID is separate from the PK.** The integer PK is internal; `meeting_code` is what users see. It can be formatted, and it never leaks row counts.
2. **I store start + end, not start + duration.** "Is it still upcoming?" becomes `scheduled_end_at > now`: indexed and portable. Duration is a computed property, so there's no redundant column.
3. **Constraints live in the database, not just the code.** `CHECK (end > start)`, `CHECK (ended_at ⇒ started_at)`, CHECK on enum values, UNIQUE on the code and the token hash, and foreign keys with CASCADE / SET NULL.
4. **SQLite gotcha:** foreign keys are OFF by default. I enable `PRAGMA foreign_keys=ON` per connection in [`db/session.py`](../backend/app/db/session.py).
5. **Why participants are sessions:** guests have no account, and the same person can join twice. A per-session row gives a correct attendance history ("joined 10:01, left 10:40").
6. **Indexes follow the queries:** `(host_id, status, scheduled_start_at)` for Upcoming, `(meeting_id, status)` for live participants, `(user_id)` for Recent.

## 5. Entity relationships

```
User 1──N Meeting            (a user hosts many meetings; delete user → delete meetings)
Meeting 1──N Participant     (a meeting has many join sessions; cascade delete)
User 1──N Participant        (optional; guests have user_id NULL; delete user → SET NULL)
Meeting 1──N ChatMessage     Participant 1──N ChatMessage
```

## 6. Meeting creation flow (New Meeting)

1. `HomeDashboard` → `useStartInstantMeeting` → `meetingsApi.createInstant()` → `POST /api/v1/meetings/instant`.
2. `MeetingService.create_instant()` builds a `Meeting` (type `instant`, status `scheduled`, start = now, random passcode).
3. `_insert_with_unique_code()` generates a random 11-digit code with `secrets`, INSERTs it, and **retries on `IntegrityError`**. The UNIQUE constraint is the source of truth: a "check then insert" would race with a concurrent request.
4. The response `MeetingDetail` includes `invite_link = PUBLIC_APP_URL/meeting/{code}?pwd={passcode}`, built server-side in one place.
5. The frontend redirects to `/meeting/{code}?host=1`, shows the pre-join screen, then `POST /start` returns a host session token.

## 7. Meeting joining flow

1. **Join form** ([`JoinMeetingForm`](../frontend/src/components/join/JoinMeetingForm.tsx)): `parseMeetingInput()` accepts `123 4567 8901` *or* a full invite link (it extracts the code and `pwd`). The display name is validated.
2. `GET /meetings/{code}` validates that the meeting exists (404, "Invalid meeting ID") and is still joinable (410 ended/cancelled). This preview **never contains the passcode**, which is why there are two DTOs.
3. The pre-join screen shows a camera preview, the name, and a passcode field unless it came from the link.
4. `POST /meetings/{code}/join {display_name, passcode}` → `ParticipantService.join()` compares the passcode with `secrets.compare_digest` (constant time), creates a `pending` participant, and returns a **one-time token**. Only its SHA-256 hash is stored.
5. The browser opens `WS /ws/meetings/{code}?token=…`. `connect()` checks the hash, the matching code, and `status == pending`, then marks the participant `connected` and the meeting `live` if it was the first.

## 8. Meeting scheduling flow

1. `ScheduleMeetingModal` holds the form state; `ScheduleMeetingForm` is purely presentational.
2. On submit: `validateScheduleForm()` runs client-side for instant feedback. The date and time are interpreted **in the selected time zone** by `zonedDateTimeToDate()` (Intl-based and DST-safe), then sent as ISO-8601 UTC.
3. `POST /meetings` → Pydantic re-validates everything; **the backend is the source of truth**. The service converts to naive UTC and stores start + end.
4. If the backend returns 422 `details`, `mapServerErrors()` maps each field error back onto the form field.
5. On success: a toast, the invite dialog opens, and the dashboard refetches, so the meeting appears in Upcoming.

## 9. Participant flow and lifecycle

```
POST /join or /start ──► pending ──WS connect──► connected ──socket closes──► left
                                                    └──host removes──► removed (token can't be reused)
```
Meeting status: `scheduled → live` on the first connect. `live → ended` when the host ends it, or when the room has been **empty for 60 s**. The grace period means a page refresh doesn't end the meeting. On server startup, `reconcile_after_restart()` closes stale sessions, since no socket survives a restart.

## 10. Frontend ↔ backend communication

- **All HTTP goes through one function:** `apiRequest()` in [`lib/api/client.ts`](../frontend/src/lib/api/client.ts). It handles JSON, converts error bodies into an `ApiError(status, code, message, details)`, and turns network failures into `NETWORK_ERROR`. Endpoint functions live in `meetingsApi`, so components never build URLs.
- **Types mirror the backend DTOs** in `types/meeting.ts` and `types/realtime.ts`.
- **Configuration is centralized** in `lib/config.ts`: the API URL, the WS URL (derived from the API URL), and the ICE servers.

## 11. Real-time communication (what goes over the WebSocket)

- **Presence:** `room_state` on connect, then `participant_joined` / `participant_left`.
- **Media state:** each client broadcasts `{audio, video, screen}`, so tiles show the muted icon or the avatar.
- **Chat:** persisted first, then broadcast.
- **Host controls:** `mute_all`, `mute_participant`, `remove_participant`, `end_meeting`. Each is **authorized on the server** via `ParticipantService.require_host()`. The UI hiding the buttons is not the security boundary.
- **WebRTC signaling:** `signal {to, data}` is relayed only to the target participant in the same room.

## 12. WebSocket / WebRTC design

**Backend** ([`realtime/`](../backend/app/realtime)):
- `RoomManager` is an in-memory `code → {participant_id → socket, media state}` map with `broadcast`, `send`, `disconnect_member`, and `close_room`.
- `MeetingConnectionHandler` handles one socket's lifetime: authenticate → announce → receive loop → cleanup. Messages are parsed into a **Pydantic discriminated union** (`schemas/ws.py`) and dispatched with `match`. Invalid JSON or unknown types get an `error` reply while the socket stays open.
- Cleanup runs inside `anyio.CancelScope(shield=True)`, so presence is cleaned up even if the task is cancelled (for example on shutdown). A test caught exactly this bug.
- Blocking DB work runs in `run_in_threadpool` with a short-lived session per operation.

**Frontend** ([`lib/realtime/`](../frontend/src/lib/realtime)):
- `SignalingClient` is a typed WebSocket wrapper.
- `PeerManager` holds **one `RTCPeerConnection` per remote participant (mesh)**.
  - **Glare avoidance:** the newcomer always creates the offers; existing participants only answer.
  - Every connection has **one audio and one video transceiver**. Switching camera ↔ screen share is `sender.replaceTrack()`, with **no renegotiation**.
  - Signals for a peer go through a **promise queue**, so an ICE candidate is never applied before its offer. Candidates that arrive early are buffered.
- `roomReducer` is a pure state machine (`connecting → connected → left | ended | removed | disconnected`) that's easy to unit-test. `useMeetingRoom` is the only React bridge: WebRTC objects live in **refs, never in React state**.

**Why a mesh and not an SFU?** A mesh needs no media server and works well for 2–6 people. Upload bandwidth grows with N−1 streams, so larger meetings need an SFU (LiveKit, mediasoup). Only `PeerManager` would change.

## 13. Error handling

- **Backend:** services raise domain exceptions (`core/errors.py`). One handler maps each to status + `{"error": {code, message, details}}`. Pydantic errors become 422 with a per-field `details` map. Anything unexpected is logged with its traceback and returned as a generic 500. Clients never see stack traces.
- **WebSocket:** recoverable errors → `{"type": "error"}` message. Terminal ones → close codes 4401/4403/4404/4410, which `roomReducer` maps to exit screens.
- **Frontend:** every API failure is an `ApiError`. Lists have loading, error+retry, and empty states. Forms show field errors. Media permission failures show a banner but you can still join. Toasts cover transient errors.

## 14. Validation (both sides)

| Rule | Frontend | Backend |
|---|---|---|
| Meeting ID format | `parseMeetingInput` | `normalize_meeting_code` → 404 |
| Meeting exists / joinable | preview call | `get_joinable` → 404 / 410 |
| Display name 1–64, trimmed | `validateDisplayName` | `DisplayName` type |
| Title, description length | `validateScheduleForm` | `Title`, `Description` types |
| Future start (time-zone aware) | ✓ | `_validate_future_start` (1-min clock-skew grace) |
| Duration 15–1440, step 15 | ✓ | `_validate_duration` |
| Passcode | ✓ | pattern + constant-time compare |
| Duplicate meeting IDs | — | UNIQUE constraint + retry |

**Frontend validation is for UX; backend validation is for correctness.**

## 15. Design patterns used

| Pattern | Where | Why / problem solved | Why not simpler |
|---|---|---|---|
| **Layered architecture / Service layer** | `api/` → `services/` → `repositories/` | Business rules in one place, shared by REST and WS; routes stay thin. | Logic in route handlers would be duplicated in the WS handler and be hard to test. |
| **Repository** | `repositories/*.py` | Upcoming/Recent queries have real logic (joins, status filters, ordering); services read like business rules. | Queries in services would work, but they'd mix SQL with rules. I don't claim it's for swapping databases; SQLAlchemy already does that. |
| **DTO** | `schemas/*.py` | Validation at the boundary; `MeetingPublic` hides the passcode that `MeetingDetail` exposes. | Returning ORM objects leaks internal fields and couples the API to the tables. |
| **Dependency Injection** | FastAPI `Depends` in `api/deps.py` | `get_db`, `get_current_user`, `get_room_manager`, and `get_session_factory` are swapped in tests (in-memory DB). `get_current_user` is also the **auth seam**. | Globals would make tests share state. |
| **Domain model methods (state machine)** | `Meeting.mark_live/mark_ended/mark_cancelled/ensure_joinable` | Status transitions are validated in one place; illegal transitions raise `InvalidMeetingState`. | Setting `status = ...` all over the code invites invalid states. |
| **Observer / Pub-Sub** | `RoomManager.broadcast` (server); `SignalingClient` callbacks (client) | One event fans out to all room members; components react to events. | Polling would be laggy and wasteful. |
| **Reducer (state machine)** | `roomReducer.ts` | All room transitions are pure and testable, and late messages after exit are ignored. | Many `useState`s would drift out of sync. |
| **Adapter / Facade** | `PeerManager`, `SignalingClient` | Hide the imperative WebRTC/WebSocket APIs behind `connectTo`, `handleSignal`, and `replaceTrack`. | Raw `RTCPeerConnection` code in components would be untestable and re-render-fragile. |

**Deliberately not used:** Factory, Strategy, CQRS, event sourcing. There's only one implementation of everything, so those patterns would be ceremony.

## 16. Important trade-offs

| Choice | Gain | Cost |
|---|---|---|
| Mesh WebRTC | No media servers, real P2P | Doesn't scale past ~6 people |
| STUN only | Free, zero config | Some NATs fail without TURN (configurable) |
| In-memory presence | Simple, fast | Single instance; restart ends live meetings |
| Sync ORM | Simplicity | Threadpool hop in the WS code |
| `create_all` instead of Alembic | Nothing to manage for v1 | Needs Alembic before the first schema change in production |
| Entry path decides the role (no auth) | Meets "no login" brief | Anyone could hit `/start` today; real auth closes that |
| Strict Mode off | Single-use WS tokens survive dev double-mount | Lose Strict Mode's extra dev checks |

## 17. How the system could scale

1. **Media:** replace the mesh with an **SFU**. Each client uploads once, and the server forwards streams (plus simulcast for quality levels).
2. **Signaling:** run several FastAPI instances. Put room fan-out on **Redis pub/sub** (or sticky-route each meeting to one instance). `RoomManager` is the only class that changes.
3. **REST:** stateless, so scale horizontally behind a load balancer.
4. **DB:** Postgres with connection pooling, read replicas for lists, and the indexes already in place.
5. **TURN:** a managed TURN cluster (e.g. coturn) for reliability.

## 18. Replacing SQLite with PostgreSQL

1. Set `DATABASE_URL=postgresql+psycopg://…` and add `psycopg` to requirements.
2. Nothing else in the code changes. Enums are CHECK-constrained strings, there's no SQLite-specific SQL, and times are stored as UTC. The SQLite pragmas are applied only when the URL starts with `sqlite`.
3. Introduce **Alembic** for migrations and generate the initial migration from the models.
4. Optionally switch naive-UTC columns to `TIMESTAMPTZ`.

## 19. Adding authentication

1. Add `password_hash` to `users` (or use an OAuth provider).
2. Add `/auth/signup` and `/auth/login` endpoints that issue a JWT or session cookie.
3. Replace the body of **`get_current_user()`** in `api/deps.py` to verify the token. Every route and service already depends on it, so nothing else changes.
4. `POST /start` already checks `meeting.host_id == current_user.id`, so with real users only the real host can start.
5. Frontend: `CurrentUserProvider` already loads `/users/me`. Add login pages and send credentials (cookie or `Authorization` header) from `apiRequest`.

## 20. Handling higher traffic

- **Rate limiting** on join/passcode attempts (brute force) and meeting creation.
- **Caching:** meeting previews are read-heavy, so a short TTL cache works.
- **Pagination:** list endpoints already accept `limit`; add cursor pagination.
- **Load balancer** with WebSocket support, sticky sessions per meeting (or Redis fan-out).
- **Observability:** structured logs, request IDs, metrics (active rooms, join latency, WS errors).
- **Background jobs:** move the empty-room timer and reminders to a worker/scheduler once there are multiple instances.

---

## Likely interview questions (with short answers)

- **"How do you guarantee unique meeting IDs?"** Random 11-digit code from `secrets`, a UNIQUE constraint, and retry on `IntegrityError` (up to 5 times). There's a test that forces a collision.
- **"What stops an attendee from muting everyone?"** The server checks the role in `ParticipantService.require_host()` from the DB. Tests send `mute_all` as an attendee and expect `NOT_HOST`.
- **"Why is the token single-use?"** It authenticates exactly one WebSocket. A removed participant can't reconnect with it, and a leaked token is useless after use. Only its hash is stored.
- **"What happens if the host refreshes?"** The socket closes and the participant is marked `left`. The room stays `live` for 60 s. The host starts again with a new session and the meeting continues.
- **"Two people join at the same instant?"** Each learns about the other exactly once, either from `room_state` or from `participant_joined`. There's a test for deterministic ordering, and the protocol tolerates both orders.
- **"How is time-zone handling correct?"** The UI interprets the wall-clock time in the chosen IANA zone (Intl, two-pass DST correction), sends UTC ISO, and the DB stores naive UTC. There are unit tests around DST.
- **"How did you test WebRTC?"** Unit tests for the protocol, plus a Playwright run with two Chromium instances and fake devices that asserted decoded video frames on both sides and during screen share.
