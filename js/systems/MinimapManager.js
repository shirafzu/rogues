class MinimapManager {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.biomeGenerator = options.biomeGenerator;
        this.worldManager = options.worldManager;

        // 設定
        this.width = options.width || 200;
        this.height = options.height || 200;
        this.zoom = options.zoom || 0.05; // 1px on minimap = 20px in world (1/0.05)
        // いや、もっと広域を見たい。
        // ワールドマップと言っているので、大陸が見えるレベル。
        // 1px = 200px in world とすると、200pxのマップで40000px (40チャンク) 四方が見える。
        // これくらいが妥当か。
        this.scale = 200; // 1px = 200 world pixels

        this.updateInterval = 1000; // ms
        this.lastUpdateTime = 0;

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

            // プレイヤーマーカー（中心）
            this.playerMarker = this.scene.add.circle(this.width / 2 + 2, this.height / 2 + 2, 3, 0xff0000);
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

            // 初回描画
            this.updateMap(0, 0, true);
        } catch (error) {
            console.error('[MinimapManager] Error creating minimap:', error);
        }
    }

    update(time, delta, playerX, playerY) {
        if (!this.container) return;

        // 座標更新
        this.coordsText.setText(`X: ${Math.round(playerX)} Y: ${Math.round(playerY)}`);

        // 定期的にマップを再描画
        if (time - this.lastUpdateTime > this.updateInterval) {
            this.updateMap(playerX, playerY);
            this.lastUpdateTime = time;
        }
    }

    updateMap(playerX, playerY, force = false) {
        if (!this.biomeGenerator || !this.context) return;

        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;

        // 描画範囲の左上座標（ワールド座標）
        const startX = playerX - halfWidth * this.scale;
        const startY = playerY - halfHeight * this.scale;

        // 解像度を落として描画負荷を下げる（例: 2x2ピクセル単位で描画）
        const pixelSize = 2;
        const cols = this.width / pixelSize;
        const rows = this.height / pixelSize;

        this.context.fillStyle = '#000000';
        this.context.fillRect(0, 0, this.width, this.height);

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                // ミニマップ上のピクセル座標
                const px = i * pixelSize;
                const py = j * pixelSize;

                // 対応するワールド座標
                const wx = startX + px * this.scale;
                const wy = startY + py * this.scale;

                // バイオーム取得
                const biome = this.biomeGenerator.getBiome(wx, wy);
                const config = this.biomeGenerator.getBiomeConfig(biome);

                // 色を設定 (Phaserの0xRRGGBBをCSSの#RRGGBBに変換)
                const colorHex = '#' + config.color.toString(16).padStart(6, '0');

                this.context.fillStyle = colorHex;
                this.context.fillRect(px, py, pixelSize, pixelSize);
            }
        }

        // テクスチャを更新
        this.canvasTexture.refresh();
    }
}

window.MinimapManager = MinimapManager;
