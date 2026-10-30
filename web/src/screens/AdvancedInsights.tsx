import React from 'react';
import { Activity, Scale, TrendingUp, Users } from 'lucide-react';
import { api, shortNumber, type ExtendedInsights } from '../api';
import { useI18n } from '../i18n';
import './AdvancedInsights.css';
import { DataTable, DataTableRow, DataTableCell } from './DataTable';
import { PlayerLink } from './PlayerLink';
import { formatWarRange } from '../date-format';

/** Contribution share minus power share, in percentage points; not a combat model. */
export function contributionBalance(data: ExtendedInsights['powerContribution']) {
  const powerTotal = data.reduce((sum, item) => sum + Math.max(0, item.power), 0);
  const pointsTotal = data.reduce((sum, item) => sum + Math.max(0, item.points), 0);
  return data.map((item) => {
    const powerShare = powerTotal ? item.power / powerTotal : 0;
    const pointsShare = pointsTotal ? item.points / pointsTotal : 0;
    return { ...item, powerShare, pointsShare, surplus: 100 * (pointsShare - powerShare) };
  });
}

export function AdvancedInsights() {
  const { locale } = useI18n();
  const uk = locale === 'uk';
  const [data, setData] = React.useState<ExtendedInsights | null>(null);
  const [error, setError] = React.useState('');
  const [powerSort, setPowerSort] = React.useState<'surplus' | 'points' | 'power'>('surplus');
  const [descending, setDescending] = React.useState(true);
  React.useEffect(() => {
    let active = true;
    api<ExtendedInsights>('insights/extended')
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason) => {
        if (active) setError((reason as Error).message);
      });
    return () => {
      active = false;
    };
  }, []);
  if (error)
    return (
      <div className="panel error-strip" role="alert">
        {error}
      </div>
    );
  if (!data) return <div className="panel">{uk ? 'Завантаження аналітики…' : 'Loading analytics…'}</div>;
  const balance = contributionBalance(data.powerContribution).sort(
    (left, right) =>
      (descending ? -1 : 1) * (left[powerSort] - right[powerSort]) ||
      left.name.localeCompare(right.name),
  );
  function sortBalance(value: 'surplus' | 'points' | 'power') {
    if (powerSort === value) setDescending((current) => !current);
    else {
      setPowerSort(value);
      setDescending(true);
    }
  }
  const marker = (value: 'surplus' | 'points' | 'power') =>
    powerSort === value ? (descending ? ' ↓' : ' ↑') : '';
  const groups = [
    { label: uk ? 'Новачки' : 'Newcomers', value: data.activityGroups.newcomer },
    { label: uk ? 'Нижче мінімуму' : 'Below minimum', value: data.activityGroups.below },
    { label: uk ? 'Виконують мінімум' : 'Meeting minimum', value: data.activityGroups.meeting },
    { label: uk ? 'Удвічі вище' : 'Exceeding 2×', value: data.activityGroups.exceeding },
  ];
  return (
    <div className="advanced-insights">
      <section className="panel insight-widget">
        <h2>
          <Activity size={19} /> {uk ? 'Активність клану' : 'Clan activity'}
        </h2>
        <div className="advanced-group-grid">
          {groups.map((group) => (
            <div key={group.label}>
              <strong>{group.value}</strong>
              <small>{group.label}</small>
            </div>
          ))}
        </div>
        <p className="muted tiny">
          {uk
            ? 'Новачки також враховуються в категоріях очок; три категорії за очками не перетинаються.'
            : 'Newcomers also belong to a points tier; the three points tiers do not overlap.'}
        </p>
      </section>
      <section className="panel insight-widget">
        <h2>
          <Users size={19} /> Retention
        </h2>
        <div className="advanced-retention">
          {data.retention.map((entry) => (
            <div key={entry.wars}>
              <b>
                {entry.wars} {uk ? 'воєн' : 'wars'}
              </b>
              <strong>{entry.rate === null ? '—' : entry.rate + '%'}</strong>
              <small>
                {entry.eligible > 0
                  ? entry.retained + ' / ' + entry.eligible
                  : uk
                    ? 'Недостатньо даних'
                    : 'Not enough data'}
              </small>
            </div>
          ))}
        </div>
      </section>
      <section className="panel insight-widget advanced-balance">
        <h2>
          <Scale size={19} /> {uk ? 'Сила та внесок' : 'Power vs Contribution'}
        </h2>
        <p className="muted tiny">
          {uk
            ? 'Різниця між часткою очок і часткою сили серед зіставлених гравців (п.п.). Це не оцінка ефективності білда.'
            : 'Contribution share minus power share among matched players (percentage points). Not a build-efficiency rating.'}
        </p>
        {balance.length > 0 ? (
          <DataTable
            label={uk ? 'Сила та внесок гравців' : 'Power vs contribution'}
            columns="minmax(0,1fr) minmax(58px,90px) minmax(58px,90px) minmax(58px,90px)"
            headers={[
              uk ? 'Гравець' : 'Player',
              <button onClick={() => sortBalance('power')}>
                {uk ? 'Сила' : 'Power'}
                {marker('power')}
              </button>,
              <button onClick={() => sortBalance('points')}>
                {uk ? 'Очки' : 'Points'}
                {marker('points')}
              </button>,
              <button onClick={() => sortBalance('surplus')} title="Contribution share − power share">
                Δ pp{marker('surplus')}
              </button>,
            ]}
          >
            {balance.map((person) => (
              <DataTableRow key={person.id}>
                <DataTableCell>
                  <PlayerLink id={person.id} name={person.name} />
                </DataTableCell>
                <DataTableCell numeric>{shortNumber(person.power)}</DataTableCell>
                <DataTableCell numeric>{shortNumber(person.points)}</DataTableCell>
                <DataTableCell numeric>
                  <span
                    className={person.surplus > 0 ? 'friendly' : person.surplus < 0 ? 'enemy' : ''}
                    title={
                      (person.pointsShare * 100).toFixed(1) +
                      '% − ' +
                      (person.powerShare * 100).toFixed(1) +
                      '%'
                    }
                  >
                    {person.surplus > 0 ? '+' : ''}
                    {person.surplus.toFixed(1)}
                  </span>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
        ) : (
          <p className="muted">
            {uk
              ? 'Потрібні очки війни та знімок сили.'
              : 'War scores and a roster power snapshot are required.'}
          </p>
        )}
        <p className="muted tiny">
          {uk ? 'Зіставлених гравців' : 'Matched players'}: {balance.length}.{' '}
          {uk ? 'Знімок складу' : 'Roster snapshot'}:{' '}
          {data.asOf ? new Date(data.asOf).toLocaleDateString(locale) : '—'}.{' '}
          {uk ? 'Остання війна' : 'Latest war'}:{' '}
          {data.latestWar ? formatWarRange(data.latestWar, locale) : '—'}.
        </p>
        <p className="muted tiny">
          {uk
            ? 'Знімок сили може бути зроблений пізніше за війну, тому це орієнтовне порівняння.'
            : 'Power may have been captured after the war; interpret the comparison cautiously.'}
        </p>
      </section>
      <section className="panel insight-widget">
        <h2>
          <TrendingUp size={19} /> {uk ? 'Лідери зростання сили' : 'Power growth leaders'}
        </h2>
        {data.rosterHistoryCount < 2 ? (
          <p className="muted">
            {uk
              ? 'Потрібно два знімки складу. Імпортуй склад ще раз пізніше.'
              : 'Two roster snapshots required. Import another roster later to track growth.'}
          </p>
        ) : data.powerGrowth.length === 0 ? (
          <p className="muted">
            {uk ? 'Немає спільних гравців у двох знімках.' : 'No matching players between snapshots.'}
          </p>
        ) : (
          <DataTable
            label="Power growth"
            columns="minmax(0,1fr) 90px 65px"
            headers={[uk ? 'Гравець' : 'Player', uk ? 'Приріст' : 'Growth', '%']}
          >
            {data.powerGrowth.map((person) => (
              <DataTableRow key={person.id}>
                <DataTableCell>
                  <PlayerLink id={person.id} name={person.name} />
                </DataTableCell>
                <DataTableCell numeric>
                  {person.delta >= 0 ? '+' : ''}
                  {shortNumber(person.delta)}
                </DataTableCell>
                <DataTableCell numeric>
                  {person.percentage === null ? '—' : person.percentage + '%'}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
        )}
      </section>
      <section className="panel insight-widget">
        <h2>{uk ? 'Найстабільніші гравці' : 'Most consistent contributors'}</h2>
        <DataTable
          label="Contribution consistency"
          columns="minmax(0,1fr) minmax(55px,75px) minmax(65px,100px)"
          headers={[uk ? 'Гравець' : 'Player', '%', uk ? 'Середнє' : 'Average']}
        >
          {data.consistency.map((person) => (
            <DataTableRow key={person.id}>
              <DataTableCell>
                <PlayerLink id={person.id} name={person.name} />
              </DataTableCell>
              <DataTableCell numeric>{person.consistency}%</DataTableCell>
              <DataTableCell numeric>{shortNumber(person.average)}</DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      </section>
    </div>
  );
}
