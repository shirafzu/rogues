// 方向計算ユーティリティ
// AttackController.jsから抽出

class DirectionUtils {
  /**
   * 入力方向から方向ベクトルを取得
   * タッチ開始位置から現在位置への方向
   */
  static getDirectionFromInput(character) {
    const input = character?.inputState;
    if (!input || input.activePointerId === null || !input.touchCurrentPos || !input.touchStartPos) {
      return null;
    }
    const dx = input.touchCurrentPos.x - input.touchStartPos.x;
    const dy = input.touchCurrentPos.y - input.touchStartPos.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return null;
    return { x: dx / len, y: dy / len };
  }

  /**
   * 速度ベクトルから方向ベクトルを取得
   */
  static getDirectionFromVelocity(character) {
    const body = character?.sprite?.body;
    if (!body || !body.velocity) return null;
    const vx = body.velocity.x || 0;
    const vy = body.velocity.y || 0;
    const len = Math.hypot(vx, vy);
    if (len < 0.1) return null;
    return { x: vx / len, y: vy / len };
  }

  /**
   * キャラクターの向きから方向ベクトルを取得
   */
  static getFacingDirection(character) {
    const sprite = character?.sprite;
    if (!sprite || typeof sprite.rotation !== "number") return null;
    return { x: Math.cos(sprite.rotation), y: Math.sin(sprite.rotation) };
  }

  /**
   * 優先順位に従って方向を取得
   * 入力 → 速度 → 向き の順で試行
   */
  static getDirection(character) {
    return (
      this.getDirectionFromInput(character) ||
      this.getDirectionFromVelocity(character) ||
      this.getFacingDirection(character)
    );
  }
}

window.DirectionUtils = DirectionUtils;
