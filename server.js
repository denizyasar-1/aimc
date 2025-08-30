// ===================== server.js =====================
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const server = http.createServer(app);
const io = socketIo(server);


app.use(express.static(path.join(__dirname, "public")));


const players = {};


io.on("connection", (socket) => {
console.log(`Yeni oyuncu bağlandı: ${socket.id}`);


players[socket.id] = {
x: Math.random() * 800,
y: Math.random() * 600,
hp: 20, // 10 kalp = 20 HP
attacking: false,
};


io.emit("updatePlayers", players);


socket.on("move", (data) => {
if (players[socket.id]) {
players[socket.id].x = data.x;
players[socket.id].y = data.y;
io.emit("updatePlayers", players);
}
});


socket.on("attack", () => {
if (!players[socket.id]) return;
players[socket.id].attacking = true;
io.emit("updatePlayers", players);


// Yakındaki oyunculara hasar uygula
for (let id in players) {
if (id !== socket.id) {
const dx = players[id].x - players[socket.id].x;
const dy = players[id].y - players[socket.id].y;
const dist = Math.sqrt(dx * dx + dy * dy);
if (dist < 60) {
players[id].hp -= 6; // 3 kalp = 6 HP
if (players[id].hp <= 0) {
// Respawn
players[id].x = Math.random() * 800;
players[id].y = Math.random() * 600;
players[id].hp = 20;
}
}
}
}


setTimeout(() => {
if (players[socket.id]) {
players[socket.id].attacking = false;
io.emit("updatePlayers", players);
}
}, 300);
});


socket.on("disconnect", () => {
console.log(`Oyuncu ayrıldı: ${socket.id}`);
delete players[socket.id];
io.emit("updatePlayers", players);
});
});


server.listen(3000, () => console.log("Server çalışıyor: http://localhost:3000"));
