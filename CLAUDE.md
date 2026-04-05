# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MediaRoom** is a minimal real-time chat room with synchronized media playback. It uses a Python WebSocket server and a static vanilla JS frontend, deployed via Docker with Nginx + SSL.

## Development Setup

### Frontend (web/)
The frontend is static HTML/JS — no build step required. jQuery is bundled directly at `web/app/js/libs/jquery/jquery.min.js`. Serve `index.html` directly or via any static file server.

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
| `app/js/util/jquery-form.js` | Form validation with regex rules |
| `app/js/util/media-player.js` | Unified player: detects YouTube vs direct URL, wraps YT IFrame API |
| `app/js/view/view.js` | DOM manipulation: toasts, speech bubbles, user badges |
| `app/js/iife/ui-feats.js` | UI interactions: panel resizer, hamburger toggle, YT aspect ratio |

**App state** is held in the `MR` object in `app.js`:
- `MR.currentChannel` — room name
- `MR.user` — `{name, color}` (color is an index into `MR.userColors`)
- `MR.users` — array of other connected users

**UI flow:** `loadSettings` → `askRoom()` → `askUserName()` → `ServerConnector.login()` → `makePresentation()` → `initTalk()` / `initColorChange()` / `initMedia()`

### YouTube Player

The YT IFrame API **replaces** `<div id="yt-player">` with `<iframe id="yt-player">` on load. To maintain 16:9 aspect ratio with letterboxing:
- `<div id="yt-player">` is wrapped in `<div id="yt-player-wrap">` (flex centering container)
- Before each YT load, `_createPlayer()` recreates the inner div via `$('#yt-player-wrap').html('<div id="yt-player"></div>')`
- `ui-feats.js` uses a `ResizeObserver` on `#yt-player-wrap` and a `MutationObserver` (with `subtree: true`) to detect iframe insertion, then computes pixel-perfect 16:9 dimensions and sets them via `style.setProperty(..., 'important')`

### Landing Page

`index.html` shows two sequential modals (room name → username) before entering the app. The landing page includes:
- Title "Media Room" (Bebas Neue font) + subtitle
- GitHub corner ribbon (CSS diagonal banner, top-right) — hidden on room entry via `$('#github-ribbon').hide()` in `makePresentation()`
- Dot-grid background on `body`

### Backend (server/main.py)

Single-file Python asyncio WebSocket server:
- `clients` — all connected sockets
- `channels` — dict mapping channel name → set of sockets
- `names` — dict mapping socket → username

On connect: receives `user:channel`, validates no duplicate username in channel, then broadcasts all subsequent messages to channel members. On disconnect: broadcasts `!username` to remaining channel members and cleans up empty channels.

### Configuration (`web/config/settings`)

Plain text `KEY=VALUE` file loaded at runtime. Key fields:
- `VERSION` — displayed in UI
- `DEV` — `true` enables auto-login bypass
- `URL` — WebSocket server URL (e.g. `wss://host:port`)

This file is served as a static asset and must be accessible at `./config/settings` relative to `index.html`.
