import React from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Plus,
  ScanLine,
  Trash2,
  UploadCloud,
  UserMinus,
  X,
} from 'lucide-react';
import {
  api,
  json,
  normalizeName,
  type Dashboard,
  type OcrPlayer,
  type OcrResponse,
  type Roster,
  type Week,
} from '../api';
import { useI18n, localizeOcrWarning } from '../i18n';

type EditableDay = { day: number; points: number; winner: 'ours' | 'opponent' | ''; mvp: string };
type EditableResult = { opponent: string; ourScore: string; opponentScore: string; days: EditableDay[] };
type Stage = 'upload' | 'review';

const dayPoints = [1, 2, 2, 2, 2, 4] as const;
const emptyRoster: Roster = { previousStart: null, previous: [], all: [] };

function makeResult(parsed: OcrResponse['result']): EditableResult | null {
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

function distance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let x = 1; x <= left.length; x++) {
    let diagonal = previous[0];
    previous[0] = x;
    for (let y = 1; y <= right.length; y++) {
      const upper = previous[y];
      previous[y] = Math.min(
        previous[y] + 1,
        previous[y - 1] + 1,
        diagonal + (left[x - 1] === right[y - 1] ? 0 : 1),
      );
      diagonal = upper;
    }
  }
  return previous[right.length];
}

function closestPlayer(name: string, existing: Roster['all']): string {
  const normalized = normalizeName(name);
  const matches = existing
    .map((player) => ({
      name: player.name,
      distance: distance(normalized, normalizeName(player.name)),
    }))
    .sort((left, right) => left.distance - right.distance);
  const first = matches[0];
  if (
    !first ||
    first.distance === 0 ||
    first.distance > Math.max(2, Math.floor(normalized.length * 0.3))
  ) {
    return '';
  }
  return first.name;
}

function FileChooser({
  label,
  hint,
  selected,
  multiple,
  onSelect,
}: {
  label: string;
  hint: string;
  selected: string;
  multiple: boolean;
  onSelect: (files: File[]) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="file-drop">
      <ScanLine size={28} />
      <strong>{label}</strong>
      <span>{hint}</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple={multiple}
        onChange={(event) => onSelect(Array.from(event.target.files ?? []))}
      />
      <b>{selected || t(multiple ? 'chooseImages' : 'chooseResult')}</b>
    </label>
  );
}

function UploadStep({
  week,
  rankingImages,
  resultImage,
  onRanking,
  onResult,
}: {
  week: Week;
  rankingImages: File[];
  resultImage: File | null;
  onRanking: (files: File[]) => void;
  onResult: (file: File | null) => void;
}) {
  const { t } = useI18n();
  const canRanking = week.permissions.ranking && !week.rankingImported;
  const canResult = week.permissions.result && !week.resultImported;
  return (
    <div className="modal-content">
      {canRanking && (
        <FileChooser
          label={t('leaderboardImages')}
          hint={t('imageLimit')}
          multiple
          selected={rankingImages.length ? t('chosenImages', { count: rankingImages.length }) : ''}
          onSelect={onRanking}
        />
      )}
      {canResult && (
        <FileChooser
          label={t('resultImage')}
          hint=""
          multiple={false}
          selected={resultImage?.name ?? ''}
          onSelect={(files) => onResult(files[0] ?? null)}
        />
      )}
    </div>
  );
}

