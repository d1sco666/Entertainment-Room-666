import { useEffect, useState } from 'react';
import { VideoPlayer } from './VideoPlayer';
import type { DubLanguage } from '../../utils/additionalPlayers';

interface PlaybackProvider {
  id: 'vimeus' | 'cinesrc' | 'vidstuck' | 'zxcstream' | 'pelmaster';
  name: string;
  getSrc: (dubLanguage?: DubLanguage) => string | Promise<string>;
  languageOptions?: { value: DubLanguage; label: string }[];
  unavailableReason?: string;
}

interface PlaybackDialogProps {
  isOpen: boolean;
  itemKey: string;
  title: string;
  providers: PlaybackProvider[];
  onClose: () => void;
}

export function PlaybackDialog({ isOpen, itemKey, title, providers, onClose }: PlaybackDialogProps) {
  const [selectedProvider, setSelectedProvider] = useState<PlaybackProvider | null>(null);
  const [languageProvider, setLanguageProvider] = useState<PlaybackProvider | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedProvider(null);
    setLanguageProvider(null);
    setPlayerUrl(null);
    setLoadingProvider(null);
    setLoadError(null);
  }, [isOpen, itemKey]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const loadProvider = async (provider: PlaybackProvider, dubLanguage?: DubLanguage) => {
    setSelectedProvider(provider);
    setLanguageProvider(null);
    setLoadingProvider(provider.id);
    setLoadError(null);

    try {
      setPlayerUrl(await provider.getSrc(dubLanguage));
    } catch (error) {
      setSelectedProvider(null);
      setLoadError(error instanceof Error ? error.message : `${provider.name} could not load this title.`);
    } finally {
      setLoadingProvider(null);
    }
  };

  const chooseProvider = (provider: PlaybackProvider) => {
    setLoadError(null);
    if (provider.languageOptions) {
      setLanguageProvider(provider);
      return;
    }
    void loadProvider(provider);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={playerUrl ? 'Video Player' : loadingProvider ? 'Loading video player' : languageProvider ? 'Choose audio language' : 'Choose a video provider'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {playerUrl ? (
        <div className="relative w-full max-w-5xl aspect-video">
          <VideoPlayer src={playerUrl} title={title} />
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-12 right-0 rounded-lg bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            aria-label="Close player"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md rounded-xl border border-dark-700 bg-dark-900 p-6 shadow-xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {loadingProvider
                  ? `Loading ${selectedProvider?.name}...`
                  : languageProvider
                    ? `Choose ${languageProvider.name} audio language`
                    : 'Choose a player'}
              </h2>
              <p className="mt-1 text-sm text-dark-300">{title}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-dark-300 transition-colors hover:bg-dark-800 hover:text-white"
              aria-label="Close player selection"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {loadError && (
            <p className="mb-3 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200" role="alert">
              {loadError}
            </p>
          )}
          {languageProvider ? (
            <div className="space-y-3">
              {languageProvider.languageOptions?.map((language) => (
                <button
                  key={language.value}
                  type="button"
                  disabled={Boolean(loadingProvider)}
                  onClick={() => void loadProvider(languageProvider, language.value)}
                  className="w-full rounded-lg border border-dark-700 bg-dark-800 px-4 py-3 text-left font-medium text-white transition-colors enabled:hover:border-primary-500 enabled:hover:bg-dark-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {language.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setLanguageProvider(null)}
                className="w-full rounded-lg px-4 py-2 text-sm text-dark-300 transition-colors hover:bg-dark-800 hover:text-white"
              >
                Back to players
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  disabled={Boolean(loadingProvider) || Boolean(provider.unavailableReason)}
                  onClick={() => chooseProvider(provider)}
                  className="w-full rounded-lg border border-dark-700 bg-dark-800 px-4 py-3 text-left font-medium text-white transition-colors enabled:hover:border-primary-500 enabled:hover:bg-dark-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {provider.name}
                  {provider.unavailableReason && (
                    <span className="mt-1 block text-sm font-normal text-dark-300">
                      {provider.unavailableReason}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {loadingProvider && (
            <p className="mt-3 text-sm text-dark-300" role="status">
              Looking up the selected provider...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
