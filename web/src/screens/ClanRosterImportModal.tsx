import React from 'react';
import { Camera, CheckCircle, Copy, Plus, Trash2, UploadCloud, X } from 'lucide-react';
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
import { prepareScreenshots, type PreparedScreenshots } from './image-prep';
import { SearchSelect } from './SearchSelect';
import { matchRosterName } from './roster-match';
import './ClanRosterImportModal.css';

interface DraftEntry {
  key: number;
  name: string;
  powerText: string;
  playerId: number | null;
  source: number;
  ocrName?: string;
}
let nextKey = 1;

function magnitude(input: string) {
  const match = input
    .trim()
    .replace(/\s+/g, '')
    .match(/^(\d{1,5}(?:[.,]\d{1,4})?)([KMBTqQ])$/);
  const factors: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, q: 1e15, Q: 1e18 };
  return match ? Number(match[1].replace(',', '.')) * factors[match[2]] : null;
}
function powerLabel(value: number) {
  for (const [name, factor] of [
    ['Q', 1e18],
    ['q', 1e15],
    ['T', 1e12],
    ['B', 1e9],
    ['M', 1e6],
    ['K', 1e3],
  ] as const) {
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
  const { t, locale } = useI18n();
  const [files, setFiles] = React.useState<File[]>([]);
  const [sourceUrls, setSourceUrls] = React.useState<string[]>([]);
  const [preparedPreview, setPreparedPreview] = React.useState<{
    files: File[];
    result: PreparedScreenshots;
  } | null>(null);
  const [previewError, setPreviewError] = React.useState('');
  const [ocrResponseJson, setOcrResponseJson] = React.useState<string | null>(null);
  const [ocrCopied, setOcrCopied] = React.useState(false);

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

  // Only the original screenshots are shown as thumbnails. The optimized mosaics
  // still go to OCR, but are never rendered or retained as object URLs.
  React.useEffect(() => {
    if (!files.length) {
      setSourceUrls([]);
      setPreparedPreview(null);
      setPreviewError('');
      setOcrResponseJson(null);
      setOcrCopied(false);
      return;
    }
    let canceled = false;
    const originals = files.map((file) => URL.createObjectURL(file));
    setSourceUrls(originals);
    setPreparedPreview(null);
    setPreviewError('');
    setOcrResponseJson(null);
    setOcrCopied(false);
    void prepareScreenshots(files, 'clan')
      .then((result) => {
        if (!canceled) setPreparedPreview({ files, result });
      })
      .catch((cause: unknown) => {
        if (!canceled) setPreviewError((cause as Error).message);
      });
    return () => {
      canceled = true;
      originals.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const visiblePreview = preparedPreview?.files === files ? preparedPreview : null;

  async function copyOcrResponse() {
    if (!ocrResponseJson) return;
    try {
      await navigator.clipboard.writeText(ocrResponseJson);
      setOcrCopied(true);
    } catch {
      setError(t('clanOcrCopyFailed'));
    }
  }

  const sum = rows.reduce((total, entry) => total + (magnitude(entry.powerText) ?? 0), 0);
  const expectedPower = reportedPower ? magnitude(reportedPower) : null;
  const percentDifference =
    expectedPower && expectedPower > 0 ? (100 * Math.abs(sum - expectedPower)) / expectedPower : null;
  const invalid = rows.filter(
    (entry) =>
      !entry.name.trim() || magnitude(entry.powerText) === null || entry.name.trim().length > 80,
  );
  const duplicated = new Set(rows.map((entry) => normalizeName(entry.name))).size !== rows.length;
  const previousIds = new Set(previous?.entries.map((entry) => entry.id) ?? []);
  const currentIds = new Set(rows.map((entry) => entry.playerId).filter((id) => id !== null));
  const previousNames = new Set(previous?.entries.map((entry) => normalizeName(entry.name)) ?? []);
  const currentNames = new Set(rows.map((entry) => normalizeName(entry.name)));
  const joined = previous
    ? rows.filter((entry) =>
        entry.playerId === null
          ? !previousNames.has(normalizeName(entry.name))
          : !previousIds.has(entry.playerId),
      )
    : [];
  const left = previous
    ? previous.entries.filter(
        (entry) => !currentIds.has(entry.id) && !currentNames.has(normalizeName(entry.name)),
      )
    : [];
  const differenceHigh = percentDifference !== null && percentDifference > 4;
  const compareNames = React.useMemo(
    () => new Intl.Collator(locale === 'uk' ? 'uk-UA' : 'en-US', { sensitivity: 'base', numeric: true }),
    [locale],
  );
  const sortedRows = React.useMemo(
    () => [...rows].sort((a, b) => compareNames.compare(a.name, b.name) || a.key - b.key),
    [rows, compareNames],
  );
  const candidateChoices = React.useMemo(
    () => [
      { value: null, label: t('clanNewPlayer') },
      ...(candidates?.players ?? [])
        .slice()
        .sort((a, b) => compareNames.compare(a.name, b.name))
        .map((person) => ({ value: person.id, label: person.name })),
    ],
    [candidates, compareNames, t],
  );

  function update(key: number, patch: Partial<DraftEntry>) {
    setRows((all) => all.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setAcknowledge(false);
  }

  function updateName(key: number, name: string) {
    // While typing, match only exact names/aliases. Partial text must not
    // accidentally select an unrelated player through fuzzy matching.
    const match = candidates ? matchRosterName(name, candidates, false) : null;
    update(key, { name, playerId: match?.playerId ?? null, ocrName: undefined });
  }

  function reconcileName(key: number, name: string) {
    if (!candidates) return;
    const match = matchRosterName(name, candidates);
    if (match) {
      update(key, {
        name: match.name,
        playerId: match.playerId,
        ocrName: normalizeName(name) === normalizeName(match.name) ? undefined : name,
      });
    }
  }

  function choosePlayer(key: number, id: number | null) {
    if (id === null) {
      update(key, { playerId: null, ocrName: undefined });
      return;
    }
    const selected = candidates?.players.find((person) => person.id === id);
    if (selected) update(key, { playerId: id, name: selected.name, ocrName: undefined });
  }

  async function scan() {
    if (!files.length || files.length > 10) {
      setError(t('clanChooseScreens'));
      return;
    }
    if (!visiblePreview) {
      setError(previewError || t('clanPreparingImages'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const [known, latest] = await Promise.all([
        api<ClanRosterCandidates>('clan-roster/candidates'),
        api<ClanRosterSnapshot | null>('clan-roster/latest'),
      ]);
      const prepared = visiblePreview.result;
      const form = new FormData();
      form.append('headerHeight', String(prepared.headerHeight));
      prepared.parts.forEach((blob, i) => form.append('mosaic', blob, 'members-' + (i + 1) + '.jpg'));
      const result = await api<ClanOcrResponse>('ocr/clan', { method: 'POST', body: form });
      // Preserve the unchanged response, including raw Vision text and word positions,
      // even if a player name or power is subsequently corrected in the editor.
      setOcrResponseJson(JSON.stringify(result, null, 2));
      setOcrCopied(false);
      setCandidates(known);
      setPrevious(latest);
      setRows(
        result.players.map((player) => {
          const match = matchRosterName(player.name, known);
          return {
            ...player,
            key: nextKey++,
            name: match?.name ?? player.name,
            playerId: match?.playerId ?? null,
            ocrName:
              match && normalizeName(player.name) !== normalizeName(match.name)
                ? player.name
                : undefined,
          };
        }),
      );
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
    if (
      invalid.length ||
      duplicated ||
      new Set(rows.map((entry) => entry.playerId).filter(Boolean)).size !==
        rows.filter((entry) => entry.playerId).length
    ) {
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
      await api(
        'clan-roster/confirm',
        json('POST', {
          capturedAt: new Date(capturedLocal).toISOString(),
          reportedMembers: count,
          reportedPowerText: reportedPower || null,
          screenshotCount: files.length,
          acknowledgePowerMismatch: acknowledge,
          players: rows.map(({ name, powerText, playerId }) => ({ name, powerText, playerId })),
        }),
      );
      const dashboard = await api<Dashboard>('dashboard');
      onDone(dashboard);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="panel modal clan-roster-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('clanImportTitle')}
      >
        <header className="modal-header">
          <h2>
            <UploadCloud size={20} /> {t('clanImportTitle')}
          </h2>
          <button className="close-button" aria-label={t('close')} onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="clan-roster-scroll">
          {stage === 'upload' ? (
            <div className="clan-roster-upload">
              <label className="clan-roster-file">
                <Camera size={21} />
                <span>
                  <strong>{t('clanSelectScreens')}</strong>
                  <small>{t('clanScreensChosen', { count: files.length })}</small>
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) => {
                    const chosen = Array.from(event.target.files || []);
                    event.currentTarget.value = '';
                    if (chosen.length > 10) setError(t('clanChooseScreens'));
                    else {
                      setError('');
                      setFiles(chosen);
                    }
                  }}
                />
              </label>
              {files.length > 0 && (
                <div className="clan-image-selection">
                  <div
                    className="clan-thumbnail-strip"
                    aria-label={t('clanScreensChosen', { count: files.length })}
                  >
                    {files.map((file, index) => (
                      <div
                        className="clan-thumbnail"
                        key={file.name + ':' + file.lastModified + ':' + index}
                      >
                        <div className="clan-thumbnail-image">
                          {sourceUrls[index] && (
                            <img
                              src={sourceUrls[index]}
                              alt={t('clanScreenshotNumber', { number: index + 1 })}
                              loading="lazy"
                            />
                          )}
                          <span>{index + 1}</span>
                          <button
                            className="clan-thumbnail-remove"
                            type="button"
                            onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                            aria-label={t('remove') + ': ' + (index + 1)}
                            title={t('remove')}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {previewError && (
                    <p className="error-strip" role="alert">
                      {previewError}
                    </p>
                  )}
                  {!visiblePreview && !previewError && (
                    <p className="muted" role="status">
                      {t('clanPreparingImages')}
                    </p>
                  )}

                </div>
              )}
            </div>
          ) : (
            <div className="clan-roster-review">
              <div className="clan-roster-summary">
                <label>
                  {t('clanCapturedAt')}
                  <input
                    type="datetime-local"
                    value={capturedLocal}
                    onChange={(event) => setCapturedLocal(event.target.value)}
                  />
                </label>
                <label>
                  {t('clanExpectedCount')}
                  <input
                    inputMode="numeric"
                    type="number"
                    min={1}
                    max={100}
                    value={expected}
                    onChange={(event) => setExpected(event.target.value)}
                  />
                </label>
                <label>
                  {t('clanHeaderPower')}
                  <input
                    value={reportedPower}
                    placeholder="77.80q"
                    onChange={(event) => {
                      setReportedPower(event.target.value);
                      setAcknowledge(false);
                    }}
                  />
                </label>
                <div className="clan-summary-figure">
                  <strong>
                    {rows.length}
                    {capacity ? ' / ' + capacity : ''}
                  </strong>
                  <small>{t('clanRecognized')}</small>
                </div>
                <div className="clan-summary-figure">
                  <strong>{powerLabel(sum)}</strong>
                  <small>{t('clanSumPower')}</small>
                </div>
              </div>
              {percentDifference !== null && (
                <p className={'clan-roster-compare' + (differenceHigh ? ' warning' : '')}>
                  {t('clanPowerDifference', { percent: percentDifference.toFixed(1) })}
                </p>
              )}
              {warnings.length > 0 && (
                <details className="clan-roster-warnings">
                  <summary>
                    {t('clanWarnings')} ({warnings.length})
                  </summary>
                  <ul>
                    {warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </details>
              )}
              {ocrResponseJson && (
                <details className="clan-ocr-response">
                  <summary>{t('clanOcrResponse')}</summary>
                  <div className="clan-ocr-response-body">
                    <div className="clan-ocr-response-toolbar">
                      <p>{t('clanOcrResponseHelp')}</p>
                      <button
                        type="button"
                        className="game-button secondary clan-ocr-copy"
                        onClick={() => void copyOcrResponse()}
                      >
                        <Copy size={15} />
                        {t(ocrCopied ? 'copied' : 'clanOcrCopy')}
                      </button>
                    </div>
                    <pre>{ocrResponseJson}</pre>
                  </div>
                </details>
              )}
              {previous && (
                <div className="clan-roster-changes">
                  <span className="joined">
                    +{joined.length} {t('clanJoined')}
                  </span>
                  <span className="left">
                    −{left.length} {t('clanLeft')}
                  </span>
                  {(joined.length > 0 || left.length > 0) && (
                    <small>
                      {[
                        ...joined.map((row) => '+ ' + row.name),
                        ...left.map((row) => '− ' + row.name),
                      ].join(' · ')}
                    </small>
                  )}
                </div>
              )}
              <div className="clan-roster-table">
                <div className="clan-roster-columns">
                  <span>{t('playerColumn')}</span>
                  <span>{t('clanPower')}</span>
                  <span>{t('clanMatch')}</span>
                  <span />
                </div>
                {sortedRows.map((row, index) => (
                  <div
                    className={
                      'clan-roster-entry' +
                      (magnitude(row.powerText) === null || !row.name.trim() ? ' invalid' : '')
                    }
                    key={row.key}
                  >
                    <label>
                      <span className="clan-roster-row-number">{index + 1}</span>
                      <input
                        aria-label={t('playerColumn') + ' ' + (index + 1)}
                        value={row.name}
                        onChange={(event) => updateName(row.key, event.target.value)}
                        onBlur={() => reconcileName(row.key, row.name)}
                        title={row.ocrName ? t('clanOcrCorrected', { name: row.ocrName }) : undefined}
                      />
                    </label>
                    <input
                      aria-label={t('clanPower') + ' ' + row.name}
                      value={row.powerText}
                      onChange={(event) => update(row.key, { powerText: event.target.value })}
                    />
                    <SearchSelect
                      value={row.playerId}
                      ariaLabel={t('clanMatch') + ': ' + row.name}
                      placeholder={t('clanNewPlayer')}
                      choices={candidateChoices}
                      onChange={(value) => choosePlayer(row.key, value)}
                    />
                    <button
                      type="button"
                      aria-label={t('remove') + ': ' + row.name}
                      onClick={() => setRows((all) => all.filter((entry) => entry.key !== row.key))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="game-button secondary clan-add-row"
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    { key: nextKey++, name: '', powerText: '', playerId: null, source: 0 },
                  ])
                }
              >
                <Plus size={15} /> {t('clanAddPlayer')}
              </button>
              {differenceHigh && (
                <label className="clan-roster-ack">
                  <input
                    type="checkbox"
                    checked={acknowledge}
                    onChange={(event) => setAcknowledge(event.target.checked)}
                  />
                  {t('clanAcknowledgePower')}
                </label>
              )}
              {invalid.length > 0 && (
                <p className="error-strip">
                  {t('clanFixRows')} ({invalid.length})
                </p>
              )}
              {duplicated && <p className="error-strip">{t('clanDuplicateNames')}</p>}
              {expected && Number(expected) !== rows.length && (
                <p className="error-strip">{t('clanCountMismatch')}</p>
              )}
            </div>
          )}
        </div>
        {error && (
          <div className="error-strip" role="alert">
            {error}
          </div>
        )}
        <footer className="modal-actions">
          <button
            className="game-button secondary"
            disabled={busy}
            onClick={() => (stage === 'upload' ? onClose() : setStage('upload'))}
          >
            {t(stage === 'upload' ? 'cancel' : 'back')}
          </button>
          <button
            className="game-button blue"
            disabled={busy || (stage === 'upload' && (!files.length || !visiblePreview))}
            onClick={() => void (stage === 'upload' ? scan() : confirm())}
          >
            <CheckCircle size={16} />{' '}
            {busy ? t('pleaseWait') : t(stage === 'upload' ? 'scan' : 'confirmImport')}
          </button>
        </footer>
      </section>
    </div>
  );
}
