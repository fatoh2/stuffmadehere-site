/** Odometer drums. Every digit of a number is a drum with 0 to 9 around it; when the plate comes into
 *  view the drums roll up from zero, each on its own motor, the low drum turning most, and settle on the
 *  figure. Separators and decimal points are engraved beside the drums, not rolled. The number stays in
 *  the page as text until the script runs, and as the drums' label after. New. */
import { axis, stepAxis, type Axis } from '../lib/motor';
import { DPR, palette } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { onceInView, reducedMotion } from '../lib/visible';

interface Drum {
  pos: Axis; // in digit rows; wraps at 10
  target: number;
  x: number; // left edge in the canvas, CSS px
}

interface Counter {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  em: number;
  font: string;
  drums: Drum[];
  seps: { ch: string; x: number }[];
  dirty: boolean;
}

export function mountOdometers(root: HTMLElement): void {
  const P = palette();
  const still = reducedMotion();
  const counters: Counter[] = [];
  root.querySelectorAll<HTMLElement>('[data-odo]').forEach((el) => {
    const text = (el.dataset.odo ?? el.textContent ?? '').trim();
    const cs = getComputedStyle(el);
    const em = parseFloat(cs.fontSize);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const drumW = em * 0.64;
    const gap = em * 0.07;
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = font;
    const drums: Drum[] = [];
    const seps: { ch: string; x: number }[] = [];
    let x = 0;
    let order = 0;
    for (const ch of text) {
      if (/\d/.test(ch)) {
        const digit = Number(ch);
        drums.push({ pos: axis(0, 9 + order * 3, 40 + order * 12), target: digit + 10 * (1 + order), x });
        x += drumW + gap;
        order++;
      } else {
        const wd = probe.measureText(ch).width;
        seps.push({ ch, x });
        x += wd + gap;
      }
    }
    const w = Math.ceil(x);
    const h = Math.ceil(em * 1.08);
    const cv = document.createElement('canvas');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', text);
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    cv.style.display = 'block';
    const dpr = DPR();
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    el.textContent = '';
    el.appendChild(cv);
    el.classList.add('odo');
    const c: Counter = { cv, ctx, w, h, em, font, drums, seps, dirty: true };
    if (still) for (const d of drums) d.pos.p = d.target;
    counters.push(c);
    draw(c);
  });

  function draw(c: Counter): void {
    const { ctx, em, drums, seps } = c;
    const drumW = em * 0.64;
    ctx.clearRect(0, 0, c.w, c.h);
    ctx.font = c.font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const cy = c.h / 2;
    for (const d of drums) {
      // the window
      ctx.fillStyle = P.recess;
      ctx.beginPath();
      ctx.roundRect(d.x, 0, drumW, c.h, em * 0.07);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.rect(d.x, 0, drumW, c.h);
      ctx.clip();
      ctx.fillStyle = P.paper;
      const pos = d.pos.p % 10;
      // the digits near the window: the one at pos, and its neighbours rolling through
      for (let k = -1; k <= 1; k++) {
        const digit = (((Math.floor(pos) + k) % 10) + 10) % 10;
        const y = cy + (Math.floor(pos) + k - pos) * em;
        ctx.fillText(String(digit), d.x + drumW / 2, y + em * 0.04);
      }
      ctx.restore();
    }
    ctx.fillStyle = P.ink;
    ctx.textAlign = 'left';
    for (const s of seps) ctx.fillText(s.ch, s.x, cy + em * 0.04);
  }

  if (still || !counters.length) return;
  let rolling = false;
  onceInView(root, () => (rolling = true), 0.25);
  addTicker((dt) => {
    if (!rolling) return;
    let busy = false;
    for (const c of counters) {
      let moved = false;
      for (const d of c.drums) {
        if (d.pos.p === d.target) continue;
        stepAxis(d.pos, d.target, dt);
        moved = true;
      }
      if (moved) {
        busy = true;
        draw(c);
      }
    }
    if (!busy) rolling = false;
  });
}
