interface WorkerEnv {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const KISSKH_ORIGIN = 'https://kisskh.org';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function fetchText(url: string, timeoutMs = 25000) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function getKissKhSearchNonce() {
  const html = await fetchText(KISSKH_ORIGIN);
  const match = html?.match(/var dtGonza\s*=\s*(\{[^;]+\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1])?.nonce ?? null;
  } catch {
    return null;
  }
}

async function searchKissKhMovie(title: string, year?: number) {
  const nonce = await getKissKhSearchNonce();
  if (!nonce) return null;

  const searchUrl = `${KISSKH_ORIGIN}/wp-json/dooplay/search/?keyword=${encodeURIComponent(title)}&nonce=${encodeURIComponent(nonce)}`;
  const responseText = await fetchText(searchUrl);
  if (!responseText) return null;

  try {
    const results = JSON.parse(responseText) as Record<string, {
      title?: string;
      url?: string;
      extra?: { date?: string };
    }>;
    const wanted = normalizeTitle(title);
    const entries = Object.entries(results);
    return entries
      .filter(([, item]) => typeof item.url === 'string' && item.url.includes('/movies/'))
      .find(([, item]) => normalizeTitle(item.title ?? '') === wanted && (!year || item.extra?.date === String(year)))
      ?? entries.find(([, item]) =>
        typeof item.url === 'string'
        && item.url.includes('/movies/')
        && normalizeTitle(item.title ?? '').includes(wanted)
      )
      ?? null;
  } catch {
    return null;
  }
}

async function resolveKissKhMovie(title: string, year?: number) {
  const match = await searchKissKhMovie(title, year);
  if (!match) return null;

  const [postId, item] = match;
  const pageHtml = await fetchText(item.url);
  const pagePostId = pageHtml?.match(/\bpostid-(\d+)/)?.[1] ?? postId;
  const pageUrl = new URL(`${KISSKH_ORIGIN}/wp-admin/admin-ajax.php`);
  const ajaxResponse = await fetch(pageUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'Mozilla/5.0',
      referer: item.url,
    },
    body: new URLSearchParams({
      action: 'doo_player_ajax',
      post: pagePostId,
      type: 'movie',
      nume: '1',
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!ajaxResponse.ok) return null;

  try {
    const player = await ajaxResponse.json() as { embed_url?: string; type?: string | boolean };
    if (!player.embed_url || !player.type) return null;
    const embedUrl = new URL(player.embed_url);
    const directSource = embedUrl.searchParams.get('source');
    return directSource || player.embed_url;
  } catch {
    return null;
  }
}
export default {
  async fetch(request: Request, env: WorkerEnv) {
    const url = new URL(request.url);
    if (url.pathname === '/api/kisskh/movie') {
      const title = (url.searchParams.get('title') ?? '').trim();
      const yearValue = Number(url.searchParams.get('year') ?? 0);
      const year = Number.isSafeInteger(yearValue) && yearValue > 0 ? yearValue : undefined;
      if (!title) return json({ error: 'Movie title is required.' }, 400);

      const resolvedUrl = await resolveKissKhMovie(title, year);
      if (!resolvedUrl) {
        return json({ error: 'This movie could not be resolved from KissKH.' }, 404);
      }
      return json({ url: resolvedUrl });
    }
    return env.ASSETS.fetch(request);
  },
};
