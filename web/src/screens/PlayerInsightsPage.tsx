import React from 'react';
import { ArrowLeft, ArrowUpRight, ChevronDown, Medal, MessageSquareText, TrendingUp, Trophy, Users } from 'lucide-react';
import { api, shortNumber, type Account, type Player, type PlayerProgress } from '../api';
import { formatWarRange } from '../date-format';
import { useI18n } from '../i18n';
import { SearchSelect } from './SearchSelect';
import { PlayerManagementPanel } from './PlayerManagementPanel';
import './PlayerInsights.css';

function ProgressChart({ main, compare }: { main: PlayerProgress; compare: PlayerProgress | null }) {
  const { t } = useI18n();
  const combined = [...new Set([...main.weeks.map(w => w.start), ...(compare?.weeks.map(w => w.start) ?? [])])].sort();
  const values = [...main.weeks.map(w => w.points), ...(compare?.weeks.map(w => w.points) ?? [])];
  const max = Math.max(1, ...values);
  const width = 720, height = 220, padX = 29, top = 14, bottom = 28;
  const x = (i: number) => padX + (i * (width - padX * 2)) / Math.max(1, combined.length - 1);
  const y = (v: number) => top + (1 - v / max) * (height - top - bottom);
  function points(profile: PlayerProgress) {
    const index = new Map(combined.map((start, i) => [start, i]));
    return profile.weeks.map(week => ({
      x: x(index.get(week.start) ?? 0), y: y(week.points), points: week.points, start: week.start,
    }));
  }
  function trace(profile: PlayerProgress, color: string) {
    const p = points(profile);
    return (
      <g>
        {p.slice(1).map((point, i) => {
          const previous = p[i];
          // Weeks missing in this series must not be connected as an unbroken run.
          if (combined.indexOf(point.start) - combined.indexOf(previous.start) !== 1) return null;
          return <line key={point.start} x1={previous.x} y1={previous.y} x2={point.x} y2={point.y}
            stroke={color} strokeWidth="3.5" strokeLinecap="round" />;
        })}
        {p.map(point => (
          <circle key={point.start} cx={point.x} cy={point.y} r="4.5"
            stroke="#101115" strokeWidth="2" fill={color}>
            <title>{point.start}: {shortNumber(point.points)}</title>
          </circle>
        ))}
      </g>
    );
  }
  return (
    <div className="progress-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('progressChart')}
        preserveAspectRatio="none">
        {[0, .25, .5, .75, 1].map(v => (
          <g key={v}>
            <line x1={padX} x2={width - padX} y1={y(max * v)} y2={y(max * v)}
              stroke="#615b64" strokeDasharray="4 5" opacity=".65" />
            <text x="2" y={y(max * v) - 5} fill="#d6ccd5" fontSize="10">{shortNumber(max * v)}</text>
          </g>
        ))}
        {main.weeks.length > 0 && trace(main, '#61e980')}
        {compare && trace(compare, '#f7bc55')}
      </svg>
      <div className="progress-legend">
        <span><i className="legend-dot main" />{main.name}</span>
        {compare && <span><i className="legend-dot other" />{compare.name}</span>}
      </div>
      {combined.length > 1 && (
        <div className="chart-dates"><span>{combined[0]}</span><span>{combined.at(-1)}</span></div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return <div className={'profile-metric ' + (tone ?? '')}>
    <strong>{value}</strong><small>{label}</small>
  </div>;
}

export function PlayerInsightsPage({ playerId, account, candidates }: {
  playerId: number;
  account: Account;
  candidates: Player[];
}) {
  const { t, locale } = useI18n();
  const [player, setPlayer] = React.useState<PlayerProgress | null>(null);
  const [compareId, setCompareId] = React.useState<number | null>(null);
  const [comparison, setComparison] = React.useState<PlayerProgress | null>(null);
  const [windowSize, setWindowSize] = React.useState(5);
  const [error, setError] = React.useState('');
  const [working, setWorking] = React.useState(true);
  const canManage = account.role !== 'member';

  React.useEffect(() => {
    let alive = true;
    setWorking(true); setError(''); setPlayer(null); setCompareId(null); setComparison(null);
    api<PlayerProgress>('insights/players/' + playerId)
      .then(data => { if (alive) setPlayer(data); })
      .catch(failure => { if (alive) setError((failure as Error).message); })
      .finally(() => { if (alive) setWorking(false); });
    return () => { alive = false; };
  }, [playerId]);
  React.useEffect(() => {
    if (compareId === null) { setComparison(null); return; }
    let alive = true;
    api<PlayerProgress>('insights/players/' + compareId).then(data => {
      if (alive) setComparison(data);
    }).catch(failure => { if (alive) setError((failure as Error).message); });
    return () => { alive = false; };
  }, [compareId]);

  const recent = player?.weeks.slice(-windowSize) ?? [];
  const average = recent.length ? Math.round(recent.reduce((sum, w) => sum + w.points, 0) / recent.length) : 0;
  const last = player?.weeks.at(-1), previous = player?.weeks.at(-2);
  const difference = last && previous && previous.points
    ? Math.round((last.points - previous.points) * 100 / previous.points) : null;

  return (
    <main className="player-insights-page">
      <a href="#/archive" className="player-back"><ArrowLeft size={17}/>{t('historyTab')}</a>
      {working && <div className="panel profile-placeholder">{t('loading')}</div>}
      {error && <div className="error-strip" role="alert">{error}</div>}
      {player && <>
        <div className="player-profile-top panel">
          <div>
            <div className="profile-eyebrow"><Users size={15}/>{t('playerProfile')}</div>
            <h1>{player.name}</h1>
            <span className={'profile-status ' + (player.active ? 'active' : 'inactive')}>
              {t(player.active ? 'activePlayer' : 'left')}
            </span>
            {player.belowRequirement && <span className="profile-status caution">{t('underMinimum')}</span>}
          </div>
          <div className="profile-score-top">
            <strong>{shortNumber(player.calculatedScore)}</strong><small>{t('calculatedScore')}</small>
          </div>
        </div>

        <div className="player-profile-metrics">
          <Metric label={t('weeksParticipated')} value={player.appearances}/>
          <Metric label={t('averagePerWar')} value={shortNumber(player.average)}/>
          <Metric label={t('personalBest')} value={shortNumber(player.best)}/>
          <Metric label="MVP" value={player.mvpCount}/>
          <Metric label={t('latestPoints')} value={shortNumber(last?.points ?? 0)}
            tone={difference !== null && difference < 0 ? 'muted' : ''}/>
          <Metric label={t('weekChange')} value={difference === null ? '—' : `${difference > 0 ? '+' : ''}${difference}%`}
            tone={difference === null ? '' : difference < 0 ? 'danger' : 'friendly'}/>
        </div>

        <section className="panel player-trends">
          <div className="player-section-heading">
            <h2><TrendingUp size={19}/>{t('performanceHistory')}</h2>
            <div className="profile-compare">
              <label>{t('compareWith')}</label>
              <SearchSelect value={compareId} onChange={setCompareId}
                ariaLabel={t('compareWith')} placeholder={t('selectPlayer')}
                choices={[{ value: null, label: t('noComparison') },
                  ...candidates.filter(item => item.id !== playerId)
                    .map(item => ({ value: item.id, label: item.name }))]}/>
            </div>
          </div>
          <ProgressChart main={player} compare={comparison}/>
          <div className="recent-average">
            <span>{t('recentAverage')}</span>
            <div className="period-options">
              {[3, 5, 10].map(size => <button key={size}
                className={windowSize === size ? 'selected' : ''} onClick={() => setWindowSize(size)}>
                {size}
              </button>)}
            </div>
            <strong>{shortNumber(average)}</strong>
          </div>
        </section>

        <section className="panel profile-history">
          <h2><Medal size={19}/>{t('warHistory')}</h2>
          {!player.weeks.length && <p className="muted">{t('noLeaders')}</p>}
          <div className="profile-history-list">
            {player.weeks.slice().reverse().map(week => (
              <div className="profile-history-row" key={week.start}>
                <span>{formatWarRange(week.start, locale)}</span>
                <small>#{week.position}</small>
                <strong>{shortNumber(week.points)}</strong>
              </div>
            ))}
          </div>
        </section>
        {canManage && <PlayerManagementPanel playerId={player.id}/>}
      </>}
    </main>
  );
}
