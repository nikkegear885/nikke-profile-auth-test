/* NIKKE Gear Manager — optional no-install profile sync, via third-party public API.
 * External provider: https://nikke-api.pages.dev (unofficial, independent account session).
 * Sends only the user's public BlablaLink profile identifier; never sends credentials.
 * Live API availability is not controlled by this site.
 */
(function(){
  'use strict';
  var BASE = 'https://nikke-api.pages.dev';
  var PAGE_SIZE = 80;
  var MAX_PAGES = 8;

  function profileId(profileUrl){
    var u;
    try{u=new URL(String(profileUrl||'').trim())}catch(_){throw new Error('올바른 BlaBlaLink 공개 프로필 URL을 입력해 주세요.')}
    if(u.protocol!=='https:' || u.hostname!=='www.blablalink.com' || u.pathname!=='/user')throw new Error('BlaBlaLink 공개 프로필 URL만 사용할 수 있습니다.');
    var id=u.searchParams.get('openid');
    if(!id || id.length>1024 || !/^[A-Za-z0-9+/_=-]+$/.test(id))throw new Error('공개 프로필 URL의 openid 형식을 확인해 주세요.');
    return id;
  }
  function ko(v){
    if(typeof v==='string')return v.trim();
    if(v&&typeof v==='object')return String(v.ko||v.en||'').trim();
    return '';
  }
  function codeOf(n){
    var raw=n&&n.character&&n.character.nameCode;
    var code=String(raw==null?'':raw).trim();
    return /^\d+$/.test(code)?code:'';
  }
  function nameOf(n){
    var code=codeOf(n);
    if(code==='1012')return '사쿠라';
    if(code==='3015')return '스즈하라 사쿠라';
    var name=ko(n&&n.character&&n.character.name);
    if(name==='사쿠라 (SR)'||name==='사쿠라 스즈하라')return '스즈하라 사쿠라';
    return name;
  }
  function num(v){
    var x=Number(v);
    return v===null||v===undefined||v===''||!Number.isFinite(x)?null:x;
  }
  function safeSkill(v){
    var n=num(v);
    return n===null?null:Math.max(0,Math.min(10,Math.floor(n)));
  }
  function convert(items){
    if(!Array.isArray(items)||items.length===0)throw new Error('외부 API에서 보유 니케 목록을 받지 못했습니다. 프로필 공개 설정을 확인해 주세요.');
    var updates=[],ownedNames=[],ownedCodes=[],seen=new Set(),details=0,unresolved=0;
    var slots={head:'머리',body:'몸통',arm:'장갑',leg:'다리'};
    for(var n of items){
      if(!n||typeof n!=='object')continue;
      var code=codeOf(n),name=nameOf(n);
      if(!name||!code){unresolved++;continue;}
      if(seen.has(code))continue;
      seen.add(code);
      ownedNames.push(name);
      ownedCodes.push(code);
      var parts={};
      for(var [slot,part] of Object.entries(slots)){
        var gear=n.equipment&&n.equipment[slot];
        // A missing item is an explicitly empty slot; an unreported slot is unknown.
        if(n.equipment && Object.prototype.hasOwnProperty.call(n.equipment,slot)){
          parts[part]={corporation_type:gear&&gear.corporation||null,tier:gear?num(gear.tier):0,level:gear?num(gear.level):0};
        }
      }
      var skills=n.skills&&typeof n.skills==='object'?n.skills:{};
      var skill1=safeSkill(skills.skill1),skill2=safeSkill(skills.skill2),burst=safeSkill(skills.burst);
      if(skill1!==null&&skill2!==null&&burst!==null)details++;
      updates.push({name:name,name_code:code,grade:num(n.grade),core:num(n.core),
        skill1:skill1,skill2:skill2,burstSkill:burst,parts:parts});
    }
    if(!updates.length)throw new Error('보유 캐릭터를 식별하지 못해 동기화를 취소했습니다.');
    if(details<Math.min(5,Math.ceil(updates.length*0.5)))
      throw new Error('스킬·장비 상세 응답이 충분하지 않아 기존 데이터 보호를 위해 동기화를 취소했습니다.');
    if(unresolved>0)throw new Error('일부 캐릭터 식별에 실패하여 동기화를 취소했습니다. 외부 API 데이터를 확인해 주세요.');
    return {ok:true,sync_type:'scriptless_external',worker_version:'외부 API (nikke-api.pages.dev)',character_count:updates.length,detail_count:details,detailCount:details,ownedNames:ownedNames,ownedCodes:ownedCodes,updates:updates};
  }

  async function requestJson(url){
    var controller=new AbortController();
    var timer=setTimeout(function(){controller.abort()},45000);
    try{
      var response=await fetch(url,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal});
      var body=await response.json().catch(function(){return {}});
      if(!response.ok){
        var detail=String(body.error||body.message||'').slice(0,160);
        if(response.status===404 && body.reason==='private')throw new Error('공개 프로필에서 보유 니케 목록이 비공개 상태입니다.');
        if(response.status===429)throw new Error('외부 API 조회 제한입니다. 잠시 후 다시 시도해 주세요.');
        if(response.status===502 || response.status===503)throw new Error('외부 API의 조회 계정 인증 또는 연결에 문제가 있습니다. '+detail);
        throw new Error('외부 API HTTP '+response.status+(detail?' · '+detail:''));
      }
      if(!body||typeof body!=='object')throw new Error('외부 API 응답 형식이 올바르지 않습니다.');
      return body;
    }finally{clearTimeout(timer)}
  }

  async function fetchExternal(profileUrl,options){
    options=options||{};
    var id=profileId(profileUrl);
    var area=options.areaId;
    if(area!=null&&area!=='' && ![81,82,83,84,85].includes(Number(area)))throw new Error('지원하지 않는 지역 코드입니다.');
    var base=BASE+'/api/user/'+encodeURIComponent(id)+'/nikke-builds?all=1&limit='+PAGE_SIZE;
    if(area!=null&&area!=='')base+='&area='+encodeURIComponent(String(area));
    var all=[],count=null,offset=0,onProgress=typeof options.onProgress==='function'?options.onProgress:function(){};
    for(var page=0;page<MAX_PAGES;page++){
      onProgress('외부 API에서 보유 니케 상세를 조회하는 중… ('+all.length+'명)');
      var body=await requestJson(base+'&offset='+offset);
      var list=body.nikkes;
      if(!Array.isArray(list))throw new Error('외부 API에서 니케 상세 목록을 반환하지 않았습니다.');
      var total=num(body.count);
      if(total===null||total<0||total>600)throw new Error('외부 API의 전체 캐릭터 수가 올바르지 않습니다.');
      if(count!==null&&count!==total)throw new Error('조회 중 목록이 변경되어 저장하지 않았습니다. 다시 시도해 주세요.');
      count=total;
      if(!list.length)break;
      all.push.apply(all,list);
      offset+=list.length;
      if(offset>=count)break;
    }
    if(count===null||count===0||all.length!==count)
      throw new Error('보유 니케 데이터를 일부만 받아왔습니다. 기존 기록을 변경하지 않았습니다.');
    var result=convert(all);
    result.external_provider=BASE;
    return result;
  }
  window.__NIKKE_GM_SCRIPTLESS_SYNC__=fetchExternal;
})();