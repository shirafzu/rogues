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
        // スポーン試行回数（チャンクサイズに応じて調整）
        const attempts = 30;

        for (let i = 0; i < attempts; i++) {
            const ox = chunk.worldX + this.rnd.between(0, this.chunkSize);
            const oy = chunk.worldY + this.rnd.between(0, this.chunkSize);

            // その位置のバイオームを取得
            const biome = this.biomeGenerator.getBiome(ox, oy);
            const config = this.biomeGenerator.getBiomeConfig(biome);

            // リソース（木など）のスポーン判定
            if (this.rnd.frac() < config.resourceDensity * 0.3) {
                // 簡易的な木（円）
                const tree = this.scene.add.circle(ox, oy, 15, 0x1b5e20);
                tree.setDepth(-2);
                this.scene.matter.add.gameObject(tree, { isStatic: true, shape: { type: 'circle', radius: 15 } });
                tree.setData('kind', 'terrain');
                chunk.objects.push(tree);
            }

            // 敵のスポーン判定
            if (this.rnd.frac() < config.enemyDensity * 0.1) {
                const enemyType = this.rnd.pick(config.enemyTypes);
                // 敵生成（簡易的な矩形）
                const enemy = this.scene.add.rectangle(ox, oy, 30, 30, 0xff0000);
                this.scene.matter.add.gameObject(enemy, { isStatic: false });
                enemy.setData('kind', 'enemy');
                enemy.setData('type', enemyType);
                chunk.objects.push(enemy);
            }
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
