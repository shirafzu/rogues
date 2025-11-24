class BiomeGenerator {
    constructor(seed, rnd) {
        this.rnd = rnd;
        // 気温用ノイズ（大きなスケールで変化）
        this.tempNoise = new SimplexNoise(rnd);
        // 湿度用ノイズ（少し細かく変化）
        this.moistNoise = new SimplexNoise(() => rnd.frac()); // 別のシード状態にするため
        // 歪み用ノイズ（境界を複雑にするためのドメインワーピング用）
        this.warpNoise = new SimplexNoise(() => rnd.frac());

        // マクロスケール設定（大陸レベルの広さ）
        // 0.00015 -> 0.00002 (約7.5倍拡大)
        // 1チャンク(1000px) = ノイズ空間で 0.02 の移動
        // ノイズの周期が ~2.0 とすると、約100チャンク(100,000px)で1周期
        this.baseScale = 0.00002;

        // FBM設定
        this.octaves = 4;
        this.persistence = 0.5;
        this.lacunarity = 2.0;

        // ワーピング（歪み）の設定
        // 大陸の形を歪ませるため、スケールも大きく、強度も非常に強くする
        this.warpScale = 0.00005;
        this.warpStrength = 5000; // 5チャンク分の歪み
    }

    // FBM (Fractal Brownian Motion) ノイズ生成
    fbm(x, y, noiseGen) {
        let total = 0;
        let amplitude = 1;
        let frequency = this.baseScale;
        let maxValue = 0;

        for (let i = 0; i < this.octaves; i++) {
            total += noiseGen.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= this.persistence;
            frequency *= this.lacunarity;
        }

        return total / maxValue;
    }

    getBiome(x, y) {
        // ドメインワーピング：座標をノイズで大きくずらす
        const qx = this.warpNoise.noise2D(x * this.warpScale, y * this.warpScale);
        const qy = this.warpNoise.noise2D((x + 5200) * this.warpScale, (y + 1300) * this.warpScale);

        const destX = x + qx * this.warpStrength;
        const destY = y + qy * this.warpStrength;

        // FBMを使って気温と湿度を計算
        const t = this.fbm(destX, destY, this.tempNoise);
        const m = this.fbm(destX + 10000, destY + 10000, this.moistNoise);

        // バイオーム判定（しきい値はFBMの出力分布に合わせて調整）
        // FBMの結果は概ね -1 ~ 1 だが、中央に寄る傾向がある

        // Temperature (t): High = Hot, Low = Cold
        // Moisture (m): High = Wet, Low = Dry

        if (t < -0.2) {
            // Cold
            if (m > 0.1) return "snow"; // Cold & Wet
            return "wasteland"; // Cold & Dry
        } else if (t > 0.2) {
            // Hot
            if (m < -0.1) return "desert"; // Hot & Dry
            return "forest"; // Hot & Wet
        } else {
            // Moderate
            if (m > 0.2) return "forest";
            if (m < -0.2) return "wasteland";
            return "plains";
        }
    }

    getBiomeConfig(biomeType) {
        const configs = {
            forest: {
                color: 0x2e7d32,
                resourceDensity: 0.3, // 削減: 0.8 -> 0.3
                enemyTypes: ['forest_enemy'],
                enemyDensity: 1, // 削減: 5 -> 1
                residentialChance: 0.01,
            },
            desert: {
                color: 0xedc9af,
                resourceDensity: 0.2, // 削減: 0.4 -> 0.2
                enemyTypes: ['desert_enemy'],
                enemyDensity: 0.5, // 削減: 3 -> 0.5
                residentialChance: 0.005,
            },
            snow: {
                color: 0xe0f7fa,
                resourceDensity: 0.15, // 削減: 0.3 -> 0.15
                enemyTypes: ['snow_enemy'],
                enemyDensity: 0.5, // 削減: 2 -> 0.5
                residentialChance: 0.005,
            },
            wasteland: {
                color: 0x8b4513,
                resourceDensity: 0.25, // 削減: 0.5 -> 0.25
                enemyTypes: ['wasteland_enemy'],
                enemyDensity: 1.5, // 削減: 4 -> 1.5
                residentialChance: 0.0,
            },
            plains: {
                color: 0x90ee90,
                resourceDensity: 0.2, // 削減: 0.6 -> 0.2
                enemyTypes: ['plains_enemy'],
                enemyDensity: 0.8, // 削減: 3 -> 0.8
                residentialChance: 0.2, // 増加: 0.05 -> 0.2 (5個に1個のチャンクに家が生成)
            },
        };

        return configs[biomeType] || configs.plains;
    }
}

window.BiomeGenerator = BiomeGenerator;
