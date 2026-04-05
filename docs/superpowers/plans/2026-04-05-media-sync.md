# Media Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add synchronized media playback supporting direct video URLs and YouTube links, with real-time play/pause/seek sync for all users in a room.

**Architecture:** A new `MediaPlayer` module abstracts `<video>` and YouTube IFrame API behind a unified interface. Six WebSocket events carry media state between peers. A peer-to-peer sync request at join time restores state for late joiners — the server is not modified.

**Tech Stack:** Vanilla JS (ES modules), jQuery (already present), YouTube IFrame API (loaded on demand)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `web/index.html` | Modify | Add URL form in `high-panel`, add `#yt-player` div in `right-panel` |
| `web/app/style/mr.css` | Modify | Style the URL form |
| `web/app/js/util/media-player.js` | **Create** | Unified player API: direct video + YouTube IFrame |
| `web/app/js/app.js` | Modify | Import MediaPlayer, extend `initMedia()`, add sync request in `makePresentation()` |

**Server (`server/main.py`): no changes.**

> Note: This project has no test framework. Verification steps use the browser with `DEV=true` in `web/config/settings`.

---

### Task 1: HTML structure and CSS

**Files:**
- Modify: `web/index.html`
- Modify: `web/app/style/mr.css`

- [ ] **Step 1: Add `#yt-player` div in `right-panel`** (`web/index.html`)

In the `right-panel` (around line 65), after the closing `</video>` tag, add:

```html
<div id="yt-player" style="display:none; width:100%; height:100%;"></div>
```

Result — the full `right-panel` block becomes:
```html
<div class="right-panel">
    <video controls poster="./app/images/video-poster.svg">
        <source src="" type="video/mp4">
        <track default kind="descriptions" src=""/>
    </video>
    <div id="yt-player" style="display:none; width:100%; height:100%;"></div>
</div>
```

- [ ] **Step 2: Add media URL form in `high-panel`** (`web/index.html`)

Inside `#hiding-zone`, between `<h2 class="small">Room: <span id="room-name"></span></h2>` and `<h2 class="small">Choose your avatar's color:</h2>`, add:

```html
<form id="media-form" class="media-form">
    <input type="text" id="media-url" placeholder="Video URL or YouTube link" autocomplete="off"/>
    <button type="submit">&#9654;</button>
</form>
```

- [ ] **Step 3: Add CSS for the media form** (`web/app/style/mr.css`)

Append at the end of the file:

```css
/* Media form */
.media-form {
    display: flex;
    gap: 5px;
    padding: 5px 5px 2px 5px;
    margin: 0;
}
.media-form input {
    flex: 1;
    width: auto;
    font-size: 0.8em;
    padding: 4px 8px;
    margin: 0;
}
.media-form button {
    padding: 4px 8px;
    font-size: 0.8em;
    white-space: nowrap;
    flex-shrink: 0;
}
```

- [ ] **Step 4: Verify in browser**

Set `DEV=true` in `web/config/settings`. Open `index.html`. Confirm:
- URL input and ▶ button appear in the high-panel between "Room: dev" and "Choose your avatar's color:"
- Layout is not broken on both panels
- Right panel still shows the video poster

- [ ] **Step 5: Commit**

```bash
git add web/index.html web/app/style/mr.css
git commit -m "feat: add media URL input and yt-player container"
```

---

### Task 2: Create MediaPlayer module

**Files:**
- Create: `web/app/js/util/media-player.js`

- [ ] **Step 1: Create the file**

Create `web/app/js/util/media-player.js` with the following content:

