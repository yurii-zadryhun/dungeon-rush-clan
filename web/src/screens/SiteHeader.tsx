import React from 'react';
import {
  Activity,
  BookOpen,
  ChevronDown,
  History,
  Globe2,
  LogOut,
  Menu,
  Settings,
  Swords,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { type Account } from '../api';
import { LanguagePicker, useI18n, type Locale } from '../i18n';
import './SiteHeader.css';

interface SiteHeaderProps {
  user: Account;
  isWiki: boolean;
  isPlayers: boolean;
  isAnalytics: boolean;
  onSettings: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onLocaleChange: (locale: Locale) => void;
}

export function SiteHeader({
  user,
  isWiki,
  isPlayers,
  isAnalytics,
  onSettings,
  onProfile,
  onLogout,
  onLocaleChange,
}: SiteHeaderProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const dropdown = React.useRef<HTMLDivElement>(null);
  const canManage = user.role !== 'member';
  const roleKey =
    user.role === 'owner' ? 'ownerRole' : user.role === 'admin' ? 'adminRole' : 'memberRole';

  React.useEffect(() => {
    if (!menuOpen) return;
    function onOutsideClick(event: MouseEvent) {
      if (dropdown.current && !dropdown.current.contains(event.target as Node)) setMenuOpen(false);
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onOutsideClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onOutsideClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }
  return (
    <>
      <header className="site-header shell-header">
        <a className="brand shell-brand" href="#/archive">
          <span className="brand-mark">
            <Swords size={25} />
          </span>
          <span className="brand-caption">
            <strong>DUNGEON RUSH</strong>
          </span>
        </a>
        <nav className="top-navigation shell-navigation" aria-label={t('navigation')}>
          <a
            href="#/archive"
            className={!isWiki && !isPlayers && !isAnalytics ? 'active' : ''}
            aria-current={!isWiki && !isPlayers && !isAnalytics ? 'page' : undefined}
            onClick={closeMenu}
          >
            <History size={17} /> <span>{t('historyTab')}</span>
          </a>
          <a
            href="#/analytics"
            className={isAnalytics ? 'active' : ''}
            aria-current={isAnalytics ? 'page' : undefined}
            onClick={closeMenu}
          >
            <Activity size={17} /> <span>{t('analyticsTab')}</span>
          </a>
          <a
            href="#/players"
            className={isPlayers ? 'active' : ''}
            aria-current={isPlayers ? 'page' : undefined}
            onClick={closeMenu}
          >
            <UsersRound size={17} /> <span>{t('playersDirectory')}</span>
          </a>
          <a
            href="#/wiki"
            className={isWiki ? 'active' : ''}
            aria-current={isWiki ? 'page' : undefined}
            onClick={closeMenu}
          >
            <BookOpen size={17} /> <span>{t('wikiTab')}</span>
          </a>
        </nav>
        <div className="shell-tools">
          <button
            type="button"
            className="shell-mobile-profile"
            onClick={onProfile}
            aria-label={t('profile') + ': ' + user.displayName}
          >
            <span className="shell-mobile-name">{user.displayName}</span>
            <small>{t(roleKey)}</small>
          </button>
          <div className="shell-menu-container" ref={dropdown}>
            <button
              type="button"
              className="shell-menu-button"
              aria-label={t('menu')}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Menu size={20} />
              <ChevronDown size={13} />
            </button>
            {menuOpen && (
              <div className="shell-menu" role="menu">
                <div className="shell-menu-user">
                  {user.displayName}
                  <small>{t(roleKey)}</small>
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    closeMenu();
                    onProfile();
                  }}
                >
                  <UserRound size={18} /> {t('profile')}
                </button>
                {canManage && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      closeMenu();
                      onSettings();
                    }}
                  >
                    <Settings size={18} /> {t('clanSettings')}
                  </button>
                )}
                <a role="menuitem" href="/public">
                  <Globe2 size={18} /> {t('publicGuestLink')}
                </a>
                <a role="menuitem" href="/about">
                  <Globe2 size={18} /> {t('aboutLink')}
                </a>
                <div className="shell-menu-language">
                  <LanguagePicker onSelect={onLocaleChange} />
                </div>
                <div className="shell-menu-separator" />
                <button
                  role="menuitem"
                  onClick={() => {
                    closeMenu();
                    onLogout();
                  }}
                >
                  <LogOut size={18} /> {t('logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <nav className="mobile-bottom-navigation" aria-label={t('navigation')}>
        <a
          href="#/archive"
          className={!isWiki && !isPlayers && !isAnalytics ? 'active' : ''}
          aria-current={!isWiki && !isPlayers && !isAnalytics ? 'page' : undefined}
        >
          <History size={22} />
          <span>{t('historyTab')}</span>
        </a>
        <a
          href="#/analytics"
          className={isAnalytics ? 'active' : ''}
          aria-current={isAnalytics ? 'page' : undefined}
        >
          <Activity size={22} />
          <span>{t('analyticsTab')}</span>
        </a>
        <a
          href="#/players"
          className={isPlayers ? 'active' : ''}
          aria-current={isPlayers ? 'page' : undefined}
        >
          <UsersRound size={22} />
          <span>{t('playersDirectory')}</span>
        </a>
        <a href="#/wiki" className={isWiki ? 'active' : ''} aria-current={isWiki ? 'page' : undefined}>
          <BookOpen size={22} />
          <span>{t('wikiTab')}</span>
        </a>
      </nav>
    </>
  );
}
