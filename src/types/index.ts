export interface CineSrcMovie {
  id: string;
  simklHref?: string;
  title: string;
  year: number;
  overview: string;
  poster: string;
  backdrop: string;
  backdropOriginal?: string;
  rating: number;
  ageRating?: string;
  certification?: string;
  contentRating?: string;
  genres: string[];
  runtime: number;
  releaseDate: string;
  voteCount?: number;
  imdbId?: string;
  tmdbId?: number;
}

export interface CineSrcTVShow {
  id: string;
  simklHref?: string;
  name: string;
  originalName?: string;
  alternativeNames?: string[];
  overview: string;
  poster: string;
  backdrop: string;
  backdropOriginal?: string;
  rating: number;
  ageRating?: string;
  certification?: string;
  contentRating?: string;
  genres: string[];
  firstAirDate: string;
  lastAirDate: string;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  status: string;
  voteCount?: number;
  imdbId?: string;
  tmdbId?: number;
}

export interface CineSrcSeason {
  seasonNumber: number;
  name: string;
  overview: string;
  poster: string;
  airDate: string;
  episodeCount: number;
  episodes: CineSrcEpisode[];
}

export interface CineSrcEpisode {
  episodeNumber: number;
  name: string;
  overview: string;
  still: string;
  airDate: string;
  runtime: number;
  rating: number;
  id: string;
}

export interface CineSrcSearchResult {
  movies: CineSrcMovie[];
  tvShows: CineSrcTVShow[];
  total: number;
  page: number;
  totalPages: number;
}

export type SavedMedia =
  | { type: 'movie'; item: CineSrcMovie }
  | { type: 'tv'; item: CineSrcTVShow };

export type ContinueWatchingItem = SavedMedia & {
  lastWatchedAt: number;
  episode?: {
    seasonNumber: number;
    episodeNumber: number;
    name: string;
  };
};

export type WatchedItem = SavedMedia & {
  watchedAt: number;
  episode?: {
    seasonNumber: number;
    episodeNumber: number;
    name: string;
  };
};
