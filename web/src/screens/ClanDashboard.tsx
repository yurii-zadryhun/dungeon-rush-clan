import React from 'react';
import { ChevronLeft, History, LogOut, Medal, Settings, Swords, Users } from 'lucide-react';
import { api, number, previousTuesday, shortNumber, type Account, type Dashboard, type Player, type Week } from '../api';
import { LanguagePicker, useI18n, type Locale } from '../i18n';
import { ImportModal } from './ImportModal';
import { MembersModal } from './MembersModal';
import { SettingsModal } from './SettingsModal';

type PlayerMetric = 'average' | 'lastPoints';

function Leaders({ title, players, metric }: {
  title: string;
  players: Player[];
  metric: PlayerMetric;
}) {
  const { t } = useI18n();
  return (
    <section className="panel leaders-widget">
      <header className="widget-head">
        <h2><Medal size={19} /> {title}</h2>
        <span className="chip">{t(metric === 'average' ? 'averagePerWar' : 'weeklyPoints')}</span>
      </header>
      {players.length === 0 && <p className="empty">{t('noLeaders')}</p>}
      <div className="leader-list">
        {players.slice(0, 6).map((player, index) => (
          <div key={player.id}
            className={['leader-row', !player.active && 'inactive', player.belowRequirement && 'below'].filter(Boolean).join(' ')}>
            <span className={'place place-' + index}>{index + 1}</span>
            <div className="leader-name">
              <strong>{player.name}</strong>
              <small>{player.appearances} {t(player.appearances === 1 ? 'warsSingular' : 'warsPlural')} {!player.active && '· ' + t('left')}</small>
            </div>
            <div className="leader-score">
              <b className="score">{number(metric === 'average' ? player.average : player.lastPoints ?? 0)}</b>
              <small title={t('calculatedScore')}>{t('calculatedScore')}: {number(player.score)}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DayTable({ week, clanName }: { week: Week; clanName: string }) {
  const { t } = useI18n();
  return (
    <div className="day-table">
      <div className="day-table-header">
        <span>{t('day')}</span><span>{t('pts')}</span><span>{t('winner')}</span><span>MVP</span>
      </div>
      {week.days.map(day => {
        const winningClan = day.winner === 'ours' ? clanName : week.opponent ?? t('opponent');
        return (
          <div className={'day-row ' + day.winner} key={day.day}>
            <span>{t('day')} {day.day}</span>
            <b>{day.points}</b>
            <span className="day-winner" title={winningClan}>{winningClan}</span>
            <span className="daily-mvp" title={day.mvp}>{day.mvp}</span>
          </div>
        );
      })}
    </div>
  );
}

function useWarLabels() {
  const { t } = useI18n();
  function status(week: Week): string {
    if (week.resultImported) return t((week.ourScore ?? 0) > (week.opponentScore ?? 0) ? 'victory' : 'defeat');
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

function WarColumn({ week, onImport, calculated, clanName, canEdit }: {
  week: Week;
  onImport: (week: Week) => void;
  calculated: Map<number, Player>;
  clanName: string;
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const { status, importLabel } = useWarLabels();
  const imported = week.rankingImported || week.resultImported;
  const isWin = week.resultImported && (week.ourScore ?? 0) > (week.opponentScore ?? 0);
  const isLoss = week.resultImported && !isWin;
  const canImport = canEdit && week.state !== 'future' && (
    (week.permissions.ranking && !week.rankingImported)
    || (week.permissions.result && !week.resultImported)
  );
  const classes = [
    'war-column', week.state, !imported && 'not-imported',
    isWin && 'won', isLoss && 'lost',
  ].filter(Boolean).join(' ');

  return (
    <article className={classes} data-start={week.start}>
      <header className="war-heading">
        <div className="war-date">{week.label}</div>
        <div className="war-status">{status(week)}</div>
      </header>
      <div className="war-content">
        <div className="opponent">{week.opponent || t('unknownOpponent')}</div>
        <div className="war-score">
          {week.resultImported ? (
            <><span className="friendly">{week.ourScore}</span><span>:</span><span className="enemy">{week.opponentScore}</span></>
          ) : <span className="placeholder">— : —</span>}
        </div>
        {week.resultImported ? (
          <><h3>{t('dailyScores')}</h3><DayTable week={week} clanName={clanName} /></>
        ) : <div className="war-placeholder">{t('finalPending')}</div>}
        <div className="war-roster-head">
          <h3>{t('players')}</h3>
          {week.rankingImported && <span className="tiny muted">{week.players.length}</span>}
        </div>
        {week.rankingImported ? (
          <div className="war-player-list">
            {week.players.map(player => {
              const ranking = calculated.get(player.id);
              return (
                <div key={player.id} title={t('calculatedScore') + ': ' + number(ranking?.score ?? 0)}
                  className={['war-player', !player.active && 'inactive', ranking?.belowRequirement && 'below'].filter(Boolean).join(' ')}>
                  <span className="rank-number">{player.position}</span>
                  <span className="roster-name" title={player.name}>{player.name}</span>
                  <b>{shortNumber(player.points)}</b>
                </div>
              );
            })}
          </div>
        ) : <div className="war-placeholder">{t('rankingPending')}</div>}
        {canImport && (
          <button className="game-button blue full import-btn" onClick={() => onImport(week)}>
            + {importLabel(week)}
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
      <div className="eyebrow"><Swords size={15} /> {t('clanOverview')}</div>
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
        <b>{data.rankings.settings.minimumPoints / 1000}k</b>
      </div>
    </section>
  );
}

export function ClanDashboard({ user, data, onChange, onLogout, onLocaleChange, error }: {
  user: Account;
  data: Dashboard | null;
  onChange: (next: Dashboard) => void;
  onLogout: () => void;
  onLocaleChange: (locale: Locale) => void;
  error: string;
}) {
  const { t } = useI18n();
  const [dialog, setDialog] = React.useState<'settings' | 'members' | null>(null);
  const [importWeek, setImportWeek] = React.useState<Week | null>(null);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [weeks, setWeeks] = React.useState<Week[]>([]);
  const track = React.useRef<HTMLDivElement>(null);
  const positioned = React.useRef(false);
  const canEdit = user.role !== 'member';
  const calculated = React.useMemo(
    () => new Map(data?.rankings.calculated.map(player => [player.id, player]) ?? []),
    [data?.rankings.calculated],
  );

  React.useEffect(() => {
    if (!data) return;
    setWeeks(previous => {
      const byDate = new Map(previous.map(week => [week.start, week]));
      data.weeks.forEach(week => byDate.set(week.start, week));
      return [...byDate.values()].sort((left, right) => left.start.localeCompare(right.start));
    });
  }, [data]);

  React.useLayoutEffect(() => {
    if (!data || positioned.current || !weeks.some(week => week.start === data.currentStart)) return;
    const container = track.current;
    const selected = [...(container?.querySelectorAll<HTMLElement>('.war-column') ?? [])]
      .find(element => element.dataset.start === data.currentStart);
    if (!container || !selected) return;
    const relativeLeft = selected.getBoundingClientRect().left - container.getBoundingClientRect().left;
    container.scrollLeft += relativeLeft - (container.clientWidth - selected.clientWidth) / 2;
    positioned.current = true;
  }, [data, weeks]);

  async function loadOlder() {
    if (!weeks.length || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const container = track.current;
      const previousWidth = container?.scrollWidth ?? 0;
      const anchor = previousTuesday(weeks[0].start);
      const next = await api<Dashboard>('dashboard?anchor=' + encodeURIComponent(anchor) + '&count=10');
      setWeeks(previous => [
        ...next.weeks.filter(week => !previous.some(existing => existing.start === week.start)),
        ...previous,
      ]);
      requestAnimationFrame(() => {
        if (container) container.scrollLeft += container.scrollWidth - previousWidth;
      });
    } catch (failure) {
      alert((failure as Error).message);
    } finally {
      setLoadingOlder(false);
    }
  }

  if (!data) return <main className="loading-page"><span className="spinner" /> {error || t('loadingRecords')}</main>;
  return (
    <div className="page">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark"><Swords size={26} /></span>
          <div><strong>DUNGEON RUSH</strong><small>{t('appTitle').toUpperCase()}</small></div>
        </div>
        <div className="header-actions">
          <LanguagePicker onSelect={onLocaleChange} />
          <span className="current-user">{user.displayName}</span>
          {canEdit && <button aria-label={t('settings')} title={t('settings')} className="icon-button"
            onClick={() => setDialog('settings')}><Settings size={19} /></button>}
          {user.role === 'owner' && <button aria-label={t('members')} title={t('members')} className="icon-button"
            onClick={() => setDialog('members')}><Users size={19} /></button>}
          <button aria-label={t('logout')} title={t('logout')} className="icon-button" onClick={onLogout}><LogOut size={19} /></button>
        </div>
      </header>

      <main className="dashboard">
        {error && <div className="error-strip">{error}</div>}
        <div className="dashboard-top">
          <ClanOverview data={data} />
          <Leaders title={t('allTimeLeaders')} players={data.rankings.allTime} metric="average" />
          <Leaders title={t('latestLeaders')} players={data.rankings.latest} metric="lastPoints" />
        </div>
        <section className="panel history-widget">
          <header className="widget-head timeline-heading">
            <h2><History size={20} /> {t('warHistory')}</h2>
            <button className="game-button secondary" disabled={loadingOlder} onClick={loadOlder}>
              <ChevronLeft size={17} /> {loadingOlder ? t('loading') : t('olderWars')}
            </button>
          </header>
          <div className="timeline-scroll" ref={track}>
            <div className="timeline-track">
              {weeks.map(week => <WarColumn key={week.start} week={week}
                onImport={setImportWeek} calculated={calculated}
                canEdit={canEdit} clanName={data.rankings.settings.clanName} />)}
            </div>
          </div>
        </section>
      </main>

      {importWeek && canEdit && <ImportModal key={importWeek.start} week={importWeek}
        clanName={data.rankings.settings.clanName} onClose={() => setImportWeek(null)}
        onDone={next => { onChange(next); setImportWeek(null); }} />}
      {dialog === 'settings' && canEdit && <SettingsModal current={data.rankings.settings}
        onClose={() => setDialog(null)}
        onDone={next => { onChange(next); setDialog(null); }} />}
      {dialog === 'members' && user.role === 'owner' && <MembersModal onClose={() => setDialog(null)} />}
    </div>
  );
}
