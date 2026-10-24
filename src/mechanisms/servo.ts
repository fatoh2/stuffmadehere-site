/** Mechanism 2: servo scroll. The wheel sets a target; the page is a unit mass driven to it by a PID
 *  loop. Tuned near critical damping it feels like an excellent native scroll; the knobs let you
 *  detune it. Not applied to touch, keyboard or the scrollbar: those stay native and resync the loop.
 *
 *  The target runs through detents: the top of every section is a notch. A flick carries the page to
 *  the next notch and no further, a flick's inertia tail cannot push it on, and leaving takes a
 *  deliberate push: the page strains against the stop a little, then indexes to the next section.
 *  Where a section is taller than the screen the page scrolls freely inside it and catches at the
 *  next notch. */
import { PID } from '../lib/pid';
import { addTicker } from '../lib/loop';
import { finePointer, reducedMotion } from '../lib/visible';

export interface ServoHandle {
  scrollTo(y: number): void;
  active: boolean;
}

const TUNED = { kp: 90, ki: 0, kd: 19 };
const STOPS = ['top', 'miss', 'now', 'all', 'method', 'numbers', 'about', 'watch'];
const RELEASE = 150; // px of deliberate wheel travel that frees a detent
const SETTLE = 0.28; // s after catching during which a flick's tail is ignored
const ARM_GAP = 120; // ms of quiet that marks a new trackpad gesture
const STRAIN = 30; // px the page gives against a held stop
const PAGED = 1.12; // detents closer than this many screens index one to the next

