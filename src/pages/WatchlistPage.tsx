import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { MediaCard } from '../components/features/MediaCard';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import { HorizontalCarousel } from '../components/features/HorizontalCarousel';
import { simklAPI } from '../services/simkl';

export function WatchlistPage() {
  const { watchlist, watched, removeFromWatchlist, replaceWatchlist, replaceWatched, storageError } = useMediaLibrary();
  const [connected, setConnected] = useState(simklAPI.isConnected());
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const simklRedirectUri = `${window.location.origin}/simkl/callback`;

  const connect = async () => {
    setError(null);
    try {
      await simklAPI.connect();
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Could not connect to Simkl.');
    }
  };

  const sync = async () => {
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    try {
      const result = await simklAPI.syncLibrary(watchlist, watched);
      replaceWatchlist(result.watchlist);
      replaceWatched(result.watched);
      setSyncMessage(
        `Sync complete: ${result.imported} imported, ${result.addedToSimkl} added to Simkl, `
        + `${result.removedLocally} removed here, ${result.removedFromSimkl} removed from Simkl. `
        + `Simkl returned ${result.remoteWatchlist} watchlist item(s) and ${result.remoteWatched} watched movie/episode item(s).`
        + (result.skipped ? ` ${result.skipped} movie/TV item(s) could not be matched to TMDB.` : '')
      );
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Simkl sync failed.');
      setConnected(simklAPI.isConnected());
    } finally {
      setSyncing(false);
    }
  };

  const moviesWatchlist = watchlist.filter((entry) => entry.type === 'movie');
  const tvShowsWatchlist = watchlist.filter((entry) => entry.type === 'tv');

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-primary-400">Your collection</p>
          <h1 className="text-3xl font-bold text-white">My Watchlist</h1>
        </div>
        <Link to="/" className="text-sm font-medium text-primary-400 hover:underline">
          Back to Home
        </Link>
      </div>
      <section className="mb-10 border border-dark-700 bg-dark-950 p-5" aria-labelledby="simkl-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="simkl-title" className="flex items-center gap-2 text-lg font-semibold text-white">
              <a href="https://simkl.com" target="_blank" rel="noopener noreferrer" aria-label="Visit Simkl">
                <img
                  src="https://us.simkl.in/img_favicon/v2/favicon-192x192.png"
                  alt="Simkl"
                  className="h-5 w-5 rounded-sm"
                />
                <span>Simkl Sync</span>
              </a>
            </h2>
            <p className="mt-1 text-sm text-dark-400">
              {connected
                ? 'Connected. Sync your movie and TV watchlists and watched histories with Simkl.'
                : 'Connect Simkl to sync your movie and TV watchlists and watched histories.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {connected ? (
              <>
                <Button onClick={sync} disabled={syncing}>
                  {syncing ? 'Syncing…' : 'Sync now'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    simklAPI.disconnect();
                    setConnected(false);
                    setSyncMessage(null);
                  }}
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <Button onClick={connect}>Connect Simkl</Button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-dark-500">
          First sync merges libraries. Later syncs mirror removals. Register this exact URI in your Simkl app settings:
          {' '}<code className="break-all text-dark-300">{simklRedirectUri}</code>
        </p>
        <p className="mt-2 text-xs text-dark-500">
          Removing a whole title also removes its Simkl history and rating; removing one watched episode only clears that episode.
        </p>
        {error && <p className="mt-4 text-sm text-red-400" role="alert">{error}</p>}
        {syncMessage && <p className="mt-4 text-sm text-emerald-400" role="status">{syncMessage}</p>}
      </section>

      {watchlist.length === 0 ? (
        <p className="border border-dark-800 bg-black px-6 py-12 text-center text-dark-400">
          Your watchlist is empty. Add movies or TV shows from their detail pages.
        </p>
      ) : null}

      {moviesWatchlist.length > 0 && (
        <section className="mb-10" aria-labelledby="movies-watchlist-title">
          <h2 id="movies-watchlist-title" className="mb-5 text-2xl font-bold text-white">Movies Watchlist</h2>
          <HorizontalCarousel label="Movies Watchlist">
            {moviesWatchlist.map(({ item }) => (
              <div className="w-28 flex-none snap-start sm:w-32 lg:w-36" key={`movie-${item.id}`}>
                <MediaCard
                  item={item}
                  type="movie"
                  onRemove={() => removeFromWatchlist('movie', item.id)}
                  removeLabel="Remove from Watchlist"
                />
              </div>
            ))}
          </HorizontalCarousel>
        </section>
      )}

      {tvShowsWatchlist.length > 0 && (
        <section className="mb-10" aria-labelledby="tv-shows-watchlist-title">
          <h2 id="tv-shows-watchlist-title" className="mb-5 text-2xl font-bold text-white">TV Shows Watchlist</h2>
          <HorizontalCarousel label="TV Shows Watchlist">
            {tvShowsWatchlist.map(({ item }) => (
              <div className="w-28 flex-none snap-start sm:w-32 lg:w-36" key={`tv-${item.id}`}>
                <MediaCard
                  item={item}
                  type="tv"
                  onRemove={() => removeFromWatchlist('tv', item.id)}
                  removeLabel="Remove from Watchlist"
                />
              </div>
            ))}
          </HorizontalCarousel>
        </section>
      )}

      {storageError && <p className="mt-4 text-sm text-red-400" role="alert">{storageError}</p>}
    </div>
  );
}
