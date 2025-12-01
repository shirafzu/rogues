/**
 * ObjectDefinitions
 * ワールドに配置されるオブジェクトの定義
 */
class ObjectDefinitions {
    constructor() {
        this.definitions = {
            // Trees
            tree_pine: {
                type: 'tree',
                shape: 'circle',
                radius: { min: 20, max: 30 },
                color: 0x1b5e20, // Dark Green
                isStatic: true,
                height: 100, // Visual height for pseudo-3D
                label: "Pine Tree"
            },
            tree_dead: {
                type: 'tree',
                shape: 'circle',
                radius: { min: 15, max: 20 },
                color: 0x4e342e, // Brown
                isStatic: true,
                height: 80,
                label: "Dead Tree"
            },

            // Rocks
            rock_mossy: {
                type: 'rock',
                shape: 'circle',
                radius: { min: 20, max: 60 }, // Increased size
                color: 0x558b2f,
                isStatic: true,
                height: 40,
                label: "Mossy Rock",
                cluster: { min: 1, max: 3, radius: 60 } // Small clusters
            },
            rock_boulder: {
                type: 'rock',
                shape: 'circle',
                radius: { min: 50, max: 120 }, // Much larger
                color: 0x757575,
                isStatic: true,
                height: 80,
                label: "Boulder"
            },

            // Ruins
            ruin_pillar: {
                type: 'ruin',
                shape: 'rectangle',
                width: { min: 30, max: 40 },
                height: { min: 30, max: 40 },
                color: 0xbdbdbd,
                isStatic: true,
                height: 120,
                label: "Stone Pillar",
                cluster: { min: 1, max: 4, radius: 100 } // Ruins often come in groups
            },
            ruin_wall: {
                type: 'ruin',
                shape: 'rectangle',
                width: { min: 80, max: 150 },
                height: { min: 20, max: 30 },
                color: 0x9e9e9e,
                isStatic: true,
                height: 80,
                label: "Ruined Wall"
            },

            // Props
            barrel: {
                type: 'prop',
                shape: 'circle',
                radius: { min: 12, max: 14 },
                color: 0x795548,
                isStatic: false,
                density: 0.01,
                friction: 0.5,
                height: 30,
                label: "Barrel",
                cluster: { min: 2, max: 6, radius: 40 } // Barrels are usually clustered
            },
            crate_fantasy: {
                type: 'prop',
                shape: 'rectangle',
                width: { min: 25, max: 30 },
                height: { min: 25, max: 30 },
                color: 0x5d4037,
                strokeColor: 0xffb74d,
                strokeWidth: 2,
                isStatic: false,
                density: 0.02,
                height: 25,
                label: "Supply Crate",
                cluster: { min: 1, max: 3, radius: 50 }
            },

            // Vegetation
            bush: {
                type: 'vegetation',
                shape: 'circle',
                radius: { min: 15, max: 25 },
                color: 0x81c784,
                isStatic: true,
                isSensor: true,
                height: 15,
                label: "Bush",
                cluster: { min: 3, max: 8, radius: 100 } // Bushes grow in patches
            }
        };

        // Biome specific spawn lists
        this.biomeSpawns = {
            plains: [
                { id: 'tree_pine', weight: 5 },
                { id: 'rock_mossy', weight: 2 },
                { id: 'bush', weight: 4 },
                { id: 'ruin_pillar', weight: 0.5 },
                { id: 'barrel', weight: 0.2 }
            ],
            forest: [ // Assuming forest exists or will exist
                { id: 'tree_pine', weight: 8 },
                { id: 'tree_dead', weight: 2 },
                { id: 'bush', weight: 5 },
                { id: 'rock_mossy', weight: 1 }
            ],
            desert: [
                { id: 'rock_boulder', weight: 5 },
                { id: 'ruin_pillar', weight: 2 },
                { id: 'ruin_wall', weight: 1 },
                { id: 'crate_fantasy', weight: 0.5 }
            ]
        };

        // Setpieces (Structured groups of objects)
        this.setpieces = {
            camp_small: {
                objects: [
                    { id: 'crate_fantasy', x: 0, y: 0 },
                    { id: 'crate_fantasy', x: 20, y: 5 },
                    { id: 'barrel', x: -15, y: 10 },
                    { id: 'barrel', x: -10, y: -10 }
                ],
                radius: 40
            },
            ruin_corner: {
                objects: [
                    { id: 'ruin_wall', x: 0, y: -30, angle: 0 }, // Horizontal wall
                    { id: 'ruin_wall', x: -50, y: 20, angle: Math.PI / 2 }, // Vertical wall
                    { id: 'ruin_pillar', x: -50, y: -30 }, // Corner pillar
                    { id: 'rock_mossy', x: 20, y: 20 } // Debris
                ],
                radius: 80
            },
            ruin_circle: {
                objects: [
                    { id: 'ruin_pillar', x: 60, y: 0 },
                    { id: 'ruin_pillar', x: -60, y: 0 },
                    { id: 'ruin_pillar', x: 0, y: 60 },
                    { id: 'ruin_pillar', x: 0, y: -60 },
                    { id: 'rock_mossy', x: 0, y: 0 } // Center rock
                ],
                radius: 100
            },
            forest_grove: {
                objects: [
                    { id: 'tree_pine', x: 0, y: 0 },
                    { id: 'tree_pine', x: 40, y: 20 },
                    { id: 'tree_pine', x: -30, y: 40 },
                    { id: 'bush', x: 20, y: -20 },
                    { id: 'bush', x: -20, y: 10 }
                ],
                radius: 80
            },
            rock_formation: {
                objects: [
                    { id: 'rock_boulder', x: 0, y: 0 },
                    { id: 'rock_mossy', x: 60, y: 20 },
                    { id: 'rock_mossy', x: -50, y: -30 },
                    { id: 'rock_mossy', x: 10, y: 70 }
                ],
                radius: 100
            }
        };

        // Biome specific setpiece weights
        this.biomeSetpieces = {
            plains: [
                { id: 'camp_small', weight: 1 },
                { id: 'ruin_corner', weight: 1 },
                { id: 'rock_formation', weight: 2 },
                { id: 'forest_grove', weight: 3 }
            ],
            forest: [
                { id: 'forest_grove', weight: 5 },
                { id: 'camp_small', weight: 1 },
                { id: 'ruin_circle', weight: 1 }
            ],
            desert: [
                { id: 'ruin_corner', weight: 3 },
                { id: 'ruin_circle', weight: 2 },
                { id: 'camp_small', weight: 1 }
            ]
        };
    }

    getSetpieceDefinition(id) {
        return this.setpieces[id];
    }

    getRandomSetpieceForBiome(biome, rnd) {
        const list = this.biomeSetpieces[biome] || this.biomeSetpieces['plains'];
        return this.weightedPick(list, rnd);
    }

    getDefinition(id) {
        return this.definitions[id];
    }

    getRandomObjectForBiome(biome, rnd) {
        const list = this.biomeSpawns[biome] || this.biomeSpawns['plains'];
        return this.weightedPick(list, rnd);
    }

    weightedPick(list, rnd) {
        const totalWeight = list.reduce((sum, item) => sum + item.weight, 0);
        let r = rnd.frac() * totalWeight;
        for (const item of list) {
            r -= item.weight;
            if (r <= 0) return item.id;
        }
        return list[0].id;
    }
}

window.ObjectDefinitions = ObjectDefinitions;
