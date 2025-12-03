class DodgeController {
  constructor(character, config = {}) {
    this.character = character;
    this.config = {
      distance: 200,
      duration: 260,
      invincibleDuration: 260,
      ...config,
    };

    this.isDodgeActive = false;
    this.elapsed = 0;
    this.dirX = 0;
    this.dirY = 0;
    this.startX = 0;
    this.startY = 0;
  }

  requestDodge(direction) {
    if (this.isDodgeActive || !direction) return false;

    const len = Math.hypot(direction.x, direction.y);
    if (len === 0) return false;

    this.isDodgeActive = true;
    this.elapsed = 0;
    this.dirX = direction.x / len;
    this.dirY = direction.y / len;
    this.startX = this.character.sprite.x;
    this.startY = this.character.sprite.y;

    this.character.setInvincibleFor(this.config.invincibleDuration);

    if (typeof this.character.callbacks.onDodgeStart === "function") {
      this.character.callbacks.onDodgeStart();
    }
    return true;
  }

  update(delta) {
    if (!this.isDodgeActive) return;

    // spriteが破壊されている場合は回避を終了
    if (!this.character.sprite || !this.character.sprite.active) {
      this.isDodgeActive = false;
      return;
    }

    this.elapsed += delta;
    const t = Math.min(this.elapsed / this.config.duration, 1);
    const moveDist = this.config.distance * t;
    const newX = this.startX + this.dirX * moveDist;
    const newY = this.startY + this.dirY * moveDist;

    this.character.sprite.setPosition(newX, newY);
    this.character.sprite.setVelocity(0, 0);

    if (typeof this.character.callbacks.onDodgeMove === "function") {
      this.character.callbacks.onDodgeMove();
    }

    if (t >= 1) {
      this.isDodgeActive = false;
      if (typeof this.character.callbacks.onDodgeEnd === "function") {
        this.character.callbacks.onDodgeEnd();
      }
    }
  }

  isDodging() {
    return this.isDodgeActive;
  }
}


window.DodgeController = DodgeController;
