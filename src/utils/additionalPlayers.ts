export type DubLanguage = 'en' | 'es' | 'ESP' | 'LAT' | 'SUB';

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

export function getSuperEmbedMoviePlayerUrl(tmdbId: number | undefined) {
  validateMediaIds(tmdbId);
  const url = new URL('https://multiembed.mov/');
  url.searchParams.set('video_id', String(tmdbId));
  url.searchParams.set('tmdb', '1');
  return url.toString();
}

export function getSuperEmbedEpisodePlayerUrl(
  tmdbId: number | undefined,
  season: number,
  episode: number
) {
  validateMediaIds(tmdbId, season, episode);
  const url = new URL('https://multiembed.mov/');
  url.searchParams.set('video_id', String(tmdbId));
  url.searchParams.set('tmdb', '1');
  url.searchParams.set('s', String(season));
  url.searchParams.set('e', String(episode));
  return url.toString();
}

export function getAnyEmbedMoviePlayerUrl(tmdbId: number | undefined) {
  validateMediaIds(tmdbId);
  return `https://anyembed.xyz/embed/movie/${encodeURIComponent(String(tmdbId))}`;
}

export function getAnyEmbedEpisodePlayerUrl(
  tmdbId: number | undefined,
  season: number,
  episode: number
) {
  validateMediaIds(tmdbId, season, episode);
  return `https://anyembed.xyz/embed/tv/${encodeURIComponent(String(tmdbId))}/${season}/${episode}`;
}

async function resolveKissAsian(title: string, episode?: number, year?: number) {
  if (!title.trim()) throw new Error('A title is required to search KissAsian.');
  const url = new URL('/api/kissasian/resolve', window.location.origin);
  url.searchParams.set('title', title.trim());
  if (episode) url.searchParams.set('episode', String(episode));
  if (year && Number.isSafeInteger(year)) url.searchParams.set('year', String(year));

  const response = await fetch(url);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.embedUrl) {
    throw new Error(data?.error || 'This title could not be resolved from KissAsian.');
  }
  return data.embedUrl as string;
}

async function resolveSoloLatino(title: string, season?: number, episode?: number) {
  if (!title.trim()) throw new Error('A title is required to search SoloLatino.');
  const url = new URL('/api/sololatino/resolve', window.location.origin);
  url.searchParams.set('title', title.trim());
  if (season) url.searchParams.set('season', String(season));
  if (episode) url.searchParams.set('episode', String(episode));

  const response = await fetch(url);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.embedUrl) {
    throw new Error(data?.error || 'This title could not be resolved from SoloLatino Latino.');
  }
  return data.embedUrl as string;
}

export function getKissAsianMoviePlayerUrl(title: string, year?: number) {
  return resolveKissAsian(title, undefined, year);
}

export function getKissAsianEpisodePlayerUrl(title: string, episode: number) {
  if (!Number.isSafeInteger(episode) || episode < 1) {
    throw new Error('A valid episode number is required.');
  }
  return resolveKissAsian(title, episode);
}

export function getSoloLatinoMoviePlayerUrl(title: string) {
  return resolveSoloLatino(title);
}

export function getSoloLatinoEpisodePlayerUrl(title: string, season: number, episode: number) {
  if (!Number.isSafeInteger(season) || season < 1 || !Number.isSafeInteger(episode) || episode < 1) {
    throw new Error('Valid season and episode numbers are required.');
  }
  return resolveSoloLatino(title, season, episode);
}
