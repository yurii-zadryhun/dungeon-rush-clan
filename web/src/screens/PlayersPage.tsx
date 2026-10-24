import React from 'react';
import { Activity, ArrowUpRight, Search, ShieldCheck, UserRound, Users } from 'lucide-react';
import { api, shortNumber, type Account, type Dashboard, type Player } from '../api';
import { useI18n } from '../i18n';
const UsersScreen = React.lazy(() => import('./UsersScreen').then((m) => ({ default: m.UsersScreen })));
import './PlayersPage.css';

interface DirectoryPlayer {
  id: number;
  name: string;
  active: boolean;
  hasAccount: boolean;
  accountActive: boolean;
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
  const [tab, setTab] = React.useState<'roster' | 'access'>(
    initialAccess && isStaff ? 'access' : 'roster',
  );
  const [members, setMembers] = React.useState<DirectoryPlayer[]>([]);
  const [standaloneAccounts, setStandaloneAccounts] = React.useState<StandaloneAccount[]>([]);
  const [accountsTotal, setAccountsTotal] = React.useState<number | null>(null);
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
        setAccountsTotal(isStaff ? accounts.filter((item) => item.active).length : null);
        const linked = new Set(players.map((player) => player.accountId).filter((id) => id != null));
        setStandaloneAccounts(accounts.filter((item) => !linked.has(item.id)));
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
      if (registration === 'registered' && !(player.hasAccount && player.accountActive)) return false;
      if (registration === 'unregistered' && player.hasAccount && player.accountActive) return false;
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
  const matchingUnlinked =
    isStaff && membership !== 'left' && registration !== 'unregistered'
      ? standaloneAccounts.filter(
          (item) =>
            (membership !== 'active' || !!item.active) &&
            item.display_name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
        )
      : [];

  function merged(next: Dashboard) {
    onMerged(next);
    setRevision((value) => value + 1);
  }

  return (
    <main className="players-page">
      <header className="players-heading">
        <div>
          <h1>
            <Users size={25} /> {t('playersDirectory')}
          </h1>
          <p className="muted">{t('playersDirectoryHelp')}</p>
        </div>
      </header>

      {isStaff && (
            <span>
              <b>{linkedCount}</b>
              {nChoice(
                locale,
                linkedCount,
                t('linkedCountOne'),
                t('linkedCountFew'),
                t('linkedCountMany'),
              )}
            </span>
          )}
        </div>
      </header>

      {isStaff && (
        <div className="players-tabs" role="tablist" aria-label={t('playersDirectory')}>
          <button
            role="tab"
            aria-selected={tab === 'roster'}
            className={tab === 'roster' ? 'selected' : ''}
            onClick={() => setTab('roster')}
          >
            <Users size={16} />
            <span>{t('clanRoster')}</span>
            <small className="players-tab-count">{activeCount}</small>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'access'}
            className={tab === 'access' ? 'selected' : ''}
            onClick={() => setTab('access')}
          >
            <UserRound size={16} />
            <span>{t('accounts')}</span>
            <small className="players-tab-count">{accountsTotal ?? '—'}</small>
          </button>
        </div>
      )}

