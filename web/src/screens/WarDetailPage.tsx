import React from 'react';
import { notify } from './Toast';
import { ArrowLeft, Copy, Trophy, Users, Crown } from 'lucide-react';
import { api, shortNumber, type WarDetail } from '../api';
import { formatWarRange } from '../date-format';
import { useI18n } from '../i18n';

type SortField = 'position' | 'name' | 'points';

function reportText(war: WarDetail, clanName: string, uk: boolean): string {
  const result = war.resultImported
    ? `${war.ourScore} : ${war.opponentScore}`
    : uk
      ? 'Результат очікується'
      : 'Result pending';
  const top = [...war.players].sort((a, b) => b.points - a.points).slice(0, 5);
  return [
    `⚔️ ${clanName} vs ${war.opponent || '?'}`,
    `${formatWarRange(war.start, uk ? 'uk' : 'en')}${war.championship ? ' 🏆 Championship' : ''}`,
    result,
    '',
    `${uk ? 'Учасники' : 'Participants'}: ${war.summary.participantCount}`,
    `${uk ? 'Сума очок' : 'Total points'}: ${shortNumber(war.summary.total)}`,
    `${uk ? 'Середнє' : 'Average'}: ${shortNumber(war.summary.average)}`,
    `${uk ? 'Медіана' : 'Median'}: ${shortNumber(war.summary.median)}`,
    `Top 10: ${war.summary.topTenShare}%`,
    '',
    ...top.map((player, index) => `${index + 1}. ${player.name} — ${shortNumber(player.points)}`),
    '',
    ...(war.resultImported
      ? war.days.map(
          (day) =>
            `${uk ? 'День' : 'Day'} ${day.day}: ${day.winner === 'ours' ? clanName : war.opponent || '?'} · MVP ${day.mvp}`,
        )
      : []),
  ].join('\n');
}

