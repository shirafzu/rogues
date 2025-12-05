class HookShotAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      range: 320,
      pullSpeed: 9,
      damage: 1,
      indicatorColor: 0xb39ddb,
      indicatorAlpha: 0.5,
      yankEnemy: false,
      pushEnemy: false,
      pullEnemyOnly: false,
      ...config,
    });
  }

  requestAttack(pointer) {
    if (!this.canExecute()) return false;

    const sprite = this.character.sprite;
    const combat = this.character.scene?.combatSystem;
    const { anchor, target } = this._resolveAnchor(combat);
    if (!anchor) return false;

    this.recordExecution();
    this._drawRope(sprite.x, sprite.y, anchor.x, anchor.y);
    this._moveToward(anchor, target);
    return true;
  }

  _resolveAnchor(combat) {
    const sprite = this.character.sprite;
    const dirFromInput = DirectionUtils.getDirectionFromInput(this.character) || DirectionUtils.getDirectionFromVelocity(this.character);
    const dirFromFacing = DirectionUtils.getFacingDirection(this.character);
    const targetSprite = combat?.getNearestEnemySprite
      ? combat.getNearestEnemySprite(sprite, { maxDistance: this.config.range })
      : null;

    if (targetSprite) {
      return { anchor: { x: targetSprite.x, y: targetSprite.y }, target: targetSprite };
    }

    const dir = dirFromInput || dirFromFacing || { x: 1, y: 0 };
    const anchor = {
      x: sprite.x + dir.x * this.config.range,
      y: sprite.y + dir.y * this.config.range,
    };
    return { anchor, target: null };
  }

  _drawRope(sx, sy, ex, ey) {
    const scene = this.character.scene;
    const rope = scene.add.graphics({ x: 0, y: 0 });
    rope.lineStyle(4, this.config.indicatorColor, this.config.indicatorAlpha);
    rope.lineBetween(sx, sy, ex, ey);
    scene.tweens.add({
      targets: rope,
      alpha: 0,
      duration: 180,
      onComplete: () => rope.destroy(),
    });
  }

  _moveToward(anchor, target) {
    const sprite = this.character.sprite;
    const dx = anchor.x - sprite.x;
    const dy = anchor.y - sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const travelDist = Math.min(dist, this.config.range);
    const duration = Math.min(420, (travelDist / (this.config.pullSpeed || 1)) * 100);
    const scene = this.character.scene;

    // pushEnemyモード：プレイヤーは動かず、敵だけを突き飛ばす
    if (this.config.pushEnemy && target && target.active) {
      // ダメージを与える
      if (scene.combatSystem) {
        scene.combatSystem.damageEnemySprite(target, this.config.damage);
      }
      // 敵をフックの最大距離まで突き飛ばす
      const pushTargetX = sprite.x + nx * this.config.range;
      const pushTargetY = sprite.y + ny * this.config.range;
      target.setPosition(pushTargetX, pushTargetY);
      return;
    }

    // pullEnemyOnlyモード：プレイヤーは動かず、敵だけを引き寄せる
    if (this.config.pullEnemyOnly && target && target.active) {
      // ダメージを与える
      if (scene.combatSystem) {
        scene.combatSystem.damageEnemySprite(target, this.config.damage);
      }
      // 敵をプレイヤーの近くに引き寄せる
      const pullOffset = this.config.forwardPullOffset ?? 60;
      target.setPosition(
        sprite.x + nx * pullOffset,
        sprite.y + ny * pullOffset
      );
      return;
    }

    sprite.setVelocity(nx * this.config.pullSpeed, ny * this.config.pullSpeed);
    scene.time.delayedCall(duration, () => {
      if (!sprite || !sprite.active) return;
      sprite.setVelocity(0, 0);
      sprite.setPosition(
        sprite.x + nx * (travelDist * 0.6),
        sprite.y + ny * (travelDist * 0.6)
      );
      if (target && target.active && scene.combatSystem) {
        scene.combatSystem.damageEnemySprite(target, this.config.damage);
        if (this.config.yankEnemy) {
          const pullOffset = this.config.forwardPullOffset ?? 24;
          target.setPosition(
            sprite.x + nx * pullOffset,
            sprite.y + ny * pullOffset
          );
        }
      }
    });
  }
}

window.AttackController = AttackController;
window.MeleeAoEAttackController = MeleeAoEAttackController;

window.HookShotAttackController = HookShotAttackController;
