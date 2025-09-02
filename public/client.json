// Basit Three.js tabanlı voxel renderer + kontroller + WebSocket multiplayer + inventory & crafting (çok basit)
addEventListener('mousedown', (e)=>{
// ray from camera center
raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
const intersects = raycaster.intersectObjects(Object.values(voxels));
if(intersects.length){
const p = intersects[0].point;
const n = intersects[0].face.normal;
const target = { x: Math.floor(p.x + n.x), y: Math.floor(p.y + n.y), z: Math.floor(p.z + n.z) };
// place
addVoxel(target.x, target.y, target.z, 'dirt');
ws.send(JSON.stringify({ type:'place_block', x:target.x, y:target.y, z:target.z, blockType:'dirt' }));
}
});


// inventory & crafting (very minimal)
let inventory = { dirt: 20 };
function toggleInventory(){
const invEl = document.getElementById('inventory');
if(invEl.classList.contains('hidden')){
invEl.classList.remove('hidden');
invEl.innerText = JSON.stringify(inventory, null, 2);
} else {
invEl.classList.add('hidden');
}
ws.send(JSON.stringify({ type:'inventory_update', inventory }));
}


// game loop
let last = performance.now();
function loop(t){
const dt = (t-last)/1000; last = t;
updateControls(dt);
// send position updates periodically
if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({ type:'update_state', x:controls.pos.x, y:controls.pos.y, z:controls.pos.z, rot:controls.rot }));
renderer.render(scene, camera);
requestAnimationFrame(loop);
}
requestAnimationFrame(loop);


window.addEventListener('resize', ()=>{ renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); });

