import { DAILY_MEDALS, dateKey } from '../core/levels';
import type { GameState } from '../core/game';
import { config } from '../meta/remoteConfig';
import { t } from '../meta/i18n';
import { save } from '../meta/save';
import { PRODUCTS } from '../services/iap';
import { budSvg, esc, fmt } from './dom';

const coinPill = () => `<div class="coin-pill" data-coins><span class="coin"></span><span>${fmt(save().coins)}</span></div>`;

export function homeScreen(): string {
  const s = save();
  const L = t();
  const key = dateKey();
  const dailyBest = s.daily.best[key] ?? 0;
  const medal = DAILY_MEDALS.filter((m) => dailyBest >= m).length;
  const dailyLine =
    medal > 0
      ? `${['🥉', '🥈', '🥇'][medal - 1]} ${fmt(dailyBest)} · ${L.streak} ${s.daily.streak}${L.days}`
      : `${L.dailyTarget} ${fmt(DAILY_MEDALS[0])} · ${L.streak} ${s.daily.streak}${L.days}`;
  const totalStars = Object.values(s.stars).reduce((a, b) => a + b, 0);
  const banner = config().eventBanner ? `<div class="banner">${esc(config().eventBanner)}</div>` : '';
  const resume = (m: 'classic' | 'adventure' | 'daily') => (s.runs[m]?.status === 'playing' ? ` · ${L.resume}` : '');
  return `
  <div class="screen home" data-screen="home">
    <div class="topbar">
      <button class="icon-btn" data-action="settings" aria-label="${L.settings}">⚙️</button>
      <div style="display:flex;gap:8px;align-items:center">${coinPill()}<button class="icon-btn" data-action="shop" aria-label="${L.shop}">🛍️</button></div>
    </div>
    <div class="logo">
      <div class="logo-blocks"><span style="background:#ff5d8f"></span><span style="background:#ffd23f"></span><span style="background:#5fd068"></span><span style="background:#4cc9f0"></span></div>
      <h1>${L.title}</h1>
      <p>${L.subtitle}</p>
    </div>
    ${banner}
    <div class="modes">
      <button class="mode-card classic" data-action="play" data-mode="classic">
        <span class="emoji">🌸</span>
        <span><h2>${L.classic}</h2><p>${L.best} ${fmt(s.best)}${resume('classic')}</p></span><span class="go">›</span>
      </button>
      <button class="mode-card adventure" data-action="play" data-mode="adventure">
        <span class="emoji">🌿</span>
        <span><h2>${L.adventure}</h2><p>${L.level} ${s.adventureLevel} · ⭐ ${totalStars}${resume('adventure')}</p></span><span class="go">›</span>
      </button>
      <button class="mode-card daily" data-action="play" data-mode="daily">
        <span class="emoji">🌻</span>
        <span><h2>${L.daily}</h2><p>${dailyLine}${resume('daily')}</p></span><span class="go">›</span>
      </button>
    </div>
    <div class="foot">Bloom Blocks v${__APP_VERSION__}</div>
  </div>`;
}

export function hud(s: GameState): string {
  const L = t();
  let sub = '';
  if (s.mode === 'adventure') {
    sub = `<div class="hud-sub">${L.level} <b>${s.level}</b></div><div class="goals">${s.goals
      .map((g) => `<div class="goal ${g.have >= g.need ? 'done' : ''}" data-gem="${g.gem}">${budSvg(g.gem)}<span>${g.have >= g.need ? '✓' : g.need - g.have}</span></div>`)
      .join('')}</div>`;
  } else if (s.mode === 'daily') {
    const next = DAILY_MEDALS.find((m) => s.score < m);
    sub = `<div class="hud-sub">${L.daily} · ${next ? `${L.dailyTarget} <b>${fmt(next)}</b>` : '🥇'}</div>`;
  } else {
    sub = `<div class="hud-sub">👑 ${L.best} <b data-best>${fmt(Math.max(save().best, s.score))}</b></div>`;
  }
  return `
    <button class="icon-btn" data-action="pause" aria-label="${L.paused}">⏸</button>
    <div class="hud-center">
      <div class="hud-score" data-score>${fmt(s.score)}</div>
      ${sub}
      <div class="combo-chip ${s.combo >= 2 ? '' : 'hidden'}" data-combo>${L.combo} ×${s.combo}</div>
    </div>
    ${coinPill()}`;
}

export function powerbar(hammerActive: boolean): string {
  const s = save();
  const c = config().costs;
  const badge = (n: number, cost: number) => (n > 0 ? `<span class="badge">${n}</span>` : `<span class="badge cost">${cost}</span>`);
  return `
    <button class="power ${hammerActive ? 'active' : ''}" data-action="hammer" aria-label="${t().hammer}">🔨${badge(s.inventory.hammer, c.hammer)}</button>
    <button class="power" data-action="shuffle" aria-label="${t().shuffle}">🔄${badge(s.inventory.shuffle, c.shuffle)}</button>`;
}

export function sheet(inner: string, extraClass = ''): string {
  return `<div class="sheet-wrap" data-sheet><div class="sheet ${extraClass}">${inner}</div></div>`;
}

export function pauseSheet(): string {
  const L = t();
  return sheet(`<h2>${L.paused}</h2>
    <div class="col">
      <button class="btn green" data-action="resume">▶ ${L.resume}</button>
      <button class="btn lav" data-action="restart">↻ ${L.restart}</button>
      <button class="btn" data-action="settings">⚙️ ${L.settings}</button>
      <button class="btn ghost" data-action="home">${L.home}</button>
    </div>`);
}

