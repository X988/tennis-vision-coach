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
import { useTour } from './app/tour/context';
import { VoiceProvider, VoiceToggle } from './app/voice/Voice';
import { useVoice } from './app/voice/context';

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
  const voice = useVoice();
  const tour = useTour();
  // Leaving a screen ends what was being said about it (the tour narrates across screens by itself).
  useEffect(() => {
    if (!tour.active) voice.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.name, route.name === 'lesson' ? `${route.id}/${route.mode}` : '']);
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
        <VoiceToggle />
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
      <VoiceProvider>
        <TourProvider>
          <Shell />
        </TourProvider>
      </VoiceProvider>
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
