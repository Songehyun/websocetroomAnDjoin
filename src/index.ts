import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

type Player = { id: WebSocket; playerId: number };

type Rooms = {
  [key: string]: {
    players: Player[];
    maxPlayers: number;
    currentTurnPlayerId: number;
  };
};

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static('public'));

let rooms: Rooms = {
  room1: { players: [], maxPlayers: 4, currentTurnPlayerId: 1 },
  room2: { players: [], maxPlayers: 4, currentTurnPlayerId: 1 },
};

wss.on('connection', (ws: WebSocket) => {
  let roomId: string | undefined;

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    if (data.type === 'join') {
      roomId = data.roomId;
      if (roomId && rooms[roomId]) {
        if (rooms[roomId].players.length < rooms[roomId].maxPlayers) {
          const playerId = rooms[roomId].players.length + 1;
          rooms[roomId].players.push({ id: ws, playerId });
          ws.send(JSON.stringify({ type: 'joined', playerId }));
          updateRoomState();
        } else {
          // 방이 가득 찼을 때 클라이언트에 알림을 보냄
          ws.send(JSON.stringify({ type: 'roomFull' }));
        }
      }
    } else if (data.type === 'chat') {
      if (roomId) {
        const player = rooms[roomId].players.find((p) => p.id === ws);
        if (player) {
          broadcastToRoom(
            roomId,
            JSON.stringify({
              type: 'chat',
              message: `Player ${player.playerId}: ${data.message}`,
            }),
          );
        }
      }
    } else if (data.type === 'turn') {
      if (roomId && data.playerId === rooms[roomId].currentTurnPlayerId) {
        const totalPlayers = rooms[roomId].players.length;
        rooms[roomId].currentTurnPlayerId =
          (rooms[roomId].currentTurnPlayerId % totalPlayers) + 1;
        const message = `Player ${rooms[roomId].currentTurnPlayerId}의 차례입니다.`;
        broadcastToRoom(roomId, JSON.stringify({ type: 'chat', message }));
        broadcastToRoom(
          roomId,
          JSON.stringify({
            type: 'turnUpdate',
            currentTurnPlayerId: rooms[roomId].currentTurnPlayerId,
          }),
        );
      }
    }
  });

  ws.on('close', () => {
    if (roomId && rooms[roomId]) {
      rooms[roomId].players = rooms[roomId].players.filter((p) => p.id !== ws);
      updateRoomState();
    }
  });
});

function updateRoomState() {
  const roomState = {
    type: 'roomState',
    room1: {
      players: rooms.room1.players.length,
      maxPlayers: rooms.room1.maxPlayers,
    },
    room2: {
      players: rooms.room2.players.length,
      maxPlayers: rooms.room2.maxPlayers,
    },
  };
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(roomState));
    }
  });
}

function broadcastToRoom(roomId: string, message: string) {
  if (rooms[roomId]) {
    rooms[roomId].players.forEach((player) => {
      player.id.send(message);
    });
  }
}

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
