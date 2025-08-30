import express from 'express';
import http from 'http';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

// Statik dosyaları servis et
app.use(express.static(path.join(__dirname, 'public')));

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Oyuncuları saklamak için harita
const players = new Map();

io.on('connection', (socket) => {
  console.log('Yeni oyuncu bağlandı:', socket.id);
  
  // Oyuncu katıldığında
  socket.on('join', (data) => {
    const playerId = data.id;
    players.set(playerId, {
      id: playerId,
      username: data.username,
      x: data.x,
      y: data.y,
      z: data.z,
      yaw: data.yaw,
      pitch: data.pitch
    });
    
    // Diğer tüm oyunculara katılma mesajı gönder
    io.emit('playerJoined', {
      id: playerId,
      username: data.username,
      x: data.x,
      y: data.y,
      z: data.z,
      yaw: data.yaw,
      pitch: data.pitch
    });
    
    // Yeni oyuncuya mevcut tüm oyuncuları gönder
    players.forEach((playerData, playerId) => {
      if (playerId !== socket.id) {
        socket.emit('playerJoined', playerData);
      }
    });
  });
  
  // Oyuncu hareket ettiğinde
  socket.on('move', (data) => {
    const playerData = players.get(socket.id);
    if (playerData) {
      // Pozisyonu güncelle
      playerData.x = data.x;
      playerData.y = data.y;
      playerData.z = data.z;
      playerData.yaw = data.yaw;
      playerData.pitch = data.pitch;
      
      // Diğer tüm oyunculara hareket mesajı gönder
      io.emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y,
        z: data.z,
        yaw: data.yaw,
        pitch: data.pitch
      });
    }
  });
  
  // Oyuncu ayrıldığında
  socket.on('disconnect', () => {
    console.log('Oyuncu ayrıldı:', socket.id);
    players.delete(socket.id);
    io.emit('playerLeft', { id: socket.id });
  });
});

server.listen(3000, () => {
  console.log('Sunucu http://localhost:3000 adresinde çalışıyor.');
});
