/**
 * HouseDefinitions
 * 現実的な間取り図を生成するシステム（完全リライト版）
 * LDKを分離し、廊下中心のレイアウトを実装
 */

class HouseDefinitions {
  constructor(worldWidth, worldHeight, rnd) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.rnd = rnd;
    this.defaultWallThickness = 20;

    // グリッド設定（1セル = 100px）
    this.cellSize = 100;

    // 部屋タイプ定義（個別に分離）
    this.roomTypes = {
      entrance: { minCells: 2, maxCells: 9, color: 0xd7ccc8, label: "玄関" }, // minCells reduced
      living: { minCells: 6, maxCells: 25, color: 0xbcaaa4, label: "リビング" }, // minCells reduced
      dining: { minCells: 4, maxCells: 15, color: 0xb0a199, label: "ダイニング" }, // minCells reduced
      kitchen: { minCells: 4, maxCells: 12, color: 0xa1887f, label: "キッチン" }, // minCells reduced
      bedroom: { minCells: 6, maxCells: 16, color: 0x8d6e63, label: "洋室" }, // minCells reduced
      bathroom: { minCells: 2, maxCells: 6, color: 0x795548, label: "浴室" }, // minCells reduced
      toilet: { minCells: 1, maxCells: 3, color: 0x6d4c41, label: "トイレ" }, // minCells reduced
      washroom: { minCells: 2, maxCells: 4, color: 0x5d4037, label: "洗面室" },
      storage: { minCells: 2, maxCells: 6, color: 0x4e342e, label: "収納" },
      corridor: { minCells: 3, maxCells: 12, color: 0x9e9e9e, label: "廊下" },
    };

