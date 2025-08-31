
// Simple voxel multiplayer server (WebSocket)
// Run: npm install && npm run start
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from /public with a tiny static server
const mime = {
  ".html":"text/html",
  ".js":"text/javascript",
  ".css":"text/css",
  ".json":"application/json",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".gif":"image/gif",
  ".ico":"image/x-icon",
  ".wasm":"application/wasm"
};

const httpServer = createServer((req,res) => {
  let urlPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(__dirname, "public", urlPath);
  try {
    if (existsSync(filePath)) {
      const ext = path.extname(filePath);
      res.writeHead(200, {"Content-Type": mime[ext] || "text/plain"});
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  } catch (e) {
    res.writeHead(500);
    res.end("Server error");
  }
});

const wss = new WebSocketServer({ server: httpServer });

// ----- World State -----
// Store blocks in a Map keyed by "x,y,z" -> {type: number}
const blocks = new Map();
// Seed a flat ground (y=0) 32x32
for (let x=-16; x<16; x++) {
  for (let z=-16; z<16; z++) {
    blocks.set(`${x},0,${z}`, { type: 1 });
  }
}

// Players: id -> {id, name, x,y,z, ry}
const players = new Map();

function broadcast(obj, exceptId = null) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.playerId !== exceptId) {
      client.send(msg);
    }
  }
}

wss.on('connection', (ws) => {
  const id = uuidv4();
  ws.playerId = id;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    switch (msg.t) {
      case 'join': {
        const name = (msg.name || "Player").slice(0,16);
        // spawn position
        const p = { id, name, x: 0, y: 2, z: 0, ry: 0 };
        players.set(id, p);
        // send snapshot
        ws.send(JSON.stringify({ t:'welcome', id, players: Array.from(players.values()), blocks: Array.from(blocks.entries()) }));
        // notify others
        broadcast({ t:'player_join', p }, id);
        break;
      }
      case 'move': {
        const p = players.get(id);
        if (!p) return;
        // minimal trust server; clamp values
        p.x = Math.max(-128, Math.min(128, msg.x));
        p.y = Math.max(-16,  Math.min(64,  msg.y));
        p.z = Math.max(-128, Math.min(128, msg.z));
        p.ry = msg.ry || 0;
        broadcast({ t:'player_move', id, x:p.x, y:p.y, z:p.z, ry:p.ry }, id);
        break;
      }
      case 'place': {
        // {t:'place', x,y,z,type}
        const key = `${msg.x},${msg.y},${msg.z}`;
        if (!blocks.has(key)) {
          blocks.set(key, { type: msg.type|0 });
          broadcast({ t:'block_set', x:msg.x, y:msg.y, z:msg.z, type: msg.type|0 });
        }
        break;
      }
      case 'remove': {
        const key = `${msg.x},${msg.y},${msg.z}`;
        if (blocks.has(key)) {
          blocks.delete(key);
          broadcast({ t:'block_del', x:msg.x, y:msg.y, z:msg.z });
        }
        break;
      }
      case 'chat': {
        const p = players.get(id);
        if (!p) return;
        const text = String(msg.text||"").slice(0,140);
        broadcast({ t:'chat', id, name: p.name, text });
        break;
      }
    }
  });

  ws.on('close', () => {
    const had = players.get(id);
    players.delete(id);
    if (had) broadcast({ t:'player_leave', id });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Voxel MP server running at http://localhost:${PORT}`);
});
