import * as THREE from 'three';
import { CHARACTERS, selectCharacter } from './characters.js';
import { Economy } from './economy.js';
import { MISSIONS } from './missions.js';
import { askKimi } from './kimi.js';
import { VEHICLES, UPGRADES, Garage } from './vehicles.js';
import { WEAPONS, Arsenal } from './weapons.js';
import { PoliceChase } from './chase.js';
import { Joystick } from './joystick.js';

class Game {
  constructor() {
    this.economy  = new Economy();
    this.garage   = new Garage();
    this.arsenal  = new Arsenal();
    this.chase    = null;
    this.character = null;
    this.selectedId = null;
    this.keys = {};
    this.missionMarkers = [];
    this.vehicleObjs = [];
    this.nearbyMission = null;
    this.nearbyVehicle = null;
    this.isDriving = false;
    this.vehicle = null;
    this.clock = new THREE.Clock();
    this.velocity = new THREE.Vector3();
    this.mobileMove = { x: 0, y: 0 };
    this.lastShot = 0;
    this.lastChaseCheck = 0;

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
    ['kimi','wallet','garage','weapon'].forEach(id => {
      document.getElementById(`btn-${id}`).onclick = () => {
        if (id === 'garage') return this.openGarage();
        if (id === 'weapon') return this.openWeaponShop();
        this.togglePanel(`${id}-panel`);
      };
    });
    document.getElementById('close-kimi').onclick    = () => this.togglePanel('kimi-panel', false);
    document.getElementById('close-wallet').onclick  = () => this.togglePanel('wallet-panel', false);
    document.getElementById('close-garage').onclick  = () => document.getElementById('garage-panel').classList.add('hidden');
    document.getElementById('close-weapon').onclick  = () => document.getElementById('weapon-panel').classList.add('hidden');

    document.getElementById('kimi-send').onclick = () => this.sendKimiMessage();
    document.getElementById('kimi-input').onkeydown = e => { if (e.key === 'Enter') this.sendKimiMessage(); };
    document.getElementById('withdraw-btn').onclick = () => this.requestWithdrawal();

    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (k === 'e' && this.nearbyMission && !this.isDriving) this.completeMission(this.nearbyMission);
      if (k === 'f') this.toggleVehicle();
    });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('mousedown', e => { if (e.button === 0) this.shoot(); });

    // Mobile buttons
    document.getElementById('mobile-e').addEventListener('click', () => {
      if (this.nearbyMission) this.completeMission(this.nearbyMission);
    });
    document.getElementById('mobile-f').addEventListener('click', () => this.toggleVehicle());
    document.getElementById('mobile-fire').addEventListener('click', () => this.shoot());

    // Joystick
    this.joystick = new Joystick(document.getElementById('joystick'), v => { this.mobileMove = v; });
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
    document.getElementById('hud-weapon').textContent = this.arsenal.current().name;
    this.updateMoneyUI();

    this.initThree();
    this.buildWorld();
    this.spawnPlayer();
    this.spawnMissionMarkers();
    this.spawnVehicles();
    this.chase = new PoliceChase(this);
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
    grid.material.opacity = 0.4; grid.material.transparent = true;
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
          color: 0x0d1520, emissive: neon, emissiveIntensity: 0.05 + Math.random() * 0.1,
          roughness: 0.8, metalness: 0.4
        });
        const b = new THREE.Mesh(geo, mat);
        b.position.set(x + (Math.random() - 0.5) * 2, h / 2, z + (Math.random() - 0.5) * 2);
        b.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({ color: neon, transparent: true, opacity: 0.55 })));
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
      color: this.character.color, emissive: this.character.color,
      emissiveIntensity: 0.35, metalness: 0.5, roughness: 0.4
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
    const color = mission.type === 'heist' ? 0xff00a0 : 0x00f0ff;
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.2, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
    );
    marker.position.set(x, 0.2, z);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 20, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15 })
    );
    beam.position.y = 10;
    marker.add(beam);

    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#00f0ff'; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(mission.title, 256, 42);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    sprite.scale.set(8, 1, 1); sprite.position.y = 4;
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

  spawnVehicles() {
    const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25];
    angles.forEach((angle, i) => {
      const id = Object.keys(VEHICLES)[i];
      const vehicle = this.buildVehicleMesh(id);
      vehicle.position.set(Math.cos(angle) * 15, 0, Math.sin(angle) * 15);
      vehicle.userData.vehicleId = id;
      this.scene.add(vehicle);
      this.vehicleObjs.push(vehicle);
    });
  }

  buildVehicleMesh(id) {
    const v = VEHICLES[id];
    const group = new THREE.Group();
    const color = v.color;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.8, 4.2),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, metalness: 0.6, roughness: 0.3 })
    );
    body.position.y = 0.7;
    group.add(body);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.6, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x080a12, emissive: color, emissiveIntensity: 0.15, metalness: 0.7, roughness: 0.4 })
    );
    cabin.position.y = 1.4;
    group.add(cabin);

    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    [[-1.1,0.4,1.4],[1.1,0.4,1.4],[-1.1,0.4,-1.4],[1.1,0.4,-1.4]].forEach(([x,y,z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, y, z);
      group.add(w);
    });

    // headlights
    const head = new THREE.PointLight(color, 2, 15);
    head.position.set(0, 1, 2.2);
    group.add(head);

    return group;
  }

  toggleVehicle() {
    if (this.isDriving) {
      // exit
      this.isDriving = false;
      this.player.position.copy(this.vehicle.position).add(new THREE.Vector3(2, 1.6, 0));
      this.player.visible = true;
      this.vehicle = null;
      this.velocity.set(0, 0, 0);
      document.getElementById('crosshair').classList.add('hidden');
      this.notify('Exited vehicle');
    } else if (this.nearbyVehicle) {
      // enter
      this.isDriving = true;
      this.vehicle = this.nearbyVehicle;
      this.player.visible = false;
      this.velocity.set(0, 0, 0);
      if (this.arsenal.current().id !== 'fists') {
        document.getElementById('crosshair').classList.remove('hidden');
      }
      this.notify(`Entered ${VEHICLES[this.vehicle.userData.vehicleId].name}`);
    }
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

    // 35% chance of police chase after a mission
    if (Math.random() < 0.35 && !this.chase.active) {
      setTimeout(() => this.chase.start(1 + Math.floor(Math.random() * 2)), 1500);
    }
    setTimeout(() => this.spawnSingleMission(), 3000);
  }

  shoot() {
    if (this.isDriving || !this.arsenal.current || this.arsenal.current().id === 'fists') return;
    const now = performance.now();
    const weapon = this.arsenal.current();
    const cooldown = weapon.auto ? 150 : 350;
    if (now - this.lastShot < cooldown) return;
    this.lastShot = now;

    // muzzle flash
    const flash = new THREE.PointLight(0xffee88, 8, 6);
    flash.position.copy(this.player.position).add(new THREE.Vector3(0, 1, 0));
    this.scene.add(flash);
    setTimeout(() => this.scene.remove(flash), 60);

    const raycaster = new THREE.Raycaster();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    raycaster.set(this.camera.position, dir);
    raycaster.far = weapon.range;

    const targets = this.chase ? this.chase.cars : [];
    const hits = raycaster.intersectObjects(targets, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj.parent && !this.chase.cars.includes(obj)) obj = obj.parent;
      if (this.chase.cars.includes(obj)) {
        this.chase.damageCar(obj);
      }
    }
  }

  updateMoneyUI() {
    const s = this.economy.state.soft.toLocaleString();
    ['hud-money','wallet-creds','garage-creds','weapon-creds'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = s;
    });
    document.getElementById('wallet-tx').textContent = this.economy.state.transactions.length;
  }

  notify(msg) {
    const el = document.createElement('div');
    el.className = 'glass rounded-lg px-6 py-3 text-cyan-200 fade text-sm';
    el.textContent = msg;
    document.getElementById('notifications').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 2800);
  }

  togglePanel(id, show) {
    ['kimi-panel','wallet-panel'].forEach(other => {
      if (other !== id) document.getElementById(other).classList.add('hidden');
    });
    const el = document.getElementById(id);
    if (show === false) { el.classList.add('hidden'); return; }
    el.classList.toggle('hidden');
  }

  openGarage() {
    const list = document.getElementById('garage-list');
    list.innerHTML = '';
    Object.values(VEHICLES).forEach(v => {
      const owned = this.garage.owns(v.id);
      const stats = this.garage.getStats(v.id);
      const card = document.createElement('div');
      card.className = 'shop-card glass rounded-xl p-4';
      card.innerHTML = `
        <div class="w-full h-24 rounded-lg mb-3" style="background: radial-gradient(circle, ${'#'+v.color.toString(16).padStart(6,'0')}44, transparent 70%);"></div>
        <h3 class="font-display text-lg mb-1" style="color:#${v.color.toString(16).padStart(6,'0')}">${v.name}</h3>
        <p class="text-xs text-cyan-300 mb-3">${v.description}</p>
        <div class="text-[10px] text-cyan-400 space-y-1 mb-3">
          <div>SPEED: ${Math.round(stats.speed)}</div>
          <div>HANDLING: ${stats.handling.toFixed(1)}</div>
        </div>
        <button data-id="${v.id}" class="${owned ? 'bg-cyan-900/40 border-cyan-700' : 'bg-pink-500/20 border-pink-400'} border rounded-lg w-full py-2 text-sm text-cyan-200">
          ${owned ? (this.garage.state.current === v.id ? '✓ CURRENT' : 'SELECT') : `${v.price.toLocaleString()} CREDS`}
        </button>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        if (this.garage.owns(id)) {
          this.garage.setCurrent(id);
          this.notify(`Selected ${VEHICLES[id].name}`);
        } else {
          const price = VEHICLES[id].price;
          if (this.economy.state.soft >= price) {
            this.economy.spend(price, VEHICLES[id].name);
            this.garage.buy(id);
            this.notify(`Purchased ${VEHICLES[id].name}!`);
            this.updateMoneyUI();
          } else {
            this.notify('Not enough Creds');
          }
        }
        this.openGarage();
      };
    });

    // upgrades
    const up = document.getElementById('garage-upgrades');
    up.innerHTML = '';
    const current = this.garage.state.current;
    Object.values(UPGRADES).forEach(u => {
      const has = this.garage.hasUpgrade(current, u.id);
      const btn = document.createElement('button');
      btn.className = 'glass rounded-lg px-4 py-2 text-sm text-cyan-300';
      btn.innerHTML = `${u.name}<div class="text-[10px] text-cyan-500">${u.desc} · ${u.cost} CREDS</div>`;
      btn.disabled = has;
      if (has) { btn.classList.add('opacity-40'); btn.textContent = `✓ ${u.name}`; }
      btn.onclick = () => {
        if (this.economy.state.soft >= u.cost) {
          this.economy.spend(u.cost, `${VEHICLES[current].name} · ${u.name}`);
          this.garage.upgrade(current, u.id);
          this.notify(`${u.name} installed!`);
          this.updateMoneyUI();
          this.openGarage();
        } else this.notify('Not enough Creds');
      };
      up.appendChild(btn);
    });

    this.updateMoneyUI();
    document.getElementById('garage-panel').classList.remove('hidden');
  }

  openWeaponShop() {
    const list = document.getElementById('weapon-list');
    list.innerHTML = '';
    Object.values(WEAPONS).forEach(w => {
      const owned = this.arsenal.owns(w.id);
      const equipped = this.arsenal.state.equipped === w.id;
      const card = document.createElement('div');
      card.className = 'shop-card glass rounded-xl p-4';
      card.innerHTML = `
        <h3 class="font-display text-lg mb-1 text-pink-300">${w.name}</h3>
        <p class="text-xs text-cyan-300 mb-2">Damage: ${w.damage} · Range: ${w.range}m</p>
        <button data-id="${w.id}" class="${equipped ? 'bg-cyan-900/40 border-cyan-700' : 'bg-pink-500/20 border-pink-400'} border rounded-lg w-full py-2 text-sm text-cyan-200">
          ${equipped ? '✓ EQUIPPED' : owned ? 'EQUIP' : `${w.price.toLocaleString()} CREDS`}
        </button>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        if (this.arsenal.owns(id)) {
          this.arsenal.equip(id);
          this.notify(`Equipped ${WEAPONS[id].name}`);
        } else {
          const price = WEAPONS[id].price;
          if (this.economy.state.soft >= price) {
            this.economy.spend(price, WEAPONS[id].name);
            this.arsenal.buy(id);
            this.notify(`Purchased ${WEAPONS[id].name}!`);
            this.updateMoneyUI();
          } else this.notify('Not enough Creds');
        }
        document.getElementById('hud-weapon').textContent = this.arsenal.current().name;
        if (this.arsenal.current().id !== 'fists' && this.isDriving) {
          document.getElementById('crosshair').classList.remove('hidden');
        }
        this.openWeaponShop();
      };
    });

    this.updateMoneyUI();
    document.getElementById('weapon-panel').classList.remove('hidden');
  }

  async sendKimiMessage() {
    const input = document.getElementById('kimi-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    const box = document.getElementById('kimi-messages');
    box.innerHTML += `<div class="text-cyan-500">You: ${msg}</div>`;
    box.scrollTop = box.scrollHeight;

    const reply = await askKimi(msg, {
      character: this.character?.name,
      credits: this.economy.state.soft
    });
    box.innerHTML += `<div class="text-cyan-100 border-l-2 border-pink-400 pl-2">Kimi: ${reply}</div>`;
    box.scrollTop = box.scrollHeight;
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
    } catch (e) { this.notify(e.message); }
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

    if (this.isDriving) this.updateVehicle(dt);
    else this.updatePlayer(dt);

    this.updateCamera(dt);
    this.checkMissions();
    this.checkVehicles();
    if (this.chase) this.chase.update(dt, t);

    // auto-fire if holding mouse
    if (this.keys[' '] || this.mouseDown) this.shoot();

    this.missionMarkers.forEach(m => {
      m.rotation.y += dt * 0.5;
      m.position.y = 0.2 + Math.sin(t * 2) * 0.1;
    });
    if (this.playerRing) this.playerRing.rotation.z += dt;

    document.getElementById('hud-chase').classList.toggle('hidden', !this.chase?.active);

    this.renderer.render(this.scene, this.camera);
  }

  getInputVector() {
    const move = new THREE.Vector3();
    if (this.keys['w']) move.z -= 1;
    if (this.keys['s']) move.z += 1;
    if (this.keys['a']) move.x -= 1;
    if (this.keys['d']) move.x += 1;
    if (this.mobileMove.x || this.mobileMove.y) {
      move.x += this.mobileMove.x;
      move.z += this.mobileMove.y;
    }
    return move;
  }

  updatePlayer(dt) {
    if (!this.player) return;
    const speed = this.keys['shift'] ? 30 : 15;
    const move = this.getInputVector();
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      this.player.position.add(move);
      this.player.rotation.y = Math.atan2(move.x, move.z);
    }
    this.player.position.x = Math.max(-180, Math.min(180, this.player.position.x));
    this.player.position.z = Math.max(-180, Math.min(180, this.player.position.z));
  }

  updateVehicle(dt) {
    if (!this.vehicle) return;
    const id = this.vehicle.userData.vehicleId;
    const stats = this.garage.getStats(id);
    const input = this.getInputVector();

    // rotation (steering)
    if (input.x !== 0) {
      this.vehicle.rotation.y += input.x * stats.handling * dt * 2;
    }

    // forward/backward
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vehicle.quaternion);
    const accel = input.z !== 0 ? -input.z : 0;
    this.velocity.addScaledVector(forward, accel * stats.accel * dt * 20);
    this.velocity.multiplyScalar(0.96); // friction
    const speed = this.velocity.length();
    if (speed > stats.speed) this.velocity.setLength(stats.speed);

    this.vehicle.position.addScaledVector(this.velocity, dt);
    this.vehicle.position.x = Math.max(-180, Math.min(180, this.vehicle.position.x));
    this.vehicle.position.z = Math.max(-180, Math.min(180, this.vehicle.position.z));
  }

  updateCamera(dt) {
    if (!this.player) return;
    const target = (this.isDriving && this.vehicle) ? this.vehicle.position : this.player.position;
    const camTarget = target.clone().add(new THREE.Vector3(0, this.isDriving ? 6 : 8, this.isDriving ? 10 : 12));
    this.camera.position.lerp(camTarget, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(target.clone().add(new THREE.Vector3(0, 1, 0)));
  }

  checkMissions() {
    if (!this.player) return;
    let nearest = null, minDist = 3;
    this.missionMarkers.forEach(m => {
      const d = this.player.position.distanceTo(m.position);
      if (d < minDist) { minDist = d; nearest = m; }
    });
    this.nearbyMission = nearest;
    const prompt = document.getElementById('prompt');
    if (nearest) {
      document.getElementById('prompt-text').textContent = nearest.userData.mission.title;
      prompt.classList.remove('hidden');
    } else if (!this.nearbyVehicle) {
      prompt.classList.add('hidden');
    }
  }

  checkVehicles() {
    if (this.isDriving) return;
    let nearest = null, minDist = 3.5;
    this.vehicleObjs.forEach(v => {
      const d = this.player.position.distanceTo(v.position);
      if (d < minDist) { minDist = d; nearest = v; }
    });
    this.nearbyVehicle = nearest;
    if (nearest) {
      document.getElementById('prompt-text').textContent = `Enter ${VEHICLES[nearest.userData.vehicleId].name}`;
      document.getElementById('prompt').classList.remove('hidden');
      document.getElementById('prompt').querySelector('span').innerHTML =
        `Press <span class="font-display neon-cyan">F</span> — ${VEHICLES[nearest.userData.vehicleId].name}`;
    }
  }
}

new Game();
