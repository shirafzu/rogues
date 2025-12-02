/**
 * EnvironmentSystem
 * 川の流れによる押し流しと水中での移動速度補正を適用する。
 */
class EnvironmentSystem {
    constructor(scene, { worldManager, entityManager } = {}) {
        this.scene = scene;
        this.worldManager = worldManager;
        this.entityManager = entityManager;

        // デフォルト地形補正
        this.baseTerrainMultipliers = {
            water: 0.6,
            river: 0.55,
            mud: 0.7,
            ice: 1.1,
            grass: 0.95,
            stone: 1.0,
            land: 1.0
        };
    }

    update(delta) {
        if (!this.worldManager || !this.entityManager) return;
        const entities = this.entityManager.getAll();
        const dt = Math.max(delta, 16) / 1000; // 秒

        for (const entity of entities) {
            const sprite = entity.sprite;
            if (!sprite?.body || !sprite.active) continue;

            const terrainInfo = this.worldManager.getTerrainInfo(sprite.x, sprite.y);
            const race = entity.race || 'human';
            const raceDef = (typeof window !== 'undefined' && window.RACE_DEFINITIONS && window.RACE_DEFINITIONS[race]) || null;
            const raceTerrains = raceDef?.terrainMultipliers || {};
            const baseTerrains = this.baseTerrainMultipliers;
            const terrainMul = raceTerrains[terrainInfo.terrain] ?? baseTerrains[terrainInfo.terrain] ?? 1;

            // 水場の時は種族補正を掛ける
            let speedMul = terrainMul;
            if (terrainInfo.terrain === 'water' || terrainInfo.terrain === 'river' || terrainInfo.inWater) {
                const waterMul = raceTerrains.water ?? baseTerrains.water;
                speedMul *= waterMul;
            }
            speedMul = Math.max(0.25, speedMul);

            const vel = sprite.body.velocity;
            const flowPush = terrainInfo.speed * dt;
            const flowVec = terrainInfo.flow || { x: 0, y: 0 };
            const newVx = vel.x * speedMul + flowVec.x * flowPush;
            const newVy = vel.y * speedMul + flowVec.y * flowPush;

            if (sprite.setVelocity) {
                sprite.setVelocity(newVx, newVy);
            }

            // 簡易ステータス表示やデータタグ（他システム用）
            sprite.setData('terrain', terrainInfo.terrain);
            sprite.setData('inWater', !!terrainInfo.inWater);
            sprite.setData('wet', terrainInfo.inWater);
        }
    }
}

window.EnvironmentSystem = EnvironmentSystem;
