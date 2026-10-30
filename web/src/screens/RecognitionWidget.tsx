import React from 'react';
import { PlayerLink } from './PlayerLink';
import { DataTable, DataTableRow, DataTableCell } from './DataTable';
import { Award, Crown, Medal, Trophy } from 'lucide-react';
import { api, shortNumber, type RecognitionOverview } from '../api';
import { useI18n } from '../i18n';
import { formatWarRange } from '../date-format';
import './RecognitionWidget.css';

const labels = {
  points: ['Найбільший внесок', 'Most contributed'],
  firstPlaces: ['Найбільше перших місць', 'Most first places'],
  mvps: ['Найбільше MVP', 'Most MVP awards'],
  streak: ['Найдовша серія участі', 'Longest participation streak'],
  championship: ['Очки Чемпіонатів', 'Championship points'],
} as const;

export function RecognitionWidget() {
  const { t, locale } = useI18n();
  const uk = locale === 'uk';
  const [data, setData] = React.useState<RecognitionOverview | null>(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    api<RecognitionOverview>('recognition')
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

  return (
    <section className="panel insight-widget recognition-widget">
      <h2>
        <Award size={19} /> Recognition
      </h2>
      {error && (
        <p className="error-strip" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="muted tiny">{t('loading')}</p>}
      {data?.warCount === 0 && (
        <p className="muted">{uk ? 'Поки немає даних воєн' : 'No war data yet'}</p>
      )}
      {data && data.warCount > 0 && (
        <>
          <p className="muted tiny">
            {uk ? 'На основі' : 'Based on'} {data.warCount} {uk ? 'імпортованих воєн' : 'imported wars'}
          </p>
          <div className="recognition-awards">
            {data.awards.map((award) => (
              <div key={award.kind}>
                {award.kind === 'firstPlaces' ? (
                  <Medal size={17} />
                ) : award.kind === 'championship' ? (
                  <Crown size={17} />
                ) : (
                  <Trophy size={17} />
                )}
                <span>
                  <small>{labels[award.kind][uk ? 0 : 1]}</small>
                  <strong>
                    <PlayerLink id={award.playerId} name={award.name} />
                  </strong>
                </span>
                <b>
                  {award.kind === 'points' || award.kind === 'championship'
                    ? shortNumber(award.value)
                    : award.value}
                </b>
              </div>
            ))}
          </div>
          <h3>{uk ? 'Лідери за всі війни' : 'All-time contributors'}</h3>
          <DataTable
            label={uk ? 'Лідери за всі війни' : 'All-time contributors'}
            columns="26px minmax(0,1fr) minmax(64px,95px) minmax(70px,95px)"
            headers={['#', uk ? 'Гравець' : 'Player', 'MVP / #1', uk ? 'Очки' : 'Points']}
          >
            {data.leaderboard.slice(0, 10).map((person, index) => (
              <DataTableRow key={person.id}>
                <DataTableCell>{index + 1}</DataTableCell>
                <DataTableCell>
                  <PlayerLink id={person.id} name={person.name} />
                </DataTableCell>
                <DataTableCell numeric>
                  {person.mvps} / {person.firstPlaces}
                </DataTableCell>
                <DataTableCell numeric>
                  <strong>{shortNumber(person.points)}</strong>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
          {data.recent.length > 0 && (
            <>
              <h3>{uk ? 'Герої останніх воєн' : 'Recent war leaders'}</h3>
              <div className="recognition-recent">
                {data.recent.map((entry) => (
                  <div key={entry.start}>
                    <a href={'#/wars/' + entry.start}>
                      {formatWarRange(entry.start, locale)} {entry.championship && '🏆'}
                    </a>
                    <strong>
                      <PlayerLink id={entry.id} name={entry.name} />
                    </strong>
                    <b>{shortNumber(entry.points)}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
