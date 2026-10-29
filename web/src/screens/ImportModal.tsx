import React from 'react';
import { CheckCircle, ScanLine, UploadCloud, X } from 'lucide-react';
import {
  api,
  json,
  normalizeName,
  type Dashboard,
  type OcrResponse,
  type Roster,
  type Week,
} from '../api';
import { formatWarRange } from '../date-format';
import { useI18n } from '../i18n';
import {
  WarReviewEditor,
  emptyRoster,
  makeResult,
  warSubmission,
  type WarDraft,
  type WarSections,
} from './WarReviewEditor';

function FileChooser({
  title,
  selected,
  multiple,
  onSelect,
}: {
  title: string;
  selected: string;
  multiple: boolean;
  onSelect: (files: File[]) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="war-editor-file">
      <ScanLine size={20} />
      <span>
        <strong>{title}</strong>
        <small>{selected || t(multiple ? 'chooseImages' : 'chooseResult')}</small>
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple={multiple}
        onChange={(event) => onSelect(Array.from(event.target.files ?? []))}
      />
    </label>
  );
}

function UploadStage({
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
  return (
    <div className="war-editor-upload">
      {week.permissions.ranking && !week.rankingImported && (
        <FileChooser
          title={t('leaderboardImages')}
          multiple
          selected={rankingImages.length ? t('chosenImages', { count: rankingImages.length }) : ''}
          onSelect={onRanking}
        />
      )}
      {week.permissions.result && !week.resultImported && (
        <FileChooser
          title={t('resultImage')}
          multiple={false}
          selected={resultImage?.name ?? ''}
          onSelect={(files) => onResult(files[0] ?? null)}
        />
      )}
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
  const [stage, setStage] = React.useState<'upload' | 'review'>('upload');
  const [draft, setDraft] = React.useState<WarDraft>({ players: [], result: null });
  const [sections, setSections] = React.useState<WarSections>({ players: false, result: false });
  const [roster, setRoster] = React.useState<Roster>(emptyRoster);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

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
      // Crop only the ranking bands and stitch compatible screenshots into
      // two compact OCR requests. Unsupported layouts retain the proven full-image path.
      if (rankingImages.length) {
        try {
          const prepared = await prepareScreenshots(rankingImages, 'ranking');
          prepared.parts.forEach((blob, index) =>
            form.append('rankingMosaic', blob, 'rankings-' + index + '.jpg'),
          );
        } catch {
          rankingImages.forEach((file) => form.append('ranking', file));
        }
      }
      if (resultImage) form.append('result', resultImage);
      const [recognized, available] = await Promise.all([
        api<OcrResponse>('ocr', { method: 'POST', body: form }),
        api<Roster>('import/roster?start=' + encodeURIComponent(week.start)),
      ]);
      setRoster(available);
      setWarnings(recognized.warnings);
      setDraft({
        players: recognized.players.map((player) => ({
          ...player,
          playerId:
            available.all.find((existing) => normalizeName(existing.name) === normalizeName(player.name))
              ?.id ??
            available.aliases?.find((alias) => alias.normalizedName === normalizeName(player.name))
              ?.playerId ??
            null,
        })),
        result: makeResult(recognized.result),
      });
      setSections({ players: rankingImages.length > 0, result: !!resultImage });
      setStage('review');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (sections.players && !draft.players.length) {
      setError(t('playersRequired'));
      return;
    }
    if (
      sections.result &&
      (!draft.result || draft.result.days.some((day) => !day.winner || !day.mvp.trim()))
    ) {
      setError(t('allDaysRequired'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const updated = await api<Dashboard>(
        'import/confirm',
        json('POST', warSubmission(week.start, draft, sections)),
      );
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

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="panel modal import-modal war-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('importWar')}
      >
        <header className="modal-header">
          <h2>
            <UploadCloud size={20} /> {t('importWar')} · {formatWarRange(week.start, locale)}
          </h2>
          <button className="close-button" aria-label={t('close')} onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="war-editor-scroll">
          {stage === 'upload' && (
            <UploadStage
              week={week}
              rankingImages={rankingImages}
              resultImage={resultImage}
              onRanking={setRankingImages}
              onResult={setResultImage}
            />
          )}
          {stage === 'review' && (
            <WarReviewEditor
              draft={draft}
              onChange={setDraft}
              sections={sections}
              roster={roster}
              clanName={clanName}
              warnings={warnings}
            />
          )}
        </div>
        {error && (
          <div className="error-strip" role="alert">
            {error}
          </div>
        )}
        <footer className="modal-actions">
          <button className="game-button secondary" onClick={back}>
            {stage === 'upload' ? t('cancel') : t('back')}
          </button>
          <button
            className="game-button blue"
            disabled={busy}
            onClick={() => void (stage === 'upload' ? scan() : confirm())}
          >
            <CheckCircle size={16} />{' '}
            {busy ? t('pleaseWait') : stage === 'upload' ? t('scan') : t('confirmImport')}
          </button>
        </footer>
      </section>
    </div>
  );
}
