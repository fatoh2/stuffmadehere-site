/** The painting robot. In 2021 Shane's wall-painting robot put down a million paint spots in three colours.
 *  Here the same kind of machine paints his portrait as a halftone: a carriage on a rail above the picture
 *  sweeps row by row, and the spray head puts down one dot per cell as it passes, one colour per pass,
 *  blue, then red, then black. From the wall-painting robot and the pumpkin carver's halftones. */
import { bar, bolt, fit, metals, palette } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { onVisible, reducedMotion } from '../lib/visible';
import { PORTRAIT } from '../data/portrait';
import { drawSprite, sprite, near } from '../lib/sprites';

interface Dot {
  c: number;
  r: number;
  rad: number;
}

interface Pass {
  name: 'blue' | 'red' | 'ink';
  colour: string;
  rows: number[]; // row indices that have dots of this colour, in order
  dots: Map<number, Dot[]>; // dots per row, sorted by column
}

export interface PainterHandle {
  run(): void;
}

export function mountPainter(cv: HTMLCanvasElement, onProgress?: (done: number, total: number) => void): PainterHandle {
  const P = palette();
  const M = metals();
  const { cell, cols, rows } = PORTRAIT;
  const RAIL = 34; // the rail runs above the picture
  near(cv, ['carriage', 'spray']);
  const W = cols * cell;
  const H = rows * cell + RAIL;
  const blue = getComputedStyle(document.documentElement).getPropertyValue('--blue').trim() || '#1d6fc4';
  const colours = { blue, red: P.accent, ink: P.ink };
  const passes: Pass[] = (['blue', 'red', 'ink'] as const).map((name) => {
    const flat = PORTRAIT.passes[name];
    const dots = new Map<number, Dot[]>();
    for (let i = 0; i < flat.length; i += 3) {
      const d = { c: flat[i], r: flat[i + 1], rad: flat[i + 2] / 10 };
      const list = dots.get(d.r);
      if (list) list.push(d);
      else dots.set(d.r, [d]);
    }
    dots.forEach((list) => list.sort((a, b) => a.c - b.c));
    return { name, colour: colours[name], rows: [...dots.keys()].sort((a, b) => a - b), dots };
  });
  let total = 0;
  passes.forEach((p) => p.dots.forEach((list) => (total += list.length)));

  cv.style.aspectRatio = `${W} / ${H}`;
  // the picture accumulates on its own layer at device resolution; the machine is drawn over it each frame
  const paint = document.createElement('canvas');
  const pctx = fit(paint, W, H).ctx;
  let ctx = cv.getContext('2d')!;
  let scale = 1;
  const layout = (): void => {
    const f = fit(cv);
    ctx = f.ctx;
    scale = f.w / W;
    ctx.scale(scale, scale);
    frame();
  };

  /* ---------- the machine's state ---------- */
  let pi = 0; // pass
  let ri = 0; // index into the pass's row list
  let dir = 1;
  let x = -20;
  let k = 0; // next dot in the row, from whichever end the head entered
  let pause = 0.5; // s before the first row and between passes
  let puff = 0; // s of spray left to show
  let done = false;
  let painted = 0;
  let visible = true;
  const speed = W / 0.06; // px/s along a row
  const dotY = (r: number): number => RAIL + r * cell + cell / 2;
  const dotX = (c: number): number => c * cell + cell / 2;

  const spray = (pass: Pass, d: Dot): void => {
    pctx.fillStyle = pass.colour;
    pctx.beginPath();
    pctx.arc(dotX(d.c), dotY(d.r), d.rad, 0, Math.PI * 2);
    pctx.fill();
    // overspray: a couple of specks beside the dot
    pctx.globalAlpha = 0.45;
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = d.rad * (1.2 + Math.random() * 0.8);
      pctx.beginPath();
      pctx.arc(dotX(d.c) + Math.cos(a) * rr, dotY(d.r) + Math.sin(a) * rr, 0.6, 0, Math.PI * 2);
      pctx.fill();
    }
    pctx.globalAlpha = 1;
    painted++;
    puff = 0.08;
  };

  const paintAll = (): void => {
    for (const p of passes) p.dots.forEach((list) => list.forEach((d) => spray(p, d)));
    puff = 0;
    done = true;
    onProgress?.(painted, total);
  };

  function reset(): void {
    pctx.clearRect(0, 0, W, H);
    pi = 0;
    ri = 0;
    dir = 1;
    x = -20;
    k = 0;
    pause = 0.5;
    puff = 0;
    done = false;
    painted = 0;
    onProgress?.(0, total);
  }

  function step(dt: number): void {
    if (done) return;
    if (pause > 0) {
      pause -= dt;
      return;
    }
    const pass = passes[pi];
    const row = pass.rows[ri];
    const list = pass.dots.get(row)!;
    const from = x;
    x += dir * speed * dt;
    // every dot whose column centre the head has just crossed gets sprayed
    if (dir > 0) {
      while (k < list.length && dotX(list[k].c) <= x && dotX(list[k].c) > from - 1) spray(pass, list[k++]);
    } else {
      while (k < list.length && dotX(list[list.length - 1 - k].c) >= x && dotX(list[list.length - 1 - k].c) < from + 1) spray(pass, list[list.length - 1 - k++]);
    }
    if ((dir > 0 && x >= W + 20) || (dir < 0 && x <= -20)) {
      // end of the row: next row of this pass, or the next pass, from the other side
      ri++;
      k = 0;
      dir = -dir;
      x = dir > 0 ? -20 : W + 20;
      if (ri >= pass.rows.length) {
        ri = 0;
        pi++;
        pause = 0.45;
        if (pi >= passes.length) {
          done = true;
          puff = 0;
        }
      }
    }
    onProgress?.(painted, total);
  }

  function frame(): void {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(paint, 0, 0, W, H);
    // the rail and its end blocks
    bar(ctx, 0, 8, W, 9, M.anod, 2);
    bolt(ctx, 8, 12.5, 3.5, M.steel);
    bolt(ctx, W - 8, 12.5, 3.5, M.steel);
    if (done) return;
    const pass = passes[pi];
    const hx = Math.max(-16, Math.min(W + 16, x));
    const hy = pause > 0 && pi === 0 && ri === 0 ? dotY(pass.rows[0]) : dotY(pass.rows[ri]);
    // the carriage, the arm down to the head, and the head with the colour it is spraying
    const carriageImg = sprite('carriage');
    const sprayImg = sprite('spray');
    if (carriageImg) drawSprite(ctx, carriageImg, hx, 12, 22, 0.5, 1);
    else {
      bar(ctx, hx - 15, 2, 30, 21, M.alu, 3);
      bolt(ctx, hx - 8, 12.5, 2.5, M.steel);
      bolt(ctx, hx + 8, 12.5, 2.5, M.steel);
    }
    if (sprayImg) {
      const headH = 40;
      bar(ctx, hx - 3, 12, 6, Math.max(0, hy - 2 - headH - 12), M.steel, 1.5);
      drawSprite(ctx, sprayImg, hx, hy - 2, headH, 0.5, 1);
      // the pass's colour on a chip on the head
      ctx.fillStyle = pass.colour;
      ctx.fillRect(hx - 3, hy - 2 - headH * 0.58, 6, 6);
    } else {
      bar(ctx, hx - 3, 20, 6, Math.max(0, hy - 16 - 20), M.steel, 1.5);
      bar(ctx, hx - 9, hy - 18, 18, 13, M.anod, 2);
      ctx.fillStyle = pass.colour;
      ctx.fillRect(hx - 2.5, hy - 6, 5, 4);
    }
    if (puff > 0) {
      puff -= 1 / 60;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(hx, hy - 2);
      ctx.lineTo(hx - 5, hy + 5);
      ctx.lineTo(hx + 5, hy + 5);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  onVisible(cv, (v) => (visible = v), 0.15);
  new ResizeObserver(layout).observe(cv);
  layout();

  if (reducedMotion()) {
    paintAll();
    frame();
    return { run: () => undefined };
  }
  addTicker((dt) => {
    if (!visible) return;
    if (done) return;
    step(dt);
    frame();
  });

  return {
    run() {
      reset();
      frame();
    },
  };
}
