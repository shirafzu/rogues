class ItemActionController {
    constructor(character, config = {}) {
        this.character = character;
        this.config = {
            cooldown: 500,
            itemId: null,
            consumeAmount: 1,
            ...config,
        };
        this.lastUseTime = 0;
    }

    requestUse(pointer) {
        if (!this.canUse()) return false;

        // インベントリチェック
        const inventory = this.character.scene.inventory;
        if (!inventory) return false;

        if (this.config.itemId) {
            const amount = inventory.getResourceAmount(this.config.itemId);
            if (amount < this.config.consumeAmount) {
                // UI通知など
                console.log("Not enough items");
                return false;
            }
        }

        if (this.performAction(pointer)) {
            this.recordUseTime();
            if (this.config.itemId) {
                inventory.removeResource(this.config.itemId, this.config.consumeAmount);
            }
            return true;
        }
        return false;
    }

    performAction(_pointer) {
        return false;
    }

    update() { }

    canUse() {
        const now = this.character.scene.time.now;
        return now - this.lastUseTime >= this.config.cooldown;
    }

    recordUseTime() {
        this.lastUseTime = this.character.scene.time.now;
    }
}

class HealingItemController extends ItemActionController {
    constructor(character, config = {}) {
        super(character, {
            healAmount: 2,
            cooldown: 1000,
            ...config,
        });
    }

    performAction() {
        if (this.character.hp >= this.character.maxHp) {
            console.log("HP is full");
            return false;
        }

        // 回復処理（負のダメージとして処理するか、直接HP操作するか）
        // CharacterControllerにhealメソッドがないので、直接操作してコールバックを呼ぶか、
        // takeDamageの逆を行うメソッドを追加するのが綺麗だが、
        // ここでは簡易的に実装
        const oldHp = this.character.hp;
        this.character.hp = Math.min(this.character.maxHp, this.character.hp + this.config.healAmount);

        if (this.character.hp > oldHp) {
            if (typeof this.character.callbacks.onHpChanged === "function") {
                this.character.callbacks.onHpChanged(this.character.hp, this.character.maxHp);
            }

            // エフェクト
            const sprite = this.character.sprite;
            if (sprite) {
                const gfx = this.character.scene.add.circle(sprite.x, sprite.y, 30, 0x66bb6a, 0.5);
                this.character.scene.tweens.add({
                    targets: gfx,
                    scale: 1.5,
                    alpha: 0,
                    duration: 600,
                    onComplete: () => gfx.destroy(),
                });

                // テキスト
                const text = this.character.scene.add.text(sprite.x, sprite.y - 40, `+${this.config.healAmount}`, {
                    fontFamily: "sans-serif",
                    fontSize: "20px",
                    color: "#66bb6a",
                    stroke: "#000",
                    strokeThickness: 3,
                }).setOrigin(0.5);

                this.character.scene.tweens.add({
                    targets: text,
                    y: sprite.y - 80,
                    alpha: 0,
                    duration: 800,
                    onComplete: () => text.destroy(),
                });
            }
            return true;
        }
        return false;
    }
}

class PlaceableItemController extends ItemActionController {
    constructor(character, config = {}) {
        super(character, {
            placeEntityId: "campfire", // 仮
            cooldown: 2000,
            ...config,
        });
    }

    performAction(pointer) {
        // 設置位置の決定（プレイヤーの足元、またはタップ位置）
        // タップ位置の場合は射程制限が必要
        const sprite = this.character.sprite;
        if (!sprite) return false;

        let targetX, targetY;
        // ポインタが有効かつ座標を持っている場合のみ使用
        if (pointer && typeof pointer.x === 'number' && typeof pointer.y === 'number') {
            targetX = pointer.x;
            targetY = pointer.y;
            const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, targetX, targetY);
            if (dist > 150) return false; // 射程外
        } else {
            targetX = sprite.x;
            targetY = sprite.y;
        }

        // 設置処理（SpawnManager経由などが望ましいが、ここでは簡易実装）
        // Campfire Kitの場合
        if (this.config.itemId === "campfire_kit") {
            // プレイヤーの足元より少し下にずらす（重なり回避）
            targetY += 40;

            // 簡易的な焚き火を設置
            const campfire = this.character.scene.add.circle(targetX, targetY, 30, 0xff5722, 0.8); // オレンジに戻す
            campfire.setDepth(2000); // 最前面

            // 物理体を追加（エラーハンドリング）
            try {
                this.character.scene.matter.add.gameObject(campfire, { isStatic: true, isSensor: true });
            } catch (e) {
                console.error("Failed to add physics to campfire:", e);
            }

            // エフェクト
            this.character.scene.tweens.add({
                targets: campfire,
                scale: { from: 0, to: 1 },
                duration: 400,
                ease: "Back.out",
            });

            return true;
        }
        // Spike Trapの場合
        else if (this.config.itemId === "spike_trap") {
            // プレイヤーの足元より少し下にずらす
            targetY += 40;

            // スパイクの罠を設置
            // ギザギザの円（Star）で表現
            const trap = this.character.scene.add.star(targetX, targetY, 5, 10, 20, 0x9e9e9e, 1);
            trap.setDepth(100);

            try {
                const body = this.character.scene.matter.add.gameObject(trap, { isStatic: true, isSensor: true });
                // 衝突判定などは別途CollisionSystemが必要だが、ここでは視覚効果のみ
            } catch (e) {
                console.error("Failed to add physics to trap:", e);
            }

            this.character.scene.tweens.add({
                targets: trap,
                angle: 360,
                duration: 1000,
                ease: "Cubic.out",
            });

            return true;
        }

        return false;
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
    }

    performAction(pointer) {
        const sprite = this.character.sprite;
        if (!sprite) return false;

        // ターゲット方向の計算
        let targetX, targetY;
        if (pointer && typeof pointer.x === 'number' && typeof pointer.y === 'number') {
            targetX = pointer.x;
            targetY = pointer.y;
        } else {
            // ポインタがない場合は向いている方向（簡易的に右）
            targetX = sprite.x + 100;
            targetY = sprite.y;
        }

        const angle = Phaser.Math.Angle.Between(sprite.x, sprite.y, targetX, targetY);
        const velocityX = Math.cos(angle) * this.config.projectileSpeed;
        const velocityY = Math.sin(angle) * this.config.projectileSpeed;

        // 投擲物の生成
        const projectile = this.character.scene.add.circle(sprite.x, sprite.y, 5, 0x8d6e63, 1);
        this.character.scene.matter.add.gameObject(projectile);
        projectile.setFrictionAir(0);
        projectile.setVelocity(velocityX, velocityY);
        projectile.setDepth(1000);

        // 一定時間後に消滅
        this.character.scene.time.delayedCall(1000, () => {
            if (projectile.active) projectile.destroy();
        });

        return true;
    }
}

window.ItemActionController = ItemActionController;
window.HealingItemController = HealingItemController;
window.PlaceableItemController = PlaceableItemController;
window.ThrowingItemController = ThrowingItemController;
