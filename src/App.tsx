import { resolveAppView } from './app/view';
import { BuddyView } from './views/BuddyView';
import { MainView } from './views/MainView';

export function App() {
  return resolveAppView(window.location.search) === 'buddy' ? <BuddyView /> : <MainView />;
}
