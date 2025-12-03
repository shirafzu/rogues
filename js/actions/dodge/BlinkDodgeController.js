class BlinkDodgeController extends DodgeController {
  constructor(character, config = {}) {
    super(character, config);
    this.preDelay = config.preDelay ?? 120;
    this.postDelay = config.postDelay ?? 80;
    this.phase = "idle";
  }

  requestDodge(direction) {
    if (!super.requestDodge(direction)) return false;
    this.phase = "pre";
    this.elapsed = 0;
    this.character.sprite.setAlpha(0.3);
    return true;
  }

  update(delta) {
    if (!this.isDodgeActive) return;

    // spriteが破壊されている場合は回避を終了
    if (!this.character.sprite || !this.character.sprite.active) {
      this.isDodgeActive = false;
      this.phase = "idle";
      return;
    }

    this.elapsed += delta;

    if (this.phase === "pre" && this.elapsed >= this.preDelay) {
      this.phase = "blink";
      this.elapsed = 0;
      const newX = this.startX + this.dirX * this.config.distance;
      const newY = this.startY + this.dirY * this.config.distance;
      this.character.sprite.setPosition(newX, newY);
      this.character.sprite.setVelocity(0, 0);
      return;
    }

    if (this.phase === "blink" && this.elapsed >= this.postDelay) {
      this.phase = "idle";
      this.isDodgeActive = false;
      this.character.sprite.setAlpha(1);
      if (typeof this.character.callbacks.onDodgeEnd === "function") {
        this.character.callbacks.onDodgeEnd();
      }
    }
  }
}


window.BlinkDodgeController = BlinkDodgeController;
