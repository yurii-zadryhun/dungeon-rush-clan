import React from 'react';
import { createRoot } from 'react-dom/client';
import { api,Account,Dashboard } from './api';
import { AuthScreen } from './screens/AuthScreen';
import { ClanDashboard } from './screens/ClanDashboard';
import './styles.css';

function App() {
  const [state,setState]=React.useState<'loading'|'setup'|'invite'|'login'|'ready'>('loading');
  const [account,setAccount]=React.useState<Account|null>(null);
  const [dashboard,setDashboard]=React.useState<Dashboard|null>(null);
  const [error,setError]=React.useState('');
  const invite=new URLSearchParams(location.search).get('invite');
  React.useEffect(()=>{
    let alive=true;
    (async()=>{
      try {
        const user=await api<Account>('auth/me');
        if(!alive)return;
        setAccount(user);setState('ready');
      } catch {
        try {
          const status=await api<{initialized:boolean}>('auth/setup-state');
          if(alive)setState(!status.initialized?'setup':invite?'invite':'login');
        } catch(e){if(alive){setError((e as Error).message);setState('login');}}
      }
    })();
    return ()=>{alive=false;};
  },[]);
  React.useEffect(()=>{
    if(state!=='ready')return;
    api<Dashboard>('dashboard').then(setDashboard).catch(e=>setError((e as Error).message));
  },[state]);
  const authenticated=(user:Account)=>{
    setAccount(user);setState('ready');setError('');
    history.replaceState(null,'',location.pathname);
  };
  const logout=async()=>{
    await api('auth/logout',{method:'POST'});
    setAccount(null);setDashboard(null);setState('login');
  };
  if(state==='loading')return <div className="loading-page"><span className="spinner"/> Loading clan...</div>;
  if(state!=='ready')return <AuthScreen mode={state} invite={invite} onDone={authenticated}/>;
  if(!account)return null;
  return <ClanDashboard user={account} data={dashboard} onChange={setDashboard} onLogout={logout} error={error}/>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
