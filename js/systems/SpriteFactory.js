/**
 * SpriteFactory
 * 簡易的なトップダウン用テクスチャをCanvasで生成する。
 * 外部アセット不要で、シード付きRNGが渡されれば決定論的に揺らぎを再現可能。
 */
class SpriteFactory {
    static register(scene, rnd) {
        const hasRnd = !!rnd;
        const rand = () => hasRnd ? rnd.frac() : Math.random();

        // 既に登録済みならスキップ
        if (!scene.textures.exists('tex_tree_canopy')) {
            this.createCanopyTexture(scene, 'tex_tree_canopy', {
                base: '#2f7d32',
                mid: '#3fa34d',
                highlight: '#9ccc65',
                stroke: '#1b5e20'
            }, rand);
        }

        if (!scene.textures.exists('tex_tree_dead')) {
            this.createCanopyTexture(scene, 'tex_tree_dead', {
                base: '#4a372d',
                mid: '#5c4538',
                highlight: '#7d5a46',
                stroke: '#2c1f18'
            }, rand);
        }

        if (!scene.textures.exists('tex_bush')) {
            this.createBushTexture(scene, 'tex_bush', {
                base: '#3b7a42',
                mid: '#4caf50',
                highlight: '#9ad29f',
                stroke: '#2b5d2f'
            }, rand, 108);
        }

        if (!scene.textures.exists('tex_rock')) {
            this.createRockTexture(scene, 'tex_rock', {
                base: '#6d6d6d',
                mid: '#8d8d8d',
                highlight: '#b0bec5',
                shadow: '#4a4a4a'
            }, rand);
        }
    }

    static createCanopyTexture(scene, key, palette, randFn, size = 128) {
        const tex = scene.textures.createCanvas(key, size, size);
        const ctx = tex.getSourceImage().getContext('2d');
        const cx = size / 2;
        const cy = size / 2;
        const radius = size * 0.45;

        // ベース円
        const grd = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
        grd.addColorStop(0, palette.highlight);
        grd.addColorStop(0.35, palette.mid);
        grd.addColorStop(1, palette.base);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // ノイズ葉
        for (let i = 0; i < 120; i++) {
            const angle = randFn() * Math.PI * 2;
            const dist = radius * (0.15 + randFn() * 0.85);
            const px = cx + Math.cos(angle) * dist;
            const py = cy + Math.sin(angle) * dist;
            const r = size * 0.02 + randFn() * size * 0.025;
            ctx.fillStyle = randFn() > 0.5 ? palette.highlight : palette.mid;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // 輪郭
        ctx.strokeStyle = palette.stroke;
        ctx.lineWidth = size * 0.04;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.98, 0, Math.PI * 2);
        ctx.stroke();

        tex.refresh();
    }

    static createBushTexture(scene, key, palette, randFn, size = 110) {
        const tex = scene.textures.createCanvas(key, size, size);
        const ctx = tex.getSourceImage().getContext('2d');
        const cx = size / 2;
        const cy = size / 2;
        const radius = size * 0.45;

        // 低めで横に広いシルエット
        const grd = ctx.createRadialGradient(cx, cy + radius * 0.2, radius * 0.15, cx, cy, radius);
        grd.addColorStop(0, palette.highlight);
        grd.addColorStop(0.35, palette.mid);
        grd.addColorStop(1, palette.base);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(cx, cy + size * 0.05, radius * 1.05, radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // 草の刃先
        ctx.strokeStyle = palette.highlight;
        ctx.lineWidth = size * 0.018;
        for (let i = 0; i < 90; i++) {
            const angle = randFn() * Math.PI * 2;
            const dist = radius * (0.35 + randFn() * 0.7);
            const baseX = cx + Math.cos(angle) * dist * 0.7;
            const baseY = cy + Math.sin(angle) * dist * 0.5;
            const tipLen = size * 0.12 + randFn() * size * 0.06;
            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.lineTo(baseX + Math.cos(angle) * tipLen, baseY + Math.sin(angle) * tipLen * 0.6);
            ctx.stroke();
        }

        // 外周の暗い葉影
        ctx.strokeStyle = palette.stroke;
        ctx.lineWidth = size * 0.035;
        ctx.beginPath();
        ctx.ellipse(cx, cy + size * 0.05, radius * 1.02, radius * 0.78, 0, 0, Math.PI * 2);
        ctx.stroke();

        tex.refresh();
    }

    static createRockTexture(scene, key, palette, randFn, size = 128) {
        const tex = scene.textures.createCanvas(key, size, size);
        const ctx = tex.getSourceImage().getContext('2d');
        const cx = size / 2;
        const cy = size / 2;
        const radius = size * 0.42;

        const grd = ctx.createRadialGradient(cx - size * 0.08, cy - size * 0.1, radius * 0.2, cx, cy, radius);
        grd.addColorStop(0, palette.highlight);
        grd.addColorStop(0.3, palette.mid);
        grd.addColorStop(1, palette.base);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // クラック
        ctx.strokeStyle = palette.shadow;
        ctx.lineWidth = size * 0.02;
        for (let i = 0; i < 4; i++) {
            const angle = randFn() * Math.PI * 2;
            const len = radius * (0.6 + randFn() * 0.3);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
            ctx.stroke();
        }

        tex.refresh();
    }
}

window.SpriteFactory = SpriteFactory;
