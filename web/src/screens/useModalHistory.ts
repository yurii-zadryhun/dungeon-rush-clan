import React from 'react';

// A synthetic history entry makes the Android/browser Back button dismiss a dialog.
export function useModalHistory(onClose: () => void) {
  const latest = React.useRef(onClose);
  latest.current = onClose;
  React.useEffect(() => {
    const key = 'clan-modal-' + Math.random().toString(36).slice(2);
    history.pushState({ ...history.state, modalKey: key }, '');
    let popped = false;
    function handleBack() {
      popped = true;
      latest.current();
    }
    window.addEventListener('popstate', handleBack);
    return () => {
      window.removeEventListener('popstate', handleBack);
      if (!popped && history.state?.modalKey === key) history.back();
    };
  }, []);
}
