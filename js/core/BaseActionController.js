// アクションコントローラーの基底クラス
// AttackController、ItemActionController、DodgeController等の共通ロジックを集約

class BaseActionController {
  constructor(character, config = {}) {
    this.character = character;
    this.config = {
      cooldown: 500,
      ...config,
    };
    this.lastExecutionTime = 0;
  }

  /**
   * 共通の実行可能チェック
   * スプライトの有効性とクールダウンをチェック
   */
  canExecute() {
    // スプライト検証
    if (!ValidationUtils.isCharacterValid(this.character)) {
      return false;
    }

    // クールダウンチェック
    const now = this.character.scene.time.now;
    return now - this.lastExecutionTime >= this.config.cooldown;
  }

  /**
   * 実行時間を記録（クールダウンのため）
   */
  recordExecution() {
    this.lastExecutionTime = this.character.scene.time.now;
  }

  /**
   * アクション実行メソッド（サブクラスでオーバーライド）
   * @param {*} context - 実行コンテキスト（pointer, direction等）
   * @returns {boolean} - 実行成功したか
   */
  requestAction(context) {
    return false;
  }

  /**
   * 更新ループ（必要に応じてサブクラスでオーバーライド）
   * @param {number} delta - 前フレームからの経過時間
   */
  update(delta) {
    // サブクラスで実装
  }

  /**
   * アクティブ状態チェック（必要に応じてサブクラスでオーバーライド）
   * @returns {boolean} - アクティブかどうか
   */
  isActive() {
    return false;
  }

  /**
   * 移動をブロックするかチェック（必要に応じてサブクラスでオーバーライド）
   * @returns {boolean} - 移動をブロックするか
   */
  blocksMovement() {
    return false;
  }

  /**
   * 残りクールダウン時間を取得（ミリ秒）
   * @returns {number} - 残りクールダウン時間
   */
  getRemainingCooldown() {
    const now = this.character.scene.time.now;
    const elapsed = now - this.lastExecutionTime;
    const remaining = this.config.cooldown - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * クールダウンが完了しているか
   * @returns {boolean}
   */
  isCooldownReady() {
    return this.getRemainingCooldown() === 0;
  }
}

window.BaseActionController = BaseActionController;
