/**
 * CameraManager
 * カメラ制御を統括
 */
class CameraManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.worldManager = options.worldManager;

    // ビューポートとワールドサイズ
    this.viewportWidth = options.viewportWidth ?? 720;
    this.viewportHeight = options.viewportHeight ?? 1280;
    this.worldWidth = options.worldWidth ?? 2200;
    this.worldHeight = options.worldHeight ?? 2800;
    this.playerRadius = options.playerRadius ?? 30;
    this.wallThickness = options.wallThickness ?? 40;

    // カメラモード
    this.cameraMode = "follow";
    this.activeChunkZoneId = null;
    this.currentInteriorZoneId = null;
    this.chunkTransitionInProgress = false;

    // チャンクグリッド設定
    this.cameraChunk = { col: 0, row: 0 };
    this.chunkCols = 1;
    this.chunkRows = 1;
    this.chunkWidth = this.viewportWidth;
    this.chunkHeight = this.viewportHeight;
    this.chunkOriginX = 0;
    this.chunkOriginY = 0;
    this.chunkBoundsWidth = this.worldWidth;
    this.chunkBoundsHeight = this.worldHeight;

    // プレイヤー参照
    this.playerController = null;

    // 霧エフェクト
    this.interiorFog = options.interiorFog || null;
  }

  /**
   * プレイヤーコントローラーを設定
   */
  setPlayerController(playerController) {
    this.playerController = playerController;
  }

  /**
   * 霧エフェクトを設定
   */
  setInteriorFog(fog) {
    this.interiorFog = fog;
  }

  /**
   * 初期カメラ設定
   */
  initialize() {
    // 無限マップでは境界を設定しない（デフォルトで境界なし）
    // チャンクモード（部屋）に入ったときだけ setBounds を使用
    this.camera.setViewport(0, 0, this.viewportWidth, this.viewportHeight);
    this.camera.centerOn(this.worldWidth / 2, this.worldHeight * 0.8);
    this.camera.roundPixels = true;
    this.camera.setZoom(1);

    this.configureChunkGrid({
      x: 0,
      y: 0,
      width: this.worldWidth,
      height: this.worldHeight,
    });
  }

  /**
   * カメラを更新
   */
  update() {
    if (!this.playerController?.sprite) return;

    const px = this.playerController.sprite.x;
    const py = this.playerController.sprite.y;

    const zone = this.worldManager?.getZoneForPoint(px, py) || null;

    // 部屋ベースのカメラ更新を優先
    this.updateChunkCamera();

    if (this.cameraMode === "chunk") {
      // 部屋モードの場合、updateChunkCameraで制御済みなのでここでは何もしない
      // ただし、部屋から出た場合の遷移などは updateChunkCamera 内で処理される

      // 既存のチャンクモード（部屋以外）の場合の処理
      if (this.activeChunkZoneId && !this.activeChunkZoneId.includes("_room_")) {
        const zone = this.worldManager?.getZoneForPoint(px, py) || null;
        if (!zone || zone.id !== this.activeChunkZoneId) {
          this.setCameraMode("follow");
        } else if (!this.chunkTransitionInProgress) {
          // ... existing chunk update logic ...
          const rect = this.getZoneBoundsRect(zone);
          // ... (keep existing logic for non-room chunks if any)
        }
      }
      return;
    }

    if (zone?.cameraMode === "chunk" && zone.kind !== "house") {
      // 家以外のチャンクゾーン（もしあれば）
      this.setCameraMode("chunk", zone);
      return;
    }

    // followモードでトランジション中の場合、手動でカメラを更新
    if (this.cameraMode === "follow" && this.chunkTransitionInProgress) {
      const elapsed = Date.now() - this.transitionStartTime;
      const progress = Math.min(elapsed / this.transitionDuration, 1);

      // Quad.easeInOut のイージング関数を適用
      let t = progress;
      if (t < 0.5) {
        t = 2 * t * t;
      } else {
        t = -1 + (4 - 2 * t) * t;
      }

      // 開始位置からプレイヤー位置へ補間
      const targetX = px;
      const targetY = py;
      const currentX = this.transitionStartX + (targetX - this.transitionStartX) * t;
      const currentY = this.transitionStartY + (targetY - this.transitionStartY) * t;

      this.camera.centerOn(currentX, currentY);

      // トランジション完了
      if (progress >= 1) {
        this.chunkTransitionInProgress = false;
        this.camera.startFollow(this.playerController.sprite, true, 0.18, 0.18);
      }
      return;
    }

    // 長距離移動モード中のカメラ調整
    const longDistanceAbility = this.playerController.abilityMap?.["longSwipe"];
    if (longDistanceAbility?.isActive?.()) {
      this.updateLongDistanceCamera(longDistanceAbility);
    } else {
      this.updateNormalCamera();
    }
  }

  /**
   * 長距離移動中のカメラ更新
   */
  updateLongDistanceCamera(longDistanceAbility) {
    const player = this.playerController.sprite;
    const controller = longDistanceAbility.controller;

    if (!controller?.direction) {
      this.updateNormalCamera();
      return;
    }

    // カメラを少しズームアウト
    const targetZoom = 0.9;
    const currentZoom = this.camera.zoom;
    this.camera.setZoom(currentZoom + (targetZoom - currentZoom) * 0.05);

    // 進行方向を先読みしてカメラを移動
    const lookAheadDistance = 150;
    const targetX = player.x + controller.direction.x * lookAheadDistance;
    const targetY = player.y + controller.direction.y * lookAheadDistance;

    // スムーズにカメラを移動
    const lerpFactor = 0.08;
    const newX = this.camera.scrollX + (targetX - this.camera.worldView.centerX) * lerpFactor;
    const newY = this.camera.scrollY + (targetY - this.camera.worldView.centerY) * lerpFactor;
    this.camera.scrollX = newX;
    this.camera.scrollY = newY;
  }

  /**
   * 通常モードのカメラ更新
   */
  updateNormalCamera() {
    // ズームを元に戻す
    const targetZoom = 1.0;
    const currentZoom = this.camera.zoom;
    if (Math.abs(currentZoom - targetZoom) > 0.01) {
      this.camera.setZoom(currentZoom + (targetZoom - currentZoom) * 0.05);
    }

    // 通常の追従を設定
    if (!this.camera._follow && this.playerController?.sprite) {
      this.camera.startFollow(this.playerController.sprite, true, 0.18, 0.18);
    }
  }

  /**
   * カメラモードを設定
   */
  setCameraMode(mode, zone = null) {
    if (mode === "chunk" && zone) {
      const rect = this.getZoneBoundsRect(zone);

      if (this.currentInteriorZoneId && this.currentInteriorZoneId !== zone.id) {
        this.worldManager?.handleZoneExit(this.currentInteriorZoneId);
      }

      this.cameraMode = "chunk";
      this.activeChunkZoneId = zone.id;
      this.currentInteriorZoneId = zone.id;
      this.chunkTransitionInProgress = true;

      this.worldManager?.handleZoneEnter(zone.id);
      this.updateInteriorFogAppearance(zone);

      this.camera.stopFollow();

      // ズームを計算
      const widthRatio = this.viewportWidth / rect.width;
      const heightRatio = this.viewportHeight / rect.height;
      const zoom = Math.min(1, Math.min(widthRatio, heightRatio));

      // 部屋が画面に収まるかチェック
      const roomFitsInViewportX = rect.width <= this.viewportWidth;
      const roomFitsInViewportY = rect.height <= this.viewportHeight;

      // カメラの中心位置を計算
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // カメラのバウンドとターゲット位置を計算
      let boundsX, boundsY, boundsWidth, boundsHeight;
      let targetX, targetY;

      if (roomFitsInViewportX && roomFitsInViewportY) {
        // 部屋全体が画面に収まる場合：カメラを固定
        const worldViewWidth = this.viewportWidth / zoom;
        const worldViewHeight = this.viewportHeight / zoom;
        boundsX = centerX - worldViewWidth / 2;
        boundsY = centerY - worldViewHeight / 2;
        boundsWidth = worldViewWidth;
        boundsHeight = worldViewHeight;
        targetX = centerX;
        targetY = centerY;
      } else {
        // 部屋が大きい場合：軸ごとに判定
        const playerX = this.playerController?.sprite?.x ?? centerX;
        const playerY = this.playerController?.sprite?.y ?? centerY;

        if (roomFitsInViewportX) {
          // 幅だけ収まる：X軸は固定、Y軸は追従
          const worldViewWidth = this.viewportWidth / zoom;
          boundsX = centerX - worldViewWidth / 2;
          boundsWidth = worldViewWidth;
          targetX = centerX;
        } else {
          // 幅が収まらない：X軸は通常のバウンド
          boundsX = rect.left;
          boundsWidth = rect.width;
          const halfViewportWidth = this.viewportWidth / zoom / 2;
          targetX = Phaser.Math.Clamp(
            playerX,
            rect.left + halfViewportWidth,
            rect.left + rect.width - halfViewportWidth
          );
        }

        if (roomFitsInViewportY) {
          // 高さだけ収まる：Y軸は固定、X軸は追従
          const worldViewHeight = this.viewportHeight / zoom;
          boundsY = centerY - worldViewHeight / 2;
          boundsHeight = worldViewHeight;
          targetY = centerY;
        } else {
          // 高さが収まらない：Y軸は通常のバウンド
          boundsY = rect.top;
          boundsHeight = rect.height;
          const halfViewportHeight = this.viewportHeight / zoom / 2;
          targetY = Phaser.Math.Clamp(
            playerY,
            rect.top + halfViewportHeight,
            rect.top + rect.height - halfViewportHeight
          );
        }
      }

      // パン完了後にズームとバウンドを設定
      const panCompleteEvent = Phaser.Cameras.Scene2D.Events.PAN_COMPLETE;
      this.camera.once(panCompleteEvent, () => {
        this.camera.setZoom(zoom > 0 ? zoom : 1);
        this.camera.setBounds(boundsX, boundsY, boundsWidth, boundsHeight);
        this.chunkTransitionInProgress = false;
      });

      // カメラをアニメーションで移動
      this.camera.pan(targetX, targetY, 320, "Quad.easeInOut");
      return;
    }

    if (this.currentInteriorZoneId) {
      this.worldManager?.handleZoneExit(this.currentInteriorZoneId);
      this.currentInteriorZoneId = null;
    }

    // チャンクカメラの現在位置を記録
    const currentCameraX = this.camera.worldView.centerX;
    const currentCameraY = this.camera.worldView.centerY;

    this.cameraMode = "follow";
    this.activeChunkZoneId = null;
    this.chunkTransitionInProgress = true;
    this.updateInteriorFogAppearance(null);

    // 通常モード（無限マップ）の設定を適用
    this.camera.setZoom(1);
    // 境界を実質無限に設定（_bounds = null はPhaser内部でエラーになるため使用しない）
    this.camera.setBounds(-10000000, -10000000, 20000000, 20000000);

    // チャンクカメラの位置からスタート
    this.camera.centerOn(currentCameraX, currentCameraY);

    // トランジション開始時刻を記録
    this.transitionStartTime = Date.now();
    this.transitionDuration = 400;
    this.transitionStartX = currentCameraX;
    this.transitionStartY = currentCameraY;
  }

  /**
   * ゾーンの境界矩形を取得
   */
  getZoneBoundsRect(zone) {
    const source = zone.interiorBounds || zone.bounds || {
      x: this.worldWidth / 2,
      y: this.worldHeight / 2,
      width: this.worldWidth,
      height: this.worldHeight,
    };

    const halfW = source.width / 2;
    const halfH = source.height / 2;

    return {
      left: source.x - halfW,
      top: source.y - halfH,
      width: source.width,
      height: source.height,
    };
  }

  /**
   * 矩形の中心にカメラを配置
   * 部屋がビューポートに収まる場合は中央に、収まらない場合はプレイヤー位置を考慮
   */
  centerCameraOnRect(rect, playerX = null, playerY = null) {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // ビューポートと部屋のサイズを比較
    const roomFitsInViewportX = rect.width <= this.viewportWidth;
    const roomFitsInViewportY = rect.height <= this.viewportHeight;

    let targetX = centerX;
    let targetY = centerY;

    // 部屋が画面に収まらない場合は、プレイヤー位置を使用
    if (!roomFitsInViewportX && playerX !== null) {
      // 部屋の境界内にクランプ
      const halfViewportWidth = this.viewportWidth / 2;
      targetX = Phaser.Math.Clamp(
        playerX,
        rect.left + halfViewportWidth,
        rect.left + rect.width - halfViewportWidth
      );
    }

    if (!roomFitsInViewportY && playerY !== null) {
      const halfViewportHeight = this.viewportHeight / 2;
      targetY = Phaser.Math.Clamp(
        playerY,
        rect.top + halfViewportHeight,
        rect.top + rect.height - halfViewportHeight
      );
    }

    this.camera.centerOn(targetX, targetY);
  }

  /**
   * 矩形に合わせてズームを適用
   */
  applyCameraZoomForRect(rect) {
    const widthRatio = this.viewportWidth / rect.width;
    const heightRatio = this.viewportHeight / rect.height;
    const zoom = Math.min(1, Math.min(widthRatio, heightRatio));
    this.camera.setZoom(zoom > 0 ? zoom : 1);
  }

  /**
   * チャンクグリッドを設定
   */
  configureChunkGrid(bounds = null) {
    const target = bounds || {
      x: this.worldWidth / 2,
      y: this.worldHeight / 2,
      width: this.worldWidth,
      height: this.worldHeight,
    };

    const targetWidth = Math.max(target.width, this.viewportWidth);
    const targetHeight = Math.max(target.height, this.viewportHeight);

    this.chunkWidth = targetWidth;
    this.chunkHeight = targetHeight;
    this.chunkOriginX = target.x - targetWidth / 2;
    this.chunkOriginY = target.y - targetHeight / 2;
    this.chunkBoundsWidth = targetWidth;
    this.chunkBoundsHeight = targetHeight;
    this.chunkCols = Math.max(1, Math.ceil(this.chunkBoundsWidth / this.chunkWidth));
    this.chunkRows = Math.max(1, Math.ceil(this.chunkBoundsHeight / this.chunkHeight));
    this.cameraChunk = { col: 0, row: 0 };
  }

  /**
   * 位置に対応するカメラチャンクを取得
   */
  getCameraChunkForPosition(x, y) {
    const localX = Phaser.Math.Clamp(
      x - this.chunkOriginX,
      0,
      this.chunkBoundsWidth - 0.01
    );
    const localY = Phaser.Math.Clamp(
      y - this.chunkOriginY,
      0,
      this.chunkBoundsHeight - 0.01
    );
    const col = Phaser.Math.Clamp(
      Math.floor(localX / this.chunkWidth),
      0,
      this.chunkCols - 1
    );
    const row = Phaser.Math.Clamp(
      Math.floor(localY / this.chunkHeight),
      0,
      this.chunkRows - 1
    );
    return { col, row };
  }

  /**
   * カメラチャンクを設定
   */
  setCameraChunk(chunk, animate = false) {
    if (!chunk) return;

    const isSame =
      chunk.col === this.cameraChunk.col && chunk.row === this.cameraChunk.row;
    if (isSame && !animate) return;

    const minCenterX = this.chunkOriginX + this.chunkWidth / 2;
    const minCenterY = this.chunkOriginY + this.chunkHeight / 2;
    const maxCenterX =
      this.chunkOriginX + this.chunkBoundsWidth - this.chunkWidth / 2;
    const maxCenterY =
      this.chunkOriginY + this.chunkBoundsHeight - this.chunkHeight / 2;
    const centerX = Phaser.Math.Clamp(
      this.chunkOriginX + chunk.col * this.chunkWidth + this.chunkWidth / 2,
      minCenterX,
      Math.max(minCenterX, maxCenterX)
    );
    const centerY = Phaser.Math.Clamp(
      this.chunkOriginY + chunk.row * this.chunkHeight + this.chunkHeight / 2,
      minCenterY,
      Math.max(minCenterY, maxCenterY)
    );

    const performPan = animate && !isSame;
    if (performPan) {
      if (this.chunkTransitionInProgress) return;
      this.chunkTransitionInProgress = true;
      const panCompleteEvent = Phaser.Cameras.Scene2D.Events.PAN_COMPLETE;
      this.camera.once(panCompleteEvent, () => {
        this.chunkTransitionInProgress = false;
      });
      this.camera.pan(centerX, centerY, 320, "Quad.easeInOut");
    } else {
      this.camera.centerOn(centerX, centerY);
    }

    this.cameraChunk = chunk;
  }

  /**
   * カメラをプレイヤーにスナップ
   */
  snapCameraToPlayer() {
    if (!this.playerController?.sprite) return;

    const chunk = this.getCameraChunkForPosition(
      this.playerController.sprite.x,
      this.playerController.sprite.y
    );
    this.chunkTransitionInProgress = false;
    this.setCameraChunk(chunk, false);
  }

  /**
   * チャンクカメラを更新
   */
  updateChunkCamera() {
    if (!this.playerController?.sprite) return;

    const px = this.playerController.sprite.x;
    const py = this.playerController.sprite.y;

    // 部屋ベースのカメラ制御
    // 現在の部屋を取得
    const room = this.worldManager?.getRoomAt?.(px, py);

    if (room) {
      // 部屋の中にいる場合、その部屋をターゲットにする
      // 部屋IDが変わった場合のみ更新
      if (this.activeChunkZoneId !== room.id) {
        // 擬似的なZoneオブジェクトを作成してsetCameraModeに渡す
        const roomZone = {
          id: room.id,
          kind: "room",
          bounds: room, // roomオブジェクト自体が x, y, width, height を持っている
          cameraMode: "chunk"
          // interiorConfig は設定しない（部屋は暗くしない）
        };
        this.setCameraMode("chunk", roomZone);
      }
    } else {
      // 部屋の外にいる場合
      // もし現在 "room" 種類のチャンクモードなら解除してfollowに戻す
      if (this.cameraMode === "chunk" && this.activeChunkZoneId && this.activeChunkZoneId.includes("_room_")) {
        // 部屋から出たので、屋根を表示に戻すためにExitを呼ぶ
        // ただし、WorldManager側で「同じ家の別の部屋」への移動かどうかは判断できないので、
        // ここで明示的に「家から出た」ことを伝える必要があるかもしれない。
        // とりあえずExitを呼ぶ。
        this.worldManager?.handleZoneExit(this.activeChunkZoneId);

        // さらに、もしactiveHouseZoneIdが残っているならクリアする
        if (this.worldManager?.activeHouseZoneId) {
          const houseId = this.activeChunkZoneId.split("_room_")[0];
          if (this.worldManager.activeHouseZoneId === houseId) {
            this.worldManager.activeHouseZoneId = null;
            this.worldManager.setHouseRoofVisible(houseId, true);
            this.worldManager.updateHouseObjectVisibility();
          }
        }

        this.setCameraMode("follow");
      } else {
        // 通常のグリッドベースチャンク（もし使うなら）
        // ...
      }
    }
  }

  /**
   * インテリア霧の外観を更新
   */
  updateInteriorFogAppearance(zone) {
    if (!this.interiorFog) return;

    // マスク用グラフィックスの初期化（初回のみ）
    if (!this.fogMaskGraphics) {
      this.fogMaskGraphics = this.scene.make.graphics();
    }

    if (!zone) {
      this.interiorFog.setVisible(false);
      this.interiorFog.clearMask();
      return;
    }

    if (zone?.kind === "house") {
      this.interiorFog.setVisible(false);
      this.interiorFog.clearMask();
      return;
    }

    if (zone?.interiorConfig?.hideOutside) {
      const alpha = zone.interiorConfig.fogAlpha ?? 0.85;
      this.interiorFog.setFillStyle(0x050507, alpha);
      this.interiorFog.setVisible(true);

      // マスクを更新（部屋の部分だけ穴を開ける）
      this.fogMaskGraphics.clear();
      this.fogMaskGraphics.fillStyle(0xffffff);

      // zone.boundsが x,y,width,height を持っている前提
      // roomZone作成時に bounds: room としたので、room.x等は中心座標
      const b = zone.bounds;
      if (b) {
        // グラフィックスは左上基準で描画
        this.fogMaskGraphics.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
      }

      const mask = this.fogMaskGraphics.createGeometryMask();
      mask.setInvertAlpha(true); // 描画した部分（部屋）を「隠す」＝霧を消す
      this.interiorFog.setMask(mask);

      return;
    }

    if (zone?.interiorConfig?.fogAlpha) {
      this.interiorFog.setFillStyle(0x050507, zone.interiorConfig.fogAlpha);
      this.interiorFog.setVisible(true);
      this.interiorFog.clearMask();
      return;
    }

    this.interiorFog.setVisible(false);
    this.interiorFog.clearMask();
  }

  /**
   * プレイヤーを境界内にクランプ
   * 無限マップでは境界がないため、この機能は無効化
   */
  clampPlayerToBounds() {
    // 無限マップでは境界制限なし
    return;
  }

  /**
   * クリーンアップ
   */
  destroy() {
    this.camera.stopFollow();
    this.playerController = null;
  }
}

window.CameraManager = CameraManager;