```js
/**
 * MediaPlayer
 * Unified interface for direct video URLs and YouTube IFrame API.
 * API: load, loadAndSync, play, pause, seek, getTime, getState, setCallbacks
 */

let _url = null;
let _isPlaying = false;
let _ytPlayer = null;
let _remoteAction = false;
let _syncPending = null;

const _callbacks = {
  onPlay: null,
  onPause: null,
  onSeek: null,
  onError: null
};

function _detectType(url) {
  if (/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url)) {
    return 'youtube';
  }
  return 'direct';
}

function _extractYouTubeId(url) {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([^&?/\s]+)/);
  return match ? match[1] : null;
}

// Sets _remoteAction for 500ms to suppress local event broadcasting
// while applying a remote-triggered change to the player.
function _withRemoteAction(fn) {
  _remoteAction = true;
  fn();
  setTimeout(() => { _remoteAction = false; }, 500);
}

function _applySyncPending() {
  if (!_syncPending) return;
  const { timestamp, isPlaying } = _syncPending;
  _syncPending = null;
  if (isPlaying) {
    MediaPlayer.play(timestamp);
  } else {
    MediaPlayer.seek(timestamp);
  }
}

function _loadDirect(url, onReady) {
  $('#yt-player').hide();
  $('video').show();
  $('video source').attr('src', url);
  $('video')[0].load();
  $('video').off('play.mr pause.mr seeked.mr error.mr');
  if (onReady) {
    $('video').one('canplay.sync', onReady);
  }
  $('video').on('play.mr', () => {
    if (_remoteAction) return;
    _isPlaying = true;
    if (_callbacks.onPlay) _callbacks.onPlay($('video')[0].currentTime);
  });
  $('video').on('pause.mr', () => {
    if (_remoteAction) return;
    _isPlaying = false;
    if (_callbacks.onPause) _callbacks.onPause($('video')[0].currentTime);
  });
  $('video').on('seeked.mr', () => {
    if (_remoteAction) return;
    if (_callbacks.onSeek) _callbacks.onSeek($('video')[0].currentTime);
  });
  $('video').on('error.mr', () => {
    if (_callbacks.onError) _callbacks.onError();
  });
}

function _onYTStateChange(event) {
  if (_remoteAction) return;
  if (event.data === YT.PlayerState.PLAYING) {
    _isPlaying = true;
    if (_callbacks.onPlay) _callbacks.onPlay(_ytPlayer.getCurrentTime());
  } else if (event.data === YT.PlayerState.PAUSED) {
    _isPlaying = false;
    if (_callbacks.onPause) _callbacks.onPause(_ytPlayer.getCurrentTime());
  }
}

function _loadYouTube(url, onReady) {
  $('video').hide();
  $('#yt-player').show().empty();
  const videoId = _extractYouTubeId(url);
  if (!videoId) {
    if (_callbacks.onError) _callbacks.onError();
    return;
  }
  function _createPlayer() {
    if (_ytPlayer) { _ytPlayer.destroy(); _ytPlayer = null; }
    _ytPlayer = new YT.Player('yt-player', {
      videoId: videoId,
      width: '100%',
      height: '100%',
      playerVars: { autoplay: 0, controls: 1 },
      events: {
        onReady: () => { if (onReady) onReady(); },
        onStateChange: _onYTStateChange,
        onError: () => { if (_callbacks.onError) _callbacks.onError(); }
      }
    });
  }
  if (window.YT && window.YT.Player) {
    _createPlayer();
  } else {
    if (!document.getElementById('yt-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'yt-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    window.onYouTubeIframeAPIReady = _createPlayer;
  }
}

const MediaPlayer = {};

/**
 * Register callbacks fired by local player events (used to broadcast to room).
 * @param {{ onPlay, onPause, onSeek, onError }} callbacks
 */
MediaPlayer.setCallbacks = (callbacks) => {
  Object.assign(_callbacks, callbacks);
};

/**
 * Load a URL. Detects YouTube vs direct automatically. No autoplay.
 */
MediaPlayer.load = (url) => {
  _url = url;
  _isPlaying = false;
  if (_detectType(url) === 'youtube') {
    _loadYouTube(url, null);
  } else {
    _loadDirect(url, null);
  }
};

/**
 * Load a URL and, once the player is ready, seek + optionally play.
 * Used when a new user joins and receives a mediaSyncResponse.
 */
MediaPlayer.loadAndSync = (url, timestamp, isPlaying) => {
  _url = url;
  _isPlaying = false;
  _syncPending = { timestamp, isPlaying };
  if (_detectType(url) === 'youtube') {
    _loadYouTube(url, _applySyncPending);
  } else {
    _loadDirect(url, _applySyncPending);
  }
};

/**
 * Apply a remote play at a given timestamp.
 * Tolerance: skips seek if diff < 2s to avoid jarring jumps.
 */
MediaPlayer.play = (timestamp) => {
  _withRemoteAction(() => {
    _isPlaying = true;
    if (_detectType(_url || '') === 'youtube' && _ytPlayer) {
      if (timestamp !== undefined) _ytPlayer.seekTo(timestamp, true);
      _ytPlayer.playVideo();
    } else {
      const v = $('video')[0];
      if (timestamp !== undefined && Math.abs(v.currentTime - timestamp) > 2) {
        v.currentTime = timestamp;
      }
      v.play();
    }
  });
};

/**
 * Apply a remote pause at a given timestamp.
 */
MediaPlayer.pause = (timestamp) => {
  _withRemoteAction(() => {
    _isPlaying = false;
    if (_detectType(_url || '') === 'youtube' && _ytPlayer) {
      _ytPlayer.pauseVideo();
      if (timestamp !== undefined) _ytPlayer.seekTo(timestamp, true);
    } else {
      const v = $('video')[0];
      v.pause();
      if (timestamp !== undefined) v.currentTime = timestamp;
    }
  });
};

/**
 * Apply a remote seek to a given timestamp.
 */
MediaPlayer.seek = (timestamp) => {
  _withRemoteAction(() => {
    if (_detectType(_url || '') === 'youtube' && _ytPlayer) {
      _ytPlayer.seekTo(timestamp, true);
    } else {
      $('video')[0].currentTime = timestamp;
    }
  });
};

/** Returns current playback position in seconds. */
MediaPlayer.getTime = () => {
  if (_detectType(_url || '') === 'youtube' && _ytPlayer) {
    return _ytPlayer.getCurrentTime() || 0;
  }
  return $('video')[0].currentTime || 0;
};

/** Returns full player state for sync response. */
MediaPlayer.getState = () => ({
  url: _url,
  timestamp: MediaPlayer.getTime(),
  isPlaying: _isPlaying
});

export { MediaPlayer };
```

