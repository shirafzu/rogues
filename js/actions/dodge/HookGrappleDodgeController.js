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
      const allowKind = new Set(["tree", "rock", "object", "wall", "house_object"]);
      if (allowKind.has(kind)) {
        addAnchor(go);
      }
    });

    return anchors;
  }
}

window.HookGrappleDodgeController = HookGrappleDodgeController;
