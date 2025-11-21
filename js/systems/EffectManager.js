/**
 * EffectManager
 * 視覚エフェクトを管理
 */
class EffectManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.playerController = null;

    // 長距離移動エフェクト
    this.longDistanceEffects = {
      active: false,
      trail: null,
      speedLines: [],
      trailPoints: [],
    };
  }

  /**
   * プレイヤーコントローラーを設定
   */
  setPlayerController(playerController) {
    this.playerController = playerController;
  }

  /**
   * 長距離移動エフェクトを開始
   */
  startLongDistanceEffects() {
    if (!this.playerController?.sprite) return;

    this.longDistanceEffects.active = true;
    this.longDistanceEffects.trailPoints = [];

    // トレイル用のGraphicsオブジェクトを作成
    if (!this.longDistanceEffects.trail) {
      this.longDistanceEffects.trail = this.scene.add.graphics();
      this.longDistanceEffects.trail.setDepth(this.playerController.sprite.depth - 1);
    }

    // プレイヤーの色を取得
    const baseColor = this.playerController.baseColor || 0x4caf50;

    // スピードラインを作成（4本）
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI * 2) / 4; // 90度ずつ配置
      const line = this.scene.add.graphics();
      line.setDepth(this.playerController.sprite.depth - 1);
      this.longDistanceEffects.speedLines.push({
        graphics: line,
        angle: angle,
        color: baseColor,
      });
    }
  }

  /**
   * 長距離移動エフェクトを停止
   */
  stopLongDistanceEffects() {
    this.longDistanceEffects.active = false;

    // トレイルをクリア
    if (this.longDistanceEffects.trail) {
      this.longDistanceEffects.trail.clear();
    }

    // スピードラインを削除
    this.longDistanceEffects.speedLines.forEach((line) => {
      if (line.graphics) {
        line.graphics.destroy();
      }
    });
    this.longDistanceEffects.speedLines = [];
    this.longDistanceEffects.trailPoints = [];
  }

  /**
   * 長距離移動エフェクトを更新
   */
  updateLongDistanceEffects() {
    if (!this.longDistanceEffects.active || !this.playerController?.sprite) {
      return;
    }

    const player = this.playerController.sprite;
    const currentPos = { x: player.x, y: player.y };

    // トレイルエフェクト：残像を描画
    this.longDistanceEffects.trailPoints.push({
      x: currentPos.x,
      y: currentPos.y,
      alpha: 1.0,
    });

    // トレイルポイントを更新（古いものを薄くする）
    this.longDistanceEffects.trailPoints = this.longDistanceEffects.trailPoints
      .map((point) => ({
        ...point,
        alpha: point.alpha - 0.05,
      }))
      .filter((point) => point.alpha > 0);

    // トレイルを描画
    if (this.longDistanceEffects.trail) {
      const trail = this.longDistanceEffects.trail;
      trail.clear();

      const baseColor = this.playerController.baseColor || 0x4caf50;

      this.longDistanceEffects.trailPoints.forEach((point) => {
        const size = 50 * point.alpha;
        trail.fillStyle(baseColor, point.alpha * 0.3);
        trail.fillCircle(point.x, point.y, size / 2);
      });
    }

    // スピードライン：プレイヤーの周りに回転する線を描画
    const velocity = player.body.velocity;
    const speed = Math.hypot(velocity.x, velocity.y);

    if (speed > 2) {
      const direction = { x: velocity.x / speed, y: velocity.y / speed };

      this.longDistanceEffects.speedLines.forEach((line) => {
        if (!line.graphics) return;

        const graphics = line.graphics;
        graphics.clear();

        const baseColor = line.color || 0x4caf50;

        // 速度に応じて線の長さを調整
        const lineLength = Math.min(80 + speed * 2, 150);
        const lineWidth = 3;

        // 進行方向と逆向きに線を配置
        const offsetAngle = line.angle;
        const offsetDist = 40;
        const startX = player.x - direction.x * offsetDist + Math.cos(offsetAngle) * 20;
        const startY = player.y - direction.y * offsetDist + Math.sin(offsetAngle) * 20;
        const endX = startX - direction.x * lineLength;
        const endY = startY - direction.y * lineLength;

        // グラデーション風に描画
        graphics.lineStyle(lineWidth, baseColor, 0.6);
        graphics.lineBetween(startX, startY, endX, endY);
      });
    }
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.stopLongDistanceEffects();

    if (this.longDistanceEffects.trail) {
      this.longDistanceEffects.trail.destroy();
      this.longDistanceEffects.trail = null;
    }
  }
}

window.EffectManager = EffectManager;
