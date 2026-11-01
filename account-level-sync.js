/* NIKKE Gear Manager TEST ONLY: synchro and outpost level lookup.
 * Equipment and skill sync still uses the original production Cloudflare Worker.
 * This module never requests campaign stages or modifies production infrastructure.
 */
(function(){
  'use strict';
  const BASE='https://nikke-api-edge.leegunwoo0325-5e6.workers.dev';
  const CONSENT='nikke_gm_level_lookup_consent_v1';
  const PREFIX='nikke_gm_calculator_levels_v1_';
  const ACTIVE_KEY='nikke_active_account_v1';
  const REGIONS=new Set([81,82,83,84,85]);
  const TIMEOUT_MS=90000;
  const key=name=>PREFIX+encodeURIComponent(name);
  const currentAccount=()=>{
    try{return localStorage.getItem(ACTIVE_KEY)||'계정1';}catch(_){return '계정1';}
  };
  function num(value,max){
    if(value===null||value===undefined||value==='')return null;
    const n=Number(value);
    return Number.isInteger(n)&&n>=1&&n<=max?n:null;
  }
  function profileId(url){
    const u=new URL(String(url||''));
    if(u.protocol!=='https:'||u.hostname!=='www.blablalink.com'||u.pathname!=='/user')
      throw new Error('BlaBlaLink 프로필 URL이 올바르지 않습니다.');
    const id=u.searchParams.get('openid');
    if(!id||!/^[a-zA-Z0-9_+/=-]{8,240}$/.test(id))throw new Error('프로필 ID를 읽을 수 없습니다.');
    return id;
  }
  function read(name){
    try{
      const record=JSON.parse(localStorage.getItem(key(name))||'null');
      if(!record||record.account!==name||!REGIONS.has(Number(record.areaId)))return null;
      const storedUrl=localStorage.getItem('nikke_bl_profile_url_'+encodeURIComponent(name));
      if(!storedUrl||record.profileId!==profileId(storedUrl))return null;
      // Do not reapply stale data after the slot has been linked to another region.
      const meta=JSON.parse(localStorage.getItem('nikkeBlSyncMeta_'+encodeURIComponent(name))||'null');
      if(REGIONS.has(Number(meta?.areaId))&&Number(meta.areaId)!==Number(record.areaId))return null;
      return {...record,synchroLevel:num(record.synchroLevel,1200),outpostLevel:num(record.outpostLevel,800)};
    }catch(_){return null;}
  }
  function send(name){
    const frame=document.getElementById('syncroIframe');
    if(!frame?.contentWindow)return;
    frame.contentWindow.postMessage({
      type:'nikke-gm-calculator-levels',
      account:name,
      baseline:read(name)
    },location.origin);
  }
  function replyMySynchro(name,message){
    if(currentAccount()!==name)return;
    const frame=document.getElementById('syncroIframe');
    if(!frame?.contentWindow)return;
    const b=read(name);
    frame.contentWindow.postMessage({
      type:'nikke-gm-my-synchro',
      account:name,
      synchroLevel:num(b?.synchroLevel,1200),
      outpostLevel:num(b?.outpostLevel,800),
      areaId:b?.areaId??null,
      profileId:b?.profileId??null,
      message:message||null
    },location.origin);
  }
  window.addEventListener('message',event=>{
    const frame=document.getElementById('syncroIframe');
    if(!frame||event.origin!==location.origin||event.source!==frame.contentWindow)return;
    if(event.data?.type==='nikke-syncro-ready'){send(currentAccount());return;}
    if(event.data?.type!=='nikke-gm-request-my-synchro')return;
    const name=currentAccount();
    const cached=read(name);
    if(num(cached?.synchroLevel,1200)!==null&&num(cached?.outpostLevel,800)!==null){
      replyMySynchro(name);
      return;
    }
    let url='',area=null;
    try{
      url=localStorage.getItem('nikke_bl_profile_url_'+encodeURIComponent(name))||'';
      const meta=JSON.parse(localStorage.getItem('nikkeBlSyncMeta_'+encodeURIComponent(name))||'null');
      area=Number(meta?.areaId);
    }catch(_){}
    if(!url||!REGIONS.has(area)){
      replyMySynchro(name,'현재 계정의 동기화 정보가 없습니다. 장비·스킬 계정 동기화를 먼저 진행해 주세요.');
      return;
    }
    window.__NIKKE_GM_SYNC_LEVELS__({area_id:area},name,url,{silent:true})
      .then(message=>replyMySynchro(name,message))
      .catch(error=>replyMySynchro(name,'계정 레벨 조회 실패: '+String(error?.message||error)));
  });
  // Account switching must use account-scoped records, not the last imported account.
  const previousSwitch=window.switchAccount;
  if(typeof previousSwitch==='function'){
    window.switchAccount=function(){
      const before=currentAccount();
      const result=previousSwitch.apply(this,arguments);
      if(before!==currentAccount())send(currentAccount());
      return result;
    };
  }
  let requestSequence=0;
  window.__NIKKE_GM_SYNC_LEVELS__=async function(payload,name,url,options){
    const account=String(name||'');
    const region=Number(payload?.area_id??payload?.areaId);
    if(!account||!REGIONS.has(region))return '서버 정보가 없어 레벨을 적용하지 않았습니다.';
    const id=profileId(url);
    let consented=false;
    try{consented=localStorage.getItem(CONSENT)==='accepted';}catch(_){}
    if(!consented){
      const approved=confirm(
        '싱크로·전초기지 레벨 조회에는 별도 외부 NIKKE API가 필요합니다.\\n\\n'+
        '공개 BlaBlaLink 프로필 ID만 제3자 API 운영자(leegunwoooo)에게 전송합니다. '+
        '장비·스킬 동기화는 기존 Cloudflare Worker를 그대로 사용하며, 캠페인 진행도는 조회하거나 적용하지 않습니다.\\n\\n'+
        '동의하고 두 레벨을 조회할까요?'
      );
      if(!approved)return '레벨 조회를 건너뛰었습니다. 계산기에서 직접 입력할 수 있습니다.';
      try{localStorage.setItem(CONSENT,'accepted');}catch(_){}
    }
    const sequence=++requestSequence;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    let raw;
    try{
      const response=await fetch(BASE+'/api/user/roster?blablaid='+encodeURIComponent(id)+'&area='+region,{
        method:'GET',
        credentials:'omit',
        cache:'no-store',
        referrerPolicy:'no-referrer',
        headers:{Accept:'application/json'},
        signal:controller.signal
      });
      if(!response.ok)throw new Error('레벨 조회 API HTTP '+response.status);
      raw=await response.json();
    }catch(error){
      return '레벨을 조회하지 못했습니다 ('+(error?.name==='AbortError'?'응답 시간 초과':String(error?.message||'연결 오류'))+'). 기존 값은 유지합니다.';
    }finally{clearTimeout(timeout);}
    if(sequence!==requestSequence)return '이후 동기화 요청이 있어 이전 레벨 결과를 무시했습니다.';
    if(!Array.isArray(raw?.areas))return '서버별 레벨 정보가 없어 기존 값을 유지했습니다.';
    const selected=raw.areas.find(row=>Number(row?.area)===region);
    if(!selected||!Array.isArray(selected.characters)||selected.characters.length===0)
      return '동기화한 서버의 계정을 별도 API에서 확인할 수 없어 기존 값을 유지했습니다.';
    // A provider's default-region profile must never be used for a different server.
    const outpost=selected.outpost&&typeof selected.outpost==='object'?selected.outpost:{};
    const synchro=num(outpost.synchro_level,1200);
    const level=num(outpost.outpost_battle_level,800);
    if(synchro===null&&level===null)return '선택한 서버의 싱크로·전초기지 레벨이 공개되지 않아 기존 값을 유지했습니다.';
    const old=read(account);
    const same=old?.profileId===id&&old?.areaId===region;
    const record={
      account,areaId:region,profileId:id,
      synchroLevel:synchro??(same?old.synchroLevel:null),
      outpostLevel:level??(same?old.outpostLevel:null),
      syncedAt:new Date().toISOString()
    };
    try{localStorage.setItem(key(account),JSON.stringify(record));}
    catch(_){return '레벨은 조회했지만 브라우저 저장에 실패했습니다.';}
    if(currentAccount()===account&&!options?.silent)send(account);
    return '싱크로 '+(record.synchroLevel??'미공개')+' / 전초기지 '+(record.outpostLevel??'미공개')+' · 계산기에 반영했습니다.';
  };
  // The iframe may be lazily initialized after the sync is complete.
  const frame=document.getElementById('syncroIframe');
  if(frame)frame.addEventListener('load',()=>send(currentAccount()));
})();
