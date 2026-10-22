import React from 'react';
import { createRoot } from 'react-dom/client';
import { Account, api, Dashboard, json } from './api';
import { LanguageProvider, useI18n, type Locale } from './i18n';
import { AuthScreen, type AuthMode } from './screens/AuthScreen';
import { ClanDashboard } from './screens/ClanDashboard';
import './styles.css';

type AppPhase = 'loading' | 'ready' | AuthMode;

function App() {
  const { locale, setLocale, t } = useI18n();
  const [phase, setPhase] = React.useState<AppPhase>('loading');
  const [account, setAccount] = React.useState<Account | null>(null);
  const [dashboard, setDashboard] = React.useState<Dashboard | null>(null);
  const [error, setError] = React.useState('');
  const invite = new URLSearchParams(location.search).get('invite');

  React.useEffect(() => {
    let mounted = true;
    async function restore() {
      try {
        const current = await api<Account>('auth/me');
        if (!mounted) return;
        setAccount(current);
        setLocale(current.locale);
        setPhase('ready');
      } catch {
        try {
          const status = await api<{ initialized: boolean }>('auth/setup-state');
          if (!mounted) return;
          if (!status.initialized) setPhase('setup');
          else setPhase(invite && new URLSearchParams(location.search).get('login') !== '1' ? 'invite' : 'login');
        } catch (failure) {
          if (!mounted) return;
          setError((failure as Error).message);
          setPhase('login');
        }
      }
    }
    void restore();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    document.title = 'Dungeon Rush · ' + t('appTitle');
  }, [t]);

  React.useEffect(() => {
    if (phase !== 'ready') return;
    api<Dashboard>('dashboard')
      .then(setDashboard)
      .catch((failure) => setError((failure as Error).message));
  }, [phase]);

  function authenticated(current: Account) {
    setAccount(current);
    setLocale(current.locale);
    setPhase('ready');
    setError('');
    history.replaceState(null, '', location.pathname + location.hash);
  }

  async function saveLanguage(next: Locale) {
    if (!account || next === account.locale) return;
    try {
      await api('auth/locale', json('PATCH', { locale: next }));
      setAccount({ ...account, locale: next });
    } catch (failure) {
      setError((failure as Error).message);
      setLocale(account.locale);
    }
  }

  async function logout() {
    await api('auth/logout', { method: 'POST' });
    setAccount(null);
    setDashboard(null);
    setPhase('login');
  }

  if (phase === 'loading')
    return (
      <div className="loading-page">
        <span className="spinner" /> {t('loading')}
      </div>
    );
  if (phase !== 'ready') return <AuthScreen mode={phase} invite={invite} onDone={authenticated} />;
  if (!account) return null;
  return (
    <ClanDashboard
      user={account}
      data={dashboard}
      onChange={setDashboard}
      onLogout={logout}
      onLocaleChange={saveLanguage}
      onProfileChange={async (updated) => {
        setAccount(updated);
        const refreshed = await api<Dashboard>('dashboard');
        setDashboard(refreshed);
      }}
      error={error}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>,
);
