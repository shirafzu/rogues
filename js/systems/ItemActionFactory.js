// ItemActionFactory - データ駆動型のアイテムコントローラー生成
// RESOURCE_DEFINITIONSのactionConfigからコントローラーを自動生成

class ItemActionFactory {
  // コントローラータイプのレジストリ
  static controllerRegistry = {
    "healing": HealingItemController,
    "placeable": PlaceableItemController,
    "throwing": ThrowingItemController,
  };

  /**
   * アイテムIDに対応するコントローラーを作成
   * @param {Character} character - キャラクターインスタンス
   * @param {string} itemId - アイテムID
   * @returns {ItemActionController|null} - 生成されたコントローラー、またはnull
   */
  static createController(character, itemId) {
    // アイテム定義を取得
    const itemDef = RESOURCE_DEFINITIONS[itemId];

    if (!itemDef) {
      console.warn(`ItemActionFactory: Item definition not found for "${itemId}"`);
      return null;
    }

    // actionConfigがない場合（素材など）
    if (!itemDef.actionConfig) {
      console.warn(`ItemActionFactory: No action config for item "${itemId}"`);
      return null;
    }

    const { controllerType, ...config } = itemDef.actionConfig;

    // コントローラークラスを取得
    const ControllerClass = this.controllerRegistry[controllerType];

    if (!ControllerClass) {
      console.warn(`ItemActionFactory: No controller registered for type "${controllerType}"`);
      return null;
    }

    // コントローラーを生成
    return new ControllerClass(character, {
      itemId: itemId,
      consumeAmount: 1,
      ...config
    });
  }

  /**
   * 新しいコントローラータイプを登録（拡張用）
   * @param {string} type - コントローラータイプ名
   * @param {class} ControllerClass - コントローラークラス
   */
  static registerController(type, ControllerClass) {
    this.controllerRegistry[type] = ControllerClass;
    console.log(`ItemActionFactory: Registered controller type "${type}"`);
  }

  /**
   * 登録されているすべてのコントローラータイプを取得
   * @returns {string[]} - コントローラータイプ名の配列
   */
  static getRegisteredTypes() {
    return Object.keys(this.controllerRegistry);
  }

  /**
   * アイテムが使用可能かチェック（actionConfigがあるか）
   * @param {string} itemId - アイテムID
   * @returns {boolean} - 使用可能かどうか
   */
  static isUsableItem(itemId) {
    const itemDef = RESOURCE_DEFINITIONS[itemId];
    return itemDef && itemDef.actionConfig !== undefined;
  }
}

window.ItemActionFactory = ItemActionFactory;
