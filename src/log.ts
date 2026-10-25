import { mountServo } from './mechanisms/servo';
import { mountLock } from './mechanisms/lock';
import { mountProjector, type Frame } from './mechanisms/projector';
import { mountReveal } from './lib/reveal';
import { mountSoundToggle } from './lib/sound';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

mountReveal();
const servo = mountServo(document.getElementById('servoPanel'), ['top', 'reel', 'frames', 'watch']);
mountLock(
  $('#lock'),
  [
    { id: 'reel', label: 'The projector' },
    { id: 'frames', label: 'All sixteen frames' },
    { id: 'watch', label: 'Watch' },
  ],
  (y) => servo.scrollTo(y),
);
$('a[href="#reel"]').addEventListener('click', (e) => {
  e.preventDefault();
  servo.scrollTo($('#reel').getBoundingClientRect().top + window.scrollY);
});

/* ---------- the frames come from the list in the page ---------- */
const frames: Frame[] = Array.from(document.querySelectorAll<HTMLElement>('#reelList .reel__frame')).map((li) => {
  const img = li.querySelector('img')!;
  const cap = li.querySelector('figcaption')!;
  const b = cap.querySelector('b')!;
  return { src: img.getAttribute('src') ?? '', title: b.textContent?.replace(/^\d+\.\s*/, '') ?? '', text: (cap.textContent ?? '').replace(b.textContent ?? '', '').trim() };
});
let current = 0;
const title = $('#logTitle');
const text = $('#logText');
const count = $('#logCount');
const projector = mountProjector($('#projectorCanvas'), frames, (i) => {
  const f = frames[i];
  if (!f) return;
  title.textContent = f.title;
  text.textContent = f.text;
  count.textContent = `Frame ${i + 1} of ${frames.length}`;
  current = i;
});
$('#logBack').addEventListener('click', () => projector.step(-1));
// a frame in the index cranks the projector to it
document.querySelectorAll<HTMLAnchorElement>('.reel__link').forEach((a, i) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    projector.step(i - current);
    servo.scrollTo($('#reel').getBoundingClientRect().top + window.scrollY);
  }),
);
$('#logNext').addEventListener('click', () => projector.step(1));

mountSoundToggle(Array.from(document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]')));
