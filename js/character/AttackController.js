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
      ...config,
    });
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
    const startX = this.character.sprite.x;
    const startY = this.character.sprite.y;
    const projectile = this.character.scene.add.circle(
      startX,
      startY,
      10,
      this.config.projectileColor,
      0.9
    );

    const distance = Math.hypot(target.x - startX, target.y - startY) || 1;
    const duration = (distance / this.config.projectileSpeed) * 1000;

    this.character.scene.tweens.add({
      targets: projectile,
      x: target.x,
      y: target.y,
      duration,
      onComplete: () => {
        projectile.destroy();
        if (target && target.active) {
          combat.damageEnemySprite(target, this.config.damage);
          combat.igniteEntity(target);
        }
      },
    });
    return true;
  }
}

window.AttackController = AttackController;
window.MeleeAoEAttackController = MeleeAoEAttackController;
window.AlternatingSlashAttackController = AlternatingSlashAttackController;
window.ProjectileAttackController = ProjectileAttackController;
