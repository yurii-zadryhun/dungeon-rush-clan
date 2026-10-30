import React from 'react';

const modalStack: string[] = [];
export function isTopDialog(key: string): boolean {
  return modalStack[modalStack.length - 1] === key;
}

/** One history entry per dialog; only the uppermost overlay reacts to Back. */
export function useModalHistory(onClose: () => void): string {
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const keyRef = React.useRef('clan-modal-' + Math.random().toString(36).slice(2));
  const cleanupTimer = React.useRef<number | null>(null);

  React.useEffect(() => {
    const key = keyRef.current;
    if (cleanupTimer.current !== null) {
      window.clearTimeout(cleanupTimer.current);
      cleanupTimer.current = null;
    }
    if (window.history.state?.clanDialog !== key) {
      window.history.pushState({ ...window.history.state, clanDialog: key }, '');
    }
    if (!modalStack.includes(key)) modalStack.push(key);
    let popped = false;
    function handleBack() {
      if (!isTopDialog(key) || window.history.state?.clanDialog === key) return;
      popped = true;
      onCloseRef.current();
    }
    window.addEventListener('popstate', handleBack);
    return () => {
      window.removeEventListener('popstate', handleBack);
      const position = modalStack.indexOf(key);
      if (position >= 0) modalStack.splice(position, 1);
      if (!popped) {
        // React StrictMode replays effects; allow a remount to cancel the cleanup.
        cleanupTimer.current = window.setTimeout(() => {
          cleanupTimer.current = null;
          if (window.history.state?.clanDialog === key) window.history.back();
        }, 0);
      }
    };
  }, []);
  return keyRef.current;
}
