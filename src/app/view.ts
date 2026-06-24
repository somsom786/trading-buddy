export type AppView = 'buddy' | 'bubble' | 'main';

export function resolveAppView(search: string): AppView {
  const requestedView = new URLSearchParams(search).get('view');
  if (requestedView === 'buddy' || requestedView === 'bubble') {
    return requestedView;
  }
  return 'main';
}
