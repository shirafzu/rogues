/**
 * HotspotMapGenerator
 * 多極分散型のマップ生成を担当するジェネレーター。
 * 既存バイオーム生成とは独立して動作し、週次シードで決定論的に再現可能。
 */
class HotspotMapGenerator {
    constructor(options = {}) {
        // 基本設定
        this.worldWidth = options.worldWidth ?? 80000;
        this.worldHeight = options.worldHeight ?? 80000;
        this.minPoiDistance = options.minPoiDistance ?? 4200;
        this.targetPoiCount = options.targetPoiCount ?? 28;
        this.influenceRadius = options.influenceRadius ?? this.minPoiDistance * 1.6;
        this.stampRadius = options.stampRadius ?? this.minPoiDistance * 1.2;
        this.pathGridSize = options.pathGridSize ?? 800;
        this.pathCorridorWidth = options.pathCorridorWidth ?? 600;

        // シードと乱数
        this.seed = options.seed || HotspotMapGenerator.buildWeeklySeed();
        this.rnd = options.rnd || new Phaser.Math.RandomDataGenerator([this.seed]);

        // 週次ミューテーター
        this.mutators = this.generateWeeklyMutators();

        // 生成結果
        this.pois = [];
        this.navGrid = null;
        this.paths = [];
        this.rivers = [];

        // オプション
        this.ensureRiverNearOrigin = options.ensureRiverNearOrigin !== false;

        // 実行
        this.generate();
    }

    /**
        * ISO週番号を使った週次シードを生成 (YYYY-Www)。
        */
    static buildWeeklySeed(date = new Date()) {
        const { year, week } = HotspotMapGenerator.getISOWeek(date);
        return `${year}-W${String(week).padStart(2, '0')}`;
    }

    /**
        * ISO 8601 ベースの週番号を返す。
        */
    static getISOWeek(date = new Date()) {
        const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const day = tmp.getUTCDay() || 7;
        tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
        return { year: tmp.getUTCFullYear(), week: weekNo };
    }

