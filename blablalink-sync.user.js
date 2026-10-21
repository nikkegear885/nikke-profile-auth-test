// ==UserScript==

// @name         NIKKE Gear Manager - BlablaLink 자동 장비 동기화
// @namespace    https://nikkegear885.github.io/nikke-profile-auth-test/
// @version      1.0.39
// @updateURL    https://raw.githubusercontent.com/nikkegear885/nikke-profile-auth-test/main/blablalink-sync.user.js
// @downloadURL  https://raw.githubusercontent.com/nikkegear885/nikke-profile-auth-test/main/blablalink-sync.user.js
// @description  테스트 사이트 계정동기화에서 보유·돌파·코강·스킬 레벨·장비 정보를 가져옵니다.
// @author       NIKKE Gear Manager
// @match        https://*.blablalink.com/*
// @match        http://*.blablalink.com/*
// @run-at       document-start
// @grant        none
// @license      MIT
// ==/UserScript==
(function(){
  'use strict';

  const TARGET_ORIGIN = 'https://nikkegear885.github.io';
  const API = {
    player: 'https://api.blablalink.com/api/ugc/direct/standalonesite/User/GetUserGamePlayerInfo',
    chars: 'https://api.blablalink.com/api/game/proxy/Game/GetUserCharacters',
    details: 'https://api.blablalink.com/api/game/proxy/Game/GetUserCharacterDetails'
  };

  const state = {
    intlOpenId: '',
    areaId: null,
    nickname: '',
    codeToName: new Map(),
    pendingToken: '',
    syncing: false
  };

  // 현재 NIKKE Gear Manager 캐릭터명과 BlablaLink name_code 매핑 (2026-09-25 기준)
  const BUILTIN_NAME_CODES=Object.freeze({"1007":"D","1010":"라플라스","1012":"사쿠라","1013":"솔져 E.G.","1014":"솔져 F.A.","1015":"프로덕트 08","1016":"프로덕트 12","1017":"iDoll 플라워","1018":"iDoll 오션","1019":"마나","1020":"자칼","1021":"목단","1022":"바이퍼","1023":"iDoll 썬","1024":"프로덕트 23","1025":"솔져 O.W.","3001":"라피","3002":"네온","3003":"델타","3004":"루마니","3005":"아니스","3006":"미하라","3007":"벨로타","3008":"미카","3009":"N102","3010":"에테르","3011":"네베","3012":"히메노","3013":"람","3014":"미사토","3015":"사쿠라 (SR)","3016":"릴리","3017":"클레어","3018":"쿠루미","3019":"아이기스","5001":"맥스웰","5002":"슈가","5003":"엑시아","5004":"앨리스","5005":"엠마","5006":"유니","5007":"프리바티","5008":"블랑","5009":"누아르","5010":"프림","5011":"리타","5012":"스노우 화이트","5013":"이사벨","5014":"율리아","5015":"시그널","5016":"폴리","5017":"미란다","5018":"브리드","5019":"솔린","5020":"디젤","5021":"센티","5022":"베스티","5023":"은화","5024":"드레이크","5025":"크로우","5026":"메어리","5027":"페퍼","5028":"밀크","5029":"율하","5030":"애드미","5031":"길로틴","5032":"메이든","5033":"루드밀라","5034":"루피","5035":"얀","5036":"도라","5037":"노벨","5038":"에피넬","5039":"폴크방","5040":"라푼젤","5041":"홍련","5042":"하란","5043":"노아","5044":"모더니아","5045":"로산나","5046":"에이드","5048":"마르차나","5049":"루주","5050":"코코아","5051":"소다","5053":"킬로","5054":"비스킷","5055":"길티","5056":"니힐리스타","5059":"신","5061":"도로시","5063":"앵커","5064":"메어리 : 베이 갓데스","5065":"크라운","5066":"헬름","5068":"네로","5069":"라이","5070":"아리아","5071":"네온 : 블루 오션","5074":"노이즈","5075":"볼륨","5077":"아인","5078":"퀀시","5079":"마스트","5081":"토브","5082":"키리","5085":"앤 : 미라클 페어리","5087":"루피 : 윈터 쇼퍼","5088":"츠바이","5089":"마키마","5090":"파워","5092":"레오나","5094":"2B","5095":"A2","5096":"파스칼","5097":"아니스 : 스파클링 서머","5098":"헬름 : 아쿠아마린","5099":"나가","5100":"티아","5101":"레드 후드","5102":"스노우 화이트 : 이노센트 데이즈","5103":"루드밀라 : 윈터 오너","5104":"미카 : 스노우 버디","5105":"홍련 : 흑영","5106":"프리바티 : 언카인드 메이드","5107":"일레그","5108":"렘","5109":"에밀리아","5110":"D : 킬러 와이프","5111":"베이","5112":"트로니","5113":"소다 : 트윙클링 바니","5114":"앨리스 : 원더랜드 바니","5115":"클레이","5116":"로산나 : 시크 오션","5117":"사쿠라 : 블룸 인 서머","5118":"아스카","5119":"레이","5120":"마리","5121":"퀀시 : 이스케이프 퀸","5122":"팬텀","5123":"라푼젤 : 퓨어 그레이스","5124":"신데렐라","5125":"그레이브","5126":"플로라","5127":"메이든 : 아이스 로즈","5128":"길로틴 : 윈터 슬레이어","5129":"라피 : 레드 후드","5130":"마스트 : 로망틱 메이드","5131":"앵커 : 이노센트 메이드","5132":"레이 (가칭)","5133":"아스카 : WILLE","5134":"트리나","5135":"브래디","5136":"크러스트","5137":"리틀 머메이드","5138":"미하라 : 본딩 체인","5139":"모리","5140":"아르카나","5141":"K","5142":"이브","5143":"레이븐","5144":"소라","5145":"도로시 : 세렌디피티","5146":"일레그 : 붐 앤 쇼크","5147":"엠마 : 택티컬 업","5148":"베스티 : 택티컬 업","5149":"은화 : 택티컬 업","5150":"밀크 : 블루밍 바니","5151":"에이드 : 에이전트 바니","5152":"에이다","5153":"질","5154":"델타 : 닌자 시프","5155":"나유타","5156":"리버렐리오","5157":"차임","5158":"솔린 : 프로스트 티켓","5159":"디젤 : 윈터 스위츠","5160":"브리드 : 사일런트 트랙","5161":"스노우 화이트 : 헤비암즈","5162":"레이블","5163":"벨벳","5164":"치사토","5165":"타키나","5166":"E.H.","5167":"아르카나 : 포츈 메이트","5168":"백학","5169":"아니스 : 스타","5170":"네온 : 비전 아이","5171":"아비스타","5172":"민트","5173":"프리카","5174":"아크레인저 블랙","5175":"신데렐라 : 크리스탈 웨이브","5176":"마르차나 : 마린 스터디","5177":"라플라스 : 얼티밋 히어로","5178":"맥스웰 : 오디너리 미케닉","5179":"퀸(마코토)","5180":"유키코","5181":"드레이크 : 그레이트 빌런","5182":"길티 : 마이티 바니","5183":"신 : 스위프트 바니"});

  const CORPORATIONS = Object.freeze({
    1:'ELYSION', 2:'MISSILIS', 3:'TETRA', 4:'PILGRIM', 5:'ABNORMAL', 7:'ABNORMAL'
  });

  const normalizeCorp = (v) => {
    if (v && typeof v === 'object') {
      for (const key of ['corporation_type','corporationType','corporation','manufacturer','company','maker','corp','corporation_id','manufacturer_id','company_id','type','code','id','value','name']) {
        if (v[key] !== undefined && v[key] !== null && v[key] !== '') {
          const nested = normalizeCorp(v[key]);
          if (nested) return nested;
        }
      }
      return null;
    }
    if (typeof v === 'number' && Number.isFinite(v)) return CORPORATIONS[v] || null;
    const s = String(v ?? '').trim().toUpperCase();
    if (!s || s === '0' || s === 'NONE' || s === 'ALL' || s === 'NULL' || s === 'UNDEFINED') return null;
    if (/^\d+$/.test(s)) return CORPORATIONS[Number(s)] || null;
    const aliases = {
      'ELYSION':'ELYSION','MISSILIS':'MISSILIS','TETRA':'TETRA','PILGRIM':'PILGRIM',
      'ABNORMAL':'ABNORMAL','ABNORM':'ABNORMAL',
      '엘리시온':'ELYSION','미실리스':'MISSILIS','테트라':'TETRA','필그림':'PILGRIM','어브노멀':'ABNORMAL'
    };
    return aliases[s] || null;
  };

  function getRawCorp(char, slot) {
    // BlablaLink 응답은 버전/엔드포인트에 따라 장비 필드명이 달라질 수 있으므로
    // 슬롯명 + 기업/제조사 계열 키를 함께 탐색합니다.
    const aliases = {
      head:['head','helmet','helm','head_equip','head_equipment','equip_head'],
      torso:['torso','body','chest','armor','torso_equip','body_equip','equip_torso','equip_body'],
      arm:['arm','glove','gloves','gauntlet','hand','arm_equip','equip_arm'],
      leg:['leg','legs','shoe','shoes','foot','feet','leg_equip','equip_leg']
    };
    const slotWords = aliases[slot] || [slot];
    const visited = new Set();

    function scan(value, depth=0, keyHint=''){
      if(value==null || depth>7) return null;

      const direct = normalizeCorp(value);
      if(direct) return direct;

      if(typeof value !== 'object') return null;
      if(visited.has(value)) return null;
      visited.add(value);

      for(const [key,v] of Object.entries(value)){
        const k=String(key).toLowerCase().replace(/[^a-z0-9_가-힣]/g,'');
        const slotMatch=slotWords.some(w=>k.includes(String(w).toLowerCase().replace(/[^a-z0-9_]/g,'')));
        const corpKey=/corporation|manufacturer|company|maker|corp|manufacturerid|corporationid|companyid|제조사|기업/.test(k);

        // 슬롯과 기업 관련 키가 함께 있는 경우를 최우선으로 봅니다.
        if(slotMatch && corpKey){
          const corp=normalizeCorp(v);
          if(corp) return corp;
          const nested=scan(v,depth+1,k);
          if(nested) return nested;
        }
      }

      // 장비 객체 자체가 슬롯명 아래에 있는 경우.
      for(const [key,v] of Object.entries(value)){
        const k=String(key).toLowerCase();
        const slotMatch=slotWords.some(w=>k.includes(String(w).toLowerCase()));
        if(slotMatch && v && typeof v==='object'){
          const nested=scan(v,depth+1,k);
          if(nested) return nested;
        }
      }

      // 마지막 보조 탐색: 현재 객체가 이미 슬롯 객체로 판단되면 기업 키를 깊게 찾습니다.
      const contextIsSlot=slotWords.some(w=>String(keyHint).toLowerCase().includes(String(w).toLowerCase()));
      if(contextIsSlot){
        for(const [key,v] of Object.entries(value)){
          const k=String(key).toLowerCase();
          if(/corporation|manufacturer|company|maker|corp|제조사|기업/.test(k)){
            const corp=normalizeCorp(v);
            if(corp) return corp;
            const nested=scan(v,depth+1,k);
            if(nested) return nested;
          }
        }
      }

      return null;
    }

    // 흔히 사용되는 직접 필드들.
    const directKeys=[];
    for(const w of slotWords){
      directKeys.push(
        w+'_equip_corporation_type', w+'_corporation_type',
        w+'_equip_manufacturer', w+'_manufacturer',
        w+'_equip_company', w+'_company',
        w+'_equip', w+'_equipment'
      );
    }
    for(const key of directKeys){
      if(char?.[key]!==undefined){
        const corp=scan(char[key],0,key);
        if(corp) return corp;
      }
    }

    // API 버전에 따라 corporation/manufacturer 계열 이름이 달라지는 경우를 대비한 추가 직접 필드.
    for(const w of slotWords){
      for(const suffix of ['_corporation','_corporation_id','_manufacturer','_manufacturer_id','_company','_company_id','_corp']){
        const key=w+suffix;
        if(char?.[key]!==undefined){
          const corp=scan(char[key],0,key);
          if(corp) return corp;
        }
      }
    }

    // 전체 응답을 슬롯 문맥까지 포함해 탐색.
    return scan(char,0,'');
  }

  function rememberAccountFromBody(url, body){
    try{
      const u = String(url || '');
      if (!body || typeof body !== 'string') return;
      const j = JSON.parse(body);
      const raw = j.intl_open_id ?? j.intl_openid;
      if (raw != null && String(raw).trim()) {
        state.intlOpenId = String(raw).split('-').slice(-1)[0];
      }
      const area = j.nikke_area_id ?? j.area_id;
      if (area != null && Number.isFinite(Number(area))) state.areaId = Number(area);
    }catch(_){}
  }

  function rememberMasterJson(json){
    if (!Array.isArray(json) || !json.length) return;
    let added = 0;
    for (const item of json){
      if (!item || typeof item !== 'object') continue;
      const name = item?.name_localkey?.name;
      if (typeof name !== 'string' || !name.trim()) continue;
      const code = item.name_code ?? item.nameCode;
      if (code != null && String(code).trim()){
        state.codeToName.set(String(code), name.trim());
        added++;
      }
    }
    if (added) {
      window.__NIKKE_GM_MASTER_SIZE__ = state.codeToName.size;
    }
  }

  const originalFetch = window.fetch;
  window.fetch = async function(...args){
    const url = String(args?.[0] ?? '');
    const opts = args?.[1] || {};
    rememberAccountFromBody(url, opts.body);
    const res = await originalFetch.apply(this, args);
    try{
      if (url.includes('GetUserGamePlayerInfo')){
        const j = await res.clone().json();
        const d = j?.data || {};
        const canonical = d?.info?.intl_openid ?? d?.intl_openid ?? '';
        if (canonical) state.intlOpenId = String(canonical).split('-').slice(-1)[0];
        if (d?.area_id != null) state.areaId = Number(d.area_id);
        state.nickname = String(d?.role_name || d?.nickname || '');
      } else if (url.includes('GetUserProfileBasicInfo')){
        const j = await res.clone().json();
        const b = j?.data?.basic_info || {};
        const canonical = b?.intl_openid ?? b?.intl_open_id ?? '';
        if (canonical) state.intlOpenId = String(canonical).split('-').slice(-1)[0];
        if (b?.area_id != null) state.areaId = Number(b.area_id);
        state.nickname = String(b?.nickname || b?.role_name || state.nickname || '');
      } else if (url.includes('sg-tools-cdn.blablalink.com') && url.endsWith('.json')){
        rememberMasterJson(await res.clone().json());
      }
    }catch(_){}
    return res;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url){
    this.__nikkeGmUrl = String(url || '');
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body){
    rememberAccountFromBody(this.__nikkeGmUrl, body);
    this.addEventListener('load', () => {
      try{
        const url = this.__nikkeGmUrl || '';
        const j = JSON.parse(this.responseText);
        if (url.includes('GetUserGamePlayerInfo')){
          const d = j?.data || {};
          const canonical = d?.info?.intl_openid ?? d?.intl_openid ?? '';
          if (canonical) state.intlOpenId = String(canonical).split('-').slice(-1)[0];
          if (d?.area_id != null) state.areaId = Number(d.area_id);
          state.nickname = String(d?.role_name || d?.nickname || state.nickname || '');
        } else if (url.includes('GetUserProfileBasicInfo')){
          const b = j?.data?.basic_info || {};
          const canonical = b?.intl_openid ?? b?.intl_open_id ?? '';
          if (canonical) state.intlOpenId = String(canonical).split('-').slice(-1)[0];
          if (b?.area_id != null) state.areaId = Number(b.area_id);
          state.nickname = String(b?.nickname || b?.role_name || state.nickname || '');
        } else if (url.includes('sg-tools-cdn.blablalink.com') && url.endsWith('.json')){
          rememberMasterJson(j);
        }
      }catch(_){}
    });
    return originalSend.apply(this, arguments);
  };

  const delay = ms => new Promise(r => setTimeout(r, ms));

  async function postJson(url, body){
    const res = await fetch(url, {
      method:'POST',
      headers:{
        'Content-Type':'application/json;charset=UTF-8'
      },
      credentials:'include',
      body:JSON.stringify(body)
    });
    if (!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }

  async function resolveAccount(){
    // 먼저 공식 로그인 정보 API에서 현재 로그인 계정과 서버를 확인합니다.
    for(let attempt=0; attempt<3; attempt++){
      try{
        const j = await postJson(API.player, {});
        const d = j?.data || {};
        const canonical = d?.info?.intl_openid ?? d?.intl_openid ?? '';
        if (canonical) state.intlOpenId = String(canonical).split('-').slice(-1)[0];
        if (d?.area_id != null) state.areaId = Number(d.area_id);
        state.nickname = String(d?.role_name || d?.nickname || state.nickname || '');
        if (String(j?.code ?? '') === '0' && state.intlOpenId && state.areaId) return true;
      }catch(_){}
      await delay(700 * (attempt + 1));
    }

    // 페이지가 이미 보낸 요청에서 ID가 잡힌 경우 보조 사용.
    if (!state.intlOpenId) {
      try {
        const c = document.cookie.match(/(?:^|;\s*)game_openid=([^;]+)/);
        if (c) state.intlOpenId = decodeURIComponent(c[1]);
      } catch(_){}
    }
    return !!(state.intlOpenId && state.areaId);
  }




  const NIKKE_AREAS = Object.freeze([
    {id:81, code:'JP', label:'일본 (JP)'},
    {id:82, code:'NA', label:'북미 (NA)'},
    {id:83, code:'KR', label:'한국 (KR)'},
    {id:84, code:'Global', label:'글로벌 (Global)'},
    {id:85, code:'SEA', label:'동남아 (SEA)'}
  ]);

  function isRegionAmbiguityError(message){
    const s = String(message || '').toLowerCase();
    const ambiguous = /(여러|multiple|several|more than one|ambiguous)/i.test(s);
    const regionRelated = /(nikke|니케|region|지역|server|서버|area|로스터|roster|character|캐릭터)/i.test(s);
    return ambiguous && regionRelated;
  }

  async function requestCharactersForArea(areaId){
    return await postJson(API.chars, {
      intl_open_id: state.intlOpenId,
      nikke_area_id: Number(areaId)
    });
  }

  async function probeAreaByDetails(areaId){
    try{
      const j = await postJson(API.details, {
        intl_open_id: state.intlOpenId,
        nikke_area_id: Number(areaId),
        name_codes: [5167]
      });
      return String(j?.code ?? '') === '0';
    }catch(_){
      return false;
    }
  }

  function chooseNikkeArea(candidates){
    if(candidates.length === 1) return candidates[0];
    const options = candidates.map(a => a.id + ' = ' + a.label).join('\n');
    const answer = window.prompt(
      '여러 NIKKE 지역에서 로스터가 확인되었습니다. 잘못된 지역의 장비를 가져오지 않도록 동기화할 지역을 직접 선택해 주세요.\n\n' +
      options + '\n\n지역 ID 또는 코드(JP / NA / KR / Global / SEA)를 입력하세요.',
      ''
    );
    if(answer === null) throw new Error('지역 선택이 취소되었습니다. 동기화를 다시 실행하고 올바른 지역을 선택해 주세요.');
    const normalizeRegionInput = value => String(value || '').trim().toLowerCase().replace(/[\\s()（）]/g, '');
    const value = normalizeRegionInput(answer);
    const selected = candidates.find(a => {
      const labelWithoutCode = String(a.label || '').replace(/\\s*[（(][^）)]*[）)]\\s*/g, '').trim();
      return [String(a.id), a.code, a.label, labelWithoutCode]
        .some(candidate => normalizeRegionInput(candidate) === value);
    });
    if(!selected) throw new Error('선택한 지역을 확인하지 못했습니다. 지역 ID, 코드 또는 지역명(예: 83 / KR / 한국)을 입력해 주세요.');
    return selected;
  }

  async function fetchCharacters(){
    const j = await requestCharactersForArea(state.areaId);
    if (String(j?.code ?? '') === '0') {
      return Array.isArray(j?.data?.characters) ? j.data.characters : [];
    }

    const originalMessage = String(j?.message || j?.msg || '캐릭터 목록 조회 실패');
    if(!isRegionAmbiguityError(originalMessage)) throw new Error(originalMessage);

    showStatus('NIKKE Gear Manager: 여러 지역 로스터를 확인 중…');

    // 먼저 지역별 캐릭터 목록을 직접 조회해 로스터가 존재하는 지역을 찾습니다.
    const rosterMatches = [];
    for(const area of NIKKE_AREAS){
      try{
        const candidate = await requestCharactersForArea(area.id);
        if(String(candidate?.code ?? '') === '0'){
          const characters = Array.isArray(candidate?.data?.characters) ? candidate.data.characters : [];
          if(characters.length) rosterMatches.push({...area, characters});
        }
      }catch(_){}
      await delay(120);
    }

    if(rosterMatches.length === 1){
      state.areaId = rosterMatches[0].id;
      showStatus('지역 확인: ' + rosterMatches[0].label, true);
      return rosterMatches[0].characters;
    }

    if(rosterMatches.length > 1){
      const selected = chooseNikkeArea(rosterMatches);
      state.areaId = selected.id;
      return selected.characters;
    }

    // 캐릭터 목록 API가 계속 모호하게 응답하면 상세 API로 조회 가능한 지역을 판별합니다.
    const availableAreas = [];
    for(const area of NIKKE_AREAS){
      if(await probeAreaByDetails(area.id)) availableAreas.push(area);
      await delay(120);
    }
    if(!availableAreas.length){
      throw new Error(originalMessage + ' 지역별 조회도 실패했습니다. BlablaLink 로그인 상태를 확인한 뒤 다시 시도해 주세요.');
    }

    const selected = chooseNikkeArea(availableAreas);
    state.areaId = selected.id;

    // 지역별 상세 API는 되지만 캐릭터 목록 API는 계속 모호하다고 응답하는 경우,
    // 같은 캐릭터 목록 API를 재호출하면 같은 오류가 반복됩니다. 알려진 이름 코드를
    // 상세 API에 직접 조회해 실제 보유 니케만 결과로 받습니다.
    const allKnownCodes = Array.from(new Set([
      ...Object.keys(BUILTIN_NAME_CODES),
      ...state.codeToName.keys()
    ])).filter(code => String(code || '').trim() !== '');
    if(!allKnownCodes.length){
      throw new Error('캐릭터 이름 코드 목록을 불러오지 못했습니다. BlablaLink 페이지가 완전히 열린 뒤 다시 시도해 주세요.');
    }
    const fallbackCharacters = allKnownCodes.map(name_code => ({name_code}));
    fallbackCharacters.__detailsOnlyFallback = true;
    showStatus('지역 확인: ' + selected.label + ' · 상세 API로 보유 니케 조회', true);
    return fallbackCharacters;
  }

    function skillFieldValue(char, keys) {
    if (!char || typeof char !== 'object') return null;
    const numeric = value => value !== undefined && value !== null &&
      String(value).trim() !== '' && Number.isFinite(Number(value));
    // Prefer exact top-level keys, then inspect nested skill objects used by some API variants.
    for (const key of keys) {
      if (numeric(char[key])) return char[key];
    }
    // Some BlablaLink responses expose skill levels as top-level skill1/skill2/burstSkill.
    // Accept these aliases only at the character object's top level to avoid matching
    // unrelated nested metadata with the same generic key.
    const genericAliases = new Set(['skill1', 'skill2', 'skill3', 'burstskill']);
    const wantedDirect = new Set(keys
      .map(key => String(key).toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(key => genericAliases.has(key)));
    for (const [key, value] of Object.entries(char)) {
      const normalizedKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (wantedDirect.has(normalizedKey) && numeric(value)) return value;
    }
    const wanted = new Set(keys
      .map(key => String(key).toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(key => !genericAliases.has(key)));
    const seen = new Set();
    function visit(value, depth) {
      if (!value || typeof value !== 'object' || depth > 5 || seen.has(value)) return null;
      seen.add(value);
      for (const [key, item] of Object.entries(value)) {
        const normalizedKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (wanted.has(normalizedKey) && numeric(item)) return item;
      }
      for (const item of Object.values(value)) {
        if (item && typeof item === 'object') {
          const found = visit(item, depth + 1);
          if (found !== null) return found;
        }
      }
      return null;
    }
    return visit(char, 0);
  }

  const SKILL_FIELD_GROUPS = [
    {target:'skill1_lv', keys:['skill1_lv','skill_1_lv','skill1_level','skill_1_level','skill_level_1','skill_lv1','skill_lv_1','normal_skill1_lv','normal_skill_1_lv','skill1Level','skill1']},
    {target:'skill2_lv', keys:['skill2_lv','skill_2_lv','skill2_level','skill_2_level','skill_level_2','skill_lv2','skill_lv_2','normal_skill2_lv','normal_skill_2_lv','skill2Level','skill2']},
    {target:'ulti_skill_lv', keys:['ulti_skill_lv','ultimate_skill_lv','ult_skill_lv','skill3_lv','skill_3_lv','skill3_level','skill_3_level','skill_level_3','skill_lv3','skill_lv_3','burst_lv','burst_skill_lv','burst_skill_level','skill_burst_lv','skill_burst_level','burstSkillLv','ultiSkillLv','burstSkill']}
  ];

  function hasCompleteSkillData(char) {
    return SKILL_FIELD_GROUPS.every(group => skillFieldValue(char, group.keys) !== null);
  }

  function allSkillsAreOne(char) {
    return SKILL_FIELD_GROUPS.every(group => Number(skillFieldValue(char, group.keys)) === 1);
  }

  function allSkillsAreTen(char) {
    return SKILL_FIELD_GROUPS.every(group => Number(skillFieldValue(char, group.keys)) === 10);
  }

  function mergeMissingSkillData(target, source, overwriteExisting=false) {
    if (!target || !source) return;
    for (const group of SKILL_FIELD_GROUPS) {
      const current = skillFieldValue(target, group.keys);
      const incoming = skillFieldValue(source, group.keys);
      if (incoming === null) continue;
      // For suspicious batch 1/1/1 rows, a valid single-character response takes priority.
      if (overwriteExisting || current === null) target[group.target] = incoming;
    }
  }

  async function fetchDetails(codes){
    const clean = Array.from(new Set(codes.map(v => String(v).trim()).filter(Boolean)));
    const chunks = [];
    for(let i=0;i<clean.length;i+=40) chunks.push(clean.slice(i,i+40));
    const byCode = new Map();
    const singleLookupCache = new Map();

    function addExactDetails(list, requestedCodes, source) {
      const allowed = new Set(requestedCodes.map(String));
      if (!Array.isArray(list)) return;
      for (const item of list) {
        const code = String(item?.name_code ?? '').trim();
        if (!code || !allowed.has(code)) {
          console.warn('[NIKKE GM] Ignored mismatched detail row', {source, requested:[...allowed], returnedCode:code});
          continue;
        }
        // Keep the first returned row for each exact character code. Never assign another
        // character's first response as a fallback for a missing name_code.
        if (!byCode.has(code)) byCode.set(code, item);
        else mergeMissingSkillData(byCode.get(code), item);
      }
    }

    async function fetchSingleExact(code) {
      if (singleLookupCache.has(code)) return singleLookupCache.get(code);
      let exact = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const j = await postJson(API.details, {
            intl_open_id: state.intlOpenId,
            nikke_area_id: Number(state.areaId),
            name_codes: [code]
          });
          if (String(j?.code ?? '') === '0' && Array.isArray(j?.data?.character_details)) {
            exact = j.data.character_details.find(item => String(item?.name_code ?? '').trim() === code) || null;
            if (exact) break;
            if (attempt === 1) {
              console.warn('[NIKKE GM] Single-character response did not contain requested code:', {
                requestedCode: code,
                returnedCodes: j.data.character_details.map(item => String(item?.name_code ?? ''))
              });
            }
          } else if (attempt === 1) {
            console.warn('[NIKKE GM] Single-character lookup returned no data:', code, j?.message || j?.msg || j?.code);
          }
        } catch (error) {
          if (attempt === 1) console.warn('[NIKKE GM] Single-character lookup failed:', code, error);
          else await delay(250);
        }
      }
      singleLookupCache.set(code, exact);
      await delay(100);
      return exact;
    }

    // A batch response may use 1/1/1 as a placeholder. When a per-character response
    // also returns 1/1/1, bypass the cache and retry twice to see if the API yields actual levels.
    async function fetchSingleSkillVerification(code) {
      let latest = await fetchSingleExact(code);
      if (latest && hasCompleteSkillData(latest) && !allSkillsAreOne(latest)) return latest;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const j = await postJson(API.details, {
            intl_open_id: state.intlOpenId,
            nikke_area_id: Number(state.areaId),
            name_codes: [code]
          });
          if (String(j?.code ?? '') === '0' && Array.isArray(j?.data?.character_details)) {
            const exact = j.data.character_details.find(item => String(item?.name_code ?? '').trim() === code) || null;
            if (exact) {
              latest = exact;
              const complete = hasCompleteSkillData(exact);
              if (complete && !allSkillsAreOne(exact) && !allSkillsAreTen(exact)) return exact;
            }
          }
        } catch (error) {
          console.warn('[NIKKE GM] Extra skill verification request failed:', code, error);
        }
        await delay(220);
      }
      return latest;
    }

    // First load the usual batch response, but accept only records whose name_code was requested.
    for(const chunk of chunks){
      let ok = false;
      for(let attempt=0;attempt<2 && !ok;attempt++){
        try{
          const j = await postJson(API.details, {
            intl_open_id: state.intlOpenId,
            nikke_area_id: Number(state.areaId),
            name_codes: chunk
          });
          if (String(j?.code ?? '') === '0'){
            addExactDetails(j?.data?.character_details, chunk, 'batch');
            ok = true;
          } else if (attempt === 1) {
            throw new Error(j?.message || j?.msg || '장비 상세 조회 실패');
          }
        }catch(e){
          if (attempt === 1) throw e;
          await delay(500);
        }
      }
      await delay(120);
    }

    // A batch response can omit certain characters entirely. Retry every requested code
    // that was not returned, not just the rows which did come back.
    for (const code of clean) {
      if (byCode.has(code)) continue;
      const single = await fetchSingleExact(code);
      if (single) byCode.set(code, single);
      else console.warn('[NIKKE GM] Character detail missing after individual retry:', code, BUILTIN_NAME_CODES[code] || state.codeToName.get(code) || '(unmapped)');
    }

    // Retry rows with missing skill fields and suspicious batch defaults (1/1/1).
    // Use only an exact name_code match from the single-character response.
    for (const [code, detail] of byCode) {
      const complete = hasCompleteSkillData(detail);
      const suspiciousAllOnes = complete && allSkillsAreOne(detail);
      const suspiciousAllTens = complete && allSkillsAreTen(detail);
      if (complete && !suspiciousAllOnes && !suspiciousAllTens) continue;
      const single = suspiciousAllOnes
        ? await fetchSingleSkillVerification(code)
        : await fetchSingleExact(code);
      if (!single) {
        if (suspiciousAllOnes) {
          detail.__nikkeSkillLevelsUnverified = true;
          console.warn('[NIKKE GM] 1/1/1 skill row could not be verified after individual retries; setting skills unknown:', code);
        }
        if (suspiciousAllTens) {
          detail.__nikkeSkillLevelsUnverified = true;
          console.warn('[NIKKE GM] 10/10/10 skill row has no independent response; setting skills unknown:', code);
        }
        continue;
      }

      const batchSkills = SKILL_FIELD_GROUPS.map(group => skillFieldValue(detail, group.keys));
      const singleSkills = SKILL_FIELD_GROUPS.map(group => skillFieldValue(single, group.keys));
      const singleComplete = hasCompleteSkillData(single);
      const singleAllOnes = singleComplete && allSkillsAreOne(single);
      const singleAllTens = singleComplete && allSkillsAreTen(single);
      if (suspiciousAllOnes && (!singleComplete || singleAllOnes)) {
        detail.__nikkeSkillLevelsUnverified = true;
        console.warn('[NIKKE GM] Skill levels remain 1/1/1 after independent retries; setting skills unknown instead of trusting a possible default:', {
          name_code: code, batchSkills, singleSkills, singleComplete, singleAllOnes
        });
        continue;
      }
      // A repeated 10/10/10 response is indistinguishable from a bad/default payload here.
      // Prefer an unknown marker over displaying a likely false maxed-out value.
      if (singleAllTens || (suspiciousAllTens && !singleComplete)) {
        detail.__nikkeSkillLevelsUnverified = true;
        console.warn('[NIKKE GM] Skill levels remain unverified after individual lookup; setting skills unknown:', {
          name_code: code, batchSkills, singleSkills, singleComplete, singleAllTens
        });
        continue;
      }
      // If the batch response was incomplete, trust the exact-code single response for all
      // fields it actually contains, not just the fields missing from the batch.
      const trustSingleValues = !complete || suspiciousAllOnes || suspiciousAllTens;
      mergeMissingSkillData(detail, single, trustSingleValues);

      if (['5148','5007','5101','5011'].includes(code) || suspiciousAllOnes || suspiciousAllTens || !complete) {
        console.info('[NIKKE GM] Individual skill verification', {
          name_code: code,
          name: BUILTIN_NAME_CODES[code] || state.codeToName.get(code) || '',
          batchSkills,
          singleSkills,
          suspiciousAllOnes,
          suspiciousAllTens,
          singleAllOnes,
          trustSingleValues,
          mergedSkills: SKILL_FIELD_GROUPS.map(group => skillFieldValue(detail, group.keys))
        });
      }
    }

    const out = clean.map(code => byCode.get(code)).filter(Boolean);
    const completeSkills = out.filter(hasCompleteSkillData).length;
    const allOnes = out.filter(allSkillsAreOne).length;
    const allTens = out.filter(allSkillsAreTen).length;
    const unverifiedSkillRows = out.filter(char => char?.__nikkeSkillLevelsUnverified === true).length;
    const missingCodes = clean.filter(code => !byCode.has(code));
    console.log('[NIKKE GM] Skill/detail verification summary:', {
      requested: clean.length,
      returned: out.length,
      completeSkills,
      stillAllOnes: allOnes,
      stillAllTens: allTens,
      unverifiedSkillRows,
      missingCodes: missingCodes.map(code => ({code, name: BUILTIN_NAME_CODES[code] || state.codeToName.get(code) || ''}))
    });
    return out;
  }

  function makeUpdates(details){
    const updates = [];
    const unresolved = [];
    const seen = new Set();

    for(const char of details){
      const code = String(char?.name_code ?? '');
      if(!code || seen.has(code)) continue;
      seen.add(code);

      const name = String(BUILTIN_NAME_CODES[code] || state.codeToName.get(code) || '').trim();
      if(!name){
        unresolved.push({name_code:code});
        continue;
      }

      const parts = {};
      for(const [slot, part] of [['head','머리'],['torso','몸통'],['arm','장갑'],['leg','다리']]){
        const equipTier = char?.[slot+'_equip_tier'] ?? char?.[slot+'_equip_lv_tier'] ?? null;
        const equipLevel = char?.[slot+'_equip_lv'] ?? null;
        parts[part] = {
          corporation_type: getRawCorp(char, slot),
          tier: (equipTier===undefined||equipTier===null||equipTier==='') ? null : Number(equipTier),
          level: (equipLevel===undefined||equipLevel===null||equipLevel==='') ? null : Number(equipLevel)
        };
      }
      const gradeRaw = char?.grade;
      const coreRaw = char?.core;
      const skillLevelsVerified = char?.__nikkeSkillLevelsUnverified !== true;
      const skill1Raw = skillLevelsVerified ? skillFieldValue(char, SKILL_FIELD_GROUPS[0].keys) : null;
      const skill2Raw = skillLevelsVerified ? skillFieldValue(char, SKILL_FIELD_GROUPS[1].keys) : null;
      const burstSkillRaw = skillLevelsVerified ? skillFieldValue(char, SKILL_FIELD_GROUPS[2].keys) : null;
      const asOptionalNumber = value => {
        if (value===undefined || value===null || value==='') return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      };
      updates.push({
        name,
        name_code:code,
        grade:asOptionalNumber(gradeRaw),
        core:asOptionalNumber(coreRaw),
        skill1:asOptionalNumber(skill1Raw),
        skill2:asOptionalNumber(skill2Raw),
        burstSkill:asOptionalNumber(burstSkillRaw),
        parts
      });
    }
    return {updates, unresolved};
  }

  function showStatus(text, ok=false){
    let el = document.getElementById('nikke-gm-sync-status');
    if(!el){
      el = document.createElement('div');
      el.id = 'nikke-gm-sync-status';
      el.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;padding:12px 16px;border-radius:10px;background:#111827;color:#fff;font:700 13px/1.45 Arial,sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.35);max-width:360px;';
      document.body?.appendChild(el);
    }
    el.textContent = text;
    el.style.background = ok ? '#143b35' : '#172033';
    setTimeout(()=>{ if(el && el.textContent===text) el.remove(); }, 5000);
  }

  async function runSync(token, sourceWindow){
    if(state.syncing) return;
    state.syncing = true;
    try{
      showStatus('NIKKE Gear Manager: 로그인/서버 정보 확인 중…');
      if(!await resolveAccount()){
        throw new Error('BlablaLink 로그인 정보 또는 서버 정보를 확인하지 못했습니다. 로그인 후 다시 시도해 주세요.');
      }

      // 페이지가 로드되며 캐릭터 마스터를 가져오는 시간을 조금 확보합니다.
      await delay(800);

      const chars = await fetchCharacters();
      const detailsOnlyFallback = chars && chars.__detailsOnlyFallback === true;
      // 계정에 있는 전체 캐릭터 중 현재 사이트/내장 매핑으로 이름을 확인할 수 있는 캐릭터만 조회합니다.
      // 상세 API 우회 모드에서는 알려진 이름 코드를 조회하고, 보유 니케만 상세 응답으로 추립니다.
      const codes = chars
        .map(x => x?.name_code)
        .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
        .map(v => String(v))
        .filter((v, i, a) => a.indexOf(v) === i)
        .filter(code => Boolean(BUILTIN_NAME_CODES[code]) || Boolean(state.codeToName.get(code)));
      if(!codes.length) throw new Error('현재 사이트와 매칭되는 보유 캐릭터를 찾지 못했습니다. 동기화 스크립트가 최신 버전인지 확인하세요.');

      showStatus(detailsOnlyFallback
        ? 'NIKKE Gear Manager: 선택 지역의 보유 니케 상세 정보를 조회 중…'
        : 'NIKKE Gear Manager: 장비 기업 정보를 조회 중… ('+codes.length+'명)');
      const details = await fetchDetails(codes);
      const {updates, unresolved} = makeUpdates(details);
      // The normal character-list endpoint is the source of truth for ownership.
      // In details-only fallback mode, the response contains only owned characters, so use details.
      const rosterSource = detailsOnlyFallback ? details : chars;
      const ownedNames = Array.from(new Set(rosterSource
        .map(char => {
          const code = String(char?.name_code ?? '');
          return String(BUILTIN_NAME_CODES[code] || state.codeToName.get(code) || '').trim();
        })
        .filter(Boolean)));
      const actualCharacterCount = detailsOnlyFallback
        ? new Set(details.map(char => String(char?.name_code ?? '')).filter(Boolean)).size
        : codes.length;

      if(sourceWindow && sourceWindow.postMessage){
        sourceWindow.postMessage({
          type:'NIKKE_GM_BL_TEST_SYNC_RESULT',
          token,
          payload:{
            ok:true,
            nickname:state.nickname,
            areaId:state.areaId,
            characterCount:actualCharacterCount,
            detailCount:details.length,
            ownedNames,
            updates,
            unresolved,
            skillsQueried:true
          }
        }, TARGET_ORIGIN);
      }
      showStatus('동기화 완료: '+updates.length+'명 · 미매칭 '+unresolved.length+'명', true);
    }catch(e){
      const msg = String(e?.message || e || '알 수 없는 오류');
      if(sourceWindow && sourceWindow.postMessage){
        sourceWindow.postMessage({
          type:'NIKKE_GM_BL_TEST_SYNC_RESULT',
          token,
          payload:{ok:false,error:msg}
        }, TARGET_ORIGIN);
      }
      showStatus('동기화 실패: '+msg);
    }finally{
      state.syncing = false;
    }
  }

  window.addEventListener('message', e => {
    const d = e?.data;
    if(!d || d.type !== 'NIKKE_GM_BL_TEST_HELLO') return;
    if(e.origin !== TARGET_ORIGIN) return;
    state.pendingToken = String(d.token || '');
    if(!state.pendingToken || !e.source) return;
    runSync(state.pendingToken, e.source);
  });

  const boot = () => {
    // 관리 사이트 팝업과의 연결은 READY/HELLO 핸드셰이크로 처리합니다.
    if(window.opener && window.opener !== window){
      try{
        window.opener.postMessage({type:'NIKKE_GM_BL_READY'}, TARGET_ORIGIN);
      }catch(_){}
    }
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();