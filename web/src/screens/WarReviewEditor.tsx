import React from 'react';
import './WarReviewEditor.css';
import { AlertTriangle, Plus, Trash2, UserMinus } from 'lucide-react';
import {
  normalizeName,
  shortNumber,
  type OcrPlayer,
  type OcrResponse,
  type Roster,
  type Week,
} from '../api';
import { localizeOcrWarning, useI18n } from '../i18n';
import { SearchSelect } from './SearchSelect';

export type EditableDay = { day: number; points: number; winner: 'ours' | 'opponent' | ''; mvp: string };
export type EditableResult = {
  opponent: string;
  ourScore: string;
  opponentScore: string;
  days: EditableDay[];
};
export interface WarDraft {
  championship?: boolean;
  players: OcrPlayer[];
  result: EditableResult | null;
}
export interface WarSections {
  players: boolean;
  result: boolean;
}
export const emptyRoster: Roster = { previousStart: null, previous: [], all: [] };

const dayPoints = [1, 2, 2, 2, 2, 4] as const;

export function makeResult(parsed: OcrResponse['result']): EditableResult | null {
  if (!parsed) return null;
  return {
    opponent: parsed.opponent,
    ourScore: parsed.ourScore === null ? '' : String(parsed.ourScore),
    opponentScore: parsed.opponentScore === null ? '' : String(parsed.opponentScore),
    days: dayPoints.map((points, index) => {
      const day = index + 1;
      const value = parsed.days.find((entry) => entry.day === day);
      return { day, points, winner: value?.winner ?? '', mvp: value?.mvp ?? '' };
    }),
  };
}

export function draftFromWeek(week: Week): WarDraft {
  return {
    championship: week.championship,
    players: week.players.map((player) => ({
      playerId: player.id,
      position: player.position,
      name: player.name,
      points: player.points,
      source: 0,
    })),
    result: makeResult(
      week.resultImported
        ? {
            opponent: week.opponent ?? '',
            ourScore: week.ourScore,
            opponentScore: week.opponentScore,
            days: week.days,
            warnings: [],
          }
        : null,
    ),
  };
}

export function warSubmission(start: string, draft: WarDraft, sections: WarSections) {
  return {
    start,
    ...(draft.championship !== undefined ? { championship: draft.championship } : {}),
    ...(sections.players
      ? {
          players: draft.players.map((player) => ({
            position: player.position,
            name: player.name.trim(),
            points: player.points,
            playerId: player.playerId ?? null,
          })),
        }
      : {}),
    ...(sections.result && draft.result
      ? {
          result: {
            opponent: draft.result.opponent.trim(),
            ourScore: Number(draft.result.ourScore),
            opponentScore: Number(draft.result.opponentScore),
            days: draft.result.days.map((day) => ({
              day: day.day,
              points: day.points,
              winner: day.winner,
              mvp: day.mvp.trim(),
            })),
          },
        }
      : {}),
  };
}

