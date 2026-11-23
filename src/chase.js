import * as THREE from 'three';

export class PoliceChase {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.cars = [];
    this.heat = 0;
    this.timeLeft = 0;
  }

  start(level = 1) {
    if (this.active) return;
    this.active = true;
    this.heat = level;

    const baseTime = 22;
    const mult = this.game.character.bonus?.chaseTimeMultiplier || 1;
    this.timeLeft = baseTime * mult * level;

    this.game.notify(`🚨 POLICE CHASE — Heat ${level} — Escape in ${Math.round(this.timeLeft)}s`);
    for (let i = 0; i < level + 1; i++) {
      setTimeout(() => this.spawnCar(i), i * 800);
    }
  }

  spawnCar(i) {
    if (!this.active) return;
    const car = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.9, 4),
      new THREE.MeshStandardMaterial({ color: 0x111122, emissive: 0xff0044, emissiveIntensity: 0.3 })
    );
    body.position.y = 0.6;
    car.add(body);

    const lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.25, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff0044 })
    );
    lightBar.position.set(0, 1.2, -0.3);
    car.add(lightBar);

    const siren = new THREE.PointLight(0xff0044, 3, 15);
    siren.position.set(0, 1.5, 0);
    car.add(siren);
    car.userData.siren = siren;
    car.userData.hp = 3;
    car.userData.speed = 14 + this.heat * 3;

    const angle = (i / (this.heat + 1)) * Math.PI * 2 + Math.random();
    const dist = 30 + Math.random() * 15;
    car.position.set(
      this.game.player.position.x + Math.cos(angle) * dist,
      0,
      this.game.player.position.z + Math.sin(angle) * dist
    );
    this.game.scene.add(car);
    this.cars.push(car);
  }

  update(dt, time) {
    if (!this.active) return;
    this.timeLeft -= dt;

    this.cars.forEach(car => {
      const targetPos = this.game.isDriving
        ? this.game.vehicle.position
        : this.game.player.position;
      const dir = targetPos.clone().sub(car.position);
      dir.y = 0;
      const dist = dir.length();
      if (dist > 1) {
        dir.normalize();
        car.position.add(dir.multiplyScalar(car.userData.speed * dt));
        car.lookAt(targetPos.x, car.position.y, targetPos.z);
      }
      // siren pulse
      if (car.userData.siren) {
        car.userData.siren.intensity = 2 + Math.sin(time * 12) * 1.5;
      }
      // proximity drain
      if (dist < 5) this.timeLeft -= dt * 3;
    });

    if (this.cars.length === 0) {
      this.end(true);
    } else if (this.timeLeft <= 0) {
      this.end(false);
    }
  }

  damageCar(car) {
    car.userData.hp -= 1;
    if (car.userData.hp <= 0) {
      this.game.scene.remove(car);
      this.cars = this.cars.filter(c => c !== car);
      this.game.notify('🚔 Police car destroyed! +150 Creds');
      this.game.economy.earn(150, 'Destroyed police car');
      this.game.updateMoneyUI();
      if (this.cars.length === 0) this.end(true);
    }
  }

  end(escaped) {
    this.active = false;
    this.cars.forEach(c => this.game.scene.remove(c));
    this.cars = [];

    if (escaped) {
      this.game.notify('✅ ESCAPED! +200 Creds bonus');
      this.game.economy.earn(200, 'Escape bonus');
    } else {
      const fine = Math.min(500, Math.floor(this.game.economy.state.soft * 0.15));
      this.game.economy.state.soft -= fine;
      this.game.economy.state.transactions.push({ type: 'fine', amount: fine, date: Date.now() });
      this.game.economy.save();
      this.game.notify(`💸 BUSTED! Lost ${fine} Creds`);
    }
    this.game.updateMoneyUI();
    this.heat = 0;
  }
}
