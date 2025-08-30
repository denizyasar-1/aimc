const socket = io();
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");


let players = {};
let myId = null;
let speed = 4;
let keys = {};


socket.on("connect", () => {
myId = socket.id;
});


socket.on("updatePlayers", (serverPlayers) => {
players = serverPlayers;
});


window.addEventListener("keydown", (e) => keys[e.key] = true);
window.addEventListener("keyup", (e) => keys[e.key] = false);


canvas.addEventListener("mousedown", () => {
socket.emit("attack");
});


function drawHeart(x, y, hp) {
ctx.fillStyle = "red";
for (let i = 0; i < hp / 2; i++) {
ctx.beginPath();
ctx.arc(x + i * 15, y, 5, 0, Math.PI * 2);
ctx.fill();
}
}


function gameLoop() {
ctx.clearRect(0, 0, canvas.width, canvas.height);


if (myId && players[myId]) {
if (keys["w"]) players[myId].y -= speed;
if (keys["s"]) players[myId].y += speed;
if (keys["a"]) players[myId].x -= speed;
if (keys["d"]) players[myId].x += speed;


socket.emit("move", { x: players[myId].x, y: players[myId].y });
}


for (let id in players) {
const p = players[id];
const isMe = id === myId;


// Oyuncu görünümü
ctx.fillStyle = isMe ? "#00ff88" : "#3498db";
ctx.beginPath();
ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
ctx.fill();


// Kılıç saldırı efekti
if (p.attacking) {
ctx.strokeStyle = "#ff0000";
ctx.lineWidth = 3;
ctx.beginPath();
ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
ctx.stroke();
}


// Can göstergesi (kalpler)
drawHeart(p.x - 20, p.y - 30, p.hp);
}


requestAnimationFrame(gameLoop);
}


gameLoop();
