class HoppingMovementController extends MovementController {
  constructor(character, config = {}) {
    super(character, config);
    this.hopDuration = config.hopDuration ?? 220; // ms
    this.pauseDuration = config.pauseDuration ?? 180; // ms
    this.hopSpeed = config.hopSpeed ?? character.moveSpeed * 2.2;
    this.phase = "pause";
    this.phaseTimer = 0;
    this.currentDir = { x: 0, y: 0 };
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

    if (!hasInput) {
      sprite.setVelocity(0, 0);
      this.phaseTimer = 0;
      this.phase = "pause";
      return;
    }

    const dx = inputState.touchCurrentPos.x - inputState.touchStartPos.x;
    const dy = inputState.touchCurrentPos.y - inputState.touchStartPos.y;
    const distance = Math.hypot(dx, dy);
    if (distance < this.config.dragThreshold) {
      sprite.setVelocity(0, 0);
      return;
    }

    this.phaseTimer += delta;
    if (this.phase === "pause") {
      if (this.phaseTimer >= this.pauseDuration) {
        this.phase = "hop";
        this.phaseTimer = 0;
        this.currentDir = { x: dx / distance, y: dy / distance };
      }
      sprite.setVelocity(0, 0);
      return;
    }

    // Hop phase
    sprite.setVelocity(
      this.currentDir.x * this.hopSpeed,
      this.currentDir.y * this.hopSpeed
    );
    if (this.phaseTimer >= this.hopDuration) {
      this.phase = "pause";
      this.phaseTimer = 0;
      sprite.setVelocity(0, 0);
    }
  }
}

window.HoppingMovementController = HoppingMovementController;
