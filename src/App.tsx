import { useEffect } from 'react';
import { getNav, nav, useNav } from './lib/nav';
import { onPlayWarning, startPlaytime, usePlaytime } from './lib/playtime';
import { speakIfAuto } from './lib/speech';
import { activeProfile, getData, useData } from './lib/store';
import { cls } from './lib/util';
import { GameDetail } from './screens/GameDetail';
import { GameScreen } from './screens/GameScreen';
import { Home, TabBar } from './screens/Home';
import { Me, Rooms } from './screens/Me';
import { LockScreen, Parents } from './screens/Parents';
import { Tutorial } from './screens/Tutorial';
import { Welcome } from './screens/Welcome';
import { Who } from './screens/Who';
import { Icon } from './ui/Icon';
import { toast, ToastHost } from './ui/parts';

/** Gezählt wird überall außer im Elternbereich – und nur, wenn schon ein Kind eingerichtet ist. */
const counting = () => getNav().route.name !== 'parents' && getData().profiles.length > 0;

export function App() {
  const data = useData();
  const state = useNav();
  const { status } = usePlaytime();
  const route = state.route;
  const profile = activeProfile(data);
  const locked = status.locked && route.name !== 'parents';

  useEffect(() => {
    startPlaytime(counting);
    return onPlayWarning((sec) => {
      const text = sec > 120 ? 'Noch 5 Minuten Spielzeit!' : 'Noch 1 Minute Spielzeit!';
      toast(text, <Icon name="hourglass" size={28} />, 5000);
      speakIfAuto(text);
    });
  }, []);

  // Zeit um → laufendes Spiel beenden
  useEffect(() => {
    if (!status.locked) return;
    nav.closeGame();
    nav.closeTutorial();
  }, [status.locked]);

  let screen;
  if (route.name === 'parents') screen = <Parents />;
  else if (!data.profiles.length || route.name === 'welcome') screen = <Welcome edit={route.name === 'welcome' ? route.edit : undefined} />;
  else if (!profile || route.name === 'who') screen = <Who />;
  else if (route.name === 'rooms') screen = <Rooms />;
  else if (route.name === 'me') screen = <Me profile={profile} />;
  else if (route.name === 'game') screen = <GameDetail key={`detail-${route.id}`} id={route.id} profile={profile} />;
  else screen = <Home profile={profile} tab={route.tab} />;

  const tabName = route.name === 'home' || route.name === 'rooms' || route.name === 'me' ? route.name : null;
  const tabs = !!profile && !!tabName && data.profiles.length > 0;

  return (
    <div className={cls('app', tabs && 'with-tabs')}>
      {screen}
      {tabs && <TabBar active={tabName!} />}
      {!locked && state.session && <GameScreen session={state.session} />}
      {!locked && state.tutorial && <Tutorial key={`tut-${state.tutorial.game}`} game={state.tutorial.game} start={state.tutorial.start} />}
      {locked && <LockScreen />}
      <ToastHost />
    </div>
  );
}
