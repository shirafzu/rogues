// ROGUES Prototype - Basic Phaser Game Shell

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: "MainScene" });

    this.playerController = null;
    this.playerRadius = 30;
    this.worldWidth = 720;
    this.worldHeight = 1280;
    this.wallThickness = 40;
    // 敵関連
    this.enemies = [];
    this.enemySpeed = 2;
    this.knockbackSpeed = 8;
    this.knockbackDuration = 180;

    // 物理オブジェクト（押せる箱など）
    this.crates = [];
    this.resourcePickups = [];
    this.resourceColors = {
      wood: 0x8d6e63,
      ore: 0xb0bec5,
      scrap: 0x90a4ae,
      herb: 0x66bb6a,
    };
    this.resourcePickupRadius = 70;

    // 化学エンジン（火属性）
    this.fireSystem = new FireChemicalSystem(this, {
      fireDuration: 2000,
      fireTickInterval: 400,
      fireDamagePerTick: 1,
      fireSpreadRadius: 150,
      windDirX: 0,
      windDirY: 1,
      fireDownwindMultiplier: 1.8,
      fireUpwindMultiplier: 0.6,
    });

    this.combatSystem = new CombatSystem(this, {
      getEnemies: () => this.enemies,
      getCrates: () => this.crates,
      knockbackSpeed: this.knockbackSpeed,
      knockbackDuration: this.knockbackDuration,
      onCrateRemoved: (crate) => {
        this.crates = this.crates.filter((c) => c !== crate);
      },
      onCrateDestroyed: (info) => this.onCrateDestroyed(info),
      igniteHandler: (entity) => this.fireSystem?.ignite(entity),
    });

    this.isGameOver = false;
    this.hpText = null;
    this.inventory = null;
    this.inventoryChangeUnsub = null;
    this.inventoryUIElements = null;
  }

  preload() {
    // ここでは外部アセットを使わず、簡易図形でプレイヤー等を表現する
  }

  create() {
    const worldWidth = 720;
    const worldHeight = 1280;

    // 画面端に簡易的な壁（Map の雛形）
    const wallThickness = 40;
    const wallColor = 0x555555;

    // 上
    const topWall = this.add.rectangle(
      worldWidth / 2,
      wallThickness / 2,
      worldWidth,
      wallThickness,
      wallColor
    );
    this.matter.add.gameObject(topWall, {
      isStatic: true,
    });

    // 下
    const bottomWall = this.add.rectangle(
      worldWidth / 2,
      worldHeight - wallThickness / 2,
      worldWidth,
      wallThickness,
      wallColor
    );
    this.matter.add.gameObject(bottomWall, {
      isStatic: true,
    });

    // 左
    const leftWall = this.add.rectangle(
      wallThickness / 2,
      worldHeight / 2,
      wallThickness,
      worldHeight,
      wallColor
    );
    this.matter.add.gameObject(leftWall, {
      isStatic: true,
    });

    // 右
    const rightWall = this.add.rectangle(
      worldWidth - wallThickness / 2,
      worldHeight / 2,
      wallThickness,
      worldHeight,
      wallColor
    );
    this.matter.add.gameObject(rightWall, {
      isStatic: true,
    });

    // 押せる箱（動的な物理オブジェクト）を配置
    this.spawnCrate(worldWidth * 0.3, worldHeight * 0.6);
    this.spawnCrate(worldWidth * 0.7, worldHeight * 0.6);

    // 簡易的な敵を数体スポーン
    this.spawnEnemy(worldWidth * 0.25, worldHeight * 0.4);
    this.spawnEnemy(worldWidth * 0.75, worldHeight * 0.5);
    this.spawnEnemy(worldWidth * 0.5, worldHeight * 0.3);

    // カメラ設定（今回はワールド全体 = 画面と同サイズ）
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);

    // HP 表示
    this.hpText = this.add
      .text(16, 16, "", {
        fontFamily: "sans-serif",
        fontSize: "24px",
        color: "#ffffff",
      })
      .setScrollFactor(0);
    this.updateHpUI();

    // デバッグ用の簡易テキスト
    this.add
      .text(worldWidth / 2, worldHeight * 0.1, "ROGUES Prototype", {
        fontFamily: "sans-serif",
        fontSize: "28px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // 物理衝突イベント（プレイヤーと敵の接触ダメージ用）
    this.matter.world.on("collisionstart", this.handleCollisionStart, this);

    this.setupInventorySystem();
    this.events.once("shutdown", () => {
      this.cleanupInventorySystem();
    });

    this.showCharacterSelection();
  }

  update(time, delta) {
    if (this.isGameOver) {
      if (this.playerController?.sprite) {
        this.playerController.sprite.setVelocity(0, 0);
      }
      this.enemies.forEach((enemy) => {
        if (enemy?.sprite) {
          enemy.sprite.setVelocity(0, 0);
        }
      });
      return;
    }

    if (this.playerController) {
      this.playerController.update(delta);
    }
    this.updateEnemies(delta);
    this.crates = this.crates.filter((crate) => crate && crate.active);
    if (this.fireSystem) {
      this.fireSystem.update({
        enemies: this.enemies,
        crates: this.crates,
        damageEnemy: (enemy, amt) => this.combatSystem.damageEnemySprite(enemy, amt),
        damageCrate: (crate, amt) => this.combatSystem.damageCrateSprite(crate, amt),
      });
    }
    this.updateResourcePickups();
    this.clampPlayerToBounds();
  }

  updateEnemies(delta) {
    this.enemies = this.enemies.filter(
      (enemy) => enemy && enemy.sprite && enemy.sprite.active && !enemy.isDead()
    );

    this.enemies.forEach((enemy) => {
      enemy.update(delta);
    });
  }

  clampPlayerToBounds() {
    if (!this.playerController?.sprite) return;
    const player = this.playerController.sprite;

    const halfSize = this.playerRadius;
    const margin = this.wallThickness;
    const minX = halfSize + margin;
    const maxX = this.worldWidth - halfSize - margin;
    const minY = halfSize + margin;
    const maxY = this.worldHeight - halfSize - margin;

    const clampedX = Phaser.Math.Clamp(player.x, minX, maxX);
    const clampedY = Phaser.Math.Clamp(player.y, minY, maxY);

    if (clampedX !== player.x || clampedY !== player.y) {
      player.setPosition(clampedX, clampedY);
      player.setVelocity(0, 0);
    }
  }

  spawnEnemy(x, y) {
    let enemyController = null;
    enemyController = CharacterFactory.createEnemy(this, {
      spawn: { x, y },
      baseColor: 0xf44336,
      movementConfig: {
        moveSpeed: this.enemySpeed,
        targetProvider: () => this.playerController?.sprite,
      },
      callbacks: {
        onDeath: () => this.handleEnemyDeath(enemyController),
      },
    });

    // エネミースプライトに参照を保持
    enemyController.sprite.setData("controller", enemyController);

    this.enemies.push(enemyController);
  }

  spawnCrate(x, y) {
    const size = 70;
    const color = 0x9e9e9e;

    const rect = this.add.rectangle(x, y, size, size, color);
    const crate = this.matter.add.gameObject(rect, {
      shape: { type: "rectangle" },
      friction: 0.8,
      frictionStatic: 1.0,
      restitution: 0.1,
    });

    crate.setFixedRotation(); // 箱は回転させない
    crate.setData("kind", "crate");
    crate.setData("hp", 3);
    crate.setData("baseColor", color);
    crate.setData("dropTable", this.getDefaultCrateDropTable());

    this.crates.push(crate);
  }

  handleCollisionStart(event) {
    if (!this.playerController || this.isGameOver) return;

    const now = this.time.now;
    if (now < this.playerController.invincibleUntil) return;

    const pairs = event.pairs || [];
    pairs.forEach((pair) => {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      const goA = bodyA.gameObject;
      const goB = bodyB.gameObject;
      if (!goA || !goB) return;

      const kindA = goA.getData("kind");
      const kindB = goB.getData("kind");

      const isPlayerEnemy =
        (kindA === "player" && kindB === "enemy") ||
        (kindA === "enemy" && kindB === "player");

      if (isPlayerEnemy) {
        this.playerController.takeDamage(1);
      }
    });
  }

  handlePlayerDeath() {
    if (this.isGameOver) return;
    this.isGameOver = true;

    if (this.playerController?.sprite) {
      this.playerController.sprite.setVelocity(0, 0);
      this.playerController.sprite.setFillStyle(0x9e9e9e);
    }

    // 画面中央に Game Over テキスト
    const cam = this.cameras.main;
    this.add
      .text(cam.worldView.centerX, cam.worldView.centerY, "GAME OVER\nTap to Restart", {
        fontFamily: "sans-serif",
        fontSize: "40px",
        color: "#ff5252",
        align: "center",
      })
      .setOrigin(0.5);

    this.input.once("pointerdown", () => {
      this.scene.restart();
    });
  }

  handleEnemyDeath(enemyController) {
    const sprite = enemyController?.sprite;
    if (sprite && sprite.active) {
      sprite.destroy();
    }
    this.enemies = this.enemies.filter((enemy) => enemy !== enemyController);
  }

  showCharacterSelection() {
    if (document.getElementById("character-select-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "character-select-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.85)",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: "18px",
      zIndex: "9999",
      fontFamily: "sans-serif",
      padding: "24px",
      boxSizing: "border-box",
    });

    const title = document.createElement("h2");
    title.textContent = "Customize Your Character";
    title.style.margin = "0";
    overlay.appendChild(title);

    const hint = document.createElement("p");
    hint.textContent = "Choose movement, dodge, and attack styles (prototype).";
    hint.style.margin = "0";
    hint.style.fontSize = "14px";
    overlay.appendChild(hint);

    const sectionsContainer = document.createElement("div");
    Object.assign(sectionsContainer.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "20px",
      justifyContent: "center",
      maxWidth: "900px",
    });

    const createOptionSection = (labelText, optionsMap) => {
      const section = document.createElement("div");
      Object.assign(section.style, {
        minWidth: "220px",
        maxWidth: "260px",
        background: "rgba(255,255,255,0.05)",
        padding: "12px",
        borderRadius: "8px",
      });

      const label = document.createElement("label");
      label.textContent = labelText;
      label.style.display = "block";
      label.style.marginBottom = "6px";
      section.appendChild(label);

      const select = document.createElement("select");
      Object.assign(select.style, {
        width: "100%",
        padding: "6px",
      });

      Object.entries(optionsMap).forEach(([key, option]) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = option.name;
        select.appendChild(opt);
      });

      const desc = document.createElement("p");
      desc.style.fontSize = "13px";
      desc.style.minHeight = "48px";
      desc.style.margin = "8px 0 0";

      const updateDescription = () => {
        const option = optionsMap[select.value];
        desc.textContent = option?.description || "";
      };
      select.addEventListener("change", updateDescription);
      updateDescription();

      section.appendChild(select);
      section.appendChild(desc);
      return { section, select };
    };

    const movementSection = createOptionSection("Movement", AVAILABLE_MOVEMENTS);
    const dodgeSection = createOptionSection("Dodge", AVAILABLE_DODGES);
    const attackSection = createOptionSection("Attack", AVAILABLE_ATTACKS);

    sectionsContainer.appendChild(movementSection.section);
    sectionsContainer.appendChild(dodgeSection.section);
    sectionsContainer.appendChild(attackSection.section);
    overlay.appendChild(sectionsContainer);

    const startButton = document.createElement("button");
    startButton.textContent = "Start";
    Object.assign(startButton.style, {
      padding: "10px 18px",
      fontSize: "16px",
      cursor: "pointer",
    });
    startButton.addEventListener("click", () => {
      this.initPlayerWithOptions({
        movementKey: movementSection.select.value,
        dodgeKey: dodgeSection.select.value,
        attackKey: attackSection.select.value,
      });
      overlay.remove();
    });

    overlay.appendChild(startButton);
    document.body.appendChild(overlay);
  }

  initPlayerWithOptions(selection) {
    if (this.playerController) {
      this.playerController.detachInputHandlers();
      if (this.playerController.sprite) {
        this.playerController.sprite.destroy();
      }
      this.playerController = null;
    }

    const movementOption =
      AVAILABLE_MOVEMENTS[selection?.movementKey] || AVAILABLE_MOVEMENTS.basic;
    const dodgeOption =
      AVAILABLE_DODGES[selection?.dodgeKey] || AVAILABLE_DODGES.dash;
    const attackOption =
      AVAILABLE_ATTACKS[selection?.attackKey] || AVAILABLE_ATTACKS.aoe;

    const preset = {
      maxHp: attackOption.maxHp || dodgeOption.maxHp || movementOption.maxHp || 5,
      movementController: movementOption.controller,
      movementConfig: { ...(movementOption.config || {}) },
      dodgeController: dodgeOption.controller,
      dodgeConfig: { ...(dodgeOption.config || {}) },
      attackController: attackOption.controller,
      attackConfig: { ...(attackOption.config || {}) },
    };

    const spawnX = this.worldWidth / 2;
    const spawnY = this.worldHeight * 0.7;
    this.playerController = new CharacterController(this, {
      preset,
      spawn: { x: spawnX, y: spawnY },
      baseColor:
        attackOption.baseColor || movementOption.baseColor || 0x4caf50,
      callbacks: {
        onAttackArea: (area) => this.combatSystem.handlePlayerAttackArea(area),
        onHpChanged: (hp, maxHp) => this.updateHpUI(hp, maxHp),
        onDeath: () => this.handlePlayerDeath(),
      },
    });

    const player = this.playerController;
    const abilityMap = {
      tap:
        attackOption.abilityFactory?.(player) ||
        new AttackAbilityWrapper(
          player,
          MeleeAoEAttackController,
          { radius: 120, cooldown: 250 }
        ),
      flick:
        dodgeOption.abilityFactory?.(player) ||
        new DodgeAbilityWrapper(
          player,
          DashDodgeController,
          { distance: 120, duration: 300, invincibleDuration: 200 }
        ),
    };
    player.setAbilityMap(abilityMap);
    this.updateInventoryMovementPenalty();

    this.combatSystem.setPlayerController(this.playerController);
    this.cameras.main.startFollow(this.playerController.sprite);
    this.isGameOver = false;
    this.updateHpUI(this.playerController.hp, this.playerController.maxHp);
  }

  updateHpUI(currentHp = this.playerController?.hp, maxHp = this.playerController?.maxHp) {
    if (!this.hpText) return;
    if (currentHp == null || maxHp == null) {
      this.hpText.setText("HP: --/--");
      return;
    }
    this.hpText.setText(`HP: ${currentHp}/${maxHp}`);
  }

  setupInventorySystem() {
    this.cleanupInventorySystem();
    if (typeof InventorySystem !== "function") {
      console.warn("[ROGUES] InventorySystem is not available yet.");
      return;
    }
    this.inventory = new InventorySystem({
      slotCount: 8,
      slowdownThreshold: 20,
      weightCapacity: 40,
      minSpeedMultiplier: 0.5,
    });
    this.inventoryChangeUnsub = this.inventory.addChangeListener(() => {
      this.updateInventoryUI();
      this.updateInventoryMovementPenalty();
    });
    this.createInventoryOverlay();
    this.updateInventoryUI();
  }

  cleanupInventorySystem() {
    if (typeof this.inventoryChangeUnsub === "function") {
      this.inventoryChangeUnsub();
      this.inventoryChangeUnsub = null;
    }
    if (this.inventory) {
      this.inventory.destroy();
      this.inventory = null;
    }
    this.destroyInventoryUI();
  }

  createInventoryOverlay() {
    this.destroyInventoryUI();
    if (typeof document === "undefined") return;

    const container = document.createElement("div");
    container.id = "inventory-overlay";
    Object.assign(container.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      width: "280px",
      maxHeight: "85vh",
      overflowY: "auto",
      background: "rgba(0,0,0,0.78)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "12px",
      padding: "12px",
      color: "#fff",
      fontFamily: "sans-serif",
      fontSize: "14px",
      zIndex: "10000",
      boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "8px",
    });

    const title = document.createElement("h3");
    title.textContent = "Inventory";
    title.style.margin = "0";
    title.style.fontSize = "18px";
    header.appendChild(title);

    const collapseButton = document.createElement("button");
    collapseButton.textContent = "Hide";
    Object.assign(collapseButton.style, {
      background: "rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.2)",
      color: "#fff",
      borderRadius: "6px",
      padding: "4px 10px",
      cursor: "pointer",
    });
    header.appendChild(collapseButton);

    const bodyWrapper = document.createElement("div");

    const summaryWeight = document.createElement("div");
    const summaryMovement = document.createElement("div");
    summaryWeight.style.marginBottom = "4px";
    summaryMovement.style.marginBottom = "10px";

    bodyWrapper.appendChild(summaryWeight);
    bodyWrapper.appendChild(summaryMovement);

    const slotList = document.createElement("ul");
    Object.assign(slotList.style, {
      listStyle: "none",
      padding: "0",
      margin: "0 0 12px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    });
    bodyWrapper.appendChild(slotList);

    const quickCraftHeader = document.createElement("p");
    quickCraftHeader.textContent = "Quick Craft (WIP)";
    quickCraftHeader.style.margin = "8px 0 4px";
    quickCraftHeader.style.fontWeight = "bold";
    bodyWrapper.appendChild(quickCraftHeader);

    const quickCraftList = document.createElement("div");
    quickCraftList.style.display = "flex";
    quickCraftList.style.flexDirection = "column";
    quickCraftList.style.gap = "6px";
    this.buildQuickCraftList(quickCraftList);
    bodyWrapper.appendChild(quickCraftList);

    const devLabel = document.createElement("p");
    devLabel.textContent = "Dev Resource Injector";
    devLabel.style.margin = "12px 0 2px";
    devLabel.style.fontSize = "12px";
    devLabel.style.opacity = "0.7";
    bodyWrapper.appendChild(devLabel);

    const devButtons = document.createElement("div");
    Object.assign(devButtons.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
    });
    this.buildDebugResourceButtons(devButtons);
    bodyWrapper.appendChild(devButtons);

    collapseButton.addEventListener("click", () => {
      const collapsed = bodyWrapper.style.display === "none";
      bodyWrapper.style.display = collapsed ? "block" : "none";
      collapseButton.textContent = collapsed ? "Hide" : "Show";
    });

    container.appendChild(header);
    container.appendChild(bodyWrapper);
    document.body.appendChild(container);
    this.inventoryUIElements = {
      container,
      bodyWrapper,
      summaryWeight,
      summaryMovement,
      slotList,
      quickCraftList,
    };
  }

  buildQuickCraftList(container) {
    if (!container || typeof container !== "object") return;
    container.innerHTML = "";
    const recipes = Array.isArray(QUICK_CRAFT_RECIPES) ? QUICK_CRAFT_RECIPES : [];
    recipes.forEach((recipe) => {
      const row = document.createElement("div");
      Object.assign(row.style, {
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "6px",
        padding: "6px",
      });
      const label = document.createElement("div");
      label.textContent = recipe.name;
      label.style.fontWeight = "bold";
      label.style.fontSize = "13px";
      row.appendChild(label);

      const desc = document.createElement("div");
      desc.textContent = recipe.description;
      desc.style.fontSize = "12px";
      desc.style.marginBottom = "4px";
      desc.style.opacity = "0.85";
      row.appendChild(desc);

      const cost = document.createElement("div");
      cost.textContent = `Cost: ${Object.entries(recipe.costs || {})
        .map(([resourceId, qty]) => `${RESOURCE_DEFINITIONS[resourceId]?.name || resourceId} x${qty}`)
        .join(", ")}`;
      cost.style.fontSize = "12px";
      cost.style.marginBottom = "4px";
      row.appendChild(cost);

      const button = document.createElement("button");
      button.textContent = "Craft (WIP)";
      button.disabled = true;
      Object.assign(button.style, {
        width: "100%",
        padding: "4px",
        borderRadius: "4px",
        border: "1px solid rgba(255,255,255,0.2)",
        background: "rgba(255,255,255,0.08)",
        color: "#fff",
        cursor: "not-allowed",
      });
      row.appendChild(button);

      container.appendChild(row);
    });
  }

  buildDebugResourceButtons(container) {
    if (!container || typeof container !== "object") return;
    container.innerHTML = "";
    const definitions = RESOURCE_DEFINITIONS || {};
    Object.values(definitions).forEach((resource) => {
      const button = document.createElement("button");
      button.textContent = `+${resource.name}`;
      Object.assign(button.style, {
        borderRadius: "4px",
        border: "1px solid rgba(255,255,255,0.2)",
        background: "rgba(255,255,255,0.05)",
        color: "#fff",
        padding: "4px 8px",
        cursor: "pointer",
      });
      button.addEventListener("click", () => {
        this.inventory?.addResource(resource.id, 1);
      });
      container.appendChild(button);
    });
  }

  updateInventoryUI() {
    if (!this.inventory || !this.inventoryUIElements) return;
    const { container, summaryWeight, summaryMovement, slotList } = this.inventoryUIElements;
    if (!container || !slotList) return;
    const stats = this.inventory.getWeightStats();
    summaryWeight.textContent = `Weight: ${stats.totalWeight.toFixed(1)} / ${stats.capacity.toFixed(1)}`;
    summaryMovement.textContent = `Move Speed: ${(stats.movementMultiplier * 100).toFixed(0)}%`;

    if (stats.totalWeight >= stats.slowdownThreshold) {
      container.style.borderColor = "#ff7043";
    } else {
      container.style.borderColor = "rgba(255,255,255,0.2)";
    }

    slotList.innerHTML = "";
    const slots = this.inventory.getSlots();
    slots.forEach((slot, index) => {
      const row = document.createElement("li");
      row.style.padding = "6px";
      row.style.borderRadius = "6px";
      row.style.background = "rgba(255,255,255,0.06)";
      row.textContent = slot
        ? `Slot ${index + 1}: ${RESOURCE_DEFINITIONS[slot.resourceId]?.name || slot.resourceId} x${slot.quantity}`
        : `Slot ${index + 1}: -- empty --`;
      slotList.appendChild(row);
    });
  }

  updateInventoryMovementPenalty() {
    if (!this.inventory) return;
    const multiplier = this.inventory.getMovementSpeedMultiplier();
    if (this.playerController?.setMovementSpeedMultiplier) {
      this.playerController.setMovementSpeedMultiplier(multiplier);
    }
  }

  destroyInventoryUI() {
    if (this.inventoryUIElements?.container) {
      this.inventoryUIElements.container.remove();
    }
    this.inventoryUIElements = null;
  }

  getDefaultCrateDropTable() {
    return {
      wood: { min: 1, max: 3 },
      scrap: { min: 0, max: 2, chance: 0.5 },
      herb: { min: 0, max: 1, chance: 0.35 },
    };
  }

  onCrateDestroyed(info = {}) {
    const dropTable = info.crate?.getData("dropTable") || this.getDefaultCrateDropTable();
    const drops = this.rollResourceDrops(dropTable);
    const dropEntries = Object.entries(drops).filter(([, qty]) => qty > 0);
    dropEntries.forEach(([resourceId, quantity], idx) => {
      const offsetAngle = (idx / Math.max(dropEntries.length, 1)) * Math.PI * 2;
      const offsetRadius = 24;
      const spawnX = info.x + Math.cos(offsetAngle) * offsetRadius;
      const spawnY = info.y + Math.sin(offsetAngle) * offsetRadius;
      this.spawnResourcePickup(spawnX, spawnY, resourceId, quantity);
    });
  }

  rollResourceDrops(dropTable) {
    const result = {};
    const tableEntries = Object.entries(dropTable || {});
    if (tableEntries.length === 0) {
      result.wood = 1;
      return result;
    }

    tableEntries.forEach(([resourceId, config = {}]) => {
      const chance = config.chance ?? 1;
      if (Math.random() > chance) return;
      const min = Math.max(0, Math.floor(config.min ?? 1));
      const max = Math.max(min, Math.floor(config.max ?? min));
      const quantity =
        min === max ? min : Phaser.Math.Between(min, max);
      if (quantity > 0) {
        result[resourceId] = (result[resourceId] || 0) + quantity;
      }
    });
    return result;
  }

  spawnResourcePickup(x, y, resourceId, quantity = 1) {
    const resourceDef = RESOURCE_DEFINITIONS?.[resourceId];
    if (!resourceDef || quantity <= 0) return null;
    const circle = this.add.circle(x, y, 16, this.resourceColors[resourceId] || 0xffffff, 0.9);
    circle.setStrokeStyle(2, 0xffffff, 0.6);
    circle.setDepth(5);

    const label = this.add
      .text(x, y, `x${quantity}`, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(6);

    circle.setData("resourceId", resourceId);
    circle.setData("quantity", quantity);

    const pickup = {
      sprite: circle,
      label,
      resourceId,
      quantity,
      collectRadius: this.resourcePickupRadius,
    };
    this.resourcePickups.push(pickup);
    this.tweens.add({
      targets: circle,
      scale: { from: 0.6, to: 1 },
      alpha: { from: 0, to: 0.95 },
      duration: 200,
      ease: "Quad.easeOut",
    });
    return pickup;
  }

  updateResourcePickups() {
    if (!this.playerController?.sprite || this.resourcePickups.length === 0) return;
    const player = this.playerController.sprite;
    this.resourcePickups = this.resourcePickups.filter((pickup) => {
      if (!pickup?.sprite || !pickup.sprite.active) {
        this.destroyPickupVisual(pickup);
        return false;
      }
      if (pickup.label) {
        pickup.label.setPosition(pickup.sprite.x, pickup.sprite.y - 22);
      }
      const dx = pickup.sprite.x - player.x;
      const dy = pickup.sprite.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= pickup.collectRadius) {
        const fullyCollected = this.collectResourcePickup(pickup);
        if (fullyCollected) {
          this.destroyPickupVisual(pickup);
          return false;
        }
      }
      return true;
    });
  }

  destroyPickupVisual(pickup) {
    pickup?.sprite?.destroy();
    pickup?.label?.destroy();
  }

  collectResourcePickup(pickup) {
    if (!this.inventory) return false;
    const resourceDef = RESOURCE_DEFINITIONS?.[pickup.resourceId];
    const added = this.inventory.addResource(pickup.resourceId, pickup.quantity);
    if (added <= 0) {
      this.showPickupToast("Inventory Full", pickup.sprite.x, pickup.sprite.y, "#ff7043");
      return false;
    }
    pickup.quantity -= added;
    this.showPickupToast(`+${added} ${resourceDef?.name || pickup.resourceId}`, pickup.sprite.x, pickup.sprite.y);
    if (pickup.quantity > 0) {
      pickup.label?.setText(`x${pickup.quantity}`);
      return false;
    }
    return true;
  }

  showPickupToast(message, x, y, color = "#ffffff") {
    const toast = this.add
      .text(x, y - 24, message, {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.tweens.add({
      targets: toast,
      y: y - 60,
      alpha: 0,
      duration: 700,
      ease: "Quad.easeOut",
      onComplete: () => toast.destroy(),
    });
  }
}

window.addEventListener("load", () => {
  const config = {
    type: Phaser.AUTO,
    parent: "game-container",
    backgroundColor: "#222222",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 720, // 縦持ち前提の仮想解像度
      height: 1280,
    },
    physics: {
      default: "matter",
      matter: {
        gravity: { y: 0 }, // トップダウンなので重力はオフ
        debug: false,
      },
    },
    scene: [MainScene],
  };

  // eslint-disable-next-line no-unused-vars
  const game = new Phaser.Game(config);
});
