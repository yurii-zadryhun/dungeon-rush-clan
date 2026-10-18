import React from 'react';
import { AlertTriangle, CheckCircle, Plus, ScanLine, Trash2, UploadCloud, UserMinus, UserPlus, X } from 'lucide-react';
import { api, Dashboard, json, normalizeName, OcrPlayer, OcrResponse, Roster, Week } from '../api';

type EditableDay = { day: number; points: number; winner: 'ours' | 'opponent' | ''; mvp: string };
type EditableResult = { opponent: string; ourScore: string; opponentScore: string; days: EditableDay[] };
const points = [1, 2, 2, 2, 2, 4];

function fileList(value: FileList | null): File[] {return value ? Array.from(value) : [];}

function nearestName(name: string, options: { id: number; name: string }[]): string {
  const source = normalizeName(name);

  function distance(a: string, b: string) {
    const matrix = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let old = matrix[0];
      matrix[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const previous = matrix[j];
        matrix[j] = Math.min(matrix[j] + 1, matrix[j - 1] + 1, old + (a[i - 1] === b[j - 1] ? 0 : 1));
        old = previous;
      }
    }
    return matrix[b.length];
  }

  const candidate = options.map(p => ({
    name: p.name,
    d: distance(source, normalizeName(p.name))
  })).sort((a, b) => a.d - b.d)[0];
  return candidate && candidate.d > 0 && candidate.d <= Math.max(2, Math.floor(source.length * .3)) ? candidate.name : '';
}

