import React from 'react';
import { BookOpen, ChevronDown, History, LogOut, Menu, Settings, Swords, UserRound, UsersRound } from 'lucide-react';
import { type Account } from '../api';
import { LanguagePicker, useI18n, type Locale } from '../i18n';
import './SiteHeader.css';

interface SiteHeaderProps {
  user: Account;
  isWiki: boolean;
  isUsers: boolean;
  onSettings: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onLocaleChange: (locale: Locale) => void;
}

export function SiteHeader({
  user, isWiki, isUsers, onSettings, onProfile, onLogout, onLocaleChange,
}: SiteHeaderProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const dropdown = React.useRef<HTMLDivElement>(null);
  const canManage = user.role !== 'member';

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

  function closeMenu() { setMenuOpen(false); }
  return (
    <header className="site-header shell-header">
      <a className="brand shell-brand" href="#/archive">
        <span className="brand-mark"><Swords size={25} /></span>
        <span className="brand-caption"><strong>DUNGEON RUSH</strong><small>{t('appTitle').toUpperCase()}</small></span>
      </a>
      <nav className="top-navigation shell-navigation" aria-label={t('navigation')}>
        <a href="#/archive" className={!isWiki && !isUsers ? 'active' : ''}
          aria-current={!isWiki && !isUsers ? 'page' : undefined} onClick={closeMenu}>
          <History size={17} /> <span>{t('historyTab')}</span>
        </a>
        <a href="#/wiki" className={isWiki ? 'active' : ''}
          aria-current={isWiki ? 'page' : undefined} onClick={closeMenu}>
          <BookOpen size={17} /> <span>{t('wikiTab')}</span>
        </a>
      </nav>
      <div className="shell-tools">
        <LanguagePicker onSelect={onLocaleChange} />
        <div className="shell-menu-container" ref={dropdown}>
          <button type="button" className="shell-menu-button" aria-label={t('menu')}
            aria-expanded={menuOpen} aria-haspopup="true"
            onClick={() => setMenuOpen((open) => !open)}>
            <Menu size={20} /><ChevronDown size={13} />
          </button>
          {menuOpen && (
            <div className="shell-menu" role="menu">
              <div className="shell-menu-user">{user.displayName}
                <small>{t(user.role === 'owner' ? 'ownerRole' : user.role === 'admin' ? 'adminRole' : 'memberRole')}</small>
              </div>
              <button role="menuitem" onClick={() => { closeMenu(); onProfile(); }}>
                <UserRound size={18} /> {t('profile')}
              </button>
              {canManage && (
                <a role="menuitem" href="#/users" onClick={closeMenu}>
                  <UsersRound size={18} /> {t('userManagement')}
                </a>
              )}
              {canManage && (
                <button role="menuitem" onClick={() => { closeMenu(); onSettings(); }}>
                  <Settings size={18} /> {t('clanSettings')}
                </button>
              )}
              <div className="shell-menu-separator" />
              <button role="menuitem" onClick={() => { closeMenu(); onLogout(); }}>
                <LogOut size={18} /> {t('logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
