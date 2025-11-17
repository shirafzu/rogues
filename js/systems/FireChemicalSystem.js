class FireChemicalSystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.fireDuration = options.fireDuration ?? 2000;
    this.fireTickInterval = options.fireTickInterval ?? 400;
    this.fireDamagePerTick = options.fireDamagePerTick ?? 1;
    this.fireSpreadRadius = options.fireSpreadRadius ?? 150;
    this.windDirX = options.windDirX ?? 0;
    this.windDirY = options.windDirY ?? 1;
    this.fireDownwindMultiplier = options.fireDownwindMultiplier ?? 1.8;
    this.fireUpwindMultiplier = options.fireUpwindMultiplier ?? 0.6;

    this.lastFireTickTime = 0;
  }

  ignite(entity) {
    if (!entity || !entity.active) return;
    const now = this.scene.time.now;
    const currentUntil = entity.getData("onFireUntil") || 0;
    const newUntil = Math.max(currentUntil, now + this.fireDuration);
    entity.setData("onFireUntil", newUntil);
    entity.setData("isOnFire", true);
  }

  update(targets) {
    const now = this.scene.time.now;
    const updateVisuals = (sprites) => {
      sprites.forEach((ent) => {
        if (!ent || !ent.active) return;
        const fireUntil = ent.getData("onFireUntil") || 0;
        const baseColor = ent.getData("baseColor");

        if (fireUntil > now) {
          ent.setData("isOnFire", true);
          const pulse = Math.floor(now / 120) % 2 === 0;
          if (baseColor != null) {
            ent.setFillStyle(pulse ? 0xff5722 : baseColor);
          }
        } else if (ent.getData("isOnFire")) {
          ent.setData("isOnFire", false);
          if (baseColor != null) {
            ent.setFillStyle(baseColor);
          }
        }
      });
    };

    const enemySprites = targets.enemies
      .map((enemy) => enemy && enemy.sprite)
      .filter((sprite) => sprite && sprite.active);

    updateVisuals(enemySprites);
    updateVisuals(targets.crates);

    if (now - this.lastFireTickTime < this.fireTickInterval) return;
    this.lastFireTickTime = now;

    const burningEnemies = [];
    const burningCrates = [];

    enemySprites.forEach((enemy) => {
      const fireUntil = enemy.getData("onFireUntil") || 0;
      if (fireUntil > now) {
        targets.damageEnemy(enemy, this.fireDamagePerTick);
        if (enemy.active) {
          burningEnemies.push(enemy);
        }
      }
    });

    const crates = targets.crates.filter((crate) => crate && crate.active);
    crates.forEach((crate) => {
      const fireUntil = crate.getData("onFireUntil") || 0;
      if (fireUntil > now) {
        targets.damageCrate(crate, this.fireDamagePerTick);
        if (crate.active) {
          burningCrates.push(crate);
        }
      }
    });

    const flammables = [...enemySprites, ...crates].filter(
      (ent) => ent && ent.active
    );

    const spreadFromList = (sources) => {
      sources.forEach((src) => {
        if (!src || !src.active) return;
        const sx = src.x;
        const sy = src.y;
        flammables.forEach((target) => {
          if (target === src || !target.active) return;
          const targetFireUntil = target.getData("onFireUntil") || 0;
          if (targetFireUntil > now + this.fireDuration * 0.5) return;

          const dx = target.x - sx;
          const dy = target.y - sy;
          const distance = Math.hypot(dx, dy);
          if (distance === 0) return;

          let effectiveRadius = this.fireSpreadRadius;
          const windLen = Math.hypot(this.windDirX, this.windDirY);
          if (windLen > 0) {
            const nwx = this.windDirX / windLen;
            const nwy = this.windDirY / windLen;
            const dirX = dx / distance;
            const dirY = dy / distance;
            const dot = nwx * dirX + nwy * dirY;

            if (dot > 0.35) {
              effectiveRadius *= this.fireDownwindMultiplier;
            } else if (dot < -0.35) {
              effectiveRadius *= this.fireUpwindMultiplier;
            }
          }

          if (distance <= effectiveRadius) {
            this.ignite(target);
          }
        });
      });
    };

    spreadFromList(burningEnemies);
    spreadFromList(burningCrates);
  }
}

window.FireChemicalSystem = FireChemicalSystem;