export function reviveSheet(s: GameState): string {
  const L = t();
  const cost = config().costs.revive;
  return sheet(`<h2>${s.mode === 'adventure' ? L.levelFail : L.gameOver}</h2>
    <div class="big">${fmt(s.score)}</div>
    <div class="col">
      <button class="btn green" data-action="revive-ad"><span class="ad-icon">AD</span> ${L.reviveAd}</button>
      <button class="btn" data-action="revive-coins" ${save().coins < cost ? 'disabled' : ''}><span class="coin"></span> ${cost} · ${L.reviveCoins}</button>
      <button class="btn ghost" data-action="decline-revive">${L.noThanks}</button>
    </div>`);
}

export function resultSheet(s: GameState, info: { newBest: boolean; coins: number; medal: number; doubled: boolean }): string {
  const L = t();
  const medalLine =
    s.mode === 'daily'
      ? `<div class="muted">${info.medal > 0 ? `${['🥉', '🥈', '🥇'][info.medal - 1]} ${L.medal[info.medal - 1]}` : `${L.dailyTarget} ${fmt(DAILY_MEDALS[0])}`}</div>`
      : '';
  const again = s.mode === 'daily' ? '' : `<button class="btn green" data-action="again">↻ ${L.playAgain}</button>`;
  return sheet(`<h2>${L.score}</h2>
    <div class="big">${fmt(s.score)}</div>
    ${info.newBest ? `<div class="badge-new">👑 ${L.newBest}</div>` : `<div class="muted">${L.best} ${fmt(save().best)}</div>`}
    ${medalLine}
    ${info.coins > 0 ? `<div class="reward"><span class="coin"></span> +${info.coins}</div>` : ''}
    <div class="col">
      ${info.coins > 0 && !info.doubled ? `<button class="btn lav" data-action="double"><span class="ad-icon">AD</span> ${L.doubleCoins}</button>` : ''}
      ${again}
      <button class="btn ${again ? 'ghost' : 'green'}" data-action="home">${L.home}</button>
    </div>`);
}

export function winSheet(s: GameState, stars: number, coins: number, doubled: boolean): string {
  const L = t();
  const st = [1, 2, 3].map((i) => `<span class="${i <= stars ? '' : 'off'}">⭐</span>`).join('');
  return sheet(`<h2>${L.levelClear}</h2>
    <div class="muted">${L.level} ${s.level} · ${L.moves} ${s.moves}</div>
    <div class="stars">${st}</div>
    <div class="reward"><span class="coin"></span> +${coins}</div>
    <div class="col">
      ${!doubled ? `<button class="btn lav" data-action="double"><span class="ad-icon">AD</span> ${L.doubleCoins}</button>` : ''}
      <button class="btn green" data-action="next">${L.next} ›</button>
      <button class="btn ghost" data-action="home">${L.home}</button>
    </div>`);
}

export function failSheet(s: GameState): string {
  const L = t();
  const left = s.goals.map((g) => `<div class="goal">${budSvg(g.gem)}<span>${Math.max(0, g.need - g.have)}</span></div>`).join('');
  return sheet(`<h2>${L.levelFail}</h2>
    <div class="muted">${L.level} ${s.level}</div>
    <div class="goals">${left}</div>
    <div class="col">
      <button class="btn green" data-action="again">↻ ${L.retry}</button>
      <button class="btn ghost" data-action="home">${L.home}</button>
    </div>`);
}

export function settingsSheet(): string {
  const L = t();
  const s = save().settings;
  const tog = (key: string, on: boolean) => `<button class="toggle ${on ? 'on' : ''}" data-action="toggle" data-key="${key}" aria-pressed="${on}"></button>`;
  return sheet(`<h2>${L.settings}</h2>
    <div class="settings-list">
      <div class="setting"><span>🔊 ${L.sound}</span>${tog('sound', s.sound)}</div>
      <div class="setting"><span>🎵 ${L.music}</span>${tog('music', s.music)}</div>
      <div class="setting"><span>📳 ${L.haptics}</span>${tog('haptics', s.haptics)}</div>
      <div class="setting"><span>🌐 ${L.language}</span><div class="seg"><button data-action="lang" data-lang="ko" class="${s.lang === 'ko' ? 'on' : ''}">한국어</button><button data-action="lang" data-lang="en" class="${s.lang === 'en' ? 'on' : ''}">EN</button></div></div>
    </div>
    <div class="col">
      <button class="btn ghost small" data-action="restore">${L.restore}</button>
      <button class="btn green" data-action="close">${L.close}</button>
    </div>`);
}

export function shopSheet(): string {
  const L = t();
  const s = save();
  const item = (id: keyof typeof PRODUCTS, ico: string, title: string, desc: string, featured = false, owned = false) =>
    `<div class="shop-item ${featured ? 'featured' : ''}"><div class="ico">${ico}</div><div class="info"><b>${title}</b><small>${desc}</small></div>${
      owned ? `<span class="muted">${L.owned}</span>` : `<button class="btn small" data-action="buy" data-product="${id}">${PRODUCTS[id].price}</button>`
    }</div>`;
  return sheet(`<h2>${L.shop}</h2>
    <div class="shop-list">
      ${s.starterBought ? '' : item('starter_pack', '🎁', L.starter, L.starterDesc, true)}
      ${item('remove_ads', '🚫', L.removeAds, '', false, s.removeAds)}
      ${item('coins_500', '🪙', L.coinsSmall, '')}
      ${item('coins_3000', '💰', L.coinsBig, '+20%')}
      <div class="shop-item"><div class="ico">🎬</div><div class="info"><b>${L.freeCoins}</b><small>+${config().rewards.adCoins}</small></div><button class="btn small green" data-action="free-coins"><span class="ad-icon">AD</span></button></div>
    </div>
    <div class="col"><button class="btn green" data-action="close">${L.close}</button></div>`);
}
