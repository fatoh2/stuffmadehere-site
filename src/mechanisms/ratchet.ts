/** Tally counters with a ratchet and pawl. Each vote turns the wheel one tooth: the pawl rides up the
 *  tooth, drops behind it with a click, and the count rolls up by one; nothing can turn it back. The
 *  counts live in this browser only (the real site would collect them). New. */
import { axis, stepAxis, type Axis } from '../lib/motor';
import { bolt, disc, fit, metals, palette } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { reducedMotion } from '../lib/visible';
import { cue } from '../lib/sound';
import { drawSprite, sprite } from '../lib/sprites';

const KEY = 'smh-votes';
const TEETH = 12;

interface Counter {
  key: string;
  cv: HTMLCanvasElement;
  out: HTMLElement;
  n: number;
  wheel: Axis;
  pawl: number; // 0 seated, 1 lifted
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

export function mountTally(buttons: HTMLButtonElement[], resetBtn: HTMLButtonElement | null, onLive?: (live: boolean) => void): void {
  const P = palette();
  const M = metals();
  const load = (): Record<string, number> => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  };
  const save = (counts: Record<string, number>): void => {
    try {
      localStorage.setItem(KEY, JSON.stringify(counts));
    } catch {
      /* private mode: the count still shows for this visit */
    }
  };
  const counts = load();
  sprite('ratchet');
  sprite('pawl');
  sprite('pivot');
  const counters: Counter[] = buttons.map((b) => {
    const key = b.dataset.idea ?? b.id;
    const cv = b.querySelector('canvas')!;
    const out = b.querySelector<HTMLElement>('.tally__n')!;
    const n = counts[key] ?? 0;
    out.textContent = String(n);
    const f = fit(cv);
    return { key, cv, out, n, wheel: axis(0, 9, 90), pawl: 0, ctx: f.ctx, w: f.w, h: f.h };
  });

  const draw = (c: Counter): void => {
    const { ctx, w, h } = c;
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.46;
    const cy = h * 0.54;
    const r = Math.min(w, h) * 0.36;
    const wheelImg = sprite('ratchet');
    const pawlImg = sprite('pawl');
    const pivotImg = sprite('pivot');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(c.wheel.p);
    if (wheelImg) drawSprite(ctx, wheelImg, 0, 0, r * 2.06, 0.5, 0.5);
    ctx.fillStyle = wheelImg ? 'rgba(0,0,0,0)' : M.anod.face;
    ctx.beginPath();
    for (let i = 0; i < TEETH; i++) {
      const a0 = (i / TEETH) * Math.PI * 2;
      const a1 = ((i + 0.7) / TEETH) * Math.PI * 2;
      const a2 = ((i + 1) / TEETH) * Math.PI * 2;
      ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
      ctx.lineTo(Math.cos(a1) * r * 0.8, Math.sin(a1) * r * 0.8);
      ctx.lineTo(Math.cos(a2) * r * 0.8, Math.sin(a2) * r * 0.8);
    }
    ctx.closePath();
    if (!wheelImg) {
      ctx.fill();
      ctx.strokeStyle = M.anod.dark;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
    disc(ctx, cx, cy, r * 0.22, M.steel, r * 0.07);
    // the pawl, hinged above right, its hooked tip resting between two teeth; a tap lifts it over one
    const px = cx + r * 0.95;
    const py = cy - r * 1.05;
    const aim = Math.atan2(cy - r * 0.84 - py, cx + r * 0.5 - px);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(aim + c.pawl * 0.25);
    if (pawlImg) {
      drawSprite(ctx, pawlImg, 0, 0, r * 0.4, 0.176, 0.553);
    } else {
      ctx.fillStyle = M.steel.face;
      ctx.strokeStyle = M.steel.dark;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-4, -4);
      ctx.lineTo(r * 0.6, -3);
      ctx.lineTo(r * 0.66, 3);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    if (pivotImg) drawSprite(ctx, pivotImg, px, py, 8, 0.5, 0.5);
    else bolt(ctx, px, py, 3.5, M.steel);
    ctx.fillStyle = P.accent;
    ctx.fillRect(px - 2, py + 6, 4, 4);
  };

  let live = false;
  const applyTotals = (t: Record<string, number>): void => {
    for (const c of counters) {
      if (typeof t[c.key] === 'number') {
        c.n = t[c.key];
        c.out.textContent = String(c.n);
      }
    }
  };
  // the server's totals, if this deployment counts
  void fetch('/api/vote', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { ok?: boolean; totals?: Record<string, number> } | null) => {
      if (!j?.ok || !j.totals) return;
      live = true;
      applyTotals(j.totals);
      onLive?.(true);
    })
    .catch(() => undefined);
  const vote = (c: Counter): void => {
    c.n++;
    cue.pawl();
    if (live) {
      void fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea: c.key }) })
        .then((r) => r.json())
        .then((j: { ok?: boolean; totals?: Record<string, number> }) => {
          if (j?.totals) applyTotals(j.totals);
        })
        .catch(() => undefined);
    }
    counts[c.key] = c.n;
    save(counts);
    c.out.textContent = String(c.n);
    c.cv.closest('button')?.setAttribute('aria-label', `${c.cv.closest('button')?.querySelector('.panel__name, .tally__name')?.textContent ?? 'Vote'}: ${c.n} ${c.n === 1 ? 'vote' : 'votes'}`);
    c.wheel.p -= (Math.PI * 2) / TEETH; // the wheel turns one tooth (and the pawl lets it, one way only)
    c.pawl = 1;
    if (navigator.vibrate) navigator.vibrate(8);
  };
  counters.forEach((c) => {
    const b = c.cv.closest('button')!;
    b.addEventListener('click', () => vote(c));
    draw(c);
  });
  resetBtn?.addEventListener('click', () => {
    if (live) return; // the server's totals are not yours to reset
    counters.forEach((c) => {
      c.n = 0;
      c.out.textContent = '0';
      delete counts[c.key];
    });
    save(counts);
  });

  if (reducedMotion()) return;
  addTicker((dt) => {
    for (const c of counters) {
      // the wheel is driven to the next tooth position; the pawl drops back once it has passed
      stepAxis(c.wheel, Math.round(c.wheel.p / ((Math.PI * 2) / TEETH)) * ((Math.PI * 2) / TEETH), dt);
      if (c.pawl > 0) c.pawl = Math.max(0, c.pawl - dt * 7);
      draw(c);
    }
  });
}