    console.log("[HouseDefinitions] Initialized with separated room types");
  }

  /**
   * 家を生成（メインエントリーポイント）
   */
  createProceduralHouse(lotConfig) {
    const { id, x, y, width, height, approachDir } = lotConfig;

    console.log(`[HouseDefinitions] Generating house ${id} at (${Math.round(x)}, ${Math.round(y)}), size ${width}x${height}`);

    // グリッドサイズを計算
    const gridW = Math.floor(width / this.cellSize);
    const gridH = Math.floor(height / this.cellSize);

    console.log(`[HouseDefinitions] Grid size: ${gridW}x${gridH} (cellSize=${this.cellSize}px)`);

    // 最小サイズチェック（少なくとも6x6グリッドが必要 - コンパクト用に緩和）
    if (gridW < 6 || gridH < 6) {
      console.log(`[HouseDefinitions] Grid too small for realistic house: ${gridW}x${gridH} < 6x6`);
      return null;
    }

    // グリッドサイズに応じて家のタイプを決定
    let houseSize;
    if (gridW >= 14 && gridH >= 14) {
      houseSize = "large"; // 豪邸（廊下あり）
    } else if (gridW >= 8 && gridH >= 8) {
      houseSize = "medium"; // 普通の家（廊下なし・長方形）
    } else {
      houseSize = "small"; // 小屋（廊下なし・長方形）
    }

    console.log(`[HouseDefinitions] House size category: ${houseSize}`);

    // 間取りを生成
    let result;
    if (houseSize === "large") {
      result = this.generateCorridorBasedLayout(
        gridW,
        gridH,
        houseSize,
        id,
        approachDir
      );
    } else {
      result = this.generateCompactLayout(
        gridW,
        gridH,
        houseSize,
        id,
        approachDir
      );
    }

    if (!result || result.rooms.length < 2) {
      console.log(`[HouseDefinitions] Failed to generate house: insufficient rooms (${result?.rooms.length || 0})`);
      return null;
    }

    console.log(`[HouseDefinitions] Generated ${result.rooms.length} rooms successfully`);

    // ワールド座標に変換
    const worldRooms = result.rooms.map((r) =>
      this.convertToWorldCoords(r, x, y, width, height)
    );
    const worldDoors = result.doors.map((d) =>
      this.convertDoorToWorldCoords(d, result.rooms, x, y, width, height)
    );

    const houseBounds = this.calculateHouseBounds(worldRooms);

    // 生成された部屋のタイプをログ出力
    const roomTypeSummary = worldRooms.map(r => this.roomTypes[r.type]?.label || r.type).join(", ");
    console.log(`[HouseDefinitions] Rooms: ${roomTypeSummary}`);

    return {
      id: id,
      name: `${houseSize === "large" ? "大きな家" : houseSize === "medium" ? "普通の家" : "小さな家"} (${result.rooms.length}部屋)`,
      kind: "house",
      houseType: houseSize,
      bounds: houseBounds,
      rooms: worldRooms,
      doors: worldDoors,
      entrances: result.entrances,
      wallThickness: this.defaultWallThickness,
      cameraMode: "chunk",
      interiorConfig: {
        fogAlpha: 0.92,
        hideOutside: true,
        label: lotConfig.label,
      },
    };
  }

  /**
   * コンパクトなレイアウト生成（廊下なし、長方形）
   */
  generateCompactLayout(gridW, gridH, houseSize, houseId, approachDir) {
    const rooms = [];
    const doors = [];
    const entrances = [];
    const grid = Array(gridH)
      .fill()
      .map(() => Array(gridW).fill(null));

    console.log(`[Layout] Starting compact layout for ${houseSize} house`);

    // 家の全体サイズを決定（長方形）
    // medium (赤枠ぐらい): 6x4 ~ 7x5
    // small (小屋): 4x3 ~ 5x4
    let targetW, targetH;
    if (houseSize === "medium") {
      targetW = this.rnd.between(6, 8); // 6~7
      targetH = this.rnd.between(4, 6); // 4~5
    } else {
      targetW = this.rnd.between(4, 6); // 4~5
      targetH = this.rnd.between(3, 5); // 3~4
    }

    // グリッド内に収まるように調整
    targetW = Math.min(targetW, gridW - 2);
    targetH = Math.min(targetH, gridH - 2);

    // 家の左上座標（中央寄せ）
    const startX = Math.floor((gridW - targetW) / 2);
    const startY = Math.floor((gridH - targetH) / 2);

    console.log(`[Layout] House Bounds: ${targetW}x${targetH} at (${startX}, ${startY})`);

    // 部屋の配置ロジック
    // 単純な分割または充填アルゴリズムを使用
    // ここでは「バイナリ空間分割（BSP）」風に分割していくか、
    // あるいは「主要な部屋から順に埋めていく」方式をとる

    // 1. 玄関の位置を決定（外周のどこか）
    // アプローチ方向にある辺の中央付近
    let entranceRect = { x: 0, y: 0, w: 2, h: 2 }; // 玄関は2x2固定など

    if (approachDir === "south") {
      entranceRect.x = startX + Math.floor((targetW - 2) / 2);
      entranceRect.y = startY + targetH - 2;
    } else if (approachDir === "north") {
      entranceRect.x = startX + Math.floor((targetW - 2) / 2);
      entranceRect.y = startY;
    } else if (approachDir === "east") {
      entranceRect.x = startX + targetW - 2;
      entranceRect.y = startY + Math.floor((targetH - 2) / 2);
    } else { // west
      entranceRect.x = startX;
      entranceRect.y = startY + Math.floor((targetH - 2) / 2);
    }

    const entrance = {
      id: `${houseId}_room_0`,
      type: "entrance",
      gridX: entranceRect.x,
      gridY: entranceRect.y,
      gridW: 2,
      gridH: 2
    };
    this.markGrid(grid, entrance);
    rooms.push(entrance);
    entrances.push({ roomId: entrance.id, side: approachDir, type: "main" });

    // 残りの領域を管理するためのリスト
    // シンプルに「未充填のグリッドセル」を探して部屋を置いていく

    // 必要な部屋リスト
    const requiredRooms = [];
    if (houseSize === "medium") {
      requiredRooms.push("living");
      requiredRooms.push("kitchen");
      requiredRooms.push("bedroom");
      if (this.rnd.frac() > 0.5) requiredRooms.push("bathroom");
    } else {
      // small
      requiredRooms.push("living"); // ワンルーム的な
    }

    // 部屋を配置
    for (const type of requiredRooms) {
      // 既存の部屋に隣接する空きスペースを探す
      const placed = this.placeRoomIdeally(grid, type, houseId, rooms.length, startX, startY, targetW, targetH);
      if (placed) {
        rooms.push(placed);
        // ドア接続（隣接する部屋とつなぐ）
        this.connectToNeighbors(placed, rooms, doors);
      }
    }

    // まだ空いているスペースがあれば埋める（収納や拡張）
    this.fillGaps(grid, startX, startY, targetW, targetH, houseId, rooms, doors);

    return { rooms, doors, entrances };
  }

  /**
   * 指定された範囲内で部屋を配置する
   */
  placeRoomIdeally(grid, type, houseId, index, startX, startY, targetW, targetH) {
    const config = this.roomTypes[type];
    // 試行回数
    for (let i = 0; i < 20; i++) {
      // サイズをランダムに決定（範囲内）
      // 小さめの家なので、最小サイズ寄り
      const w = this.rnd.between(Math.max(2, Math.floor(config.minCells / 3)), 5);
      const h = this.rnd.between(Math.max(2, Math.floor(config.minCells / 3)), 5);

      // 配置場所をランダムに（ただし家の範囲内）
      const x = this.rnd.between(startX, startX + targetW - w + 1);
      const y = this.rnd.between(startY, startY + targetH - h + 1);

      if (this.checkCollision(grid, x, y, w, h)) continue;

      // 既存の部屋と隣接しているかチェック（孤立を防ぐ）
      // 最初の部屋（玄関）以外は必須
      if (index > 0 && !this.checkAdjacency(grid, x, y, w, h)) continue;

      const room = {
        id: `${houseId}_room_${index}`,
        type: type,
        gridX: x,
        gridY: y,
        gridW: w,
        gridH: h
      };
      this.markGrid(grid, room);
      return room;
    }
    return null;
  }

  /**
   * 隣接チェック
   */
  checkAdjacency(grid, gx, gy, w, h) {
    // 周囲1マスを確認して、nullでない（部屋がある）マスがあればOK
    for (let x = gx; x < gx + w; x++) {
      if (gy > 0 && grid[gy - 1][x] !== null) return true; // 上
      if (gy + h < grid.length && grid[gy + h][x] !== null) return true; // 下
    }
    for (let y = gy; y < gy + h; y++) {
      if (gx > 0 && grid[y][gx - 1] !== null) return true; // 左
      if (gx + w < grid[0].length && grid[y][gx + w] !== null) return true; // 右
    }
    return false;
  }

  /**
   * 隣接する部屋とドアで接続
   */
  connectToNeighbors(room, rooms, doors) {
    // 上下左右の隣接部屋を探す
    const neighbors = [];

    // 簡易的な隣接判定：部屋リストを走査
    for (const other of rooms) {
      if (other.id === room.id) continue;

      // 接しているか判定
      const isTouching =
        (room.gridX < other.gridX + other.gridW && room.gridX + room.gridW > other.gridX &&
          (room.gridY === other.gridY + other.gridH || room.gridY + room.gridH === other.gridY)) ||
        (room.gridY < other.gridY + other.gridH && room.gridY + room.gridH > other.gridY &&
          (room.gridX === other.gridX + other.gridW || room.gridX + room.gridW === other.gridX));

      if (isTouching) {
        // 既に接続されているかチェック
        const existing = doors.find(d =>
          (d.roomA === room.id && d.roomB === other.id) ||
          (d.roomA === other.id && d.roomB === room.id)
        );
        if (!existing) {
          doors.push({ roomA: room.id, roomB: other.id, type: "interior" });
        }
      }
    }
  }

  /**
   * 隙間を埋める
   */
  fillGaps(grid, startX, startY, targetW, targetH, houseId, rooms, doors) {
    // 簡易的な実装：1x1以上の空き領域を見つけて、隣接する部屋を拡張するか、新しい部屋（収納など）にする
    // ここではシンプルに「空きマスを見つけたら、隣接する部屋を拡張する」ロジックにする

    let changed = true;
    while (changed) {
      changed = false;
      for (let y = startY; y < startY + targetH; y++) {
        for (let x = startX; x < startX + targetW; x++) {
          if (grid[y][x] === null) {
            // 空きマス
            // 上下左右の部屋を探す
            const neighborId = this.findNeighborId(grid, x, y);
            if (neighborId) {
              // その部屋を拡張（データ構造的に矩形を保つのが難しいので、
              // ここでは「新しい小さな部屋（収納）」として追加し、ドアでつなぐ）
              // あるいは、グリッド上で部屋IDを割り当てるだけにして、後で結合する？
              // 
              // 今回はシンプルに「収納(storage)」として埋める
              const room = {
                id: `${houseId}_room_${rooms.length}`,
                type: "storage",
                gridX: x,
                gridY: y,
                gridW: 1,
                gridH: 1
              };
              // 1x1だと小さすぎるので、可能なら広げる
              // 右に空きがあるか？
              if (x + 1 < startX + targetW && grid[y][x + 1] === null) room.gridW++;
              // 下に空きがあるか？
              if (y + 1 < startY + targetH && grid[y + 1][x] === null) room.gridH++;

              this.markGrid(grid, room);
              rooms.push(room);
              doors.push({ roomA: neighborId, roomB: room.id, type: "interior" });
              changed = true;
            }
          }
        }
      }
    }
  }

  findNeighborId(grid, x, y) {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
        if (grid[ny][nx] !== null) return grid[ny][nx];
      }
    }
    return null;
  }

  /**
   * 廊下中心のレイアウト生成
   */
  generateCorridorBasedLayout(gridW, gridH, houseSize, houseId, approachDir) {
    const rooms = [];
    const doors = [];
    const entrances = [];
    const grid = Array(gridH)
      .fill()
      .map(() => Array(gridW).fill(null));

    console.log(`[Layout] Starting corridor-based layout for ${houseSize} house`);

    // ステップ1: 玄関を配置
    const entrance = this.placeEntrance(grid, gridW, gridH, approachDir, houseId, 0);
    if (!entrance) {
      console.log("[Layout] Failed to place entrance");
      return null;
    }
    rooms.push(entrance);
    entrances.push({ roomId: entrance.id, side: approachDir, type: "main" });
    console.log(`[Layout] Placed entrance at grid (${entrance.gridX}, ${entrance.gridY})`);

    // ステップ2: 廊下を配置（玄関から延長）
    const corridor = this.placeCorridor(grid, gridW, gridH, entrance, houseId, rooms.length);
    if (!corridor) {
      console.log("[Layout] Failed to place corridor, creating simple layout");
      // 廊下なしでもシンプルな家は作れる
    } else {
      rooms.push(corridor);
      doors.push({ roomA: entrance.id, roomB: corridor.id, type: "interior" });
      console.log(`[Layout] Placed corridor at grid (${corridor.gridX}, ${corridor.gridY}), size ${corridor.gridW}x${corridor.gridH}`);
    }

    // ステップ3: メイン部屋を配置（リビング、ダイニング、キッチンを分離）
    const mainRooms = this.placeMainRooms(grid, gridW, gridH, houseSize, corridor || entrance, houseId, rooms, doors);
    console.log(`[Layout] Placed ${mainRooms.length} main rooms`);

    // ステップ4: 寝室を配置
    const bedrooms = this.placeBedrooms(grid, gridW, gridH, houseSize, corridor || entrance, houseId, rooms, doors);
    console.log(`[Layout] Placed ${bedrooms.length} bedrooms`);

    // ステップ5: 水回りを配置（浴室、トイレ、洗面室をグループ化）
    const waterRooms = this.placeWaterRooms(grid, gridW, gridH, houseSize, corridor || entrance, houseId, rooms, doors);
    console.log(`[Layout] Placed ${waterRooms.length} water rooms`);

    // ステップ6: 収納を配置（オプション）
    if (houseSize === "large" && rooms.length < 10) {
      const storage = this.tryPlaceRoom(grid, "storage", corridor || entrance, houseId, rooms.length, { w: 2, h: 2 });
      if (storage) {
        rooms.push(storage);
        doors.push({ roomA: (corridor || entrance).id, roomB: storage.id, type: "interior" });
        console.log(`[Layout] Placed storage`);
      }
    }

    console.log(`[Layout] Final room count: ${rooms.length}`);

    return { rooms, doors, entrances };
  }

  /**
   * 玄関を配置
   */
  placeEntrance(grid, gridW, gridH, approachDir, houseId, index) {
    const margin = 1;
    let gx, gy;
    const w = 2;
    const h = 2;

    // アプローチ方向に応じて配置
    if (approachDir === "south") {
      gx = Math.floor((gridW - w) / 2);
      gy = gridH - h - margin;
    } else if (approachDir === "north") {
      gx = Math.floor((gridW - w) / 2);
      gy = margin;
    } else if (approachDir === "east") {
      gx = gridW - w - margin;
      gy = Math.floor((gridH - h) / 2);
    } else {
      // west
      gx = margin;
      gy = Math.floor((gridH - h) / 2);
    }

    if (this.isOutOfBounds(gx, gy, w, h, gridW, gridH)) return null;
    if (this.checkCollision(grid, gx, gy, w, h)) return null;

    const room = {
      id: `${houseId}_room_${index}`,
      type: "entrance",
      gridX: gx,
      gridY: gy,
      gridW: w,
      gridH: h,
    };

    this.markGrid(grid, room);
    return room;
  }

  /**
   * 廊下を配置（玄関から延長）
   */
  placeCorridor(grid, gridW, gridH, entrance, houseId, index) {
    // 廊下は玄関からグリッドの中央に向かって延長
    let gx = entrance.gridX;
    let gy = entrance.gridY;
    let w, h;

    // 玄関の位置から廊下の方向を決定
    const centerX = Math.floor(gridW / 2);
    const centerY = Math.floor(gridH / 2);

    if (Math.abs(entrance.gridY - centerY) > Math.abs(entrance.gridX - centerX)) {
      // 縦廊下
      w = 2;
      h = Math.min(6, Math.abs(centerY - entrance.gridY) + 2);
      gx = entrance.gridX;
      gy = entrance.gridY < centerY ? entrance.gridY + entrance.gridH : entrance.gridY - h;
    } else {
      // 横廊下
      w = Math.min(6, Math.abs(centerX - entrance.gridX) + 2);
      h = 2;
      gx = entrance.gridX < centerX ? entrance.gridX + entrance.gridW : entrance.gridX - w;
      gy = entrance.gridY;
    }

    if (this.isOutOfBounds(gx, gy, w, h, gridW, gridH)) return null;
    if (this.checkCollision(grid, gx, gy, w, h)) return null;

    const room = {
      id: `${houseId}_room_${index}`,
      type: "corridor",
      gridX: gx,
      gridY: gy,
      gridW: w,
      gridH: h,
    };

    this.markGrid(grid, room);
    return room;
  }

  /**
   * メイン部屋を配置（リビング、ダイニング、キッチンを分離）
   */
  placeMainRooms(grid, gridW, gridH, houseSize, baseRoom, houseId, rooms, doors) {
    const placed = [];

    // リビング（一番大きい）
    const living = this.tryPlaceRoom(grid, "living", baseRoom, houseId, rooms.length, {
      w: houseSize === "large" ? 5 : houseSize === "medium" ? 4 : 3,
      h: houseSize === "large" ? 5 : houseSize === "medium" ? 4 : 3,
    });

    if (living) {
      rooms.push(living);
      doors.push({ roomA: baseRoom.id, roomB: living.id, type: "interior" });
      placed.push(living);
      console.log(`[MainRooms] Placed living room (${living.gridW}x${living.gridH})`);
    }

    // ダイニング（リビングの隣が理想）
    const diningBase = living || baseRoom;
    const dining = this.tryPlaceRoom(grid, "dining", diningBase, houseId, rooms.length, {
      w: houseSize === "large" ? 4 : 3,
      h: houseSize === "large" ? 3 : 3,
    });

    if (dining) {
      rooms.push(dining);
      if (living) {
        doors.push({ roomA: living.id, roomB: dining.id, type: "interior" });
      } else {
        doors.push({ roomA: baseRoom.id, roomB: dining.id, type: "interior" });
      }
      placed.push(dining);
      console.log(`[MainRooms] Placed dining room (${dining.gridW}x${dining.gridH})`);
    }

    // キッチン（ダイニングの隣が理想）
    const kitchenBase = dining || living || baseRoom;
    const kitchen = this.tryPlaceRoom(grid, "kitchen", kitchenBase, houseId, rooms.length, {
      w: houseSize === "large" ? 3 : 2,
      h: houseSize === "large" ? 4 : 3,
    });

    if (kitchen) {
      rooms.push(kitchen);
      if (dining) {
        doors.push({ roomA: dining.id, roomB: kitchen.id, type: "interior" });
      } else if (living) {
        doors.push({ roomA: living.id, roomB: kitchen.id, type: "interior" });
      } else {
        doors.push({ roomA: baseRoom.id, roomB: kitchen.id, type: "interior" });
      }
      placed.push(kitchen);
      console.log(`[MainRooms] Placed kitchen (${kitchen.gridW}x${kitchen.gridH})`);
    }

    return placed;
  }

  /**
   * 寝室を配置
   */
  placeBedrooms(grid, gridW, gridH, houseSize, baseRoom, houseId, rooms, doors) {
    const placed = [];
    let bedroomCount = houseSize === "large" ? 3 : houseSize === "medium" ? 2 : 1;

    for (let i = 0; i < bedroomCount; i++) {
      const bedroom = this.tryPlaceRoom(grid, "bedroom", baseRoom, houseId, rooms.length, {
        w: 3,
        h: 3,
      });

      if (bedroom) {
        rooms.push(bedroom);
        doors.push({ roomA: baseRoom.id, roomB: bedroom.id, type: "interior" });
        placed.push(bedroom);
        console.log(`[Bedrooms] Placed bedroom ${i + 1}`);
      } else {
        console.log(`[Bedrooms] Failed to place bedroom ${i + 1}`);
      }
    }

    return placed;
  }

  /**
   * 水回りを配置（浴室、トイレ、洗面室をグループ化）
   */
  placeWaterRooms(grid, gridW, gridH, houseSize, baseRoom, houseId, rooms, doors) {
    const placed = [];

    // 浴室
    const bathroom = this.tryPlaceRoom(grid, "bathroom", baseRoom, houseId, rooms.length, {
      w: 2,
      h: 3,
    });

    if (bathroom) {
      rooms.push(bathroom);
      doors.push({ roomA: baseRoom.id, roomB: bathroom.id, type: "interior" });
      placed.push(bathroom);
      console.log(`[WaterRooms] Placed bathroom`);

      // 浴室の隣にトイレと洗面室を配置
      if (houseSize === "medium" || houseSize === "large") {
        const toilet = this.tryPlaceRoom(grid, "toilet", bathroom, houseId, rooms.length, {
          w: 1,
          h: 2,
        });

        if (toilet) {
          rooms.push(toilet);
          doors.push({ roomA: baseRoom.id, roomB: toilet.id, type: "interior" });
          placed.push(toilet);
          console.log(`[WaterRooms] Placed toilet next to bathroom`);
        }
      }

      if (houseSize === "large") {
        const washroom = this.tryPlaceRoom(grid, "washroom", bathroom, houseId, rooms.length, {
          w: 2,
          h: 2,
        });

        if (washroom) {
          rooms.push(washroom);
          doors.push({ roomA: baseRoom.id, roomB: washroom.id, type: "interior" });
          placed.push(washroom);
          console.log(`[WaterRooms] Placed washroom next to bathroom`);
        }
      }
    } else {
      console.log(`[WaterRooms] Failed to place bathroom`);
    }

    return placed;
  }

  /**
   * 部屋を配置（汎用）
   */
  tryPlaceRoom(grid, type, baseRoom, houseId, index, preferredSize) {
    const w = preferredSize?.w || 3;
    const h = preferredSize?.h || 3;

    // 配置候補の優先順位（ランダム化）
    const directions = ["north", "south", "east", "west"];
    this.rnd.shuffle(directions);

    for (const dir of directions) {
      let gx, gy;

      if (dir === "north") {
        gx = baseRoom.gridX;
        gy = baseRoom.gridY - h;
      } else if (dir === "south") {
        gx = baseRoom.gridX;
        gy = baseRoom.gridY + baseRoom.gridH;
      } else if (dir === "east") {
        gx = baseRoom.gridX + baseRoom.gridW;
        gy = baseRoom.gridY;
      } else {
        // west
        gx = baseRoom.gridX - w;
        gy = baseRoom.gridY;
      }

      if (this.isOutOfBounds(gx, gy, w, h, grid[0].length, grid.length)) continue;
      if (this.checkCollision(grid, gx, gy, w, h)) continue;

      const room = {
        id: `${houseId}_room_${index}`,
        type: type,
        gridX: gx,
        gridY: gy,
        gridW: w,
        gridH: h,
      };

      this.markGrid(grid, room);
      return room;
    }

    return null;
  }

  /**
   * グリッド範囲外チェック
   */
  isOutOfBounds(gx, gy, w, h, gridW, gridH) {
    return gx < 1 || gy < 1 || gx + w > gridW - 1 || gy + h > gridH - 1;
  }

  /**
   * 衝突チェック
   */
  checkCollision(grid, gx, gy, w, h) {
    for (let y = gy; y < gy + h; y++) {
      for (let x = gx; x < gx + w; x++) {
        if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return true;
        if (grid[y][x] !== null) return true;
      }
    }
    return false;
  }

  /**
   * グリッドにマーク
   */
  markGrid(grid, room) {
    for (let y = room.gridY; y < room.gridY + room.gridH; y++) {
      for (let x = room.gridX; x < room.gridX + room.gridW; x++) {
        if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
          grid[y][x] = room.id;
        }
      }
    }
  }

  /**
   * グリッド座標をワールド座標に変換
   */
  convertToWorldCoords(room, lotCenterX, lotCenterY, lotWidth, lotHeight) {
    const gridTotalW = Math.floor(lotWidth / this.cellSize);
    const gridTotalH = Math.floor(lotHeight / this.cellSize);

    const lotLeft = lotCenterX - (gridTotalW * this.cellSize) / 2;
    const lotTop = lotCenterY - (gridTotalH * this.cellSize) / 2;

    const x = lotLeft + (room.gridX + room.gridW / 2) * this.cellSize;
    const y = lotTop + (room.gridY + room.gridH / 2) * this.cellSize;
    const width = room.gridW * this.cellSize;
    const height = room.gridH * this.cellSize;

    return {
      id: room.id,
      type: room.type,
      x,
      y,
      width,
      height,
      bounds: {
        x,
        y,
        width,
        height,
        left: x - width / 2,
        right: x + width / 2,
        top: y - height / 2,
        bottom: y + height / 2,
      },
    };
  }

  /**
   * ドアをワールド座標に変換
   */
  convertDoorToWorldCoords(door, rooms, lotCenterX, lotCenterY, lotWidth, lotHeight) {
    const roomA = rooms.find((r) => r.id === door.roomA);
    const roomB = rooms.find((r) => r.id === door.roomB);

    if (!roomA || !roomB) return door;

    const gridTotalW = Math.floor(lotWidth / this.cellSize);
    const gridTotalH = Math.floor(lotHeight / this.cellSize);
    const lotLeft = lotCenterX - (gridTotalW * this.cellSize) / 2;
    const lotTop = lotCenterY - (gridTotalH * this.cellSize) / 2;

    let doorX, doorY;

    // 部屋の位置関係からドアの位置を計算
    if (roomA.gridY + roomA.gridH === roomB.gridY) {
      // A の下に B
      doorX = lotLeft + (roomA.gridX + roomA.gridW / 2) * this.cellSize;
      doorY = lotTop + (roomA.gridY + roomA.gridH) * this.cellSize;
    } else if (roomB.gridY + roomB.gridH === roomA.gridY) {
      // B の下に A
      doorX = lotLeft + (roomB.gridX + roomB.gridW / 2) * this.cellSize;
      doorY = lotTop + (roomB.gridY + roomB.gridH) * this.cellSize;
    } else if (roomA.gridX + roomA.gridW === roomB.gridX) {
      // A の右に B
      doorX = lotLeft + (roomA.gridX + roomA.gridW) * this.cellSize;
      doorY = lotTop + (roomA.gridY + roomA.gridH / 2) * this.cellSize;
    } else {
      // B の右に A
      doorX = lotLeft + (roomB.gridX + roomB.gridW) * this.cellSize;
      doorY = lotTop + (roomB.gridY + roomB.gridH / 2) * this.cellSize;
    }

    return {
      ...door,
      x: doorX,
      y: doorY,
    };
  }

  /**
   * 家全体の境界を計算
   */
  calculateHouseBounds(rooms) {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    rooms.forEach((r) => {
      if (r.bounds.left < minX) minX = r.bounds.left;
      if (r.bounds.right > maxX) maxX = r.bounds.right;
      if (r.bounds.top < minY) minY = r.bounds.top;
      if (r.bounds.bottom > maxY) maxY = r.bounds.bottom;
    });

    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      width: maxX - minX,
      height: maxY - minY,
      left: minX,
      right: maxX,
      top: minY,
      bottom: maxY,
    };
  }
}

window.HouseDefinitions = HouseDefinitions;
