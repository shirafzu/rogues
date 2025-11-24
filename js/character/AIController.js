class AIController {
    constructor(character, config = {}) {
        this.character = character;
        this.config = config;
        this.scene = character.scene;
    }

    update(delta) {
        // Override in subclasses
    }
}

class SimpleAIController extends AIController {
    constructor(character, config = {}) {
        super(character, config);
        this.targetProvider = config.targetProvider || (() => this.scene.playerController?.sprite);
        this.attackRange = config.attackRange ?? 100;
        this.attackCooldown = config.attackCooldown ?? 1000;
        this.lastAttackTime = 0;
    }

    update(delta) {
        if (!this.character.sprite || !this.character.sprite.active) return;

        const target = this.targetProvider();
        if (!target || !target.active) return;

        const dist = Phaser.Math.Distance.Between(
            this.character.sprite.x,
            this.character.sprite.y,
            target.x,
            target.y
        );

        // 攻撃範囲内なら攻撃試行
        if (dist <= this.attackRange) {
            // 移動停止
            if (this.character.movementController) {
                this.character.sprite.setVelocity(0, 0);
            }

            this.tryAttack();
        } else {
            // 攻撃範囲外なら移動（MovementControllerに委譲）
            if (this.character.movementController) {
                this.character.movementController.update(delta);
            }
        }
    }

    tryAttack() {
        const now = this.scene.time.now;
        if (now - this.lastAttackTime < this.attackCooldown) return;

        const attackAbility = this.character.abilityMap["attack"]; // "tap"ではなく"attack"として登録予定
        if (attackAbility) {
            attackAbility.execute();
            this.lastAttackTime = now;
        } else {
            // フォールバック：tapスロット（デフォルト攻撃）を使用
            const tapAbility = this.character.abilityMap["tap"];
            if (tapAbility) {
                tapAbility.execute();
                this.lastAttackTime = now;
            }
        }
    }
}

class SensoryAIController extends AIController {
    constructor(character, config = {}) {
        super(character, config);
        this.state = "IDLE"; // IDLE, PATROL, CHASE, SEARCH, ATTACK
        this.stateTimer = 0;
        this.target = null;
        this.lastKnownPos = null;

        // Config from EnemyDefinitions or defaults
        this.senses = config.senses || {
            vision: { range: 300, angle: 120 },
            smell: { range: 0 },
            hearing: { range: 0 }
        };
        this.aiConfig = config.aiConfig || {
            aggression: "medium",
            persistence: 5000
        };

        this.patrolRadius = config.patrolRadius ?? 200;
        this.attackRange = config.attackRange ?? 80;

        this.moveTarget = null;

        // Listen for sound events
        if (this.scene.events) {
            this.scene.events.on("sound_emitted", this.handleSoundEvent, this);
        }
    }

    destroy() {
        if (this.scene && this.scene.events) {
            this.scene.events.off("sound_emitted", this.handleSoundEvent, this);
        }
    }

    handleSoundEvent(event) {
        // event: { x, y, intensity, source }
        if (!this.character.sprite || !this.character.sprite.active) return;
        if (event.source === this.character) return; // Ignore self

        const hearing = this.senses.hearing;
        if (!hearing || hearing.range <= 0) return;

        const dist = Phaser.Math.Distance.Between(
            this.character.sprite.x,
            this.character.sprite.y,
            event.x,
            event.y
        );

        // Check if sound is within range and loud enough
        // Simple logic: effective range = range * intensity
        if (dist <= hearing.range * event.intensity) {
            // Heard something!
            this.onHeardSound(event);
        }
    }

    onHeardSound(event) {
        // Update last known position to sound source
        this.lastKnownPos = { x: event.x, y: event.y };

        // Reaction depends on aggression
        if (this.state === "IDLE" || this.state === "PATROL") {
            this.changeState("SEARCH");
        } else if (this.state === "SEARCH") {
            // Update search target
            this.moveTarget = { x: event.x, y: event.y };
        }
    }

    update(delta) {
        if (!this.character.sprite || !this.character.sprite.active) return;

        // 1. Process Senses
        this.processSenses();

        // 2. Decide State
        this.decideState(delta);

        // 3. Act
        this.act(delta);
    }

