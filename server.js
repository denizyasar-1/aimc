// ===================== server.js (Düzeltilmiş) =====================
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
// HATA 1 (Kritik): Socket.IO sunucusunu başlatırken "new" anahtar kelimesi eksikti.
// Bu, sunucunun hiç başlamamasına neden olan ana hataydı.
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const players = {};
const PLAYER_MAX_HP = 20;
const ATTACK_DAMAGE = 6;
const ATTACK_RADIUS = 60;
const ATTACK_DURATION = 300; // ms

io.on("connection", (socket) => {
  console.log(`Yeni oyuncu bağlandı: ${socket.id}`);

  players[socket.id] = {
    x: Math.random() * 800,
    y: Math.random() * 600,
    hp: PLAYER_MAX_HP,
    attacking: false,
  };

  // Tüm oyunculara güncel listeyi gönder
  io.emit("updatePlayers", players);

  socket.on("move", (data) => {
    // Oyuncunun var olup olmadığını kontrol et (güvenlik için iyi bir pratik)
    const player = players[socket.id];
    if (player) {
      player.x = data.x;
      player.y = data.y;
      io.emit("updatePlayers", players);
    }
  });

  socket.on("attack", () => {
    const attacker = players[socket.id];
    if (!attacker || attacker.attacking) return; // Oyuncu yoksa veya zaten saldırıyorsa işlemi iptal et

    attacker.attacking = true;
    io.emit("updatePlayers", players); // Saldırı animasyonunu başlatmak için anında gönder

    // Yakındaki oyunculara hasar uygula
    for (const id in players) {
      // Kendine hasar vermeyi engelle
      if (id === socket.id) continue;

      const target = players[id];
      const dx = target.x - attacker.x;
      const dy = target.y - attacker.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < ATTACK_RADIUS) {
        target.hp -= ATTACK_DAMAGE;
        if (target.hp <= 0) {
          // Oyuncu öldüğünde yeniden canlandır (respawn)
          target.x = Math.random() * 800;
          target.y = Math.random() * 600;
          target.hp = PLAYER_MAX_HP;
        }
      }
    }

    // MANTIK HATASI 2 (Önemli): Hasar verildikten sonra oyuncuların can değerleri
    // diğer oyunculara gönderilmiyordu. Bu yüzden kimse canının azaldığını göremezdi.
    // Bu satır, hasar sonrası güncel durumu herkese bildirir.
    io.emit("updatePlayers", players);


    // Saldırı durumunu belirli bir süre sonra bitir
    setTimeout(() => {
      // Oyuncu bu süre içinde oyundan ayrılmış olabilir, kontrol et
      if (players[socket.id]) {
        players[socket.id].attacking = false;
        io.emit("updatePlayers", players);
      }
    }, ATTACK_DURATION);
  });

  socket.on("disconnect", () => {
    console.log(`Oyuncu ayrıldı: ${socket.id}`);
    delete players[socket.id];
    io.emit("updatePlayers", players);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
});




