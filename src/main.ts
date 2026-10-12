import './style.css';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { App } from './app';
import { bestMove } from './core/bot';
import { place } from './core/game';
import { loadRemoteConfig, tuning } from './meta/remoteConfig';
import { loadSave, persist, save } from './meta/save';
import { bufferedEvents, track } from './services/analytics';
import { resumeAudio, suspendAudio } from './services/audio';

loadSave();
loadRemoteConfig();
save().stats.sessions++;
persist();
track('app_open', { platform: Capacitor.getPlatform() });
track('session_start', { n: save().stats.sessions });

const app = new App(document.getElementById('game') as HTMLCanvasElement);

// Lifecycle: save + mute when backgrounded, never lose a run.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    app.pause();
    suspendAudio();
  } else resumeAudio();
});
window.addEventListener('pagehide', () => persist(true));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') app.back();
});

if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', () => {
    if (!app.back()) CapApp.exitApp();
  });
}

// Test/QA hooks (harness): deterministic driving of the real UI from Playwright.
if (import.meta.env.DEV || /[?&](e2e|debug)\b/.test(location.search)) {
  Object.assign(window, {
    __bloom: {
      app,
      save,
      events: bufferedEvents,
      /** Make the best bot move through the real event pipeline. */
      autoMove() {
        const g = app.game;
        if (!g || g.status !== 'playing') return false;
        const m = bestMove(g);
        if (!m) return false;
        const ev = place(g, m.slot, m.row, m.col, tuning());
        if (ev) app.handleEvents(ev);
        return !!ev;
      },
    },
  });
}
