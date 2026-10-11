import { useEffect, useState } from 'react';

export interface Route {
  path: string[];
  params: URLSearchParams;
}

function parse(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const [p, q = ''] = hash.split('?');
  return { path: p.split('/').filter(Boolean), params: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(to: string) {
  window.location.hash = to;
}

export function href(to: string) {
  return `#${to}`;
}
