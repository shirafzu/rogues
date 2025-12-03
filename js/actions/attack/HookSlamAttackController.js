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
    if (!this.canExecute()) return false;

    const sprite = this.character.sprite;
    this.recordExecution();

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


window.HookSlamAttackController = HookSlamAttackController;
