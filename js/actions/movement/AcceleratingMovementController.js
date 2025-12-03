class AcceleratingMovementController extends MovementController {
  constructor(character, config = {}) {
    super(character, config);
    this.currentSpeed = 0;
    this.maxSpeed = config.maxSpeed ?? character.moveSpeed * 1.75;
    this.accelPerSecond = config.accelPerSecond ?? 2.5;
    this.decelPerSecond = config.decelPerSecond ?? 4;
  }

  update(delta = 0) {
    const { sprite, inputState } = this.character;
    // spriteが存在しない、または破壊されている場合は何もしない
    if (!sprite || !sprite.active || !sprite.body) return;

    if (this.character.isAbilityBlockingMovement?.()) {
      sprite.setVelocity(0, 0);
      return;
    }

    const hasInput =
      inputState.activePointerId !== null &&
      inputState.touchCurrentPos &&
      inputState.touchStartPos;

    const dt = delta / 1000;
    if (!hasInput) {
      this.currentSpeed = Math.max(
        0,
        this.currentSpeed - this.decelPerSecond * dt
      );
      sprite.setVelocity(0, 0);
      return;
    }

    const dx = inputState.touchCurrentPos.x - inputState.touchStartPos.x;
    const dy = inputState.touchCurrentPos.y - inputState.touchStartPos.y;
    const distance = Math.hypot(dx, dy);

    if (distance < this.config.dragThreshold) {
      this.currentSpeed = Math.max(
        0,
        this.currentSpeed - this.decelPerSecond * dt
      );
      sprite.setVelocity(0, 0);
      return;
    }

    this.currentSpeed = Math.min(
      this.maxSpeed,
      this.currentSpeed + this.accelPerSecond * dt
    );

    const nx = dx / distance;
    const ny = dy / distance;
    sprite.setVelocity(nx * this.currentSpeed, ny * this.currentSpeed);
  }
}

window.AcceleratingMovementController = AcceleratingMovementController;
