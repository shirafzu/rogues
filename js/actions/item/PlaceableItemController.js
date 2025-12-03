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

window.PlaceableItemController = PlaceableItemController;
