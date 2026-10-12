import { SIZE, canPlace, fitsAnywhere, idx, previewClear } from './core/board';
import { bestMove } from './core/bot';
import {
  type GameEvent,
  type GameState,
  type Mode,
  canRevive,
  hammer,
  newGame,
  place,
  revive,
  shuffle,
  starsFor,
} from './core/game';
import { DAILY_MEDALS, dateKey } from './core/levels';
import { getShape } from './core/shapes';
import { setLang, t } from './meta/i18n';
import { config, tuning } from './meta/remoteConfig';
import { persist, save } from './meta/save';
import { type DragView, Renderer } from './render/renderer';
import { showInterstitial, showRewarded } from './services/ads';
import { track } from './services/analytics';
import { setMusic, setSound, sfx, unlockAudio } from './services/audio';
import { notify, setHaptics, tap } from './services/haptics';
import { type ProductId, purchase, restorePurchases } from './services/iap';
import { $, fmt, toast } from './ui/dom';
import * as UI from './ui/screens';

interface Drag extends DragView {
  pointerId: number;
  lift: number;
}

type Screen = 'home' | 'game';

export class App {
  renderer: Renderer;
  screen: Screen = 'home';
  game: GameState | null = null;
  private drag: Drag | null = null;
  private hammerMode = false;
  private shownScore = 0;
  private lastInput = performance.now();
  private runStart = 0;
  private result: { coins: number; doubled: boolean; newBest: boolean; medal: number; stars: number } | null = null;
  private tutorialStep = 0;
  private sheetStack: Array<() => string> = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.renderer.gemTarget = (gem) => {
      const el = document.querySelector(`.goal[data-gem="${gem}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + 14, y: r.top + r.height / 2 };
    };
    this.renderer.canFitCache = (slot) => {
      const p = this.game?.tray[slot];
      return !p || fitsAnywhere(this.game!.board, getShape(p.shapeId));
    };
    this.applySettings();
    this.bindInput();
    document.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('resize', () => this.layout());
    this.showHome();
    this.loop();
  }

  // ------------------------------------------------------------------ settings
  applySettings() {
    const st = save().settings;
    setLang(st.lang);
    document.documentElement.lang = st.lang;
    setSound(st.sound);
    setMusic(st.music);
    setHaptics(st.haptics);
  }

  // ------------------------------------------------------------------ layout & loop
  layout() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const hud = $('#hud');
    const bar = $('#powerbar');
    const top = hud.hidden ? 0 : hud.getBoundingClientRect().bottom + 6;
    const bottom = bar.hidden ? H : bar.getBoundingClientRect().top - 4;
    this.renderer.resize(W, H, top, bottom);
  }

  private loop() {
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.tick(now);
      this.renderer.draw(this.screen === 'game' ? this.game : null, this.drag, dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private tick(now: number) {
    const g = this.game;
    if (!g || this.screen !== 'game') return;
    // Count-up score
    if (this.shownScore !== g.score) {
      const diff = g.score - this.shownScore;
      this.shownScore += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.15));
      if ((diff > 0 && this.shownScore > g.score) || (diff < 0 && this.shownScore < g.score)) this.shownScore = g.score;
      const el = document.querySelector('[data-score]');
      if (el) el.textContent = fmt(this.shownScore);
    }
    // Idle hint after 12s (always on during tutorial)
    if (!this.drag && g.status === 'playing' && !this.renderer.hint && (this.tutorialStep === 1 || now - this.lastInput > 12000)) {
      const m = bestMove(g);
      if (m) this.renderer.hint = { slot: m.slot, row: m.row, col: m.col };
    }
  }

  // ------------------------------------------------------------------ screens
  showHome() {
    this.screen = 'home';
    this.game = null;
    this.drag = null;
    this.setHammer(false);
    $('#hud').hidden = true;
    $('#powerbar').hidden = true;
    $('#screens').innerHTML = UI.homeScreen();
    this.sheetStack = [];
    this.layout();
  }

  private openSheet(render: () => string) {
    this.sheetStack.push(render);
    this.renderSheets();
  }

  private closeSheet() {
    this.sheetStack.pop();
    this.renderSheets();
  }

  private renderSheets() {
    const base = this.screen === 'home' ? UI.homeScreen() : '';
    const top = this.sheetStack[this.sheetStack.length - 1];
    $('#screens').innerHTML = base + (top ? top() : '');
  }

  private refreshHud() {
    if (!this.game) return;
    $('#hud').innerHTML = UI.hud(this.game);
    const el = document.querySelector('[data-score]');
    if (el) el.textContent = fmt(this.shownScore);
    $('#powerbar').innerHTML = UI.powerbar(this.hammerMode);
  }

  private refreshCoins() {
    document.querySelectorAll('[data-coins] span:last-child').forEach((el) => (el.textContent = fmt(save().coins)));
  }

  // ------------------------------------------------------------------ run lifecycle
  startGame(mode: Mode, fresh = false) {
    unlockAudio();
    const s = save();
    const cfgT = tuning();
    const key = dateKey();
    let g = fresh ? undefined : s.runs[mode];
    if (g && (g.status !== 'playing' || (mode === 'daily' && g.dailyKey !== key) || (mode === 'adventure' && g.level !== s.adventureLevel))) g = undefined;
    if (!g) {
      g = newGame({ mode, level: s.adventureLevel, dailyKey: key }, cfgT);
      if (mode === 'classic' && !s.tutorialDone) this.setupTutorial(g);
      track(mode === 'adventure' ? 'level_start' : 'game_start', { mode, level: g.level });
    }
    s.runs[mode] = g;
    persist();
    this.game = g;
    this.screen = 'game';
    this.result = null;
    this.shownScore = g.score;
    this.runStart = Date.now();
    this.lastInput = performance.now();
    this.renderer.hint = null;
    this.sheetStack = [];
    $('#screens').innerHTML = '';
    $('#hud').hidden = false;
    $('#powerbar').hidden = false;
    this.refreshHud();
    this.layout();
    this.renderer.dealIn([0, 1, 2]);
    if (this.tutorialStep === 1) this.showTutorial(t().tutorial);
  }

  private setupTutorial(g: GameState) {
    // A friendly scripted opening: bottom row needs exactly the first piece.
    for (let c = 0; c < SIZE; c++) if (c !== 3 && c !== 4) g.board.cells[idx(7, c)] = 1 + (c % 7);
    for (let c = 0; c < SIZE; c++) if (c < 2 || c > 5) g.board.cells[idx(6, c)] = 1 + ((c + 3) % 7);
    g.tray = [
      { shapeId: 'h2', color: 3, gemCell: -1, gem: 0 },
      { shapeId: 'h4', color: 5, gemCell: -1, gem: 0 },
      { shapeId: 'o2', color: 1, gemCell: -1, gem: 0 },
    ];
    this.tutorialStep = 1;
    track('tutorial_begin');
  }

  private showTutorial(text: string) {
    document.querySelector('.tutorial')?.remove();
    const el = document.createElement('div');
    el.className = 'tutorial';
    el.textContent = text;
    $('#screens').appendChild(el);
  }

  private finishTutorialStep() {
    if (this.tutorialStep === 1) {
      this.tutorialStep = 2;
      this.showTutorial(t().tutorial2);
      setTimeout(() => {
        document.querySelector('.tutorial')?.remove();
        this.tutorialStep = 0;
      }, 3200);
      save().tutorialDone = true;
      track('tutorial_complete');
    }
  }

  /** Called once when a run is truly finished (no revive taken). Grants rewards. */
  private finalizeRun() {
    const g = this.game!;
    const s = save();
    const cfg = config();
    const mult = cfg.coinMultiplier;
    let coins = 0;
    let newBest = false;
    let medal = 0;
    let stars = 0;
    s.stats.runs++;
    s.stats.runsSinceAd++;
    s.stats.lines += g.lines;

    if (g.mode === 'adventure') {
      if (g.status === 'won') {
        stars = starsFor(g);
        s.stars[g.level] = Math.max(s.stars[g.level] ?? 0, stars);
        coins = Math.round((cfg.rewards.adventureWin + stars * cfg.rewards.perStar) * mult);
        s.adventureLevel = Math.max(s.adventureLevel, g.level + 1);
        track('level_complete', { level: g.level, stars, moves: g.moves });
      } else {
        track('level_fail', { level: g.level, moves: g.moves, revives: g.revives });
      }
    } else {
      newBest = g.score > s.best;
      if (g.mode === 'classic' && newBest) s.best = g.score;
      coins = Math.round(Math.min(150, Math.floor(g.score / 100) * cfg.rewards.classicPer100) * mult);
      if (g.mode === 'daily') {
        const key = g.dailyKey;
        s.daily.best[key] = Math.max(s.daily.best[key] ?? 0, g.score);
        medal = DAILY_MEDALS.filter((m) => s.daily.best[key] >= m).length;
        const claimed = s.daily.medalsClaimed[key] ?? 0;
        for (let i = claimed; i < medal; i++) coins += Math.round(cfg.rewards.dailyMedals[i] * mult);
        s.daily.medalsClaimed[key] = Math.max(claimed, medal);
        if (medal > 0 && s.daily.lastKey !== key) {
          const y = new Date();
          y.setDate(y.getDate() - 1);
          s.daily.streak = s.daily.lastKey === dateKey(y) ? s.daily.streak + 1 : 1;
          s.daily.lastKey = key;
          track('daily_complete', { medal, streak: s.daily.streak });
        }
        newBest = false;
      }
      track('game_end', { mode: g.mode, score: g.score, moves: g.moves, lines: g.lines, revives: g.revives, sec: Math.round((Date.now() - this.runStart) / 1000) });
    }
    s.coins += coins;
    if (coins) track('coins_earn', { source: g.mode, amount: coins });
    delete s.runs[g.mode];
    persist(true);
    this.result = { coins, doubled: false, newBest, medal, stars };
  }

  private showRunEnd() {
    const g = this.game!;
    const r = this.result!;
    if (g.mode === 'adventure') {
      this.openSheet(() => (g.status === 'won' ? UI.winSheet(g, r.stars, r.coins, r.doubled) : UI.failSheet(g)));
    } else {
      if (r.newBest) {
        this.renderer.sparkle(window.innerWidth / 2, window.innerHeight / 3, 60, '#ffd23f');
        notify('success');
      }
      this.openSheet(() => UI.resultSheet(g, r));
    }
  }

  private async maybeInterstitial() {
    const s = save();
    const c = config();
    if (s.removeAds) return;
    if (s.stats.runs < c.interstitialGraceRuns) return;
    if (s.stats.runsSinceAd < c.interstitialEvery) return;
    if (Date.now() - s.stats.lastAdAt < c.interstitialCooldownSec * 1000) return;
    s.stats.runsSinceAd = 0;
    s.stats.lastAdAt = Date.now();
    persist();
    await showInterstitial('run_end');
  }

  // ------------------------------------------------------------------ input
  private bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e, true));
  }

  private onDown(e: PointerEvent) {
    unlockAudio();
    const g = this.game;
    this.lastInput = performance.now();
    this.renderer.hint = null;
    if (!g || this.screen !== 'game' || g.status !== 'playing' || this.sheetStack.length || this.drag) return;
    if (this.hammerMode) {
      const k = this.renderer.cellAt(e.clientX, e.clientY);
      if (k >= 0 && g.board.cells[k]) this.useHammer(k);
      return;
    }
    const slot = this.renderer.slotAt(e.clientX, e.clientY);
    if (slot < 0 || !g.tray[slot]) return;
    const L = this.renderer.layout;
    const lift = e.pointerType === 'mouse' ? L.cell * 0.3 : L.cell * 1.3;
    this.drag = { slot, x: 0, y: 0, ghost: null, preview: null, pointerId: e.pointerId, lift };
    this.canvas.setPointerCapture(e.pointerId);
    sfx.pick();
    tap('light');
    this.onMove(e);
  }

  private onMove(e: PointerEvent) {
    const d = this.drag;
    const g = this.game;
    if (!d || !g || e.pointerId !== d.pointerId) return;
    const p = g.tray[d.slot]!;
    const sh = getShape(p.shapeId);
    const L = this.renderer.layout;
    d.x = e.clientX - (sh.cols * L.cell) / 2;
    d.y = e.clientY - sh.rows * L.cell - d.lift;
    const col = Math.round((d.x - L.boardX) / L.cell);
    const row = Math.round((d.y - L.boardY) / L.cell);
    const prev = d.ghost;
    d.ghost = null;
    d.preview = null;
    // Snap tolerance: also try neighbours so near-misses still land.
    for (const [dr, dc] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (canPlace(g.board, sh, row + dr, col + dc)) {
        d.ghost = { row: row + dr, col: col + dc };
        break;
      }
    }
    if (d.ghost) {
      const lc = previewClear(g.board, sh, d.ghost.row, d.ghost.col);
      if (lc.rows.length || lc.cols.length) d.preview = { rows: lc.rows, cols: lc.cols };
      if (!prev || prev.row !== d.ghost.row || prev.col !== d.ghost.col) tap('light');
    }
  }

  private onUp(e: PointerEvent, cancelled = false) {
    const d = this.drag;
    const g = this.game;
    if (!d || !g || e.pointerId !== d.pointerId) return;
    this.drag = null;
    if (!cancelled && d.ghost) {
      const events = place(g, d.slot, d.ghost.row, d.ghost.col, tuning());
      if (events) {
        this.handleEvents(events);
        return;
      }
    }
    this.renderer.returnToTray(d.slot, d.x, d.y);
  }

  // ------------------------------------------------------------------ events → juice
  handleEvents(events: GameEvent[]) {
    const g = this.game!;
    const L = this.renderer.layout;
    const s = save();
    s.runs[g.mode] = g;
    let refreshHud = false;

    for (const ev of events) {
      switch (ev.t) {
        case 'place':
          this.renderer.pop(ev.cells);
          sfx.place();
          tap('light');
          break;
        case 'clear': {
          this.renderer.clear(ev.cells);
          sfx.clear(ev.lines, ev.combo);
          tap(ev.lines >= 2 ? 'heavy' : 'medium');
          const cx = L.boardX + L.boardSize / 2;
          const cy = L.boardY + L.boardSize / 2;
          this.renderer.clearFloaters();
          const level = Math.min(4, ev.lines - 1 + Math.max(0, ev.combo - 1));
          if (ev.lines >= 2 || ev.combo >= 2) this.renderer.float(t().praise[level], cx, cy - L.cell * 0.8, 34 + level * 4, ['#ffe066', '#ffb3d1', '#9be8ff', '#c3b0ff', '#ffffff'][level], 1100);
          if (ev.combo >= 2) this.renderer.float(`${t().combo} ×${ev.combo}`, cx, cy + L.cell * 0.2, 24, '#ff9f43', 1000);
          this.renderer.float(`+${fmt(ev.points)}`, cx, cy + L.cell * 1.1, 22, '#ffffff', 900);
          if (ev.lines >= 3) this.renderer.shake(10);
          refreshHud = true;
          if (this.tutorialStep === 1) this.finishTutorialStep();
          break;
        }
        case 'allClear':
          this.renderer.float(t().allClear, L.boardX + L.boardSize / 2, L.boardY + L.boardSize / 2 - L.cell * 2, 44, '#ffe066', 1600);
          this.renderer.sparkle(L.boardX + L.boardSize / 2, L.boardY + L.boardSize / 2, 80);
          sfx.allClear();
          notify('success');
          break;
        case 'gems':
          setTimeout(() => {
            sfx.gem();
            this.refreshHud();
            for (const gem of new Set(ev.gems)) {
              const el = document.querySelector(`.goal[data-gem="${gem}"]`);
              el?.classList.add('bump');
              setTimeout(() => el?.classList.remove('bump'), 220);
            }
          }, 750);
          break;
        case 'deal':
          this.renderer.dealIn([0, 1, 2]);
          break;
        case 'comboLost':
          refreshHud = true;
          break;
        case 'revive':
          this.renderer.clear(ev.cells);
          break;
        case 'over':
          setTimeout(() => {
            sfx.over();
            notify('error');
            this.onStuck();
          }, 650);
          break;
        case 'won':
          setTimeout(() => {
            sfx.win();
            notify('success');
            this.renderer.sparkle(window.innerWidth / 2, window.innerHeight / 3, 70, '#9be8a1');
            this.finalizeRun();
            this.showRunEnd();
          }, 1100);
          break;
      }
    }
    if (refreshHud) this.refreshHud();
    persist();
  }

  private onStuck() {
    const g = this.game;
    if (!g || g.status !== 'over') return;
    if (canRevive(g, tuning())) this.openSheet(() => UI.reviveSheet(g));
    else this.endRun();
  }

  private endRun() {
    this.sheetStack = [];
    this.finalizeRun();
    this.showRunEnd();
  }

  private doRevive(source: 'ad' | 'coins') {
    const g = this.game!;
    track('revive', { mode: g.mode, source });
    this.sheetStack = [];
    this.renderSheets();
    this.handleEvents(revive(g, tuning()));
    this.refreshHud();
  }

  // ------------------------------------------------------------------ power-ups
  private spendOrConsume(kind: 'hammer' | 'shuffle'): boolean {
    const s = save();
    if (s.inventory[kind] > 0) {
      s.inventory[kind]--;
      return true;
    }
    const cost = config().costs[kind];
    if (s.coins >= cost) {
      s.coins -= cost;
      track('coins_spend', { sink: kind, amount: cost });
      this.refreshCoins();
      return true;
    }
    toast(t().notEnough);
    this.openSheet(() => UI.shopSheet());
    return false;
  }

  private setHammer(on: boolean) {
    this.hammerMode = on;
    this.renderer.hammerMode = on;
    if (this.game) $('#powerbar').innerHTML = UI.powerbar(on);
    if (on) toast(t().tapCell, 2000);
  }

  private useHammer(k: number) {
    const g = this.game!;
    if (!this.spendOrConsume('hammer')) return this.setHammer(false);
    const events = hammer(g, k, tuning());
    if (events) {
      track('powerup_use', { kind: 'hammer', mode: g.mode });
      this.renderer.shake(6);
      tap('heavy');
      sfx.place();
      this.handleEvents(events);
    }
    this.setHammer(false);
    this.refreshHud();
  }

  private useShuffle() {
    const g = this.game!;
    if (g.status !== 'playing') return;
    if (!this.spendOrConsume('shuffle')) return;
    track('powerup_use', { kind: 'shuffle', mode: g.mode });
    sfx.coin();
    const events = shuffle(g, tuning());
    if (events) this.handleEvents(events);
    this.refreshHud();
  }

  // ------------------------------------------------------------------ clicks
  private async onClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!el) return;
    unlockAudio();
    sfx.button();
    tap('light');
    const action = el.dataset.action!;
    const g = this.game;
    const s = save();
    switch (action) {
      case 'play':
        this.startGame(el.dataset.mode as Mode);
        break;
      case 'pause':
        this.setHammer(false);
        this.openSheet(() => UI.pauseSheet());
        break;
      case 'resume':
      case 'close':
        this.closeSheet();
        if (this.screen === 'home') this.renderSheets();
        break;
      case 'restart':
        if (g) {
          delete s.runs[g.mode];
          this.startGame(g.mode, true);
        }
        break;
      case 'home':
        if (this.result) await this.maybeInterstitial();
        persist(true);
        this.showHome();
        break;
      case 'again':
        await this.maybeInterstitial();
        if (g) this.startGame(g.mode, true);
        break;
      case 'next':
        await this.maybeInterstitial();
        this.startGame('adventure', true);
        break;
      case 'settings':
        this.openSheet(() => UI.settingsSheet());
        break;
      case 'shop':
        this.openSheet(() => UI.shopSheet());
        break;
      case 'toggle': {
        const key = el.dataset.key as 'sound' | 'music' | 'haptics';
        s.settings[key] = !s.settings[key];
        this.applySettings();
        persist();
        this.renderSheets();
        break;
      }
      case 'lang':
        s.settings.lang = el.dataset.lang as 'ko' | 'en';
        this.applySettings();
        persist();
        this.renderSheets();
        if (this.screen === 'game') this.refreshHud();
        break;
      case 'hammer':
        if (g?.status === 'playing') this.setHammer(!this.hammerMode);
        break;
      case 'shuffle':
        this.setHammer(false);
        this.useShuffle();
        break;
      case 'revive-ad':
        if (await showRewarded('revive')) this.doRevive('ad');
        break;
      case 'revive-coins':
        if (s.coins >= config().costs.revive) {
          s.coins -= config().costs.revive;
          track('coins_spend', { sink: 'revive', amount: config().costs.revive });
          this.doRevive('coins');
        }
        break;
      case 'decline-revive':
        this.endRun();
        break;
      case 'double':
        if (this.result && !this.result.doubled && (await showRewarded('double_coins'))) {
          s.coins += this.result.coins;
          this.result.doubled = true;
          this.result.coins *= 2;
          sfx.coin();
          persist();
          this.renderSheets();
        }
        break;
      case 'free-coins':
        if (await showRewarded('free_coins')) {
          s.coins += config().rewards.adCoins;
          sfx.coin();
          persist();
          this.renderSheets();
          this.refreshCoins();
        }
        break;
      case 'buy':
        await this.buy(el.dataset.product as ProductId);
        break;
      case 'restore': {
        const owned = await restorePurchases();
        if (owned.includes('remove_ads') || owned.includes('starter_pack')) s.removeAds = true;
        toast('✓');
        persist();
        break;
      }
    }
  }

  private async buy(id: ProductId) {
    const s = save();
    if (!(await purchase(id))) return;
    if (id === 'starter_pack') {
      s.starterBought = true;
      s.removeAds = true;
      s.coins += 1000;
      s.inventory.hammer += 5;
      s.inventory.shuffle += 5;
    } else if (id === 'remove_ads') s.removeAds = true;
    else if (id === 'coins_500') s.coins += 500;
    else if (id === 'coins_3000') s.coins += 3000;
    sfx.coin();
    notify('success');
    persist(true);
    this.renderSheets();
    this.refreshCoins();
    if (this.game) $('#powerbar').innerHTML = UI.powerbar(this.hammerMode);
  }

  /** Android back button / Escape. */
  back(): boolean {
    if (this.sheetStack.length) {
      const top = this.sheetStack[this.sheetStack.length - 1];
      // Run-end sheets must be answered; others can be dismissed.
      const html = top();
      if (/data-action="(revive-ad|next|again|decline-revive)"/.test(html)) return true;
      this.closeSheet();
      return true;
    }
    if (this.screen === 'game') {
      this.openSheet(() => UI.pauseSheet());
      return true;
    }
    return false;
  }

  pause() {
    persist(true);
    if (this.screen === 'game' && this.game?.status === 'playing' && !this.sheetStack.length) this.openSheet(() => UI.pauseSheet());
  }
}
