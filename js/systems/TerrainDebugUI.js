class TerrainDebugUI {
    constructor(scene, biomeGenerator) {
        this.scene = scene;
        this.biomeGenerator = biomeGenerator;
        this.isVisible = false;
        this.textureKey = 'debug_world_map';
        this.width = 800;
        this.height = 400;

        this.create();
    }

    create() {
        // コンテナ
        this.container = this.scene.add.container(this.scene.scale.width / 2, this.scene.scale.height / 2);
        this.container.setScrollFactor(0).setDepth(2000);
        this.container.setVisible(this.isVisible);

        // 背景
        const bg = this.scene.add.rectangle(0, 0, this.width + 20, this.height + 60, 0x000000, 0.8);
        this.container.add(bg);

        // タイトル
        const title = this.scene.add.text(0, -this.height / 2 - 20, "World Map Debug (Press 'M' to Toggle)", {
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.container.add(title);

        // キャンバス
        if (this.scene.textures.exists(this.textureKey)) {
            this.scene.textures.remove(this.textureKey);
        }
        this.canvasTexture = this.scene.textures.createCanvas(this.textureKey, this.width, this.height);
        this.mapImage = this.scene.add.image(0, 0, this.textureKey);
        this.container.add(this.mapImage);

        // 更新ボタン
        const refreshBtn = this.scene.add.text(0, this.height / 2 + 20, "[ Refresh Map ]", {
            fontSize: '16px',
            color: '#00ff00',
            backgroundColor: '#333333',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive();

        refreshBtn.on('pointerdown', () => this.drawWorldMap());
        this.container.add(refreshBtn);

        // キーボード入力
        this.scene.input.keyboard.on('keydown-M', () => {
            this.toggle();
        });
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.container.setVisible(this.isVisible);
        if (this.isVisible) {
            this.drawWorldMap();
        }
    }

    drawWorldMap() {
        const ctx = this.canvasTexture.getContext();
        const w = this.width;
        const h = this.height;

        // ワールド設定
        const radius = this.biomeGenerator.planetRadius;
        const worldWidth = radius * 360; // 経度 0-360
        const maxLat = this.biomeGenerator.maxLatitude;
        const worldHeight = radius * (maxLat * 2); // 緯度 -85 ~ +85

        const stepX = worldWidth / w;
        const stepY = worldHeight / h;

        // 画像データ作成
        const imgData = ctx.createImageData(w, h);
        const data = imgData.data;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                // ワールド座標に変換
                // x: 0 -> 360度
                const wx = x * stepX;
                // y: +85度 -> -85度 (画面上は上が0なので、上を北とする)
                // 画面y=0 -> 北緯85度, 画面y=h -> 南緯85度
                // worldY = (0.5 - y/h) * 2 * maxLat * radius ?
                // いや、単純に y=0 が maxLat, y=h が -maxLat
                const lat = maxLat - (y / h) * (maxLat * 2);
                const wy = lat * radius;

                const biome = this.biomeGenerator.getBiome(wx, wy);
                const config = this.biomeGenerator.getBiomeConfig(biome);

                const index = (y * w + x) * 4;
                const color = config.color;

                data[index] = (color >> 16) & 0xFF;     // R
                data[index + 1] = (color >> 8) & 0xFF;  // G
                data[index + 2] = color & 0xFF;         // B
                data[index + 3] = 255;                  // Alpha
            }
        }

        ctx.putImageData(imgData, 0, 0);
        this.canvasTexture.refresh();
        console.log("World map updated");
    }
}

window.TerrainDebugUI = TerrainDebugUI;
