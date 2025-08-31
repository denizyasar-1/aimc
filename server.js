// server.js
// Render uyumlu mini voxel multiplayer server
// Render "Web Service" olarak deploy edilecekse "PORT" Render tarafından atanacak.
// Public klasörünü "public" içinde barındırıyoruz.

import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Public dosyaları servis et
app.use(express.static(path.join(__dirname, "public")));

// HTTP sunucusunu oluştur
const server = app.listen(PORT, () => {
  console.log(`Voxel MP server running at http://localhost:${PORT}`);
});

// WebSocket sunucusu
const wss = new WebSocketServer({ server });

// Dünya verisi: bloklar ve oyuncular
const blocks = new Map();
const players = new Map();

// Basit düz dünya üret (32x32)
for (let x = -16; x < 16; x++) {
  for (let z = -16; z < 16; z++) {
    blocks.set(`${x},0,${z}`, { type: 1 });
  }
}

// Broadcast helper
function broadcast(obj, exceptId = null) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.playerId !== exceptId) {
      client.send(msg);
    }
  }
}

// WebSocket bağlantı yönetimi
wss.on("connection", (ws) => {
  const id = uuidv4();
  ws.playerId = id;

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.t) {
      case "join": {
        const name = (msg.name || "Player").slice(0, 16);
        const p = { id, name, x: 0, y: 2, z: 0, ry: 0 };
        players.set(id, p);

        // Hoş geldin mesajı ve dünya snapshot'ı
        ws.send(
          JSON.stringify({
            t: "welcome",
            id,
            players: Array.from(players.values()),
            blocks: Array.from(blocks.entries()),
          })
        );

        broadcast({ t: "player_join", p }, id);
        break;
      }

      case "move": {
        const p = players.get(id);
        if (!p) return;

        // Konum değerlerini sınırla
        p.x = Math.max(-128, Math.min(128, msg.x));
        p.y = Math.max(-16, Math.min(64, msg.y));
        p.z = Math.max(-128, Math.min(128, msg.z));
        p.ry = msg.ry || 0;

        broadcast(
          { t: "player_move", id, x: p.x, y: p.y, z: p.z, ry: p.ry },
          id
        );
        break;
      }

      case "place": {
        const key = `${msg.x},${msg.y},${msg.z}`;
        if (!blocks.has(key)) {
          blocks.set(key, { type: msg.type | 0 });
          broadcast({ t: "block_set", x: msg.x, y: msg.y, z: msg.z, type: msg.type | 0 });
        }
        break;
      }

      case "remove": {
        const key = `${msg.x},${msg.y},${msg.z}`;
        if (blocks.has(key)) {
          blocks.delete(key);
          broadcast({ t: "block_del", x: msg.x, y: msg.y, z: msg.z });
        }
        break;
      }

      case "chat": {
        const p = players.get(id);
        if (!p) return;
        const text = String(msg.text || "").slice(0, 140);
        broadcast({ t: "chat", id, name: p.name, text });
        break;
      }
    }
  });

  ws.on("close", () => {
    const had = players.get(id);
    players.delete(id);
    if (had) broadcast({ t: "player_leave", id });
  });
});
