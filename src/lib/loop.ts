/** One requestAnimationFrame loop for every mechanism. Each ticker can pause itself; the loop
 *  stops entirely when the tab is hidden. */
export type Ticker = (dt: number, now: number) => void;

const tickers = new Set<Ticker>();
let running = false;
let last = 0;
let frames = 0;
let lastDt = 0;
const stats = new Map<Ticker, { ms: number; n: number }>();
/** Debug: frame count, last dt and per-ticker cost (ms per call), reset on read. */
(window as unknown as { __loop: () => unknown }).__loop = () => {
  const out = { frames, lastDt, tickers: [...stats.entries()].map(([t, r]) => ({ name: t.name || 'anon', avgMs: +(r.ms / Math.max(1, r.n)).toFixed(2), n: r.n })) };
  frames = 0;
  stats.clear();
  return out;
};

function frame(now: number): void {
  if (!running) return;
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0) dt = 0;
  for (const t of tickers) {
    const t0 = performance.now();
    t(dt, now);
    const cost = performance.now() - t0;
    const rec = stats.get(t) ?? { ms: 0, n: 0 };
    rec.ms += cost;
    rec.n++;
    stats.set(t, rec);
  }
  frames++;
  lastDt = dt;
  if (tickers.size) requestAnimationFrame(frame);
  else running = false;
}

function start(): void {
  if (running || document.hidden) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

export function addTicker(t: Ticker): () => void {
  tickers.add(t);
  start();
  return () => tickers.delete(t);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) running = false;
  else start();
});
