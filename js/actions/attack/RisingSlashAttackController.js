class RisingSlashAttackController extends AttackController {
  constructor(character, config = {}) {
    super(character, {
      radius: 160,
      damage: 2,
      indicatorColor: 0x90caf9,
      indicatorAlpha: 0.25,
      knockbackRadius: 190,
      ...config,
    });
  }

  requestAttack(pointer) {
    if (!this.canExecute()) return false;

    const sprite = this.character.sprite;
    this.recordExecution();

    const scene = this.character.scene;
    const centerX = sprite.x;
    const centerY = sprite.y;
    const slash = scene.add.circle(
      centerX,
      centerY,
      this.config.radius,
      this.config.indicatorColor,
      this.config.indicatorAlpha
    );
    scene.tweens.add({
      targets: slash,
      scale: 1.2,
      alpha: 0,
      duration: 200,
      onComplete: () => slash.destroy(),
    });

    if (typeof this.character.callbacks.onAttackArea === "function") {
      this.character.callbacks.onAttackArea({
        type: "circle",
        centerX,
        centerY,
        radius: this.config.radius,
        damage: this.config.damage,
        pointer,
      });
    }

    // 軽い吹き飛ばし
    const combat = scene.combatSystem;
    if (combat && combat.applyRadialPush) {
      combat.applyRadialPush(
        { x: centerX, y: centerY },
        this.config.knockbackRadius,
        0,
        this.character
      );
    }
    return true;
  }
}


window.RisingSlashAttackController = RisingSlashAttackController;
