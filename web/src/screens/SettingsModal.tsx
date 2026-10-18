import React from 'react';
import { Settings, X, Save, Plus, Trash2 } from 'lucide-react';
import {api,Dashboard,json} from '../api';

export function SettingsModal({current,onClose,onDone}:{current:Dashboard['rankings']['settings'];onClose:()=>void;onDone:(next:Dashboard)=>void}) {
  const [clanName,setClanName]=React.useState(current.clanName);
  const [minimum,setMinimum]=React.useState(String(current.minimumPoints/1000));
  const [weights,setWeights]=React.useState(current.weights.map(w=>String(Math.round(w*10000)/100)));
  const [error,setError]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  async function save() {
    setBusy(true);setError('');
    try {
      const list=weights.map(w=>Number(w)/100);
      if(list.some(w=>!Number.isFinite(w)||w<=0)||Math.abs(list.reduce((s,w)=>s+w,0)-1)>0.00001)throw new Error('Weights must be positive and total exactly 100%.');
      const min=Number(minimum);
      if(!Number.isInteger(min*1000)||min<0)throw new Error('Requirement must be a non-negative number of thousands.');
      onDone(await api<Dashboard>('settings',json('PATCH',{clanName,minimumPoints:min*1000,weights:list})));
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="panel modal settings-modal" role="dialog" aria-modal="true">
      <header className="modal-header"><h2><Settings/> Clan settings</h2><button className="close-button" onClick={onClose}><X/></button></header>
      <div className="modal-content">
        <label>Clan name<input value={clanName} onChange={e=>setClanName(e.target.value)}/></label>
        <label>Minimum calculated weekly score<div className="input-suffix"><input type="number" step="1" min="0" value={minimum} onChange={e=>setMinimum(e.target.value)}/><span>k pts</span></div></label>
        <div className="review-head"><h3>Calculated score weights</h3><button className="game-button secondary" disabled={weights.length>=12} onClick={()=>setWeights(old=>[...old,'0'])}><Plus size={14}/> Add</button></div>
        <p className="tiny muted">Newest imported war first. The weights must sum to 100%. If fewer wars are available, the available weights are normalized.</p>
        {weights.map((w,i)=><div className="weight-row" key={i}><span>War −{i}</span><input type="number" step=".01" min="0" max="100" value={w}
          onChange={e=>setWeights(old=>old.map((v,j)=>i===j?e.target.value:v))}/><span>%</span><button className="icon-button danger" disabled={weights.length<=1} onClick={()=>setWeights(old=>old.filter((_,j)=>i!==j))}><Trash2 size={16}/></button></div>)}
        <div className="sum-row">Total: <b>{weights.reduce((s,x)=>s+(Number(x)||0),0).toFixed(2)}%</b></div>
      </div>
      {error&&<div className="error-strip">{error}</div>}
      <footer className="modal-actions"><button className="game-button secondary" onClick={onClose}>Cancel</button><button className="game-button blue" disabled={busy} onClick={save}><Save size={17}/> Save</button></footer>
    </section>
  </div>;
}
