// MeleeAoEAttackController - 近接AoE攻撃コントローラー
// プレイヤーの周囲に円形の攻撃範囲を展開

class MeleeAoEAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      radius: 120,
      indicatorColor: 0xffffff,
      indicatorAlpha: 0.15,
      ...config,
    });
  }

  requestAttack(pointer) {
    if (!this.canExecute()) return false;

    const sprite = this.character.sprite;
    this.recordExecution();
    const centerX = sprite.x;
    const centerY = sprite.y;

    // 攻撃を可視化
    const gfx = this.character.scene.add.circle(
      centerX,
      centerY,
      this.config.radius,
      this.config.indicatorColor,
      this.config.indicatorAlpha
    );
    this.character.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 150,
      onComplete: () => gfx.destroy(),
    });

    if (typeof this.character.callbacks.onAttackArea === "function") {
      this.character.callbacks.onAttackArea({
        type: "circle",
        centerX,
        centerY,
        radius: this.config.radius,
        pointer,
      });
    }
    return true;
  }
}

window.MeleeAoEAttackController = MeleeAoEAttackController;