function PlayersReview({
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
  const participatingIds = new Set(players.map((player) => player.playerId).filter(Boolean));
  const departing = roster.previous.filter((player) => !participatingIds.has(player.id));

  function update(index: number, patch: Partial<OcrPlayer>) {
    onChange(players.map((player, position) => (position === index ? { ...player, ...patch } : player)));
  }
  function addPlayer() {
    const position = players.length ? Math.max(...players.map((player) => player.position)) + 1 : 1;
    onChange([...players, { position, name: '', points: 0, source: 0, playerId: null }]);
  }

  return (
    <>
      <div className="review-head">
        <h3>
          {t('players')} ({players.length})
        </h3>
        <button className="game-button secondary" onClick={addPlayer}>
          <Plus size={14} /> {t('addRow')}
        </button>
      </div>
      <div className="review-list">
        {players.map((player, index) => {
          const isNew = !player.playerId || !previousIds.has(player.playerId);
          const suggestion = !player.playerId ? closestPlayer(player.name, roster.all) : '';
          return (
            <div className="review-player" key={index}>
              <div className="review-player-fields">
                <label>
                  {t('rank')}
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={player.position}
                    onChange={(event) => update(index, { position: Number(event.target.value) })}
                  />
                </label>
                <label>
                  {t('name')}
                  <input
                    value={player.name}
                    onChange={(event) => {
                      const name = event.target.value;
                      const found = roster.all.find(
                        (existing) => normalizeName(existing.name) === normalizeName(name),
                      );
                      update(index, { name, playerId: found?.id ?? null });
                    }}
                  />
                </label>
                <label>
                  {t('points')}
                  <input
                    type="number"
                    min="0"
                    value={player.points}
                    onChange={(event) => update(index, { points: Number(event.target.value) })}
                  />
                </label>
                <button
                  className="icon-button danger"
                  aria-label={t('removeRow')}
                  onClick={() => onChange(players.filter((_, position) => position !== index))}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="match-row">
                <span className={'tag ' + (isNew ? 'warning' : 'success')}>
                  {t(isNew ? 'new' : 'returning')}
                </span>
                <select
                  aria-label={t('pickExisting')}
                  value={player.playerId ?? ''}
                  onChange={(event) =>
                    update(index, { playerId: event.target.value ? Number(event.target.value) : null })
                  }
                >
                  <option value="">{t('newPlayer')}</option>
                  {roster.all.map((existing) => (
                    <option value={existing.id} key={existing.id}>
                      {existing.name}
                    </option>
                  ))}
                </select>
                {suggestion && (
                  <span className="tiny warning-text">{t('possibleMatch', { name: suggestion })}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {departing.length > 0 && (
        <div className="warning-list left-list">
          <strong>
            <UserMinus size={16} /> {t('markedLeft', { count: departing.length })}
          </strong>
          <p>{departing.map((player) => player.name).join(', ')}</p>
        </div>
      )}
    </>
  );
}

function ResultReview({
  result,
  clanName,
  onChange,
}: {
  result: EditableResult;
  clanName: string;
  onChange: (value: EditableResult) => void;
}) {
  const { t } = useI18n();
  function updateDay(day: number, patch: Partial<EditableDay>) {
    onChange({
      ...result,
      days: result.days.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)),
    });
  }
  const ours = result.days
    .filter((day) => day.winner === 'ours')
    .reduce((sum, day) => sum + day.points, 0);
  const theirs = result.days
    .filter((day) => day.winner === 'opponent')
    .reduce((sum, day) => sum + day.points, 0);
  return (
    <div className="war-result-review">
      <h3>{t('finalResult')}</h3>
      <div className="result-fields">
        <label>
          {t('opponent')}
          <input
            value={result.opponent}
            onChange={(event) => onChange({ ...result, opponent: event.target.value })}
          />
        </label>
        <label>
          {t('clanScore', { name: clanName })}
          <input
            type="number"
            min="0"
            max="13"
            value={result.ourScore}
            onChange={(event) => onChange({ ...result, ourScore: event.target.value })}
          />
        </label>
        <label>
          {t('opponentsScore')}
          <input
            type="number"
            min="0"
            max="13"
            value={result.opponentScore}
            onChange={(event) => onChange({ ...result, opponentScore: event.target.value })}
          />
        </label>
      </div>
      <div className="review-days">
        {result.days.map((day) => (
          <div className="review-day" key={day.day}>
            <span>
              {t('day')} {day.day}{' '}
              <b>
                {day.points} {t('daySuffix')}
              </b>
            </span>
            <label>
              {t('winner')}
              <select
                value={day.winner}
                onChange={(event) =>
                  updateDay(day.day, { winner: event.target.value as EditableDay['winner'] })
                }
              >
                <option value="">{t('selectWinner')}</option>
                <option value="ours">{clanName}</option>
                <option value="opponent">{result.opponent || t('opponent')}</option>
              </select>
            </label>
            <label>
              MVP
              <input
                value={day.mvp}
                onChange={(event) => updateDay(day.day, { mvp: event.target.value })}
              />
            </label>
          </div>
        ))}
      </div>
      <p className="tiny muted">
        {t('calculatedFromDays')}: {ours} : {theirs}
      </p>
    </div>
  );
}

export function ImportModal({
  week,
  clanName,
  onClose,
  onDone,
}: {
  week: Week;
  clanName: string;
  onClose: () => void;
  onDone: (data: Dashboard) => void;
}) {
  const { t, locale } = useI18n();
  const [rankingImages, setRankingImages] = React.useState<File[]>([]);
  const [resultImage, setResultImage] = React.useState<File | null>(null);
  const [stage, setStage] = React.useState<Stage>('upload');
  const [players, setPlayers] = React.useState<OcrPlayer[]>([]);
  const [result, setResult] = React.useState<EditableResult | null>(null);
  const [roster, setRoster] = React.useState<Roster>(emptyRoster);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function scan() {
    if (!rankingImages.length && !resultImage) {
      setError(t('screenshotsRequired'));
      return;
    }
    if (rankingImages.length > 10) {
      setError(t('screenshotsLimit'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      rankingImages.forEach((file) => form.append('ranking', file));
      if (resultImage) form.append('result', resultImage);
      const [parsed, previous] = await Promise.all([
        api<OcrResponse>('ocr', { method: 'POST', body: form }),
        api<Roster>('import/roster?start=' + encodeURIComponent(week.start)),
      ]);
      setRoster(previous);
      setWarnings(parsed.warnings);
      setPlayers(
        parsed.players.map((player) => ({
          ...player,
          playerId:
            previous.all.find((existing) => normalizeName(existing.name) === normalizeName(player.name))
              ?.id ?? null,
        })),
      );
      setResult(makeResult(parsed.result));
      setStage('review');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      if (rankingImages.length && !players.length) throw new Error(t('playersRequired'));
      if (resultImage && result?.days.some((day) => !day.winner || !day.mvp.trim())) {
        throw new Error(t('allDaysRequired'));
      }
      const submission: {
        start: string;
        players?: Array<{ position: number; name: string; points: number; playerId: number | null }>;
        result?: {
          opponent: string;
          ourScore: number;
          opponentScore: number;
          days: Array<{ day: number; points: number; winner: string; mvp: string }>;
        };
      } = { start: week.start };
      if (rankingImages.length) {
        submission.players = players.map((player) => ({
          position: player.position,
          name: player.name.trim(),
          points: player.points,
          playerId: player.playerId ?? null,
        }));
      }
      if (resultImage && result) {
        submission.result = {
          opponent: result.opponent.trim(),
          ourScore: Number(result.ourScore),
          opponentScore: Number(result.opponentScore),
          days: result.days.map((day) => ({
            day: day.day,
            points: day.points,
            winner: day.winner,
            mvp: day.mvp.trim(),
          })),
        };
      }
      const updated = await api<Dashboard>('import/confirm', json('POST', submission));
      onDone(updated);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function back() {
    if (stage === 'review') setStage('upload');
    else onClose();
  }

  const action = stage === 'upload' ? scan : confirm;
  const actionLabel = stage === 'upload' ? t('scan') : t('confirmImport');

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t('importWar')}
        className="panel modal import-modal"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">
              <UploadCloud size={16} /> {t('importWar')}
            </span>
            <h2>{week.label}</h2>
          </div>
          <button aria-label={t('close')} className="close-button" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="stepper">
          <span className="step active">1 · {t('upload')}</span>
          <span className={'step ' + (stage === 'review' ? 'active' : '')}>2 · {t('review')}</span>
          <span className="step">3 · {t('confirm')}</span>
        </div>
        {stage === 'upload' && (
          <UploadStep
            week={week}
            rankingImages={rankingImages}
            resultImage={resultImage}
            onRanking={setRankingImages}
            onResult={setResultImage}
          />
        )}
        {stage === 'review' && (
          <div className="modal-content">
            {warnings.length > 0 && (
              <div className="warning-list">
                <strong>
                  <AlertTriangle size={17} /> {t('ocrNeedsReview')}
                </strong>
                {warnings.map((warning, index) => (
                  <p key={index}>{localizeOcrWarning(warning, locale)}</p>
                ))}
              </div>
            )}
            {rankingImages.length > 0 && (
              <PlayersReview players={players} onChange={setPlayers} roster={roster} />
            )}
            {resultImage && result && (
              <ResultReview result={result} clanName={clanName} onChange={setResult} />
            )}
          </div>
        )}
        {error && (
          <div className="error-strip" role="alert">
            {error}
          </div>
        )}
        <footer className="modal-actions">
          <button className="game-button secondary" onClick={back}>
            {stage === 'upload' ? t('cancel') : t('back')}
          </button>
          <button className="game-button blue" disabled={busy} onClick={action}>
            {busy ? (
              t('pleaseWait')
            ) : (
              <>
                <CheckCircle size={17} /> {actionLabel}
              </>
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}