export function WarDetailPage({ start, clanName }: { start: string; clanName: string }) {
  const { locale } = useI18n();
  const uk = locale === 'uk';
  const [war, setWar] = React.useState<WarDetail | null>(null);
  const [error, setError] = React.useState('');
  const [sort, setSort] = React.useState<SortField>('position');
  const [descending, setDescending] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setWar(null);
    setError('');
    api<WarDetail>('wars/' + encodeURIComponent(start))
      .then((value) => {
        if (active) setWar(value);
      })
      .catch((reason) => {
        if (active) setError((reason as Error).message);
      });
    return () => {
      active = false;
    };
  }, [start]);

  function orderBy(field: SortField) {
    if (sort === field) setDescending((value) => !value);
    else {
      setSort(field);
      setDescending(field === 'points');
    }
  }

  const players = [...(war?.players ?? [])].sort((a, b) => {
    const difference = sort === 'name' ? a.name.localeCompare(b.name) : a[sort] - b[sort];
    return (descending ? -difference : difference) || a.position - b.position;
  });

  async function copyReport() {
    if (!war) return;
    try {
      await navigator.clipboard.writeText(reportText(war, clanName, uk));
      setCopied(true);
      notify(uk ? 'Звіт скопійовано' : 'Report copied');
    } catch {
      setError(uk ? 'Не вдалося скопіювати звіт' : 'Could not copy report');
    }
  }

  return (
    <main className="war-detail-page">
      <a className="player-back" href="#/archive">
        <ArrowLeft size={17} />
        {uk ? 'Архів воєн' : 'War archive'}
      </a>
      {error && (
        <div className="error-strip" role="alert">
          {error}
        </div>
      )}
      {!war && !error && <div className="panel">{uk ? 'Завантаження…' : 'Loading…'}</div>}
      {war && (
        <>
          <header className="panel war-detail-hero">
            <div className="war-detail-heading">
              <div>
                <small>
                  {formatWarRange(war.start, locale)}{' '}
                  {war.championship && (
                    <span className="war-championship">
                      <Crown size={14} /> Championship
                    </span>
                  )}
                </small>
                <h1>
                  {clanName} <span className="muted">vs</span> {war.opponent || '?'}
                </h1>
              </div>
              <strong className="war-detail-score">
                {war.resultImported ? `${war.ourScore} : ${war.opponentScore}` : '— : —'}
              </strong>
            </div>
            <div className="war-summary-metrics">
              <div>
                <Trophy size={17} />
                <strong>{shortNumber(war.summary.total)}</strong>
                <small>{uk ? 'Загалом очок' : 'Total points'}</small>
              </div>
              <div>
                <Users size={17} />
                <strong>{war.summary.participantCount}</strong>
                <small>{uk ? 'Гравців' : 'Players'}</small>
              </div>
              <div>
                <strong>{shortNumber(war.summary.average)}</strong>
                <small>{uk ? 'Середнє' : 'Average'}</small>
              </div>
              <div>
                <strong>{shortNumber(war.summary.median)}</strong>
                <small>{uk ? 'Медіана' : 'Median'}</small>
              </div>
              <div>
                <strong>
                  {war.summary.topFiveShare}% / {war.summary.topTenShare}%
                </strong>
                <small>Top 5 / Top 10</small>
              </div>
            </div>
          </header>
          {war.resultImported && (
            <section className="panel war-detail-section">
              <h2>{uk ? 'Результати за днями' : 'Daily results'}</h2>
              <div className="war-detail-days">
                {war.days.map((day) => (
                  <div className="war-detail-day" key={day.day}>
                    <b>
                      {uk ? 'День' : 'Day'} {day.day}
                    </b>
                    <span>
                      {day.points} {uk ? 'оч.' : 'pts'}
                    </span>
                    <span className={day.winner === 'ours' ? 'friendly' : 'enemy'}>
                      {day.winner === 'ours' ? clanName : war.opponent}
                    </span>
                    <span>
                      MVP:{' '}
                      {day.mvpPlayerId && day.winner === 'ours' ? (
                        <a href={'#/players/' + day.mvpPlayerId}>{day.mvp}</a>
                      ) : (
                        day.mvp
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {war.rankingImported && war.players.length > 0 && (
            <section className="panel war-detail-section">
              <h2>{uk ? 'Відзнаки' : 'Recognition'}</h2>
              <div className="war-recognition">
                <span>
                  🏅 {uk ? 'Найбільший внесок' : 'Top contributor'}:{' '}
                  <a href={'#/players/' + [...war.players].sort((a, b) => b.points - a.points)[0].id}>
                    {[...war.players].sort((a, b) => b.points - a.points)[0].name}
                  </a>
                </span>
                {war.days.some((day) => day.winner === 'ours') && (
                  <span>
                    🏆 {uk ? 'MVP наших перемог' : 'Our winning MVPs'}:{' '}
                    {war.days
                      .filter((day) => day.winner === 'ours')
                      .map((day) => day.mvp)
                      .join(', ')}
                  </span>
                )}
              </div>
            </section>
          )}
          {war.rankingImported && (
            <section className="panel war-detail-section">
              <h2>{uk ? 'Внесок гравців' : 'Player contribution'}</h2>
              <div
                className="war-distribution"
                aria-label={uk ? 'Розподіл очок' : 'Points distribution'}
              >
                <span style={{ width: war.summary.topFiveShare + '%' }} />
                <span style={{ width: war.summary.topTenShare - war.summary.topFiveShare + '%' }} />
                <span style={{ width: 100 - war.summary.topTenShare + '%' }} />
              </div>
              <p className="muted tiny">
                Top 5: {war.summary.topFiveShare}% · Top 6–10:{' '}
                {war.summary.topTenShare - war.summary.topFiveShare}% · {uk ? 'Інші' : 'Others'}:{' '}
                {100 - war.summary.topTenShare}%
              </p>
              <div
                className="war-detail-table"
                role="table"
                aria-label={uk ? 'Рейтинг гравців' : 'Player ranking'}
              >
                <div className="war-detail-row war-detail-columns" role="row">
                  <button onClick={() => orderBy('position')}>
                    {uk ? 'Місце' : 'Rank'} {sort === 'position' ? (descending ? '↓' : '↑') : ''}
                  </button>
                  <button onClick={() => orderBy('name')}>
                    {uk ? 'Гравець' : 'Player'} {sort === 'name' ? (descending ? '↓' : '↑') : ''}
                  </button>
                  <button onClick={() => orderBy('points')}>
                    {uk ? 'Очки' : 'Points'} {sort === 'points' ? (descending ? '↓' : '↑') : ''}
                  </button>
                </div>
                {players.map((player) => (
                  <div className="war-detail-row" role="row" key={player.id}>
                    <span>{player.position}</span>
                    <a href={'#/players/' + player.id}>{player.name}</a>
                    <strong>{shortNumber(player.points)}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="panel war-detail-section">
            <div className="war-detail-report-heading">
              <h2>{uk ? 'Звіт про війну' : 'War report'}</h2>
              <button className="game-button blue" onClick={() => void copyReport()}>
                <Copy size={16} />
                {copied ? (uk ? 'Скопійовано' : 'Copied') : uk ? 'Копіювати' : 'Copy'}
              </button>
            </div>
            <pre className="war-report-preview">{reportText(war, clanName, uk)}</pre>
          </section>
        </>
      )}
    </main>
  );
}
