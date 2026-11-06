const OKRU_SEARCH_URL = 'https://ok.ru/video/search';

interface SearchResult {
  id: string;
  title: string;
  embedUrl: string;
  score?: number;
}

interface WorkerEnv {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function normalize(value: string) {
  return decodeHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u0430-\u044f\u0451]+/gi, ' ')
    .trim();
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? 'public, max-age=300' : 'no-store',
    },
  });
}

function findResults(html: string, query: string) {
  const normalizedQuery = normalize(query);
  const queryWords = normalizedQuery.split(/\s+/).filter((word) => word.length >= 2);
  const results = new Map<string, SearchResult>();

  for (const match of html.matchAll(/data-id=["'](\d{6,})["']/g)) {
    const id = match[1];
    if (results.has(id)) continue;

    const start = Math.max(0, match.index - 500);
    const end = Math.min(html.length, match.index + 4000);
    const card = html.slice(start, end);
    const altMatch = card.match(/<img[^>]+alt=["']([^"']+)["'][^>]*>/i);
    const title = altMatch ? decodeHtml(altMatch[1]).trim() : '';
    const normalizedTitle = normalize(title);
    let score = 0;

    for (const word of queryWords) {
      if (normalizedTitle.includes(word)) score += 2;
    }
    if (normalizedTitle.includes(normalizedQuery)) score += 5;

    results.set(id, {
      id,
      title,
      embedUrl: `https://ok.ru/videoembed/${id}`,
      score,
    });
  }

  return [...results.values()]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 10);
}

async function searchOkRu(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';
  const type = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
  const year = url.searchParams.get('year')?.trim() ?? '';
  const season = url.searchParams.get('season')?.trim() ?? '';
  const episode = url.searchParams.get('episode')?.trim() ?? '';

  if (query.length < 2 || query.length > 150) {
    return json({ ok: false, error: 'A valid search title is required.' }, 400);
  }

  const searchTerms = [
    query,
    year,
    type === 'tv' && season ? `S${season.padStart(2, '0')}` : '',
    type === 'tv' && episode ? `E${episode.padStart(2, '0')}` : '',
  ].filter(Boolean).join(' ');

  try {
    const response = await fetch(`${OKRU_SEARCH_URL}?${new URLSearchParams({ 'st.query': searchTerms })}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cf: { cacheTtl: 3600 },
    } as RequestInit);

    if (!response.ok) {
      return json({ ok: false, error: 'OK.ru search is unavailable.' }, 502);
    }

    const html = await response.text();
    const results = findResults(html, searchTerms);
    const confidentResult = (results[0]?.score ?? 0) >= 2 ? results[0] : undefined;
    return json({
      ok: true,
      embedUrl: confidentResult?.embedUrl ?? null,
      results: confidentResult ? results : [],
    });
  } catch {
    return json({ ok: false, error: 'OK.ru search could not be completed.' }, 502);
  }
}

function decodePlayerHtml(value: string) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

async function resolveOkRu(request: Request) {
  const url = new URL(request.url);
  const embedParam = url.searchParams.get('url')?.trim();

  let embedUrl: URL;
  try {
    embedUrl = new URL(embedParam ?? '');
  } catch {
    return json({ ok: false, error: 'A valid OK.ru URL is required.' }, 400);
  }

  const hostname = embedUrl.hostname.toLowerCase();
  if (
    embedUrl.protocol !== 'https:' ||
    !['ok.ru', 'www.ok.ru', 'm.ok.ru'].includes(hostname) ||
    !/^\/video(?:embed)?\/\d+\/?$/.test(embedUrl.pathname)
  ) {
    return json({ ok: false, error: 'Only direct OK.ru video URLs are supported.' }, 400);
  }

  embedUrl.pathname = embedUrl.pathname.replace('/video/', '/videoembed/');
  embedUrl.search = '';

  try {
    const response = await fetch(embedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      cf: { cacheTtl: 300 },
    } as RequestInit);

    if (!response.ok) {
      return json({ ok: false, error: 'OK.ru embed is unavailable.' }, 502);
    }

    const html = await response.text();
    const optionsMatch = html.match(/data-options=["']([^"']+)["']/i);
    if (!optionsMatch) {
      return json({ ok: true, directUrl: null, qualities: [] });
    }

    const options = JSON.parse(decodePlayerHtml(optionsMatch[1])) as {
      flashvars?: { metadata?: unknown };
      metadata?: unknown;
    };
    let metadata = options.flashvars?.metadata ?? options.metadata;
    if (typeof metadata === 'string') {
      metadata = JSON.parse(decodePlayerHtml(metadata));
    }

    const videos = (metadata as { videos?: Array<{ name?: string; url?: string }> } | undefined)?.videos ?? [];
    const qualities = videos
      .filter((video) => {
        if (!video.url) return false;
        try {
          const streamUrl = new URL(video.url);
          return streamUrl.protocol === 'https:' &&
            (streamUrl.hostname === 'okcdn.ru' || streamUrl.hostname.endsWith('.okcdn.ru'));
        } catch {
          return false;
        }
      })
      .map((video) => ({
        name: video.name || 'unknown',
        url: video.url!,
      }));

    const qualityOrder = ['full', 'hd', 'sd', 'low', 'lowest', 'mobile'];
    qualities.sort((a, b) => {
      return qualityOrder.indexOf(a.name) - qualityOrder.indexOf(b.name);
    });

    return json({
      ok: true,
      directUrl: qualities[0]?.url ?? null,
      qualities,
    });
  } catch {
    return json({ ok: false, error: 'OK.ru stream metadata could not be read.' }, 502);
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv) {
    const url = new URL(request.url);
    if (url.pathname === '/api/okru/search') {
      return searchOkRu(request);
    }
    if (url.pathname === '/api/okru/resolve') {
      return resolveOkRu(request);
    }
    return env.ASSETS.fetch(request);
  },
};
