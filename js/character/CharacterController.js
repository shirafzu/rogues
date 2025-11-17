class CharacterController {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.preset =
      typeof options.preset === "string"
        ? CHARACTER_PRESETS[options.preset] || CHARACTER_PRESETS.default
        : options.preset || CHARACTER_PRESETS.default;

    const spawnX = options.spawn?.x ?? scene.scale.width / 2;
    const spawnY = options.spawn?.y ?? scene.scale.height / 2;

    this.kind = options.kind || "player";
    this.baseColor = options.baseColor ?? 0x4caf50;
    this.sprite = this.createSprite(spawnX, spawnY);

    const defaultCallbacks = {
      onAttackArea: null,
      onDodgeStart: () => this.sprite.setAlpha(0.5),
      onDodgeMove: null,
      onDodgeEnd: () => this.sprite.setAlpha(1),
      onHpChanged: null,
      onDeath: null,
    };
    this.callbacks = { ...defaultCallbacks, ...(options.callbacks || {}) };

    this.maxHp = this.preset.maxHp ?? 5;
    this.hp = this.maxHp;
    this.invincibleUntil = 0;
    this.damageCooldown = options.damageCooldown ?? 700;

    this.moveSpeed =
      (this.preset.movementConfig && this.preset.movementConfig.moveSpeed) || 6;
    this.baseMoveSpeed = this.moveSpeed;
    this.movementSpeedMultiplier = 1;

    const movementConfig = { ...(this.preset.movementConfig || {}) };
    const MovementClass = this.preset.movementController || BasicMovementController;
    this.movementController = MovementClass
      ? new MovementClass(this, movementConfig)
      : null;

    this.inputState = {
      activePointerId: null,
      touchStartPos: null,
      touchCurrentPos: null,
      touchStartTime: 0,
    };

    this.isDeadFlag = false;
    this.useInput = options.useInput !== undefined ? options.useInput : true;
    this.abilityMap = options.abilityMap || {};
    this.activeAbilities = new Set();

    this.syncSpriteState();

    if (this.useInput) {
      this.setupInputHandlers();
    }
  }

  createSprite(x, y) {
    const size = 60;
    const rect = this.scene.add.rectangle(x, y, size, size, this.baseColor);
    const sprite = this.scene.matter.add.gameObject(rect, {
      shape: { type: "rectangle" },
    });
    sprite.setFixedRotation();
    sprite.setData("kind", this.kind);
    sprite.setData("controller", this);
    sprite.setData("baseColor", this.baseColor);
    sprite.setData("_id", Phaser.Math.RND.uuid());
    return sprite;
  }

  setupInputHandlers() {
    if (this.inputHandlersAttached) return;
    const input = this.scene.input;
    this.boundHandlers = this.boundHandlers || {};
    this.boundHandlers.pointerdown = this.handlePointerDown.bind(this);
    this.boundHandlers.pointermove = this.handlePointerMove.bind(this);
    this.boundHandlers.pointerup = this.handlePointerUp.bind(this);
    input.on("pointerdown", this.boundHandlers.pointerdown);
    input.on("pointermove", this.boundHandlers.pointermove);
    input.on("pointerup", this.boundHandlers.pointerup);
    input.on("pointerupoutside", this.boundHandlers.pointerup);
    this.inputHandlersAttached = true;
  }

  detachInputHandlers() {
    if (!this.inputHandlersAttached || !this.boundHandlers) return;
    const input = this.scene.input;
    input.off("pointerdown", this.boundHandlers.pointerdown);
    input.off("pointermove", this.boundHandlers.pointermove);
    input.off("pointerup", this.boundHandlers.pointerup);
    input.off("pointerupoutside", this.boundHandlers.pointerup);
    this.inputHandlersAttached = false;
  }

  setAbilityMap(map = {}) {
    this.abilityMap = map;
  }

  handlePointerDown(pointer) {
    if (this.isDeadFlag) return;
    if (this.inputState.activePointerId !== null) return;

    this.inputState.activePointerId = pointer.id;
    this.inputState.touchStartPos = { x: pointer.x, y: pointer.y };
    this.inputState.touchCurrentPos = { x: pointer.x, y: pointer.y };
    this.inputState.touchStartTime = this.scene.time.now;
  }

  handlePointerMove(pointer) {
    if (pointer.id !== this.inputState.activePointerId) return;
    this.inputState.touchCurrentPos = { x: pointer.x, y: pointer.y };
  }

  handlePointerUp(pointer) {
    if (pointer.id !== this.inputState.activePointerId) return;

    const endPos = { x: pointer.x, y: pointer.y };
    const dx = endPos.x - this.inputState.touchStartPos.x;
    const dy = endPos.y - this.inputState.touchStartPos.y;
    const distance = Math.hypot(dx, dy);
    const duration = this.scene.time.now - this.inputState.touchStartTime;

    const tapMaxDistance = 20;
    const tapMaxDuration = 200;
    const flickMinDistance = 80;
    const flickMaxDuration = 250;

    if (distance <= tapMaxDistance && duration <= tapMaxDuration) {
      const cam = this.scene.cameras.main;
      const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
      this.triggerAbility("tap", { pointer: worldPoint });
    } else if (distance >= flickMinDistance && duration <= flickMaxDuration) {
      this.triggerAbility("flick", { direction: { x: dx, y: dy } });
    }

    if (!this.isAbilityBlockingMovement()) {
      this.sprite.setVelocity(0, 0);
    }

    this.inputState.activePointerId = null;
    this.inputState.touchStartPos = null;
    this.inputState.touchCurrentPos = null;
    this.inputState.touchStartTime = 0;
  }

  triggerAbility(slot, context = {}) {
    const ability = this.abilityMap?.[slot];
    if (!ability) return false;
    const executed = ability.execute(context);
    if (executed && ability.isActive()) {
      this.activeAbilities.add(ability);
    }
    return executed;
  }

  updateActiveAbilities(delta) {
    if (!this.activeAbilities || this.activeAbilities.size === 0) return;
    [...this.activeAbilities].forEach((ability) => {
      ability.update(delta);
      if (!ability.isActive()) {
        this.activeAbilities.delete(ability);
      }
    });
  }

  isAbilityBlockingMovement() {
    for (const ability of this.activeAbilities) {
      if (ability.blocksMovement()) return true;
    }
    return false;
  }

  update(delta) {
    if (this.isDeadFlag) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    this.updateActiveAbilities(delta);
    if (this.movementController) {
      this.movementController.update(delta);
    }
    this.applyMovementSpeedModifier();
  }

  setInvincibleFor(duration) {
    this.invincibleUntil = Math.max(
      this.invincibleUntil,
      this.scene.time.now + duration
    );
  }

  takeDamage(amount) {
    if (this.isDeadFlag) return;
    if (this.scene.time.now < this.invincibleUntil) return;

    this.invincibleUntil = this.scene.time.now + this.damageCooldown;
    this.hp = Math.max(0, this.hp - amount);
    this.syncSpriteState();

    if (this.kind === "player") {
      this.sprite.setFillStyle(0xff5722);
      this.scene.time.delayedCall(120, () => {
        if (this.sprite && !this.isDeadFlag) {
          this.sprite.setFillStyle(this.baseColor);
        }
      });
    }

    if (typeof this.callbacks.onHpChanged === "function") {
      this.callbacks.onHpChanged(this.hp, this.maxHp);
    }

    if (this.hp <= 0) {
      this.die();
    }
  }

  die() {
    if (this.isDeadFlag) return;
    this.isDeadFlag = true;
    this.sprite.setVelocity(0, 0);
    if (this.kind === "player") {
      this.sprite.setFillStyle(0x9e9e9e);
      this.sprite.setAlpha(0.6);
    }
    if (typeof this.callbacks.onDeath === "function") {
      this.callbacks.onDeath(this);
    }
  }

  revive() {
    this.isDeadFlag = false;
    this.hp = this.maxHp;
    this.sprite.setFillStyle(this.baseColor);
    this.sprite.setAlpha(1);
    this.syncSpriteState();
    if (typeof this.callbacks.onHpChanged === "function") {
      this.callbacks.onHpChanged(this.hp, this.maxHp);
    }
  }

  syncSpriteState() {
    if (!this.sprite) return;
    this.sprite.setData("hp", this.hp);
    this.sprite.setData("baseColor", this.baseColor);
  }

  isDead() {
    return this.isDeadFlag;
  }

  setMovementSpeedMultiplier(multiplier = 1) {
    const clamped =
      typeof Phaser !== "undefined" && Phaser?.Math?.Clamp
        ? Phaser.Math.Clamp(multiplier ?? 1, 0.2, 1)
        : Math.min(Math.max(multiplier ?? 1, 0.2), 1);
    this.movementSpeedMultiplier = clamped;
  }

  getMovementSpeedMultiplier() {
    return this.movementSpeedMultiplier ?? 1;
  }

  applyMovementSpeedModifier() {
    if (
      !this.sprite ||
      !this.sprite.body ||
      !this.sprite.body.velocity ||
      this.movementSpeedMultiplier === 1
    ) {
      return;
    }
    const velocity = this.sprite.body.velocity;
    const vx = velocity.x;
    const vy = velocity.y;
    if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) {
      return;
    }
    this.sprite.setVelocity(vx * this.movementSpeedMultiplier, vy * this.movementSpeedMultiplier);
  }
}

window.CharacterController = CharacterController;
