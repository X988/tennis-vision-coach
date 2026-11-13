import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'library' }
  | { name: 'lesson'; id: string; mode: 'watch' | 'decide' | 'compare' }
  | { name: 'constructor' }
  | { name: 'progress' }
  | { name: 'profile' }
  | { name: 'help' };

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const q = new URLSearchParams(query);
  switch (parts[0]) {
    case 'library':
      return { name: 'library' };
    case 'lesson': {
      const mode = q.get('mode');
      return { name: 'lesson', id: parts[1] ?? '', mode: mode === 'watch' || mode === 'compare' ? mode : 'decide' };
    }
    case 'constructor':
      return { name: 'constructor' };
    case 'progress':
      return { name: 'progress' };
    case 'profile':
      return { name: 'profile' };
    case 'help':
      return { name: 'help' };
    default:
      return { name: 'home' };
  }
}

export function href(r: Route): string {
  if (r.name === 'lesson') return `#/lesson/${r.id}?mode=${r.mode}`;
  return r.name === 'home' ? '#/' : `#/${r.name}`;
}

export function navigate(r: Route) {
  window.location.hash = href(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
