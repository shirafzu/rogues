class BiomeGenerator {
    constructor(seed, rnd) {
        this.rnd = rnd;
        // 気温用ノイズ（大きなスケールで変化）
        this.tempNoise = new SimplexNoise(rnd);
        // 湿度用ノイズ（少し細かく変化）
        this.moistNoise = new SimplexNoise(() => rnd.frac()); // 別のシード状態にするため
        // 標高用ノイズ（大陸と海を分ける）
        this.elevationNoise = new SimplexNoise(() => rnd.frac());
        // 歪み用ノイズ（境界を複雑にするためのドメインワーピング用）
        this.warpNoise = new SimplexNoise(() => rnd.frac());

        // マクロスケール設定（大陸レベルの広さ）
        this.baseScale = 0.00002;

        // FBM設定
        this.octaves = 5;
        this.persistence = 0.5;
        this.lacunarity = 2.0;

        // ワーピング（歪み）の設定
        this.warpScale = 0.00005;
        this.warpStrength = 5000;

        // 球面座標設定
        this.planetRadius = 100000; // 惑星の半径（ワールド単位）
        this.maxLatitude = 85; // 度数法、±85度が最大（極地氷冠エリア）
        this.DEG_TO_RAD = Math.PI / 180;
    }

    // 座標ラッピング（球面座標変換）
    wrapCoordinates(x, y) {
        // XY座標を緯度経度に変換
        const lat = y / this.planetRadius; // 度数法
        const lon = x / this.planetRadius; // 度数法（簡易版、厳密にはcos(lat)で割る必要あるが負荷軽減のため省略）

        // 経度をラッピング（0-360度）
        const wrappedLon = ((lon % 360) + 360) % 360;

        // 緯度をクランプ（±85度）
        const clampedLat = Math.max(-this.maxLatitude, Math.min(this.maxLatitude, lat));

        // ラップ後のXY座標に変換
        const wrappedX = wrappedLon * this.planetRadius;
        const wrappedY = clampedLat * this.planetRadius;

        return { x: wrappedX, y: wrappedY, latitude: clampedLat, longitude: wrappedLon };
    }

    // FBM (Fractal Brownian Motion) ノイズ生成
    fbm(x, y, noiseGen, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
        let total = 0;
        let amplitude = 1;
        let frequency = this.baseScale;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += noiseGen.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return total / maxValue;
    }

    // リッジノイズ（山脈のような鋭い地形を作る）
    // 1 - abs(noise) の形
    ridgeNoise(x, y, noiseGen) {
        let n = this.fbm(x, y, noiseGen, 4, 0.5, 2.0);
        return 1.0 - Math.abs(n);
    }

    // 標高を取得（-1 ~ 1の範囲）
    getElevation(x, y) {
        const qx = this.warpNoise.noise2D(x * this.warpScale, y * this.warpScale);
        const qy = this.warpNoise.noise2D((x + 5200) * this.warpScale, (y + 1300) * this.warpScale);
        const destX = x + qx * this.warpStrength;
        const destY = y + qy * this.warpStrength;
        return this.fbm(destX + 20000, destY + 20000, this.elevationNoise, 5);
    }

    // 気温を取得（-1 ~ 1の範囲、標高補正なし）
    getTemperature(x, y) {
        const qx = this.warpNoise.noise2D(x * this.warpScale, y * this.warpScale);
        const qy = this.warpNoise.noise2D((x + 5200) * this.warpScale, (y + 1300) * this.warpScale);
        const destX = x + qx * this.warpStrength;
        const destY = y + qy * this.warpStrength;
        return this.fbm(destX, destY, this.tempNoise, 4);
    }

    // 湿度を取得（-1 ~ 1の範囲）
    getMoisture(x, y) {
        const qx = this.warpNoise.noise2D(x * this.warpScale, y * this.warpScale);
        const qy = this.warpNoise.noise2D((x + 5200) * this.warpScale, (y + 1300) * this.warpScale);
        const destX = x + qx * this.warpStrength;
        const destY = y + qy * this.warpStrength;
        return this.fbm(destX + 10000, destY + 10000, this.moistNoise, 4);
    }

    getBiome(x, y) {
        // 球面座標にラッピング
        const wrapped = this.wrapCoordinates(x, y);
        const wx = wrapped.x;
        const wy = wrapped.y;
        const latitude = wrapped.latitude;

        // 極地氷冠（緯度85度以上）
        if (Math.abs(latitude) > this.maxLatitude * 0.98) {
            return "ice_cap";
        }

        // ドメインワーピング：座標をノイズで大きくずらす
        const qx = this.warpNoise.noise2D(wx * this.warpScale, wy * this.warpScale);
        const qy = this.warpNoise.noise2D((wx + 5200) * this.warpScale, (wy + 1300) * this.warpScale);

        const destX = wx + qx * this.warpStrength;
        const destY = wy + qy * this.warpStrength;

        // 1. 標高（Elevation）を計算
        const elevation = this.fbm(destX + 20000, destY + 20000, this.elevationNoise, 5);

        // 2. リッジノイズ（プレート境界/山脈）
        const ridge = 1.0 - Math.abs(this.fbm(destX * 2, destY * 2, this.elevationNoise, 4));

        // 3. 気温（緯度補正あり）と湿度
        let t = this.fbm(destX, destY, this.tempNoise, 4);
        // 緯度が高いほど寒くなる（極地付近は-0.02 * 85 = -1.7の補正）
        t -= Math.abs(latitude) * 0.02;
        const m = this.fbm(destX + 10000, destY + 10000, this.moistNoise, 4);

        // --- バイオーム判定ロジック ---

        // 海（Ocean）：標高が低い場所
        // 地球の海面比率は7割だが、ゲーム的には陸地多めが良いかも
        // -0.2 以下を海とする（約40%が海になる想定）
        if (elevation < -0.2) {
            // 深海と浅瀬を分ける
            if (elevation < -0.6) return "deep_ocean";
            return "ocean";
        }

        // 海岸（Beach）：海の境界
        if (elevation < -0.15) {
            return "beach";
        }

        // 山脈（Mountain）：リッジが高い場所、かつ陸地
        // プレート衝突による隆起を表現
        if (ridge > 0.8) {
            // 火山（Volcano）：山脈の中でさらに特定の条件（例えば温度が高い）
            // またはランダムなホットスポット
            if (ridge > 0.9 && t > 0.5) return "volcano";
            if (t < -0.3) return "snow_mountain"; // 雪山
            return "mountain";
        }

        // 高地（Highland）：標高が高い場所
        if (elevation > 0.6) {
            if (t < 0) return "snow"; // 高いところは寒い
            return "mountain"; // 岩場
        }

        // 一般的な陸地バイオーム（気温と湿度で決定）
        // FBMの結果は概ね -1 ~ 1 だが、中央に寄る傾向がある

        // Temperature (t): High = Hot, Low = Cold
        // Moisture (m): High = Wet, Low = Dry

        if (t < -0.2) {
            // Cold
            if (m > 0.1) return "snow";
            return "wasteland"; // Tundra/Wasteland
        } else if (t > 0.2) {
            // Hot
            if (m < -0.1) return "desert";
            if (m > 0.4) return "jungle"; // 湿気が多いとジャングル
            return "forest";
        } else {
            // Moderate
            if (m > 0.2) return "forest";
            if (m < -0.2) return "wasteland"; // Dry plains
            return "plains";
        }
    }

    getBiomeConfig(biomeType) {
        const configs = {
            forest: {
                color: 0x2e7d32,
                resourceDensity: 0.3,
                enemyTypes: ['forest_enemy'],
                enemyDensity: 1,
                residentialChance: 0.01,
            },
            jungle: {
                color: 0x1b5e20, // 濃い緑
                resourceDensity: 0.6, // 資源豊富
                enemyTypes: ['forest_enemy'], // ジャングル用の敵がいれば変更
                enemyDensity: 1.5,
                residentialChance: 0.0,
            },
            desert: {
                color: 0xedc9af,
                resourceDensity: 0.2,
                enemyTypes: ['desert_enemy'],
                enemyDensity: 0.5,
                residentialChance: 0.005,
            },
            snow: {
                color: 0xe0f7fa,
                resourceDensity: 0.15,
                enemyTypes: ['snow_enemy'],
                enemyDensity: 0.5,
                residentialChance: 0.005,
            },
            wasteland: {
                color: 0x8b4513,
                resourceDensity: 0.25,
                enemyTypes: ['wasteland_enemy'],
                enemyDensity: 1.5,
                residentialChance: 0.0,
            },
            plains: {
                color: 0x90ee90,
                resourceDensity: 0.2,
                enemyTypes: ['plains_enemy'],
                enemyDensity: 0.8,
                residentialChance: 0.2,
            },
            // --- 新しいバイオーム ---
            ocean: {
                color: 0x2196f3, // 青
                resourceDensity: 0.0,
                enemyTypes: [],
                enemyDensity: 0,
                residentialChance: 0.0,
                isWater: true, // 水判定用
            },
            deep_ocean: {
                color: 0x0d47a1, // 濃い青
                resourceDensity: 0.0,
                enemyTypes: [],
                enemyDensity: 0,
                residentialChance: 0.0,
                isWater: true,
            },
            beach: {
                color: 0xfff59d, // 砂色
                resourceDensity: 0.1, // ヤシの木など
                enemyTypes: ['plains_enemy'], // カニとか？
                enemyDensity: 0.3,
                residentialChance: 0.0,
            },
            mountain: {
                color: 0x757575, // グレー
                resourceDensity: 0.1, // 岩
                enemyTypes: ['wasteland_enemy'],
                enemyDensity: 0.5,
                residentialChance: 0.0,
                isSolid: true, // 通行不可にする？
            },
            snow_mountain: {
                color: 0xcfcfcf, // 白っぽいグレー
                resourceDensity: 0.0,
                enemyTypes: ['snow_enemy'],
                enemyDensity: 0.5,
                residentialChance: 0.0,
            },
            volcano: {
                color: 0x3e2723, // 焦げ茶
                resourceDensity: 0.0,
                enemyTypes: ['wasteland_enemy'], // 火の敵とか
                enemyDensity: 1.0,
                residentialChance: 0.0,
                isDangerous: true, // ダメージ床？
            },
            ice_cap: {
                color: 0xffffff, // 白
                resourceDensity: 0.0,
                enemyTypes: [],
                enemyDensity: 0,
                residentialChance: 0.0,
                isImpassable: true, // 通行不可
            },
        };

        return configs[biomeType] || configs.plains;
    }
}

window.BiomeGenerator = BiomeGenerator;
