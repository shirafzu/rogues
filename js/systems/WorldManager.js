class WorldManager {
  constructor(scene, rnd) {
    this.scene = scene;
    this.rnd = rnd;

    // HouseDefinitionsはChunkManager内で使用されるが、ここでも保持
    this.houseDefinitions = new HouseDefinitions(0, 0, rnd); // サイズは無意味になる

    // チャンクマネージャーの初期化
    this.chunkManager = new ChunkManager(scene, this, rnd);

    this.houses = []; // 現在ロードされている家リスト
    this.houseRoofGroups = {};
    this.zoneObjectRegistry = {};
    this.activeHouseZoneId = null;

    // ベースノード（クラフト拠点）のスポーン位置
    // 初期位置(0,0)付近に固定で1つ作る
    this.baseNodeSpawns = [
      { x: 0, y: 0, zoneId: "start_base" },
    ];

    // クレートスポーンはChunkManagerに委譲するため削除
    this.crateSpawns = [];
  }

  update(player) {
    if (!player) return;

    // チャンク更新
    this.chunkManager.update(player.x, player.y);

    // 家の屋根の表示更新
    this.updateHouseObjectVisibility();
  }

  // 古いgenerateZonesは削除

  addHouse(houseZone) {
    this.houses.push(houseZone);
    this.buildHouseStructure(houseZone);
  }

  removeHouse(houseZone) {
    const index = this.houses.indexOf(houseZone);
    if (index > -1) {
      this.houses.splice(index, 1);

      // 物理オブジェクトの削除
      if (houseZone.physicsObjects) {
        houseZone.physicsObjects.forEach(obj => obj.destroy());
      }

      // 屋根の削除
      if (this.houseRoofGroups[houseZone.id]) {
        this.houseRoofGroups[houseZone.id].forEach(obj => obj.destroy());
        delete this.houseRoofGroups[houseZone.id];
      }
    }
  }

  buildHouseStructure(house) {
    house.physicsObjects = [];

    // 部屋ごとの床と屋根を生成
    house.rooms.forEach(room => {
      // 床（部屋タイプに応じた色）
      const roomConfig = this.houseDefinitions.roomTypes[room.type] || {};
      const floorColor = roomConfig.color || 0xd7ccc8;

      const floor = this.scene.add.rectangle(
        room.bounds.x,
        room.bounds.y,
        room.bounds.width,
        room.bounds.height,
        floorColor
      );
      floor.setDepth(-5);
      house.physicsObjects.push(floor);

      // 部屋ラベル（デバッグ用）
      // const label = this.scene.add.text(
      //   room.bounds.x,
      //   room.bounds.y,
      //   roomConfig.label || room.type,
      //   {
      //     fontSize: '14px',
      //     color: '#ffffff',
      //     backgroundColor: '#00000088',
      //     padding: { x: 4, y: 2 }
      //   }
      // ).setOrigin(0.5).setDepth(10);
      // house.physicsObjects.push(label);

      // 屋根の生成
      this.createHouseRoof(house, room);
    });

    // 壁の生成（ドアを考慮）
    this.createHouseWallsWithDoors(house);
  }

  /**
   * ドアを考慮した壁生成
   */
  createHouseWallsWithDoors(house) {
    const wallThickness = 20;
    const wallColor = 0x6d4c41;

    // 全ての部屋の壁を生成
    // 隣接する部屋がある場合は壁を作らない（あるいはドアがある場合のみ穴をあける）
    // ここではシンプルに「各部屋の4辺」について処理する

    house.rooms.forEach(room => {
      const bounds = room.bounds;
      const sides = ['top', 'bottom', 'left', 'right'];

      sides.forEach(side => {
        // この辺に隣接する部屋があるか？
        const neighbor = this.findNeighborRoom(house, room, side);

        // ドアがあるか？
        const door = this.findDoorOnSide(house, room, side);

        if (neighbor) {
          // 隣接部屋がある場合
          if (door) {
            // ドアがあるなら、ドア部分を空けて壁を作る（間仕切り壁）
            this.createWallWithDoorGap(house, room, side, door, wallColor, wallThickness);
            // ドアオブジェクトを生成（まだ生成されていなければ）
            if (!door.generated) {
              // 壁の向きに合わせてドアの向きを強制設定
              door.orientation = (side === 'top' || side === 'bottom') ? 'horizontal' : 'vertical';
              this.createDoorObject(house, door);
              door.generated = true;
            }
          } else {
            // ドアがないなら、壁は作らない（部屋がつながっている）
            // ただし、部屋のタイプが違う場合などは壁があってもいいが、
            // 今回の仕様では「廊下なし＝つながっている」なので壁なしでOK
          }
        } else {
          // 隣接部屋がない＝外壁
          // 玄関ドアがあるかチェック
          // side (top/bottom/left/right) を approachDir (north/south/west/east) に変換
          let dir = '';
          if (side === 'top') dir = 'north';
          else if (side === 'bottom') dir = 'south';
          else if (side === 'left') dir = 'west';
          else if (side === 'right') dir = 'east';

          const entrance = this.findEntranceOnSide(house, room, dir);
          if (entrance) {
            // 玄関ドア
            // ドアの位置を特定する必要があるが、entranceデータには座標がない場合がある
            // 簡易的に辺の中央とする
            const doorPos = this.calculateEntrancePos(room, side);
            const doorObj = { x: doorPos.x, y: doorPos.y, w: 60, h: wallThickness, orientation: (side === 'top' || side === 'bottom') ? 'horizontal' : 'vertical' };

            this.createWallWithDoorGap(house, room, side, doorObj, wallColor, wallThickness);
            this.createDoorObject(house, { ...doorObj, id: `entrance_${room.id}`, type: 'entrance' });

            // マーカー
            this.createEntranceMarker(house, room, dir); // sideではなくdirを渡す（createEntranceMarkerはnorth/south期待）
          } else {
            // 完全な壁
            this.createWallSegment(house, room, side, wallColor, wallThickness);
          }
        }
      });
    });
  }

  findNeighborRoom(house, room, side) {
    const threshold = 5;
    return house.rooms.find(other => {
      if (other.id === room.id) return false;
      if (side === 'top') {
        return Math.abs(other.bounds.bottom - room.bounds.top) < threshold &&
          other.bounds.right > room.bounds.left && other.bounds.left < room.bounds.right;
      }
      if (side === 'bottom') {
        return Math.abs(other.bounds.top - room.bounds.bottom) < threshold &&
          other.bounds.right > room.bounds.left && other.bounds.left < room.bounds.right;
      }
      if (side === 'left') {
        return Math.abs(other.bounds.right - room.bounds.left) < threshold &&
          other.bounds.bottom > room.bounds.top && other.bounds.top < room.bounds.bottom;
      }
      if (side === 'right') {
        return Math.abs(other.bounds.left - room.bounds.right) < threshold &&
          other.bounds.bottom > room.bounds.top && other.bounds.top < room.bounds.bottom;
      }
      return false;
    });
  }

  findDoorOnSide(house, room, side) {
    const threshold = 10;
    return house.doors.find(d => {
      // ドアの座標がこの辺上にあるか
      if (side === 'top') {
        return Math.abs(d.y - room.bounds.top) < threshold && d.x > room.bounds.left && d.x < room.bounds.right;
      }
      if (side === 'bottom') {
        return Math.abs(d.y - room.bounds.bottom) < threshold && d.x > room.bounds.left && d.x < room.bounds.right;
      }
      if (side === 'left') {
        return Math.abs(d.x - room.bounds.left) < threshold && d.y > room.bounds.top && d.y < room.bounds.bottom;
      }
      if (side === 'right') {
        return Math.abs(d.x - room.bounds.right) < threshold && d.y > room.bounds.top && d.y < room.bounds.bottom;
      }
      return false;
    });
  }

  findEntranceOnSide(house, room, side) {
    if (!house.entrances) return null;
    return house.entrances.find(e => e.roomId === room.id && e.side === side);
  }

  calculateEntrancePos(room, side) {
    if (side === 'top') return { x: room.bounds.x, y: room.bounds.top };
    if (side === 'bottom') return { x: room.bounds.x, y: room.bounds.bottom };
    if (side === 'left') return { x: room.bounds.left, y: room.bounds.y };
    if (side === 'right') return { x: room.bounds.right, y: room.bounds.y };
    return { x: room.bounds.x, y: room.bounds.y };
  }

  createWallSegment(house, room, side, color, thickness) {
    let x, y, w, h;
    if (side === 'top') {
      x = room.bounds.x; y = room.bounds.top; w = room.bounds.width; h = thickness;
    } else if (side === 'bottom') {
      x = room.bounds.x; y = room.bounds.bottom; w = room.bounds.width; h = thickness;
    } else if (side === 'left') {
      x = room.bounds.left; y = room.bounds.y; w = thickness; h = room.bounds.height;
    } else { // right
      x = room.bounds.right; y = room.bounds.y; w = thickness; h = room.bounds.height;
    }

    const wall = this.scene.add.rectangle(x, y, w, h, color);
    const categories = this.scene.collisionCategories || {};
    this.scene.matter.add.gameObject(wall, {
      isStatic: true,
      friction: 0.1, // 摩擦を低く
      slop: 0.03,
      collisionFilter: {
        category: categories.WALL || 0x0040,
        mask: (categories.PLAYER | categories.ENEMY | categories.PROJECTILE | categories.DYNAMIC_OBJECT) || 0xFFFF
      }
    });
    wall.setDepth(5);
    house.physicsObjects.push(wall);
  }

  createWallWithDoorGap(house, room, side, door, color, thickness) {
    // ドアを中心に、左右（または上下）に壁を作る
    const doorSize = 100; // ドアの幅 (60 -> 100)

    let w1, h1, x1, y1;
    let w2, h2, x2, y2;

    if (side === 'top' || side === 'bottom') {
      // 横壁
      const yPos = side === 'top' ? room.bounds.top : room.bounds.bottom;
      const leftW = (door.x - room.bounds.left) - doorSize / 2;
      const rightW = (room.bounds.right - door.x) - doorSize / 2;

      if (leftW > 0) {
        w1 = leftW; h1 = thickness;
        x1 = room.bounds.left + leftW / 2;
        y1 = yPos;
      }
      if (rightW > 0) {
        w2 = rightW; h2 = thickness;
        x2 = room.bounds.right - rightW / 2;
        y2 = yPos;
      }
    } else {
      // 縦壁
      const xPos = side === 'left' ? room.bounds.left : room.bounds.right;
      const topH = (door.y - room.bounds.top) - doorSize / 2;
      const bottomH = (room.bounds.bottom - door.y) - doorSize / 2;

      if (topH > 0) {
        w1 = thickness; h1 = topH;
        x1 = xPos;
        y1 = room.bounds.top + topH / 2;
      }
      if (bottomH > 0) {
        w2 = thickness; h2 = bottomH;
        x2 = xPos;
        y2 = room.bounds.bottom - bottomH / 2;
      }
    }

    const categories = this.scene.collisionCategories || {};
    const wallCollisionConfig = {
      isStatic: true,
      friction: 0.1, // 摩擦を低く
      slop: 0.03,
      collisionFilter: {
        category: categories.WALL || 0x0040,
        mask: (categories.PLAYER | categories.ENEMY | categories.PROJECTILE | categories.DYNAMIC_OBJECT) || 0xFFFF
      }
    };

    if (w1) {
      const wall1 = this.scene.add.rectangle(x1, y1, w1, h1, color);
      this.scene.matter.add.gameObject(wall1, wallCollisionConfig);
      wall1.setDepth(5);
      house.physicsObjects.push(wall1);
    }
    if (w2) {
      const wall2 = this.scene.add.rectangle(x2, y2, w2, h2, color);
      this.scene.matter.add.gameObject(wall2, wallCollisionConfig);
      wall2.setDepth(5);
      house.physicsObjects.push(wall2);
    }
  }

  createDoorObject(house, doorData) {
    // ドアサイズを大きくする
    const thickness = 20;
    const length = 100; // 60 -> 100

    const w = (doorData.orientation === 'vertical' || (doorData.w < doorData.h && doorData.w > 0)) ? thickness : length;
    const h = (doorData.orientation === 'vertical' || (doorData.w < doorData.h && doorData.w > 0)) ? length : thickness;

    // ドア本体
    const door = this.scene.add.rectangle(doorData.x, doorData.y, w, h, 0x8d6e63);
    const categories = this.scene.collisionCategories || {};
    this.scene.matter.add.gameObject(door, {
      isStatic: true,
      friction: 0.1, // 摩擦を低く
      slop: 0.03,
      collisionFilter: {
        category: categories.WALL || 0x0040,
        mask: (categories.PLAYER | categories.ENEMY | categories.PROJECTILE | categories.DYNAMIC_OBJECT) || 0xFFFF
      }
    });
    door.setDepth(6);
    door.setData('kind', 'door');
    door.setData('state', 'closed');
    door.setData('progress', 0);
    door.setData('baseColor', 0x8d6e63);

    house.physicsObjects.push(door);
  }

  /**
   * 玄関マーカーを作成
   */
  createEntranceMarker(house, room, side) {
    const bounds = room.bounds;
    let x, y;

    // 玄関の位置を計算
    if (side === 'south') {
      x = bounds.x;
      y = bounds.bottom + 30;
    } else if (side === 'north') {
      x = bounds.x;
      y = bounds.top - 30;
    } else if (side === 'east') {
      x = bounds.right + 30;
      y = bounds.y;
    } else { // west
      x = bounds.left - 30;
      y = bounds.y;
    }

    // 入り口を示す矢印または図形
    const marker = this.scene.add.circle(x, y, 20, 0xff9800, 0.7);
    marker.setDepth(1);
    house.physicsObjects.push(marker);

    const label = this.scene.add.text(x, y, '入口', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2);
    house.physicsObjects.push(label);
  }

  createHouseRoof(house, room) {
    if (!this.houseRoofGroups[house.id]) {
      this.houseRoofGroups[house.id] = [];
    }

    const roof = this.scene.add.rectangle(room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height, 0x3e2723);
    roof.setDepth(100); // 最前面
    this.houseRoofGroups[house.id].push(roof);
  }

  getRoomAt(x, y) {
    return this.chunkManager.getRoomAt(x, y);
  }

  // 既存メソッドの維持
  getHouseZoneAt(x, y) {
    // 家の部屋のいずれかに入っているかチェック
    for (const house of this.houses) {
      for (const room of house.rooms) {
        if (this.isPointInsideRect(x, y, room.bounds)) {
          return house;
        }
      }
    }
    return null;
  }

  getBaseNodeSpawns() {
    return this.baseNodeSpawns;
  }

  // 古いメソッドの削除
  // buildStaticLayout, buildWorldWalls, getCrateSpawns, etc.

  getCrateSpawns() {
    return []; // ChunkManagerで生成するため空を返す
  }

  getEnemySpawnPlan() {
    return []; // ChunkManagerで生成するため空を返す
  }

  // ユーティリティ
  isPointInsideRect(x, y, rect) {
    if (!rect) return false;
    if (rect.left !== undefined) {
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;
    return x >= rect.x - halfW && x <= rect.x + halfW && y >= rect.y - halfH && y <= rect.y + halfH;
  }

  // 部屋に入ったときの処理などは維持
  handleZoneEnter(zoneId) {
    if (!zoneId) return;

    // 部屋IDの場合
    if (zoneId.includes("_room_")) {
      const houseId = zoneId.split("_room_")[0];
      if (this.activeHouseZoneId !== houseId) {
        this.activeHouseZoneId = houseId;
        this.setHouseRoofVisible(houseId, false);
        this.updateHouseObjectVisibility();
      }
      return;
    }
  }

  handleZoneExit(zoneId) {
    if (!zoneId) return;

    // 部屋から出た場合
    if (zoneId.includes("_room_")) {
      // 次のゾーンが同じ家の別の部屋なら何もしない
      // これは呼び出し元(CameraManager)で制御されるべきだが、
      // ここでは「家から完全に出た」判定が難しい。
      // CameraManagerが handleZoneEnter を呼んでくれるので、
      // ここでは単純に activeHouseZoneId をリセットしない方が良い場合もある。

      // しかし、家から出た場合は屋根を表示したい。
      // CameraManagerのupdateChunkCameraで、roomがnullになったら
      // activeHouseZoneIdをnullにして屋根を表示する処理が必要。
      // 現状のWorldManagerのロジックでは、明示的に「家から出た」メソッドが必要かも。
    }
  }

  setHouseRoofVisible(houseId, visible) {
    const group = this.houseRoofGroups[houseId];
    if (group) {
      group.forEach((obj) => obj.setVisible(visible));
    }
  }

  registerZoneObject(_zoneId, displayObject) {
    if (!displayObject?.setVisible) return;
    if (!this.houseObjects) {
      this.houseObjects = new Set();
    }
    this.houseObjects.add(displayObject);
    this.updateSingleHouseObject(displayObject);
  }

  updateHouseObjectVisibility() {
    if (!this.houseObjects) return;
    const toDelete = [];
    for (const obj of this.houseObjects) {
      if (!obj || !obj.active) {
        toDelete.push(obj);
      }
    }
    toDelete.forEach(obj => this.houseObjects.delete(obj));
    this.houseObjects.forEach((obj) => this.updateSingleHouseObject(obj));
  }

  updateSingleHouseObject(displayObject) {
    if (!displayObject?.setVisible || !displayObject.active) return;

    // 家の中にいるかチェック（部屋単位で判定）
    let inHouse = false;
    let houseId = null;

    for (const house of this.houses) {
      // 家の部屋のいずれかに入っているかチェック
      for (const room of house.rooms) {
        if (this.isPointInsideRect(displayObject.x, displayObject.y, room.bounds)) {
          inHouse = true;
          houseId = house.id;
          break;
        }
      }
      if (inHouse) break;
    }

    if (!inHouse) {
      // 家の外にいる場合は常に表示
      displayObject.setVisible(true);
      displayObject.__houseZoneId = null;
      return;
    }

    // 家の中にいる場合
    displayObject.__houseZoneId = houseId;

    // プレイヤーが同じ家の中にいる場合のみ表示
    const shouldShow = houseId === this.activeHouseZoneId;
    displayObject.setVisible(shouldShow);
  }

  // 互換性のため、getZoneForPoint メソッドを追加
  getZoneForPoint(x, y) {
    // 家の中にいる場合は家の情報を返す
    const house = this.getHouseZoneAt(x, y);
    if (house) return house;

    // それ以外はバイオーム情報を返す
    const biome = this.chunkManager?.getBiomeAt(x, y);
    if (biome) {
      return {
        id: `biome_${biome}`,
        kind: 'biome',
        biome: biome,
      };
    }

    return null;
  }

  // 互換性のため、getZoneById メソッドを追加（常に null を返す）
  getZoneById(zoneId) {
    // 固定ゾーンはないので、家を検索
    return this.houses.find(h => h.id === zoneId) || null;
  }
}

window.WorldManager = WorldManager;
