import React from 'react';
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
import { useI18n, type Locale } from '../i18n';
import { ImportModal } from './ImportModal';
import { EditWarModal } from './EditWarModal';
import { UsersScreen } from './UsersScreen';
import { SiteHeader } from './SiteHeader';
import { PlayerInsightsPage } from './PlayerInsightsPage';
import { ClanHealthWidget, DayOutcomesWidget } from './InsightsWidgets';
import { SettingsModal } from './SettingsModal';
import { ProfileModal } from './ProfileModal';
import { WikiScreen } from '../wiki/WikiScreen';

type PlayerMetric = 'average' | 'lastPoints';

function Leaders({
  title,
  players,
  metric,
  account,
}: {
  title: string;
  players: Player[];
  metric: PlayerMetric;
  account: Account;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = React.useState(false);
  return (
    <section className={'panel leaders-widget' + (expanded ? ' expanded' : '')}>
      <header className="widget-head">
        <h2>
          <Medal size={19} /> {title}
        </h2>
        <span className="chip">{t(metric === 'average' ? 'averagePerWar' : 'weeklyPoints')}</span>
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
              <a className="player-profile-link" href={'#/players/' + player.id}>{player.name}</a>
              <small>
                {player.appearances} {t(player.appearances === 1 ? 'warsSingular' : 'warsPlural')}{' '}
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

function DayTable({ week, clanName }: { week: Week; clanName: string }) {
  const { t } = useI18n();
  return (
    <div className="day-table">
      <div className="day-table-header">
        <span>{t('day')}</span>
        <span>{t('pts')}</span>
        <span>{t('winner')}</span>
        <span>MVP</span>
      </div>
      {week.days.map((day) => {
        const winningClan = day.winner === 'ours' ? clanName : (week.opponent ?? t('opponent'));
        return (
          <div className={'day-row ' + day.winner} key={day.day}>
            <span>
              {t('day')} {day.day}
            </span>
            <b>{day.points}</b>
            <span className="day-winner" title={winningClan}>
              {winningClan}
            </span>
            <span className="daily-mvp" title={day.mvp}>
              {day.mvp}
            </span>
          </div>
        );
      })}
    </div>
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
  clanName,
  canEdit,
  account,
}: {
  week: Week;
  onImport: (week: Week) => void;
  onEdit: (week: Week) => void;
  calculated: Map<number, Player>;
  clanName: string;
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
        {week.resultImported ? (
          <>
            <h3>{t('dailyScores')}</h3>
            <DayTable week={week} clanName={clanName} />
          </>
        ) : (
          <div className="war-placeholder">{t('finalPending')}</div>
        )}
        <div className="war-roster-head">
          <h3>{t('players')}</h3>
          {week.rankingImported && <span className="tiny muted">{week.players.length}</span>}
        </div>
        {week.rankingImported ? (
          <div className="war-player-list">
            {week.players.map((player) => {
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
                  <a className="roster-name player-profile-link" title={player.name}
                    href={'#/players/' + player.id}>{player.name}</a>
                  <b>{shortNumber(player.points)}</b>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="war-placeholder">{t('rankingPending')}</div>
        )}
        {canImport && (
          <button className="game-button blue full import-btn" onClick={() => onImport(week)}>
            + {importLabel(week)}
          </button>
        )}
        {canEdit && imported && (
          <button className="war-edit-button" onClick={() => onEdit(week)}>
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
      <div className="eyebrow">
        <Swords size={15} /> {t('clanOverview')}
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
  onLocaleChange,
  onProfileChange,
  error,
}: {
  user: Account;
  data: Dashboard | null;
  onChange: (next: Dashboard) => void;
  onLogout: () => void;
  onLocaleChange: (locale: Locale) => void;
  onProfileChange: (account: Account) => Promise<void>;
  error: string;
}) {
  const { t } = useI18n();
  const [route, setRoute] = React.useState(() => window.location.hash);
  const wikiMatch = route.match(/^#\/wiki(?:\/([a-z0-9-]+))?\/?$/);
  const isWiki = Boolean(wikiMatch);
  const isUsers = route === '#/users' && user.role !== 'member';
  const playerMatch = route.match(/^#\/players\/(\d+)\/?$/);
  const playerId = playerMatch ? Number(playerMatch[1]) : null;
  const wikiArticleId = wikiMatch?.[1];
  const [dialog, setDialog] = React.useState<'settings' | 'profile' | null>(null);
  const [importWeek, setImportWeek] = React.useState<Week | null>(null);
  const [editWeek, setEditWeek] = React.useState<Week | null>(null);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
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
    if (isWiki || isUsers || playerId !== null) positioned.current = false;
  }, [isWiki, isUsers, playerId]);

  React.useLayoutEffect(() => {
    if (!data || isWiki || isUsers || playerId !== null || positioned.current) return;
    if (!visibleWeeks.some((week) => week.start === data.currentStart)) return;
    const container = track.current;
    const selected = [...(container?.querySelectorAll<HTMLElement>('.war-column') ?? [])].find(
      (element) => element.dataset.start === data.currentStart,
    );
    if (!container || !selected) return;
    const relativeLeft = selected.getBoundingClientRect().left - container.getBoundingClientRect().left;
    container.scrollLeft += relativeLeft - (container.clientWidth - selected.clientWidth) / 2;
    positioned.current = true;
  }, [data?.currentStart, visibleWeeks, isWiki, isUsers, playerId]);

  React.useLayoutEffect(() => {
    const container = track.current;
    const snapshot = restore.current;
    if (!container || !snapshot || isWiki || isUsers) return;
    // Keep the same card under the pointer when older data is prepended.
    container.scrollLeft = snapshot.left + container.scrollWidth - snapshot.width;
    restore.current = null;
  }, [weeks, isWiki, isUsers]);

  async function loadOlder() {
    if (!weeks.length || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const container = track.current;
      if (container) restore.current = { left: container.scrollLeft, width: container.scrollWidth };
      const anchor = previousTuesday(weeks[0].start);
      const next = await api<Dashboard>('dashboard?anchor=' + encodeURIComponent(anchor) + '&count=2');
      const older = next.weeks.filter(
        (week) => !weeks.some((existing) => existing.start === week.start),
      );
      setWeeks((previous) => [...older, ...previous]);
    } catch (failure) {
      restore.current = null;
      alert((failure as Error).message);
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
        <span className="spinner" /> {error || t('loadingRecords')}
      </main>
    );
  return (
    <div className="page">
      <SiteHeader
        user={user}
        isWiki={isWiki}
        isUsers={isUsers}
        onSettings={() => setDialog('settings')}
        onProfile={() => setDialog('profile')}
        onLogout={onLogout}
        onLocaleChange={onLocaleChange}
      />

      {isWiki ? (
        <WikiScreen articleId={wikiArticleId} />
      ) : isUsers ? (
        <UsersScreen account={user} onMerged={next => { setWeeks([]); onChange(next); }} />
      ) : playerId !== null ? (
        <PlayerInsightsPage key={playerId} playerId={playerId} account={user}
          candidates={data.rankings.calculated} />
      ) : (
        <main className="dashboard">
          {error && <div className="error-strip">{error}</div>}
          <div className="dashboard-top">
            <ClanOverview data={data} />
            <Leaders
              title={t('allTimeLeaders')}
              players={data.rankings.allTime}
              metric="average"
              account={user}
            />
            <Leaders
              title={t('latestLeaders')}
              players={data.rankings.latest}
              metric="lastPoints"
              account={user}
            />
          </div>
          <div className="insights-grid">
            {canEdit && <ClanHealthWidget />}
            <DayOutcomesWidget />
          </div>
          <section className="panel history-widget">
            <header className="widget-head timeline-heading">
              <h2>
                <History size={20} /> {t('warHistory')}
              </h2>
            </header>
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
                    clanName={data.rankings.settings.clanName}
                  />
                ))}
              </div>
            </div>
          </section>
        </main>
      )}

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
        <ProfileModal account={user} onClose={() => setDialog(null)} onSaved={onProfileChange} />
      )}
    </div>
  );
}