- [ ] **Step 2: Verify import works**

Temporarily add the import to `app.js` (top of file) to confirm no module resolution errors:
```js
import { MediaPlayer } from './util/media-player.js';
```
Open `index.html` with `DEV=true`. Check browser console for errors. Remove the import if Task 3 hasn't started yet.

- [ ] **Step 3: Commit**

```bash
git add web/app/js/util/media-player.js
git commit -m "feat: add MediaPlayer module (direct video + YouTube IFrame)"
```

---

### Task 3: Wire media sync in app.js

**Files:**
- Modify: `web/app/js/app.js`

- [ ] **Step 1: Add import for MediaPlayer**

At the top of `web/app/js/app.js`, after the existing imports (line 4), add:

```js
import { MediaPlayer } from './util/media-player.js';
```

- [ ] **Step 2: Add `_formatTimestamp` helper and replace `initMedia()`**

Replace the entire `initMedia()` function (lines 254–269) with the following. Add `_formatTimestamp` just above `initMedia`:

```js
function _formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function initMedia() {
  // End of direct video — restore poster
  $('video').on('ended', () => {
    $('video')[0].load();
    const fun_msg = [
      'The media is over, but the fun is just beginning.',
      'The media is finished, but the story is still being written.',
      'The media is finished, but the imagination is still running wild.',
      'The media is finished, but the memories will last a lifetime.',
      'The media is finished, but the journey is only just beginning.'
    ];
    View.toast(fun_msg[Math.floor(fun_msg.length * Math.random())]);
  });

  // Wire MediaPlayer local events → broadcast to room
  MediaPlayer.setCallbacks({
    onPlay: (timestamp) => {
      ServerConnector.say('mediaPlay', { timestamp, user: MR.user });
    },
    onPause: (timestamp) => {
      ServerConnector.say('mediaPause', { timestamp, user: MR.user });
    },
    onSeek: (timestamp) => {
      ServerConnector.say('mediaSeek', { timestamp, user: MR.user });
    },
    onError: () => {
      View.toast('Could not load media');
    }
  });

  // URL form → load and broadcast
  $('#media-form').on('submit', (e) => {
    e.preventDefault();
    const url = $('#media-url').val().trim();
    if (!url) return;
    MediaPlayer.load(url);
    ServerConnector.say('mediaLoad', { url, timestamp: 0, user: MR.user });
    $('#media-url').val('');
  });

  // Remote: someone loaded a new media
  ServerConnector.addListener('mediaLoad', (data) => {
    if (data.user.name === MR.user.name) return;
    MediaPlayer.load(data.url);
    View.toast(`${data.user.name} loaded a new video`, MR.userColors[data.user.color]);
  });

  // Remote: someone played
  ServerConnector.addListener('mediaPlay', (data) => {
    if (data.user.name === MR.user.name) return;
    MediaPlayer.play(data.timestamp);
    View.toast(`${data.user.name} started playback`, MR.userColors[data.user.color]);
  });

  // Remote: someone paused
  ServerConnector.addListener('mediaPause', (data) => {
    if (data.user.name === MR.user.name) return;
    MediaPlayer.pause(data.timestamp);
    View.toast(`${data.user.name} paused`, MR.userColors[data.user.color]);
  });

  // Remote: someone seeked
  ServerConnector.addListener('mediaSeek', (data) => {
    if (data.user.name === MR.user.name) return;
    MediaPlayer.seek(data.timestamp);
    View.toast(`${data.user.name} jumped to ${_formatTimestamp(data.timestamp)}`, MR.userColors[data.user.color]);
  });

  // Sync: respond to joiners requesting current state
  ServerConnector.addListener('mediaSyncRequest', () => {
    const state = MediaPlayer.getState();
    if (state.url) {
      ServerConnector.say('mediaSyncResponse', state);
    }
  });

  // Sync: receive state from existing peers on join (take first response only)
  let _syncDone = false;
  const _syncTimeout = setTimeout(() => { _syncDone = true; }, 2000);
  ServerConnector.addListener('mediaSyncResponse', (data) => {
    if (_syncDone) return;
    _syncDone = true;
    clearTimeout(_syncTimeout);
    MediaPlayer.loadAndSync(data.url, data.timestamp, data.isPlaying);
  });
}
```

