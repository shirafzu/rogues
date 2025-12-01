/**
 * SpawnManager
 * エンティティのスポーン処理を統括
 */
class SpawnManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.entityManager = options.entityManager;
    this.worldManager = options.worldManager;
    this.combatSystem = options.combatSystem;

    // コールバック
    this.onEnemyDeath = options.onEnemyDeath || null;
    this.onCrateDestroyed = options.onCrateDestroyed || null;

    // 設定
    this.enemySpeed = options.enemySpeed ?? 2;
    this.knockbackSpeed = options.knockbackSpeed ?? 8;
    this.knockbackDuration = options.knockbackDuration ?? 180;
    this.wallThickness = options.wallThickness ?? 40;
    this.worldWidth = options.worldWidth ?? 2200;
    this.worldHeight = options.worldHeight ?? 2800;

    // プレイヤー参照用（targetProviderで使用）
    this.playerController = null;

    // スポーン済みクレート
    this.crates = [];

    // ベースノード
    this.baseNodes = [];
  }

  /**
   * プレイヤーコントローラーを設定
   */
  setPlayerController(playerController) {
    this.playerController = playerController;
  }

  /**
   * ベースノードをスポーン
   */
  spawnBaseNode(x, y, options = {}) {
    const size = 80;
    const color = 0x2196f3;

    // ビジュアル
    const rect = this.scene.add.rectangle(x, y, size, size, color, 0.8);
    rect.setStrokeStyle(4, 0x64b5f6, 1);

    // 物理ボディ（静的）
    const categories = this.scene.collisionCategories || {};
    const baseNode = this.scene.matter.add.gameObject(rect, {
      isStatic: true,
      shape: { type: "rectangle", width: size, height: size },
      friction: 0.1, // 摩擦を低く
      slop: 0.03,
      collisionFilter: {
        category: categories.OBSTACLE || 0x0004,
        mask: (categories.PLAYER | categories.ENEMY | categories.DYNAMIC_OBJECT) || 0xFFFF
      }
    });

    baseNode.setData("kind", "baseNode");
    baseNode.setData("zoneId", options.zoneId);

    // ラベル
    const label = this.scene.add
      .text(x, y - 50, "BASE CAMP", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#e3f2fd",
        stroke: "#0d47a1",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(10);

    const node = {
      sprite: baseNode,
      label: label,
      interactRadius: 100,
    };

    if (options.zoneId && this.worldManager?.registerZoneObject) {
      this.worldManager.registerZoneObject(options.zoneId, baseNode);
      this.worldManager.registerZoneObject(options.zoneId, label);
    }

    this.baseNodes.push(node);
    return node;
  }

  /**
   * ベースノードを一括スポーン
   */
  spawnBaseNodes() {
    if (!this.worldManager) return;
    const spawns = this.worldManager.getBaseNodeSpawns();
    spawns.forEach((spawn) => {
      this.spawnBaseNode(spawn.x, spawn.y, { zoneId: spawn.zoneId });
    });
  }

  /**
   * ベースノードの更新（インタラクション判定）
   */
  updateBaseNodes() {
    if (!this.playerController?.sprite || this.baseNodes.length === 0) return;

    const player = this.playerController.sprite;
    this.baseNodes.forEach((node) => {
      if (!node.sprite.active) return;

      const dx = node.sprite.x - player.x;
      const dy = node.sprite.y - player.y;
      const distance = Math.hypot(dx, dy);

      if (distance <= node.interactRadius) {
        // 範囲内に入ったらインベントリUIを開く（まだ開いていなければ）
        // 簡易的にUIManagerのメソッドを直接呼ぶ形にする
        // 本来はイベント経由が良いが、プロトタイプなので直接参照またはシーン経由で
        if (this.scene.uiManager) {
          // UIManager側でトグル制御などが欲しいため、
          // ここでは「範囲内にいる間はインベントリボタンが強調される」などの表現が望ましいが
          // 今回はシンプルに「範囲内なら自動でインベントリが開く」または「ボタンが出る」
          // 実装プラン通り、インタラクト（接近）でUIを開く

          // 既に開いているかチェックする手段がないため、
          // 毎フレーム呼ぶのは避ける必要がある。
          // ここでは「範囲内」フラグを持たせて、入った瞬間に開くようにする
          if (!node.isPlayerInside) {
            node.isPlayerInside = true;
            this.scene.uiManager.inventoryUIElements?.container.style.setProperty("display", "block");
            // 閉じていた場合は開く処理（collapseButtonのテキスト更新など）が必要だが
            // UIManagerの実装依存。一旦display操作のみ。

            // 視覚フィードバック
            node.sprite.setStrokeStyle(4, 0xffff00, 1);
            node.label.setText("BASE CAMP (Active)");
            node.label.setColor("#fff176");
          }
        }
      } else {
        if (node.isPlayerInside) {
          node.isPlayerInside = false;
          // 出たら閉じる？ それとも手動？
          // 使い勝手を考えると出たら閉じるのが自然
          if (this.scene.uiManager) {
            this.scene.uiManager.inventoryUIElements?.container.style.setProperty("display", "none");
          }

          node.sprite.setStrokeStyle(4, 0x64b5f6, 1);
          node.label.setText("BASE CAMP");
          node.label.setColor("#e3f2fd");
        }
      }
    });
  }

  /**
   * 敵をスポーン
   */
  spawnEnemy(x, y, options = {}) {
    let enemyController = null;

    // Determine enemy definition
    const enemyId = options.enemyId || "default";
    const def = (window.ENEMY_DEFINITIONS && window.ENEMY_DEFINITIONS[enemyId]) ||
      (window.ENEMY_DEFINITIONS && window.ENEMY_DEFINITIONS.default) || {};

    // Merge options with definition
    const baseColor = options.baseColor ?? def.baseColor ?? 0xf44336;
    const maxHp = options.maxHp ?? def.stats?.maxHp;
    const moveSpeed = options.moveSpeed ?? def.stats?.moveSpeed ?? this.enemySpeed;

    // AI Config
    const aiConfig = {
      ...(def.aiConfig || {}),
      senses: def.senses || {},
      ...(options.aiConfig || {})
    };

    enemyController = CharacterFactory.createEnemy(this.scene, {
      spawn: { x, y },
      baseColor: baseColor,
      movementConfig: {
        moveSpeed: moveSpeed,
        targetProvider: () => this.playerController?.sprite,
        ...(options.movementConfig || {}),
      },
      maxHp: maxHp,
      callbacks: {
        onDeath: () => this.handleEnemyDeath(enemyController),
      },
      // Pass AI config to factory (Factory needs update or we set it manually)
    });

    // Manually set AI Controller to SensoryAIController if needed
    // Assuming CharacterFactory uses SimpleAIController by default.
    // We replace it here.
    if (enemyController.aiController) {
      // Clean up old one
      // enemyController.aiController.destroy(); // If it had destroy
    }

    if (window.SensoryAIController) {
      enemyController.aiController = new SensoryAIController(enemyController, aiConfig);
    }

    enemyController.sprite.setData("controller", enemyController);
    enemyController.zoneId = options.zoneId || null;
    enemyController.enemyId = enemyId; // Store ID

    if (enemyController.zoneId && this.worldManager?.registerZoneObject) {
      this.worldManager.registerZoneObject(
        enemyController.zoneId,
        enemyController.sprite
      );
    }

    this.entityManager.add(enemyController);
    return enemyController;
  }

  /**
   * 敵死亡時の処理
   */
  handleEnemyDeath(enemyController) {
    if (typeof this.onEnemyDeath === 'function') {
      this.onEnemyDeath(enemyController);
    }
  }

  /**
   * ゾーンの敵を一括スポーン
   */
  spawnZoneEnemies() {
    if (!this.worldManager) return;
    const enemyPlan = this.worldManager.getEnemySpawnPlan();
    enemyPlan.forEach((entry) => {
      for (let i = 0; i < entry.count; i += 1) {
        const point = this.worldManager.getRandomPointInZone(entry.zoneId);
        const jitterX = Phaser.Math.FloatBetween(-40, 40);
        const jitterY = Phaser.Math.FloatBetween(-40, 40);
        const config = { ...(entry.config || {}), zoneId: entry.zoneId };
        this.spawnEnemy(point.x + jitterX, point.y + jitterY, config);
      }
    });
  }

  /**
   * クレートをスポーン
   */
  spawnCrate(x, y, options = {}) {
    const size = 70;
    const color = 0x9e9e9e;

    const rect = this.scene.add.rectangle(x, y, size, size, color);
    const categories = this.scene.collisionCategories || {};
    const crate = this.scene.matter.add.gameObject(rect, {
      shape: { type: "rectangle" },
      friction: 0.3, // 摩擦を下げる（動的オブジェクトは適度に）
      frictionStatic: 0.8, // 静止摩擦は高めに
      restitution: 0.1,
      density: 0.01,
      slop: 0.03, // 貫通許容値を少し緩める
      collisionFilter: {
        category: categories.DYNAMIC_OBJECT || 0x0008,
        mask: (categories.PLAYER | categories.ENEMY | categories.OBSTACLE | categories.DYNAMIC_OBJECT | categories.WALL) || 0xFFFF
      }
    });

    crate.setFixedRotation();
    crate.setData("kind", "crate");
    crate.setData("hp", 3);
    crate.setData("baseColor", color);
    crate.setData(
      "dropTable",
      options.dropTable || this.getDefaultCrateDropTable()
    );
    if (options.zoneId) {
      crate.setData("zoneId", options.zoneId);
      this.worldManager?.registerZoneObject(options.zoneId, crate);
    }

    this.crates.push(crate);
    return crate;
  }

  /**
   * プランに基づいてクレートを配置
   */
  spawnCratesFromPlan() {
    if (!this.worldManager) return;
    const plan = this.worldManager.getCrateSpawns();
    plan.forEach((entry) => {
      const dropTable = this.worldManager.getCrateDropTable(
        entry.zoneId,
        this.getDefaultCrateDropTable()
      );
      this.spawnCrate(entry.x, entry.y, {
        dropTable,
        zoneId: entry.zoneId,
      });
    });
  }

  /**
   * クレートのドロップテーブル（デフォルト）
   */
  getDefaultCrateDropTable() {
    return {
      wood: { min: 1, max: 3 },
      scrap: { min: 0, max: 2, chance: 0.5 },
      herb: { min: 0, max: 1, chance: 0.35 },
    };
  }

  /**
   * クレートを更新（非アクティブなものを削除）
   */
  updateCrates() {
    this.crates = this.crates.filter((crate) => crate && crate.active);
  }

  /**
   * すべてのクレートを取得
   */
  getCrates() {
    return this.crates;
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.crates.forEach(crate => {
      if (crate && crate.destroy) {
        crate.destroy();
      }
    });
    this.crates = [];

    this.baseNodes.forEach(node => {
      node.sprite?.destroy();
      node.label?.destroy();
    });
    this.baseNodes = [];
  }
}

window.SpawnManager = SpawnManager;
