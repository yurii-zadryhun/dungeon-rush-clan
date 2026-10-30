import React from 'react';
import { createPortal } from 'react-dom';
import { isTopDialog, useModalHistory } from './useModalHistory';

interface Props {
  children: React.ReactNode;
  onClose: () => void;
  ariaLabel: string;
  className: string;
}

/** Single modal shell: backdrop, focus trap, Escape and browser Back. */
export function ModalDialog({ children, onClose, ariaLabel, className }: Props) {
  const dialog = React.useRef<HTMLElement>(null);
  const latestClose = React.useRef(onClose);
  latestClose.current = onClose;
  const dialogKey = useModalHistory(onClose);

  React.useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = dialog.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (node?.querySelector<HTMLElement>('.close-button, [autofocus]') ?? node)?.focus();

    function onKey(event: KeyboardEvent) {
      if (!isTopDialog(dialogKey)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        latestClose.current();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const focusable = [
        ...node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((item) => item.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = oldOverflow;
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) latestClose.current();
      }}
    >
      <section
        ref={dialog}
        tabIndex={-1}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
