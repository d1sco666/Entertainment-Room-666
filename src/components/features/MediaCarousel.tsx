import { memo, useRef, useState } from 'react';
import { MediaCard } from './MediaCard';
import { SkeletonCard } from '../ui/Skeleton';
import type { CineSrcMovie, CineSrcTVShow } from '@/types';

interface MediaCarouselProps {
  items: (CineSrcMovie | CineSrcTVShow)[];
  type: 'movie' | 'tv';
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  glossyCards?: boolean;
  onRemove?: (item: CineSrcMovie | CineSrcTVShow, type: 'movie' | 'tv') => void;
  removeLabel?: string;
}

function MediaCarouselComponent({
  items,
  type,
  loading = false,
  error,
  emptyMessage = 'No titles available',
  glossyCards = false,
  onRemove,
  removeLabel,
}: MediaCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const move = (direction: -1 | 1) => {
    if (trackRef.current) {
      const scrollAmount = trackRef.current.clientWidth * 0.9;
      trackRef.current.scrollBy({
        left: direction * scrollAmount,
        behavior: isScrolling ? 'auto' : 'smooth',
      });
      setIsScrolling(true);
      setTimeout(() => setIsScrolling(false), 300);
    }
  };

  if (error && items.length === 0) {
    return (
      <p className="border border-red-900/50 bg-red-950/20 p-6 text-red-400" role="alert">
        {error}
      </p>
    );
  }

  if (!loading && items.length === 0) {
    return <p className="py-6 text-center text-dark-400">{emptyMessage}</p>;
  }

  return (
    <div className="relative px-4 group">
      {error && (
        <p className="mb-3 border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        aria-label="Scroll titles left"
        onClick={() => move(-1)}
        className="absolute left-0 top-1/2 z-20 -translate-y-1/2 bg-netflix-black/80 p-3 text-white rounded-r-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity group-hover:not-[&*:disabled]:cursor-pointer group:active:scale-95"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div
        ref={trackRef}
        className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth py-2 group relative"
        aria-label={type === 'movie' ? 'Movies' : 'TV shows'}
      >
        {loading && items.length === 0
          ? Array.from({ length: 8 }, (_, index) => (
              <div className="w-32 flex-none snap-start sm:w-40 lg:w-48" key={index}>
                <SkeletonCard />
              </div>
            ))
          : items.map((item) => (
              <div className="w-32 flex-none snap-start sm:w-40 lg:w-48" key={item.id}>
                <MediaCard
                  item={item}
                  type={type}
                  glossySurface={glossyCards}
                  onRemove={onRemove ? () => onRemove(item, type) : undefined}
                  removeLabel={removeLabel}
                  removeIconOnly
                />
              </div>
            ))}
      </div>
      <button
        type="button"
        aria-label="Scroll titles right"
        onClick={() => move(1)}
        className="absolute right-0 top-1/2 z-20 -translate-y-1/2 bg-netflix-black/80 p-3 text-white rounded-l-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity group-hover:not-[&*:disabled]:cursor-pointer group:active:scale-95"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

export const MediaCarousel = memo(MediaCarouselComponent);
