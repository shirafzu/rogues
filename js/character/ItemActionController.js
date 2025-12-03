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

class HealingItemController extends ItemActionController {
    constructor(character, config = {}) {
        super(character, {
            healAmount: 2,
            cooldown: 1000,
            ...config,
        });

        // HealEffectを初期化
        this.healEffect = new HealEffect(character.scene, {
            healAmount: this.config.healAmount
        });
    }

    performAction() {
        const sprite = this.character.sprite;
        if (!sprite) return false;

        // HealEffectを使用して回復
        return this.healEffect.execute({
            target: this.character,
            position: { x: sprite.x, y: sprite.y }
        });
    }
}

class PlaceableItemController extends ItemActionController {
    constructor(character, config = {}) {
        super(character, {
            placeEntityId: "campfire",
            cooldown: 2000,
            maxRange: 150,
            offsetY: 40,
            ...config,
        });

        // SpawnEffectを初期化
        this.spawnEffect = new SpawnEffect(character.scene);
    }

    performAction(pointer) {
        const sprite = this.character.sprite;
        if (!sprite) return false;

        // 設置位置の決定
        let targetX = sprite.x;
        let targetY = sprite.y + this.config.offsetY;

        // ポインタが有効な場合は射程チェック
        if (pointer && typeof pointer.x === 'number' && typeof pointer.y === 'number') {
            const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, pointer.x, pointer.y);
            if (dist > this.config.maxRange) return false; // 射程外

            targetX = pointer.x;
            targetY = pointer.y + this.config.offsetY;
        }

        // アイテムIDに応じたエンティティタイプを決定
        let entityType = "campfire";
        if (this.config.itemId === "spike_trap") {
            entityType = "trap";
        } else if (this.config.itemId === "campfire_kit") {
            entityType = "campfire";
        }

        // SpawnEffectを使用してオブジェクトを生成
        return this.spawnEffect.execute({
            position: { x: targetX, y: targetY },
            entityType: entityType
        });
    }
}

class ThrowingItemController extends ItemActionController {
    constructor(character, config = {}) {
        super(character, {
            projectileSpeed: 10,
            damage: 1,
            range: 300,
            ...config,
        });

        // ProjectileEffectを初期化
        this.projectileEffect = new ProjectileEffect(character.scene, {
            speed: this.config.projectileSpeed,
            damage: this.config.damage
        });
    }

    performAction(pointer) {
        const sprite = this.character.sprite;
        if (!sprite) return false;

        // ターゲット方向の計算
        let targetX = sprite.x + 100; // デフォルトは右
        let targetY = sprite.y;

        if (pointer && typeof pointer.x === 'number' && typeof pointer.y === 'number') {
            targetX = pointer.x;
            targetY = pointer.y;
        }

        const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, targetX, targetY);

        // ProjectileEffectを使用して投射物を生成
        return this.projectileEffect.execute({
            position: { x: sprite.x, y: sprite.y },
            angle: angle
        });
    }
}

window.ItemActionController = ItemActionController;
window.HealingItemController = HealingItemController;
window.PlaceableItemController = PlaceableItemController;
window.ThrowingItemController = ThrowingItemController;