export function ImportModal({ week, clanName, onClose, onDone }: {
  week: Week;
  clanName: string;
  onClose: () => void;
  onDone: (next: Dashboard) => void
}) {
  const [rankingImages, setRankingImages] = React.useState<File[]>([]);
  const [resultImage, setResultImage] = React.useState<File | null>(null);
  const [stage, setStage] = React.useState<'upload' | 'review'>('upload');
  const [players, setPlayers] = React.useState<OcrPlayer[]>([]);
  const [result, setResult] = React.useState<EditableResult | null>(null);
  const [roster, setRoster] = React.useState<Roster>({ previousStart: null, previous: [], all: [] });
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const canRanking = week.permissions.ranking && !week.rankingImported;
  const canResult = week.permissions.result && !week.resultImported;
  const previousIds = new Set(roster.previous.map(p => p.id));
  const existingIds = new Set(players.map(p => p.playerId).filter(Boolean));
  const departed = roster.previous.filter(p => !existingIds.has(p.id));

  function changePlayer(index: number, patch: Partial<OcrPlayer>) {setPlayers(old => old.map((p, i) => i === index ? { ...p, ...patch } : p));}

  function changeDay(day: number, patch: Partial<EditableDay>) {
    setResult(old => old ? { ...old, days: old.days.map(d => d.day === day ? { ...d, ...patch } : d) } : old);
  }

  async function scan() {
    if (!rankingImages.length && !resultImage) {
      setError('Select at least one screenshot.');
      return;
    }
    if (rankingImages.length > 10) {
      setError('Maximum 10 ranking screenshots.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const form = new FormData();
      rankingImages.forEach(f => form.append('ranking', f));
      if (resultImage) form.append('result', resultImage);
      const [ocr, previous] = await Promise.all([
        api<OcrResponse>('ocr', { method: 'POST', body: form }),
        api<Roster>('import/roster?start=' + encodeURIComponent(week.start))
      ]);
      setRoster(previous);
      setWarnings(ocr.warnings);
      setPlayers(ocr.players.map(p => ({
        ...p,
        playerId: previous.all.find(x => normalizeName(x.name) === normalizeName(p.name))?.id ?? null
      })));
      setResult(ocr.result ? {
        opponent: ocr.result.opponent, ourScore: ocr.result.ourScore === null ? '' : String(ocr.result.ourScore),
        opponentScore: ocr.result.opponentScore === null ? '' : String(ocr.result.opponentScore),
        days: points.map((point, i) => {
          const parsed = ocr.result!.days.find(d => d.day === i + 1);
          return { day: i + 1, points: point, winner: parsed?.winner || '', mvp: parsed?.mvp || '' };
        })
      } : null);
      setStage('review');
    } catch (e) {setError((e as Error).message);} finally {setLoading(false);}
  }

  async function confirm() {
    setLoading(true);
    setError('');
    try {
      const payload: any = { start: week.start };
      if (rankingImages.length) payload.players = players.map(p => ({
        position: Number(p.position),
        name: p.name.trim(),
        points: Number(p.points),
        playerId: p.playerId ?? null
      }));
      if (resultImage && result) payload.result = {
        opponent: result.opponent.trim(),
        ourScore: Number(result.ourScore), opponentScore: Number(result.opponentScore),
        days: result.days.map(d => ({ day: d.day, points: d.points, winner: d.winner, mvp: d.mvp.trim() }))
      };
      if (rankingImages.length && !players.length) throw new Error('Add at least one player before confirming.');
      if (resultImage && result && result.days.some(d => !d.winner || !d.mvp.trim())) throw new Error('All six days need a winner and MVP.');
      onDone(await api<Dashboard>('import/confirm', json('POST', payload)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return <div className="modal-backdrop" role="presentation"
              onMouseDown={e => {if (e.target === e.currentTarget) onClose();}}>
    <section role="dialog" aria-modal="true" aria-label="Import war" className="panel modal import-modal">
      <header className="modal-header">
        <div><span className="eyebrow"><UploadCloud size={16}/> WAR IMPORT</span>
          <h2>{week.label} <span className="muted tiny">UTC</span></h2></div>
        <button className="close-button" onClick={onClose} aria-label="Close"><X/></button>
      </header>
      <div className="stepper"><span className="step active">1 · Upload</span><span
        className={'step ' + (stage === 'review' ? 'active' : '')}>2 · OCR review</span><span className="step">3 · Confirm</span>
      </div>
      {stage === 'upload' ? <div className="modal-content">
        <p className="muted">Screenshots are analyzed with Google Cloud Vision. Duplicate leaderboard entries will be
          reconciled before saving.</p>
        {canRanking && <label className="file-drop"><ScanLine/><strong>Weekly leaderboard screenshots</strong>
            <span>Up to 10 images · PNG, JPG, WebP</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple
                   onChange={e => setRankingImages(fileList(e.target.files))}/>
            <b>{rankingImages.length ? rankingImages.length + ' images selected' : 'Select screenshots'}</b>
          {rankingImages.length > 0 &&
              <small className="file-names">{rankingImages.map(f => f.name).join(', ')}</small>}
        </label>}
        {canResult && <label className="file-drop"><SwordsIcon/><strong>Final war result</strong>
            <span>Day 6 must be finished · Monday 00:00 UTC or later</span>
            <input type="file" accept="image/png,image/jpeg,image/webp"
                   onChange={e => setResultImage(e.target.files?.[0] || null)}/>
            <b>{resultImage ? resultImage.name : 'Select result screenshot'}</b>
        </label>}
        {!canResult && !week.resultImported &&
            <div className="info-strip">Final result can be imported from Monday 00:00 UTC.</div>}
      </div> : <div className="modal-content">
        {warnings.length > 0 &&
            <div className="warning-list"><strong><AlertTriangle size={17}/> OCR needs review</strong>
              {warnings.map((w, i) => <p key={i}>{w}</p>)}</div>}
        {rankingImages.length > 0 && <>
            <div className="review-head"><h3>Leaderboard ({players.length})</h3>
                <button className="game-button secondary" onClick={() => setPlayers(old => [...old, {
                  position: old.length ? Math.max(...old.map(p => p.position)) + 1 : 1,
                  name: '',
                  points: 0,
                  source: 0,
                  playerId: null
                }])}><Plus size={14}/> Add row
                </button>
            </div>
            <p className="tiny muted">NEW means not present in the last earlier imported war. Choose an existing account
                for OCR name errors. LEFT members are marked only after confirmation.</p>
            <div className="review-list">
              {players.map((p, index) => {
                const added = !p.playerId || !previousIds.has(p.playerId);
                const suggestion = !p.playerId ? nearestName(p.name, roster.all) : '';
                return <div className="review-player" key={index}>
                  <div className="review-player-fields">
                    <label>Rank<input type="number" min="1" max="100" value={p.position}
                                      onChange={e => changePlayer(index, { position: Number(e.target.value) })}/></label>
                    <label>Name<input value={p.name} onChange={e => changePlayer(index, {
                      name: e.target.value,
                      playerId: roster.all.find(x => normalizeName(x.name) === normalizeName(e.target.value))?.id ?? null
                    })}/></label>
                    <label>Points<input type="number" min="0" value={p.points}
                                        onChange={e => changePlayer(index, { points: Number(e.target.value) })}/></label>
                    <button aria-label="Remove row" className="icon-button danger"
                            onClick={() => setPlayers(old => old.filter((_, i) => i !== index))}><Trash2 size={17}/>
                    </button>
                  </div>
                  <div className="match-row"><span
                    className={'tag ' + (added ? 'warning' : 'success')}>{added ? 'NEW' : 'RETURNING'}</span>
                    <select value={p.playerId || ''}
                            onChange={e => changePlayer(index, { playerId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">New player</option>
                      {roster.all.map(existing => <option key={existing.id}
                                                          value={existing.id}>{existing.name}</option>)}
                    </select>
                    {suggestion && <span className="tiny warning-text">Possible match: {suggestion}</span>}
                  </div>
                </div>;
              })}
            </div>
          {departed.length > 0 &&
              <div className="warning-list left-list"><strong><UserMinus size={16}/> Will be marked LEFT
                  ({departed.length})</strong><p>{departed.map(p => p.name).join(', ')}</p></div>}
          {players.filter(p => !p.playerId || !previousIds.has(p.playerId)).length > 0 &&
              <div className="info-strip"><UserPlus size={15}/> Newcomers can be corrected using the player selector
                  above.</div>}
        </>}
        {resultImage && result && <div className="war-result-review">
            <h3>Final result</h3>
            <div className="result-fields"><label>Opponent<input value={result.opponent} onChange={e => setResult({
              ...result,
              opponent: e.target.value
            })}/></label>
                <label>{clanName} score<input type="number" min="0" max="13" value={result.ourScore}
                                              onChange={e => setResult({
                                                ...result,
                                                ourScore: e.target.value
                                              })}/></label>
                <label>Opponent score<input type="number" min="0" max="13" value={result.opponentScore}
                                            onChange={e => setResult({
                                              ...result,
                                              opponentScore: e.target.value
                                            })}/></label></div>
            <div className="review-days">{result.days.map(d => <div className="review-day" key={d.day}>
              <span>Day {d.day} <b>{d.points} pts</b></span>
              <label>Winner<select value={d.winner}
                                   onChange={e => changeDay(d.day, { winner: e.target.value as EditableDay['winner'] })}>
                <option value="">Choose...</option>
                <option value="ours">{clanName}</option>
                <option value="opponent">{result.opponent || 'Opponent'}</option>
              </select></label>
              <label>MVP<input value={d.mvp} onChange={e => changeDay(d.day, { mvp: e.target.value })}/></label>
            </div>)}</div>
            <p className="tiny muted">Calculated from
                days: {result.days.filter(d => d.winner === 'ours').reduce((s, d) => s + d.points, 0)} : {result.days.filter(d => d.winner === 'opponent').reduce((s, d) => s + d.points, 0)} (13
                total points).</p>
        </div>}
      </div>}
      {error && <div className="error-strip" role="alert">{error}</div>}
      <footer className="modal-actions">
        <button className="game-button secondary"
                onClick={stage === 'review' ? () => setStage('upload') : onClose}>{stage === 'review' ? 'Back' : 'Cancel'}</button>
        <button className="game-button blue" disabled={loading} onClick={stage === 'upload' ? scan : confirm}>
          {loading ? 'Please wait...' : stage === 'upload' ? <><ScanLine size={17}/> Run OCR</> : <><CheckCircle
            size={17}/> Confirm import</>}
        </button>
      </footer>
    </section>
  </div>;
}

function SwordsIcon() {return <span className="file-icon">⚔</span>;}
