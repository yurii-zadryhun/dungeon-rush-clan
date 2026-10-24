import React from 'react';
import { ArrowRight, Crown, History } from 'lucide-react';
import { api, type PublicClan } from '../api';
import { formatWarRange } from '../date-format';
import { LanguagePicker, useI18n } from '../i18n';
import './GuestPage.css';

export function GuestPage() {
  const { locale, t } = useI18n();
  const [clan, setClan] = React.useState<PublicClan | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let alive = true;
    api<PublicClan>('public/clan')
      .then((data) => {
        if (alive) setClan(data);
      })
      .catch((failure) => {
        if (alive) setError((failure as Error).message);
      });
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (clan) document.title = clan.name + ' · Dungeon Rush';
  }, [clan]);

  return (
    <div className="guest-page">
      <header className="guest-header">
        <a href="/clan" className="guest-brand">
          <img src="/assets/clan-emblem.png" alt="" width="32" height="35" />
          <span>{t('publicArchive')}</span>
        </a>
        <div className="guest-actions">
          <LanguagePicker />
          <a href="/?login=1" className="guest-signin">
            {t('login')} <ArrowRight size={15} />
          </a>
        </div>
      </header>
      <main className="guest-main">
        {error && (
          <div className="error-strip" role="alert">
            {error}
          </div>
        )}
        {!clan && !error && (
          <div className="guest-loading">
            <span className="spinner" />
            {t('loading')}
          </div>
        )}
        {clan && (
          <>
            <section className="panel guest-hero">
              <div className="guest-intro">
                <div className="guest-emblem-wrap">
                  <img src="/assets/clan-emblem.png" alt="" width="132" height="144" />
                </div>
                <div className="guest-hero-text">
                  <h1>{clan.name}</h1>
                  <span className="guest-game">Dungeon Rush</span>
                  <div className="guest-leader">
                    <Crown size={18} /> {t('publicLeaderLabel')}: <strong>{clan.leader}</strong>
                  </div>
                </div>
              </div>
            </section>
            <div className="panel guest-record" aria-label={t('clanOverview')}>
              <div className="guest-record-item">
                <strong className="friendly">{clan.record.wins}</strong>
                <span>{t('wins')}</span>
              </div>
              <span className="guest-record-divider" aria-hidden="true" />
              <div className="guest-record-item">
                <strong className="enemy">{clan.record.losses}</strong>
                <span>{t('losses')}</span>
              </div>
            </div>
            <section className="panel guest-history">
              <div className="guest-section-head">
                <h2>
                  <History size={21} />
                  {t('warHistory')}
                </h2>
              </div>
              {clan.recentWars.length === 0 ? (
                <p className="empty">{t('publicNoWars')}</p>
              ) : (
                <div className="guest-wars">
                  {clan.recentWars.map((war) => {
                    const victory = war.ourScore > war.opponentScore;
                    return (
                      <article
                        key={war.start}
                        className={'guest-war ' + (victory ? 'victory' : 'defeat')}
                      >
                        <div className="guest-war-info">
                          <span className="guest-war-date">{formatWarRange(war.start, locale)}</span>
                          <strong>
                            {clan.name} <span className="guest-versus">vs</span>{' '}
                            {war.opponent ?? t('unknownOpponent')}
                          </strong>
                        </div>
                        <div className="guest-war-result">
                          <b>
                            {war.ourScore} : {war.opponentScore}
                          </b>
                          <small>{t(victory ? 'victory' : 'defeat')}</small>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
