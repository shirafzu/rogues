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
    this.race = options.race || "human";
    this.baseColor = options.baseColor ?? 0x4caf50;
    this.sprite = this.createSprite(spawnX, spawnY);

    const defaultCallbacks = {
      onAttackArea: null,
      onDodgeStart: () => this.sprite.setAlpha(0.5),
      onDodgeMove: null,
      onDodgeEnd: () => this.sprite.setAlpha(1),
      onHpChanged: null,
      onDeath: null,
      onTapInput: null,
      onFlickInput: null,
      onLongSwipeInput: null,
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

    // 長距離移動の発動距離閾値
    this.longDistanceTriggerDistance = options.longDistanceTriggerDistance ?? 250;

    this.isDeadFlag = false;
    this.isDestroyed = false;
    this.useInput = options.useInput !== undefined ? options.useInput : true;
    this.abilityMap = options.abilityMap || {};
    this.activeAbilities = new Set();
    this._entityId = null; // EntityManagerによって設定される

    // ステータスラベル
    this.statusLabel = this.scene.add
      .text(0, 0, "", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(100); // キャラクターより手前
    this.statusLabel.setVisible(false);

    this.syncSpriteState();

    if (this.useInput) {
      this.setupInputHandlers();
    }

    // AIコントローラーの初期化
    const AIClass = options.aiController || null;
    this.aiController = AIClass
      ? new AIClass(this, options.aiConfig || {})
      : null;

    // 攻撃コントローラーの初期化（AI用）
    const AttackClass = options.attackController || null;
    if (AttackClass) {
      this.abilityMap["attack"] = new AttackAbilityWrapper(
        this,
        AttackClass,
        options.attackConfig || {}
      );
    }

    // サバイバルシステムの初期化
    if (window.SurvivalSystem && this.kind === "player") {
      this.survivalSystem = new SurvivalSystem(this, this.race);
    }

    // Dryad用の状態管理
    this.isRooting = false;
    this.rootingTime = 0;
  }

  createSprite(x, y) {
    const size = 60;
    const rect = this.scene.add.rectangle(x, y, size, size, this.baseColor);

    // 衝突カテゴリーの決定
    const categories = this.scene.collisionCategories || {};
    const isPlayer = this.kind === "player";
    const collisionCategory = isPlayer ? categories.PLAYER : categories.ENEMY;

    // 衝突マスクの設定（何と衝突するか）
    const collisionMask = isPlayer
      ? (categories.ENEMY | categories.OBSTACLE | categories.DYNAMIC_OBJECT | categories.WALL) // プレイヤーは敵、障害物、動的オブジェクト、壁と衝突
      : (categories.PLAYER | categories.OBSTACLE | categories.DYNAMIC_OBJECT | categories.WALL | categories.ENEMY); // 敵は全てと衝突

    const sprite = this.scene.matter.add.gameObject(rect, {
      shape: { type: "rectangle" },
      friction: 0.1, // キャラクターは滑らかに移動
      frictionAir: 0.05, // 空気抵抗を追加してスムーズな停止
      frictionStatic: 0.1,
      density: 0.002, // 適度な密度
      restitution: 0.0, // 反発なし
      slop: 0.02, // 貫通許容値を削減
      inertia: Infinity, // 回転しないように慣性を無限大に
      collisionFilter: {
        category: collisionCategory || 0x0001,
        mask: collisionMask || 0xFFFF
      }
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

  /**
   * クイックスロットにアイテムをセット
   */
  setQuickSlotItem(itemId) {
    let controller = null;

    if (itemId === "health_salve") {
      controller = HealingItemController;
    } else if (itemId === "campfire_kit") {
      controller = PlaceableItemController;
    } else if (itemId === "throwing_stone") {
      controller = ThrowingItemController;
    } else if (itemId === "spike_trap") {
      controller = PlaceableItemController;
    }

    if (controller) {
      this.abilityMap["item"] = new ItemAbilityWrapper(this, controller, { itemId });
      console.log(`Set quick slot: ${itemId}`);

      // UI更新通知
      if (typeof this.callbacks.onQuickSlotChanged === "function") {
        this.callbacks.onQuickSlotChanged(itemId);
      }
    } else {
      console.warn(`No controller found for item: ${itemId}`);
      this.clearQuickSlotItem();
    }
  }

  /**
   * クイックスロットをクリア
   */
  clearQuickSlotItem() {
    if (this.abilityMap["item"]) {
      delete this.abilityMap["item"];
      console.log("Cleared quick slot");
      if (typeof this.callbacks.onQuickSlotChanged === "function") {
        this.callbacks.onQuickSlotChanged(null);
      }
    }
  }

  /**
   * タップアクションを攻撃に戻す（デフォルト）
   * ※アイテム使用が別ボタンになったため、これは純粋な武器リセットとして機能
   */
  resetTapActionToAttack() {
    this.abilityMap["tap"] = new AttackAbilityWrapper(this, MeleeAoEAttackController, {
      radius: 120,
      cooldown: 250,
    });
    console.log("Equipped weapon: Default Attack");
  }

  handlePointerDown(pointer) {
    if (this.isDeadFlag) return;
    if (this.inputState.activePointerId !== null) return;

    // UI上の操作は無視
    if (this.scene.uiManager && typeof this.scene.uiManager.isPointerOnUI === 'function') {
      if (this.scene.uiManager.isPointerOnUI(pointer)) {
        return;
      }
    }

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

    // 長距離移動モード中の場合
    const longDistanceAbility = this.abilityMap?.["longSwipe"];
    if (longDistanceAbility?.isActive()) {
      // 短いタップで停止
      if (distance <= tapMaxDistance && duration <= tapMaxDuration) {
        longDistanceAbility.stop();
      }
      // 長距離移動モード中は指を離しても移動継続
      this.inputState.activePointerId = null;
      this.inputState.touchStartPos = null;
      this.inputState.touchCurrentPos = null;
      this.inputState.touchStartTime = 0;
      return;
    }

    // 入力判定の優先順位
    // 1. タップ（瞬間・最短距離）
    if (distance <= tapMaxDistance && duration <= tapMaxDuration) {
      const cam = this.scene.cameras.main;
      const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
      this.triggerAbility("tap", { pointer: worldPoint });

      // UI通知
      if (typeof this.callbacks.onTapInput === "function") {
        this.callbacks.onTapInput(worldPoint.x, worldPoint.y);
      }
    }
    // 2. フリック（短時間・短距離）
    else if (distance >= flickMinDistance && duration <= flickMaxDuration) {
      this.triggerAbility("flick", { direction: { x: dx, y: dy } });

      // UI通知
      if (typeof this.callbacks.onFlickInput === "function") {
        const len = Math.hypot(dx, dy);
        const normalizedDx = len > 0 ? dx / len : 0;
        const normalizedDy = len > 0 ? dy / len : 0;
        this.callbacks.onFlickInput(this.sprite.x, this.sprite.y, normalizedDx, normalizedDy);
      }
    }
    // 3. 長距離移動（長距離）
    else if (distance >= this.longDistanceTriggerDistance) {
      this.triggerAbility("longSwipe", { direction: { x: dx, y: dy } });

      // UI通知
      if (typeof this.callbacks.onLongSwipeInput === "function") {
        const startWorldX = this.sprite.x;
        const startWorldY = this.sprite.y;
        const cam = this.scene.cameras.main;
        const endWorldPoint = cam.getWorldPoint(endPos.x, endPos.y);
        this.callbacks.onLongSwipeInput(startWorldX, startWorldY, endWorldPoint.x, endWorldPoint.y);
      }
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
    // エンティティが破壊済みの場合は何もしない
    if (this.isDestroyed) {
      return;
    }

    // spriteが破壊されている場合は何もしない
    if (!this.sprite || !this.sprite.active) {
      return;
    }

    if (this.isDeadFlag) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    this.updateActiveAbilities(delta);

    // AI更新
    if (this.aiController) {
      this.aiController.update(delta);
    } else if (this.movementController) {
      // AIがない場合は通常のMovementController（入力依存など）
      this.movementController.update(delta);
    }

    // サバイバルシステム更新
    if (this.survivalSystem) {
      this.survivalSystem.update(delta);

      // Dryadの特殊能力: Rooting (根を張る)
      // 条件: Dryadであること、移動していないこと、水分が十分あること
      if (this.race === "dryad") {
        this.handleDryadRooting(delta);
      }
    }

    // 移動中なら音を出す（低強度）
    if (this.movementController && this.movementController.isMoving) {
      if (Math.random() < 0.05) { // 毎フレームではなく確率で
        this.emitSound(0.3);
      }
      // 匂いを残す
      this.updateScent(delta);
    }

    this.applyMovementSpeedModifier();

    // ステータスラベルの位置更新
    if (this.statusLabel && this.statusLabel.visible) {
      this.statusLabel.setPosition(this.sprite.x, this.sprite.y - 50);
    }
  }

  /**
   * Dryadの根を張る回復処理
   */
  handleDryadRooting(delta) {
    if (!this.sprite || !this.survivalSystem) return;

    const vx = this.sprite.body?.velocity?.x || 0;
    const vy = this.sprite.body?.velocity?.y || 0;
    const isMoving = Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1;

    // 移動中は根を張れない
    if (isMoving) {
      this.isRooting = false;
      this.rootingTime = 0;
      return;
    }

    // 条件チェック: 水分が50%以上あるか
    const hydration = this.survivalSystem.getStat("hydration");
    if (!hydration || hydration.current < hydration.max * 0.5) {
      this.isRooting = false;
      this.rootingTime = 0;
      return;
    }

    // TODO: 明るい場所かどうか、土の上かどうかのチェックを追加
    // 現在は簡易実装として、停止していれば根を張る

    // 根を張っている状態
    this.isRooting = true;
    this.rootingTime += delta;

    // 1秒ごとにHPを回復
    if (this.rootingTime >= 1000) {
      this.rootingTime = 0;
      if (this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + 1);
        if (typeof this.callbacks.onHpChanged === "function") {
          this.callbacks.onHpChanged(this.hp, this.maxHp);
        }

        // エフェクト表示
        const gfx = this.scene.add.circle(this.sprite.x, this.sprite.y, 20, 0x66bb6a, 0.3);
        this.scene.tweens.add({
          targets: gfx,
          scale: 2,
          alpha: 0,
          duration: 1000,
          onComplete: () => gfx.destroy(),
        });
      }
    }
  }

  updateStatusLabel(text, color = "#ffffff") {
    if (!this.statusLabel) return;
    if (!text) {
      this.statusLabel.setVisible(false);
      return;
    }
    this.statusLabel.setText(text);
    this.statusLabel.setColor(color);
    this.statusLabel.setVisible(true);
  }

  setInvincibleFor(duration) {
    this.invincibleUntil = Math.max(
      this.invincibleUntil,
      this.scene.time.now + duration
    );
  }

  /**
   * 音を発する（AIが感知するイベント）
   * @param {number} intensity - 音の大きさ (0.0 - 1.0)
   */
  emitSound(intensity) {
    if (!this.scene || !this.scene.events) return;

    this.scene.events.emit("sound_emitted", {
      x: this.sprite.x,
      y: this.sprite.y,
      intensity: intensity,
      source: this,
    });
  }

  /**
   * 匂いを残す
   */
  updateScent(delta) {
    if (!this.scene.scentManager) return;

    // 前回の匂い位置からの距離をチェック
    if (!this.lastScentPos) {
      this.lastScentPos = { x: this.sprite.x, y: this.sprite.y };
      this.scene.scentManager.addScentNode(this.sprite.x, this.sprite.y, this);
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      this.lastScentPos.x,
      this.lastScentPos.y
    );

    // 50px移動するごとに匂いを残す
    if (dist > 50) {
      this.scene.scentManager.addScentNode(this.sprite.x, this.sprite.y, this);
      this.lastScentPos = { x: this.sprite.x, y: this.sprite.y };
    }
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

    // 長距離移動中は速度調整をスキップ（長距離コントローラーが速度を管理している）
    const longDistanceAbility = this.abilityMap?.["longSwipe"];
    if (longDistanceAbility?.isActive()) {
      return;
    }

    const velocity = this.sprite.body.velocity;
    const vx = velocity.x;
    const vy = velocity.y;
    if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) {
      return;
    }

    // setVelocityメソッドの存在確認
    if (this.sprite.setVelocity) {
      this.sprite.setVelocity(vx * this.movementSpeedMultiplier, vy * this.movementSpeedMultiplier);
    }
  }

  /**
   * エンティティを破壊してリソースをクリーンアップ
   * EntityManagerから呼ばれる
   */
  destroy() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    // 入力ハンドラーをデタッチ
    if (this.useInput) {
      this.detachInputHandlers();
    }

    // すべてのアクティブなabilityをクリーンアップ
    if (this.activeAbilities) {
      this.activeAbilities.clear();
    }

    // spriteを破壊
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
    if (this.statusLabel) {
      this.statusLabel.destroy();
      this.statusLabel = null;
    }

    // 参照をクリア
    if (this.aiController && typeof this.aiController.destroy === 'function') {
      this.aiController.destroy();
    }
    this.aiController = null;
    this.movementController = null;
    this.abilityMap = null;
  }
}

window.CharacterController = CharacterController;
