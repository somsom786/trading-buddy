import { ChatWorkspace } from '../components/chat/ChatWorkspace';
import type { CompanionService } from '../services/tauri/companionService';
import type { LocalAiService } from '../services/tauri/localAiService';
import type { WindowService } from '../services/windowService';

const navigationItems = ['Chat', 'Journal', 'Reviews', 'Settings'] as const;

interface MainViewProps {
  localAiService?: LocalAiService;
  companionService?: CompanionService;
  windowService?: WindowService;
}

export function MainView(props: MainViewProps) {
  return (
    <div className="main-view">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark">TB</span>
          <div>
            <strong>Trading Buddy</strong>
            <small>BETA v0.1 · Local companion</small>
          </div>
        </div>

        <nav aria-label="Primary navigation">
          {navigationItems.map((item, index) => (
            <button
              key={item}
              type="button"
              className={`nav-item${index === 0 ? ' nav-item--active' : ''}`}
            >
              <span className="nav-item__dot" aria-hidden="true" />
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="workspace__header">
          <div>
            <p className="eyebrow">Private by default</p>
            <h1>Chat</h1>
          </div>
          <span className="status-pill">Local only</span>
        </header>

        <ChatWorkspace {...props} />
      </main>
    </div>
  );
}
