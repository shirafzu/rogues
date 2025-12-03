class AttackController {
  constructor(character, config = {}) {
    this.character = character;
    this.config = {
      cooldown: 250,
      ...config,
    };
    this.lastAttackTime = 0;
  }

  requestAttack(_pointer) {
    return false;
  }

  update() {}

  canAttack() {
    const now = this.character.scene.time.now;
    return now - this.lastAttackTime >= this.config.cooldown;
  }

  recordAttackTime() {
    this.lastAttackTime = this.character.scene.time.now;
  }
}

class MeleeAoEAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      radius: 120,
      indicatorColor: 0xffffff,
      indicatorAlpha: 0.15,
      ...config,
    });
  }

  requestAttack(pointer) {
    if (!this.canAttack()) return false;

    // spriteが破壊されている場合は攻撃できない
    const sprite = this.character.sprite;
    if (!sprite || !sprite.active) return false;

    this.recordAttackTime();
    const centerX = sprite.x;
    const centerY = sprite.y;

    // 攻撃を可視化
    const gfx = this.character.scene.add.circle(
      centerX,
      centerY,
      this.config.radius,
      this.config.indicatorColor,
      this.config.indicatorAlpha
    );
    this.character.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 150,
      onComplete: () => gfx.destroy(),
    });

    if (typeof this.character.callbacks.onAttackArea === "function") {
      this.character.callbacks.onAttackArea({
        type: "circle",
        centerX,
        centerY,
        radius: this.config.radius,
        pointer,
      });
    }
    return true;
  }
}

class AlternatingSlashAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      range: 140,
      damage: 2,
      slashWidth: 24,
      slashLength: 80,
      ...config,
    });
    this.swingLeft = false;
  }

  requestAttack() {
    if (!this.canAttack()) return false;

    // spriteが破壊されている場合は攻撃できない
    if (!this.character.sprite || !this.character.sprite.active) return false;

    const combat = this.character.scene.combatSystem;
    if (!combat) return false;

    const target = combat.getNearestEnemySprite(this.character.sprite);
    if (!target) return false;

    this.recordAttackTime();
    this.swingLeft = !this.swingLeft;

    const dirX = target.x - this.character.sprite.x;
    const dirY = target.y - this.character.sprite.y;
    const distance = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / distance;
    const ny = dirY / distance;

    const perpX = this.swingLeft ? -ny : ny;
    const perpY = this.swingLeft ? nx : -nx;

    const slash = this.character.scene.add.rectangle(
      this.character.sprite.x + nx * this.config.slashLength * 0.3,
      this.character.sprite.y + ny * this.config.slashLength * 0.3,
      this.config.slashLength,
      this.config.slashWidth,
      0xffe082,
      0.35
    );
    slash.setRotation(Math.atan2(ny, nx));
    this.character.scene.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 120,
      onComplete: () => slash.destroy(),
    });

    combat.damageEnemySprite(target, this.config.damage);
    combat.igniteEntity(target);
    return true;
  }
}

class ProjectileAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      projectileSpeed: 500,
      damage: 1,
      projectileColor: 0x81d4fa,
      range: 640,
      ...config,
    });
  }

  requestAttack(pointerOrContext) {
    if (!this.canAttack()) return false;

    // spriteが破壊されている場合は攻撃できない
    if (!this.character.sprite || !this.character.sprite.active) return false;

    const combat = this.character.scene.combatSystem;
    if (!combat) return false;
    const { target, aimX, aimY } = this._resolveAim(pointerOrContext, combat);
    if (!aimX || !aimY) return false;

    this.recordAttackTime();
    const startX = this.character.sprite.x;
    const startY = this.character.sprite.y;
    const projectile = this.character.scene.add.circle(
      startX,
      startY,
      10,
      this.config.projectileColor,
      0.9
    );

    const distance = Math.hypot(aimX - startX, aimY - startY) || 1;
    const duration = (distance / this.config.projectileSpeed) * 1000;

    this.character.scene.tweens.add({
      targets: projectile,
      x: aimX,
      y: aimY,
      duration,
      onComplete: () => {
        projectile.destroy();
        this._applyDamage(target, aimX, aimY, combat);
      },
    });
    return true;
  }

  _resolveAim(pointerOrContext, combat) {
    const sprite = this.character.sprite;
    const context = pointerOrContext || {};
    const dirFromInput = this._getMoveDirectionFromInput() || this._getDirectionFromVelocity();
    const dirFromFacing = this._getFacingDirection();

    // 1) 有効射程内で最も近い敵
    const targetSprite = combat.getNearestEnemySprite(sprite, { maxDistance: this.config.range });
    if (targetSprite) {
      return { target: targetSprite, aimX: targetSprite.x, aimY: targetSprite.y };
    }

    // 2) スティック入力の方向（移動方向）
    if (dirFromInput) {
      return {
        target: null,
        aimX: sprite.x + dirFromInput.x * this.config.range,
        aimY: sprite.y + dirFromInput.y * this.config.range,
      };
    }

    // 3) キャラクターの向いている方向
    const finalDir = dirFromFacing || { x: 1, y: 0 };
    return {
      target: null,
      aimX: sprite.x + finalDir.x * this.config.range,
      aimY: sprite.y + finalDir.y * this.config.range,
    };
  }

  _getMoveDirectionFromInput() {
    const input = this.character?.inputState;
    if (!input) return null;
    const hasInput =
      input.activePointerId !== null &&
      input.touchCurrentPos &&
      input.touchStartPos;
    if (!hasInput) return null;
    const dx = input.touchCurrentPos.x - input.touchStartPos.x;
    const dy = input.touchCurrentPos.y - input.touchStartPos.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return null;
    return { x: dx / len, y: dy / len };
  }

  _getDirectionFromVelocity() {
    const body = this.character?.sprite?.body;
    if (!body || !body.velocity) return null;
    const vx = body.velocity.x || 0;
    const vy = body.velocity.y || 0;
    const len = Math.hypot(vx, vy);
    if (len < 0.1) return null;
    return { x: vx / len, y: vy / len };
  }

  _getFacingDirection() {
    const sprite = this.character?.sprite;
    if (!sprite || typeof sprite.rotation !== "number") return null;
    return { x: Math.cos(sprite.rotation), y: Math.sin(sprite.rotation) };
  }

  _applyDamage(target, aimX, aimY, combat) {
    if (target && target.active) {
      combat.damageEnemySprite(target, this.config.damage);
      combat.igniteEntity(target);
      return;
    }
    // ターゲット不在時は小さな接触判定
    const radius = 30;
    const enemies = combat.getEnemies().map((e) => e && e.sprite).filter((s) => s && s.active);
    enemies.forEach((enemy) => {
      const dist = Phaser.Math.Distance.Between(aimX, aimY, enemy.x, enemy.y);
      if (dist <= radius) {
        combat.damageEnemySprite(enemy, this.config.damage);
        combat.igniteEntity(enemy);
      }
    });
  }
}

class MultiHitAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      hitCount: 3,
      interval: 90,
      radius: 110,
      forwardStep: 45,
      damage: 1,
      indicatorColor: 0xffc107,
      indicatorAlpha: 0.2,
      ...config,
    });
  }

  requestAttack(pointer) {
    if (!this.canAttack()) return false;
    const sprite = this.character.sprite;
    if (!sprite || !sprite.active) return false;

    this.recordAttackTime();

    const dir = this._getDirection(pointer);
    const scene = this.character.scene;

    for (let i = 0; i < this.config.hitCount; i += 1) {
      const delay = i * this.config.interval;
      scene.time.delayedCall(delay, () => {
        if (!sprite || !sprite.active) return;
        const centerX =
          sprite.x + dir.x * (this.config.forwardStep * (i + 1) * 0.6);
        const centerY =
          sprite.y + dir.y * (this.config.forwardStep * (i + 1) * 0.6);

        const gfx = scene.add.circle(
          centerX,
          centerY,
          this.config.radius,
          this.config.indicatorColor,
          this.config.indicatorAlpha
        );
        scene.tweens.add({
          targets: gfx,
          scale: 1.08,
          alpha: 0,
          duration: this.config.interval + 80,
          onComplete: () => gfx.destroy(),
        });

        if (typeof this.character.callbacks.onAttackArea === "function") {
          this.character.callbacks.onAttackArea({
            type: "circle",
            centerX,
            centerY,
            radius: this.config.radius,
            damage: this.config.damage,
            pointer,
          });
        }
      });
    }
    return true;
  }

  _getDirection(pointer) {
    const sprite = this.character.sprite;
    let dx = 1;
    let dy = 0;
    if (pointer && typeof pointer.x === "number" && typeof pointer.y === "number") {
      dx = pointer.x - sprite.x;
      dy = pointer.y - sprite.y;
    } else {
      const combat = this.character.scene?.combatSystem;
      const target = combat?.getNearestEnemySprite
        ? combat.getNearestEnemySprite(sprite)
        : null;
      if (target) {
        dx = target.x - sprite.x;
        dy = target.y - sprite.y;
      }
    }
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }
}

class RisingSlashAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      radius: 160,
      damage: 2,
      indicatorColor: 0x90caf9,
      indicatorAlpha: 0.25,
      knockbackRadius: 190,
      ...config,
    });
  }

  requestAttack(pointer) {
    if (!this.canAttack()) return false;
    const sprite = this.character.sprite;
    if (!sprite || !sprite.active) return false;

    this.recordAttackTime();

    const scene = this.character.scene;
    const centerX = sprite.x;
    const centerY = sprite.y;
    const slash = scene.add.circle(
      centerX,
      centerY,
      this.config.radius,
      this.config.indicatorColor,
      this.config.indicatorAlpha
    );
    scene.tweens.add({
      targets: slash,
      scale: 1.2,
      alpha: 0,
      duration: 200,
      onComplete: () => slash.destroy(),
    });

    if (typeof this.character.callbacks.onAttackArea === "function") {
      this.character.callbacks.onAttackArea({
        type: "circle",
        centerX,
        centerY,
        radius: this.config.radius,
        damage: this.config.damage,
        pointer,
      });
    }

    // 軽い吹き飛ばし
    const combat = scene.combatSystem;
    if (combat && combat.applyRadialPush) {
      combat.applyRadialPush(
        { x: centerX, y: centerY },
        this.config.knockbackRadius,
        0,
        this.character
      );
    }
    return true;
  }
}

class LinePierceAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      length: 520,
      width: 32,
      damage: 2,
      indicatorColor: 0x4dd0e1,
      indicatorAlpha: 0.5,
      ...config,
    });
  }

  requestAttack(pointer) {
    if (!this.canAttack()) return false;
    const sprite = this.character.sprite;
    if (!sprite || !sprite.active) return false;

    this.recordAttackTime();

    const { startX, startY, dir } = this._resolveDirection(pointer);
    const endX = startX + dir.x * this.config.length;
    const endY = startY + dir.y * this.config.length;
    const scene = this.character.scene;

    const gfx = scene.add.graphics({ x: 0, y: 0 });
    gfx.lineStyle(this.config.width, this.config.indicatorColor, this.config.indicatorAlpha);
    gfx.lineBetween(startX, startY, endX, endY);
    scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 160,
      onComplete: () => gfx.destroy(),
    });

    this._damageAlongLine(startX, startY, endX, endY);
    return true;
  }

  _resolveDirection(pointer) {
    const sprite = this.character.sprite;
    let dx = 1;
    let dy = 0;
    if (pointer && typeof pointer.x === "number" && typeof pointer.y === "number") {
      dx = pointer.x - sprite.x;
      dy = pointer.y - sprite.y;
    } else {
      const combat = this.character.scene?.combatSystem;
      const target = combat?.getNearestEnemySprite
        ? combat.getNearestEnemySprite(sprite)
        : null;
      if (target) {
        dx = target.x - sprite.x;
        dy = target.y - sprite.y;
      }
    }
    const len = Math.hypot(dx, dy) || 1;
    return { startX: sprite.x, startY: sprite.y, dir: { x: dx / len, y: dy / len } };
  }

  _damageAlongLine(x1, y1, x2, y2) {
    const combat = this.character.scene?.combatSystem;
    if (!combat || !combat.getEnemies) return;

    const enemies = combat.getEnemies()
      .map((enemy) => enemy && enemy.sprite)
      .filter((s) => s && s.active);

    const lineLenSq = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
    enemies.forEach((enemy) => {
      const proj = ((enemy.x - x1) * (x2 - x1) + (enemy.y - y1) * (y2 - y1)) / lineLenSq;
      if (proj < 0 || proj > 1) return;
      const closestX = x1 + (x2 - x1) * proj;
      const closestY = y1 + (y2 - y1) * proj;
      const dist = Math.hypot(enemy.x - closestX, enemy.y - closestY);
      if (dist <= this.config.width * 0.6) {
        combat.damageEnemySprite(enemy, this.config.damage);
        combat.igniteEntity(enemy);
      }
    });
  }
}

class HookSlamAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      radius: 120,
      damage: 1,
      forwardOffset: 40,
      indicatorColor: 0xff7043,
      indicatorAlpha: 0.22,
      ...config,
    });
  }

  requestAttack(pointer) {
    if (!this.canAttack()) return false;
    const sprite = this.character.sprite;
    if (!sprite || !sprite.active) return false;

    this.recordAttackTime();
    const dir = this._getDirection(pointer);
    const centerX = sprite.x + dir.x * this.config.forwardOffset;
    const centerY = sprite.y + dir.y * this.config.forwardOffset;
    const scene = this.character.scene;

    const slam = scene.add.circle(
      centerX,
      centerY,
      this.config.radius,
      this.config.indicatorColor,
      this.config.indicatorAlpha
    );
    scene.tweens.add({
      targets: slam,
      scale: 1.1,
      alpha: 0,
      duration: 140,
      onComplete: () => slam.destroy(),
    });

    if (typeof this.character.callbacks.onAttackArea === "function") {
      this.character.callbacks.onAttackArea({
        type: "circle",
        centerX,
        centerY,
        radius: this.config.radius,
        damage: this.config.damage,
        pointer,
      });
    }
    return true;
  }

  _getDirection(pointer) {
    const sprite = this.character.sprite;
    let dx = 0;
    let dy = 1;
    if (pointer && typeof pointer.x === "number" && typeof pointer.y === "number") {
      dx = pointer.x - sprite.x;
      dy = pointer.y - sprite.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }
}

class HookShotAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      range: 320,
      pullSpeed: 9,
      damage: 1,
      indicatorColor: 0xb39ddb,
      indicatorAlpha: 0.5,
      yankEnemy: false,
      ...config,
    });
  }

  requestAttack(pointer) {
    if (!this.canAttack()) return false;
    const sprite = this.character.sprite;
    if (!sprite || !sprite.active) return false;

    const combat = this.character.scene?.combatSystem;
    const target = combat?.getNearestEnemySprite
      ? combat.getNearestEnemySprite(sprite, { maxDistance: this.config.range })
      : null;

    const anchor = this._resolveAnchor(pointer, target);
    if (!anchor) return false;

    this.recordAttackTime();
    this._drawRope(sprite.x, sprite.y, anchor.x, anchor.y);
    this._moveToward(anchor, target);
    return true;
  }

  _resolveAnchor(pointer, target) {
    const sprite = this.character.sprite;
    if (target) {
      return { x: target.x, y: target.y };
    }

    if (pointer && typeof pointer.x === "number" && typeof pointer.y === "number") {
      const dx = pointer.x - sprite.x;
      const dy = pointer.y - sprite.y;
      const dist = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(dist, this.config.range);
      return {
        x: sprite.x + (dx / dist) * clamped,
        y: sprite.y + (dy / dist) * clamped,
      };
    }
    return null;
  }

  _drawRope(sx, sy, ex, ey) {
    const scene = this.character.scene;
    const rope = scene.add.graphics({ x: 0, y: 0 });
    rope.lineStyle(4, this.config.indicatorColor, this.config.indicatorAlpha);
    rope.lineBetween(sx, sy, ex, ey);
    scene.tweens.add({
      targets: rope,
      alpha: 0,
      duration: 180,
      onComplete: () => rope.destroy(),
    });
  }

  _moveToward(anchor, target) {
    const sprite = this.character.sprite;
    const dx = anchor.x - sprite.x;
    const dy = anchor.y - sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const travelDist = Math.min(dist, this.config.range);
    const duration = Math.min(420, (travelDist / (this.config.pullSpeed || 1)) * 100);
    const scene = this.character.scene;

    sprite.setVelocity(nx * this.config.pullSpeed, ny * this.config.pullSpeed);
    scene.time.delayedCall(duration, () => {
      if (!sprite || !sprite.active) return;
      sprite.setVelocity(0, 0);
      sprite.setPosition(
        sprite.x + nx * (travelDist * 0.6),
        sprite.y + ny * (travelDist * 0.6)
      );
      if (target && target.active && scene.combatSystem) {
        scene.combatSystem.damageEnemySprite(target, this.config.damage);
        if (this.config.yankEnemy) {
          const pullOffset = this.config.forwardPullOffset ?? 24;
          target.setPosition(
            sprite.x + nx * pullOffset,
            sprite.y + ny * pullOffset
          );
        }
      }
    });
  }
}

window.AttackController = AttackController;
window.MeleeAoEAttackController = MeleeAoEAttackController;
window.AlternatingSlashAttackController = AlternatingSlashAttackController;
window.ProjectileAttackController = ProjectileAttackController;
window.MultiHitAttackController = MultiHitAttackController;
window.RisingSlashAttackController = RisingSlashAttackController;
window.LinePierceAttackController = LinePierceAttackController;
window.HookSlamAttackController = HookSlamAttackController;
window.HookShotAttackController = HookShotAttackController;
