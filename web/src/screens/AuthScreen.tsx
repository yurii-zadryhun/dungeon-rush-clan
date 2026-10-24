import React from 'react';
import { ArrowRight } from 'lucide-react';
import { api, json, type Account } from '../api';
import { LanguagePicker, useI18n, type Locale } from '../i18n';

type Credentials = { username: string; password: string };

function AuthLayout({
  children,
  onLocaleChange,
}: {
  children: React.ReactNode;
  onLocaleChange: (locale: Locale) => void;
}) {
  const { t } = useI18n();
  return (
    <main className="auth-shell">
      <div className="panel auth-card">
        <div className="auth-language">
          <LanguagePicker onSelect={onLocaleChange} />
        </div>
        <h1>Dungeon Rush</h1>
        <h2>{t('appTitle')}</h2>
        <a className="auth-public-link" href="/clan">{t('publicGuestLink')} ↗</a>
        {children}
      </div>
    </main>
  );
}

function CredentialsForm({
  title,
  username = '',
  extra,
  onSubmit,
  onDone,
}: {
  title: string;
  username?: string;
  extra?: React.ReactNode;
  onSubmit: (credentials: Credentials) => Promise<Account>;
  onDone: (account: Account) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = React.useState(username);
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => setName(username), [username]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const account = await onSubmit({ username: name, password });
      onDone(account);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {extra}
      <label>
        {t('username')}
        <input
          autoComplete="username"
          value={name}
          maxLength={50}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label>
        {t('password')}
        <input
          type="password"
          autoComplete={title === t('login') ? 'current-password' : 'new-password'}
          value={password}
          minLength={12}
          maxLength={200}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error && (
        <div className="error-strip" role="alert">
          {error}
        </div>
      )}
      <button className="game-button blue full" disabled={busy}>
        {busy ? t('pleaseWait') : title} <ArrowRight size={17} />
      </button>
    </form>
  );
}

function LoginScreen({
  onDone,
  loginLocale,
}: {
  onDone: (account: Account) => void;
  loginLocale: Locale | null;
}) {
  const { t } = useI18n();
  return (
    <CredentialsForm
      title={t('login')}
      onDone={onDone}
      onSubmit={(credentials) =>
        api<Account>(
          'auth/login',
          json('POST', { ...credentials, ...(loginLocale ? { locale: loginLocale } : {}) }),
        )
      }
    />
  );
}

function OwnerSetupScreen({ onDone }: { onDone: (account: Account) => void }) {
  const { t, locale } = useI18n();
  const [bootstrapToken, setBootstrapToken] = React.useState('');
  return (
    <>
      <p className="muted">{t('setupTitle')}</p>
      <CredentialsForm
        title={t('createAccount')}
        onDone={onDone}
        extra={
          <label>
            {t('setupToken')}
            <input
              type="password"
              autoComplete="off"
              value={bootstrapToken}
              onChange={(event) => setBootstrapToken(event.target.value)}
              required
            />
          </label>
        }
        onSubmit={(credentials) =>
          api<Account>('auth/bootstrap', json('POST', { ...credentials, bootstrapToken, locale }))
        }
      />
    </>
  );
}

function InvitationScreen({ token, onDone }: { token: string; onDone: (account: Account) => void }) {
  const { t, locale } = useI18n();
  const [invitation, setInvitation] = React.useState<{
    label: string;
    role: string;
    shared: boolean;
  } | null>(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    api<{ label: string; role: string; shared: boolean }>('auth/invite/' + encodeURIComponent(token))
      .then((info) => {
        if (active) setInvitation(info);
      })
      .catch((failure) => {
        if (active) setError((failure as Error).message);
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (error) return <div className="error-strip">{error}</div>;
  if (!invitation) return <p className="muted">{t('loading')}</p>;
  return (
    <>
      <p className="muted">
        {invitation.shared ? t('sharedInviteTitle') : t('invitationFor', { name: invitation.label })}
      </p>
      <CredentialsForm
        title={t('createAccount')}
        username={invitation.label}
        onDone={onDone}
        onSubmit={(credentials) =>
          api<Account>(
            'auth/invite/' + encodeURIComponent(token) + '/register',
            json('POST', { ...credentials, locale }),
          )
        }
      />
      <a className="auth-login-link" href="?login=1">
        {t('alreadyHaveAccount')}
      </a>
    </>
  );
}

export type AuthMode = 'login' | 'setup' | 'invite';

const authScreens: Record<
  AuthMode,
  React.ComponentType<{
    onDone: (account: Account) => void;
    token: string;
    loginLocale: Locale | null;
  }>
> = {
  login: ({ onDone, loginLocale }) => <LoginScreen onDone={onDone} loginLocale={loginLocale} />,
  setup: ({ onDone }) => <OwnerSetupScreen onDone={onDone} />,
  invite: ({ onDone, token }) => <InvitationScreen token={token} onDone={onDone} />,
};

export function AuthScreen({
  mode,
  invite,
  onDone,
}: {
  mode: AuthMode;
  invite: string | null;
  onDone: (account: Account) => void;
}) {
  const Screen = authScreens[mode];
  // Inferred language is a UI default, not consent to overwrite an existing account.
  const [explicitLocale, setExplicitLocale] = React.useState<Locale | null>(null);
  return (
    <AuthLayout onLocaleChange={setExplicitLocale}>
      <Screen onDone={onDone} token={invite ?? ''} loginLocale={explicitLocale} />
    </AuthLayout>
  );
}