- [ ] **Step 3: Add `mediaSyncRequest` at the end of `makePresentation()`**

In `makePresentation()`, after the `initMedia()` call and before `$(".container").show()`, add:

```js
  // Request media sync from existing peers
  ServerConnector.say('mediaSyncRequest', {});
```

The tail of `makePresentation()` should look like this:

```js
  // show room name
  $("#room-name").html(MR.currentChannel);

  // next:
  initMedia();

  // Request media sync from existing peers
  ServerConnector.say('mediaSyncRequest', {});

  // show container:
  $(".container").show();
  $("#message").focus();
```

- [ ] **Step 4: Verify — single user, direct URL**

1. Set `DEV=true` in `web/config/settings`, open `index.html`
2. Paste a direct `.mp4` URL in the media form, press ▶
3. Confirm video loads in the right panel
4. Press play, pause, drag the seek bar — no console errors

- [ ] **Step 5: Verify — single user, YouTube URL**

1. Paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ` in the media form, press ▶
2. Confirm the YouTube iframe appears, `<video>` is hidden
3. Press play, pause — no console errors

- [ ] **Step 6: Verify — two users, real-time sync**

1. Set `DEV=false` in `web/config/settings`
2. Open two browser tabs, each joining the same room with different usernames
3. In tab 1, load a direct video URL → confirm toast appears in tab 2 with the username
4. In tab 1, press play → confirm tab 2 plays and shows toast
5. In tab 1, pause → confirm tab 2 pauses and shows toast
6. In tab 1, seek to a different position → confirm tab 2 jumps to the same position with toast showing `"[user] jumped to M:SS"`

- [ ] **Step 7: Verify — late joiner sync**

1. Keep tab 1 with a video playing
2. Open a third tab, join the same room
3. Within 2 seconds, confirm the video loads and starts playing at approximately the same position as tab 1

- [ ] **Step 8: Commit**

```bash
git add web/app/js/app.js
git commit -m "feat: wire media sync — broadcast play/pause/seek/load + join sync"
```
