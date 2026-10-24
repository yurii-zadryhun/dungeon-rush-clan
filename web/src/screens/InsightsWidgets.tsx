import React from 'react';
import { Activity, AlertTriangle, ArrowDownRight, ShieldCheck, Trophy, Users } from 'lucide-react';
import { api, shortNumber, type ClanHealth, type DayAnalytics, type HealthPlayer } from '../api';
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
