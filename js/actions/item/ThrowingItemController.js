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

window.ThrowingItemController = ThrowingItemController;
