import type {
  SavedMedia,
  WatchedItem,
} from '../types';

const API_URL = 'https://api.simkl.com';
const CLIENT_ID = import.meta.env.VITE_SIMKL_CLIENT_ID || '5b98b5163aa1a1606f1ddf4cfe476affe3fb20150ac05f38a229325723f72241';
const APP_NAME = 'entertainment-room';
const APP_VERSION = '1.0.0';
const AUTH_KEY = 'entertainment-room-simkl-auth';
const PENDING_AUTH_KEY = 'entertainment-room-simkl-pending';
const SNAPSHOT_KEY = 'entertainment-room-simkl-snapshot';
let lastWriteAt = 0;
let writeQueue = Promise.resolve();

interface SimklAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

function withSimklHref(media: SavedMedia, href: string): SavedMedia {
  return media.type === 'movie'
    ? { type: 'movie', item: { ...media.item, simklHref: href } }
    : { type: 'tv', item: { ...media.item, simklHref: href } };
}

function makeWatchedEntry(
  media: SavedMedia,
  watchedAt: number,
  episode?: WatchedItem['episode']
): WatchedItem {
  if (media.type === 'movie') {
    return { type: 'movie', item: media.item, watchedAt };
  }
  return { type: 'tv', item: media.item, watchedAt, ...(episode ? { episode } : {}) };
}

interface PendingAuth {
  verifier: string;
  state: string;
  redirectUri: string;
}

interface SimklItem {
  movie?: SimklTitle;
  show?: SimklTitle;
  status?: string;
  last_watched_at?: string | null;
  watched_at?: string | null;
  seasons?: {
    number: number;
    episodes?: {
      number: number;
      watched?: boolean;
      watched_at?: string | null;
      last_watched_at?: string | null;
    }[];
  }[];
}

interface SimklTitle {
  title: string;
  year?: number;
  ids: {
    tmdb?: number | string;
    simkl?: number | string;
    imdb?: string;
    slug?: string;
    mal?: number | string;
    anilist?: number | string;
  };
}

interface SimklSnapshot {
  watchlist: { local: string[]; remote: string[] };
  watched: { local: string[]; remote: string[] };
}

interface SimklHistoryResponse {
  not_found?: Record<string, unknown[]>;
}

interface SyncResult {
  watchlist: SavedMedia[];
  watched: WatchedItem[];
  addedToSimkl: number;
  removedFromSimkl: number;
  imported: number;
  removedLocally: number;
  skipped: number;
  remoteWatchlist: number;
  remoteWatched: number;
}

function getRedirectUri() {
  return `${window.location.origin}/simkl/callback`;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(size: number) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

function readAuth(): SimklAuth | null {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (
      !parsed || typeof parsed !== 'object'
      || typeof (parsed as SimklAuth).accessToken !== 'string'
      || typeof (parsed as SimklAuth).refreshToken !== 'string'
      || typeof (parsed as SimklAuth).expiresAt !== 'number'
      || typeof (parsed as SimklAuth).scope !== 'string'
    ) {
      return null;
    }
    return parsed as SimklAuth;
  } catch {
    return null;
  }
}

function saveAuth(auth: SimklAuth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  window.dispatchEvent(new Event('simkl-auth-changed'));
}

