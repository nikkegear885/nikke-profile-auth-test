/* NIKKE Gear Manager TEST ONLY: per-account campaign and synchro/outpost profile baselines. */
(function(){
  'use strict';
  const PREFIX='nikke_gm_account_progress_v1_';
  const ACTIVE='nikke_gm_progress_active_v1';
  const STATUS_PREFIX='nikke_gm_progress_status_v1_';
  const STAGE_KEY='nikke_outpost_stage_selection_v1';
  const ACCOUNT_KEY='nikke_active_account_v1';
  const account=()=>{try{return localStorage.getItem(ACCOUNT_KEY)||'계정1';}catch(_){return '계정1';}};
  const read=name=>{
    try{const item=JSON.parse(localStorage.getItem(PREFIX+encodeURIComponent(name))||'null');
      return item&&item.account===name?item:null;
    }catch(_){return null;}
  };
  const stageList=()=>typeof OUTPOST_CHAPTER_STAGES!=='undefined'?OUTPOST_CHAPTER_STAGES:[];
  // Use the site's stage catalogue, not a numeric guess. API labels can include
  // STAGE/BOSS prefixes or suffixes and optional branch identifiers.
  function stageName(raw){
    if(!raw)return null;
    const input=String(raw).trim().toUpperCase();
    const match=input.match(/(\d{1,2})\s*-\s*(\d+(?:[AB](?:-\d+)?)?)/i);
    if(!match)return null;
    const chapter=Number(match[1]),suffix=match[2].toUpperCase();
    const list=stageList()[chapter]||[];
    const wanted=String(chapter)+'-'+suffix;
    const clean=s=>String(s).toUpperCase().replace(/\s*(STAGE|BOSS)\s*$/,'').replace(/\s+/g,'');
    return list.find(s=>clean(s)===wanted)||null;
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
    if(help)help.textContent='노말 '+b.normal+' · 하드 '+(b.hard||'미클리어')+
      (b.stageStale?' · 스테이지는 마지막으로 확인된 이전 기록입니다.':' · API에서 조회한 실제 전초기지 레벨입니다.');
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
    // The browser silently refuses a select value if no matching option exists.
    // Only report success after verifying both actual DOM selections.
    nSt.value=b.normal;
    hSt.value=b.hard||'';
    const applied=stageMatches(b)&&
      nCh.value===b.normal.split('-')[0]&&
      hCh.value===(b.hard?b.hard.split('-')[0]:'0');
    if(!applied){
      console.warn('[NIKKE GM] stage selection was rejected by the dropdowns',
        {expected:{normal:b.normal,hard:b.hard},actual:{normal:nSt.value,hard:hSt.value}});
      return false;
    }
    if(typeof updateOutpostCalculator==='function')updateOutpostCalculator();
    if(typeof persistOutpostStageSelection==='function')persistOutpostStageSelection();
    displayActualLevel();
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
  function recordStatus(name,message){
    if(!name)return;
    const data={message:String(message||'').slice(0,300),at:new Date().toISOString()};
    try{localStorage.setItem(STATUS_PREFIX+encodeURIComponent(name),JSON.stringify(data));}catch(_){}
    if(account()===name)renderCampaignStatus(read(name));
  }
  function renderCampaignStatus(b){
    const note=document.getElementById('outpost-account-progress-status');
    if(!note)return;
    let status=null;
    try{status=JSON.parse(localStorage.getItem(STATUS_PREFIX+encodeURIComponent(account()))||'null');}catch(_){}
    const baseline=!b?'':b.stageStale
      ? ('스테이지 최신 조회 실패 · '+
         (b.normal?'이전 스테이지 '+b.normal+' · ':'')+
         '싱크로 '+(b.synchroLevel??'조회 불가')+
         ' / 실제 전초기지 '+(b.outpostLevel??'조회 불가'))
      : (b.normal?'동기화 계정 · 노말 '+b.normal+' / 하드 '+(b.hard||'미클리어')+
         ' · 실제 전초기지 '+(b.outpostLevel??'조회 불가'):'');
    note.textContent=[baseline,status?.message].filter(Boolean).join(' | ');
    note.hidden=!note.textContent;
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
    renderCampaignStatus(b);
    sendToIframe(name,b);
    return b;
  }
  function resetOutpost(){
    const b=read(account());
    if(!b?.normal){alert('현재 계정의 노말·하드 진행도가 없습니다. 먼저 계정을 동기화해 주세요.');return;}
    applyStages(b);
    if(typeof toast==='function')toast(b.stageStale?
      '최신 스테이지 조회에 실패해 마지막으로 확인한 스테이지를 복원했습니다.':
      '동기화한 스테이지와 실제 전초기지 레벨로 복원했습니다.');
  }
  let refreshing=false;
  async function refreshFromApi(){
    if(refreshing)return;
    const name=account();
    let url='',area=null;
    try{
      url=localStorage.getItem('nikke_bl_profile_url_'+encodeURIComponent(name))||'';
      area=Number(JSON.parse(localStorage.getItem('nikkeBlSyncMeta_'+encodeURIComponent(name))||'null')?.areaId);
    }catch(_){}
    if(!url||![81,82,83,84,85].includes(area)){
      recordStatus(name,'저장된 프로필 링크 또는 서버 정보가 없습니다. 먼저 계정 동기화를 한 번 실행해 주세요.');
      return;
    }
    const button=document.getElementById('outpost-profile-refresh');
    refreshing=true;
    if(button){button.disabled=true;button.textContent='조회 중…';}
    recordStatus(name,'저장된 프로필 링크로 캠페인 진행도를 조회하는 중…');
    try{
      const api=window.__NIKKE_GM_EXTERNAL_SYNC__;
      if(!api?.getProfile)throw new Error('외부 API 모듈이 로드되지 않았습니다.');
      if(!api.allowExternalRequest())throw new Error('외부 API 이용에 동의하지 않았습니다.');
      const info=await api.getProfile(url,area);
      const progress=info?.progress;
      if(!progress?.normal)throw new Error(progress?.progressError||
        'API에서 해당 계정의 노말 캠페인 진행도를 보내지 않았습니다.');
      // Never overwrite whichever other account the user selected during the await.
      const result=accept({accountProgress:progress},name);
      if(!result.applied){
        if(!result.saved||!result.stageResolved)throw new Error(result.reason||'스테이지 정보 저장 실패');
        recordStatus(name,'스테이지는 저장됐지만 현재 계정 선택칸에 적용되지 않았습니다: '+result.reason);
      }
    }catch(error){
      recordStatus(name,'계정 스테이지 재조회 실패: '+String(error?.message||error).slice(0,220));
    }finally{
      refreshing=false;
      if(button){button.disabled=false;button.textContent='계정 정보 새로고침';}
    }
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
    const refresh=document.createElement('button');
    refresh.id='outpost-profile-refresh';
    refresh.type='button';
    refresh.className='outpost-final-stage-btn';
    refresh.textContent='계정 정보 새로고침';
    refresh.title='장비·스킬 재동기화 없이 마지막으로 연결한 계정의 노말·하드 진행도와 전초기지·싱크로 레벨 다시 조회';
    refresh.addEventListener('click',refreshFromApi);
    label.appendChild(refresh);
    const note=document.createElement('div');
    note.id='outpost-account-progress-status';
    note.style.cssText='font-size:12px;line-height:1.5;flex-basis:100%;width:100%;margin-top:5px;color:var(--muted,#728391)';
    note.hidden=true;
    label.insertAdjacentElement('afterend',note);
  }
  function accept(payload,name){
    const p=payload?.accountProgress;
    if(!p||!name){
      recordStatus(name,'동기화 응답에 스테이지 진행도 정보가 없습니다.');
      return {saved:false,applied:false,reason:'계정 진행도 응답 없음'};
    }
    const normal=stageName(p.normal);
    const hard=stageName(p.hard);
    const level=Number(p.outpostLevel),synchro=Number(p.synchroLevel);
    const actualLevel=p.outpostLevel!=null&&Number.isInteger(level)&&level>=1&&level<=800?level:null;
    const actualSynchro=p.synchroLevel!=null&&Number.isInteger(synchro)&&synchro>=1&&synchro<=1200?synchro:null;
    if(!normal&&actualLevel===null&&actualSynchro===null){
      const reason=p.normal
        ? 'API 노말 스테이지 "'+String(p.normal).slice(0,45)+'"를 사이트 스테이지 목록에서 찾지 못했습니다.'
        : (p.progressError||'API에서 스테이지와 레벨을 받지 못했습니다.');
      recordStatus(name,'스테이지 입력 실패: '+reason);
      return {saved:false,applied:false,reason};
    }
    const old=read(name);
    // Never reuse a different profile's saved stage just because it has the same region.
    const sameProfile=old&&Number(old.areaId)===Number(p.areaId)&&
      old.profileId&&p.profileId&&old.profileId===p.profileId;
    const b={
      account:name,areaId:Number(p.areaId)||null,profileId:p.profileId||null,
      normal:normal||(sameProfile?old.normal:null)||null,
      hard:normal?(hard||''):(sameProfile?(old.hard||''):''),
      stageStale:!normal,
      progressError:p.progressError||null,
      outpostLevel:actualLevel,
      synchroLevel:actualSynchro,
      syncedAt:new Date().toISOString()
    };
    try{localStorage.setItem(PREFIX+encodeURIComponent(name),JSON.stringify(b));}
    catch(e){
      console.warn('[NIKKE GM] save stage data',e);
      recordStatus(name,'스테이지 저장 실패: 브라우저 저장소 오류');
      return {saved:false,applied:false,reason:'브라우저 저장 실패'};
    }
    const isCurrent=account()===name;
    const applied=isCurrent&&!!normal?!!applyStages(b):false;
    if(isCurrent){
      try{localStorage.setItem(ACTIVE,JSON.stringify(b));}catch(_){}
      sendToIframe(name,b);
    }
    const reason=!normal?(
        p.normal
        ? 'API 스테이지 "'+String(p.normal).slice(0,45)+'"가 현재 스테이지 목록과 불일치'
        : (p.progressError||'API 노말 스테이지 미수신'))
      : !isCurrent?'동기화한 계정이 화면의 선택 계정과 다름'
      : !applied?'노말/하드 선택칸이 API 진행도를 적용하지 못함':null;
    recordStatus(name,normal
      ? (applied?'API 스테이지 화면 적용 확인':('스테이지 저장됨 · '+reason))
      : ('최신 스테이지 조회 실패 · '+reason));
    return {
      saved:true,stageResolved:!!normal,applied,active:isCurrent,
      normal:b.normal,hard:b.hard,reason
    };
  }
  // Reconcile a dropdown rebuilt by the production outpost view on navigation.
  // Only restore when its saved selection still equals the synced baseline:
  // intentional manual stage edits are never overridden.
  function refreshOutpost(){
    const b=read(account());
    if(!b?.normal)return false;
    if(stageMatches(b)){displayActualLevel();return true;}
    let current=null;
    try{current=JSON.parse(localStorage.getItem(STAGE_KEY)||'null');}catch(_){}
    if(current?.normal===b.normal&&current?.hard===(b.hard||'')){
      return applyStages(b);
    }
    return false;
  }
  window.__NIKKE_GM_ACCOUNT_PROGRESS__=Object.freeze({
    accept,activate,resetOutpost,refreshOutpost,refreshFromApi
  });
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
