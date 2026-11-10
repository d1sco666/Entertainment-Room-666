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
  const items = new Map<string, { title: string; link: string }>();
  const pageFingerprints = new Set<string>();

  for (let page = 1; page <= 8; page += 1) {
    const searchUrl = new URL(`/search/${encodeURIComponent(title)}/feed/rss2/`, KISSASIAN_ORIGIN);
    if (page > 1) searchUrl.searchParams.set('paged', String(page));
    const xml = await fetchText(searchUrl.toString());
    if (!xml) break;

    const pageItems = getRssItems(xml);
    const fingerprint = pageItems.map((item) => item.link).join('|');
    if (!pageItems.length || pageFingerprints.has(fingerprint)) break;
    pageFingerprints.add(fingerprint);
    for (const item of pageItems) {
      if (isKissAsianUrl(item.link)) items.set(item.link, item);
    }

    const pageCount = Number(xml.match(/Page\s+\d+\s+of\s+(\d+)/i)?.[1]);
    if ((pageCount && page >= pageCount) || pageItems.length < 10) break;
  }
  return [...items.values()];
}

function isKissAsianUrl(value: string) {
  try {
    return new URL(value).origin === KISSASIAN_ORIGIN;
  } catch {
    return false;
  }
}

function normalizeKissAsianTitle(value: string) {
  return decodeXml(value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function kissAsianTitleBase(value: string) {
  return value
    .replace(/\|.*$/, '')
    .replace(/\b(?:episode|ep)\s*[-:#]?\s*\d+.*$/i, '')
    .replace(/\b(?:english\s*)?(?:sub(?:bed)?|dub(?:bed)?|raw)\b.*$/i, '')
    .replace(/\(\s*(?:19|20)\d{2}\s*\)/g, ' ')
    .replace(/\b(?:season|s)\s*[-:#]?\s*\d+\b/gi, ' ');
}

function kissAsianTitleScore(candidate: string, titles: string[]) {
  const candidateName = normalizeKissAsianTitle(kissAsianTitleBase(candidate));
  if (!candidateName) return 0;
  const candidateTokens = new Set(candidateName.split(' ').filter(Boolean));
  let best = 0;

  for (const title of titles) {
    const wanted = normalizeKissAsianTitle(title);
    if (!wanted) continue;
    if (candidateName === wanted) {
      best = Math.max(best, 1000);
      continue;
    }
    const wantedTokens = [...new Set(wanted.split(' ').filter(Boolean))];
    if (!wantedTokens.length) continue;
    const overlap = wantedTokens.filter((token) => candidateTokens.has(token)).length;
    const recall = overlap / wantedTokens.length;
    const precision = overlap / candidateTokens.size;
    const score = Math.round(recall * 600 + precision * 300);
    best = Math.max(best, score);
  }
  return best;
}

function kissAsianYear(value: string) {
  return Number(value.match(/(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/)?.[1]) || undefined;
}

function kissAsianSeason(value: string) {
  return Number(value.match(/\b(?:season|s)[- _:#]*(\d+)\b/i)?.[1]) || undefined;
}

function kissAsianEpisode(value: string) {
  return Number(value.match(/\b(?:episode|ep)[- _:#]*(\d+)\b/i)?.[1]) || undefined;
}

function kissAsianSearchTitles(title: string, alternateTitles: string[] = []) {
  return [...new Set([title.trim(), ...alternateTitles.map((value) => value.trim())]
    .filter((value) => Boolean(value)))].slice(0, 4);
}

async function searchKissAsianTitles(titles: string[]) {
  const results = await Promise.all(titles.map(searchKissAsian));
  return [...new Map(results.flat().map((item) => [item.link, item])).values()];
}

function matchesKissAsianEpisode(
  item: { title: string; link: string },
  titles: string[],
  season: number,
  episode: number,
  year?: number
) {
  const itemEpisodes = [kissAsianEpisode(item.title), kissAsianEpisode(item.link)]
    .filter((value): value is number => value !== undefined);
  if (!itemEpisodes.includes(episode) || itemEpisodes.some((value) => value !== episode)) return false;
  const itemSeasons = [kissAsianSeason(item.title), kissAsianSeason(item.link)]
    .filter((value): value is number => value !== undefined);
  if (itemSeasons.some((value) => value !== season) || (season > 1 && !itemSeasons.length)) return false;
  const itemYears = [kissAsianYear(item.title), kissAsianYear(item.link)]
    .filter((value): value is number => value !== undefined);
  if (year && itemYears.some((value) => value !== year)) return false;
  return kissAsianTitleScore(item.title, titles) >= 800;
}

async function resolveEpisodePage(
  title: string,
  season: number,
  episode: number,
  year?: number,
  alternateTitles: string[] = []
) {
  const titles = kissAsianSearchTitles(title, alternateTitles);
  const items = await searchKissAsianTitles(titles);
  const matchingItem = items
    .filter((item) => matchesKissAsianEpisode(item, titles, season, episode, year))
    .sort((a, b) => {
      const score = kissAsianTitleScore(b.title, titles) - kissAsianTitleScore(a.title, titles);
      if (score) return score;
      return Number(kissAsianYear(`${b.title} ${b.link}`) === year)
        - Number(kissAsianYear(`${a.title} ${a.link}`) === year);
    })[0];
  if (matchingItem && isKissAsianUrl(matchingItem.link)) return matchingItem.link;

  const candidates = titles.flatMap((candidateTitle) => {
    const slug = slugify(candidateTitle);
    const yearSuffix = year ? `-${year}` : '';
    return season > 1
      ? [
        `${KISSASIAN_ORIGIN}/${slug}${yearSuffix}-season-${season}-episode-${episode}/`,
        `${KISSASIAN_ORIGIN}/${slug}-season-${season}-episode-${episode}/`,
      ]
      : [
        `${KISSASIAN_ORIGIN}/${slug}${yearSuffix}-episode-${episode}/`,
        `${KISSASIAN_ORIGIN}/${slug}-episode-${episode}/`,
      ];
  });
  for (const candidate of candidates) {
    const pageHtml = await fetchText(candidate);
    const pageTitle = pageHtml?.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    if (!pageTitle || !isKissAsianUrl(candidate)) continue;
    const item = { title: decodeXml(pageTitle), link: candidate };
    if (matchesKissAsianEpisode(item, titles, season, episode, year)) return candidate;
  }
  return null;
}

async function resolveMoviePage(title: string, year?: number) {
  const titles = [title];
  const items = await searchKissAsian(title);
  const item = items
    .filter((candidate) => {
      if (candidate.link.includes('/series/') || kissAsianEpisode(candidate.title) !== undefined) return false;
      const itemYear = kissAsianYear(`${candidate.title} ${candidate.link}`);
      return (!year || !itemYear || itemYear === year)
        && kissAsianTitleScore(candidate.title, titles) >= 800;
    })
    .sort((a, b) => kissAsianTitleScore(b.title, titles) - kissAsianTitleScore(a.title, titles))[0];
  if (item && isKissAsianUrl(item.link)) return item.link;

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
      const seasonValue = Number(url.searchParams.get('season') ?? 1);
      const yearValue = Number(url.searchParams.get('year') ?? 0);
      const episode = Number.isSafeInteger(episodeValue) && episodeValue > 0 ? episodeValue : undefined;
      const season = Number.isSafeInteger(seasonValue) && seasonValue > 0 ? seasonValue : 1;
      const year = Number.isSafeInteger(yearValue) && yearValue > 0 ? yearValue : undefined;
      const alternateTitles = url.searchParams.getAll('alternateTitle')
        .map((value) => value.trim())
        .filter(Boolean);
      if (!title) return json({ error: 'Title is required.' }, 400);

      const pageUrl = episode
        ? await resolveEpisodePage(title, season, episode, year, alternateTitles)
        : await resolveMoviePage(title, year);
      if (!pageUrl) return json({ error: 'This title could not be resolved from KissAsian.' }, 404);

      const player = await resolveKissAsianPlayer(pageUrl);
      if (!player) return json({ error: 'A KissAsian stream could not be resolved.' }, 404);
      return json(player);
    }
    return env.ASSETS.fetch(request);
  },
};
