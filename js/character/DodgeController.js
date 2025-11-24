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

class DashDodgeController extends DodgeController {}

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

class ChainImpactDodgeController extends DodgeController {
  constructor(character, config = {}) {
    super(character, config);
    this.chainRadius = config.chainRadius ?? 160;
    this.damagePerHit = config.damagePerHit ?? 1;
    this.currentTarget = null;
    this.visitedIds = new Set();
    this.activeDistance = this.config.distance;
  }

  requestDodge(direction) {
    const combat = this.character.scene.combatSystem;
    if (!combat) return false;
    const sprite = this.character.sprite;
    const target = combat.getNearestEnemySprite(sprite, {
      direction,
      maxDistance: this.config.distance,
    });
    if (!target) return false;

    if (!super.requestDodge(direction)) return false;
    this.currentTarget = target;
    const targetId = target.getData("_id") || target.id;
    this.visitedIds = new Set([target, targetId]);
    const dx = target.x - this.startX;
    const dy = target.y - this.startY;
    this.activeDistance = Math.min(Math.hypot(dx, dy) || this.config.distance, this.config.distance);
    return true;
  }

  update(delta) {
    // spriteが破壊されている場合は回避を終了
    if (!this.character.sprite || !this.character.sprite.active) {
      this.finishChain();
      return;
    }

    if (!this.isDodgeActive || !this.currentTarget || !this.currentTarget.active) {
      if (this.isDodgeActive && (!this.currentTarget || !this.currentTarget.active)) {
        this.finishChain();
      }
      return;
    }

    this.elapsed += delta;
    const t = Math.min(this.elapsed / this.config.duration, 1);
    const moveDist = this.activeDistance * t;
    const newX = this.startX + this.dirX * moveDist;
    const newY = this.startY + this.dirY * moveDist;
    this.character.sprite.setPosition(newX, newY);
    this.character.sprite.setVelocity(0, 0);

    if (t >= 1) {
      const combat = this.character.scene.combatSystem;
      combat.damageEnemySprite(this.currentTarget, this.damagePerHit);
      combat.igniteEntity(this.currentTarget);
      const nextTarget = combat.getNearestEnemySprite(this.currentTarget, {
        excludeSprites: this.visitedIds,
        maxDistance: this.chainRadius,
      });
      if (nextTarget) {
        const nextId = nextTarget.getData("_id") || nextTarget.id;
        this.visitedIds.add(nextTarget);
        this.visitedIds.add(nextId);
        this.startX = this.character.sprite.x = this.currentTarget.x;
        this.startY = this.character.sprite.y = this.currentTarget.y;
        const dx = nextTarget.x - this.startX;
        const dy = nextTarget.y - this.startY;
        const len = Math.hypot(dx, dy) || 1;
        this.dirX = dx / len;
        this.dirY = dy / len;
        this.currentTarget = nextTarget;
        this.elapsed = 0;
        this.activeDistance = Math.min(len, this.config.distance);
      } else {
        this.finishChain();
      }
    }
  }

  finishChain() {
    this.isDodgeActive = false;
    this.currentTarget = null;
    if (typeof this.character.callbacks.onDodgeEnd === "function") {
      this.character.callbacks.onDodgeEnd();
    }
  }
}

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

window.DodgeController = DodgeController;
window.DashDodgeController = DashDodgeController;
window.AcceleratingDodgeController = AcceleratingDodgeController;
window.ChainImpactDodgeController = ChainImpactDodgeController;
window.BlinkDodgeController = BlinkDodgeController;
