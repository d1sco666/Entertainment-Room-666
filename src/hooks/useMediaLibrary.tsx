import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ContinueWatchingItem, CineSrcEpisode, CineSrcTVShow, SavedMedia, WatchedItem } from '../types';

const WATCHLIST_KEY = 'entertainment-room-watchlist';
const CONTINUE_WATCHING_KEY = 'entertainment-room-continue-watching';
const WATCHED_KEY = 'entertainment-room-watched';

interface MediaLibraryContextValue {
  watchlist: SavedMedia[];
  continueWatching: ContinueWatchingItem[];
  watched: WatchedItem[];
  storageError: string | null;
  toggleWatchlist: (media: SavedMedia) => void;
  addToContinueWatching: (media: SavedMedia, episode?: ContinueWatchingItem['episode']) => void;
  removeFromWatchlist: (type: SavedMedia['type'], id: string) => void;
  removeFromContinueWatching: (type: SavedMedia['type'], id: string) => void;
  isInWatchlist: (type: SavedMedia['type'], id: string) => boolean;
  markWatched: (media: SavedMedia, episode?: WatchedItem['episode']) => void;
  markSeasonWatched: (
    mediaOrType: SavedMedia | SavedMedia['type'],
    seasonOrId: number | string,
    episodesOrSeasonNumber?: CineSrcEpisode[] | number
  ) => void;
  removeFromWatched: (type: SavedMedia['type'], id: string, episode?: WatchedItem['episode']) => void;
  removeSeasonWatched: (type: SavedMedia['type'], id: string, seasonNumber: number) => void;
  isWatched: (type: SavedMedia['type'], id: string, episode?: WatchedItem['episode']) => boolean;
  replaceWatchlist: (items: SavedMedia[]) => void;
  replaceWatched: (items: WatchedItem[]) => void;
}

const MediaLibraryContext = createContext<MediaLibraryContextValue | null>(null);

function isSavedMedia(value: unknown): value is SavedMedia {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.type !== 'movie' && record.type !== 'tv') return false;
  if (!record.item || typeof record.item !== 'object') return false;

  const item = record.item as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.poster === 'string' &&
    typeof item.rating === 'number' &&
    Array.isArray(item.genres) &&
    item.genres.every((genre) => typeof genre === 'string') &&
    (record.type === 'movie' ? typeof item.title === 'string' : typeof item.name === 'string')
  );
}

function isContinueWatchingItem(value: unknown): value is ContinueWatchingItem {
  if (!isSavedMedia(value)) return false;
  const record = value as unknown as Record<string, unknown>;
  if (typeof record.lastWatchedAt !== 'number') return false;
  if (record.episode === undefined) return true;
  if (!record.episode || typeof record.episode !== 'object') return false;

  const episode = record.episode as Record<string, unknown>;
  return (
    typeof episode.seasonNumber === 'number' &&
    typeof episode.episodeNumber === 'number' &&
    typeof episode.name === 'string'
  );
}

function isWatchedItem(value: unknown): value is WatchedItem {
  if (!isSavedMedia(value)) return false;
  const record = value as unknown as Record<string, unknown>;
  if (typeof record.watchedAt !== 'number') return false;
  if (record.episode === undefined) return true;
  if (!record.episode || typeof record.episode !== 'object') return false;
  const episode = record.episode as Record<string, unknown>;
  return typeof episode.seasonNumber === 'number'
    && typeof episode.episodeNumber === 'number'
    && typeof episode.name === 'string';
}

function episodeKey(episode?: WatchedItem['episode']) {
  return episode ? `${episode.seasonNumber}.${episode.episodeNumber}` : 'complete';
}

function watchedMediaKey(type: SavedMedia['type'], id: string, episode?: WatchedItem['episode']) {
  return `${type}:${id}:${episodeKey(episode)}`;
}

function readStorage<T>(
  key: string,
  isValid: (value: unknown) => value is T
): { items: T[]; error: string | null } {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return { items: [], error: null };
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every(isValid)) {
      return { items: [], error: 'Saved media data is invalid and could not be loaded.' };
    }
    return { items: parsed, error: null };
  } catch {
    return { items: [], error: 'Saved media could not be read from this browser.' };
  }
}

