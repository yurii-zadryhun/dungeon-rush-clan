import React from 'react';
import { Activity, AlertTriangle, ArrowDownRight, ShieldCheck, Trophy, Users } from 'lucide-react';
import {
  api,
  shortNumber,
  type ClanHealth,
  type ClanRosterTimelineEntry,
  type DayAnalytics,
  type HealthPlayer,
  type WarPointsPoint,
} from '../api';
import { useI18n } from '../i18n';
import './InsightsWidgets.css';

const healthGroups = ['belowRequirement', 'dropping', 'attention', 'joined', 'left'] as const;
type HealthGroup = (typeof healthGroups)[number];

function HealthEntry({ player }: { player: HealthPlayer }) {
  const { t } = useI18n();
  return (
    <a className="health-person" href={'#/players/' + player.id}>
      <span className="health-person-name">
        <strong>{player.name}</strong>
        <span className="health-person-flags">
          {player.telegram && <small>TG</small>}
          {player.discord && <small>DC</small>}
          {player.exception && <small className="protected">{t('protectedPlayer')}</small>}
        </span>
      </span>
      <span className="health-person-score">
        {player.change !== null && (
          <small className={player.change < 0 ? 'negative' : 'positive'}>
            {player.change > 0 ? '+' : ''}
            {player.change}%
          </small>
        )}
        <b>{shortNumber(player.calculated)}</b>
      </span>
    </a>
  );
}

