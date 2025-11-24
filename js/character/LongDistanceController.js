/**
 * 長距離移動コントローラー
 * 指定方向に自動的に移動し続ける
 */
class LongDistanceController {
  constructor(character, config = {}) {
    this.character = character;
    this.config = {
      speedMultiplier: 1.5,
      autoStopDistance: 1500,
      useAcceleration: false,
      minSpeedMultiplier: 1.0,
      maxSpeedMultiplier: 2.0,
      accelPerSecond: 3.0,
      decelPerSecond: 4.0,
      ...config,
    };

    this.isActive = false;
    this.direction = null;
    this.startPos = null;
    this.traveledDistance = 0;
    this.currentSpeed = 0;
  }

  /**
   * 長距離移動を開始
   * @param {Object} direction - 移動方向 {x, y}
   * @returns {boolean} 開始に成功したかどうか
   */
  requestLongDistance(direction) {
    if (this.isActive || !direction) return false;

    // spriteとbodyの存在確認
    if (!this.character.sprite || !this.character.sprite.body) {
      return false;
    }

    const len = Math.hypot(direction.x, direction.y);
    if (len === 0) return false;

    this.isActive = true;
    this.direction = {
      x: direction.x / len,
      y: direction.y / len,
    };
    this.startPos = {
      x: this.character.sprite.x,
      y: this.character.sprite.y,
    };
    this.traveledDistance = 0;
    this.currentSpeed = this.config.useAcceleration
      ? this.character.moveSpeed * this.config.minSpeedMultiplier
      : this.character.moveSpeed * this.config.speedMultiplier;

    if (typeof this.character.callbacks.onLongDistanceStart === "function") {
      this.character.callbacks.onLongDistanceStart(this.direction);
    }

    return true;
  }

  /**
   * 長距離移動を停止
   */
  stop() {
    if (!this.isActive) return;

    this.isActive = false;
    this.direction = null;
    this.currentSpeed = 0;

    // spriteとsetVelocityメソッドの存在確認
    if (this.character.sprite && this.character.sprite.setVelocity) {
      this.character.sprite.setVelocity(0, 0);
    }

    if (typeof this.character.callbacks.onLongDistanceStop === "function") {
      this.character.callbacks.onLongDistanceStop();
    }
  }

  /**
   * 毎フレーム更新
   */
  update(delta) {
    if (!this.isActive || !this.direction) return;

    // spriteとbodyの存在確認
    if (!this.character.sprite || !this.character.sprite.body) return;

    // 移動距離を計算
    const currentPos = {
      x: this.character.sprite.x,
      y: this.character.sprite.y,
    };
    this.traveledDistance = Math.hypot(
      currentPos.x - this.startPos.x,
      currentPos.y - this.startPos.y
    );

    // 自動停止判定
    if (this.traveledDistance >= this.config.autoStopDistance) {
      this.stop();
      return;
    }

    // 壁との衝突判定（速度がほぼ0になった場合）
    const body = this.character.sprite.body;
    if (body && body.velocity && typeof body.velocity.x === 'number' && typeof body.velocity.y === 'number') {
      const speed = Math.hypot(body.velocity.x, body.velocity.y);
      if (speed < 0.5) {
        this.stop();
        return;
      }
    }

    // 速度計算
    let targetSpeed;
    if (this.config.useAcceleration) {
      // 加速型
      const dt = delta / 1000;
      const maxSpeed = this.character.moveSpeed * this.config.maxSpeedMultiplier;
      this.currentSpeed = Math.min(
        maxSpeed,
        this.currentSpeed + this.config.accelPerSecond * dt
      );
      targetSpeed = this.currentSpeed;
    } else {
      // 固定速度型
      targetSpeed = this.character.moveSpeed * this.config.speedMultiplier;
    }

    // 速度を適用（bodyが正常に初期化されている場合のみ）
    if (this.character.sprite.setVelocity) {
      this.character.sprite.setVelocity(
        this.direction.x * targetSpeed,
        this.direction.y * targetSpeed
      );
    }
  }

  /**
   * 長距離移動中かどうか
   */
  isMoving() {
    return this.isActive;
  }
}

/**
 * 固定速度型長距離移動コントローラー
 */
class SteadyLongDistanceController extends LongDistanceController {
  constructor(character, config = {}) {
    super(character, {
      speedMultiplier: 1.5,
      useAcceleration: false,
      ...config,
    });
  }
}

/**
 * 加速型長距離移動コントローラー
 */
class AcceleratingLongDistanceController extends LongDistanceController {
  constructor(character, config = {}) {
    super(character, {
      minSpeedMultiplier: 1.0,
      maxSpeedMultiplier: 2.0,
      accelPerSecond: 3.0,
      useAcceleration: true,
      ...config,
    });
  }
}

window.LongDistanceController = LongDistanceController;
window.SteadyLongDistanceController = SteadyLongDistanceController;
window.AcceleratingLongDistanceController = AcceleratingLongDistanceController;
