import React from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { Account,api,json } from '../api';

export function AuthScreen({mode,invite,onDone}:{mode:string;invite:string|null;onDone:(user:Account)=>void}) {
  const [username,setUsername]=React.useState('');
  const [password,setPassword]=React.useState('');
  const [otp,setOtp]=React.useState('');
  const [bootstrap,setBootstrap]=React.useState('');
  const [step,setStep]=React.useState(0);
  const [qr,setQr]=React.useState('');
  const [info,setInfo]=React.useState('');
  const [error,setError]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  React.useEffect(()=>{
    if(mode==='invite'&&invite)api<{label:string;role:string}>('auth/invite/'+encodeURIComponent(invite))
      .then(x=>setInfo(x.label+' · '+x.role)).catch(e=>setError((e as Error).message));
  },[mode,invite]);
  const setup=mode==='setup',inviting=mode==='invite',login=mode==='login';
  async function submit(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError('');
    try {
      if(login) {
        onDone(await api<Account>('auth/login',json('POST',{username,password,code:otp})));
      } else if(step===0) {
        const url=setup?'auth/bootstrap/start':'auth/invite/'+encodeURIComponent(invite||'')+'/start';
        const result=await api<{qr:string}>(url,json('POST',setup?{bootstrapToken:bootstrap}:{}));
        setQr(result.qr);setStep(1);
      } else {
        const url=setup?'auth/bootstrap/finish':'auth/invite/'+encodeURIComponent(invite||'')+'/finish';
        onDone(await api<Account>(url,json('POST',{username,password,code:otp,...(setup?{bootstrapToken:bootstrap}:{})})));
      }
    } catch(e){setError((e as Error).message);}
    finally {setBusy(false);}
  }
  return <main className="auth-shell">
    <div className="panel auth-card">
      <div className="eyebrow"><ShieldCheck size={16}/> PRIVATE CLAN AREA</div>
      <h1>Dungeon Rush</h1><h2>Clan War Archive</h2>
      <p className="muted">{setup?'Create your owner account':inviting?'Accept your personal invitation':'Sign in with your password and authenticator code'}</p>
      {info&&<div className="info-strip">{info}</div>}
      <form onSubmit={submit}>
        {setup&&<label>Setup token<input type="password" autoComplete="off" value={bootstrap} onChange={e=>setBootstrap(e.target.value)} required/></label>}
        {(!login&&step===1)&&<div className="qr-box"><img src={qr} alt="Authenticator enrollment QR"/><p>Scan in your authenticator app, then enter its six-digit code below.</p></div>}
        {(login||step===1)&&<>
          <label>Username<input autoComplete="username" value={username} maxLength={50} onChange={e=>setUsername(e.target.value)} required/></label>
          <label>Password<input type="password" autoComplete={login?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={login?undefined:8} required/></label>
          <label>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} placeholder="000000" required/></label>
        </>}
        {error&&<div role="alert" className="error-strip">{error}</div>}
        <button className="game-button blue full" disabled={busy}>{busy?'Please wait...':login?'Sign in':step===0?'Get authenticator QR':'Finish setup'} <ArrowRight size={17}/></button>
      </form>
    </div>
  </main>;
}
