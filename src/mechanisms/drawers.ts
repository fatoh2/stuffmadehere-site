/** Parts drawers. Six drawers in a steel cabinet, one per family of machine; pull one and it runs out
 *  on its slides with the inertia of a loaded drawer, a soft close at the end of travel, and the
 *  thumbnails inside as parts in bins. One drawer open at a time, as in any shop. New. */
import { axis, stepAxis, type Axis } from '../lib/motor';
import { addTicker } from '../lib/loop';
import { reducedMotion } from '../lib/visible';
import { cue } from '../lib/sound';

interface Drawer {
  root: HTMLElement;
  front: HTMLButtonElement;
  slot: HTMLElement;
  bin: HTMLElement;
  open: boolean;
  y: Axis; // the bin's position: -H (shut) to 0 (out)
  h: number;
}

export function mountDrawers(cabinet: HTMLElement): void {
  const still = reducedMotion();
  const drawers: Drawer[] = Array.from(cabinet.querySelectorAll<HTMLElement>('.drawer')).map((root) => ({
    root,
    front: root.querySelector<HTMLButtonElement>('.drawer__front')!,
    slot: root.querySelector<HTMLElement>('.drawer__slot')!,
    bin: root.querySelector<HTMLElement>('.drawer__bin')!,
    open: false,
    y: axis(0, 2600, 16000),
    h: 0,
  }));

  // a drawer may run out only as far as keeps the whole section on one screen; the bin scrolls inside
  const measure = (d: Drawer): number => {
    d.bin.hidden = false;
    const sec = cabinet.closest<HTMLElement>('section');
    const slots = drawers.reduce((a, o) => a + o.slot.getBoundingClientRect().height, 0);
    const cabH = cabinet.getBoundingClientRect().height - slots;
    const head = sec?.querySelector<HTMLElement>('.drawers__head')?.getBoundingClientRect().height ?? 0;
    const cs = sec ? getComputedStyle(sec) : null;
    const pad = cs ? parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) : 0;
    const avail = Math.max(140, window.innerHeight - pad - head - cabH - 32);
    return Math.min(d.bin.scrollHeight, avail);
  };

  const place = (d: Drawer): void => {
    d.bin.style.transform = `translate3d(0, ${d.y.p.toFixed(1)}px, 0)`;
  };

  const set = (d: Drawer, open: boolean): void => {
    d.open = open;
    d.front.setAttribute('aria-expanded', String(open));
    d.root.classList.toggle('is-open', open);
    if (open) {
      d.h = measure(d);
      d.slot.style.height = `${d.h}px`;
      if (still) {
        d.y.p = 0;
        place(d);
      } else if (d.y.p === 0) d.y.p = -d.h; // starts shut
    } else if (still) {
      d.slot.style.height = '0px';
      d.bin.hidden = true;
    }
  };

  for (const d of drawers) {
    d.bin.hidden = true;
    d.slot.style.height = '0px';
    d.front.addEventListener('click', () => {
      const wasOpen = d.open;
      for (const o of drawers) if (o !== d && o.open) set(o, false);
      set(d, !wasOpen);
      cue.index();
    });
  }

  if (still) return;
  addTicker((dt) => {
    for (const d of drawers) {
      const target = d.open ? 0 : -d.h;
      if (d.y.p === target && !d.open && !d.bin.hidden && d.slot.style.height === '0px') continue;
      if (d.y.p === target && d.open) continue;
      stepAxis(d.y, target, dt);
      place(d);
      if (!d.open) {
        // the slot shrinks with the bin so the cabinet closes up behind it
        const shown = Math.max(0, d.h + d.y.p);
        d.slot.style.height = `${shown.toFixed(1)}px`;
        if (d.y.p === target) {
          d.bin.hidden = true;
          d.slot.style.height = '0px';
        }
      }
    }
  });
}
