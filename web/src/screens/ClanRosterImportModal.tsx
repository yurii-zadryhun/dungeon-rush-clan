import React from 'react';
import { ArrowDown, ArrowUp, Camera, CheckCircle, Plus, Trash2, UploadCloud, X } from 'lucide-react';
import {
  api,
  json,
  normalizeName,
  type ClanOcrResponse,
  type ClanRosterCandidates,
  type ClanRosterSnapshot,
  type Dashboard,
} from '../api';
import { useI18n } from '../i18n';
import { prepareScreenshots } from './image-prep';
import { SearchSelect } from './SearchSelect';
import './ClanRosterImportModal.css';

interface DraftEntry {
  key: number;
  name: string;
  powerText: string;
  playerId: number | null;
  source: number;
}
let nextKey = 1;

function magnitude(input: string) {
  const match = input.trim().replace(/\s+/g, '').match(/^(\d{1,5}(?:[.,]\d{1,4})?)([KMBTqQ])$/);
  const factors: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, q: 1e15, Q: 1e18 };
  return match ? Number(match[1].replace(',', '.')) * factors[match[2]] : null;
}
function powerLabel(value: number) {
  for (const [name, factor] of [['Q', 1e18], ['q', 1e15], ['T', 1e12], ['B', 1e9], ['M', 1e6], ['K', 1e3]] as const) {
    if (value >= factor) return (value / factor).toFixed(2).replace(/\.?0+$/, '') + name;
  }
  return String(Math.round(value));
}

function captureLocalTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function ClanRosterImportModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (dashboard: Dashboard) => void;
}) {
  const { t } = useI18n();
  const [files, setFiles] = React.useState<File[]>([]);
  const [stage, setStage] = React.useState<'upload' | 'review'>('upload');
  const [capturedLocal, setCapturedLocal] = React.useState(captureLocalTime);
  const [rows, setRows] = React.useState<DraftEntry[]>([]);
  const [expected, setExpected] = React.useState('');
  const [reportedPower, setReportedPower] = React.useState('');
  const [capacity, setCapacity] = React.useState<number | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [candidates, setCandidates] = React.useState<ClanRosterCandidates | null>(null);
  const [previous, setPrevious] = React.useState<ClanRosterSnapshot | null>(null);
  const [acknowledge, setAcknowledge] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const sum = rows.reduce((total, entry) => total + (magnitude(entry.powerText) ?? 0), 0);
  const expectedPower = reportedPower ? magnitude(reportedPower) : null;
  const percentDifference = expectedPower && expectedPower > 0
    ? (100 * Math.abs(sum - expectedPower)) / expectedPower : null;
  const invalid = rows.filter((entry) =>
    !entry.name.trim() || magnitude(entry.powerText) === null ||
    entry.name.trim().length > 80);
  const duplicated = new Set(rows.map((entry) => normalizeName(entry.name))).size !== rows.length;
  const knownNames = new Set(previous?.entries.map((entry) => normalizeName(entry.name)) ?? []);
  const currentNames = new Set(rows.map((entry) => normalizeName(entry.name)));
  const joined = previous ? rows.filter((entry) => !knownNames.has(normalizeName(entry.name))) : [];
  const left = previous ? previous.entries.filter((entry) => !currentNames.has(normalizeName(entry.name))) : [];
  const differenceHigh = percentDifference !== null && percentDifference > 4;

  function update(key: number, patch: Partial<DraftEntry>) {
    setRows((all) => all.map((row) => row.key === key ? { ...row, ...patch } : row));
    setAcknowledge(false);
  }

  async function scan() {
    if (!files.length || files.length > 10) {
      setError(t('clanChooseScreens'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const [prepared, known, latest] = await Promise.all([
        prepareScreenshots(files, 'clan'),
        api<ClanRosterCandidates>('clan-roster/candidates'),
        api<ClanRosterSnapshot | null>('clan-roster/latest'),
      ]);
      const form = new FormData();
      form.append('headerHeight', String(prepared.headerHeight));
      prepared.parts.forEach((blob, i) => form.append('mosaic', blob, 'members-' + (i + 1) + '.jpg'));
      const result = await api<ClanOcrResponse>('ocr/clan', { method: 'POST', body: form });
      const byName = new Map(known.players.map((person) => [normalizeName(person.name), person.id]));
      for (const alias of known.aliases) byName.set(alias.normalizedName, alias.playerId);
      setCandidates(known);
      setPrevious(latest);
      setRows(result.players.map((player) => ({
        ...player,
        key: nextKey++,
        playerId: byName.get(normalizeName(player.name)) ?? null,
      })));
      setExpected(result.reportedMembers == null ? '' : String(result.reportedMembers));
      setReportedPower(result.reportedPowerText ?? '');
      setCapacity(result.capacity);
      setWarnings(result.warnings);
      setStage('review');
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    const count = Number(expected);
    if (!Number.isSafeInteger(count) || count < 1 || count > 100 || count !== rows.length) {
      setError(t('clanCountMismatch'));
      return;
    }
    if (invalid.length || duplicated || new Set(rows.map((entry) => entry.playerId).filter(Boolean)).size !==
      rows.filter((entry) => entry.playerId).length) {
      setError(t('clanFixRows'));
      return;
    }
    if (differenceHigh && !acknowledge) {
      setError(t('clanPowerMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('clan-roster/confirm', json('POST', {
        capturedAt: new Date(capturedLocal).toISOString(),
        reportedMembers: count,
        reportedPowerText: reportedPower || null,
        screenshotCount: files.length,
        acknowledgePowerMismatch: acknowledge,
        players: rows.map(({ name, powerText, playerId }) => ({ name, powerText, playerId })),
      }));
      const dashboard = await api<Dashboard>('dashboard');
      onDone(dashboard);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="panel modal clan-roster-modal" role="dialog" aria-modal="true"
        aria-label={t('clanImportTitle')}>
        <header className="modal-header">
          <h2><UploadCloud size={20} /> {t('clanImportTitle')}</h2>
          <button className="close-button" aria-label={t('close')} onClick={onClose}><X /></button>
        </header>
        <div className="clan-roster-scroll">
          {stage === 'upload' ? (
            <div className="clan-roster-upload">
              <p className="muted">{t('clanImportHelp')}</p>
              <label className="war-editor-file">
                <Camera size={21} />
                <span><strong>{t('clanSelectScreens')}</strong>
                  <small>{t('clanScreensChosen', { count: files.length })}</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple
                  onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 10))} />
              </label>
              {files.length > 0 && (
                <div className="clan-file-list">
                  {files.map((file, index) => (
                    <div className="clan-file-row" key={file.name + index}>
                      <span><b>{index + 1}.</b> {file.name}</span>
                      <button type="button" aria-label={t('moveUp')} disabled={index === 0}
                        onClick={() => setFiles((items) => {
                          const changed = items.slice();
                          [changed[index - 1], changed[index]] = [changed[index], changed[index - 1]];
                          return changed;
                        })}><ArrowUp size={15} /></button>
                      <button type="button" aria-label={t('moveDown')} disabled={index === files.length - 1}
                        onClick={() => setFiles((items) => {
                          const changed = items.slice();
                          [changed[index], changed[index + 1]] = [changed[index + 1], changed[index]];
                          return changed;
                        })}><ArrowDown size={15} /></button>
                    </div>
                  ))}
                </div>
              )}
              <p className="muted tiny">{t('clanFirstScreenHelp')}</p>
            </div>
          ) : (
            <div className="clan-roster-review">
              <p className="muted">{t('clanReviewHelp')}</p>
              <div className="clan-roster-summary">
                <label>{t('clanCapturedAt')}<input type="datetime-local" value={capturedLocal}
                  onChange={(event) => setCapturedLocal(event.target.value)} /></label>
                <label>{t('clanExpectedCount')}<input inputMode="numeric" type="number" min={1} max={100}
                  value={expected} onChange={(event) => setExpected(event.target.value)} /></label>
                <label>{t('clanHeaderPower')}<input value={reportedPower}
                  placeholder="77.80q" onChange={(event) => { setReportedPower(event.target.value); setAcknowledge(false); }} /></label>
                <div className="clan-summary-figure"><strong>{rows.length}{capacity ? ' / ' + capacity : ''}</strong>
                  <small>{t('clanRecognized')}</small></div>
                <div className="clan-summary-figure"><strong>{powerLabel(sum)}</strong>
                  <small>{t('clanSumPower')}</small></div>
              </div>
              {percentDifference !== null && (
                <p className={'clan-roster-compare' + (differenceHigh ? ' warning' : '')}>
                  {t('clanPowerDifference', { percent: percentDifference.toFixed(1) })}
                </p>
              )}
              {warnings.length > 0 && <details className="clan-roster-warnings" open>
                <summary>{t('clanWarnings')} ({warnings.length})</summary>
                <ul>{warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
              </details>}
              {previous && <div className="clan-roster-changes">
                <span className="joined">+{joined.length} {t('clanJoined')}</span>
                <span className="left">−{left.length} {t('clanLeft')}</span>
                {(joined.length > 0 || left.length > 0) && (
                  <small>{[...joined.map((row) => '+ ' + row.name),
                    ...left.map((row) => '− ' + row.name)].join(' · ')}</small>
                )}
              </div>}
              <div className="clan-roster-table">
                <div className="clan-roster-columns">
                  <span>{t('playerColumn')}</span><span>{t('clanPower')}</span>
                  <span>{t('clanMatch')}</span><span />
                </div>
                {rows.map((row, index) => (
                  <div className={'clan-roster-entry' +
                    (magnitude(row.powerText) === null || !row.name.trim() ? ' invalid' : '')} key={row.key}>
                    <label><span className="clan-roster-row-number">{index + 1}</span>
                      <input aria-label={t('playerColumn') + ' ' + (index + 1)}
                        value={row.name} onChange={(event) => update(row.key, { name: event.target.value })} /></label>
                    <input aria-label={t('clanPower') + ' ' + row.name} value={row.powerText}
                      onChange={(event) => update(row.key, { powerText: event.target.value })} />
                    <SearchSelect value={row.playerId}
                      ariaLabel={t('clanMatch') + ': ' + row.name}
                      placeholder={t('clanNewPlayer')}
                      choices={[{ value: null, label: t('clanNewPlayer') },
                        ...(candidates?.players ?? []).map((person) =>
                          ({ value: person.id, label: person.name }))]}
                      onChange={(value) => update(row.key, { playerId: value })} />
                    <button type="button" aria-label={t('delete') + ': ' + row.name}
                      onClick={() => setRows((all) => all.filter((entry) => entry.key !== row.key))}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="game-button secondary clan-add-row"
                onClick={() => setRows((current) => [...current,
                  { key: nextKey++, name: '', powerText: '', playerId: null, source: 0 }])}>
                <Plus size={15} /> {t('clanAddPlayer')}
              </button>
              {differenceHigh && <label className="clan-roster-ack">
                <input type="checkbox" checked={acknowledge}
                  onChange={(event) => setAcknowledge(event.target.checked)} />
                {t('clanAcknowledgePower')}
              </label>}
              {invalid.length > 0 && <p className="error-strip">{t('clanFixRows')} ({invalid.length})</p>}
              {duplicated && <p className="error-strip">{t('clanDuplicateNames')}</p>}
              {expected && Number(expected) !== rows.length &&
                <p className="error-strip">{t('clanCountMismatch')}</p>}
            </div>
          )}
        </div>
        {error && <div className="error-strip" role="alert">{error}</div>}
        <footer className="modal-actions">
          <button className="game-button secondary" disabled={busy}
            onClick={() => stage === 'upload' ? onClose() : setStage('upload')}>
            {t(stage === 'upload' ? 'cancel' : 'back')}
          </button>
          <button className="game-button blue" disabled={busy || (stage === 'upload' && !files.length)}
            onClick={() => void (stage === 'upload' ? scan() : confirm())}>
            <CheckCircle size={16} /> {busy ? t('pleaseWait') :
              t(stage === 'upload' ? 'scan' : 'confirmImport')}
          </button>
        </footer>
      </section>
    </div>
  );
}
