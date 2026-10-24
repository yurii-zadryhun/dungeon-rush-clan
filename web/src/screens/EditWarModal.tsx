import React from 'react';
import { Pencil, Save, X } from 'lucide-react';
import { api, json, type Dashboard, type Roster, type Week } from '../api';
import { useI18n } from '../i18n';
import {
  WarReviewEditor, draftFromWeek, emptyRoster, warSubmission,
  type WarDraft, type WarSections,
} from './WarReviewEditor';

export function EditWarModal({ week, clanName, onClose, onDone }: {
  week: Week;
  clanName: string;
  onClose: () => void;
  onDone: (dashboard: Dashboard, updatedWeek: Week) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = React.useState<WarDraft>(() => draftFromWeek(week));
  const [roster, setRoster] = React.useState<Roster>(emptyRoster);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const sections: WarSections = { players: week.rankingImported, result: week.resultImported };

  React.useEffect(() => {
    let alive = true;
    api<Roster>('import/roster?start=' + encodeURIComponent(week.start))
      .then(value => { if (alive) setRoster(value); })
      .catch(failure => { if (alive) setError((failure as Error).message); });
    return () => { alive = false; };
  }, [week.start]);

  async function save() {
    if (sections.players && !draft.players.length) { setError(t('playersRequired')); return; }
    if (sections.result && (!draft.result || draft.result.days.some(day => !day.winner || !day.mvp.trim()))) {
      setError(t('allDaysRequired')); return;
    }
    setBusy(true);
    setError('');
    try {
      const dashboard = await api<Dashboard>('import/war',
        json('PATCH', warSubmission(week.start, draft, sections)));
      // Read the saved row to obtain canonical names and database-generated player IDs.
      const latest = await api<Dashboard>('dashboard?anchor=' + encodeURIComponent(week.start) + '&count=1');
      const updated = latest.weeks.find(candidate => candidate.start === week.start);
      if (!updated) throw new Error(t('serverError'));
      onDone(dashboard, updated);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="panel modal import-modal war-editor-dialog" role="dialog" aria-modal="true"
        aria-label={t('editWar')}>
        <header className="modal-header">
          <h2><Pencil size={20} /> {t('editWar')} · {week.label}</h2>
          <button className="close-button" aria-label={t('close')} onClick={onClose}><X /></button>
        </header>
        <div className="war-editor-scroll">
          <WarReviewEditor draft={draft} onChange={setDraft} sections={sections}
            roster={roster} clanName={clanName} />
        </div>
        {error && <div className="error-strip" role="alert">{error}</div>}
        <footer className="modal-actions">
          <button className="game-button secondary" onClick={onClose}>{t('cancel')}</button>
          <button className="game-button blue" disabled={busy} onClick={() => void save()}>
            <Save size={16} /> {busy ? t('pleaseWait') : t('save')}
          </button>
        </footer>
      </section>
    </div>
  );
}