export function mountServo(panel: HTMLElement | null, stopIds: string[] = STOPS): ServoHandle {
  const active = finePointer() && !reducedMotion();
  if (!active) {
    panel?.remove();
    return {
      active,
      scrollTo: (y) => window.scrollTo({ top: y, behavior: reducedMotion() ? 'auto' : 'smooth' }),
    };
  }

  const pid = new PID(TUNED.kp, TUNED.ki, TUNED.kd);
  let x = window.scrollY;
  let v = 0;
  let sp = x;
  let lastSet = x;
  const maxScroll = (): number => Math.max(0, (document.scrollingElement ?? document.documentElement).scrollHeight - window.innerHeight);
  const clamp = (y: number): number => Math.max(0, Math.min(maxScroll(), y));

  /* ---------- the detents ---------- */
  let stops: number[] = [];
  let stopsAt = -1;
  const detents = (): number[] => {
    const now = performance.now();
    if (now - stopsAt > 400) {
      stops = stopIds.map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => !!el)
        .map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY))
        .filter((y) => y <= maxScroll() + 2)
        .sort((a, b) => a - b);
      stopsAt = now;
    }
    return stops;
  };
  const latch = { on: false, at: 0, dir: 0, push: 0, since: 0, armed: false };
  let lastWheel = -1e9;
  let holdUntil = 0; // no re-seating while a mechanism drives the page
  const catchAt = (y: number, dir: number, now: number): void => {
    latch.on = true;
    latch.at = y;
    latch.dir = dir;
    latch.push = 0;
    latch.since = now;
    latch.armed = false;
    sp = y;
  };
  const strain = (push: number): number => (STRAIN * push) / (push + RELEASE);
  const neighbour = (y: number, dir: number): number | null => {
    const d = detents();
    if (dir > 0) for (const s of d) if (s > y + 2) return s;
    if (dir < 0) for (let i = d.length - 1; i >= 0; i--) if (d[i] < y - 2) return d[i];
    return null;
  };

  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) return; // pinch zoom
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-own-wheel]')) return; // a mechanism that uses the wheel itself
      e.preventDefault();
      const now = performance.now();
      const gap = now - lastWheel;
      lastWheel = now;
      let d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (!d) return;
      const dir = Math.sign(d);
      const notch = Math.abs(d) >= 40 && Number.isInteger(e.deltaY); // a mouse wheel click, not a trackpad

      if (latch.on) {
        if ((now - latch.since) / 1000 < SETTLE) return; // the tail of the flick that got us here
        if (notch || gap > ARM_GAP) latch.armed = true; // a new gesture, not inertia
        if (!latch.armed) return;
        if (dir !== latch.dir) {
          latch.dir = dir;
          latch.push = 0;
        }
        latch.push += Math.abs(d);
        if (latch.push < RELEASE) {
          sp = clamp(latch.at + dir * strain(latch.push)); // strain against the stop
          return;
        }
        // released: index to the next notch when it is a screen away, else scroll on freely
        latch.on = false;
        const next = neighbour(latch.at, dir);
        if (next != null && Math.abs(next - latch.at) <= window.innerHeight * PAGED) {
          catchAt(next, dir, now);
          return;
        }
        d = dir * Math.max(0, latch.push - RELEASE);
        sp = latch.at;
        if (!d) return;
      }

      const from = sp;
      const to = clamp(sp + d);
      const hit = neighbour(from, dir);
      if (hit != null && (dir > 0 ? hit <= to : hit >= to)) catchAt(hit, dir, now);
      else sp = to;
    },
    { passive: false },
  );

  // anything else that scrolls (scrollbar, keyboard, anchors, find-in-page) resyncs the loop
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      if (Math.abs(y - lastSet) > 1.5) {
        x = sp = y;
        v = 0;
        pid.reset();
        lastSet = y;
        latch.on = false;
      }
    },
    { passive: true },
  );

  addTicker((dt) => {
    const now = performance.now();
    const max = maxScroll();
    if (sp > max) sp = max;
    if (latch.on) {
      // a push that stopped short of a release is remembered for a moment, then relaxes onto the stop
      if (latch.push > 0 && now - lastWheel > 900) latch.push = Math.max(0, latch.push - dt * 300);
      sp = clamp(latch.at + latch.dir * strain(latch.push));
    } else if (now - lastWheel > 320 && now > holdUntil && Math.abs(v) < 60) {
      // between notches in a paged region, the plunger drops into the nearest one
      const d = detents();
      let best: number | null = null;
      for (const s of d) if (best == null || Math.abs(s - sp) < Math.abs(best - sp)) best = s;
      if (best != null && Math.abs(best - sp) > 1 && Math.abs(best - sp) < window.innerHeight * 0.35) {
        const other = neighbour(best, sp > best ? 1 : -1);
        if (other == null || Math.abs(other - best) <= window.innerHeight * PAGED) catchAt(best, Math.sign(best - sp) || 1, now);
      }
    }
    const n = 4;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = pid.step(sp - x, v, h);
      v += a * h;
      x += v * h;
      if (x < 0) {
        x = 0;
        if (v < 0) v = 0;
      } else if (x > max) {
        x = max;
        if (v > 0) v = 0;
      }
    }
    const y = Math.round(x * 2) / 2;
    if (Math.abs(y - window.scrollY) >= 0.5) {
      lastSet = y;
      window.scrollTo(0, y);
    }
  });

  /* the knobs */
  if (panel) {
    const hero = document.getElementById('top');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver((es) => es.forEach((e) => panel.classList.toggle('is-hidden', e.isIntersecting)), { threshold: 0.05 }).observe(hero);
    }
    const kp = panel.querySelector<HTMLInputElement>('#kp')!;
    const ki = panel.querySelector<HTMLInputElement>('#ki')!;
    const kd = panel.querySelector<HTMLInputElement>('#kd')!;
    const outs = { kp: panel.querySelector('#kpo')!, ki: panel.querySelector('#kio')!, kd: panel.querySelector('#kdo')! };
    const apply = (): void => {
      pid.kp = +kp.value;
      pid.ki = +ki.value;
      pid.kd = +kd.value;
      outs.kp.textContent = kp.value;
      outs.ki.textContent = ki.value;
      outs.kd.textContent = kd.value;
    };
    [kp, ki, kd].forEach((el) => el.addEventListener('input', apply));
    panel.querySelector('#servoTuned')!.addEventListener('click', () => {
      kp.value = String(TUNED.kp);
      ki.value = String(TUNED.ki);
      kd.value = String(TUNED.kd);
      apply();
    });
    const toggle = panel.querySelector<HTMLButtonElement>('#servoToggle')!;
    toggle.addEventListener('click', () => {
      const open = !panel.classList.contains('is-open');
      panel.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  // the page starts seated in the first notch
  if (sp <= 2) catchAt(0, 1, performance.now());

  // debug probe
  (window as unknown as { __servo: () => unknown }).__servo = () => ({ sp, x: Math.round(x), latch: { ...latch }, detents: detents() });

  return {
    active,
    scrollTo(y) {
      const now = performance.now();
      const t = clamp(y);
      holdUntil = now + 1500;
      const d = detents().find((s) => Math.abs(s - t) <= 2);
      if (d != null) catchAt(d, 1, now);
      else {
        latch.on = false;
        sp = t;
      }
    },
  };
}
