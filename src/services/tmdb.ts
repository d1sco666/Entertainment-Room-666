import type { CineSrcEpisode, CineSrcMovie, CineSrcSeason, CineSrcSearchResult, CineSrcTVShow } from '../types';

const API_URL = 'https://api.themoviedb.org/3';
const IMAGE_URL = 'https://image.tmdb.org/t/p';
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

interface TMDBList<T> {
  page: number;
  total_pages: number;
  total_results?: number;
  results: T[];
}

interface TMDBTitle {
  id: number;
  title?: string;
  name?: string;
  adult?: boolean;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  release_date?: string;
  first_air_date?: string;
  last_air_date?: string;
}

interface TMDBMovie extends TMDBTitle {
  title: string;
  release_date?: string;
  runtime?: number | null;
  imdb_id?: string | null;
  release_dates?: {
    results?: {
      iso_3166_1: string;
      release_dates: { certification: string }[];
    }[];
  };
}

interface TMDBTVShow extends TMDBTitle {
  name: string;
  original_name?: string;
  alternative_titles?: {
    results?: { title: string; iso_3166_1?: string }[];
  };
  first_air_date?: string;
  last_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  external_ids?: { imdb_id?: string | null };
  content_ratings?: {
    results?: { iso_3166_1: string; rating: string }[];
  };
}

interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview?: string;
  still_path?: string | null;
  air_date?: string;
  runtime?: number | null;
  vote_average?: number;
}

interface TMDBSeason {
  season_number: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  air_date?: string;
  episodes?: TMDBEpisode[];
}

interface TMDBVideo {
  key: string;
  site: string;
  type: string;
  official?: boolean;
  iso_639_1?: string;
}

interface TMDBSearchResult extends TMDBTitle {
  media_type?: string;
  runtime?: number | null;
  first_air_date?: string;
}

export interface TMDBWatchProvider {
  provider_id: number;
  provider_name: string;
  display_priority: number;
}

export interface TMDBCountry {
  iso_3166_1: string;
  english_name: string;
  native_name: string;
}

// TMDB keyword IDs for the categories this app never shows: fan-made
// films, fake/placeholder movies and adult titles. Applied through
// `without_keywords` on the discover endpoints, which support it.
const JUNK_KEYWORD_IDS = [
  189978, // fan film
  378267, // fanfilm
  253056, // fanfic
  328865, // fake film
  360629, // adult
  284535, // adult video
  161919, // adult animation
  337153, // adult drama
  385955, // porn
  155139, // porn parody
  256466, // erotic
  302868, // erotic comedy
  298666, // erotic romance
  155691, // erotic vignettes
  352503, // erotic theater
  198385, // hentai
  155477, // softcore
  341367, // soft porn
  382870, // gay softcore
  325693, // erotica
  354470, // sex scene
  33451, // masturbation
  199040, // strip
  155857, // strip tease
  320667, // adult film actress
  379142, // adult film actor
  379979, // mature and adult film
];

// A title needs a real audience before its average rating means
// anything. Without this floor, fan films rated 10.0 on a single vote
// dominate the "Top Rated" sort.
const MIN_TOP_RATED_VOTES = 200;

// Titles that state their junk category outright. TMDB leaves some of
// these unflagged and without keywords, so they are dropped client side
// as well. Patterns stay specific to avoid catching mainstream titles.
const JUNK_TITLE_PATTERNS = [
  /\bfan\s*film\b/i,
  /\bfan\s*made\b/i,
  /\bfanfic\b/i,
  /\bfake\s*film\b/i,
  /\bporn\b/i,
  /\bhentai\b/i,
  /\berotic\b/i,
  /\berotica\b/i,
  /\bsoftcore\b/i,
  /\bsoft\s*-?\s*porn\b/i,
  /\bporno\b/i,
  /\bsex\s*scene\b/i,
  /\bmasturbat/i,
  /\badult\s*(?:film|video|animation|drama)\b/i,
];

function isJunkTitle(title: string) {
  return JUNK_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

// TMDB flags softcore and other adult titles with `adult: true` on the
// result itself. Only the discover endpoints support `without_keywords`,
// so every other endpoint relies on this flag plus the title patterns.
function isBlockedTitle(title: string, adult?: boolean) {
  return adult === true || isJunkTitle(title);
}

const genreNames: Record<number, string> = {
  12: 'Adventure', 14: 'Fantasy', 16: 'Animation', 18: 'Drama',
  27: 'Horror', 28: 'Action', 35: 'Comedy', 36: 'History',
  37: 'Western', 53: 'Thriller', 80: 'Crime', 99: 'Documentary',
  878: 'Science Fiction', 9648: 'Mystery', 10402: 'Music',
  10749: 'Romance', 10751: 'Family', 10752: 'War', 10759: 'Action & Adventure',
  10762: 'Kids', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
  10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
};

export const movieGenres = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];

