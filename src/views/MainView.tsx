import { ChatWorkspace } from '../components/chat/ChatWorkspace';
import type { CompanionService } from '../services/tauri/companionService';
import type { LocalAiService } from '../services/tauri/localAiService';
import { tauriWindowService, type WindowService } from '../services/windowService';

const navigationItems = ['Chat', 'Journal', 'Reviews', 'Settings'] as const;

interface MainViewProps {
  localAiService?: LocalAiService;
  companionService?: CompanionService;
  windowService?: WindowService;
}

export function MainView({ windowService = tauriWindowService, ...workspaceProps }: MainViewProps) {
  return (
    <div className="main-view">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark">TB</span>
          <div>
            <strong>Companion Home</strong>
            <small>BETA v0.2 · Desktop buddy first</small>
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
            <p className="eyebrow">Secondary workspace</p>
            <h1>Companion Home</h1>
            <p className="workspace__subtitle">
              Your buddy lives on the desktop. This window is for history, privacy, storage, and
              deeper conversations.
            </p>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void windowService.controlBubble('focus');
              }}
            >
              Return to desktop buddy
            </button>
            <span className="status-pill">Local only</span>
          </div>
        </header>

        <ChatWorkspace windowService={windowService} {...workspaceProps} />
      </main>
    </div>
  );
}
