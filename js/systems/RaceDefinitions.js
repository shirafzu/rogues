/**
 * RaceDefinitions.js
 * Defines the survival parameters and unique mechanics for each race.
 */

const RACE_DEFINITIONS = {
    human: {
        id: "human",
        name: "Human",
        description: "Balanced survivor. Needs food and water.",
        terrainMultipliers: {
            water: 0.65,
            river: 0.6,
            mud: 0.75,
            ice: 0.95,
            grass: 1.0,
            stone: 1.0
        },
        stats: {
            hunger: {
                id: "hunger",
                name: "Hunger",
                max: 100,
                initial: 100,
                decayRate: 0.5, // per second
                damageOnEmpty: 1, // HP damage per tick when empty
                color: 0xff9800, // Orange
            },
            thirst: {
                id: "thirst",
                name: "Thirst",
                max: 100,
                initial: 100,
                decayRate: 0.8, // per second
                damageOnEmpty: 1,
                color: 0x2196f3, // Blue
            },
        },
        canUseItems: true, // Can use healing items
        specialAbilities: [],
    },

    dryad: {
        id: "dryad",
        name: "Dryad",
        description: "Plant-based. Needs water and light. Roots to heal.",
        terrainMultipliers: {
            water: 0.75,
            river: 0.7,
            mud: 0.85,
            ice: 0.9,
            grass: 1.05,
            stone: 0.95
        },
        stats: {
            hydration: {
                id: "hydration",
                name: "Hydration",
                max: 100,
                initial: 100,
                decayRate: 1.0,
                damageOnEmpty: 2,
                color: 0x00bcd4, // Cyan
            },
            photosynthesis: {
                id: "photosynthesis",
                name: "Sunlight",
                max: 100,
                initial: 100,
                decayRate: 0.2, // Slow decay, replenishes in light
                damageOnEmpty: 0.5,
                color: 0xffeb3b, // Yellow
            },
        },
        canUseItems: false, // Cannot use standard healing items
        specialAbilities: ["rooting"], // Special action to heal
    },

    // --- Future Races (Notes) ---

    slime: {
        id: "slime",
        name: "Slime",
        description: "Amorphous. Consumes anything for mass.",
        terrainMultipliers: {
            water: 0.9,
            river: 0.85,
            mud: 1.1,
            ice: 0.8,
            grass: 1.0,
            stone: 1.0
        },
        // Note:
        // - Stats: Mass (Health + Hunger combined?)
        // - Recovery: Eat items (wood, stone, trash) or absorb enemies.
        // - Special: Split into smaller slimes when Mass is high?
        stats: {
            mass: {
                id: "mass",
                name: "Mass",
                max: 200,
                initial: 50,
                decayRate: 0.5,
                color: 0x8bc34a, // Light Green
            }
        },
        canUseItems: false,
        specialAbilities: ["absorb", "split"],
    },

    automaton: {
        id: "automaton",
        name: "Automaton",
        description: "Mechanical. Needs fuel/battery. No natural regen.",
        terrainMultipliers: {
            water: 0.55,
            river: 0.5,
            mud: 0.7,
            ice: 1.0,
            grass: 0.95,
            stone: 1.05
        },
        // Note:
        // - Stats: Energy (Battery), Heat (limit activity)
        // - Recovery: Batteries, Gasoline.
        // - Special: Overheat mechanic (stops actions if too high).
        stats: {
            energy: {
                id: "energy",
                name: "Energy",
                max: 100,
                initial: 100,
                decayRate: 0, // Only decays on action
                color: 0xe91e63, // Pink
            },
            heat: {
                id: "heat",
                name: "Heat",
                max: 100,
                initial: 0,
                decayRate: -1, // Cools down over time
                color: 0xf44336, // Red
            }
        },
        canUseItems: true, // Can use repair kits / fuel
        specialAbilities: ["overdrive"],
    },

    ghost: {
        id: "ghost",
        name: "Ghost",
        description: "Ethereal. Needs souls. Phases through walls.",
        terrainMultipliers: {
            water: 1.0,
            river: 1.0,
            mud: 1.0,
            ice: 1.0,
            grass: 1.0,
            stone: 1.0
        },
        // Note:
        // - Stats: Ectoplasm / Soul Power
        // - Recovery: Drain enemies. Cannot eat physical food.
        // - Special: Wall phasing (costs Soul Power).
        stats: {
            soul: {
                id: "soul",
                name: "Soul",
                max: 100,
                initial: 50,
                decayRate: 0.5,
                color: 0x9c27b0, // Purple
            }
        },
        canUseItems: false,
        specialAbilities: ["phase", "drain"],
    },
};

window.RACE_DEFINITIONS = RACE_DEFINITIONS;
