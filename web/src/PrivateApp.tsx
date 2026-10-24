import React from 'react';
import { api, json, type Account, type Dashboard } from './api';
import { LanguageProvider, useI18n, type Locale } from './i18n';
import type { AuthMode } from './screens/AuthScreen';
const AuthScreen = React.lazy(() =>
  import('./screens/AuthScreen').then((module) => ({ default: module.AuthScreen })),
);
const ClanDashboard = React.lazy(() =>
  import('./screens/ClanDashboard').then((module) => ({ default: module.ClanDashboard })),
);

type AppPhase = 'loading' | 'ready' | AuthMode;

export function PrivateApp() {
  const { setLocale, t } = useI18n();
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
          else
            setPhase(
              invite && new URLSearchParams(location.search).get('login') !== '1' ? 'invite' : 'login',
            );
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
  if (phase !== 'ready')
    return (
      <React.Suspense fallback={<main className="loading-page">{t('loading')}</main>}>
        <AuthScreen mode={phase} invite={invite} onDone={authenticated} />
      </React.Suspense>
    );
  if (!account) return null;
  return (
    <React.Suspense fallback={<main className="loading-page">{t('loading')}</main>}>
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
    </React.Suspense>
  );
}