async function exchangeToken(fields: Record<string, string>): Promise<SimklAuth> {
  const response = await fetch(`${API_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...fields }),
  });
  if (!response.ok) {
    throw new Error(`Simkl authorization failed (${response.status}). Check the client type and registered redirect URL.`);
  }

  const result = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!result.access_token || !result.refresh_token || !result.scope?.split(' ').includes('media:write')) {
    throw new Error('Simkl did not grant the required media:write scope. Reconnect and approve write access.');
  }
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresAt: Date.now() + (result.expires_in ?? 604800) * 1000,
    scope: result.scope,
  };
}

async function getValidAuth() {
  const auth = readAuth();
  if (!auth) throw new Error('Connect your Simkl account to sync your library.');
  if (auth.expiresAt > Date.now() + 60_000) return auth;
  try {
    const refreshed = await exchangeToken({
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken,
    });
    saveAuth(refreshed);
    return refreshed;
  } catch (error) {
    disconnectSimkl();
    throw error;
  }
}

async function simklRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const auth = await getValidAuth();
  if (method !== 'GET') {
    const nextWrite = writeQueue.then(async () => {
      const delay = Math.max(0, 1000 - (Date.now() - lastWriteAt));
      if (delay) await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
      lastWriteAt = Date.now();
    });
    writeQueue = nextWrite.catch(() => undefined);
    await nextWrite;
  }
  const url = new URL(path, API_URL);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('app-name', APP_NAME);
  url.searchParams.set('app-version', APP_VERSION);
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Simkl request failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ''}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function idKey(media: SavedMedia) {
  return `${media.type}:${media.item.id}`;
}

function watchedKey(media: WatchedItem) {
  return `${idKey(media)}:${media.episode ? `${media.episode.seasonNumber}.${media.episode.episodeNumber}` : 'complete'}`;
}

function unwrapItems(response: { movies?: SimklItem[]; shows?: SimklItem[] }, type: SavedMedia['type']) {
  return (type === 'movie' ? response.movies ?? [] : response.shows ?? [])
    .filter((entry) => type === 'movie' ? Boolean(entry.movie) : Boolean(entry.show));
}

const SIMKL_WATCHLIST_STATUSES = ['plantowatch'] as const;

async function loadPaginatedAllItems(
  path: string,
  collection: 'movies' | 'shows'
): Promise<{ movies?: SimklItem[]; shows?: SimklItem[] }> {
  const limit = 5000;
  const combined = new Map<string, SimklItem>();
  const seenPages = new Set<string>();

  for (let page = 1; page <= 100; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const response = await simklRequest<{ movies?: SimklItem[]; shows?: SimklItem[] }>(
      `${path}${separator}page=${page}&limit=${limit}`
    );
    const items = response[collection] ?? [];
    if (!items.length) break;

    const pageFingerprint = items.map((entry) => {
      const title = collection === 'movies' ? entry.movie : entry.show;
      return title?.ids?.tmdb ?? title?.ids?.simkl ?? title?.ids?.slug ?? title?.title ?? '';
    }).join('|');
    if (seenPages.has(pageFingerprint)) break;
    seenPages.add(pageFingerprint);

    let newItems = 0;
    for (const entry of items) {
      const title = collection === 'movies' ? entry.movie : entry.show;
      const key = title?.ids?.tmdb !== undefined ? `tmdb:${title.ids.tmdb}`
        : title?.ids?.simkl !== undefined ? `simkl:${title.ids.simkl}`
        : title?.ids?.slug ? `slug:${title.ids.slug}`
        : title ? `title:${title.title}` : '';
      if (key && !combined.has(key)) {
        combined.set(key, entry);
        newItems += 1;
      }
    }
    if (newItems === 0 || items.length < limit) break;
  }

  return collection === 'movies'
    ? { movies: [...combined.values()] }
    : { shows: [...combined.values()] };
}

async function loadRemoteWatchlist() {
  const entries: { type: SavedMedia['type']; title: SimklTitle }[] = [];
  for (const status of SIMKL_WATCHLIST_STATUSES) {
    const [movies, shows] = await Promise.all([
      loadPaginatedAllItems(`/sync/all-items/movies/${status}`, 'movies'),
      loadPaginatedAllItems(`/sync/all-items/shows/${status}`, 'shows'),
    ]);
    entries.push(
      ...unwrapItems(movies, 'movie').map((entry) => ({ type: 'movie' as const, title: entry.movie! })),
      ...unwrapItems(shows, 'tv').map((entry) => ({ type: 'tv' as const, title: entry.show! })),
    );
  }
  return entries;
}

function tmdbId(title: SimklTitle) {
  return title.ids.tmdb === undefined ? '' : String(title.ids.tmdb);
}

function simklHref(type: SavedMedia['type'], title: SimklTitle) {
  const simklId = title.ids.simkl;
  if (simklId) {
    const section = type === 'movie' ? 'movies' : 'tv';
    return `https://simkl.com/${section}/${encodeURIComponent(String(simklId))}/${encodeURIComponent(title.ids.slug ?? '')}`;
  }
  return simklRedirect(tmdbId(title));
}

function simklRedirect(id: string) {
  const url = new URL('/redirect', API_URL);
  url.search = new URLSearchParams({
    to: 'simkl',
    tmdb: id,
    client_id: CLIENT_ID,
    'app-name': APP_NAME,
    'app-version': APP_VERSION,
  }).toString();
  return url.toString();
}

