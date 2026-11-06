import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { classNames } from '@/utils/helpers';
import { simklAPI } from '@/services/simkl';

export function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [simklConnected, setSimklConnected] = useState(simklAPI.isConnected());
  const [simklLoginError, setSimklLoginError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const updateSimklStatus = () => setSimklConnected(simklAPI.isConnected());
    window.addEventListener('simkl-auth-changed', updateSimklStatus);
    return () => window.removeEventListener('simkl-auth-changed', updateSimklStatus);
  }, []);

  useEffect(() => {
    setShowSearch(false);
    setShowMenu(false);
    setSearchQuery('');
  }, [location.pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSimklLogin = async () => {
    setSimklLoginError(null);
    try {
      await simklAPI.connect();
    } catch (error) {
      setSimklLoginError(error instanceof Error ? error.message : 'Could not connect to Simkl.');
    }
  };

  return (
    <header className={classNames(
      'fixed top-0 left-0 right-0 z-40 bg-app-background',
      scrolled && 'shadow-sm'
    )}>
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center" aria-label="Home">
            <img
              src="https://media1.tenor.com/m/tcDvU7eJUGwAAAAd/metal-blackmetal-cat-headbang-corpsepaint.gif"
              alt=""
              className="h-12 w-16 object-contain"
            />
          </Link>

          <div className="flex-1 max-w-xl mx-8 hidden md:block">
            <form onSubmit={handleSearch} className="relative" role="search">
              <label htmlFor="search" className="sr-only">Search movies, TV shows</label>
              <Input
                id="search"
                type="search"
                placeholder="Search movies, TV shows..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                leftIcon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
                className="!bg-white !text-black border-dark-200 focus:bg-white"
              />
            </form>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/movies" className="hidden sm:block px-3 py-2 text-sm font-medium text-dark-700 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800">
              Movies
            </Link>
            <Link to="/tv-shows" className="hidden sm:block px-3 py-2 text-sm font-medium text-dark-700 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800">
              TV Shows
            </Link>
            <Link to="/watchlist" className="hidden sm:block px-3 py-2 text-sm font-medium text-dark-700 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800">
              Watchlist
            </Link>
            <Link to="/watched" className="hidden sm:block px-3 py-2 text-sm font-medium text-dark-700 dark:text-dark-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800">
              Watched
            </Link>
            {simklConnected ? (
              <Link to="/watchlist" className="hidden sm:block px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-dark-800">
                Simkl connected
              </Link>
            ) : (
              <Button size="sm" className="hidden sm:inline-flex" onClick={handleSimklLogin}>
                Sign in with Simkl
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={showSearch ? 'Close search' : 'Open search'}
              aria-expanded={showSearch}
              onClick={() => {
                setShowSearch((visible) => !visible);
                setShowMenu(false);
              }}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={showMenu ? 'Close menu' : 'Open menu'}
              aria-expanded={showMenu}
              onClick={() => {
                setShowMenu((visible) => !visible);
                setShowSearch(false);
              }}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
          </div>
        </div>

        {showSearch && (
          <div className="md:hidden py-4 border-t border-dark-200 dark:border-dark-700">
            <form onSubmit={handleSearch} className="relative" role="search">
              <label htmlFor="mobile-search" className="sr-only">Search movies, TV shows</label>
              <Input
                id="mobile-search"
                type="search"
                placeholder="Search movies, TV shows..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="!bg-white !text-black border-dark-200 focus:bg-white"
                leftIcon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
                autoFocus
              />
            </form>
          </div>
        )}
        {showMenu && (
          <div className="md:hidden border-t border-dark-200 dark:border-dark-700 py-3">
            <nav aria-label="Mobile navigation" className="flex flex-col">
              <Link to="/movies" className="rounded-lg px-3 py-2 text-sm font-medium text-dark-700 hover:bg-dark-100 dark:text-dark-300 dark:hover:bg-dark-800">Movies</Link>
              <Link to="/tv-shows" className="rounded-lg px-3 py-2 text-sm font-medium text-dark-700 hover:bg-dark-100 dark:text-dark-300 dark:hover:bg-dark-800">TV Shows</Link>
              <Link to="/watchlist" className="rounded-lg px-3 py-2 text-sm font-medium text-dark-700 hover:bg-dark-100 dark:text-dark-300 dark:hover:bg-dark-800">Watchlist</Link>
              <Link to="/watched" className="rounded-lg px-3 py-2 text-sm font-medium text-dark-700 hover:bg-dark-100 dark:text-dark-300 dark:hover:bg-dark-800">Watched</Link>
              <Link to="/trending" className="rounded-lg px-3 py-2 text-sm font-medium text-dark-700 hover:bg-dark-100 dark:text-dark-300 dark:hover:bg-dark-800">Trending</Link>
              {simklConnected ? (
                <Link to="/watchlist" className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-dark-800">Simkl connected</Link>
              ) : (
                <button
                  type="button"
                  onClick={handleSimklLogin}
                  className="rounded-lg px-3 py-2 text-left text-sm font-medium text-primary-400 hover:bg-dark-800"
                >
                  Sign in with Simkl
                </button>
              )}
            </nav>
          </div>
        )}
        {simklLoginError && (
          <p className="pb-3 text-right text-xs text-red-400" role="alert">{simklLoginError}</p>
        )}
      </nav>
    </header>
  );
}