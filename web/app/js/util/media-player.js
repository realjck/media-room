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
  // 2s window: YouTube onStateChange fires over IPC with unpredictable latency
  setTimeout(() => { _remoteAction = false; }, 2000);
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
  $('video').off('play.mr pause.mr seeked.mr error.mr canplay.sync');
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
// Note: YouTube IFrame API has no 'seeked' event. Manual scrubbing by remote users
// is not broadcast. Only play/pause events are synchronized for YouTube.

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
    // Overwriting onYouTubeIframeAPIReady is intentional: the latest load always wins.
    // If two YouTube URLs are loaded before the API script finishes, only the last one is created.
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
