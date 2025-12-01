class ChunkManager {
    constructor(scene, worldManager, rnd) {
        this.scene = scene;
        this.worldManager = worldManager;
        this.rnd = rnd;

        this.chunkSize = 1000; // 1チャンクのサイズ (px)
        this.renderDistance = 1; // プレイヤー中心に周囲何チャンク読み込むか (1 = 3x3, 2 = 5x5)

        this.activeChunks = new Map(); // "x,y" -> chunkData
        this.biomeGenerator = new BiomeGenerator(0, rnd);

        // 家の生成用
        this.houseDefinitions = worldManager.houseDefinitions;

        // デバッグ表示
        this.debugGraphics = scene.add.graphics().setDepth(0);
    }

    update(playerX, playerY) {
        const currentChunkX = Math.floor(playerX / this.chunkSize);
        const currentChunkY = Math.floor(playerY / this.chunkSize);

        const keepChunks = new Set();

        // 周囲のチャンクをロード
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let y = -this.renderDistance; y <= this.renderDistance; y++) {
                const cx = currentChunkX + x;
                const cy = currentChunkY + y;
                const key = `${cx},${cy}`;

                keepChunks.add(key);

                if (!this.activeChunks.has(key)) {
                    this.loadChunk(cx, cy);
                }
            }
        }

        // 範囲外のチャンクをアンロード
        for (const [key, chunk] of this.activeChunks) {
            if (!keepChunks.has(key)) {
                this.unloadChunk(key);
            }
        }

        // デバッグ描画（オプション）
        // this.drawDebug(currentChunkX, currentChunkY);
    }

    loadChunk(cx, cy) {
        const key = `${cx},${cy}`;
        const x = cx * this.chunkSize;
        const y = cy * this.chunkSize;

        // チャンクの中心点
        const centerX = x + this.chunkSize / 2;
        const centerY = y + this.chunkSize / 2;

        // バイオーム決定（チャンクの中心で判定）
        const biome = this.biomeGenerator.getBiome(centerX, centerY);
        const config = this.biomeGenerator.getBiomeConfig(biome);

        const chunk = {
            x: cx,
            y: cy,
            worldX: x,
            worldY: y,
            biome: biome,
            objects: [], // このチャンクに属するオブジェクト
            houses: [],
        };

        // 地面タイルの生成（細かいグリッドで描画して有機的な境界を表現）
        const tileSize = 40; // 40px x 40px のタイル
        const cols = this.chunkSize / tileSize;
        const rows = this.chunkSize / tileSize;

        const graphics = this.scene.add.graphics();
        graphics.setDepth(-10);
        chunk.objects.push(graphics);

        // チャンク内の各タイルについてバイオームを判定して描画
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const tileX = x + i * tileSize;
                const tileY = y + j * tileSize;
                const tileCenterX = tileX + tileSize / 2;
                const tileCenterY = tileY + tileSize / 2;

                // タイルごとのバイオームを取得
                const tileBiome = this.biomeGenerator.getBiome(tileCenterX, tileCenterY);
                const tileConfig = this.biomeGenerator.getBiomeConfig(tileBiome);

                graphics.fillStyle(tileConfig.color, 1);
                graphics.fillRect(tileX, tileY, tileSize, tileSize);

                // デバッグ用に境界線を描く（オプション）
                // graphics.lineStyle(1, 0x000000, 0.1);
                // graphics.strokeRect(tileX, tileY, tileSize, tileSize);
            }
        }

        // オブジェクト生成（木、岩など）
        this.spawnBiomeObjects(chunk, config);

        // 家の生成（平原のみ）
        if (biome === "plains") {
            const roll = this.rnd.frac();
            const willGenerate = roll < config.residentialChance;
            console.log(`Plains chunk [${cx}, ${cy}]: roll=${roll.toFixed(3)}, threshold=${config.residentialChance}, willGenerate=${willGenerate}`);

            if (willGenerate) {
                this.spawnHouseInChunk(chunk);
            }
        }

        this.activeChunks.set(key, chunk);
        // console.log(`Loaded chunk ${key} (${biome})`);
    }

    unloadChunk(key) {
        const chunk = this.activeChunks.get(key);
        if (!chunk) return;

        // オブジェクトの削除
        chunk.objects.forEach(obj => {
            if (obj.destroy) obj.destroy();
        });

        // 家の削除
        chunk.houses.forEach(house => {
            // 家に関連するオブジェクト（壁、床、屋根など）を削除
            // HouseDefinitionsが返すhouseオブジェクトは単なるデータ構造だが、
            // WorldManager側で管理されている実体がある場合は削除が必要
            // 今回はWorldManagerのhouses配列からも削除する必要がある
            this.worldManager.removeHouse(house);
        });

        this.activeChunks.delete(key);
        // console.log(`Unloaded chunk ${key}`);
    }

    spawnBiomeObjects(chunk) {
        // ObjectDefinitionsの初期化（シングルトン的）
        if (!this.objectDefinitions) {
            this.objectDefinitions = new ObjectDefinitions();
        }

        // 密度ノイズの初期化（初回のみ）
        if (!this.densityNoise) {
            this.densityNoise = new SimplexNoise(this.rnd);
        }

        // チャンク内のグリッドポイントでスポーン判定を行う（ランダム散布ではなく、グリッドベースで密度制御）
        const gridSize = 100; // 100pxごとのグリッド
        const cols = this.chunkSize / gridSize;
        const rows = this.chunkSize / gridSize;

        for (let ix = 0; ix < cols; ix++) {
            for (let iy = 0; iy < rows; iy++) {
                const ox = chunk.worldX + ix * gridSize + this.rnd.between(0, 20);
                const oy = chunk.worldY + iy * gridSize + this.rnd.between(0, 20);

                // ノイズによる密度判定 (-1 ~ 1)
                // スケールを調整して、ある程度の広さの「森」や「平原」を作る
                const density = this.densityNoise.noise2D(ox * 0.002, oy * 0.002);

                const biome = this.biomeGenerator.getBiome(ox, oy);
                const config = this.biomeGenerator.getBiomeConfig(biome);

                // 高密度エリア (Density > 0.3) -> セットピースや高密度オブジェクト
                if (density > 0.3) {
                    // セットピースのチャンス (少し低めに)
                    if (this.rnd.frac() < 0.05) {
                        const setpieceId = this.objectDefinitions.getRandomSetpieceForBiome(biome, this.rnd);
                        this.spawnSetpiece(chunk, ox, oy, setpieceId);
                        // セットピースを置いたら周囲のスポーンをスキップする処理入れたいが、簡易的に確率で制御
                    } else if (this.rnd.frac() < config.resourceDensity * 0.8) {
                        // 通常オブジェクト（高密度）
                        const objId = this.objectDefinitions.getRandomObjectForBiome(biome, this.rnd);
                        this.spawnObject(chunk, ox, oy, objId);
                    }
                }
                // 中密度エリア (-0.2 < Density <= 0.3) -> 通常の散布
                else if (density > -0.2) {
                    if (this.rnd.frac() < config.resourceDensity * 0.3) {
                        const objId = this.objectDefinitions.getRandomObjectForBiome(biome, this.rnd);
                        this.spawnObject(chunk, ox, oy, objId);
                    }
                }
                // 低密度エリア (Density <= -0.2) -> 開けた場所（ほとんどスポーンしない）
                else {
                    if (this.rnd.frac() < 0.01) { // たまにポツンとある
                        const objId = this.objectDefinitions.getRandomObjectForBiome(biome, this.rnd);
                        this.spawnObject(chunk, ox, oy, objId);
                    }
                }

                // 敵のスポーン（密度に関わらず、しかし密度が高い場所には出にくいとか？）
                // 今回はシンプルにランダム
                if (this.rnd.frac() < config.enemyDensity * 0.02) { // グリッドベースなので確率は下げる
                    const enemyType = this.rnd.pick(config.enemyTypes);
                    if (this.scene.spawnManager) {
                        const enemy = this.scene.spawnManager.spawnEnemy(ox, oy, { enemyId: enemyType });
                        if (enemy && enemy.sprite) {
                            chunk.objects.push(enemy.sprite);
                        }
                    }
                }
            }
        }
    }

    spawnSetpiece(chunk, x, y, setpieceId) {
        const def = this.objectDefinitions.getSetpieceDefinition(setpieceId);
        if (!def) return;

        // ランダムな回転
        const rotation = this.rnd.angle();
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        def.objects.forEach(item => {
            // 回転を適用
            const rx = item.x * cos - item.y * sin;
            const ry = item.x * sin + item.y * cos;

            const finalX = x + rx;
            const finalY = y + ry;

            // 個別のオブジェクト定義を取得してスポーン
            // item.id はオブジェクトID
            const objDef = this.objectDefinitions.getDefinition(item.id);
            if (objDef) {
                // セットピース内のオブジェクトはクラスタリングしない（配置が決まっているため）
                // createSingleObjectを直接呼ぶ
                this.createSingleObject(chunk, finalX, finalY, objDef, item.id);

                // オブジェクト個別の回転（もしあれば）
                // 現状 createSingleObject は回転引数を取らないが、必要なら拡張
                // ruin_wallなどは回転させたい
                const lastObj = chunk.objects[chunk.objects.length - 1];
                if (lastObj && item.angle !== undefined) {
                    lastObj.setRotation(item.angle + rotation);
                }
            }
        });
    }

    spawnObject(chunk, x, y, objId) {
        const def = this.objectDefinitions.getDefinition(objId);
        if (!def) return;

        // Clustering Logic
        if (def.cluster) {
            const count = this.rnd.between(def.cluster.min, def.cluster.max);
            for (let i = 0; i < count; i++) {
                // Random offset within cluster radius
                const angle = this.rnd.angle();
                const dist = this.rnd.between(0, def.cluster.radius);
                const cx = x + Math.cos(angle) * dist;
                const cy = y + Math.sin(angle) * dist;

                this.createSingleObject(chunk, cx, cy, def, objId);
            }
        } else {
            this.createSingleObject(chunk, x, y, def, objId);
        }
    }

    createSingleObject(chunk, x, y, def, objId) {
        let obj;
        if (def.shape === 'circle') {
            const radius = this.rnd.between(def.radius.min, def.radius.max);
            obj = this.scene.add.circle(x, y, radius, def.color);

            // Physics
            const options = {
                isStatic: def.isStatic,
                isSensor: def.isSensor || false,
                friction: def.friction || 0.1,
                density: def.density || 0.001
            };
            this.scene.matter.add.gameObject(obj, { ...options, shape: { type: 'circle', radius: radius } });

        } else if (def.shape === 'rectangle') {
            const w = this.rnd.between(def.width.min, def.width.max);
            const h = this.rnd.between(def.height.min, def.height.max);
            obj = this.scene.add.rectangle(x, y, w, h, def.color);

            if (def.strokeColor) {
                obj.setStrokeStyle(def.strokeWidth || 2, def.strokeColor);
            }

            // Physics
            const options = {
                isStatic: def.isStatic,
                isSensor: def.isSensor || false,
                friction: def.friction || 0.1,
                density: def.density || 0.001
            };
            this.scene.matter.add.gameObject(obj, { ...options, shape: { type: 'rectangle', width: w, height: h } });
        }

        if (obj) {
            // Depth sorting based on y position for pseudo-3D effect
            // But for now, just keep layers simple. 
            // Maybe add a slight random offset to depth to prevent z-fighting if overlapping?
            // Or use y-sorting if the game supports it. 
            // Current system seems to use explicit depths (-2, -3).
            obj.setDepth(def.isSensor ? -3 : -2);

            obj.setData('kind', 'terrain');
            obj.setData('type', def.type);
            obj.setData('id', objId);
            chunk.objects.push(obj);
        }
    }

    spawnHouseInChunk(chunk) {
        // チャンクの中央付近に家を建てる
        // 家のサイズを大きくして現実的な大きさに（800-1200px = 8-12セル）
        const width = this.rnd.between(800, 1200);
        const height = this.rnd.between(800, 1200);

        const x = chunk.worldX + this.chunkSize / 2;
        const y = chunk.worldY + this.chunkSize / 2;

        const houseId = `house_${chunk.x}_${chunk.y}`;

        // HouseDefinitionsを使って家を生成
        const houseZone = this.houseDefinitions.createProceduralHouse({
            id: houseId,
            label: `House ${chunk.x},${chunk.y}`,
            x: x,
            y: y,
            width: width,
            height: height,
            approachDir: this.rnd.pick(["north", "south", "east", "west"]),
        });

        // 家の生成に失敗した場合（グリッドが小さすぎるなど）はスキップ
        if (!houseZone) {
            return;
        }

        // WorldManagerに登録して実体を生成させる
        this.worldManager.addHouse(houseZone);
        chunk.houses.push(houseZone);

        // 家が生成されたことをログに出力
        console.log(`🏠 House generated at (${Math.round(x)}, ${Math.round(y)}) in chunk [${chunk.x}, ${chunk.y}]`);
    }

    getRoomAt(x, y) {
        // アクティブなチャンク内の家から検索
        for (const chunk of this.activeChunks.values()) {
            for (const house of chunk.houses) {
                if (this.worldManager.isPointInsideRect(x, y, house.bounds)) {
                    return house.rooms.find(room => this.worldManager.isPointInsideRect(x, y, room.bounds));
                }
            }
        }
        return null;
    }

    getBiomeAt(x, y) {
        // 座標からチャンクを特定し、そのバイオームを返す
        const cx = Math.floor(x / this.chunkSize);
        const cy = Math.floor(y / this.chunkSize);
        const key = `${cx},${cy}`;

        const chunk = this.activeChunks.get(key);
        if (chunk) {
            return chunk.biome;
        }

        // チャンクがロードされていない場合は、BiomeGeneratorから直接取得
        return this.biomeGenerator.getBiome(x, y);
    }
}

window.ChunkManager = ChunkManager;
