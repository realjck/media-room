# Typing Indicator — Design Spec
_2026-05-18_

## Overview

Add a real-time "X is typing..." indicator above the chat input area. When a user types in the message field, other participants see their name with animated dots. The indicator disappears when the field is cleared or after 3 seconds of inactivity.

## WebSocket Events

Two new app-level events, following the existing `eventName:{JSON}` protocol:

| Event | Payload | When sent |
|-------|---------|-----------|
| `typing` | `{user: {name, color}}` | On first keystroke (field non-empty) + every 2s heartbeat while typing continues |
| `typingStop` | `{user: {name, color}}` | Immediately when field becomes empty |

The server relays these like all other events — no backend changes needed.

## Emitter Logic (sender side)

In `initTalk()` in `app.js`, on the `#message` textarea `input` event:

- **Field non-empty and not yet sending:** send `typing` immediately, start a 2s interval that re-sends `typing` (heartbeat).
- **Field becomes empty:** clear the interval, send `typingStop` immediately.
- On message submit: `JQueryForm` clears the field via `.val("")` which does **not** fire the `input` event. So the heartbeat must be explicitly stopped inside the `initTalk()` JQueryForm callback: cancel the interval and send `typingStop`.

## Receiver Logic (listener side)

A local object `_typingUsers` maps `username → expiry timer ID`.

On receiving `typing`:
- Ignore if `data.user.name === MR.user.name` (don't show own name).
- Cancel any existing expiry timer for that user.
- Record the user with a new 3s expiry timer. On expiry: delete the user from `_typingUsers` and update the indicator.
- Update the indicator: display the most recently added user (last key in the object).

On receiving `typingStop`:
- Ignore own name.
- Cancel expiry timer, delete from `_typingUsers`.
- Update the indicator.

On `logout` of a user: also clear that user from `_typingUsers` and update the indicator.

## "Most Recent" Display

`_typingUsers` is a plain object. Since JS objects preserve insertion order, the last inserted key is the most recent typer. The indicator always shows that last key. When it is removed, the next-to-last becomes the displayed typer (or the indicator hides if the object is empty).

## HTML

Insert between `.box-container` and `#talk-area` in `index.html`:

```html
<div id="typing-indicator">
  <span id="typing-name"></span>
  <span class="typing-dots"><span></span><span></span><span></span></span>
</div>
```

The div always occupies its space (fixed height). Only its text content is shown/hidden.

## CSS

```css
#typing-indicator {
  height: 20px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  font-size: 0.72em;
  color: #666;
  gap: 4px;
  flex-shrink: 0;
}

.typing-dots span {
  display: inline-block;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #666;
  animation: typing-blink 1.2s infinite;
}
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing-blink {
  0%, 80%, 100% { opacity: 0.2; }
  40%            { opacity: 1; }
}
```

## Files to Change

| File | Change |
|------|--------|
| `web/index.html` | Add `#typing-indicator` div between `.box-container` and `#talk-area` |
| `web/app/style/mr.css` | Add `#typing-indicator` and `.typing-dots` styles + keyframe |
| `web/app/js/app.js` | Add emitter + receiver logic in `initTalk()`, bump version to `0.8.2` |

## Version

Bump `VERSION` constant and header comment in `app.js` from `0.8.1` → `0.8.2`.
