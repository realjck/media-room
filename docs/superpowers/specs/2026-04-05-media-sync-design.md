# Media Sync — Design Spec
**Date:** 2026-04-05  
**Project:** MediaRoom  
**Status:** Approved

---

## Goal

Add synchronized media playback to MediaRoom: any user can load a video URL (direct or YouTube), and all users in the room share play/pause/seek state in real time. All users are hosts (equal control). The application stays minimal.

---

## Section 1 — WebSocket Protocol

Six new events, using the existing `eventName:{JSON}` format. **The server is not modified.**

| Event | Emitter | Payload | Description |
|---|---|---|---|
| `mediaLoad` | client | `{url, timestamp}` | Load a new URL |
| `mediaPlay` | client | `{timestamp}` | Playback started |
| `mediaPause` | client | `{timestamp}` | Playback paused |
| `mediaSeek` | client | `{timestamp}` | Timeline jump |
| `mediaSyncRequest` | client | `{}` | Request current state (on join) |
| `mediaSyncResponse` | client | `{url, timestamp, isPlaying}` | Response to sync request |

### Anti-loop guard
When a client receives a remote media event and applies it to its player, it sets `_remoteAction = true` before applying the change. The player's native event handlers check this flag before broadcasting. The flag is reset via `setTimeout(0)` after the action.

---

## Section 2 — Frontend Architecture

### URL Detection

A `detectMediaType(url)` function returns `'youtube'` or `'direct'`:
- YouTube regex matches: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`
- Everything else is `'direct'`

### MediaPlayer module (`app/js/util/media-player.js`)

Unified API regardless of source:

```js
MediaPlayer.load(url)      // load and detect type
MediaPlayer.play(timestamp) // play from timestamp
MediaPlayer.pause(timestamp) // pause + seek
MediaPlayer.seek(timestamp)  // seek only
MediaPlayer.getTime()        // returns current timestamp (seconds)
MediaPlayer.getState()       // returns {url, timestamp, isPlaying}
```

Internally:
- **Direct URLs:** uses the existing `<video>` element
- **YouTube:** injects a `<div id="yt-player">` in `right-panel`, replaced by the YouTube IFrame API
- Only one player is visible at a time; the other is hidden

The YouTube IFrame API script (`https://www.youtube.com/iframe_api`) is loaded dynamically on first YouTube URL load.

### Changes to `app.js`

`initMedia()` is extended to:
1. Register listeners for all 6 media events via `ServerConnector.addListener`
2. Wire native player events (`play`, `pause`, `seeked` on `<video>`; `onStateChange` on YouTube IFrame) to broadcast via `ServerConnector.say`
3. Display toasts for remote actions (not for local actions)

`makePresentation()` sends `mediaSyncRequest` after login.

### URL Input in `high-panel`

Placed between "Room: xxx" and "Choose your avatar's color:":

```
[ url or youtube link...      ] [▶]
```

Submitting the form calls `MediaPlayer.load(url)` and broadcasts `mediaLoad`.

---

## Section 3 — Error Handling & Edge Cases

### Load errors
- Invalid or unreachable URL → `View.toast("Could not load media")`, no broadcast
- YouTube IFrame API unavailable → toast error, graceful fallback (native `<video>` stays visible)

### Sync on join
- `mediaSyncRequest` is broadcast on join
- If no response within 2s → nothing (empty room or no media loaded)
- Only the first `mediaSyncResponse` received is used (flag `_syncDone`)
- Clients only send `mediaSyncResponse` if `MediaPlayer.getState().url !== null`

### Timestamp drift
- No continuous sync — only on user events (play/pause/seek/load)
- Tolerance: if timestamp difference on `mediaPlay` is < 2s, no forced seek (avoids jarring jumps)

### Disconnection / reconnection
- On reconnect, `makePresentation` runs again and sends `mediaSyncRequest` — sync is re-established naturally

### Toast messages for remote media actions
- `mediaLoad` → `"[user] loaded a new video"`
- `mediaPlay` → `"[user] started playback"`
- `mediaPause` → `"[user] paused"`
- `mediaSeek` → `"[user] jumped to 1:23"`
- Local actions do not trigger toasts

---

## Files to Create / Modify

| File | Action |
|---|---|
| `web/app/js/util/media-player.js` | **Create** — MediaPlayer module |
| `web/app/js/app.js` | **Modify** — extend `initMedia()`, add `mediaSyncRequest` in `makePresentation()` |
| `web/index.html` | **Modify** — add URL input in `high-panel`, add `<div id="yt-player">` in `right-panel` |
| `web/app/style/mr.css` | **Modify** — style for URL input field |
| `server/main.py` | **No change** |
