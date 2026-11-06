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

export function getHnEmbedMoviePlayerUrl(tmdbId: number | undefined) {
  validateMediaIds(tmdbId);
  return `https://hnembed.cc/embed/movie/${encodeURIComponent(String(tmdbId))}`;
}

export function getHnEmbedEpisodePlayerUrl(
  tmdbId: number | undefined,
  season: number,
  episode: number
) {
  validateMediaIds(tmdbId, season, episode);
  return `https://hnembed.cc/embed/tv/${encodeURIComponent(String(tmdbId))}/${season}/${episode}`;
}
