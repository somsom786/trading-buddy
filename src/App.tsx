import { resolveAppView } from './app/view';
import { BubbleView } from './views/BubbleView';
import { BuddyView } from './views/BuddyView';
import { MainView } from './views/MainView';

export function App() {
  const view = resolveAppView(window.location.search);
  if (view === 'buddy') {
    return <BuddyView />;
  }
  if (view === 'bubble') {
    return <BubbleView />;
  }
  return <MainView />;
}
