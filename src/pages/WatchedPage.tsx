import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { MediaCard } from '../components/features/MediaCard';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import { HorizontalCarousel } from '../components/features/HorizontalCarousel';

export function WatchedPage() {
  const { watched, removeFromWatched, markSeasonWatched, storageError } = useMediaLibrary();

  const moviesWatched = watched.filter((entry) => entry.type === 'movie');
  const tvShowsWatched = watched.filter((entry) => entry.type === 'tv');

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-primary-400">Your history</p>
          <h1 className="text-3xl font-bold text-white">Watched</h1>
        </div>
        <Link to="/watchlist" className="text-sm font-medium text-primary-400 hover:underline">Sync with Simkl</Link>
      </div>

      {watched.length === 0 ? (
        <p className="border border-dark-800 bg-black px-6 py-12 text-center text-dark-400">
          Nothing marked watched yet. Mark movies or TV episodes from their detail pages.
        </p>
      ) : null}

      {moviesWatched.length > 0 && (
        <section className="mb-10" aria-labelledby="movies-watched-title">
          <h2 id="movies-watched-title" className="mb-5 text-2xl font-bold text-white">Watched Movies</h2>
          <HorizontalCarousel label="Watched Movies">
            {moviesWatched.map((entry) => (
              <div className="w-28 flex-none snap-start sm:w-32 lg:w-36" key={`movie-${entry.item.id}`}>
            <MediaCard
              item={entry.item}
              type="movie"
              subtitle="Watched"
              posterOnly
            />
              </div>
            ))}
          </HorizontalCarousel>
        </section>
      )}

      {tvShowsWatched.length > 0 && (
        <section className="mb-10" aria-labelledby="tv-shows-watched-title">
          <h2 id="tv-shows-watched-title" className="mb-5 text-2xl font-bold text-white">Watched TV Shows</h2>
          <HorizontalCarousel label="Watched TV Shows">
            {tvShowsWatched.map((entry) => {
              const subtitle = entry.episode
                ? `S${entry.episode.seasonNumber.toString().padStart(2, '0')}E${entry.episode.episodeNumber.toString().padStart(2, '0')} · ${entry.episode.name}`
                : 'Watched';
              return (
                <div className="w-28 flex-none snap-start sm:w-32 lg:w-36" key={`tv-${entry.item.id}-${entry.episode ? `${entry.episode.seasonNumber}-${entry.episode.episodeNumber}` : 'complete'}`}>
                  <MediaCard
                    item={entry.item}
                    type="tv"
                    subtitle={subtitle}
                    onRemove={() => removeFromWatched('tv', entry.item.id, entry.episode)}
                    removeLabel="Remove from watched history"
                  />
                </div>
              );
            })}
            <div className="mb-4">{tvShowsWatched.map((entry) => (
              <Button
                key={entry.item.id}
                variant="outline"
                onClick={() => markSeasonWatched('tv', entry.item.id, 1)}
              >
                Mark Season 1 as Watched
              </Button>
            ))}</div>
          </HorizontalCarousel>
        </section>
      )}
      {storageError && <p className="mt-4 text-sm text-red-400" role="alert">{storageError}</p>}
    </div>
  );
}
