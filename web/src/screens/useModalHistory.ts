import React from 'react';

/** A modal owns a history entry, so Back closes the modal before navigating away. */
export function useModalHistory(onClose: () => void) {
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
    let popped = false;
    function handleBack() {
      if (window.history.state?.clanDialog === key) return;
      popped = true;
      onCloseRef.current();
    }
    window.addEventListener('popstate', handleBack);
    return () => {
      window.removeEventListener('popstate', handleBack);
      if (!popped) {
        // Delay cleanup to avoid StrictMode's effect replay popping a live modal.
        cleanupTimer.current = window.setTimeout(() => {
          cleanupTimer.current = null;
          if (window.history.state?.clanDialog === key) window.history.back();
        }, 0);
      }
    };
  }, []);
}
