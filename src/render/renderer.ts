import { SIZE, idx } from '../core/board';
import type { GameState } from '../core/game';
import type { Piece } from '../core/generator';
import { getShape } from '../core/shapes';
import { blockSprite, drawBud, roundRect } from './sprites';
import { BLOCK_COLORS, BUD_COLORS, UI } from './theme';

export interface Layout {
  W: number;
  H: number;
  dpr: number;
  boardX: number;
  boardY: number;
  cell: number;
  boardSize: number;
  trayY: number;
  trayH: number;
  slotW: number;
  trayCell: number;
}

export interface DragView {
  slot: number;
  /** Top-left of the dragged piece, CSS px. */
  x: number;
  y: number;
  ghost: { row: number; col: number } | null;
  preview: { rows: number[]; cols: number[] } | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  life: number;
  max: number;
  kind: 'petal' | 'spark' | 'bud';
  bud?: number;
}

interface Floater {
  text: string;
  x: number;
  y: number;
  t0: number;
  dur: number;
  size: number;
  color: string;
}

interface Clearing {
  k: number;
  color: number;
  gem: number;
  t0: number;
}

const now = () => performance.now();
const easeOutBack = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  layout!: Layout;
  private pops = new Map<number, number>();
  private clearing: Clearing[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private shakeT0 = 0;
  private shakeMag = 0;
  private trayIn = new Map<number, number>();
  private returning: { slot: number; x: number; y: number; t0: number } | null = null;
  private motes = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.5, p: Math.random() * 6.28 }));
  hint: { slot: number; row: number; col: number } | null = null;
  hammerMode = false;
  /** Gem targets in screen space (HUD goal chips), so collected buds fly there. */
  gemTarget: (gem: number) => { x: number; y: number } | null = () => null;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(W: number, H: number, top: number, bottom: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    const avail = Math.max(200, bottom - top);
    const boardSize = Math.floor(Math.min(W - 28, 560, avail / 1.38));
    const cell = boardSize / SIZE;
    const trayH = Math.max(cell * 3.2, boardSize * 0.36);
    const used = boardSize + trayH;
    const boardY = top + Math.max(6, (avail - used) * 0.4);
    this.layout = {
      W,
      H,
      dpr,
      boardSize,
      cell,
      boardX: (W - boardSize) / 2,
      boardY,
      trayY: boardY + boardSize + 8,
      trayH,
      slotW: boardSize / 3,
      trayCell: cell * 0.58,
    };
  }

  // ---------- geometry helpers used by input ----------
  slotRect(slot: number) {
    const L = this.layout;
    return { x: L.boardX + L.slotW * slot, y: L.trayY, w: L.slotW, h: L.trayH };
  }

  slotAt(x: number, y: number): number {
    const L = this.layout;
    if (y < L.trayY - 10 || y > L.trayY + L.trayH + 20) return -1;
    if (x < L.boardX - 14 || x > L.boardX + L.boardSize + 14) return -1;
    return Math.max(0, Math.min(2, Math.floor((x - L.boardX) / L.slotW)));
  }

  cellAt(x: number, y: number): number {
    const L = this.layout;
    const c = Math.floor((x - L.boardX) / L.cell);
    const r = Math.floor((y - L.boardY) / L.cell);
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return -1;
    return idx(r, c);
  }

  /** Top-left (CSS px) where a tray piece is drawn at rest. */
  trayPiecePos(slot: number, p: Piece) {
    const s = getShape(p.shapeId);
    const L = this.layout;
    const r = this.slotRect(slot);
    return { x: r.x + (r.w - s.cols * L.trayCell) / 2, y: r.y + (r.h - s.rows * L.trayCell) / 2, cell: L.trayCell };
  }

  // ---------- effects API (driven by GameEvents) ----------
  pop(cells: number[]) {
    const t = now();
    for (const k of cells) this.pops.set(k, t);
  }

  clear(cells: Array<{ k: number; color: number; gem: number }>) {
    const t = now();
    const L = this.layout;
    for (const c of cells) {
      const r = Math.floor(c.k / SIZE);
      const col = c.k % SIZE;
      // Wave outward from the board centre so multi-line clears ripple.
      const d = Math.hypot(r - 3.5, col - 3.5);
      const delay = d * 28;
      this.clearing.push({ ...c, t0: t + delay });
      const cx = L.boardX + (col + 0.5) * L.cell;
      const cy = L.boardY + (r + 0.5) * L.cell;
      const pal = BLOCK_COLORS[c.color] ?? BLOCK_COLORS[1];
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 160;
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 120,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 10,
          size: L.cell * (0.16 + Math.random() * 0.14),
          color: i % 2 ? pal.light : pal.base,
          life: -delay / 1000,
          max: 0.9 + Math.random() * 0.5,
          kind: 'petal',
        });
      }
      if (c.gem) {
        const target = this.gemTarget(c.gem);
        this.particles.push({
          x: cx,
          y: cy,
          vx: target ? target.x : cx,
          vy: target ? target.y : cy - 200,
          rot: 0,
          vr: 0,
          size: L.cell * 0.45,
          color: BUD_COLORS[c.gem]?.petal ?? '#fff',
          life: -delay / 1000,
          max: 0.75,
          kind: 'bud',
          bud: c.gem,
        });
      }
    }
  }

  sparkle(x: number, y: number, n = 24, color = '#fff6c2') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 260;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: 0, vr: 0, size: 2 + Math.random() * 3, color, life: 0, max: 0.6 + Math.random() * 0.6, kind: 'spark' });
    }
  }

  /** Drop pending text so rapid clears don't stack unreadable labels. */
  clearFloaters() {
    this.floaters = [];
  }

  float(text: string, x: number, y: number, size = 28, color = '#fff', dur = 900) {
    this.floaters.push({ text, x, y, t0: now(), dur, size, color });
  }

  shake(mag: number) {
    this.shakeT0 = now();
    this.shakeMag = mag;
  }

  dealIn(slots: number[]) {
    const t = now();
    slots.forEach((s, i) => this.trayIn.set(s, t + i * 70));
  }

  returnToTray(slot: number, x: number, y: number) {
    this.returning = { slot, x, y, t0: now() };
  }

  get busy() {
    return this.clearing.length > 0 || this.particles.length > 0;
  }

  // ---------- frame ----------
  draw(s: GameState | null, drag: DragView | null, dt: number) {
    const { ctx } = this;
    const L = this.layout;
    const t = now();
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    this.drawBackground(t);
    if (!s) {
      this.drawParticles(dt);
      return;
    }

    ctx.save();
    if (this.shakeMag > 0) {
      const e = (t - this.shakeT0) / 380;
      if (e < 1) {
        const m = this.shakeMag * (1 - e);
        ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
      } else this.shakeMag = 0;
    }

    this.drawBoard(s, drag, t);
    this.drawTray(s, drag, t);
    ctx.restore();

    if (drag && s.tray[drag.slot]) {
      const p = s.tray[drag.slot]!;
      this.drawPiece(p, drag.x, drag.y, L.cell, 1, 1.0, true);
    }
    this.drawParticles(dt);
    this.drawFloaters(t);
  }

  private drawBackground(t: number) {
    const { ctx } = this;
    const L = this.layout;
    const g = ctx.createLinearGradient(0, 0, 0, L.H);
    g.addColorStop(0, UI.bgTop);
    g.addColorStop(1, UI.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L.W, L.H);
    // Fireflies
    for (const m of this.motes) {
      const y = ((m.y - t * 0.000012 * m.s) % 1 + 1) % 1;
      const x = m.x + Math.sin(t * 0.0006 + m.p) * 0.02;
      const a = 0.25 + 0.25 * Math.sin(t * 0.002 + m.p);
      ctx.fillStyle = `rgba(255,236,170,${a})`;
      ctx.beginPath();
      ctx.arc(x * L.W, y * L.H, m.s * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBoard(s: GameState, drag: DragView | null, t: number) {
    const { ctx } = this;
    const L = this.layout;
    const pad = L.cell * 0.18;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = UI.panel;
    roundRect(ctx, L.boardX - pad, L.boardY - pad, L.boardSize + pad * 2, L.boardSize + pad * 2, L.cell * 0.4);
    ctx.fill();
    ctx.restore();

    // Empty slots
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const x = L.boardX + c * L.cell;
        const y = L.boardY + r * L.cell;
        ctx.fillStyle = (r + c) % 2 ? UI.slot : UI.slotEdge;
        roundRect(ctx, x + L.cell * 0.06, y + L.cell * 0.06, L.cell * 0.88, L.cell * 0.88, L.cell * 0.18);
        ctx.fill();
      }
    }

    const dragPiece = drag ? s.tray[drag.slot] : null;
    const previewSet = new Set<number>();
    if (drag?.preview) {
      for (const r of drag.preview.rows) for (let c = 0; c < SIZE; c++) previewSet.add(idx(r, c));
      for (const c of drag.preview.cols) for (let r = 0; r < SIZE; r++) previewSet.add(idx(r, c));
    }

    // Filled cells
    for (let k = 0; k < SIZE * SIZE; k++) {
      const color = s.board.cells[k];
      if (!color) continue;
      const r = Math.floor(k / SIZE);
      const c = k % SIZE;
      let scale = 1;
      const p0 = this.pops.get(k);
      if (p0 !== undefined) {
        const e = (t - p0) / 220;
        if (e >= 1) this.pops.delete(k);
        else scale = 0.7 + 0.3 * easeOutBack(e);
      }
      const shown = previewSet.has(k) && dragPiece ? dragPiece.color : color;
      this.drawCell(L.boardX + c * L.cell, L.boardY + r * L.cell, L.cell, shown, scale, 1);
      if (s.board.gems[k]) drawBud(ctx, L.boardX + (c + 0.5) * L.cell, L.boardY + (r + 0.5) * L.cell, L.cell * 0.36, s.board.gems[k], 0.5 + 0.5 * Math.sin(t * 0.004 + k));
      if (this.hammerMode) {
        ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.3 * Math.sin(t * 0.008)})`;
        ctx.lineWidth = 2;
        roundRect(ctx, L.boardX + c * L.cell + 3, L.boardY + r * L.cell + 3, L.cell - 6, L.cell - 6, L.cell * 0.2);
        ctx.stroke();
      }
    }

    // Ghost
    if (drag?.ghost && dragPiece) {
      const sh = getShape(dragPiece.shapeId);
      for (const [dr, dc] of sh.cells) {
        const x = L.boardX + (drag.ghost.col + dc) * L.cell;
        const y = L.boardY + (drag.ghost.row + dr) * L.cell;
        this.drawCell(x, y, L.cell, dragPiece.color, 1, 0.45);
      }
      if (previewSet.size) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.08 * Math.sin(t * 0.012)})`;
        for (const k of previewSet) {
          const r = Math.floor(k / SIZE);
          const c = k % SIZE;
          roundRect(ctx, L.boardX + c * L.cell + 2, L.boardY + r * L.cell + 2, L.cell - 4, L.cell - 4, L.cell * 0.2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // Idle hint
    if (this.hint && !drag && s.tray[this.hint.slot]) {
      const p = s.tray[this.hint.slot]!;
      const sh = getShape(p.shapeId);
      const a = 0.18 + 0.18 * Math.sin(t * 0.006);
      for (const [dr, dc] of sh.cells) {
        this.drawCell(L.boardX + (this.hint.col + dc) * L.cell, L.boardY + (this.hint.row + dr) * L.cell, L.cell, p.color, 1, a);
      }
    }

    // Clearing animation
    this.clearing = this.clearing.filter((c) => {
      const e = (t - c.t0) / 320;
      if (e >= 1) return false;
      const r = Math.floor(c.k / SIZE);
      const col = c.k % SIZE;
      const x = L.boardX + col * L.cell;
      const y = L.boardY + r * L.cell;
      if (e < 0) {
        this.drawCell(x, y, L.cell, c.color, 1, 1);
        return true;
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - e;
      ctx.fillStyle = '#fff';
      roundRect(ctx, x + 2, y + 2, L.cell - 4, L.cell - 4, L.cell * 0.2);
      ctx.fill();
      ctx.restore();
      this.drawCell(x, y, L.cell, c.color, 1 + e * 0.35, 1 - e);
      return true;
    });
  }

  private drawCell(x: number, y: number, size: number, color: number, scale: number, alpha: number) {
    const { ctx } = this;
    const L = this.layout;
    const spr = blockSprite(color, size, L.dpr);
    const s = size * scale;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(spr, x + (size - s) / 2, y + (size - s) / 2, s, s);
    ctx.globalAlpha = 1;
  }

  private drawPiece(p: Piece, x: number, y: number, cell: number, scale: number, alpha: number, lifted = false) {
    const sh = getShape(p.shapeId);
    const { ctx } = this;
    if (lifted) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 10;
    }
    sh.cells.forEach(([dr, dc], i) => {
      this.drawCell(x + dc * cell, y + dr * cell, cell, p.color, scale, alpha);
      if (i === p.gemCell && p.gem) drawBud(ctx, x + (dc + 0.5) * cell, y + (dr + 0.5) * cell, cell * 0.36, p.gem, 0.5);
    });
    if (lifted) ctx.restore();
  }

  private drawTray(s: GameState, drag: DragView | null, t: number) {
    const L = this.layout;
    s.tray.forEach((p, slot) => {
      if (!p || drag?.slot === slot) return;
      const pos = this.trayPiecePos(slot, p);
      let { x, y } = pos;
      let alpha = 1;
      let cell = pos.cell;
      const t0 = this.trayIn.get(slot);
      if (t0 !== undefined) {
        const e = (t - t0) / 360;
        if (e < 0) return;
        if (e >= 1) this.trayIn.delete(slot);
        else {
          x += (1 - easeOutBack(e)) * L.W * 0.6;
          alpha = Math.min(1, e * 2);
        }
      }
      if (this.returning?.slot === slot) {
        const e = (t - this.returning.t0) / 180;
        if (e >= 1) this.returning = null;
        else {
          const k = 1 - Math.pow(1 - e, 3);
          x = this.returning.x + (x - this.returning.x) * k;
          y = this.returning.y + (y - this.returning.y) * k;
          cell = L.cell + (pos.cell - L.cell) * k;
        }
      }
      const fits = this.canFitCache?.(slot) ?? true;
      this.drawPiece(p, x, y, cell, 1, fits ? alpha : alpha * 0.35);
    });
  }

  /** Set by the controller: dims tray pieces that can't be placed anywhere. */
  canFitCache: ((slot: number) => boolean) | null = null;

  private drawParticles(dt: number) {
    const { ctx } = this;
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      if (p.life < 0) return true;
      if (p.life >= p.max) return false;
      const e = p.life / p.max;
      if (p.kind === 'bud') {
        // Fly from (x,y) to target (vx,vy) on an arc.
        const k = e * e * (3 - 2 * e);
        const x = p.x + (p.vx - p.x) * k;
        const y = p.y + (p.vy - p.y) * k - Math.sin(k * Math.PI) * 80;
        drawBud(ctx, x, y, p.size * (1 + Math.sin(k * Math.PI) * 0.5), p.bud ?? 1, 1);
        return true;
      }
      p.vy += 520 * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      ctx.save();
      ctx.globalAlpha = 1 - e;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.kind === 'petal') {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1 - e * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return true;
    });
  }

  private drawFloaters(t: number) {
    const { ctx } = this;
    this.floaters = this.floaters.filter((f) => {
      const e = (t - f.t0) / f.dur;
      if (e >= 1) return false;
      const scale = e < 0.2 ? easeOutBack(e / 0.2) : 1;
      ctx.save();
      ctx.globalAlpha = e > 0.7 ? 1 - (e - 0.7) / 0.3 : 1;
      ctx.translate(f.x, f.y - e * 40);
      ctx.scale(scale, scale);
      ctx.font = `900 ${f.size}px "Baloo 2", "Jua", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, f.size * 0.16);
      ctx.strokeStyle = 'rgba(30,16,70,0.85)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
      return true;
    });
  }
}
