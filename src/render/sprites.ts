import { BLOCK_COLORS, BUD_COLORS } from './theme';

/** Pre-rendered block sprites keyed by color+size: one drawImage per cell per frame. */
const cache = new Map<string, HTMLCanvasElement>();

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function blockSprite(color: number, size: number, dpr: number): HTMLCanvasElement {
  const px = Math.max(4, Math.round(size * dpr));
  const key = `${color}:${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  const pal = BLOCK_COLORS[color] ?? BLOCK_COLORS[1];
  const inset = px * 0.04;
  const s = px - inset * 2;
  const r = s * 0.2;

  // Body
  const grad = g.createLinearGradient(0, inset, 0, inset + s);
  grad.addColorStop(0, pal.light);
  grad.addColorStop(0.45, pal.base);
  grad.addColorStop(1, pal.dark);
  g.fillStyle = grad;
  roundRect(g, inset, inset, s, s, r);
  g.fill();

  // Inner bevel
  g.lineWidth = Math.max(1, px * 0.05);
  g.strokeStyle = 'rgba(255,255,255,0.28)';
  roundRect(g, inset + px * 0.07, inset + px * 0.07, s - px * 0.14, s - px * 0.14, r * 0.7);
  g.stroke();

  // Gloss
  g.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(g, inset + s * 0.18, inset + s * 0.12, s * 0.38, s * 0.14, s * 0.07);
  g.fill();

  if (color === 8) {
    // Stone speckles
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (const [x, y, rr] of [
      [0.3, 0.6, 0.06],
      [0.65, 0.4, 0.05],
      [0.7, 0.72, 0.08],
    ]) {
      g.beginPath();
      g.arc(px * x, px * y, px * rr, 0, Math.PI * 2);
      g.fill();
    }
  }
  cache.set(key, c);
  return c;
}

export function drawBud(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, type: number, open = 0) {
  const pal = BUD_COLORS[type] ?? BUD_COLORS[1];
  const petals = 5;
  const pr = r * (0.5 + open * 0.15);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = r * 0.3;
  ctx.fillStyle = pal.petal;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r * 0.48, Math.sin(a) * r * 0.48, pr, pr * 0.72, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = pal.center;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(-r * 0.1, -r * 0.1, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function clearSpriteCache() {
  cache.clear();
}
