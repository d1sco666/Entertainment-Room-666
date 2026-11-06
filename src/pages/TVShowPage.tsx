import { useParams, Link } from 'react-router-dom';
import { PlaybackDialog } from '../components/features/PlaybackDialog';
import { TrailerPlayer } from '../components/features/TrailerPlayer';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Image } from '../components/ui/Image';
import { Badge } from '../components/ui/Badge';
import { useMediaTrailer, useTVShowDetails, useSeasonDetails } from '../hooks/useMedia';
import { useMediaLibrary } from '../hooks/useMediaLibrary';
import { formatYear, formatDate, formatRuntime } from '../utils/helpers';
import { getVimeusEpisodeEmbedUrl } from '../utils/vimeus';
import { getVidstuckEpisodeEmbedUrl, getZxcstreamEpisodePlayerUrl, getOkRuEpisodeEmbedUrl } from '../utils/additionalPlayers';
import { useState } from 'react';
import type { CineSrcEpisode } from '../types';

export function TVShowPage() {
  const { id } = useParams<{ id: string }>();
  const { show, loading, error } = useTVShowDetails(id!);
  const trailer = useMediaTrailer('tv', show?.tmdbId);
  const { addToContinueWatching, toggleWatchlist, isInWatchlist, isWatched, markWatched, markSeasonWatched, removeSeasonWatched, removeFromWatched } = useMediaLibrary();

  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<CineSrcEpisode | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);

  const { season, loading: seasonLoading } = useSeasonDetails(id!, selectedSeason);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card><CardContent className="aspect-video" /></Card>
            <Card><CardContent className="space-y-4"><div className="h-6 w-3/4" /><div className="h-4 w-1/2" /><div className="h-4 w-1/3" /></CardContent></Card>
          </div>
          <Card><CardContent className="aspect-[3/4]" /></Card>
        </div>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <svg className="mx-auto h-16 w-16 text-dark-300 dark:text-dark-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">TV Show Not Found</h1>
        <p className="text-dark-500 dark:text-dark-400 mb-6">{error || 'The TV show you\'re looking for doesn\'t exist.'}</p>
        <Link to="/tv-shows"><Button>Browse TV Shows</Button></Link>
      </div>
    );
  }

  const handlePlayEpisode = (episode: CineSrcEpisode) => {
    setSelectedEpisode(episode);
    addToContinueWatching(
      { type: 'tv', item: show },
      {
        seasonNumber: selectedSeason,
        episodeNumber: episode.episodeNumber,
        name: episode.name,
      }
    );
    setShowPlayer(true);
  };

  const cinesrcEmbedUrl = show.tmdbId && selectedEpisode
    ? `https://cinesrc.st/embed/tv/${encodeURIComponent(String(show.tmdbId))}?s=${selectedSeason}&e=${selectedEpisode.episodeNumber}`
    : null;
  const isSaved = isInWatchlist('tv', show.id);
  const showWatched = isWatched('tv', show.id);
  const selectedEpisodeRef = selectedEpisode
    ? { seasonNumber: selectedSeason, episodeNumber: selectedEpisode.episodeNumber, name: selectedEpisode.name }
    : undefined;
  const selectedEpisodeWatched = selectedEpisode
    ? isWatched('tv', show.id, selectedEpisodeRef)
    : false;
  const seasonWatched = season?.episodes.length
    ? season.episodes.every((episode) => isWatched('tv', show.id, {
        seasonNumber: selectedSeason,
        episodeNumber: episode.episodeNumber,
        name: episode.name,
      }))
    : false;
  const ageRating = show.ageRating || show.contentRating || show.certification || 'N/A';

  return (
    <div className="min-h-screen">
      {selectedEpisode && (
        <PlaybackDialog
          isOpen={showPlayer}
          itemKey={`tv:${show.id}:${selectedSeason}:${selectedEpisode.episodeNumber}`}
          title={`${show.name} - S${selectedSeason.toString().padStart(2, '0')}E${selectedEpisode.episodeNumber.toString().padStart(2, '0')} - ${selectedEpisode.name}`}
          providers={[
            {
              id: 'vimeus',
              name: 'Vimeus',
              getSrc: () => getVimeusEpisodeEmbedUrl(show.tmdbId, selectedSeason, selectedEpisode.episodeNumber),
              unavailableReason: !show.tmdbId ? 'A TMDB ID is required' : undefined,
            },
            {
              id: 'cinesrc',
              name: 'CineSrc',
              getSrc: () => {
                if (!cinesrcEmbedUrl) throw new Error('A TMDB ID is required to open this episode in CineSrc.');
                return cinesrcEmbedUrl;
              },
              unavailableReason: !cinesrcEmbedUrl ? 'A TMDB ID is required' : undefined,
            },
            {
              id: 'vidstuck',
              name: 'Vidstuck',
              getSrc: () => getVidstuckEpisodeEmbedUrl(show.tmdbId, selectedSeason, selectedEpisode.episodeNumber),
              unavailableReason: !show.tmdbId ? 'A TMDB ID is required' : undefined,
            },
            {
              id: 'zxcstream',
              name: 'Zxcstream',
              getSrc: () => getZxcstreamEpisodePlayerUrl(
                show.tmdbId,
                selectedSeason,
                selectedEpisode.episodeNumber,
                'en'
              ),
              unavailableReason: !show.tmdbId ? 'A TMDB ID is required' : undefined,
            },
            {
              id: 'okru',
              name: 'OK.ru',
              languageOptions: [
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Spanish' },
              ],
              getSrc: (language) => getOkRuEpisodeEmbedUrl(
                show.tmdbId,
                selectedSeason,
                selectedEpisode.episodeNumber,
                language === 'es' ? 'es' : 'en',
                show.name,
                show.firstAirDate ? Number(show.firstAirDate.slice(0, 4)) : undefined
              ),
            },
          ]}
          onClose={() => setShowPlayer(false)}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <nav className="mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm text-dark-500 dark:text-dark-400">
            <li><Link to="/" className="hover:text-primary-600 dark:hover:text-primary-400">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link to="/tv-shows" className="hover:text-primary-600 dark:hover:text-primary-400">TV Shows</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-dark-900 dark:text-white truncate max-w-xs" aria-current="page">{show.name}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="relative aspect-[3/4] w-full sm:w-72 flex-shrink-0 rounded-xl overflow-hidden">
                <Image
                  src={show.poster}
                  alt={`${show.name} poster`}
                  fallback="/placeholder-poster.svg"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3">
                  <Badge variant="primary" size="lg"><span aria-hidden="true">★</span> {show.rating.toFixed(1)}</Badge>
                </div>
                <div className="absolute top-3 right-3">
                  <Badge variant="default" className="bg-black/70 text-white" aria-label={`Age rating ${ageRating}`}>{ageRating}</Badge>
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="primary" size="lg">{show.rating.toFixed(1)}</Badge>
                  <span className="text-dark-500 dark:text-dark-400">({show.voteCount || 'N/A'} votes)</span>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-dark-900 dark:text-white">{show.name}</h1>
                <p className="text-dark-500 dark:text-dark-400">{show.status} • {formatYear(show.firstAirDate)} - {show.lastAirDate !== 'Present' ? formatYear(show.lastAirDate) : 'Present'}</p>

                <div className="flex flex-wrap items-center gap-4 text-sm text-dark-500 dark:text-dark-400">
                  <span>{show.numberOfSeasons} Seasons</span>
                  <span aria-hidden="true">•</span>
                  <span>{show.numberOfEpisodes} Episodes</span>
                  <span aria-hidden="true">•</span>
                  <span>{show.genres.join(', ')}</span>
                </div>

                <div className="flex flex-wrap gap-3 pt-4">
                  <Button
                    variant="outline"
                    size="lg"
                    aria-pressed={isSaved}
                    onClick={() => toggleWatchlist({ type: 'tv', item: show })}
                  >
                    {isSaved ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    aria-pressed={showWatched}
                    onClick={() => showWatched
                      ? removeFromWatched('tv', show.id)
                      : markWatched({ type: 'tv', item: show })}
                  >
                    {showWatched ? 'Show Watched' : 'Mark Show Watched'}
                  </Button>
                  <Button variant="ghost" size="lg" aria-label="Share">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                  </Button>
                </div>
              </div>
            </div>

            <TrailerPlayer
              title={show.name}
              videoKey={trailer.trailerKey}
              loading={trailer.loading}
              error={trailer.error}
            />

            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-dark-600 dark:text-dark-300 leading-relaxed whitespace-pre-line">{show.overview}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Seasons</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={seasonWatched ? 'secondary' : 'outline'}
                    disabled={!season?.episodes.length}
                    aria-pressed={seasonWatched}
                    aria-label={`${seasonWatched ? 'Unmark' : 'Mark'} season ${selectedSeason} as watched`}
                    onClick={() => seasonWatched
                      ? removeSeasonWatched('tv', show.id, selectedSeason)
                      : season && markSeasonWatched({ type: 'tv', item: show }, selectedSeason, season.episodes)}
                  >
                    {seasonWatched ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m5 12 4 4L19 6" />
                        </svg>
                        Season watched
                      </span>
                    ) : 'Mark season watched'}
                  </Button>
                  <select
                    value={selectedSeason}
                    onChange={(e) => {
                      setSelectedSeason(Number(e.target.value));
                      setSelectedEpisode(null);
                    }}
                    className="px-3 py-1.5 text-sm border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    aria-label="Select season"
                  >
                    {Array.from({ length: show.numberOfSeasons }, (_, i) => i + 1).map((seasonNum) => (
                      <option key={seasonNum} value={seasonNum}>Season {seasonNum}</option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent>
                {seasonLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-3">
                        <div className="h-16 w-16 bg-dark-200 dark:bg-dark-700 rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 bg-dark-200 dark:bg-dark-700 rounded" />
                          <div className="h-3 w-1/2 bg-dark-200 dark:bg-dark-700 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : season ? (
                  <div className="space-y-3">
                    {season.episodes.map((episode) => {
                      const episodeRef = {
                        seasonNumber: selectedSeason,
                        episodeNumber: episode.episodeNumber,
                        name: episode.name,
                      };
                      const episodeWatched = isWatched('tv', show.id, episodeRef);
                      return (
                      <div
                        key={episode.id}
                        className="flex items-center gap-4 border border-dark-200 bg-dark-50 p-3 dark:border-dark-700 dark:bg-dark-800"
                      >
                        <button
                          type="button"
                          onClick={() => handlePlayEpisode(episode)}
                          className="flex min-w-0 flex-1 items-center gap-4 text-left"
                          aria-label={`Play ${episode.name}`}
                        >
                          <div className="relative aspect-video h-16 w-24 flex-shrink-0 overflow-hidden bg-dark-200 dark:bg-dark-700">
                            {episode.still && (
                              <Image
                                src={episode.still}
                                alt={`${episode.name} thumbnail`}
                                className="h-full w-full object-cover"
                              />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium text-dark-900 dark:text-white">
                                S{selectedSeason.toString().padStart(2, '0')}E{episode.episodeNumber.toString().padStart(2, '0')} - {episode.name}
                              </span>
                              {episode.rating > 0 && (
                                <Badge variant="primary" size="sm">{episode.rating.toFixed(1)}</Badge>
                              )}
                            </div>
                            <p className="truncate text-sm text-dark-500 dark:text-dark-400">{episode.overview || 'No description available'}</p>
                            <div className="mt-1 flex items-center gap-3 text-xs text-dark-500 dark:text-dark-400">
                              <span>{formatDate(episode.airDate)}</span>
                              <span aria-hidden="true">•</span>
                              <span>{episode.runtime > 0 ? formatRuntime(episode.runtime) : 'Runtime unavailable'}</span>
                            </div>
                          </div>
                        </button>
                        <Button
                          type="button"
                          size="sm"
                          variant={episodeWatched ? 'secondary' : 'outline'}
                          aria-pressed={episodeWatched}
                          aria-label={`${episodeWatched ? 'Unmark' : 'Mark'} ${episode.name} as watched`}
                          onClick={() => episodeWatched
                            ? removeFromWatched('tv', show.id, episodeRef)
                            : markWatched({ type: 'tv', item: show }, episodeRef)}
                        >
                          {episodeWatched ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m5 12 4 4L19 6" />
                              </svg>
                              Watched
                            </span>
                          ) : 'Mark watched'}
                        </Button>
                      </div>
                    );
                    })}
                  </div>
                ) : (
                  <p className="text-dark-500 dark:text-dark-400 text-center py-8">No episodes found for this season</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Play Episode</CardTitle>
                <CardDescription>Select an episode from the season list</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedEpisode ? (
                  <>
                    <div className="p-3 rounded-lg bg-dark-50 dark:bg-dark-800 border border-dark-200 dark:border-dark-700">
                      <p className="font-medium text-dark-900 dark:text-white">
                        S{selectedSeason.toString().padStart(2, '0')}E{selectedEpisode.episodeNumber.toString().padStart(2, '0')} - {selectedEpisode.name}
                      </p>
                      <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">{selectedEpisode.overview}</p>
                    </div>
                    <Button
                      onClick={() => handlePlayEpisode(selectedEpisode)}
                      disabled={!show.tmdbId}
                      className="w-full"
                    >
                      Play Episode
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => selectedEpisodeWatched
                        ? removeFromWatched('tv', show.id, selectedEpisodeRef)
                        : markWatched({ type: 'tv', item: show }, selectedEpisodeRef)}
                      className="w-full"
                      aria-pressed={selectedEpisodeWatched}
                    >
                      {selectedEpisodeWatched ? 'Remove Watched Status' : 'Mark Episode Watched'}
                    </Button>
                    {!show.tmdbId && (
                      <p className="text-sm text-dark-500 dark:text-dark-400">
                        A TMDB ID is required to open this episode.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-dark-500 dark:text-dark-400 text-center py-8">Select an episode from the season list to play it</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-dark-500 dark:text-dark-400">First Air Date</dt>
                    <dd className="font-medium text-dark-900 dark:text-white">{formatDate(show.firstAirDate)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-dark-500 dark:text-dark-400">Status</dt>
                    <dd className="font-medium text-dark-900 dark:text-white">{show.status}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-dark-500 dark:text-dark-400">Seasons</dt>
                    <dd className="font-medium text-dark-900 dark:text-white">{show.numberOfSeasons}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-dark-500 dark:text-dark-400">Episodes</dt>
                    <dd className="font-medium text-dark-900 dark:text-white">{show.numberOfEpisodes}</dd>
                  </div>
                  {show.imdbId && (
                    <div className="flex justify-between">
                      <dt className="text-dark-500 dark:text-dark-400">IMDb</dt>
                      <dd className="font-medium text-dark-900 dark:text-white">
                        <a href={`https://imdb.com/title/${show.imdbId}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 dark:hover:text-primary-400">{show.imdbId}</a>
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}