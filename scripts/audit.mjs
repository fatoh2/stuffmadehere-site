#!/usr/bin/env node
// The one-screen audit.
//
// Builds the site, serves dist/ on a local port, and opens every page at six sizes in headless
// Chromium. For each page and size it checks that every listed section is exactly one viewport
// tall (|height - innerHeight| <= 1 px), that the page does not scroll sideways, and that nothing
// was thrown or logged as an error. Prints a table and exits 1 on any failure.
//
//   node scripts/audit.mjs                       build, serve, audit (what CI runs)
//   node scripts/audit.mjs --channel chrome      use the system Chrome instead of Playwright's Chromium
//   node scripts/audit.mjs --no-build            audit the dist/ that is already there
//   node scripts/audit.mjs --url https://...     audit a running server or the live site, no build
//   node scripts/audit.mjs --jobs 2              how many sizes run at once (default 3)

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Every section that must be one screen tall, per page. The WATCH band and the footer are exempt,
// and so is the build log's 'frames' index, which is allowed to be long.
const PAGES = [
  { file: 'index.html', sections: ['top', 'miss', 'putt', 'now', 'all', 'drawers', 'method', 'numbers', 'about'] },
  { file: 'about.html', sections: ['top', 'shop', 'builds', 'work'] },
  { file: 'ideas.html', sections: ['top', 'table', 'sign', 'learn', 'since', 'vote'] },
  { file: 'log.html', sections: ['top', 'reel'] },
];

// Width x height. Anything under 800 px wide is opened as a touch device (isMobile + hasTouch).
const SIZES = [
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1366, 768],
  [1440, 900],
];

const PHONE_BELOW = 800;
const TOLERANCE = 1; // px
const SETTLE_MS = 1000; // after networkidle, for the machines to lay out

// ---------------------------------------------------------------------------------------------
// arguments

function parseArgs(argv) {
  const opts = { build: true, channel: process.env.AUDIT_CHANNEL || undefined, url: process.env.AUDIT_URL || undefined, jobs: 3 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [flag, inline] = a.includes('=') ? a.split(/=(.*)/s) : [a, undefined];
    const next = () => (inline !== undefined ? inline : argv[++i]);
    switch (flag) {
      case '--no-build': opts.build = false; break;
      case '--channel': opts.channel = next(); break;
      case '--url': opts.url = next(); opts.build = false; break;
      case '--jobs': opts.jobs = Math.max(1, Number(next()) || 1); break;
      case '--help': case '-h':
        console.log('usage: node scripts/audit.mjs [--channel chrome] [--no-build] [--url <base>] [--jobs <n>]');
        process.exit(0);
      default:
        console.error(`unknown argument: ${a}`);
        process.exit(2);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------------------------
// build and serve

async function buildSite() {
  const { build } = await import('vite');
  const t0 = Date.now();
  await build({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'), logLevel: 'warn' });
  console.log(`built dist/ in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

// The serverless functions in api/ are not part of dist/. Answer them the way a deployment
// without the keys does ("not live"), so the page takes its fallback path instead of logging a 404.
const apiStub = {
  name: 'audit:api-stub',
  configurePreviewServer(server) {
    server.middlewares.use('/api', (_req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ live: false, ok: false }));
    });
  },
};

async function serveDist() {
  const { preview } = await import('vite');
  const server = await preview({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.ts'),
    logLevel: 'warn',
    plugins: [apiStub],
    preview: { host: '127.0.0.1', port: 4173, strictPort: false, open: false },
  });
  let base = server.resolvedUrls?.local?.[0];
  if (!base) {
    const addr = server.httpServer.address();
    base = `http://127.0.0.1:${addr.port}/`;
  }
  return { server, base: base.replace(/\/$/, '') };
}

// ---------------------------------------------------------------------------------------------
// one page at one size

async function auditPage(context, base, pageDef, size) {
  const [width, height] = size;
  const page = await context.newPage();
  const errors = [];
  const notes = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const where = m.location()?.url;
    errors.push(`console: ${m.text()}${where ? ` (${where})` : ''}`);
  });

  const url = `${base}/${pageDef.file === 'index.html' ? '' : pageDef.file}`;
  let measured = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => notes.push('network never went idle'));
    await page.waitForTimeout(SETTLE_MS);
    measured = await page.evaluate((ids) => {
      const de = document.documentElement;
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        overflow: de.scrollWidth - de.clientWidth,
        sections: ids.map((id) => {
          const el = document.getElementById(id);
          return { id, found: !!el, height: el ? el.getBoundingClientRect().height : NaN };
        }),
      };
    }, pageDef.sections);
  } catch (e) {
    errors.push(`audit: ${e.message.split('\n')[0]}`);
  } finally {
    await page.close().catch(() => undefined);
  }

  const problems = [];
  if (measured) {
    for (const s of measured.sections) {
      if (!s.found) problems.push(`#${s.id} is missing`);
      else if (Math.abs(s.height - measured.innerHeight) > TOLERANCE) {
        const d = s.height - measured.innerHeight;
        problems.push(`#${s.id} is ${s.height.toFixed(1)} px tall, the viewport ${measured.innerHeight} (${d > 0 ? '+' : ''}${d.toFixed(1)})`);
      }
    }
    if (measured.overflow !== 0) problems.push(`scrolls sideways by ${measured.overflow} px`);
  } else {
    problems.push('could not measure the page');
  }
  for (const e of errors) problems.push(e.length > 300 ? `${e.slice(0, 300)}…` : e);

  const okSections = measured ? measured.sections.filter((s) => s.found && Math.abs(s.height - measured.innerHeight) <= TOLERANCE).length : 0;
  return {
    page: pageDef.file,
    size: `${width}x${height}`,
    mode: width < PHONE_BELOW ? 'touch' : 'desktop',
    sections: `${okSections}/${pageDef.sections.length}`,
    overflow: measured ? `${measured.overflow} px` : '?',
    errors: errors.length,
    pass: problems.length === 0,
    problems,
    notes,
  };
}

