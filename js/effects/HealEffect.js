// HP回復エフェクト
// HealingItemControllerから抽出

class HealEffect extends BaseEffect {
  constructor(scene, config = {}) {
    super(scene, {
      healAmount: 2,
      showVisualEffect: true,
      effectColor: 0x66bb6a,
      effectAlpha: 0.5,
      effectRadius: 30,
      effectDuration: 600,
      ...config
    });
  }

  /**
   * 回復エフェクトを実行
   * @param {Object} context - { target: Character, position: {x, y} }
   * @returns {boolean} - 回復が実行されたか
   */
  execute(context) {
    const { target, position } = context;

    if (!target) {
      console.warn("HealEffect: target is required");
      return false;
    }

    // HPが満タンの場合は回復しない
    if (target.hp >= target.maxHp) {
      console.log("HP is full");
      return false;
    }

    // HP回復処理
    const oldHp = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + this.config.healAmount);

    if (target.hp > oldHp) {
      // コールバック通知
      if (typeof target.callbacks?.onHpChanged === "function") {
        target.callbacks.onHpChanged(target.hp, target.maxHp);
      }

      // ビジュアルエフェクト表示
      if (this.config.showVisualEffect && this.isSceneValid()) {
        const effectPos = position || (target.sprite ? { x: target.sprite.x, y: target.sprite.y } : null);
        if (effectPos) {
          this.showHealEffect(effectPos, this.config.healAmount);
        }
      }

      return true;
    }

    return false;
  }

  /**
   * 回復の視覚エフェクトを表示
   */
  showHealEffect(position, amount) {
    // 円形エフェクト
    const gfx = this.scene.add.circle(
      position.x,
      position.y,
      this.config.effectRadius,
      this.config.effectColor,
      this.config.effectAlpha
    );

    this.scene.tweens.add({
      targets: gfx,
      scale: 1.5,
      alpha: 0,
      duration: this.config.effectDuration,
      onComplete: () => gfx.destroy(),
    });

    // テキスト表示
    const text = this.scene.add.text(
      position.x,
      position.y - 40,
      `+${amount}`,
      {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#66bb6a",
        stroke: "#000",
        strokeThickness: 3,
      }
    ).setOrigin(0.5);

    this.scene.tweens.add({
      targets: text,
      y: position.y - 80,
      alpha: 0,
      duration: 800,
      onComplete: () => text.destroy(),
    });
  }
}

window.HealEffect = HealEffect;
