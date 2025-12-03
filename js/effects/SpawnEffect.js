// オブジェクト生成エフェクト
// PlaceableItemControllerから抽出

class SpawnEffect extends BaseEffect {
  constructor(scene, config = {}) {
    super(scene, {
      radius: 30,
      depth: 2000,
      isStatic: true,
      isSensor: true,
      spawnAnimationDuration: 400,
      spawnAnimationEase: "Back.out",
      ...config
    });
  }

  /**
   * オブジェクトを生成
   * @param {Object} context - { position: {x, y}, entityType: "campfire" | "trap" }
   * @returns {boolean} - 生成が成功したか
   */
  execute(context) {
    const { position, entityType } = context;

    if (!position) {
      console.warn("SpawnEffect: position is required");
      return false;
    }

    if (!this.isSceneValid()) {
      console.warn("SpawnEffect: scene is not valid");
      return false;
    }

    const type = entityType || this.config.entityType;

    if (type === "campfire") {
      return this.spawnCampfire(position);
    } else if (type === "trap") {
      return this.spawnTrap(position);
    }

    console.warn(`SpawnEffect: unknown entity type "${type}"`);
    return false;
  }

  /**
   * 焚き火を生成
   */
  spawnCampfire(position) {
    const campfire = this.scene.add.circle(
      position.x,
      position.y,
      this.config.radius,
      0xff5722, // オレンジ色
      0.8
    );
    campfire.setDepth(this.config.depth);

    // 物理体を追加
    try {
      this.scene.matter.add.gameObject(campfire, {
        isStatic: this.config.isStatic,
        isSensor: this.config.isSensor
      });
    } catch (e) {
      console.error("Failed to add physics to campfire:", e);
    }

    // 生成アニメーション
    this.scene.tweens.add({
      targets: campfire,
      scale: { from: 0, to: 1 },
      duration: this.config.spawnAnimationDuration,
      ease: this.config.spawnAnimationEase,
    });

    return true;
  }

  /**
   * トラップを生成
   */
  spawnTrap(position) {
    const trap = this.scene.add.star(
      position.x,
      position.y,
      5,  // points
      10, // inner radius
      20, // outer radius
      0x9e9e9e, // グレー
      1   // alpha
    );
    trap.setDepth(100);

    // 物理体を追加
    try {
      this.scene.matter.add.gameObject(trap, {
        isStatic: true,
        isSensor: true
      });
    } catch (e) {
      console.error("Failed to add physics to trap:", e);
    }

    // 回転アニメーション
    this.scene.tweens.add({
      targets: trap,
      angle: 360,
      duration: 1000,
      ease: "Cubic.out",
    });

    return true;
  }
}

window.SpawnEffect = SpawnEffect;