function mapRemoteWatched(
  response: { movies?: SimklItem[]; shows?: SimklItem[] },
  type: SavedMedia['type']
) {
  const result: {
    type: SavedMedia['type'];
    title: SimklTitle;
    watchedAt?: string;
    episode?: { season: number; number: number; watchedAt?: string };
  }[] = [];
  const entries = unwrapItems(response, type);
  for (const entry of entries) {
    const title = type === 'movie' ? entry.movie! : entry.show!;
    if (type === 'movie') {
      if (entry.status === 'completed' || entry.last_watched_at || entry.watched_at) {
        result.push({ type, title, watchedAt: entry.last_watched_at ?? entry.watched_at ?? undefined });
      }
      continue;
    }
    const episodes = (entry.seasons ?? []).flatMap((season) => (season.episodes ?? [])
      .filter((episode) => episode.watched || episode.watched_at || episode.last_watched_at)
      .map((episode) => ({
        season: season.number,
        number: episode.number,
        watchedAt: episode.watched_at ?? episode.last_watched_at ?? undefined,
      })));
    if (episodes.length) {
      for (const episode of episodes) result.push({ type, title, episode });
    } else if (entry.status === 'completed') {
      result.push({ type, title, watchedAt: entry.last_watched_at ?? entry.watched_at ?? undefined });
    }
  }
  return result;
}

function timestamp(value?: string) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function makeIds(media: SavedMedia) {
  const tmdb = media.item.tmdbId ?? Number(media.item.id);
  if (!Number.isSafeInteger(tmdb) || tmdb <= 0) {
    throw new Error(`Cannot sync ${media.type} without a valid TMDB ID.`);
  }
  return { tmdb };
}

function readSnapshot(): SimklSnapshot | null {
  try {
    const stored = localStorage.getItem(SNAPSHOT_KEY);
    return stored ? JSON.parse(stored) as SimklSnapshot : null;
  } catch {
    return null;
  }
}

function diffRemoved(previous: string[], current: string[]) {
  const currentSet = new Set(current);
  return previous.filter((key) => !currentSet.has(key));
}

function groupWatchlist(media: SavedMedia[]) {
  return {
    movies: media.filter((entry) => entry.type === 'movie').map((entry) => ({
      to: 'plantowatch',
      ids: makeIds(entry),
    })),
    shows: media.filter((entry) => entry.type === 'tv').map((entry) => ({
      to: 'plantowatch',
      ids: makeIds(entry),
    })),
  };
}

function groupWatched(media: WatchedItem[]) {
  const movies = media.filter((entry) => entry.type === 'movie').map((entry) => ({
    ids: makeIds(entry),
    watched_at: new Date(entry.watchedAt).toISOString(),
  }));
  const showMap = new Map<string, { ids: { tmdb: number }; watched_at?: string; seasons?: { number: number; episodes: { number: number; watched_at: string }[] }[] }>();
  for (const entry of media.filter((item) => item.type === 'tv')) {
    const key = entry.item.id;
    const existing = showMap.get(key) ?? { ids: makeIds(entry) };
    if (entry.episode) {
      const season = existing.seasons?.find((value) => value.number === entry.episode!.seasonNumber)
        ?? { number: entry.episode.seasonNumber, episodes: [] };
      season.episodes.push({
        number: entry.episode.episodeNumber,
        watched_at: new Date(entry.watchedAt).toISOString(),
      });
      existing.seasons = [...(existing.seasons ?? []).filter((value) => value.number !== season.number), season];
    } else {
      existing.watched_at = new Date(entry.watchedAt).toISOString();
    }
    showMap.set(key, existing);
  }
  return { movies, shows: [...showMap.values()] };
}

function countNotFound(response: SimklHistoryResponse) {
  return Object.values(response.not_found ?? {}).reduce(
    (count, items) => count + (Array.isArray(items) ? items.length : 0),
    0
  );
}

async function loadTmdbDetails(
  type: SavedMedia['type'],
  id: string
): Promise<SavedMedia> {
  const { tmdbAPI } = await import('./tmdb');
  return type === 'movie'
    ? { type, item: await tmdbAPI.getMovieDetails(id) }
    : { type, item: await tmdbAPI.getTVShowDetails(id) };
}

