/** Mechanism C: pin-tumbler navigation. One pin stack per section; the key slides in as you scroll
 *  and each stack sets at the shear line when its section arrives. From the two unpickable locks. */
import { clamp } from '../lib/motor';
import { cue } from '../lib/sound';

export interface LockSection {
  id: string;
  label: string;
}

const SVG = 'http://www.w3.org/2000/svg';
const SHEAR = 23;
const PIN_H = 11;

export function mountLock(nav: HTMLElement, sections: LockSection[], scrollTo: (y: number) => void): void {
  const pinsG = nav.querySelector<SVGGElement>('#lockPins')!;
  const key = nav.querySelector<SVGGElement>('#lockKey')!;
  const buttons = nav.querySelector<HTMLElement>('#lockPinButtons')!;
  const menu = nav.querySelector<HTMLButtonElement>('#lockMenu')!;
  const list = nav.querySelector<HTMLElement>('#lockList')!;
  const links = Array.from(list.querySelectorAll<HTMLAnchorElement>('a'));
  links.forEach((a, i) => a.style.setProperty('--i', String(i)));

  const stacks = sections.map((s, i) => {
    const x = 44 + i * 26;
    const channel = document.createElementNS(SVG, 'rect');
    channel.setAttribute('x', String(x));
    channel.setAttribute('y', '2');
    channel.setAttribute('width', '10');
    channel.setAttribute('height', '38');
    channel.setAttribute('fill', 'var(--recess)');
    const driver = document.createElementNS(SVG, 'rect');
    driver.setAttribute('x', String(x + 1));
    driver.setAttribute('width', '8');
    driver.setAttribute('height', String(PIN_H));
    driver.setAttribute('fill', 'var(--steel-dark)');
    const pin = document.createElementNS(SVG, 'rect');
    pin.setAttribute('x', String(x + 1));
    pin.setAttribute('width', '8');
    pin.setAttribute('height', String(PIN_H));
    pin.setAttribute('fill', 'var(--steel)');
    pinsG.append(channel, driver, pin);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lock__pin';
    b.setAttribute('aria-label', s.label);
    b.title = s.label;
    b.addEventListener('click', () => {
      const el = document.getElementById(s.id);
      if (el) scrollTo(el.getBoundingClientRect().top + window.scrollY);
    });
    buttons.append(b);
    return { s, driver, pin, lift: -1 };
  });

  function setPins(): void {
    const vh = window.innerHeight;
    const y = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    key.setAttribute('transform', `translate(${(y / max) * 70} 0)`);
    let active = -1;
    stacks.forEach((st, i) => {
      const el = document.getElementById(st.s.id);
      if (!el) return;
      const top = el.getBoundingClientRect().top + y;
      const raw = clamp((y + vh * 0.6 - top) / (vh * 0.4), 0, 1);
      const lift = raw * raw * (3 - 2 * raw);
      if (raw >= 1 || (raw > 0 && i === stacks.length - 1)) active = i;
      if (Math.abs(lift - st.lift) < 0.002) return;
      st.lift = lift;
      // at full lift the key pin's top sits exactly on the shear line; unset, it sits 17 lower
      const pinY = SHEAR - PIN_H + (1 - lift) * 17;
      st.pin.setAttribute('y', String(pinY));
      st.driver.setAttribute('y', String(pinY - PIN_H));
    });
    stacks.forEach((st, i) => st.pin.setAttribute('fill', i === active ? 'var(--accent)' : 'var(--steel)'));
    // in the open door, the section you are in carries the set pin
    const here = active >= 0 ? `#${stacks[active].s.id}` : '';
    links.forEach((a) => a.classList.toggle('is-here', !!here && a.getAttribute('href') === here));
  }
  let queued = false;
  const onScroll = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      setPins();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  setPins();

  /* phone menu */
  // the deadbolt: the key turns, the bolt draws back with a click, and the door swings in from the edge
  let opening = 0;
  const open = (v: boolean): void => {
    if (list.classList.contains('is-open') === v) return;
    window.clearTimeout(opening);
    list.classList.toggle('is-open', v);
    nav.classList.toggle('is-open', v);
    menu.setAttribute('aria-expanded', String(v));
    document.documentElement.style.overflow = v ? 'hidden' : '';
    cue.index();
    if (v) opening = window.setTimeout(() => (list.querySelector('a') as HTMLElement | null)?.focus({ preventScroll: true }), 620);
    else menu.focus({ preventScroll: true });
  };
  menu.addEventListener('click', () => open(!list.classList.contains('is-open')));
  list.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const el = document.querySelector<HTMLElement>(a.getAttribute('href')!);
      if (!el) return;
      e.preventDefault();
      open(false);
      scrollTo(el.getBoundingClientRect().top + window.scrollY);
    });
  });
  // step aside over the band and the footer, whose grounds it would fight
  if ('IntersectionObserver' in window) {
    const away = new Set<Element>();
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => (e.isIntersecting ? away.add(e.target) : away.delete(e.target)));
        nav.classList.toggle('is-away', away.size > 0);
      },
      { rootMargin: '-60px 0px 0px 0px', threshold: 0 },
    );
    ['watch', 'foot'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && list.classList.contains('is-open')) open(false);
  });
}
