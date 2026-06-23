export type AppView = 'buddy' | 'main';

export function resolveAppView(search: string): AppView {
  const requestedView = new URLSearchParams(search).get('view');
  return requestedView === 'buddy' ? 'buddy' : 'main';
}
