class LinePierceAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      length: 520,
      width: 32,
      damage: 2,
      indicatorColor: 0x4dd0e1,
      indicatorAlpha: 0.5,
      ...config,
    });
  }

  requestAttack(pointer) {
    if (!this.canExecute()) return false;

    const sprite = this.character.sprite;
    this.recordExecution();

    const { startX, startY, dir } = this._resolveDirection();
    const endX = startX + dir.x * this.config.length;
    const endY = startY + dir.y * this.config.length;
    const scene = this.character.scene;

    const gfx = scene.add.graphics({ x: 0, y: 0 });
    gfx.lineStyle(this.config.width, this.config.indicatorColor, this.config.indicatorAlpha);
    gfx.lineBetween(startX, startY, endX, endY);
    scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 160,
      onComplete: () => gfx.destroy(),
    });

    this._damageAlongLine(startX, startY, endX, endY);
    return true;
  }

  _resolveDirection() {
    const sprite = this.character.sprite;
    const combat = this.character.scene?.combatSystem;
    const dirFromInput = DirectionUtils.getDirectionFromInput(this.character) || DirectionUtils.getDirectionFromVelocity(this.character);
    const dirFromFacing = DirectionUtils.getFacingDirection(this.character);
    const target = combat?.getNearestEnemySprite
      ? combat.getNearestEnemySprite(sprite, { maxDistance: this.config.length })
      : null;

    if (target) {
      const dx = target.x - sprite.x;
      const dy = target.y - sprite.y;
      const len = Math.hypot(dx, dy) || 1;
      return { startX: sprite.x, startY: sprite.y, dir: { x: dx / len, y: dy / len } };
    }

    const dir = dirFromInput || dirFromFacing || { x: 1, y: 0 };
    return { startX: sprite.x, startY: sprite.y, dir };
  }

  _damageAlongLine(x1, y1, x2, y2) {
    const combat = this.character.scene?.combatSystem;
    if (!combat || !combat.getEnemies) return;

    const enemies = combat.getEnemies()
      .map((enemy) => enemy && enemy.sprite)
      .filter((s) => s && s.active);

    const lineLenSq = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1;
    enemies.forEach((enemy) => {
      const proj = ((enemy.x - x1) * (x2 - x1) + (enemy.y - y1) * (y2 - y1)) / lineLenSq;
      if (proj < 0 || proj > 1) return;
      const closestX = x1 + (x2 - x1) * proj;
      const closestY = y1 + (y2 - y1) * proj;
      const dist = Math.hypot(enemy.x - closestX, enemy.y - closestY);
      if (dist <= this.config.width * 0.6) {
        combat.damageEnemySprite(enemy, this.config.damage);
        combat.igniteEntity(enemy);
      }
    });
  }
}


window.LinePierceAttackController = LinePierceAttackController;
