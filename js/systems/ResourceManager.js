/**
 * ResourceManager
 * リソースピックアップとノードの管理
 */
class ResourceManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.worldManager = options.worldManager;
    this.inventory = options.inventory || null;

    // リソースピックアップ
    this.resourcePickups = [];
    this.resourcePickupRadius = options.resourcePickupRadius ?? 70;
    this.resourceColors = options.resourceColors || {
      wood: 0x8d6e63,
      ore: 0xb0bec5,
      scrap: 0x90a4ae,
      herb: 0x66bb6a,
    };

    // リソースノード
    this.resourceNodes = [];
    this.resourceNodeConfigs = options.resourceNodeConfigs || {
      wood: {
        label: "倒木",
        description: "樹液の匂いが漂う。長押しで伐採できそうだ。",
        color: 0x6d4c41,
        accentColor: 0xffccbc,
        size: 64,
        gatherTime: 1400,
        interactRadius: 120,
        dropTable: {
          wood: { min: 2, max: 4 },
          herb: { min: 0, max: 1, chance: 0.4 },
        },
      },
      ore: {
        label: "鉱脈",
        description: "金属光沢が見える。採掘で鉱石が得られそう。",
        color: 0x90a4ae,
        accentColor: 0xcfd8dc,
        size: 70,
        gatherTime: 1800,
        interactRadius: 110,
        dropTable: {
          ore: { min: 2, max: 3 },
          scrap: { min: 0, max: 2, chance: 0.5 },
        },
      },
      scrap: {
        label: "残骸",
        description: "壊れた機械が散乱。金属資源を回収できる。",
        color: 0x78909c,
        accentColor: 0xfff176,
        size: 58,
        gatherTime: 1500,
        interactRadius: 110,
        dropTable: {
          scrap: { min: 2, max: 4 },
          wood: { min: 0, max: 1, chance: 0.35 },
        },
      },
      herb: {
        label: "薬草群生地",
        description: "芳香が漂う。丁寧に摘み取れば薬草が得られる。",
        color: 0x66bb6a,
        accentColor: 0xb9f6ca,
        size: 60,
        gatherTime: 1200,
        interactRadius: 105,
        dropTable: {
          herb: { min: 2, max: 3 },
        },
      },
    };

    // プレイヤー参照
    this.playerController = null;
  }

  /**
   * プレイヤーコントローラーを設定
   */
  setPlayerController(playerController) {
    this.playerController = playerController;
  }

  /**
   * インベントリを設定
   */
  setInventory(inventory) {
    this.inventory = inventory;
  }

  /**
   * リソースピックアップをスポーン
   */
  spawnResourcePickup(x, y, resourceId, quantity = 1, zoneId = null) {
    const resourceDef = RESOURCE_DEFINITIONS?.[resourceId];
    if (!resourceDef || quantity <= 0) return null;

    const circle = this.scene.add.circle(x, y, 16, this.resourceColors[resourceId] || 0xffffff, 0.9);
    circle.setStrokeStyle(2, 0xffffff, 0.6);
    circle.setDepth(5);

    const label = this.scene.add
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
      zoneId,
    };

    if (zoneId && this.worldManager?.registerZoneObject) {
      this.worldManager.registerZoneObject(zoneId, circle);
      this.worldManager.registerZoneObject(zoneId, label);
    }

    this.resourcePickups.push(pickup);
    this.scene.tweens.add({
      targets: circle,
      scale: { from: 0.6, to: 1 },
      alpha: { from: 0, to: 0.95 },
      duration: 200,
      ease: "Quad.easeOut",
    });

    return pickup;
  }

  /**
   * リソースピックアップを更新
   */
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

  /**
   * ピックアップを破棄
   */
  destroyPickupVisual(pickup) {
    pickup?.sprite?.destroy();
    pickup?.label?.destroy();
  }

  /**
   * リソースピックアップを収集
   */
  collectResourcePickup(pickup) {
    if (!this.inventory) return false;

    const resourceDef = RESOURCE_DEFINITIONS?.[pickup.resourceId];
    const added = this.inventory.addResource(pickup.resourceId, pickup.quantity);

    if (added <= 0) {
      this.showPickupToast("Inventory Full", pickup.sprite.x, pickup.sprite.y, "#ff7043");
      return false;
    }

    pickup.quantity -= added;
    this.showPickupToast(
      `+${added} ${resourceDef?.name || pickup.resourceId}`,
      pickup.sprite.x,
      pickup.sprite.y
    );

    if (pickup.quantity > 0) {
      pickup.label?.setText(`x${pickup.quantity}`);
      return false;
    }

    return true;
  }

  /**
   * ピックアップトーストを表示
   */
  showPickupToast(message, x, y, color = "#ffffff") {
    const toast = this.scene.add
      .text(x, y - 24, message, {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.scene.tweens.add({
      targets: toast,
      y: y - 60,
      alpha: 0,
      duration: 700,
      ease: "Quad.easeOut",
      onComplete: () => toast.destroy(),
    });
  }

  /**
   * リソースドロップをロール
   */
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
      const quantity = min === max ? min : Phaser.Math.Between(min, max);

      if (quantity > 0) {
        result[resourceId] = (result[resourceId] || 0) + quantity;
      }
    });

    return result;
  }

  /**
   * リソースノードをスポーン
   */
  spawnResourceNodes() {
    if (!this.worldManager) return;

    const plan = this.worldManager.getResourceNodePlan();
    plan.forEach((entry) => {
      for (let i = 0; i < entry.count; i += 1) {
        const point = this.worldManager.getRandomPointInZone(entry.zoneId);
        const dropTable = this.worldManager.getResourceDropTable(
          entry.zoneId,
          entry.type,
          this.getBaseResourceDropTable(entry.type)
        );
        this.createResourceNode(point.x, point.y, entry.type, entry.zoneId, dropTable);
      }
    });
  }

  /**
   * ベースドロップテーブルを取得
   */
  getBaseResourceDropTable(type) {
    const config = this.resourceNodeConfigs?.[type];
    if (!config?.dropTable) return {};

    const clone = {};
    Object.entries(config.dropTable).forEach(([resourceId, entry]) => {
      clone[resourceId] = { ...entry };
    });
    return clone;
  }

  /**
   * リソースノードを作成
   */
  createResourceNode(x, y, type, zoneId = null, dropTableOverride = null) {
    const config = this.resourceNodeConfigs[type];
    if (!config) return null;

    const aura = this.scene.add
      .circle(x, y, config.size * 0.85, config.accentColor, 0.12)
      .setDepth(1);

    const sprite = this.scene.add
      .rectangle(x, y, config.size, config.size * 0.7, config.color, 0.92)
      .setStrokeStyle(3, config.accentColor, 0.9)
      .setDepth(2);

    this.scene.tweens.add({
      targets: aura,
      scale: { from: 0.9, to: 1.3 },
      alpha: { from: 0.5, to: 0.15 },
      duration: 1800,
      repeat: -1,
      yoyo: true,
      ease: "Sine.easeInOut",
    });

    const label = this.scene.add
      .text(x, y - config.size * 0.55, config.label, {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#fff5e1",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(3);

    const progressLabel = this.scene.add
      .text(x, y + config.size * 0.55, config.description || "", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(3);

    const node = {
      sprite,
      aura,
      label,
      progressLabel,
      type,
      zoneId,
      description: config.description || "",
      gatherTime: config.gatherTime ?? 1500,
      progress: 0,
      interactRadius: config.interactRadius ?? 110,
      dropTable: dropTableOverride || config.dropTable || { [type]: { min: 1, max: 3 } },
    };

    if (zoneId && this.worldManager?.registerZoneObject) {
      this.worldManager.registerZoneObject(zoneId, sprite);
      this.worldManager.registerZoneObject(zoneId, aura);
      this.worldManager.registerZoneObject(zoneId, label);
      this.worldManager.registerZoneObject(zoneId, progressLabel);
    }

    this.resourceNodes.push(node);
    return node;
  }

  /**
   * リソースノードを更新
   */
  updateResourceNodes(delta = 0) {
    if (!this.playerController?.sprite || this.resourceNodes.length === 0) return;

    const player = this.playerController.sprite;
    this.resourceNodes = this.resourceNodes.filter((node) => {
      if (!node?.sprite || !node.sprite.active) {
        this.destroyResourceNode(node);
        return false;
      }

      const dx = node.sprite.x - player.x;
      const dy = node.sprite.y - player.y;
      const distance = Math.hypot(dx, dy);
      const nearby = distance <= node.interactRadius;

      if (node.aura) {
        node.aura.setScale(nearby ? 1.3 : 1);
      }
      if (node.label) {
        node.label.setColor(nearby ? "#ffff8d" : "#fff5e1");
      }

      if (nearby) {
        node.progress = Math.min(node.gatherTime, node.progress + delta);
        this.updateNodeProgressLabel(node, true);
        if (node.progress >= node.gatherTime) {
          this.onResourceNodeHarvested(node);
          return false;
        }
      } else if (node.progress > 0) {
        node.progress = Math.max(0, node.progress - delta * 0.5);
        this.updateNodeProgressLabel(node, false);
      } else if (node.progressLabel) {
        node.progressLabel.setText(node.description || "");
      }

      return true;
    });
  }

  /**
   * ノードの進捗ラベルを更新
   */
  updateNodeProgressLabel(node, isHarvesting) {
    if (!node?.progressLabel) return;

    const percent = Math.floor((node.progress / node.gatherTime) * 100);
    if (percent <= 0) {
      node.progressLabel.setText(isHarvesting ? "接近中..." : node.description || "");
      return;
    }
    node.progressLabel.setText(isHarvesting ? `採取 ${percent}%` : `進行 ${percent}%`);
  }

  /**
   * リソースノード採取完了時の処理
   */
  onResourceNodeHarvested(node) {
    const drops = this.rollResourceDrops(node?.dropTable || {});
    const entries = Object.entries(drops).filter(([, qty]) => qty > 0);

    if (entries.length === 0) {
      entries.push(["wood", 1]);
    }

    entries.forEach(([resourceId, quantity], idx) => {
      const offsetAngle = (idx / Math.max(entries.length, 1)) * Math.PI * 2;
      const offsetRadius = 20;
      const spawnX = node.sprite.x + Math.cos(offsetAngle) * offsetRadius;
      const spawnY = node.sprite.y + Math.sin(offsetAngle) * offsetRadius;
      this.spawnResourcePickup(spawnX, spawnY, resourceId, quantity, node.zoneId);
    });

    this.showPickupToast("採取成功！", node.sprite.x, node.sprite.y - 30, "#c5e1a5");
    this.emitExplorationPing(
      node.sprite.x,
      node.sprite.y,
      this.resourceNodeConfigs[node.type]?.accentColor || 0xffffff
    );
    this.destroyResourceNode(node);
  }

  /**
   * ノードを破棄
   */
  destroyResourceNode(node) {
    node?.sprite?.destroy();
    node?.aura?.destroy();
    node?.label?.destroy();
    node?.progressLabel?.destroy();
  }

  /**
   * 探索時のピング表示
   */
  emitExplorationPing(x, y, color = 0xffffff) {
    const ring = this.scene.add.circle(x, y, 20, color, 0.15).setDepth(0);
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 0.6, to: 3 },
      alpha: { from: 0.5, to: 0 },
      duration: 900,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.resourcePickups.forEach(pickup => this.destroyPickupVisual(pickup));
    this.resourcePickups = [];

    this.resourceNodes.forEach(node => this.destroyResourceNode(node));
    this.resourceNodes = [];
  }
}

window.ResourceManager = ResourceManager;
