import * as THREE from 'three';
import { CHARACTERS, selectCharacter } from './characters.js';
import { Economy } from './economy.js';
import { MISSIONS } from './missions.js';
import { getKimiResponse } from './kimi.js';

class Game {
  constructor() {
    this.economy = new Economy();
    this.character = null;
    this.selectedId = null;
    this.keys = {};
    this.missionMarkers = [];
    this.nearbyMission = null;
    this.clock = new THREE.Clock();

    this.initUI();
    this.initCharacterSelect();

    setTimeout(() => {
      document.getElementById('loading').classList.add('hidden');
      const sel = document.getElementById('character-select');
      sel.classList.remove('hidden');
      sel.classList.add('flex');
    }, 900);
  }

  initUI() {
    document.getElementById('confirm-char').onclick = () => this.startGame();

    document.getElementById('btn-kimi').onclick   = () => this.togglePanel('kimi-panel');
    document.getElementById('btn-wallet').onclick = () => this.togglePanel('wallet-panel');
    document.getElementById('close-kimi').onclick   = () => this.togglePanel('kimi-panel', false);
    document.getElementById('close-wallet').onclick = () => this.togglePanel('wallet-panel', false);

    document.getElementById('kimi-send').onclick = () => this.sendKimiMessage();
    document.getElementById('kimi-input').onkeydown = e => { if (e.key === 'Enter') this.sendKimiMessage(); };
    document.getElementById('withdraw-btn').onclick = () => this.requestWithdrawal();

    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (k === 'e' && this.nearbyMission) this.completeMission(this.nearbyMission);
    });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('resize', () => this.onResize());
  }

  initCharacterSelect() {
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';
    Object.values(CHARACTERS).forEach(char => {
      const card = document.createElement('div');
      card.className = 'char-card glass rounded-2xl p-6 flex flex-col';
      card.dataset.id = char.id;
      card.innerHTML = `
        <div class="w-full h-40 rounded-lg mb-4 flex items-center justify-center"
             style="background: radial-gradient(circle, ${char.color}44, transparent 70%);">
          <div class="w-24 h-24 rounded-full" style="background:${char.color}; box-shadow:0 0 60px ${char.color}88;"></div>
        </div>
        <h3 class="font-display text-2xl mb-2" style="color:${char.color};">${char.name}</h3>
        <p class="text-cyan-200 text-sm flex-grow">${char.description}</p>
        <div class="mt-4 text-[10px] text-cyan-400 tracking-widest">PASSIVE · ${char.passive}</div>
      `;
      card.onclick = () => this.pickCharacter(char.id, card);
      grid.appendChild(card);
    });
  }

  pickCharacter(id, card) {
    this.selectedId = id;
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    document.getElementById('confirm-char').disabled = false;
  }

  startGame() {
    if (!this.selectedId) return;
    this.character = selectCharacter(this.selectedId);

    const sel = document.getElementById('character-select');
    sel.classList.add('hidden');
    sel.classList.remove('flex');

    document.getElementById('game').classList.remove('hidden');
    document.getElementById('hud-char').textContent = this.character.name;
    this.updateMoneyUI();

    this.initThree();
    this.buildWorld();
    this.spawnPlayer();
    this.spawnMissionMarkers();
    this.animate();
  }

  initThree() {
    const canvas = document.getElementById('scene-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x05070d);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x05070d, 40, 180);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(0, 10, 16);

    this.scene.add(new THREE.HemisphereLight(0x00f0ff, 0x05070d, 0.6));
    const dir = new THREE.DirectionalLight(0xff00a0, 0.7);
    dir.position.set(30, 50, 20);
    this.scene.add(dir);
    this.scene.add(new THREE.AmbientLight(0x1a2330, 1.2));
  }

  buildWorld() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x0a1220, roughness: 0.9, metalness: 0.2 })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(400, 100, 0x00f0ff, 0x002233);
    grid.material.opacity = 0.4;
    grid.material.transparent = true;
    grid.position.y = 0.02;
    this.scene.add(grid);

    const city = new THREE.Group();
    for (let x = -80; x <= 80; x += 12) {
      for (let z = -80; z <= 80; z += 12) {
        if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
        if (Math.random() < 0.15) continue;

        const w = 4 + Math.random() * 4;
        const d = 4 + Math.random() * 4;
        const h = 8 + Math.random() * 40;
        const neon = Math.random() > 0.5 ? 0x00f0ff : 0xff00a0;

        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x0d1520,
          emissive: neon,
          emissiveIntensity: 0.05 + Math.random() * 0.1,
          roughness: 0.8,
          metalness: 0.4
        });
        const b = new THREE.Mesh(geo, mat);
        b.position.set(x + (Math.random() - 0.5) * 2, h / 2, z + (Math.random() - 0.5) * 2);

        const edges = new THREE.EdgesGeometry(geo);
        b.add(new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: neon, transparent: true, opacity: 0.55 })
        ));
        city.add(b);
      }
    }
    this.scene.add(city);

    for (let i = 0; i < 8; i++) {
      const pl = new THREE.PointLight(Math.random() > 0.5 ? 0x00f0ff : 0xff00a0, 1.5, 40);
      pl.position.set((Math.random() - 0.5) * 160, 15, (Math.random() - 0.5) * 160);
      this.scene.add(pl);
    }
  }

  spawnPlayer() {
    const mat = new THREE.MeshStandardMaterial({
      color: this.character.color,
      emissive: this.character.color,
      emissiveIntensity: 0.35,
      metalness: 0.5,
      roughness: 0.4
    });
    this.player = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 1.6, 8, 16), mat);
    this.player.position.set(0, 1.6, 0);
    this.scene.add(this.player);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.6, 32),
      new THREE.MeshBasicMaterial({ color: this.character.color, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.55;
    this.player.add(ring);
    this.playerRing = ring;
  }

  makeMarker(mission, x, z) {
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.2, 32),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 })
    );
    marker.position.set(x, 0.2, z);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 20, 8),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.15 })
    );
    beam.position.y = 10;
    marker.add(beam);

    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mission.title, 256, 42);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    sprite.scale.set(8, 1, 1);
    sprite.position.y = 4;
    marker.add(sprite);

    marker.userData.mission = mission;
    this.scene.add(marker);
    this.missionMarkers.push(marker);
  }

  spawnMissionMarkers() {
    const shuffled = [...MISSIONS].sort(() => Math.random() - 0.5).slice(0, 5);
    shuffled.forEach((m, i) => {
      const a = (i / 5) * Math.PI * 2;
      const d = 20 + Math.random() * 30;
      this.makeMarker(m, Math.cos(a) * d, Math.sin(a) * d);
    });
  }

  spawnSingleMission() {
    const m = MISSIONS[Math.floor(Math.random() * MISSIONS.length)];
    const a = Math.random() * Math.PI * 2;
    const d = 20 + Math.random() * 40;
    this.makeMarker(m, Math.cos(a) * d, Math.sin(a) * d);
  }

  completeMission(marker) {
    const m = marker.userData.mission;
    let payout = m.payout;
    if (this.character.bonus?.transportMultiplier && m.type === 'transport') {
      payout = Math.floor(payout * this.character.bonus.transportMultiplier);
    }
    this.economy.earn(payout, m.title);
    this.updateMoneyUI();

    this.scene.remove(marker);
    this.missionMarkers = this.missionMarkers.filter(x => x !== marker);
    this.nearbyMission = null;
    document.getElementById('prompt').classList.add('hidden');

    this.notify(`+${payout} Creds — ${m.title}`);
    setTimeout(() => this.spawnSingleMission(), 3000);
  }

  updateMoneyUI() {
    const s = this.economy.state.soft.toLocaleString();
    document.getElementById('hud-money').textContent = s;
    document.getElementById('wallet-creds').textContent = s;
    document.getElementById('wallet-tx').textContent = this.economy.state.transactions.length;
  }

  notify(msg) {
    const el = document.createElement('div');
    el.className = 'glass rounded-lg px-6 py-3 text-cyan-200 fade text-sm';
    el.textContent = msg;
    document.getElementById('notifications').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 2500);
  }

  togglePanel(id, show) {
    const otherId = id === 'kimi-panel' ? 'wallet-panel' : 'kimi-panel';
    document.getElementById(otherId).classList.add('hidden');
    const el = document.getElementById(id);
    if (show === false) { el.classList.add('hidden'); return; }
    el.classList.toggle('hidden');
  }

  sendKimiMessage() {
    const input = document.getElementById('kimi-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    const box = document.getElementById('kimi-messages');
    box.innerHTML += `<div class="text-cyan-500">You: ${msg}</div>`;
    box.scrollTop = box.scrollHeight;

    setTimeout(() => {
      const reply = getKimiResponse(msg, this.economy, this.character);
      box.innerHTML += `<div class="text-cyan-100 border-l-2 border-pink-400 pl-2">Kimi: ${reply}</div>`;
      box.scrollTop = box.scrollHeight;
    }, 350);
  }

  requestWithdrawal() {
    const amount = parseInt(document.getElementById('withdraw-amount').value);
    if (!amount || amount <= 0) { this.notify('Enter a valid amount'); return; }
    try {
      const res = this.economy.requestWithdrawal(amount);
      this.notify(res.message);
      this.updateMoneyUI();
      document.getElementById('wallet-log').innerHTML =
        `<div>${new Date().toLocaleTimeString()} — Requested ${amount} Creds</div>` +
        document.getElementById('wallet-log').innerHTML;
      document.getElementById('withdraw-amount').value = '';
    } catch (e) {
      this.notify(e.message);
    }
  }

  onResize() {
    if (!this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t  = this.clock.elapsedTime;

    this.updatePlayer(dt);
    this.updateCamera(dt);
    this.checkMissions();

    this.missionMarkers.forEach(m => {
      m.rotation.y += dt * 0.5;
      m.position.y = 0.2 + Math.sin(t * 2) * 0.1;
    });
    if (this.playerRing) this.playerRing.rotation.z += dt;

    this.renderer.render(this.scene, this.camera);
  }

  updatePlayer(dt) {
    if (!this.player) return;
    const speed = this.keys['shift'] ? 30 : 15;
    const move = new THREE.Vector3();
    if (this.keys['w']) move.z -= 1;
    if (this.keys['s']) move.z += 1;
    if (this.keys['a']) move.x -= 1;
    if (this.keys['d']) move.x += 1;
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      this.player.position.add(move);
      this.player.rotation.y = Math.atan2(move.x, move.z);
    }
    this.player.position.x = Math.max(-180, Math.min(180, this.player.position.x));
    this.player.position.z = Math.max(-180, Math.min(180, this.player.position.z));
  }

  updateCamera(dt) {
    if (!this.player) return;
    const target = this.player.position.clone().add(new THREE.Vector3(0, 8, 12));
    this.camera.position.lerp(target, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(this.player.position.clone().add(new THREE.Vector3(0, 1, 0)));
  }

  checkMissions() {
    if (!this.player) return;
    let nearest = null, minDist = 3;
    this.missionMarkers.forEach(m => {
      const d = this.player.position.distanceTo(m.position);
      if (d < minDist) { minDist = d; nearest = m; }
    });
    if (nearest !== this.nearbyMission) {
      this.nearbyMission = nearest;
      const prompt = document.getElementById('prompt');
      if (nearest) {
        document.getElementById('prompt-text').textContent = nearest.userData.mission.title;
        prompt.classList.remove('hidden');
      } else {
        prompt.classList.add('hidden');
      }
    }
  }
}

new Game();