export function MediaLibraryProvider({ children }: { children: ReactNode }) {
  const [initialState] = useState(() => {
    const watchlist = readStorage(WATCHLIST_KEY, isSavedMedia);
    const continueWatching = readStorage(CONTINUE_WATCHING_KEY, isContinueWatchingItem);
    const watched = readStorage(WATCHED_KEY, isWatchedItem);
    return {
      watchlist: watchlist.items,
      continueWatching: continueWatching.items,
      watched: watched.items,
      storageError: watchlist.error || continueWatching.error || watched.error,
    };
  });
  const [watchlist, setWatchlist] = useState(initialState.watchlist);
  const [continueWatching, setContinueWatching] = useState(initialState.continueWatching);
  const [watched, setWatched] = useState(initialState.watched);
  const [storageError, setStorageError] = useState<string | null>(initialState.storageError);

  useEffect(() => {
    try {
      window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch {
      setStorageError('Your watchlist could not be saved in this browser.');
    }
  }, [watchlist]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONTINUE_WATCHING_KEY, JSON.stringify(continueWatching));
    } catch {
      setStorageError('Continue Watching could not be saved in this browser.');
    }
  }, [continueWatching]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WATCHED_KEY, JSON.stringify(watched));
    } catch {
      setStorageError('Your watched history could not be saved in this browser.');
    }
  }, [watched]);

  const isInWatchlist = useCallback(
    (type: SavedMedia['type'], id: string) => watchlist.some((entry) => entry.type === type && entry.item.id === id),
    [watchlist]
  );

  const toggleWatchlist = useCallback((media: SavedMedia) => {
    setWatchlist((current) => {
      const exists = current.some((entry) => entry.type === media.type && entry.item.id === media.item.id);
      return exists
        ? current.filter((entry) => entry.type !== media.type || entry.item.id !== media.item.id)
        : [media, ...current];
    });
  }, []);

  const addToContinueWatching = useCallback((media: SavedMedia, episode?: ContinueWatchingItem['episode']) => {
    setContinueWatching((current) => [
      { ...media, episode, lastWatchedAt: Date.now() },
      ...current.filter((entry) => entry.type !== media.type || entry.item.id !== media.item.id),
    ]);
  }, []);

  const removeFromWatchlist = useCallback((type: SavedMedia['type'], id: string) => {
    setWatchlist((current) => current.filter((entry) => entry.type !== type || entry.item.id !== id));
  }, []);

  const removeFromContinueWatching = useCallback((type: SavedMedia['type'], id: string) => {
    setContinueWatching((current) => current.filter((entry) => entry.type !== type || entry.item.id !== id));
  }, []);

  const markWatched = useCallback((media: SavedMedia, episode?: WatchedItem['episode']) => {
    const entry: WatchedItem = { ...media, episode, watchedAt: Date.now() };
    const key = watchedMediaKey(media.type, media.item.id, episode);
    setWatched((current) => [entry, ...current.filter((item) => watchedMediaKey(item.type, item.item.id, item.episode) !== key)]);
  }, []);

  const markSeasonWatched = useCallback((
    mediaOrType: SavedMedia | SavedMedia['type'],
    seasonOrId: number | string,
    episodesOrSeasonNumber?: CineSrcEpisode[] | number
  ) => {
    setWatched((current) => {
      if (typeof mediaOrType === 'object') {
        const media = mediaOrType;
        const seasonNumber = seasonOrId as number;
        const episodes = episodesOrSeasonNumber as CineSrcEpisode[];
        const entries = episodes.map((episode) => ({
          ...media,
          watchedAt: Date.now(),
          episode: {
            seasonNumber,
            episodeNumber: episode.episodeNumber,
            name: episode.name,
          },
        }));
        const keys = new Set(entries.map((entry) => watchedMediaKey(entry.type, entry.item.id, entry.episode)));
        return [
          ...current.filter((entry) => !keys.has(watchedMediaKey(entry.type, entry.item.id, entry.episode))),
          ...entries,
        ];
      }

      const type = mediaOrType;
      const id = seasonOrId as string;
      const seasonNumber = episodesOrSeasonNumber as number;
      const showEntry = current.find((item) => item.type === type && item.item.id === id);
      if (!showEntry) return current;

      const tvShow = showEntry.item as CineSrcTVShow;
      const totalEpisodes = tvShow.numberOfEpisodes || 0;
      const episodesPerSeason = Math.ceil(totalEpisodes / Math.max(tvShow.numberOfSeasons || 1, 1));
      const entries: WatchedItem[] = [];

      for (let episodeNumber = 1; episodeNumber <= episodesPerSeason; episodeNumber++) {
        entries.push({
          type: 'tv',
          item: tvShow,
          watchedAt: Date.now(),
          episode: { seasonNumber, episodeNumber, name: `Episode ${episodeNumber}` },
        });
      }

      const episodeKeys = new Set(entries.map((entry) => watchedMediaKey(entry.type, entry.item.id, entry.episode)));
      return [
        ...current.filter((entry) =>
          !episodeKeys.has(watchedMediaKey(entry.type, entry.item.id, entry.episode))
        ),
        ...entries,
      ];
    });
  }, []);

  const removeFromWatched = useCallback((type: SavedMedia['type'], id: string, episode?: WatchedItem['episode']) => {
    const key = watchedMediaKey(type, id, episode);
    setWatched((current) => current.filter((item) => watchedMediaKey(item.type, item.item.id, item.episode) !== key));
  }, []);
  const removeSeasonWatched = useCallback((type: SavedMedia['type'], id: string, seasonNumber: number) => {
    setWatched((current) => current.filter((item) =>
      item.type !== type
      || item.item.id !== id
      || !item.episode
      || item.episode.seasonNumber !== seasonNumber
    ));
  }, []);
  const isWatched = useCallback((type: SavedMedia['type'], id: string, episode?: WatchedItem['episode']) => {
    const key = watchedMediaKey(type, id, episode);
    return watched.some((item) => watchedMediaKey(item.type, item.item.id, item.episode) === key);
  }, [watched]);
  const replaceWatchlist = useCallback((items: SavedMedia[]) => setWatchlist(items), []);
  const replaceWatched = useCallback((items: WatchedItem[]) => setWatched(items), []);

  const value = useMemo(
    () => ({
      watchlist,
      continueWatching,
      watched,
      storageError,
      toggleWatchlist,
      addToContinueWatching,
      removeFromWatchlist,
      removeFromContinueWatching,
      isInWatchlist,
      markWatched,
      markSeasonWatched,
      removeFromWatched,
      removeSeasonWatched,
      isWatched,
      replaceWatchlist,
      replaceWatched,
    }),
    [watchlist, continueWatching, watched, storageError, toggleWatchlist, addToContinueWatching, removeFromWatchlist, removeFromContinueWatching, isInWatchlist, markWatched, markSeasonWatched, removeFromWatched, removeSeasonWatched, isWatched, replaceWatchlist, replaceWatched]
  );

  return <MediaLibraryContext.Provider value={value}>{children}</MediaLibraryContext.Provider>;
}

export function useMediaLibrary() {
  const context = useContext(MediaLibraryContext);
  if (!context) throw new Error('useMediaLibrary must be used within a MediaLibraryProvider');
  return context;
}
