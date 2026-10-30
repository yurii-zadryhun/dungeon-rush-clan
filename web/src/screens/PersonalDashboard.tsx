import React from 'react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { shortNumber, type Account, type Dashboard } from '../api';
import { useI18n } from '../i18n';

export function PersonalDashboard({ account, data }: { account: Account; data: Dashboard }) {
  const { locale } = useI18n();
  const player = data.rankings.calculated.find((entry) => entry.id === account.playerId);
  if (!player) return null;
  const requirement = data.rankings.settings.minimumPoints;
  const rank = data.rankings.calculated.findIndex((entry) => entry.id === player.id) + 1;
  const progress = requirement > 0 ? Math.min(100, Math.round((player.score / requirement) * 100)) : 100;
  const uk = locale === 'uk';
  return (
    <section className="panel personal-dashboard">
      <div className="personal-dashboard-top">
        <h2>
          <TrendingUp size={18} />
          {uk ? 'Мій прогрес' : 'My progress'}
        </h2>
        <a href={'#/players/' + player.id}>
          {uk ? 'Профіль' : 'Profile'} <ArrowUpRight size={15} />
        </a>
      </div>
      <div className="personal-dashboard-metrics">
        <div>
          <strong>{shortNumber(player.score)}</strong>
          <small>{uk ? 'Мій рейтинг' : 'My score'}</small>
        </div>
        <div>
          <strong>#{rank}</strong>
          <small>{uk ? 'Місце в клані' : 'Clan rank'}</small>
        </div>
        <div>
          <strong>{player.lastPoints === null ? '—' : shortNumber(player.lastPoints)}</strong>
          <small>{uk ? 'Остання війна' : 'Latest war'}</small>
        </div>
        <div>
          <strong>{player.appearances}</strong>
          <small>{uk ? 'Участь у війнах' : 'Wars played'}</small>
        </div>
      </div>
      {requirement > 0 && (
        <div
          className="personal-requirement"
          aria-label={uk ? 'Прогрес до мінімуму' : 'Progress toward minimum'}
        >
          <span style={{ width: progress + '%' }} />
        </div>
      )}
    </section>
  );
}
