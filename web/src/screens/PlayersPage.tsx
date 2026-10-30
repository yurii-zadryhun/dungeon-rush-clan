import React from 'react';
import {
  Activity,
  ArrowUpRight,
  Gamepad2,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  UploadCloud,
  Users,
} from 'lucide-react';
import {
  api,
  shortNumber,
  type Account,
  type ClanRosterSnapshot,
  type Dashboard,
  type Player,
} from '../api';
import { useI18n } from '../i18n';
const ClanRosterImportModal = React.lazy(() =>
  import('./ClanRosterImportModal').then((m) => ({ default: m.ClanRosterImportModal })),
);
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
type Order = 'score' | 'latest' | 'name' | 'weeks';
type Focus = 'all' | 'newcomer' | 'below' | 'attention';
type SavedView = {
  name: string;
  membership: Membership;
  registration: Registration;
  order: Order;
  search: string;
  focus?: Focus;
  descending?: boolean;
};

export function PlayersPage({
  account,
  dashboard,
  onMerged,
  onImpersonate,
  initialAccess = false,
}: {
  account: Account;
  dashboard: Dashboard;
  onMerged: (data: Dashboard) => void;
  onImpersonate: (account: Account) => void;
  initialAccess?: boolean;
}) {
  const { t, locale } = useI18n();
  const isStaff = account.role !== 'member';
  const [rosterImportOpen, setRosterImportOpen] = React.useState(false);
  const [tab, setTab] = React.useState<'roster' | 'access'>(
    initialAccess && isStaff ? 'access' : 'roster',
  );
  const [members, setMembers] = React.useState<DirectoryPlayer[]>([]);
  const [powerByPlayer, setPowerByPlayer] = React.useState<Map<number, string>>(new Map());
  const [standaloneAccounts, setStandaloneAccounts] = React.useState<StandaloneAccount[]>([]);
  const [accountsTotal, setAccountsTotal] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [revision, setRevision] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [membership, setMembership] = React.useState<Membership>('active');
  const [registration, setRegistration] = React.useState<Registration>('all');
  const [focus, setFocus] = React.useState<Focus>('all');
  const [activeView, setActiveView] = React.useState('');
  const [order, setOrder] = React.useState<Order>('score');
  const [descending, setDescending] = React.useState(true);
  const [viewName, setViewName] = React.useState('');
  const viewsKey = 'clan:player-views:v1:' + account.id;
  const [savedViews, setSavedViews] = React.useState<SavedView[]>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(viewsKey) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.name === 'string').slice(0, 10) : [];
    } catch { return []; }
  });

  function sortBy(field: Order) {
    if (order === field) setDescending((current) => !current);
    else { setOrder(field); setDescending(field !== 'name'); }
  }

  function saveView() {
    const name = viewName.trim().slice(0, 35);
    if (!name) return;
    const next = [...savedViews.filter((item) => item.name !== name),
      { name, membership, registration, order, search, focus, descending }].slice(-10);
    setSavedViews(next);
    localStorage.setItem(viewsKey, JSON.stringify(next));
    setViewName('');
    setActiveView(name);
  }

  function deleteView(name: string) {
    const next = savedViews.filter((item) => item.name !== name);
    setSavedViews(next);
    localStorage.setItem(viewsKey, JSON.stringify(next));
    if (activeView === name) setActiveView('');
  }

  function selectView(name: string) {
    const view = savedViews.find((item) => item.name === name);
    if (!view) return;
    setMembership(view.membership);
    setRegistration(view.registration);
    setOrder(view.order);
    setSearch(view.search);
    setFocus(view.focus ?? 'all');
    setDescending(view.descending ?? view.order !== 'name');
    setActiveView(name);
  }

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([
      api<DirectoryPlayer[]>('players'),
      api<ClanRosterSnapshot | null>('clan-roster/latest'),
      isStaff ? api<StandaloneAccount[]>('auth/accounts') : Promise.resolve([]),
    ])
      .then(([players, rosterSnapshot, accounts]) => {
        if (!alive) return;
        setMembers(players);
        setPowerByPlayer(
          new Map(rosterSnapshot?.entries.map((entry) => [entry.id, entry.powerText]) ?? []),
        );
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
      const stat = stats.get(player.id);
      if (focus === 'newcomer' && !stat?.newcomer) return false;
      if (focus === 'below' && !stat?.belowRequirement) return false;
      if (focus === 'attention' && !player.attention) return false;
      if (membership === 'active' && !player.active) return false;
      if (membership === 'left' && player.active) return false;
      if (registration === 'registered' && !(player.hasAccount && player.accountActive)) return false;
      if (registration === 'unregistered' && player.hasAccount && player.accountActive) return false;
      return player.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    })
    .sort((a, b) => {
      const aScore = stats.get(a.id);
      const bScore = stats.get(b.id);
      const difference = order === 'name'
        ? a.name.localeCompare(b.name)
        : order === 'latest'
          ? (aScore?.lastPoints ?? -1) - (bScore?.lastPoints ?? -1)
          : order === 'weeks'
            ? a.weeks.length - b.weeks.length
            : (aScore?.score ?? 0) - (bScore?.score ?? 0);
      return (descending ? -difference : difference) || a.name.localeCompare(b.name);
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
        {isStaff && (
          <button
            className="game-button blue clan-import-trigger"
            onClick={() => setRosterImportOpen(true)}
          >
            <UploadCloud size={16} /> {t('clanImportTitle')}
          </button>
        )}
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
          <UsersScreen account={account} onMerged={merged} onImpersonate={onImpersonate} />
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
                <select value={order} onChange={(event) => sortBy(event.target.value as Order)}>
                  <option value="score">{t('calculatedScore')}</option>
                  <option value="latest">{t('latestPoints')}</option>
                  <option value="name">{t('name')}</option>
                  <option value="weeks">{t('weeksParticipated')}</option>
                </select>
              </label>
            </div>
            <div className="player-focus-filters" role="group" aria-label={locale === 'uk' ? 'Швидкі фільтри' : 'Quick filters'}>
              {(['all', 'newcomer', 'below', ...(isStaff ? ['attention'] : [])] as Focus[]).map((value) => (
                <button key={value} type="button" className={focus === value ? 'selected' : ''}
                  aria-pressed={focus === value} onClick={() => { setFocus(value); setActiveView(''); }}>
                  {value === 'all' ? (locale === 'uk' ? 'Усі' : 'All') :
                    value === 'newcomer' ? (locale === 'uk' ? 'Новачки' : 'Newcomers') :
                    value === 'below' ? (locale === 'uk' ? 'Нижче мінімуму' : 'Below minimum') :
                    (locale === 'uk' ? 'Увага' : 'Attention')}
                </button>
              ))}
            </div>
            <div className="player-saved-views">
              {savedViews.length > 0 && (
                <div className="player-view-chips">
                  {savedViews.map((view) => (
                    <span className={'player-view-chip' + (activeView === view.name ? ' active' : '')} key={view.name}>
                      <button type="button" onClick={() => selectView(view.name)}>{view.name}</button>
                      <button type="button" aria-label={(locale === 'uk' ? 'Видалити' : 'Delete') + ': ' + view.name}
                        onClick={() => deleteView(view.name)}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="player-view-create">
                <input value={viewName} onChange={(event) => setViewName(event.target.value)}
                  maxLength={35} placeholder={locale === 'uk' ? 'Назва фільтра' : 'View name'}
                  aria-label={locale === 'uk' ? 'Назва фільтра' : 'View name'}/>
                <button type="button" className="game-button secondary" disabled={!viewName.trim()}
                  onClick={saveView}>{locale === 'uk' ? 'Зберегти фільтр' : 'Save view'}</button>
              </div>
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
                    <button role="columnheader" onClick={() => sortBy('name')}>{t('playerColumn')} {order === 'name' ? (descending ? '↓' : '↑') : ''}</button>
                    <button role="columnheader" onClick={() => sortBy('score')}>{t('scoreColumn')} {order === 'score' ? (descending ? '↓' : '↑') : ''}</button>
                    <button role="columnheader" onClick={() => sortBy('latest')}>{t('lastWarColumn')} {order === 'latest' ? (descending ? '↓' : '↑') : ''}</button>
                    <button role="columnheader" onClick={() => sortBy('weeks')}>{t('warsColumn')} {order === 'weeks' ? (descending ? '↓' : '↑') : ''}</button>
                  </div>
                  <div className="players-directory-list" role="rowgroup">
                    {visible.map((player) => (
                      <DirectoryRow
                        key={player.id}
                        player={player}
                        stat={stats.get(player.id)}
                        power={powerByPlayer.get(player.id)}
                      />
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
      {rosterImportOpen && (
        <React.Suspense fallback={null}>
          <ClanRosterImportModal
            onClose={() => setRosterImportOpen(false)}
            onDone={(dashboard) => {
              merged(dashboard);
              setRosterImportOpen(false);
            }}
          />
        </React.Suspense>
      )}
    </main>
  );
}

function DirectoryRow({
  player,
  stat,
  power,
}: {
  player: DirectoryPlayer;
  stat?: Player;
  power?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={'directory-player' + (!player.active ? ' inactive' : '')} role="row">
      <div className="directory-player-main" role="cell">
        <a href={'#/players/' + player.id} className="directory-player-name">
          {player.name} <ArrowUpRight size={15} />
        </a>
        {power && <small className="directory-player-power">⚔ {power}</small>}
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
          {player.telegram && (
            <span
              className="directory-flag social-icon telegram-icon"
              role="img"
              aria-label={t('clanTelegram')}
              title={t('clanTelegram')}
            >
              <Send size={14} aria-hidden="true" />
            </span>
          )}
          {player.discord && (
            <span
              className="directory-flag social-icon discord-icon"
              role="img"
              aria-label={t('clanDiscord')}
              title={t('clanDiscord')}
            >
              <Gamepad2 size={14} aria-hidden="true" />
            </span>
          )}
          {player.protected && (
            <span className="directory-flag protected">
              <ShieldCheck size={12} /> {t('protectedPlayer')}
            </span>
          )}
          {player.attention && <span className="directory-flag caution">{t('health_attention')}</span>}
          {stat?.newcomer && <span className="directory-flag new-player">New</span>}
          {stat?.belowRequirement && player.active && (
            <span
              className="directory-player-low"
              title={t('underMinimum')}
              aria-label={t('underMinimum')}
            >
              <Activity size={14} />
            </span>
          )}
        </div>
      </div>
      <strong className="directory-player-value" role="cell" title={t('calculatedScore')}>
        {stat?.appearances ? shortNumber(stat.score) : '—'}
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
