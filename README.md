# Zoom Clone — Video Conferencing Platform

A functional clone of the Zoom web app: start instant meetings, join by Meeting ID or invite link, schedule meetings, and meet with **real audio/video** (WebRTC), screen sharing, chat and host controls.

| | |
|---|---|
| **Frontend** | Next.js 15 (App Router, client-side SPA), React 19, TypeScript, Tailwind CSS 4 |
| **Backend** | Python 3.12+, FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| **Database** | SQLite (portable schema, FK + CHECK constraints) |
| **Realtime** | FastAPI WebSockets (signaling + presence) · WebRTC mesh (media) |
| **Tests** | pytest (56 backend) · Vitest (51 frontend) · Playwright two-browser E2E (19 steps, run locally) |

---

## Features

### Core (all required features)
- **Home dashboard** — Zoom-style top nav (profile / settings / notifications placeholders), New Meeting · Join · Schedule · Share Screen tiles, live clock card, **Upcoming Meetings** and **Recent Meetings** lists (loading, empty and error states).
- **Instant meetings** — one click creates a meeting with a unique 11-digit Meeting ID (`123 4567 8901`), passcode and shareable invite link, then redirects to the room.
- **Join meeting** — by Meeting ID *or* pasted invite link, display name required, meeting existence validated (`Invalid meeting ID`), passcode checked (auto-filled from invite links).
- **Schedule meetings** — topic, description, date & time picker, duration (hr/min), time zone, passcode, host/participant video defaults, mute-on-entry. Auto-generated link, persisted in SQLite, shown in Upcoming. Edit / delete (cancel) / copy invitation.
- **Meeting room** — pre-join camera/mic preview, gallery view with 16:9 best-fit layout, active-speaker highlight, mute/unmute, start/stop video, participant list, meeting info (ID / passcode / link), elapsed timer.

