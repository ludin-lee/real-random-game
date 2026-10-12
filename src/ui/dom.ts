import { BUD_COLORS } from '../render/theme';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

export function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

export function budSvg(type: number): string {
  const p = BUD_COLORS[type] ?? BUD_COLORS[1];
  const petals = [0, 1, 2, 3, 4]
    .map((i) => {
      const a = (i / 5) * 360 - 90;
      const rad = (a * Math.PI) / 180;
      return `<ellipse cx="${12 + Math.cos(rad) * 5.5}" cy="${12 + Math.sin(rad) * 5.5}" rx="5.5" ry="4" transform="rotate(${a} ${12 + Math.cos(rad) * 5.5} ${12 + Math.sin(rad) * 5.5})" fill="${p.petal}"/>`;
    })
    .join('');
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${petals}<circle cx="12" cy="12" r="4" fill="${p.center}"/></svg>`;
}

let toastTimer = 0;
export function toast(msg: string, ms = 1600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
}
