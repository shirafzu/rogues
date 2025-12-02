class ChunkManager {
    constructor(scene, worldManager, rnd, options = {}) {
        this.scene = scene;
        this.worldManager = worldManager;
        this.rnd = rnd;

        this.chunkSize = 1000; // 1チャンクのサイズ (px)
        this.renderDistance = 1; // プレイヤー中心に周囲何チャンク読み込むか (1 = 3x3, 2 = 5x5)

        this.activeChunks = new Map(); // "x,y" -> chunkData
        this.biomeGenerator = new BiomeGenerator(0, rnd);
        this.prefabLibrary = new PrefabLibrary();

        // ホットスポット型マップ生成
        this.mapGenerationMode = options.mapGenerationMode || 'biome';
        this.hotspotSeed = options.hotspotSeed || null;
        this.hotspotGenerator = null;
        this.mapMutators = null;
        if (this.mapGenerationMode === 'hotspot') {
            const seed = this.hotspotSeed || (window.HotspotMapGenerator && HotspotMapGenerator.buildWeeklySeed());
            this.hotspotGenerator = new HotspotMapGenerator({
                seed,
                rnd: new Phaser.Math.RandomDataGenerator([seed]),
                worldWidth: this.chunkSize * 140,
                worldHeight: this.chunkSize * 140,
            });
            this.mapMutators = this.hotspotGenerator.mutators;
            console.log(`[ChunkManager] Hotspot map enabled. Seed=${seed}`);
        }

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
        if (this.mapGenerationMode === 'hotspot' && this.hotspotGenerator) {
            return this.loadChunkHotspot(cx, cy);
        }

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

    loadChunkHotspot(cx, cy) {
        const key = `${cx},${cy}`;
        const x = cx * this.chunkSize;
        const y = cy * this.chunkSize;
        const chunkRng = this.hotspotGenerator.getChunkRng(cx, cy, 'chunk');

        const chunk = {
            x: cx,
            y: cy,
            worldX: x,
            worldY: y,
            biome: 'hotspot',
            objects: [],
            houses: [],
            mutators: this.mapMutators,
        };

        const tileSize = 40;
        const cols = this.chunkSize / tileSize;
        const rows = this.chunkSize / tileSize;

        const graphics = this.scene.add.graphics();
        graphics.setDepth(-10);
        chunk.objects.push(graphics);

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const tileX = x + i * tileSize;
                const tileY = y + j * tileSize;
                const tileCenterX = tileX + tileSize / 2;
                const tileCenterY = tileY + tileSize / 2;

                const danger = this.hotspotGenerator.getDangerValue(tileCenterX, tileCenterY);
                const height = this.hotspotGenerator.getStampedHeight(tileCenterX, tileCenterY);
                const color = this.getHotspotTileColor(danger, height);

                graphics.fillStyle(color, 1);
                graphics.fillRect(tileX, tileY, tileSize, tileSize);
            }
        }

        // パスの簡易描画（安全ルートの可視化）
        graphics.lineStyle(8, 0x2e7d32, 0.5);
        for (const path of this.hotspotGenerator.paths) {
            graphics.beginPath();
            let started = false;
            for (const point of path.points) {
                if (point.x < x - tileSize || point.x > x + this.chunkSize + tileSize ||
                    point.y < y - tileSize || point.y > y + this.chunkSize + tileSize) {
                    continue;
                }
                if (!started) {
                    graphics.moveTo(point.x, point.y);
                    started = true;
                } else {
                    graphics.lineTo(point.x, point.y);
                }
            }
            if (started) graphics.strokePath();
        }

        // 川の描画
        this.drawRivers(graphics, x, y);

        // POIプレハブ
        this.spawnPrefabPOIs(chunk);
        // 危険度帯プレハブ
        this.spawnDangerBandPrefab(chunk, chunkRng);
        this.spawnHotspotContent(chunk, chunkRng);

        this.activeChunks.set(key, chunk);
    }

    drawRivers(graphics, chunkX, chunkY) {
        if (!this.hotspotGenerator?.rivers?.length) return;
        const margin = 200;
        graphics.lineStyle(0, 0, 0);
        graphics.fillStyle(0x2196f3, 0.7);

        for (const river of this.hotspotGenerator.rivers) {
            const w = river.width;
            for (let i = 0; i < river.points.length - 1; i++) {
                const a = river.points[i];
                const b = river.points[i + 1];
                if (Math.max(a.x, b.x) < chunkX - margin || Math.min(a.x, b.x) > chunkX + this.chunkSize + margin ||
                    Math.max(a.y, b.y) < chunkY - margin || Math.min(a.y, b.y) > chunkY + this.chunkSize + margin) {
                    continue;
                }
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.hypot(dx, dy) || 1;
                const nx = -dy / len;
                const ny = dx / len;
                const hw = w / 2;
                const p1 = { x: a.x + nx * hw, y: a.y + ny * hw };
                const p2 = { x: a.x - nx * hw, y: a.y - ny * hw };
                const p3 = { x: b.x + nx * hw, y: b.y + ny * hw };
                const p4 = { x: b.x - nx * hw, y: b.y - ny * hw };

                graphics.beginPath();
                graphics.moveTo(p1.x, p1.y);
                graphics.lineTo(p3.x, p3.y);
                graphics.lineTo(p4.x, p4.y);
                graphics.lineTo(p2.x, p2.y);
                graphics.closePath();
                graphics.fillPath();
            }
        }
    }

    getHotspotTileColor(danger, height) {
        // 水域優先
        if (height < -0.35) {
            return 0x1e88e5;
        }

        const safeColor = 0x4caf50;     // 緑
        const midColor = 0xc49b66;      // 砂地
        const dangerColor = 0x8e2424;   // 危険地帯

        let color;
        if (danger < 0.4) {
            color = this.lerpColor(safeColor, midColor, danger / 0.4);
        } else {
            color = this.lerpColor(midColor, dangerColor, (danger - 0.4) / 0.6);
        }

        // 天候の霧表現
        if (this.mapMutators?.weather?.fog) {
            const fog = this.mapMutators.weather.fog;
            const fogTint = 0xdedede;
            color = this.lerpColor(color, fogTint, fog);
        }

        return color;
    }

    spawnHotspotContent(chunk, rng) {
        const generator = this.hotspotGenerator;
        const gridSize = 200;
        const spawnPadding = 80;

        if (!this.objectDefinitions) {
            this.objectDefinitions = new ObjectDefinitions();
        }

        for (let ix = spawnPadding; ix < this.chunkSize - spawnPadding; ix += gridSize) {
            for (let iy = spawnPadding; iy < this.chunkSize - spawnPadding; iy += gridSize) {
                const ox = chunk.worldX + ix + rng.between(-40, 40);
                const oy = chunk.worldY + iy + rng.between(-40, 40);

                const danger = generator.getDangerValue(ox, oy);
                const height = generator.getStampedHeight(ox, oy);

                if (height < -0.35) continue; // 水没エリア

                // 視界遮蔽（L字/コの字）配置
                const nearPath = generator.getDistanceToPaths(ox, oy);
                if (danger > 0.55 && (nearPath === null || nearPath > generator.pathCorridorWidth + 120)) {
                    if (rng.frac() < 0.08) {
                        this.spawnMicroLayout(chunk, ox, oy, danger, rng);
                    }
                }

                // 危険度帯プレハブ（軽めのランドマーク）
                if (rng.frac() < 0.01) {
                    const prefab = this.prefabLibrary.getPrefabForDangerBand(danger, rng);
                    if (prefab) {
                        this.spawnPrefab(chunk, ox, oy, prefab, rng);
                    }
                }

                // 環境オブジェクト
                const variant = generator.getEnvironmentVariant(danger);
                const vegChance = this.getVegetationChance(variant, danger);
                if (rng.frac() < vegChance) {
                    const objId = this.pickObjectForVariant(variant, rng);
                    this.spawnObject(chunk, ox, oy, objId, rng);
                }

                // 敵スポーン
                const tier = generator.getEnemyTier(danger);
                const baseChance = tier === 'elite' ? 0.035 : tier === 'patrol' ? 0.02 : 0.008;
                if (rng.frac() < baseChance) {
                    this.spawnHotspotEnemy(chunk, ox, oy, tier, rng);
                }
            }
        }
    }

    spawnPrefabPOIs(chunk) {
        if (!this.hotspotGenerator || !this.prefabLibrary) return;
        const x0 = chunk.worldX;
        const y0 = chunk.worldY;
        const x1 = x0 + this.chunkSize;
        const y1 = y0 + this.chunkSize;

        for (const poi of this.hotspotGenerator.pois) {
            if (poi.x < x0 || poi.x >= x1 || poi.y < y0 || poi.y >= y1) continue;
            const prefab = this.prefabLibrary.getPrefabForPoi(poi.role);
            if (!prefab) continue;
            const rng = this.hotspotGenerator.createScopedRng(`poi_${poi.id}`);
            this.spawnPrefab(chunk, poi.x, poi.y, prefab, rng);
        }
    }

    spawnDangerBandPrefab(chunk, rng) {
        if (!this.prefabLibrary) return;
        if (rng.frac() > 0.35) return; // 軽い頻度で

        const cx = chunk.worldX + this.chunkSize / 2 + rng.between(-150, 150);
        const cy = chunk.worldY + this.chunkSize / 2 + rng.between(-150, 150);
        const danger = this.hotspotGenerator.getDangerValue(cx, cy);
        const prefab = this.prefabLibrary.getPrefabForDangerBand(danger, rng);
        if (!prefab) return;

        this.spawnPrefab(chunk, cx, cy, prefab, rng);
    }

    spawnPrefab(chunk, baseX, baseY, prefab, rng) {
        if (!this.objectDefinitions) {
            this.objectDefinitions = new ObjectDefinitions();
        }
        const rotation = prefab.rotateRandom ? rng.angle() : 0;

        prefab.objects.forEach(obj => {
            if (!obj.required) {
                const chance = obj.chance ?? 0.7;
                if (rng.frac() > chance) return;
            }

            const jitter = obj.jitter || 0;
            const jx = jitter ? rng.realInRange(-jitter, jitter) : 0;
            const jy = jitter ? rng.realInRange(-jitter, jitter) : 0;

            const localX = obj.x + jx;
            const localY = obj.y + jy;
            const rotated = Phaser.Math.RotateAround({ x: localX, y: localY }, 0, 0, rotation);
            const finalX = baseX + rotated.x;
            const finalY = baseY + rotated.y;

            const def = this.objectDefinitions.getDefinition(obj.id);
            if (!def) return;
            this.createSingleObject(chunk, finalX, finalY, def, obj.id, rng, obj.angle !== undefined ? obj.angle + rotation : rotation);
        });
    }

    getVegetationChance(variant, danger) {
        if (variant === 'lush') return 0.35;
        if (variant === 'wilted') return 0.22 + danger * 0.05;
        return 0.12 + danger * 0.08; // blighted
    }

    pickObjectForVariant(variant, rng) {
        const pools = {
            lush: ['tree_pine', 'bush', 'rock_mossy'],
            wilted: ['tree_dead', 'rock_mossy', 'ruin_pillar'],
            blighted: ['rock_boulder', 'ruin_wall', 'ruin_pillar']
        };
        const list = pools[variant] || pools.lush;
        const idx = rng.between(0, list.length - 1);
        return list[idx];
    }

    spawnMicroLayout(chunk, x, y, danger, rng) {
        const layout = rng.frac() < 0.5 ? 'L' : 'U';
        const angle = rng.realInRange(0, Math.PI * 2);
        const longSide = rng.between(160, 260);
        const shortSide = rng.between(100, 160);
        const thickness = rng.between(18, 28);
        const color = danger > 0.8 ? 0x4e342e : 0x5d4037;

        const pieces = [];
        if (layout === 'L') {
            pieces.push({ dx: longSide / 2, dy: 0, w: longSide, h: thickness });
            pieces.push({ dx: 0, dy: shortSide / 2, w: thickness, h: shortSide });
        } else {
            pieces.push({ dx: -longSide / 2 + thickness / 2, dy: 0, w: thickness, h: shortSide });
            pieces.push({ dx: longSide / 2 - thickness / 2, dy: 0, w: thickness, h: shortSide });
            pieces.push({ dx: 0, dy: shortSide / 2, w: longSide, h: thickness });
        }

        for (const piece of pieces) {
            const rotated = Phaser.Math.RotateAround({ x: piece.dx, y: piece.dy }, 0, 0, angle);
            const px = x + rotated.x;
            const py = y + rotated.y;

            const obj = this.scene.add.rectangle(px, py, piece.w, piece.h, color);
            this.scene.matter.add.gameObject(obj, {
                isStatic: true,
                shape: { type: 'rectangle', width: piece.w, height: piece.h }
            });

            obj.setDepth(-2);
            obj.setRotation(angle);
            obj.setData('kind', 'cover');
            obj.setData('type', 'micro_layout');
            chunk.objects.push(obj);
        }
    }

    spawnHotspotEnemy(chunk, x, y, tier, rng) {
        if (!this.scene.spawnManager) return;

        const bias = this.mapMutators?.spawnBias;
        const biasedEnemy = bias ? bias.enemyId : null;

        let enemyId = 'default';
        let hp = 3;
        let speed = 2.0;
        if (tier === 'elite') {
            enemyId = biasedEnemy || 'dog_beastkin';
            hp = 9;
            speed = 2.6;
        } else if (tier === 'patrol') {
            enemyId = rng.frac() < 0.5 ? 'dog_beastkin' : 'rabbit_beastkin';
            hp = 5;
            speed = 2.2;
        } else {
            enemyId = 'rabbit_beastkin';
            hp = 3;
            speed = 2.1;
        }

        // バイアス適用
        if (bias && rng.frac() < (bias.weight - 1) * 0.4) {
            enemyId = bias.enemyId;
        }

        const enemy = this.scene.spawnManager.spawnEnemy(x, y, {
            enemyId,
            maxHp: hp,
            moveSpeed: speed,
        });
        if (enemy && enemy.sprite) {
            chunk.objects.push(enemy.sprite);
        }
    }

    lerpColor(c1, c2, t) {
        const r1 = (c1 >> 16) & 0xff;
        const g1 = (c1 >> 8) & 0xff;
        const b1 = c1 & 0xff;
        const r2 = (c2 >> 16) & 0xff;
        const g2 = (c2 >> 8) & 0xff;
        const b2 = c2 & 0xff;

        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);

        return (r << 16) | (g << 8) | b;
    }

    unloadChunk(key) {
        const chunk = this.activeChunks.get(key);
        if (!chunk) return;

        // オブジェクトの削除または移行
        chunk.objects.forEach(obj => {
            // 敵キャラクター（動的エンティティ）の場合、現在の位置を確認
            if (obj.getData('kind') === 'enemy' && obj.active) {
                const currentCx = Math.floor(obj.x / this.chunkSize);
                const currentCy = Math.floor(obj.y / this.chunkSize);
                const newKey = `${currentCx},${currentCy}`;

                // 新しいチャンクがアクティブなら、そちらに移行
                if (this.activeChunks.has(newKey)) {
                    const newChunk = this.activeChunks.get(newKey);
                    if (newChunk !== chunk) {
                        newChunk.objects.push(obj);
                        // console.log(`[ChunkManager] Migrated enemy from ${key} to ${newKey}`);
                        return; // 削除しない
                    }
                } else {
                    // console.log(`[ChunkManager] Enemy at ${obj.x},${obj.y} (Chunk ${newKey}) is in inactive chunk. Destroying.`);
                }
            }

            if (obj.destroy) {
                // console.log(`[ChunkManager] Destroying object in ${key}`);
                // If it's an enemy with a controller, destroy the controller first
                // This ensures AIController.destroy() is called to clean up debugGraphics
                // CharacterController.destroy() will also destroy the sprite, so we skip obj.destroy()
                const controller = obj.getData && obj.getData('controller');
                if (controller && typeof controller.destroy === 'function') {
                    controller.destroy();
                } else {
                    obj.destroy();
                }
            }
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

    spawnSetpiece(chunk, x, y, setpieceId, rng = this.rnd) {
        const def = this.objectDefinitions.getSetpieceDefinition(setpieceId);
        if (!def) return;

        // ランダムな回転
        const rotation = rng.angle();
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
                this.createSingleObject(chunk, finalX, finalY, objDef, item.id, rng);

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

    spawnObject(chunk, x, y, objId, rng = this.rnd) {
        const def = this.objectDefinitions.getDefinition(objId);
        if (!def) return;

        // Clustering Logic
        if (def.cluster) {
            const count = rng.between(def.cluster.min, def.cluster.max);
            for (let i = 0; i < count; i++) {
                // Random offset within cluster radius
                const angle = rng.angle();
                const dist = rng.between(0, def.cluster.radius);
                const cx = x + Math.cos(angle) * dist;
                const cy = y + Math.sin(angle) * dist;

                this.createSingleObject(chunk, cx, cy, def, objId, rng);
            }
        } else {
            this.createSingleObject(chunk, x, y, def, objId, rng);
        }
    }

    createSingleObject(chunk, x, y, def, objId, rng = this.rnd, rotation = null) {
        let obj;
        if (def.shape === 'circle') {
            const radius = rng.between(def.radius.min, def.radius.max);

            const options = {
                isStatic: def.isStatic,
                isSensor: def.isSensor || false,
                friction: def.friction || 0.1,
                density: def.density || 0.001
            };

            if (def.textureKey && this.scene.textures.exists(def.textureKey)) {
                obj = this.scene.add.image(x, y, def.textureKey);
                obj.setDisplaySize(radius * 2, radius * 2);
                this.scene.matter.add.gameObject(obj, { ...options, shape: { type: 'circle', radius: radius } });
            } else {
                obj = this.scene.add.circle(x, y, radius, def.color);
                this.scene.matter.add.gameObject(obj, { ...options, shape: { type: 'circle', radius: radius } });
            }

        } else if (def.shape === 'rectangle') {
            const w = rng.between(def.width.min, def.width.max);
            const h = rng.between(def.height.min, def.height.max);

            const options = {
                isStatic: def.isStatic,
                isSensor: def.isSensor || false,
                friction: def.friction || 0.1,
                density: def.density || 0.001
            };

            if (def.textureKey && this.scene.textures.exists(def.textureKey)) {
                obj = this.scene.add.image(x, y, def.textureKey);
                obj.setDisplaySize(w, h);
                this.scene.matter.add.gameObject(obj, { ...options, shape: { type: 'rectangle', width: w, height: h } });
            } else {
                obj = this.scene.add.rectangle(x, y, w, h, def.color);
                if (def.strokeColor) {
                    obj.setStrokeStyle(def.strokeWidth || 2, def.strokeColor);
                }
                this.scene.matter.add.gameObject(obj, { ...options, shape: { type: 'rectangle', width: w, height: h } });
            }
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
            if (rotation !== null && obj.setRotation) {
                obj.setRotation(rotation);
            }
            chunk.objects.push(obj);
            return obj;
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

    getWaterFlowInfo(x, y) {
        if (this.mapGenerationMode === 'hotspot' && this.hotspotGenerator) {
            return this.hotspotGenerator.getRiverFlowInfo(x, y);
        }
        return { inWater: false, flow: { x: 0, y: 0 }, speed: 0, speedMultiplier: 1, terrain: 'land' };
    }

    getTerrainInfo(x, y) {
        if (this.mapGenerationMode === 'hotspot' && this.hotspotGenerator) {
            const flow = this.hotspotGenerator.getRiverFlowInfo(x, y);
            const tag = this.hotspotGenerator.getTerrainTag(x, y);
            return { terrain: tag, ...flow };
        }
        const biome = this.getBiomeAt(x, y);
        return { terrain: biome || 'land', inWater: false, flow: { x: 0, y: 0 }, speed: 0, speedMultiplier: 1 };
    }
}

window.ChunkManager = ChunkManager;
