import React from 'react';
import { Copy, ShieldOff, UserPlus, Users, X } from 'lucide-react';
import { api, json } from '../api';

interface ManagedAccount {
  id: number;
  username: string;
  display_name: string;
  role: string;
  active: number;
  created_at: number
}

interface Invite {
  id: number;
  label: string;
  role: string;
  expires_at: number;
  used_at: number | null
}

interface Created {
  id: number;
  url: string;
  qr: string;
  role: string;
  label: string
}

export function MembersModal({ onClose }: { onClose: () => void }) {
  const [members, setMembers] = React.useState<ManagedAccount[]>([]);
  const [invites, setInvites] = React.useState<Invite[]>([]);
  const [created, setCreated] = React.useState<Created | null>(null);
  const [label, setLabel] = React.useState('');
  const [role, setRole] = React.useState<'member' | 'admin'>('member');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function refresh() {
    const [a, b] = await Promise.all([api<ManagedAccount[]>('auth/accounts'), api<Invite[]>('auth/invites')]);
    setMembers(a);
    setInvites(b);
  }

  React.useEffect(() => {refresh().catch(e => setError((e as Error).message));}, []);

  async function makeInvite() {
    setBusy(true);
    setError('');
    try {
      setCreated(await api<Created>('auth/invites', json('POST', { label, role })));
      setLabel('');
      await refresh();
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }

  async function revoke(path: string) {
    if (!confirm('Revoke this access?')) return;
    setError('');
    try {
      await api(path, { method: 'DELETE' });
      await refresh();
    } catch (e) {setError((e as Error).message);}
  }

  return <div className="modal-backdrop" onMouseDown={e => {if (e.target === e.currentTarget) onClose();}}>
    <section className="panel modal members-modal" role="dialog" aria-modal="true">
      <header className="modal-header"><h2><Users/> Manage access</h2>
        <button className="close-button" onClick={onClose}><X/></button>
      </header>
      <div className="modal-content">
        <p className="tiny muted">Each user enrolls their own authenticator. Roles are checked server-side. Only the
          owner can manage access.</p>
        <div className="review-head"><h3>Create single-use invitation</h3></div>
        <div className="invite-form"><label>Display name<input value={label} onChange={e => setLabel(e.target.value)}
                                                               placeholder="Clan member"/></label>
          <label>Role<select value={role} onChange={e => setRole(e.target.value as 'member' | 'admin')}>
            <option value="member">Member · read-only</option>
            <option value="admin">Admin · can import and edit</option>
          </select></label>
          <button className="game-button blue" disabled={busy || label.trim().length < 2} onClick={makeInvite}><UserPlus
            size={16}/> Create
          </button>
        </div>
        {created && <div className="created-invite"><h3>{created.label} · {created.role}</h3><img alt="Invite QR code"
                                                                                                  src={created.qr}/>
            <p className="tiny muted">Share this invitation QR or link privately. The recipient sets a password and
                enrolls their own authenticator. Expires in 7 days, one use.</p>
            <button className="game-button blue" onClick={() => navigator.clipboard.writeText(created.url)}><Copy
                size={15}/> Copy invite link
            </button>
        </div>}
        <h3>Accounts</h3>
        <div className="accounts-list">{members.map(m => <div className={'account-row ' + (!m.active ? 'inactive' : '')}
                                                              key={m.id}>
          <div><strong>{m.display_name}</strong><small>{m.username} · {m.role}{!m.active ? ' · revoked' : ''}</small>
          </div>
          {m.role !== 'owner' && !!m.active && <button className="icon-button danger" title="Revoke account"
                                                       onClick={() => revoke('auth/accounts/' + m.id)}><ShieldOff
              size={18}/></button>}
        </div>)}</div>
        <h3>Pending invitations</h3>
        <div className="accounts-list">{invites.filter(i => !i.used_at && i.expires_at > Date.now()).map(i => <div
          className="account-row" key={i.id}>
          <div><strong>{i.label}</strong><small>{i.role} · expires {new Date(i.expires_at).toLocaleDateString()}</small>
          </div>
          <button className="icon-button danger" title="Revoke invite" onClick={() => revoke('auth/invites/' + i.id)}><X
            size={18}/></button>
        </div>)}</div>
      </div>
      {error && <div className="error-strip">{error}</div>}
      <footer className="modal-actions">
        <button className="game-button blue" onClick={onClose}>Done</button>
      </footer>
    </section>
  </div>;
}
