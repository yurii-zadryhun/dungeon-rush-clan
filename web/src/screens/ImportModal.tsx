import React from 'react';
import { notify } from './Toast';
import { ModalDialog } from './ModalDialog';
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
import { prepareScreenshots, regions, type CropSegment } from './image-prep';
import { useI18n } from '../i18n';
import { OcrLimitStatus } from './OcrLimitStatus';
import {
  WarReviewEditor,
  invalidWarDraft,
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
  const [quotaRefresh, setQuotaRefresh] = React.useState(0);
  const [error, setError] = React.useState('');
  const [cropSegments, setCropSegments] = React.useState<CropSegment[]>([]);
  const [optimizedCrop, setOptimizedCrop] = React.useState(false);
  const [crop, setCrop] = React.useState<{ position: number; url: string } | null>(null);
  const storageKey = 'clan:war-review:' + week.start;

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        at: number; draft: WarDraft; sections: WarSections; roster: Roster; warnings: string[];
        cropSegments?: CropSegment[]; optimizedCrop?: boolean;
      };
      if (Date.now() - saved.at > 86_400_000) {
        sessionStorage.removeItem(storageKey);
        return;
      }
      if (!saved.draft || !saved.sections) return;
      setDraft(saved.draft);
      setSections(saved.sections);
      setRoster(saved.roster ?? emptyRoster);
      setWarnings(saved.warnings ?? []);
      setCropSegments(saved.cropSegments ?? []);
      setOptimizedCrop(saved.optimizedCrop ?? false);
      setStage('review');
    } catch { /* Invalid draft is ignored. */ }
  }, [storageKey]);

  React.useEffect(() => {
    if (stage !== 'review') return;
    try {
      sessionStorage.setItem(storageKey,
        JSON.stringify({ at: Date.now(), draft, sections, roster, warnings, cropSegments, optimizedCrop }));
    } catch { /* Browser storage may be unavailable. */ }
  }, [stage, draft, sections, roster, warnings, cropSegments, optimizedCrop, storageKey]);

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
      let optimized = false;
      let preparedSegments: CropSegment[] = [];
      // Crop only the ranking bands and stitch compatible screenshots into
      // two compact OCR requests. Unsupported layouts retain the proven full-image path.
      if (rankingImages.length) {
        try {
          const prepared = await prepareScreenshots(rankingImages, 'ranking');
          preparedSegments = prepared.segments;
          prepared.parts.forEach((blob, index) =>
            form.append('rankingMosaic', blob, 'rankings-' + index + '.jpg'),
          );
          optimized = true;
        } catch {
          rankingImages.forEach((file) => form.append('ranking', file));
        }
      }
      if (resultImage) form.append('result', resultImage);
      let [recognized, available] = await Promise.all([
        api<OcrResponse>('ocr', { method: 'POST', body: form }),
        api<Roster>('import/roster?start=' + encodeURIComponent(week.start)),
      ]);
      // A previously supported layout must not regress because of optimization.
      // If the composite detects suspiciously few rows, retry with original images.
      if (
        optimized &&
        rankingImages.length &&
        recognized.players.length < Math.max(1, rankingImages.length * 2)
      ) {
        const original = new FormData();
        rankingImages.forEach((file) => original.append('ranking', file));
        if (resultImage) original.append('result', resultImage);
        recognized = await api<OcrResponse>('ocr', { method: 'POST', body: original });
        optimized = false;
        preparedSegments = [];
      }
      setCropSegments(preparedSegments);
      setOptimizedCrop(optimized);
      setCrop(null);
      setRoster(available);
      setWarnings(recognized.warnings);
      setDraft({
        championship: week.championship,
        players: recognized.players.map((player) => ({
          ...player,
          y: recognized.positions?.find((item) => item.position === player.position && item.source === player.source)?.y,
          confidence: recognized.positions?.find((item) => item.position === player.position && item.source === player.source)?.confidence,
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
      setQuotaRefresh((revision) => revision + 1);
      setBusy(false);
    }
  }

  async function showPlayerCrop(player: WarDraft['players'][number]) {
    const location = player.y;
    if (location === undefined || !rankingImages.length) return;
    const segment = optimizedCrop ? cropSegments.find((item) => item.part === player.source &&
      location >= item.top && location < item.top + item.height) : null;
    const file = rankingImages[segment ? segment.fileIndex : player.source - 1];
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    try {
      const relativeY = segment ? (location - segment.top) / segment.height : location / bitmap.height;
      const fraction = segment ? regions.ranking.rows.y + relativeY * regions.ranking.rows.height : relativeY;
      const x = Math.round(bitmap.width * 0.14);
      const y = Math.max(0, Math.round(bitmap.height * (fraction - 0.035)));
      const width = Math.round(bitmap.width * 0.82);
      const height = Math.min(bitmap.height - y, Math.round(bitmap.height * 0.07));
      if (height <= 0) return;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
      setCrop({ position: player.position, url: canvas.toDataURL('image/jpeg', 0.9) });
    } finally { bitmap.close(); }
  }

  async function confirm() {
    if (invalidWarDraft(draft, sections)) {
      setError(locale === 'uk' ? 'Виправ виділені помилки перед імпортом.' : 'Correct the highlighted fields before importing.');
      return;
    }
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
      sessionStorage.removeItem(storageKey);
      notify(t('changesSaved'));
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
    <ModalDialog onClose={onClose} ariaLabel={t('importWar')} className="panel modal import-modal war-editor-dialog">
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
          {stage === 'upload' && <OcrLimitStatus refreshKey={quotaRefresh} />}
          {stage === 'review' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' }}>
              <input type="checkbox" checked={!!draft.championship}
                onChange={(event) => setDraft((current) => ({ ...current, championship: event.target.checked }))} />
              Championship
            </label>
          )}
          {stage === 'review' && !rankingImages.length && sections.players && (
            <label className="war-review-reattach">
              {locale === 'uk' ? 'Додайте оригінали в тому самому порядку для перевірки OCR' : 'Attach originals in the same order to inspect OCR'}
              <input type="file" multiple accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setRankingImages(Array.from(event.target.files || []))} />
            </label>
          )}
          {stage === 'review' && (
            <WarReviewEditor
              draft={draft}
              onChange={setDraft}
              sections={sections}
              roster={roster}
              clanName={clanName}
              warnings={warnings}
              onShowCrop={showPlayerCrop}
              crop={crop}
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
    </ModalDialog>
  );
}