      {tab === 'access' && isStaff ? (
        <React.Suspense fallback={<p className="muted">{t('loading')}</p>}>
          <UsersScreen account={account} onMerged={merged} />
        </React.Suspense>
      ) : (
        <section className="panel players-directory" aria-label={t('clanRoster')}>
          <div className="players-filters">
            <label className="players-search">
              <Search size={18} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('searchPlayers')}
                aria-label={t('searchPlayers')}
              />
            </label>
            <div className="players-filter-row">
              <div className="players-segments" role="group" aria-label={t('membershipFilter')}>
                {(['active', 'all', 'left'] as const).map((value) => (
                  <button
                    key={value}
                    className={membership === value ? 'selected' : ''}
                    aria-pressed={membership === value}
                    onClick={() => setMembership(value)}
                  >
                    {t(
                      value === 'active'
                        ? 'activePlayersTab'
                        : value === 'left'
                          ? 'formerPlayers'
                          : 'allPlayers',
                    )}
                  </button>
                ))}
              </div>
              <label className="players-filter-select">
                <span>{t('siteAccount')}</span>
                <select
                  value={registration}
                  onChange={(event) => setRegistration(event.target.value as Registration)}
                >
                  <option value="all">{t('allAccounts')}</option>
                  <option value="registered">{t('registeredPlayers')}</option>
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
          {error && (
            <p className="error-strip" role="alert">
              {error}
            </p>
          )}
          {loading && <p className="muted">{t('loading')}</p>}
          {!loading && (
            <>
              <div className="players-result-count">
                {t('matchingPlayers', { count: visible.length })}
              </div>
              {visible.length === 0 && matchingUnlinked.length === 0 && (
                <p className="empty">{t('noMatchingPlayers')}</p>
              )}
              {visible.length > 0 && (
                <div className="players-table" role="table" aria-label={t('clanRoster')}>
                  <div className="players-column-head" role="row">
                    <span role="columnheader">{t('playerColumn')}</span>
                    <span role="columnheader" title={t('calculatedScore')}>{t('scoreColumn')}</span>
                    <span role="columnheader" title={t('latestPoints')}>{t('lastWarColumn')}</span>
                    <span role="columnheader" title={t('weeksParticipated')}>{t('warsColumn')}</span>
                  </div>
                  <div className="players-directory-list" role="rowgroup">
                    {visible.map((player) => (
                      <DirectoryRow key={player.id} player={player} stat={stats.get(player.id)} />
                    ))}
                  </div>
                </div>
              )}
              {matchingUnlinked.length > 0 && (
                <div className="players-unlinked">
                  <h2>
                    <ShieldCheck size={17} /> {t('siteOnlyAccounts')} ({matchingUnlinked.length})
                  </h2>
                  <p className="muted">{t('siteOnlyHelp')}</p>
                  {matchingUnlinked.map((item) => (
                    <div className="players-unlinked-entry" key={item.id}>
                      <span>{item.display_name}</span>
                      <small>
                        {t(
                          item.role === 'owner'
                            ? 'ownerRole'
                            : item.role === 'admin'
                              ? 'adminRole'
                              : 'memberRole',
                        )}
                        {!item.active && ' · ' + t('revoked')}
                      </small>
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
    <div className={'directory-player' + (!player.active ? ' inactive' : '')} role="row">
      <div className="directory-player-main" role="cell">
        <a href={'#/players/' + player.id} className="directory-player-name">
          {player.name} <ArrowUpRight size={15} />
        </a>
        <div className="directory-player-flags">
          <span
            className={
              'directory-flag ' + (player.hasAccount && player.accountActive ? 'linked' : 'unlinked')
            }
          >
            {t(
              player.hasAccount
                ? player.accountActive
                  ? 'registered'
                  : 'revokedAccount'
                : 'notRegistered',
            )}
          </span>
          {player.hasAccount &&
            player.accountActive &&
            player.accountRole &&
            player.accountRole !== 'member' && (
              <span className="directory-flag">
                {t(player.accountRole === 'owner' ? 'ownerRole' : 'adminRole')}
              </span>
            )}
          {!player.active && <span className="directory-flag">{t('left')}</span>}
          {player.telegram && <span className="directory-flag">TG</span>}
          {player.discord && <span className="directory-flag">Discord</span>}
          {player.protected && (
            <span className="directory-flag protected">
              <ShieldCheck size={12} /> {t('protectedPlayer')}
            </span>
          )}
          {player.attention && <span className="directory-flag caution">{t('health_attention')}</span>}
          {stat?.belowRequirement && player.active && (
            <span className="directory-player-low" title={t('underMinimum')} aria-label={t('underMinimum')}>
              <Activity size={14} />
            </span>
          )}
        </div>
      </div>
      <strong className="directory-player-value" role="cell" title={t('calculatedScore')}>
        {stat ? shortNumber(stat.score) : '—'}
      </strong>
      <strong className="directory-player-value" role="cell" title={t('latestPoints')}>
        {stat?.lastPoints == null ? '—' : shortNumber(stat.lastPoints)}
      </strong>
      <span className="directory-player-wars" role="cell" title={t('weeksParticipated')}>
        {player.weeks.length}
      </span>
    </div>
  );
}
