import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const base='http://127.0.0.1:'+(process.env.PORT||3128)+'/api/';
async function request(path,method='GET',body=null,cookie='') {
  const headers={'X-Requested-With':'clan-stats'};
  if(body!==null)headers['Content-Type']='application/json';
  if(cookie)headers.Cookie=cookie;
  const res=await fetch(base+path,{method,headers,body:body===null?undefined:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  return {status:res.status,body:data,cookie:(res.headers.get('set-cookie')||'').split(';')[0]};
}
function totp(secret) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let accumulator=0,bits=0;const bytes=[];
  for(const c of secret){accumulator=(accumulator<<5)|alphabet.indexOf(c);bits+=5;if(bits>=8){bits-=8;bytes.push((accumulator>>bits)&255);}}
  const step=Math.floor(Date.now()/30000);
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));
  const hash=createHmac('sha1',Buffer.from(bytes)).update(counter).digest();
  return String((hash.readUInt32BE(hash[19]&15)&0x7fffffff)%1000000).padStart(6,'0');
}
function startFor(date) {
  const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
  d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+5)%7);
  return d;
}
function weekOffset(start,offset) {
  const d=new Date(start);d.setUTCDate(d.getUTCDate()+offset*7);return d.toISOString().slice(0,10);
}
function ensure(actual,expected,context) {assert.equal(actual,expected,context);}
async function run(){
  ensure((await request('auth/setup-state')).body.initialized,false,'Uninitialized');
  ensure((await request('dashboard')).status,401,'Dashboard guarded');
  const boot=await request('auth/bootstrap/start','POST',{bootstrapToken:process.env.BOOTSTRAP_TOKEN});
  ensure(boot.status,201,'Bootstrap start');
  const secret=new URL(boot.body.uri).searchParams.get('secret');
  const owner=await request('auth/bootstrap/finish','POST',{
    bootstrapToken:process.env.BOOTSTRAP_TOKEN,username:'owner',password:'testing-password-1234',code:totp(secret)});
  ensure(owner.status,201,'Owner enrolled');
  const ownerCookie=owner.cookie;
  assert.ok(ownerCookie.startsWith('clan_session='),'Owner cookie was issued');
  ensure((await request('auth/me','GET',null,ownerCookie)).body.role,'owner','Owner role');
  const old=weekOffset(startFor(new Date()),-3);
  const recent=weekOffset(startFor(new Date()),-2);
  const dayPoints=[1,2,2,2,2,4];
  const days=dayPoints.map((points,i)=>({day:i+1,points,winner:i===1?'opponent':'ours',mvp:i===1?'opponentMVP':'КРОСТ'}));
  let result=await request('import/confirm','POST',{
    start:old,players:[{position:1,name:'КРОСТ',points:100000},{position:2,name:'Someone',points:200000}],
    result:{opponent:'poorplay',ourScore:11,opponentScore:2,days}
  },ownerCookie);
  ensure(result.status,201,'Initial import');
  ensure(result.body.record.wins,1,'Win counted');
  result=await request('import/confirm','POST',{start:recent,
    players:[{position:1,name:'NewPerson',points:550000},{position:2,name:'КРОСТ',points:400000}]
  },ownerCookie);
  ensure(result.status,201,'Next week imported');
  const computed=result.body.rankings.calculated;
  const oldPlayer=computed.find(p=>p.name==='Someone');
  const oldName=computed.find(p=>p.name==='КРОСТ');
  const newcomer=computed.find(p=>p.name==='NewPerson');
  ensure(oldPlayer.active,false,'Missing player marked inactive');
  ensure(oldName.score,325000,'75/25 calculation');
  ensure(newcomer.active,true,'Newcomer marked active');
  ensure((await request('import/confirm','POST',{start:recent,players:[{position:1,name:'КРОСТ',points:123}]},ownerCookie)).status,400,'Prevent duplicate import');
  const invitation=await request('auth/invites','POST',{label:'Guest',role:'member'},ownerCookie);
  ensure(invitation.status,201,'Owner can invite');
  const inviteToken=new URL(invitation.body.url).searchParams.get('invite');
  const enroll=await request('auth/invite/'+inviteToken+'/start','POST',{});
  ensure(enroll.status,201,'Member can enroll');
  const secret2=new URL(enroll.body.uri).searchParams.get('secret');
  const member=await request('auth/invite/'+inviteToken+'/finish','POST',{username:'guest',password:'guest-password-1234',code:totp(secret2)});
  ensure(member.status,201,'Member account registered');
  const memberCookie=member.cookie;
  ensure((await request('dashboard','GET',null,memberCookie)).status,200,'Member can view');
  ensure((await request('settings','PATCH',{clanName:'Modified',minimumPoints:0,weights:[1]},memberCookie)).status,403,'Member cannot edit settings');
  ensure((await request('import/confirm','POST',{start:recent,players:[{position:1,name:'Fake',points:12}]},memberCookie)).status,403,'Member cannot import');
  const revoke=await request('auth/accounts/'+member.body.id,'DELETE',null,ownerCookie);
  ensure(revoke.status,200,'Owner can revoke');
  ensure((await request('dashboard','GET',null,memberCookie)).status,401,'Revoked user denied');
  console.log('Production integration smoke tests passed');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
