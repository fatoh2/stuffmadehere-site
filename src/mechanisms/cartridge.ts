/** Mechanism 6: the blank-cartridge button. Hold to chamber, release to fire; a plain tap fires at
 *  a default charge so it is never slower than a click. From the explosive bat, axe and nut cracker. */
import { clamp } from '../lib/motor';
import { capture } from '../lib/pointer';
import type { HoopHandle } from './hoop';

export function mountCartridge(el: HTMLAnchorElement, hoop: HoopHandle, hero: HTMLElement): void {
  const gauge = el.querySelector<HTMLElement>('.cartridge__gauge')!;
  let holding = false;
  let t0 = 0;
  let charge = 0;
  let raf = 0;

  function tick(): void {
    if (!holding) return;
    charge = clamp((performance.now() - t0) / 1200, 0, 1);
    gauge.style.transform = `scaleX(${charge})`;
    raf = requestAnimationFrame(tick);
  }

  function launch(c: number): void {
    const r = el.getBoundingClientRect();
    const hr = hero.getBoundingClientRect();
    hoop.fire(r.left - hr.left + 18, r.top - hr.top + r.height / 2, c);
    el.classList.add('is-fired');
    hero.classList.add('is-recoil');
    window.setTimeout(() => el.classList.remove('is-fired'), 150);
    window.setTimeout(() => hero.classList.remove('is-recoil'), 320);
    if (navigator.vibrate) navigator.vibrate(Math.round(15 + c * 45));
  }

  // a long press on a phone must chamber a round, not open the link's context menu or drag it
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('dragstart', (e) => e.preventDefault());
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.pointerType === 'touch') e.preventDefault();
    capture(el, e);
    holding = true;
    t0 = performance.now();
    charge = 0;
    el.classList.remove('is-fired');
    el.classList.add('is-holding');
    tick();
  });

  function release(): void {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(raf);
    el.classList.remove('is-holding');
    gauge.style.transform = 'scaleX(0)';
    launch(charge < 0.15 ? 0.6 : charge);
  }
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', () => {
    holding = false;
    cancelAnimationFrame(raf);
    el.classList.remove('is-holding');
    gauge.style.transform = 'scaleX(0)';
  });
  el.addEventListener('click', (e) => {
    e.preventDefault();
    if (e.detail === 0) launch(0.6); // keyboard activation: no pointer events happened
  });
}
