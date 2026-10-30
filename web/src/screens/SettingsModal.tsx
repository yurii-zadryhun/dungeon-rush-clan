import React from 'react';
import { notify } from './Toast';
import { ModalDialog } from './ModalDialog';
import { Plus, Save, Settings, Trash2, X } from 'lucide-react';
import { api, json, type Dashboard } from '../api';
import { useI18n } from '../i18n';

export function SettingsModal({
  current,
  onClose,
  onDone,
}: {
  current: Dashboard['rankings']['settings'];
  onClose: () => void;
  onDone: (next: Dashboard) => void;
}) {
  const { t } = useI18n();
  const [clanName, setClanName] = React.useState(current.clanName);
  const [leaderName, setLeaderName] = React.useState(current.leaderName);
  const [telegramUrl, setTelegramUrl] = React.useState(current.telegramUrl);
  const [discordUrl, setDiscordUrl] = React.useState(current.discordUrl);
  const [contactUrl, setContactUrl] = React.useState(current.contactUrl);
  const [minimum, setMinimum] = React.useState(String(current.minimumPoints / 1000));
  const [weights, setWeights] = React.useState(
    current.weights.map((weight) => String(Math.round(weight * 10000) / 100)),
  );
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  function updateWeight(index: number, value: string) {
    setWeights((existing) => existing.map((weight, position) => (position === index ? value : weight)));
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const list = weights.map((weight) => Number(weight) / 100);
      const total = list.reduce((sum, weight) => sum + weight, 0);
      if (
        list.some((weight) => !Number.isFinite(weight) || weight <= 0) ||
        Math.abs(total - 1) > 0.00001
      ) {
        throw new Error(t('weightsError'));
      }
      const minimumThousands = Number(minimum);
      if (!Number.isInteger(minimumThousands * 1000) || minimumThousands < 0) {
        throw new Error(t('minimumError'));
      }
      const updated = await api<Dashboard>(
        'settings',
        json('PATCH', {
          clanName,
          leaderName,
          telegramUrl,
          discordUrl,
          contactUrl,
          minimumPoints: minimumThousands * 1000,
          weights: list,
        }),
      );
      notify(t('changesSaved'));
      onDone(updated);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sum = weights.reduce((total, weight) => total + (Number(weight) || 0), 0);
  return (
    <ModalDialog onClose={onClose} ariaLabel={t('clanSettings')} className="panel modal settings-modal">
        <header className="modal-header">
          <h2>
            <Settings /> {t('clanSettings')}
          </h2>
          <button aria-label={t('close')} className="close-button" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="modal-content">
          <label>
            {t('clanName')}
            <input value={clanName} onChange={(event) => setClanName(event.target.value)} />
          </label>
          <label>
            {t('publicLeader')}
            <input
              value={leaderName}
              maxLength={80}
              placeholder={t('publicLeaderFallback')}
              onChange={(event) => setLeaderName(event.target.value)}
            />
            <small className="muted">{t('publicLeaderHelp')}</small>
          </label>
          <fieldset className="clan-links-fields">
            <legend>{t('clanLinksTitle')}</legend>
            <label>
              {t('clanTelegram')}
              <input
                type="url"
                autoComplete="url"
                placeholder="https://t.me/..."
                value={telegramUrl}
                maxLength={500}
                onChange={(event) => setTelegramUrl(event.target.value)}
              />
            </label>
            <label>
              {t('clanDiscord')}
              <input
                type="url"
                autoComplete="url"
                placeholder="https://discord.gg/..."
                value={discordUrl}
                maxLength={500}
                onChange={(event) => setDiscordUrl(event.target.value)}
              />
            </label>
            <label>
              {t('clanContactLink')}
              <input
                type="url"
                autoComplete="url"
                placeholder="https://discord.gg/..."
                value={contactUrl}
                maxLength={500}
                onChange={(event) => setContactUrl(event.target.value)}
              />
              <small className="muted">{t('clanContactHint')}</small>
            </label>
          </fieldset>
          <label>
            {t('minimumScore')}
            <div className="input-suffix">
              <input
                type="number"
                step="1"
                min="0"
                value={minimum}
                onChange={(event) => setMinimum(event.target.value)}
              />
              <span>k</span>
            </div>
          </label>
          <h3>{t('weights')}</h3>
          <p className="tiny muted">{t('weightsHelp')}</p>
          {weights.map((weight, index) => (
            <div className="weight-row" key={index}>
              <span>{index === 0 ? t('newestWar') : t('previousWar', { offset: index })}</span>
              <input
                type="number"
                step=".01"
                min="0"
                max="100"
                value={weight}
                onChange={(event) => updateWeight(index, event.target.value)}
              />
              <span>%</span>
              <button
                aria-label={t('removeRow')}
                className="icon-button danger"
                disabled={weights.length <= 1}
                onClick={() =>
                  setWeights((existing) => existing.filter((_, position) => position !== index))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            className="game-button secondary weight-add"
            disabled={weights.length >= 12}
            onClick={() => setWeights((existing) => [...existing, '0'])}
          >
            <Plus size={14} /> {t('add')}
          </button>
          <div className="sum-row">
            {t('total')}: <b>{sum.toFixed(2)}%</b>
          </div>
        </div>
        {error && (
          <div className="error-strip" role="alert">
            {error}
          </div>
        )}
        <footer className="modal-actions">
          <button className="game-button secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="game-button blue" disabled={busy} onClick={save}>
            <Save size={17} /> {t('save')}
          </button>
        </footer>
    </ModalDialog>
  );
}
