import { Link } from 'react-router-dom';
import { MediaCarousel } from '../components/features/MediaCarousel';
import { useTrendingMovies, useTrendingTVShows, usePopularMovies, usePopularTVShows } from '../hooks/useMedia';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import type { CineSrcMovie, CineSrcTVShow } from '../types';



function HomeRow({
  title,
  items,
  types,
  loading,
  error,
  emptyMessage,
  onRemove,
}: {
  title: string;
  items: (CineSrcMovie | CineSrcTVShow)[] | undefined;
  types?: ('movie' | 'tv')[] | undefined;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onRemove?: (item: CineSrcMovie | CineSrcTVShow, type: 'movie' | 'tv') => void;
}) {
  const resolvedType = types?.[0] ?? 'movie';
  const safeItems = items ?? [];

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="netflix-row-title text-xl font-bold text-white">{title}</h2>
        <Link to={resolvedType === 'movie' ? '/movies' : '/tv-shows'} className="text-sm font-medium text-primary-400 hover:text-primary-300">
          Browse All →
        </Link>
      </div>
      <MediaCarousel
        items={safeItems}
        type={resolvedType}
        loading={loading}
        error={error}
        emptyMessage={emptyMessage}
        glossyCards
        onRemove={onRemove}
        removeLabel={`Remove from ${title}`}
      />
    </section>
  );
}

export function Home() {
  const { continueWatching, removeFromContinueWatching, storageError } = useMediaLibrary();
  const { movies: trendingMovies, loading: trendingMoviesLoading, error: trendingMoviesError } = useTrendingMovies();
  const { shows: trendingShows, loading: trendingShowsLoading, error: trendingShowsError } = useTrendingTVShows();
  const { movies: popularMovies, loading: popularMoviesLoading, error: popularMoviesError } = usePopularMovies();
  const { shows: popularShows, loading: popularShowsLoading, error: popularShowsError } = usePopularTVShows();

  return (
    <div className="relative isolate bg-netflix-dark min-h-screen">
      {/* Decorative background blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] bg-primary-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] bg-primary-600/10 rounded-full blur-[120px]" />
      </div>

      <section className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <HomeRow
          title="Continue Watching Movies"
          items={continueWatching.filter((e) => e.type === 'movie').map((e) => e.item)}
          types={continueWatching.filter((e) => e.type === 'movie').map((e) => e.type)}
          loading={false}
          emptyMessage=""
          onRemove={(item) => removeFromContinueWatching('movie', item.id)}
        />

        <HomeRow
          title="Continue Watching TV Shows"
          items={continueWatching.filter((e) => e.type === 'tv').map((e) => e.item)}
          types={continueWatching.filter((e) => e.type === 'tv').map((e) => e.type)}
          loading={false}
          emptyMessage=""
          onRemove={(item) => removeFromContinueWatching('tv', item.id)}
        />

        <MediaCarousel
          items={trendingMovies}
          type="movie"
          loading={trendingMoviesLoading}
          error={trendingMoviesError}
          emptyMessage="No trending movies available"
          glossyCards
        />

        <MediaCarousel
          items={trendingShows}
          type="tv"
          loading={trendingShowsLoading}
          error={trendingShowsError}
          emptyMessage="No trending TV shows available"
          glossyCards
        />

        <MediaCarousel
          items={popularMovies}
          type="movie"
          loading={popularMoviesLoading}
          error={popularMoviesError}
          emptyMessage="No popular movies available"
          glossyCards
        />

        <MediaCarousel
          items={popularShows}
          type="tv"
          loading={popularShowsLoading}
          error={popularShowsError}
          emptyMessage="No popular TV shows available"
          glossyCards
        />

        {storageError && <p className="mt-4 text-sm text-red-400" role="alert">{storageError}</p>}
      </section>
    </div>
  );
}
