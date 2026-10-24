import React from 'react';
import { GitMerge, ShieldAlert } from 'lucide-react';
import { api, json, type Dashboard } from '../api';
import { useI18n } from '../i18n';
import { SearchSelect } from './SearchSelect';
import './MergePlayers.css';

interface PlayerIdentity {
  id: number;
  name: string;
  active: boolean;
  hasAccount: boolean;
  weeks: string[];
}

export function MergePlayers({ onMerged }: { onMerged: (dashboard: Dashboard) => void }) {
  const { t } = useI18n();
  const [players, setPlayers] = React.useState<PlayerIdentity[]>([]);
  const [from, setFrom] = React.useState<number | null>(null);
  const [into, setInto] = React.useState<number | null>(null);
  const [overlap, setOverlap] = React.useState<'keepTarget' | 'keepSource'>('keepTarget');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState('');

  const load = React.useCallback(async () => {
    setPlayers(await api<PlayerIdentity[]>('players'));
  }, []);

  React.useEffect(() => {
    void load().catch((error) => setError((error as Error).message));
  }, [load]);

  const source = players.find((player) => player.id === from);
  const target = players.find((player) => player.id === into);
  const conflicts = source && target ? source.weeks.filter((week) => target.weeks.includes(week)) : [];
  const choices = players.map((player) => ({
    value: player.id,
    label: player.name,
    hint: t('warsCount', { count: player.weeks.length }),
  }));

  async function merge() {
    if (!source || !target || source.id === target.id) return;
    if (!window.confirm(t('mergeConfirm', { old: source.name, correct: target.name }))) return;
    setBusy(true);
    setError('');
    setDone('');
    try {
      const dashboard = await api<Dashboard>(
        'players/merge',
        json('POST', { sourceId: source.id, targetId: target.id, overlap }),
      );
      onMerged(dashboard);
      setFrom(null);
      setInto(null);
      await load();
      setDone(t('mergeComplete'));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel access-panel player-merge-panel">
      <h2>
        <GitMerge size={19} /> {t('mergePlayers')}
      </h2>
      <p className="muted tiny">{t('mergeHelp')}</p>
      <div className="merge-fields">
        <label>
          {t('incorrectPlayer')}
          <SearchSelect
            ariaLabel={t('incorrectPlayer')}
            value={from}
            choices={choices.filter((player) => player.value !== into)}
            placeholder={t('selectPlayer')}
            onChange={setFrom}
          />
        </label>
        <label>
          {t('correctPlayer')}
          <SearchSelect
            ariaLabel={t('correctPlayer')}
            value={into}
            choices={choices.filter((player) => player.value !== from)}
            placeholder={t('selectPlayer')}
            onChange={setInto}
          />
        </label>
      </div>
      {source && target && (
        <div className="merge-preview">
          <span>
            {t('warsCount', { count: source.weeks.length })} → {target.name}
          </span>
          {!!conflicts.length && (
            <div className="merge-overlap">
              <ShieldAlert size={16} />
              <span>{t('mergeOverlap', { count: conflicts.length })}</span>
              <select
                aria-label={t('mergeConflictChoice')}
                value={overlap}
                onChange={(event) => setOverlap(event.target.value as 'keepTarget' | 'keepSource')}
              >
                <option value="keepTarget">{t('keepCorrectScores')}</option>
                <option value="keepSource">{t('keepIncorrectScores')}</option>
              </select>
            </div>
          )}
          {source.hasAccount && target.hasAccount && (
            <p className="warning-text">{t('mergeAccountWarning')}</p>
          )}
        </div>
      )}
      {error && (
        <p className="error-strip" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="tiny merge-success" role="status">
          {done}
        </p>
      )}
      <button
        className="game-button blue"
        type="button"
        disabled={
          busy || !source || !target || from === into || (source.hasAccount && target.hasAccount)
        }
        onClick={() => void merge()}
      >
        <GitMerge size={16} /> {busy ? t('pleaseWait') : t('mergePlayers')}
      </button>
    </section>
  );
}
