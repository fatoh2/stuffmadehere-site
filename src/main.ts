import { mountServo } from './mechanisms/servo';
import { mountLock } from './mechanisms/lock';
import { mountHoop } from './mechanisms/hoop';
import { mountCartridge } from './mechanisms/cartridge';
import { mountPickPlace } from './mechanisms/pickplace';
import { mountGimbal } from './mechanisms/gimbal';
import { mountCamshaft } from './mechanisms/camshaft';
import { mountGeneva } from './mechanisms/geneva';
import { mountPeel } from './mechanisms/peel';
import { mountCnc } from './mechanisms/cnc';
import { mountOdometers } from './mechanisms/odometer';
import { mountDrawers } from './mechanisms/drawers';
import { fetchLive, millions } from './lib/live';
import { latest } from './data/videos';
import { reducedMotion } from './lib/visible';
import { mountSoundToggle } from './lib/sound';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

/* ---------- reveal once, never leave content hidden ---------- */
(() => {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!targets.length) return;
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
  );
  targets.forEach((el) => io.observe(el));
  window.addEventListener('load', () =>
    setTimeout(() => {
      targets.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in');
      });
    }, 2500),
  );
})();

/* ---------- page-wide: servo scroll and the lock ---------- */
const servo = mountServo(document.getElementById('servoPanel'));
mountLock(
  $('#lock'),
  [
    { id: 'miss', label: 'Won’t let you miss' },
    { id: 'now', label: 'Building now' },
    { id: 'all', label: 'All 41' },
    { id: 'drawers', label: 'Parts drawers' },
    { id: 'method', label: 'How a build goes' },
    { id: 'numbers', label: 'The numbers' },
    { id: 'about', label: 'About Shane' },
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

/* ---------- hero: the hoop and the cartridge button ---------- */
const miss = $('#miss');
const gimbal = mountGimbal($('#gimbal'), latest.id, latest.title);
const hoop = mountHoop({
  canvas: $('#rig'),
  score: $('#score'),
  rack: document.getElementById('rack'),
  bottom: document.querySelector<HTMLElement>('.miss__bottom'),
  onCatch: () => {
    const now = document.getElementById('now');
    if (now) servo.scrollTo(now.getBoundingClientRect().top + window.scrollY);
    window.setTimeout(() => gimbal.play(), 700);
  },
});
mountCartridge($('#fire'), hoop, miss);
$('#heroWatch').addEventListener('click', (e) => {
  e.preventDefault();
  const now = document.getElementById('now');
  if (now) servo.scrollTo(now.getBoundingClientRect().top + window.scrollY);
  window.setTimeout(() => gimbal.play(), 700);
});

/* ---------- building now: assembled by the gantry ---------- */
const assembly = mountPickPlace($('#now'));

/* ---------- all 41: the camshaft and the launcher ---------- */
mountCamshaft({
  ledger: $('#ledger'),
  shaftEl: $('#camshaft'),
  preview: $('#preview'),
  landing: $('#landing'),
  launcherCanvas: $('#launcherCanvas'),
  fireButton: $('#fireRandom'),
  card: $('#card'),
  scrollTo: (y) => servo.scrollTo(y),
});

/* ---------- how a build goes: Geneva drive and plotter ---------- */
const feed = mountGeneva({ section: $('#method'), printer: $('#printer'), slip: $('#slip'), notes: $('#slip .slip__notes') });

/* ---------- about: the apple peel ---------- */
const peel = mountPeel($('#about'), $('#aboutText'), $('#peel'));

/* ---------- machined headings and the footer wordmark ---------- */
mountDrawers($('#cabinet'));
const plate = mountOdometers($('#nameplate'));
void fetchLive().then((live) => {
  if (!live || !live.live) return;
  plate.set('videos', String(live.videos));
  plate.set('views', millions(live.views, 0));
  plate.set('subscribers', millions(live.subscribers, 2));
  const sub = document.getElementById('plateSub');
  if (sub) sub.textContent = `Stuff Made Here · live from YouTube, ${live.asOf} · drums roll when the plate comes into view`;
});
const heroCut = mountCnc($('#heroMark'), { seconds: 5, textureUrl: '/parts/milled.jpg', textureScale: 0.55 });
mountCnc($('#miss-h'), { seconds: 2.2 });
mountCnc($('#method-h'), { seconds: 2.4 });

/* ---------- replay controls: every machine can be run again on demand ---------- */
const replay = (id: string, fn: () => void): void => {
  const b = document.getElementById(id) as HTMLButtonElement | null;
  if (!b || reducedMotion()) return;
  b.hidden = false;
  b.addEventListener('click', fn);
};
replay('replayHero', () => heroCut.run());
replay('replayNow', () => assembly.start());
replay('replayMethod', () => feed.reset());
replay('replayAbout', () => peel.reset());

/* ---------- sound, off until switched on ---------- */
mountSoundToggle(Array.from(document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]')));
