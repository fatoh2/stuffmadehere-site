import { mountServo } from './mechanisms/servo';
import { mountLock } from './mechanisms/lock';
import { mountCnc } from './mechanisms/cnc';
import { mountPainter } from './mechanisms/painter';
import { mountMocap } from './mechanisms/mocap';
import { mountSorter } from './mechanisms/sorter';
import { mountReveal } from './lib/reveal';
import { reducedMotion } from './lib/visible';
import { mountSoundToggle } from './lib/sound';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const $$ = <T extends HTMLElement>(sel: string): T[] => Array.from(document.querySelectorAll<T>(sel));

mountReveal();

/* ---------- page-wide: servo scroll with this page's notches, and the lock ---------- */
const servo = mountServo(document.getElementById('servoPanel'), ['top', 'shop', 'builds', 'work', 'watch']);
mountLock(
  $('#lock'),
  [
    { id: 'shop', label: 'The shop' },
    { id: 'builds', label: 'What he builds' },
    { id: 'work', label: 'How he works' },
    { id: 'watch', label: 'Watch' },
  ],
  (y) => servo.scrollTo(y),
);
document.querySelectorAll<HTMLAnchorElement>('a[href="#top"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    servo.scrollTo(0);
  }),
);

/* ---------- the machines ---------- */
const nameCut = mountCnc($('#aboutMark'), { seconds: 3.2 });
mountCnc($('#shop-h'), { seconds: 2 });

const count = document.getElementById('paintCount');
const painter = mountPainter($('#paintCanvas'), (done, total) => {
  if (count) count.textContent = `${done.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} dots`;
});

mountMocap($('#shopFloor'), $('#mocapCanvas'), $$('#shopTools li'));

const line = mountSorter($('#sorter'), $('#sorterCanvas'), $$('#sorter .sort__card'), $$('#sorter .sort__bin'), $$('#sorter .sort__count'));

/* ---------- replay controls ---------- */
const replay = (id: string, fn: () => void): void => {
  const b = document.getElementById(id) as HTMLButtonElement | null;
  if (!b || reducedMotion()) return;
  b.hidden = false;
  b.addEventListener('click', fn);
};
replay('replayName', () => nameCut.run());
replay('replayPaint', () => painter.run());
replay('sortAgain', () => line.run());

/* ---------- sound, off until switched on ---------- */
mountSoundToggle(Array.from(document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]')));
