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
import { fetchLive } from './lib/live';

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
const clock = mountEscapement($('#escapeCanvas'), new Date(`${latest.date}T12:00:00Z`), { days: document.getElementById('sinceDays'), clock: document.getElementById('sinceClock') });
void fetchLive().then((live) => {
  if (!live || !live.live) return;
  clock.setSince(new Date(`${live.latest.date}T12:00:00Z`));
  if (sinceLink) {
    sinceLink.href = watchUrl(live.latest.id);
    sinceLink.textContent = live.latest.title;
  }
});
mountTally($$('button.tally'), document.getElementById('resetVotes') as HTMLButtonElement | null, (live) => {
  const note = document.getElementById('voteNote');
  const reset = document.getElementById('resetVotes');
  if (live && note) note.textContent = 'The counts are everyone’s, kept on the server, fifty taps a day per address.';
  if (live && reset) reset.hidden = true;
});

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
const tiltBtn = document.getElementById('tiltBall') as HTMLButtonElement | null;
tiltBtn?.addEventListener('click', () => {
  void table.tilt().then((ok) => {
    tiltBtn.textContent = ok ? 'Tilting with you' : 'No tilt sensor here';
    tiltBtn.disabled = true;
  });
});
control('clearPlate', () => panto.clear());
control('keepPlate', () => {
  const url = panto.keep();
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = 'engraved-plate.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
});
const signForm = document.getElementById('signForm') as HTMLFormElement | null;
const signText = document.getElementById('signText') as HTMLInputElement | null;
signForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (signText?.value.trim()) panto.sign(signText.value);
});
control('fireAgain', () => treb.reset());

/* ---------- sound, off until switched on ---------- */
mountSoundToggle(Array.from(document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]')));