export function ClanHealthWidget() {
  const { t } = useI18n();
  const [data, setData] = React.useState<ClanHealth | null>(null);
  const [selected, setSelected] = React.useState<HealthGroup>('belowRequirement');
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    api<ClanHealth>('insights/health')
      .then((result) => {
        if (active) setData(result);
      })
      .catch((failure) => {
        if (active) setError((failure as Error).message);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="panel insight-widget health-widget">
      <h2>
        <Activity size={19} />
        {t('clanHealth')}
      </h2>
      {error && <p className="error-strip">{error}</p>}
      {!data && !error && <p className="muted tiny">{t('loading')}</p>}
      {data && (
        <>
          <div className="health-counters">
            {healthGroups.map((group) => (
              <button
                className={'health-counter ' + (selected === group ? 'selected ' : '') + group}
                key={group}
                onClick={() => setSelected(group)}
                aria-pressed={selected === group}
              >
                <b>{data[group].length}</b>
                <span>
                  {t(
                    ('health_' + group) as
                      | 'health_belowRequirement'
                      | 'health_dropping'
                      | 'health_attention'
                      | 'health_joined'
                      | 'health_left',
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="health-roster">
            {!data[selected].length && <p className="empty">{t('healthAllGood')}</p>}
            {data[selected].slice(0, 25).map((player) => (
              <HealthEntry key={player.id} player={player} />
            ))}
          </div>
          {!data.previousStart && <p className="muted tiny">{t('healthNeedHistory')}</p>}
        </>
      )}
    </section>
  );
}

export function DayOutcomesWidget() {
  const { t } = useI18n();
  const [data, setData] = React.useState<DayAnalytics | null>(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    api<DayAnalytics>('insights/days')
      .then((result) => {
        if (active) setData(result);
      })
      .catch((failure) => {
        if (active) setError((failure as Error).message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="panel insight-widget day-insights">
      <h2>
        <Trophy size={19} />
        {t('dayWinStats')}
      </h2>
      {error && <p className="error-strip">{error}</p>}
      {!data && !error && <p className="muted tiny">{t('loading')}</p>}
      {data && (
        <>
          <small className="muted">{t('basedOnWars', { count: data.completedWars })}</small>
          <div className="day-insight-grid">
            {data.days.map((day) => (
              <div className="day-insight-row" key={day.day}>
                <span>
                  {t('day')} {day.day} <small>×{day.dayWeight}</small>
                </span>
                <div
                  className="day-progress-rail"
                  role="img"
                  aria-label={t('winRate') + ': ' + (day.winRate ?? 0) + '%'}
                >
                  <div className="day-progress-win" style={{ width: (day.winRate ?? 0) + '%' }} />
                </div>
                <b>{day.winRate === null ? '—' : day.winRate + '%'}</b>
                <small>
                  {day.wins} / {day.total}
                </small>
              </div>
            ))}
          </div>
          <p className="muted tiny">{t('dayStatsHint')}</p>
        </>
      )}
    </section>
  );
}

function trendLine(values: number[], scale: (value: number) => number, color: string) {
  const toX = (index: number) => 48 + (index * 542) / Math.max(1, values.length - 1);
  return (
    <>
      {values.length > 1 && (
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={values.map((value, index) => toX(index) + ',' + scale(value)).join(' ')}
        />
      )}
      {values.map((value, index) => (
        <circle
          key={index}
          cx={toX(index)}
          cy={scale(value)}
          r="5"
          fill={color}
          stroke="#181a20"
          strokeWidth="2"
        >
          <title>{value.toLocaleString()}</title>
        </circle>
      ))}
    </>
  );
}

function shortDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));
}

export function ClanGrowthWidget() {
  const { t, locale } = useI18n();
  const [data, setData] = React.useState<ClanRosterTimelineEntry[] | null>(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    api<ClanRosterTimelineEntry[]>('clan-roster/timeline')
      .then((result) => {
        if (active) setData(result);
      })
      .catch((failure) => {
        if (active) setError((failure as Error).message);
      });
    return () => {
      active = false;
    };
  }, []);

  const series = data ?? [];
  const last = series.at(-1);
  const prior = data && series.length > 1 ? series[series.length - 2] : null;
  const maximum = Math.max(1, ...series.map((entry) => entry.totalPower));
  const toY = (value: number) => 182 - (value / maximum) * 145;

  return (
    <section className="panel insight-widget clan-growth-widget">
      <h2>
        <Activity size={19} /> {t('clanGrowthTitle')}
      </h2>
      {error && <p className="error-strip">{error}</p>}
      {data === null && !error && <p className="muted tiny">{t('loading')}</p>}
      {data && series.length === 0 && <p className="muted">{t('clanGrowthEmpty')}</p>}
      {last && (
        <>
          <div className="growth-headline">
            <div>
              <strong>{last.totalPowerText}</strong>
              <small>{t('clanPower')}</small>
            </div>
            <div>
              <strong>{last.memberCount}</strong>
              <small>{t('clanExpectedCount')}</small>
            </div>
            {prior && (
              <div>
                <strong className={last.totalPower >= prior.totalPower ? 'positive' : 'negative'}>
                  {last.totalPower >= prior.totalPower ? '+' : ''}
                  {prior.totalPower > 0
                    ? ((100 * (last.totalPower - prior.totalPower)) / prior.totalPower).toFixed(1) + '%'
                    : '—'}
                </strong>
                <small>{t('clanPowerChange')}</small>
              </div>
            )}
          </div>
          <div className="growth-plot">
            <svg
              viewBox="0 0 640 285"
              role="img"
              preserveAspectRatio="xMidYMid meet"
              aria-label={t('clanPowerTrend')}
            >
              {[0, 0.5, 1].map((fraction) => (
                <g key={fraction}>
                  <line
                    x1="48"
                    x2="590"
                    y1={toY(maximum * fraction)}
                    y2={toY(maximum * fraction)}
                    stroke="#554c5b"
                    strokeDasharray="4 5"
                  />
                  <text x="5" y={toY(maximum * fraction) - 5} fontSize="12" fill="#d2c9d5">
                    {fraction === 0 ? '0' : last.totalPowerText && fraction === 1 ? 'Max' : '½'}
                  </text>
                </g>
              ))}
              {trendLine(
                series.map((entry) => entry.totalPower),
                toY,
                '#7ee899',
              )}
              <line x1="48" x2="590" y1="232" y2="232" stroke="#6f6574" />
              {series.map((entry, index) => {
                const x = 48 + (index * 542) / Math.max(1, series.length - 1);
                const change = Math.max(1, entry.joined ?? 0, entry.left ?? 0);
                const height = Math.min(36, change * 10);
                return (
                  <g key={entry.id}>
                    {(entry.joined ?? 0) > 0 && (
                      <rect x={x - 8} y={232 - height} width="7" height={height} fill="#75d894">
                        <title>
                          +{entry.joined} {t('clanJoined')}
                        </title>
                      </rect>
                    )}
                    {(entry.left ?? 0) > 0 && (
                      <rect
                        x={x + 1}
                        y="232"
                        width="7"
                        height={Math.min(33, entry.left! * 10)}
                        fill="#ee8e93"
                      >
                        <title>
                          −{entry.left} {t('clanLeft')}
                        </title>
                      </rect>
                    )}
                    {(series.length <= 6 || index === 0 || index === series.length - 1) && (
                      <text x={x} y="279" fill="#bdb7c2" fontSize="12" textAnchor="middle">
                        {shortDate(entry.capturedAt, locale)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="growth-legend">
            <span>
              <i className="growth-dot power" /> {t('clanPowerTrend')}
            </span>
            <span>
              <i className="growth-dot joined" /> {t('clanJoined')}
            </span>
            <span>
              <i className="growth-dot left" /> {t('clanLeft')}
            </span>
          </div>
          <p className="muted tiny">{t('clanSnapshotNote', { count: series.length })}</p>
        </>
      )}
    </section>
  );
}

export function WarPointsWidget() {
  const { t, locale } = useI18n();
  const [data, setData] = React.useState<WarPointsPoint[] | null>(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    api<WarPointsPoint[]>('insights/war-points')
      .then((result) => {
        if (active) setData(result);
      })
      .catch((failure) => {
        if (active) setError((failure as Error).message);
      });
    return () => {
      active = false;
    };
  }, []);

  const series = data ?? [];
  const max = Math.max(1, ...series.map((entry) => entry.total));
  const overall = data?.length
    ? Math.round(series.reduce((sum, entry) => sum + entry.total, 0) / series.length)
    : 0;
  const latest = data?.at(-1);
  const previous = data && series.length > 1 ? series[series.length - 2] : null;

  return (
    <section className="panel insight-widget war-points-widget">
      <h2>
        <Trophy size={19} /> {t('warPointsTitle')}
      </h2>
      {error && <p className="error-strip">{error}</p>}
      {data === null && !error && <p className="muted tiny">{t('loading')}</p>}
      {data?.length === 0 && <p className="muted">{t('warPointsEmpty')}</p>}
      {latest && (
        <>
          <div className="growth-headline">
            <div>
              <strong>{shortNumber(latest.total)}</strong>
              <small>{t('warPointsLast')}</small>
            </div>
            <div>
              <strong>{shortNumber(overall)}</strong>
              <small>{t('warPointsAverage')}</small>
            </div>
            <div>
              <strong>{shortNumber(latest.average)}</strong>
              <small>{t('warPointsPerPlayer')}</small>
            </div>
          </div>
          <div className="growth-plot">
            <svg viewBox="0 0 640 235" role="img" aria-label={t('warPointsTitle')}>
              {[0, 0.5, 1].map((fraction) => (
                <g key={fraction}>
                  <line
                    x1="48"
                    x2="590"
                    y1={190 - fraction * 150}
                    y2={190 - fraction * 150}
                    stroke="#514d59"
                    strokeDasharray="4 5"
                  />
                  <text x="3" y={185 - fraction * 150} fontSize="12" fill="#c9c0cb">
                    {shortNumber(max * fraction)}
                  </text>
                </g>
              ))}
              {trendLine(
                series.map((entry) => entry.total),
                (value) => 190 - (value / max) * 150,
                '#88c7f5',
              )}
              {series
                .filter((_, index) => series.length <= 6 || index === 0 || index === series.length - 1)
                .map((entry) => {
                  const x = 48 + (series.indexOf(entry) * 542) / Math.max(1, series.length - 1);
                  return (
                    <text
                      key={entry.start}
                      x={x}
                      y="226"
                      fill="#bfbac5"
                      fontSize="12"
                      textAnchor="middle"
                    >
                      {shortDate(entry.start, locale)}
                    </text>
                  );
                })}
            </svg>
          </div>
          {previous && (
            <p className="muted tiny">
              {t('warPointsDelta')}: {latest.total >= previous.total ? '+' : ''}
              {shortNumber(latest.total - previous.total)}
              {' · '}
              {t('warPointsPlayers')}: {latest.playerCount}
            </p>
          )}
        </>
      )}
    </section>
  );
}
