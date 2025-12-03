// 投射物エフェクト
// ThrowingItemControllerから抽出

class ProjectileEffect extends BaseEffect {
  constructor(scene, config = {}) {
    super(scene, {
      speed: 10,
      damage: 1,
      radius: 5,
      color: 0x8d6e63,
      alpha: 1,
      lifetime: 1000,
      depth: 1000,
      frictionAir: 0,
      ...config
    });
  }

  /**
   * 投射物を生成
   * @param {Object} context - { position: {x, y}, angle: number, direction: {x, y} }
   * @returns {boolean} - 生成が成功したか
   */
  execute(context) {
    const { position, angle, direction } = context;

    if (!position) {
      console.warn("ProjectileEffect: position is required");
      return false;
    }

    if (!this.isSceneValid()) {
      console.warn("ProjectileEffect: scene is not valid");
      return false;
    }

    // 角度の計算
    let finalAngle = angle;
    if (direction && finalAngle === undefined) {
      finalAngle = Math.atan2(direction.y, direction.x);
    }
    if (finalAngle === undefined) {
      console.warn("ProjectileEffect: angle or direction is required");
      return false;
    }

    // 速度の計算
    const velocityX = Math.cos(finalAngle) * this.config.speed;
    const velocityY = Math.sin(finalAngle) * this.config.speed;

    // 投射物の生成
    const projectile = this.scene.add.circle(
      position.x,
      position.y,
      this.config.radius,
      this.config.color,
      this.config.alpha
    );

    // 物理体を追加
    try {
      this.scene.matter.add.gameObject(projectile);
      projectile.setFrictionAir(this.config.frictionAir);
      projectile.setVelocity(velocityX, velocityY);
      projectile.setDepth(this.config.depth);
    } catch (e) {
      console.error("Failed to add physics to projectile:", e);
      projectile.destroy();
      return false;
    }

    // 一定時間後に消滅
    this.scene.time.delayedCall(this.config.lifetime, () => {
      if (projectile && projectile.active) {
        projectile.destroy();
      }
    });

    return true;
  }
}

window.ProjectileEffect = ProjectileEffect;
