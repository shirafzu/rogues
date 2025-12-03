// ItemActionController - BaseActionControllerを継承
// Effectシステムを使用してロジックを分離

class ItemActionController extends BaseActionController {
    constructor(character, config = {}) {
        super(character, {
            cooldown: 500,
            itemId: null,
            consumeAmount: 1,
            ...config,
        });
    }

    // canExecute()をオーバーライドしてインベントリチェックを追加
    canExecute() {
        // 基本チェック（スプライト有効性とクールダウン）
        if (!super.canExecute()) return false;

        // インベントリチェック
        const inventory = this.character.scene.inventory;
        if (!inventory) return false;

        if (this.config.itemId) {
            const amount = inventory.getResourceAmount(this.config.itemId);
            if (amount < this.config.consumeAmount) {
                console.log("Not enough items");
                return false;
            }
        }

        return true;
    }

    requestUse(pointer) {
        if (!this.canExecute()) return false;

        if (this.performAction(pointer)) {
            this.recordExecution();

            // アイテムを消費
            const inventory = this.character.scene.inventory;
            if (this.config.itemId && inventory) {
                inventory.removeResource(this.config.itemId, this.config.consumeAmount);
            }
            return true;
        }
        return false;
    }

    performAction(_pointer) {
        return false;
    }

    // update()とrecordExecution()はBaseActionControllerから継承
}

window.ItemActionController = ItemActionController;
