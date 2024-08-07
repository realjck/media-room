import asyncio
import websockets
import ssl
from websockets import WebSocketServerProtocol
from typing import Set, Dict

clients: Set[WebSocketServerProtocol] = set()
channels: Dict[str, Set[WebSocketServerProtocol]] = {}
names: Dict[WebSocketServerProtocol, str] = {}


async def handle_clients(websocket: WebSocketServerProtocol):
    clients.add(websocket)
    try:
        # Receive client's name and chosen channel
        msg_login = await websocket.recv()

        if ':' not in msg_login or msg_login.count(':') != 1:
            error_message = "Error: Message format incorrect. Please use 'user:channel'."
            await websocket.send(error_message)
        else:
            name, channel_name = msg_login.split(':')

            # check if there's not another user with same name in the channel:
            if not any(name == val for val in (names[member] for member in channels.get(channel_name, []))):
                names[websocket] = name
                if channel_name not in channels:
                    channels[channel_name] = set()
                channels[channel_name].add(websocket)

                msg = f"{name} has recently joined in {channel_name}"
                await broadcast(msg, channel_name)

                async for message in websocket:
                    await broadcast(message, channel_name, names[websocket] + ": ")

            else:
                error_message = f">User {name} already exists in {channel_name}"
                await websocket.send(error_message)

    except websockets.ConnectionClosed as e:
        print(f"Client {websocket.remote_address} disconnected: {e}")

    finally:
        # Unregister client
        if websocket in clients:
            clients.remove(websocket)
        if websocket in names:
            msg = f"!{names[websocket]}"
            del names[websocket]
            for channel, members in list(channels.items()):
                if websocket in members:
                    members.remove(websocket)
                    if members:  # Check if the channel still has members
                        await broadcast(msg, channel)
                    else:
                        del channels[channel]  # Remove empty channel


async def broadcast(message: str, channel_name: str, prefix: str = ""):
    to_remove = set()
    for client in channels.get(channel_name, []):
        try:
            await client.send(prefix + message)
        except websockets.ConnectionClosed:
            to_remove.add(client)
    if to_remove:
        channels[channel_name].difference_update(to_remove)
        # Remove channel if it's empty
        if not channels[channel_name]:
            del channels[channel_name]


async def main():
    # Créer un contexte SSL
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain('cert.pem', 'key.pem')

    async with websockets.serve(handle_clients, "0.0.0.0", 8080, ssl=ssl_context):
        print("Server listening on port 8080...")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
