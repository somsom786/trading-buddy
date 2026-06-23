import { useEffect, useState } from 'react';
import { BuddyRenderer } from '../components/buddy/BuddyRenderer';
import { BuddyStatusIndicator } from '../components/buddy/BuddyStatusIndicator';
import type { BuddyState } from '../domain/companion/buddyState';
import { tauriCompanionService, type CompanionService } from '../services/tauri/companionService';
import { tauriWindowService, type WindowService } from '../services/windowService';

interface BuddyViewProps {
  windowService?: WindowService;
  companionService?: CompanionService;
}

export function BuddyView({
  windowService = tauriWindowService,
  companionService = tauriCompanionService,
}: BuddyViewProps) {
  const [state, setState] = useState<BuddyState>('idle');

  useEffect(() => {
    let disposed = false;
    let cleanup: () => void = () => undefined;
    void companionService
      .subscribe((command) => {
        if (command.type === 'set_state') {
          setState(command.state);
        } else if (command.type === 'wake') {
          setState('idle');
        }
      })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
        } else {
          cleanup = unlisten;
        }
      });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [companionService]);

  const openMainWindow = () => {
    void companionService.emitInteraction({ type: 'interaction_detected' });
    void companionService.emitInteraction({ type: 'buddy_clicked' });
    void companionService.emitInteraction({ type: 'open_main_requested' });
    void windowService.openMainWindow();
  };

  return (
    <main className="buddy-view" data-testid="buddy-view">
      <BuddyRenderer
        state={state}
        companionService={companionService}
        onActivate={openMainWindow}
      />
      <BuddyStatusIndicator state={state} />
    </main>
  );
}
