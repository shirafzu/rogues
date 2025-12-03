class BasicMovementController extends MovementController {
  update() {
    const { sprite, inputState } = this.character;
    // spriteが存在しない、または破壊されている場合は何もしない
    if (!sprite || !sprite.active || !sprite.body) return;

    if (this.character.isAbilityBlockingMovement?.()) {
      return;
    }

    if (
      inputState.activePointerId === null ||
      !inputState.touchCurrentPos ||
      !inputState.touchStartPos
    ) {
      sprite.setVelocity(0, 0);
      return;
    }

    const dx = inputState.touchCurrentPos.x - inputState.touchStartPos.x;
    const dy = inputState.touchCurrentPos.y - inputState.touchStartPos.y;
    const distance = Math.hypot(dx, dy);

    if (distance >= this.config.dragThreshold) {
      const nx = dx / distance;
      const ny = dy / distance;
      sprite.setVelocity(nx * this.character.moveSpeed, ny * this.character.moveSpeed);
    } else {
      sprite.setVelocity(0, 0);
    }
  }
}

window.BasicMovementController = BasicMovementController;
