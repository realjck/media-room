import asyncio
import websockets
import ssl
import re
import time
import logging
from websockets import WebSocketServerProtocol
from typing import Set, Dict

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("mediaroom")

clients: Set[WebSocketServerProtocol] = set()
channels: Dict[str, Set[WebSocketServerProtocol]] = {}
names: Dict[WebSocketServerProtocol, str] = {}
channel_locks: Dict[str, asyncio.Lock] = {}

IDENT_RE = re.compile(r'^\w{1,32}$')
MAX_MESSAGE_SIZE = 65536
SLOW_SEND_SECONDS = 1.0  # warn if a single send blocks longer than this


def get_channel_lock(channel_name: str) -> asyncio.Lock:
    if channel_name not in channel_locks:
        channel_locks[channel_name] = asyncio.Lock()
    return channel_locks[channel_name]


async def handle_clients(websocket: WebSocketServerProtocol):
    clients.add(websocket)
    remote_address = websocket.remote_address
    try:
        # Receive client's name and chosen channel
        msg_login = await websocket.recv()

        if ':' not in msg_login:
            await websocket.send("Error: Message format incorrect. Please use 'user:channel'.")
            return

        name, channel_name = msg_login.split(':', 1)

        if not IDENT_RE.match(name) or not IDENT_RE.match(channel_name):
            await websocket.send("Error: Username and channel must be alphanumeric (max 32 chars).")
            return

        # Acquire per-channel lock to prevent race condition on username uniqueness
        lock = get_channel_lock(channel_name)
        async with lock:
            if any(name == val for val in (names[m] for m in channels.get(channel_name, []))):
                await websocket.send(f">User {name} already exists in {channel_name}")
                return
            names[websocket] = name
            if channel_name not in channels:
                channels[channel_name] = set()
            channels[channel_name].add(websocket)

        log.info("JOIN %s in %s (channel now %d clients)", name, channel_name, len(channels[channel_name]))
        msg = f"{name} has recently joined in {channel_name}"
        await broadcast(msg, channel_name)

        async for message in websocket:
            await broadcast(message, channel_name, names[websocket] + ": ")

    except websockets.ConnectionClosed as e:
        log.info("Client %s disconnected: %s", remote_address, e)

    finally:
        # Unregister client
        if websocket in clients:
            clients.remove(websocket)
        if websocket in names:
            names_removed = names[websocket]
            msg = f"!{names_removed}"
            del names[websocket]
            for channel, members in list(channels.items()):
                if websocket in members:
                    members.remove(websocket)
                    log.info("LEAVE %s from %s (channel now %d clients)", names_removed, channel, len(members))
                    if members:
                        await broadcast(msg, channel)
                    else:
                        del channels[channel]
                        if channel in channel_locks:
                            del channel_locks[channel]


async def broadcast(message: str, channel_name: str, prefix: str = ""):
    to_remove = set()
    for client in channels.get(channel_name, []):
        start = time.monotonic()
        try:
            await client.send(prefix + message)
        except websockets.ConnectionClosed:
            to_remove.add(client)
            continue
        elapsed = time.monotonic() - start
        if elapsed > SLOW_SEND_SECONDS:
            log.warning("SLOW send to %s took %.1fs in channel %s", names.get(client), elapsed, channel_name)
    if to_remove:
        channels[channel_name].difference_update(to_remove)
        if not channels[channel_name]:
            del channels[channel_name]


async def main():
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain('cert.pem', 'key.pem')

    async with websockets.serve(
        handle_clients, "0.0.0.0", 8080,
        ssl=ssl_context,
        max_size=MAX_MESSAGE_SIZE
    ):
        log.info("Server listening on port 8080...")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