export const tvGenres = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Mystery' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10766, name: 'Soap' },
  { id: 10767, name: 'Talk' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
];

function image(path: string | null | undefined, size: 'w342' | 'w500' | 'w780' | 'original' = 'w500') {
  return path ? `${IMAGE_URL}/${size}${path}` : '';
}

function getGenres(title: TMDBTitle) {
  return title.genres?.map((genre) => genre.name)
    ?? title.genre_ids?.map((id) => genreNames[id]).filter((name): name is string => Boolean(name))
    ?? [];
}

function mapMovie(movie: TMDBMovie): CineSrcMovie {
  const usReleases = movie.release_dates?.results?.find((region) => region.iso_3166_1 === 'US');
  const certification = usReleases?.release_dates.find((release) => release.certification)?.certification
    ?? movie.release_dates?.results?.flatMap((region) => region.release_dates).find((release) => release.certification)?.certification;

  return {
    id: String(movie.id),
    tmdbId: movie.id,
    imdbId: movie.imdb_id ?? undefined,
    title: movie.title,
    year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : 0,
    overview: movie.overview ?? '',
    poster: image(movie.poster_path),
    backdrop: image(movie.backdrop_path, 'w780'),
    backdropOriginal: image(movie.backdrop_path, 'original'),
    rating: movie.vote_average ?? 0,
    voteCount: movie.vote_count,
    ageRating: certification || undefined,
    certification: certification || undefined,
    genres: getGenres(movie),
    runtime: movie.runtime ?? 0,
    releaseDate: movie.release_date ?? '',
  };
}

function mapTVShow(show: TMDBTVShow): CineSrcTVShow {
  const usRating = show.content_ratings?.results?.find((region) => region.iso_3166_1 === 'US')?.rating;
  const rating = usRating || show.content_ratings?.results?.find((region) => region.rating)?.rating;

  return {
    id: String(show.id),
    tmdbId: show.id,
    imdbId: show.external_ids?.imdb_id ?? undefined,
    name: show.name,
    originalName: show.original_name ?? undefined,
    alternativeNames: [...new Set(
      (show.alternative_titles?.results ?? [])
        .map((entry) => entry.title.trim())
        .filter((title) => title && title !== show.name && title !== show.original_name)
    )],
    overview: show.overview ?? '',
    poster: image(show.poster_path),
    backdrop: image(show.backdrop_path, 'w780'),
    backdropOriginal: image(show.backdrop_path, 'original'),
    rating: show.vote_average ?? 0,
    voteCount: show.vote_count,
    ageRating: rating || undefined,
    certification: rating || undefined,
    genres: getGenres(show),
    firstAirDate: show.first_air_date ?? '',
    lastAirDate: show.last_air_date || 'Present',
    numberOfSeasons: show.number_of_seasons ?? 0,
    numberOfEpisodes: show.number_of_episodes ?? 0,
    status: show.status ?? 'Unknown',
  };
}

function mapEpisode(episode: TMDBEpisode): CineSrcEpisode {
  return {
    id: String(episode.id),
    episodeNumber: episode.episode_number,
    name: episode.name,
    overview: episode.overview ?? '',
    still: image(episode.still_path, 'w342'),
    airDate: episode.air_date ?? '',
    runtime: episode.runtime ?? 0,
    rating: episode.vote_average ?? 0,
  };
}

