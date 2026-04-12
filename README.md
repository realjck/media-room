# MediaRoom

<img src="web/app/images/mascot.svg" alt="mascot" height="160">

[![python](https://img.shields.io/badge/python-f7dc65?logo=python)](https://www.python.org/)
![javascript](https://img.shields.io/badge/javascript-grey?logo=javascript)
[![jquery](https://img.shields.io/badge/jquery-0865a7?logo=jquery)](https://jquery.com/)
[![mini.css](https://img.shields.io/badge/mini.css-f22f21)](https://minicss.us/)

A minimal real-time chat room with synchronized media playback.

**[Demo at mediaroom.pxly.fr](https://mediaroom.pxly.fr)**

---

## Features

- Create or join named rooms — multiple rooms can coexist on the same server
- Synchronized video playback: play, pause and seek are broadcast to everyone in the room
- Supports direct MP4/video URLs and YouTube links
- Chat with colored name badges, changeable at any time
- Share a room link with one click — anyone opening the link lands directly in that room

## Usage

### Joining a room

Open the app and enter a room name, or navigate directly to a room via its URL hash:

```
https://mediaroom.pxly.fr#lounge
```

This skips the room selection step and brings you straight to the username prompt for room `lounge`. The URL updates automatically when you enter a room, so you can copy and share it at any time.

### Playing media

Paste a video URL (MP4 or YouTube) into the field at the top of the sidebar and press Enter or click the play button. All users in the room will load the same video. Play, pause and seek actions are synchronized in real time.

---

## Deployment

The app is split into two independent parts.

### Server

A Python asyncio WebSocket server, intended to run in Docker with SSL.

```bash
docker build -t media-room-server ./server

docker run -d --restart always -p 2002:8080 \
  -v /etc/letsencrypt/live/your-server.com/fullchain.pem:/app/cert.pem \
  -v /etc/letsencrypt/live/your-server.com/privkey.pem:/app/key.pem \
  media-room-server
```

Expose the container via Nginx on port 8443 (`wss://`):

```nginx
server {
  listen 8443 ssl;
  server_name your-server.com;
  ssl_certificate /etc/letsencrypt/live/your-server.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-server.com/privkey.pem;
  location / {
    proxy_pass https://localhost:2002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

### Web client

Static files — no build step. Set the WebSocket server URL in `web/config/settings`:

```
URL=wss://your-server.com:8443
```

Deploy the `web/` folder (or build its Docker image) to any static file host.
