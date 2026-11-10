# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MediaRoom** is a minimal real-time chat room with synchronized media playback. It uses a Python WebSocket server and a static vanilla JS frontend, deployed via Docker with Nginx + SSL.

## Development Setup

### Frontend (web/)
The frontend is static HTML/JS — no build step required. jQuery is bundled directly at `web/app/js/libs/jquery/jquery.min.js`. Serve `index.html` directly or via any static file server.

`web/config/settings` is git-ignored: create it with `cp web/config/settings.example web/config/settings`.

**Dev mode:** Set `DEV=true` in `web/config/settings` to skip login modals and auto-connect as `johndoe` to channel `dev`.

### Backend (server/)
```bash
cd server
python -m venv .venv
.venv/Scripts/activate   # Windows
pip install -r requirements.txt

# Run (requires cert.pem + key.pem in server/)
python main.py
```

The server listens on port 8080 with SSL (WSS). For local dev, you need self-signed certs or must modify `main.py` to remove SSL.

### Docker
```bash
# Server
docker build -t media-room-server ./server
docker run -p 8080:8080 -v /path/to/certs:/app media-room-server

# Web
docker build -t media-room-web ./web
docker run -p 80:80 media-room-web
```

## Architecture

### WebSocket Message Protocol

All app-level messages follow a structured format over raw WebSocket text:

**Client → Server:**
- Login handshake (first message): `username:channelname`
- App events: `eventName:{JSON_object}` e.g. `talk:{"message":"hi","user":{...}}`

**Server → Client:**
- App events: `:eventName:{JSON_object}` — parsed by regex in `ServerConnector`
- `>message` prefix → `alreadyTaken` event (username conflict)
- `!username` prefix → `logout` event (user disconnected)
- Plain text → server join/leave notifications (logged, not rendered)

### Media Sync Protocol

Media events are broadcast via the existing WebSocket app event system:

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `mediaLoad` | broadcast | `{url, timestamp, user}` | Someone loaded a new video |
| `mediaPlay` | broadcast | `{timestamp, user}` | Someone hit play |
| `mediaPause` | broadcast | `{timestamp, user}` | Someone hit pause |
| `mediaSeek` | broadcast | `{timestamp, user}` | Someone scrubbed (direct video only) |
| `mediaClear` | broadcast | `{user}` | Someone removed the media (the × on the Loaded line) |
| `mediaSyncRequest` | broadcast on join | `{user}` | New joiner requests current state |
| `mediaSyncResponse` | reply to requester | `{url, timestamp, isPlaying}` | Existing peer sends back state |

Sync flow on join: new user broadcasts `mediaSyncRequest` → first peer to respond sends `mediaSyncResponse` → joiner calls `MediaPlayer.loadAndSync()`. A 2-second timeout discards late responses.

YouTube note: the IFrame API has no `seeked` event — only play/pause are synchronized for YouTube. Autoplay is browser-blocked without a user gesture, so `loadAndSync` seeks to timestamp and shows a toast inviting the user to press play.

### Frontend Modules

| File | Role |
|------|------|
| `app/js/app.js` | Main app: state (`MR` object), UI flow, event wiring, media sync |
| `app/js/util/server-connector.js` | WebSocket client with pub/sub (`addListener`, `say`) |
| `app/js/util/load-settings.js` | Loads `config/settings` (key=value) into `window.*` globals |
| `app/js/util/jquery-form.js` | Form validation with regex rules. Uses `.off().on()` to replace handlers on re-init, preventing accumulation across re-logins |
| `app/js/util/media-player.js` | Unified player: detects YouTube vs direct URL, wraps YT IFrame API. `_ytReady` flag gates all YT player method calls until `onReady` fires |
| `app/js/view/view.js` | DOM manipulation: toasts, speech bubbles, user badges |
| `app/js/iife/ui-feats.js` | UI interactions: panel resizer, hamburger toggle, YT aspect ratio |

**App state** is held in the `MR` object in `app.js`:
- `MR.currentChannel` — room name
- `MR.user` — `{name, color}` (color is an index into `MR.userColors`)
- `MR.users` — array of other connected users

**UI flow:** `loadSettings` → (hash check: `askRoom()` or direct `askUserName()`) → `ServerConnector.login()` → `makePresentation()` → `View.addSelfUser()` → `initTalk()` / `initColorChange()` / `initMedia()`

### YouTube Player

The YT IFrame API **replaces** `<div id="yt-player">` with `<iframe id="yt-player">` on load. To maintain 16:9 aspect ratio with letterboxing:
- `<div id="yt-player">` is wrapped in `<div id="yt-player-wrap">` (flex centering container)
- Before each YT load, `_createPlayer()` recreates the inner div via `$('#yt-player-wrap').html('<div id="yt-player"></div>')`
- `ui-feats.js` uses a `ResizeObserver` on `#yt-player-wrap` and a `MutationObserver` (with `subtree: true`) to detect iframe insertion, then computes pixel-perfect 16:9 dimensions and sets them via `style.setProperty(..., 'important')`

### URL Hash Routing

Room names are encoded in the URL hash: `https://mediaroom.pxly.fr#lounge`.

- On page load, `app.js` reads `location.hash` — if valid (`^\w+$`), sets `MR.currentChannel` and skips `askRoom()`, going directly to `askUserName()`
- When the user submits the room name modal, `location.hash` is set to the room name
- The close button on the username modal clears the hash via `history.replaceState` and returns to `askRoom()`
- No server-side rewrite needed — hash routing is fully client-side

