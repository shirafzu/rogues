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
                radius: { min: 28, max: 36 },
                color: 0x1b5e20,
                textureKey: 'tex_tree_canopy',
                isStatic: true,
                height: 100,
                label: "Pine Tree"
            },
            tree_dead: {
                type: 'tree',
                shape: 'circle',
                radius: { min: 24, max: 32 },
                color: 0x4e342e,
                textureKey: 'tex_tree_dead',
                isStatic: true,
                height: 80,
                label: "Dead Tree"
            },
            tree_oak: {
                type: 'tree',
                shape: 'circle',
                radius: { min: 30, max: 40 },
                color: 0x355e3b,
                isStatic: true,
                height: 90,
                label: "Oak Tree"
            },
            tree_birch: {
                type: 'tree',
                shape: 'circle',
                radius: { min: 26, max: 34 },
                color: 0x6da67a,
                isStatic: true,
                height: 85,
                label: "Birch Tree"
            },
            tree_scorched: {
                type: 'tree',
                shape: 'circle',
                radius: { min: 28, max: 36 },
                color: 0x2f1b13,
                isStatic: true,
                height: 80,
                label: "Scorched Tree"
            },
            tree_giant: {
                type: 'tree',
                shape: 'circle',
                radius: { min: 40, max: 54 },
                color: 0x1f6b2e,
                isStatic: true,
                height: 130,
                label: "Giant Tree"
            },
            // Rocks
            rock_mossy: {
                type: 'rock',
                shape: 'circle',
                radius: { min: 20, max: 60 },
                color: 0x558b2f,
                textureKey: 'tex_rock',
                isStatic: true,
                height: 40,
                label: "Mossy Rock",
                cluster: { min: 1, max: 3, radius: 60 }
            },
            rock_boulder: {
                type: 'rock',
                shape: 'circle',
                radius: { min: 50, max: 120 },
                color: 0x757575,
                textureKey: 'tex_rock',
                isStatic: true,
                height: 80,
                label: "Boulder"
            },
            rock_long: {
                type: 'rock',
                shape: 'rectangle',
                width: { min: 140, max: 220 },
                height: { min: 40, max: 80 },
                color: 0x6d6d6d,
                isStatic: true,
                height3d: 80,
                label: "Long Rock"
            },
            rock_slab: {
                type: 'rock',
                shape: 'rectangle',
                width: { min: 120, max: 180 },
                height: { min: 80, max: 120 },
                color: 0x8d8d8d,
                isStatic: true,
                height3d: 60,
                label: "Stone Slab"
            },
            rock_spike: {
                type: 'rock',
                shape: 'circle',
                radius: { min: 30, max: 45 },
                color: 0x616161,
                isStatic: true,
                height: 90,
                label: "Spiked Rock",
                cluster: { min: 2, max: 5, radius: 80 }
            },
            rock_obsidian: {
                type: 'rock',
                shape: 'circle',
                radius: { min: 28, max: 42 },
                color: 0x1f1b2e,
                isStatic: true,
                height: 90,
                label: "Obsidian Shard",
                cluster: { min: 2, max: 4, radius: 70 }
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
                cluster: { min: 1, max: 4, radius: 100 }
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
            ruin_arch: {
                type: 'ruin',
                shape: 'rectangle',
                width: { min: 120, max: 180 },
                height: { min: 30, max: 40 },
                color: 0xa7a7a7,
                isStatic: true,
                height: 110,
                label: "Broken Arch"
            },
            ruin_statue: {
                type: 'ruin',
                shape: 'rectangle',
                width: { min: 60, max: 80 },
                height: { min: 120, max: 160 },
                color: 0x9c9c9c,
                isStatic: true,
                height: 140,
                label: "Stone Statue"
            },
            rune_stone: {
                type: 'ruin',
                shape: 'rectangle',
                width: { min: 50, max: 70 },
                height: { min: 100, max: 140 },
                color: 0x4b4a5b,
                isStatic: true,
                height: 120,
                label: "Rune Stone"
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
                cluster: { min: 2, max: 6, radius: 40 }
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
            campfire: {
                type: 'prop',
                shape: 'circle',
                radius: { min: 18, max: 22 },
                color: 0xff7043,
                isStatic: true,
                isSensor: true,
                height: 10,
                label: "Campfire"
            },
            scout_tent: {
                type: 'prop',
                shape: 'rectangle',
                width: { min: 120, max: 160 },
                height: { min: 70, max: 90 },
                color: 0x5d4037,
                strokeColor: 0xffcc80,
                strokeWidth: 2,
                isStatic: true,
                height: 60,
                label: "Scout Tent"
            },
            supply_cart: {
                type: 'prop',
                shape: 'rectangle',
                width: { min: 140, max: 180 },
                height: { min: 60, max: 80 },
                color: 0x6d4c41,
                strokeColor: 0x8d6e63,
                strokeWidth: 3,
                isStatic: true,
                height: 70,
                label: "Supply Cart"
            },
            camp_banner: {
                type: 'prop',
                shape: 'rectangle',
                width: { min: 18, max: 24 },
                height: { min: 120, max: 160 },
                color: 0xc62828,
                strokeColor: 0xffeb3b,
                strokeWidth: 3,
                isStatic: true,
                height: 140,
                label: "Camp Banner"
            },
            wooden_totem: {
                type: 'prop',
                shape: 'rectangle',
                width: { min: 26, max: 32 },
                height: { min: 120, max: 150 },
                color: 0x6d4c41,
                isStatic: true,
                height: 120,
                label: "Wooden Totem"
            },
            bone_pile: {
                type: 'prop',
                shape: 'circle',
                radius: { min: 18, max: 28 },
                color: 0xdedede,
                isStatic: true,
                height: 15,
                label: "Bone Pile",
                cluster: { min: 2, max: 5, radius: 60 }
            },
            barricade_spike: {
                type: 'prop',
                shape: 'rectangle',
                width: { min: 110, max: 150 },
                height: { min: 30, max: 40 },
                color: 0x4e342e,
                isStatic: true,
                height: 70,
                label: "Spiked Barricade"
            },
            ground_lantern: {
                type: 'prop',
                shape: 'circle',
                radius: { min: 12, max: 16 },
                color: 0xfff176,
                isStatic: true,
                isSensor: true,
                height: 20,
                label: "Lantern"
            },
            crate_arcane: {
                type: 'prop',
                shape: 'rectangle',
                width: { min: 25, max: 32 },
                height: { min: 25, max: 32 },
                color: 0x512da8,
                strokeColor: 0xffc107,
                strokeWidth: 2,
                isStatic: false,
                density: 0.02,
                height: 25,
                label: "Arcane Crate",
                cluster: { min: 1, max: 2, radius: 40 }
            },
            // Vegetation
            bush: {
                type: 'vegetation',
                shape: 'circle',
                radius: { min: 15, max: 25 },
                color: 0x81c784,
                textureKey: 'tex_bush',
                isStatic: true,
                isSensor: true,
                height: 15,
                label: "Bush",
                cluster: { min: 3, max: 8, radius: 100 }
            },
            shrub: {
                type: 'vegetation',
                shape: 'circle',
                radius: { min: 12, max: 18 },
                color: 0x6fa86f,
                isStatic: true,
                isSensor: true,
                height: 12,
                label: "Shrub",
                cluster: { min: 4, max: 10, radius: 90 }
            },
            grass_patch: {
                type: 'vegetation',
                shape: 'circle',
                radius: { min: 10, max: 16 },
                color: 0x7cb342,
                isStatic: true,
                isSensor: true,
                height: 8,
                label: "Grass Patch",
                cluster: { min: 5, max: 12, radius: 120 }
            },
            mushroom_small: {
                type: 'vegetation',
                shape: 'circle',
                radius: { min: 10, max: 14 },
                color: 0xc62828,
                isStatic: true,
                isSensor: true,
                height: 10,
                label: "Mushroom",
                cluster: { min: 4, max: 10, radius: 80 }
            },
            mushroom_giant: {
                type: 'vegetation',
                shape: 'circle',
                radius: { min: 26, max: 34 },
                color: 0x8e24aa,
                isStatic: true,
                isSensor: true,
                height: 30,
                label: "Giant Mushroom",
                cluster: { min: 2, max: 4, radius: 90 }
            },
            flower_field: {
                type: 'vegetation',
                shape: 'circle',
                radius: { min: 18, max: 26 },
                color: 0xffc0cb,
                isStatic: true,
                isSensor: true,
                height: 8,
                label: "Wildflowers",
                cluster: { min: 3, max: 7, radius: 100 }
            },
            log_fallen: {
                type: 'vegetation',
                shape: 'rectangle',
                width: { min: 120, max: 180 },
                height: { min: 28, max: 36 },
                color: 0x5d4037,
                isStatic: true,
                height: 30,
                label: "Fallen Log"
            },
            tree_stump: {
                type: 'vegetation',
                shape: 'circle',
                radius: { min: 18, max: 24 },
                color: 0x6d4c41,
                isStatic: true,
                height: 20,
                label: "Tree Stump"
            },
            bramble: {
                type: 'vegetation',
                shape: 'circle',
                radius: { min: 20, max: 28 },
                color: 0x2e7d32,
                isStatic: true,
                isSensor: true,
                height: 14,
                label: "Bramble",
                cluster: { min: 3, max: 6, radius: 80 }
            },
            // Crystals / Arcane
            crystal_blue: {
                type: 'arcane',
                shape: 'rectangle',
                width: { min: 28, max: 36 },
                height: { min: 90, max: 130 },
                color: 0x4fc3f7,
                strokeColor: 0xb3e5fc,
                strokeWidth: 3,
                isStatic: true,
                height: 120,
                label: "Blue Crystal",
                cluster: { min: 2, max: 4, radius: 70 }
            },
            crystal_red: {
                type: 'arcane',
                shape: 'rectangle',
                width: { min: 26, max: 34 },
                height: { min: 90, max: 130 },
                color: 0xef5350,
                strokeColor: 0xff8a80,
                strokeWidth: 3,
                isStatic: true,
                height: 120,
                label: "Red Crystal",
                cluster: { min: 2, max: 4, radius: 70 }
            },
            crystal_purple: {
                type: 'arcane',
                shape: 'rectangle',
                width: { min: 26, max: 36 },
                height: { min: 90, max: 140 },
                color: 0x7e57c2,
                strokeColor: 0xb39ddb,
                strokeWidth: 3,
                isStatic: true,
                height: 130,
                label: "Amethyst Crystal",
                cluster: { min: 2, max: 4, radius: 70 }
            },
            obelisk_dark: {
                type: 'arcane',
                shape: 'rectangle',
                width: { min: 40, max: 50 },
                height: { min: 160, max: 200 },
                color: 0x2e294e,
                strokeColor: 0xc5cae9,
                strokeWidth: 4,
                isStatic: true,
                height: 200,
                label: "Dark Obelisk"
            },
            arcane_beacon: {
                type: 'arcane',
                shape: 'circle',
                radius: { min: 24, max: 30 },
                color: 0x00e5ff,
                isStatic: true,
                isSensor: true,
                height: 30,
                label: "Arcane Beacon"
            }
        };

        // Biome specific spawn lists
        this.biomeSpawns = {
            plains: [
                { id: 'tree_pine', weight: 4 },
                { id: 'tree_oak', weight: 3 },
                { id: 'tree_birch', weight: 2 },
                { id: 'tree_stump', weight: 1.5 },
                { id: 'log_fallen', weight: 2 },
                { id: 'rock_mossy', weight: 2.5 },
                { id: 'rock_long', weight: 1 },
                { id: 'rock_slab', weight: 1 },
                { id: 'rock_boulder', weight: 1.5 },
                { id: 'bush', weight: 4 },
                { id: 'shrub', weight: 4 },
                { id: 'grass_patch', weight: 3 },
                { id: 'flower_field', weight: 1 },
                { id: 'ruin_pillar', weight: 0.5 },
                { id: 'ruin_wall', weight: 0.4 },
                { id: 'ruin_arch', weight: 0.3 },
                { id: 'ruin_statue', weight: 0.2 },
                { id: 'barrel', weight: 0.2 },
                { id: 'crate_fantasy', weight: 0.2 },
                { id: 'campfire', weight: 0.1 },
                { id: 'scout_tent', weight: 0.15 },
                { id: 'supply_cart', weight: 0.12 },
                { id: 'camp_banner', weight: 0.1 },
                { id: 'wooden_totem', weight: 0.15 },
                { id: 'bone_pile', weight: 0.1 },
                { id: 'ground_lantern', weight: 0.08 },
                { id: 'barricade_spike', weight: 0.15 }
            ],
            forest: [
                { id: 'tree_pine', weight: 6 },
                { id: 'tree_oak', weight: 4 },
                { id: 'tree_birch', weight: 3 },
                { id: 'tree_dead', weight: 2 },
                { id: 'tree_giant', weight: 1 },
                { id: 'tree_scorched', weight: 0.8 },
                { id: 'bush', weight: 6 },
                { id: 'shrub', weight: 5 },
                { id: 'grass_patch', weight: 4 },
                { id: 'bramble', weight: 2.5 },
                { id: 'mushroom_small', weight: 3 },
                { id: 'mushroom_giant', weight: 1.5 },
                { id: 'flower_field', weight: 1 },
                { id: 'log_fallen', weight: 2 },
                { id: 'tree_stump', weight: 2 },
                { id: 'rock_mossy', weight: 2 },
                { id: 'rock_spike', weight: 1 },
                { id: 'rock_long', weight: 1 },
                { id: 'ruin_pillar', weight: 0.6 },
                { id: 'ruin_statue', weight: 0.3 },
                { id: 'wooden_totem', weight: 0.4 },
                { id: 'campfire', weight: 0.12 },
                { id: 'scout_tent', weight: 0.1 }
            ],
            desert: [
                { id: 'rock_boulder', weight: 6 },
                { id: 'rock_long', weight: 3 },
                { id: 'rock_slab', weight: 2 },
                { id: 'rock_spike', weight: 2 },
                { id: 'rock_obsidian', weight: 1.5 },
                { id: 'ruin_pillar', weight: 2 },
                { id: 'ruin_wall', weight: 1.5 },
                { id: 'ruin_arch', weight: 1 },
                { id: 'rune_stone', weight: 0.8 },
                { id: 'ruin_statue', weight: 0.5 },
                { id: 'crate_fantasy', weight: 0.5 },
                { id: 'crate_arcane', weight: 0.3 },
                { id: 'barricade_spike', weight: 0.4 },
                { id: 'ground_lantern', weight: 0.1 },
                { id: 'bone_pile', weight: 0.6 },
                { id: 'camp_banner', weight: 0.2 }
            ],
            arcane: [
                { id: 'crystal_blue', weight: 3 },
                { id: 'crystal_red', weight: 3 },
                { id: 'crystal_purple', weight: 3 },
                { id: 'obelisk_dark', weight: 2 },
                { id: 'arcane_beacon', weight: 2 },
                { id: 'rune_stone', weight: 1.2 },
                { id: 'ruin_statue', weight: 0.8 },
                { id: 'ruin_wall', weight: 0.6 },
                { id: 'crate_arcane', weight: 0.6 },
                { id: 'ground_lantern', weight: 0.4 }
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
            },
            crystal_garden: {
                objects: [
                    { id: 'crystal_blue', x: 0, y: 0 },
                    { id: 'crystal_purple', x: 60, y: 0 },
                    { id: 'crystal_red', x: -60, y: 0 },
                    { id: 'arcane_beacon', x: 0, y: -70 },
                    { id: 'rock_obsidian', x: 0, y: 70 }
                ],
                radius: 120
            },
            mushroom_ring: {
                objects: [
                    { id: 'mushroom_giant', x: 60, y: 0 },
                    { id: 'mushroom_giant', x: -60, y: 0 },
                    { id: 'mushroom_small', x: 0, y: 60 },
                    { id: 'mushroom_small', x: 0, y: -60 },
                    { id: 'campfire', x: 0, y: 0 }
                ],
                radius: 100
            },
            bandit_camp: {
                objects: [
                    { id: 'scout_tent', x: -80, y: -40 },
                    { id: 'scout_tent', x: 80, y: -40 },
                    { id: 'supply_cart', x: 0, y: 80 },
                    { id: 'campfire', x: 0, y: 0 },
                    { id: 'camp_banner', x: 0, y: -120 }
                ],
                radius: 140
            },
            barricade_line: {
                objects: [
                    { id: 'barricade_spike', x: -80, y: 0, angle: 0 },
                    { id: 'barricade_spike', x: 0, y: 0, angle: 0 },
                    { id: 'barricade_spike', x: 80, y: 0, angle: 0 },
                    { id: 'ground_lantern', x: -40, y: -30 },
                    { id: 'ground_lantern', x: 40, y: -30 }
                ],
                radius: 120
            }
        };

        // Biome specific setpiece weights
        this.biomeSetpieces = {
            plains: [
                { id: 'camp_small', weight: 1 },
                { id: 'ruin_corner', weight: 1 },
                { id: 'rock_formation', weight: 2 },
                { id: 'forest_grove', weight: 3 },
                { id: 'bandit_camp', weight: 1.2 }
            ],
            forest: [
                { id: 'forest_grove', weight: 5 },
                { id: 'camp_small', weight: 1 },
                { id: 'ruin_circle', weight: 1 },
                { id: 'mushroom_ring', weight: 1.5 }
            ],
            desert: [
                { id: 'ruin_corner', weight: 3 },
                { id: 'ruin_circle', weight: 2 },
                { id: 'camp_small', weight: 1 },
                { id: 'barricade_line', weight: 1 }
            ],
            arcane: [
                { id: 'crystal_garden', weight: 3 },
                { id: 'ruin_circle', weight: 1.5 },
                { id: 'barricade_line', weight: 0.5 }
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
