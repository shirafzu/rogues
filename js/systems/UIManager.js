/**
 * UIManager
 * すべてのUI要素を管理
 */
class UIManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.inventory = options.inventory || null;

    // HUD要素
    this.hpText = null;

    // インベントリUI要素
    this.inventoryUIElements = null;
    this.inventoryChangeUnsub = null;

    // 入力ビジュアライゼーション
    this.inputVisuals = {
      joystick: null,
      joystickBase: null,
      joystickStick: null,
      flickArrow: null,
      tapIndicator: null,
      longDistanceTrail: null,
      longDistanceThreshold: null,
    };

    // コールバック
    this.onCharacterSelected = options.onCharacterSelected || null;
    this.onInventoryMovementPenaltyChange = options.onInventoryMovementPenaltyChange || null;

    // アクションボタン
    this.actionButtons = {
      item: null,
    };
  }

  /**
   * インベントリを設定
   */
  setInventory(inventory) {
    this.inventory = inventory;
  }

  /**
   * HUDを作成
   */
  createHUD() {
    this.hpText = this.scene.add
      .text(16, 16, "", {
        fontFamily: "sans-serif",
        fontSize: "24px",
        color: "#ffffff",
      })
      .setScrollFactor(0);

    // 座標とバイオーム表示
    this.coordsText = this.scene.add
      .text(16, 44, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#90ee90",
      })
      .setScrollFactor(0);

    this.updateHpUI();
  }

  /**
   * サバイバルHUDを作成（種族ごとに異なるステータスバー）
   */
  createSurvivalHUD(character) {
    if (!character || !character.survivalSystem) return;

    // 既存のサバイバルHUDをクリア
    if (this.survivalBars) {
      this.survivalBars.forEach(bar => {
        if (bar.container) bar.container.destroy();
      });
    }

    this.survivalBars = [];
    const stats = character.survivalSystem.getAllStats();
    const startX = 16;
    const startY = 60; // HP表示の下
    const barHeight = 20;
    const barSpacing = 30;

    stats.forEach((stat, index) => {
      const y = startY + index * barSpacing;

      // コンテナ
      const container = this.scene.add.container(startX, y).setScrollFactor(0).setDepth(1000);

      // ラベル
      const label = this.scene.add.text(0, 0, stat.def.name, {
        fontSize: "14px",
        color: "#ffffff",
      });

      // バー背景
      const barBg = this.scene.add.rectangle(100, 5, 100, barHeight, 0x333333).setOrigin(0, 0);

      // バー（現在値）
      const barFill = this.scene.add.rectangle(100, 5, 100, barHeight, stat.def.color).setOrigin(0, 0);

      container.add([label, barBg, barFill]);

      this.survivalBars.push({
        container,
        stat,
        barFill,
        maxWidth: 100,
      });
    });
  }

  /**
   * サバイバルHUDを更新
   */
  updateSurvivalHUD() {
    if (!this.survivalBars) return;

    this.survivalBars.forEach(bar => {
      const ratio = bar.stat.current / bar.stat.max;
      const newWidth = bar.maxWidth * ratio;
      bar.barFill.setDisplaySize(newWidth, bar.barFill.height);
    });
  }

  /**
   * HP UIを更新
   */
  updateHpUI(currentHp, maxHp) {
    if (!this.hpText) return;

    if (currentHp == null || maxHp == null) {
      this.hpText.setText("HP: --/--");
      return;
    }

    this.hpText.setText(`HP: ${currentHp}/${maxHp}`);
  }

  /**
   * 座標UIを更新
   */
  updateCoordsUI(x, y, biome) {
    if (!this.coordsText) return;

    const chunkX = Math.floor(x / 1000);
    const chunkY = Math.floor(y / 1000);

    this.coordsText.setText(
      `X: ${Math.round(x)}  Y: ${Math.round(y)}\n` +
      `Chunk: [${chunkX}, ${chunkY}]  Biome: ${biome || "unknown"}`
    );
  }

  /**
   * ゲームオーバー画面を表示
   */
  showGameOver(onRestart) {
    const cam = this.scene.cameras.main;
    this.scene.add
      .text(cam.worldView.centerX, cam.worldView.centerY, "GAME OVER\nTap to Restart", {
        fontFamily: "sans-serif",
        fontSize: "40px",
        color: "#ff5252",
        align: "center",
      })
      .setOrigin(0.5);

    this.scene.input.once("pointerdown", () => {
      if (typeof onRestart === 'function') {
        onRestart();
      }
    });
  }

  /**
   * キャラクター選択UIを表示
   */
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
      justifyContent: "flex-start",
      alignItems: "center",
      gap: "18px",
      zIndex: "9999",
      fontFamily: "sans-serif",
      padding: "24px",
      boxSizing: "border-box",
      overflowY: "auto",
      touchAction: "pan-y",
      WebkitOverflowScrolling: "touch",
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

    const raceSection = createOptionSection("Race", window.RACE_DEFINITIONS || { human: { name: "Human", description: "Default" } });

    const movementSection = createOptionSection("Movement", AVAILABLE_MOVEMENTS);
    const dodgeSection = createOptionSection("Dodge", AVAILABLE_DODGES);
    const attackSection = createOptionSection("Attack", AVAILABLE_ATTACKS);
    const longDistanceSection = createOptionSection("Long Distance Travel", AVAILABLE_LONG_DISTANCE_MODES);

    sectionsContainer.appendChild(raceSection.section);
    sectionsContainer.appendChild(movementSection.section);
    sectionsContainer.appendChild(dodgeSection.section);
    sectionsContainer.appendChild(attackSection.section);
    sectionsContainer.appendChild(longDistanceSection.section);
    overlay.appendChild(sectionsContainer);

    const startButton = document.createElement("button");
    startButton.textContent = "Start";
    Object.assign(startButton.style, {
      padding: "10px 18px",
      fontSize: "16px",
      cursor: "pointer",
    });

    startButton.addEventListener("click", () => {
      const selection = {
        race: raceSection.select.value,
        movementKey: movementSection.select.value,
        dodgeKey: dodgeSection.select.value,
        attackKey: attackSection.select.value,
        longDistanceKey: longDistanceSection.select.value,
      };

      if (typeof this.onCharacterSelected === 'function') {
        this.onCharacterSelected(selection);
      }

      overlay.remove();
    });

    overlay.appendChild(startButton);
    document.body.appendChild(overlay);
  }

  /**
   * インベントリシステムをセットアップ
   */
  setupInventorySystem() {
    if (!this.inventory || typeof this.inventory.addChangeListener !== 'function') {
      return;
    }

    this.inventoryChangeUnsub = this.inventory.addChangeListener(() => {
      this.updateInventoryUI();
      this.updateInventoryMovementPenalty();
      this.updateActionButtons(); // ボタン状態も更新
      // クラフトリストも更新（コスト充足状況が変わるため）
      if (this.inventoryUIElements && this.inventoryUIElements.quickCraftList) {
        this.buildQuickCraftList(this.inventoryUIElements.quickCraftList);
      }
    });

    this.createInventoryOverlay();
    this.updateInventoryUI();
  }

  /**
   * インベントリシステムをクリーンアップ
   */
  cleanupInventorySystem() {
    if (typeof this.inventoryChangeUnsub === "function") {
      this.inventoryChangeUnsub();
      this.inventoryChangeUnsub = null;
    }

    this.destroyInventoryUI();
  }

  /**
   * インベントリオーバーレイを作成
   */
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
    summaryMovement.style.fontSize = "12px";
    summaryMovement.style.marginBottom = "8px";
    summaryMovement.style.opacity = "0.8";

    bodyWrapper.appendChild(summaryWeight);
    bodyWrapper.appendChild(summaryMovement);

    // 武器リセットボタン（アイテム装備解除）
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Unequip Item";
    Object.assign(resetBtn.style, {
      width: "100%",
      padding: "6px",
      marginBottom: "12px",
      background: "rgba(244, 67, 54, 0.3)",
      border: "1px solid rgba(244, 67, 54, 0.5)",
      color: "#ef9a9a",
      borderRadius: "4px",
      cursor: "pointer",
    });
    resetBtn.addEventListener("click", () => {
      if (this.scene && this.scene.playerController) {
        this.scene.playerController.clearQuickSlotItem();
      }
    });
    bodyWrapper.appendChild(resetBtn);

    const slotList = document.createElement("div");
    Object.assign(slotList.style, {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "8px",
      marginBottom: "16px",
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

  /**
   * クイッククラフトリストを構築
   */
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

      // コストチェック
      let canCraft = true;
      if (this.inventory) {
        for (const [resourceId, amount] of Object.entries(recipe.costs || {})) {
          if (this.inventory.getResourceAmount(resourceId) < amount) {
            canCraft = false;
            break;
          }
        }
      } else {
        canCraft = false;
      }

      const button = document.createElement("button");
      button.textContent = canCraft ? "Craft" : "Insufficient Resources";
      button.disabled = !canCraft;
      Object.assign(button.style, {
        width: "100%",
        padding: "4px",
        borderRadius: "4px",
        border: "1px solid rgba(255,255,255,0.2)",
        background: canCraft ? "rgba(76, 175, 80, 0.3)" : "rgba(255,255,255,0.08)",
        color: canCraft ? "#a5d6a7" : "rgba(255,255,255,0.4)",
        cursor: canCraft ? "pointer" : "not-allowed",
      });

      if (canCraft) {
        button.addEventListener("click", () => {
          if (this.inventory && this.inventory.craftItem(recipe.id)) {
            // クラフト成功時のエフェクトや音（今回は簡易的にUI更新のみ）
            // インベントリ変更通知でUI全体が再描画されるはずだが、
            // ここでもボタン状態を即時反映したい場合は再構築を呼ぶ
            // this.buildQuickCraftList(container); // notifyChangeで呼ばれるので不要
          }
        });
      }

      row.appendChild(button);
      container.appendChild(row);
    });
  }

  /**
   * デバッグ用リソースボタンを追加
   */
  addDebugResourceButton(container, label, resourceId, amount) {
    const button = document.createElement("button");
    button.textContent = label;
    Object.assign(button.style, {
      borderRadius: "4px",
      border: "1px solid rgba(255,255,255,0.2)",
      background: "rgba(255,255,255,0.05)",
      color: "#fff",
      padding: "4px 8px",
      cursor: "pointer",
    });
    button.addEventListener("click", () => {
      this.inventory?.addResource(resourceId, amount);
    });
    container.appendChild(button);
  }

  /**
   * デバッグ用リソースボタンを構築
   */
  buildDebugResourceButtons(container) {
    if (!container || typeof container !== "object") return;
    this.addDebugResourceButton(container, "Add Stone", "stone", 5);
    this.addDebugResourceButton(container, "Add Fiber", "fiber", 5);

    // Enemy Spawn Buttons
    const spawnDogBtn = document.createElement("button");
    spawnDogBtn.textContent = "Spawn Dog";
    Object.assign(spawnDogBtn.style, {
      borderRadius: "4px",
      border: "1px solid rgba(255,100,100,0.4)",
      background: "rgba(100,0,0,0.3)",
      color: "#ffcccc",
      padding: "4px 8px",
      cursor: "pointer",
      marginTop: "8px",
      display: "block",
      width: "100%"
    });
    spawnDogBtn.addEventListener("click", () => {
      const player = this.scene.playerController?.sprite;
      if (player && this.scene.spawnManager) {
        // Spawn near player
        const x = player.x + (Math.random() - 0.5) * 300;
        const y = player.y + (Math.random() - 0.5) * 300;
        this.scene.spawnManager.spawnEnemy(x, y, { enemyId: "dog_beastkin" });
      }
    });
    container.appendChild(spawnDogBtn);

    const spawnRabbitBtn = document.createElement("button");
    spawnRabbitBtn.textContent = "Spawn Rabbit";
    Object.assign(spawnRabbitBtn.style, {
      borderRadius: "4px",
      border: "1px solid rgba(255,100,100,0.4)",
      background: "rgba(100,0,0,0.3)",
      color: "#ffcccc",
      padding: "4px 8px",
      cursor: "pointer",
      marginTop: "4px",
      display: "block",
      width: "100%"
    });
    spawnRabbitBtn.addEventListener("click", () => {
      const player = this.scene.playerController?.sprite;
      if (player && this.scene.spawnManager) {
        // Spawn near player
        const x = player.x + (Math.random() - 0.5) * 300;
        const y = player.y + (Math.random() - 0.5) * 300;
        this.scene.spawnManager.spawnEnemy(x, y, { enemyId: "rabbit_beastkin" });
      }
    });
    container.appendChild(spawnRabbitBtn);

    container.appendChild(document.createElement("hr")); // Separator

    const definitions = RESOURCE_DEFINITIONS || {};
    Object.values(definitions).forEach((resource) => {
      this.addDebugResourceButton(container, `+${resource.name}`, resource.id, 1);
    });
  }

  /**
   * インベントリUIを更新
   */
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
      row.style.display = "flex";
      row.style.flexDirection = "column";
      row.style.gap = "4px";

      if (slot) {
        const info = document.createElement("div");
        info.textContent = `Slot ${index + 1}: ${RESOURCE_DEFINITIONS[slot.resourceId]?.name || slot.resourceId} x${slot.quantity}`;
        row.appendChild(info);

        // 装備可能なアイテムかチェック
        const equippableItems = ["health_salve", "campfire_kit", "throwing_stone", "spike_trap"];
        if (equippableItems.includes(slot.resourceId)) {
          const equipBtn = document.createElement("button");
          equipBtn.textContent = "Equip";
          Object.assign(equipBtn.style, {
            padding: "2px 6px",
            fontSize: "12px",
            background: "rgba(33, 150, 243, 0.3)",
            border: "1px solid rgba(33, 150, 243, 0.5)",
            color: "#90caf9",
            borderRadius: "4px",
            cursor: "pointer",
            alignSelf: "flex-start",
          });
          equipBtn.addEventListener("click", () => {
            try {
              const controller = this.scene?.playerController;
              if (controller) {
                controller.setQuickSlotItem(slot.resourceId);
                // 簡易フィードバック
                equipBtn.textContent = "Set to Slot";
                equipBtn.style.background = "rgba(76, 175, 80, 0.3)";
                equipBtn.style.borderColor = "rgba(76, 175, 80, 0.5)";
                equipBtn.style.color = "#a5d6a7";
                setTimeout(() => {
                  if (equipBtn) {
                    equipBtn.textContent = "Equip";
                    equipBtn.style.background = "rgba(33, 150, 243, 0.3)";
                    equipBtn.style.borderColor = "rgba(33, 150, 243, 0.5)";
                    equipBtn.style.color = "#90caf9";
                  }
                }, 1000);
              } else {
                console.error("Player controller not found");
                equipBtn.textContent = "Error: No Player";
                equipBtn.style.background = "rgba(244, 67, 54, 0.3)";
              }
            } catch (e) {
              console.error(e);
              equipBtn.textContent = `Err: ${e.name}`;
              equipBtn.style.background = "rgba(244, 67, 54, 0.3)";
              equipBtn.title = e.message; // ホバーで詳細表示
            }
          });
          row.appendChild(equipBtn);
        }
      } else {
        row.textContent = `Slot ${index + 1}: -- empty --`;
      }
      slotList.appendChild(row);
    });
  }

  /**
   * インベントリの移動速度ペナルティを更新
   */
  updateInventoryMovementPenalty() {
    if (!this.inventory) return;

    const multiplier = this.inventory.getMovementSpeedMultiplier();
    if (typeof this.onInventoryMovementPenaltyChange === 'function') {
      this.onInventoryMovementPenaltyChange(multiplier);
    }
  }

  /**
   * インベントリUIを破棄
   */
  destroyInventoryUI() {
    if (this.inventoryUIElements?.container) {
      this.inventoryUIElements.container.remove();
    }
    this.inventoryUIElements = null;
  }

  /**
   * アクションボタンを作成
   */
  createActionButtons() {
    // アイテムボタン（右下）
    const btnSize = 70; // 少し大きく
    const margin = 40;  // マージンを広げる
    const x = this.scene.scale.width - margin - btnSize / 2;
    const y = this.scene.scale.height - margin - btnSize / 2;

    const container = this.scene.add.container(x, y).setScrollFactor(0).setDepth(2000); // Depthを上げる

    const bg = this.scene.add.circle(0, 0, btnSize / 2, 0x000000, 0.5);
    bg.setStrokeStyle(2, 0xffffff, 0.8);

    const icon = this.scene.add.text(0, 0, "?", {
      fontFamily: "sans-serif",
      fontSize: "24px",
      color: "#ffffff",
    }).setOrigin(0.5);

    const countBadge = this.scene.add.circle(btnSize / 2 * 0.7, -btnSize / 2 * 0.7, 12, 0xff5252, 1);
    const countText = this.scene.add.text(btnSize / 2 * 0.7, -btnSize / 2 * 0.7, "0", {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#ffffff",
    }).setOrigin(0.5);

    container.add([bg, icon, countBadge, countText]);
    container.setVisible(false); // 初期状態は非表示

    // インタラクション
    // コンテナ自体をインタラクティブにする
    container.setInteractive(new Phaser.Geom.Circle(0, 0, btnSize / 2), Phaser.Geom.Circle.Contains);

    container.on("pointerdown", (pointer) => {
      console.log("HUD Button Pressed");
      if (this.scene.playerController) {
        // プレイヤーの位置をターゲットとして渡す（ボタン押下時はターゲット指定なし＝自キャラ位置/足元）
        // const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const result = this.scene.playerController.triggerAbility("item"); // 引数なしで呼び出す
        console.log("Ability Triggered:", result);

        // ボタンアニメーション
        this.scene.tweens.add({
          targets: container,
          scale: 0.9,
          duration: 50,
          yoyo: true,
        });

        // タップフィードバック（色変更）
        bg.setFillStyle(0x333333);
        setTimeout(() => bg.setFillStyle(0x000000), 100);
      }
    });

    this.actionButtons.item = {
      container,
      bg,
      icon,
      countBadge,
      countText,
      itemId: null,
    };

    // リサイズ対応
    this.scene.scale.on('resize', (gameSize) => {
      if (this.actionButtons.item && this.actionButtons.item.container) {
        const newX = gameSize.width - margin - btnSize / 2;
        const newY = gameSize.height - margin - btnSize / 2;
        this.actionButtons.item.container.setPosition(newX, newY);
      }
    });
  }

  /**
   * アクションボタンの状態を更新
   */
  updateActionButtons() {
    if (!this.actionButtons.item || !this.inventory) return;

    const itemBtn = this.actionButtons.item;
    if (!itemBtn.itemId) {
      itemBtn.container.setVisible(false);
      return;
    }

    const amount = this.inventory.getResourceAmount(itemBtn.itemId);

    // 常に表示（アイテムがセットされていれば）
    itemBtn.container.setVisible(true);

    if (amount <= 0) {
      // 持っていない場合は半透明
      itemBtn.container.setAlpha(0.5);
      itemBtn.countText.setText("0");
      itemBtn.bg.setStrokeStyle(2, 0xff5252, 0.8); // 赤枠で警告
    } else {
      itemBtn.container.setAlpha(1);
      itemBtn.countText.setText(amount.toString());
      itemBtn.bg.setStrokeStyle(2, 0xffffff, 0.8);
    }

    // アイコン更新（簡易的に頭文字）
    const def = RESOURCE_DEFINITIONS[itemBtn.itemId];
    if (def) {
      itemBtn.icon.setText(def.name.substring(0, 2).toUpperCase());
    }
  }

  /**
   * クイックスロットのアイテムを設定
   */
  setQuickSlotItem(itemId) {
    if (!this.actionButtons.item) return;
    this.actionButtons.item.itemId = itemId;
    this.updateActionButtons();
  }

  /**
   * ポインターがUI上にあるかチェック
   */
  isPointerOnUI(pointer) {
    // アクションボタン（HUDアイテムボタン）のチェック
    if (this.actionButtons.item && this.actionButtons.item.container && this.actionButtons.item.container.visible) {
      const btn = this.actionButtons.item;
      const container = btn.container;
      const bg = btn.bg;

      // コンテナの位置（ScrollFactor(0)なので画面座標と一致）
      const btnX = container.x;
      const btnY = container.y;

      // 半径（bgのradius）
      const radius = bg.radius || (bg.width / 2);

      // 距離チェック
      const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, btnX, btnY);
      if (dist <= radius) {
        return true;
      }
    }

    // インベントリが開いている場合
    if (this.inventoryUIElements && this.inventoryUIElements.container) {
      // インベントリはHTML要素なので、Phaserのポインターイベントとは独立しているが、
      // もしPhaserのポインターがHTML要素上にある場合も除外したいならここに追加
      // ただし、通常はHTMLがイベントを吸うのでPhaserには来ないことが多い
    }

    return false;
  }

  /**
   * 入力ビジュアライゼーションを作成
   */
  createInputVisualization() {
    // ジョイスティックベース（外側の円）
    this.inputVisuals.joystickBase = this.scene.add.graphics();
    this.inputVisuals.joystickBase.setDepth(1001);
    this.inputVisuals.joystickBase.setScrollFactor(0);
    this.inputVisuals.joystickBase.setVisible(false);

    // ジョイスティックスティック（内側の円）
    this.inputVisuals.joystickStick = this.scene.add.graphics();
    this.inputVisuals.joystickStick.setDepth(1002);
    this.inputVisuals.joystickStick.setScrollFactor(0);
    this.inputVisuals.joystickStick.setVisible(false);

    // フリック方向矢印
    this.inputVisuals.flickArrow = this.scene.add.graphics();
    this.inputVisuals.flickArrow.setDepth(1001);
    this.inputVisuals.flickArrow.setVisible(false);

    // タップインジケーター
    this.inputVisuals.tapIndicator = this.scene.add.graphics();
    this.inputVisuals.tapIndicator.setDepth(1001);
    this.inputVisuals.tapIndicator.setVisible(false);

    // 長距離移動軌跡
    this.inputVisuals.longDistanceTrail = this.scene.add.graphics();
    this.inputVisuals.longDistanceTrail.setDepth(1001);
    this.inputVisuals.longDistanceTrail.setVisible(false);

    // 長距離移動判定閾値の円
    this.inputVisuals.longDistanceThreshold = this.scene.add.graphics();
    this.inputVisuals.longDistanceThreshold.setDepth(1000);
    this.inputVisuals.longDistanceThreshold.setScrollFactor(0);
    this.inputVisuals.longDistanceThreshold.setVisible(false);
  }

  /**
   * 仮想ジョイスティックを表示
   */
  showVirtualJoystick(screenX, screenY, dragX, dragY) {
    if (!this.inputVisuals.joystickBase || !this.inputVisuals.joystickStick) return;

    const baseRadius = 60;
    const stickRadius = 25;
    const maxDistance = 50;

    // ベースを描画
    this.inputVisuals.joystickBase.clear();
    this.inputVisuals.joystickBase.fillStyle(0xffffff, 0.2);
    this.inputVisuals.joystickBase.fillCircle(screenX, screenY, baseRadius);
    this.inputVisuals.joystickBase.lineStyle(2, 0xffffff, 0.4);
    this.inputVisuals.joystickBase.strokeCircle(screenX, screenY, baseRadius);
    this.inputVisuals.joystickBase.setVisible(true);

    // スティックの位置を計算
    const dx = dragX - screenX;
    const dy = dragY - screenY;
    const distance = Math.hypot(dx, dy);
    const clampedDistance = Math.min(distance, maxDistance);
    const ratio = distance > 0 ? clampedDistance / distance : 0;
    const stickX = screenX + dx * ratio;
    const stickY = screenY + dy * ratio;

    // スティックを描画
    this.inputVisuals.joystickStick.clear();
    this.inputVisuals.joystickStick.fillStyle(0x4caf50, 0.8);
    this.inputVisuals.joystickStick.fillCircle(stickX, stickY, stickRadius);
    this.inputVisuals.joystickStick.lineStyle(2, 0xffffff, 0.6);
    this.inputVisuals.joystickStick.strokeCircle(stickX, stickY, stickRadius);
    this.inputVisuals.joystickStick.setVisible(true);
  }

  /**
   * 仮想ジョイスティックを非表示
   */
  hideVirtualJoystick() {
    if (this.inputVisuals.joystickBase) {
      this.inputVisuals.joystickBase.clear();
      this.inputVisuals.joystickBase.setVisible(false);
    }
    if (this.inputVisuals.joystickStick) {
      this.inputVisuals.joystickStick.clear();
      this.inputVisuals.joystickStick.setVisible(false);
    }
  }

  /**
   * フリック方向インジケーターを表示
   */
  showFlickIndicator(worldX, worldY, directionX, directionY) {
    if (!this.inputVisuals.flickArrow) return;

    const length = 80;
    const arrowSize = 15;

    // カメラ座標に変換
    const cam = this.scene.cameras.main;
    const screenX = (worldX - cam.scrollX) * cam.zoom;
    const screenY = (worldY - cam.scrollY) * cam.zoom;

    this.inputVisuals.flickArrow.clear();
    this.inputVisuals.flickArrow.lineStyle(4, 0xff9800, 0.8);

    // 矢印の本体
    const endX = screenX + directionX * length;
    const endY = screenY + directionY * length;
    this.inputVisuals.flickArrow.lineBetween(screenX, screenY, endX, endY);

    // 矢印の先端
    const angle = Math.atan2(directionY, directionX);
    const arrowAngle1 = angle + Math.PI * 0.75;
    const arrowAngle2 = angle - Math.PI * 0.75;
    const arrow1X = endX + Math.cos(arrowAngle1) * arrowSize;
    const arrow1Y = endY + Math.sin(arrowAngle1) * arrowSize;
    const arrow2X = endX + Math.cos(arrowAngle2) * arrowSize;
    const arrow2Y = endY + Math.sin(arrowAngle2) * arrowSize;

    this.inputVisuals.flickArrow.lineBetween(endX, endY, arrow1X, arrow1Y);
    this.inputVisuals.flickArrow.lineBetween(endX, endY, arrow2X, arrow2Y);
    this.inputVisuals.flickArrow.setVisible(true);

    // 一定時間後に非表示
    this.scene.time.delayedCall(300, () => {
      if (this.inputVisuals.flickArrow) {
        this.inputVisuals.flickArrow.clear();
        this.inputVisuals.flickArrow.setVisible(false);
      }
    });
  }

  /**
   * タップインジケーターを表示
   */
  showTapIndicator(worldX, worldY) {
    if (!this.inputVisuals.tapIndicator) return;

    // カメラ座標に変換
    const cam = this.scene.cameras.main;
    const screenX = (worldX - cam.scrollX) * cam.zoom;
    const screenY = (worldY - cam.scrollY) * cam.zoom;

    this.inputVisuals.tapIndicator.clear();
    this.inputVisuals.tapIndicator.fillStyle(0xffffff, 0.5);
    this.inputVisuals.tapIndicator.fillCircle(screenX, screenY, 30);
    this.inputVisuals.tapIndicator.lineStyle(3, 0xffffff, 0.8);
    this.inputVisuals.tapIndicator.strokeCircle(screenX, screenY, 30);
    this.inputVisuals.tapIndicator.setVisible(true);

    // リングアニメーション用のトゥイーン（手動で実装）
    let alpha = 0.8;
    let scale = 1.0;
    const timer = this.scene.time.addEvent({
      delay: 16,
      repeat: 20,
      callback: () => {
        alpha -= 0.04;
        scale += 0.05;
        if (this.inputVisuals.tapIndicator) {
          this.inputVisuals.tapIndicator.clear();
          this.inputVisuals.tapIndicator.lineStyle(3, 0xffffff, alpha);
          this.inputVisuals.tapIndicator.strokeCircle(screenX, screenY, 30 * scale);
        }
      },
    });

    // 一定時間後に非表示
    this.scene.time.delayedCall(350, () => {
      timer.remove();
      if (this.inputVisuals.tapIndicator) {
        this.inputVisuals.tapIndicator.clear();
        this.inputVisuals.tapIndicator.setVisible(false);
      }
    });
  }

  /**
   * 長距離移動インジケーターを表示
   */
  showLongDistanceIndicator(worldStartX, worldStartY, worldEndX, worldEndY) {
    if (!this.inputVisuals.longDistanceTrail) return;

    // カメラ座標に変換
    const cam = this.scene.cameras.main;
    const startScreenX = (worldStartX - cam.scrollX) * cam.zoom;
    const startScreenY = (worldStartY - cam.scrollY) * cam.zoom;
    const endScreenX = (worldEndX - cam.scrollX) * cam.zoom;
    const endScreenY = (worldEndY - cam.scrollY) * cam.zoom;

    this.inputVisuals.longDistanceTrail.clear();
    this.inputVisuals.longDistanceTrail.lineStyle(5, 0x2196f3, 0.6);
    this.inputVisuals.longDistanceTrail.lineBetween(startScreenX, startScreenY, endScreenX, endScreenY);

    // 破線風に描画
    const dx = endScreenX - startScreenX;
    const dy = endScreenY - startScreenY;
    const distance = Math.hypot(dx, dy);
    const segments = Math.floor(distance / 20);

    this.inputVisuals.longDistanceTrail.clear();
    for (let i = 0; i < segments; i++) {
      if (i % 2 === 0) {
        const t1 = i / segments;
        const t2 = Math.min((i + 1) / segments, 1);
        const x1 = startScreenX + dx * t1;
        const y1 = startScreenY + dy * t1;
        const x2 = startScreenX + dx * t2;
        const y2 = startScreenY + dy * t2;
        this.inputVisuals.longDistanceTrail.lineStyle(5, 0x2196f3, 0.6);
        this.inputVisuals.longDistanceTrail.lineBetween(x1, y1, x2, y2);
      }
    }

    this.inputVisuals.longDistanceTrail.setVisible(true);

    // 一定時間後に非表示
    this.scene.time.delayedCall(500, () => {
      if (this.inputVisuals.longDistanceTrail) {
        this.inputVisuals.longDistanceTrail.clear();
        this.inputVisuals.longDistanceTrail.setVisible(false);
      }
    });
  }

  /**
   * 入力ビジュアライゼーションを更新
   */
  updateInputVisualization(inputState, playerWorldX, playerWorldY, longDistanceTriggerDistance = 250) {
    if (!inputState) return;

    // ジョイスティック表示の更新
    if (inputState.activePointerId !== null && inputState.touchStartPos && inputState.touchCurrentPos) {
      const dx = inputState.touchCurrentPos.x - inputState.touchStartPos.x;
      const dy = inputState.touchCurrentPos.y - inputState.touchStartPos.y;
      const distance = Math.hypot(dx, dy);

      // 一定距離以上ドラッグしている場合にジョイスティック表示
      if (distance > 20) {
        this.showVirtualJoystick(
          inputState.touchStartPos.x,
          inputState.touchStartPos.y,
          inputState.touchCurrentPos.x,
          inputState.touchCurrentPos.y
        );

        // 長距離移動判定の円を表示（現在位置も渡す）
        this.showLongDistanceThreshold(
          inputState.touchStartPos.x,
          inputState.touchStartPos.y,
          inputState.touchCurrentPos.x,
          inputState.touchCurrentPos.y,
          longDistanceTriggerDistance,
          distance
        );
      } else {
        this.hideVirtualJoystick();
        this.hideLongDistanceThreshold();
      }
    } else {
      this.hideVirtualJoystick();
      this.hideLongDistanceThreshold();
    }
  }

  /**
   * 長距離移動判定の円を表示
   */
  showLongDistanceThreshold(startScreenX, startScreenY, currentScreenX, currentScreenY, threshold, currentDistance) {
    if (!this.inputVisuals.longDistanceThreshold) return;

    this.inputVisuals.longDistanceThreshold.clear();

    // 閾値の円を描画（現在の距離が閾値を超えているかで色を変える）
    const color = currentDistance >= threshold ? 0x2196f3 : 0xffffff;
    const alpha = currentDistance >= threshold ? 0.5 : 0.3;

    // 破線風に円を描画
    const segments = 24;
    for (let i = 0; i < segments; i++) {
      if (i % 2 === 0) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;
        const x1 = startScreenX + Math.cos(angle1) * threshold;
        const y1 = startScreenY + Math.sin(angle1) * threshold;
        const x2 = startScreenX + Math.cos(angle2) * threshold;
        const y2 = startScreenY + Math.sin(angle2) * threshold;

        this.inputVisuals.longDistanceThreshold.lineStyle(3, color, alpha);
        this.inputVisuals.longDistanceThreshold.lineBetween(x1, y1, x2, y2);
      }
    }

    // 始点から現在位置への距離を示す線を描画
    if (currentDistance > 20) {
      const dx = currentScreenX - startScreenX;
      const dy = currentScreenY - startScreenY;
      const angle = Math.atan2(dy, dx);

      // 線の長さは現在の距離と閾値の小さい方
      const lineLength = Math.min(currentDistance, threshold * 0.95);
      const lineEndX = startScreenX + Math.cos(angle) * lineLength;
      const lineEndY = startScreenY + Math.sin(angle) * lineLength;

      // 距離インジケーター線を描画
      this.inputVisuals.longDistanceThreshold.lineStyle(2, color, alpha * 1.2);
      this.inputVisuals.longDistanceThreshold.lineBetween(startScreenX, startScreenY, lineEndX, lineEndY);

      // 線の先端に小さな円を描画
      this.inputVisuals.longDistanceThreshold.fillStyle(color, alpha * 1.5);
      this.inputVisuals.longDistanceThreshold.fillCircle(lineEndX, lineEndY, 5);
    }

    this.inputVisuals.longDistanceThreshold.setVisible(true);
  }

  /**
   * 長距離移動判定の円を非表示
   */
  hideLongDistanceThreshold() {
    if (this.inputVisuals.longDistanceThreshold) {
      this.inputVisuals.longDistanceThreshold.clear();
      this.inputVisuals.longDistanceThreshold.setVisible(false);
    }
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.cleanupInventorySystem();
    if (this.hpText) {
      this.hpText.destroy();
      this.hpText = null;
    }

    // 入力ビジュアライゼーションのクリーンアップ
    Object.values(this.inputVisuals).forEach(visual => {
      if (visual?.destroy) {
        visual.destroy();
      }
    });
    this.inputVisuals = {};
  }
}

window.UIManager = UIManager;
