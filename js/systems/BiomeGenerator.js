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

        // プレートテクトニクス設定
        this.numPlates = 18; // プレート総数を増加
        this.plates = [];
        this.generatePlates();
    }

    generatePlates() {
        this.plates = [];
        const worldWidth = this.planetRadius * 360;
        const worldHeight = this.planetRadius * 170;

        // プレート配置の最小距離（クラスタリング回避）
        const minDistance = this.planetRadius * 60; // 60度分

        // 戦略的配置: 赤道付近に1つ大陸を確保（ゲームプレイ用）
        const equatorialPlate = {
            id: 0,
            lon: this.rnd.between(0, 360),
            lat: this.rnd.between(-15, 15), // 赤道±15度
            type: 'continental',
            size: 'super' // 超大陸
        };
        equatorialPlate.x = equatorialPlate.lon * this.planetRadius;
        equatorialPlate.y = equatorialPlate.lat * this.planetRadius;
        this.plates.push(equatorialPlate);

        // 残りのプレートを配置
        let attempts = 0;
        const maxAttempts = 500;

        while (this.plates.length < this.numPlates && attempts < maxAttempts) {
            attempts++;

            const lon = this.rnd.between(0, 360);
            const lat = this.rnd.between(-70, 70); // 極地は避ける
            const x = lon * this.planetRadius;
            const y = lat * this.planetRadius;

            // 最小距離チェック
            let tooClose = false;
            for (const existing of this.plates) {
                const dist = this.getWrappedDistance(x, y, existing.x, existing.y);
                if (dist < minDistance) {
                    tooClose = true;
                    break;
                }
            }

            if (tooClose) continue;

            // プレートタイプ決定: 45%が大陸プレート
            const type = this.rnd.frac() < 0.45 ? 'continental' : 'oceanic';

            // サイズ分類（大陸プレートの場合のみ）
            let size = 'standard';
            if (type === 'continental') {
                const sizeRoll = this.rnd.frac();
                if (sizeRoll < 0.15) {
                    size = 'super';      // 15%: 超大陸
                } else if (sizeRoll < 0.7) {
                    size = 'standard';   // 55%: 通常大陸
                } else {
                    size = 'micro';      // 30%: 小規模大陸/大きな島
                }
            }

            this.plates.push({
                id: this.plates.length,
                x: x,
                y: y,
                lon: lon,
                lat: lat,
                type: type,
                size: size
            });
        }

        // 移動ベクトルと半径を設定
        for (const plate of this.plates) {
            const angle = this.rnd.angle();
            const speed = this.rnd.between(0.5, 1.5);
            plate.vx = Math.cos(angle) * speed;
            plate.vy = Math.sin(angle) * speed;

            // サイズに応じた半径
            if (plate.type === 'continental') {
                if (plate.size === 'super') {
                    plate.radius = this.rnd.between(50000, 70000); // 非常に大きい
                } else if (plate.size === 'standard') {
                    plate.radius = this.rnd.between(30000, 45000); // 通常
                } else { // micro
                    plate.radius = this.rnd.between(15000, 25000); // 小さい
                }
            } else {
                plate.radius = this.rnd.between(20000, 35000); // 海洋プレート
            }
        }

        console.log(`[BiomeGenerator] Generated ${this.plates.length} plates:`,
            this.plates.filter(p => p.type === 'continental').length, 'continental,',
            this.plates.filter(p => p.type === 'oceanic').length, 'oceanic');
    }

    // 2点間の距離（経度ラッピング考慮）
    getWrappedDistance(x1, y1, x2, y2) {
        const circumference = 360 * this.planetRadius;

        let dx = Math.abs(x1 - x2);
        // 経度方向の最短距離（ラッピング）
        if (dx > circumference / 2) {
            dx = circumference - dx;
        }

        const dy = Math.abs(y1 - y2);

        return Math.sqrt(dx * dx + dy * dy);
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

    // ラップされたノイズを取得（smootherstep補間によるC2連続性を保証）
    wrappedNoise2D(x, y, noiseGen) {
        const W = this.planetRadius * 360; // ワールド全周

        // xを 0 ~ W の範囲に正規化
        let nx = x % W;
        if (nx < 0) nx += W;

        // 補間係数 (0.0 ~ 1.0)
        const s = nx / W;

        // Smootherstep (Ken Perlin's improved smoothstep)
        // これにより1次・2次微分が0になり、C2連続性が保証される
        const t = s * s * s * (s * (s * 6 - 15) + 10);

        // 通常のノイズと、1周分ずらしたノイズをブレンド
        const n1 = noiseGen.noise2D(nx, y);
        const n2 = noiseGen.noise2D(nx - W, y);

        return n1 * (1 - t) + n2 * t;
    }

    // FBM (Fractal Brownian Motion) ノイズ生成（完全ラップ対応版）
    fbm(x, y, noiseGen, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
        const W = this.planetRadius * 360; // ワールド幅（ワールド座標）

        let total = 0;
        let amplitude = 1;
        let frequency = this.baseScale;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            // このオクターブでのノイズ空間座標
            const nx = x * frequency;
            const ny = y * frequency;

            // ノイズ空間での周期（このオクターブ専用）
            const period = W * frequency;

            // ノイズ空間でのラッピング処理
            let px = nx % period;
            if (px < 0) px += period;

            // 補間係数（このオクターブの周期内での位置）
            const s = px / period;
            // Smootherstep補間
            const t = s * s * s * (s * (s * 6 - 15) + 10);

            // 2つのサンプルを取得して補間
            const a = noiseGen.noise2D(px, ny);
            const b = noiseGen.noise2D(px - period, ny);
            const noiseValue = a * (1 - t) + b * t;

            total += noiseValue * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return total / maxValue;
    }

    // リッジノイズ（山脈のような鋭い地形を作る）
    ridgeNoise(x, y, noiseGen) {
        let n = this.fbm(x, y, noiseGen, 4, 0.5, 2.0);
        return 1.0 - Math.abs(n);
    }

    // 標高を取得（プレートテクトニクスベース + 多層ノイズ）
    getElevation(x, y) {
        // 1. 最も近いプレートと2番目に近いプレートを探す
        let d1 = Infinity;
        let d2 = Infinity;
        let p1 = null;
        let p2 = null;

        for (const plate of this.plates) {
            const dist = this.getWrappedDistance(x, y, plate.x, plate.y);
            if (dist < d1) {
                d2 = d1;
                p2 = p1;
                d1 = dist;
                p1 = plate;
            } else if (dist < d2) {
                d2 = dist;
                p2 = plate;
            }
        }

        if (!p1) return -1.0; // エラー回避

        // 2. ベース標高（大陸か海洋か）
        let baseHeight;
        const distFactor = 1.0 - Math.min(1.0, d1 / p1.radius); // 0.0(遠い) ~ 1.0(中心)

        if (p1.type === 'continental') {
            baseHeight = 0.2 + distFactor * 0.8; // 0.2 ~ 1.0
        } else {
            baseHeight = -1.0 + distFactor * 0.5; // -1.0 ~ -0.5
        }

        // 3. テクトニクス相互作用（境界付近）
        let tectonicMod = 0;
        if (p2) {
            const edgeDist = d2 - d1;
            const edgeThreshold = 10000;

            if (edgeDist < edgeThreshold) {
                const edgeFactor = 1.0 - (edgeDist / edgeThreshold);

                const rvx = p2.vx - p1.vx;
                const rvy = p2.vy - p1.vy;

                let dx = p2.x - p1.x;
                const circumference = 360 * this.planetRadius;
                if (Math.abs(dx) > circumference / 2) dx -= Math.sign(dx) * circumference;
                const dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const nx = dx / len;
                const ny = dy / len;

                const dot = rvx * nx + rvy * ny;

                if (dot < -0.5) {
                    tectonicMod = edgeFactor * 1.0; // 山脈
                } else if (dot > 0.5) {
                    tectonicMod = -edgeFactor * 0.8; // 谷
                }
            }
        }

        // 4. 多層ノイズ
        // Layer 1: 大陸スケール（既にbaseHeightに含まれている）

        // Layer 2: 地域スケール（中規模の地形変化）
        const regionalNoise = this.fbm(x, y, this.elevationNoise, 3, 0.5, 2.0) * 0.15;

        // Layer 3: 局所スケール（細かい地形）
        const localNoise = this.fbm(x, y, this.elevationNoise, 5, 0.5, 2.5) * 0.08;

        // 5. フラクタル海岸線（海抜付近のみに適用）
        const coastlineDetail = this.getCoastlineNoise(x, y, baseHeight + tectonicMod);

        // 最終合成
        let finalElevation = baseHeight + tectonicMod + regionalNoise + localNoise + coastlineDetail;

        // 極地マスク
        const lat = y / this.planetRadius;
        if (Math.abs(lat) > 60) {
            const polarFactor = (Math.abs(lat) - 60) / 25;
            finalElevation -= polarFactor * 1.5;
        }

        return finalElevation;
    }

    // フラクタル海岸線ノイズ（海抜付近のみに適用）
    getCoastlineNoise(x, y, roughElevation) {
        // 海抜付近でのみ強く作用
        // roughElevation が -0.3 ~ 0.3 の範囲で最大強度
        const seaLevel = 0.0;
        const distanceFromSeaLevel = Math.abs(roughElevation - seaLevel);

        // 海抜から離れるほど影響が減衰
        const influenceRange = 0.4;
        if (distanceFromSeaLevel > influenceRange) return 0;

        const influence = 1.0 - (distanceFromSeaLevel / influenceRange);

        // 高周波ノイズで複雑な海岸線を生成
        const coastNoise = this.fbm(x * 3, y * 3, this.warpNoise, 6, 0.6, 2.3);

        return coastNoise * influence * 0.25; // 適度な強度
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

        // ドメインワーピング：座標をノイズで大きくずらす（ラップ対応）
        const qx = this.wrappedNoise2D(wx * this.warpScale, wy * this.warpScale, this.warpNoise);
        const qy = this.wrappedNoise2D((wx + 5200) * this.warpScale, (wy + 1300) * this.warpScale, this.warpNoise);

        const destX = wx + qx * this.warpStrength;
        const destY = wy + qy * this.warpStrength;

        // 1. 標高（Elevation）を計算
        // getElevation内でfbm(ラップ対応)を使っているが、
        // ここではワーピング後の座標を渡している。
        // getElevation自体は生の座標を受け取って内部で距離計算等を行う設計になっている。
        // しかし、ここでは「ワーピングされた座標」を使って「ノイズによる詳細」を得たい意図があるかもしれないが、
        // getElevationは「プレートからの距離」がメインなので、ワーピングされた座標を渡すとプレート位置との整合性が取れなくなる可能性がある。

        // 修正方針:
        // getElevationは「大まかな地形（プレート）」と「詳細ノイズ」を合成している。
        // ワーピングは「詳細ノイズ」や「バイオーム境界」に効かせたい。
        // 現在のgetElevation実装では、内部で this.fbm(x, y) を呼んでいる。
        // なので、getElevation(wx, wy) を呼べば、プレート計算は正確に行われ、ノイズもラップされて乗る。
        // ドメインワーピングを効かせたいなら、getElevationの引数をずらすのではなく、
        // getElevation内部のノイズ計算にワーピングを適用する必要がある。

        // とりあえず、getElevation(wx, wy) をそのまま呼ぶのが正解。
        // 以前のコードでは destX, destY を使っていたが、それは全てがノイズベースだったから。
        // プレートベースになった今、座標をずらすとプレート中心からの距離がおかしくなる。

        // ただし、バイオームの境界をぐにゃぐにゃにしたいなら、
        // getElevationの結果に対してノイズを乗せるか、
        // 気温・湿度の計算にワーピングを使うのが良い。

        const elevation = this.getElevation(wx, wy);

        // 2. 気温・湿度（ワーピング適用）
        // ここでは destX, destY を使って、気温・湿度の分布を歪ませる
        let t = this.fbm(destX, destY, this.tempNoise, 4);
        // 緯度が高いほど寒くなる
        t -= Math.abs(latitude) * 0.02;

        const m = this.fbm(destX + 10000, destY + 10000, this.moistNoise, 4);

        // --- バイオーム判定ロジック ---

        // 極地氷冠（緯度85度以上）
        if (Math.abs(latitude) > this.maxLatitude * 0.98) {
            return "ice_cap";
        }

        // 海（Ocean）
        if (elevation < -0.2) {
            if (elevation < -0.6) return "deep_ocean";
            return "ocean";
        }

        // 海岸（Beach）
        if (elevation < -0.1) { // 少し閾値を上げる
            return "beach";
        }

        // 高地・山岳（Mountain）
        // プレート衝突で隆起した場所は elevation が高くなっているはず
        if (elevation > 0.5) {
            if (elevation > 0.8 && t > 0.5) return "volcano"; // 高くて暑い
            if (t < 0) return "snow_mountain"; // 高くて寒い
            return "mountain";
        }

        // 一般的な陸地バイオーム
        if (t < -0.2) {
            // Cold
            if (m > 0.1) return "snow";
            return "wasteland";
        } else if (t > 0.2) {
            // Hot
            if (m < -0.1) return "desert";
            if (m > 0.4) return "jungle";
            return "forest";
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
