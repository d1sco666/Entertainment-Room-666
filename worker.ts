interface WorkerEnv {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const KISSASIAN_ORIGIN = 'https://kissasian.com.gr';
const DRAMAVIBE_ORIGIN = 'https://catalog.dramavibe.cfd';

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
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, decimal) =>
      String.fromCharCode(Number.parseInt(hex ?? decimal, hex ? 16 : 10))
    )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(value: string) {
  return normalizeTitle(value).replace(/\s+/g, '-');
}

async function fetchText(url: string, timeoutMs = 25000) {
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, decimal) =>
      String.fromCharCode(Number.parseInt(hex ?? decimal, hex ? 16 : 10))
    );
}

function getRssItems(xml: string) {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi), ([, body]) => {
    const title = body.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '';
    const link = body.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? '';
    return { title: decodeXml(title).trim(), link: decodeXml(link).trim() };
  });
}

async function searchKissAsian(title: string) {
  const searchUrl = new URL(`/search/${encodeURIComponent(title)}/feed/rss2/`, KISSASIAN_ORIGIN);
  const xml = await fetchText(searchUrl.toString());
  return xml ? getRssItems(xml) : [];
}

async function resolveEpisodePage(title: string, episode: number) {
  const wanted = normalizeTitle(title);
  const items = await searchKissAsian(title);

  const episodeItem = items.find((item) => {
    const normalized = normalizeTitle(item.title);
    return item.link.includes('-episode-')
      && new RegExp(`-episode-${episode}(?:/|$)`, 'i').test(item.link)
      && normalized.includes(wanted);
  });
  if (episodeItem?.link.startsWith(KISSASIAN_ORIGIN)) return episodeItem.link;

  const seriesItem = items.find((item) => item.link.includes('/series/') && normalizeTitle(item.title) === wanted);
  if (seriesItem?.link.startsWith(KISSASIAN_ORIGIN)) {
    const seriesHtml = await fetchText(seriesItem.link);
    const episodeLinks = Array.from(seriesHtml?.matchAll(/href=["']([^"']+-episode-\d+\/)["']/gi) ?? [])
      .map((match) => decodeXml(match[1]));
    const match = episodeLinks.find((link) =>
      new RegExp(`-episode-${episode}(?:/|$)`, 'i').test(link)
    );
    if (match?.startsWith(KISSASIAN_ORIGIN)) return match;
  }

  const candidates = [
    `${KISSASIAN_ORIGIN}/${slugify(title)}-episode-${episode}/`,
    `${KISSASIAN_ORIGIN}/${slugify(title).replace(/-season-\d+$/, '')}-episode-${episode}/`,
  ];
  for (const candidate of candidates) {
    const html = await fetchText(candidate);
    if (html) return candidate;
  }
  return null;
}

async function resolveMoviePage(title: string, year?: number) {
  const wanted = normalizeTitle(title);
  const items = await searchKissAsian(title);
  const item = items.find((candidate) => {
    const normalized = normalizeTitle(candidate.title);
    const titleMatches = normalized === wanted
      || normalized.startsWith(`${wanted} `)
      || normalized.includes(wanted);
    const yearMatches = !year || candidate.title.includes(String(year));
    return titleMatches && yearMatches && !candidate.link.includes('/series/');
  });
  if (item?.link.startsWith(KISSASIAN_ORIGIN)) return item.link;

  const candidates = [
    `${KISSASIAN_ORIGIN}/${slugify(title)}-${year ?? ''}/`.replace(/-\/$/, '/'),
    `${KISSASIAN_ORIGIN}/${slugify(title)}-movie/`,
  ];
  for (const candidate of candidates) {
    const html = await fetchText(candidate);
    if (html) return candidate;
  }
  return null;
}

async function resolveKissAsianPlayer(pageUrl: string) {
  const pageHtml = await fetchText(pageUrl);
  const embedMatch = pageHtml?.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (!embedMatch) return null;

  const embedUrl = decodeXml(embedMatch[1]);
  const allowedEmbed = embedUrl.startsWith(DRAMAVIBE_ORIGIN + '/');
  if (!allowedEmbed) return null;

  const episodeMatch = new URL(embedUrl).searchParams.get('episode');
  if (!episodeMatch || !/^\d+$/.test(episodeMatch)) return null;

  const sourceResponse = await fetch(`${DRAMAVIBE_ORIGIN}/player_source.php?episode=${encodeURIComponent(episodeMatch)}`, {
    headers: {
      accept: 'application/json',
      referer: embedUrl,
      'user-agent': 'Mozilla/5.0',
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!sourceResponse.ok) return null;

  const source = await sourceResponse.json() as {
    ok?: boolean;
    src?: string;
    list?: string[];
  };
  if (source.ok !== true || !source.src || !Array.isArray(source.list)) return null;
  if (!source.list.every((url) => url.startsWith('https://cdn.dramav2.xyz/') || url.startsWith('https://cdn.drama3.click/'))) {
    return null;
  }
  return { embedUrl, src: source.src, list: source.list };
}

export default {
  async fetch(request: Request, env: WorkerEnv) {
    const url = new URL(request.url);
    if (url.pathname === '/api/kissasian/resolve') {
      const title = (url.searchParams.get('title') ?? '').trim();
      const episodeValue = Number(url.searchParams.get('episode') ?? 0);
      const yearValue = Number(url.searchParams.get('year') ?? 0);
      const episode = Number.isSafeInteger(episodeValue) && episodeValue > 0 ? episodeValue : undefined;
      const year = Number.isSafeInteger(yearValue) && yearValue > 0 ? yearValue : undefined;
      if (!title) return json({ error: 'Title is required.' }, 400);

      const pageUrl = episode
        ? await resolveEpisodePage(title, episode)
        : await resolveMoviePage(title, year);
      if (!pageUrl) return json({ error: 'This title could not be resolved from KissAsian.' }, 404);

      const player = await resolveKissAsianPlayer(pageUrl);
      if (!player) return json({ error: 'A KissAsian stream could not be resolved.' }, 404);
      return json(player);
    }
    return env.ASSETS.fetch(request);
  },
};
