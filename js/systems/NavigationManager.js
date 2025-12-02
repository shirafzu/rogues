/**
 * NavigationManager - A* Pathfinding for enemy navigation
 * Grid-based navigation system that works with the chunk system
 */
class NavigationManager {
    constructor(scene, options = {}) {
        this.scene = scene;

        // Grid configuration
        this.cellSize = options.cellSize || 40; // Match tile size
        this.padding = options.padding || 15; // Extra padding around obstacles

        // Cache configuration
        this.cacheTimeout = options.cacheTimeout || 500; // ms before recalculating path
        this.maxPathLength = options.maxPathLength || 100; // Maximum path nodes

        // Grid cache (regenerated when chunks change)
        this.gridCache = new Map(); // "cx,cy" -> { grid, timestamp }
        this.lastChunkKey = null;

        // Path cache per entity
        this.pathCache = new Map(); // entityId -> { path, timestamp, targetX, targetY }

        // Debug
        this.debug = options.debug || false;
        this.debugGraphics = null;
    }

    /**
     * Get or generate navigation grid for a chunk
     */
    getGridForChunk(cx, cy) {
        const key = `${cx},${cy}`;
        const cached = this.gridCache.get(key);
        const now = Date.now();

        // Return cached grid if fresh (increased from 2000ms to reduce recalculation)
        if (cached && (now - cached.timestamp) < 10000) {
            return cached.grid;
        }

        // Generate new grid
        const grid = this.generateGrid(cx, cy);
        this.gridCache.set(key, { grid, timestamp: now });

        return grid;
    }

    /**
     * Generate walkability grid for a chunk area
     */
    generateGrid(cx, cy) {
        const chunkSize = 1000; // Match ChunkManager
        const worldX = cx * chunkSize;
        const worldY = cy * chunkSize;

        const cols = Math.ceil(chunkSize / this.cellSize);
        const rows = Math.ceil(chunkSize / this.cellSize);

        // Initialize grid (true = walkable)
        const grid = [];
        for (let y = 0; y < rows; y++) {
            grid[y] = [];
            for (let x = 0; x < cols; x++) {
                grid[y][x] = true; // Assume walkable initially
            }
        }

        // Use Matter.js Query to get only bodies in this chunk region (more efficient)
        if (this.scene.matter && this.scene.matter.world) {
            const Query = Phaser.Physics.Matter.Matter.Query;
            const chunkBounds = {
                min: { x: worldX - this.padding, y: worldY - this.padding },
                max: { x: worldX + chunkSize + this.padding, y: worldY + chunkSize + this.padding }
            };

            const allBodies = this.scene.matter.world.localWorld.bodies;
            const bodiesInChunk = Query.region(allBodies, chunkBounds);

            for (const body of bodiesInChunk) {
                // Skip sensors, dynamic entities (enemies, player)
                if (body.isSensor) continue;
                if (!body.isStatic) continue; // Only consider static obstacles

                // Get body bounds
                const bounds = body.bounds;
                if (!bounds) continue;

                // Add padding for smoother navigation
                const minX = bounds.min.x - this.padding;
                const minY = bounds.min.y - this.padding;
                const maxX = bounds.max.x + this.padding;
                const maxY = bounds.max.y + this.padding;

                // Mark overlapping cells as unwalkable
                const startCol = Math.max(0, Math.floor((minX - worldX) / this.cellSize));
                const endCol = Math.min(cols - 1, Math.ceil((maxX - worldX) / this.cellSize));
                const startRow = Math.max(0, Math.floor((minY - worldY) / this.cellSize));
                const endRow = Math.min(rows - 1, Math.ceil((maxY - worldY) / this.cellSize));

                for (let row = startRow; row <= endRow; row++) {
                    for (let col = startCol; col <= endCol; col++) {
                        if (grid[row] && grid[row][col] !== undefined) {
                            grid[row][col] = false;
                        }
                    }
                }
            }
        }

        return grid;
    }

    /**
     * Convert world coordinates to grid coordinates
     */
    worldToGrid(worldX, worldY, chunkX, chunkY) {
        const chunkWorldX = chunkX * 1000;
        const chunkWorldY = chunkY * 1000;

        return {
            col: Math.floor((worldX - chunkWorldX) / this.cellSize),
            row: Math.floor((worldY - chunkWorldY) / this.cellSize)
        };
    }

