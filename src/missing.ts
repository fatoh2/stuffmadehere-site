import { mountPickPlace } from './mechanisms/pickplace';

const path = document.getElementById('missingPath');
if (path) path.textContent = decodeURIComponent(location.pathname + location.search).slice(0, 80) || '/';
const section = document.getElementById('missing');
if (section) {
  const line = mountPickPlace(section);
  // the page is one screen: the gantry starts as soon as the type is ready, whether or not the observer fired
  document.fonts.ready.then(() => window.setTimeout(() => line.start(), 150));
}
