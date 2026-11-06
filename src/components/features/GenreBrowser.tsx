import { useEffect, useState } from 'react';
import { MediaGrid } from './MediaGrid';
import { useGenreTitles } from '../../hooks/useMedia';
import { movieGenres, tmdbAPI, tvGenres, type TMDBCountry, type TMDBWatchProvider } from '../../services/tmdb';

interface GenreBrowserProps {
  type: 'movie' | 'tv';
}

export function GenreBrowser({ type }: GenreBrowserProps) {
  const [selectedGenre, setSelectedGenre] = useState('');
  const [ageRating, setAgeRating] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'top_rated'>('popular');
  const [year, setYear] = useState('');
  const [providerId, setProviderId] = useState('');
  const [providers, setProviders] = useState<TMDBWatchProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState('');
  const [countries, setCountries] = useState<TMDBCountry[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const { items, loading, loadingMore, error, loadMore, hasMore } = useGenreTitles(
    type,
    selectedGenre ? Number(selectedGenre) : null,
    ageRating,
    sortBy,
    year ? Number(year) : null,
    providerId ? Number(providerId) : null,
    countryCode || null,
  );
  const genres = type === 'movie' ? movieGenres : tvGenres;
  const label = type === 'movie' ? 'movies' : 'TV shows';
  const ageRatings = type === 'movie'
    ? ['G', 'PG', 'PG-13', 'R', 'NC-17']
    : ['TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];
  const currentYear = new Date().getFullYear();
  const countryOptions = countries
    .map((country) => ({
      code: country.iso_3166_1,
      name: country.native_name || country.english_name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    let active = true;
    setProvidersLoading(true);
    setProvidersError(null);
    tmdbAPI.getWatchProviders(type)
      .then((availableProviders) => {
        if (active) setProviders(availableProviders);
      })
      .catch((providerError: unknown) => {
        if (active) {
          setProvidersError(providerError instanceof Error
            ? providerError.message
            : 'Could not load streaming providers.');
        }
      })
      .finally(() => {
        if (active) setProvidersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [type]);

  useEffect(() => {
    let active = true;
    setCountriesLoading(true);
    setCountriesError(null);
    tmdbAPI.getCountries()
      .then((availableCountries) => {
        if (active) setCountries(availableCountries);
      })
      .catch((countryError: unknown) => {
        if (active) {
          setCountriesError(countryError instanceof Error
            ? countryError.message
            : 'Could not load countries.');
        }
      })
      .finally(() => {
        if (active) setCountriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-labelledby={`${type}-genres-title`} className="mb-8">
      <div className="mb-5">
        <div>
          <h2 id={`${type}-genres-title`} className="text-2xl font-bold text-dark-100">Browse {label}</h2>
          <p className="mt-1 text-sm text-dark-400">Combine genre, age rating, provider, country, release year, and sort filters.</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-dark-900 dark:text-dark-900">
          Genre
          <select
            value={selectedGenre}
            onChange={(event) => setSelectedGenre(event.target.value)}
            className="w-full border border-dark-300 bg-white px-3 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-primary-500 [&>option]:bg-white [&>option]:text-black"
          >
            <option value="">All genres</option>
            {genres.map((genre) => (
              <option key={genre.id} value={genre.id}>{genre.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-dark-900 dark:text-dark-900">
          Age rating
          <select
            value={ageRating}
            onChange={(event) => setAgeRating(event.target.value)}
            className="w-full border border-dark-300 bg-white px-3 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-primary-500 [&>option]:bg-white [&>option]:text-black"
          >
            <option value="">Any age rating</option>
            {ageRatings.map((rating) => <option key={rating} value={rating}>{rating}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-dark-900 dark:text-dark-900">
          Sort by
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value === 'top_rated' ? 'top_rated' : 'popular')}
            className="w-full border border-dark-300 bg-white px-3 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-primary-500 [&>option]:bg-white [&>option]:text-black"
          >
            <option value="popular">Popular</option>
            <option value="top_rated">Top Rated</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-dark-900 dark:text-dark-900">
          Streaming provider (US)
          <select
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
            disabled={providersLoading || Boolean(providersError)}
            className="w-full border border-dark-300 bg-white px-3 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60 [&>option]:bg-white [&>option]:text-black"
          >
            <option value="">
              {providersLoading ? 'Loading providers…' : providersError ? 'Providers unavailable' : 'Any provider'}
            </option>
            {providers.map((provider) => (
              <option key={provider.provider_id} value={provider.provider_id}>{provider.provider_name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-dark-900 dark:text-dark-900">
          Country of origin
          <select
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
            disabled={countriesLoading || Boolean(countriesError)}
            className="w-full border border-dark-300 bg-white px-3 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60 [&>option]:bg-white [&>option]:text-black"
          >
            <option value="">
              {countriesLoading ? 'Loading countries…' : countriesError ? 'Countries unavailable' : 'Any country'}
            </option>
            {countryOptions.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-dark-900 dark:text-dark-900">
          Release year
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="w-full border border-dark-300 bg-white px-3 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-primary-500 [&>option]:bg-white [&>option]:text-black"
          >
            <option value="">Any year</option>
            {Array.from({ length: currentYear - 1899 }, (_, index) => currentYear - index).map((releaseYear) => (
              <option key={releaseYear} value={releaseYear}>{releaseYear}</option>
            ))}
          </select>
        </label>
      </div>
      {providersError && (
        <p className="mb-4 text-sm text-red-400" role="alert">
          Could not load streaming providers: {providersError}
        </p>
      )}
      {countriesError && (
        <p className="mb-4 text-sm text-red-400" role="alert">
          Could not load countries: {countriesError}
        </p>
      )}

      <MediaGrid
        items={items}
        type={type}
        loading={loading}
        error={error}
        loadMore={loadMore}
        hasMore={hasMore}
        loadingMore={loadingMore}
        emptyMessage={`No ${label} match these filters.`}
      />
    </section>
  );
}
