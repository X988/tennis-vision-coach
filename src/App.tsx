import { useEffect } from 'react';
import { LangContext, useT } from './app/i18n';
import { href, Route, useRoute } from './app/router';
import { Constructor } from './app/screens/Constructor';
import { Help } from './app/screens/Help';
import { Home } from './app/screens/Home';
import { Lesson } from './app/screens/Lesson';
import { Library } from './app/screens/Library';
import { ProfileScreen } from './app/screens/ProfileScreen';
import { Progress } from './app/screens/Progress';
import { StoreProvider, useStore } from './app/store';
import { TourProvider } from './app/tour/Tour';

const NAV: { route: Route; key: string; icon: string }[] = [
  { route: { name: 'home' }, key: 'nav.home', icon: '⌂' },
  { route: { name: 'library' }, key: 'nav.library', icon: '▤' },
  { route: { name: 'constructor' }, key: 'nav.constructor', icon: '✎' },
  { route: { name: 'progress' }, key: 'nav.progress', icon: '↗' },
  { route: { name: 'profile' }, key: 'nav.profile', icon: '☺' },
  { route: { name: 'help' }, key: 'nav.help', icon: '?' },
];

function Shell() {
  const t = useT();
  const route = useRoute();
  const active = (r: Route) => r.name === route.name || (r.name === 'library' && route.name === 'lesson');
  return (
    <div className={`shell route-${route.name}`}>
      <nav className="nav" data-tour="nav">
        <a className="brand" href="#/">
          <img src="./favicon.svg" alt="" width={22} height={22} />
          <span>{t('app.title')}</span>
        </a>
        {NAV.map((n) => (
          <a key={n.key} href={href(n.route)} className={active(n.route) ? 'active' : ''} data-tour={`nav-${n.route.name}`}>
            <span className="nav-icon" aria-hidden>
              {n.icon}
            </span>
            <span>{t(n.key)}</span>
          </a>
        ))}
      </nav>
      <main className="content">
        {route.name === 'home' && <Home />}
        {route.name === 'library' && <Library />}
        {route.name === 'lesson' && <Lesson key={route.id} id={route.id} mode={route.mode} />}
        {route.name === 'constructor' && <Constructor />}
        {route.name === 'progress' && <Progress />}
        {route.name === 'profile' && <ProfileScreen />}
        {route.name === 'help' && <Help />}
      </main>
    </div>
  );
}

function WithLanguage() {
  const { profile } = useStore();
  useEffect(() => {
    document.documentElement.lang = profile.language;
  }, [profile.language]);
  return (
    <LangContext.Provider value={profile.language}>
      <TourProvider>
        <Shell />
      </TourProvider>
    </LangContext.Provider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <WithLanguage />
    </StoreProvider>
  );
}
