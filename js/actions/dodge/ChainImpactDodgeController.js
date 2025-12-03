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

window.ChainImpactDodgeController = ChainImpactDodgeController;
