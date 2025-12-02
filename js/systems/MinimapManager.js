class MinimapManager {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.biomeGenerator = options.biomeGenerator;
        this.hotspotGenerator = options.hotspotGenerator;
        this.worldManager = options.worldManager;

        // 設定
        this.width = options.width || 200;
        this.height = options.height || 200;

        // ワールド寸法
        if (this.hotspotGenerator) {
            this.worldWidth = this.hotspotGenerator.worldWidth;
            this.worldHeight = this.hotspotGenerator.worldHeight;
        } else {
            const planetRadius = this.biomeGenerator?.planetRadius || 100000;
            this.worldWidth = planetRadius * 360;
            this.worldHeight = planetRadius * 170;
        }

        this.scaleX = this.worldWidth / this.width;
        this.scaleY = this.worldHeight / this.height;
        this.scale = Math.max(this.scaleX, this.scaleY);

        console.log(`[MinimapManager] World: ${this.worldWidth} x ${this.worldHeight}, Scale: ${this.scale}`);

        this.updateInterval = 1000; // ms
        this.lastUpdateTime = 0;
        this.mapDrawn = false; // マップが描画済みかどうか

        this.container = null;
        this.mapImage = null;
        this.playerMarker = null;
        this.canvas = null;
        this.context = null;
        this.textureKey = 'minimap_texture';
    }

    create() {
        try {
            // コンテナ（右下）
            const margin = 20;
            const x = this.scene.scale.width - this.width - margin;
            const y = this.scene.scale.height - this.height - margin;

            this.container = this.scene.add.container(x, y).setScrollFactor(0).setDepth(1000);

            // 背景（枠）
            const bg = this.scene.add.rectangle(0, 0, this.width + 4, this.height + 4, 0x000000);
            bg.setOrigin(0, 0);
            this.container.add(bg);

            // キャンバスとテクスチャの作成
            if (this.scene.textures.exists(this.textureKey)) {
                this.scene.textures.remove(this.textureKey);
            }
            this.canvasTexture = this.scene.textures.createCanvas(this.textureKey, this.width, this.height);
            this.canvas = this.canvasTexture.getSourceImage();
            this.context = this.canvas.getContext('2d');

            // マップ画像
            this.mapImage = this.scene.add.image(2, 2, this.textureKey).setOrigin(0, 0);
            this.container.add(this.mapImage);

            // プレイヤーマーカー（動的に配置）
            this.playerMarker = this.scene.add.circle(this.width / 2 + 2, this.height / 2 + 2, 2, 0xff0000);
            this.container.add(this.playerMarker);

            // 座標テキスト
            this.coordsText = this.scene.add.text(2, -20, "X: 0 Y: 0", {
                fontFamily: "monospace",
                fontSize: "12px",
                color: "#ffffff",
                backgroundColor: "#000000"
            });
            this.container.add(this.coordsText);

            // リサイズ対応
            this.scene.scale.on('resize', (gameSize) => {
                const newX = gameSize.width - this.width - margin;
                const newY = gameSize.height - this.height - margin;
                this.container.setPosition(newX, newY);
            });

            // 初回描画（ワールド全体）
            this.updateMap(0, 0, true);
        } catch (error) {
            console.error('[MinimapManager] Error creating minimap:', error);
        }
    }

    update(time, delta, playerX, playerY) {
        if (!this.container) return;

        // 座標更新
        this.coordsText.setText(`X: ${Math.round(playerX)} Y: ${Math.round(playerY)} `);

        const worldWidth = this.worldWidth;
        const worldHeight = this.worldHeight;

        let mapX = 0;
        let mapY = 0;
        if (this.hotspotGenerator) {
            const normalizedX = Phaser.Math.Clamp((playerX + worldWidth / 2) / worldWidth, 0, 1);
            const normalizedY = Phaser.Math.Clamp((playerY + worldHeight / 2) / worldHeight, 0, 1);
            mapX = normalizedX * this.width + 2;
            mapY = normalizedY * this.height + 2;
        } else {
            // プレイヤー座標をワールド座標系に正規化（球面前提）
            const planetRadius = this.biomeGenerator?.planetRadius || 100000;
            let normalizedX = playerX % worldWidth;
            if (normalizedX < 0) normalizedX += worldWidth;

            const maxLat = 85;
            const normalizedY = Math.max(-maxLat * planetRadius, Math.min(maxLat * planetRadius, playerY));

            mapX = (normalizedX / worldWidth) * this.width + 2;
            mapY = ((normalizedY + maxLat * planetRadius) / worldHeight) * this.height + 2;
        }

        this.playerMarker.setPosition(mapX, mapY);

        // 静的マップは一度だけ描画（ホットスポットマップは変化しない）
        if (!this.mapDrawn) {
            this.updateMap(playerX, playerY, true);
        }
    }

    updateMap(playerX, playerY, force = false) {
        if (!this.context) return;

        if (this.hotspotGenerator) {
            this.drawHotspotMap();
            this.canvasTexture.refresh();
            this.mapDrawn = true;
            return;
        }

        if (!this.biomeGenerator) return;

        const planetRadius = this.biomeGenerator.planetRadius;
        const worldWidth = planetRadius * 360;
        const worldHeight = planetRadius * 170; // ±85度
        const maxLat = 85;

        const startX = 0;
        const startY = -maxLat * planetRadius; // 北緯85度から開始

        const pixelSize = 2;
        const cols = this.width / pixelSize;
        const rows = this.height / pixelSize;

        this.context.fillStyle = '#000000';
        this.context.fillRect(0, 0, this.width, this.height);

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const px = i * pixelSize;
                const py = j * pixelSize;

                const wx = startX + px * this.scale;
                const wy = startY + py * this.scale;

                const biome = this.biomeGenerator.getBiome(wx, wy);
                const config = this.biomeGenerator.getBiomeConfig(biome);

                const colorHex = '#' + config.color.toString(16).padStart(6, '0');

                this.context.fillStyle = colorHex;
                this.context.fillRect(px, py, pixelSize, pixelSize);
            }
        }

        this.canvasTexture.refresh();
        this.mapDrawn = true;
    }

    drawHotspotMap() {
        const gen = this.hotspotGenerator;
        if (!gen) return;

        const pixelSize = 2;
        const cols = this.width / pixelSize;
        const rows = this.height / pixelSize;
        const startX = -gen.worldWidth / 2;
        const startY = -gen.worldHeight / 2;
        const stepX = gen.worldWidth / cols;
        const stepY = gen.worldHeight / rows;

        this.context.fillStyle = '#000000';
        this.context.fillRect(0, 0, this.width, this.height);

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const px = i * pixelSize;
                const py = j * pixelSize;
                const wx = startX + (i + 0.5) * stepX;
                const wy = startY + (j + 0.5) * stepY;
                const danger = gen.getDangerValue(wx, wy);
                const height = gen.getStampedHeight(wx, wy);
                const color = this.hotspotColorToCss(danger, height);

                this.context.fillStyle = color;
                this.context.fillRect(px, py, pixelSize, pixelSize);
            }
        }
    }

    hotspotColorToCss(danger, height) {
        const safe = { r: 76, g: 175, b: 80 };
        const mid = { r: 196, g: 155, b: 102 };
        const dangerC = { r: 142, g: 36, b: 36 };
        const water = { r: 30, g: 136, b: 229 };

        let rgb = safe;
        if (height < -0.35) {
            rgb = water;
        } else if (danger < 0.4) {
            const t = danger / 0.4;
            rgb = {
                r: safe.r + (mid.r - safe.r) * t,
                g: safe.g + (mid.g - safe.g) * t,
                b: safe.b + (mid.b - safe.b) * t
            };
        } else {
            const t = (danger - 0.4) / 0.6;
            rgb = {
                r: mid.r + (dangerC.r - mid.r) * t,
                g: mid.g + (dangerC.g - mid.g) * t,
                b: mid.b + (dangerC.b - mid.b) * t
            };
        }

        return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
    }
}

window.MinimapManager = MinimapManager;
