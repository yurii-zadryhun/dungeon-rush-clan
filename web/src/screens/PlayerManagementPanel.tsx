import React from 'react';
import { ClipboardList, MessageCircle, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import {
  api,
  json,
  type NoteCategory,
  type PlayerLabels,
  type PlayerManagement,
  type PlayerTag,
} from '../api';
import { useI18n } from '../i18n';
import './PlayerManagementPanel.css';

const tagOptions: PlayerTag[] = ['family', 'exception', 'attention', 'inactive', 'plan', 'reliable'];
const initialLabels: PlayerLabels = {
  telegram: false,
  discord: false,
  telegramHandle: '',
  discordHandle: '',
  tags: [],
  exceptionReason: '',
};

export function PlayerManagementPanel({ playerId }: { playerId: number }) {
  const { t, locale } = useI18n();
  const [data, setData] = React.useState<PlayerManagement | null>(null);
  const [labels, setLabels] = React.useState<PlayerLabels>(initialLabels);
  const [body, setBody] = React.useState('');
  const [category, setCategory] = React.useState<NoteCategory>('note');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');

  React.useEffect(() => {
    let alive = true;
    setData(null);
    api<PlayerManagement>('player-management/' + playerId)
      .then((value) => {
        if (!alive) return;
        setData(value);
        setLabels(value.labels);
      })
      .catch((failure) => {
        if (alive) setError((failure as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [playerId]);

  function setValue<K extends keyof PlayerLabels>(field: K, value: PlayerLabels[K]) {
    setLabels((previous) => ({ ...previous, [field]: value }));
    setNotice('');
  }

  function toggleTag(tag: PlayerTag) {
    setValue(
      'tags',
      labels.tags.includes(tag) ? labels.tags.filter((value) => value !== tag) : [...labels.tags, tag],
    );
  }

  async function action(operation: () => Promise<PlayerManagement>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await operation();
      setData(next);
      setLabels(next.labels);
      setNotice(t('changesSaved'));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function saveLabels() {
    void action(() => api<PlayerManagement>('player-management/' + playerId, json('PATCH', labels)));
  }

  function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    void action(async () => {
      const next = await api<PlayerManagement>(
        'player-management/' + playerId + '/notes',
        json('POST', { body: body.trim(), category }),
      );
      setBody('');
      return next;
    });
  }

  function removeNote(noteId: number) {
    if (!window.confirm(t('confirmDeleteNote'))) return;
    void action(() =>
      api<PlayerManagement>(`player-management/${playerId}/notes/${noteId}`, { method: 'DELETE' }),
    );
  }

  return (
    <section className="panel player-management">
      <div className="player-section-heading">
        <h2>
          <ShieldCheck size={19} />
          {t('managementNotes')}
        </h2>
        <small className="staff-only">{t('staffOnly')}</small>
      </div>
      {!data && !error && <p className="muted">{t('loading')}</p>}
      {data && (
        <>
          <div className="management-grid">
            <div className="management-block">
              <h3>
                <MessageCircle size={16} />
                {t('contactChannels')}
              </h3>
              <div className="contact-choice">
                <label>
                  <input
                    type="checkbox"
                    checked={labels.telegram}
                    onChange={(e) => setValue('telegram', e.target.checked)}
                  />{' '}
                  Telegram
                </label>
                {labels.telegram && (
                  <input
                    value={labels.telegramHandle}
                    placeholder={t('contactOptional')}
                    maxLength={100}
                    onChange={(e) => setValue('telegramHandle', e.target.value)}
                  />
                )}
              </div>
              <div className="contact-choice">
                <label>
                  <input
                    type="checkbox"
                    checked={labels.discord}
                    onChange={(e) => setValue('discord', e.target.checked)}
                  />{' '}
                  Discord
                </label>
                {labels.discord && (
                  <input
                    value={labels.discordHandle}
                    placeholder={t('contactOptional')}
                    maxLength={100}
                    onChange={(e) => setValue('discordHandle', e.target.value)}
                  />
                )}
              </div>
            </div>
            <div className="management-block">
              <h3>
                <ClipboardList size={16} />
                {t('playerTags')}
              </h3>
              <div className="management-tags">
                {tagOptions.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    className={'player-tag-button' + (labels.tags.includes(tag) ? ' selected' : '')}
                    aria-pressed={labels.tags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                  >
                    {t(
                      ('tag_' + tag) as
                        | 'tag_family'
                        | 'tag_exception'
                        | 'tag_attention'
                        | 'tag_inactive'
                        | 'tag_plan'
                        | 'tag_reliable',
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="exemption-reason">
            {t('exceptionReason')}
            <textarea
              rows={2}
              maxLength={600}
              value={labels.exceptionReason}
              placeholder={t('exceptionPlaceholder')}
              onChange={(e) => setValue('exceptionReason', e.target.value)}
            />
          </label>
          <div className="management-save">
            <button className="game-button blue" disabled={busy} onClick={saveLabels}>
              <Save size={15} />
              {t('save')}
            </button>
          </div>
          <div className="note-section">
            <h3>{t('noteHistory')}</h3>
            <form className="note-form" onSubmit={addNote}>
              <select
                value={category}
                aria-label={t('noteType')}
                onChange={(e) => setCategory(e.target.value as NoteCategory)}
              >
                {(['note', 'attention', 'contact', 'positive'] as const).map((value) => (
                  <option value={value} key={value}>
                    {t(
                      ('note_' + value) as
                        'note_note' | 'note_attention' | 'note_contact' | 'note_positive',
                    )}
                  </option>
                ))}
              </select>
              <textarea
                rows={2}
                maxLength={700}
                value={body}
                placeholder={t('newNote')}
                onChange={(e) => setBody(e.target.value)}
              />
              <button type="submit" className="game-button blue" disabled={busy || !body.trim()}>
                <Plus size={15} />
                {t('addNote')}
              </button>
            </form>
            <div className="staff-note-list">
              {data.notes.map((note) => (
                <div className={'staff-note note-' + note.category} key={note.id}>
                  <div className="staff-note-head">
                    <strong>
                      {t(
                        ('note_' + note.category) as
                          'note_note' | 'note_attention' | 'note_contact' | 'note_positive',
                      )}
                    </strong>
                    <small>
                      {new Date(note.createdAt).toLocaleString(locale === 'uk' ? 'uk-UA' : 'en-US')}
                    </small>
                    <small>{note.author || t('formerMember')}</small>
                    <button
                      className="icon-button danger"
                      title={t('deleteNote')}
                      aria-label={t('deleteNote')}
                      disabled={busy}
                      onClick={() => removeNote(note.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <p>{note.body}</p>
                </div>
              ))}
              {!data.notes.length && <p className="muted tiny">{t('noNotes')}</p>}
            </div>
          </div>
        </>
      )}
      {error && (
        <div className="error-strip" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="management-success" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
