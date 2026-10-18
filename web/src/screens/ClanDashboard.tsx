import React from 'react';
import { Swords, Trophy, Settings, LogOut, Users, Medal, History, Shield, ChevronLeft } from 'lucide-react';
import { Account,api,Dashboard,number,Player,previousTuesday,shortNumber,Week } from '../api';
import { ImportModal } from './ImportModal';
import { SettingsModal } from './SettingsModal';
import { MembersModal } from './MembersModal';

function Leaders({title,players,metric}:{title:string;players:Player[];metric:'average'|'lastPoints'}) {
  return <section className="panel leaders-widget">
    <header className="widget-head"><h2><Medal size={19}/> {title}</h2><span className="chip">{metric==='average'?'Average / war':'Weekly points'}</span></header>
    {players.length===0?<p className="empty">Import a weekly leaderboard to see the top players.</p>:<div className="leader-list">
      {players.slice(0,6).map((p,index)=><div key={p.id} className={'leader-row '+(!p.active?'inactive':'')+(p.belowRequirement?' below':'')}>
        <span className={'place place-'+index}>{index+1}</span>
        <div className="leader-name"><strong>{p.name}</strong><small>{p.appearances} {p.appearances===1?'war':'wars'} {!p.active?'· LEFT':''}</small></div>
        <b className="score">{number(metric==='average'?p.average:p.lastPoints||0)}</b>
      </div>)}
    </div>}
  </section>;
}
function DayTable({week}:{week:Week}) {
  return <div className="day-table">
    {week.days.map(d=><div className={'day-row '+d.winner} key={d.day}>
      <span>Day {d.day}</span><b>{d.points}</b><span className="daily-mvp" title={d.mvp}>{d.mvp}</span>
    </div>)}
  </div>;
}
function WarColumn({week,onImport}:{week:Week;onImport:(w:Week)=>void}) {
  const finished=week.resultImported;
  const isWin=finished&&week.ourScore!>week.opponentScore!;
  const isLoss=finished&&week.ourScore!<week.opponentScore!;
  const imported=week.rankingImported||week.resultImported;
  const canRanking=week.permissions.ranking&&!week.rankingImported;
  const canResult=week.permissions.result&&!week.resultImported;
  return <article className={'war-column '+week.state+(!imported?' not-imported':'')+(isWin?' won':isLoss?' lost':'')} data-start={week.start}>
    <header className="war-heading">
      <div className="war-date">{week.label}</div>
      <div className="war-status">{isWin?'VICTORY':isLoss?'DEFEAT':week.state==='active'?'IN PROGRESS':week.state==='future'?'UPCOMING':imported?'PARTIAL':'NO DATA'}</div>
    </header>
    <div className="war-content">
      {week.opponent?<><span className="muted tiny">VS</span><div className="opponent">{week.opponent}</div></>:<div className="opponent muted">Unknown opponent</div>}
      <div className="war-score">{finished?<><span className="friendly">{week.ourScore}</span><span className="colon">:</span><span className="enemy">{week.opponentScore}</span></>:<span className="placeholder">— : —</span>}</div>
      {finished?<><h3>Daily scores</h3><DayTable week={week}/></>:<div className="war-placeholder">{week.resultImported?'':'Final result pending'}</div>}
      <div className="war-roster-head"><h3>Players</h3>{week.rankingImported&&<span className="tiny muted">{week.players.length}</span>}</div>
      {week.rankingImported?<div className="war-player-list">{week.players.map(p=><div className={'war-player '+(!p.active?'inactive':'')} key={p.id}>
        <span className="rank-number">{p.position}</span><span title={p.name} className="roster-name">{p.name}</span><b>{shortNumber(p.points)}</b>
      </div>)}</div>:<div className="war-placeholder">Weekly ranking not imported</div>}
      {(canRanking||canResult)&&week.state!=='future'&&<button className="game-button blue full import-btn" onClick={()=>onImport(week)}>+ Import {canRanking&&canResult?'data':canRanking?'ranking':'result'}</button>}
    </div>
  </article>;
}
export function ClanDashboard({user,data,onChange,onLogout,error}:{user:Account;data:Dashboard|null;onChange:(d:Dashboard)=>void;onLogout:()=>void;error:string}) {
  const [dialog,setDialog]=React.useState<'settings'|'members'|null>(null);
  const [importWeek,setImportWeek]=React.useState<Week|null>(null);
  const [loadingOlder,setLoadingOlder]=React.useState(false);
  const [weeks,setWeeks]=React.useState<Week[]>([]);
  const track=React.useRef<HTMLDivElement>(null);
  const initialized=React.useRef(false);
  const canEdit=user.role!=='member';
  React.useEffect(()=>{
    if(!data)return;
    setWeeks(prev=>{
      const existing=new Map(prev.map(w=>[w.start,w]));
      data.weeks.forEach(w=>existing.set(w.start,w));
      return [...existing.values()].sort((a,b)=>a.start.localeCompare(b.start));
    });
  },[data]);
  React.useEffect(()=>{
    if(!data||!track.current||initialized.current)return;
    initialized.current=true;
    requestAnimationFrame(()=>{
      const selected=track.current?.querySelector<HTMLElement>('.war-column.active');
      selected?.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'});
    });
  },[data,weeks]);
  async function moreHistory() {
    if(!weeks.length||loadingOlder)return;
    setLoadingOlder(true);
    try {
      const container=track.current,previousWidth=container?.scrollWidth||0;
      const next=await api<Dashboard>('dashboard?anchor='+encodeURIComponent(previousTuesday(weeks[0].start))+'&count=10');
      setWeeks(old=>[...next.weeks.filter(w=>!old.some(x=>x.start===w.start)),...old]);
      requestAnimationFrame(()=>{if(container)container.scrollLeft+=container.scrollWidth-previousWidth;});
    } catch(e){alert((e as Error).message);}finally{setLoadingOlder(false);}
  }
  if(!data)return <main className="loading-page"><span className="spinner"/> {error||'Loading records...'}</main>;
  return <div className="page">
    <header className="site-header"><div className="brand"><span className="brand-mark"><Swords size={26}/></span><div><strong>DUNGEON RUSH</strong><small>CLAN WAR ARCHIVE</small></div></div>
      <div className="header-actions"><span className="current-user"><Shield size={14}/> {user.displayName} <small>{user.role}</small></span>
      {canEdit&&<button title="Settings" className="icon-button" onClick={()=>setDialog('settings')}><Settings size={19}/></button>}
      {user.role==='owner'&&<button title="Members" className="icon-button" onClick={()=>setDialog('members')}><Users size={19}/></button>}
      <button title="Log out" className="icon-button" onClick={onLogout}><LogOut size={19}/></button></div>
    </header>
    <main className="dashboard">
      {error&&<div className="error-strip">{error}</div>}
      <div className="dashboard-top">
        <section className="panel clan-widget">
          <div className="eyebrow"><Swords size={15}/> CLAN OVERVIEW</div>
          <h1>{data.rankings.settings.clanName}</h1>
          <div className="record"><strong className="friendly">{data.record.wins}</strong><span>/</span><strong className="enemy">{data.record.losses}</strong><span className="record-label">WINS / LOSSES</span></div>
          <div className="requirement"><span>Weekly requirement</span><b>{data.rankings.settings.minimumPoints/1000}k pts</b></div>
          <div className="requirement"><span>Calculated score weights</span><b>{data.rankings.settings.weights.map(w=>Math.round(w*100)+'%').join(' · ')}</b></div>
        </section>
        <Leaders title="All-time leaders" players={data.rankings.allTime} metric="average"/>
        <Leaders title="Latest war leaders" players={data.rankings.latest} metric="lastPoints"/>
      </div>
      <section className="panel history-widget">
        <header className="widget-head timeline-heading"><div><h2><History size={20}/> War history</h2><p className="muted tiny">Tuesday–Sunday · Monday break · all times UTC</p></div>
          <button onClick={moreHistory} disabled={loadingOlder} className="game-button secondary"><ChevronLeft size={17}/> {loadingOlder?'Loading...':'Older wars'}</button></header>
        <div className="timeline-scroll" ref={track}><div className="timeline-track">{weeks.map(w=><WarColumn key={w.start} week={w} onImport={setImportWeek}/>)}</div></div>
      </section>
      <footer>Records from imported screenshots · Missing weeks remain visible · <Trophy size={13}/> Dungeon Rush</footer>
    </main>
    {importWeek&&canEdit&&<ImportModal key={importWeek.start} week={importWeek} clanName={data.rankings.settings.clanName}
      onClose={()=>setImportWeek(null)} onDone={next=>{onChange(next);setImportWeek(null);}}/>}
    {dialog==='settings'&&canEdit&&<SettingsModal current={data.rankings.settings} onClose={()=>setDialog(null)}
      onDone={next=>{onChange(next);setDialog(null);}}/>}
    {dialog==='members'&&user.role==='owner'&&<MembersModal onClose={()=>setDialog(null)}/>}
  </div>;
}
