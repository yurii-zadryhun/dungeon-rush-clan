import React from 'react';
import { UserRound, X } from 'lucide-react';
import { api, json, type Account } from '../api';
import { useI18n } from '../i18n';

export function ProfileModal({
  account,
  onClose,
  onSaved,
}: {
  account: Account;
  onClose: () => void;
  onSaved: (updated: Account) => Promise<void>;
}) {
  const { t } = useI18n();
  const [username, setUsername] = React.useState(account.displayName);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmation) {
      setError(t('passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      const updated = await api<Account>(
        'auth/profile',
        json('PATCH', {
          username,
          currentPassword,
          ...(newPassword ? { newPassword } : {}),
        }),
      );
      await onSaved(updated);
      onClose();
    } catch (failure) {
      setError((failure as Error).message);
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
        role="dialog"
        aria-modal="true"
        aria-label={t('profile')}
        className="panel modal profile-modal"
      >
        <header className="modal-header">
          <h2>
            <UserRound /> {t('profile')}
          </h2>
          <button className="close-button" aria-label={t('close')} onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="modal-content">
            <label>
              {t('username')}
              <input
                required
                minLength={2}
                maxLength={50}
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label>
              {t('currentPassword')}
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              {t('newPassword')}
              <input
                type="password"
                minLength={12}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            {newPassword && (
              <label>
                {t('confirmPassword')}
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
            )}
          </div>
          {error && (
            <div className="error-strip" role="alert">
              {error}
            </div>
          )}
          <footer className="modal-actions">
            <button type="button" className="game-button secondary" onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="game-button blue" disabled={busy}>
              {busy ? t('pleaseWait') : t('save')}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
