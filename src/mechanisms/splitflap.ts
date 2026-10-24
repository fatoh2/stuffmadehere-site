/** A split-flap board. Every character sits on its own wheel of flaps, driven by its own stepper: the
 *  wheel steps through the alphabet until the right flap drops, so a title arrives the way a departures
 *  board does, each letter settling in its own time. New. */
import { reducedMotion } from '../lib/visible';

export interface FlapHandle {
  run(): void;
}

const ALPHABET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?’-';

export function mountSplitFlap(host: HTMLElement): FlapHandle {
  const text = (host.textContent ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  host.setAttribute('aria-label', text);
  host.textContent = '';
  const wheels: { el: HTMLElement; target: number; at: number; timer: number }[] = [];
  for (const word of text.split(' ')) {
    const w = document.createElement('span');
    w.className = 'flap__word';
    for (const ch of word) {
      const cell = document.createElement('span');
      cell.className = 'flap';
      const face = document.createElement('span');
      face.className = 'flap__char';
      face.textContent = ch;
      cell.appendChild(face);
      w.appendChild(cell);
      const target = Math.max(0, ALPHABET.indexOf(ch));
      wheels.push({ el: cell, target, at: target, timer: 0 });
    }
    host.appendChild(w);
    host.appendChild(document.createTextNode(' '));
  }

  const show = (wheel: (typeof wheels)[number]): void => {
    wheel.el.firstElementChild!.textContent = ALPHABET[wheel.at] === ' ' ? ' ' : ALPHABET[wheel.at];
  };

  function run(): void {
    if (reducedMotion()) return;
    wheels.forEach((wheel, i) => {
      window.clearInterval(wheel.timer);
      // each wheel starts somewhere else and steps at its own rate, like a board with worn motors
      wheel.at = (wheel.target + 8 + Math.floor(Math.random() * (ALPHABET.length - 10))) % ALPHABET.length;
      show(wheel);
      const period = 62 + (i % 5) * 6;
      wheel.timer = window.setInterval(() => {
        wheel.at = (wheel.at + 1) % ALPHABET.length;
        show(wheel);
        wheel.el.classList.remove('is-step');
        void wheel.el.offsetWidth;
        wheel.el.classList.add('is-step');
        if (wheel.at === wheel.target) {
          window.clearInterval(wheel.timer);
          wheel.el.classList.add('is-set');
        }
      }, period);
      wheel.el.classList.remove('is-set');
    });
  }

  run();
  return { run };
}
