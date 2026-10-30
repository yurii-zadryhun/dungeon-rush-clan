import React from 'react';
import { notify } from './Toast';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
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
  const [savedLabels, setSavedLabels] = React.useState<string | null>(null);
  const [body, setBody] = React.useState('');
  const [category, setCategory] = React.useState<NoteCategory>('note');
  const [saving, setSaving] = React.useState(false);
  const [notesBusy, setNotesBusy] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');
  const [saveError, setSaveError] = React.useState('');
  const [noteError, setNoteError] = React.useState('');
  const latestLabels = React.useRef(labels);
  const playerEpoch = React.useRef(0);

  latestLabels.current = labels;

  React.useEffect(() => {
    const epoch = ++playerEpoch.current;
    let alive = true;
    setData(null);
    setSavedLabels(null);
    setSaving(false);
    setLoadError('');
    setSaveError('');
    setNoteError('');
    setBody('');
    api<PlayerManagement>('player-management/' + playerId)
      .then((value) => {
        if (!alive || playerEpoch.current !== epoch) return;
        setData(value);
        setLabels(value.labels);
        setSavedLabels(JSON.stringify(value.labels));
      })
      .catch((failure) => {
        if (alive && playerEpoch.current === epoch) setLoadError((failure as Error).message);
      });
    return () => {
      alive = false;
      ++playerEpoch.current;
    };
  }, [playerId]);

  function setValue<K extends keyof PlayerLabels>(field: K, value: PlayerLabels[K]) {
    setLabels((previous) => ({ ...previous, [field]: value }));
    setSaveError('');
  }

  function toggleTag(tag: PlayerTag) {
    setLabels((previous) => ({
      ...previous,
      tags: previous.tags.includes(tag)
        ? previous.tags.filter((value) => value !== tag)
        : [...previous.tags, tag],
    }));
    setSaveError('');
  }

  const draft = JSON.stringify(labels);
  const unsaved = savedLabels !== null && draft !== savedLabels;

  // Only one labels PATCH can be in flight at a time. If the user edits while it is
  // saving, the effect sends the newest values afterwards instead of overwriting them.
  const saveLabels = React.useCallback(() => {
    if (!data || saving || savedLabels === null || draft === savedLabels) return;
    setSaving(true);
    setSaveError('');
    const epoch = playerEpoch.current;
    const sent = draft;
    void api<PlayerManagement>('player-management/' + playerId, json('PATCH', labels))
      .then((next) => {
        if (playerEpoch.current !== epoch) return;
        const canonical = JSON.stringify(next.labels);
        setSavedLabels(canonical);
        setData((previous) => (previous ? { ...previous, labels: next.labels } : next));
        if (JSON.stringify(latestLabels.current) === sent) {
          setLabels(next.labels);
          notify(t('changesSaved'));
        }
      })
      .catch((failure) => {
        if (playerEpoch.current !== epoch) return;
        const message = (failure as Error).message;
        setSaveError(message);
        notify(t('autosaveFailed'), 'error');
      })
      .finally(() => {
        if (playerEpoch.current === epoch) setSaving(false);
      });
  }, [data, draft, labels, playerId, savedLabels, saving, t]);

  React.useEffect(() => {
    if (!unsaved || saving || saveError) return;
    const timer = setTimeout(saveLabels, 600);
    return () => clearTimeout(timer);
  }, [unsaved, saving, saveError, saveLabels]);

  async function updateNotes(operation: () => Promise<PlayerManagement>, after?: () => void) {
    setNotesBusy(true);
    setNoteError('');
    try {
      const next = await operation();
      setData((previous) => (previous ? { ...previous, notes: next.notes } : next));
      after?.();
      notify(t('changesSaved'));
    } catch (failure) {
      setNoteError((failure as Error).message);
      notify(t('noteSaveFailed'), 'error');
    } finally {
      setNotesBusy(false);
    }
  }

  function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() || notesBusy) return;
    const noteText = body.trim();
    void updateNotes(
      () =>
        api<PlayerManagement>(
          'player-management/' + playerId + '/notes',
          json('POST', { body: noteText, category }),
        ),
      () => setBody(''),
    );
  }

  function removeNote(noteId: number) {
    if (!window.confirm(t('confirmDeleteNote')) || notesBusy) return;
    void updateNotes(() =>
      api<PlayerManagement>(`player-management/${playerId}/notes/${noteId}`, { method: 'DELETE' }),
    );
  }

  return (
    <section className="panel player-management">
      <div className="player-section-heading management-heading">
        <h2>
          <ShieldCheck size={19} />
          {t('managementNotes')}
        </h2>
      </div>

      {!data && !loadError && <p className="muted">{t('loading')}</p>}
      {loadError && (
        <div className="error-strip" role="alert">
          {loadError}
        </div>
      )}
      {data && (
        <>
          <div className="management-grid">
            <div className="management-block">
              <h3>
                <MessageCircle size={16} />
                {t('contactChannels')}
              </h3>
              <div className="contact-choice">
                <label htmlFor={'telegram-' + playerId}>
                  <input
                    id={'telegram-' + playerId}
                    type="checkbox"
                    checked={labels.telegram}
                    onChange={(event) => setValue('telegram', event.target.checked)}
                  />
                  Telegram
                </label>
                <input
                  aria-label={t('telegramContact')}
                  value={labels.telegramHandle}
                  disabled={!labels.telegram}
                  placeholder={t('contactOptional')}
                  maxLength={100}
                  onChange={(event) => setValue('telegramHandle', event.target.value)}
                  onBlur={saveLabels}
                />
              </div>
              <div className="contact-choice">
                <label htmlFor={'discord-' + playerId}>
                  <input
                    id={'discord-' + playerId}
                    type="checkbox"
                    checked={labels.discord}
                    onChange={(event) => setValue('discord', event.target.checked)}
                  />
                  Discord
                </label>
                <input
                  aria-label={t('discordContact')}
                  value={labels.discordHandle}
                  disabled={!labels.discord}
                  placeholder={t('contactOptional')}
                  maxLength={100}
                  onChange={(event) => setValue('discordHandle', event.target.value)}
                  onBlur={saveLabels}
                />
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
              onChange={(event) => setValue('exceptionReason', event.target.value)}
              onBlur={saveLabels}
            />
          </label>
          {saveError && (
            <div className="management-save-error" role="alert">
              <AlertCircle size={17} />
              <span>
                {t('autosaveFailed')}: {saveError}
              </span>
              <button
                type="button"
                className="management-retry"
                onClick={() => {
                  setSaveError('');
                  saveLabels();
                }}
              >
                <RotateCcw size={14} />
                {t('retrySave')}
              </button>
            </div>
          )}

          <div className="note-section">
            <h3>{t('noteHistory')}</h3>
            <form className="note-form" onSubmit={addNote}>
              <textarea
                rows={3}
                maxLength={700}
                aria-label={t('newNote')}
                value={body}
                placeholder={t('newNote')}
                onChange={(event) => setBody(event.target.value)}
              />
              <div className="note-form-actions">
                <select
                  value={category}
                  aria-label={t('noteType')}
                  onChange={(event) => setCategory(event.target.value as NoteCategory)}
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
                <button type="submit" className="game-button blue" disabled={notesBusy || !body.trim()}>
                  <Plus size={15} />
                  {t('addNote')}
                </button>
              </div>
            </form>
            {noteError && (
              <div className="error-strip" role="alert">
                {noteError}
              </div>
            )}
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
                      type="button"
                      className="icon-button danger"
                      title={t('deleteNote')}
                      aria-label={t('deleteNote')}
                      disabled={notesBusy}
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

    </section>
  );
}