    /**
     * Convert grid coordinates to world coordinates (cell center)
     */
    gridToWorld(col, row, chunkX, chunkY) {
        const chunkWorldX = chunkX * 1000;
        const chunkWorldY = chunkY * 1000;

        return {
            x: chunkWorldX + col * this.cellSize + this.cellSize / 2,
            y: chunkWorldY + row * this.cellSize + this.cellSize / 2
        };
    }

    /**
     * Get chunk coordinates for a world position
     */
    getChunkCoords(worldX, worldY) {
        return {
            cx: Math.floor(worldX / 1000),
            cy: Math.floor(worldY / 1000)
        };
    }

    /**
     * Find path using A* algorithm
     * Returns array of waypoints in world coordinates
     */
    findPath(startX, startY, endX, endY, entityId = null) {
        // Check cache first
        if (entityId) {
            const cached = this.pathCache.get(entityId);
            const now = Date.now();
            if (cached &&
                (now - cached.timestamp) < this.cacheTimeout &&
                Math.abs(cached.targetX - endX) < 50 &&
                Math.abs(cached.targetY - endY) < 50) {
                return cached.path;
            }
        }

        // Get chunk for start position
        const startChunk = this.getChunkCoords(startX, startY);
        const endChunk = this.getChunkCoords(endX, endY);

        // For cross-chunk pathfinding, use simplified approach
        // Path to chunk boundary, then continue in next chunk
        if (startChunk.cx !== endChunk.cx || startChunk.cy !== endChunk.cy) {
            return this.findCrossChunkPath(startX, startY, endX, endY, entityId);
        }

        // Single chunk pathfinding
        const grid = this.getGridForChunk(startChunk.cx, startChunk.cy);
        const startGrid = this.worldToGrid(startX, startY, startChunk.cx, startChunk.cy);
        const endGrid = this.worldToGrid(endX, endY, startChunk.cx, startChunk.cy);

        // Validate grid positions
        const rows = grid.length;
        const cols = grid[0]?.length || 0;

        if (startGrid.row < 0 || startGrid.row >= rows ||
            startGrid.col < 0 || startGrid.col >= cols ||
            endGrid.row < 0 || endGrid.row >= rows ||
            endGrid.col < 0 || endGrid.col >= cols) {
            return null;
        }

        // If start or end is blocked, find nearest walkable cell
        let actualStart = startGrid;
        let actualEnd = endGrid;

        if (!grid[startGrid.row][startGrid.col]) {
            actualStart = this.findNearestWalkable(grid, startGrid.col, startGrid.row);
            if (!actualStart) return null;
        }

        if (!grid[endGrid.row][endGrid.col]) {
            actualEnd = this.findNearestWalkable(grid, endGrid.col, endGrid.row);
            if (!actualEnd) return null;
        }

        // Run A*
        const pathGrid = this.aStar(grid, actualStart, actualEnd);

        if (!pathGrid || pathGrid.length === 0) {
            return null;
        }

        // Convert grid path to world coordinates
        const path = pathGrid.map(node =>
            this.gridToWorld(node.col, node.row, startChunk.cx, startChunk.cy)
        );

        // Smooth path (remove unnecessary waypoints)
        const smoothedPath = this.smoothPath(path, startX, startY);

        // Cache the path
        if (entityId) {
            this.pathCache.set(entityId, {
                path: smoothedPath,
                timestamp: Date.now(),
                targetX: endX,
                targetY: endY
            });
        }

        return smoothedPath;
    }

    /**
     * Find path across chunk boundaries
     */
    findCrossChunkPath(startX, startY, endX, endY, entityId) {
        // Simplified: create intermediate waypoint at chunk boundary
        const startChunk = this.getChunkCoords(startX, startY);
        const endChunk = this.getChunkCoords(endX, endY);

        // Direction to target chunk
        const dx = endChunk.cx - startChunk.cx;
        const dy = endChunk.cy - startChunk.cy;

        // Find boundary point
        let boundaryX, boundaryY;
        const chunkSize = 1000;

        if (Math.abs(dx) >= Math.abs(dy)) {
            // Moving primarily horizontally
            if (dx > 0) {
                boundaryX = (startChunk.cx + 1) * chunkSize - 20;
            } else {
                boundaryX = startChunk.cx * chunkSize + 20;
            }
            // Interpolate Y
            const t = (boundaryX - startX) / (endX - startX);
            boundaryY = startY + t * (endY - startY);
        } else {
            // Moving primarily vertically
            if (dy > 0) {
                boundaryY = (startChunk.cy + 1) * chunkSize - 20;
            } else {
                boundaryY = startChunk.cy * chunkSize + 20;
            }
            // Interpolate X
            const t = (boundaryY - startY) / (endY - startY);
            boundaryX = startX + t * (endX - startX);
        }

        // Find path to boundary in current chunk
        const pathToBoundary = this.findPath(startX, startY, boundaryX, boundaryY, null);

        if (pathToBoundary && pathToBoundary.length > 0) {
            // Add final target as last waypoint (will be refined when we get closer)
            pathToBoundary.push({ x: endX, y: endY });

            if (entityId) {
                this.pathCache.set(entityId, {
                    path: pathToBoundary,
                    timestamp: Date.now(),
                    targetX: endX,
                    targetY: endY
                });
            }

            return pathToBoundary;
        }

        // Fallback: direct path
        return [{ x: endX, y: endY }];
    }

