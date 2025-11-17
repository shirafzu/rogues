class MovementController {
  constructor(character, config = {}) {
    this.character = character;
    this.config = {
      dragThreshold: 20,
      ...config,
    };
  }

  update(_delta) {
    // Base class does nothing
  }
}

class BasicMovementController extends MovementController {
  update() {
    const { sprite, inputState } = this.character;
    if (!sprite) return;

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
    if (!sprite) return;

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
    if (!sprite) return;

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

class SeekMovementController extends MovementController {
  constructor(character, config = {}) {
    super(character, config);
    this.speed = config.moveSpeed ?? character.moveSpeed ?? 2;
    this.targetProvider = config.targetProvider || null;
    this.arriveThreshold = config.arriveThreshold ?? 4;
  }

  update() {
    const sprite = this.character.sprite;
    if (!sprite) return;

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

window.MovementController = MovementController;
window.BasicMovementController = BasicMovementController;
window.AcceleratingMovementController = AcceleratingMovementController;
window.HoppingMovementController = HoppingMovementController;
window.SeekMovementController = SeekMovementController;
