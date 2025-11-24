class SurvivalSystem {
    constructor(character, raceId) {
        this.character = character;
        this.raceId = raceId || "human";
        this.definition = window.RACE_DEFINITIONS[this.raceId] || window.RACE_DEFINITIONS.human;

        // Initialize stats based on definition
        this.stats = {};
        if (this.definition.stats) {
            Object.entries(this.definition.stats).forEach(([key, def]) => {
                this.stats[key] = {
                    current: def.initial,
                    max: def.max,
                    def: def,
                };
            });
        }

        this.damageTimer = 0;
        this.damageInterval = 1000; // Apply damage every 1 second if empty
    }

    update(delta) {
        if (this.character.isDead()) return;

        // Decay stats
        Object.values(this.stats).forEach(stat => {
            if (stat.def.decayRate > 0) {
                // Calculate decay amount for this frame
                const decay = stat.def.decayRate * (delta / 1000);
                stat.current = Math.max(0, stat.current - decay);
            }
        });

        // Check for empty stats and apply penalties
        this.damageTimer += delta;
        if (this.damageTimer >= this.damageInterval) {
            this.damageTimer = 0;
            this.applyPenalties();
        }
    }

    applyPenalties() {
        let totalDamage = 0;
        Object.values(this.stats).forEach(stat => {
            if (stat.current <= 0 && stat.def.damageOnEmpty > 0) {
                totalDamage += stat.def.damageOnEmpty;
            }
        });

        if (totalDamage > 0) {
            this.character.takeDamage(totalDamage);
            // Optional: Show starvation/dehydration message
            // console.log(`Taking ${totalDamage} survival damage`);
        }
    }

    /**
     * Modify a specific stat
     * @param {string} statId - e.g., "hunger", "thirst"
     * @param {number} amount - Positive to restore, negative to reduce
     */
    modifyStat(statId, amount) {
        const stat = this.stats[statId];
        if (!stat) return false;

        stat.current = Math.max(0, Math.min(stat.max, stat.current + amount));
        return true;
    }

    getStat(statId) {
        return this.stats[statId];
    }

    getAllStats() {
        return Object.values(this.stats);
    }

    canUseItems() {
        return this.definition.canUseItems;
    }
}

window.SurvivalSystem = SurvivalSystem;