    /**
     * A* pathfinding algorithm
     */
    aStar(grid, start, end) {
        const rows = grid.length;
        const cols = grid[0].length;

        // Node structure
        const createNode = (col, row, g, h, parent) => ({
            col, row, g, h, f: g + h, parent
        });

        // Heuristic (Manhattan distance * 10 for integer math)
        const heuristic = (col, row) => {
            return (Math.abs(col - end.col) + Math.abs(row - end.row)) * 10;
        };

        // Open and closed sets
        const openSet = [];
        const closedSet = new Set();

        const startNode = createNode(start.col, start.row, 0, heuristic(start.col, start.row), null);
        openSet.push(startNode);

        // Movement directions (8-directional)
        const directions = [
            { dc: 0, dr: -1, cost: 10 },  // Up
            { dc: 1, dr: 0, cost: 10 },   // Right
            { dc: 0, dr: 1, cost: 10 },   // Down
            { dc: -1, dr: 0, cost: 10 },  // Left
            { dc: 1, dr: -1, cost: 14 },  // Up-Right
            { dc: 1, dr: 1, cost: 14 },   // Down-Right
            { dc: -1, dr: 1, cost: 14 },  // Down-Left
            { dc: -1, dr: -1, cost: 14 }, // Up-Left
        ];

        let iterations = 0;
        const maxIterations = this.maxPathLength * 50;

        while (openSet.length > 0 && iterations < maxIterations) {
            iterations++;

            // Find node with lowest f score
            let lowestIndex = 0;
            for (let i = 1; i < openSet.length; i++) {
                if (openSet[i].f < openSet[lowestIndex].f) {
                    lowestIndex = i;
                }
            }

            const current = openSet.splice(lowestIndex, 1)[0];

            // Check if reached goal
            if (current.col === end.col && current.row === end.row) {
                // Reconstruct path
                const path = [];
                let node = current;
                while (node) {
                    path.unshift({ col: node.col, row: node.row });
                    node = node.parent;
                }
                return path;
            }

            closedSet.add(`${current.col},${current.row}`);

            // Explore neighbors
            for (const dir of directions) {
                const newCol = current.col + dir.dc;
                const newRow = current.row + dir.dr;

                // Bounds check
                if (newCol < 0 || newCol >= cols || newRow < 0 || newRow >= rows) {
                    continue;
                }

                // Walkable check
                if (!grid[newRow][newCol]) {
                    continue;
                }

                // Diagonal movement check - ensure corner cells are walkable
                if (Math.abs(dir.dc) + Math.abs(dir.dr) === 2) {
                    // Diagonal movement
                    if (!grid[current.row + dir.dr][current.col] ||
                        !grid[current.row][current.col + dir.dc]) {
                        continue; // Can't cut corners
                    }
                }

                const key = `${newCol},${newRow}`;
                if (closedSet.has(key)) {
                    continue;
                }

                const g = current.g + dir.cost;
                const h = heuristic(newCol, newRow);

                // Check if already in open set with better score
                const existingIndex = openSet.findIndex(n => n.col === newCol && n.row === newRow);
                if (existingIndex !== -1) {
                    if (g < openSet[existingIndex].g) {
                        openSet[existingIndex].g = g;
                        openSet[existingIndex].f = g + h;
                        openSet[existingIndex].parent = current;
                    }
                } else {
                    openSet.push(createNode(newCol, newRow, g, h, current));
                }
            }
        }

        // No path found
        return null;
    }

