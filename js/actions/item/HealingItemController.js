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

window.HealingItemController = HealingItemController;
