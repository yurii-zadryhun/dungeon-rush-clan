import React from 'react';
import { Activity, ArrowUpRight, GitMerge, Search, ShieldCheck, UserRound, Users } from 'lucide-react';
import { api, shortNumber, type Account, type Dashboard, type Player } from '../api';
import { useI18n } from '../i18n';
import { UsersScreen } from './UsersScreen';
import './PlayersPage.css';

interface DirectoryPlayer {
  id: number;
  name: string;
  active: boolean;
  hasAccount: boolean;
  accountLinked: boolean;
  accountRole: Account['role'] | null;
  accountId?: number | null;
  weeks: string[];
  telegram?: boolean;
  discord?: boolean;
  protected?: boolean;
  attention?: boolean;
}
interface StandaloneAccount {
  id: number;
  display_name: string;
  role: Account['role'];
  active: number;
}
type Membership = 'active' | 'all' | 'left';
type Registration = 'all' | 'registered' | 'unregistered';
type Order = 'score' | 'latest' | 'name';

export function PlayersPage({
  account,
  dashboard,
  onMerged,
  initialAccess = false,
}: {
  account: Account;
  dashboard: Dashboard;
  onMerged: (data: Dashboard) => void;
  initialAccess?: boolean;
}) {
  const { t } = useI18n();
  const isStaff = account.role !== 'member';
  const [tab, setTab] = React.useState<'roster' | 'access'>(initialAccess && isStaff ? 'access' : 'roster');
  const [members, setMembers] = React.useState<DirectoryPlayer[]>([]);
  const [standaloneAccounts, setStandaloneAccounts] = React.useState<StandaloneAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [revision, setRevision] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [membership, setMembership] = React.useState<Membership>('active');
  const [registration, setRegistration] = React.useState<Registration>('all');
  const [order, setOrder] = React.useState<Order>('score');

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([
      api<DirectoryPlayer[]>('players'),
      isStaff ? api<StandaloneAccount[]>('auth/accounts') : Promise.resolve([]),
    ])
      .then(([players, accounts]) => {
        if (!alive) return;
        setMembers(players);
        setStandaloneAccounts(accounts.filter((item) => !players.some((p) => p.accountId === item.id)));
      })
      .catch((failure) => {
        if (alive) setError((failure as Error).message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isStaff, revision, tab]);

  const stats = new Map(dashboard.rankings.calculated.map((player) => [player.id, player]));
  const visible = members
    .filter((player) => {
      if (membership === 'active' && !player.active) return false;
      if (membership === 'left' && player.active) return false;
      if (registration === 'registered' && !player.hasAccount) return false;
      if (registration === 'unregistered' && player.hasAccount) return false;
      return player.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    })
    .sort((a, b) => {
      const aScore = stats.get(a.id);
      const bScore = stats.get(b.id);
      if (order === 'name') return a.name.localeCompare(b.name);
      if (order === 'latest')
        return (bScore?.lastPoints ?? -1) - (aScore?.lastPoints ?? -1) || a.name.localeCompare(b.name);
      return (bScore?.score ?? 0) - (aScore?.score ?? 0) || a.name.localeCompare(b.name);
    });
  const activeCount = members.filter((player) => player.active).length;
  const registeredCount = members.filter((player) => player.active && player.hasAccount).length;

  function merged(next: Dashboard) {
    onMerged(next);
    setRevision((value) => value + 1);
  }

  return (
    <main className="players-page">
      <header className="players-heading">
        <div>
          <h1><Users size={25} /> {t('playersDirectory')}</h1>
          <p className="muted">{t('playersDirectoryHelp')}</p>
        </div>
        <div className="players-overview">
          <span><b>{activeCount}</b>{t('activePlayer')}</span>
          <span><b>{registeredCount}</b>{t('registered')}</span>
        </div>
      </header>

      {isStaff && (
        <div className="players-tabs" role="tablist" aria-label={t('playersDirectory')}>
          <button role="tab" aria-selected={tab === 'roster'}
            className={tab === 'roster' ? 'selected' : ''} onClick={() => setTab('roster')}>
            <Users size={16} /> {t('clanRoster')}
          </button>
          <button role="tab" aria-selected={tab === 'access'}
            className={tab === 'access' ? 'selected' : ''} onClick={() => setTab('access')}>
            <UserRound size={16} /> {t('accountsAndInvites')}
          </button>
        </div>
      )}

      {tab === 'access' && isStaff ? (
        <UsersScreen account={account} onMerged={merged} />
      ) : (
        <section className="panel players-directory" aria-label={t('clanRoster')}>
          <div className="players-filters">
            <label className="players-search">
              <Search size={18} />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder={t('searchPlayers')} aria-label={t('searchPlayers')} />
            </label>
            <div className="players-filter-row">
              <div className="players-segments" role="group" aria-label={t('membershipFilter')}>
                {(['active', 'all', 'left'] as const).map((value) => (
                  <button key={value} className={membership === value ? 'selected' : ''}
                    aria-pressed={membership === value} onClick={() => setMembership(value)}>
                    {t(value === 'active' ? 'activePlayer' : value === 'left' ? 'formerPlayers' : 'allPlayers')}
                  </button>
                ))}
              </div>
              <label className="players-filter-select">
                <span>{t('siteAccount')}</span>
                <select value={registration} onChange={(event) => setRegistration(event.target.value as Registration)}>
                  <option value="all">{t('allAccounts')}</option>
                  <option value="registered">{t('registered')}</option>
                  <option value="unregistered">{t('notRegistered')}</option>
                </select>
              </label>
              <label className="players-filter-select">
                <span>{t('sortBy')}</span>
                <select value={order} onChange={(event) => setOrder(event.target.value as Order)}>
                  <option value="score">{t('calculatedScore')}</option>
                  <option value="latest">{t('latestPoints')}</option>
                  <option value="name">{t('name')}</option>
                </select>
              </label>
            </div>
          </div>
          {error && <p className="error-strip" role="alert">{error}</p>}
          {loading && <p className="muted">{t('loading')}</p>}
          {!loading && (
            <>
              <div className="players-result-count">{t('matchingPlayers', { count: visible.length })}</div>
              {visible.length === 0 && <p className="empty">{t('noMatchingPlayers')}</p>}
              <div className="players-directory-list">
                {visible.map((player) => (
                  <DirectoryRow key={player.id} player={player} stat={stats.get(player.id)} />
                ))}
              </div>
              {isStaff && standaloneAccounts.length > 0 && membership !== 'left' && registration !== 'unregistered' && !search && (
                <div className="players-unlinked">
                  <h2><ShieldCheck size={17} /> {t('siteOnlyAccounts')} ({standaloneAccounts.length})</h2>
                  <p className="muted">{t('siteOnlyHelp')}</p>
                  {standaloneAccounts.map((item) => (
                    <div className="players-unlinked-entry" key={item.id}>
                      <span>{item.display_name}</span>
                      <small>{t(item.role === 'owner' ? 'ownerRole' : item.role === 'admin' ? 'adminRole' : 'memberRole')}
                        {!item.active && ' · ' + t('revoked')}</small>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}

function DirectoryRow({ player, stat }: { player: DirectoryPlayer; stat?: Player }) {
  const { t } = useI18n();
  return (
    <div className={'directory-player' + (!player.active ? ' inactive' : '')}>
      <div className="directory-player-main">
        <a href={'#/players/' + player.id} className="directory-player-name">
          {player.name} <ArrowUpRight size={15} />
        </a>
        <div className="directory-player-flags">
          <span className={'directory-flag ' + (player.hasAccount ? 'linked' : 'unlinked')}>
            {t(player.hasAccount ? 'registered' : player.accountLinked ? 'revokedAccount' : 'notRegistered')}
          </span>
          {player.hasAccount && player.accountRole && player.accountRole !== 'member' && (
            <span className="directory-flag">{t(player.accountRole === 'owner' ? 'ownerRole' : 'adminRole')}</span>
          )}
          {!player.active && <span className="directory-flag">{t('left')}</span>}
          {player.telegram && <span className="directory-flag">TG</span>}
          {player.discord && <span className="directory-flag">Discord</span>}
          {player.protected && <span className="directory-flag protected"><ShieldCheck size={12} /> {t('protectedPlayer')}</span>}
          {player.attention && <span className="directory-flag caution">{t('health_attention')}</span>}
        </div>
      </div>
      <div className="directory-player-metrics">
        <span><strong>{shortNumber(stat?.score ?? 0)}</strong><small>{t('calculatedScore')}</small></span>
        <span><strong>{stat?.lastPoints == null ? '—' : shortNumber(stat.lastPoints)}</strong><small>{t('latestPoints')}</small></span>
        <span><strong>{player.weeks.length}</strong><small>{t('weeksParticipated')}</small></span>
      </div>
      {stat?.belowRequirement && player.active && (
        <span className="directory-player-low" title={t('underMinimum')}><Activity size={15} /></span>
      )}
    </div>
  );
}
