# Typing Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time "X is typing..." indicator above the chat input, visible to all other participants when someone is composing a message.

**Architecture:** Two new WebSocket events (`typing` / `typingStop`) are broadcast via the existing `ServerConnector.say()` relay. The emitter watches the `#message` textarea with a 2s heartbeat; receivers track active typers with 3s auto-expiry timers and display the most recent one. A fixed-height `#typing-indicator` div between `.box-container` and `#talk-area` reserves space so speech bubbles never jump.

**Tech Stack:** Vanilla JS (ES modules), jQuery, WebSocket via existing `ServerConnector`, CSS keyframe animation.

---

## File Map

| File | Change |
|------|--------|
| `web/index.html` | Insert `#typing-indicator` div between `.box-container` and `#talk-area` |
| `web/app/style/mr.css` | Add `#typing-indicator`, `.typing-dots`, `@keyframes typing-blink` |
| `web/app/js/app.js` | Module-level `_typingUsers`, `_clearTypingUser()`, `_updateTypingIndicator()`; update `initTalk()` and logout handler; bump version |

---

## Task 1: HTML — Add typing indicator element

**Files:**
- Modify: `web/index.html`

- [ ] **Step 1: Insert the `#typing-indicator` div**

In `web/index.html`, between the closing `</div>` of `.box-container` (line 48) and the opening `<div id="talk-area">` (line 50), insert:

```html
		<!-- Left Panel - Messages box container -->
		<div class="box-container">
			<!-- speech bubbles -->
		</div>
		<!-- Typing indicator -->
		<div id="typing-indicator">
			<span id="typing-name"></span>
			<span class="typing-dots"><span></span><span></span><span></span></span>
		</div>
		<!-- Left Panel - Send messages area -->
		<div id="talk-area">
```

- [ ] **Step 2: Commit**

```bash
git add web/index.html
git commit -m "feat(html): add typing indicator placeholder"
```

---

## Task 2: CSS — Style the typing indicator

**Files:**
- Modify: `web/app/style/mr.css`

- [ ] **Step 1: Add styles at the end of `mr.css`**

Append to `web/app/style/mr.css`:

```css
/* Typing indicator */
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

.typing-dots {
    display: none;
    gap: 3px;
    align-items: center;
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

- [ ] **Step 2: Verify static layout**

Open `web/index.html` in a browser (DEV mode). The chat area should show a 20px gap between the message bubbles and the textarea — no content yet, just reserved space. The layout must not shift.

- [ ] **Step 3: Commit**

```bash
git add web/app/style/mr.css
git commit -m "feat(css): add typing indicator styles and dot animation"
```

---

## Task 3: JS — Add typing logic and bump version

**Files:**
- Modify: `web/app/js/app.js`

- [ ] **Step 1: Bump the version**

At the top of `web/app/js/app.js`, change:

```js
// Version: 0.8.1
```
to:
```js
// Version: 0.8.2
```

And:

```js
const VERSION = '0.8.1';
```
to:
```js
const VERSION = '0.8.2';
```

- [ ] **Step 2: Add module-level typing state**

After the existing module-level declarations (`let _syncDone`, `let _syncTimeout`), add:

```js
let _typingUsers = {};

function _clearTypingUser(username) {
  if (_typingUsers[username]) {
    clearTimeout(_typingUsers[username]);
    delete _typingUsers[username];
  }
  _updateTypingIndicator();
}

function _updateTypingIndicator() {
  const keys = Object.keys(_typingUsers);
  if (keys.length === 0) {
    $('#typing-name').text('');
    $('.typing-dots').css('display', 'none');
  } else {
    $('#typing-name').text(keys[keys.length - 1] + ' is typing');
    $('.typing-dots').css('display', 'inline-flex');
  }
}
```

- [ ] **Step 3: Reset typing state on re-login**

In `makePresentation()`, after `MR.users = [];` and `$('#users-container').empty();`, add:

```js
_typingUsers = {};
_updateTypingIndicator();
```

- [ ] **Step 4: Clear typing state on user logout**

In the `logout` listener inside `makePresentation()`, after `View.removeUser(username);`, add:

```js
_clearTypingUser(username);
```

The logout handler should look like:

```js
ServerConnector.addListener('logout', username => {
    const found = MR.users.findLast(user => user.name === username);
    const col = found ? found.color : 0;
    MR.users = MR.users.filter(user => user.name !== username);
    View.removeUser(username);
    _clearTypingUser(username);
    const fun_msg = [ /* ... unchanged ... */ ];
    View.toast(username + ' ' + fun_msg[Math.floor(fun_msg.length*Math.random())], MR.userColors[col]);
});
```

- [ ] **Step 5: Replace `initTalk()` with the new version**

Replace the entire `initTalk()` function with:

```js
function initTalk() {
  let _typingInterval = null;

  function _sendTyping() {
    ServerConnector.say('typing', MR.user);
  }

  function _stopTyping() {
    if (_typingInterval) {
      clearInterval(_typingInterval);
      _typingInterval = null;
    }
    ServerConnector.say('typingStop', MR.user);
  }

  // Emitter: watch textarea
  $('#message').on('input', () => {
    const val = $('#message').val();
    if (val.length > 0 && !_typingInterval) {
      _sendTyping();
      _typingInterval = setInterval(_sendTyping, 2000);
    } else if (val.length === 0 && _typingInterval) {
      _stopTyping();
    }
  });

  // Receiver: someone started typing
  ServerConnector.addListener('typing', (data) => {
    if (data.name === MR.user.name) return;
    if (_typingUsers[data.name]) clearTimeout(_typingUsers[data.name]);
    _typingUsers[data.name] = setTimeout(() => {
      delete _typingUsers[data.name];
      _updateTypingIndicator();
    }, 3000);
    _updateTypingIndicator();
  });

  // Receiver: someone stopped typing
  ServerConnector.addListener('typingStop', (data) => {
    if (data.name === MR.user.name) return;
    _clearTypingUser(data.name);
  });

  // Receiver: incoming chat message
  ServerConnector.addListener('talk', (data) => {
    const isOther = data.user.name !== MR.user.name || data.user.color !== MR.user.color;
    View.speechBubble(data.user.name, MR.userColors[data.user.color], data.message, isOther);
  });

  // Submit form — JQueryForm clears the field without firing 'input', so stop heartbeat here
  JQueryForm.init('talk-area', [['message', /^[^<>]+$/]], (data) => {
    _stopTyping();
    ServerConnector.say('talk', { message: data.message, user: MR.user });
  });
}
```

- [ ] **Step 6: Manual verification**

Open the app with `DEV=true` in two browser tabs (same channel). In tab A, type something — tab B should show "johndoe is typing" with animated dots. Clear the field in tab A — the indicator disappears in tab B immediately. Stop typing without clearing — indicator disappears after ~3s in tab B. Submit a message — indicator disappears in tab B immediately.

- [ ] **Step 7: Commit**

```bash
git add web/app/js/app.js
git commit -m "feat(js): add typing indicator with heartbeat and auto-expiry (v0.8.2)"
```
