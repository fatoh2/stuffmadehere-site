// Scratch: serve a built dist/ the way Vercel does (brotli for text, nothing for images).
// usage: node serve-dist.mjs <dir> [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { brotliCompressSync, constants } from 'node:zlib';
import { extname, join, normalize } from 'node:path';

const root = process.argv[2];
const port = Number(process.argv[3] ?? 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
const squash = new Set(['.html', '.js', '.css', '.svg', '.json']);
const cache = new Map();

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  let file = join(root, normalize(p));
  try {
    if (!(await stat(file)).isFile()) throw 0;
  } catch {
    if (!extname(p)) {
      file = join(root, normalize(p + '.html'));
      try { await stat(file); } catch { res.writeHead(404).end('not found'); return; }
    } else {
      res.writeHead(404).end('not found');
      return;
    }
  }
  const ext = extname(file);
  const headers = { 'content-type': types[ext] ?? 'application/octet-stream', 'cache-control': 'public, max-age=0, must-revalidate' };
  let body = await readFile(file);
  if (squash.has(ext) && /\bbr\b/.test(req.headers['accept-encoding'] ?? '')) {
    if (!cache.has(file)) cache.set(file, brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
    body = cache.get(file);
    headers['content-encoding'] = 'br';
  }
  headers['content-length'] = body.length;
  res.writeHead(200, headers).end(body);
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on ${port}`));
