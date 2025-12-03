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
    if (!this.canExecute()) return false;

    const combat = this.character.scene.combatSystem;
    if (!combat) return false;
    const { target, aimX, aimY } = this._resolveAim(pointerOrContext, combat);
    if (!aimX || !aimY) return false;

    this.recordExecution();
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

  _resolveAim(_context, combat) {
    const sprite = this.character.sprite;
    const dirFromInput = DirectionUtils.getDirectionFromInput(this.character) || DirectionUtils.getDirectionFromVelocity(this.character);
    const dirFromFacing = DirectionUtils.getFacingDirection(this.character);

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


window.ProjectileAttackController = ProjectileAttackController;
