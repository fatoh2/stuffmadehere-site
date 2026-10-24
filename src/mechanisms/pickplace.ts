/** Mechanism 4: pick-and-place assembly. The section's parts start in a feeder at the bottom edge;
 *  a gantry head picks each one and places it where CSS laid it out, with trapezoidal motion
 *  profiles on x and on the z arm. From "Worlds hardest jigsaw vs. puzzle machine" (2022). */
import { axis, stepAxis } from '../lib/motor';
import { addTicker } from '../lib/loop';
import { onceInView, reducedMotion } from '../lib/visible';

interface Part {
  el: HTMLElement;
  // final position relative to the section (CSS layout)
  x: number;
  y: number;
  w: number;
  h: number;
}

type Step = { act: 'move'; x: number } | { act: 'belt'; i: number } | { act: 'z'; z: number } | { act: 'pick'; i: number } | { act: 'drop'; i: number } | { act: 'done' };

export interface PickPlaceHandle {
  start(): void;
}

export function mountPickPlace(section: HTMLElement): PickPlaceHandle {
  const els = Array.from(section.querySelectorAll<HTMLElement>('[data-part]'));
  if (!els.length || reducedMotion()) return { start() {} };
  const head = section.querySelector<HTMLElement>('#gantryHead')!;
  const arm = section.querySelector<HTMLElement>('#gantryArm')!;
  const cup = section.querySelector<HTMLElement>('#gantryCup')!;

  let parts: Part[] = [];
  let feed = { x: 0, y: 0 };
  let placed = 0;
  let carrying: number | null = null;
  const hx = axis(0, 4200, 34000);
  const z = axis(40, 5000, 52000);
  const belt = axis(0, 4200, 30000); // the conveyor that brings each part in from the left
  let seq: Step[] = [];
  let si = 0;
  let live = false;

  function measureParts(): void {
    const sr = section.getBoundingClientRect();
    parts = els.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
    });
    feed = { x: Math.max(240, sr.width * 0.3), y: 64 };
  }

  function placeEl(p: Part, x: number, y: number): void {
    p.el.style.transform = `translate3d(${x - p.x}px, ${y - p.y}px, 0)`;
  }

  function showFeeder(i: number): void {
    parts.forEach((p, j) => {
      if (j < i) return; // already placed
      if (j === i) {
        p.el.style.visibility = 'visible';
        belt.p = -p.w - 24;
        belt.v = 0;
        placeEl(p, belt.p, feed.y);
      } else p.el.style.visibility = 'hidden';
    });
  }

  function plan(): void {
    seq = [];
    parts.forEach((p, i) => {
      seq.push({ act: 'belt', i });
      seq.push({ act: 'move', x: feed.x });
      seq.push({ act: 'z', z: feed.y });
      seq.push({ act: 'pick', i });
      seq.push({ act: 'z', z: 40 });
      seq.push({ act: 'move', x: p.x + p.w / 2 });
      seq.push({ act: 'z', z: p.y });
      seq.push({ act: 'drop', i });
      seq.push({ act: 'z', z: 40 });
    });
    seq.push({ act: 'move', x: feed.x });
    seq.push({ act: 'done' });
    si = 0;
  }

  function start(): void {
    els.forEach((el) => {
      el.style.transform = '';
      el.style.visibility = '';
    });
    section.classList.add('is-live');
    measureParts();
    hx.p = feed.x;
    hx.v = 0;
    z.p = 40;
    z.v = 0;
    placed = 0;
    carrying = null;
    showFeeder(0);
    plan();
    live = true;
  }

  onceInView(section, () => start(), 0.12);

  addTicker((dt) => {
    if (!live) return;
    const step = seq[si];
    if (!step) return;
    switch (step.act) {
      case 'belt': {
        const p = parts[step.i];
        const target = feed.x - p.w / 2;
        stepAxis(belt, target, dt);
        placeEl(p, belt.p, feed.y);
        stepAxis(hx, feed.x, dt); // the head travels to the pick point while the belt runs
        if (belt.p === target) si++;
        break;
      }
      case 'move':
        stepAxis(hx, step.x, dt);
        if (hx.p === step.x) si++;
        break;
      case 'z':
        stepAxis(z, step.z, dt);
        if (z.p === step.z) si++;
        break;
      case 'pick':
        carrying = step.i;
        si++;
        break;
      case 'drop':
        carrying = null;
        placeEl(parts[step.i], parts[step.i].x, parts[step.i].y);
        parts[step.i].el.style.transform = '';
        placed = step.i + 1;
        if (placed < parts.length) showFeeder(placed);
        si++;
        break;
      case 'done':
        live = false;
        section.classList.remove('is-live');
        parts.forEach((p) => {
          p.el.style.transform = '';
          p.el.style.visibility = '';
        });
        return;
    }
    head.style.transform = `translate3d(${hx.p - 24}px, 0, 0)`;
    arm.style.transform = `translate3d(${hx.p - 4}px, 0, 0) scaleY(${Math.max(0.1, (z.p - 14) / 10)})`;
    cup.style.transform = `translate3d(${hx.p - 12}px, ${z.p - 4}px, 0)`;
    if (carrying != null) placeEl(parts[carrying], hx.p - parts[carrying].w / 2, z.p);
  });

  return { start };
}
