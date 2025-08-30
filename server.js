import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Public klasörünü servis et
app.use(express.static(path.join(__dirname, "public")));

// Oyuncuların durumlarını saklayacağımız yapı
const players = new Map(); // id -> { id, x, y, hp, attacking }

// Rastgele başlangıç pozisyonu
function randomSpawn() {
  return {
    x: Math.random() * 800,
    y: Math.random() * 600,
  };
}

io.on("connection", (socket) => {
  console.log("Yeni oyuncu bağlandı:", socket.id);

  // Yeni oyuncuyu listeye ekle
  const spawn = randomSpawn();
  players.set(socket.id, {
    id: socket.id,
    x: spawn.x,
    y: spawn.y,
    hp: 10, // 10 kalp
    attacking: false,
  });

  // Tüm oyunculara güncel listeyi gönder
  io.emit("updatePlayers", Array.from(players.values()));

  // Hareket verilerini al
  socket.on("move", ({ x, y }) => {
    const player = players.get(socket.id);
    if (!player) return;
    player.x = x;
    player.y = y;

    // Güncel oyuncu durumunu tüm istemcilere gönder
    io.emit("updatePlayers", Array.from(players.values()));
  });

  // Saldırı olayı
  socket.on("attack", (targetId) => {
    const attacker = players.get(socket.id);
    const target = players.get(targetId);
    if (!attacker || !target) return;

    // Saldırı menzili kontrolü (60 px)
    const dx = attacker.x - target.x;
    const dy = attacker.y - target.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 60) return;

    // Hedefin canını düşür
    target.hp -= 3; // 3 kalp hasar
    if (target.hp <= 0) {
      // Respawn noktası
      const respawn = randomSpawn();
      target.x = respawn.x;
      target.y = respawn.y;
      target.hp = 10;
      io.to(target.id).emit("respawn", {
        x: target.x,
        y: target.y,
        hp: target.hp,
      });
    }

    // Güncellenmiş bilgileri herkese gönder
    io.emit("updatePlayers", Array.from(players.values()));
  });

  // Oyuncu ayrıldığında listeden çıkar
  socket.on("disconnect", () => {
    players.delete(socket.id);
    io.emit("updatePlayers", Array.from(players.values()));
    console.log("Oyuncu ayrıldı:", socket.id);
  });
});

// PORT ayarı
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Server ${PORT} portunda çalışıyor...`)
);


