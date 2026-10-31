/* NIKKE Gear Manager TEST ONLY - local browser-session JSON account import.
 * Does not touch the production website, Cloudflare Worker, passwords, cookies or tokens.
 * A user-activated bookmarklet runs only at www.blablalink.com and produces a sanitized JSON file.
 */
(function(){
  'use strict';
  const CAPTURE_SOURCE = "(async function(){\n  'use strict';\n  var HOST='https://www.blablalink.com';\n  if(location.origin!==HOST){\n    alert('이 북마클릿은 공식 https://www.blablalink.com 에 로그인한 탭에서만 실행할 수 있습니다.');\n    return;\n  }\n  if(document.getElementById('nikke-gm-test-capture-status')){\n    alert('이미 니케 데이터 추출이 진행 중입니다.');\n    return;\n  }\n  var status=document.createElement('div');\n  status.id='nikke-gm-test-capture-status';\n  status.style.cssText='position:fixed;z-index:2147483647;right:16px;bottom:16px;max-width:360px;padding:14px 18px;background:#19243b;color:white;border:1px solid #70bba8;border-radius:10px;box-shadow:0 6px 20px #0006;font:13px/1.5 sans-serif';\n  status.textContent='NIKKE Gear Manager 테섭: 로그인 정보 확인 중…';\n  document.body.appendChild(status);\n  function step(s){status.textContent='NIKKE Gear Manager 테섭: '+s;}\n  function errMsg(j,defaultText){return String(j && (j.message||j.msg) || defaultText);}\n  function optionalNumber(v){if(v===null||v===undefined||v==='')return null;var n=Number(v);return Number.isFinite(n)?n:null;}\n  async function api(url,body){\n    var r=await fetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json;charset=UTF-8'},body:JSON.stringify(body)});\n    var j=await r.json();\n    if(!r.ok||Number(j && j.code)!==0)throw new Error(errMsg(j,'HTTP '+r.status+' · BlaBlaLink 로그인 및 공유 설정을 확인하세요.'));\n    return j.data||{};\n  }\n  var API={\n    player:'https://api.blablalink.com/api/ugc/direct/standalonesite/User/GetUserGamePlayerInfo',\n    chars:'https://api.blablalink.com/api/game/proxy/Game/GetUserCharacters',\n    details:'https://api.blablalink.com/api/game/proxy/Game/GetUserCharacterDetails'\n  };\n  var STATIC_NAMES={\"1007\":\"D\",\"1010\":\"라플라스\",\"1012\":\"사쿠라\",\"1013\":\"솔져 E.G.\",\"1014\":\"솔져 F.A.\",\"1015\":\"프로덕트 08\",\"1016\":\"프로덕트 12\",\"1017\":\"iDoll 플라워\",\"1018\":\"iDoll 오션\",\"1019\":\"마나\",\"1020\":\"자칼\",\"1021\":\"목단\",\"1022\":\"바이퍼\",\"1023\":\"iDoll 썬\",\"1024\":\"프로덕트 23\",\"1025\":\"솔져 O.W.\",\"3001\":\"라피\",\"3002\":\"네온\",\"3003\":\"델타\",\"3004\":\"루마니\",\"3005\":\"아니스\",\"3006\":\"미하라\",\"3007\":\"벨로타\",\"3008\":\"미카\",\"3009\":\"N102\",\"3010\":\"에테르\",\"3011\":\"네베\",\"3012\":\"히메노\",\"3013\":\"람\",\"3014\":\"미사토\",\"3015\":\"사쿠라 (SR)\",\"3016\":\"릴리\",\"3017\":\"클레어\",\"3018\":\"쿠루미\",\"3019\":\"아이기스\",\"5001\":\"맥스웰\",\"5002\":\"슈가\",\"5003\":\"엑시아\",\"5004\":\"앨리스\",\"5005\":\"엠마\",\"5006\":\"유니\",\"5007\":\"프리바티\",\"5008\":\"블랑\",\"5009\":\"누아르\",\"5010\":\"프림\",\"5011\":\"리타\",\"5012\":\"스노우 화이트\",\"5013\":\"이사벨\",\"5014\":\"율리아\",\"5015\":\"시그널\",\"5016\":\"폴리\",\"5017\":\"미란다\",\"5018\":\"브리드\",\"5019\":\"솔린\",\"5020\":\"디젤\",\"5021\":\"센티\",\"5022\":\"베스티\",\"5023\":\"은화\",\"5024\":\"드레이크\",\"5025\":\"크로우\",\"5026\":\"메어리\",\"5027\":\"페퍼\",\"5028\":\"밀크\",\"5029\":\"율하\",\"5030\":\"애드미\",\"5031\":\"길로틴\",\"5032\":\"메이든\",\"5033\":\"루드밀라\",\"5034\":\"루피\",\"5035\":\"얀\",\"5036\":\"도라\",\"5037\":\"노벨\",\"5038\":\"에피넬\",\"5039\":\"폴크방\",\"5040\":\"라푼젤\",\"5041\":\"홍련\",\"5042\":\"하란\",\"5043\":\"노아\",\"5044\":\"모더니아\",\"5045\":\"로산나\",\"5046\":\"에이드\",\"5048\":\"마르차나\",\"5049\":\"루주\",\"5050\":\"코코아\",\"5051\":\"소다\",\"5053\":\"킬로\",\"5054\":\"비스킷\",\"5055\":\"길티\",\"5056\":\"니힐리스타\",\"5059\":\"신\",\"5061\":\"도로시\",\"5063\":\"앵커\",\"5064\":\"메어리 : 베이 갓데스\",\"5065\":\"크라운\",\"5066\":\"헬름\",\"5068\":\"네로\",\"5069\":\"라이\",\"5070\":\"아리아\",\"5071\":\"네온 : 블루 오션\",\"5074\":\"노이즈\",\"5075\":\"볼륨\",\"5077\":\"아인\",\"5078\":\"퀀시\",\"5079\":\"마스트\",\"5081\":\"토브\",\"5082\":\"키리\",\"5085\":\"앤 : 미라클 페어리\",\"5087\":\"루피 : 윈터 쇼퍼\",\"5088\":\"츠바이\",\"5089\":\"마키마\",\"5090\":\"파워\",\"5092\":\"레오나\",\"5094\":\"2B\",\"5095\":\"A2\",\"5096\":\"파스칼\",\"5097\":\"아니스 : 스파클링 서머\",\"5098\":\"헬름 : 아쿠아마린\",\"5099\":\"나가\",\"5100\":\"티아\",\"5101\":\"레드 후드\",\"5102\":\"스노우 화이트 : 이노센트 데이즈\",\"5103\":\"루드밀라 : 윈터 오너\",\"5104\":\"미카 : 스노우 버디\",\"5105\":\"홍련 : 흑영\",\"5106\":\"프리바티 : 언카인드 메이드\",\"5107\":\"일레그\",\"5108\":\"렘\",\"5109\":\"에밀리아\",\"5110\":\"D : 킬러 와이프\",\"5111\":\"베이\",\"5112\":\"트로니\",\"5113\":\"소다 : 트윙클링 바니\",\"5114\":\"앨리스 : 원더랜드 바니\",\"5115\":\"클레이\",\"5116\":\"로산나 : 시크 오션\",\"5117\":\"사쿠라 : 블룸 인 서머\",\"5118\":\"아스카\",\"5119\":\"레이\",\"5120\":\"마리\",\"5121\":\"퀀시 : 이스케이프 퀸\",\"5122\":\"팬텀\",\"5123\":\"라푼젤 : 퓨어 그레이스\",\"5124\":\"신데렐라\",\"5125\":\"그레이브\",\"5126\":\"플로라\",\"5127\":\"메이든 : 아이스 로즈\",\"5128\":\"길로틴 : 윈터 슬레이어\",\"5129\":\"라피 : 레드 후드\",\"5130\":\"마스트 : 로망틱 메이드\",\"5131\":\"앵커 : 이노센트 메이드\",\"5132\":\"레이 (가칭)\",\"5133\":\"아스카 : WILLE\",\"5134\":\"트리나\",\"5135\":\"브래디\",\"5136\":\"크러스트\",\"5137\":\"리틀 머메이드\",\"5138\":\"미하라 : 본딩 체인\",\"5139\":\"모리\",\"5140\":\"아르카나\",\"5141\":\"K\",\"5142\":\"이브\",\"5143\":\"레이븐\",\"5144\":\"소라\",\"5145\":\"도로시 : 세렌디피티\",\"5146\":\"일레그 : 붐 앤 쇼크\",\"5147\":\"엠마 : 택티컬 업\",\"5148\":\"베스티 : 택티컬 업\",\"5149\":\"은화 : 택티컬 업\",\"5150\":\"밀크 : 블루밍 바니\",\"5151\":\"에이드 : 에이전트 바니\",\"5152\":\"에이다\",\"5153\":\"질\",\"5154\":\"델타 : 닌자 시프\",\"5155\":\"나유타\",\"5156\":\"리버렐리오\",\"5157\":\"차임\",\"5158\":\"솔린 : 프로스트 티켓\",\"5159\":\"디젤 : 윈터 스위츠\",\"5160\":\"브리드 : 사일런트 트랙\",\"5161\":\"스노우 화이트 : 헤비암즈\",\"5162\":\"레이블\",\"5163\":\"벨벳\",\"5164\":\"치사토\",\"5165\":\"타키나\",\"5166\":\"E.H.\",\"5167\":\"아르카나 : 포츈 메이트\",\"5168\":\"백학\",\"5169\":\"아니스 : 스타\",\"5170\":\"네온 : 비전 아이\",\"5171\":\"아비스타\",\"5172\":\"민트\",\"5173\":\"프리카\",\"5174\":\"아크레인저 블랙\",\"5175\":\"신데렐라 : 크리스탈 웨이브\",\"5176\":\"마르차나 : 마린 스터디\",\"5177\":\"라플라스 : 얼티밋 히어로\",\"5178\":\"맥스웰 : 오디너리 미케닉\",\"5179\":\"퀸(마코토)\",\"5180\":\"유키코\",\"5181\":\"드레이크 : 그레이트 빌런\",\"5182\":\"길티 : 마이티 바니\",\"5183\":\"신 : 스위프트 바니\"};\n  var masterNames=new Map();\n  try{\n    var masterResponse=await fetch('https://sg-tools-cdn.blablalink.com/yl-57/hd-03/1bf030193826e243c2e195f951a4be00.json',{credentials:'omit'});\n    if(masterResponse.ok){\n      var master=await masterResponse.json();\n      if(Array.isArray(master)){\n        master.forEach(function(entry){\n          var code=String(entry && (entry.name_code||entry.nameCode)||'').trim();\n          var name=entry && entry.name_localkey && entry.name_localkey.name;\n          if(code&&typeof name==='string'&&name.trim())masterNames.set(code,name.trim());\n        });\n      }\n    }\n  }catch(_){}\n  function nameForCode(code){return String(STATIC_NAMES[code]||masterNames.get(code)||'').trim();}\n  var skillKeys=[\n    ['skill1_lv','skill_1_lv','skill1_level','skill_1_level','skill_level_1','skill_lv1','skill1Level','s1_lv','skill1'],\n    ['skill2_lv','skill_2_lv','skill2_level','skill_2_level','skill_level_2','skill_lv2','skill2Level','s2_lv','skill2'],\n    ['ulti_skill_lv','ultimate_skill_lv','ult_skill_lv','burst_skill_lv','burst_skill_level','skill3_lv','skill_3_lv','skill3_level','skill_3_level','skill_level_3','burstSkill','burst_lv','skill3']\n  ];\n  function skillValue(char,keys,index){\n    for(var i=0;i<keys.length;i++){\n      var number=optionalNumber(char[keys[i]]);\n      if(number!==null&&number>=1&&number<=10)return number;\n    }\n    var arrays=[char.skill_levels,char.skillLevels,char.skills];\n    for(var a=0;a<arrays.length;a++){\n      var list=arrays[a];\n      if(!list)continue;\n      var raw=Array.isArray(list)?list[index]:(list[String(index+1)]||list[index]);\n      if(raw&&typeof raw==='object')raw=raw.lv??raw.level??raw.skill_lv??null;\n      var n=optionalNumber(raw);\n      if(n!==null&&n>=1&&n<=10)return n;\n    }\n    return null;\n  }\n  const CORPORATIONS = Object.freeze({\n    1:'ELYSION', 2:'MISSILIS', 3:'TETRA', 4:'PILGRIM', 5:'ABNORMAL', 7:'ABNORMAL'\n  });\n\n  const normalizeCorp = (v) => {\n    if (v && typeof v === 'object') {\n      for (const key of ['corporation_type','corporationType','corporation','manufacturer','company','maker','corp','corporation_id','manufacturer_id','company_id','type','code','id','value','name']) {\n        if (v[key] !== undefined && v[key] !== null && v[key] !== '') {\n          const nested = normalizeCorp(v[key]);\n          if (nested) return nested;\n        }\n      }\n      return null;\n    }\n    if (typeof v === 'number' && Number.isFinite(v)) return CORPORATIONS[v] || null;\n    const s = String(v ?? '').trim().toUpperCase();\n    if (!s || s === '0' || s === 'NONE' || s === 'ALL' || s === 'NULL' || s === 'UNDEFINED') return null;\n    if (/^\\d+$/.test(s)) return CORPORATIONS[Number(s)] || null;\n    const aliases = {\n      'ELYSION':'ELYSION','MISSILIS':'MISSILIS','TETRA':'TETRA','PILGRIM':'PILGRIM',\n      'ABNORMAL':'ABNORMAL','ABNORM':'ABNORMAL',\n      '엘리시온':'ELYSION','미실리스':'MISSILIS','테트라':'TETRA','필그림':'PILGRIM','어브노멀':'ABNORMAL'\n    };\n    return aliases[s] || null;\n  };\n\n  function getRawCorp(char, slot) {\n    // BlablaLink 응답은 버전/엔드포인트에 따라 장비 필드명이 달라질 수 있으므로\n    // 슬롯명 + 기업/제조사 계열 키를 함께 탐색합니다.\n    const aliases = {\n      head:['head','helmet','helm','head_equip','head_equipment','equip_head'],\n      torso:['torso','body','chest','armor','torso_equip','body_equip','equip_torso','equip_body'],\n      arm:['arm','glove','gloves','gauntlet','hand','arm_equip','equip_arm'],\n      leg:['leg','legs','shoe','shoes','foot','feet','leg_equip','equip_leg']\n    };\n    const slotWords = aliases[slot] || [slot];\n    const visited = new Set();\n\n    function scan(value, depth=0, keyHint=''){\n      if(value==null || depth>7) return null;\n\n      const direct = normalizeCorp(value);\n      if(direct) return direct;\n\n      if(typeof value !== 'object') return null;\n      if(visited.has(value)) return null;\n      visited.add(value);\n\n      for(const [key,v] of Object.entries(value)){\n        const k=String(key).toLowerCase().replace(/[^a-z0-9_가-힣]/g,'');\n        const slotMatch=slotWords.some(w=>k.includes(String(w).toLowerCase().replace(/[^a-z0-9_]/g,'')));\n        const corpKey=/corporation|manufacturer|company|maker|corp|manufacturerid|corporationid|companyid|제조사|기업/.test(k);\n\n        // 슬롯과 기업 관련 키가 함께 있는 경우를 최우선으로 봅니다.\n        if(slotMatch && corpKey){\n          const corp=normalizeCorp(v);\n          if(corp) return corp;\n          const nested=scan(v,depth+1,k);\n          if(nested) return nested;\n        }\n      }\n\n      // 장비 객체 자체가 슬롯명 아래에 있는 경우.\n      for(const [key,v] of Object.entries(value)){\n        const k=String(key).toLowerCase();\n        const slotMatch=slotWords.some(w=>k.includes(String(w).toLowerCase()));\n        if(slotMatch && v && typeof v==='object'){\n          const nested=scan(v,depth+1,k);\n          if(nested) return nested;\n        }\n      }\n\n      // 마지막 보조 탐색: 현재 객체가 이미 슬롯 객체로 판단되면 기업 키를 깊게 찾습니다.\n      const contextIsSlot=slotWords.some(w=>String(keyHint).toLowerCase().includes(String(w).toLowerCase()));\n      if(contextIsSlot){\n        for(const [key,v] of Object.entries(value)){\n          const k=String(key).toLowerCase();\n          if(/corporation|manufacturer|company|maker|corp|제조사|기업/.test(k)){\n            const corp=normalizeCorp(v);\n            if(corp) return corp;\n            const nested=scan(v,depth+1,k);\n            if(nested) return nested;\n          }\n        }\n      }\n\n      return null;\n    }\n\n    // 흔히 사용되는 직접 필드들.\n    const directKeys=[];\n    for(const w of slotWords){\n      directKeys.push(\n        w+'_equip_corporation_type', w+'_corporation_type',\n        w+'_equip_manufacturer', w+'_manufacturer',\n        w+'_equip_company', w+'_company',\n        w+'_equip', w+'_equipment'\n      );\n    }\n    for(const key of directKeys){\n      if(char?.[key]!==undefined){\n        const corp=scan(char[key],0,key);\n        if(corp) return corp;\n      }\n    }\n\n    // API 버전에 따라 corporation/manufacturer 계열 이름이 달라지는 경우를 대비한 추가 직접 필드.\n    for(const w of slotWords){\n      for(const suffix of ['_corporation','_corporation_id','_manufacturer','_manufacturer_id','_company','_company_id','_corp']){\n        const key=w+suffix;\n        if(char?.[key]!==undefined){\n          const corp=scan(char[key],0,key);\n          if(corp) return corp;\n        }\n      }\n    }\n\n    // 전체 응답을 슬롯 문맥까지 포함해 탐색.\n    return scan(char,0,'');\n  }\n\n\n  function equipment(char,slot){\n    var key=slot+'_equip_';\n    var c=getRawCorp(char,slot);\n    return {\n      corporation_type:c,\n      tier:optionalNumber(char[key+'tier']??char[key+'lv_tier']??null),\n      level:optionalNumber(char[key+'lv']??null)\n    };\n  }\n  try{\n    var user=await api(API.player,{});\n    var canonical=user.info&&user.info.intl_openid||user.intl_openid||'';\n    var openid=String(canonical).split('-').pop();\n    if(!/^\\d+$/.test(openid))throw new Error('공식 페이지에서 로그인 계정 ID를 확인하지 못했습니다. ShiftyPad 페이지를 열어 로그인 상태를 확인해 주세요.');\n    var area=Number(user.area_id||user.info&&user.info.area_id||0);\n    if(![81,82,83,84,85].includes(area)){\n      area=Number(prompt('NIKKE 서버 지역 ID를 입력하세요.\\n81 일본 / 82 북미 / 83 한국 / 84 글로벌 / 85 동남아','83'));\n    }\n    if(![81,82,83,84,85].includes(area))throw new Error('서버 지역을 올바르게 선택하지 않았습니다.');\n    step('보유 니케 명단 확인 중…');\n    var roster=await api(API.chars,{intl_open_id:openid,nikke_area_id:area});\n    var characters=Array.isArray(roster.characters)?roster.characters:[];\n    var codes=Array.from(new Set(characters.map(function(ch){return String(ch && ch.name_code||'').trim();}).filter(Boolean)));\n    if(!codes.length)throw new Error('보유 니케 명단이 비어 있습니다. 로그인 계정과 NIKKE 지역을 확인하세요.');\n    var unresolved=codes.filter(function(code){return !nameForCode(code);});\n    if(unresolved.length){\n      throw new Error('이름 매핑이 없는 니케 '+unresolved.length+'명이 있어 안전하게 중단했습니다. 최신 캐릭터 데이터 업데이트 후 재시도하세요.');\n    }\n    var details=[];\n    for(var from=0;from<codes.length;from+=30){\n      step('장비·스킬 정보 수집 '+Math.min(from+30,codes.length)+' / '+codes.length+'명…');\n      var d=await api(API.details,{intl_open_id:openid,nikke_area_id:area,name_codes:codes.slice(from,from+30)});\n      if(!Array.isArray(d.character_details))throw new Error('BlaBlaLink가 상세 정보 배열을 반환하지 않았습니다. 계정에 변경은 없습니다.');\n      details.push.apply(details,d.character_details);\n    }\n    if(!details.length)throw new Error('니케 상세 정보를 받지 못했습니다.');\n    var uniqueDetails=new Map();\n    details.forEach(function(ch){var code=String(ch&&ch.name_code||'').trim();if(code&&codes.includes(code))uniqueDetails.set(code,ch);});\n    if(uniqueDetails.size!==codes.length)throw new Error('보유 명단 '+codes.length+'명 중 '+uniqueDetails.size+'명의 상세 정보만 받아 적용을 중단했습니다. 다른 시간에 재시도하세요.');\n    var updates=codes.map(function(code){\n      var ch=uniqueDetails.get(code);\n      return {\n        name:nameForCode(code),\n        grade:optionalNumber(ch.grade),\n        core:optionalNumber(ch.core),\n        skill1:skillValue(ch,skillKeys[0],0),\n        skill2:skillValue(ch,skillKeys[1],1),\n        burstSkill:skillValue(ch,skillKeys[2],2),\n        parts:{\n          '머리':equipment(ch,'head'),\n          '몸통':equipment(ch,'torso'),\n          '장갑':equipment(ch,'arm'),\n          '다리':equipment(ch,'leg')\n        }\n      };\n    });\n    var output={\n      kind:'nikke-gm-browser-capture',\n      schemaVersion:1,\n      capturedAt:new Date().toISOString(),\n      source:'official-blablalink-browser-session',\n      areaId:area,\n      nickname:String(user.role_name||user.nickname||'').slice(0,80),\n      characterCount:codes.length,\n      detailCount:updates.length,\n      ownedNames:codes.map(nameForCode),\n      updates:updates,\n      unresolved:[]\n    };\n    // Export only the sanitized roster and equipment/skill data: no raw account ID or cookies.\n    var blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'});\n    var href=URL.createObjectURL(blob),link=document.createElement('a');\n    link.href=href;\n    link.download='nikke-test-sync-'+new Date().toISOString().slice(0,10)+'.json';\n    document.body.appendChild(link);link.click();link.remove();\n    setTimeout(function(){URL.revokeObjectURL(href);},15000);\n    step('추출 완료 · '+codes.length+'명 · 내려받은 JSON 파일을 테섭에 올리세요.');\n    setTimeout(function(){status.remove();},12000);\n  }catch(error){\n    step('실패: '+String(error&&error.message||error));\n    status.style.borderColor='#ff8c8c';\n    alert('테섭 브라우저 연동 실험 실패:\\n'+String(error&&error.message||error));\n    setTimeout(function(){status.remove();},15000);\n  }\n})()";
  const BOOKMARKLET = 'javascript:' + encodeURIComponent(CAPTURE_SOURCE);
  let panel=null;
  let selected=null;
  const ACCOUNTS_FALLBACK=['계정1','계정2'];
  const text=(value)=>String(value==null?'':value);
  const normalizeName=(value)=>text(value).normalize('NFKC').toLowerCase().replace(/[\s:：·•._'’“”"\-–—()\[\]{}]/g,'');
  function allowedAccounts(){
    try{if(typeof ACCOUNTS !== 'undefined' && Array.isArray(ACCOUNTS))return ACCOUNTS.filter(Boolean).slice(0,2);}catch(_){}
    return ACCOUNTS_FALLBACK;
  }
  function status(message,isError=false){
    const el=panel&&panel.querySelector('#gmNewSyncStatus');
    if(el){el.textContent=message;el.style.color=isError?'#ffa2a2':'#b7decc';}
  }
  function validateSnapshot(snapshot){
    if(!snapshot || typeof snapshot!=='object' || Array.isArray(snapshot) ||
      snapshot.kind!=='nikke-gm-browser-capture' || snapshot.schemaVersion!==1)
      throw new Error('테섭 전용 북마클릿으로 생성한 JSON 파일이 아닙니다.');
    if(!Array.isArray(snapshot.ownedNames)||!Array.isArray(snapshot.updates)||
      !snapshot.ownedNames.length||snapshot.ownedNames.length>600||
      snapshot.updates.length!==snapshot.ownedNames.length)
      throw new Error('보유 명단과 상세 데이터 수가 일치하지 않거나 비어 있습니다.');
    const names=snapshot.ownedNames.map(text);
    const unique=new Set(names.map(normalizeName));
    if(unique.size!==names.length || names.some(n=>!n.trim()||n.length>120))
      throw new Error('보유 명단에 중복되거나 잘못된 이름이 있습니다.');
    const byName=new Set(snapshot.updates.map(u=>normalizeName(u&&u.name)));
    if(byName.size!==unique.size||[...unique].some(name=>!byName.has(name)))
      throw new Error('보유 니케 명단과 상세 정보의 이름이 일치하지 않습니다.');
    if(Number(snapshot.characterCount)!==names.length ||
       Number(snapshot.detailCount)!==snapshot.updates.length)
      throw new Error('추출 파일의 보유/상세 건수 검증에 실패했습니다.');
    const catalog=Array.isArray(window.__NIKKE_RAW)?window.__NIKKE_RAW:[];
    const known=new Set(catalog.map(row=>normalizeName(row&&row['이름'])).filter(Boolean));
    if(!known.size)throw new Error('사이트 캐릭터 도감을 불러오지 못했습니다.');
    const unknown=names.filter(n=>!known.has(normalizeName(n)));
    if(unknown.length)throw new Error('테섭 도감에서 찾지 못한 캐릭터 '+unknown.length+'명 ('+unknown.slice(0,3).join(', ')+')이 있습니다. 안전을 위해 적용하지 않습니다.');
    for(const item of snapshot.updates){
      if(!item||typeof item!=='object'||!item.parts||typeof item.parts!=='object')
        throw new Error('일부 니케의 상세 정보가 누락되었습니다.');
      for(const key of ['grade','core','skill1','skill2','burstSkill']){
        const value=item[key];
        if(value!==null&&value!==undefined&&(!Number.isFinite(Number(value))||Number(value)<0||Number(value)> (key==='grade'?3:key==='core'?7:10)))
          throw new Error('유효하지 않은 '+key+' 값이 포함되어 있습니다.');
      }
    }
    return {snapshot,names,unknown:[],skillMissing:snapshot.updates.filter(u=>
      u.skill1==null||u.skill2==null||u.burstSkill==null).length};
  }
  function openPanel(){
    if(!panel){
      panel=document.createElement('div');
      panel.className='gm-new-sync-overlay';
      panel.style.cssText='position:fixed;z-index:200050;inset:0;background:#030917d9;display:flex;align-items:center;justify-content:center;padding:16px';
      panel.innerHTML=
        '<section style="background:#111c30;color:#f6f9ff;border:1px solid #466075;border-radius:14px;padding:20px;width:min(640px,96vw);max-height:92vh;overflow:auto;font:13px/1.65 sans-serif;box-shadow:0 20px 70px #0008" role="dialog" aria-modal="true" aria-labelledby="gmNewSyncTitle">'+
          '<header style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 id="gmNewSyncTitle" style="margin:0;font-size:18px">실험실 · 새 계정 연동</h2><button type="button" data-gm-close style="padding:7px 12px">닫기</button></header>'+
          '<p style="margin:12px 0">서비스 공용 토큰 대신 <b>본인이 로그인한 BlaBlaLink 브라우저</b>에서 직접 데이터를 추출합니다. 별도 확장·Tampermonkey·Cloudflare 변경 없이, 파일 확인 후 반영하는 시험 기능입니다.</p>'+
          '<p style="margin:10px 0"><b>1.</b> 북마크바 표시(Ctrl+Shift+B) 후 아래 링크를 북마크바에 <b>드래그</b>하세요.</p>'+
          '<p style="text-align:center"><a id="gmNewSyncBookmarklet" style="display:inline-block;padding:10px 16px;background:#264f75;border:1px solid #7cafd2;border-radius:8px;color:#fff;font-weight:700;cursor:grab">니케 보유·장비 추출</a></p>'+
          '<p><b>2.</b> <a href="https://www.blablalink.com/shiftyspad/nikke" target="_blank" rel="noopener noreferrer" style="color:#8fdcf2">공식 BlaBlaLink ShiftyPad 열기</a> → 본인 계정으로 로그인 → 만들어 둔 북마크를 클릭합니다. 보유·장비·스킬이 JSON 파일로 내려받아집니다.</p>'+
          '<p><b>3.</b> 내려받은 JSON 파일을 아래에서 선택하세요. 계정 데이터는 미리보기 단계에서 변경되지 않습니다.</p>'+
          '<input type="file" id="gmNewSyncFile" accept=".json,application/json" style="width:100%;padding:10px;border:1px solid #63748a;border-radius:8px;background:#1d2e47;color:white">'+
          '<div id="gmNewSyncPreview" hidden style="padding:10px;margin:12px 0;border:1px solid #405971;border-radius:8px"></div>'+
          '<label style="display:block;margin-top:10px">적용할 테섭 계정<select id="gmNewSyncAccount" style="display:block;width:100%;margin-top:5px;padding:8px;background:#152840;color:#fff;border:1px solid #7892aa"><option value="">적용할 계정 선택…</option></select></label>'+
          '<label style="display:block;margin:12px 0"><input type="checkbox" id="gmNewSyncApproval"> 미리보기 명단을 확인했고, 선택한 테섭 계정의 보유·장비·스킬 정보가 교체되는 것에 동의합니다.</label>'+
          '<button type="button" id="gmNewSyncApply" disabled style="padding:10px 18px;border:1px solid #67b9bb;border-radius:8px;background:#164f61;color:#fff;font-weight:700">확인한 계정에만 반영</button>'+
          '<div id="gmNewSyncStatus" style="margin-top:12px;white-space:pre-wrap;color:#b7decc">기존 공개 프로필 URL 동기화는 변경하지 않았습니다.</div>'+
          '<p style="font-size:11px;color:#9babc4">실험 기능 · 공식 웹페이지에서 직접 요청하며 쿠키·비밀번호·토큰은 JSON에 저장하지 않습니다. 로그인 세션 만료, 브라우저/CORS 정책, 공식 API 변경에 따라 추출이 실패할 수 있습니다.</p>'+
        '</section>';
      document.body.appendChild(panel);
      panel.querySelector('[data-gm-close]').addEventListener('click',()=>{panel.style.display='none';});
      const link=panel.querySelector('#gmNewSyncBookmarklet');
      link.href=BOOKMARKLET;
      link.title='이 링크를 북마크바에 끌어다 놓으세요. 공식 BlaBlaLink 탭에서 실행됩니다.';
      const select=panel.querySelector('#gmNewSyncAccount');
      allowedAccounts().forEach(name=>{
        const option=document.createElement('option');option.value=name;option.textContent=name;select.appendChild(option);
      });
      panel.querySelector('#gmNewSyncFile').addEventListener('change',async event=>{
        selected=null;
        const preview=panel.querySelector('#gmNewSyncPreview');
        const file=event.target.files&&event.target.files[0];
        preview.hidden=true;
        panel.querySelector('#gmNewSyncApply').disabled=true;
        if(!file)return;
        if(file.size>3*1024*1024){status('파일이 3MB를 초과합니다.',true);return;}
        try{
          const content=await file.text();
          selected=validateSnapshot(JSON.parse(content));
          preview.hidden=false;
          preview.textContent='보유 '+selected.names.length+'명 / 상세 '+selected.snapshot.updates.length+'명 / 지역 '+text(selected.snapshot.areaId)+' / 수집일 '+text(selected.snapshot.capturedAt).slice(0,19)+
            (selected.skillMissing?' / 스킬 일부 미확인 '+selected.skillMissing+'명':' / 스킬 정보 포함')+
            '\n미리보기: '+selected.names.slice(0,15).join(', ')+(selected.names.length>15?' 외 '+(selected.names.length-15)+'명':'');
          status('파일 검증 완료. 적용할 계정과 확인 체크를 지정하세요.');
          updateApply();
        }catch(e){selected=null;status('파일 확인 실패: '+text(e.message||e),true);}
      });
      select.addEventListener('change',updateApply);
      panel.querySelector('#gmNewSyncApproval').addEventListener('change',updateApply);
      panel.querySelector('#gmNewSyncApply').addEventListener('click',()=>{
        if(!selected)return;
        const account=panel.querySelector('#gmNewSyncAccount').value;
        if(!allowedAccounts().includes(account)||!panel.querySelector('#gmNewSyncApproval').checked)return;
        if(!window.confirm('테섭 '+account+'의 보유·돌파·장비·스킬 정보를 '+selected.names.length+'명의 추출 결과로 교체합니다. 진행할까요?'))return;
        const apply=window.__NIKKE_GM_APPLY_SYNC__;
        if(typeof apply!=='function'){status('기존 사이트 동기화 반영 함수를 찾지 못했습니다.',true);return;}
        try{
          const snapshot=selected.snapshot;
          apply({ok:true,nickname:snapshot.nickname||'',areaId:snapshot.areaId,detailCount:snapshot.updates.length,
            ownedNames:snapshot.ownedNames,updates:snapshot.updates,unresolved:[],scriptVersion:'browser-file-test-1'},account);
          const key='nikke_synced_owned_characters_v1_'+encodeURIComponent(account);
          const persisted=JSON.parse(localStorage.getItem(key)||'null');
          if(!Array.isArray(persisted)||persisted.length!==selected.names.length)
            throw new Error('적용 후 보유 명단을 저장소에서 확인하지 못했습니다.');
          status('반영 완료 · '+account+' · '+persisted.length+'명. 테섭 장비·스킬 현황을 확인하세요.');
          panel.querySelector('#gmNewSyncApproval').checked=false;
          updateApply();
        }catch(e){status('반영 중 오류: '+text(e.message||e),true);}
      });
    }
    panel.style.display='flex';
    panel.querySelector('#gmNewSyncAccount').value='';
    panel.querySelector('#gmNewSyncApproval').checked=false;
    updateApply();
  }
  function updateApply(){
    if(!panel)return;
    const enabled=!!selected&&allowedAccounts().includes(panel.querySelector('#gmNewSyncAccount').value)
      &&panel.querySelector('#gmNewSyncApproval').checked;
    panel.querySelector('#gmNewSyncApply').disabled=!enabled;
  }
  function addEntry(){
    const modal=document.querySelector('.bl-direct-modal');
    const actions=modal&&modal.querySelector('.bl-direct-actions');
    if(!actions||actions.querySelector('.gm-new-sync-entry'))return;
    const button=document.createElement('button');
    button.type='button';
    button.className='gm-new-sync-entry';
    button.textContent='새 연동 방식 실험';
    button.style.cssText='padding:8px 12px;background:#204963;border:1px solid #4386a4;border-radius:8px;color:white;font-weight:700;cursor:pointer';
    button.addEventListener('click',openPanel);
    actions.appendChild(button);
  }
  function init(){
    if(typeof window.openBlablalinkSyncGuide==='function' &&
       !window.openBlablalinkSyncGuide.__nikkeExperimentalWrapped){
      const old=window.openBlablalinkSyncGuide;
      const wrapped=function(){const output=old.apply(this,arguments);addEntry();return output;};
      wrapped.__nikkeExperimentalWrapped=true;
      window.openBlablalinkSyncGuide=wrapped;
    }
    addEntry();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  window.__NIKKE_EXPERIMENTAL_SYNC_TEST__={open:openPanel,validate:validateSnapshot};
})();