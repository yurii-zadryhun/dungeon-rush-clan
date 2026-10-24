import React from 'react';
import { ArrowRight, Copy, Crown, History, Shield, Swords, Trophy } from 'lucide-react';
import { api, type PublicClan } from '../api';
import { formatWarRange } from '../date-format';
import { LanguagePicker, useI18n } from '../i18n';
import './GuestPage.css';

export function GuestPage() {
  const { locale, t } = useI18n();
  const [clan, setClan] = React.useState<PublicClan | null>(null);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);

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

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.origin + '/clan');
      setCopied(true);
    } catch {
      setError(t('publicCopyFailed'));
    }
  }

  return (
    <div className="guest-page">
      <header className="guest-header">
        <a href="/clan" className="guest-brand">
          <Swords size={21} /> DUNGEON RUSH
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
            <section className="guest-hero panel">
              <div className="guest-intro">
                <div className="guest-emblem-wrap">
                  <img src="/clan-emblem.png" alt="" width="132" height="144" />
                </div>
                <div className="guest-hero-text">
                  <span className="guest-eyebrow">
                    <Shield size={15} /> {t('publicClanProfile')}
                  </span>
                  <h1>{clan.name}</h1>
                  <span className="guest-game">Dungeon Rush</span>
                  <div className="guest-leader">
                    <Crown size={18} /> {t('publicLeaderLabel')}: <strong>{clan.leader}</strong>
                  </div>
                </div>
              </div>
              <div className="guest-hero-bottom">
                <p>{t('publicIntro')}</p>
                <button className="game-button blue" type="button" onClick={() => void share()}>
                  <Copy size={17} /> {t(copied ? 'copied' : 'publicShare')}
                </button>
              </div>
            </section>
            <div className="guest-stats">
              <div className="panel guest-stat won">
                <Trophy size={22} />
                <strong>{clan.record.wins}</strong>
                <span>{t('wins')}</span>
              </div>
              <div className="panel guest-stat lost">
                <Swords size={22} />
                <strong>{clan.record.losses}</strong>
                <span>{t('losses')}</span>
              </div>
              <div className="panel guest-stat total">
                <History size={22} />
                <strong>{clan.record.wins + clan.record.losses}</strong>
                <span>{t('publicCompletedWars')}</span>
              </div>
            </div>
            <section className="panel guest-history">
              <div className="guest-section-head">
                <h2>
                  <History size={21} />
                  {t('warHistory')}
                </h2>
                <span className="guest-history-note">{t('publicResultsOnly')}</span>
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
            <footer className="guest-footer">
              <Shield size={17} />
              {t('publicPrivacyNotice')}
              <a href="/?login=1">
                {t('publicMemberArea')} <ArrowRight size={14} />
              </a>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
