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
    if (!this.canExecute()) return false;

    const sprite = this.character.sprite;
    this.recordExecution();

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


window.MultiHitAttackController = MultiHitAttackController;