function similarity(left: string, right: string): number {
  const a = normalizeName(left),
    b = normalizeName(right);
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

function PlayersPanel({
  players,
  onChange,
  roster,
}: {
  players: OcrPlayer[];
  onChange: (players: OcrPlayer[]) => void;
  roster: Roster;
}) {
  const { t } = useI18n();
  const previousIds = new Set(roster.previous.map((player) => player.id));
  const participants = new Set(players.map((player) => player.playerId).filter(Boolean));
  const departures = roster.previous.filter((player) => !participants.has(player.id));

  function update(index: number, patch: Partial<OcrPlayer>) {
    onChange(players.map((player, position) => (position === index ? { ...player, ...patch } : player)));
  }

  function rename(index: number, name: string) {
    const existingId = players[index].playerId;
    const exact = roster.all.find((player) => normalizeName(player.name) === normalizeName(name));
    const alias = roster.aliases?.find((entry) => entry.normalizedName === normalizeName(name));
    // A manual name correction retains the linked identity. Unlinked OCR rows may auto-match.
    update(index, { name, playerId: existingId ?? exact?.id ?? alias?.playerId ?? null });
  }

  function add() {
    onChange([
      ...players,
      {
        position: players.length ? Math.max(...players.map((p) => p.position)) + 1 : 1,
        name: '',
        points: 0,
        source: 0,
        playerId: null,
      },
    ]);
  }

  return (
    <div className="war-editor-panel">
      <div className="war-editor-toolbar">
        <strong>
          {t('players')} · {players.length}
        </strong>
        <button type="button" className="game-button secondary compact-add" onClick={add}>
          <Plus size={15} /> {t('addRow')}
        </button>
      </div>
      <div className="war-editor-players">
        {players.map((player, index) => {
          const isNew = !player.playerId;
          const isReturning = !!player.playerId && !previousIds.has(player.playerId);
          const near = !player.playerId
            ? roster.all
                .map((p) => ({ ...p, distance: similarity(player.name, p.name) }))
                .sort((a, b) => a.distance - b.distance)[0]
            : undefined;
          const suggestion =
            near &&
            near.distance > 0 &&
            near.distance <= Math.max(2, Math.floor(normalizeName(player.name).length * 0.3))
              ? near.name
              : null;
          return (
            <div className="war-editor-player" key={index}>
              <div className="war-editor-player-fields">
                <input
                  aria-label={t('rank')}
                  title={t('rank')}
                  type="number"
                  min="1"
                  max="100"
                  value={player.position}
                  onChange={(e) => update(index, { position: Number(e.target.value) })}
                />
                <input
                  aria-label={t('name')}
                  title={t('name')}
                  value={player.name}
                  placeholder={t('name')}
                  onChange={(e) => rename(index, e.target.value)}
                />
                <input
                  aria-label={t('points')}
                  title={t('points')}
                  type="number"
                  min="0"
                  value={player.points}
                  onChange={(e) => update(index, { points: Number(e.target.value) })}
                />
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={t('removeRow')}
                  onClick={() => onChange(players.filter((_, i) => i !== index))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="war-editor-player-meta">
                {(isNew || isReturning) && (
                  <span className={'tag ' + (isNew ? 'new-player' : 'success')}>
                    {t(isNew ? 'new' : 'returning')}
                  </span>
                )}
                <SearchSelect
                  ariaLabel={t('pickExisting')}
                  placeholder={t('pickExisting')}
                  value={player.playerId ?? null}
                  choices={[
                    { value: null, label: t('newPlayer') },
                    ...roster.all.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  onChange={(id) => {
                    const match = roster.all.find((p) => p.id === id);
                    update(index, { playerId: id, name: match?.name ?? player.name });
                  }}
                />
                <span className="war-editor-short-score">{shortNumber(player.points)}</span>
                {suggestion && (
                  <span className="warning-text tiny">{t('possibleMatch', { name: suggestion })}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!!departures.length && (
        <div className="war-editor-departures">
          <UserMinus size={15} /> {t('markedLeft', { count: departures.length })}:
          <span>{departures.map((p) => p.name).join(', ')}</span>
        </div>
      )}
    </div>
  );
}

function ResultPanel({
  result,
  onChange,
  clanName,
}: {
  result: EditableResult;
  onChange: (result: EditableResult) => void;
  clanName: string;
}) {
  const { t } = useI18n();
  const score = (winner: 'ours' | 'opponent') =>
    result.days.filter((day) => day.winner === winner).reduce((sum, day) => sum + day.points, 0);
  function updateDay(day: number, patch: Partial<EditableDay>) {
    onChange({
      ...result,
      days: result.days.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)),
    });
  }
  return (
    <div className="war-editor-panel">
      <div className="war-editor-result-fields">
        <label>
          {t('opponent')}
          <input
            value={result.opponent}
            onChange={(e) => onChange({ ...result, opponent: e.target.value })}
          />
        </label>
        <label>
          {clanName}
          <input
            type="number"
            min="0"
            max="13"
            value={result.ourScore}
            onChange={(e) => onChange({ ...result, ourScore: e.target.value })}
          />
        </label>
        <label>
          {t('opponent')}
          <input
            type="number"
            min="0"
            max="13"
            value={result.opponentScore}
            onChange={(e) => onChange({ ...result, opponentScore: e.target.value })}
          />
        </label>
      </div>
      <div className="war-editor-days">
        {result.days.map((day) => (
          <div className="war-editor-day" key={day.day}>
            <span>
              {t('day')} {day.day}{' '}
              <small>
                · {day.points} {t('pts')}
              </small>
            </span>
            <select
              aria-label={t('winner')}
              title={t('winner')}
              value={day.winner}
              onChange={(e) => updateDay(day.day, { winner: e.target.value as EditableDay['winner'] })}
            >
              <option value="">{t('selectWinner')}</option>
              <option value="ours">{clanName}</option>
              <option value="opponent">{result.opponent || t('opponent')}</option>
            </select>
            <input
              aria-label="MVP"
              placeholder="MVP"
              value={day.mvp}
              onChange={(e) => updateDay(day.day, { mvp: e.target.value })}
            />
          </div>
        ))}
      </div>
      <p className="tiny muted war-editor-totals">
        {t('calculatedFromDays')}: {score('ours')} : {score('opponent')}
      </p>
    </div>
  );
}

export function WarReviewEditor({
  draft,
  onChange,
  sections,
  roster,
  clanName,
  warnings = [],
}: {
  draft: WarDraft;
  onChange: (draft: WarDraft) => void;
  sections: WarSections;
  roster: Roster;
  clanName: string;
  warnings?: string[];
}) {
  const { locale, t } = useI18n();
  const [tab, setTab] = React.useState<'players' | 'result'>(sections.players ? 'players' : 'result');

  return (
    <div className="war-review-editor">
      {warnings.length > 0 && (
        <div className="war-editor-warnings">
          <AlertTriangle size={15} />
          <div>
            {warnings.map((warning, index) => (
              <p key={index}>{localizeOcrWarning(warning, locale)}</p>
            ))}
          </div>
        </div>
      )}
      {sections.players && sections.result && (
        <div className="war-editor-tabs">
          <button
            type="button"
            className={tab === 'players' ? 'selected' : ''}
            onClick={() => setTab('players')}
          >
            {t('players')} · {draft.players.length}
          </button>
          <button
            type="button"
            className={tab === 'result' ? 'selected' : ''}
            onClick={() => setTab('result')}
          >
            {t('finalResult')}
          </button>
        </div>
      )}
      {sections.players && tab === 'players' && (
        <PlayersPanel
          players={draft.players}
          onChange={(players) => onChange({ ...draft, players })}
          roster={roster}
        />
      )}
      {sections.result && tab === 'result' && draft.result && (
        <ResultPanel
          result={draft.result}
          onChange={(result) => onChange({ ...draft, result })}
          clanName={clanName}
        />
      )}
    </div>
  );
}
