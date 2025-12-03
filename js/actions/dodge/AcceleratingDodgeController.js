class AcceleratingDodgeController extends DodgeController {
  constructor(character, config = {}) {
    super(character, config);
    this.impactRadius = config.impactRadius ?? 100;
    this.impactDamage = config.impactDamage ?? 1;
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
    const eased = t * t;
    const moveDist = this.config.distance * eased;
    const newX = this.startX + this.dirX * moveDist;
    const newY = this.startY + this.dirY * moveDist;
    this.character.sprite.setPosition(newX, newY);
    this.character.sprite.setVelocity(0, 0);

    if (typeof this.character.callbacks.onDodgeMove === "function") {
      this.character.callbacks.onDodgeMove();
    }

    if (t >= 1) {
      this.isDodgeActive = false;
      this.performImpact(newX, newY);
      if (typeof this.character.callbacks.onDodgeEnd === "function") {
        this.character.callbacks.onDodgeEnd();
      }
    }
  }

  performImpact(x, y) {
    const scene = this.character.scene;
    const combat = scene.combatSystem;
    if (!combat) return;
    combat.applyRadialPush({ x, y }, this.impactRadius, this.impactDamage, this.character);
  }
}


window.AcceleratingDodgeController = AcceleratingDodgeController;
