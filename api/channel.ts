/** Live channel figures. With a YouTube Data API key in the environment this reads the channel's
 *  statistics and its latest upload once an hour (cached at the edge); without one it returns the
 *  figures the site was built with, marked as such. Nothing here is required for the site to work. */

interface Reply {
  live: boolean;
  asOf: string;
  subscribers: number;
  views: number;
  videos: number;
  latest: { id: string; title: string; date: string };
}

const BUILT: Reply = {
  live: false,
  asOf: '2026-10-24',
  subscribers: 4800000,
  views: 352000000,
  videos: 41,
  latest: { id: 'RpslsMqPFWA', title: 'I made an apple peel itself', date: '2026-08-05' },
};

const HANDLE = 'stuffmadehere';

interface Req {
  method?: string;
}
interface Res {
  setHeader(name: string, value: string): void;
  status(code: number): Res;
  json(body: unknown): void;
}

async function fetchLive(key: string): Promise<Reply> {
  const base = 'https://www.googleapis.com/youtube/v3';
  const ch = await fetch(`${base}/channels?part=statistics,contentDetails&forHandle=${HANDLE}&key=${key}`);
  if (!ch.ok) throw new Error(`channels ${ch.status}`);
  const cj = (await ch.json()) as { items?: { statistics: Record<string, string>; contentDetails: { relatedPlaylists: { uploads: string } } }[] };
  const item = cj.items?.[0];
  if (!item) throw new Error('no channel');
  const uploads = item.contentDetails.relatedPlaylists.uploads;
  const pl = await fetch(`${base}/playlistItems?part=snippet&maxResults=1&playlistId=${uploads}&key=${key}`);
  if (!pl.ok) throw new Error(`playlist ${pl.status}`);
  const pj = (await pl.json()) as { items?: { snippet: { title: string; publishedAt: string; resourceId: { videoId: string } } }[] };
  const v = pj.items?.[0]?.snippet;
  return {
    live: true,
    asOf: new Date().toISOString().slice(0, 10),
    subscribers: Number(item.statistics.subscriberCount ?? BUILT.subscribers),
    views: Number(item.statistics.viewCount ?? BUILT.views),
    videos: Number(item.statistics.videoCount ?? BUILT.videos),
    latest: v ? { id: v.resourceId.videoId, title: v.title, date: v.publishedAt.slice(0, 10) } : BUILT.latest,
  };
}

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
    res.status(200).json(BUILT);
    return;
  }
  try {
    const live = await fetchLive(key);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(live);
  } catch (err) {
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json({ ...BUILT, error: String(err) });
  }
}
