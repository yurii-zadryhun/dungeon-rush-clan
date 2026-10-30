import React from 'react';
import { api } from '../api';

interface AuditEvent {
  id: number;
  actor: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  createdAt: number;
}

export function AuditHistory() {
  const [entries, setEntries] = React.useState<AuditEvent[]>([]);
  const [error, setError] = React.useState('');
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!expanded) return;
    let active = true;
    api<AuditEvent[]>('audit')
      .then((data) => { if (active) setEntries(data); })
      .catch((cause) => { if (active) setError((cause as Error).message); });
    return () => { active = false; };
  }, [expanded]);

  return (
    <section className="panel">
      <button type="button" className="game-button secondary" aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}>Audit log {expanded ? '−' : '+'}</button>
      {expanded && (
        <>
          {error && <p role="alert" className="error-strip">{error}</p>}
          <div className="accounts-list">
            {entries.map((event) => (
              <div className="account-row" key={event.id}>
                <div><strong>{event.action}</strong><small>{event.actor ?? 'System'} · {event.entity}{event.entityId ? ' #' + event.entityId : ''}</small></div>
                <small>{new Date(event.createdAt).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
