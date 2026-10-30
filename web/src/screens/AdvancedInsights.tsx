import React from 'react';
import { Activity, ChartScatter, TrendingUp, Users } from 'lucide-react';
import { api, shortNumber, type ExtendedInsights } from '../api';
import { useI18n } from '../i18n';
import './AdvancedInsights.css';

function ScatterPlot({ data }: { data: ExtendedInsights['powerContribution'] }) {
  const maxPower = Math.max(1, ...data.map((item) => item.power));
  const maxPoints = Math.max(1, ...data.map((item) => item.points));
  const logPower = (power: number) => Math.log10(Math.max(1, power));
  const maximum = logPower(maxPower);
  const minimum = Math.min(maximum, ...data.map((item) => logPower(item.power)));
  const scaleX = (power: number) => 40 + 520 * (logPower(power) - minimum) / Math.max(1, maximum - minimum);
  const scaleY = (points: number) => 215 - 170 * points / maxPoints;
  return (
    <svg className="advanced-scatter" viewBox="0 0 600 260" role="img" aria-label="Power versus contribution">
      {[0, 0.5, 1].map((fraction) => (
        <g key={fraction}>
          <line x1="40" x2="560" y1={scaleY(fraction * maxPoints)} y2={scaleY(fraction * maxPoints)} stroke="#504b57" strokeDasharray="4 4" />
          <text x="2" y={scaleY(fraction * maxPoints) + 5} fill="#ccc" fontSize="11">{shortNumber(maxPoints * fraction)}</text>
        </g>
      ))}
      {data.map((item) => (
        <a href={'#/players/' + item.id} key={item.id}>
          <circle cx={scaleX(item.power)} cy={scaleY(item.points)} r="5" fill="#8ecdf4" opacity=".82">
            <title>{item.name}: {shortNumber(item.power)} · {shortNumber(item.points)}</title>
          </circle>
        </a>
      ))}
      <text x="300" y="252" fill="#c5c0cb" textAnchor="middle" fontSize="12">Power (log scale)</text>
    </svg>
  );
}

export function AdvancedInsights() {
  const { locale } = useI18n();
  const uk = locale === 'uk';
  const [data, setData] = React.useState<ExtendedInsights | null>(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    api<ExtendedInsights>('insights/extended')
      .then((result) => { if (active) setData(result); })
      .catch((reason) => { if (active) setError((reason as Error).message); });
    return () => { active = false; };
  }, []);
  if (error) return <div className="panel error-strip" role="alert">{error}</div>;
  if (!data) return <div className="panel">{uk ? 'Завантаження аналітики…' : 'Loading analytics…'}</div>;
  const groups = [
    { label: uk ? 'Новачки' : 'Newcomers', value: data.activityGroups.newcomer },
    { label: uk ? 'Нижче мінімуму' : 'Below minimum', value: data.activityGroups.below },
    { label: uk ? 'Виконують мінімум' : 'Meeting minimum', value: data.activityGroups.meeting },
    { label: uk ? 'Удвічі вище' : 'Exceeding 2×', value: data.activityGroups.exceeding },
  ];
  return (
    <div className="advanced-insights">
      <section className="panel insight-widget">
        <h2><Activity size={19}/> {uk ? 'Активність клану' : 'Clan activity'}</h2>
        <div className="advanced-group-grid">
          {groups.map((group) => <div key={group.label}><strong>{group.value}</strong><small>{group.label}</small></div>)}
        </div>
      </section>
      <section className="panel insight-widget">
        <h2><Users size={19}/> Retention</h2>
        <div className="advanced-retention">
          {data.retention.map((entry) => (
            <div key={entry.wars}><b>{entry.wars} {uk ? 'воєн' : 'wars'}</b>
              <strong>{entry.rate === null ? '—' : entry.rate + '%'}</strong>
              <small>{entry.retained} / {entry.eligible}</small></div>
          ))}
        </div>
      </section>
      <section className="panel insight-widget">
        <h2><ChartScatter size={19}/> Power vs Contribution</h2>
        <ScatterPlot data={data.powerContribution}/>
        {data.asOf && <p className="muted tiny">{uk ? 'Склад за' : 'Roster as of'} {new Date(data.asOf).toLocaleDateString(locale)}</p>}
      </section>
      <section className="panel insight-widget">
        <h2><TrendingUp size={19}/> {uk ? 'Лідери зростання сили' : 'Power growth leaders'}</h2>
        <div className="advanced-ranking">
          {data.powerGrowth.map((player) => (
            <a key={player.id} href={'#/players/' + player.id}>
              <span>{player.name}</span><b>{player.delta >= 0 ? '+' : ''}{shortNumber(player.delta)}</b>
              <small>{player.percentage === null ? '—' : player.percentage + '%'}</small>
            </a>
          ))}
        </div>
      </section>
      <section className="panel insight-widget">
        <h2>{uk ? 'Найстабільніші гравці' : 'Most consistent contributors'}</h2>
        <div className="advanced-ranking">
          {data.consistency.map((player) => (
            <a key={player.id} href={'#/players/' + player.id}>
              <span>{player.name}</span><b>{player.consistency}%</b>
              <small>{shortNumber(player.average)}</small>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
