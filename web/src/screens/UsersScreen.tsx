import React from 'react';
import { Copy, Link2, Pencil, Trash2, UserPlus, Users, X } from 'lucide-react';
import { api, json, type Account, type Role } from '../api';
import { useI18n } from '../i18n';
import { MergePlayers } from './MergePlayers';
import type { Dashboard } from '../api';

interface ManagedAccount {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  active: number;
}
interface Invitation {
  id: number;
  label: string;
  role: Role;
  created_by: number;
  expires_at: number;
  used_at: number | null;
}
interface CreatedInvitation {
  id: number;
  url: string;
  label: string;
  role: Role;
}
interface SharedInvite {
  active: boolean;
  createdAt: number | null;
  url?: string;
}
interface AccessData {
  accounts: ManagedAccount[];
  invites: Invitation[];
  shared: SharedInvite;
}

export function UsersScreen({ account, onMerged }: { account: Account; onMerged: (data: Dashboard) => void }) {
  const { t, locale } = useI18n();
  const [data, setData] = React.useState<AccessData | null>(null);
  const [label, setLabel] = React.useState('');
  const [role, setRole] = React.useState<Role>('member');
  const [created, setCreated] = React.useState<CreatedInvitation | null>(null);
  const [groupUrl, setGroupUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [groupExpanded, setGroupExpanded] = React.useState(false);
  const [editing, setEditing] = React.useState<ManagedAccount | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editRole, setEditRole] = React.useState<Role>('member');
  const owner = account.role === 'owner';

  const refresh = React.useCallback(async () => {
    const [accounts, invites, shared] = await Promise.all([
      api<ManagedAccount[]>('auth/accounts'),
      api<Invitation[]>('auth/invites'),
      api<SharedInvite>('auth/shared-invite'),
    ]);
    setData({ accounts, invites, shared });
  }, []);

  React.useEffect(() => {
    void refresh().catch((failure) => setError((failure as Error).message));
  }, [refresh]);

  async function perform(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function issueInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void perform(async () => {
      const invite = await api<CreatedInvitation>('auth/invites', json('POST', { label, role }));
      setCreated(invite);
      setLabel('');
      await refresh();
    });
  }

  function issueGroup() {
    void perform(async () => {
      const invite = await api<SharedInvite>('auth/shared-invite', { method: 'POST' });
      setGroupUrl(invite.url ?? '');
      await refresh();
    });
  }

  function revokeGroup() {
    if (!window.confirm(t('confirmRevoke'))) return;
    void perform(async () => {
      await api('auth/shared-invite', { method: 'DELETE' });
      setGroupUrl('');
      await refresh();
    });
  }

  function revokeInvite(invite: Invitation) {
    if (!window.confirm(t('confirmRevoke'))) return;
    void perform(async () => {
      await api('auth/invites/' + invite.id, { method: 'DELETE' });
      await refresh();
    });
  }

  function deleteAccount(person: ManagedAccount) {
    if (!window.confirm(t('confirmDeleteUser'))) return;
    void perform(async () => {
      await api('auth/accounts/' + person.id, { method: 'DELETE' });
      await refresh();
    });
  }

  function openEditor(person: ManagedAccount) {
    setEditing(person);
    setEditName(person.display_name);
    setEditRole(person.role);
  }

  function saveUser(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    void perform(async () => {
      await api(
        'auth/accounts/' + editing.id,
        json('PATCH', {
          username: editName,
          role: editRole,
        }),
      );
      setEditing(null);
      await refresh();
    });
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  function roleLabel(value: Role) {
    const labels: Record<Role, string> = {
      owner: t('ownerRole'),
      admin: t('adminRole'),
      member: t('memberRole'),
    };
    return labels[value];
  }

  const pending =
    data?.invites.filter((invite) => !invite.used_at && invite.expires_at > Date.now()) ?? [];

  return (
    <main className="users-page">
      <div className="users-heading">
        <h1>
          <Users size={24} /> {t('userManagement')}
        </h1>
      </div>
      {error && (
        <div role="alert" className="error-strip">
          {error}
        </div>
      )}
      <div className="users-layout">
        <section className="panel access-panel">
          <h2>
            <UserPlus size={19} /> {t('newUserInvite')}
          </h2>
          <form className="users-invite-form" onSubmit={issueInvite}>
            <label>
              {t('displayName')}
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                minLength={2}
                maxLength={50}
                required
              />
            </label>
            <label>
              {t('role')}
              <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                <option value="member">{t('memberRole')}</option>
                {owner && <option value="admin">{t('adminRole')}</option>}
                {owner && <option value="owner">{t('ownerRole')}</option>}
              </select>
            </label>
            <button className="game-button blue" disabled={busy || label.trim().length < 2}>
              {t('create')}
            </button>
          </form>
          {created && (
            <div className="invite-result">
              <strong>{t('inviteReady', { name: created.label })}</strong>
              <div className="invite-link-row">
                <input
                  readOnly
                  aria-label={t('copyInvite')}
                  value={created.url}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button className="game-button secondary" onClick={() => void copyLink(created.url)}>
                  <Copy size={17} /> {t('copyInvite')}
                </button>
              </div>
            </div>
          )}
          <div className="access-divider" />
          <button
            type="button"
            className="group-disclosure"
            aria-expanded={groupExpanded}
            onClick={() => setGroupExpanded((expanded) => !expanded)}
          >
            <Link2 size={17} />
            <span>{t('groupInvite')}</span>
            <small>{data?.shared.active ? t('sharedInviteActive') : t('sharedInviteDisabled')}</small>
            <span aria-hidden="true">{groupExpanded ? '−' : '+'}</span>
          </button>
          {groupExpanded && (
            <div className="group-content">
              {groupUrl && (
                <div className="invite-link-row">
                  <input
                    readOnly
                    value={groupUrl}
                    aria-label={t('copyInvite')}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <button className="game-button secondary" onClick={() => void copyLink(groupUrl)}>
                    <Copy size={17} />
                  </button>
                </div>
              )}
              <div className="shared-invite-actions">
                <button className="game-button blue" disabled={busy} onClick={issueGroup}>
                  {data?.shared.active ? t('reissueSharedInvite') : t('createSharedInvite')}
                </button>
                {data?.shared.active && (
                  <button className="game-button secondary" disabled={busy} onClick={revokeGroup}>
                    {t('revokeSharedInvite')}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="users-lists">
          <section className="panel access-panel">
            <h2>
              {t('accounts')} <span className="chip">{data?.accounts.length ?? '—'}</span>
            </h2>
            {!data && <p className="muted">{t('loading')}</p>}
            <div className="accounts-list">
              {data?.accounts.map((person) => (
                <div className={'account-row' + (!person.active ? ' inactive' : '')} key={person.id}>
                  <div>
                    <strong>{person.display_name}</strong>
                    <small>
                      {roleLabel(person.role)} {!person.active && '· ' + t('revoked')}
                    </small>
                  </div>
                  {person.id !== account.id && (owner || person.role === 'member') && (
                    <div className="user-actions">
                      <button
                        className="icon-button"
                        aria-label={t('editUser')}
                        title={t('editUser')}
                        disabled={busy}
                        onClick={() => openEditor(person)}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={t('deleteUser')}
                        title={t('deleteUser')}
                        disabled={busy}
                        onClick={() => deleteAccount(person)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
          <section className="panel access-panel">
            <h2>
              {t('pendingInvites')} <span className="chip">{data ? pending.length : '—'}</span>
            </h2>
            <div className="accounts-list">
              {data && pending.length === 0 && <p className="empty">{t('noPendingInvites')}</p>}
              {pending.map((invite) => (
                <div className="account-row" key={invite.id}>
                  <div>
                    <strong>{invite.label}</strong>
                    <small>
                      {roleLabel(invite.role)} ·{' '}
                      {t('expires', {
                        date: new Date(invite.expires_at).toLocaleDateString(locale),
                      })}
                    </small>
                  </div>
                  {(owner || (invite.role === 'member' && invite.created_by === account.id)) && (
                    <button
                      className="icon-button danger"
                      disabled={busy}
                      aria-label={t('revokeInvite')}
                      onClick={() => revokeInvite(invite)}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
        <MergePlayers onMerged={onMerged} />
      </div>
      {editing && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <section
            className="panel modal user-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('editUser')}
          >
            <header className="modal-header">
              <h2>
                <Pencil size={19} /> {t('editUser')}
              </h2>
              <button
                type="button"
                className="close-button"
                aria-label={t('close')}
                onClick={() => setEditing(null)}
              >
                <X />
              </button>
            </header>
            <form onSubmit={saveUser}>
              <div className="modal-content">
                <label>
                  {t('username')}
                  <input
                    value={editName}
                    minLength={2}
                    maxLength={50}
                    required
                    onChange={(event) => setEditName(event.target.value)}
                  />
                </label>
                <label>
                  {t('role')}
                  <select value={editRole} onChange={(event) => setEditRole(event.target.value as Role)}>
                    <option value="member">{t('memberRole')}</option>
                    {owner && <option value="admin">{t('adminRole')}</option>}
                    {owner && <option value="owner">{t('ownerRole')}</option>}
                  </select>
                </label>
              </div>
              {error && (
                <div className="error-strip" role="alert">
                  {error}
                </div>
              )}
              <footer className="modal-actions">
                <button type="button" className="game-button secondary" onClick={() => setEditing(null)}>
                  {t('cancel')}
                </button>
                <button className="game-button blue" type="submit" disabled={busy}>
                  {t('save')}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
