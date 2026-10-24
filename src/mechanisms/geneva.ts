/** Mechanism E, the Geneva drive, and mechanism D, the pen plotter. A four-slot Geneva wheel feeds
 *  the slip out of the printer one stage per index, with the real dwell between steps; after each
 *  row lands, a plotter arm writes its note in a single-stroke lettering with pen lifts. */
import { cue } from '../lib/sound';
import { fit, palette } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { onVisible, reducedMotion } from '../lib/visible';
import { clamp } from '../lib/motor';
import { capture } from '../lib/pointer';
import { strokesFor, textWidth } from './strokefont';
import { sprite, drawSprite } from '../lib/sprites';
import { metals, bar, disc } from '../lib/canvas';

const TAU = Math.PI * 2;
const SLOTS = 4;
/** where the drive pin sits in the rendered driver disc (angle from +x, canvas y down) */
const DRIVER_PIN_ANGLE = 0;

export interface GenevaOptions {
  section: HTMLElement;
  printer: HTMLElement;
  slip: HTMLElement;
  notes: HTMLCanvasElement;
}

/** Geneva wheel angle for a driver angle (4 slots). The driver pin engages for a quarter turn
 *  centred on alpha = 0 (mod 2π); outside that window the wheel dwells. */
function genevaAngle(alpha: number): number {
  const turn = Math.floor((alpha + Math.PI / 4) / TAU); // completed indexes
  let a = alpha - turn * TAU; // in [-π/4, 7π/4)
  const index = (turn * TAU) / SLOTS;
  if (a > Math.PI / 4) return index + TAU / SLOTS; // dwell after the index
  // engaged: c = 1, pin radius r = sin(π/4)
  const r = Math.sin(Math.PI / SLOTS);
  const beta = Math.atan2(r * Math.sin(a), 1 - r * Math.cos(a));
  a = beta + Math.PI / SLOTS; // from 0 to π/2 over the engagement
  return index + a;
}

export interface GenevaHandle {
  reset(): void;
}