    /**
        * シードをハッシュ化し、0-1の範囲で返す。
        */
    hashToUnit(seedStr) {
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = (hash << 5) - hash + seedStr.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash % 10000) / 10000;
    }

    /**
        * スコープ付き乱数生成器。
        */
    createScopedRng(label) {
        return new Phaser.Math.RandomDataGenerator([this.seed, label]);
    }

    /**
        * チャンク座標ごとに乱数を安定化。
        */
    getChunkRng(cx, cy, label = '') {
        return new Phaser.Math.RandomDataGenerator([this.seed, `${cx},${cy}`, label]);
    }

    generate() {
        this.pois = this.generatePOIs();
        this.navGrid = this.buildNavGrid();
        this.paths = this.buildPathNetwork();
        this.rivers = this.generateRivers();
    }

    /**
        * 週替わりミューテーター（天候・水位・敵傾向）。
        */
    generateWeeklyMutators() {
        const rng = this.createScopedRng('mutators');
        const weatherOptions = [
            { id: 'clear', visibility: 1.0, fog: 0.0 },
            { id: 'fog', visibility: 0.75, fog: 0.35 },
            { id: 'storm', visibility: 0.6, fog: 0.2 },
            { id: 'heatwave', visibility: 0.9, fog: 0.15 },
            { id: 'rain', visibility: 0.8, fog: 0.25 }
        ];
        const weather = weatherOptions[rng.between(0, weatherOptions.length - 1)];

        const waterLevel = Phaser.Math.Clamp(rng.realInRange(0.05, 0.28), 0.0, 0.4);

        const enemyBiasOptions = [
            { id: 'caster_bias', label: '魔法使い強化', enemyId: 'rabbit_beastkin', weight: 1.5 },
            { id: 'brute_bias', label: '獣型強化', enemyId: 'dog_beastkin', weight: 1.4 },
            { id: 'balanced', label: 'バランス', enemyId: 'default', weight: 1.0 }
        ];
        const spawnBias = enemyBiasOptions[rng.between(0, enemyBiasOptions.length - 1)];

        return {
            seed: this.seed,
            week: HotspotMapGenerator.getISOWeek(),
            weather,
            waterLevel,
            spawnBias
        };
    }

    /**
        * Poisson Disk Sampling でPOIを生成し、役割を割り当てる。
        */
    generatePOIs() {
        const minX = -this.worldWidth / 2;
        const minY = -this.worldHeight / 2;
        const maxX = this.worldWidth / 2;
        const maxY = this.worldHeight / 2;

        const cellSize = this.minPoiDistance / Math.SQRT2;
        const gridWidth = Math.ceil(this.worldWidth / cellSize);
        const gridHeight = Math.ceil(this.worldHeight / cellSize);
        const grid = new Array(gridWidth).fill(null).map(() => new Array(gridHeight).fill(null));

        const points = [];
        const active = [];

        const first = {
            x: this.rnd.realInRange(minX, maxX),
            y: this.rnd.realInRange(minY, maxY)
        };
        const firstIdx = this.pointToGrid(first, cellSize, minX, minY);
        grid[firstIdx.gx][firstIdx.gy] = first;
        points.push(first);
        active.push(first);

        const maxAttempts = 30;
        while (active.length && points.length < this.targetPoiCount) {
            const idx = this.rnd.between(0, active.length - 1);
            const point = active[idx];
            let found = false;

            for (let i = 0; i < maxAttempts; i++) {
                const angle = this.rnd.realInRange(0, Math.PI * 2);
                const dist = this.rnd.realInRange(this.minPoiDistance, this.minPoiDistance * 2);
                const candidate = {
                    x: point.x + Math.cos(angle) * dist,
                    y: point.y + Math.sin(angle) * dist
                };
                if (!this.isInside(candidate, minX, maxX, minY, maxY)) continue;
                if (!this.isValidPoissonCandidate(candidate, grid, cellSize, minX, minY)) continue;

                const cIdx = this.pointToGrid(candidate, cellSize, minX, minY);
                grid[cIdx.gx][cIdx.gy] = candidate;
                points.push(candidate);
                active.push(candidate);
                found = true;
                break;
            }

            if (!found) {
                active.splice(idx, 1);
            }
        }

        return this.assignPoiRoles(points);
    }

    pointToGrid(point, cellSize, minX, minY) {
        const gx = Math.floor((point.x - minX) / cellSize);
        const gy = Math.floor((point.y - minY) / cellSize);
        return { gx, gy };
    }

    isInside(p, minX, maxX, minY, maxY) {
        return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
    }

    isValidPoissonCandidate(candidate, grid, cellSize, minX, minY) {
        const { gx, gy } = this.pointToGrid(candidate, cellSize, minX, minY);
        const searchRadius = 2;
        for (let x = gx - searchRadius; x <= gx + searchRadius; x++) {
            for (let y = gy - searchRadius; y <= gy + searchRadius; y++) {
                if (x < 0 || y < 0 || x >= grid.length || y >= grid[0].length) continue;
                const neighbor = grid[x][y];
                if (!neighbor) continue;
                const dx = neighbor.x - candidate.x;
                const dy = neighbor.y - candidate.y;
                if (dx * dx + dy * dy < this.minPoiDistance * this.minPoiDistance) {
                    return false;
                }
            }
        }
        return true;
    }

    assignPoiRoles(points) {
        const roles = ['boss', 'highLoot', 'scavenge', 'extraction'];
        const weights = [
            { role: 'boss', weight: 1.2 },
            { role: 'highLoot', weight: 1.6 },
            { role: 'scavenge', weight: 2.2 },
            { role: 'extraction', weight: 1.0 }
        ];

        const result = points.map((p, idx) => ({
            id: `poi_${idx}`,
            x: p.x,
            y: p.y,
            role: 'scavenge'
        }));

        // 必須役割を確保
        const shuffled = result.slice().sort(() => this.rnd.frac() - 0.5);
        roles.forEach((role, i) => {
            if (shuffled[i]) {
                shuffled[i].role = role;
            }
        });

        // 残りを重みで割り当て
        for (let i = roles.length; i < result.length; i++) {
            result[i].role = this.weightedPick(weights, this.rnd);
        }

        return result;
    }

    weightedPick(list, rng) {
        const total = list.reduce((sum, item) => sum + item.weight, 0);
        let r = rng.frac() * total;
        for (const item of list) {
            r -= item.weight;
            if (r <= 0) return item.role || item.id;
        }
        return list[0].role || list[0].id;
    }

    /**
        * 最寄りPOIと距離を返す。
        */
    getNearestPoi(x, y) {
        let nearest = null;
        let bestDist2 = Infinity;
        for (const poi of this.pois) {
            const dx = poi.x - x;
            const dy = poi.y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDist2) {
                bestDist2 = d2;
                nearest = poi;
            }
        }
        return { poi: nearest, distance: Math.sqrt(bestDist2) };
    }

    /**
        * DangerValue を 0.0 - 1.0 で返す。パス近傍は安全側に補正。
        */
    getDangerValue(x, y, options = {}) {
        if (!this.pois.length) return 0;

        const { poi, distance } = this.getNearestPoi(x, y);
        const base = Phaser.Math.Clamp(1 - distance / this.influenceRadius, 0, 1);
        const roleMultiplier = {
            boss: 1.2,
            highLoot: 1.0,
            scavenge: 0.8,
            extraction: 0.6
        };
        let danger = Phaser.Math.Clamp(base * (roleMultiplier[poi.role] || 1), 0, 1);

        if (!options.ignorePaths) {
            const pathDistance = this.getDistanceToPaths(x, y);
            if (pathDistance !== null && pathDistance < this.pathCorridorWidth) {
                const t = Phaser.Math.Clamp(pathDistance / this.pathCorridorWidth, 0, 1);
                danger *= t * 0.35; // パス上は安全
            }
        }

        return Phaser.Math.Clamp(danger, 0, 1);
    }

    /**
        * 各POIのスタンプを重ね合わせた地形高さ（-1.0 - 1.0）。
        */
    getStampedHeight(x, y) {
        let height = -0.05;
        const profiles = {
            boss: { radius: this.stampRadius * 1.15, amplitude: 0.9, shape: 'crater' },
            highLoot: { radius: this.stampRadius, amplitude: 0.6, shape: 'hill' },
            scavenge: { radius: this.stampRadius * 0.9, amplitude: 0.4, shape: 'flat' },
            extraction: { radius: this.stampRadius * 0.8, amplitude: 0.35, shape: 'plateau' }
        };

        for (const poi of this.pois) {
            const profile = profiles[poi.role] || profiles.scavenge;
            const dx = x - poi.x;
            const dy = y - poi.y;
            const dist = Math.hypot(dx, dy);
            if (dist > profile.radius) continue;

            const t = 1 - dist / profile.radius;
            let contribution = 0;
            if (profile.shape === 'crater') {
                contribution = -(t * t) * profile.amplitude;
            } else if (profile.shape === 'hill') {
                contribution = Math.pow(t, 1.5) * profile.amplitude;
            } else if (profile.shape === 'plateau') {
                contribution = (Math.pow(t, 0.5)) * profile.amplitude * 0.5;
            } else {
                contribution = t * profile.amplitude * 0.3;
            }
            height += contribution;
        }

        // 川による掘り下げ
        const riverInfluence = this.getRiverInfluence(x, y);
        if (riverInfluence) {
            height -= riverInfluence.depth;
        }

        // パス上はフラットに
        const pathDistance = this.getDistanceToPaths(x, y);
        if (pathDistance !== null && pathDistance < this.pathCorridorWidth) {
            height = Math.max(height, -0.2);
        }

        // 水位でオフセット
        height -= this.mutators.waterLevel * 0.6;
        return Phaser.Math.Clamp(height, -1, 1);
    }

    getTerrainTag(x, y) {
        // 優先: 明示的な川
        const river = this.getRiverInfluence(x, y);
        if (river && river.dist < (river.river?.width || 0)) {
            return 'river';
        }

        const h = this.getStampedHeight(x, y);
        if (h < -0.35) return 'water';
        if (h < -0.1) return 'mud';

        const danger = this.getDangerValue(x, y, { ignorePaths: true });
        if (danger < 0.35) return 'grass';
        return 'stone';
    }

    /**
        * 川の生成（シンプルな蛇行ポリライン）
        */
    generateRivers() {
        const rng = this.createScopedRng('rivers');
        const rivers = [];
        const count = 3;
        const amplitude = this.worldHeight * 0.08;

        const makeRiver = (id, startYBias = null) => {
            const baseY = startYBias !== null ? startYBias : rng.realInRange(-this.worldHeight * 0.35, this.worldHeight * 0.35);
            const width = rng.between(180, 260);
            const points = [];
            const steps = 14;
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const x = -this.worldWidth / 2 + t * this.worldWidth;
                const y = baseY + Math.sin(t * Math.PI * 2 + rng.realInRange(-0.5, 0.5)) * amplitude + rng.realInRange(-120, 120);
                points.push({ x, y });
            }
            rivers.push({ id, points, width, baseSpeed: 70 + rng.realInRange(-10, 20) });
        };

        for (let i = 0; i < count; i++) {
            makeRiver(`river_${i}`);
        }

        // プレイヤー起点近くに必ず1本通す
        if (this.ensureRiverNearOrigin) {
            makeRiver('river_origin', rng.realInRange(-this.worldHeight * 0.08, this.worldHeight * 0.08));
        }

        return rivers;
    }

    getRiverInfluence(x, y) {
        if (!this.rivers || !this.rivers.length) return null;
        let best = null;
        for (const river of this.rivers) {
            for (let i = 0; i < river.points.length - 1; i++) {
                const a = river.points[i];
                const b = river.points[i + 1];
                const dist = this.pointToSegmentDistance(x, y, a.x, a.y, b.x, b.y);
                if (dist > river.width * 0.6) continue;
                const t = Phaser.Math.Clamp(dist / (river.width * 0.6), 0, 1);
                const depth = (1 - t) * 0.5; // 掘り下げ量
                best = { river, depth, segment: { a, b }, dist };
                break;
            }
        }
        return best;
    }

    getRiverFlowInfo(x, y) {
        const info = this.getRiverInfluence(x, y);
        if (!info) {
            // 汎用的な水域（高さで判定）
            const height = this.getStampedHeight(x, y);
            if (height < -0.35) {
                return { inWater: true, flow: { x: 0, y: 0 }, speed: 40, speedMultiplier: 0.6, terrain: 'water' };
            }
            return { inWater: false, flow: { x: 0, y: 0 }, speed: 0, speedMultiplier: 1, terrain: this.getTerrainTag(x, y) };
        }
        const { a, b } = info.segment;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = dx / len;
        const ny = dy / len;
        return {
            inWater: true,
            flow: { x: nx, y: ny },
            speed: info.river.baseSpeed,
            speedMultiplier: 0.55,
            terrain: 'river'
        };
    }

    /**
        * ナビゲーション用グリッドを作成。
        */
    buildNavGrid() {
        const cols = Math.ceil(this.worldWidth / this.pathGridSize);
        const rows = Math.ceil(this.worldHeight / this.pathGridSize);
        const minX = -this.worldWidth / 2;
        const minY = -this.worldHeight / 2;

        const cells = new Array(cols * rows).fill(null);
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                const wx = minX + x * this.pathGridSize + this.pathGridSize / 2;
                const wy = minY + y * this.pathGridSize + this.pathGridSize / 2;
                const danger = this.getDangerValue(wx, wy, { ignorePaths: true });
                const height = this.getStampedHeight(wx, wy);
                const blocked = height < -0.4; // 水没域を壁扱い
                const baseCost = 1 + danger * 8 + Math.max(0, height) * 4;
                cells[this.toIndex(x, y, cols)] = {
                    x,
                    y,
                    worldX: wx,
                    worldY: wy,
                    cost: blocked ? Infinity : baseCost,
                    blocked
                };
            }
        }

        return { cols, rows, cells, minX, minY };
    }

    /**
        * 全POIを接続する経路網を生成（MST + A*）。
        */
    buildPathNetwork() {
        if (this.pois.length <= 1) return [];
        const edges = this.buildMinimumSpanningEdges();
        const paths = [];
        edges.forEach((edge, idx) => {
            const path = this.findPath(edge.a, edge.b);
            if (path && path.length > 1) {
                paths.push({ id: `path_${idx}`, points: path, width: this.pathCorridorWidth });
            }
        });
        return paths;
    }

    buildMinimumSpanningEdges() {
        const visited = new Set();
        visited.add(0);
        const edges = [];
        while (visited.size < this.pois.length) {
            let best = null;
            for (const i of visited) {
                for (let j = 0; j < this.pois.length; j++) {
                    if (visited.has(j)) continue;
                    const a = this.pois[i];
                    const b = this.pois[j];
                    const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
                    if (!best || dist < best.dist) {
                        best = { a: i, b: j, dist };
                    }
                }
            }
            if (best) {
                visited.add(best.b);
                edges.push({ a: best.a, b: best.b });
            } else {
                break;
            }
        }
        return edges;
    }

    findPath(fromPoiIndex, toPoiIndex) {
        const startPoi = this.pois[fromPoiIndex];
        const endPoi = this.pois[toPoiIndex];
        const startCell = this.worldToGrid(startPoi.x, startPoi.y);
        const goalCell = this.worldToGrid(endPoi.x, endPoi.y);
        const pathCells = this.aStar(startCell, goalCell);
        if (!pathCells.length) {
            // フォールバックで直線
            return [startPoi, endPoi].map(p => ({ x: p.x, y: p.y }));
        }
        return pathCells.map(c => this.gridToWorld(c.x, c.y));
    }

    aStar(start, goal) {
        const { cols, rows, cells } = this.navGrid;
        const toIdx = (p) => this.toIndex(p.x, p.y, cols);
        const open = new Set();
        open.add(toIdx(start));

        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startIdx = toIdx(start);
        gScore.set(startIdx, 0);
        fScore.set(startIdx, this.heuristic(start, goal));

        while (open.size) {
            let currentIdx = null;
            let lowest = Infinity;
            for (const idx of open) {
                const score = fScore.get(idx) ?? Infinity;
                if (score < lowest) {
                    lowest = score;
                    currentIdx = idx;
                }
            }

            if (currentIdx === null) break;

            const current = this.indexToPoint(currentIdx, cols);
            if (current.x === goal.x && current.y === goal.y) {
                return this.reconstructPath(cameFrom, currentIdx, cols);
            }

            open.delete(currentIdx);
            const neighbors = this.getNeighbors(current, cols, rows);
            for (const neighbor of neighbors) {
                const nIdx = toIdx(neighbor);
                const cell = cells[nIdx];
                if (!cell || cell.blocked) continue;

                const tentativeG = (gScore.get(currentIdx) ?? Infinity) + cell.cost;
                if (tentativeG < (gScore.get(nIdx) ?? Infinity)) {
                    cameFrom.set(nIdx, currentIdx);
                    gScore.set(nIdx, tentativeG);
                    fScore.set(nIdx, tentativeG + this.heuristic(neighbor, goal));
                    open.add(nIdx);
                }
            }
        }

        return [];
    }

    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    reconstructPath(cameFrom, currentIdx, cols) {
        const path = [this.indexToPoint(currentIdx, cols)];
        while (cameFrom.has(currentIdx)) {
            currentIdx = cameFrom.get(currentIdx);
            path.unshift(this.indexToPoint(currentIdx, cols));
        }
        return path;
    }

    getNeighbors(p, cols, rows) {
        const out = [];
        const dirs = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 }
        ];
        for (const d of dirs) {
            const nx = p.x + d.x;
            const ny = p.y + d.y;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            out.push({ x: nx, y: ny });
        }
        return out;
    }

    toIndex(x, y, cols) {
        return y * cols + x;
    }

    indexToPoint(idx, cols) {
        const y = Math.floor(idx / cols);
        const x = idx - y * cols;
        return { x, y };
    }

    worldToGrid(wx, wy) {
        const gx = Phaser.Math.Clamp(Math.floor((wx + this.worldWidth / 2) / this.pathGridSize), 0, this.navGrid.cols - 1);
        const gy = Phaser.Math.Clamp(Math.floor((wy + this.worldHeight / 2) / this.pathGridSize), 0, this.navGrid.rows - 1);
        return { x: gx, y: gy };
    }

    gridToWorld(gx, gy) {
        const wx = -this.worldWidth / 2 + gx * this.pathGridSize + this.pathGridSize / 2;
        const wy = -this.worldHeight / 2 + gy * this.pathGridSize + this.pathGridSize / 2;
        return { x: wx, y: wy };
    }

    /**
        * パスまでの最短距離（全てのセグメントから）。
        */
    getDistanceToPaths(x, y) {
        if (!this.paths || !this.paths.length) return null;
        let best = Infinity;
        for (const path of this.paths) {
            for (let i = 0; i < path.points.length - 1; i++) {
                const a = path.points[i];
                const b = path.points[i + 1];
                const d = this.pointToSegmentDistance(x, y, a.x, a.y, b.x, b.y);
                if (d < best) best = d;
            }
        }
        return best === Infinity ? null : best;
    }

    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (dx === 0 && dy === 0) {
            return Math.hypot(px - x1, py - y1);
        }
        const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
        const clampedT = Phaser.Math.Clamp(t, 0, 1);
        const projX = x1 + clampedT * dx;
        const projY = y1 + clampedT * dy;
        return Math.hypot(px - projX, py - projY);
    }

    /**
        * 環境ストーリーテリング用の植生バリアントをDanger値から求める。
        */
    getEnvironmentVariant(danger) {
        if (danger > 0.8) return 'blighted';
        if (danger > 0.4) return 'wilted';
        return 'lush';
    }

    /**
        * Dangerに応じて敵ティアを返す。
        */
    getEnemyTier(danger) {
        if (danger > 0.8) return 'elite';
        if (danger > 0.4) return 'patrol';
        return 'low';
    }
}

window.HotspotMapGenerator = HotspotMapGenerator;
