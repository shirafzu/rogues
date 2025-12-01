class AIController {
    constructor(character, config = {}) {
        this.character = character;
        this.config = config;
        this.scene = character.scene;
    }

    clearDebugGraphics() {
        if (this.debugGraphics) {
            this.debugGraphics.clear();
            this.debugGraphics.destroy();
            this.debugGraphics = null;
        }
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

        // Obstacle Avoidance Config
        this.avoidanceConfig = config.avoidance || {
            rayCount: 8,
            rayLength: 60, // Detection range
            avoidForce: 1.5, // How strongly to avoid
            debug: false
        };

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
        this.clearDebugGraphics();
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

        // Debug/Vision Draw
        // console.log(`[AIController] Update. Entity: ${this.character._entityId}, Vision: ${!!this.senses.vision}, SpriteActive: ${this.character.sprite?.active}`);
        this.drawDebug();
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
                    this.lastKnownPos = { x: scentNode.x, y: scentNode.y };

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
        for (const collision of bodies) {
            // Matter.Query.ray returns collision objects.
            const body = collision.bodyA || collision.bodyB;
            if (!body) continue;

            // Ignore self and target
            if (body.gameObject === this.character.sprite) continue;
            if (body.gameObject === target) continue;

            // Handle compound bodies
            if (body.parent && body.parent.gameObject === this.character.sprite) continue;
            if (body.parent && body.parent.gameObject === target) continue;

            // Ignore sensors
            if (body.isSensor) continue;

            // If we hit something else, LOS is blocked
            // console.log(`[AI Debug] Blocked by: ${body.label}`);
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

    getBestMoveDirection(target) {
        const sprite = this.character.sprite;
        const rayCount = this.avoidanceConfig.rayCount;
        const rayLength = this.avoidanceConfig.rayLength;
        const clearanceRadius = this.getAgentRadius();

        // 1. Interest Map (Direction to target)
        const angleToTarget = Phaser.Math.Angle.Between(sprite.x, sprite.y, target.x, target.y);

        // 2. Danger Map (Obstacles)
        const dangerMap = new Array(rayCount).fill(0);
        const interestMap = new Array(rayCount).fill(0);

        // Calculate interest for each ray direction
        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2;
            // Simple dot product to see alignment with target direction
            // We want directions close to the target angle to have higher interest
            // Cosine similarity: 1.0 if aligned, -1.0 if opposite
            // We map this to 0..1 roughly, or just use it as weight

            // Difference between ray angle and target angle
            let diff = angle - angleToTarget;
            // Normalize to -PI..PI
            while (diff <= -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            // Interest is higher if angle is closer to target
            // Gaussian-like falloff or linear
            const weight = Math.max(0, 1 - Math.abs(diff) / (Math.PI / 2)); // Only forward 180 degrees relevant?
            // Actually let's allow all directions but prefer target
            interestMap[i] = Math.max(0, Math.cos(diff));
        }

        // Cast rays to populate Danger Map
        if (this.scene.matter) {
            const start = { x: sprite.x, y: sprite.y };

            for (let i = 0; i < rayCount; i++) {
                const angle = (i / rayCount) * Math.PI * 2;
                const dir = { x: Math.cos(angle), y: Math.sin(angle) };
                const perp = { x: -dir.y, y: dir.x };

                // Cast multiple rays offset by the character's radius so we account for body width
                const offsets = [0, clearanceRadius * 0.9, -clearanceRadius * 0.9];
                let worstDanger = 0;

                for (const offset of offsets) {
                    const rayStart = {
                        x: start.x + perp.x * offset,
                        y: start.y + perp.y * offset
                    };
                    const rayEnd = {
                        x: rayStart.x + dir.x * rayLength,
                        y: rayStart.y + dir.y * rayLength
                    };

                    const hitDistance = this.castRayForClearance(rayStart, rayEnd, sprite, target);
                    if (hitDistance !== null) {
                        // Danger increases the closer the obstacle is to the start point
                        const clearanceDist = hitDistance - clearanceRadius;
                        const normalized = Phaser.Math.Clamp(clearanceDist / rayLength, 0, 1);
                        const danger = 1 - normalized;
                        worstDanger = Math.max(worstDanger, danger);
                    }
                }

                if (worstDanger > 0) {
                    dangerMap[i] = Math.min(1, worstDanger * this.avoidanceConfig.avoidForce);
                }
            }
        }

        // 3. Choose Best Direction
        // Subtract danger from interest
        let bestDirIndex = -1;
        let maxScore = -Infinity;

        for (let i = 0; i < rayCount; i++) {
            const score = interestMap[i] - (dangerMap[i] * this.avoidanceConfig.avoidForce);
            if (score > maxScore) {
                maxScore = score;
                bestDirIndex = i;
            }
        }

        if (bestDirIndex !== -1) {
            const angle = (bestDirIndex / rayCount) * Math.PI * 2;
            return { x: Math.cos(angle), y: Math.sin(angle) };
        }

        // Fallback to direct
        return null;
    }

    getAgentRadius() {
        const body = this.character.sprite?.body;
        if (!body) return 0;
        if (body.circleRadius) return body.circleRadius;

        const bounds = body.bounds;
        if (!bounds) return 0;

        const width = bounds.max.x - bounds.min.x;
        const height = bounds.max.y - bounds.min.y;
        return Math.max(width, height) / 2;
    }

    castRayForClearance(start, end, sprite, target) {
        const results = this.scene.matter.query.ray(
            this.scene.matter.world.localWorld.bodies,
            start,
            end
        );

        let nearest = null;

        for (const res of results) {
            const body = res.body || res.bodyA || res.bodyB || res;
            if (!body) continue;
            if (body.gameObject === sprite) continue;
            if (body.isSensor) continue;
            if (body.gameObject === target) continue;
            if (body.parent && (body.parent.gameObject === sprite || body.parent.gameObject === target)) continue;

            const point = res.point || res;
            const px = point.x ?? body.position?.x ?? end.x;
            const py = point.y ?? body.position?.y ?? end.y;
            const dist = Phaser.Math.Distance.Between(start.x, start.y, px, py);

            if (nearest === null || dist < nearest) {
                nearest = dist;
            }
        }

        return nearest;
    }

    moveTo(target, speedMultiplier = 1.0) {
        if (!target) return;
        const sprite = this.character.sprite;
        const dist = Phaser.Math.Distance.Between(sprite.x, sprite.y, target.x, target.y);

        if (dist > 10) {
            let nx, ny;

            // Use Context Steering for obstacle avoidance
            const bestDir = this.getBestMoveDirection(target);

            if (bestDir) {
                nx = bestDir.x;
                ny = bestDir.y;
            } else {
                // Fallback to direct
                const dx = target.x - sprite.x;
                const dy = target.y - sprite.y;
                nx = dx / dist;
                ny = dy / dist;
            }

            const maxSpeed = this.character.moveSpeed * speedMultiplier;
            const targetVx = nx * maxSpeed;
            const targetVy = ny * maxSpeed;

            const currentVx = sprite.body.velocity.x;
            const currentVy = sprite.body.velocity.y;

            // Smooth turn
            const lerpFactor = this.state === "PATROL" ? 0.05 : 0.1;

            const newVx = currentVx + (targetVx - currentVx) * lerpFactor;
            const newVy = currentVy + (targetVy - currentVy) * lerpFactor;

            sprite.setVelocity(newVx, newVy);

            // Update rotation to face movement direction
            if (Math.abs(newVx) > 0.1 || Math.abs(newVy) > 0.1) {
                sprite.setRotation(Math.atan2(newVy, newVx));
            }

            // Store debug info
            this.debugInfo = {
                target: target,
                bestDir: bestDir
            };

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

    drawDebug() {
        if (!this.debugGraphics) {
            this.debugGraphics = this.scene.add.graphics();
            this.debugGraphics.setDepth(9999); // Topmost
        }
        const graphics = this.debugGraphics;
        graphics.clear();

        const sprite = this.character.sprite;
        if (!sprite || !sprite.active) {
            graphics.clear();
            return;
        }

        // Vision Cone Visualization
        const vision = this.senses.vision;
        if (vision && vision.range > 0) {
            let color = 0x0000ff; // Blue: Patrol/Idle
            if (this.state === "SEARCH") color = 0xffff00; // Yellow: Search
            if (this.state === "CHASE" || this.state === "ATTACK") color = 0xff0000; // Red: Chase

            const angle = sprite.rotation;
            const halfAngle = Phaser.Math.DegToRad(vision.angle / 2);

            graphics.fillStyle(color, 0.2); // Semi-transparent
            graphics.slice(sprite.x, sprite.y, vision.range, angle - halfAngle, angle + halfAngle, false);
            graphics.fillPath();
        }
    }
}

window.AIController = AIController;
window.SimpleAIController = SimpleAIController;
window.SensoryAIController = SensoryAIController;