export function mountGeneva(o: GenevaOptions): GenevaHandle {
  const P = palette();
  const M = metals();
  if (reducedMotion()) return { reset() {} }; // the slip is simply printed
  const rows = Array.from(o.slip.querySelectorAll<HTMLElement>('.slip__group, .slip__row, .slip__total'));
  const notes = rows.map((r) => r.dataset.note ?? '');
  const pcv = o.printer.querySelector('canvas')!;
  let pctx!: CanvasRenderingContext2D;
  let PW = 0;
  let PH = 0;
  let nctx!: CanvasRenderingContext2D;
  let NW = 0;
  let NH = 0;
  const fitAll = (): void => {
    const a = fit(pcv);
    pctx = a.ctx;
    PW = a.w;
    PH = a.h;
    const b = fit(o.notes);
    nctx = b.ctx;
    NW = b.w;
    NH = b.h;
    redrawNotes();
  };
  o.section.classList.add('is-live');

  let visible = false;
  onVisible(o.section, (v) => (visible = v), 0.05);

  // driver angle: scroll depth sets a target, dragging the driver adds to it, a motor turns it
  let alpha = 0;
  let alphaV = 0;
  let manual = 0;
  let drag: { y: number } | null = null;
  pcv.style.touchAction = 'pan-y';
  pcv.style.cursor = 'grab';
  pcv.addEventListener('pointerdown', (e) => {
    capture(pcv, e);
    drag = { y: e.clientY };
  });
  pcv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    manual += (e.clientY - drag.y) * 0.02;
    drag = { y: e.clientY };
  });
  const end = (): void => {
    drag = null;
  };
  pcv.addEventListener('pointerup', end);
  pcv.addEventListener('pointercancel', end);

  const fed = new Array<boolean>(rows.length).fill(false);
  let fedCount = 0;

  /* ---------- plotter ---------- */
  interface Job {
    row: number;
    strokes: number[][][]; // [stroke][point][x,y] in slip coords
    s: number; // stroke index
    k: number; // point index
    progress: number; // 0..1 along current segment
  }
  const done: number[][][][] = []; // finished strokes per note, redrawn on resize
  let job: Job | null = null;
  const queue: number[] = [];
  const pen = { x: 0, y: 0, down: false };
  const PEN_SPEED = 520; // px/s

  function notePlacement(i: number): { x: number; y: number; size: number } {
    const r = rows[i].getBoundingClientRect();
    const sr = o.slip.getBoundingClientRect();
    let size = 11;
    // over the dot leader if the row has one, sized to fit it; else to the right of the label
    const dots = rows[i].querySelector<HTMLElement>('.dots');
    if (dots) {
      const dr = dots.getBoundingClientRect();
      const perPx = textWidth(notes[i], 1);
      size = clamp((dr.width - 10) / Math.max(0.01, perPx), 7.5, 11);
      if (perPx * size <= dr.width - 8) return { x: dr.left - sr.left + 4, y: dr.top - sr.top - size * 0.95, size };
      // too short a leader (phones): in the room above the row's label
      size = 8.5;
      return { x: r.left - sr.left + 1, y: r.top - sr.top + 3, size };
    }
    const label = rows[i].firstElementChild?.getBoundingClientRect() ?? r;
    return { x: label.right - sr.left + 18, y: r.bottom - sr.top - size * 1.1 - 4, size };
  }

  function startJob(i: number): void {
    const text = notes[i];
    if (!text) return;
    const { x, y, size } = notePlacement(i);
    const strokes = strokesFor(text, x, y, size);
    if (!strokes.length) return;
    job = { row: i, strokes, s: 0, k: 0, progress: 0 };
    done[i] = [];
  }

  function stepPlotter(dt: number): void {
    if (!job) {
      const next = queue.shift();
      if (next != null) startJob(next);
      if (!job) return;
    }
    let budget = PEN_SPEED * dt;
    while (budget > 0 && job) {
      const stroke = job.strokes[job.s];
      if (!stroke) {
        job = null;
        break;
      }
      const a = stroke[job.k];
      const b = stroke[job.k + 1];
      if (!b) {
        // stroke finished: lift the pen, next stroke
        done[job.row].push(stroke);
        job.s++;
        job.k = 0;
        job.progress = 0;
        pen.down = false;
        budget -= 6; // pen lift costs a little time
        continue;
      }
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.01;
      const remain = (1 - job.progress) * len;
      if (!pen.down) {
        // travel to the stroke start
        const d = Math.hypot(a[0] - pen.x, a[1] - pen.y);
        if (d > 1) {
          const step = Math.min(d, budget * 1.6);
          pen.x += ((a[0] - pen.x) / d) * step;
          pen.y += ((a[1] - pen.y) / d) * step;
          budget -= step / 1.6;
          continue;
        }
        pen.down = true;
      }
      const step = Math.min(remain, budget);
      job.progress += step / len;
      budget -= step;
      pen.x = a[0] + (b[0] - a[0]) * job.progress;
      pen.y = a[1] + (b[1] - a[1]) * job.progress;
      if (job.progress >= 0.999) {
        job.k++;
        job.progress = 0;
      }
    }
  }

  function redrawNotes(): void {
    if (!nctx) return;
    nctx.clearRect(0, 0, NW, NH);
    nctx.strokeStyle = P.accent;
    nctx.lineWidth = 2;
    nctx.lineCap = 'round';
    nctx.lineJoin = 'round';
    done.forEach((strokes, i) => {
      if (!strokes) return;
      // re-place on resize: recompute from the row position
      const text = notes[i];
      const { x, y, size } = notePlacement(i);
      const fresh = strokesFor(text, x, y, size);
      done[i] = fresh.slice(0, strokes.length);
      for (const st of done[i]) path(st);
    });
  }
  function path(st: number[][]): void {
    nctx.beginPath();
    st.forEach((p, i) => (i ? nctx.lineTo(p[0], p[1]) : nctx.moveTo(p[0], p[1])));
    nctx.stroke();
  }

  fitAll();
  new ResizeObserver(fitAll).observe(o.slip);

  /* ---------- loop ---------- */
  addTicker((dt) => {
    if (!visible && !job) return;
    // target driver angle from scroll depth through the section
    const r = o.section.getBoundingClientRect();
    const vh = window.innerHeight;
    const depth = clamp((vh * 0.85 - r.top) / (Math.min(r.height, vh * 1.1) * 0.9), 0, 1);
    const target = depth * (rows.length + 0.25) * TAU + manual;
    // the driver is a motor: constant speed toward the target
    const diff = target - alpha;
    const vmax = 9; // rad/s, about 1.4 s per index
    alphaV = clamp(diff * 6, -vmax, vmax);
    alpha += alphaV * dt;
    const wheel = genevaAngle(alpha);
    const feedRows = wheel / (TAU / SLOTS); // rows fed, fractional during an index
    const n = clamp(Math.floor(feedRows + 1e-6), 0, rows.length);
    if (n !== fedCount) {
      for (let i = 0; i < rows.length; i++) {
        const f = i < n;
        if (f && !fed[i]) {
          queue.push(i);
          cue.index();
        }
        if (!f && fed[i]) {
          done[i] = [];
          const qi = queue.indexOf(i);
          if (qi >= 0) queue.splice(qi, 1);
          if (job?.row === i) job = null;
        }
        fed[i] = f;
        rows[i].classList.toggle('is-fed', f);
      }
      fedCount = n;
      redrawNotes();
    }
    // the slip emerges: clip to the fed height plus the fraction of the row being fed
    const next = rows[n];
    const sr = o.slip.getBoundingClientRect();
    let reveal = sr.height;
    if (next) {
      const nr = next.getBoundingClientRect();
      const frac = feedRows - n;
      reveal = nr.top - sr.top + nr.height * frac;
    }
    o.slip.style.clipPath = `inset(0 0 ${Math.max(0, sr.height - reveal).toFixed(1)}px 0)`;

    stepPlotter(dt);
    // draw the current stroke on top of the finished ones
    redrawNotesLive();
    drawPrinter(alpha, wheel);
  });

  function redrawNotesLive(): void {
    nctx.clearRect(0, 0, NW, NH);
    nctx.strokeStyle = P.accent;
    nctx.lineWidth = 2;
    nctx.lineCap = 'round';
    nctx.lineJoin = 'round';
    done.forEach((strokes) => strokes && strokes.forEach(path));
    if (job) {
      const st = job.strokes[job.s];
      if (st && pen.down) {
        nctx.beginPath();
        for (let i = 0; i <= job.k; i++) (i ? nctx.lineTo : nctx.moveTo).call(nctx, st[i][0], st[i][1]);
        nctx.lineTo(pen.x, pen.y);
        nctx.stroke();
      }
      // the arm: anchored top-right of the slip, two links to the pen
      const ax = NW - 10;
      const ay = -6;
      const L1 = Math.max(120, NW * 0.55);
      const L2 = Math.max(120, NH * 0.6);
      const dx = pen.x - ax;
      const dy = pen.y - ay;
      const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1);
      const a0 = Math.atan2(dy, dx);
      const cosE = clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
      const elbow = Math.acos(cosE);
      const a1 = a0 - Math.atan2(L2 * Math.sin(elbow), L1 + L2 * Math.cos(elbow));
      const ex = ax + Math.cos(a1) * L1;
      const ey = ay + Math.sin(a1) * L1;
      const py2 = pen.y - (pen.down ? 0 : 4);
      link(ax, ay, ex, ey, 22);
      link(ex, ey, pen.x, py2, 18);
      disc(nctx, ex, ey, 6, M.steel, 2);
      const penImg = sprite('pen');
      if (penImg) drawSprite(nctx, penImg, pen.x, py2, 46, 0.523, 0.998);
      else {
        nctx.fillStyle = pen.down ? P.accent : P.steel;
        nctx.beginPath();
        nctx.arc(pen.x, py2, 4, 0, TAU);
        nctx.fill();
      }
    }
  }

  /** a rendered arm link between two joints; the bearings keep their shape, only the bar stretches */
  function link(x0: number, y0: number, x1: number, y1: number, thick: number): void {
    const img = sprite('armlink');
    const L = Math.hypot(x1 - x0, y1 - y0);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    nctx.save();
    nctx.translate(x0, y0);
    nctx.rotate(ang);
    if (img) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const k = thick / ih; // display scale
      const capW = iw * 0.17 * k; // the bearing ends in display px
      const bearing = iw * 0.085 * k; // from the end to the bearing centre
      const left = -bearing;
      const total = L + 2 * bearing;
      nctx.drawImage(img, 0, 0, iw * 0.17, ih, left, -thick / 2, capW, thick);
      nctx.drawImage(img, iw * 0.17, 0, iw * 0.66, ih, left + capW, -thick / 2, Math.max(1, total - 2 * capW), thick);
      nctx.drawImage(img, iw * 0.83, 0, iw * 0.17, ih, left + total - capW, -thick / 2, capW, thick);
    } else {
      bar(nctx, 0, -thick / 2, L, thick, M.anod, thick / 2);
    }
    nctx.restore();
  }

  function drawPrinter(a: number, wheel: number): void {
    pctx.clearRect(0, 0, PW, PH);
    const cy = PH / 2;
    const c = 30; // centre distance
    const wx = 48;
    const dx = wx + c;
    // Geneva wheel: disc with four slots and four locking arcs
    const wheelImg = sprite('geneva');
    if (wheelImg) drawSprite(pctx, wheelImg, wx, cy, 50, 0.5, 0.5, wheel + Math.PI / SLOTS);
    else {
      pctx.save();
      pctx.translate(wx, cy);
      pctx.rotate(wheel);
      disc(pctx, 0, 0, 22, M.alu, 4);
      pctx.fillStyle = M.anod.dark;
      for (let i = 0; i < SLOTS; i++) {
        pctx.save();
        pctx.rotate((i * TAU) / SLOTS + Math.PI / SLOTS);
        pctx.fillRect(10, -2.5, 14, 5);
        pctx.restore();
      }
      pctx.restore();
    }
    // driver: disc with pin at radius r = c·sin(π/4), pin at angle a + π (toward the wheel at a = 0)
    pctx.save();
    pctx.translate(dx, cy);
    const pr = c * Math.sin(Math.PI / SLOTS);
    const driverImg = sprite('driver');
    if (driverImg) drawSprite(pctx, driverImg, 0, 0, 2 * pr + 14, 0.5, 0.5, a + Math.PI - DRIVER_PIN_ANGLE);
    else {
      disc(pctx, 0, 0, 14, M.anod, 3);
      const px = Math.cos(a + Math.PI) * pr;
      const py = Math.sin(a + Math.PI) * pr;
      pctx.fillStyle = P.accent;
      pctx.beginPath();
      pctx.arc(px, py, 3.5, 0, TAU);
      pctx.fill();
    }
    pctx.restore();
    // paper slot and feed rollers
    pctx.fillStyle = P.paper;
    pctx.fillRect(dx + 36, cy - 3, PW - dx - 46, 6);
    for (const x of [dx + 50, PW - 24]) {
      disc(pctx, x, cy - 11, 7, M.alu, 2);
      disc(pctx, x, cy + 11, 7, M.alu, 2);
    }
  }

  return {
    reset() {
      alpha = 0;
      alphaV = 0;
      manual = 0;
      fed.fill(false);
      fedCount = 0;
      rows.forEach((r) => r.classList.remove('is-fed'));
      done.length = 0;
      queue.length = 0;
      job = null;
      redrawNotes();
    },
  };
}
