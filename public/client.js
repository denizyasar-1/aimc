
// Client for Mini Voxel Multiplayer
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js"; // used only until pointer lock engages

const ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host);
const me = { id: null, name: "", x:0, y:2, z:0, ry:0 };
let connected = false;

const nameInput = document.getElementById('name');
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !connected) {
    me.name = nameInput.value.trim() || "Player";
    ws.send(JSON.stringify({ t:'join', name: me.name }));
    connected = true;
    nameInput.disabled = true;
    nameInput.value = `Bağlanıldı: ${me.name}`;
  }
});

function chatPush(text) {
  const div = document.createElement('div');
  div.className = 'msg';
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    ws.send(JSON.stringify({ t:'chat', text: chatInput.value.trim() }));
    chatInput.value = '';
  }
});

// ---- Three.js Setup ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222233);
const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1000);
camera.position.set(0, 2, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x333366, 1.0);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(5,10,2);
scene.add(dir);

// Controls until pointer lock
const orbit = new OrbitControls(camera, renderer.domElement);

// Voxel materials
const palette = {
  1: new THREE.MeshStandardMaterial({ color: 0x55aa55 }),
  2: new THREE.MeshStandardMaterial({ color: 0x888888 }),
};
let currentType = 1;
window.addEventListener('keydown', (e) => {
  if (e.key === '1') currentType = 1;
  if (e.key === '2') currentType = 2;
});

// Block storage
const blockGeo = new THREE.BoxGeometry(1,1,1);
const blocks = new Map(); // key -> mesh

function keyOf(x,y,z){ return `${x},${y},${z}`; }

function addBlock(x,y,z,type){
  const m = new THREE.Mesh(blockGeo, palette[type] || palette[1]);
  m.position.set(x+0.5, y+0.5, z+0.5);
  m.receiveShadow = m.castShadow = true;
  scene.add(m);
  blocks.set(keyOf(x,y,z), m);
}

function delBlock(x,y,z){
  const k = keyOf(x,y,z);
  const m = blocks.get(k);
  if (m) {
    scene.remove(m);
    m.geometry.dispose();
    // keep material (shared)
    blocks.delete(k);
  }
}

// Basic player representation
const otherPlayers = new Map(); // id -> {mesh, name, label}
const playerGeo = new THREE.BoxGeometry(0.6, 1.8, 0.6);
const playerMat = new THREE.MeshStandardMaterial({ color: 0x66aaff });

function upsertPlayer(p){
  let h = otherPlayers.get(p.id);
  if (!h) {
    const mesh = new THREE.Mesh(playerGeo, playerMat);
    mesh.position.set(p.x, p.y, p.z);
    scene.add(mesh);
    const nameSprite = makeNameSprite(p.name);
    mesh.add(nameSprite);
    nameSprite.position.y = 1.2;
    h = { mesh, nameSprite };
    otherPlayers.set(p.id, h);
  }
  h.mesh.position.set(p.x, p.y, p.z);
  h.mesh.rotation.y = p.ry || 0;
}

function removePlayer(id){
  const h = otherPlayers.get(id);
  if (h) {
    scene.remove(h.mesh);
    otherPlayers.delete(id);
  }
}

function makeNameSprite(text){
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0,0,256,64);
  ctx.fillStyle = '#fff';
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(1.5, 0.4, 1);
  return spr;
}

// Pointer lock for FPS movement
let pointerLocked = false;
document.body.addEventListener('click', () => {
  if (!pointerLocked) {
    renderer.domElement.requestPointerLock();
  }
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = (document.pointerLockElement === renderer.domElement);
  orbit.enabled = !pointerLocked;
});

let yaw = 0, pitch = 0;
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  const sens = 0.0025;
  yaw -= e.movementX * sens;
  pitch -= e.movementY * sens;
  pitch = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, pitch));
});

// Movement & physics
const keys = new Set();
document.addEventListener('keydown', e => keys.add(e.code));
document.addEventListener('keyup', e => keys.delete(e.code));
let velY = 0;
const gravity = -20;
let canJump = false;

function isSolid(x,y,z){
  return blocks.has(keyOf(Math.floor(x), Math.floor(y), Math.floor(z)));
}

