// AlternatingSlashAttackController - 交互に左右に斬撃を繰り出す攻撃
// 最も近い敵に対して交互にスラッシュ攻撃を行う

class AlternatingSlashAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      range: 140,
      damage: 2,
      slashWidth: 24,
      slashLength: 80,
      ...config,
    });
    this.swingLeft = false;
  }

  requestAttack() {
    if (!this.canExecute()) return false;

    const combat = this.character.scene.combatSystem;
    if (!combat) return false;

    const target = combat.getNearestEnemySprite(this.character.sprite);
    if (!target) return false;

    this.recordExecution();
    this.swingLeft = !this.swingLeft;

    const dirX = target.x - this.character.sprite.x;
    const dirY = target.y - this.character.sprite.y;
    const distance = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / distance;
    const ny = dirY / distance;

    const perpX = this.swingLeft ? -ny : ny;
    const perpY = this.swingLeft ? nx : -nx;

    const slash = this.character.scene.add.rectangle(
      this.character.sprite.x + nx * this.config.slashLength * 0.3,
      this.character.sprite.y + ny * this.config.slashLength * 0.3,
      this.config.slashLength,
      this.config.slashWidth,
      0xffe082,
      0.35
    );
    slash.setRotation(Math.atan2(ny, nx));
    this.character.scene.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 120,
      onComplete: () => slash.destroy(),
    });

    combat.damageEnemySprite(target, this.config.damage);
    combat.igniteEntity(target);
    return true;
  }
}

window.AlternatingSlashAttackController = AlternatingSlashAttackController;
