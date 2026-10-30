import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
type Notice = { message: string; kind: 'success' | 'error'; id: number };
const EVENT = 'clan:notification';

export function notify(message: string, kind: Notice['kind'] = 'success') {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind, id: Date.now() } }));
}

export function ToastHost() {
  const [notice, setNotice] = React.useState<Notice | null>(null);
  React.useEffect(() => {
    const listener = (event: Event) => setNotice((event as CustomEvent<Notice>).detail);
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, []);
  React.useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return (
    <div className={'management-toast ' + notice.kind}
      role={notice.kind === 'error' ? 'alert' : 'status'}>
      {notice.kind === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span>{notice.message}</span>
    </div>
  );
}
