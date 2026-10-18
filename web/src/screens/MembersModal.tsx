import React from 'react';
import { Copy, ShieldOff, UserPlus, Users, X } from 'lucide-react';
import { api, json } from '../api';
import { useI18n } from '../i18n';

interface ManagedAccount {
  id: number;
  username: string;
  display_name: string;
  role: 'owner' | 'admin' | 'member';
  active: number;
}
interface Invitation {
  id: number;
  label: string;
  role: 'admin' | 'member';
  expires_at: number;
  used_at: number | null;
}
interface CreatedInvitation {
  id: number;
  url: string;
  role: 'admin' | 'member';
  label: string;
}

export function MembersModal({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const [members, setMembers] = React.useState<ManagedAccount[]>([]);
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);
  const [created, setCreated] = React.useState<CreatedInvitation | null>(null);
  const [displayName, setDisplayName] = React.useState('');
  const [role, setRole] = React.useState<'member' | 'admin'>('member');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function refresh() {
    const [accounts, pending] = await Promise.all([
      api<ManagedAccount[]>('auth/accounts'),
      api<Invitation[]>('auth/invites'),
    ]);
    setMembers(accounts);
    setInvitations(pending);
  }

  React.useEffect(() => {
    void refresh().catch(failure => setError((failure as Error).message));
  }, []);

  async function createInvitation() {
    setBusy(true);
    setError('');
    try {
      const invitation = await api<CreatedInvitation>('auth/invites',
        json('POST', { label: displayName, role }));
      setCreated(invitation);
      setCopied(false);
      setDisplayName('');
      await refresh();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(path: string) {
    if (!window.confirm(t('confirmRevoke'))) return;
    setError('');
    try {
      await api(path, { method: 'DELETE' });
      await refresh();
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setError(t('serverError'));
    }
  }

  function roleLabel(value: ManagedAccount['role']) {
    if (value === 'owner') return t('ownerRole');
    if (value === 'admin') return t('adminRole');
    return t('memberRole');
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="panel modal members-modal" role="dialog" aria-modal="true" aria-label={t('manageAccess')}>
        <header className="modal-header">
          <h2><Users /> {t('manageAccess')}</h2>
          <button className="close-button" aria-label={t('close')} onClick={onClose}><X /></button>
        </header>
        <div className="modal-content">
          <h3>{t('newInvitation')}</h3>
          <div className="invite-form">
            <label>{t('displayName')}
              <input value={displayName} onChange={event => setDisplayName(event.target.value)} />
            </label>
            <label>{t('role')}
              <select value={role} onChange={event => setRole(event.target.value as 'member' | 'admin')}>
                <option value="member">{t('roleMemberDescription')}</option>
                <option value="admin">{t('roleAdminDescription')}</option>
              </select>
            </label>
            <button className="game-button blue" disabled={busy || displayName.trim().length < 2}
              onClick={createInvitation}><UserPlus size={16} /> {t('create')}</button>
          </div>
          {created && (
            <div className="created-invite">
              <h3>{t('inviteReady', { name: created.label })}</h3>
              <p className="tiny muted">{t('inviteDescription')}</p>
              <button className="game-button blue" onClick={copyLink}>
                <Copy size={15} /> {copied ? t('copied') : t('copyInvite')}
              </button>
            </div>
          )}
          <h3>{t('accounts')}</h3>
          <div className="accounts-list">
            {members.map(member => (
              <div className={'account-row' + (!member.active ? ' inactive' : '')} key={member.id}>
                <div>
                  <strong>{member.display_name}</strong>
                  <small>{member.username} · {roleLabel(member.role)}
                    {!member.active && ' · ' + t('revoked')}</small>
                </div>
                {member.role !== 'owner' && !!member.active && (
                  <button className="icon-button danger" aria-label={t('revokeAccount')}
                    title={t('revokeAccount')} onClick={() => revoke('auth/accounts/' + member.id)}>
                    <ShieldOff size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <h3>{t('pendingInvites')}</h3>
          <div className="accounts-list">
            {invitations.filter(invite => !invite.used_at && invite.expires_at > Date.now())
              .map(invite => (
                <div className="account-row" key={invite.id}>
                  <div>
                    <strong>{invite.label}</strong>
                    <small>{roleLabel(invite.role)} · {t('expires', {
                      date: new Date(invite.expires_at).toLocaleDateString(locale),
                    })}</small>
                  </div>
                  <button className="icon-button danger" aria-label={t('revokeInvite')}
                    onClick={() => revoke('auth/invites/' + invite.id)}><X size={18} /></button>
                </div>
              ))}
          </div>
        </div>
        {error && <div className="error-strip" role="alert">{error}</div>}
        <footer className="modal-actions">
          <button className="game-button blue" onClick={onClose}>{t('done')}</button>
        </footer>
      </section>
    </div>
  );
}
