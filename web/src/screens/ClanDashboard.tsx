import React from 'react';
import { PlayerIdentityProvider, PlayerLink } from './PlayerLink';
import { ChevronsLeft, History, Medal, Pencil, Swords } from 'lucide-react';
import {
  api,
  number,
  previousTuesday,
  shortNumber,
  type Account,
  type Dashboard,
  type Player,
  type Week,
  normalizeName,
} from '../api';
import { formatWarRange } from '../date-format';
import { nChoice, useI18n, type Locale } from '../i18n';

import { SiteHeader } from './SiteHeader';
import { ToastHost, ConfirmationHost, notify } from './Toast';
import { ClanSocialLinks } from './ClanSocialLinks';
import { PersonalDashboard } from './PersonalDashboard';
import './PersonalDashboard.css';
import './WarDetailPage.css';

// Route-only screens and heavy editors should not be bundled into the archive's first paint.
const WikiScreen = React.lazy(() =>
  import('../wiki/WikiScreen').then((m) => ({ default: m.WikiScreen })),
);
const PlayersPage = React.lazy(() => import('./PlayersPage').then((m) => ({ default: m.PlayersPage })));
const AnalyticsPage = React.lazy(() =>
  import('./AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const PlayerInsightsPage = React.lazy(() =>
  import('./PlayerInsightsPage').then((m) => ({ default: m.PlayerInsightsPage })),
);
const WarDetailPage = React.lazy(() =>
  import('./WarDetailPage').then((module) => ({ default: module.WarDetailPage })),
);
const ImportModal = React.lazy(() => import('./ImportModal').then((m) => ({ default: m.ImportModal })));
const EditWarModal = React.lazy(() =>
  import('./EditWarModal').then((m) => ({ default: m.EditWarModal })),
);
const SettingsModal = React.lazy(() =>
  import('./SettingsModal').then((m) => ({ default: m.SettingsModal })),
);
const ProfileModal = React.lazy(() =>
  import('./ProfileModal').then((m) => ({ default: m.ProfileModal })),
);

type PlayerMetric = 'average' | 'lastPoints';

function Leaders({
  allTime,
  latest,
  account,
}: {
  allTime: Player[];
  latest: Player[];
  account: Account;
}) {
  const { t, locale } = useI18n();
  const [metric, setMetric] = React.useState<PlayerMetric>('average');
  const [expanded, setExpanded] = React.useState(false);
  const players = metric === 'average' ? allTime : latest;

  function selectMetric(next: PlayerMetric) {
    setMetric(next);
    setExpanded(false);
  }

  return (
    <section className={'panel leaders-widget' + (expanded ? ' expanded' : '')}>
      <header className="widget-head leaderboard-heading">
        <h2>
          <Medal size={19} /> {t('rankingsTitle')}
        </h2>
        <div className="leaderboard-tabs" role="tablist" aria-label={t('rankingsTitle')}>
          <button
            type="button"
            role="tab"
            aria-selected={metric === 'average'}
            className={metric === 'average' ? 'selected' : ''}
            onClick={() => selectMetric('average')}
          >
            {t('allTimeTab')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={metric === 'lastPoints'}
            className={metric === 'lastPoints' ? 'selected' : ''}
            onClick={() => selectMetric('lastPoints')}
          >
            {t('latestTab')}
          </button>
        </div>
      </header>
      {players.length === 0 && <p className="empty">{t('noLeaders')}</p>}
      <div className="leader-list">
        {(expanded ? players : players.slice(0, 6)).map((player, index) => (
          <div
            key={player.id}
            className={[
              'leader-row',
              !player.active && 'inactive',
              player.belowRequirement && 'below',
              (account.playerId === player.id ||
                (!account.playerId && normalizeName(player.name) === normalizeName(account.username))) &&
                'is-me',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className={'place place-' + index}>{index + 1}</span>
            <div className="leader-name">
              <PlayerLink id={player.id} name={player.name} className="player-profile-link" />
              <small>
                {player.appearances}{' '}
                {nChoice(locale, player.appearances, t('warsSingular'), t('warsFew'), t('warsPlural'))}{' '}
                {!player.active && '· ' + t('left')}
              </small>
            </div>
            <div className="leader-score">
              <b className="score">
                {number(metric === 'average' ? player.average : (player.lastPoints ?? 0))}
              </b>
            </div>
          </div>
        ))}
      </div>
      {players.length > 6 && (
        <button
          className="game-button secondary leader-expand"
          onClick={() => setExpanded((value) => !value)}
        >
          {t(expanded ? 'showLess' : 'showAll')} ({players.length})
        </button>
      )}
    </section>
  );
}

function useWarLabels() {
  const { t } = useI18n();
  function status(week: Week): string {
    if (week.resultImported)
      return t((week.ourScore ?? 0) > (week.opponentScore ?? 0) ? 'victory' : 'defeat');
    if (week.state === 'active') return t('inProgress');
    if (week.state === 'future') return t('upcoming');
    if (week.rankingImported) return t('partial');
    return t('noData');
  }
  function importLabel(week: Week) {
    const ranking = week.permissions.ranking && !week.rankingImported;
    const result = week.permissions.result && !week.resultImported;
    if (ranking && result) return t('importData');
    if (ranking) return t('importRanking');
    return t('importResult');
  }
  return { status, importLabel };
}

function WarColumn({
  week,
  onImport,
  onEdit,
  calculated,
  canEdit,
  account,
}: {
  week: Week;
  onImport: (week: Week) => void;
  onEdit: (week: Week) => void;
  calculated: Map<number, Player>;
  canEdit: boolean;
  account: Account;
}) {
  const { t, locale } = useI18n();
  const { status, importLabel } = useWarLabels();
  const imported = week.rankingImported || week.resultImported;
  const isWin = week.resultImported && (week.ourScore ?? 0) > (week.opponentScore ?? 0);
  const isLoss = week.resultImported && !isWin;
  const canImport =
    canEdit &&
    week.state !== 'future' &&
    ((week.permissions.ranking && !week.rankingImported) ||
      (week.permissions.result && !week.resultImported));
  const classes = [
    'war-column',
    week.state,
    !imported && 'not-imported',
    isWin && 'won',
    isLoss && 'lost',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={classes} data-start={week.start}>
      <header className="war-heading">
        <div className="war-date">{formatWarRange(week.start, locale)}</div>
        <div className="war-status">{status(week)}</div>
      </header>
      <div className="war-content">
        <div className="opponent">{week.opponent || t('unknownOpponent')}</div>
        <div className="war-score">
          {week.resultImported ? (
            <>
              <span className="friendly">{week.ourScore}</span>
              <span>:</span>
              <span className="enemy">{week.opponentScore}</span>
            </>
          ) : (
            <span className="placeholder">— : —</span>
          )}
        </div>
        {week.championship && <span className="war-championship">🏆 Championship</span>}
        {!week.resultImported && <div className="war-placeholder">{t('finalPending')}</div>}
        <div className="war-roster-head">
          <h3>{t('players')}</h3>
          {week.rankingImported && <span className="tiny muted">{week.players.length}</span>}
        </div>
        {week.rankingImported ? (
          <div className="war-player-list">
            {week.players.slice(0, 5).map((player) => {
              const ranking = calculated.get(player.id);
              return (
                <div
                  key={player.id}
                  title={t('calculatedScore') + ': ' + number(ranking?.score ?? 0)}
                  className={[
                    'war-player',
                    !player.active && 'inactive',
                    ranking?.belowRequirement && 'below',
                    (account.playerId === player.id ||
                      (!account.playerId &&
                        normalizeName(player.name) === normalizeName(account.username))) &&
                      'is-me',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="rank-number">{player.position}</span>
                  <PlayerLink id={player.id} name={player.name} className="roster-name player-profile-link" />
                  <b>{shortNumber(player.points)}</b>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="war-placeholder">{t('rankingPending')}</div>
        )}
        {imported && (
          <a className="game-button secondary full" href={'#/wars/' + week.start}>
            {locale === 'uk' ? 'Деталі війни' : 'War details'}
          </a>
        )}
        {canImport && (
          <button className="game-button blue full import-btn" onClick={() => onImport(week)}>
            + {importLabel(week)}
          </button>
        )}
        {canEdit && imported && (
          <button className="game-button secondary full war-edit-button" onClick={() => onEdit(week)}>
            <Pencil size={15} /> {t('editWar')}
          </button>
        )}
      </div>
    </article>
  );
}

function ClanOverview({ data }: { data: Dashboard }) {
  const { t } = useI18n();
  return (
    <section className="panel clan-widget">
      <div className="clan-widget-header">
        <div className="eyebrow">
          <Swords size={15} /> {t('clanOverview')}
        </div>
        <ClanSocialLinks
          telegramUrl={data.rankings.settings.telegramUrl}
          discordUrl={data.rankings.settings.discordUrl}
        />
      </div>
      <div className="clan-summary-line">
        <h1>{data.rankings.settings.clanName}</h1>
        <div className="clan-record">
          <div className="clan-record-entry">
            <strong className="friendly">{data.record.wins}</strong>
            <small>{t('wins')}</small>
          </div>
          <div className="clan-record-entry">
            <strong className="enemy">{data.record.losses}</strong>
            <small>{t('losses')}</small>
          </div>
        </div>
      </div>
      <div className="requirement">
        <span>{t('weeklyRequirement')}</span>
        <b>{shortNumber(data.rankings.settings.minimumPoints)}</b>
      </div>
    </section>
  );
}

export function ClanDashboard({
  user,
  data,
  onChange,
  onLogout,
  onImpersonate,
  onStopImpersonation,
  onLocaleChange,
  onProfileChange,
  onAccountDeleted,
  error,
}: {
  user: Account;
  data: Dashboard | null;
  onChange: (next: Dashboard) => void;
  onLogout: () => void;
  onImpersonate: (account: Account) => void;
  onStopImpersonation: () => Promise<void>;
  onLocaleChange: (locale: Locale) => void;
  onProfileChange: (account: Account) => Promise<void>;
  onAccountDeleted: () => void;
  error: string;
}) {
  const { t } = useI18n();
  const [route, setRoute] = React.useState(() => window.location.hash);
  const wikiMatch = route.match(/^#\/wiki(?:\/([a-z0-9-]+))?\/?$/);
  const isWiki = Boolean(wikiMatch);
  const playerMatch = route.match(/^#\/players\/(\d+)\/?$/);
  const playerId = playerMatch ? Number(playerMatch[1]) : null;
  const warMatch = route.match(/^#\/wars\/(\d{4}-\d{2}-\d{2})\/?$/);
  const warDetailStart = warMatch?.[1] ?? null;
  const isAnalytics = route === '#/analytics';
  const legacyAccessRoute = route === '#/users';
  const isPlayers = route === '#/players' || legacyAccessRoute || playerId !== null;
  const isArchive = !isWiki && !isPlayers && !isAnalytics && !warDetailStart;
  const wikiArticleId = wikiMatch?.[1];
  const [dialog, setDialog] = React.useState<'settings' | 'profile' | null>(null);
  const [importWeek, setImportWeek] = React.useState<Week | null>(null);
  const [editWeek, setEditWeek] = React.useState<Week | null>(null);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [historyError, setHistoryError] = React.useState('');
  const [weeks, setWeeks] = React.useState<Week[]>([]);
  const track = React.useRef<HTMLDivElement>(null);
  const positioned = React.useRef(false);
  const restore = React.useRef<{ width: number; left: number } | null>(null);
  const gesture = React.useRef<{ x: number; atStart: boolean } | null>(null);
  const wheelPull = React.useRef(0);
  const lastPull = React.useRef(0);
  const canEdit = user.role !== 'member';
  const calculated = React.useMemo(
    () => new Map(data?.rankings.calculated.map((player) => [player.id, player]) ?? []),
    [data?.rankings.calculated],
  );
  const visibleWeeks = React.useMemo(() => {
    if (!data) return [];
    const imported = weeks.filter((week) => week.rankingImported || week.resultImported);
    const oldest = imported[0]?.start ?? data.currentStart;
    const blankBefore = previousTuesday(oldest);
    return weeks.filter(
      (week) =>
        week.rankingImported ||
        week.resultImported ||
        week.start === blankBefore ||
        week.start === data.currentStart ||
        week.state === 'future',
    );
  }, [data?.currentStart, weeks]);

  React.useEffect(() => {
    const syncRoute = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  React.useEffect(() => {
    if (!data) return;
    setWeeks((previous) => {
      const byDate = new Map(previous.map((week) => [week.start, week]));
      data.weeks.forEach((week) => byDate.set(week.start, week));
      return [...byDate.values()].sort((left, right) => left.start.localeCompare(right.start));
    });
  }, [data]);

  React.useEffect(() => {
    if (!isArchive) positioned.current = false;
  }, [isArchive]);

  React.useLayoutEffect(() => {
    if (!data || !isArchive || positioned.current) return;
    if (!visibleWeeks.some((week) => week.start === data.currentStart)) return;
    const container = track.current;
    const selected = [...(container?.querySelectorAll<HTMLElement>('.war-column') ?? [])].find(
      (element) => element.dataset.start === data.currentStart,
    );
    if (!container || !selected) return;
    const relativeLeft = selected.getBoundingClientRect().left - container.getBoundingClientRect().left;
    container.scrollLeft += relativeLeft - (container.clientWidth - selected.clientWidth) / 2;
    positioned.current = true;
  }, [data?.currentStart, visibleWeeks, isArchive]);

  React.useLayoutEffect(() => {
    const container = track.current;
    const snapshot = restore.current;
    if (!container || !snapshot || !isArchive) return;
    // Keep the same card under the pointer when older data is prepended.
    container.scrollLeft = snapshot.left + container.scrollWidth - snapshot.width;
    restore.current = null;
  }, [weeks, isArchive]);

  async function loadOlder() {
    if (!weeks.length || loadingOlder) return;
    setLoadingOlder(true);
    setHistoryError('');
    try {
      const container = track.current;
      if (container) restore.current = { left: container.scrollLeft, width: container.scrollWidth };
      const anchor = previousTuesday(weeks[0].start);
      const next = await api<Week[]>('war-weeks?anchor=' + encodeURIComponent(anchor) + '&count=2');
      const older = next.filter((week) => !weeks.some((existing) => existing.start === week.start));
      setWeeks((previous) => [...older, ...previous]);
    } catch (failure) {
      restore.current = null;
      setHistoryError((failure as Error).message);
      notify((failure as Error).message, 'error');
    } finally {
      setLoadingOlder(false);
    }
  }

  function touchStart(event: React.TouchEvent<HTMLDivElement>) {
    gesture.current = {
      x: event.touches[0]?.clientX ?? 0,
      atStart: event.currentTarget.scrollLeft <= 3,
    };
  }

  function touchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const start = gesture.current;
    gesture.current = null;
    if (!start?.atStart || loadingOlder) return;
    const displacement = (event.changedTouches[0]?.clientX ?? 0) - start.x;
    if (displacement > 75 && Date.now() - lastPull.current > 700) {
      lastPull.current = Date.now();
      void loadOlder();
    }
  }

  function wheelScroll(event: React.WheelEvent<HTMLDivElement>) {
    if (event.currentTarget.scrollLeft > 3 || event.deltaX >= 0) {
      wheelPull.current = 0;
      return;
    }
    wheelPull.current += event.deltaX;
    if (wheelPull.current < -90 && !loadingOlder && Date.now() - lastPull.current > 700) {
      lastPull.current = Date.now();
      wheelPull.current = 0;
      void loadOlder();
    }
  }

  if (!data)
    return (
      <main className="loading-page">
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button className="game-button blue" onClick={() => window.location.reload()}>
              {t('retrySave')}
            </button>
          </div>
        ) : (
          <>
            <span className="spinner" /> {t('loadingRecords')}
          </>
        )}
      </main>
    );
  return (
    <PlayerIdentityProvider account={user}>
    <div className="page">
      <ToastHost />
      <ConfirmationHost />
      <SiteHeader
        user={user}
        isWiki={isWiki}
        isPlayers={isPlayers}
        isAnalytics={isAnalytics}
        onSettings={() => setDialog('settings')}
        onProfile={() => setDialog('profile')}
        onLogout={onLogout}
        onLocaleChange={onLocaleChange}
      />

      {user.impersonating && (
        <aside className="impersonation-banner" role="status">
          <span>
            <strong>{t('impersonationActive')}</strong> {user.displayName} ·{' '}
            {t('impersonationOwner', { name: user.impersonating.ownerName })}
          </span>
          <button
            type="button"
            className="impersonation-return"
            onClick={() => void onStopImpersonation()}
          >
            {t('returnToOwner')}
          </button>
        </aside>
      )}

      <React.Suspense
        fallback={
          <main className="loading-page">
            <span className="spinner" /> {t('loading')}
          </main>
        }
      >
        {isWiki ? (
          <WikiScreen articleId={wikiArticleId} />
        ) : playerId !== null ? (
          <PlayerInsightsPage
            key={playerId}
            playerId={playerId}
            account={user}
            candidates={data.rankings.calculated}
          />
        ) : isAnalytics ? (
          <AnalyticsPage account={user} />
        ) : warDetailStart ? (
          <WarDetailPage start={warDetailStart} clanName={data.rankings.settings.clanName} />
        ) : isPlayers ? (
          <PlayersPage
            key={legacyAccessRoute ? 'access' : 'roster'}
            initialAccess={legacyAccessRoute}
            account={user}
            dashboard={data}
            onImpersonate={onImpersonate}
            onMerged={(next) => {
              setWeeks([]);
              onChange(next);
            }}
          />
        ) : (
          <main className="dashboard">
            {error && <div className="error-strip">{error}</div>}
            {user.playerId !== null && <PersonalDashboard account={user} data={data} />}
            <div className="dashboard-top dashboard-top-compact">
              <ClanOverview data={data} />
              <Leaders allTime={data.rankings.allTime} latest={data.rankings.latest} account={user} />
            </div>
            <section className="panel history-widget">
              <header className="widget-head timeline-heading">
                <h2>
                  <History size={20} /> {t('warHistory')}
                </h2>
              </header>
              {historyError && (
                <div className="error-strip" role="alert">
                  {historyError} <button onClick={() => void loadOlder()}>Retry</button>
                </div>
              )}
              <div
                className="timeline-scroll"
                ref={track}
                onTouchStart={touchStart}
                onTouchEnd={touchEnd}
                onWheel={wheelScroll}
              >
                <div className="timeline-track">
                  <button
                    className="war-load-control"
                    disabled={loadingOlder}
                    title={t('pullOlder')}
                    aria-label={t('pullOlder')}
                    onClick={loadOlder}
                  >
                    <ChevronsLeft size={32} />
                  </button>
                  {visibleWeeks.map((week) => (
                    <WarColumn
                      key={week.start}
                      week={week}
                      onImport={setImportWeek}
                      onEdit={setEditWeek}
                      calculated={calculated}
                      canEdit={canEdit}
                      account={user}
                    />
                  ))}
                </div>
              </div>
            </section>
          </main>
        )}
      </React.Suspense>
      <React.Suspense fallback={null}>
        {editWeek && canEdit && (
          <EditWarModal
            key={editWeek.start}
            week={editWeek}
            clanName={data.rankings.settings.clanName}
            onClose={() => setEditWeek(null)}
            onDone={(next, updatedWeek) => {
              onChange(next);
              setWeeks((previous) =>
                previous.map((week) => (week.start === updatedWeek.start ? updatedWeek : week)),
              );
              setEditWeek(null);
            }}
          />
        )}
        {importWeek && canEdit && (
          <ImportModal
            key={importWeek.start}
            week={importWeek}
            clanName={data.rankings.settings.clanName}
            onClose={() => setImportWeek(null)}
            onDone={(next) => {
              onChange(next);
              setImportWeek(null);
            }}
          />
        )}
        {dialog === 'settings' && canEdit && (
          <SettingsModal
            current={data.rankings.settings}
            onClose={() => setDialog(null)}
            onDone={(next) => {
              onChange(next);
              setDialog(null);
            }}
          />
        )}
        {dialog === 'profile' && (
          <ProfileModal
            account={user}
            onClose={() => setDialog(null)}
            onSaved={onProfileChange}
            onDeleted={onAccountDeleted}
          />
        )}
      </React.Suspense>
    </div>
    </PlayerIdentityProvider>
  );
}
