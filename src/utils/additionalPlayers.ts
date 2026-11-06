export type DubLanguage = 'en' | 'es' | 'ESP' | 'LAT' | 'SUB';
export type OkRuLanguage = 'en' | 'es';

interface OkRuCatalog {
  movies?: Record<string, Partial<Record<OkRuLanguage, string>>>;
  tv?: Record<string, Record<string, Record<string, Partial<Record<OkRuLanguage, string>>>>>;
}

let okRuCatalogPromise: Promise<OkRuCatalog> | null = null;

function validateOkRuEmbedUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('The OK.ru catalog contains an invalid embed URL.');
  }

  const allowedHosts = new Set(['ok.ru', 'www.ok.ru', 'm.ok.ru']);
  if (
    url.protocol !== 'https:' ||
    !allowedHosts.has(url.hostname.toLowerCase()) ||
    !/^\/video(embed)?\/\d+(?:\/?$|\?)/.test(url.pathname + url.search)
  ) {
    throw new Error('Only direct OK.ru video embed URLs are supported.');
  }
  return url.toString();
}

async function getOkRuCatalog() {
  if (!okRuCatalogPromise) {
    okRuCatalogPromise = fetch('/okru-catalog.json', { cache: 'no-cache' })
      .then(async (response) => {
        if (!response.ok) throw new Error('The OK.ru content catalog could not be loaded.');
        return await response.json() as OkRuCatalog;
      })
      .catch((error) => {
        okRuCatalogPromise = null;
        throw error instanceof Error ? error : new Error('The OK.ru content catalog could not be loaded.');
      });
  }
  return okRuCatalogPromise;
}

function validateMediaIds(tmdbId: number | undefined, season?: number, episode?: number) {
  if (!tmdbId || !Number.isSafeInteger(tmdbId) || tmdbId < 1) {
    throw new Error('A valid TMDB ID is required to open this title.');
  }

  if (
    (season !== undefined && (!Number.isSafeInteger(season) || season < 1)) ||
    (episode !== undefined && (!Number.isSafeInteger(episode) || episode < 1))
  ) {
    throw new Error('Valid season and episode numbers are required to open this episode.');
  }
}

async function resolveOkRuEmbedUrl(embedUrl: string) {
  const validatedEmbedUrl = validateOkRuEmbedUrl(embedUrl);
  const resolveUrl = new URL('/api/okru/resolve', window.location.origin);
  resolveUrl.searchParams.set('url', validatedEmbedUrl);

  const response = await fetch(resolveUrl);
  if (!response.ok) {
    return validatedEmbedUrl;
  }

  const result = await response.json() as { directUrl?: string };
  return result.directUrl || validatedEmbedUrl;
}

export function getVidstuckMovieEmbedUrl(tmdbId?: number) {
  validateMediaIds(tmdbId);
  return `https://vidstuck.cc/embed/movie/${tmdbId}`;
}

export function getVidstuckEpisodeEmbedUrl(tmdbId: number | undefined, season: number, episode: number) {
  validateMediaIds(tmdbId, season, episode);
  return `https://vidstuck.cc/embed/tv/${tmdbId}/${season}/${episode}`;
}

export function getZxcstreamMoviePlayerUrl(tmdbId: number | undefined, dubLanguage: DubLanguage) {
  validateMediaIds(tmdbId);
  const url = new URL(`https://zxcstream.cc/player/movie/${tmdbId}`);
  url.searchParams.set('dubLang', dubLanguage);
  return url.toString();
}

export function getZxcstreamEpisodePlayerUrl(
  tmdbId: number | undefined,
  season: number,
  episode: number,
  dubLanguage: DubLanguage
) {
  validateMediaIds(tmdbId, season, episode);
  const url = new URL(`https://zxcstream.cc/player/tv/${tmdbId}/${season}/${episode}`);
  url.searchParams.set('dubLang', dubLanguage);
  return url.toString();
}

export async function getOkRuMovieEmbedUrl(
  tmdbId: number | undefined,
  language: OkRuLanguage,
  title?: string,
  year?: number
) {
  validateMediaIds(tmdbId);
  const catalog = await getOkRuCatalog();
  const embedUrl = catalog.movies?.[String(tmdbId)]?.[language];
  if (embedUrl) {
    return resolveOkRuEmbedUrl(embedUrl);
  }

  if (!title) {
    throw new Error(`No OK.ru embed is available for this movie.`);
  }

  const searchUrl = new URL('/api/okru/search', window.location.origin);
  searchUrl.searchParams.set('q', title);
  searchUrl.searchParams.set('type', 'movie');
  if (year) searchUrl.searchParams.set('year', String(year));

  const response = await fetch(searchUrl);
  if (!response.ok) {
    throw new Error('OK.ru could not find an embeddable result for this movie.');
  }

  const result = await response.json() as { embedUrl?: string; directUrl?: string };
  if (!result.embedUrl && !result.directUrl) {
    throw new Error('No public OK.ru embed was found for this movie.');
  }
  if (result.directUrl) {
    return result.directUrl;
  }
  if (!result.embedUrl) {
    throw new Error('No public OK.ru embed was found for this movie.');
  }
  return resolveOkRuEmbedUrl(result.embedUrl);
}

export async function getOkRuEpisodeEmbedUrl(
  tmdbId: number | undefined,
  season: number,
  episode: number,
  language: OkRuLanguage,
  title?: string,
  year?: number
) {
  validateMediaIds(tmdbId, season, episode);
  const catalog = await getOkRuCatalog();
  const embedUrl = catalog.tv?.[String(tmdbId)]?.[String(season)]?.[String(episode)]?.[language];
  if (embedUrl) {
    return resolveOkRuEmbedUrl(embedUrl);
  }

  if (!title) {
    throw new Error(`No OK.ru embed is available for this episode.`);
  }

  const searchUrl = new URL('/api/okru/search', window.location.origin);
  searchUrl.searchParams.set('q', title);
  searchUrl.searchParams.set('type', 'tv');
  searchUrl.searchParams.set('season', String(season));
  searchUrl.searchParams.set('episode', String(episode));
  if (year) searchUrl.searchParams.set('year', String(year));

  const response = await fetch(searchUrl);
  if (!response.ok) {
    throw new Error('OK.ru could not find an embeddable result for this episode.');
  }

  const result = await response.json() as { embedUrl?: string; directUrl?: string };
  if (!result.embedUrl && !result.directUrl) {
    throw new Error('No public OK.ru embed was found for this episode.');
  }
  if (result.directUrl) {
    return result.directUrl;
  }
  if (!result.embedUrl) {
    throw new Error('No public OK.ru embed was found for this episode.');
  }
  return resolveOkRuEmbedUrl(result.embedUrl);
}
