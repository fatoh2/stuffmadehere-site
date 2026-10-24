/** The sorting line. Forty-one videos come down a belt in the order he made them, and a row of diverter
 *  gates drops each one into its bin: can't miss, toolpath, explosive, locks, assembly, the rest. The bins
 *  fill with the real thumbnails, which stay links. Pull the lever to run the line again. New. */
import { axis, stepAxis, type Axis } from '../lib/motor';
import { bar, bolt, disc, fit, metals, palette } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { onVisible, reducedMotion } from '../lib/visible';

interface Card {
  el: HTMLElement;
  family: string;
  bin: number;
  state: 'wait' | 'belt' | 'fall' | 'rest';
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  at: number; // s on the line when it is placed on the belt
}

interface Gate {
  x: number;
  flap: Axis; // 0 closed (flat on the belt), 1 open (swung down)
  open: boolean;
}

export interface SorterHandle {
  run(): void;
}

const G = 2200;
const BELT = 420; // px/s
const SPACING = 0.18; // s between cards on the belt

export function mountSorter(root: HTMLElement, cv: HTMLCanvasElement, cardEls: HTMLElement[], binEls: HTMLElement[], counts: HTMLElement[]): SorterHandle {
  const P = palette();
  const M = metals();
  let ctx = cv.getContext('2d')!;
  let W = 10;
  let H = 10;
  let beltY = 40;
  let binTop = 200;
  let cw = 64;
  let ch = 36;
  const families = binEls.map((b) => b.dataset.family ?? '');
  const gates: Gate[] = binEls.map(() => ({ x: 0, flap: axis(0, 9, 90), open: false }));
  const cards: Card[] = cardEls.map((el) => {
    const family = el.dataset.family ?? 'other';
    const bin = Math.max(0, families.indexOf(family));
    return { el, family, bin, state: 'wait', x: -100, y: 0, vx: 0, vy: 0, rot: 0, at: 0 };
  });
  const piles = binEls.map(() => 0);
  const binW = binEls.map(() => 200);
  const landed = binEls.map(() => 0);
  const totals = binEls.map((_, i) => cards.filter((c) => c.bin === i).length);
  let t = 0;
  let running = false;
  let belt = 0; // belt travel, for the moving marks
  let visible = true;

  const layout = (): void => {
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
    const rr = root.getBoundingClientRect();
    const c0 = cardEls[0]?.getBoundingClientRect();
    if (c0 && c0.width > 4) {
      cw = c0.width;
      ch = c0.height;
    }
    beltY = Math.max(36, ch * 0.7 + 22);
    binEls.forEach((b, i) => {
      const r = b.getBoundingClientRect();
      gates[i].x = r.left - rr.left + r.width / 2;
      binW[i] = r.width;
      if (i === 0) binTop = r.top - rr.top;
    });
    place();
  };

  const place = (): void => {
    for (const c of cards) {
      if (c.state === 'wait') continue;
      c.el.style.transform = `translate3d(${(c.x - cw / 2).toFixed(1)}px, ${(c.y - ch / 2).toFixed(1)}px, 0) rotate(${c.rot.toFixed(1)}deg)`;
    }
  };

  const restY = (bin: number, n: number): number => binTop + 14 + ch / 2 + Math.max(0, totals[bin] - 1 - n) * 0; // all cards of a bin lie at the same depth, fanned
  // the pile fans out as far as the bin allows: ten pixels a card on a desktop, a tight stack on a phone
  const fanStep = (bin: number): number => Math.min(10, Math.max(1.5, (binW[bin] - cw - 10) / Math.max(1, totals[bin] - 1)));
  const restX = (bin: number, n: number): number => gates[bin].x + (n - (totals[bin] - 1) / 2) * fanStep(bin);

  const land = (c: Card): void => {
    const n = landed[c.bin]++;
    c.state = 'rest';
    c.x = restX(c.bin, n);
    c.y = restY(c.bin, n) + Math.min(28, n * 3);
    c.rot = ((n % 3) - 1) * 2.5;
    c.vx = 0;
    c.vy = 0;
    counts[c.bin].textContent = `${landed[c.bin]} of ${totals[c.bin]}`;
    c.el.style.zIndex = String(10 + n);
  };

  function reset(): void {
    t = 0;
    running = true;
    landed.fill(0);
    piles.fill(0);
    counts.forEach((el, i) => (el.textContent = `0 of ${totals[i]}`));
    cards.forEach((c, i) => {
      c.state = 'wait';
      c.at = 0.3 + i * SPACING;
      c.x = -cw;
      c.y = beltY - ch / 2 - 2;
      c.vx = BELT;
      c.vy = 0;
      c.rot = 0;
      c.el.classList.remove('is-live');
      c.el.style.zIndex = '';
    });
    gates.forEach((g) => {
      g.open = false;
      g.flap.p = 0;
      g.flap.v = 0;
    });
  }

  function placeAll(): void {
    // no motion: every card lies in its bin
    landed.fill(0);
    cards.forEach((c) => {
      c.el.classList.add('is-live');
      land(c);
    });
    place();
    frame();
  }

  function step(dt: number): void {
    t += dt;
    belt += BELT * dt;
    let active = false;
    gates.forEach((g) => (g.open = false));
    for (const c of cards) {
      if (c.state === 'wait') {
        if (t >= c.at) {
          c.state = 'belt';
          c.el.classList.add('is-live');
        } else continue;
      }
      if (c.state === 'belt') {
        active = true;
        c.x += BELT * dt;
        const g = gates[c.bin];
        if (c.x > g.x - 70) g.open = true; // the gate for this card's bin swings down ahead of it
        if (c.x >= g.x - 4) {
          c.state = 'fall';
          c.vx = BELT * 0.35;
          c.vy = 60;
        }
      } else if (c.state === 'fall') {
        active = true;
        c.vy += G * dt;
        c.vx *= 1 - Math.min(1, dt * 3);
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.rot += dt * 40;
        const floor = restY(c.bin, landed[c.bin]) + Math.min(28, landed[c.bin] * 3);
        if (c.y >= floor) land(c);
      }
    }
    for (const g of gates) stepAxis(g.flap, g.open ? 1 : 0, dt);
    if (!active && t > cards[cards.length - 1].at + 1) running = false;
    place();
  }

  function frame(): void {
    ctx.clearRect(0, 0, W, H);
    // the belt: a bar with moving marks between two rollers
    bar(ctx, 0, beltY - 2, W, 10, M.anod, 2);
    ctx.fillStyle = P.steelDark;
    const pitch = 28;
    for (let x = -(belt % pitch); x < W; x += pitch) ctx.fillRect(x, beltY, 10, 6);
    disc(ctx, 10, beltY + 3, 11, M.steel, 3);
    disc(ctx, W - 10, beltY + 3, 11, M.steel, 3);
    // the gates: a flap hinged at the belt that swings down to divert
    gates.forEach((g) => {
      const a = g.flap.p * 1.05;
      ctx.save();
      ctx.translate(g.x - 30, beltY + 9);
      ctx.rotate(a);
      bar(ctx, 0, 0, 46, 6, g.flap.p > 0.3 ? M.alu : M.steel, 1.5);
      ctx.restore();
      bolt(ctx, g.x - 30, beltY + 12, 3.5, M.anod);
    });
  }

  onVisible(root, (v) => (visible = v), 0.1);
  new ResizeObserver(layout).observe(root);
  layout();

  if (reducedMotion()) {
    placeAll();
    return { run: () => undefined };
  }
  reset();
  addTicker((dt) => {
    if (!visible) return;
    if (running) step(dt);
    frame();
  });
  return {
    run() {
      reset();
    },
  };
}