// ---------------------------------------------------------------------------------------------
// run every size, a few at a time

async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function auditSize(browser, base, size) {
  const [width, height] = size;
  const phone = width < PHONE_BELOW;
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: phone,
    hasTouch: phone,
    deviceScaleFactor: 1,
  });
  try {
    const rows = [];
    for (const pageDef of PAGES) rows.push(await auditPage(context, base, pageDef, size));
    return rows;
  } finally {
    await context.close().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------------------------
// the table

function table(rows) {
  const cols = [
    ['page', (r) => r.page],
    ['size', (r) => r.size],
    ['mode', (r) => r.mode],
    ['sections', (r) => r.sections],
    ['overflow', (r) => r.overflow],
    ['errors', (r) => String(r.errors)],
    ['result', (r) => (r.pass ? 'PASS' : 'FAIL')],
  ];
  const cells = rows.map((r) => cols.map(([, f]) => f(r)));
  const widths = cols.map(([h], i) => Math.max(h.length, ...cells.map((c) => c[i].length)));
  const line = (c) => c.map((v, i) => v.padEnd(widths[i])).join('  ').trimEnd();
  const out = [line(cols.map(([h]) => h)), widths.map((w) => '-'.repeat(w)).join('  ')];
  for (const c of cells) out.push(line(c));
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const t0 = Date.now();

  if (opts.build) await buildSite();

  let server = null;
  let base = opts.url ? opts.url.replace(/\/$/, '') : null;
  if (!base) {
    ({ server, base } = await serveDist());
    console.log(`serving dist/ at ${base}`);
  } else {
    console.log(`auditing ${base}`);
  }

  const browser = await chromium.launch({ headless: true, channel: opts.channel });
  console.log(`${opts.channel ? `chrome (${opts.channel})` : 'chromium'} ${browser.version()}, ${PAGES.length} pages x ${SIZES.length} sizes, ${opts.jobs} at a time\n`);

  let rows = [];
  try {
    const perSize = await pool(SIZES, opts.jobs, (size) => auditSize(browser, base, size));
    // page-major order reads better than size-major
    for (const pageDef of PAGES) for (const sizeRows of perSize) rows.push(sizeRows.find((r) => r.page === pageDef.file));
  } finally {
    await browser.close().catch(() => undefined);
    if (server) await server.close().catch(() => undefined);
  }

  console.log(table(rows));

  const failed = rows.filter((r) => !r.pass);
  const noted = rows.filter((r) => r.notes.length);
  if (noted.length) {
    console.log('');
    for (const r of noted) for (const n of r.notes) console.log(`note  ${r.page} ${r.size}: ${n}`);
  }
  if (failed.length) {
    console.log('');
    for (const r of failed) {
      console.log(`FAIL  ${r.page} at ${r.size} (${r.mode})`);
      for (const p of r.problems) console.log(`      ${p}`);
    }
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log('');
  if (failed.length) {
    console.log(`${failed.length} of ${rows.length} page/size pairs failed in ${secs} s`);
    process.exitCode = 1;
  } else {
    console.log(`all ${rows.length} page/size pairs pass in ${secs} s`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
