/** The vote, counted. With a Vercel KV store (Upstash REST) on the project this keeps one counter per
 *  prototype and a daily cap per address; without one it says so and the page keeps its local counts.
 *  GET returns the totals; POST { idea } adds one. */

const IDEAS = ['table', 'sign', 'learn', 'since', 'flap'];
const CAP_PER_DAY = 50;

interface Req {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  setHeader(name: string, value: string): void;
  status(code: number): Res;
  json(body: unknown): void;
}

function kv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function cmd(store: { url: string; token: string }, ...parts: (string | number)[]): Promise<unknown> {
  const r = await fetch(`${store.url}/${parts.map((p) => encodeURIComponent(String(p))).join('/')}`, {
    headers: { Authorization: `Bearer ${store.token}` },
  });
  if (!r.ok) throw new Error(`kv ${r.status}`);
  const j = (await r.json()) as { result: unknown };
  return j.result;
}

async function totals(store: { url: string; token: string }): Promise<Record<string, number>> {
  const raw = (await cmd(store, 'mget', ...IDEAS.map((i) => `votes:${i}`))) as (string | null)[];
  const out: Record<string, number> = {};
  IDEAS.forEach((i, k) => (out[i] = Number(raw[k] ?? 0)));
  return out;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  const store = kv();
  if (!store) {
    res.status(503).json({ ok: false, reason: 'no store' });
    return;
  }
  try {
    if (req.method === 'GET') {
      res.status(200).json({ ok: true, totals: await totals(store) });
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, reason: 'GET or POST' });
      return;
    }
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { idea?: string } | undefined;
    const idea = body?.idea;
    if (!idea || !IDEAS.includes(idea)) {
      res.status(400).json({ ok: false, reason: 'unknown idea' });
      return;
    }
    const fwd = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd ?? 'unknown').split(',')[0].trim();
    const day = new Date().toISOString().slice(0, 10);
    const used = Number(await cmd(store, 'incr', `rl:${ip}:${day}`));
    if (used === 1) await cmd(store, 'expire', `rl:${ip}:${day}`, 86400);
    if (used > CAP_PER_DAY) {
      res.status(429).json({ ok: false, reason: 'enough for today', totals: await totals(store) });
      return;
    }
    await cmd(store, 'incr', `votes:${idea}`);
    res.status(200).json({ ok: true, totals: await totals(store) });
  } catch (err) {
    res.status(500).json({ ok: false, reason: String(err) });
  }
}
