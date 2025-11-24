/**
 * ScentManager.js
 * Manages scent trails left by characters.
 */
class ScentManager {
    constructor(scene) {
        this.scene = scene;
        this.scentNodes = [];
        this.nodeIdCounter = 0;
    }

    /**
     * Add a scent node at the given position
     * @param {number} x 
     * @param {number} y 
     * @param {object} source - The character who left the scent
     * @param {number} duration - How long the scent lasts in ms
     */
    addScentNode(x, y, source, duration = 10000) {
        const node = {
            id: this.nodeIdCounter++,
            x: x,
            y: y,
            source: source,
            timestamp: this.scene.time.now,
            expiry: this.scene.time.now + duration,
        };
        this.scentNodes.push(node);

        // Debug visualization (optional)
        // this.drawDebugNode(node);
    }

    update(time, delta) {
        // Remove expired nodes
        // Using filter might be slow if many nodes, but for prototype it's fine
        // Optimization: Use a ring buffer or remove from head if sorted by time
        if (this.scentNodes.length > 0 && this.scentNodes[0].expiry < time) {
            this.scentNodes = this.scentNodes.filter(node => node.expiry > time);
        }
    }

    /**
     * Find the newest scent node within range
     * @param {number} x 
     * @param {number} y 
     * @param {number} range 
     * @param {object} sourceToTrack - Optional: only find scents from this source
     * @param {number} minTime - Optional: ignore nodes older than this (to avoid backtracking)
     */
    findNewestScent(x, y, range, sourceToTrack = null, minTime = 0) {
        let bestNode = null;
        let bestTime = -1;

        // Iterate backwards (newest first)
        for (let i = this.scentNodes.length - 1; i >= 0; i--) {
            const node = this.scentNodes[i];

            if (node.timestamp <= minTime) continue;
            if (sourceToTrack && node.source !== sourceToTrack) continue;

            const dist = Phaser.Math.Distance.Between(x, y, node.x, node.y);
            if (dist <= range) {
                if (node.timestamp > bestTime) {
                    bestTime = node.timestamp;
                    bestNode = node;
                    // Since we iterate backwards, the first match is the newest
                    return bestNode;
                }
            }
        }
        return bestNode;
    }

    drawDebugNode(node) {
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(0x00ff00, 0.3);
        graphics.fillCircle(node.x, node.y, 5);
        this.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: node.expiry - node.timestamp,
            onComplete: () => graphics.destroy()
        });
    }
}

window.ScentManager = ScentManager;
