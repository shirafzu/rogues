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
    // ターゲットがいない場合は通常の回避にフォールバック
    if (!target) {
      return super.requestDodge(direction);
    }

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

    // チェイン対象なしの場合は通常回避として移動（武器固有の挙動を優先）
    if (!this.currentTarget || !this.currentTarget.active) {
      super.update(delta);
      if (!this.isDodgeActive) {
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

/**
 * 回避方向優先で、45度内にオブジェクトがあればフックで引っ掛けて突っ込む
 * オブジェクトが見つからない場合は通常の回避
 */
class HookGrappleDodgeController extends DodgeController {
  constructor(character, config = {}) {
    super(character, config);
    this.hookRange = config.hookRange ?? 260;
    this.pullSpeed = config.pullSpeed ?? 10;
    this.anchor = null;
    this.rope = null;
  }

  requestDodge(direction) {
    const dir = this._normalize(direction);
    if (!dir) return false;

    const anchor = this._findAnchor(dir);
    this.anchor = anchor;
    this.fakeAnchor = null;

    if (!anchor) {
      // オブジェクトがない場合：フックだけ伸ばしてその場で回避時間経過
      this.fakeAnchor = {
        x: this.character.sprite.x + dir.x * this.hookRange,
        y: this.character.sprite.y + dir.y * this.hookRange,
      };
      this.isDodgeActive = true;
      this.elapsed = 0;
      this.character.setInvincibleFor(this.config.invincibleDuration);
      if (typeof this.character.callbacks.onDodgeStart === "function") {
        this.character.callbacks.onDodgeStart();
      }
      this._drawRope(true);
      return true;
    }

    if (!super.requestDodge(direction)) return false;
    this._drawRope();
    return true;
  }

  update(delta) {
    if (!this.isDodgeActive) return;
    if (!this.character.sprite || !this.character.sprite.active) {
      this._endGrapple();
      return;
    }

    if (!this.anchor) {
      // フックのみ伸ばして静止する場合
      this.elapsed += delta;
      this.character.sprite.setVelocity(0, 0);
      if (typeof this.character.callbacks.onDodgeMove === "function") {
        this.character.callbacks.onDodgeMove();
      }
      if (this.elapsed >= this.config.duration) {
        this._endGrapple();
        this.isDodgeActive = false;
        if (typeof this.character.callbacks.onDodgeEnd === "function") {
          this.character.callbacks.onDodgeEnd();
        }
      }
      this._updateRope();
      return;
    }

    this.elapsed += delta;
    const sprite = this.character.sprite;
    const dx = this.anchor.x - sprite.x;
    const dy = this.anchor.y - sprite.y;
    const dist = Math.hypot(dx, dy);
    const speed = this.pullSpeed;
    if (dist <= speed || this.elapsed >= this.config.duration) {
      sprite.setPosition(this.anchor.x, this.anchor.y);
      sprite.setVelocity(0, 0);
      this._endGrapple();
      if (typeof this.character.callbacks.onDodgeEnd === "function") {
        this.character.callbacks.onDodgeEnd();
      }
      this.isDodgeActive = false;
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    sprite.setVelocity(nx * speed, ny * speed);
    if (typeof this.character.callbacks.onDodgeMove === "function") {
      this.character.callbacks.onDodgeMove();
    }
    this._updateRope();
  }

  _findAnchor(dir) {
    const scene = this.character.scene;
    const sprite = this.character.sprite;
    const anchors = this._collectAnchors(scene);

    let best = null;
    let bestDist = Infinity;
    anchors.forEach((a) => {
      const dx = a.x - sprite.x;
      const dy = a.y - sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist > this.hookRange || dist < 1) return;
      const dot = (dx * dir.x + dy * dir.y) / dist; // dir normalized
      // 45度以内
      if (dot < Math.cos(Math.PI / 4)) return;
      if (dist < bestDist) {
        best = a;
        bestDist = dist;
      }
    });
    return best;
  }

  _drawRope(forceFake = false) {
    const anchor = this.anchor || (forceFake ? this.fakeAnchor : null);
    if (!anchor) return;
    this._clearRope();
    const scene = this.character.scene;
    this.rope = scene.add.graphics({ x: 0, y: 0 });
    this.rope.setDepth(50);
    this.rope.lineStyle(4, 0xc5cae9, 0.8);
    this.rope.lineBetween(this.character.sprite.x, this.character.sprite.y, anchor.x, anchor.y);
  }

  _updateRope() {
    if (!this.rope) return;
    const anchor = this.anchor || this.fakeAnchor;
    if (!anchor) return;
    this.rope.clear();
    this.rope.lineStyle(4, 0xc5cae9, 0.8);
    this.rope.lineBetween(this.character.sprite.x, this.character.sprite.y, anchor.x, anchor.y);
  }

  _clearRope() {
    if (this.rope) {
      this.rope.destroy();
      this.rope = null;
    }
  }

  _endGrapple() {
    this.anchor = null;
    this.fakeAnchor = null;
    this._clearRope();
  }

  _normalize(direction) {
    if (!direction) return null;
    const dx = direction.x ?? 0;
    const dy = direction.y ?? 0;
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;
    return { x: dx / len, y: dy / len };
  }

  _collectAnchors(scene) {
    const anchors = [];
    const addAnchor = (obj) => {
      if (!obj || !obj.active) return;
      anchors.push({ x: obj.x, y: obj.y });
    };

    const combat = scene?.combatSystem;
    if (combat?.getEnemies) {
      combat.getEnemies()
        .map((e) => e && e.sprite)
        .filter((s) => s && s.active)
        .forEach(addAnchor);
    }

    const crates = scene?.spawnManager?.getCrates?.() || [];
    crates.forEach(addAnchor);

    // マップオブジェクト（木/岩など）を Matter の bodies から収集
    const bodies = scene?.matter?.world?.localWorld?.bodies || [];
    bodies.forEach((body) => {
      const go = body.gameObject;
      if (!go || !go.getData) return;

      const kind = go.getData("kind");

      // terrain オブジェクトをチェック（木、岩など）
      if (kind === "terrain") {
        addAnchor(go);
        return;
      }

      // その他の特殊なオブジェクトタイプもチェック
      const allowKind = new Set(["wall", "door", "cover", "crate", "baseNode"]);
      if (allowKind.has(kind)) {
        addAnchor(go);
      }
    });

    return anchors;
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
