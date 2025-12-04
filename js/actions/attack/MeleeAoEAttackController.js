// MeleeAoEAttackController - 近接AoE攻撃コントローラー
// プレイヤーの周囲に円形の攻撃範囲を展開

class MeleeAoEAttackController extends AttackController {
  constructor(character, config = {}) {
    const baseRadius = config.radius ?? 120;
    const forwardOffset = config.forwardOffset ?? baseRadius * 0.6;
    const targetSearchRadius = config.targetSearchRadius ?? baseRadius * 1.2;
    super(character, {
      radius: baseRadius,
      indicatorColor: 0xffffff,
      indicatorAlpha: 0.15,
      forwardOffset,
      targetSearchRadius,
      ...config,
    });
  }

  requestAttack(pointer) {
    if (!this.canExecute()) return false;

    const sprite = this.character.sprite;
    const combat = this.character.scene?.combatSystem;
    const { centerX, centerY } = this._resolveAttackCenter(combat);
    this.recordExecution();

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

  _resolveAttackCenter(combat) {
    const sprite = this.character.sprite;
    const target =
      combat?.getNearestEnemySprite?.(sprite, {
        maxDistance: this.config.targetSearchRadius,
      }) || null;

    let dir;
    if (target) {
      dir = { x: target.x - sprite.x, y: target.y - sprite.y };
    } else {
      dir =
        DirectionUtils.getFacingDirection(this.character) || { x: 1, y: 0 };
    }
    const len = Math.hypot(dir.x, dir.y) || 1;
    const nx = dir.x / len;
    const ny = dir.y / len;

    if (this.character.setFacingDirection) {
      this.character.setFacingDirection({ x: nx, y: ny });
    }

    const distToTarget = target
      ? Math.hypot(target.x - sprite.x, target.y - sprite.y)
      : 0;
    const offset = target
      ? Math.min(distToTarget, this.config.forwardOffset)
      : this.config.forwardOffset;

    return {
      centerX: sprite.x + nx * offset,
      centerY: sprite.y + ny * offset,
    };
  }
}

window.MeleeAoEAttackController = MeleeAoEAttackController;
