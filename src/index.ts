import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let rooms = {
  room1: { players: [], maxPlayers: 4 },
  room2: { players: [], maxPlayers: 4 },
};

wss.on('connection', (ws) => {
  let roomId: string | undefined;

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    if (data.type === 'join') {
      roomId = data.roomId;
      if (rooms[roomId].players.length < rooms[roomId].maxPlayers) {
        const playerId = rooms[roomId].players.length + 1;
        rooms[roomId].players.push({ id: ws, playerId });
        ws.send(JSON.stringify({ type: 'joined', playerId }));
        updateRoomState(roomId);
      } else {
        ws.send(JSON.stringify({ type: 'full' }));
      }
    } else if (data.type === 'chat') {
      broadcastToRoom(
        roomId!,
        JSON.stringify({ type: 'chat', message: data.message }),
      );
    }
  });

  ws.on('close', () => {
    if (roomId) {
      rooms[roomId].players = rooms[roomId].players.filter((p) => p.id !== ws);
      updateRoomState(roomId);
    }
  });
});

function updateRoomState(roomId: string) {
  const roomState = {
    type: 'roomState',
    players: rooms[roomId].players.length,
    maxPlayers: rooms[roomId].maxPlayers,
  };
  broadcastToRoom(roomId, JSON.stringify(roomState));
}

function broadcastToRoom(roomId: string, message: string) {
  rooms[roomId].players.forEach((player) => {
    player.id.send(message);
  });
}

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
