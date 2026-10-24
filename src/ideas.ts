import { mountServo } from './mechanisms/servo';
import { mountLock } from './mechanisms/lock';
import { mountSplitFlap } from './mechanisms/splitflap';
import { mountBalance } from './mechanisms/balance';
import { mountPantograph } from './mechanisms/pantograph';
import { mountTrebuchet } from './mechanisms/trebuchet';
import { mountEscapement } from './mechanisms/escapement';
import { mountTally } from './mechanisms/ratchet';
import { mountReveal } from './lib/reveal';
import { reducedMotion } from './lib/visible';
import { mountSoundToggle } from './lib/sound';
import { latest, watchUrl } from './data/videos';

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const $$ = <T extends HTMLElement>(sel: string): T[] => Array.from(document.querySelectorAll<T>(sel));

mountReveal();

/* ---------- page-wide: servo scroll with this page's notches, and the lock ---------- */
const servo = mountServo(document.getElementById('servoPanel'), ['top', 'table', 'sign', 'learn', 'since', 'vote', 'watch']);
mountLock(
  $('#lock'),
  [
    { id: 'table', label: 'Won’t let it fall' },
    { id: 'sign', label: 'Sign small' },
    { id: 'learn', label: 'A trebuchet that learns' },
    { id: 'since', label: 'Days since' },
    { id: 'vote', label: 'Vote' },
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
// the vote button on the board scrolls through the servo too
$('a[href="#vote"]').addEventListener('click', (e) => {
  e.preventDefault();
  servo.scrollTo($('#vote').getBoundingClientRect().top + window.scrollY);
});

/* ---------- the six machines ---------- */
const board = mountSplitFlap($('#ideasMark'));
const table = mountBalance($('#balanceCanvas'), document.getElementById('balanceStat'));
const panto = mountPantograph($('#pantoCanvas'));
const treb = mountTrebuchet($('#trebCanvas'), document.getElementById('shotLog'));
const sinceLink = document.getElementById('sinceLink') as HTMLAnchorElement | null;
if (sinceLink) {
  sinceLink.href = watchUrl(latest.id);
  sinceLink.textContent = latest.title;
}
mountEscapement($('#escapeCanvas'), new Date(`${latest.date}T12:00:00Z`), { days: document.getElementById('sinceDays'), clock: document.getElementById('sinceClock') });
mountTally($$('button.tally'), document.getElementById('resetVotes') as HTMLButtonElement | null);

/* ---------- controls ---------- */
const control = (id: string, fn: () => void): void => {
  const b = document.getElementById(id) as HTMLButtonElement | null;
  if (!b) return;
  if (reducedMotion() && b.classList.contains('replay')) return;
  b.hidden = false;
  b.addEventListener('click', fn);
};
control('replayFlap', () => board.run());
control('shoveBall', () => table.shove());
control('clearPlate', () => panto.clear());
const signForm = document.getElementById('signForm') as HTMLFormElement | null;
const signText = document.getElementById('signText') as HTMLInputElement | null;
signForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (signText?.value.trim()) panto.sign(signText.value);
});
control('fireAgain', () => treb.reset());

/* ---------- sound, off until switched on ---------- */
mountSoundToggle(Array.from(document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]')));