function physics(dt){
  // forward vector from yaw
  const speed = 5;
  const dir = new THREE.Vector3();
  if (keys.has('KeyW')) dir.z -= 1;
  if (keys.has('KeyS')) dir.z += 1;
  if (keys.has('KeyA')) dir.x -= 1;
  if (keys.has('KeyD')) dir.x += 1;
  dir.normalize();

  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const moveX = (dir.x * cos - dir.z * sin) * speed * dt;
  const moveZ = (dir.x * sin + dir.z * cos) * speed * dt;

  // apply gravity & jump
  velY += gravity * dt;
  if (keys.has('Space') && canJump) {
    velY = 7;
    canJump = false;
  }

  let nx = me.x + moveX;
  let nz = me.z + moveZ;
  let ny = me.y + velY*dt;

  // simple collision: check feet and head
  const feetY = ny;
  const headY = ny + 1.7;
  if (isSolid(nx, feetY, nz) || isSolid(nx, headY, nz)) {
    // cancel horizontal if hit
    nx = me.x;
    nz = me.z;
  }
  // ground collision
  if (isSolid(nx, feetY-0.1, nz)) {
    // landed
    canJump = true;
    velY = 0;
    ny = Math.ceil(feetY) + 0.01;
  }

  me.x = nx; me.y = ny; me.z = nz;
  me.ry = yaw;
}

// Raycasting for block interact
const raycaster = new THREE.Raycaster();
let highlight;
function updateTargetBlock(place=false, remove=false){
  // cast from camera
  raycaster.set(camera.position, getForwardVector());
  const intersects = [];
  // Check against existing block meshes
  for (const [k, m] of blocks) {
    const hit = raycaster.intersectObject(m, false)[0];
    if (hit) intersects.push({ hit, k });
  }
  if (intersects.length === 0) { if (highlight) highlight.visible=false; return; }
  intersects.sort((a,b)=>a.hit.distance-b.hit.distance);
  const { point, face } = intersects[0].hit;
  const normal = face?.normal || new THREE.Vector3(0,1,0);
  const bx = Math.floor(point.x);
  const by = Math.floor(point.y);
  const bz = Math.floor(point.z);

  // show highlight cube
  if (!highlight){
    const geo = new THREE.BoxGeometry(1.01,1.01,1.01);
    const mat = new THREE.MeshBasicMaterial({ wireframe:true });
    highlight = new THREE.Mesh(geo, mat);
    scene.add(highlight);
  }
  highlight.visible = true;
  highlight.position.set(bx+0.5, by+0.5, bz+0.5);

  if (remove) {
    ws.send(JSON.stringify({ t:'remove', x:bx, y:by, z:bz }));
  } else if (place) {
    const px = bx + normal.x;
    const py = by + normal.y;
    const pz = bz + normal.z;
    ws.send(JSON.stringify({ t:'place', x:px|0, y:py|0, z:pz|0, type: currentType }));
  }
}

function getForwardVector(){
  const v = new THREE.Vector3(0,0,-1);
  v.applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
  v.applyAxisAngle(new THREE.Vector3(1,0,0), pitch);
  return v.normalize();
}

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) updateTargetBlock(false, true); // left remove
  if (e.button === 2) updateTargetBlock(true, false); // right place
});
window.addEventListener('contextmenu', e => e.preventDefault());

// Resize
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// WS events
ws.addEventListener('open', () => {
  chatPush("Sunucuya bağlanıldı. İsmini yazıp Enter'a bas.");
});
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  switch (msg.t) {
    case 'welcome': {
      me.id = msg.id;
      chatPush("Hoş geldin! Oyuncu sayısı: " + msg.players.length);
      // world
      for (const [k, val] of msg.blocks) {
        const [x,y,z] = k.split(',').map(Number);
        addBlock(x,y,z,val.type);
      }
      // players
      for (const p of msg.players) if (p.id !== me.id) upsertPlayer(p);
      break;
    }
    case 'player_join': {
      chatPush(`${msg.p.name} oyuna katıldı.`);
      upsertPlayer(msg.p);
      break;
    }
    case 'player_leave': {
      removePlayer(msg.id);
      break;
    }
    case 'player_move': {
      if (msg.id !== me.id) {
        upsertPlayer({ id: msg.id, x: msg.x, y: msg.y, z: msg.z, ry: msg.ry });
      }
      break;
    }
    case 'block_set': addBlock(msg.x,msg.y,msg.z,msg.type); break;
    case 'block_del': delBlock(msg.x,msg.y,msg.z); break;
    case 'chat': chatPush(`${msg.name}: ${msg.text}`); break;
  }
});

// Main loop
let last = performance.now();
function loop(){
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;

  if (pointerLocked) {
    physics(dt);
    const eye = new THREE.Vector3(0,1.6,0);
    const forward = getForwardVector();
    const camPos = new THREE.Vector3(me.x, me.y, me.z).add(eye);
    camera.position.copy(camPos);
    // construct camera orientation from yaw/pitch
    const target = camPos.clone().add(forward);
    camera.lookAt(target);
    // send motion occasionally
    sendMoveThrottled();
  }

  renderer.render(scene, camera);
}
loop();

// Throttle move updates
let lastMoveSent = 0;
function sendMoveThrottled(){
  const t = performance.now();
  if (t - lastMoveSent > 50) {
    lastMoveSent = t;
    ws.send(JSON.stringify({ t:'move', x:me.x, y:me.y, z:me.z, ry: me.ry }));
  }
}