    /**
     * Find nearest walkable cell to a blocked position
     */
    findNearestWalkable(grid, col, row) {
        const rows = grid.length;
        const cols = grid[0].length;

        // Spiral search outward
        for (let radius = 1; radius < 10; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

                    const newCol = col + dx;
                    const newRow = row + dy;

                    if (newCol >= 0 && newCol < cols && newRow >= 0 && newRow < rows) {
                        if (grid[newRow][newCol]) {
                            return { col: newCol, row: newRow };
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * Smooth path by removing unnecessary waypoints
     */
    smoothPath(path, startX, startY) {
        if (!path || path.length <= 2) return path;

        const smoothed = [path[0]];

        for (let i = 1; i < path.length - 1; i++) {
            const prev = smoothed[smoothed.length - 1];
            const current = path[i];
            const next = path[i + 1];

            // Calculate direction change
            const dir1X = current.x - prev.x;
            const dir1Y = current.y - prev.y;
            const dir2X = next.x - current.x;
            const dir2Y = next.y - current.y;

            // Normalize
            const len1 = Math.sqrt(dir1X * dir1X + dir1Y * dir1Y) || 1;
            const len2 = Math.sqrt(dir2X * dir2X + dir2Y * dir2Y) || 1;

            const dot = (dir1X / len1) * (dir2X / len2) + (dir1Y / len1) * (dir2Y / len2);

            // Keep waypoint if direction changes significantly (dot product < 0.9)
            if (dot < 0.9) {
                smoothed.push(current);
            }
        }

        // Always include final destination
        smoothed.push(path[path.length - 1]);

        return smoothed;
    }

    /**
     * Get next waypoint for an entity
     * Returns null if no path or destination reached
     */
    getNextWaypoint(entityId, currentX, currentY, targetX, targetY, waypointReachedDistance = 30) {
        // Find or calculate path
        let path = this.findPath(currentX, currentY, targetX, targetY, entityId);

        if (!path || path.length === 0) {
            return null;
        }

        // Get next waypoint
        const nextPoint = path[0];
        const dist = Math.sqrt(
            (nextPoint.x - currentX) ** 2 +
            (nextPoint.y - currentY) ** 2
        );

        // If reached current waypoint, move to next
        if (dist < waypointReachedDistance && path.length > 1) {
            path.shift();

            // Update cache
            const cached = this.pathCache.get(entityId);
            if (cached) {
                cached.path = path;
            }

            return path[0] || null;
        }

        return nextPoint;
    }

    /**
     * Clear path cache for an entity
     */
    clearPath(entityId) {
        this.pathCache.delete(entityId);
    }

    /**
     * Check if there's a clear line of sight (raycast)
     */
    hasLineOfSight(x1, y1, x2, y2) {
        if (!this.scene.matter) return true;

        const bodies = this.scene.matter.query.ray(
            this.scene.matter.world.localWorld.bodies,
            { x: x1, y: y1 },
            { x: x2, y: y2 }
        );

        for (const collision of bodies) {
            const body = collision.bodyA || collision.bodyB;
            if (!body) continue;
            if (body.isSensor) continue;
            if (!body.isStatic) continue;

            return false;
        }

        return true;
    }

    /**
     * Update method - call each frame for debug drawing
     */
    update() {
        if (this.debug) {
            this.drawDebug();
        }
    }

    /**
     * Draw debug visualization
     */
    drawDebug() {
        if (!this.debugGraphics) {
            this.debugGraphics = this.scene.add.graphics();
            this.debugGraphics.setDepth(9998);
        }

        this.debugGraphics.clear();

        // Draw active paths
        this.debugGraphics.lineStyle(2, 0x00ff00, 0.8);

        for (const [entityId, cached] of this.pathCache) {
            const path = cached.path;
            if (!path || path.length < 2) continue;

            this.debugGraphics.beginPath();
            this.debugGraphics.moveTo(path[0].x, path[0].y);

            for (let i = 1; i < path.length; i++) {
                this.debugGraphics.lineTo(path[i].x, path[i].y);
            }

            this.debugGraphics.strokePath();

            // Draw waypoints
            this.debugGraphics.fillStyle(0x00ff00, 0.6);
            for (const point of path) {
                this.debugGraphics.fillCircle(point.x, point.y, 4);
            }
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.gridCache.clear();
        this.pathCache.clear();
        if (this.debugGraphics) {
            this.debugGraphics.destroy();
        }
    }
}

window.NavigationManager = NavigationManager;
