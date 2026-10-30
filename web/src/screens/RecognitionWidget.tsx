import React from 'react';
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
              <a key={award.kind} href={'#/players/' + award.playerId}>
                {award.kind === 'firstPlaces' ? (
                  <Medal size={17} />
                ) : award.kind === 'championship' ? (
                  <Crown size={17} />
                ) : (
                  <Trophy size={17} />
                )}
                <span>
                  <small>{labels[award.kind][uk ? 0 : 1]}</small>
                  <strong>{award.name}</strong>
                </span>
                <b>
                  {award.kind === 'points' || award.kind === 'championship'
                    ? shortNumber(award.value)
                    : award.value}
                </b>
              </a>
            ))}
          </div>
          <h3>{uk ? 'Лідери за всі війни' : 'All-time contributors'}</h3>
          <div className="recognition-leaders">
            {data.leaderboard.slice(0, 10).map((person, index) => (
              <a key={person.id} href={'#/players/' + person.id}>
                <span>{index + 1}.</span>
                <strong>{person.name}</strong>
                <small>
                  {person.mvps} MVP · {person.firstPlaces} #1
                </small>
                <b>{shortNumber(person.points)}</b>
              </a>
            ))}
          </div>
          {data.recent.length > 0 && (
            <>
              <h3>{uk ? 'Герої останніх воєн' : 'Recent war leaders'}</h3>
              <div className="recognition-recent">
                {data.recent.map((entry) => (
                  <a href={'#/wars/' + entry.start} key={entry.start}>
                    <span>
                      {formatWarRange(entry.start, locale)} {entry.championship && '🏆'}
                    </span>
                    <strong>{entry.name}</strong>
                    <b>{shortNumber(entry.points)}</b>
                  </a>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
