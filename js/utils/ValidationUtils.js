// スプライト検証ユーティリティ
// 各コントローラーで繰り返されているチェックを統一

class ValidationUtils {
  /**
   * キャラクターが有効な状態かチェック
   * スプライトがアクティブで物理体が存在するか
   */
  static isCharacterValid(character) {
    return character?.sprite?.active && character.sprite.body;
  }

  /**
   * スプライトが有効な状態かチェック
   */
  static isSpriteValid(sprite) {
    return sprite && sprite.active;
  }

  /**
   * 物理体が有効な状態かチェック
   */
  static isBodyValid(body) {
    return body && body.velocity !== undefined;
  }

  /**
   * キャラクターのスプライトを取得（null安全）
   */
  static getSprite(character) {
    if (!character || !character.sprite || !character.sprite.active) {
      return null;
    }
    return character.sprite;
  }

  /**
   * キャラクターの物理体を取得（null安全）
   */
  static getBody(character) {
    const sprite = this.getSprite(character);
    if (!sprite || !sprite.body) {
      return null;
    }
    return sprite.body;
  }
}

window.ValidationUtils = ValidationUtils;
