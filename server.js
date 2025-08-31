// Basit multiplayer sunucu: Express statik dosya sunar + WebSocket (ws) oyuncu pozisyonları ve blok olaylarını broadcast eder.
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');


const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


const PORT = process.env.PORT || 3000;


app.use(express.static(path.join(__dirname, 'public')));


// Basit in-memory world (küçük): set of placed blocks
const world = {
// key: "x,y,z" -> {type}
blocks: {},
};


// Players state: id -> {x,y,z,rot,inventory}
const players = {};


function broadcastJSON(obj, except) {
const msg = JSON.stringify(obj);
wss.clients.forEach((c) => {
if (c.readyState === WebSocket.OPEN && c !== except) c.send(msg);
});
}


wss.on('connection', (ws) => {
// assign id
const id = Math.random().toString(36).slice(2, 9);
players[id] = { x: 0, y: 5, z: 0, rot: 0, inventory: {}, id };


// send initial state
ws.send(JSON.stringify({ type: 'init', id, players, world }));


// notify others
broadcastJSON({ type: 'player_join', player: players[id] }, ws);


ws.on('message', (raw) => {
let msg;
try { msg = JSON.parse(raw); } catch(e) { return; }
switch(msg.type) {
case 'update_state':
if (!players[id]) return;
players[id].x = msg.x; players[id].y = msg.y; players[id].z = msg.z; players[id].rot = msg.rot;
broadcastJSON({ type: 'player_update', id, x: msg.x, y: msg.y, z: msg.z, rot: msg.rot }, ws);
break;
case 'place_block':
{
const key = `${msg.x},${msg.y},${msg.z}`;
world.blocks[key] = { type: msg.blockType };
broadcastJSON({ type: 'place_block', x: msg.x, y: msg.y, z: msg.z, blockType: msg.blockType });
}
break;
case 'remove_block':
{
const key = `${msg.x},${msg.y},${msg.z}`;
delete world.blocks[key];
broadcastJSON({ type: 'remove_block', x: msg.x, y: msg.y, z: msg.z });
}
