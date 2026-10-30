import React from 'react';
import { api } from '../api';
import { useI18n } from '../i18n';

interface AuditEvent {
  id: number;
  actor: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  createdAt: number;
}

const actions: Record<string, { uk: string; en: string }> = {
  'war.import': { uk: 'Імпорт війни', en: 'War imported' },
  'war.update': { uk: 'Редагування війни', en: 'War updated' },
  'roster.import': { uk: 'Імпорт складу', en: 'Roster imported' },
  'player.labels.update': { uk: 'Зміна позначок гравця', en: 'Player labels updated' },
  'player.note.add': { uk: 'Додано нотатку', en: 'Player note added' },
  'player.note.delete': { uk: 'Видалено нотатку', en: 'Player note deleted' },
  'player.merge': { uk: 'Об’єднано гравців', en: 'Players merged' },
  'settings.update': { uk: 'Змінено налаштування', en: 'Settings changed' },
  'account.update': { uk: 'Змінено акаунт', en: 'Account updated' },
  'account.delete': { uk: 'Видалено акаунт', en: 'Account deleted' },
  'invite.create': { uk: 'Створено запрошення', en: 'Invite created' },
  'invite.revoke': { uk: 'Відкликано запрошення', en: 'Invite revoked' },
  'invite.shared.create': { uk: 'Створено спільне запрошення', en: 'Shared invite created' },
  'invite.shared.revoke': { uk: 'Відкликано спільне запрошення', en: 'Shared invite revoked' },
};

export function AuditHistory() {
  const { locale } = useI18n();
  const [entries, setEntries] = React.useState<AuditEvent[]>([]);
  const [error, setError] = React.useState('');
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!expanded) return;
    let active = true;
    api<AuditEvent[]>('audit')
      .then((data) => {
        if (active) setEntries(data);
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      });
    return () => {
      active = false;
    };
  }, [expanded]);

  return (
    <section className="panel">
      <button
        type="button"
        className="game-button secondary"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {locale === 'uk' ? 'Історія дій' : 'Activity log'} {expanded ? '−' : '+'}
      </button>
      {expanded && (
        <>
          {error && (
            <p role="alert" className="error-strip">
              {error}
            </p>
          )}
          <div className="accounts-list">
            {entries.map((event) => (
              <div className="account-row" key={event.id}>
                <div>
                  <strong>{actions[event.action]?.[locale] ?? event.action}</strong>
                  <small>
                    {event.actor ?? (locale === 'uk' ? 'Система' : 'System')} · {event.entity}
                    {event.entityId ? ' #' + event.entityId : ''}
                  </small>
                </div>
                <small>
                  {new Date(event.createdAt).toLocaleString(locale === 'uk' ? 'uk-UA' : 'en-US')}
                </small>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
