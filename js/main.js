// ROGUES Prototype - Refactored Main Scene

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: "MainScene" });

    // 基本設定
    this.viewportWidth = 720;
    this.viewportHeight = 1280;
    this.worldWidth = 4400;
    this.worldHeight = 5600;
    this.wallThickness = 40;
    this.playerRadius = 30;

    // コアシステム
    this.entityManager = new EntityManager();
    this.playerController = null;
    this.isGameOver = false;

    // マネージャー（createで初期化）
    this.worldManager = null;
    this.spawnManager = null;
    this.resourceManager = null;
    this.cameraManager = null;
    this.effectManager = null;
    this.uiManager = null;
    this.inventory = null;
    this.fireSystem = null;
    this.combatSystem = null;
    this.interiorFog = null;
    this.environmentSystem = null;
  }

  preload() {
    // 外部アセットを使わず、簡易図形でプレイヤー等を表現する
  }

  create() {
    const viewWidth = this.viewportWidth;
    const viewHeight = this.viewportHeight;

    // 無限マップのため、固定のワールド境界は設定しない
    // ただし、物理エンジンのパフォーマンスのために、ある程度の広さを確保するか、
    // updateで動的にsetBoundsするかだが、PhaserのMatterはsetBoundsしなくても動く。
    // 落下防止の壁はないので、そのまま無限に移動可能。

    // SEED値の取得と乱数生成器の初期化
    const params = new URLSearchParams(window.location.search);
    const seed = params.get("seed") || Phaser.Math.RND.uuid();
    const mapGenerationMode = params.get("mapgen") || "biome";
    const hotspotSeed = params.get("hotspotSeed") || null;
    console.log("Map Seed:", seed, "MapGen:", mapGenerationMode, "HotspotSeed:", hotspotSeed || "weekly");
    this.rnd = new Phaser.Math.RandomDataGenerator([seed]);

    // WorldManagerを初期化
    this.worldManager = new WorldManager(this, this.rnd, {
      mapGenerationMode,
      hotspotSeed,
    });

    // プロシージャルスプライト生成（外部アセットなしで木/岩/茂みを用意）
    SpriteFactory.register(this, this.rnd);
    // buildStaticLayoutは廃止

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

    // CombatSystemを初期化
    this.combatSystem = new CombatSystem(this, {
      getEnemies: () => this.entityManager.getEnemies(),
      getCrates: () => this.spawnManager?.getCrates() || [],
      knockbackSpeed: 8,
      knockbackDuration: 180,
      onCrateRemoved: (crate) => {
        if (this.spawnManager) {
          this.spawnManager.crates = this.spawnManager.crates.filter((c) => c !== crate);
        }
      },
      onCrateDestroyed: (info) => this.onCrateDestroyed(info),
      igniteHandler: (entity) => this.fireSystem?.ignite(entity),
    });

    // SpawnManagerを初期化
    this.spawnManager = new SpawnManager(this, {
      rnd: this.rnd,
      entityManager: this.entityManager,
      worldManager: this.worldManager,
      combatSystem: this.combatSystem,
      onEnemyDeath: (enemyController) => {
        this.entityManager.remove(enemyController);
      },
      enemySpeed: 2,
      knockbackSpeed: 8,
      knockbackDuration: 180,
      wallThickness: this.wallThickness,
      worldWidth: 100000, // 仮想的に大きくしておく
      worldHeight: 100000,
    });

    // インベントリシステムを初期化
    this.inventory = new InventorySystem({
      slotCount: 8,
      slowdownThreshold: 20,
      weightCapacity: 40,
      minSpeedMultiplier: 0.5,
    });

    // ResourceManagerを初期化
    this.resourceManager = new ResourceManager(this, {
      rnd: this.rnd,
      worldManager: this.worldManager,
      inventory: this.inventory,
      resourcePickupRadius: 70,
      resourceColors: {
        wood: 0x8d6e63,
        ore: 0xb0bec5,
        scrap: 0x90a4ae,
        herb: 0x66bb6a,
      },
    });

    // インテリア霧エフェクトを作成
    this.interiorFog = this.add
      .rectangle(0, 0, viewWidth, viewHeight, 0x050507, 0.9)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false);

    // CameraManagerを初期化
    this.cameraManager = new CameraManager(this, {
      worldManager: this.worldManager,
      viewportWidth: viewWidth,
      viewportHeight: viewHeight,
      worldWidth: 100000, // 無限マップ対応
      worldHeight: 100000,
      playerRadius: this.playerRadius,
      wallThickness: this.wallThickness,
      interiorFog: this.interiorFog,
    });
    this.cameraManager.initialize();

    // EffectManagerを初期化
    this.effectManager = new EffectManager(this);

    // 環境システム（川の流れ・移動補正）
    this.environmentSystem = new EnvironmentSystem(this, {
      worldManager: this.worldManager,
      entityManager: this.entityManager,
    });

    // ScentManagerを初期化
    this.scentManager = new ScentManager(this);

    // NavigationManagerを初期化（敵のパスファインディング用）
    this.navigationManager = new NavigationManager(this, {
      cellSize: 40,
      padding: 15,
      cacheTimeout: 2000, // パス再計算間隔（ms）- 長くするとパフォーマンス向上
      debug: false // trueにするとパスが可視化される（パフォーマンス影響あり）
    });

    // MinimapManagerを初期化
    this.minimapManager = new MinimapManager(this, {
      biomeGenerator: this.worldManager.chunkManager.biomeGenerator,
      hotspotGenerator: this.worldManager.chunkManager.hotspotGenerator,
      worldManager: this.worldManager,
      width: 200,
      height: 200
    });
    this.minimapManager.create();

    // デバッグ用UI（全体マップ）
    this.terrainDebugUI = new TerrainDebugUI(this, this.worldManager.chunkManager.biomeGenerator);

    // CameraManagerを初期化
    this.cameraManager = new CameraManager(this, {
      worldManager: this.worldManager,
      viewportWidth: viewWidth,
      viewportHeight: viewHeight,
      worldWidth: 100000, // 無限マップ対応
      worldHeight: 100000,
      playerRadius: this.playerRadius,
      wallThickness: this.wallThickness,
      interiorFog: this.interiorFog,
    });
    this.cameraManager.initialize();

    // UIManagerを初期化
    this.uiManager = new UIManager(this, {
      inventory: this.inventory,
      onCharacterSelected: (selection) => this.initPlayerWithOptions(selection),
      onInventoryMovementPenaltyChange: (multiplier) => {
        if (this.playerController?.setMovementSpeedMultiplier) {
          this.playerController.setMovementSpeedMultiplier(multiplier);
        }
      },
    });

    // UIを作成
    this.uiManager.createHUD();
    this.uiManager.setupInventorySystem();
    this.uiManager.createInputVisualization();
    this.uiManager.createActionButtons();

    // エンティティをスポーン
    // 固定配置のみ行う（ベースキャンプなど）
    this.spawnManager.spawnBaseNodes();

    // 以下の固定スポーンは廃止（ChunkManagerが動的に行う）
    // this.spawnManager.spawnCratesFromPlan();
    // this.spawnManager.spawnZoneEnemies();
    // this.resourceManager.spawnResourceNodes();

    // 物理衝突イベント
    this.matter.world.on("collisionstart", this.handleCollisionStart, this);

    // シャットダウン時のクリーンアップ
    this.events.once("shutdown", () => {
      this.cleanupScene();
    });

    // キャラクター選択UIを表示
    this.uiManager.showCharacterSelection();
  }




  update(time, delta) {
    // エンティティクリーンアップ（フレームの最初）
    this.entityManager.cleanup();

    // ゲームオーバー時は全エンティティを停止
    if (this.isGameOver) {
      if (this.playerController?.sprite?.active && this.playerController.sprite.body) {
        this.playerController.sprite.setVelocity(0, 0);
      }
      const enemies = this.entityManager.getEnemies();
      enemies.forEach((enemy) => {
        if (enemy?.sprite?.active && enemy.sprite.body) {
          enemy.sprite.setVelocity(0, 0);
        }
      });
      return;
    }

    // エンティティの更新
    this.entityManager.updateAll(delta);

    // 環境（川の流れ・移動補正）
    this.environmentSystem?.update(delta);

    // サバイバルHUDの更新
    if (this.uiManager) {
      this.uiManager.updateSurvivalHUD();

      // 座標UIの更新
      if (this.playerController?.sprite) {
        const x = this.playerController.sprite.x;
        const y = this.playerController.sprite.y;
        const currentZone = this.worldManager?.getZoneForPoint(x, y);
        const biome = currentZone?.biome || "unknown";
        this.uiManager.updateCoordsUI(x, y, biome);
      }
    }

    // クレートの更新
    this.spawnManager?.updateCrates();
    this.spawnManager?.updateBaseNodes();

    // FireSystemの更新
    if (this.fireSystem) {
      this.fireSystem.update({
        enemies: this.entityManager.getEnemies().map(e => e.sprite).filter(s => s && s.active),
        crates: this.spawnManager?.getCrates() || [],
        damageEnemy: (enemy, amt) => this.combatSystem.damageEnemySprite(enemy, amt),
        damageCrate: (crate, amt) => this.combatSystem.damageCrateSprite(crate, amt),
      });
    }

    // ResourceManagerの更新
    this.resourceManager?.updateResourcePickups();
    this.resourceManager?.updateResourceNodes(delta);

    // CameraManagerの更新
    this.cameraManager?.clampPlayerToBounds();
    this.cameraManager?.update();

    // WorldManagerの更新（ChunkManagerの更新を含む）
    if (this.worldManager && this.playerController?.sprite) {
      this.worldManager.update(this.playerController.sprite);

      // ドアとのインタラクション処理
      this.handleDoorInteraction();
    }

    // EffectManagerの更新
    this.effectManager?.updateLongDistanceEffects();

    // ScentManagerの更新
    this.scentManager?.update(time, delta);

    // NavigationManagerの更新（デバッグ描画用）
    this.navigationManager?.update();

    // ミニマップの更新
    if (this.minimapManager && this.playerController && this.playerController.sprite) {
      this.minimapManager.update(time, delta, this.playerController.sprite.x, this.playerController.sprite.y);
    }

    // 入力ビジュアライゼーションの更新
    if (this.playerController && this.uiManager) {
      this.uiManager.updateInputVisualization(
        this.playerController.inputState,
        this.playerController.sprite?.x,
        this.playerController.sprite?.y
      );
    }
  }

  /**
   * ドアとのインタラクション処理
   */
  handleDoorInteraction() {
    if (!this.playerController?.sprite || !this.worldManager) return;

    const playerPos = { x: this.playerController.sprite.x, y: this.playerController.sprite.y };

    let interactingDoor = null;
    const interactionDist = 80; // インタラクション距離 (60 -> 80)

    // 全てのロードされている家からドアを探す
    // getHouseZoneAtだと、ドア付近（部屋の外）にいるときに取得できない場合があるため
    if (this.worldManager.houses) {
      for (const house of this.worldManager.houses) {
        // 家の境界ボックスチェック（最適化）
        // プレイヤーが家の近くにいなければスキップ
        const houseBounds = house.bounds;
        const margin = 100;
        if (playerPos.x < houseBounds.left - margin || playerPos.x > houseBounds.right + margin ||
          playerPos.y < houseBounds.top - margin || playerPos.y > houseBounds.bottom + margin) {
          continue;
        }

        if (house.physicsObjects) {
          for (const obj of house.physicsObjects) {
            if (obj.getData('kind') === 'door') {
              const dist = Phaser.Math.Distance.Between(playerPos.x, playerPos.y, obj.x, obj.y);
              if (dist < interactionDist) {
                interactingDoor = obj;
                break;
              }
            }
          }
        }
        if (interactingDoor) break;
      }
    }

    // インタラクション中のドアがあれば進行度更新
    if (interactingDoor) {
      const state = interactingDoor.getData('state');

      let progress = interactingDoor.getData('progress') || 0;
      progress += 0.7; // 進行速度 (2 -> 0.7, 約3倍遅く)

      if (progress >= 100) {
        progress = 0;
        this.toggleDoor(interactingDoor);
      }

      interactingDoor.setData('progress', progress);

      // プログレスバー表示
      this.drawDoorProgress(interactingDoor, progress);
    }

    // プログレスバー描画用のGraphics
    if (!this.doorDebugGraphics) {
      this.doorDebugGraphics = this.add.graphics().setDepth(20);
    }
    this.doorDebugGraphics.clear();
    if (interactingDoor) {
      this.drawDoorProgress(interactingDoor, interactingDoor.getData('progress'));
    }
  }

  toggleDoor(door) {
    const state = door.getData('state');
    const newState = state === 'closed' ? 'open' : 'closed';

    door.setData('state', newState);

    if (newState === 'open') {
      // 開く：物理無効化、見た目を薄く/回転
      door.setAlpha(0.3);
      // 物理ボディを無効化（センサーにするか、削除して再生成か）
      // MatterJSの場合、setSensor(true)で通り抜け可能になる
      if (door.body) {
        door.setSensor(true);
        // 衝突状態をリセットするためにスリープを解除
        door.setAwake();
      }

      // プレイヤーがドアに押し付けられている場合、スリープしている可能性があるため起こす
      if (this.playerController?.sprite?.body) {
        this.playerController.sprite.setAwake();
      }

      // 音を鳴らす（あれば）
      // this.sound.play('door_open');
    } else {
      // 閉じる
      door.setAlpha(1.0);
      if (door.body) {
        door.setSensor(false);
        door.setAwake();
      }
    }
  }

  drawDoorProgress(door, progress) {
    if (!this.doorDebugGraphics) return;

    const width = 40;
    const height = 6;
    const x = door.x - width / 2;
    const y = door.y - 40;

    // 背景
    this.doorDebugGraphics.fillStyle(0x000000, 0.5);
    this.doorDebugGraphics.fillRect(x, y, width, height);

    // バー
    const barWidth = (width * progress) / 100;
    const color = progress >= 100 ? 0x00ff00 : 0xffffff;
    this.doorDebugGraphics.fillStyle(color, 1);
    this.doorDebugGraphics.fillRect(x, y, barWidth, height);
  }

  /**
   * プレイヤーを初期化
   */
  initPlayerWithOptions(selection) {
    if (this.playerController) {
      this.entityManager.remove(this.playerController);
      this.entityManager.cleanup();
      this.playerController = null;
    }

    const movementOption =
      AVAILABLE_MOVEMENTS[selection?.movementKey] || AVAILABLE_MOVEMENTS.basic;
    const dodgeOption =
      AVAILABLE_DODGES[selection?.dodgeKey] || AVAILABLE_DODGES.dash;
    const attackOption =
      AVAILABLE_ATTACKS[selection?.attackKey] || AVAILABLE_ATTACKS.aoe;
    const longDistanceOption =
      AVAILABLE_LONG_DISTANCE_MODES[selection?.longDistanceKey] || AVAILABLE_LONG_DISTANCE_MODES.none;

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
    const spawnY = this.worldHeight * 0.85;

    this.playerController = new CharacterController(this, {
      preset,
      spawn: { x: spawnX, y: spawnY },
      race: selection.race || "human",
      baseColor: attackOption.baseColor || movementOption.baseColor || 0x4caf50,
      longDistanceTriggerDistance: 250,
      callbacks: {
        onAttackArea: (area) => this.combatSystem.handlePlayerAttackArea(area),
        onHpChanged: (hp, maxHp) => this.uiManager?.updateHpUI(hp, maxHp),
        onDeath: () => this.handlePlayerDeath(),
        onLongDistanceStart: () => this.effectManager?.startLongDistanceEffects(),
        onLongDistanceStop: () => this.effectManager?.stopLongDistanceEffects(),
        onTapInput: (worldX, worldY) => this.uiManager?.showTapIndicator(worldX, worldY),
        onFlickInput: (worldX, worldY, dirX, dirY) => this.uiManager?.showFlickIndicator(worldX, worldY, dirX, dirY),
        onLongSwipeInput: (startX, startY, endX, endY) => this.uiManager?.showLongDistanceIndicator(startX, startY, endX, endY),
        onQuickSlotChanged: (itemId) => this.uiManager?.setQuickSlotItem(itemId),
      },
    });

    const player = this.playerController;
    const abilityMap = {
      tap:
        attackOption.abilityFactory?.(player) ||
        new AttackAbilityWrapper(player, MeleeAoEAttackController, {
          radius: 120,
          cooldown: 250,
        }),
      flick:
        dodgeOption.abilityFactory?.(player) ||
        new DodgeAbilityWrapper(player, DashDodgeController, {
          distance: 120,
          duration: 300,
          invincibleDuration: 200,
        }),
      longSwipe: longDistanceOption.abilityFactory?.(player) || null,
    };
    player.setAbilityMap(abilityMap);
    // コンボ＆遠近自動切替のロードアウトをセット（剣/フック/槍）
    const equipments = createWeaponEquipments(player);
    player.setComboManager(new ComboManager(player, {
      equipments,
      rangeThreshold: 260,
      resetMs: 1200,
    }));

    // EntityManagerに追加
    this.entityManager.add(this.playerController);

    // 各マネージャーにプレイヤーを設定
    this.spawnManager?.setPlayerController(this.playerController);
    this.resourceManager?.setPlayerController(this.playerController);
    this.cameraManager?.setPlayerController(this.playerController);
    this.effectManager?.setPlayerController(this.playerController);
    this.combatSystem.setPlayerController(this.playerController);

    // インベントリペナルティを適用
    if (this.uiManager) {
      this.uiManager.updateInventoryMovementPenalty();
      // サバイバルHUDを初期化
      this.uiManager.createSurvivalHUD(this.playerController);
    }

    // カメラモードを設定
    const spawnZone = this.worldManager?.getZoneForPoint(spawnX, spawnY) || null;
    if (spawnZone?.cameraMode === "chunk") {
      this.cameraManager?.setCameraMode("chunk", spawnZone);
    } else {
      this.cameraManager?.setCameraMode("follow");
    }

    this.isGameOver = false;
    this.uiManager?.updateHpUI(this.playerController.hp, this.playerController.maxHp);
  }

  /**
   * 衝突処理
   */
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

  /**
   * プレイヤー死亡処理
   */
  handlePlayerDeath() {
    if (this.isGameOver) return;
    this.isGameOver = true;

    if (this.playerController?.sprite) {
      this.playerController.sprite.setVelocity(0, 0);
      this.playerController.sprite.setFillStyle(0x9e9e9e);
    }

    this.uiManager?.showGameOver(() => {
      this.scene.restart();
    });
  }

  /**
   * クレート破壊時の処理
   */
  onCrateDestroyed(info = {}) {
    const dropTable = info.crate?.getData("dropTable") || this.spawnManager?.getDefaultCrateDropTable() || {};
    const zoneId = info.crate?.getData("zoneId") || null;

    const drops = this.resourceManager?.rollResourceDrops(dropTable) || {};
    const dropEntries = Object.entries(drops).filter(([, qty]) => qty > 0);

    dropEntries.forEach(([resourceId, quantity], idx) => {
      const offsetAngle = (idx / Math.max(dropEntries.length, 1)) * Math.PI * 2;
      const offsetRadius = 24;
      const spawnX = info.x + Math.cos(offsetAngle) * offsetRadius;
      const spawnY = info.y + Math.sin(offsetAngle) * offsetRadius;
      this.resourceManager?.spawnResourcePickup(spawnX, spawnY, resourceId, quantity, zoneId);
    });
  }

  /**
   * シーンのクリーンアップ
   */
  cleanupScene() {
    this.uiManager?.destroy();
    this.effectManager?.destroy();
    this.cameraManager?.destroy();
    this.resourceManager?.destroy();
    this.spawnManager?.destroy();
    this.entityManager.clear();
    if (this.inventory) {
      this.inventory.destroy();
    }
  }
}

// Phaserゲームの初期化
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
