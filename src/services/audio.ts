/**
 * Procedural audio: every SFX and the ambient music are synthesized with WebAudio,
 * so the game ships with zero audio assets (tiny download, no licensing).
 * Pentatonic scale everywhere => any combination of sounds stays consonant.
 */
const PENTA = [0, 2, 4, 7, 9];
let ctx: AudioContext | null = null;
let sfxGain: GainNode;
let musicGain: GainNode;
let soundOn = true;
let musicOn = true;
let musicTimer = 0;

function note(semitone: number, base = 523.25) {
  return base * Math.pow(2, semitone / 12);
}

function scale(step: number) {
  const oct = Math.floor(step / PENTA.length);
  return PENTA[((step % PENTA.length) + PENTA.length) % PENTA.length] + oct * 12;
}

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  sfxGain = ctx.createGain();
  sfxGain.gain.value = soundOn ? 0.5 : 0;
  sfxGain.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = musicOn ? 0.12 : 0;
  musicGain.connect(ctx.destination);
  startMusic();
}

export function setSound(on: boolean) {
  soundOn = on;
  if (ctx) sfxGain.gain.value = on ? 0.5 : 0;
}

export function setMusic(on: boolean) {
  musicOn = on;
  if (ctx) musicGain.gain.setTargetAtTime(on ? 0.12 : 0, ctx.currentTime, 0.3);
}

export function suspendAudio() {
  ctx?.suspend();
}
export function resumeAudio() {
  ctx?.resume();
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; delay?: number; out?: GainNode; glide?: number } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.glide) osc.frequency.exponentialRampToValueAtTime(freq * opts.glide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.4, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(opts.out ?? sfxGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  pick() {
    tone(note(7, 440), 0.07, { type: 'triangle', vol: 0.15 });
  },
  place() {
    tone(note(0, 196), 0.12, { type: 'triangle', vol: 0.45, glide: 0.7 });
    tone(note(12, 392), 0.05, { type: 'sine', vol: 0.12 });
  },
  invalid() {
    tone(160, 0.12, { type: 'square', vol: 0.06, glide: 0.8 });
  },
  clear(lines: number, combo: number) {
    const start = Math.min(combo - 1, 8);
    const count = 3 + Math.min(lines, 4);
    for (let i = 0; i < count; i++) {
      tone(note(scale(start + i)), 0.35, { type: 'sine', vol: 0.28, delay: i * 0.055 });
      tone(note(scale(start + i) + 12), 0.2, { type: 'triangle', vol: 0.07, delay: i * 0.055 });
    }
  },
  gem() {
    tone(note(scale(10)), 0.25, { type: 'sine', vol: 0.2 });
    tone(note(scale(12)), 0.3, { type: 'sine', vol: 0.18, delay: 0.07 });
  },
  allClear() {
    for (let i = 0; i < 10; i++) tone(note(scale(i)), 0.5, { type: 'sine', vol: 0.22, delay: i * 0.05 });
  },
  over() {
    [4, 2, 0, -3].forEach((s, i) => tone(note(scale(s), 392), 0.4, { type: 'triangle', vol: 0.25, delay: i * 0.16 }));
  },
  win() {
    [0, 2, 4, 5, 7].forEach((s, i) => tone(note(scale(s)), 0.45, { type: 'triangle', vol: 0.25, delay: i * 0.1 }));
  },
  button() {
    tone(note(scale(5)), 0.06, { type: 'sine', vol: 0.15 });
  },
  coin() {
    tone(1318, 0.08, { type: 'square', vol: 0.05 });
    tone(1760, 0.18, { type: 'square', vol: 0.05, delay: 0.06 });
  },
};

/** Gentle generative music box: I–vi–IV–V over a pentatonic melody. */
function startMusic() {
  const chords = [0, 9, 5, 7];
  let beat = 0;
  const step = () => {
    if (!ctx || ctx.state !== 'running') return;
    const chord = chords[Math.floor(beat / 8) % chords.length];
    if (beat % 8 === 0) {
      tone(note(chord - 24), 3.2, { type: 'sine', vol: 0.5, out: musicGain });
      tone(note(chord - 17), 3.2, { type: 'sine', vol: 0.3, out: musicGain });
    }
    if (Math.random() < 0.55) {
      tone(note(scale(Math.floor(Math.random() * 8))), 1.2, { type: 'triangle', vol: 0.35, out: musicGain });
    }
    beat++;
  };
  clearInterval(musicTimer);
  musicTimer = window.setInterval(step, 420);
}