    processSenses() {
        const player = this.scene.playerController?.sprite;
        if (!player || !player.active) {
            this.target = null;
            return;
        }

        const dist = Phaser.Math.Distance.Between(
            this.character.sprite.x,
            this.character.sprite.y,
            player.x,
            player.y
        );

        let detected = false;

        // Vision Check
        if (dist <= this.senses.vision.range) {
            // Check Angle (simplified)
            // Check Line of Sight
            if (this.checkLineOfSight(player)) {
                detected = true;
            }
        }

        // Smell Check (Scent Trail)
        // Only if not already detected visually
        if (!detected && this.senses.smell && this.senses.smell.range > 0) {
            if (this.scene.scentManager) {
                // Find newest scent node in range
                // We track the player's scent
                const scentNode = this.scene.scentManager.findNewestScent(
                    this.character.sprite.x,
                    this.character.sprite.y,
                    this.senses.smell.range,
                    this.scene.playerController // Track player only
                );

                if (scentNode) {
                    // Found a scent!
                    // If we are already chasing/searching, we might want to update target
                    // But here we just set detected=true to trigger state change
                    // The actual movement target will be set in decideState/act
                    // For now, let's set target to the scent node position (virtual target)

                    // Note: This is tricky because 'target' usually means the player sprite
                    // If we set target to player, CHASE logic will move to player directly
                    // But we want to move to the scent node.

                    // Solution:
                    // If smelled, we set a "scentTarget" and switch to SEARCH or CHASE
                    // For Dog behavior (aggressive tracking), we can treat it as CHASE but move to scent

                    this.lastKnownPos = { x: scentNode.x, y: scentNode.y };
                    // We don't set this.target = player because we don't see them
                    // But we want to enter CHASE/SEARCH state

                    // If we are IDLE/PATROL, smell triggers SEARCH (or CHASE for high aggression)
                    if (this.state === "IDLE" || this.state === "PATROL") {
                        this.changeState("SEARCH");
                    }
                }
            }
        }

        if (detected) {
            this.target = player;
            this.lastKnownPos = { x: player.x, y: player.y };
        } else {
            // If we lost visual contact, we keep target null
            // But lastKnownPos remains from previous frame or smell
            this.target = null;
        }
    }

    checkLineOfSight(target) {
        if (!this.scene.matter) return true; // Fallback

        const start = { x: this.character.sprite.x, y: this.character.sprite.y };
        const end = { x: target.x, y: target.y };

        // Raycast
        const bodies = this.scene.matter.query.ray(
            this.scene.matter.world.localWorld.bodies,
            start,
            end
        );

        // Check if any body blocks the view
        for (const body of bodies) {
            // Ignore self and target
            if (body.gameObject === this.character.sprite) continue;
            if (body.gameObject === target) continue;

            // Ignore sensors, non-blocking items (like grass, if any)
            if (body.isSensor) continue;

            // If we hit something else (wall, crate, etc.), LOS is blocked
            // Ideally check collision filter or label
            // For now, assume any other static/solid body blocks view
            return false;
        }

        return true;
    }

    decideState(delta) {
        this.stateTimer += delta;

        switch (this.state) {
            case "IDLE":
                if (this.target) {
                    this.changeState("CHASE");
                } else if (this.stateTimer > 2000) {
                    this.changeState("PATROL");
                }
                break;

            case "PATROL":
                if (this.target) {
                    this.changeState("CHASE");
                } else if (this.hasReachedMoveTarget()) {
                    this.changeState("IDLE");
                }
                break;

            case "CHASE":
                if (!this.target) {
                    // Lost target, go to SEARCH
                    this.changeState("SEARCH");
                } else {
                    const dist = Phaser.Math.Distance.Between(
                        this.character.sprite.x,
                        this.character.sprite.y,
                        this.target.x,
                        this.target.y
                    );
                    if (dist <= this.attackRange) {
                        this.changeState("ATTACK");
                    }
                }
                break;

            case "SEARCH":
                if (this.target) {
                    this.changeState("CHASE");
                } else if (this.stateTimer > this.aiConfig.persistence) {
                    this.changeState("IDLE");
                } else if (this.hasReachedMoveTarget()) {
                    // Reached last known pos, look around?
                }
                break;

            case "ATTACK":
                if (this.stateTimer > 500) { // Attack cooldown/animation time
                    this.changeState("CHASE");
                }
                break;
        }
    }

