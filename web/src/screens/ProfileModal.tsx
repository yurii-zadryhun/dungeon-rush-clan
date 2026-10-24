import React from 'react';
import { KeyRound, Trash2, UserRound, X } from 'lucide-react';
import { api, json, type Account } from '../api';
import { useI18n } from '../i18n';

export function ProfileModal({
  account,
  onClose,
  onSaved,
  onDeleted,
}: {
  account: Account;
  onClose: () => void;
  onSaved: (account: Account) => Promise<void>;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = React.useState(account.displayName);
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [deletionOpen, setDeletionOpen] = React.useState(false);
  const [deletionPassword, setDeletionPassword] = React.useState('');
  const [deletionAcknowledged, setDeletionAcknowledged] = React.useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (changingPassword && newPassword !== confirmation) {
      setError(t('passwordMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const accountUpdate = await api<Account>(
        'auth/profile',
        json('PATCH', {
          username: name.trim(),
          ...(changingPassword ? { currentPassword, newPassword } : {}),
        }),
      );
      await onSaved(accountUpdate);
      onClose();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!deletionAcknowledged || !deletionPassword || busy) return;
    setBusy(true);
    setError('');
    try {
      await api('auth/me', json('DELETE', { password: deletionPassword, confirmation: 'DELETE' }));
      onDeleted();
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
        <form onSubmit={save} className="profile-form">
          <div className="modal-content">
            <label>
              {t('username')}
              <input
                autoComplete="username"
                value={name}
                required
                minLength={2}
                maxLength={50}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            {!changingPassword && (
              <button
                className="game-button secondary profile-password-action"
                type="button"
                onClick={() => setChangingPassword(true)}
              >
                <KeyRound size={16} /> {t('changePassword')}
              </button>
            )}
            {changingPassword && (
              <div className="password-fields">
                <div className="review-head">
                  <h3>{t('changePassword')}</h3>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t('cancel')}
                    onClick={() => {
                      setChangingPassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmation('');
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <label>
                  {t('currentPassword')}
                  <input
                    autoComplete="current-password"
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </label>
                <label>
                  {t('newPasswordRequired')}
                  <input
                    autoComplete="new-password"
                    type="password"
                    required
                    minLength={12}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </label>
                <label>
                  {t('confirmPassword')}
                  <input
                    autoComplete="new-password"
                    type="password"
                    required
                    minLength={12}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </label>
              </div>
            )}
          </div>
          {error && (
            <div className="error-strip" role="alert">
              {error}
            </div>
          )}
          <footer className="modal-actions">
            <button className="game-button secondary" type="button" onClick={onClose}>
              {t('cancel')}
            </button>
            <button className="game-button blue" type="submit" disabled={busy}>
              {busy ? t('pleaseWait') : t('save')}
            </button>
          </footer>
        </form>
        {!account.impersonating && (
          <section className="profile-danger-zone" aria-label={t('deleteAccount')}>
            {!deletionOpen ? (
              <button
                type="button"
                className="profile-delete-trigger"
                onClick={() => setDeletionOpen(true)}
              >
                <Trash2 size={15} /> {t('deleteAccount')}
              </button>
            ) : (
              <form className="profile-delete-form" onSubmit={deleteAccount}>
                <h3>{t('deleteAccount')}</h3>
                <p>{t('deleteAccountExplanation')}</p>
                <label>
                  {t('confirmWithPassword')}
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={1}
                    value={deletionPassword}
                    onChange={(event) => setDeletionPassword(event.target.value)}
                  />
                </label>
                <label className="profile-delete-check">
                  <input
                    type="checkbox"
                    checked={deletionAcknowledged}
                    onChange={(event) => setDeletionAcknowledged(event.target.checked)}
                  />
                  <span>{t('deleteAccountConfirm')}</span>
                </label>
                <div className="profile-delete-actions">
                  <button
                    type="button"
                    className="game-button secondary"
                    onClick={() => {
                      setDeletionOpen(false);
                      setDeletionPassword('');
                      setDeletionAcknowledged(false);
                      setError('');
                    }}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="game-button danger"
                    disabled={busy || !deletionPassword || !deletionAcknowledged}
                  >
                    {busy ? t('pleaseWait') : t('deleteAccount')}
                  </button>
                </div>
                <a href="/privacy" className="profile-privacy-link">{t('privacyLink')} ↗</a>
              </form>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
