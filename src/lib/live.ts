/** The live figures from /api/channel, when the deployment has them; null when it does not or when
 *  the request is slow. The page never waits on this. */
export interface Live {
  live: boolean;
  asOf: string;
  subscribers: number;
  views: number;
  videos: number;
  latest: { id: string; title: string; date: string };
}

export async function fetchLive(timeoutMs = 3500): Promise<Live | null> {
  if (location.protocol === 'file:') return null;
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch('/api/channel', { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j = (await r.json()) as Live;
    return j && typeof j.subscribers === 'number' ? j : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

/** 4812345 → "4.8", 352104000 → "352", for a drum with an M beside it. */
export function millions(n: number, decimals: number): string {
  const m = n / 1e6;
  return decimals ? m.toFixed(decimals) : String(Math.round(m));
}
