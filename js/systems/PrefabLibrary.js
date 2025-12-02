/**
 * PrefabLibrary
 * POIロールや危険度帯に応じた複数オブジェクトの集合体を定義。
 * 各オブジェクトに必須/任意、位置の揺らぎ（ジッター）、個別回転を持たせる。
 */
class PrefabLibrary {
    constructor() {
        this.poiPrefabs = {
            boss: {
                id: 'boss_crater_camp',
                rotateRandom: true,
                objects: [
                    // 100%生成（核）
                    { id: 'rock_boulder', x: 0, y: 0, required: true, jitter: 40 },
                    { id: 'ruin_pillar', x: -220, y: 40, required: true, jitter: 50 },
                    { id: 'ruin_pillar', x: 220, y: -40, required: true, jitter: 50 },
                    // 周辺（確率で追加）
                    { id: 'rock_mossy', x: -80, y: -160, chance: 0.75, jitter: 60 },
                    { id: 'rock_mossy', x: 140, y: 160, chance: 0.75, jitter: 60 },
                    { id: 'ruin_wall', x: 0, y: -260, angle: Math.PI / 2, chance: 0.6, jitter: 40 },
                ]
            },
            highLoot: {
                id: 'ruined_market',
                rotateRandom: true,
                objects: [
                    { id: 'crate_fantasy', x: -40, y: 0, required: true, jitter: 30 },
                    { id: 'crate_fantasy', x: 40, y: 0, required: true, jitter: 30 },
                    { id: 'barrel', x: 0, y: 60, chance: 0.9, jitter: 25 },
                    { id: 'ruin_wall', x: 0, y: -120, angle: 0, chance: 1.0, jitter: 35 },
                    { id: 'ruin_pillar', x: -140, y: 80, chance: 0.7, jitter: 40 },
                    { id: 'ruin_pillar', x: 140, y: 80, chance: 0.7, jitter: 40 },
                ]
            },
            scavenge: {
                id: 'fallen_timber_camp',
                rotateRandom: true,
                objects: [
                    { id: 'tree_dead', x: -120, y: 40, required: true, jitter: 50 },
                    { id: 'tree_pine', x: 140, y: -20, required: true, jitter: 60 },
                    { id: 'bush', x: -40, y: -120, chance: 0.9, jitter: 50 },
                    { id: 'barrel', x: 60, y: 110, chance: 0.6, jitter: 35 },
                    { id: 'crate_fantasy', x: -60, y: 140, chance: 0.6, jitter: 35 },
                ]
            },
            extraction: {
                id: 'signal_node',
                rotateRandom: true,
                objects: [
                    { id: 'ruin_pillar', x: 0, y: 0, required: true, jitter: 20 },
                    { id: 'ruin_wall', x: 0, y: -120, angle: 0, required: true, jitter: 25 },
                    { id: 'crate_fantasy', x: 80, y: 60, chance: 0.8, jitter: 25 },
                    { id: 'barrel', x: -90, y: 60, chance: 0.8, jitter: 25 },
                    { id: 'rock_mossy', x: 0, y: 150, chance: 0.7, jitter: 40 },
                ]
            }
        };

        this.bandPrefabs = {
            high: [
                {
                    id: 'scorched_barricade',
                    rotateRandom: true,
                    objects: [
                        { id: 'ruin_wall', x: -80, y: 0, angle: Math.PI / 2, required: true, jitter: 20 },
                        { id: 'ruin_wall', x: 80, y: 0, angle: Math.PI / 2, required: true, jitter: 20 },
                        { id: 'rock_boulder', x: 0, y: 60, chance: 0.8, jitter: 30 }
                    ]
                }
            ],
            mid: [
                {
                    id: 'abandoned_checkpoint',
                    rotateRandom: true,
                    objects: [
                        { id: 'ruin_wall', x: 0, y: 0, angle: 0, required: true, jitter: 25 },
                        { id: 'crate_fantasy', x: -60, y: 40, chance: 0.9, jitter: 25 },
                        { id: 'barrel', x: 60, y: 40, chance: 0.9, jitter: 25 },
                    ]
                }
            ],
            low: [
                {
                    id: 'waystone_grove',
                    rotateRandom: true,
                    objects: [
                        { id: 'tree_pine', x: -80, y: 0, required: true, jitter: 30 },
                        { id: 'tree_pine', x: 80, y: 0, required: true, jitter: 30 },
                        { id: 'bush', x: 0, y: 60, chance: 0.8, jitter: 25 },
                    ]
                }
            ]
        };
    }

    getPrefabForPoi(role) {
        return this.poiPrefabs[role] || null;
    }

    getPrefabForDangerBand(danger, rng = Math) {
        if (danger > 0.8) {
            return this.pickFrom(this.bandPrefabs.high, rng);
        }
        if (danger > 0.4) {
            return this.pickFrom(this.bandPrefabs.mid, rng);
        }
        return this.pickFrom(this.bandPrefabs.low, rng);
    }

    pickFrom(list, rng = Math) {
        if (!list || !list.length) return null;
        const r = rng.random ? rng.random() : rng.frac ? rng.frac() : Math.random();
        return list[Math.floor(r * list.length)];
    }
}

window.PrefabLibrary = PrefabLibrary;
