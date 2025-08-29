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
  cors: { origin: "*" }
});

// Statik dosyaları sun
app.use(express.static(path.join(__dirname, "public"))); // index.html burada olmalı

// Socket.io olayları
io.on("connection", (socket) => {
  console.log("Yeni oyuncu bağlandı:", socket.id);

  socket.on("join", (playerData) => {
    socket.broadcast.emit("playerJoined", playerData);
  });

  socket.on("move", (playerData) => {
    socket.broadcast.emit("playerMoved", playerData);
  });

  socket.on("blockAction", (blockData) => {
    socket.broadcast.emit("blockUpdate", blockData);
  });

  socket.on("disconnect", () => {
    io.emit("playerLeft", { id: socket.id });
  });
});

// Render PORT ortam değişkeni kullanılır
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor...`));


