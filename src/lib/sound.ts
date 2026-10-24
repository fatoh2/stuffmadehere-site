/** Sound, off until switched on. Every cue is synthesised in the Web Audio API, so there are no files:
 *  the Geneva's index click, a pawl dropping behind a tooth, the cartridge's bang, the clatter of a flap,
 *  and the spindle's whine that follows the cutter. The switch is remembered per browser. */

const KEY = 'smh-sound';
let ctx: AudioContext | null = null;
let on = false;
let noiseBuf: AudioBuffer | null = null;
const listeners = new Set<(v: boolean) => void>();

try {
  on = localStorage.getItem(KEY) === 'on';
} catch {
  on = false;
}

function ensure(): AudioContext | null {
  if (!on) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = c.sampleRate * 0.5;
  noiseBuf = c.createBuffer(1, len, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** A burst of filtered noise: the body of every click, clatter and bang. */
function burst(c: AudioContext, seconds: number, gain: number, type: BiquadFilterType, freq: number, q = 1, at = 0): void {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  const t = c.currentTime + at;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + seconds);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
  src.stop(t + seconds + 0.02);
}

function thump(c: AudioContext, freq: number, seconds: number, gain: number, at = 0): void {
  const o = c.createOscillator();
  o.type = 'sine';
  const t = c.currentTime + at;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.4), t + seconds);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + seconds);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + seconds + 0.02);
}

export const cue = {
  /** the Geneva drive indexing: one dry click as the pin leaves the slot */
  index(): void {
    const c = ensure();
    if (!c) return;
    burst(c, 0.035, 0.18, 'bandpass', 2400, 2);
    thump(c, 180, 0.05, 0.08);
  },
  /** a pawl riding over a tooth and dropping: two clicks, the second lower */
  pawl(): void {
    const c = ensure();
    if (!c) return;
    burst(c, 0.02, 0.12, 'highpass', 3000);
    burst(c, 0.04, 0.2, 'bandpass', 1400, 3, 0.045);
  },
  /** the blank cartridge: a low thump under a short, dull crack */
  bang(strength = 1): void {
    const c = ensure();
    if (!c) return;
    burst(c, 0.14 * strength + 0.06, 0.45, 'lowpass', 900, 0.7);
    thump(c, 90, 0.22, 0.5);
  },
  /** one flap dropping on the board */
  flap(): void {
    const c = ensure();
    if (!c) return;
    burst(c, 0.018, 0.09, 'highpass', 2600);
  },
  /** the ball through the net */
  swish(): void {
    const c = ensure();
    if (!c) return;
    burst(c, 0.25, 0.1, 'bandpass', 1800, 0.6);
  },
};

/** The spindle: a whine that rises when the cutter is engaged and dies when it lifts. */
export function spindle(): { set(engaged: boolean): void; stop(): void } {
  let o: OscillatorNode | null = null;
  let g: GainNode | null = null;
  let f: BiquadFilterNode | null = null;
  const start = (c: AudioContext): void => {
    o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 140;
    f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    g = c.createGain();
    g.gain.value = 0.0001;
    o.connect(f).connect(g).connect(c.destination);
    o.start();
  };
  return {
    set(engaged) {
      const c = ensure();
      if (!c) return;
      if (!o) start(c);
      const t = c.currentTime;
      g!.gain.cancelScheduledValues(t);
      g!.gain.setTargetAtTime(engaged ? 0.05 : 0.012, t, 0.05);
      o!.frequency.setTargetAtTime(engaged ? 118 : 150, t, 0.08);
    },
    stop() {
      if (!o || !g || !ctx) return;
      const t = ctx.currentTime;
      g.gain.setTargetAtTime(0.0001, t, 0.08);
      o.stop(t + 0.5);
      o = null;
      g = null;
      f = null;
    },
  };
}

export function soundOn(): boolean {
  return on;
}

export function setSound(v: boolean): void {
  on = v;
  try {
    localStorage.setItem(KEY, v ? 'on' : 'off');
  } catch {
    /* fine */
  }
  if (v) {
    const c = ensure();
    if (c) cue.index();
  }
  listeners.forEach((l) => l(v));
}

/** The switch in the servo panel. */
export function mountSoundToggle(btns: HTMLButtonElement[]): void {
  for (const btn of btns) {
    const paint = (): void => {
      btn.setAttribute('aria-pressed', String(on));
      btn.textContent = on ? 'Sound on' : 'Sound off';
    };
    paint();
    listeners.add(paint);
    btn.addEventListener('click', () => setSound(!on));
  }
}
