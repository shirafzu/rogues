class SeekMovementController extends MovementController {
  constructor(character, config = {}) {
    super(character, config);
    this.speed = config.moveSpeed ?? character.moveSpeed ?? 2;
    this.targetProvider = config.targetProvider || null;
    this.arriveThreshold = config.arriveThreshold ?? 4;
  }

  update() {
    const sprite = this.character.sprite;
    // spriteが存在しない、または破壊されている場合は何もしない
    if (!sprite || !sprite.active || !sprite.body) return;

    if (this.character.isAbilityBlockingMovement?.()) {
      return;
    }

    const target = this.targetProvider ? this.targetProvider() : null;
    if (!target || !target.active) {
      sprite.setVelocity(0, 0);
      return;
    }

    const dx = target.x - sprite.x;
    const dy = target.y - sprite.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= this.arriveThreshold) {
      sprite.setVelocity(0, 0);
      return;
    }

    const nx = dx / distance;
    const ny = dy / distance;
    sprite.setVelocity(nx * this.speed, ny * this.speed);
  }
}

window.SeekMovementController = SeekMovementController;