### Bonus
- **Host controls** — *Mute All*, mute one participant, *Remove participant* (server-enforced; the removed session cannot reconnect), *End Meeting for All*.
- **Responsive design** — desktop, tablet and mobile layouts (dashboard, modals as bottom sheets, full-screen side panels in the room).
- **Screen sharing** (spotlight layout), **in-meeting chat** (persisted), **Meetings page** (Upcoming / Previous tabs), Zoom keyboard shortcuts (`Alt+A`, `Alt+V`).
- **Login/Signup** — intentionally not built (the brief says to assume a logged-in default user); an auth seam is in place (see [Assumptions](#assumptions)).

---

## Architecture

```
Browser (Next.js SPA)
 ├─ app/ (routes) → components/ (feature UI) → hooks/ (state + side effects)
 ├─ lib/api        — single fetch wrapper + typed endpoint functions
 └─ lib/realtime   — SignalingClient (WebSocket) · PeerManager (WebRTC) · roomReducer
        │  REST /api/v1 (JSON)             │  WS /ws/meetings/{code}?token=…        ▲
        ▼                                  ▼                                        │ P2P media
FastAPI                                                                              │ (browser ↔ browser)
 ├─ api/ (routers)        HTTP ⇄ DTO only, no business rules
 ├─ realtime/             connection handler (protocol dispatch) · RoomManager (in-memory presence)
 ├─ services/             business rules: meeting lifecycle, admission, host permissions, code generation
 ├─ repositories/         every SQL query lives here
 ├─ models/               SQLAlchemy ORM + lifecycle methods (scheduled → live → ended / cancelled)
 └─ core/                 config · domain errors → HTTP mapping · security helpers · clock
        ▼
      SQLite
```

**Key decisions**

| Decision | Why |
|---|---|
| Layered backend (router → service → repository) | Rules such as "only the host can remove" or "ended meetings can't be joined" are written once and reused by **both** REST and WebSocket code; routes stay thin and services are unit-testable. |
| Domain exceptions + one global handler | Services raise `MeetingNotFound`, `InvalidPasscode`, … without knowing HTTP; one handler maps them to status codes and a consistent error body. No stack traces reach clients. |
| Pydantic DTOs | Validation at the boundary, and separate response shapes: `MeetingPublic` (pre-join preview, **no passcode**) vs `MeetingDetail` (host / admitted participants). |
| Sync SQLAlchemy | Simple and well understood; FastAPI runs sync routes in a threadpool, WebSocket code calls services via `run_in_threadpool`. Async SQLite adds complexity without benefit. |
| WebRTC **mesh** + WebSocket signaling | Real peer-to-peer media with no paid media servers. The server relays only small signaling messages. Suits small meetings (≈2–6 people); an SFU is the scaling path. |
| Newcomer always sends the offer | Avoids WebRTC "glare" (both sides offering) without implementing full perfect negotiation. Every connection has one audio + one video transceiver, so camera ↔ screen share uses `replaceTrack()` with no renegotiation. |
| In-memory `RoomManager` | Live sockets are process-local by nature; the DB stores durable facts (attendance, chat). Scaling out = Redis pub/sub. |
| No Redux / React Query / date library / UI kit | Global state is only "current user" + toasts (Context). Room state is a pure reducer. Two dashboard queries don't justify a cache library. `Intl` covers date/time-zone needs. A UI kit would look like the kit, not like Zoom. |

---

## Folder structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py                # app factory: CORS, routers, error handlers, startup (create tables, reconcile, seed)
│   │   ├── seed.py                # demo data  (python -m app.seed [--reset])
│   │   ├── core/                  # config.py, errors.py, security.py, clock.py
│   │   ├── db/                    # engine (SQLite pragmas), session dependency, declarative base
│   │   ├── models/                # user, meeting, participant, chat_message, enums
│   │   ├── schemas/               # Pydantic DTOs (meeting, participant, chat, user, ws protocol)
│   │   ├── repositories/          # SQL queries per aggregate
│   │   ├── services/              # meeting_service, participant_service, chat_service, meeting_code
│   │   ├── realtime/              # room_manager.py, connection_handler.py
│   │   └── api/                   # deps.py (DI + auth seam), v1/ (meetings, users, ws routers)
│   ├── tests/                     # pytest: API, validation, lifecycle, WebSocket protocol
│   ├── requirements.txt / requirements-dev.txt / .env.example / pytest.ini
├── frontend/
│   └── src/
│       ├── app/                   # routes: / , /join , /meetings , /meeting/[code]
│       ├── components/
│       │   ├── ui/                # Button, Modal, FormField, Menu, Avatar, ConfirmDialog, EmptyState, Spinner
│       │   ├── layout/            # TopNav, ZoomLogo
│       │   ├── dashboard/         # HomeDashboard, ActionTile, ClockBanner
│       │   ├── meetings/          # MeetingList(+Item), ScheduleMeeting(Modal|Form), InviteDialog, useMeetingDialogs
│       │   ├── join/              # JoinMeetingForm
│       │   └── meeting-room/      # MeetingPageClient → MeetingSession → PreJoinScreen | MeetingRoom
│       │                          #   (VideoGrid, VideoTile, ControlBar, ParticipantsPanel, ChatPanel, …)
│       ├── hooks/                 # useMeetingRoom, useMediaDevices, useMeetingLists, useSpeaking, …
│       ├── lib/                   # api/, realtime/, validation/, datetime, meetingCode, galleryLayout, config
│       ├── providers/             # CurrentUserProvider (auth seam), ToastProvider
│       └── types/                 # API + WebSocket protocol types (mirror backend schemas)
├── docs/INTERVIEW_GUIDE.md        # architecture walkthrough & design rationale
└── render.yaml                    # Render blueprint for the backend
```

---

## Database design

```
users 1 ──── N meetings 1 ──── N participants N ──── 0..1 users   (guests have no user)
                   │ 1                 │ 1
                   └──── N chat_messages N ┘
```

**users** — `id` PK · `name` · `email` UNIQUE · timestamps

**meetings**
| column | notes |
|---|---|
| `id` | PK (internal) |
| `meeting_code` | VARCHAR(11) **UNIQUE** — public Zoom-style ID |
| `passcode` | VARCHAR(10), required (embedded in invite links) |
| `host_id` | **FK → users** ON DELETE CASCADE |
| `title`, `description` | description nullable |
| `meeting_type` | CHECK IN (`instant`, `scheduled`) |
| `status` | CHECK IN (`scheduled`, `live`, `ended`, `cancelled`) |
| `scheduled_start_at`, `scheduled_end_at` | UTC; **CHECK end > start**. Duration is derived (API accepts `duration_minutes`). |
| `timezone` | IANA zone chosen in the scheduler |
| `mute_on_entry`, `host_video_on`, `participant_video_on` | scheduler options applied at pre-join |
| `started_at`, `ended_at` | actual runtime; CHECK `ended_at` ⇒ `started_at` |
| index | (`host_id`, `status`, `scheduled_start_at`) for Upcoming |

**participants** — one row per **join session** (not per person): `meeting_id` FK CASCADE · `user_id` FK SET NULL, **nullable** (guests) · `display_name` · `role` (`host`/`attendee`) · `status` (`pending` → `connected` → `left`/`removed`) · `session_token_hash` UNIQUE (SHA-256; raw token never stored) · `joined_at` / `left_at`. Indexes: (`meeting_id`, `status`), (`user_id`).

**chat_messages** — `meeting_id` FK · `participant_id` FK · `body` (CHECK 1–1000 chars) · `created_at`; index (`meeting_id`, `created_at`).

Why these choices:
- **Session rows** keep an honest attendance history for guests without accounts and for people who rejoin.
- **Start + end** (instead of start + duration) makes "still upcoming?" a plain indexed comparison that is portable to PostgreSQL — no DB-specific date arithmetic.
- **Enums as CHECK-constrained strings** are readable in SQLite and portable.
- SQLite ignores foreign keys by default — the engine enables `PRAGMA foreign_keys=ON` (and WAL) on every connection.

**Meeting lifecycle** (enforced by model methods, called from services):
```
scheduled ──first participant connects──► live ──host "End for all" / room empty 60 s──► ended
    └──host deletes──► cancelled                                   (joining ended/cancelled → 410)
```
- **Upcoming** = scheduled-type meetings of the user, status `scheduled`, `scheduled_end_at > now`, soonest first.
- **Recent** = meetings the user hosted or attended that actually started (`live`/`ended`), newest first.

---

## API

Base URL: `/api/v1` · interactive docs at **`/docs`** (Swagger) · health check `GET /health`.

| Method | Path | Purpose | Success | Errors |
|---|---|---|---|---|
| GET | `/users/me` | Current (default) user | 200 | |
| GET | `/meetings?scope=upcoming\|recent&limit=20` | Dashboard lists | 200 `MeetingDetail[]` | 422 |
| POST | `/meetings/instant` | New Meeting | 201 `MeetingDetail` | |
| POST | `/meetings` | Schedule | 201 `MeetingDetail` | 422 |
| PATCH | `/meetings/{code}` | Edit scheduled meeting | 200 | 403, 404, 409 |
| DELETE | `/meetings/{code}` | Cancel | 204 | 403, 404, 409 |
| GET | `/meetings/{code}` | Validate ID before joining (no passcode) | 200 `MeetingPublic` | 404, 410 |
| POST | `/meetings/{code}/start` | Host enters → session token | 201 `JoinSession` | 403, 404, 410 |
| POST | `/meetings/{code}/join` | Attendee enters `{display_name, passcode}` | 201 `JoinSession` | 403, 404, 410, 422 |
| POST | `/meetings/{code}/end` | Host ends for everyone | 200 | 403, 404, 409 |
| GET | `/meetings/{code}/participants?active_only=true` | Participant list | 200 | 404 |
| GET | `/meetings/{code}/messages` | Chat history | 200 | 404 |

`{code}` accepts `12345678901`, `123 4567 8901` or `123-4567-8901`.

**Schedule request**
```json
{ "title": "Sprint Planning", "description": "Sprint 24", "start_time": "2030-01-15T10:00:00+05:30",
  "duration_minutes": 60, "timezone": "Asia/Kolkata", "passcode": "abc123",
  "mute_on_entry": false, "host_video_on": true, "participant_video_on": true }
```
Validation: title 1–200 chars (trimmed) · description ≤ 2000 · `start_time` must include an offset and be in the future · duration 15–1440 min in 15-min steps · valid IANA time zone · passcode 1–10 alphanumerics · display name 1–64 chars.

**Error format** (every error):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Start time must be in the future.",
             "details": { "start_time": "Start time must be in the future." } } }
```
Codes: `VALIDATION_ERROR` 422 · `MEETING_NOT_FOUND` 404 · `MEETING_ENDED` / `MEETING_CANCELLED` 410 · `INVALID_PASSCODE` 403 · `NOT_HOST` 403 · `INVALID_MEETING_STATE` 409 · `INTERNAL_ERROR` 500 (logged, no stack trace).

### WebSocket protocol — `WS /ws/meetings/{code}?token=<JoinSession.token>`
The token is **single-use**: it authenticates exactly one socket.

| Direction | `type` | Payload |
|---|---|---|
| C→S | `signal` | `{to, data: {sdp} \| {candidate}}` — relayed only to `to` |
| C→S | `media_state` | `{audio, video, screen}` |
| C→S | `chat_message` | `{body}` (persisted) |
| C→S | `mute_all` · `mute_participant` · `remove_participant` · `end_meeting` | host only |
| S→C | `room_state` | `{self_id, participants[]}` on connect |
| S→C | `participant_joined` · `participant_updated` · `participant_left` | presence |
| S→C | `signal` · `chat_message` · `force_mute` · `removed` · `meeting_ended` · `error` | |

Close codes: `4401` invalid session · `4403` removed · `4404` meeting not found · `4410` meeting ended.

---

## Running locally

**Prerequisites:** Python 3.12+ and Node.js 20+.

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                 # optional; defaults work for local dev
python -m app.seed --reset           # create tables + demo data
uvicorn app.main:app --reload --port 8000
```
API: http://localhost:8000 · Swagger: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local           # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                          # http://localhost:3000
```

**Try it:** click **New Meeting**, open the meeting info (green shield), copy the invite link and open it in a second browser profile or an incognito window. Both participants see and hear each other.

### Environment variables

| Backend (`backend/.env`) | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./zoom_clone.db` | SQLAlchemy URL |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `PUBLIC_APP_URL` | `http://localhost:3000` | Frontend base URL used in invite links |
| `SEED_ON_STARTUP` | `true` | Seed demo data when the DB is empty |
| `EMPTY_ROOM_GRACE_SECONDS` | `60` | Empty live meetings end after this delay |

| Frontend (`frontend/.env.local`) | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL |
| `NEXT_PUBLIC_WS_URL` | derived (`http→ws`) | WebSocket base URL |
| `NEXT_PUBLIC_ICE_SERVERS` | Google STUN | JSON `RTCIceServer[]` (add TURN here) |

### Database & seed data
Tables are created automatically on startup, and demo data is seeded when the DB is empty. To reset manually: `python -m app.seed --reset`. The seed contains the default user (**Alex Morgan**), 5 upcoming meetings, 5 past meetings with attendance and chat history, and 1 cancelled meeting (hidden from the lists).

---

## Testing

```bash
cd backend  && pytest                 # 56 tests: REST, validation, lifecycle, WebSocket protocol
cd frontend && npm test               # 51 tests: parsing, time zones, validation, room reducer, layout
cd frontend && npm run lint && npm run typecheck
```
- **Backend:** every test gets an isolated in-memory SQLite database via FastAPI dependency overrides. Tests cover unique IDs and collision retry, schedule validation, Upcoming/Recent filtering, join errors (404/410/403/422), host-only start, the full WebSocket protocol (targeted signal relay, media state, chat persistence, mute all, remove plus token reuse, end for all), and malformed messages.
- **Frontend:** pure logic without a browser: invite-link parsing, DST-aware time-zone conversion, form validation, the room state machine, and the gallery layout algorithm.
- **End-to-end (manual/local):** a Playwright script drove two Chromium browsers with fake camera/mic through dashboard → schedule → invalid ID → new meeting → join with wrong/right passcode → **two-way video** → chat → camera off → screen share → mute all → remove → join via link → end for all → responsive mobile. All 19 steps passed. The script is not committed because it needs a Playwright browser download.

---

## Deployment

**Backend → Render** (supports WebSockets)
1. Push this repo to GitHub.
2. In Render, choose **New → Blueprint** and select the repo (it reads `render.yaml`). Alternatively, create a Web Service with root `backend`, build command `pip install -r requirements.txt`, and start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Set `CORS_ORIGINS` and `PUBLIC_APP_URL` to the Vercel URL (for example `https://your-app.vercel.app`).

**Frontend → Vercel**
1. Choose **Import Project** and set the root directory to `frontend` (Next.js is auto-detected).
2. Set `NEXT_PUBLIC_API_URL=https://<your-render-service>.onrender.com`.
3. Deploy, then update the backend's `CORS_ORIGINS` / `PUBLIC_APP_URL` if the URL changed.

> Render's free tier has an **ephemeral filesystem** and sleeps when idle. The SQLite file resets on redeploy or restart and is automatically re-seeded, and the first request after idling takes about 30–60 s. For durable data, attach a Render disk or point `DATABASE_URL` at PostgreSQL. No code changes are needed.

---

## Assumptions
- **No authentication** (per the brief). The default user is resolved by `get_current_user()` in `backend/app/api/deps.py`, which is the single seam where real auth (JWT/session) would plug in. Because every browser is "the default user" today, **host vs attendee is decided by the entry path**: `POST /start` (host-only, checked against `meeting.host_id`) vs `POST /join` (always an attendee). Dashboard *New Meeting / Start* uses the first; *Join* and invite links use the second.
- Meetings always have a passcode (Zoom's default). Invite links embed it, so link joins aren't prompted.
- Times are stored in UTC and displayed in the browser's time zone. The scheduler interprets the chosen date/time in the chosen time zone.
- An ended meeting's ID cannot be reused (410 Gone). A live meeting auto-ends 60 s after the last person leaves, so a page refresh doesn't kill it.
- Meetings target small groups (≈2–6) because of the mesh topology.

## Known limitations
- **No TURN server by default.** Peers behind strict/symmetric NATs (some corporate or mobile networks) may fail to connect media. Add TURN credentials via `NEXT_PUBLIC_ICE_SERVERS`.
- **Mesh topology** scales as O(n²) connections. Beyond about 6 participants an SFU (LiveKit, mediasoup) is needed.
- **Single backend instance.** Room presence is in memory, so horizontal scaling needs Redis pub/sub or sticky sessions. A restart ends live meetings (they are reconciled on startup).
- **Host leaving without ending** leaves the meeting running without a host (Zoom would ask you to assign a new host).
- "Stop video" disables the camera track (black frames, avatar shown) rather than releasing the camera hardware.
- Only one participant can share their screen at a time (Zoom's default).
- No rate limiting on passcode attempts yet.
