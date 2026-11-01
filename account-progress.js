/* NIKKE Gear Manager TEST ONLY: per-account campaign and synchro/outpost profile baselines. */
(function(){
  'use strict';
  const PREFIX='nikke_gm_account_progress_v1_';
  const ACTIVE='nikke_gm_progress_active_v1';
  const STAGE_KEY='nikke_outpost_stage_selection_v1';
  const ACCOUNT_KEY='nikke_active_account_v1';
  const account=()=>{try{return localStorage.getItem(ACCOUNT_KEY)||'계정1';}catch(_){return '계정1';}};
  const read=name=>{
    try{const item=JSON.parse(localStorage.getItem(PREFIX+encodeURIComponent(name))||'null');
      return item&&item.account===name?item:null;
    }catch(_){return null;}
  };
  const stageList=()=>typeof OUTPOST_CHAPTER_STAGES!=='undefined'?OUTPOST_CHAPTER_STAGES:[];
  function stageName(raw){
    if(!raw)return null;
    const str=String(raw).replace(/\s+STAGE\s*$/i,'').trim();
    const match=str.match(/^(\d+)-/);
    if(!match)return null;
    const list=stageList()[Number(match[1])]||[];
    const normalize=s=>String(s).toUpperCase().replace(/\s*(STAGE|BOSS)\s*$/,'').replace(/\s+/g,'');
    return list.find(s=>normalize(s)===normalize(str))||null;
  }
  function stageMatches(b){
    const n=document.getElementById('outpostNormalStage')?.value||'';
    const h=document.getElementById('outpostHardStage')?.value||'';
    return !!b?.normal && n===b.normal && h===(b.hard||'');
  }
  function displayActualLevel(){
    const b=read(account());
    if(!stageMatches(b)||!Number.isInteger(b.outpostLevel)||b.outpostLevel<1||b.outpostLevel>800)return;
    const level=b.outpostLevel;
    const value=document.getElementById('outpostLevelValue');
    const progress=document.getElementById('outpostProgressText');
    const help=document.getElementById('outpostLevelHelp');
    if(value)value.innerHTML=level+' <span>of 800 · API 실제</span>';
    if(progress)progress.textContent='동기화된 실제 전초기지 Lv.'+level;
    document.querySelectorAll('#outpostProgressBars .outpost-progress-bar').forEach(bar=>bar.classList.remove('active'));
    if(help)help.textContent='노말 '+b.normal+' · 하드 '+(b.hard||'미클리어')+' · API에서 조회한 실제 전초기지 레벨입니다.';
    if(typeof updateOutpostCurrentProduction==='function')updateOutpostCurrentProduction(level);
    if(typeof outpostStageToCount==='function'){
      const nc=outpostStageToCount(Number(b.normal.split('-')[0]),b.normal);
      const hc=b.hard?outpostStageToCount(Number(b.hard.split('-')[0]),b.hard):0;
      if(typeof updateOutpostCoreDustHint==='function')updateOutpostCoreDustHint(nc,level,hc);
      if(typeof updateOutpostCoreLevelHint==='function')updateOutpostCoreLevelHint(nc+hc,level);
    }
  }
  if(typeof window.updateOutpostCalculator==='function'){
    const previous=window.updateOutpostCalculator;
    window.updateOutpostCalculator=function(){
      const result=previous.apply(this,arguments);
      displayActualLevel();
      return result;
    };
  }
  function applyStages(b){
    if(!b?.normal)return false;
    const nCh=document.getElementById('outpostNormalChapter');
    const hCh=document.getElementById('outpostHardChapter');
    const nSt=document.getElementById('outpostNormalStage');
    const hSt=document.getElementById('outpostHardStage');
    if(!nCh||!hCh||!nSt||!hSt)return false;
    nCh.value=b.normal.split('-')[0];
    hCh.value=b.hard?b.hard.split('-')[0]:'0';
    if(typeof updateOutpostStageOptions==='function')updateOutpostStageOptions();
    if(typeof updateOutpostHardStageOptions==='function')updateOutpostHardStageOptions();
    nSt.value=b.normal;
    hSt.value=b.hard||'';
    if(typeof updateOutpostCalculator==='function')updateOutpostCalculator();
    if(typeof persistOutpostStageSelection==='function')persistOutpostStageSelection();
    return true;
  }
  function sendToIframe(name,b){
    const frame=document.getElementById('syncroIframe');
    if(!frame?.contentWindow)return;
    frame.contentWindow.postMessage({type:'nikke-gm-account-progress',account:name,baseline:b},location.origin);
  }
  function clearStageView(){
    const nCh=document.getElementById('outpostNormalChapter');
    const hCh=document.getElementById('outpostHardChapter');
    const nSt=document.getElementById('outpostNormalStage');
    const hSt=document.getElementById('outpostHardStage');
    if(!nCh||!hCh||!nSt||!hSt)return;
    nCh.value='0';hCh.value='0';
    if(typeof updateOutpostStageOptions==='function')updateOutpostStageOptions();
    if(typeof updateOutpostHardStageOptions==='function')updateOutpostHardStageOptions();
    nSt.value='0-1';hSt.value='';
    if(typeof updateOutpostCalculator==='function')updateOutpostCalculator();
    if(typeof persistOutpostStageSelection==='function')persistOutpostStageSelection();
  }
  function activate(name,clearUnknown=false){
    const b=read(name);
    try{
      if(b)localStorage.setItem(ACTIVE,JSON.stringify(b));
      else localStorage.setItem(ACTIVE,JSON.stringify({account:name,baselineMissing:true}));
    }catch(_){}
    if(b?.normal)applyStages(b);
    else if(clearUnknown)clearStageView();
    else if(typeof updateOutpostCalculator==='function')updateOutpostCalculator();
    sendToIframe(name,b);
    return b;
  }
  function resetOutpost(){
    const b=read(account());
    if(!b?.normal){alert('현재 계정의 노말·하드 진행도가 없습니다. 먼저 계정을 동기화해 주세요.');return;}
    applyStages(b);
    if(typeof toast==='function')toast('동기화한 스테이지와 실제 전초기지 레벨로 복원했습니다.');
  }
  function ensureButton(){
    if(document.getElementById('outpost-profile-reset'))return;
    const label=document.querySelector('#outpostPanel .outpost-calc-section-label-with-action');
    if(!label)return;
    const button=document.createElement('button');
    button.id='outpost-profile-reset';
    button.type='button';
    button.className='outpost-final-stage-btn';
    button.textContent='정보 리셋';
    button.title='현재 계정에서 마지막으로 동기화한 노말·하드 진행도 및 전초기지 레벨 복원';
    button.addEventListener('click',resetOutpost);
    label.appendChild(button);
  }
  function accept(payload,name){
    const p=payload?.accountProgress;
    if(!p||!name)return false;
    const normal=stageName(p.normal);
    const hard=stageName(p.hard);
    const level=Number(p.outpostLevel);
    const synchro=Number(p.synchroLevel);
    if(!normal)return false;
    const b={
      account:name,areaId:Number(p.areaId)||null,
      normal,hard:hard||'',
      outpostLevel:Number.isInteger(level)&&level>=1&&level<=800?level:null,
      synchroLevel:Number.isInteger(synchro)&&synchro>=1&&synchro<=999?synchro:null,
      syncedAt:new Date().toISOString()
    };
    try{localStorage.setItem(PREFIX+encodeURIComponent(name),JSON.stringify(b));}catch(e){console.warn('계정 진행도 저장 실패',e);return false;}
    if(account()===name)activate(name);
    return true;
  }
  window.__NIKKE_GM_ACCOUNT_PROGRESS__=Object.freeze({accept,activate,resetOutpost});
  const previousSwitch=window.switchAccount;
  if(typeof previousSwitch==='function'){
    window.switchAccount=function(){
      const was=account(),result=previousSwitch.apply(this,arguments),now=account();
      if(now!==was)activate(now,true);
      return result;
    };
  }
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin || e.data?.type!=='nikke-syncro-ready')return;
    if(e.source!==document.getElementById('syncroIframe')?.contentWindow)return;
    sendToIframe(account(),read(account()));
  });
  const ready=()=>{
    ensureButton();
    activate(account());
    const frame=document.getElementById('syncroIframe');
    frame?.addEventListener('load',()=>sendToIframe(account(),read(account())));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
  else ready();
})();