class TMDBAPI {
  private readonly responseCache = new Map<string, { expiresAt: number; response: Promise<unknown> }>();
  private movieRuntimeRequests = new Map<string, Promise<number>>();
  private movieDetailRequests = new Map<string, Promise<CineSrcMovie>>();
  private tvDetailRequests = new Map<string, Promise<CineSrcTVShow>>();

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!API_KEY) {
      throw new Error('TMDB API key is missing. Set VITE_TMDB_API_KEY in .env.local for local development or in your deployment build variables, then rebuild.');
    }

    const url = new URL(`${API_URL}${endpoint}`);
    url.search = new URLSearchParams({ api_key: API_KEY, ...params }).toString();
    const cacheKey = url.toString();
    const cached = this.responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.response as Promise<T>;
    }
    if (cached) this.responseCache.delete(cacheKey);

    const response = fetch(url, { headers: { Accept: 'application/json' } })
      .then(async (result) => {
        if (!result.ok) {
          throw new Error(`TMDB request failed (${result.status}). Check the API key and TMDB access.`);
        }
        return result.json() as Promise<unknown>;
      });
    const cachedResponse = response.catch((error: unknown) => {
      if (this.responseCache.get(cacheKey)?.response === cachedResponse) {
        this.responseCache.delete(cacheKey);
      }
      throw error;
    });

    for (const [key, entry] of this.responseCache) {
      if (entry.expiresAt <= Date.now()) this.responseCache.delete(key);
    }
    if (this.responseCache.size >= 100) {
      const oldestKey = this.responseCache.keys().next().value;
      if (oldestKey) this.responseCache.delete(oldestKey);
    }
    this.responseCache.set(cacheKey, {
      expiresAt: Date.now() + 5 * 60 * 1000,
      response: cachedResponse,
    });
    return cachedResponse as Promise<T>;
  }

  async search(query: string, page = 1): Promise<CineSrcSearchResult> {
    const data = await this.request<TMDBList<TMDBSearchResult>>('/search/multi', {
      query,
      page: String(page),
      include_adult: 'false',
    });
    const movies = data.results
      .filter((result) => result.media_type === 'movie')
      .filter((result) => !isBlockedTitle(result.title ?? '', result.adult))
      .map((result) => mapMovie(result as TMDBMovie));
    const tvShows = data.results
      .filter((result) => result.media_type === 'tv')
      .filter((result) => !isBlockedTitle(result.name ?? '', result.adult))
      .map((result) => mapTVShow(result as TMDBTVShow));

    return {
      movies,
      tvShows,
      total: data.total_results ?? movies.length + tvShows.length,
      page: data.page,
      totalPages: data.total_pages,
    };
  }

  async getPopularMovies(page = 1): Promise<{ movies: CineSrcMovie[]; totalPages: number }> {
    const data = await this.request<TMDBList<TMDBMovie>>('/movie/popular', { page: String(page) });
    return {
      movies: data.results
        .filter((movie) => !isBlockedTitle(movie.title, movie.adult))
        .map(mapMovie),
      totalPages: data.total_pages,
    };
  }

  async getPopularTVShows(page = 1): Promise<{ tvShows: CineSrcTVShow[]; totalPages: number }> {
    const data = await this.request<TMDBList<TMDBTVShow>>('/tv/popular', { page: String(page) });
    return {
      tvShows: data.results
        .filter((show) => !isBlockedTitle(show.name, show.adult))
        .map(mapTVShow),
      totalPages: data.total_pages,
    };
  }

  async discoverTitles(
    type: 'movie' | 'tv',
    filters: {
      genreId: number | null;
      ageRating: string;
      sortBy: 'popular' | 'top_rated';
      year: number | null;
      providerId: number | null;
      countryCode: string | null;
    },
    page = 1,
  ): Promise<{ items: (CineSrcMovie | CineSrcTVShow)[]; totalPages: number }> {
    const params: Record<string, string> = {
      page: String(page),
      sort_by: filters.sortBy === 'top_rated' ? 'vote_average.desc' : 'popularity.desc',
      include_adult: 'false',
    };
    if (filters.genreId !== null) params.with_genres = String(filters.genreId);
    if (filters.year !== null) {
      params[type === 'movie' ? 'primary_release_year' : 'first_air_date_year'] = String(filters.year);
    }
    if (filters.providerId !== null) {
      params.watch_region = 'US';
      params.with_watch_providers = String(filters.providerId);
    }
    if (filters.ageRating) {
      params.certification_country = 'US';
      params.certification = filters.ageRating;
    }
    if (filters.countryCode) {
      params.with_origin_country = filters.countryCode;
    }
    params.without_keywords = JUNK_KEYWORD_IDS.join(',');
    // Popularity already implies an audience, so unreleased blockbusters
    // with no votes yet stay visible. Only the rating sort needs a floor.
    if (filters.sortBy === 'top_rated') {
      params['vote_count.gte'] = String(MIN_TOP_RATED_VOTES);
    }

    if (type === 'movie') {
      const data = await this.request<TMDBList<TMDBMovie>>('/discover/movie', params);
      return {
        items: data.results
          .filter((movie) => !isBlockedTitle(movie.title, movie.adult))
          .map(mapMovie),
        totalPages: data.total_pages,
      };
    }
    const data = await this.request<TMDBList<TMDBTVShow>>('/discover/tv', params);
    return {
      items: data.results
        .filter((show) => !isBlockedTitle(show.name, show.adult))
        .map(mapTVShow),
      totalPages: data.total_pages,
    };
  }

  async getWatchProviders(type: 'movie' | 'tv'): Promise<TMDBWatchProvider[]> {
    const data = await this.request<{ results: TMDBWatchProvider[] }>(
      `/watch/providers/${type}`,
      { watch_region: 'US' },
    );
    return data.results;
  }

  async getCountries(): Promise<TMDBCountry[]> {
    return this.request<TMDBCountry[]>('/configuration/countries');
  }

  async getTrendingMovies(page = 1): Promise<{ movies: CineSrcMovie[]; totalPages: number }> {
    const data = await this.request<TMDBList<TMDBMovie>>('/trending/movie/day', { page: String(page) });
    return {
      movies: data.results
        .filter((movie) => !isBlockedTitle(movie.title, movie.adult))
        .map(mapMovie),
      totalPages: data.total_pages,
    };
  }

  async getPopularHorrorMovies(page = 1): Promise<{ movies: CineSrcMovie[]; totalPages: number }> {
    const data = await this.request<TMDBList<TMDBMovie>>('/discover/movie', {
      page: String(page),
      sort_by: 'popularity.desc',
      with_genres: '27',
      'vote_count.gte': '20',
      include_adult: 'false',
      without_keywords: JUNK_KEYWORD_IDS.join(','),
    });
    return {
      movies: data.results
        .filter((movie) => !isBlockedTitle(movie.title, movie.adult))
        .map(mapMovie),
      totalPages: data.total_pages,
    };
  }

  async getMovieTrailer(movieId: number): Promise<string | null> {
    return this.getTrailer('movie', movieId);
  }

  async getTVShowTrailer(showId: number): Promise<string | null> {
    return this.getTrailer('tv', showId);
  }

  private async getTrailer(type: 'movie' | 'tv', id: number): Promise<string | null> {
    const data = await this.request<{ results: TMDBVideo[] }>(`/${type}/${id}/videos`);
    const trailers = data.results.filter((video) => video.site === 'YouTube' && video.key);
    const selected = trailers
      .filter((video) => video.type === 'Trailer')
      .sort((a, b) => Number(Boolean(b.official)) - Number(Boolean(a.official))
        || Number(b.iso_639_1 === 'es') - Number(a.iso_639_1 === 'es'))[0]
      ?? trailers.find((video) => video.type === 'Teaser');
    return selected?.key ?? null;
  }

  async getTrendingTVShows(page = 1): Promise<{ tvShows: CineSrcTVShow[]; totalPages: number }> {
    const data = await this.request<TMDBList<TMDBTVShow>>('/trending/tv/day', { page: String(page) });
    return {
      tvShows: data.results
        .filter((show) => !isBlockedTitle(show.name, show.adult))
        .map(mapTVShow),
      totalPages: data.total_pages,
    };
  }

  async getMovieDetails(id: string): Promise<CineSrcMovie> {
    const cached = this.movieDetailRequests.get(id);
    if (cached) return cached;

    const request = this.request<TMDBMovie>(`/movie/${encodeURIComponent(id)}`, {
      append_to_response: 'release_dates',
    }).then(mapMovie).catch((error: unknown) => {
      this.movieDetailRequests.delete(id);
      throw error;
    });
    this.movieDetailRequests.set(id, request);
    return request;
  }

  getMovieRuntime(id: string): Promise<number> {
    const cached = this.movieRuntimeRequests.get(id);
    if (cached) return cached;

    const request = this.getMovieDetails(id)
      .then((movie) => movie.runtime)
      .catch((error: unknown) => {
        this.movieRuntimeRequests.delete(id);
        throw error;
      });
    this.movieRuntimeRequests.set(id, request);
    return request;
  }

  async getTVShowDetails(id: string): Promise<CineSrcTVShow> {
    const cached = this.tvDetailRequests.get(id);
    if (cached) return cached;

    const request = this.request<TMDBTVShow>(`/tv/${encodeURIComponent(id)}`, {
      append_to_response: 'content_ratings,external_ids,alternative_titles',
    }).then(mapTVShow).catch((error: unknown) => {
      this.tvDetailRequests.delete(id);
      throw error;
    });
    this.tvDetailRequests.set(id, request);
    return request;
  }

  async getSeasonDetails(tvId: string, seasonNumber: number): Promise<CineSrcSeason> {
    const season = await this.request<TMDBSeason>(`/tv/${encodeURIComponent(tvId)}/season/${seasonNumber}`);
    return {
      seasonNumber: season.season_number,
      name: season.name,
      overview: season.overview ?? '',
      poster: image(season.poster_path),
      airDate: season.air_date ?? '',
      episodeCount: season.episodes?.length ?? 0,
      episodes: season.episodes?.map(mapEpisode) ?? [],
    };
  }
}

export const tmdbAPI = new TMDBAPI();
