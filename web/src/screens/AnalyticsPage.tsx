import React from 'react';
import { Activity } from 'lucide-react';
import { type Account } from '../api';
import { useI18n } from '../i18n';
import { ClanGrowthWidget, ClanHealthWidget, DayOutcomesWidget, WarPointsWidget } from './InsightsWidgets';
import './AnalyticsPage.css';

export function AnalyticsPage({ account }: { account: Account }) {
  const { t } = useI18n();
  return (
    <main className="analytics-page">
      <header className="analytics-heading">
        <h1>
          <Activity size={25} /> {t('analyticsTab')}
        </h1>
        <p className="muted">{t('analyticsIntro')}</p>
      </header>
      <div className="insights-grid">
        {account.role !== 'member' && <ClanHealthWidget />}
        <DayOutcomesWidget />
        <ClanGrowthWidget />
        <WarPointsWidget />
      </div>
    </main>
  );
}
