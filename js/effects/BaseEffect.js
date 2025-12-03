// エフェクトの基底クラス
// 回復、ダメージ、スポーン等の再利用可能なエフェクトロジック

class BaseEffect {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.config = config;
  }

  /**
   * エフェクトを実行
   * @param {Object} context - 実行コンテキスト（target, position等）
   * @returns {boolean} - 実行成功したか
   */
  execute(context) {
    // サブクラスで実装
    return false;
  }

  /**
   * シーンが有効かチェック
   */
  isSceneValid() {
    return this.scene && this.scene.sys && this.scene.sys.isActive();
  }
}

window.BaseEffect = BaseEffect;