export const simklAPI = {
  isConfigured: Boolean(CLIENT_ID),
  isConnected: () => Boolean(readAuth()),

  async connect() {
    if (!CLIENT_ID) throw new Error('Set VITE_SIMKL_CLIENT_ID before connecting Simkl.');
    const verifier = randomString(64);
    const challenge = toBase64Url(new Uint8Array(await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verifier)
    )));
    const pending: PendingAuth = {
      verifier,
      state: randomString(32),
      redirectUri: getRedirectUri(),
    };
    sessionStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(pending));
    const url = new URL('https://simkl.com/oauth2/authorize');
    url.search = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: pending.redirectUri,
      response_type: 'code',
      scope: 'media:read media:write',
      state: pending.state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();
    window.location.assign(url.toString());
  },

  async completeConnection(code: string, state: string) {
    const raw = sessionStorage.getItem(PENDING_AUTH_KEY);
    sessionStorage.removeItem(PENDING_AUTH_KEY);
    if (!raw) throw new Error('Simkl sign-in expired. Start the connection again.');
    const pending = JSON.parse(raw) as PendingAuth;
    if (!state || state !== pending.state) throw new Error('Simkl sign-in state did not match. Start again.');
    const auth = await exchangeToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier,
    });
    saveAuth(auth);
  },

  disconnect() {
    disconnectSimkl();
  },

  async syncLibrary(localWatchlist: SavedMedia[], localWatched: WatchedItem[]): Promise<SyncResult> {
    const [remoteWatchlist, remoteMovieLibrary, remoteShowLibrary] = await Promise.all([
      loadRemoteWatchlist(),
      loadPaginatedAllItems('/sync/all-items/movies?extended=full&include_all_episodes=yes&episode_watched_at=yes', 'movies'),
      loadPaginatedAllItems('/sync/all-items/shows?extended=full&include_all_episodes=yes&episode_watched_at=yes', 'shows'),
    ]);
    const remoteTrackedTitles = [
      ...unwrapItems(remoteMovieLibrary, 'movie').map((entry) => ({ type: 'movie' as const, title: entry.movie! })),
      ...unwrapItems(remoteShowLibrary, 'tv').map((entry) => ({ type: 'tv' as const, title: entry.show! })),
    ];
    const remoteWatchedEntries = [
      ...mapRemoteWatched(remoteMovieLibrary, 'movie'),
      ...mapRemoteWatched(remoteShowLibrary, 'tv'),
    ];

    const remoteWatchlistKeys = remoteWatchlist
      .filter((entry) => tmdbId(entry.title))
      .map((entry) => `${entry.type}:${tmdbId(entry.title)}`);
    const remoteWatchedKeys = remoteWatchedEntries
      .filter((entry) => tmdbId(entry.title))
      .map((entry) => `${entry.type}:${tmdbId(entry.title)}:${entry.episode ? `${entry.episode.season}.${entry.episode.number}` : 'complete'}`);
    const localWatchlistKeys = localWatchlist.map(idKey);
    const localWatchedKeys = localWatched.map(watchedKey);
    const previous = readSnapshot();
    let nextWatchlist = [...localWatchlist];
    let nextWatched = [...localWatched];
    const remoteWatchlistSet = new Set(remoteWatchlistKeys);
    const remoteWatchedSet = new Set(remoteWatchedKeys);
    let addedToSimkl = 0;
    let removedFromSimkl = 0;
    let imported = 0;
    let removedLocally = 0;
    let skipped = remoteWatchlist.filter((entry) => !tmdbId(entry.title)).length
      + remoteWatchedEntries.filter((entry) => !tmdbId(entry.title)).length;

    if (previous) {
      const localWatchlistRemoved = new Set(diffRemoved(previous.watchlist.local, localWatchlistKeys));
      for (const key of localWatchlistRemoved) {
        const match = remoteTrackedTitles.find((entry) => `${entry.type}:${tmdbId(entry.title)}` === key);
        if (match) {
          await simklRequest('/sync/history/remove', 'POST', {
            [match.type === 'movie' ? 'movies' : 'shows']: [{ ids: { tmdb: Number(tmdbId(match.title)) } }],
          });
          removedFromSimkl += 1;
          remoteWatchlistSet.delete(key);
          for (const watchedKey of remoteWatchedSet) {
            if (watchedKey.startsWith(`${key}:`) || watchedKey === `${key}:complete`) remoteWatchedSet.delete(watchedKey);
          }
        }
      }
      // Keep all local watchlist items - only add from Simkl, never remove local
// nextWatchlist = nextWatchlist.filter((entry) => !remoteWatchlistRemoved.has(idKey(entry)));
      removedLocally += localWatchlist.length - nextWatchlist.length;

      const localWatchedRemoved = new Set(diffRemoved(previous.watched.local, localWatchedKeys));
      for (const key of localWatchedRemoved) {
        const entry = localWatched.find((item) => watchedKey(item) === key);
        if (!entry) continue;
        const group = groupWatched([entry]);
        await simklRequest('/sync/history/remove', 'POST', group);
        removedFromSimkl += 1;
        if (!entry.episode) {
          for (const remoteKey of remoteWatchedSet) {
            if (remoteKey.startsWith(`${idKey(entry)}:`)) remoteWatchedSet.delete(remoteKey);
          }
        } else {
          remoteWatchedSet.delete(key);
        }
      }
      nextWatched = nextWatched.filter(() => true);
      removedLocally += localWatched.length - nextWatched.length;
    }

    const availableWatchlistKeys = new Set(nextWatchlist.map(idKey));
    const addWatchlist = nextWatchlist.filter((entry) => (
      !remoteWatchlistSet.has(idKey(entry))
    ));
    if (addWatchlist.length) {
      await simklRequest('/sync/add-to-list', 'POST', groupWatchlist(addWatchlist));
      addedToSimkl += addWatchlist.length;
      for (const entry of addWatchlist) remoteWatchlistSet.add(idKey(entry));
    }
    for (const entry of remoteWatchlist) {
      const id = tmdbId(entry.title);
      if (!id || availableWatchlistKeys.has(`${entry.type}:${id}`)) continue;
      try {
        const media = await loadTmdbDetails(entry.type, id);
        media.item.simklHref = simklHref(entry.type, entry.title);
        nextWatchlist.push(media);
        availableWatchlistKeys.add(idKey(media));
        imported += 1;
      } catch {
        skipped += 1;
      }
    }

    const currentWatchedKeys = new Set(nextWatched.map(watchedKey));
    const addWatched = nextWatched.filter((entry) => !remoteWatchedSet.has(watchedKey(entry)));
    if (addWatched.length) {
      const historyResponse = await simklRequest<SimklHistoryResponse>(
        '/sync/history',
        'POST',
        groupWatched(addWatched)
      );
      const notFoundCount = countNotFound(historyResponse);
      if (notFoundCount > 0) {
        throw new Error(`Simkl did not recognize ${notFoundCount} watched item(s). Check that the items have valid TMDB IDs, then sync again.`);
      }
      addedToSimkl += addWatched.length;
      for (const entry of addWatched) remoteWatchedSet.add(watchedKey(entry));
    }
    for (const entry of remoteWatchedEntries) {
      const id = tmdbId(entry.title);
      if (!id) continue;
      const detail = entry.type === 'movie'
        ? await loadTmdbDetails('movie', id).catch(() => null)
        : await loadTmdbDetails('tv', id).catch(() => null);
      if (!detail) {
        skipped += 1;
        continue;
      }
      const media = withSimklHref(detail, simklHref(entry.type, entry.title));
      const watchedEntry = makeWatchedEntry(
        media,
        timestamp(entry.episode?.watchedAt ?? entry.watchedAt),
        entry.episode && {
          seasonNumber: entry.episode.season,
          episodeNumber: entry.episode.number,
          name: `Episode ${entry.episode.number}`,
        }
      );
      const key = watchedKey(watchedEntry);
      if (!currentWatchedKeys.has(key)) {
        nextWatched.push(watchedEntry);
        currentWatchedKeys.add(key);
        imported += 1;
      }
    }

    nextWatchlist = nextWatchlist.map((entry) => withSimklHref(
      entry,
      entry.item.simklHref || simklRedirect(entry.item.tmdbId ? String(entry.item.tmdbId) : entry.item.id)
    ));
    nextWatched = nextWatched.map((entry) => entry.type === 'movie'
      ? {
        ...entry,
        item: {
          ...entry.item,
          simklHref: entry.item.simklHref || simklRedirect(entry.item.tmdbId ? String(entry.item.tmdbId) : entry.item.id),
        },
      }
      : {
        ...entry,
        item: {
          ...entry.item,
          simklHref: entry.item.simklHref || simklRedirect(entry.item.tmdbId ? String(entry.item.tmdbId) : entry.item.id),
        },
      });

    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      watchlist: { local: nextWatchlist.map(idKey), remote: [...remoteWatchlistSet] },
      watched: { local: nextWatched.map(watchedKey), remote: [...remoteWatchedSet] },
    } satisfies SimklSnapshot));
    return {
      watchlist: nextWatchlist,
      watched: nextWatched,
      addedToSimkl,
      removedFromSimkl,
      imported,
      removedLocally,
      skipped,
      remoteWatchlist: remoteWatchlist.length,
      remoteWatched: remoteWatchedEntries.length,
    };
  },
};

function disconnectSimkl() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(SNAPSHOT_KEY);
  window.dispatchEvent(new Event('simkl-auth-changed'));
}