### Landing Page

`index.html` shows two sequential modals (room name → username) before entering the app. The landing page includes:
- Modal 1 (`#modal-roomname-dialog`): "Join or create a room:" label, inline input + Enter button
- Modal 2 (`#modal-username-dialog`): "What's your name?" label, color picker, Enter button — with a floating `#room-welcome` tag above it showing the room name
- GitHub corner ribbon (CSS diagonal banner, top-right) — hidden on room entry via `$('#github-ribbon').hide()` in `makePresentation()`
- Dot-grid background on `body`

### Left Panel Layout

The left panel is a flex column with four sections:
1. `.high-panel` — sidebar header (collapsible)
2. `.box-container` — scrollable chat bubbles (`flex: 1`, `flex-direction: column-reverse`)
3. `#typing-indicator` — fixed 20px bar showing "X is typing..." with animated dots; always reserves space so bubbles never jump
4. `#talk-area` — textarea + send button

### Sidebar — High Panel

The high panel (`#high-panel`) at the top of the left sidebar contains:
- `.panel-header`: mascot icon + "MEDIA ROOM" (Bebas Neue) on the left, hamburger toggle on the right — flex row, collapses cleanly
- `#copy-room-link`: button displaying "Link to room_name" — copies `location.href` to clipboard via `navigator.clipboard`
- `#media-form`: video URL input. Submitted URLs are checked by `MediaPlayer.isValidUrl()` (http(s), well-formed YouTube id); an invalid one stays in the field
- `#media-status`: fixed-height line under the form (never shifts the panel). Class `error` shows a red message (invalid syntax, or a load failure of the user's own URL — a failed media is cleared from the player state, so it is never shown as loaded nor sent to joiners); class `watching` shows "Loaded <url>" (click copies the URL) and a × that unloads the media for the whole room via `mediaClear`
- `.users-panel` / `#users-container`: user badges. The current user's badge (`#self-badge`) is prepended with a color picker dropdown (`#self-color-picker`) that opens on click — other users' badges are non-interactive

### Icons (`web/app/images/`)

Custom SVG icons drawn for this project (no icon library):
- `mascot.svg` — app mascot / logo
- `copy-link.svg` — chain link icon for copy-to-clipboard actions
- `send.svg` — paper plane icon for the send message button

### Backend (server/main.py)

Single-file Python asyncio WebSocket server:
- `clients` — all connected sockets
- `channels` — dict mapping channel name → set of sockets
- `names` — dict mapping socket → username
- `channel_locks` — per-channel `asyncio.Lock` to prevent race conditions on join

On connect: validates login format (`split(':', 1)`), validates username and channel against `IDENT_RE = r'^\w{1,32}$'`, acquires channel lock before uniqueness check, then broadcasts all subsequent messages to channel members. On disconnect: broadcasts `!username` to remaining channel members and cleans up empty channels.

`websockets.serve` is configured with `max_size=65536` to prevent DoS via oversized messages.

**Diagnostic logging** (stdlib `logging`, timestamped): `JOIN`/`LEAVE` with per-channel client count, and a `SLOW send` warning when a single `broadcast()` send blocks longer than `SLOW_SEND_SECONDS` (1s). The `SLOW send` line is the signal to confirm/rule out head-of-line blocking of the sequential broadcast on a slow client — the leading hypothesis for a transient chat freeze. `remote_address` is captured once at connect time (not in the `ConnectionClosed` handler) because reading it after the SSL transport is torn down raises `AttributeError`.

### Security model & planned hardening

The app is intentionally **open**: the only access control is the channel name (no authentication, no per-room secret — and none is wanted). Anyone who knows/guesses a room name can join, read live activity, and post. Displayed identity (`user.name`, color) comes from the client's event JSON and is **not** enforced server-side, so pseudo spoofing within a room is possible. There is **no message history**, so eavesdropping is live-only. This is an accepted trade-off for a casual shared-room chat.

What is protected: chat/usernames render via jQuery `.text()` (no XSS even bypassing the client-side `/^[^<>]+$/` regex); colors are fixed-palette index lookups; media URLs received from peers (`mediaLoad`, `mediaSyncResponse`) go through the same `MediaPlayer.isValidUrl()` check as local input and are ignored otherwise; login is regex-restricted (`^\w{1,32}$`) and only string-split (no injection sink); the server is pure in-memory (no eval/shell/fs/DB from user input); `max_size` caps message size.

**Planned (future session): rate-limiting + connection cap.** The realistic abuse vector is a bot opening many connections or flooding a room (the sequential broadcast means a flood affects everyone in the channel). There is currently no per-IP/per-connection rate limit, no total-connection cap, and no login timeout (a client can hold a coroutine at `await recv()` without ever identifying — slowloris-style). Add these when hardening. Per-room secrets are explicitly out of scope.

### Configuration (`web/config/settings`)

Plain text `KEY=VALUE` file loaded at runtime. Only whitelisted keys (`DEV`, `URL`) are written to `window.*` — all others are ignored. Key fields:
- `DEV` — `true` enables auto-login bypass
- `URL` — WebSocket server URL (e.g. `wss://host:port`). Note: this overwrites the native `window.URL` constructor, so `new URL()` cannot be used in the frontend

This file is served as a static asset and must be accessible at `./config/settings` relative to `index.html`. It is git-ignored (it holds the deployment URL); `web/config/settings.example` is the versioned template.

**Version** is hardcoded in `web/app/js/app.js` as `const VERSION = '...'` at the top of the file — not in `settings`.
