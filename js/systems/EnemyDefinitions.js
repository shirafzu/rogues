/**
 * EnemyDefinitions.js
 * Defines enemy races, classes, and their sensory capabilities.
 */

const ENEMY_DEFINITIONS = {
    dog_beastkin: {
        id: "dog_beastkin",
        name: "Dog Beastkin",
        race: "beastkin",
        job: "tracker",
        baseColor: 0x795548, // Brown
        stats: {
            maxHp: 5,
            moveSpeed: 2.2,
        },
        senses: {
            vision: {
                range: 250,
                angle: 100, // degrees
            },
            smell: {
                range: 400, // Can smell from far away
                intensityThreshold: 0.2,
            },
            hearing: {
                range: 200,
                threshold: 0.5,
            }
        },
        aiConfig: {
            aggression: "high", // Chases relentlessly
            persistence: 8000, // Chases for 8 seconds after losing track
        }
    },

    rabbit_beastkin: {
        id: "rabbit_beastkin",
        name: "Rabbit Beastkin",
        race: "beastkin",
        job: "scout",
        baseColor: 0xffcdd2, // Pinkish
        stats: {
            maxHp: 3,
            moveSpeed: 3.0, // Fast
        },
        senses: {
            vision: {
                range: 350, // Good vision
                angle: 150, // Wide angle
            },
            smell: {
                range: 100, // Poor smell
                intensityThreshold: 0.8,
            },
            hearing: {
                range: 500, // Excellent hearing
                threshold: 0.1, // Hears even quiet sounds
            }
        },
        aiConfig: {
            aggression: "low", // Flees or investigates cautiously
            persistence: 3000,
        }
    },

    // Default enemy for fallback
    default: {
        id: "default",
        name: "Enemy",
        race: "unknown",
        baseColor: 0xf44336,
        stats: {
            maxHp: 3,
            moveSpeed: 2.0,
        },
        senses: {
            vision: { range: 300, angle: 120 },
            smell: { range: 0, intensityThreshold: 1 },
            hearing: { range: 0, threshold: 1 },
        },
        aiConfig: {
            aggression: "medium",
            persistence: 5000,
        }
    }
};

window.ENEMY_DEFINITIONS = ENEMY_DEFINITIONS;
