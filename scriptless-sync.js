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
  var AREA_IDS = [81,82,83,84,85];
  function areaLabel(area){return ({81:'일본 (JP)',82:'북미 (NA)',83:'한국 (KR)',84:'글로벌',85:'동남아'})[area]||String(area);}

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
  function optionName(value){
    var k=ko(value).normalize('NFKC').replace(/[\s\[\]()]/g,'');
    if(/우월코드/.test(k))return '우코';
    if(/최대장탄|장탄수/.test(k))return '장탄';
    if(/크리티컬확률|크리확률/.test(k))return '크확';
    if(/크리티컬대미지|크리티컬데미지|크리대미지/.test(k))return '크댐';
    if(/명중률/.test(k))return '명중';
    if(/차지대미지|차지데미지/.test(k))return '차댐';
    if(/차지속도/.test(k))return '차속';
    if(/방어력/.test(k))return '방어';
    if(/공격력/.test(k))return '공증';
    return '';
  }
  function gearOptions(gear){
    if(!gear)return [];
    if(!Array.isArray(gear.options))throw new Error('외부 API 장비 옵션 응답이 불완전해 동기화를 중단했습니다.');
    var out=[];
    for(var opt of gear.options){
      if(!opt)continue;
      var name=optionName(opt.name);
      var v=num(opt.value&&opt.value.value);
      if(!name||v===null)throw new Error('장비 옵션 종류·수치를 해석하지 못해 동기화를 중단했습니다.');
      out.push({name:name,value:v});
      if(out.length>3)throw new Error('장비 옵션 항목 수가 올바르지 않습니다.');
    }
    return out;
  }
  function convert(items){
    if(!Array.isArray(items)||items.length===0)throw new Error('외부 API에서 보유 니케 목록을 받지 못했습니다. 프로필 공개 설정을 확인해 주세요.');
    var updates=[],ownedNames=[],ownedCodes=[],seen=new Set(),details=0,unresolved=0,skipped=[];
    // Unknown external characters should not block known characters.
    var normalize=function(v){return String(v||'').normalize('NFKC').toLowerCase().replace(/[\\s:：·•._'’“”"\\-–—()\\[\\]{}]/g,'');};
    if(!Array.isArray(window.__NIKKE_RAW)||!window.__NIKKE_RAW.length)
      throw new Error('사이트 도감을 불러오지 못해 동기화를 중단했습니다. 새로고침 후 다시 시도해 주세요.');
    var roster=new Set(window.__NIKKE_RAW.map(r=>normalize(r&&r['이름'])));
    var slots={head:'머리',body:'몸통',arm:'장갑',leg:'다리'};
    for(var n of items){
      if(!n||typeof n!=='object')continue;
      var code=codeOf(n),name=nameOf(n);
      if(!name){unresolved++;continue;}
      if(!roster.has(normalize(name))){skipped.push(name);continue;}
      if(!code){unresolved++;continue;}
      if(seen.has(code))throw new Error('중복된 니케 정보를 받아 동기화를 중단했습니다.');
      seen.add(code);
      ownedNames.push(name);
      ownedCodes.push(code);
      if(!n.equipment||typeof n.equipment!=='object')throw new Error('장비 상세 정보가 누락되어 동기화를 중단했습니다.');
      var parts={};
      for(var [slot,part] of Object.entries(slots)){
        if(!Object.prototype.hasOwnProperty.call(n.equipment,slot))throw new Error('장비 부위 정보가 누락되어 동기화를 중단했습니다.');
        var gear=n.equipment[slot];
        parts[part]={corporation_type:gear&&gear.corporation||null,tier:gear?num(gear.tier):0,level:gear?num(gear.level):0,options:gearOptions(gear)};
      }
      var skills=n.skills&&typeof n.skills==='object'?n.skills:{};
      var skill1=safeSkill(skills.skill1),skill2=safeSkill(skills.skill2),burst=safeSkill(skills.burst);
      if(skill1!==null&&skill2!==null&&burst!==null)details++;
      updates.push({name:name,name_code:code,grade:num(n.grade),core:num(n.core),
        skill1:skill1,skill2:skill2,burstSkill:burst,parts:parts});
    }
    if(!updates.length)throw new Error('사이트 도감에서 일치하는 니케가 없어 동기화할 데이터가 없습니다. 기존 기록은 유지됩니다.');
    if(details!==updates.length)
      throw new Error('일부 니케의 스킬 상세가 누락되어 기존 데이터 보호를 위해 동기화를 취소했습니다.');
    // Invalid known-character identities still fail; unsupported new characters are skipped.
    if(unresolved>0)throw new Error('일부 니케의 식별 정보가 누락되어 동기화를 중단했습니다.');
    return {ok:true,sync_type:'scriptless_external',worker_version:'외부 API (nikke-api.pages.dev)',character_count:updates.length,external_character_count:items.length,skipped_character_count:skipped.length,skipped_character_names:skipped,detail_count:details,detailCount:details,ownedNames:ownedNames,ownedCodes:ownedCodes,updates:updates};
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

  // Resolve the actual owned roster once, and pin every builds page to that region.
  async function detectOwnedArea(id,options){
    var onProgress=typeof options.onProgress==='function'?options.onProgress:function(){};
    onProgress('보유 니케가 있는 서버를 확인하는 중…');
    var response;
    try{
      response=await requestJson(BASE+'/api/user/'+encodeURIComponent(id)+'/roster');
    }catch(err){
      throw new Error('서버 자동 확인에 실패했습니다. 외부 API 조회 오류: '+String(err&&err.message||err)+'. 서버를 직접 선택해 다시 시도할 수 있습니다.');
    }
    if(!response||!Array.isArray(response.areas))
      throw new Error('서버 자동 확인 응답에 지역 목록이 없습니다. 서버를 직접 선택해 주세요.');
    var found=[],seen=new Set();
    for(var record of response.areas){
      var area=Number(record&&record.area);
      if(!AREA_IDS.includes(area)||seen.has(area)||!Array.isArray(record.characters)||record.characters.length===0)continue;
      seen.add(area);
      found.push({area_id:area,character_count:record.characters.length});
    }
    if(!found.length)throw new Error('보유 니케가 있는 서버를 확인하지 못했습니다. 프로필 공개 설정을 확인하거나 서버를 직접 선택해 주세요.');
    if(found.length===1)return {areaId:found[0].area_id,mode:'auto',candidates:found};
    var preferred=Number(options.preferredAreaId);
    if(AREA_IDS.includes(preferred)&&found.some(x=>x.area_id===preferred))
      return {areaId:preferred,mode:'remembered',candidates:found};
    var error=new Error('여러 서버에 보유 니케가 있습니다: '+found.map(x=>areaLabel(x.area_id)+' '+x.character_count+'명').join(', ')+'. 서버를 직접 선택해 주세요. 계정마다 선택한 서버는 동기화 완료 후 기억합니다.');
    error.code='multiple_areas';
    error.candidates=found;
    throw error;
  }

  async function fetchExternal(profileUrl,options){
    options=options||{};
    var id=profileId(profileUrl);
    var selected=options.areaId;
    if(selected!=null&&selected!==''&&!AREA_IDS.includes(Number(selected)))throw new Error('지원하지 않는 지역 코드입니다.');
    var auto=selected==null||selected==='';
    var areaSelection=auto
      ? await detectOwnedArea(id,options)
      : {areaId:Number(selected),mode:'manual',candidates:[]};
    var area=areaSelection.areaId;
    var base=BASE+'/api/user/'+encodeURIComponent(id)+'/nikke-builds?all=1&limit='+PAGE_SIZE+'&area='+encodeURIComponent(String(area));
    var all=[],count=null,offset=0,onProgress=typeof options.onProgress==='function'?options.onProgress:function(){};
    for(var page=0;page<MAX_PAGES;page++){
      onProgress(areaLabel(area)+' 서버에서 보유 니케 상세를 조회하는 중… ('+all.length+'/'+(count===null?'?':count)+'명)');
      var body=await requestJson(base+'&offset='+offset);
      var list=body.nikkes;
      if(!Array.isArray(list))throw new Error('외부 API에서 니케 상세 목록을 반환하지 않았습니다.');
      if(body.offset!=null&&Number(body.offset)!==offset)
        throw new Error('조회 페이지 위치가 변경되어 저장하지 않았습니다. 요청 '+offset+' / 응답 '+body.offset);
      var total=num(body.count);
      if(total===null||total<0||total>600)throw new Error('외부 API의 전체 캐릭터 수가 올바르지 않습니다.');
      if(count!==null&&count!==total)throw new Error('조회 중 목록이 변경되어 저장하지 않았습니다. 다시 시도해 주세요.');
      count=total;
      if(!list.length)break;
      all.push.apply(all,list);
      offset+=list.length;
      if(offset>=count)break;
    }
    if(count===null||count===0)
      throw new Error('외부 API가 보유 니케 수를 0명 또는 누락된 값으로 응답했습니다. 기존 기록을 변경하지 않았습니다.');
    if(all.length!==count)
      throw new Error('외부 API 수신 불완전 · 전체 '+count+'명 중 '+all.length+'명 수신 · 다음 요청 시작 '+offset+'명째 · 기존 기록을 변경하지 않았습니다.');
    var result=convert(all);
    result.external_provider=BASE;
    result.area_id=area;
    result.area_selection_mode=areaSelection.mode;
    result.area_candidates=areaSelection.candidates;
    return result;
  }
  window.__NIKKE_GM_SCRIPTLESS_SYNC__=fetchExternal;
})();