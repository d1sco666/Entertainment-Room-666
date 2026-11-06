import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { MediaGrid } from '../components/features/MediaGrid';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useSearch } from '../hooks/useMedia';
import { classNames } from '../utils/helpers';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'tv'>('all');

  const { results, loading, error } = useSearch(query, !!query);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
    }
  };

  const movies = results?.movies || [];
  const tvShows = results?.tvShows || [];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">Search</h1>
        <p className="text-dark-500 dark:text-dark-400">Find movies and TV shows</p>
      </div>

      <form onSubmit={handleSearch} className="max-w-2xl mb-8" role="search">
        <div className="flex gap-2">
          <label htmlFor="search-input" className="sr-only">Search query</label>
          <Input
            id="search-input"
            type="search"
            placeholder="Search movies, TV shows..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            className="flex-1"
          />
          <Button type="submit" className="!text-black" disabled={!query.trim() || loading}>Search</Button>
        </div>
      </form>

      {query && (
        <div className="flex gap-2 mb-6" role="tablist" aria-label="Search result types">
          <button
            role="tab"
            aria-selected={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
            className={classNames(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-100 dark:bg-dark-800 text-dark-700 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-700'
            )}
          >
            All ({results?.total || 0})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'movies'}
            onClick={() => setActiveTab('movies')}
            className={classNames(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'movies'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-100 dark:bg-dark-800 text-dark-700 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-700'
            )}
          >
            Movies ({movies.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'tv'}
            onClick={() => setActiveTab('tv')}
            className={classNames(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'tv'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-100 dark:bg-dark-800 text-dark-700 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-700'
            )}
          >
            TV Shows ({tvShows.length})
          </button>
        </div>
      )}

      {query && activeTab === 'all' && (
        <div className="space-y-10">
          <section aria-labelledby="movie-search-results">
            <h2 id="movie-search-results" className="mb-4 text-xl font-bold text-dark-900 dark:text-white">Movies</h2>
            <MediaGrid
              items={movies}
              type="movie"
              loading={loading}
              error={error}
              emptyMessage={error ? `Error: ${error}` : `No movies found for "${query}"`}
            />
          </section>
          <section aria-labelledby="tv-search-results">
            <h2 id="tv-search-results" className="mb-4 text-xl font-bold text-dark-900 dark:text-white">TV Shows</h2>
            <MediaGrid
              items={tvShows}
              type="tv"
              loading={loading}
              error={error}
              emptyMessage={error ? `Error: ${error}` : `No TV shows found for "${query}"`}
            />
          </section>
        </div>
      )}

      {query && activeTab !== 'all' && (
        <MediaGrid
          items={activeTab === 'movies' ? movies : tvShows}
          type={activeTab === 'movies' ? 'movie' : 'tv'}
          loading={loading}
          error={error}
          emptyMessage={error ? `Error: ${error}` : `No results found for "${query}"`}
        />
      )}

      {!query && (
        <div className="text-center py-16">
          <svg className="mx-auto h-16 w-16 text-dark-300 dark:text-dark-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">Search for content</h2>
          <p className="text-dark-500 dark:text-dark-400">Enter a movie or TV show title above to start searching</p>
        </div>
      )}
    </div>
  );
}