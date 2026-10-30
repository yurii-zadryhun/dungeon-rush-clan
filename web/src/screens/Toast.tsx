import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { ModalDialog } from './ModalDialog';
import { useI18n } from '../i18n';

type Tone = 'success' | 'error';
interface Notice { id: number; message: string; kind: Tone }
interface Confirmation { message: string; resolve: (accepted: boolean) => void }
const NOTICE = 'clan:notification';
const CONFIRM = 'clan:confirm';
let nextId = 0;

export function notify(message: string, kind: Tone = 'success') {
  window.dispatchEvent(new CustomEvent<Notice>(NOTICE, {
    detail: { id: ++nextId, message, kind },
  }));
}

export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<Confirmation>(CONFIRM, {
      detail: { message, resolve },
    }));
  });
}

/** App-wide notifications are queued, not overwritten by a subsequent save. */
export function ToastHost() {
  const [queue, setQueue] = React.useState<Notice[]>([]);
  const current = queue[0] ?? null;
  React.useEffect(() => {
    const handler = (event: Event) => {
      const notice = (event as CustomEvent<Notice>).detail;
      setQueue((items) => [...items, notice]);
    };
    window.addEventListener(NOTICE, handler);
    return () => window.removeEventListener(NOTICE, handler);
  }, []);
  React.useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => {
      setQueue((items) => items.filter((item) => item.id !== current.id));
    }, current.kind === 'error' ? 5500 : 3200);
    return () => window.clearTimeout(timer);
  }, [current?.id]);
  return current ? (
    <div className={'management-toast ' + current.kind}
      role={current.kind === 'error' ? 'alert' : 'status'}>
      {current.kind === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span>{current.message}</span>
      <button type="button" aria-label="Dismiss"
        onClick={() => setQueue((items) => items.filter((item) => item.id !== current.id))}>
        <X size={16} />
      </button>
    </div>
  ) : null;
}

/** Same dialog shell as the editors; only destructive actions ask for confirmation. */
export function ConfirmationHost() {
  const { locale, t } = useI18n();
  const [pending, setPending] = React.useState<Confirmation | null>(null);
  const current = React.useRef<Confirmation | null>(null);
  React.useEffect(() => {
    const handler = (event: Event) => {
      const request = (event as CustomEvent<Confirmation>).detail;
      // Requests are sequential. Never leave a displaced promise unresolved.
      current.current?.resolve(false);
      current.current = request;
      setPending(request);
    };
    window.addEventListener(CONFIRM, handler);
    return () => {
      window.removeEventListener(CONFIRM, handler);
      current.current?.resolve(false);
      current.current = null;
    };
  }, []);

  function finish(accepted: boolean) {
    const active = current.current;
    current.current = null;
    setPending(null);
    active?.resolve(accepted);
  }

  return pending ? (
    <ModalDialog className="panel modal confirm-dialog"
      ariaLabel={locale === 'uk' ? 'Підтвердження дії' : 'Confirm action'}
      onClose={() => finish(false)}>
      <header className="modal-header">
        <h2>{locale === 'uk' ? 'Підтвердження дії' : 'Confirm action'}</h2>
        <button type="button" className="close-button" onClick={() => finish(false)}
          aria-label={t('close')}><X size={18} /></button>
      </header>
      <div className="modal-content"><p>{pending.message}</p></div>
      <footer className="modal-actions">
        <button type="button" className="game-button secondary"
          onClick={() => finish(false)}>{t('cancel')}</button>
        <button type="button" className="game-button danger"
          onClick={() => finish(true)}>{locale === 'uk' ? 'Підтвердити' : 'Confirm'}</button>
      </footer>
    </ModalDialog>
  ) : null;
}