    act(delta) {
        const sprite = this.character.sprite;

        switch (this.state) {
            case "IDLE":
                sprite.setVelocity(0, 0);
                break;

            case "PATROL":
                this.moveTo(this.moveTarget, 0.5);
                break;

            case "CHASE":
                if (this.target) {
                    this.moveTo(this.target);
                }
                break;

            case "SEARCH":
                if (this.lastKnownPos) {
                    this.moveTo(this.lastKnownPos, 0.7);
                }
                break;

            case "ATTACK":
                sprite.setVelocity(0, 0);
                if (this.stateTimer === 0) {
                    this.tryAttack();
                }
                break;
        }
    }

    changeState(newState) {
        if (this.state === newState) return;

        this.state = newState;
        this.stateTimer = 0;

        // Status Label Update
        let color = "#ffffff";
        let text = newState;
        switch (newState) {
            case "IDLE": color = "#ffffff"; break;
            case "PATROL": color = "#81d4fa"; break;
            case "CHASE": color = "#ffb74d"; text = "CHASE!"; break;
            case "ATTACK": color = "#ff5252"; text = "ATTACK!"; break;
            case "SEARCH": color = "#fff176"; text = "SEARCH?"; break;
        }
        this.character.updateStatusLabel(text, color);

        // State Entry Logic
        if (newState === "PATROL") {
            this.setRandomPatrolTarget();
        } else if (newState === "SEARCH") {
            // If entering search without a last known pos (rare), set to current pos
            if (!this.lastKnownPos) {
                this.lastKnownPos = { x: this.character.sprite.x, y: this.character.sprite.y };
            }
            this.moveTarget = this.lastKnownPos;
        }
    }

    setRandomPatrolTarget() {
        let attempt = 0;
        let target = null;
        while (attempt < 5) {
            const angle = Math.random() * Math.PI * 2;
            const r = this.patrolRadius * (0.5 + Math.random() * 0.5);
            const tx = this.character.sprite.x + Math.cos(angle) * r;
            const ty = this.character.sprite.y + Math.sin(angle) * r;

            const bounds = this.scene.matter?.world?.bounds;
            if (bounds) {
                if (tx > bounds.min.x && tx < bounds.max.x &&
                    ty > bounds.min.y && ty < bounds.max.y) {
                    target = { x: tx, y: ty };
                    break;
                }
            } else {
                target = { x: tx, y: ty };
                break;
            }
            attempt++;
        }
        this.moveTarget = target || { x: this.character.sprite.x, y: this.character.sprite.y };
    }

    moveTo(target, speedMultiplier = 1.0) {
        if (!target) return;
        const sprite = this.character.sprite;
        const dx = target.x - sprite.x;
        const dy = target.y - sprite.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 10) {
            const maxSpeed = this.character.moveSpeed * speedMultiplier;
            const nx = dx / dist;
            const ny = dy / dist;
            const targetVx = nx * maxSpeed;
            const targetVy = ny * maxSpeed;

            const currentVx = sprite.body.velocity.x;
            const currentVy = sprite.body.velocity.y;

            const lerpFactor = this.state === "PATROL" ? 0.05 : 0.1;

            const newVx = currentVx + (targetVx - currentVx) * lerpFactor;
            const newVy = currentVy + (targetVy - currentVy) * lerpFactor;

            sprite.setVelocity(newVx, newVy);
        } else {
            const currentVx = sprite.body.velocity.x;
            const currentVy = sprite.body.velocity.y;
            sprite.setVelocity(currentVx * 0.8, currentVy * 0.8);
        }
    }

    hasReachedMoveTarget() {
        if (!this.moveTarget) return true;
        const dist = Phaser.Math.Distance.Between(
            this.character.sprite.x,
            this.character.sprite.y,
            this.moveTarget.x,
            this.moveTarget.y
        );
        return dist < 10;
    }

    tryAttack() {
        const attackAbility = this.character.abilityMap["attack"] || this.character.abilityMap["tap"];
        if (attackAbility) {
            attackAbility.execute();
        }
    }
}

window.AIController = AIController;
window.SimpleAIController = SimpleAIController;
window.SensoryAIController = SensoryAIController;
