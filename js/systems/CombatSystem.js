class CombatSystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.getEnemies = options.getEnemies || (() => []);
    this.getCrates = options.getCrates || (() => []);
    this.knockbackSpeed = options.knockbackSpeed ?? 8;
    this.knockbackDuration = options.knockbackDuration ?? 180;
    this.onCrateRemoved = options.onCrateRemoved || (() => { });
    this.igniteHandler = options.igniteHandler || null;
    this.onCrateDestroyed = options.onCrateDestroyed || null;
  }

  setPlayerController(controller) {
    this.playerController = controller;
  }

  handlePlayerAttackArea(area) {
    if (!area || area.type !== "circle") return;
    const { centerX, centerY, radius } = area;
    const damage = area.damage ?? 1;

    const enemySprites = this.getEnemies()
      .map((enemy) => enemy && enemy.sprite)
      .filter((sprite) => sprite && sprite.active);

    enemySprites.forEach((enemy) => {
      const dx = enemy.x - centerX;
      const dy = enemy.y - centerY;
      const distance = Math.hypot(dx, dy);
      if (distance <= radius) {
        this.damageEnemySprite(enemy, damage);

        if (distance > 0) {
          const nx = dx / distance;
          const ny = dy / distance;
          enemy.setVelocity(nx * this.knockbackSpeed, ny * this.knockbackSpeed);
          enemy.setData("knockbackUntil", this.scene.time.now + this.knockbackDuration);
        }

        this.igniteEntity(enemy);
      }
    });

    const crates = this.getCrates().filter((crate) => crate && crate.active);
    crates.forEach((crate) => {
      const dx = crate.x - centerX;
      const dy = crate.y - centerY;
      const distance = Math.hypot(dx, dy);
      if (distance <= radius) {
        this.igniteEntity(crate);
      }
    });
  }

  handleEnemyAttackArea(area) {
    if (!area || area.type !== "circle") return;
    const { centerX, centerY, radius } = area;
    const damage = area.damage ?? 1;

    // プレイヤーへのダメージ判定
    if (!this.playerController || !this.playerController.sprite || !this.playerController.sprite.active) {
      return;
    }

    const player = this.playerController.sprite;
    const dx = player.x - centerX;
    const dy = player.y - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance <= radius) {
      this.playerController.takeDamage(damage);

      // ノックバック
      if (distance > 0) {
        const nx = dx / distance;
        const ny = dy / distance;
        player.setVelocity(nx * this.knockbackSpeed, ny * this.knockbackSpeed);
        player.setData("knockbackUntil", this.scene.time.now + this.knockbackDuration);
      }
    }
  }

  damageEnemySprite(enemySprite, amount) {
    if (!enemySprite || !enemySprite.active) return;
    const controller = enemySprite.getData("controller");
    if (controller) {
      controller.takeDamage(amount);
      return;
    }

    const currentHp = enemySprite.getData("hp") ?? 1;
    const nextHp = currentHp - amount;
    enemySprite.setData("hp", nextHp);
    const baseColor = enemySprite.getData("baseColor") ?? 0xf44336;

    enemySprite.setFillStyle(0xffeb3b);
    this.scene.time.delayedCall(80, () => {
      if (!enemySprite || !enemySprite.active) return;
      if (enemySprite.getData("isOnFire")) {
        enemySprite.setFillStyle(0xff5722);
      } else {
        enemySprite.setFillStyle(baseColor);
      }
    });

    if (nextHp <= 0) {
      enemySprite.destroy();
    }
  }

  damageCrateSprite(crate, amount) {
    if (!crate || !crate.active) return;

    const currentHp = crate.getData("hp") ?? 1;
    const nextHp = currentHp - amount;
    crate.setData("hp", nextHp);

    const baseColor = crate.getData("baseColor") ?? 0x9e9e9e;
    crate.setFillStyle(0xffcc80);
    this.scene.time.delayedCall(80, () => {
      if (!crate || !crate.active) return;
      if (crate.getData("isOnFire")) {
        crate.setFillStyle(0xff5722);
      } else {
        crate.setFillStyle(baseColor);
      }
    });

    if (nextHp <= 0) {
      const destroyPayload = {
        crate,
        x: crate.x,
        y: crate.y,
      };
      if (typeof this.onCrateDestroyed === "function") {
        this.onCrateDestroyed(destroyPayload);
      }
      crate.destroy();
      this.onCrateRemoved(crate);
    }
  }

  igniteEntity(entity) {
    if (this.igniteHandler) {
      this.igniteHandler(entity);
    }
  }

  getNearestEnemySprite(reference, options = {}) {
    const sprites = this.getEnemies()
      .map((enemy) => enemy && enemy.sprite)
      .filter((sprite) => sprite && sprite.active);
    if (sprites.length === 0) return null;

    const refX = reference.x;
    const refY = reference.y;
    const direction = options.direction || null;
    const maxDistance = options.maxDistance || Infinity;
    const excludeIds = new Set(options.excludeSprites || []);

    let best = null;
    let bestDist = Infinity;

    sprites.forEach((sprite) => {
      const spriteId = sprite.getData("_id") || sprite.id;
      if (excludeIds.has(sprite) || excludeIds.has(spriteId)) return;
      const dx = sprite.x - refX;
      const dy = sprite.y - refY;
      const distance = Math.hypot(dx, dy);
      if (distance > maxDistance) return;
      if (direction) {
        const len = Math.hypot(direction.x, direction.y) || 1;
        const dot = (dx * direction.x + dy * direction.y) / (distance * len);
        if (dot < 0.1) return;
      }
      if (distance < bestDist) {
        best = sprite;
        bestDist = distance;
      }
    });

    return best;
  }

  applyRadialPush(center, radius, damage = 0, sourceCharacter = null) {
    const sprites = this.getEnemies()
      .map((enemy) => enemy && enemy.sprite)
      .filter((sprite) => sprite && sprite.active);
    sprites.forEach((sprite) => {
      if (sourceCharacter && sprite === sourceCharacter.sprite) return;
      const dx = sprite.x - center.x;
      const dy = sprite.y - center.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= radius && distance > 0) {
        const nx = dx / distance;
        const ny = dy / distance;
        sprite.setVelocity(nx * this.knockbackSpeed * 1.5, ny * this.knockbackSpeed * 1.5);
        sprite.setData("knockbackUntil", this.scene.time.now + this.knockbackDuration);
        if (damage > 0) {
          this.damageEnemySprite(sprite, damage);
        }
      }
    });
  }
}

window.CombatSystem = CombatSystem;
