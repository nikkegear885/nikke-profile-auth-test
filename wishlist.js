/* NIKKE Gear Manager - Wishlist Recommendation (test site only) */
(function(){
  'use strict';

  const COMPANIES = ['엘리시온','미실리스','테트라','필그림'];
  const PILGRIM_COMPANY = '필그림';
  const STANDARD_PRIORITY_COMPANIES = COMPANIES.filter(company => company !== PILGRIM_COMPANY);
  const STORAGE_KEY = 'nikke_wishlist_recommendations_v1';
  const EXCLUDED_STORAGE_KEY = 'nikke_wishlist_excluded_characters_v1';
  const FAVORITE_STORAGE_KEY = 'nikke_wishlist_favorite_characters_v1';
  const SYNCED_OWNED_STORAGE_PREFIX = 'nikke_synced_owned_characters_v1_';
  const EXCLUDED_HELM_MIGRATED_KEY = 'nikke_wishlist_helm_conditional_migrated_v1';
  const IMAGE_URL = 'assets/nikke-pedia-master.json?v=1047';
  const norm = value => String(value == null ? '' : value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s:：·•._'’“”"\-–—()\[\]{}]/g, '');
  const OVERSPEC_WISHLIST_NAMES = new Set([
    "라피 : 레드 후드",
    "네온 : 비전 아이",
    "아니스 : 스타",
    "미하라 : 본딩 체인"
  ].map(norm));
  function isOverspecWishlistName(name){ return OVERSPEC_WISHLIST_NAMES.has(norm(name)); }
  // Keep limited/distribution characters out of wishlist choices and auto-recommendations.
  const WISHLIST_EXCLUDED_NAMES = new Set([
    "2B",
    "신데렐라 : 크리스탈 웨이브",
    "길로틴 : 윈터 슬레이어",
    "네온 : 블루 오션",
    "도로시 : 세렌디피티",
    "디젤 : 윈터 스위츠",
    "레이",
    "레이 (가칭)",
    "레이븐",
    "렘",
    "로산나 : 시크 오션",
    "루드밀라 : 윈터 오너",
    "루피 : 윈터 쇼퍼",
    "마르차나 : 마린 스터디",
    "마리",
    "마키마",
    "메어리 : 베이 갓데스",
    "메이든 : 아이스 로즈",
    "미카 : 스노우 버디",
    "브리드 : 사일런트 트랙",
    "사쿠라 : 블룸 인 서머",
    "아니스 : 스파클링 서머",
    "아스카",
    "아스카 : WILLE",
    "앤 : 미라클 페어리",
    "에밀리아",
    "에이다",
    "유키코",
    "이브",
    "일레그 : 붐 앤 쇼크",
    "질",
    "치사토",
    "퀸(마코토)",
    "타키나",
    "파워",
    "헬름 : 아쿠아마린",
    "A2",
    "앵커",
    "네베",
    "차임",
    "킬로",
    "파스칼",
    "클레어",
    "쿠루미",
    "아이기스",
    "길티",
    "신",
    "퀀시",
    "라푼젤:퓨어그레이스",
    "람",
    "릴리",
    "모리",
    "미사토",
    "사쿠라 스즈하라",
    "아비스타",
    "니힐리스타",
    "스노우 화이트 : 이노센트 데이즈",
    "히메노",
    "라이"
  ].map(norm));
  function isWishlistExcluded(name){ return WISHLIST_EXCLUDED_NAMES.has(norm(name)); }

  const RARITY_DATA_URL = 'assets/nikke-skills.json?v=1051';
  let nikkeRarityMap = new Map();
  let rarityLoadPromise = null;
  let rarityDataReady = false;

  function ensureRarityData(){
    if(rarityDataReady) return Promise.resolve(true);
    if(rarityLoadPromise) return rarityLoadPromise;
    rarityLoadPromise = (async function(){
      try{
        const response = await fetch(RARITY_DATA_URL, {cache:'no-store'});
        if(!response.ok) throw new Error('등급 데이터 요청 실패: HTTP ' + response.status);
        const records = await response.json();
        if(!records || typeof records !== 'object' || Array.isArray(records)) throw new Error('등급 데이터 형식이 올바르지 않습니다.');
        const map = new Map();
        Object.entries(records).forEach(([name,entry]) => {
          const rarity = String(entry && (entry.r ?? entry.rarity) || '').trim().toUpperCase();
          if(name && rarity) map.set(norm(name), rarity);
          if(entry && entry.name && rarity) map.set(norm(entry.name), rarity);
        });
        if(!map.size) throw new Error('등급 데이터가 비어 있습니다.');
        nikkeRarityMap = map;
        rarityDataReady = true;
        return true;
      }catch(error){
        console.error('[wishlist] rarity data load failed', error);
        rarityLoadPromise = null;
        return false;
      }
    })();
    return rarityLoadPromise;
  }

  function isSSRCharacter(name){
    return rarityDataReady && nikkeRarityMap.get(norm(name)) === 'SSR';
  }

  // Standard-company eligibility (Elysion, Missillis, Tetra).
  function isEligibleStandardWishlistName(name, company){
    if(!String(name || '').trim()) return false;
    // Overspec characters are available under Pilgrim only.
    if(isOverspecWishlistName(name) && company !== PILGRIM_COMPANY) return false;
    return !isWishlistExcluded(name) && isSSRCharacter(name);
  }

  // Pilgrim eligibility is intentionally isolated from standard-company eligibility.
  // Until Pilgrim-specific eligibility rules are provided, preserve the current SSR/exclusion
  // boundary as a compatibility default; future Pilgrim rules should be added here only.
  function isEligiblePilgrimWishlistName(name){
    if(!String(name || '').trim()) return false;
    return !isWishlistExcluded(name) && isSSRCharacter(name);
  }

  function isEligibleWishlistName(name, company){
    return company === PILGRIM_COMPANY
      ? isEligiblePilgrimWishlistName(name)
      : isEligibleStandardWishlistName(name, company);
  }

  // Internal-only performance ranking for standard-company auto recommendations (Elysion/Missillis/Tetra).
  // Do not render these labels or ranks in the Pedia or other UI.
  // Pilgrim must not be added to this shared table; its dedicated priority rules are defined separately below.
  // Lower rank number means higher priority. The Solo Raid MLB tier and PvP tier share rank 4.
  // PVP inclusion is an optional auto-recommendation priority, separate from the fixed tier table.
  // Only characters explicitly designated by the user as PVP candidates.
  // Missilis: 트리나, 자칼, 센티. Elysion: 베스티 : 택티컬 업.
  const PVP_WISHLIST_NAMES = new Set(['트리나','자칼','센티','베스티 : 택티컬 업','비스킷','루마니','노이즈','블랑','소다','베이'].map(norm));
  // Laplace is the lowest-priority member of the PVP category.
  const PVP_LOWEST_WISHLIST_NAMES = new Set(['라플라스'].map(norm));
  // Split the former mixed "Solo Raid = PVP" list into distinct priority categories.
  const SOLO_RAID_WISHLIST_NAMES = new Set([
    'D : 킬러 와이프','밀크 : 블루밍 바니','에이드 : 에이전트 바니','솔린 : 프로스트 티켓','아르카나 : 포츈 메이트','델타 : 닌자 시프','아르카나',
    '길티 : 마이티 바니','드레이크 : 그레이트 빌런','신 : 스위프트 바니',
    '브래디','소다 : 트윙클링 바니','루주','앨리스','벨벳','아크레인저 블랙','누아르',
    '볼륨','퀀시 : 이스케이프 퀸'
  ].map(norm));
  const PVP_INCLUDED_KEY = 'nikke_wishlist_pvp_included_v1';

  const WISHLIST_PERFORMANCE_TIERS = [
    {rank:1, label:'필수캐', names:['마스트 : 로망틱 메이드','민트']},
    {rank:2, label:'애장품 필수', names:['헬름','플로라','토브','목단']},
    {rank:3, label:'범용캐', names:['드레이크','아인','라플라스 : 얼티밋 히어로','프리카','앵커 : 이노센트 메이드']},
    {rank:4, label:'PVP 우선', names:['베스티 : 택티컬 업','트리나','자칼','센티','라플라스','비스킷','루마니','노이즈','블랑','소다','베이']},
    {rank:5, label:'애장품 솔레캐', names:['프리바티','팬텀','미란다','슈가','로산나']},
    {rank:6, label:'솔레', names:[
      'D : 킬러 와이프','밀크 : 블루밍 바니','에이드 : 에이전트 바니','솔린 : 프로스트 티켓','아르카나 : 포츈 메이트','델타 : 닌자 시프','아르카나',
      '길티 : 마이티 바니','드레이크 : 그레이트 빌런','신 : 스위프트 바니',
      '브래디','소다 : 트윙클링 바니','루주','앨리스','벨벳','아크레인저 블랙','누아르',
      '퀀시 : 이스케이프 퀸'
    ]},
    {rank:8, label:'명함 추천', names:[
      '맥스웰 : 오디너리 미케닉','율리아','츠바이',
      '프리바티 : 언카인드 메이드','마스트','은화 : 택티컬 업','엠마 : 택티컬 업',
      '마나','페퍼','맥스웰','티아','나가','리타',
      '볼륨','도라','사쿠라','에이드','크러스트','앨리스 : 원더랜드 바니','레오나','네로'
    ]},
    {rank:10, label:'도감작', names:[
      '레이블','길로틴','마르차나','시그널','키리','브리드','메이든','베스티','엠마',
      '솔린','은화','D','K','소라','E.H.','폴리','디젤',
      '에피넬','애드미','트로니','일레그','백학','유니','크로우',
      '루드밀라','코코아','클레이','폴크방','밀크','바이퍼','루피','메어리',
      '얀','엑시아','율하','프림','노벨','아리아'
    ]}
  ];
  // Pilgrim has a fully separate first-copy priority sequence.
  // Once a character is owned (the account no longer marks it as unowned), skip it regardless of breakthrough.
  // The names are canonical in-game names; normalization handles spacing variants in user-facing text.
  const PILGRIM_WISHLIST_PRIORITY_NAMES = [
    '크라운',
    '아니스 : 스타',
    '라피 : 레드 후드',
    '스노우 화이트 : 헤비암즈',
    '네온 : 비전 아이',
    '홍련 : 흑영',
    '리버렐리오',
    '나유타',
    '신데렐라',
    '미하라 : 본딩 체인',
    '리틀 머메이드',
    '노아',
    '이사벨',
    '그레이브',
    '레드 후드',
    '스노우 화이트',
    '모더니아',
    '도로시',
    '하란',
    // These two stay last unless PVP priority is set to stage 1.
    '홍련',
    '라푼젤'
  ];

  const PILGRIM_PVP_PROMOTED_NAMES = ['홍련','라푼젤'];

  function getPilgrimWishlistPriorityNames(){
    const promotedKeys = new Set(PILGRIM_PVP_PROMOTED_NAMES.map(norm));
    const names = PILGRIM_WISHLIST_PRIORITY_NAMES.filter(name => !promotedKeys.has(norm(name)));
    // PVP priority stage 1 promotes Scarlet > Rapunzel immediately after Noah.
    if(pvpPriority === 'pvp'){
      const noahIndex = names.findIndex(name => norm(name) === norm('노아'));
      names.splice(noahIndex >= 0 ? noahIndex + 1 : names.length, 0, ...PILGRIM_PVP_PROMOTED_NAMES);
    }else{
      names.push(...PILGRIM_PVP_PROMOTED_NAMES);
    }
    return names;
  }

  function getPilgrimWishlistPriorityIndex(){
    return new Map(getPilgrimWishlistPriorityNames().map((name,index) => [norm(name),index]));
  }

  const WISHLIST_PERFORMANCE_PRIORITY = (() => {
    const priorities = new Map();
    WISHLIST_PERFORMANCE_TIERS.forEach(tier => tier.names.forEach(name => {
      const key = norm(name);
      // If a Nikke appears in multiple groups, retain its highest (lowest-numbered) priority.
      if(!priorities.has(key) || tier.rank < priorities.get(key)) priorities.set(key, tier.rank);
    }));
    return priorities;
  })();
  // Preserve the ordering of the internal list within each rank for the character picker.
  const WISHLIST_PERFORMANCE_POSITION = (() => {
    const positions = new Map();
    WISHLIST_PERFORMANCE_TIERS.forEach((tier,tierOrder) => tier.names.forEach((name,index) => {
      const key = norm(name);
      const current = positions.get(key);
      if(!current || tier.rank < current.rank) positions.set(key,{rank:tier.rank,tierOrder,index});
    }));
    return positions;
  })();
  function getWishlistPerformancePosition(name){
    const key = norm(name);
    if(WISHLIST_UNOWNED_REQUIRED_OVERRIDE_NAMES.has(key) && isMarkedUnowned(name)){
      return {rank:1,tierOrder:0,index:997};
    }
    // 프리바티는 2돌 미만이면 애장품 필수 그룹의 정렬 위치를 사용한다.
    if(WISHLIST_TREASURE_REQUIRED_UNDER_TWO_NAMES.has(key) && getBreakthrough(name) < 2){
      return {rank:2,tierOrder:1,index:998};
    }
    if(WISHLIST_TREASURE_SOLO_UNDER_TWO_NAMES.has(key) && getBreakthrough(name) < 2){
      return {rank:5,tierOrder:4,index:5};
    }
    if(WISHLIST_UNOWNED_GENERAL_OVERRIDE_NAMES.has(key) && isMarkedUnowned(name)){
      return {rank:3,tierOrder:2,index:997};
    }
    if(isMarkedUnowned(name) && key === norm('루주')){
      // 아니스 : 스타 미보유 시에는 범용캐 맨 뒤, 보유 시에는 에이드 : 에이전트 바니 바로 뒤의 솔레 순위.
      return isMarkedUnowned('아니스 : 스타')
        ? {rank:3,tierOrder:2,index:999}
        : {rank:6,tierOrder:5,index:2.5};
    }
    if(isMarkedUnowned(name) && key === norm('볼륨')){
      return {rank:6,tierOrder:5,index:-1};
    }
    return WISHLIST_PERFORMANCE_POSITION.get(key);
  }
  function compareWishlistPickerOrder(a,b){
    const aName = String(a && a['이름'] || '').trim();
    const bName = String(b && b['이름'] || '').trim();
    const aRank = getWishlistPerformancePriority(aName);
    const bRank = getWishlistPerformancePriority(bName);
    if(aRank !== bRank) return aRank - bRank;
    const aPosition = getWishlistPerformancePosition(aName);
    const bPosition = getWishlistPerformancePosition(bName);
    if(aPosition && bPosition && aPosition.tierOrder !== bPosition.tierOrder) return aPosition.tierOrder - bPosition.tierOrder;
    if(aPosition && bPosition && aPosition.index !== bPosition.index) return aPosition.index - bPosition.index;
    if(aPosition && !bPosition) return -1;
    if(!aPosition && bPosition) return 1;
    return aName.localeCompare(bName,'ko');
  }

  function compareWishlistPickerOrderForCompany(a,b,company){
    const aName = String(a && a['이름'] || '').trim();
    const bName = String(b && b['이름'] || '').trim();
    if(company === PILGRIM_COMPANY){
      const priorityIndex = getPilgrimWishlistPriorityIndex();
      const aIndex = priorityIndex.get(norm(aName));
      const bIndex = priorityIndex.get(norm(bName));
      if(aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
      if(aIndex !== undefined) return -1;
      if(bIndex !== undefined) return 1;
      return aName.localeCompare(bName,'ko');
    }
    return compareWishlistPickerOrder(a,b);
  }
  const DEFAULT_PERFORMANCE_PRIORITY = Math.max(...WISHLIST_PERFORMANCE_TIERS.map(tier => tier.rank)) + 1;
  const WISHLIST_TREASURE_REQUIRED_NAMES = new Set(
    WISHLIST_PERFORMANCE_TIERS
      .filter(tier => tier.label === '애장품 필수')
      .flatMap(tier => tier.names.map(norm))
  );
  const WISHLIST_TREASURE_SOLO_NAMES = new Set(
    WISHLIST_PERFORMANCE_TIERS
      .filter(tier => tier.label === '애장품 솔레캐')
      .flatMap(tier => tier.names.map(norm))
  );
  const WISHLIST_TREASURE_UPSIDE_NAMES = new Set([
    ...WISHLIST_TREASURE_REQUIRED_NAMES,
    ...WISHLIST_TREASURE_SOLO_NAMES
  ]);
  const WISHLIST_REQUIRED_NAMES = new Set(
    WISHLIST_PERFORMANCE_TIERS.filter(tier => tier.label === '필수캐').flatMap(tier => tier.names.map(norm))
  );
  // 160-wall X rule 2: prioritize these characters whenever they are below 3 breakthroughs.
  const WISHLIST_160_WALL_X_PRIORITY_NAMES = new Set(['티아','나가','리타','헬름','앨리스'].map(norm));
  const WISHLIST_GENERAL_NAMES = new Set(
    WISHLIST_PERFORMANCE_TIERS.filter(tier => tier.label === '범용캐').flatMap(tier => tier.names.map(norm))
  );
  const WISHLIST_NAMECARD_NAMES = new Set(
    WISHLIST_PERFORMANCE_TIERS.filter(tier => tier.label === '명함 추천').flatMap(tier => tier.names.map(norm))
  );
  const WISHLIST_COLLECTION_NAMES = new Set(
    WISHLIST_PERFORMANCE_TIERS
      .filter(tier => tier.label === '도감작')
      .flatMap(tier => tier.names.map(norm))
  );
  const WISHLIST_TRACKED_NAMES = new Set(WISHLIST_PERFORMANCE_TIERS.flatMap(tier => tier.names.map(norm)));
  // Special breakthrough-based priority overrides requested for the wishlist.
  // 프리바티: 2돌 미만이면 애장품 필수, 2돌 이상이면 기본 애장품 솔레캐 우선순위 유지.
  const WISHLIST_TREASURE_REQUIRED_UNDER_TWO_NAMES = new Set(['프리바티'].map(norm));
  // 센티는 2돌 미만일 때만 PVP 대신 애장품 솔레캐 우선순위를 적용합니다.
  const WISHLIST_TREASURE_SOLO_UNDER_TWO_NAMES = new Set(['센티'].map(norm));
  const WISHLIST_TWO_BREAKTHROUGH_PVP_NAMES = new Set(['라플라스'].map(norm));
  const WISHLIST_TWO_BREAKTHROUGH_NAMECARD_NAMES = new Set(['츠바이','율리아'].map(norm));
  const WISHLIST_AUTO_EXCLUDE_AT_TWO_NAMES = new Set(['미란다'].map(norm));
  // 베스티 : 택티컬 업은 미보유 상태에서만 범용캐로 취급하고, 명함 보유 시 기존 PVP 우선도를 따른다.
  const WISHLIST_UNOWNED_GENERAL_OVERRIDE_NAMES = new Set(['베스티 : 택티컬 업'].map(norm));
  // 프리카는 별도 특수조건 없이 기본 범용캐 우선순위를 적용한다.
  const WISHLIST_UNOWNED_REQUIRED_OVERRIDE_NAMES = new Set();
  // 루주는 본인 명함이 없을 때 아니스 : 스타 보유 여부에 따라 범용캐 또는 에이드 뒤 솔레로 배치한다.
  // 명함을 보유하면 기존 솔레 순서를 그대로 적용한다.
  const WISHLIST_UNOWNED_GENERAL_LAST_NAMES = new Set(['루주'].map(norm));
  // Volume is promoted to the first Solo Raid slot only while unowned, then returns to Namecard.
  const WISHLIST_UNOWNED_SOLO_FIRST_NAMES = new Set(['볼륨'].map(norm));
  function getBaseWishlistPerformancePriority(name){
    return WISHLIST_PERFORMANCE_PRIORITY.get(norm(name)) ?? DEFAULT_PERFORMANCE_PRIORITY;
  }
  function getWishlistPerformancePriority(name){
    const key = norm(name);
    if(WISHLIST_UNOWNED_REQUIRED_OVERRIDE_NAMES.has(key) && isMarkedUnowned(name)) return 1;
    if(WISHLIST_UNOWNED_GENERAL_OVERRIDE_NAMES.has(key) && isMarkedUnowned(name)) return 3;
    if(WISHLIST_UNOWNED_GENERAL_LAST_NAMES.has(key) && isMarkedUnowned(name)){
      return isMarkedUnowned('아니스 : 스타') ? 3 : 6;
    }
    if(WISHLIST_UNOWNED_SOLO_FIRST_NAMES.has(key) && isMarkedUnowned(name)) return 6;
    if(WISHLIST_TREASURE_REQUIRED_UNDER_TWO_NAMES.has(key) && getBreakthrough(name) < 2) return 2;
    if(WISHLIST_TREASURE_SOLO_UNDER_TWO_NAMES.has(key) && getBreakthrough(name) < 2) return 5;
    if(WISHLIST_TWO_BREAKTHROUGH_NAMECARD_NAMES.has(key)){
      return getBreakthrough(name) < 2 ? 8 : DEFAULT_PERFORMANCE_PRIORITY;
    }
    if(PVP_WISHLIST_NAMES.has(key) || PVP_LOWEST_WISHLIST_NAMES.has(key)){
      return pvpPriority === 'pvp' ? 4 : pvpPriority === 'solo' ? 5.5 : 7;
    }
    if(WISHLIST_NAMECARD_NAMES.has(key)){
      return 8;
    }
    return getBaseWishlistPerformancePriority(name);
  }
  // Non-performance collectible characters should not be auto-recommended at 2+ breakthrough.
  // This rule only affects auto-build; manual picker eligibility and Pedia display remain unchanged.
  const WISHLIST_EXCLUDE_AT_TWO_BREAKTHROUGHS = new Set(
    WISHLIST_PERFORMANCE_TIERS
      .filter(tier => tier.label === '애장품 비성능')
      .flatMap(tier => tier.names.map(norm))
  );
  function shouldExcludeFromAutoWishlist(name){
    const key = norm(name);
    return (WISHLIST_EXCLUDE_AT_TWO_BREAKTHROUGHS.has(key) && getBreakthrough(name) >= 2) ||
      (wallStatus === 'O' && WISHLIST_AUTO_EXCLUDE_AT_TWO_NAMES.has(key) && getBreakthrough(name) >= 2);
  }

  function isTreasurePerformanceBelowTwo(name, breakthrough){
    const key = norm(name);
    return (WISHLIST_TREASURE_UPSIDE_NAMES.has(key) || WISHLIST_TREASURE_SOLO_UNDER_TWO_NAMES.has(key)) && breakthrough < 2;
  }

  function getCopyPrioritySortGroup(name, performancePriority, breakthrough, unowned){
    const key = norm(name);
    if(WISHLIST_UNOWNED_GENERAL_OVERRIDE_NAMES.has(key) && unowned) return 3;
    if(WISHLIST_UNOWNED_GENERAL_LAST_NAMES.has(key)){
      if(!unowned) return 16;
      return isMarkedUnowned('아니스 : 스타') ? 3 : 6;
    }
    if(WISHLIST_UNOWNED_SOLO_FIRST_NAMES.has(key)) return unowned ? 6 : 18;
    if(WISHLIST_REQUIRED_NAMES.has(key)) return 1;
    if(WISHLIST_TREASURE_REQUIRED_NAMES.has(key)) return breakthrough < 2 ? 2 : 12;
    if(WISHLIST_TREASURE_REQUIRED_UNDER_TWO_NAMES.has(key) && breakthrough < 2) return 2;
    if(WISHLIST_TREASURE_SOLO_UNDER_TWO_NAMES.has(key) && breakthrough < 2) return 5;
    if(WISHLIST_TREASURE_SOLO_NAMES.has(key)) return breakthrough < 2 ? 5 : 15;
    if(WISHLIST_GENERAL_NAMES.has(key)) return unowned ? 3 : 13;
    if(PVP_WISHLIST_NAMES.has(key) || PVP_LOWEST_WISHLIST_NAMES.has(key)){
      const rank = pvpPriority === 'pvp' ? 4 : pvpPriority === 'solo' ? 5.5 : 7;
      if(WISHLIST_TWO_BREAKTHROUGH_PVP_NAMES.has(key)) return breakthrough < 2 ? rank : rank + 10;
      return unowned ? rank : rank + 10;
    }
    if(SOLO_RAID_WISHLIST_NAMES.has(key)) return unowned ? 6 : 16;
    if(WISHLIST_TWO_BREAKTHROUGH_NAMECARD_NAMES.has(key)){
      if(breakthrough < 2) return key === norm('츠바이') ? 7 : 7.5;
      return 18;
    }
    if(WISHLIST_NAMECARD_NAMES.has(key)){
      return unowned ? 8 : 18;
    }
    if(WISHLIST_COLLECTION_NAMES.has(key) && copyPriority === 2) return unowned ? 10 : 20;
    return performancePriority;
  }

  // Stage 1 ("필수캐 우선") uses explicit groups rather than relying on partial comparator checks.
  // Required units are pinned first, missing first copies from ranks 2–6 come next,
  // owned treasure-performance units are targeted only until 2 breakthroughs, and
  // owned base-copy general/PVP units are sent near the end.
  function getWishlistAutoBuildPriority(name, stage, breakthrough, unowned){
    const key = norm(name);
    if(WISHLIST_UNOWNED_REQUIRED_OVERRIDE_NAMES.has(key) && unowned) return 1;
    if(WISHLIST_UNOWNED_GENERAL_OVERRIDE_NAMES.has(key) && unowned) return 3;
    if(WISHLIST_UNOWNED_GENERAL_LAST_NAMES.has(key)){
      if(!unowned) return 16;
      return isMarkedUnowned('아니스 : 스타') ? 3 : 6;
    }
    if(WISHLIST_UNOWNED_SOLO_FIRST_NAMES.has(key)) return unowned ? 6 : 18;
    if(WISHLIST_TREASURE_SOLO_UNDER_TWO_NAMES.has(key) && breakthrough < 2) return 5;
    const isRequired = WISHLIST_REQUIRED_NAMES.has(key) || (WISHLIST_UNOWNED_REQUIRED_OVERRIDE_NAMES.has(key) && unowned);
    const isTreasureSolo = WISHLIST_TREASURE_SOLO_NAMES.has(key);
    const isTreasureRequired = WISHLIST_TREASURE_REQUIRED_NAMES.has(key);
    const isPvp = PVP_WISHLIST_NAMES.has(key) || PVP_LOWEST_WISHLIST_NAMES.has(key);
    const isSoloRaid = SOLO_RAID_WISHLIST_NAMES.has(key);
    const isNamecard = WISHLIST_NAMECARD_NAMES.has(key);
    const isGeneral = WISHLIST_GENERAL_NAMES.has(key);
    const isCollection = WISHLIST_COLLECTION_NAMES.has(key) || !WISHLIST_TRACKED_NAMES.has(key);

    // Zwei and Julia are first-copy-tier targets until they have two breakthroughs.
    // Zwei is first, then Julia; only after both reach 2★ do ordinary namecard targets advance.
    if(WISHLIST_TWO_BREAKTHROUGH_NAMECARD_NAMES.has(key)){
      if(breakthrough < 2) return key === norm('츠바이') ? 7 : 7.5;
      return 18;
    }

    // 프리바티는 2돌 미만이면 애장품 필수로 편성한다.
    if(WISHLIST_TREASURE_REQUIRED_UNDER_TWO_NAMES.has(key) && breakthrough < 2){
      return stage === 0 ? 1 : 2;
    }

    // Rank 1: required characters; owned copies are skipped in stages 2–3 by the candidate filter.
    if(isRequired) return stage === 0 || unowned ? 1 : Number.POSITIVE_INFINITY;

    // Treasure-required characters are pinned with required characters in step 1.
    // In steps 2 and 3, 2★+ copies are retained but pushed back like other already-owned characters.
    if(isTreasureRequired) return stage === 0 ? 1 : (breakthrough < 2 ? 2 : 12);
    if(isTreasureSolo) return breakthrough < 2 ? 5 : 15;

    // Rank 3: general-purpose characters.
    if(isGeneral) return unowned ? 3 : 13;

    // PVP characters move to 4 / 5.5 / 7. Laplace holds its PVP position until 2★.
    if(isPvp){
      const rank = pvpPriority === 'pvp' ? 4 : pvpPriority === 'solo' ? 5.5 : 7;
      if(WISHLIST_TWO_BREAKTHROUGH_PVP_NAMES.has(key)) return breakthrough < 2 ? rank : rank + 10;
      return unowned ? rank : rank + 10;
    }

    // Rank 6: Solo Raid; rank 8: ordinary namecard recommendations.
    if(isSoloRaid) return unowned ? 6 : 16;
    if(isNamecard) return unowned ? 8 : 18;

    // Rank 10: collection-only characters, included only in collection mode.
    if(isCollection && stage === 2) return unowned ? 10 : 20;
    if(stage === 2 && unowned) return 10;
    if(stage === 2) return 20;
    return Number.POSITIVE_INFINITY;
  }

  function normalizePicksToEligibleSSR(source){
    const cleaned = clonePicks(source);
    let changed = false;
    COMPANIES.forEach(company => {
      cleaned[company] = cleaned[company].map(name => {
        if(name && !isEligibleWishlistName(name, company)){
          changed = true;
          return '';
        }
        return name;
      });
    });
    return {picks:cleaned, changed};
  }

  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[ch]);

  const CLUE_LISTS = [
    {title:'리스트 1', names:['밀크','엠마','루드밀라','메어리']},
    {title:'리스트 2', names:['페퍼','프림','엑시아','미란다']},
    {title:'리스트 3', names:['리타','볼륨','노이즈','얀','아비스타']},
    {title:'리스트 4', names:['노아','폴크방','은화','아리아','차임']},
    {title:'리스트 5', names:['폴리','루피','시그널','디젤','킬로']},
    {title:'리스트 6', names:['센티','애드미','유니','라이','스노우 화이트 : 이노센트 데이즈']},
    {title:'리스트 7', names:['프리바티','크로우','솔린','브리드','라푼젤 : 퓨어 그레이스']},
    {title:'리스트 8', names:['드레이크','슈가','율리아','에피넬','모리']},
    {title:'리스트 9', names:['율하','맥스웰','메이든','베스티','길로틴']},
    {title:'애장품 시즌6', names:['팬텀','센티','플로라','로산나','슈가']}
  ];

  // The displayed "실마 리스트" is also the authoritative silver-mileage priority set for 160-wall X.
  const SILVER_MILEAGE_NAMES = new Set(CLUE_LISTS.flatMap(list => list.names.map(norm)));

  function openClueListModal(){
    const existing = document.getElementById('wlClueModal');
    if(existing) return;
    const renderClueList = list =>
      '<section class="wl-clue-modal-column"><h2>' + esc(list.title) + '</h2><ol>' +
      list.names.map(name => {
        const image = findImage(name);
        const photo = image
          ? '<img src="' + esc(image) + '" alt="' + esc(name) + '" loading="lazy" draggable="false">'
          : '<span class="wl-clue-nikke-placeholder">' + esc(name.slice(0,1)) + '</span>';
        return '<li><div class="wl-clue-nikke-row"><span class="wl-clue-nikke-photo" data-wl-clue-photo="' + esc(name) + '">' + photo + '</span><span class="wl-clue-nikke-name">' + esc(name) + '</span></div></li>';
      }).join('') +
      '</ol></section>';
    const columns = CLUE_LISTS.filter(list => list.title !== '애장품 시즌6').map(renderClueList).join('');
    const seasonColumn = CLUE_LISTS.filter(list => list.title === '애장품 시즌6').map(renderClueList).join('');
    const overlay = document.createElement('div');
    overlay.id = 'wlClueModal';
    overlay.className = 'wl-clue-modal-backdrop';
    overlay.innerHTML =
      '<style>' +
      '#wlClueModal{position:fixed;inset:0;z-index:15000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:rgba(13,22,37,.44);backdrop-filter:blur(2px)}' +
      '#wlClueModal *{box-sizing:border-box}' +
      '#wlClueModal .wl-clue-modal-dialog{display:flex;flex-direction:column;width:min(1320px,calc(100vw - 32px));max-height:min(590px,calc(100vh - 32px));overflow:hidden;border:1px solid #d6deeb;border-radius:13px;background:#f7f9fc;color:#28364a;box-shadow:0 14px 46px rgba(12,24,44,.25)}' +
      '#wlClueModal .wl-clue-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none;padding:12px 15px;border-bottom:1px solid #e1e7f0;background:#fff}' +
      '#wlClueModal .wl-clue-modal-title{margin:0;font-size:20px;line-height:1.2;font-weight:900;letter-spacing:-.02em}' +
      '#wlClueModal .wl-clue-modal-note{margin-top:5px;color:#d52232;font-size:14px;font-weight:1000;line-height:1.4}' +
      '#wlClueModal .wl-clue-modal-close{flex:none;padding:6px 10px;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;color:#475569;font-size:12px;font-weight:900;cursor:pointer}' +
      '#wlClueModal .wl-clue-modal-close:hover{background:#eaf1f8;border-color:#aab9cd}' +
      '#wlClueModal .wl-clue-modal-scroll{overflow:auto;overscroll-behavior:contain;padding:10px}' +
      '#wlClueModal .wl-clue-modal-grid{display:grid;grid-template-columns:repeat(9,minmax(82px,1fr));gap:7px;min-width:794px;align-items:start}' +
      '#wlClueModal .wl-clue-modal-season-row{margin-top:10px}' +
      '#wlClueModal .wl-clue-modal-season-row .wl-clue-modal-column{min-height:0}' +
      '#wlClueModal .wl-clue-modal-season-row .wl-clue-modal-column ol{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:0;padding-left:17px}' +
      '#wlClueModal .wl-clue-modal-column{min-height:150px;padding:9px 8px 10px;border:1px solid #dce4ef;border-radius:8px;background:#fff}' +
      '#wlClueModal .wl-clue-modal-column h2{margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid #dce5f0;color:#24658e;font-size:9px;font-weight:900;text-align:center}' +
      '#wlClueModal .wl-clue-modal-column ol{margin:0;padding-left:17px;color:#344256;font-size:8px;font-weight:750;line-height:1.55}' +
      '#wlClueModal .wl-clue-modal-column li{padding-left:1px;margin:0 0 5px;overflow-wrap:anywhere}' +
      '#wlClueModal .wl-clue-nikke-row{display:flex;align-items:center;gap:5px;min-width:0}' +
      '#wlClueModal .wl-clue-nikke-photo{display:flex;align-items:center;justify-content:center;flex:0 0 30px;width:30px;height:30px;overflow:hidden;border-radius:5px;background:#e4ebf4}' +
      '#wlClueModal .wl-clue-nikke-photo img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}' +
      '#wlClueModal .wl-clue-nikke-placeholder{display:grid;place-items:center;width:100%;height:100%;color:#66788e;font-size:10px;font-weight:900}' +
      '#wlClueModal .wl-clue-nikke-name{min-width:0;overflow-wrap:anywhere;font-size:7px;line-height:1.25}' +
      'html.dark-theme #wlClueModal .wl-clue-modal-dialog{border-color:#354761;background:#121d2d;color:#e7eefb}' +
      'html.dark-theme #wlClueModal .wl-clue-modal-head{border-color:#354761;background:#1b2a40}' +
      'html.dark-theme #wlClueModal .wl-clue-modal-note{color:#9aacc4}' +
      'html.dark-theme #wlClueModal .wl-clue-modal-close{border-color:#425773;background:#26364d;color:#e7eefb}' +
      'html.dark-theme #wlClueModal .wl-clue-modal-close:hover{background:#314761}' +
      'html.dark-theme #wlClueModal .wl-clue-modal-column{border-color:#354761;background:#182438}' +
      'html.dark-theme #wlClueModal .wl-clue-modal-column h2{border-color:#354761;color:#9fd2ff}' +
      'html.dark-theme #wlClueModal .wl-clue-modal-column ol{color:#e0e9f7}' +
      '@media(max-width:560px){#wlClueModal{padding:8px}#wlClueModal .wl-clue-modal-dialog{width:calc(100vw - 16px);max-height:calc(100vh - 16px)}#wlClueModal .wl-clue-modal-head{padding:10px}#wlClueModal .wl-clue-modal-title{font-size:18px}#wlClueModal .wl-clue-modal-scroll{padding:8px}}' +
      '</style>' +
      '<section class="wl-clue-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="wlClueModalTitle">' +
        '<header class="wl-clue-modal-head"><div><h2 class="wl-clue-modal-title" id="wlClueModalTitle">실마 상점 스페어바디 목록</h2>' +
        '<div class="wl-clue-modal-note">실마 상점으로 획득하는건 명함이 아닌 스페어바디(돌파재료)니까 주의!</div></div>' +
        '<button type="button" class="wl-clue-modal-close" data-wl-clue-close>닫기 ×</button></header>' +
        '<div class="wl-clue-modal-scroll"><div class="wl-clue-modal-grid">' + columns + '</div>' +
        '<div class="wl-clue-modal-season-row">' + seasonColumn + '</div></div>' +
      '</section>';
    document.body.appendChild(overlay);
    loadImageMap().then(() => {
      if(!overlay.isConnected) return;
      overlay.querySelectorAll('[data-wl-clue-photo]').forEach(photoNode => {
        const name = photoNode.getAttribute('data-wl-clue-photo') || '';
        const image = findImage(name);
        photoNode.innerHTML = image
          ? '<img src="' + esc(image) + '" alt="' + esc(name) + '" loading="lazy" draggable="false">'
          : '<span class="wl-clue-nikke-placeholder">' + esc(name.slice(0,1)) + '</span>';
      });
    });
    const closeButton = overlay.querySelector('[data-wl-clue-close]');
    const closeModal = () => {
      document.removeEventListener('keydown', onKeydown);
      overlay.remove();
    };
    const onKeydown = event => {
      if(event.key === 'Escape') closeModal();
    };
    overlay.addEventListener('click', event => {
      if(event.target === overlay || (event.target.closest && event.target.closest('[data-wl-clue-close]'))){
        closeModal();
      }
    });
    document.addEventListener('keydown', onKeydown);
    if(closeButton) closeButton.focus();
  }
  const blankWishlist = () => Object.fromEntries(COMPANIES.map(company => [
    company, Array(5).fill('')
  ]));
  const clonePicks = source => Object.fromEntries(COMPANIES.map(company => [
    company, Array.from({length:5}, (_,i) =>
      source && Array.isArray(source[company]) && typeof source[company][i] === 'string'
        ? source[company][i] : ''
    )
  ]));

  let picks = loadPicks();
  let savedPicks = clonePicks(picks);
  let excludedCharacters = loadExcludedCharacters();
  let savedExcludedCharacters = excludedCharacters.slice();
  let favoriteCharacters = loadFavoriteCharacters();
  let savedFavoriteCharacters = favoriteCharacters.slice();
  let imageMap = new Map();
  let imageLoadPromise = null;
  let panel = null;
  let pickerCompany = null;
  let pickerSlot = null;
  let hoverCard = null;
  let hoverCardAnchor = null;

  function activePicksStorageKey(){
    try{
      if(typeof activeAccount !== 'undefined' && String(activeAccount || '').trim()){
        return STORAGE_KEY + '_' + encodeURIComponent(String(activeAccount).trim());
      }
    }catch(_){}
    return STORAGE_KEY;
  }

  function activeExcludedStorageKey(){
    try{
      if(typeof activeAccount !== 'undefined' && String(activeAccount || '').trim()){
        return EXCLUDED_STORAGE_KEY + '_' + encodeURIComponent(String(activeAccount).trim());
      }
    }catch(_){}
    return EXCLUDED_STORAGE_KEY;
  }

  function activeFavoriteStorageKey(){
    try{
      if(typeof activeAccount !== 'undefined' && String(activeAccount || '').trim()){
        return FAVORITE_STORAGE_KEY + '_' + encodeURIComponent(String(activeAccount).trim());
      }
    }catch(_){}
    return FAVORITE_STORAGE_KEY;
  }

  function loadFavoriteCharacters(){
    try{
      const raw = JSON.parse(localStorage.getItem(activeFavoriteStorageKey()) || '[]');
      const source = Array.isArray(raw) ? raw : [];
      const seen = new Set();
      return source.map(name => String(name || '').trim()).filter(name => {
        const key = norm(name);
        if(!name || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }catch(_){
      return [];
    }
  }

  function activeExcludedHelmMigratedKey(){
    try{
      if(typeof activeAccount !== 'undefined' && String(activeAccount || '').trim()){
        return EXCLUDED_HELM_MIGRATED_KEY + '_' + encodeURIComponent(String(activeAccount).trim());
      }
    }catch(_){}
    return EXCLUDED_HELM_MIGRATED_KEY;
  }

  function loadExcludedCharacters(){
    try{
      const storageKey = activeExcludedStorageKey();
      const raw = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const source = Array.isArray(raw) ? raw : [];
      const seen = new Set();
      let names = source.map(name => String(name || '').trim()).filter(name => {
        const key = norm(name);
        if(!name || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      // Remove Helm if it was added by the earlier always-excluded default.
      // Run this migration only once so users can still manually exclude Helm afterwards.
      const migratedKey = activeExcludedHelmMigratedKey();
      if(localStorage.getItem(migratedKey) !== '1'){
        names = names.filter(name => norm(name) !== norm('헬름'));
        localStorage.setItem(storageKey, JSON.stringify(names));
        localStorage.setItem(migratedKey, '1');
      }
      return names;
    }catch(_){
      return [];
    }
  }

  function getAutomaticExclusionReason(name){
    if(getCoreEnhancement(name) >= 7){
      return '코어 강화 7 자동 제외';
    }
    if(wallStatus === 'O' && WISHLIST_AUTO_EXCLUDE_AT_TWO_NAMES.has(norm(name)) && getBreakthrough(name) >= 2){
      return '미란다 2돌파 이상 자동 제외';
    }
    return '';
  }

  function isManuallyExcludedCharacter(name){
    const key = norm(name);
    return !!key && excludedCharacters.some(value => norm(value) === key);
  }

  function isExcludedCharacter(name){
    return isManuallyExcludedCharacter(name) || !!getAutomaticExclusionReason(name);
  }

  function isFavoriteCharacter(name){
    const key = norm(name);
    return !!key && favoriteCharacters.some(value => norm(value) === key);
  }

  function getCharacterStatus(name){
    if(isManuallyExcludedCharacter(name)) return 'excluded';
    if(isFavoriteCharacter(name)) return 'favorite';
    return 'normal';
  }

  // Cycle: normal -> excluded -> favourite -> normal.
  function cycleCharacterStatus(name){
    const canonical = String(name || '').trim();
    if(!canonical) return;
    const current = getCharacterStatus(canonical);
    const key = norm(canonical);
    excludedCharacters = excludedCharacters.filter(value => norm(value) !== key);
    favoriteCharacters = favoriteCharacters.filter(value => norm(value) !== key);
    if(current === 'normal') excludedCharacters.push(canonical);
    else if(current === 'excluded') favoriteCharacters.push(canonical);
  }

  const WALL_STATUS_KEY = 'nikke_wishlist_160_wall_v1';
  const CHARACTER_NAMES_VISIBLE_KEY = 'nikke_wishlist_character_names_visible_v1';
  const COPY_PRIORITY_KEY = 'nikke_wishlist_copy_priority_v3';
  const PREVIOUS_COPY_PRIORITY_KEY = 'nikke_wishlist_copy_priority_v2';
  const LEGACY_COPY_PRIORITY_KEY = 'nikke_wishlist_copy_priority_v1';

  function activeWallStatusKey(){
    try{
      if(typeof activeAccount !== 'undefined' && String(activeAccount || '').trim()){
        return WALL_STATUS_KEY + '_' + encodeURIComponent(String(activeAccount).trim());
      }
    }catch(_){}
    return WALL_STATUS_KEY;
  }

  function loadWallStatus(){
    try{ return localStorage.getItem(activeWallStatusKey()) === 'O' ? 'O' : 'X'; }
    catch(_){ return 'X'; }
  }

  function saveWallStatus(){
    try{ localStorage.setItem(activeWallStatusKey(), wallStatus); }catch(_){}
  }

  let wallStatus = loadWallStatus();

  function loadCharacterNamesVisible(){
    try{ return localStorage.getItem(CHARACTER_NAMES_VISIBLE_KEY) === 'on'; }
    catch(_){ return false; }
  }
  function saveCharacterNamesVisible(){
    try{ localStorage.setItem(CHARACTER_NAMES_VISIBLE_KEY, characterNamesVisible ? 'on' : 'off'); }catch(_){}
  }
  let characterNamesVisible = loadCharacterNamesVisible();

  function activePvpIncludedKey(){
    try{
      if(typeof activeAccount !== 'undefined' && String(activeAccount || '').trim()){
        return PVP_INCLUDED_KEY + '_' + encodeURIComponent(String(activeAccount).trim());
      }
    }catch(_){}
    return PVP_INCLUDED_KEY;
  }
    function loadPvpPriority(){
    try{
      const saved = localStorage.getItem(activePvpIncludedKey());
      // Migrate the old O/X control: O -> PVP 우선, X -> 솔레 우선.
      if(saved === 'pvp' || saved === 'solo' || saved === 'exclude') return saved;
      if(saved === 'O') return 'pvp';
      if(saved === 'X') return 'solo';
      return 'solo'; // preserve the former X/default behavior
    }catch(_){ return 'solo'; }
  }
  function savePvpPriority(){
    try{ localStorage.setItem(activePvpIncludedKey(), pvpPriority); }catch(_){}
  }
  let pvpPriority = loadPvpPriority();

  function activeCopyPriorityKey(baseKey = COPY_PRIORITY_KEY){
    try{
      if(typeof activeAccount !== 'undefined' && String(activeAccount || '').trim()){
        return baseKey + '_' + encodeURIComponent(String(activeAccount).trim());
      }
    }catch(_){}
    return baseKey;
  }

  function loadCopyPriority(){
    try{
      const saved = localStorage.getItem(activeCopyPriorityKey());
      if(saved !== null){
        const value = Number(saved);
        return Number.isInteger(value) && value >= 0 && value <= 2 ? value : 0;
      }

      // Migrate the previous four-step slider after removing its second step:
      // old 0/1 -> new 0, old 2 -> new 1, old 3 -> new 2.
      const previous = localStorage.getItem(activeCopyPriorityKey(PREVIOUS_COPY_PRIORITY_KEY));
      if(previous !== null){
        const previousValue = Number(previous);
        const migrated = previousValue === 2 ? 1 : previousValue === 3 ? 2 : 0;
        localStorage.setItem(activeCopyPriorityKey(), String(migrated));
        return migrated;
      }

      // Compatibility with the older three-step setting.
      const legacy = localStorage.getItem(activeCopyPriorityKey(LEGACY_COPY_PRIORITY_KEY));
      if(legacy !== null){
        const legacyValue = Number(legacy);
        const migrated = legacyValue === 2 ? 2 : legacyValue === 1 ? 1 : 0;
        localStorage.setItem(activeCopyPriorityKey(), String(migrated));
        return migrated;
      }
      return 0;
    }catch(_){ return 0; }
  }

  function saveCopyPriority(){
    try{ localStorage.setItem(activeCopyPriorityKey(), String(copyPriority)); }catch(_){}
  }

  const COPY_PRIORITY_LABELS = ['성능캐 돌파우선','균형','도감작 우선'];
  const PVP_PRIORITY_DESCRIPTIONS = {
    pvp: '일반적으로 추천하는 설정입니다',
    solo: 'PVP캐릭터보다 솔레 캐릭터를\n우선으로 추천합니다.\n아레나를 포기한 유저가\n아니라면 추천하지 않습니다.',
    exclude: 'PVP 캐릭터를 후순위로 설정합니다.\n묵은지 계정 등 PVP 자체가 불가능한\n상황이 아니라면 추천하지 않습니다.'
  };
  function getCopyPriorityDescription(){
    if(wallStatus === 'X'){
      if(copyPriority === 0) return '';
      if(copyPriority === 1) return '과금 유저 추천\n단순 돌파보다는 어느 정도 성능이 보장된\n캐릭터의 명함 획득을 우선으로 합니다.';
      return '일반적으로 추천되는\n160벽 돌파 위시리스트입니다.';
    }
    if(copyPriority === 0) return '성능캐로 취급받는 캐릭터의\n돌파를 우선으로 합니다.';
    if(copyPriority === 1) return '현재 쓰이지 않는 캐릭은 제외\n돌파보다는 명함 취득을 우선합니다.\n애장품 떡상 가능성은 고려하지 않습니다.';
    return '캐릭터의 사용 여부와 상관없이\n명함 획득을 최우선으로 합니다.';
  }
  let copyPriority = loadCopyPriority();

  function loadPicks(){
    const output = blankWishlist();
    try{
      const key = activePicksStorageKey();
      let raw = localStorage.getItem(key);
      // Migrate the old shared wishlist to the first account only; other accounts start separately.
      if(raw === null && key !== STORAGE_KEY){
        let isFirstAccount = false;
        try{ isFirstAccount = Array.isArray(ACCOUNTS) && String(activeAccount) === String(ACCOUNTS[0]); }catch(_){}
        if(isFirstAccount) raw = localStorage.getItem(STORAGE_KEY);
      }
      const saved = JSON.parse(raw || 'null');
      if(saved && typeof saved === 'object'){
        COMPANIES.forEach(company => {
          const list = Array.isArray(saved[company]) ? saved[company] : [];
          output[company] = Array.from({length:5},(_,i) =>
            typeof list[i] === 'string' ? list[i] : ''
          );
        });
      }
    }catch(_){}
    return output;
  }

  function savePicks(){
    try{
      localStorage.setItem(activePicksStorageKey(), JSON.stringify(picks));
      localStorage.setItem(activeExcludedStorageKey(), JSON.stringify(excludedCharacters));
      localStorage.setItem(activeFavoriteStorageKey(), JSON.stringify(favoriteCharacters));
      savedPicks = clonePicks(picks);
      savedExcludedCharacters = excludedCharacters.slice();
      savedFavoriteCharacters = favoriteCharacters.slice();
      return true;
    }catch(_){
      return false;
    }
  }

  function getAllCharacters(){
    try{
      const list = Array.isArray(window.__NIKKE_RAW) ? window.__NIKKE_RAW : [];
      // Treat the four Over-Spec units as Pilgrim for wishlist assignment without mutating the site's raw data.
      const classified = list.map(row => {
        if(!row || typeof row !== 'object') return row;
        const name = String(row['이름'] || '').trim();
        return isOverspecWishlistName(name) ? {...row, '기업':'필그림'} : row;
      });
      const seen = new Set();
      return classified.filter(row => {
        const name = String(row && row['이름'] || '').trim();
        const company = String(row && row['기업'] || '').trim();
        const key = norm(name);
        if(!name || !COMPANIES.includes(company) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }catch(_){
      return [];
    }
  }

  function getCharactersForCompany(company){
    return getAllCharacters()
      .filter(row => String(row['기업'] || '').trim() === company && isEligibleWishlistName(row['이름'], company))
      .sort((a,b) => compareWishlistPickerOrderForCompany(a,b,company));
  }

  function findAccountRow(name){
    try{
      if(typeof data !== 'undefined' && Array.isArray(data)){
        const key = norm(name);
        const row = data.find(item => norm(item && item['이름']) === key);
        if(row) return row;
      }
    }catch(_){}
    return getAllCharacters().find(row => norm(row['이름']) === norm(name)) || null;
  }

  function hasOwnershipEvidence(row){
    if(!row || typeof row !== 'object') return false;
    // A stale "unowned" marker must not override clear ownership data already saved for this account.
    for(const key of ['돌파','전투력','협투력','호감도','코강','스킬1','스킬2','버스트스킬']){
      const value = Number(String(row[key] == null ? '' : row[key]).replace(/,/g,''));
      if(Number.isFinite(value) && value > 0) return true;
    }
    for(const part of ['머리','몸통','장갑','다리']){
      for(const suffix of ['_티어','_레벨','_옵1값','_옵2값','_옵3값']){
        const value = Number(String(row[part + suffix] == null ? '' : row[part + suffix]).replace(/,/g,''));
        if(Number.isFinite(value) && value > 0) return true;
      }
      const companyGear = row[part + '_기업장비'];
      if(companyGear === true || (typeof companyGear === 'string' && companyGear.trim() && !['false','0','nan','null','undefined'].includes(companyGear.trim().toLowerCase()))) return true;
    }
    for(const key of ['소장품','큐브']){
      const value = String(row[key] == null ? '' : row[key]).trim().toLowerCase();
      if(value && !['nan','null','undefined','none','false','0'].includes(value)) return true;
    }
    return false;
  }

  let syncedOwnedRosterAccount = null;
  let syncedOwnedRoster = null;
  function refreshSyncedOwnedRoster(force=false){
    const account = (typeof activeAccount !== 'undefined' && activeAccount != null)
      ? String(activeAccount).trim()
      : '';
    if(!force && account === syncedOwnedRosterAccount) return syncedOwnedRoster;
    syncedOwnedRosterAccount = account;
    syncedOwnedRoster = null;
    if(!account) return syncedOwnedRoster;
    // The account-specific synced roster is the source of truth. Read it first so
    // stale/manual/test flags on data rows can never override the profile synced to this account.
    try{
      const key = SYNCED_OWNED_STORAGE_PREFIX + encodeURIComponent(account);
      const raw = localStorage.getItem(key);
      if(raw !== null){
        const saved = JSON.parse(raw);
        if(Array.isArray(saved)){
          syncedOwnedRoster = new Set(saved.map(norm).filter(Boolean));
          return syncedOwnedRoster;
        }
      }
    }catch(_){}
    // Backward compatibility for an older synced account whose roster key was not saved,
    // but whose account rows already contain the explicit sync marker.
    try{
      const accountRows = (typeof data !== 'undefined' && Array.isArray(data)) ? data : [];
      const hasSyncedFlags = accountRows.some(row => row && typeof row.__nikkeSyncedOwned === 'boolean');
      if(hasSyncedFlags){
        syncedOwnedRoster = new Set(
          accountRows
            .filter(row => row && row.__nikkeSyncedOwned === true)
            .map(row => norm(row['이름']))
            .filter(Boolean)
        );
      }
    }catch(_){}
    return syncedOwnedRoster;
  }

  function isMarkedUnowned(name){
    // Once an account has a synced roster, use it as the ownership source of truth.
    // This prevents local RAW/legacy progress values from making unowned characters look owned.
    try{
      const syncedRoster = refreshSyncedOwnedRoster();
      if(syncedRoster) return !syncedRoster.has(norm(name));
    }catch(_){}
    try{
      if(typeof unownedCharacters !== 'undefined' && unownedCharacters){
        if(typeof unownedCharacters.has === 'function' && unownedCharacters.has(name)) return true;
        for(const savedName of unownedCharacters){
          if(norm(savedName) === norm(name)) return true;
        }
      }
    }catch(_){}
    // No synced roster for this account means ownership is unknown.
    // Never treat the site's embedded RAW snapshot as this user's roster on a new device.
    return true;
  }

  function getBreakthrough(name){
    // Breakthrough values from embedded/default data are not valid account state until synced.
    if(!refreshSyncedOwnedRoster()) return 0;
    const row = findAccountRow(name);
    if(!row) return 0;
    const raw = row['돌파'];
    const value = Number(raw);
    if(Number.isFinite(value)) return Math.max(0,Math.min(3,Math.floor(value)));
    const match = String(raw == null ? '' : raw).match(/\d+/);
    return match ? Math.max(0,Math.min(3,Number(match[0]))) : 0;
  }

  function getCoreEnhancement(name){
    // Likewise, don't display embedded/default core enhancement values before this account is synced.
    if(!refreshSyncedOwnedRoster()) return 0;
    const row = findAccountRow(name);
    if(!row) return 0;
    const raw = row['코강'];
    const value = Number(raw);
    if(Number.isFinite(value)) return Math.max(0,Math.min(7,Math.floor(value)));
    const match = String(raw == null ? '' : raw).match(/\d+/);
    return match ? Math.max(0,Math.min(7,Number(match[0]))) : 0;
  }

  function findImage(name){
    try{
      if(typeof NIKKE_PEDIA_IMAGES !== 'undefined' && NIKKE_PEDIA_IMAGES){
        const map = NIKKE_PEDIA_IMAGES;
        const direct = map[name] || map['#' + norm(name)];
        if(direct) return String(direct);
      }
    }catch(_){}
    return imageMap.get(norm(name)) || '';
  }

  async function loadImageMap(){
    if(imageLoadPromise) return imageLoadPromise;
    imageLoadPromise = (async function(){
      try{
        const response = await fetch(IMAGE_URL, {cache:'no-store'});
        if(!response.ok) throw new Error('이미지 목록 조회 실패');
        const rows = await response.json();
        if(Array.isArray(rows)){
          rows.forEach(row => {
            const name = String(row && row.name || '').trim();
            const image = String(row && row.image || '').trim();
            if(name && /^https?:\/\//i.test(image)) imageMap.set(norm(name), image);
          });
        }
      }catch(_){}
      return imageMap;
    })();
    return imageLoadPromise;
  }

  function injectStyle(){
    if(document.getElementById('wishlist-recommender-style')) return;
    const style = document.createElement('style');
    style.id = 'wishlist-recommender-style';
    style.textContent = [
      'body.wishlist-view #characterPanel,body.wishlist-view #kpis,body.wishlist-view #outpostPanel,body.wishlist-view #soleScorePanel,body.wishlist-view #pediaPanel{display:none!important}',
      'body.wishlist-view .topbar{display:none!important}',
      '#wishlistAccountSwitcher[hidden]{display:none!important}',
      '#wishlistAccountSwitcher{display:flex;align-items:center;justify-content:flex-end;gap:6px;box-sizing:border-box;width:calc(100% - 24px);max-width:462px;margin:8px auto 8px;padding:0 2px;position:relative;z-index:20}',
      '#wishlistAccountSwitcher .wl-account-label{margin-right:3px;color:#7c8795;font-size:10px;font-weight:900;white-space:nowrap}',
      '#wishlistAccountSwitcher .wl-account-button{min-width:58px;max-width:128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:6px 11px;border:1px solid #c9d6e4;border-radius:999px;background:#fff;color:#586577;font-size:11px;font-weight:900;cursor:pointer;box-shadow:0 1px 3px rgba(27,55,85,.07)}',
      '#wishlistAccountSwitcher .wl-account-button.active{border-color:#159ed3;background:#eaf8ff;color:#087ca9;box-shadow:0 0 0 1px rgba(21,158,211,.10)}',
      '#wishlistAccountSwitcher .wl-account-button:hover{border-color:#52acd0;background:#f2fbff;color:#086f99}',
      '@media(max-width:520px){#wishlistAccountSwitcher{width:calc(100% - 24px);gap:4px;margin:7px auto 7px}#wishlistAccountSwitcher .wl-account-label{font-size:9px}#wishlistAccountSwitcher .wl-account-button{min-width:52px;padding:6px 8px;font-size:10px}}',
      '#wishlist160WallControl[hidden]{display:none!important}',
      '#wishlist160WallControl{position:fixed;left:calc(50% - 231px - 297px);top:142px;z-index:50;box-sizing:border-box;width:277px;padding:16px;border:1px solid #d8dee8;border-radius:13px;background:#fff;color:#344054;box-shadow:0 6px 21px rgba(27,48,75,.10);font-family:inherit}',
      '#wishlist160WallControl .wl-name-view-title{margin:0 0 9px;font-size:15px;font-weight:1000;line-height:1.35;text-align:center;color:#38465a}',
      '#wishlist160WallControl .wl-name-view-options{display:grid;grid-template-columns:1fr 1fr;gap:9px}',
      '#wishlist160WallControl .wl-name-view-button{height:38px;border:1px solid #d3dbe7;border-radius:8px;background:#f7f9fc;color:#69778b;font-size:14px;font-weight:1000;cursor:pointer;transition:background .12s,border-color .12s,color .12s}',
      '#wishlist160WallControl .wl-name-view-button.active{border-color:#5296ce;background:#e9f5ff;color:#17679c;box-shadow:inset 0 0 0 1px rgba(82,150,206,.14)}',
      '#wishlist160WallControl .wl-name-view-divider{margin:13px 1px 13px}',
      '#wishlist160WallControl .wl-160-title{margin:0 0 12px;font-size:15px;font-weight:1000;line-height:1.35;text-align:center;color:#38465a}',
      '#wishlist160WallControl .wl-160-options{display:grid;grid-template-columns:1fr 1fr;gap:9px}',
      '#wishlist160WallControl .wl-160-button{height:44px;border:1px solid #d3dbe7;border-radius:8px;background:#f7f9fc;color:#69778b;font-size:17px;font-weight:1000;cursor:pointer;transition:background .12s,border-color .12s,color .12s}',
      '#wishlist160WallControl .wl-160-button[data-wl-160-wall="O"].active{border-color:#239b76;background:#e5f7ef;color:#16724f;box-shadow:inset 0 0 0 1px rgba(35,155,118,.14)}',
      '#wishlist160WallControl .wl-160-button[data-wl-160-wall="X"].active{border-color:#8a96a8;background:#e8edf4;color:#344054;box-shadow:inset 0 0 0 1px rgba(90,106,128,.12)}',
      '#wishlist160WallControl .wl-160-note{margin-top:10px;color:#78869a;font-size:11.5px;line-height:1.4;text-align:center}',
      '#wishlist160WallControl .wl-copy-priority-divider{height:1px;margin:16px 1px 13px;background:#e3e8ef}',
      '#wishlist160WallControl .wl-copy-priority-heading{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:10px;color:#38465a;font-size:14px;font-weight:1000}',
      '#wishlist160WallControl .wl-copy-priority-value{padding:4px 8px;border:1px solid #cbd8e8;border-radius:999px;background:#edf4fc;color:#3e6797;font-size:11.5px;font-weight:900;white-space:nowrap}',
      '#wishlist160WallControl .wl-priority-slider-wrap{position:relative;width:100%;height:26px;margin:7px 0 0}',
      '#wishlist160WallControl .wl-copy-priority-slider{position:absolute;left:calc(16.6667% - 10.333px);right:auto;top:3px;z-index:2;display:block;width:calc(66.6667% + 20.667px);height:23px;margin:0;accent-color:#668fda;cursor:pointer;-webkit-appearance:none;appearance:none;background:transparent}',
      '#wishlist160WallControl .wl-priority-slider-segments{position:absolute;left:0;right:0;top:8px;z-index:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;height:12px;pointer-events:none}',
      '#wishlist160WallControl .wl-priority-slider-segments span{display:block;min-width:0;box-sizing:border-box;border:1px solid #aebfd2;border-radius:5px;background:linear-gradient(180deg,#f8fbff,#e1ebf6);box-shadow:inset 0 1px 0 rgba(255,255,255,.85);transition:background .12s,border-color .12s,box-shadow .12s}',
      '#wishlist160WallControl .wl-priority-slider-segments span.is-active{border-color:#347fba;background:linear-gradient(180deg,#c7e8ff,#8bc8f0);box-shadow:inset 0 0 0 1px rgba(255,255,255,.5),0 0 0 1px rgba(52,127,186,.12)}',
      '#wishlist160WallControl .wl-copy-slider-wrap.is-red-warning .wl-priority-slider-segments span.is-active{border-color:#d92d37;background:linear-gradient(180deg,#ffe0e2,#f3a0a7);box-shadow:inset 0 0 0 1px rgba(255,255,255,.45),0 0 0 1px rgba(217,45,55,.15)}',
      '#wishlist160WallControl .wl-copy-slider-wrap.is-red-warning .wl-copy-priority-slider::-webkit-slider-thumb{background:#d92d37}',
      '#wishlist160WallControl .wl-copy-slider-wrap.is-red-warning .wl-copy-priority-slider::-moz-range-thumb{background:#d92d37}',
      '#wishlist160WallControl .wl-copy-priority-slider::-webkit-slider-runnable-track{height:12px;border:0;background:transparent}',
      '#wishlist160WallControl .wl-copy-priority-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;margin-top:-3px;border:2px solid #fff;border-radius:50%;background:#4a8fc7;box-shadow:0 1px 4px rgba(28,66,102,.38);cursor:grab}',
      '#wishlist160WallControl .wl-copy-priority-slider:active::-webkit-slider-thumb{cursor:grabbing}',
      '#wishlist160WallControl .wl-copy-priority-slider::-moz-range-track{height:12px;border:0;background:transparent}',
      '#wishlist160WallControl .wl-copy-priority-slider::-moz-range-thumb{width:14px;height:14px;border:2px solid #fff;border-radius:50%;background:#4a8fc7;box-shadow:0 1px 4px rgba(28,66,102,.38);cursor:grab}',
      '#wishlist160WallControl .wl-copy-priority-slider:active::-moz-range-thumb{cursor:grabbing}',
      '#wishlist160WallControl .wl-priority-star{position:absolute;top:14.5px;z-index:6;display:flex;align-items:center;justify-content:center;width:22px;height:22px;box-sizing:border-box;border:1px solid #e5bb50;border-radius:50%;background:linear-gradient(180deg,#fffdf3,#ffefb9);color:#bd8611;font-family:Arial,sans-serif;font-size:12px;font-weight:900;line-height:1;transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 1px 3px rgba(90,65,18,.18)}',
      '#wishlist160WallControl .wl-priority-star:after{display:none!important;pointer-events:none}',
'#wishlist160WallControl .wl-priority-prohibit[hidden],#wishlist160WallControl .wl-copy-priority-warning[hidden],#wishlist160WallControl .wl-priority-info[hidden]{display:none!important}',
'#wishlist160WallControl .wl-priority-prohibit{position:absolute;left:calc(16.6667% - 1.333px);top:14.5px;z-index:5;display:flex;align-items:center;justify-content:center;width:18px;height:18px;box-sizing:border-box;border:2px solid #d92d37;border-radius:50%;background:linear-gradient(45deg,#fff 43%,#d92d37 44%,#d92d37 56%,#fff 57%);transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 1px 3px rgba(90,20,20,.2)}',
'#wishlist160WallControl .wl-copy-priority-warning{margin-top:6px;padding:7px 8px;border:1px solid #f0b8bd;border-radius:7px;background:#fff0f1;color:#c52632;font-size:8.3px;font-weight:900;line-height:1.45;text-align:center;white-space:pre-line}',
       '#wishlist160WallControl .wl-priority-info{margin-top:6px;padding:7px 8px;border:1px solid #b9d7f4;border-radius:7px;background:#eff7ff;color:#245b8f;font-size:8.3px;font-weight:850;line-height:1.45;text-align:center;white-space:pre-line}',
       'html.dark-theme #wishlist160WallControl .wl-priority-info{border-color:#345c85;background:#172d47;color:#c6e3ff}',
      '#wishlist160WallControl .wl-copy-priority-ends{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:center;margin-top:4px;color:#728096;font-size:13px;font-weight:900;text-align:center}#wishlist160WallControl .wl-copy-priority-ends span:first-child{text-align:left}#wishlist160WallControl .wl-copy-priority-ends span:last-child{text-align:right}',
      '#wishlist160WallControl .wl-pvp-priority-ends{display:flex;justify-content:space-between;align-items:center;margin-top:4px;color:#728096;font-size:13px;font-weight:900}',
      '#wishlist160WallControl .wl-pvp-priority-ends span:nth-child(2){text-align:center}',
      '#wishlist160WallControl .wl-pvp-priority-ends span:last-child{text-align:right}',
       '#wishlist160WallControl .wl-pvp-priority-info{margin-top:6px;padding:7px 8px;border:1px solid #b9d7f4;border-radius:7px;background:#eff7ff;color:#245b8f;font-size:8.3px;font-weight:850;line-height:1.45;text-align:center;white-space:pre-line}',
       'html.dark-theme #wishlist160WallControl .wl-pvp-priority-info{border-color:#345c85;background:#172d47;color:#c6e3ff}',
      '#wishlist160WallControl .wl-copy-priority-note{margin-top:9px;color:#8793a6;font-size:11.5px;line-height:1.4;text-align:center}',
      '#wishlist160WallControl .wl-copy-priority-help{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;margin-left:-1px;padding:0;border:1px solid #9bb0ca;border-radius:50%;background:#edf4fc;color:#47709f;font-size:10px;font-weight:1000;line-height:1;cursor:help}',
      '#wishlist160WallControl .wl-copy-priority-help:after{content:attr(data-tooltip);position:absolute;left:calc(100% + 9px);top:50%;z-index:1002;width:250px;max-width:calc(100vw - 205px);box-sizing:border-box;padding:10px 12px;border:1px solid rgba(107,195,238,.42);border-radius:10px;background:linear-gradient(145deg,#202d43,#101827);color:#f3f7ff;font:600 11px/1.55 system-ui,sans-serif;letter-spacing:0;text-align:left;white-space:normal;box-shadow:0 10px 28px rgba(0,0,0,.3);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-50%) translateX(-3px);transition:opacity .08s ease,transform .08s ease,visibility 0s linear .08s}',
      '#wishlist160WallControl .wl-copy-priority-help:hover:after,#wishlist160WallControl .wl-copy-priority-help:focus-visible:after{opacity:1;visibility:visible;transform:translateY(-50%) translateX(0);transition-delay:0s}',
      '#wishlist160WallControl .wl-copy-priority-help:focus-visible{outline:2px solid #668fda;outline-offset:2px}',
      '@media(max-width:1000px){#wishlist160WallControl .wl-copy-priority-help:after{left:auto;right:calc(100% + 8px);max-width:calc(100vw - 56px)}}',
      'html.dark-theme #wishlist160WallControl .wl-copy-priority-help{border-color:#627b9d;background:#1a2d47;color:#a9d5ff}',
      '@media(prefers-reduced-motion:reduce){#wishlist160WallControl .wl-copy-priority-help:after{transition:none}}',
      'html.dark-theme #wishlist160WallControl .wl-copy-priority-divider{background:#354761}',
      'html.dark-theme #wishlist160WallControl .wl-copy-priority-heading{color:#edf3ff}',
      'html.dark-theme #wishlist160WallControl .wl-copy-priority-value{border-color:#354761;background:#1a2d47;color:#a9d5ff}',
      'html.dark-theme #wishlist160WallControl .wl-copy-priority-slider{accent-color:#9a89ff}',
      'html.dark-theme #wishlist160WallControl .wl-priority-slider-segments span{border-color:#52647c;background:linear-gradient(180deg,#293a52,#1c2a3e);box-shadow:inset 0 1px 0 rgba(207,225,248,.08)}',
      'html.dark-theme #wishlist160WallControl .wl-priority-slider-segments span.is-active{border-color:#8b82e9;background:linear-gradient(180deg,#59539a,#403c79);box-shadow:inset 0 0 0 1px rgba(220,218,255,.18),0 0 0 1px rgba(139,130,233,.16)}',
      'html.dark-theme #wishlist160WallControl .wl-copy-priority-slider::-webkit-slider-thumb{border-color:#e5e7ff;background:#a39af7}',
      'html.dark-theme #wishlist160WallControl .wl-copy-priority-slider::-moz-range-thumb{border-color:#e5e7ff;background:#a39af7}',
      'html.dark-theme #wishlist160WallControl .wl-copy-priority-ends{color:#a3b1c7}',
      'html.dark-theme #wishlist160WallControl .wl-copy-priority-note{color:#92a0b7}',
      'html.dark-theme #wishlist160WallControl{border-color:#354761;background:#151f31;color:#edf3ff;box-shadow:0 5px 18px rgba(0,0,0,.25)}',
      'html.dark-theme #wishlist160WallControl .wl-160-title{color:#edf3ff}',
      'html.dark-theme #wishlist160WallControl .wl-160-button{border-color:#354761;background:#0d1525;color:#adbacd}',
      'html.dark-theme #wishlist160WallControl .wl-160-button[data-wl-160-wall="O"].active{border-color:#3b9f7d;background:#173d33;color:#a5f0d0}',
      'html.dark-theme #wishlist160WallControl .wl-160-button[data-wl-160-wall="X"].active{border-color:#72819b;background:#273449;color:#e1e9f5}',
      '@media(max-width:1080px){#wishlist160WallControl{position:relative;left:auto;top:auto;width:calc(100% - 24px);max-width:600px;margin:10px auto;padding:10px 16px}#wishlist160WallControl .wl-160-title{margin-bottom:8px}#wishlist160WallControl .wl-160-note{margin-top:7px}#wishlist160WallControl .wl-copy-priority-help{width:19px;height:19px;font-size:12px}#wishlist160WallControl .wl-priority-star{width:22px;height:22px;font-size:12px}}',
      '#wishlistPanel[hidden]{display:none!important}',
      '#wishlistPanel{position:relative!important;z-index:auto;display:block!important;box-sizing:border-box!important;width:calc(100% - 24px)!important;max-width:462px!important;min-width:0!important;padding:0!important;margin:0 auto 16px!important;overflow:visible;background:transparent;color:#25282d}',
      '#wishlistPanel .wl-dialog{position:relative;display:flex;flex-direction:column;width:100%;height:auto;min-height:0;overflow:visible;border:1px solid #dedfe1;border-radius:12px;background:#f8f8f8;box-shadow:0 2px 12px rgba(0,0,0,.10)}',
      '#wishlistPanel .wl-modal-head{position:relative;z-index:30;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;min-height:31px;padding:3px 7px;overflow:visible;background:linear-gradient(135deg,#f5f5f5 0%,#eeeeef 42%,#fafafa 100%);border-bottom:1px solid #dedfe1}',
      '#wishlistPanel .wl-recommend-warning[hidden]{display:none!important}',
      '#wishlistPanel .wl-recommend-warning{position:relative;z-index:3;flex:none;color:#d92332;font-size:11px;font-weight:1000;line-height:1.2;white-space:nowrap;cursor:help;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}',
      '#wishlistPanel .wl-recommend-warning:after{content:attr(data-tooltip);position:absolute;left:50%;top:calc(100% + 8px);z-index:1000;display:block;width:380px;max-width:calc(100vw - 24px);box-sizing:border-box;padding:11px 13px;border:1px solid #e3b4bb;border-left:3px solid #d92332;border-radius:9px;background:#fffafa;color:#354256;font-size:10px;font-weight:800;line-height:1.6;letter-spacing:0;text-align:left;white-space:pre-line;box-shadow:0 8px 24px rgba(40,25,30,.2);opacity:0;visibility:hidden;pointer-events:none;transform:translate(-50%,-3px);transition:opacity .08s ease,transform .08s ease,visibility 0s linear .08s}',
      '#wishlistPanel .wl-recommend-warning:hover:after,#wishlistPanel .wl-recommend-warning:focus-visible:after{opacity:1;visibility:visible;transform:translate(-50%,0);transition-delay:0s}',
      '#wishlistPanel .wl-recommend-warning:focus-visible{outline:2px solid #d92332;outline-offset:3px}',
      'html.dark-theme #wishlistPanel .wl-recommend-warning{color:#ff858f}',
      'html.dark-theme #wishlistPanel .wl-recommend-warning:after{border-color:#6e3841;border-left-color:#ff858f;background:#211922;color:#f7e9eb}',
      '#wishlistPanel .wl-modal-head:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,transparent 0 8%,rgba(210,214,218,.35) 8% 20%,transparent 20% 37%,rgba(255,255,255,.62) 37% 48%,transparent 48% 62%,rgba(218,221,224,.35) 62% 77%,transparent 77%)}',
      '#wishlistPanel .wl-modal-title{position:relative;display:flex;align-items:center;gap:4px;color:#16a5df;font-size:11px;font-weight:1000;letter-spacing:-.04em}',
      '#wishlistPanel .wl-random-test-account-button{position:relative;z-index:1;flex:none;max-width:54%;padding:4px 7px;border:1px solid #b98a38;border-radius:5px;background:#fff8e8;color:#795315;font-size:9px;font-weight:1000;line-height:1.2;white-space:nowrap;cursor:pointer}',
      '#wishlistPanel .wl-random-test-account-button:hover{border-color:#d5a750;background:#fff0cf;color:#65430e}',
      '#wishlistPanel .wl-random-settings{flex:none;margin:6px 8px 3px;border:1px solid #e3cf9e;border-radius:7px;background:#fffaf0;color:#654f26;overflow:hidden}',
      '#wishlistPanel .wl-random-settings>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;cursor:pointer;list-style:none;font-size:10px;font-weight:1000;line-height:1.4}',
      '#wishlistPanel .wl-random-settings>summary::-webkit-details-marker{display:none}',
      '#wishlistPanel .wl-random-settings>summary:after{content:"⌄";font-size:14px;transition:transform .15s ease}',
      '#wishlistPanel .wl-random-settings[open]>summary:after{transform:rotate(180deg)}',
      '#wishlistPanel .wl-random-settings[open]>summary{border-bottom:1px solid #ebdfc3}',
      '#wishlistPanel .wl-random-settings-body{display:grid;gap:9px;max-height:42vh;overflow-y:auto;padding:9px 10px 10px;overscroll-behavior:contain}',
      '#wishlistPanel .wl-random-setting{display:grid;gap:3px;min-width:0}',
      '#wishlistPanel .wl-random-setting-head{display:flex;align-items:center;justify-content:space-between;gap:7px;font-size:10px;font-weight:900;line-height:1.35}',
      '#wishlistPanel .wl-random-setting-head label{min-width:0;flex:1}',
      '#wishlistPanel .wl-random-setting-head output{flex:none;color:#8b6218;font-size:10px;font-weight:1000;font-variant-numeric:tabular-nums}',
      '#wishlistPanel .wl-random-setting input[type=range]{display:block;width:100%;height:18px;margin:0;accent-color:#bd8c2e;cursor:pointer}',
      '#wishlistPanel .wl-random-setting-hint{color:#887957;font-size:9px;line-height:1.4}',
      '#wishlistPanel .wl-random-derived-chance{display:flex;align-items:center;justify-content:space-between;gap:7px;padding:5px 7px;border:1px dashed #d4bb7d;border-radius:5px;background:#fff4d9;font-size:10px;font-weight:900}',
      '#wishlistPanel .wl-random-derived-chance strong{color:#805811;font-size:11px;font-variant-numeric:tabular-nums}',
      'html.dark-theme #wishlistPanel .wl-random-settings{border-color:#655333;background:#211f1a;color:#f2e3bd}',
      'html.dark-theme #wishlistPanel .wl-random-settings[open]>summary{border-bottom-color:#51442b}',
      'html.dark-theme #wishlistPanel .wl-random-setting-head output{color:#ffd27f}',
      'html.dark-theme #wishlistPanel .wl-random-setting input[type=range]{accent-color:#d4a64d}',
      'html.dark-theme #wishlistPanel .wl-random-setting-hint{color:#c3b38e}',
      'html.dark-theme #wishlistPanel .wl-random-derived-chance{border-color:#655333;background:#302817;color:#f2e3bd}',
      'html.dark-theme #wishlistPanel .wl-random-derived-chance strong{color:#ffd27f}',
      '@media(prefers-reduced-motion:reduce){#wishlistPanel .wl-random-settings>summary:after{transition:none}}',
      'html.dark-theme #wishlistPanel .wl-random-test-account-button{border-color:#8b6a31;background:#352a19;color:#ffe2a7}',
      'html.dark-theme #wishlistPanel .wl-random-test-account-button:hover{border-color:#c49a47;background:#49371c;color:#fff0ca}',
      '#wishlistPanel .wl-refresh-icon{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;border:2px solid #16a5df;border-right-color:transparent;border-radius:50%;font-size:0;position:relative;transform:rotate(-35deg)}',
      '#wishlistPanel .wl-refresh-icon:after{content:"";position:absolute;right:-3px;top:-4px;width:0;height:0;border-top:4px solid transparent;border-bottom:4px solid transparent;border-left:6px solid #16a5df;transform:rotate(28deg)}',
      '#wishlistPanel .wl-close{position:relative;flex:none;width:42px;height:42px;border:0;background:transparent;color:#777;font-size:42px;font-weight:300;line-height:1;cursor:pointer}',
      '#wishlistPanel .wl-close:hover{color:#222}',
      '#wishlistPanel .wl-intro{flex:none;padding:3px 5px 3px;text-align:center;color:#16181b;font-size:clamp(9px,1vw,11px);font-weight:900;line-height:1.2;letter-spacing:-.035em}',
      '#wishlistPanel .wl-intro p{margin:0}',
      '#wishlistPanel .wl-intro .wl-blue{color:#16a5df}',
      '#wishlistPanel .wl-intro .wl-subline{margin-top:2px;color:#16a5df;font-size:clamp(8px,.9vw,10px)}',
      '#wishlistPanel .wl-company-list{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:none;gap:6px;flex:0 0 auto;min-height:0;padding:2px 8px 6px;overflow:visible}',
      '#wishlistPanel .wl-company{display:flex;flex-direction:column;min-height:0;border:1px solid #e3e3e3;border-radius:6px;background:rgba(255,255,255,.94);box-shadow:0 1px 2px rgba(0,0,0,.045)}',
      '#wishlistPanel .wl-company-head{position:relative;display:flex;align-items:center;justify-content:center;flex:none;min-height:32px;padding:2px 8px;border-bottom:1px solid #f0f0f0}',
      '#wishlistPanel .wl-company-brand{display:flex;flex-direction:row;align-items:center;justify-content:flex-start;gap:1px;width:min(340px,calc(100vw - 44px));color:#777}',
      '#wishlistPanel .wl-company-symbol{width:30px;height:25px;display:flex;align-items:center;justify-content:center;font-size:29px;line-height:1;font-weight:1000;color:#777;letter-spacing:-.08em}',
      '#wishlistPanel .wl-company-name{display:none;font-size:8px;font-weight:900;letter-spacing:.1em;color:#858585}',

      '#wishlistPanel .wl-slots{position:relative;display:grid;grid-template-columns:repeat(5,minmax(0,min(64px,calc((100vw - 64px)/5))));justify-content:center;gap:5px;align-items:start;padding:8px 8px 12px}',
      '#wishlistPanel .wl-row-select-trigger{position:absolute;inset:0;z-index:1;display:block;width:100%;height:100%;margin:0;padding:0;border:0;border-radius:9px;background:transparent;cursor:pointer}',
      '#wishlistPanel .wl-row-select-trigger:focus-visible{outline:3px solid rgba(22,165,223,.5);outline-offset:2px}',
      '#wishlistPanel .wl-slot{position:relative;z-index:2;min-width:0;aspect-ratio:1 / 1;border:0;border-radius:8px;background:transparent;box-shadow:none;overflow:visible;cursor:pointer}',
      '#wishlistHoverCard{position:fixed;z-index:2147483647;display:flex;align-items:center;gap:11px;box-sizing:border-box;width:max-content;max-width:min(280px,calc(100vw - 20px));padding:11px 13px;border:1px solid rgba(107,195,238,.45);border-radius:14px;background:linear-gradient(145deg,rgba(25,39,60,.98),rgba(9,16,29,.98));color:#f2f7ff;box-shadow:0 16px 42px rgba(2,8,20,.4),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(14px);pointer-events:none;opacity:0;visibility:hidden;transform:translateY(4px) scale(.985);transform-origin:center;transition:opacity .06s ease,transform .06s ease,visibility 0s linear .06s;font-family:inherit}',
      '#wishlistHoverCard.is-visible{opacity:1;visibility:visible;transform:translateY(0) scale(1);transition-delay:0s}',
      '#wishlistHoverCard .wl-hover-card-image{flex:none;width:45px;height:45px;overflow:hidden;border:1px solid rgba(148,210,244,.48);border-radius:10px;background:linear-gradient(135deg,#2b405d,#132034);box-shadow:0 4px 12px rgba(0,0,0,.22)}',
      '#wishlistHoverCard .wl-hover-card-image img{display:block;width:100%;height:100%;object-fit:cover}',
      '#wishlistHoverCard .wl-hover-card-fallback{display:flex;width:100%;height:100%;align-items:center;justify-content:center;color:#cdefff;font-size:22px;font-weight:900}',
      '#wishlistHoverCard .wl-hover-card-content{display:flex;min-width:0;flex-direction:column;gap:6px}',
      '#wishlistHoverCard .wl-hover-card-name{color:#f5f8ff;font-size:13px;font-weight:900;line-height:1.3;overflow-wrap:anywhere}',
      '#wishlistHoverCard .wl-hover-card-company{color:#8fd6f7;font-size:10px;font-weight:800;letter-spacing:.02em}',
      '#wishlistHoverCard .wl-hover-card-meta{display:flex;flex-wrap:wrap;align-items:center;gap:5px}',
      '#wishlistHoverCard .wl-hover-card-chip{display:inline-flex;align-items:center;padding:3px 6px;border:1px solid rgba(158,180,210,.22);border-radius:999px;background:rgba(255,255,255,.07);color:#dbe6f5;font-size:10px;font-weight:800;line-height:1.2;white-space:nowrap}',
      '#wishlistHoverCard .wl-hover-card-chip.is-unowned{border-color:rgba(255,174,105,.4);background:rgba(168,85,24,.2);color:#ffd5aa}',
      '#wishlistHoverCard.is-compact{width:auto;max-width:min(260px,calc(100vw - 20px));padding:9px 12px;border-radius:11px}',
      '#wishlistHoverCard.is-compact .wl-hover-card-image,#wishlistHoverCard.is-compact .wl-hover-card-company,#wishlistHoverCard.is-compact .wl-hover-card-meta{display:none}',
      '#wishlistHoverCard.is-compact .wl-hover-card-content{gap:0}',
      '#wishlistHoverCard.is-compact .wl-hover-card-name{font-size:11px;line-height:1.45;max-width:230px}',
      '#wishlistHoverCard.is-guidance{box-sizing:border-box;width:430px;max-width:min(430px,calc(100vw - 20px));min-height:84px;justify-content:center;padding:9px 12px;border:1px solid #cbd9e5;border-left:3px solid #59a3bb;border-radius:11px;background:linear-gradient(145deg,rgba(255,255,255,.99),rgba(237,244,249,.99));color:#34465a;box-shadow:0 8px 24px rgba(37,56,79,.20),inset 0 1px 0 rgba(255,255,255,.95);backdrop-filter:blur(10px)}',
      '#wishlistHoverCard.is-guidance .wl-hover-card-content{width:100%;min-width:0}',
      '#wishlistHoverCard.is-guidance .wl-hover-card-name{max-width:100%;color:#34465a!important;font-size:7px!important;font-weight:750;line-height:1.5;letter-spacing:0;white-space:pre-line;overflow-wrap:anywhere;text-shadow:none}',
      'html.dark-theme #wishlistHoverCard.is-guidance{border-color:#3c526b;border-left-color:#58b8c5;background:linear-gradient(145deg,rgba(28,42,62,.99),rgba(15,24,39,.99));color:#e5eff9;box-shadow:0 10px 26px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.05)}',
      'html.dark-theme #wishlistHoverCard.is-guidance .wl-hover-card-name{color:#e5eff9!important}',
      '@media(prefers-reduced-motion:reduce){#wishlistHoverCard{transition:none}}',
      '#wishlistPanel .wl-tile{position:absolute;inset:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid #8a8a8a;border-radius:9px;background:repeating-linear-gradient(0deg,rgba(90,90,90,.045) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(255,255,255,.28) 0 1px,transparent 1px 3px),linear-gradient(135deg,#f5f5f5 0%,#dedede 64%,#d0d0d0 100%);box-shadow:inset 0 1px 2px rgba(255,255,255,.96),inset 0 -2px 3px rgba(100,100,100,.16),0 3px 5px rgba(0,0,0,.32);}',
      '#wishlistPanel .wl-tile:before{content:"";position:absolute;left:0;top:21%;width:34%;height:35%;background:linear-gradient(180deg,rgba(255,255,255,.85) 0 31%,rgba(200,200,200,.56) 31% 38%,rgba(255,255,255,.62) 38% 68%,rgba(190,190,190,.4) 68% 75%,rgba(240,240,240,.38) 75%);border-right:1px solid rgba(255,255,255,.45);pointer-events:none}', '#wishlistPanel .wl-tile:after{content:"";position:absolute;inset:0;pointer-events:none}',
      '#wishlistPanel .wl-corner-mark{position:absolute;left:0;top:0;z-index:2;width:21px;height:23px;display:flex;align-items:center;justify-content:center;clip-path:polygon(0 0,100% 0,100% 74%,50% 100%,0 74%);background:#a53bea;color:white;font-size:11px;font-weight:1000;box-shadow:0 1px 3px rgba(0,0,0,.2)}',
      '#wishlistPanel .wl-empty-mark{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;padding:0;text-align:center;color:#333;font-size:0;font-weight:900;line-height:1}',
      '#wishlistPanel .wl-plus{position:relative;z-index:2;font-family:Arial,sans-serif;font-size:clamp(28px,3vw,38px);font-weight:300;line-height:1;color:#303030;text-shadow:0 1px 0 rgba(255,255,255,.8)}',
      '#wishlistPanel .wl-selected-name{max-width:100%;padding:19px 5px 12px;text-align:center;overflow-wrap:anywhere;word-break:keep-all;color:#3a3b3e;font-size:clamp(9px,1.1vw,12px);font-weight:1000;line-height:1.25}',
      '#wishlistPanel .wl-stage{position:absolute;top:3px;right:3px;z-index:3;min-width:19px;padding:2px 3px;border-radius:4px;background:rgba(35,37,40,.9);border:1px solid rgba(255,255,255,.8);color:#fff;font-size:8px;font-weight:1000;text-align:center}',
      '#wishlistPanel .wl-unowned{position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;background:rgba(70,74,80,.66);color:#fff;font-size:clamp(11px,1.5vw,15px);font-weight:1000;letter-spacing:.02em;text-shadow:0 1px 4px rgba(0,0,0,.6)}',
      '#wishlistPanel .wl-slot.is-unowned .wl-tile{filter:grayscale(1);background:#d0d0d0}',
      '#wishlistPanel .wl-slot.is-unowned .wl-selected-name{color:#777}',
      '#wishlistPanel .wl-slot:focus-within{outline:3px solid rgba(22,165,223,.45);outline-offset:2px}',
      '#wishlistPanel .wl-select{position:absolute;inset:0;z-index:8;width:100%;height:100%;opacity:0;cursor:pointer}',
      '#wishlistPanel .wl-select-trigger{position:absolute;inset:0;z-index:8;width:100%;height:100%;margin:0;padding:0;border:0;border-radius:8px;background:transparent;cursor:pointer}',
      '#wishlistPanel .wl-tile.wl-photo-only{padding:0;border-color:#8a8a8a;background:#fff}',
      '#wishlistPanel .wl-slot.is-bonus-recruit .wl-tile{border:3px solid #00b84a;box-shadow:0 0 0 2px #e6ffed,0 0 0 5px rgba(0,184,74,.48),0 4px 11px rgba(0,120,45,.42),inset 0 1px 2px rgba(255,255,255,.96),inset 0 -2px 3px rgba(0,100,35,.14)}',
      '#wishlistPanel .wl-slot.is-road-to-villain .wl-tile{border:3px solid #e53935;box-shadow:0 0 0 2px #fff0f0,0 0 0 5px rgba(229,57,53,.5),0 4px 11px rgba(150,0,0,.38),inset 0 1px 2px rgba(255,255,255,.96),inset 0 -2px 3px rgba(130,0,0,.14)}',
      '#wishlistPanel .wl-tile.wl-photo-only:before,#wishlistPanel .wl-tile.wl-photo-only:after{display:none!important;content:none!important}',
      '#wishlistPanel .wl-picked-image{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;object-position:center;border-radius:7px}',
      '#wishlistPanel .wl-character-name-label{display:none;box-sizing:border-box;width:100%;margin-top:3px;padding:0 1px;color:#4a5565;font-size:9px;font-weight:800;line-height:1.2;text-align:center;overflow-wrap:anywhere;word-break:keep-all}',
      'body.wishlist-view.wl-character-names-visible #wishlistPanel .wl-slot.has-character-name{display:flex;flex-direction:column;align-items:stretch;align-self:start;aspect-ratio:auto;min-height:0}',
      'body.wishlist-view.wl-character-names-visible #wishlistPanel .wl-slot.has-character-name .wl-tile{position:relative;inset:auto;display:block;width:100%;aspect-ratio:1/1;flex:none;overflow:hidden}',
      'body.wishlist-view.wl-character-names-visible #wishlistPanel .wl-slot.has-character-name .wl-character-name-label{display:block}',
      'body.wishlist-view.wl-character-names-visible #wishlistPanel .wl-slot.is-unowned .wl-photo-status{margin-top:2px}',
      'html.dark-theme body.wishlist-view.wl-character-names-visible #wishlistPanel .wl-character-name-label{color:#d0d9e8}',
      '#wishlistPanel .wl-promotion-stars{position:absolute;left:2px;top:auto;bottom:2px;z-index:5;display:flex;align-items:center;gap:0;padding:0;border:0;border-radius:0;background:transparent;color:#fff;font-size:clamp(8px,1vw,10px);font-weight:1000;line-height:1;letter-spacing:-.08em;text-shadow:0 1px 2px rgba(0,0,0,.85);white-space:nowrap;pointer-events:none}',
      '#wishlistPanel .wl-promotion-stars .wl-star-filled{color:#ffd76a}',
      '#wishlistPanel .wl-promotion-stars .wl-star-empty{color:#e8edf3;opacity:.9}',
      '#wishlistPanel .wl-core-enhancement{position:absolute;right:2px;top:2px;z-index:6;display:inline-flex;align-items:center;justify-content:center;min-width:15px;padding:2px 3px;border:1px solid rgba(255,255,255,.7);border-radius:4px;background:rgba(24,28,38,.86);color:#ffe18a;font-size:clamp(8px,.95vw,10px);font-weight:1000;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,.45);pointer-events:none}',
      '#wishlistPanel .wl-photo-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#e4ebf3,#c8d2df);color:#596b80;font-size:28px;font-weight:1000}',
      '#wishlistPanel .wl-slot.is-unowned{display:flex;flex-direction:column;align-items:stretch;aspect-ratio:auto;min-height:0}', 
      '#wishlistPanel .wl-slot.is-unowned .wl-tile{position:relative;inset:auto;display:block;width:100%;aspect-ratio:1/1;flex:none;overflow:hidden;filter:none;background:#d0d0d0}',
      '#wishlistPanel .wl-slot.is-unowned .wl-picked-image{filter:grayscale(1)}',
      '#wishlistPanel .wl-slot.is-unowned .wl-promotion-stars,#wishlistPanel .wl-slot.is-unowned .wl-core-enhancement{display:none!important}',
      '#wishlistPanel .wl-slot.is-unowned .wl-photo-status{position:relative;left:auto;right:auto;bottom:auto;z-index:4;display:block;width:100%;box-sizing:border-box;margin-top:2px;padding:1px 0;background:transparent;color:#a5adbb;text-align:center;font-size:clamp(8px,1vw,10px);font-weight:900;line-height:1.15;text-shadow:none}',
      '#wishlistPanel .wl-photo-status{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:3px 1px;background:rgba(35,39,46,.70);color:#fff;text-align:center;font-size:clamp(8px,1vw,10px);font-weight:1000;line-height:1.15;text-shadow:0 1px 2px rgba(0,0,0,.4)}',
      '#wishlistPanel .wl-picker-backdrop[hidden]{display:none!important}',
      '#wishlistPanel .wl-picker-backdrop{position:relative;inset:auto;z-index:20;display:block;box-sizing:border-box;width:100%;margin:0;padding:0 8px 12px;background:transparent;backdrop-filter:none;animation:wl-picker-expand .16s ease-out}',
      '#wishlistPanel .wl-picker-dialog{display:flex;flex-direction:column;width:100%;max-height:none;overflow:visible;border:1px solid #d5dbe5;border-radius:10px;background:#f8fafc;color:#222936;box-shadow:0 6px 18px rgba(0,0,0,.15)}',
      '@keyframes wl-picker-expand{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}',
      '#wishlistPanel .wl-picker-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-bottom:1px solid #dde3ec;background:linear-gradient(135deg,#fff,#edf3fa)}',
      '#wishlistPanel .wl-picker-title{flex:none;margin:0;color:#168fc5;font-size:15px;font-weight:1000;white-space:nowrap}',
      '#wishlistPanel .wl-picker-close{flex:none;width:30px;height:30px;border:0;border-radius:7px;background:#e7ebf1;color:#576171;font-size:22px;line-height:1;cursor:pointer}',
      '#wishlistPanel .wl-picker-search-wrap{display:none!important}',
      '#wishlistPanel .wl-picker-search{box-sizing:border-box;flex:1;min-width:0;width:auto;height:32px;padding:0 9px;border:1px solid #cbd4e0;border-radius:8px;background:#fff;color:#222936;font-size:12px;outline:none}',
      '#wishlistPanel .wl-picker-search:focus{border-color:#169fd6;box-shadow:0 0 0 3px rgba(22,159,214,.14)}',
      '#wishlistPanel .wl-picker-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-content:start;align-items:start;gap:3px;flex:none;min-height:0;max-height:none;padding:5px 7px 6px;overflow:visible}',
      '#wishlistPanel .wl-picker-group-divider{grid-column:1/-1;height:0;margin:1px -7px;border:0;border-top:1px solid #dfe4eb;background:none;}',
      '#wishlistPanel .wl-picker-item{min-width:0;padding:2px!important;border-radius:5px}',
      '#wishlistPanel .wl-picker-item.is-current{padding:1px!important}',
      '#wishlistPanel .wl-picker-photo{width:100%!important;max-width:100%!important;gap:0!important}',
      '#wishlistPanel .wl-picker-image-wrap{width:44px!important;max-width:44px!important;height:44px!important;aspect-ratio:1/1!important}',
      '@media(max-width:650px){#wishlistPanel .wl-picker-head{gap:5px;padding:5px 6px}#wishlistPanel .wl-picker-title{font-size:12px}#wishlistPanel .wl-picker-search{height:29px;font-size:11px;padding:0 7px}#wishlistPanel .wl-picker-close{width:26px;height:26px;font-size:19px}#wishlistPanel .wl-picker-image-wrap{width:42px!important;max-width:42px!important;height:42px!important}}',
      '#wishlistPanel .wl-picker-name{display:none!important}',
      'body.wishlist-view.wl-character-names-visible #wishlistPanel .wl-picker-name{display:block!important;box-sizing:border-box;min-height:0;padding:1px 2px 2px;color:#354052;font-size:10px;font-weight:900;line-height:1.2;text-align:center;overflow-wrap:anywhere;word-break:keep-all}',
      'html.dark-theme body.wishlist-view.wl-character-names-visible #wishlistPanel .wl-picker-name{color:#e4edfb}',
      '@media(max-width:650px){body.wishlist-view.wl-character-names-visible #wishlistPanel .wl-picker-name{font-size:8px;line-height:1.15;padding:1px 1px 2px}}',
      '#wishlistPanel .wl-picker-choice{gap:0!important}',
      '#wishlistPanel .wl-picker-choice:focus-visible{outline:2px solid #168fc5;outline-offset:2px}',
      '#wishlistPanel .wl-picker-item{position:relative;display:flex;min-width:0;flex-direction:column;align-items:center;gap:6px;padding:8px 5px;border:1px solid #dce2ea;border-radius:9px;background:#fff;color:#333b49;cursor:pointer;transition:border-color .12s,background .12s,transform .12s}',
      '#wishlistPanel .wl-picker-item:hover:not(:disabled){transform:translateY(-1px);border-color:#37a8d7;background:#f0faff}',
      '#wishlistPanel .wl-picker-item.is-current{border:2px solid #149fd6;padding:7px 4px;background:#e9f8ff}',
      '#wishlistPanel .wl-picker-item.is-manual-excluded{border-color:#e45b70;background:#fff0f2}',
      '#wishlistPanel .wl-picker-item.is-favorite{border-color:#5ca9df;background:#eaf6ff}',
      '#wishlistPanel .wl-picker-item:disabled{opacity:.36;cursor:not-allowed;filter:grayscale(.7)}',
      '#wishlistPanel .wl-picker-photo{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;width:72px;height:auto;overflow:visible;border-radius:7px;background:transparent}',
      '#wishlistPanel .wl-picker-image-wrap{position:relative;display:block;flex:none;width:72px;height:72px;overflow:hidden;border-radius:7px;background:#e6ebf2}',
      '#wishlistPanel .wl-picker-state-marker{position:absolute;left:2px;top:2px;z-index:8;padding:3px 5px;border-radius:4px;background:rgba(195,43,67,.94);color:#fff;font-size:9px;font-weight:1000;line-height:1.1;box-shadow:0 1px 3px rgba(0,0,0,.28);pointer-events:none}',
      '#wishlistPanel .wl-picker-state-marker.is-favorite{background:rgba(25,115,178,.96);color:#fff}',
      '#wishlistPanel .wl-picker-photo img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}',
      '#wishlistPanel .wl-picker-placeholder{position:absolute;inset:0;display:grid;place-items:center;color:#738093;font-size:24px;font-weight:900}',
      '#wishlistPanel .wl-picker-name{width:100%;min-height:2.5em;overflow-wrap:anywhere;text-align:center;font-size:11px;font-weight:900;line-height:1.25}',
      '#wishlistPanel .wl-picker-unowned{display:block;width:100%;padding:1px 0;background:transparent;color:#777;text-align:center;font-size:10px;font-weight:900;line-height:1.15}',
      '#wishlistPanel .wl-picker-item.is-unowned .wl-picker-photo img{filter:grayscale(1)}',
      '#wishlistPanel .wl-picker-choice{display:flex;width:100%;min-width:0;flex-direction:column;align-items:center;gap:6px;padding:0;border:0;border-radius:5px;background:transparent;color:inherit;cursor:pointer}',
      '#wishlistPanel .wl-picker-choice:hover:not(:disabled){filter:brightness(.97)}',
      '#wishlistPanel .wl-picker-choice:disabled{opacity:.38;cursor:not-allowed;filter:grayscale(.7)}',
      '#wishlistPanel .wl-picker-exclude{width:100%;min-height:26px;padding:4px 5px;border:1px solid #efb8c0;border-radius:6px;background:#fff0f2;color:#b52b43;font-size:10px;font-weight:1000;cursor:pointer}',
      '#wishlistPanel .wl-picker-exclude.is-excluded{border-color:#b7c1ce;background:#edf1f6;color:#4d596a}',
      '#wishlistPanel .wl-excluded-panel{position:absolute;left:calc(100% + 16px);top:0;z-index:1;box-sizing:border-box;width:290px;max-width:calc(100vw - 500px);max-height:calc(100vh - 155px);display:flex;flex-direction:column;overflow-x:hidden;overflow-y:auto;border:1px solid #e7aab5;border-radius:12px;background:linear-gradient(180deg,#fff4f5,#ffe9ed);color:#5a2631;box-shadow:0 5px 20px rgba(151,43,66,.12)}',
      '#wishlistPanel .wl-clue-window-button{display:flex;flex:none;flex-direction:column;align-items:center;gap:0;width:calc(100% - 16px);margin:8px 8px 10px;padding:12px;border:1px solid #d8c7a3;border-radius:9px;background:linear-gradient(180deg,#fffaf0,#f9efdc);text-align:center;cursor:pointer}',
      '#wishlistPanel .wl-clue-window-button:hover{border-color:#c5a76b;background:#fff4d7}',
      '#wishlistPanel .wl-clue-window-title{display:block;max-width:100%;color:#51452d;font-size:19px;font-weight:1000;line-height:1.25;overflow-wrap:anywhere}',
      'html.dark-theme #wishlistPanel .wl-clue-window-button{border-color:#67563b;background:linear-gradient(180deg,#2b251b,#211c15)}',
      'html.dark-theme #wishlistPanel .wl-clue-window-button:hover{background:#3a3020}',
      'html.dark-theme #wishlistPanel .wl-clue-window-title{color:#f4e5bf}',
      '#wishlistPanel .wl-clue-list{flex:none;margin:8px 8px 10px;border:1px solid #d8c7a3;border-radius:9px;background:linear-gradient(180deg,#fffaf0,#f9efdc);color:#51452d;overflow:hidden}',
      '#wishlistPanel .wl-clue-list>summary{display:flex;align-items:center;gap:8px;min-height:38px;padding:8px 10px;cursor:pointer;list-style:none}',
      '#wishlistPanel .wl-clue-list>summary::-webkit-details-marker{display:none}',
      '#wishlistPanel .wl-clue-list-title{flex:1;min-width:0;font-size:12px;font-weight:1000;color:#51452d}',
      '#wishlistPanel .wl-clue-list-count{flex:none;padding:3px 7px;border:1px solid #e3d2ac;border-radius:999px;background:#fff4d7;color:#96712d;font-size:10px;font-weight:1000}',
      '#wishlistPanel .wl-clue-list-chevron{flex:none;color:#89754d;font-size:15px;line-height:1;transition:transform .12s ease}',
      '#wishlistPanel .wl-clue-list[open] .wl-clue-list-chevron{transform:rotate(180deg)}',
      '#wishlistPanel .wl-clue-list-scroll{width:100%;max-height:260px;overflow:auto;overscroll-behavior:contain;border-top:1px solid #e9dcbf}',
      '#wishlistPanel .wl-clue-list-grid{display:grid;grid-template-columns:repeat(8,minmax(102px,1fr));gap:6px;width:max-content;min-width:870px;padding:8px}',
      '#wishlistPanel .wl-clue-column{min-width:0;padding:7px 7px 9px;border:1px solid #e5d8bb;border-radius:7px;background:rgba(255,255,255,.72)}',
      '#wishlistPanel .wl-clue-column h4{margin:0 0 7px;padding-bottom:5px;border-bottom:1px solid #eadfc8;color:#85621f;font-size:10px;font-weight:1000;text-align:center;white-space:nowrap}',
      '#wishlistPanel .wl-clue-column ol{margin:0;padding-left:20px;color:#554d3f;font-size:10px;font-weight:800;line-height:1.55}',
      '#wishlistPanel .wl-clue-column li{padding-left:1px;overflow-wrap:anywhere}',
      'html.dark-theme #wishlistPanel .wl-clue-list{border-color:#67563b;background:linear-gradient(180deg,#2b251b,#211c15);color:#f4e5bf}',
      'html.dark-theme #wishlistPanel .wl-clue-list-title{color:#f4e5bf}',
      'html.dark-theme #wishlistPanel .wl-clue-list-count{border-color:#67563b;background:#3a3020;color:#f2d38b}',
      'html.dark-theme #wishlistPanel .wl-clue-list-chevron{color:#cfb77f}',
      'html.dark-theme #wishlistPanel .wl-clue-list-scroll{border-color:#55472f}',
      'html.dark-theme #wishlistPanel .wl-clue-column{border-color:#55472f;background:rgba(13,17,24,.72)}',
      'html.dark-theme #wishlistPanel .wl-clue-column h4{border-color:#55472f;color:#f2d38b}',
      'html.dark-theme #wishlistPanel .wl-clue-column ol{color:#e7dfcf}',
      '#wishlistPanel .wl-excluded-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 13px;border-bottom:1px solid #efc0c8;background:linear-gradient(135deg,#ffe8ec,#ffd6de)}',
      '#wishlistPanel .wl-excluded-title{font-size:13px;font-weight:1000;color:#354459}',
      '#wishlistPanel .wl-excluded-count{flex:none;padding:3px 7px;border-radius:999px;background:#e8edf4;color:#536175;font-size:10px;font-weight:1000}',
      '#wishlistPanel .wl-excluded-note{padding:9px 13px 7px;color:#6f7c8f;font-size:10px;line-height:1.5}',
       '#wishlistPanel .wl-favorite-note{padding:9px 13px 7px;color:#456d88;font-size:10px;line-height:1.5}',
      '#wishlistPanel .wl-excluded-list{display:flex;flex-direction:column;gap:6px;min-height:36px;max-height:min(34vh,300px);padding:0 10px 11px;overflow:auto}',
      '#wishlistPanel .wl-favorite-section{flex:none;border-top:1px solid #a9d5f1;background:linear-gradient(180deg,#f0f9ff,#e0f2ff)}',
      '#wishlistPanel .wl-favorite-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 13px;border-bottom:1px solid #b7dcf4;background:linear-gradient(135deg,#e5f5ff,#cdeaff)}',
      '#wishlistPanel .wl-favorite-count{flex:none;padding:3px 7px;border-radius:999px;background:#b8e0fb;color:#155987;font-size:10px;font-weight:1000}',
      '#wishlistPanel .wl-favorite-list{display:flex;flex-direction:column;gap:6px;min-height:32px;max-height:min(24vh,200px);padding:8px 10px 11px;overflow:auto}',
      '#wishlistPanel .wl-favorite-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 8px;border:1px solid #acd7f3;border-radius:8px;background:#eaf6ff;color:#164b70}',
      '#wishlistPanel .wl-favorite-remove{flex:none;padding:5px 7px;border:1px solid #8fc5eb;border-radius:6px;background:#d3edff;color:#155987;font-size:10px;font-weight:1000;cursor:pointer}',
      '#wishlistPanel .wl-favorite-remove:hover{border-color:#4b9ed4;background:#b5e1ff}',
      '#wishlistPanel .wl-excluded-empty{padding:14px 7px;color:#8a95a5;text-align:center;font-size:11px;line-height:1.6}',
      '#wishlistPanel .wl-excluded-row{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 8px;border:1px solid #e8b2bc;border-radius:8px;background:#ffedf0;color:#632b37}',
      '#wishlistPanel .wl-core7-group{flex:none;overflow:hidden;border:1px solid #cbd8e8;border-radius:9px;background:linear-gradient(135deg,#f7faff,#edf3fa)}',
      '#wishlistPanel .wl-core7-group>summary{display:flex;align-items:center;gap:8px;min-height:38px;padding:7px 10px;cursor:pointer;list-style:none;color:#354459;font-size:11px;font-weight:900}',
      '#wishlistPanel .wl-core7-group>summary::-webkit-details-marker{display:none}',
      '#wishlistPanel .wl-core7-label{flex:1;min-width:0}',
      '#wishlistPanel .wl-core7-count{flex:none;padding:3px 7px;border:1px solid #c7d9ee;border-radius:999px;background:#e2efff;color:#2468a1;font-size:10px;font-weight:1000;white-space:nowrap}',
      '#wishlistPanel .wl-core7-chevron{flex:none;color:#73859d;font-size:13px;transition:transform .12s ease}',
      '#wishlistPanel .wl-core7-group[open] .wl-core7-chevron{transform:rotate(180deg)}',
      '#wishlistPanel .wl-core7-items{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;padding:0 8px 8px}',
      '#wishlistPanel .wl-core7-item{display:flex;align-items:center;gap:6px;min-width:0;padding:5px 7px;border:1px solid #e0e8f2;border-radius:6px;background:rgba(255,255,255,.86)}',
      '#wishlistPanel .wl-core7-company{flex:none;color:#70829a;font-size:9px;font-weight:800}',
      '#wishlistPanel .wl-core7-name{min-width:0;overflow-wrap:anywhere;color:#354459;font-size:10px;font-weight:850;line-height:1.35}',
      'html.dark-theme #wishlistPanel .wl-core7-group{border-color:#354761;background:linear-gradient(135deg,#1b2a40,#121c2d)}',
      'html.dark-theme #wishlistPanel .wl-core7-group>summary{color:#e7eefb}',
      'html.dark-theme #wishlistPanel .wl-core7-count{border-color:#34557a;background:#172e49;color:#9fd2ff}',
      'html.dark-theme #wishlistPanel .wl-core7-chevron{color:#a3b5cd}',
      'html.dark-theme #wishlistPanel .wl-core7-item{border-color:#354761;background:rgba(12,20,35,.78)}',
      'html.dark-theme #wishlistPanel .wl-core7-company{color:#9aacc4}',
      'html.dark-theme #wishlistPanel .wl-core7-name{color:#e4edfb}',
      '@media(max-width:480px){#wishlistPanel .wl-core7-items{grid-template-columns:1fr}}',
      '#wishlistPanel .wl-excluded-row.is-miranda{padding-top:16px}',
      '#wishlistPanel .wl-excluded-info{position:absolute;top:3px;right:4px;z-index:2;display:flex;align-items:center;justify-content:center;width:11px;height:11px;box-sizing:border-box;border:1px solid #8b9aac;border-radius:50%;background:rgba(246,249,253,.96);color:#65748a;font:italic 900 7px/1 Georgia,serif;text-align:center;cursor:help;box-shadow:0 1px 2px rgba(0,0,0,.08)}',
      '#wishlistPanel .wl-excluded-info:hover{border-color:#168fc5;background:#e9f8ff;color:#087ba8}',
      '#wishlistPanel .wl-excluded-info:after{content:attr(data-tooltip);position:absolute;top:calc(100% + 8px);right:-5px;z-index:20;width:230px;max-width:calc(100vw - 48px);box-sizing:border-box;padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:linear-gradient(145deg,#202b3d,#101827);color:#f3f7ff;font:500 11px/1.55 system-ui,sans-serif;letter-spacing:0;text-align:left;white-space:normal;box-shadow:0 9px 26px rgba(0,0,0,.28);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-2px);transition:opacity .06s ease-out,transform .06s ease-out,visibility 0s linear .06s}',
      '#wishlistPanel .wl-excluded-info:hover:after,#wishlistPanel .wl-excluded-info:focus-visible:after{opacity:1;visibility:visible;transform:translateY(0);transition-delay:0s}',
      '#wishlistPanel .wl-excluded-info:before{content:"";position:absolute;top:calc(100% + 3px);right:0;z-index:21;border:5px solid transparent;border-bottom-color:#202b3d;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .06s ease-out,visibility 0s linear .06s}',
      '#wishlistPanel .wl-excluded-info:hover:before,#wishlistPanel .wl-excluded-info:focus-visible:before{opacity:1;visibility:visible;transition-delay:0s}',
      '@media(hover:none){#wishlistPanel .wl-excluded-info:active:after,#wishlistPanel .wl-excluded-info:active:before{opacity:1;visibility:visible;transition-delay:0s}}',
      '#wishlistPanel .wl-excluded-identity{display:flex;min-width:0;flex-direction:column;gap:3px}',
      '#wishlistPanel .wl-excluded-company{color:#8a95a5;font-size:9px;font-weight:900}',
      '#wishlistPanel .wl-excluded-name{overflow-wrap:anywhere;color:#354052;font-size:11px;font-weight:900;line-height:1.3}',
      '#wishlistPanel .wl-excluded-reason{color:#b45b25;font-size:9px;font-weight:900;line-height:1.3}',
      '#wishlistPanel .wl-auto-exclusion-pill{flex:none;padding:5px 7px;border:1px solid #e9c6ad;border-radius:6px;background:#fff3e9;color:#a84b14;font-size:10px;font-weight:1000;white-space:nowrap}',
      '#wishlistPanel .wl-include-button{flex:none;padding:5px 7px;border:1px solid #cdd6e2;border-radius:6px;background:#f4f6f9;color:#556276;font-size:10px;font-weight:1000;cursor:pointer}',
      '#wishlistPanel .wl-include-button:hover{border-color:#168fc5;background:#edf9ff;color:#087ba8}',
      'html.dark-theme #wishlistPanel .wl-excluded-panel{border-color:#75404d;background:linear-gradient(180deg,#321c25,#24141b);color:#ffe8ed;box-shadow:0 5px 20px rgba(0,0,0,.25)}',
      'html.dark-theme #wishlistPanel .wl-excluded-head{border-color:#75404d;background:linear-gradient(135deg,#492430,#351a23)}',
      'html.dark-theme #wishlistPanel .wl-excluded-title{color:#e8eef9}',
      'html.dark-theme #wishlistPanel .wl-excluded-count{background:#27364c;color:#cbd6e6}',
      'html.dark-theme #wishlistPanel .wl-excluded-note,html.dark-theme #wishlistPanel .wl-excluded-empty{color:#9aa9be}',
       'html.dark-theme #wishlistPanel .wl-favorite-note{color:#a3c8e2}',
      'html.dark-theme #wishlistPanel .wl-excluded-row{border-color:#75404d;background:#3b202a;color:#ffe8ed}',
      'html.dark-theme #wishlistPanel .wl-favorite-section{border-color:#315e7d;background:linear-gradient(180deg,#142b3b,#102333)}',
      'html.dark-theme #wishlistPanel .wl-favorite-head{border-color:#315e7d;background:linear-gradient(135deg,#193d54,#153146)}',
      'html.dark-theme #wishlistPanel .wl-favorite-count{background:#234e6d;color:#d8efff}',
      'html.dark-theme #wishlistPanel .wl-favorite-row{border-color:#315e7d;background:#173247;color:#e0f3ff}',
      'html.dark-theme #wishlistPanel .wl-favorite-remove{border-color:#397da8;background:#1e4b69;color:#d8efff}',
      'html.dark-theme #wishlistPanel .wl-excluded-info{border-color:#65758d;background:#192538;color:#cbd8ea}',
      'html.dark-theme #wishlistPanel .wl-excluded-info:hover{border-color:#5ab9df;background:#203b50;color:#bdeaff}',
      'html.dark-theme #wishlistPanel .wl-excluded-info:after{border-color:#3b4960;background:linear-gradient(145deg,#243249,#121b2b);color:#f3f7ff}',
      'html.dark-theme #wishlistPanel .wl-excluded-info:before{border-bottom-color:#243249}',
      'html.dark-theme #wishlistPanel .wl-excluded-name{color:#e3ebf8}',
      'html.dark-theme #wishlistPanel .wl-excluded-reason{color:#ffbc86}',
      'html.dark-theme #wishlistPanel .wl-auto-exclusion-pill{border-color:#80563d;background:#3a291f;color:#ffc08d}',
      'html.dark-theme #wishlistPanel .wl-include-button{border-color:#43546c;background:#1e2c41;color:#d1dcef}',
      'html.dark-theme #wishlistPanel .wl-picker-exclude{border-color:#75404e;background:#351d27;color:#ffabb9}',
      'html.dark-theme #wishlistPanel .wl-picker-exclude.is-excluded{border-color:#43546c;background:#1e2c41;color:#d1dcef}',
      '#wishlistPanel .wl-picker-foot{display:none!important}',
      '#wishlistPanel .wl-picker-clear{flex:none;padding:8px 12px;border:1px solid #d7a9ad;border-radius:7px;background:#fff5f5;color:#b3434a;font-size:12px;font-weight:900;cursor:pointer}',
      '#wishlistPanel .wl-picker-empty{grid-column:1/-1;padding:28px 10px;text-align:center;color:#758196;font-size:13px}',
      '#wishlistPanel .wl-auto-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px;padding:2px 8px 4px}',
      '#wishlistPanel .wl-auto-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:32px;padding:7px 14px;border:1px solid #1597ca;border-radius:7px;background:linear-gradient(180deg,#19b5ed,#079bd7);color:#fff;font-size:12px;font-weight:1000;cursor:pointer;box-shadow:0 2px 4px rgba(0,110,160,.15)}',
      '#wishlistPanel .wl-auto-button:hover{filter:brightness(1.04);transform:translateY(-1px)}',
      '#wishlistPanel .wl-auto-note{flex-basis:100%;text-align:center;color:#7a8490;font-size:9px;line-height:1.35}',
      '#wishlistPanel .wl-status{flex:none;padding:0 12px 6px;text-align:right;color:#80858b;font-size:9px}',
      '#wishlistPanel .wl-footer{display:flex;justify-content:center;gap:16px;flex:none;padding:5px 12px 6px;border-top:1px solid #dedede;background:#f8f8f8}',
      '#wishlistPanel .wl-action{display:flex;align-items:center;justify-content:center;gap:7px;width:clamp(120px,25%,220px);min-height:42px;border-radius:6px;font-size:16px;font-weight:1000;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.12)}',
      '#wishlistPanel .wl-cancel{border:2px solid #aaa;background:#fff;color:#343434}',
      '#wishlistPanel .wl-confirm{border:2px solid #0da5e2;background:#0ba8eb;color:white}',
      '#wishlistPanel .wl-action:hover{filter:brightness(.97);transform:translateY(-1px)}',
      '@media(max-width:1000px){#wishlistPanel .wl-excluded-panel{position:relative;left:auto;top:auto;width:calc(100% - 24px);max-width:462px;max-height:none;margin:12px auto 0}#wishlistPanel .wl-excluded-list{max-height:260px}#wishlistPanel .wl-favorite-list{max-height:200px}#wishlistPanel .wl-clue-list-grid{min-width:870px}}',
      '@media(max-width:650px){body.wishlist-view.wl-character-names-visible #wishlistPanel .wl-character-name-label{font-size:7px;line-height:1.15;margin-top:2px}#wishlistPanel{width:100%;margin:0 auto 12px}#wishlistPanel .wl-dialog{width:100%;height:auto;border-radius:10px}#wishlistPanel .wl-modal-head{min-height:27px;padding:3px 6px}#wishlistPanel .wl-modal-title{font-size:11px;gap:4px}#wishlistPanel .wl-refresh-icon{width:17px;height:17px;border-width:2px}#wishlistPanel .wl-intro{padding:3px 4px;font-size:9px;line-height:1.2}#wishlistPanel .wl-intro .wl-subline{font-size:8px;margin-top:2px}#wishlistPanel .wl-company-list{gap:6px;padding:2px 7px 6px}#wishlistPanel .wl-company-head{min-height:30px;padding:2px 7px}#wishlistPanel .wl-company-brand{width:min(340px,calc(100vw - 44px))}#wishlistPanel .wl-company-symbol{width:28px;height:24px;font-size:27px}#wishlistPanel .wl-company-name{font-size:7px}#wishlistPanel .wl-slots{gap:4px;padding:7px 5px 10px}#wishlistPanel .wl-slot{aspect-ratio:1 / 1;border-radius:4px}#wishlistPanel .wl-corner-mark{width:16px;height:18px;font-size:9px}#wishlistPanel .wl-selected-name{padding:14px 2px 7px;font-size:7px}#wishlistPanel .wl-stage{top:2px;right:2px;padding:1px 2px;font-size:7px;min-width:14px}#wishlistPanel .wl-plus{font-size:28px}#wishlistPanel .wl-empty-mark{gap:1px;padding:2px;font-size:7px}#wishlistPanel .wl-footer{gap:8px;padding:5px 8px 6px}#wishlistPanel .wl-action{width:42%;min-height:36px;font-size:13px}}',
      '@media(max-width:380px){#wishlistPanel .wl-company-list{padding-left:6px;padding-right:6px}#wishlistPanel .wl-slots{gap:4px;padding-left:5px;padding-right:5px}#wishlistPanel .wl-selected-name{font-size:8px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureNav(){
    const nav = document.querySelector('.nav');
    if(!nav) return;
    let button = nav.querySelector('[data-view="wishlist"]');
    if(!button){
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'main-view-nav';
      button.dataset.view = 'wishlist';
      button.textContent = '위시리스트 추천';
      button.addEventListener('click', () => window.switchMainView && window.switchMainView('wishlist'));
    }
    const pediaButton = nav.querySelector('[data-view="pedia"]');
    // Keep Wishlist Recommendation immediately above the encyclopedia item.
    if(pediaButton) nav.insertBefore(button,pediaButton);
    else if(button.parentElement !== nav) nav.appendChild(button);
  }

  function ensureAccountSwitcher(){
    let switcher = document.getElementById('wishlistAccountSwitcher');
    if(switcher) return switcher;
    switcher = document.createElement('div');
    switcher.id = 'wishlistAccountSwitcher';
    switcher.hidden = true;
    switcher.setAttribute('aria-label','위시리스트 계정 선택');
    switcher.addEventListener('click', function(event){
      const button = event.target.closest && event.target.closest('[data-wl-account]');
      if(!button) return;
      const account = button.dataset.wlAccount;
      if(!account || !Array.isArray(ACCOUNTS) || !ACCOUNTS.includes(account)) return;
      if(typeof window.switchAccount === 'function') window.switchAccount(account);
      renderAccountSwitcher();
    });
    const main = document.querySelector('main.main') || document.querySelector('main');
    if(main) main.appendChild(switcher);
    else document.body.appendChild(switcher);
    return switcher;
  }

  function renderAccountSwitcher(){
    const switcher = ensureAccountSwitcher();
    if(!switcher) return;
    const accounts = Array.isArray(ACCOUNTS) && ACCOUNTS.length ? ACCOUNTS.slice(0,2) : ['계정1','계정2'];
    const current = typeof activeAccount !== 'undefined' ? activeAccount : accounts[0];
    switcher.innerHTML = '<span class="wl-account-label">계정</span>' + accounts.map((account,index) =>
      '<button type="button" class="wl-account-button' + (current === account ? ' active' : '') + '" data-wl-account="' + esc(account) + '" aria-pressed="' + (current === account ? 'true' : 'false') + '" data-wl-hover-text="' + esc(account) + '">' + esc(account || ('계정' + (index+1))) + '</button>'
    ).join('');
    switcher.hidden = !document.body.classList.contains('wishlist-view');
  } 

  function ensure160WallControl(){
    let control = document.getElementById('wishlist160WallControl');
    if(control) return control;
    control = document.createElement('aside');
    control.id = 'wishlist160WallControl';
    control.hidden = true;
    control.setAttribute('aria-label','160벽 돌파 여부 설정');
    control.innerHTML =
      '<div class="wl-name-view-title">캐릭터 이름보기</div>' +
      '<div class="wl-name-view-options">' +
        '<button type="button" class="wl-name-view-button" data-wl-name-visibility="on" aria-pressed="false">ON</button>' +
        '<button type="button" class="wl-name-view-button" data-wl-name-visibility="off" aria-pressed="true">OFF</button>' +
      '</div>' +
      '<div class="wl-copy-priority-divider wl-name-view-divider"></div>' +
      '<div class="wl-160-title">160벽 돌파 여부</div>' +
      '<div class="wl-160-options">' +
        '<button type="button" class="wl-160-button" data-wl-160-wall="O" aria-pressed="false">O</button>' +
        '<button type="button" class="wl-160-button" data-wl-160-wall="X" aria-pressed="false">X</button>' +
      '</div>' +
      
      '<div class="wl-copy-priority-divider"></div>' +
      '<div class="wl-copy-priority-heading"><span>PVP 캐릭터 선호도</span><span class="wl-copy-priority-value" data-wl-pvp-priority-value>솔레 우선</span></div>' +
      '<div class="wl-priority-slider-wrap wl-pvp-slider-wrap">' +
         '<div class="wl-priority-slider-segments" aria-hidden="true"><span data-wl-pvp-step="0"></span><span data-wl-pvp-step="1"></span><span data-wl-pvp-step="2"></span></div>' +
         '<input class="wl-copy-priority-slider" data-wl-pvp-priority type="range" min="0" max="2" step="1" value="1" aria-label="PVP 캐릭터 선호도" />' +
         '<span class="wl-priority-star" data-wl-pvp-star aria-hidden="true" style="left:16.6667%">★</span>' +
       '</div>' +
      '<div class="wl-copy-priority-ends wl-pvp-priority-ends"><span>PVP 우선</span><span>솔레 우선</span><span>PVP 제외</span></div>' +
       '<div class="wl-priority-info wl-pvp-priority-info" data-wl-pvp-info></div>' +
      
      '<div class="wl-copy-priority-divider"></div>' +
      '<div class="wl-copy-priority-heading"><span>돌파 선호도</span><span class="wl-copy-priority-value" data-wl-copy-priority-value>성능캐 돌파우선</span></div>' +
      '<div class="wl-priority-slider-wrap wl-copy-slider-wrap">' +
         '<div class="wl-priority-slider-segments" aria-hidden="true"><span data-wl-copy-step="0"></span><span data-wl-copy-step="1"></span><span data-wl-copy-step="2"></span></div>' +
         '<input class="wl-copy-priority-slider" data-wl-copy-priority type="range" min="0" max="2" step="1" value="0" aria-label="돌파 선호도" />' +
         '<span class="wl-priority-star" data-wl-copy-star aria-hidden="true" style="left:83.3333%">★</span>' +
          '<span class="wl-priority-prohibit" data-wl-copy-prohibit aria-hidden="true" hidden></span>' +
       '</div>' +
      '<div class="wl-copy-priority-ends" data-wl-copy-priority-ends><span data-wl-copy-priority-end="0">성능캐<br>돌파우선</span><span data-wl-copy-priority-end="1">균형</span><span data-wl-copy-priority-end="2">도감작<br>우선</span></div>' +
      
       '<div class="wl-copy-priority-warning" data-wl-copy-warning hidden>160벽 돌파여부가 X인 상태에서는\n추천하지 않는 설정입니다.</div>' +
        '<div class="wl-priority-info wl-copy-priority-info" data-wl-copy-info hidden></div>';
    control.addEventListener('input', event => {
      const pvpSlider = event.target.closest && event.target.closest('[data-wl-pvp-priority]');
      if(pvpSlider){
        const value = Number(pvpSlider.value);
        const modes = ['pvp','solo','exclude'];
        if(!Number.isInteger(value) || value < 0 || value > 2) return;
        pvpPriority = modes[value];
        savePvpPriority();
        render160WallControl();
        if(typeof renderWishlist === 'function') renderWishlist();
        return;
      }
      const slider = event.target.closest && event.target.closest('[data-wl-copy-priority]');
      if(!slider) return;
      const value = Number(slider.value);
      if(!Number.isInteger(value) || value < 0 || value > 2) return;
      copyPriority = value;
      saveCopyPriority();
      render160WallControl();
    });
    control.addEventListener('click', event => {
      const nameButton = event.target.closest && event.target.closest('[data-wl-name-visibility]');
      if(nameButton){
        const value = nameButton.getAttribute('data-wl-name-visibility');
        if(value !== 'on' && value !== 'off') return;
        characterNamesVisible = value === 'on';
        saveCharacterNamesVisible();
        render160WallControl();
        if(typeof renderWishlist === 'function') renderWishlist();
        return;
      }
      const button = event.target.closest && event.target.closest('[data-wl-160-wall]');
      if(!button) return;
      const value = button.getAttribute('data-wl-160-wall');
      if(value !== 'O' && value !== 'X') return;
      wallStatus = value;
      saveWallStatus();
      render160WallControl();
      if(typeof renderWishlist === 'function') renderWishlist();
    });
    const main = document.querySelector('main.main') || document.querySelector('main');
    if(main){
      const existingPanel = document.getElementById('wishlistPanel');
      if(existingPanel && existingPanel.parentElement === main) main.insertBefore(control, existingPanel);
      else main.appendChild(control);
    }else{
      document.body.appendChild(control);
    }
    return control;
  }

  function render160WallControl(){
    const control = ensure160WallControl();
    if(!control) return;
    control.hidden = !document.body.classList.contains('wishlist-view');
    document.body.classList.toggle('wl-character-names-visible', characterNamesVisible);
    control.querySelectorAll('[data-wl-name-visibility]').forEach(button => {
      const active = button.getAttribute('data-wl-name-visibility') === (characterNamesVisible ? 'on' : 'off');
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    control.querySelectorAll('[data-wl-160-wall]').forEach(button => {
      const active = button.getAttribute('data-wl-160-wall') === wallStatus;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const pvpModes = ['pvp','solo','exclude'];
    const pvpSlider = control.querySelector('[data-wl-pvp-priority]');
    if(pvpSlider) pvpSlider.value = String(Math.max(0,pvpModes.indexOf(pvpPriority)));
    const pvpStep = Math.max(0,pvpModes.indexOf(pvpPriority));
    control.querySelectorAll('[data-wl-pvp-step]').forEach(segment => {
      segment.classList.toggle('is-active', Number(segment.getAttribute('data-wl-pvp-step')) === pvpStep);
    });
    const pvpStar = control.querySelector('[data-wl-pvp-star]');
    if(pvpStar) pvpStar.style.left = 'calc(16.6667% - 1.333px)';
     const pvpInfo = control.querySelector('[data-wl-pvp-info]');
     if(pvpInfo) pvpInfo.textContent = PVP_PRIORITY_DESCRIPTIONS[pvpPriority] || PVP_PRIORITY_DESCRIPTIONS.solo;
    const pvpValueLabel = control.querySelector('[data-wl-pvp-priority-value]');
    if(pvpValueLabel) pvpValueLabel.textContent = ({pvp:'PVP 우선',solo:'솔레 우선',exclude:'PVP 제외'})[pvpPriority] || '솔레 우선';
    const slider = control.querySelector('[data-wl-copy-priority]');
    if(slider) slider.value = String(copyPriority);
    control.querySelectorAll('[data-wl-copy-step]').forEach(segment => {
      segment.classList.toggle('is-active', Number(segment.getAttribute('data-wl-copy-step')) === copyPriority);
    });
    const copyStar = control.querySelector('[data-wl-copy-star]');
    if(copyStar) copyStar.style.left = wallStatus === 'O' ? '50%' : 'calc(83.3333% + 1.333px)';
    const copySliderWrap = control.querySelector('.wl-copy-slider-wrap');
    if(copySliderWrap) copySliderWrap.classList.toggle('is-red-warning', wallStatus === 'X' && copyPriority === 0);
    const copyProhibit = control.querySelector('[data-wl-copy-prohibit]');
    if(copyProhibit) copyProhibit.hidden = wallStatus !== 'X';
    const copyWarning = control.querySelector('[data-wl-copy-warning]');
    if(copyWarning) copyWarning.hidden = !(wallStatus === 'X' && copyPriority === 0);
     const copyInfo = control.querySelector('[data-wl-copy-info]');
     const copyInfoText = getCopyPriorityDescription();
     if(copyInfo){
       copyInfo.textContent = copyInfoText;
       copyInfo.hidden = !copyInfoText || (wallStatus === 'X' && copyPriority === 0);
     }
    const copyEnds = control.querySelector('[data-wl-copy-priority-ends]');
    if(copyEnds){
      const end1 = copyEnds.querySelector('[data-wl-copy-priority-end="1"]');
      const end2 = copyEnds.querySelector('[data-wl-copy-priority-end="2"]');
      if(end1) end1.textContent = wallStatus === 'X' ? '' : '균형';
      if(end2) end2.innerHTML = wallStatus === 'X' ? '추천' : '도감작<br>우선';
    }
    const valueLabel = control.querySelector('[data-wl-copy-priority-value]');
    const copyPriorityLabels = wallStatus === 'X'
      ? ['성능캐 돌파우선','과금유저용','추천']
      : COPY_PRIORITY_LABELS;
    if(valueLabel) valueLabel.textContent = copyPriorityLabels[copyPriority] || '성능캐 돌파우선';
    const help = control.querySelector('[data-wl-copy-priority-help]');
    if(help){
      const description = copyInfoText || '160벽 돌파 못한 상태에선 추천하지 않는 설정입니다';
       help.setAttribute('data-tooltip', description);
      help.setAttribute('aria-label', description);
    }
  }

  function ensurePanel(){
    panel = document.getElementById('wishlistPanel');
    if(panel) return panel;
    panel = document.createElement('section');
    panel.id = 'wishlistPanel';
    panel.className = 'panel wishlist-panel';
    panel.hidden = true;
    panel.setAttribute('aria-labelledby','wishlistModalTitle');
    panel.innerHTML =
      '<div class="wl-dialog">' +
        '<div class="wl-modal-head">' +
          '<div class="wl-modal-title" id="wishlistModalTitle"><span class="wl-refresh-icon" aria-hidden="true"></span><span>위시리스트 모집</span></div>' +
          '<span class="wl-recommend-warning" data-wl-recommend-warning hidden tabindex="0" role="note" aria-label="위시리스트 추천 안내" data-tooltip="해당 위시리스트 추천은 뉴비들의  160벽 돌파,명함 획득을 목표로 제작되었습니다.&#10;니청년~니할배들의  돌파,코강 우선도 체크용으로는 추천하지 않습니다.">필독!</span>' +
          '<button type="button" class="wl-random-test-account-button" data-wl-random-test-account title="무작위 보유·돌파 데이터가 있는 테스트 계정을 생성합니다">무작위 계정 테스트</button>' +
        '</div>' +
        '<details class="wl-random-settings" data-wl-random-settings>' +
          '<summary>무작위 계정 생성 규칙 조절</summary>' +
          '<div class="wl-random-settings-body">' +
            '<div class="wl-random-setting">' +
              '<div class="wl-random-setting-head"><label for="wlRandomOwnedChance">니케 보유 확률</label><output data-wl-random-rule-value="ownedChance">60%</output></div>' +
              '<input id="wlRandomOwnedChance" type="range" min="0" max="100" step="5" value="60" data-wl-random-rule="ownedChance">' +
            '</div>' +
            '<div class="wl-random-setting">' +
              '<div class="wl-random-setting-head"><label for="wlRandomOneChance">1돌 확률</label><output data-wl-random-rule-value="breakthroughOneChance">25%</output></div>' +
              '<input id="wlRandomOneChance" type="range" min="0" max="85" step="5" value="25" data-wl-random-rule="breakthroughOneChance">' +
            '</div>' +
            '<div class="wl-random-setting">' +
              '<div class="wl-random-setting-head"><label for="wlRandomTwoChance">2돌 확률</label><output data-wl-random-rule-value="breakthroughTwoChance">10%</output></div>' +
              '<input id="wlRandomTwoChance" type="range" min="0" max="70" step="5" value="10" data-wl-random-rule="breakthroughTwoChance">' +
            '</div>' +
            '<div class="wl-random-setting">' +
              '<div class="wl-random-setting-head"><label for="wlRandomThreeChance">3돌 확률</label><output data-wl-random-rule-value="breakthroughThreeChance">5%</output></div>' +
              '<input id="wlRandomThreeChance" type="range" min="0" max="65" step="5" value="5" data-wl-random-rule="breakthroughThreeChance">' +
            '</div>' +
            '<div class="wl-random-derived-chance"><span>남는 확률은 0돌에 자동 배정</span><strong data-wl-random-zero-chance>60%</strong></div>' +
          '</div>' +
        '</details>' +
        '<div class="wl-auto-toolbar">' +
          '<button type="button" class="wl-auto-button" data-wl-auto-build>✦ 추천 위시리스트 확인</button>' +
        '</div>' +
        '<div class="wl-company-list" id="wishlistCompanyList"></div>' +
        '<div class="wl-status" id="wishlistSavedStatus">변경 사항 없음</div>' +
        '<div class="wl-footer">' +
          '<button type="button" class="wl-action wl-cancel" data-wl-cancel><span aria-hidden="true">×</span> 취소</button>' +
          '<button type="button" class="wl-action wl-confirm" data-wl-confirm><span aria-hidden="true">✓</span> 결정</button>' +
        '</div>' +
      '</div>' +
      '<aside class="wl-excluded-panel" id="wishlistExcludedPanel" aria-label="제외 캐릭터">' +
        '<button type="button" class="wl-clue-window-button" data-wl-clue-open><span class="wl-clue-window-title">실마 상점 스페어바디 목록</span></button>' +
        '<div class="wl-excluded-head"><div class="wl-excluded-title">제외 캐릭터</div><span class="wl-excluded-count" data-wl-excluded-count>0명</span></div>' +
        '<div class="wl-excluded-note">캐릭터 사진을 눌러 제외 캐릭터로 지정가능합니다</div>' +
        '<div class="wl-excluded-list" data-wl-excluded-list></div>' +
        '<div class="wl-favorite-section">' +
          '<div class="wl-favorite-head"><div class="wl-excluded-title">애정캐</div><span class="wl-favorite-count" data-wl-favorite-count>0명</span></div>' +
           '<div class="wl-favorite-note">캐릭터 사진을 눌러 제외 → 애정캐로 지정할 수 있습니다. 애정캐로 지정한 니케는 반드시 포함됩니다.</div>' +
          '<div class="wl-favorite-list" data-wl-favorite-list></div>' +
        '</div>' +
      '</aside>' +
      '<div class="wl-picker-backdrop" data-wl-picker-backdrop hidden>' +
        '<div class="wl-picker-dialog" role="region" aria-labelledby="wlPickerTitle">' +
          '<div class="wl-picker-head"><h3 class="wl-picker-title" id="wlPickerTitle">니케 상태 설정</h3><input type="search" class="wl-picker-search" data-wl-picker-search placeholder="니케 이름 검색" aria-label="니케 이름 검색" autocomplete="off"><button type="button" class="wl-picker-close" data-wl-picker-close aria-label="접기">×</button></div>' +
          '<div class="wl-picker-grid" data-wl-picker-grid></div>' +
          '<div class="wl-picker-foot"><span>캐릭터를 누를 때마다 기본 → 제외 → 애정캐 → 기본으로 바뀝니다.</span></div>' +
        '</div>' +
      '</div>' +
    '</section>';
    const main = document.querySelector('main.main') || document.querySelector('main');
    if(main){
      const before = main.querySelector('#pediaPanel, #soleScorePanel, #outpostPanel, #characterPanel');
      if(before) main.insertBefore(panel,before);
      else main.appendChild(panel);
      const accountSwitcher = ensureAccountSwitcher();
      if(accountSwitcher) main.insertBefore(accountSwitcher,panel);
    }else{
      document.body.appendChild(panel);
      const accountSwitcher = ensureAccountSwitcher();
      if(accountSwitcher) document.body.insertBefore(accountSwitcher,panel);
    }
    panel.addEventListener('change', onPanelChange);
    panel.addEventListener('click', onPanelClick);
    panel.addEventListener('input', onPanelInput);
    panel.addEventListener('pointerover', onPanelPointerOver);
    panel.addEventListener('pointerout', onPanelPointerOut);
    panel.addEventListener('focusin', onPanelFocusIn);
    panel.addEventListener('focusout', onPanelFocusOut);
    renderRandomAccountRuleControls(panel);
    window.addEventListener('scroll', hideWishlistHoverCard, true);
    window.addEventListener('resize', hideWishlistHoverCard);
    document.addEventListener('keydown', onPickerKeydown);
    document.addEventListener('click', onOutsidePickerClick);
    return panel;
  }

  function buildOptionList(company, slot, characters){
    const selectedElsewhere = new Set(picks[company].filter((name,index) => index !== slot && name).map(norm));
    const current = picks[company][slot] || '';
    let html = '<option value="">니케 선택…</option>';
    characters.forEach(row => {
      const name = String(row['이름'] || '').trim();
      const duplicate = selectedElsewhere.has(norm(name));
      html += '<option value="' + esc(name) + '"' +
        (name === current ? ' selected' : '') +
        (duplicate ? ' disabled' : '') + '>' + esc(name) + '</option>';
    });
    return html;
  }

  const COMPANY_SYMBOLS = {
    '엘리시온':'▦',
    '미실리스':'Ⅱ',
    '테트라':'T',
    '필그림':'✦'
  };

  function buildSlot(company, slot, characters){
    const name = picks[company][slot] || '';
    const isBonusRecruit = !!name && wallStatus === 'X' && WISHLIST_160_WALL_X_PRIORITY_NAMES.has(norm(name));
    const isRoadToVillain = !!name && wallStatus === 'X' && norm(name) === norm('드레이크');
    const unowned = !!name && isMarkedUnowned(name);
    const stage = getBreakthrough(name);
    let tile;
    if(name){
      const image = findImage(name);
      const photo = image
        ? '<img class="wl-picked-image" src="' + esc(image) + '" alt="' + esc(name) + '" draggable="false">'
        : '<span class="wl-photo-fallback" aria-hidden="true">' + esc(name.slice(0,1)) + '</span>';
      const stars = Array.from({length:3},(_,i) =>
        '<span class="' + (i < stage ? 'wl-star-filled' : 'wl-star-empty') + '">' + (i < stage ? '★' : '☆') + '</span>'
      ).join('');
      const core = getCoreEnhancement(name);
      tile = '<div class="wl-tile wl-photo-only">' + photo +
        (unowned ? '' : '<span class="wl-promotion-stars" aria-label="' + stage + '돌파">' + stars + '</span>') +
        (!unowned && core > 0 ? '<span class="wl-core-enhancement" aria-label="코어 강화 +' + core + '">+' + core + '</span>' : '') +
        '</div>';
    }else{
      tile = '<div class="wl-tile wl-empty-tile">' +
        '<div class="wl-empty-mark"><span class="wl-plus">＋</span></div></div>';
    }
    const accessibleName = name ? name + (unowned ? ' · 미보유' : ' · ' + stage + '돌') : '빈 슬롯';
    return '<article class="wl-slot' + (!name ? ' wl-slot-empty' : '') + (name ? ' has-character-name' : '') + (isBonusRecruit ? ' is-bonus-recruit' : '') + (isRoadToVillain ? ' is-road-to-villain' : '') + (unowned ? ' is-unowned' : '') + '" data-wl-slot="true" data-company="' + esc(company) + '"' +
      (name ? ' data-wl-hover-text="' + esc(name) + '"' : '') +
      ' aria-label="' + esc(accessibleName) + '">' +
      tile +
      (unowned ? '<span class="wl-photo-status">미보유</span>' : '') +
      (name ? '<span class="wl-character-name-label">' + esc(name) + '</span>' : '') +
      '</article>';
  }

  function ensureWishlistHoverCard(){
    if(hoverCard && document.body.contains(hoverCard)) return hoverCard;
    hoverCard = document.createElement('div');
    hoverCard.id = 'wishlistHoverCard';
    hoverCard.className = 'wl-hover-card';
    hoverCard.setAttribute('role','tooltip');
    hoverCard.setAttribute('aria-hidden','true');

    const image = document.createElement('div');
    image.className = 'wl-hover-card-image';
    const content = document.createElement('div');
    content.className = 'wl-hover-card-content';
    const name = document.createElement('div');
    name.className = 'wl-hover-card-name';
    const company = document.createElement('div');
    company.className = 'wl-hover-card-company';
    const meta = document.createElement('div');
    meta.className = 'wl-hover-card-meta';
    content.append(name,company,meta);
    hoverCard.append(image,content);
    document.body.appendChild(hoverCard);
    return hoverCard;
  }

  function addWishlistHoverChip(container,label,extraClass){
    const chip = document.createElement('span');
    chip.className = 'wl-hover-card-chip' + (extraClass ? ' ' + extraClass : '');
    chip.textContent = label;
    container.appendChild(chip);
  }

  function positionWishlistHoverCard(anchor,card){
    if(!anchor || !card) return;
    const rect = anchor.getBoundingClientRect();
    const size = card.getBoundingClientRect();
    const margin = 10;
    let left = rect.right + 10;
    if(left + size.width > window.innerWidth - margin) left = rect.left - size.width - 10;
    if(left < margin) left = Math.max(margin,Math.min(window.innerWidth - size.width - margin,rect.left + (rect.width - size.width) / 2));
    let top = rect.top + (rect.height - size.height) / 2;
    top = Math.max(margin,Math.min(top,window.innerHeight - size.height - margin));
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
  }

  function showWishlistHoverCard(target){
    if(!target || !document.body.classList.contains('wishlist-view')) return;
    const slot = target.matches && target.matches('.wl-slot') ? target : null;
    const card = ensureWishlistHoverCard();
    const imageBox = card.querySelector('.wl-hover-card-image');
    const nameLabel = card.querySelector('.wl-hover-card-name');
    const companyLabel = card.querySelector('.wl-hover-card-company');
    const meta = card.querySelector('.wl-hover-card-meta');

    // Keep slot hover hints minimal; the two guidance types get a smaller, UI-matched tooltip.
    card.classList.add('is-compact');
    const isGuidance = !!slot && (slot.classList.contains('is-bonus-recruit') || slot.classList.contains('is-road-to-villain'));
    card.classList.toggle('is-guidance', isGuidance);
    imageBox.replaceChildren();
    meta.replaceChildren();
    imageBox.style.display = 'none';

    if(slot){
      const name = String(slot.getAttribute('data-wl-hover-text') || '').trim();
      if(!name) return hideWishlistHoverCard();
      const isBonusRecruit = slot.classList.contains('is-bonus-recruit');
      const isRoadToVillain = slot.classList.contains('is-road-to-villain');
      if(isBonusRecruit){
        nameLabel.textContent = '보너스 리크루트에 포함된 니케입니다.\n본인의 포인트 상황에 따라 제외 추천';
      }else if(isRoadToVillain){
        nameLabel.textContent = '로드 투 빌런 상시 이벤트로 2돌파 까지 획득 가능한 니케입니다.\n1회라도 직접 획득했다면 제외 추천';
      }else{
        nameLabel.textContent = name;
      }
      nameLabel.style.whiteSpace = (isBonusRecruit || isRoadToVillain) ? 'pre-line' : '';
      companyLabel.textContent = '';
    }else{
      const text = String(target.getAttribute('data-wl-hover-text') || '').trim();
      if(!text) return;
      nameLabel.textContent = text;
      companyLabel.textContent = '';
    }

    hoverCardAnchor = target;
    card.setAttribute('aria-hidden','false');
    card.classList.add('is-visible');
    positionWishlistHoverCard(target,card);
  }

  function hideWishlistHoverCard(){
    if(!hoverCard) return;
    hoverCard.classList.remove('is-visible','is-compact','is-guidance');
    hoverCard.setAttribute('aria-hidden','true');
    hoverCardAnchor = null;
  }

  function findWishlistHoverTarget(target){
    return target && target.closest ? target.closest('[data-wl-hover-text]') : null;
  }

  function onPanelPointerOver(event){
    if(event.pointerType === 'touch') return;
    const slot = event.target && event.target.closest && event.target.closest('.wl-slot');
    if(slot){
      if(event.relatedTarget && slot.contains(event.relatedTarget)) return;
      const name = String(slot.getAttribute('data-wl-hover-text') || '').trim();
      if(name) showWishlistHoverCard(slot);
      else hideWishlistHoverCard();
      return;
    }
    if(event.target && event.target.closest && event.target.closest('.wl-slots')){
      hideWishlistHoverCard();
      return;
    }
    const target = findWishlistHoverTarget(event.target);
    if(!target || (event.relatedTarget && target.contains(event.relatedTarget))) return;
    showWishlistHoverCard(target);
  }

  function onPanelPointerOut(event){
    const target = findWishlistHoverTarget(event.target);
    if(!target || (event.relatedTarget && target.contains(event.relatedTarget))) return;
    hideWishlistHoverCard();
  }

  function onPanelFocusIn(event){
    const slot = event.target && event.target.closest && event.target.closest('.wl-slot');
    if(slot){
      const name = String(slot.getAttribute('data-wl-hover-text') || '').trim();
      if(name) showWishlistHoverCard(slot);
      else hideWishlistHoverCard();
      return;
    }
    if(event.target && event.target.closest && event.target.closest('.wl-slots')){
      hideWishlistHoverCard();
      return;
    }
    const target = findWishlistHoverTarget(event.target);
    if(target) showWishlistHoverCard(target);
  }

  function onPanelFocusOut(event){
    const target = findWishlistHoverTarget(event.target);
    if(!target || (event.relatedTarget && target.contains(event.relatedTarget))) return;
    hideWishlistHoverCard();
  }

  function openCharacterPicker(company, slot){
    if(!COMPANIES.includes(company) || !Number.isInteger(slot) || slot < 0 || slot > 4) return;
    const backdrop = panel && panel.querySelector('[data-wl-picker-backdrop]');
    if(!backdrop) return;
    if(pickerCompany === company && pickerSlot === slot && !backdrop.hidden){
      closeCharacterPicker();
      return;
    }
    pickerCompany = company;
    pickerSlot = slot;
    const companySection = Array.from(panel.querySelectorAll('.wl-company'))
      .find(section => section.dataset.wlCompany === company);
    const slots = companySection && companySection.querySelector('.wl-slots');
    if(!companySection || !slots) return;
    slots.insertAdjacentElement('afterend', backdrop);
    const title = backdrop.querySelector('#wlPickerTitle');
    if(title) title.textContent = company + ' 니케 선택';
    const search = backdrop.querySelector('[data-wl-picker-search]');
    if(search){
      search.value = '';
      search.placeholder = company + ' 니케 이름 검색';
      search.setAttribute('aria-label', company + ' 니케 이름 검색');
    }
    backdrop.hidden = false;
    renderCharacterPicker();
    loadImageMap().then(renderCharacterPicker);
    if(search) search.focus({preventScroll:true});
  }

  function closeCharacterPicker(){
    const backdrop = panel && panel.querySelector('[data-wl-picker-backdrop]');
    if(backdrop){
      backdrop.hidden = true;
      // Keep the picker attached to the wishlist panel so future re-renders can reuse it.
      panel.appendChild(backdrop);
    }
    pickerCompany = null;
    pickerSlot = null;
  }

  function renderCharacterPicker(){
    refreshSyncedOwnedRoster(true);
    if(!pickerCompany || !COMPANIES.includes(pickerCompany) || pickerSlot === null || !panel) return;
    const company = pickerCompany;
    const backdrop = panel.querySelector('[data-wl-picker-backdrop]');
    const grid = backdrop && backdrop.querySelector('[data-wl-picker-grid]');
    const search = backdrop && backdrop.querySelector('[data-wl-picker-search]');
    if(!grid || !backdrop || backdrop.hidden) return;
    const query = norm(search ? search.value : '');
    const characters = getCharactersForCompany(company).filter(row => {
      const name = String(row['이름'] || '').trim();
      return name && (!query || norm(name).includes(query));
    }).sort((a,b) => compareWishlistPickerOrderForCompany(a,b,company));
    if(!characters.length){
      grid.innerHTML = '<div class="wl-picker-empty">검색 결과가 없습니다.</div>';
      return;
    }
    const unownedCharacters = characters.filter(row => isMarkedUnowned(String(row['이름'] || '').trim()));
    const ownedCharacters = characters.filter(row => !isMarkedUnowned(String(row['이름'] || '').trim()));
    const renderPickerItems = rows => rows.map(row => {
      const name = String(row['이름'] || '').trim();
      const image = findImage(name);
      const unowned = isMarkedUnowned(name);
      const breakthrough = getBreakthrough(name);
      const core = getCoreEnhancement(name);
      const manualExcluded = isManuallyExcludedCharacter(name);
      const favorite = isFavoriteCharacter(name);
      const status = manualExcluded ? 'excluded' : favorite ? 'favorite' : 'normal';
      const automaticReason = getAutomaticExclusionReason(name);
      const photo = image
        ? '<img src="' + esc(image) + '" alt="" loading="lazy" draggable="false">'
        : '<span class="wl-picker-placeholder">' + esc(name.slice(0,1)) + '</span>';
      const stars = Array.from({length:3},(_,i) =>
        '<span class="' + (i < breakthrough ? 'wl-star-filled' : 'wl-star-empty') + '">' + (i < breakthrough ? '★' : '☆') + '</span>'
      ).join('');
      const statusLabel = status === 'excluded' ? '제외' : status === 'favorite' ? '애정캐' : '기본';
      const marker = status === 'excluded'
        ? '<span class="wl-picker-state-marker" aria-label="제외">제외</span>'
        : status === 'favorite'
          ? '<span class="wl-picker-state-marker is-favorite" aria-label="애정캐">애정캐</span>'
          : '';
      const statusHint = unowned ? ' · 미보유' : '';
      const autoHint = automaticReason ? ' · ' + automaticReason : '';
      const statusClasses = (status === 'excluded' ? ' is-manual-excluded' : '') +
        (status === 'favorite' ? ' is-favorite' : '');
      const photoWithStatus = '<span class="wl-picker-image-wrap">' + photo +
        (unowned ? '' : '<span class="wl-promotion-stars" aria-label="' + breakthrough + '돌파">' + stars + '</span>') +
        (!unowned && core > 0 ? '<span class="wl-core-enhancement" aria-label="코어 강화 +' + core + '">+' + core + '</span>' : '') +
        marker +
        '</span>' + (unowned ? '<span class="wl-picker-unowned">미보유</span>' : '');
      return '<div class="wl-picker-item' + statusClasses + (unowned ? ' is-unowned' : '') + '">' +
        '<button type="button" class="wl-picker-choice" data-wl-status-name="' + esc(name) + '" aria-label="' +
          esc(name + ', 현재 상태 ' + statusLabel + statusHint + autoHint + '. 누르면 다음 상태로 변경') + '">' +
          '<span class="wl-picker-photo">' + photoWithStatus + '</span>' +
          '<span class="wl-picker-name">' + esc(name) + '</span>' +
        '</button>' +
      '</div>';
    }).join('');
    const unownedHtml = renderPickerItems(unownedCharacters);
    const ownedHtml = renderPickerItems(ownedCharacters);
    grid.innerHTML =
      unownedHtml +
      (unownedCharacters.length && ownedCharacters.length ? '<div class="wl-picker-group-divider" aria-hidden="true"></div>' : '') +
      ownedHtml;
  }


  const RANDOM_ACCOUNT_RULES_STORAGE_KEY = 'nikke_random_test_account_rules_v1';
  const RANDOM_ACCOUNT_RULE_DEFAULTS = {
    ownedChance:60,
    breakthroughOneChance:25,
    breakthroughTwoChance:10,
    breakthroughThreeChance:5
  };

  function clampRandomPercent(value, min=0, max=100){
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
  }

  function sanitizeRandomAccountRuleValues(source){
    const values = Object.assign({},RANDOM_ACCOUNT_RULE_DEFAULTS,source || {});
    const one = clampRandomPercent(values.breakthroughOneChance);
    const two = clampRandomPercent(values.breakthroughTwoChance,0,100-one);
    const three = clampRandomPercent(values.breakthroughThreeChance,0,100-one-two);
    return {
      ownedChance:clampRandomPercent(values.ownedChance),
      breakthroughOneChance:one,
      breakthroughTwoChance:two,
      breakthroughThreeChance:three
    };
  }

  function loadRandomAccountRuleValues(){
    let saved = {};
    try{
      saved = JSON.parse(localStorage.getItem(RANDOM_ACCOUNT_RULES_STORAGE_KEY) || '{}') || {};
    }catch(_){}
    return sanitizeRandomAccountRuleValues(saved);
  }

  function publishRandomAccountRuleValues(values){
    const normalized = sanitizeRandomAccountRuleValues(values);
    const one = normalized.breakthroughOneChance;
    const two = normalized.breakthroughTwoChance;
    const three = normalized.breakthroughThreeChance;
    window.NIKKE_RANDOM_ACCOUNT_RULES = {
      ownedChance:normalized.ownedChance,
      breakthroughWeights:{
        zero:Math.max(0,100-one-two-three),
        one:one,
        two:two,
        three:three
      }
    };
    return normalized;
  }

  function renderRandomAccountRuleControls(root, sourceValues){
    if(!root) return;
    const section = root.querySelector('[data-wl-random-settings]');
    if(!section) return;
    const values = publishRandomAccountRuleValues(sourceValues || loadRandomAccountRuleValues());
    section.querySelectorAll('[data-wl-random-rule]').forEach(input => {
      const key = input.dataset.wlRandomRule;
      if(Object.prototype.hasOwnProperty.call(values,key)) input.value = String(values[key]);
    });
    const one = values.breakthroughOneChance;
    const two = values.breakthroughTwoChance;
    const three = values.breakthroughThreeChance;
    const maxByKey = {
      breakthroughOneChance:100-two-three,
      breakthroughTwoChance:100-one-three,
      breakthroughThreeChance:100-one-two
    };
    section.querySelectorAll('[data-wl-random-rule]').forEach(input => {
      const key = input.dataset.wlRandomRule;
      if(Object.prototype.hasOwnProperty.call(maxByKey,key)) input.max = String(maxByKey[key]);
      const output = section.querySelector('[data-wl-random-rule-value="' + key + '"]');
      if(output) output.textContent = values[key] + '%';
    });
    const zeroOutput = section.querySelector('[data-wl-random-zero-chance]');
    if(zeroOutput) zeroOutput.textContent = Math.max(0,100-one-two-three) + '%';
  }

  function updateRandomAccountRuleControls(root, changedInput){
    if(!root || !changedInput) return;
    const section = root.querySelector('[data-wl-random-settings]');
    if(!section) return;
    const values = {};
    section.querySelectorAll('[data-wl-random-rule]').forEach(input => {
      values[input.dataset.wlRandomRule] = Number(input.value);
    });
    const normalized = sanitizeRandomAccountRuleValues(values);
    renderRandomAccountRuleControls(root,normalized);
    const savedValues = {
      ownedChance:normalized.ownedChance,
      breakthroughOneChance:normalized.breakthroughOneChance,
      breakthroughTwoChance:normalized.breakthroughTwoChance,
      breakthroughThreeChance:normalized.breakthroughThreeChance
    };
    try{localStorage.setItem(RANDOM_ACCOUNT_RULES_STORAGE_KEY,JSON.stringify(savedValues));}catch(_){}
  }

  function onPanelInput(event){
    if(event.target && event.target.matches && event.target.matches('[data-wl-picker-search]')){
      renderCharacterPicker();
      return;
    }
    const ruleInput = event.target && event.target.closest && event.target.closest('[data-wl-random-rule]');
    if(ruleInput) updateRandomAccountRuleControls(panel,ruleInput);
  }

  function onPickerKeydown(event){
    if(event.key === 'Escape' && pickerSlot !== null) closeCharacterPicker();
  }

  function onOutsidePickerClick(event){
    if(pickerSlot === null || !pickerCompany || !panel) return;
    const backdrop = panel.querySelector('[data-wl-picker-backdrop]');
    if(!backdrop || backdrop.hidden || backdrop.contains(event.target)) return;
    // Opening clicks from either a slot tile or the row-wide target must not immediately close the picker.
    if(event.target && event.target.closest && event.target.closest('.wl-slot, .wl-row-select-trigger')) return;
    closeCharacterPicker();
  }

  async function autoBuildWishlist(){
    const rarityLoaded = await ensureRarityData();
    if(!rarityLoaded){
      alert('SSR 등급 정보를 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
      return;
    }
    const current = normalizePicksToEligibleSSR(picks);
    if(current.changed){
      picks = current.picks;
      savedPicks = clonePicks(picks);
      savePicks();
    }
    const all = getAllCharacters();
    if(!all.length){
      alert('캐릭터 데이터를 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
      return;
    }
    const overLimitFavorites = STANDARD_PRIORITY_COMPANIES.map(company => ({
      company,
      names: getCharactersForCompany(company)
        .map(row => String(row['이름'] || '').trim())
        .filter(name => isFavoriteCharacter(name) && getCoreEnhancement(name) < 7 && !isManuallyExcludedCharacter(name))
    })).find(item => item.names.length > 5);
    if(overLimitFavorites){
      alert(overLimitFavorites.company + '의 애정캐가 ' + overLimitFavorites.names.length +
        '명이라 위시리스트 5칸을 초과했습니다. 애정캐를 5명 이하로 줄인 뒤 다시 자동 편성해 주세요.');
      return;
    }
    // 160-wall X: mandatory and mandatory-treasure characters must all fit in the wishlist,
    // except characters already at 3 breakthroughs. Stop rather than silently dropping any of them.
    if(wallStatus === 'X'){
      const overLimitMandatory = STANDARD_PRIORITY_COMPANIES.map(company => ({
        company,
        names: getCharactersForCompany(company)
          .map(row => String(row['이름'] || '').trim())
          .filter(name => {
            const key = norm(name);
            const isNamedPriority = WISHLIST_160_WALL_X_PRIORITY_NAMES.has(key);
            const isUnownedRequired = isMarkedUnowned(name) &&
              (WISHLIST_REQUIRED_NAMES.has(key) || WISHLIST_TREASURE_REQUIRED_NAMES.has(key) || WISHLIST_UNOWNED_REQUIRED_OVERRIDE_NAMES.has(key));
            return !isManuallyExcludedCharacter(name) && (isNamedPriority || isUnownedRequired) && getBreakthrough(name) < 3;
          })
      })).find(item => item.names.length > 5);
      if(overLimitMandatory){
        alert(overLimitMandatory.company + '의 160벽 X 우선 포함 대상이 ' + overLimitMandatory.names.length +
          '명이라 위시리스트 5칸을 초과했습니다. 3돌 이상은 제외되며, 우선 포함 대상 수를 확인해 주세요.');
        return;
      }
    }
    // Build only standard companies here. Pilgrim is managed by an independent rule path;
    // keep its current/manual picks untouched until its dedicated auto-build rules are added.
    STANDARD_PRIORITY_COMPANIES.forEach(company => {
      const candidates = getCharactersForCompany(company)
        .filter(row => {
          const name = String(row['이름'] || '').trim();
          const key = norm(name);
          const isTreasureRequired = WISHLIST_TREASURE_REQUIRED_NAMES.has(key);
          const isCollection = WISHLIST_COLLECTION_NAMES.has(key) || !WISHLIST_TRACKED_NAMES.has(key);
          const favorite = isFavoriteCharacter(name);
          const unowned = isMarkedUnowned(name);
          const breakthrough = getBreakthrough(name);
          const isRequired = WISHLIST_REQUIRED_NAMES.has(key) || (WISHLIST_UNOWNED_REQUIRED_OVERRIDE_NAMES.has(key) && unowned);
          // Rule 2: the five named targets are forced in below 3 breakthroughs regardless of ownership.
          // Rule 3: company-required and mandatory-treasure characters are forced in only while unowned.
          // Once a first copy is owned, they leave rule 3 and are ranked by rule 4 instead.
          const is160WallXPriorityTarget = WISHLIST_160_WALL_X_PRIORITY_NAMES.has(key);
          const isUnownedRequired160WallX = unowned && (isRequired || isTreasureRequired);
          const forceInclude160WallX = wallStatus === 'X' &&
            (is160WallXPriorityTarget || isUnownedRequired160WallX);
          // In 160-wall X + namecard preference step 2, 2-breakthrough silver-mileage
          // characters remain eligible even if their ordinary category is collection-only.
          const is160WallXSilverMileageTwoBreakthrough =
            wallStatus === 'X' && copyPriority === 1 && SILVER_MILEAGE_NAMES.has(key) && breakthrough === 2;

          // 160-wall X always excludes 3-breakthrough characters.
          if(wallStatus === 'X' && breakthrough >= 3) return false;
          if(getCoreEnhancement(name) >= 7 && !forceInclude160WallX) return false;
          // Stage 1 mandatory characters bypass manual exclusion; X's forced mandatory targets do too.
          if(isManuallyExcludedCharacter(name)) return false;
          // O retains the existing acquisition-stage rule. X evaluates owned copies independently.
          if(wallStatus !== 'X' && copyPriority !== 0 && isRequired && !unowned) return false;
          // 2★+ treasure characters stay eligible; their priority is moved behind first-copy targets.
          // Collection-only candidates are stage 3 only, except X's forced mandatory targets.
          if(isCollection && copyPriority !== 2 && !forceInclude160WallX && !is160WallXSilverMileageTwoBreakthrough) return false;
          if(shouldExcludeFromAutoWishlist(name) && !forceInclude160WallX && !is160WallXSilverMileageTwoBreakthrough) return false;
          return true;
        });

      candidates.sort((a,b) => {
        const aName = String(a['이름'] || '').trim();
        const bName = String(b['이름'] || '').trim();
        const aBreakthrough = getBreakthrough(aName);
        const bBreakthrough = getBreakthrough(bName);
        const aUnowned = isMarkedUnowned(aName);
        const bUnowned = isMarkedUnowned(bName);
        // 160-wall X tiers: Rule 2 named targets > Rule 3 unowned required/mandatory-treasure targets > Rule 4 breakthrough priority.
        // Rule 4 uses the visible silver-mileage list; non-silver characters only enter Rule 4 at 2★,
        // and only when they are not already in Rule 3. O mode keeps the existing ordering unchanged.
        if(wallStatus === 'X'){
          const aNamedPriority160WallX = WISHLIST_160_WALL_X_PRIORITY_NAMES.has(norm(aName));
          const bNamedPriority160WallX = WISHLIST_160_WALL_X_PRIORITY_NAMES.has(norm(bName));
          if(aNamedPriority160WallX !== bNamedPriority160WallX) return aNamedPriority160WallX ? -1 : 1;

          const aMustInclude160WallX = aUnowned &&
            (WISHLIST_REQUIRED_NAMES.has(norm(aName)) || WISHLIST_TREASURE_REQUIRED_NAMES.has(norm(aName)) || WISHLIST_UNOWNED_REQUIRED_OVERRIDE_NAMES.has(norm(aName)));
          const bMustInclude160WallX = bUnowned &&
            (WISHLIST_REQUIRED_NAMES.has(norm(bName)) || WISHLIST_TREASURE_REQUIRED_NAMES.has(norm(bName)) || WISHLIST_UNOWNED_REQUIRED_OVERRIDE_NAMES.has(norm(bName)));
          if(aMustInclude160WallX !== bMustInclude160WallX) return aMustInclude160WallX ? -1 : 1;

          const aSilverMileage = SILVER_MILEAGE_NAMES.has(norm(aName));
          const bSilverMileage = SILVER_MILEAGE_NAMES.has(norm(bName));
          // Only owned silver-mileage characters already at 1★/2★ get the special Rule 4 boost.
          // Unowned candidates use their normal character-priority rules, regardless of silver-list membership.
          const aRule4Priority = !aUnowned && ((aSilverMileage && aBreakthrough > 0) || (!aMustInclude160WallX && aBreakthrough === 2));
          const bRule4Priority = !bUnowned && ((bSilverMileage && bBreakthrough > 0) || (!bMustInclude160WallX && bBreakthrough === 2));
          if(aRule4Priority !== bRule4Priority) return aRule4Priority ? -1 : 1;
          if(aRule4Priority && bRule4Priority && aBreakthrough !== bBreakthrough){
            return bBreakthrough - aBreakthrough;
          }
        }
        const aGroup = getWishlistAutoBuildPriority(aName,copyPriority,aBreakthrough,aUnowned);
        const bGroup = getWishlistAutoBuildPriority(bName,copyPriority,bBreakthrough,bUnowned);
        if(aGroup !== bGroup) return aGroup - bGroup;

        // Preserve the original treasure-target and owned-copy breakthrough tiebreakers in O mode.
        // Under 160-wall X, breakthrough ranking is handled explicitly by Rule 4 above; do not
        // let these fallback comparisons promote non-silver 0★/1★ characters.
        if(aGroup === 2 || aGroup === 5){
          if(wallStatus !== 'X' && aBreakthrough !== bBreakthrough) return bBreakthrough - aBreakthrough;
          if(aUnowned !== bUnowned) return aUnowned ? 1 : -1;
        }else{
          // On acquisition groups, missing first copies come before owned copies.
          if(aGroup < 10 && aUnowned !== bUnowned) return aUnowned ? -1 : 1;
          if(wallStatus !== 'X' && !aUnowned && !bUnowned && aBreakthrough !== bBreakthrough) return bBreakthrough - aBreakthrough;
        }

        const aFavorite = isFavoriteCharacter(aName);
        const bFavorite = isFavoriteCharacter(bName);
        if(aFavorite !== bFavorite) return aFavorite ? -1 : 1;

        const aBasePriority = getWishlistPerformancePriority(aName);
        const bBasePriority = getWishlistPerformancePriority(bName);
        if(aBasePriority !== bBasePriority) return aBasePriority - bBasePriority;
        const aPosition = getWishlistPerformancePosition(aName);
        const bPosition = getWishlistPerformancePosition(bName);
        if(aPosition && bPosition && aPosition.tierOrder !== bPosition.tierOrder) return aPosition.tierOrder - bPosition.tierOrder;
        if(aPosition && bPosition && aPosition.index !== bPosition.index) return aPosition.index - bPosition.index;
        if(aPosition && !bPosition) return -1;
        if(!aPosition && bPosition) return 1;
        return aName.localeCompare(bName,'ko');
      });
      picks[company] = candidates.slice(0,5).map(row => String(row['이름'] || '').trim());
      while(picks[company].length < 5) picks[company].push('');
    });

    // Pilgrim follows the same independent rule for 160-wall O and X.
    // Copy preference stage 1 uses the priority sequence only through the standard Snow White entry;
    // stages 2 and 3 use the complete Pilgrim priority sequence, independent of PVP preference.
    const pilgrimPriorityNames = getPilgrimWishlistPriorityNames();
    const snowWhiteIndex = copyPriority === 0
      ? pilgrimPriorityNames.findIndex(name => norm(name) === norm('스노우 화이트'))
      : -1;
    const pilgrimTargetNames = copyPriority === 0 && snowWhiteIndex >= 0
      ? pilgrimPriorityNames.slice(0, snowWhiteIndex + 1)
      : pilgrimPriorityNames.slice();
    const pilgrimPriorityIndex = new Map(pilgrimTargetNames.map((name,index) => [norm(name),index]));

    // Keep manually excluded Pilgrim characters out of both the normal list and its restart cycle.
    const pilgrimPriorityRows = getCharactersForCompany(PILGRIM_COMPANY)
      .filter(row => {
        const name = String(row['이름'] || '').trim();
        // Keep the core-enhancement-7 exclusion active even when the all-owned cycle restarts.
        return pilgrimPriorityIndex.has(norm(name)) &&
          !isManuallyExcludedCharacter(name) &&
          getCoreEnhancement(name) < 7;
      })
      .sort((a,b) => {
        const aName = String(a['이름'] || '').trim();
        const bName = String(b['이름'] || '').trim();
        return pilgrimPriorityIndex.get(norm(aName)) - pilgrimPriorityIndex.get(norm(bName));
      });

    // Use the same account-specific synced ownership source for Pilgrim as for every other company.
    const isPilgrimMarkedUnowned = name => isMarkedUnowned(name);

    // Prefer missing first copies in priority order, then wrap to the top to fill remaining slots.
    // This prevents empty slots when fewer than five eligible unowned targets remain.
    const pilgrimCandidates = pilgrimPriorityRows.filter(row =>
      isPilgrimMarkedUnowned(String(row['이름'] || '').trim())
    );
    const selectedPilgrimNames = new Set(pilgrimCandidates.map(row => norm(String(row['이름'] || '').trim())));
    for(const row of pilgrimPriorityRows){
      if(pilgrimCandidates.length >= 5) break;
      const name = String(row['이름'] || '').trim();
      const key = norm(name);
      if(!selectedPilgrimNames.has(key)){
        pilgrimCandidates.push(row);
        selectedPilgrimNames.add(key);
      }
    }

    picks[PILGRIM_COMPANY] = pilgrimCandidates.slice(0,5).map(row => String(row['이름'] || '').trim());
    while(picks[PILGRIM_COMPANY].length < 5) picks[PILGRIM_COMPANY].push('');

    renderWishlist();
  }

  function renderWishlist(){
    refreshSyncedOwnedRoster(true);
    hideWishlistHoverCard();
    const activePanel = ensurePanel();
    if(!activePanel) return;
    const list = activePanel.querySelector('#wishlistCompanyList');
    if(!list) return;
    const all = getAllCharacters();
    if(!all.length){
      list.innerHTML = '<div class="wl-note">캐릭터 데이터를 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.</div>';
      return;
    }
    if(!rarityDataReady){
      list.innerHTML = '<div class="wl-note">SSR 등급 정보를 불러오는 중…</div>';
      ensureRarityData().then(loaded => {
        if(!document.body.classList.contains('wishlist-view')) return;
        if(!loaded){
          const currentList = document.getElementById('wishlistCompanyList');
          if(currentList) currentList.innerHTML = '<div class="wl-note">SSR 등급 정보를 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.</div>';
          return;
        }
        renderWishlist();
      });
      return;
    }
    const eligibility = normalizePicksToEligibleSSR(picks);
    if(eligibility.changed){
      picks = eligibility.picks;
      savedPicks = clonePicks(picks);
      savePicks();
    }
    // Preserve an open inline picker when the company list needs to be redrawn.
    const pickerBackdrop = activePanel.querySelector('[data-wl-picker-backdrop]');
    const pickerWasOpen = !!(pickerBackdrop && !pickerBackdrop.hidden && pickerCompany && pickerSlot !== null);
    const pickerSearch = pickerBackdrop && pickerBackdrop.querySelector('[data-wl-picker-search]');
    const pickerSearchValue = pickerSearch ? pickerSearch.value : '';
    if(pickerBackdrop){
      pickerBackdrop.hidden = true;
      activePanel.appendChild(pickerBackdrop);
    }
    list.innerHTML = COMPANIES.map(company => {
      const characters = getCharactersForCompany(company);
      return '<section class="wl-company" data-wl-company="' + esc(company) + '">' +
        '<div class="wl-company-head">' +
          '<div class="wl-company-brand"><span class="wl-company-symbol" aria-hidden="true"></span>' +
          '<span class="wl-company-name">' + esc(company) + '</span></div>' +
        '</div>' +
        '<div class="wl-slots">' + Array.from({length:5},(_,slot) => buildSlot(company,slot,characters)).join('') +
          '<button type="button" class="wl-row-select-trigger" data-company="' + esc(company) + '" aria-label="' + esc(company + ' 위시리스트 5칸 선택') + '"></button>' +
        '</div>' +
      '</section>';
    }).join('');
    if(pickerWasOpen && pickerBackdrop){
      const openedCompany = Array.from(list.querySelectorAll('.wl-company'))
        .find(section => section.dataset.wlCompany === pickerCompany);
      const openedSlots = openedCompany && openedCompany.querySelector('.wl-slots');
      if(openedSlots){
        openedSlots.insertAdjacentElement('afterend', pickerBackdrop);
        const nextSearch = pickerBackdrop.querySelector('[data-wl-picker-search]');
        if(nextSearch) nextSearch.value = pickerSearchValue;
        pickerBackdrop.hidden = false;
        renderCharacterPicker();
      }else{
        pickerCompany = null;
        pickerSlot = null;
      }
    }
    renderExcludedCharacters();
    const status = activePanel.querySelector('#wishlistSavedStatus');
    const changed = JSON.stringify(picks) !== JSON.stringify(savedPicks) ||
      JSON.stringify(excludedCharacters) !== JSON.stringify(savedExcludedCharacters) ||
      JSON.stringify(favoriteCharacters) !== JSON.stringify(savedFavoriteCharacters);
    if(status) status.textContent = (changed ? '변경 사항 있음 · 결정 버튼을 눌러 저장' : '저장된 위시리스트') +
      ' · ' + COMPANIES.reduce((sum,company) => sum + picks[company].filter(Boolean).length,0) + ' / 20명' +
      ' · 제외 ' + excludedCharacters.length + '명 · 애정캐 ' + favoriteCharacters.length + '명';
    updateRecommendedWarning();
  }

  function updateRecommendedWarning(){
    const warning = panel && panel.querySelector('[data-wl-recommend-warning]');
    if(!warning) return;
    const recommendedNames = COMPANIES.flatMap(company =>
      (Array.isArray(picks[company]) ? picks[company] : []).map(name => String(name || '').trim()).filter(Boolean)
    );
    const allRecommendedOwned = recommendedNames.length > 0 && recommendedNames.every(name => !isMarkedUnowned(name));
    const roster = getAllCharacters();
    const threeBreakthroughCount = roster.reduce((count,row) => {
      const name = String(row && row['이름'] || '').trim();
      return count + (name && getBreakthrough(name) >= 3 ? 1 : 0);
    },0);
    const hasCoreSeven = roster.some(row => {
      const name = String(row && row['이름'] || '').trim();
      return !!name && getCoreEnhancement(name) >= 7;
    });
    warning.hidden = !(allRecommendedOwned || threeBreakthroughCount >= 9 || hasCoreSeven);
  }

  function renderExcludedCharacters(){
    const pane = panel && panel.querySelector('#wishlistExcludedPanel');
    const list = pane && pane.querySelector('[data-wl-excluded-list]');
    const count = pane && pane.querySelector('[data-wl-excluded-count]');
    const favoriteList = pane && pane.querySelector('[data-wl-favorite-list]');
    const favoriteCount = pane && pane.querySelector('[data-wl-favorite-count]');
    if(!pane || !list || !favoriteList) return;
    const automaticNames = getAllCharacters()
      .map(row => String(row && row['이름'] || '').trim())
      .filter(name => name && !!getAutomaticExclusionReason(name));
    const combined = [];
    const seen = new Set();
    [...excludedCharacters,...automaticNames].forEach(name => {
      const key = norm(name);
      if(name && !seen.has(key)){
        seen.add(key);
        combined.push(name);
      }
    });
    if(count) count.textContent = combined.length + '명';
    const all = getAllCharacters();
    const companyOrder = new Map(COMPANIES.map((company,index) => [company,index]));
    const rows = combined.map(name => {
      const row = all.find(item => norm(item['이름']) === norm(name));
      const automaticReason = getAutomaticExclusionReason(name);
      const manual = isManuallyExcludedCharacter(name);
      return {name,company:row ? String(row['기업'] || '') : '기업 미상',automaticOnly:!!automaticReason && !manual,automaticReason};
    }).sort((a,b) =>
      (companyOrder.get(a.company) ?? 99) - (companyOrder.get(b.company) ?? 99) ||
      a.name.localeCompare(b.name,'ko')
    );

    const core7Rows = rows.filter(row => row.automaticOnly && row.automaticReason === '코어 강화 7 자동 제외');
    const core7Names = new Set(core7Rows.map(row => norm(row.name)));
    const visibleRows = rows.filter(row => !core7Names.has(norm(row.name)));
    const core7Group = core7Rows.length
      ? '<details class="wl-core7-group">' +
          '<summary><span class="wl-core7-label">코어 강화 +7 캐릭터</span>' +
          '<span class="wl-core7-count">+' + core7Rows.length + '명</span>' +
          '<span class="wl-core7-chevron" aria-hidden="true">⌄</span></summary>' +
          '<div class="wl-core7-items">' +
            core7Rows.map(row =>
              '<div class="wl-core7-item"><span class="wl-core7-company">' + esc(row.company) + '</span>' +
              '<span class="wl-core7-name">' + esc(row.name) + '</span></div>'
            ).join('') +
          '</div></details>'
      : '';
    if(!rows.length){
      list.innerHTML = '';
    }else{
      list.innerHTML = core7Group + visibleRows.map(row => {
        const isMiranda = norm(row.name) === norm('미란다');
        const explanation = '시공증 미보유 버프 캐릭터로, 돌파로 인한 데미지 증가량이 미미함.';
        return '<div class="wl-excluded-row' + (isMiranda ? ' is-miranda' : '') + '">' +
          (isMiranda ? '<span class="wl-excluded-info" data-tooltip="' + esc(explanation) + '" tabindex="0" role="note" aria-label="미란다 설명">i</span>' : '') +
          '<div class="wl-excluded-identity"><span class="wl-excluded-company">' + esc(row.company) + '</span>' +
          '<span class="wl-excluded-name">' + esc(row.name) + '</span>' +
          (row.automaticOnly ? '<span class="wl-excluded-reason">' + esc(row.automaticReason) + '</span>' : '') + '</div>' +
          (row.automaticOnly
            ? '<span class="wl-auto-exclusion-pill" data-wl-hover-text="' + esc(row.automaticReason) + '">자동 제외</span>'
            : '<button type="button" class="wl-include-button" data-wl-include-name="' + esc(row.name) + '" data-wl-hover-text="' + esc(row.name + ' 자동편성 제외 해제') + '">해제</button>') +
        '</div>';
      }).join('');
    }

    const favoriteRows = favoriteCharacters.map(name => {
      const row = all.find(item => norm(item['이름']) === norm(name));
      return {name,company:row ? String(row['기업'] || '') : '기업 미상',core:getCoreEnhancement(name)};
    }).sort((a,b) =>
      (companyOrder.get(a.company) ?? 99) - (companyOrder.get(b.company) ?? 99) ||
      a.name.localeCompare(b.name,'ko')
    );
    if(favoriteCount) favoriteCount.textContent = favoriteRows.length + '명';
    favoriteList.innerHTML = favoriteRows.length ? favoriteRows.map(row =>
      '<div class="wl-favorite-row">' +
        '<div class="wl-excluded-identity"><span class="wl-excluded-company">' + esc(row.company) + '</span>' +
        '<span class="wl-excluded-name">' + esc(row.name) + '</span>' +
        (row.core >= 7 ? '<span class="wl-excluded-reason">코강 +7 · 자동 추천 제외</span>' : '') + '</div>' +
        '<button type="button" class="wl-favorite-remove" data-wl-favorite-clear="' + esc(row.name) + '" aria-label="' + esc(row.name + ' 애정캐 해제') + '">해제</button>' +
      '</div>'
    ).join('') : '';
  }

  function onPanelChange(event){
    const select = event.target.closest && event.target.closest('.wl-select');
    if(!select) return;
    const company = select.dataset.company;
    const slot = Number(select.dataset.slot);
    if(!COMPANIES.includes(company) || !Number.isInteger(slot) || slot < 0 || slot > 4) return;
    const name = String(select.value || '').trim();
    if(name && !isEligibleWishlistName(name, company)){
      renderWishlist();
      return;
    }
    if(name && picks[company].some((value,index) => index !== slot && norm(value) === norm(name))){
      renderWishlist();
      return;
    }
    picks[company][slot] = name;
    renderWishlist();
  }

  function onPanelClick(event){
    const clueOpenButton = event.target.closest && event.target.closest('[data-wl-clue-open]');
    if(clueOpenButton){
      event.preventDefault();
      openClueListModal();
      return;
    }
    const randomTestButton = event.target.closest && event.target.closest('[data-wl-random-test-account]');
    if(randomTestButton){
      if(typeof window.createRandomTestAccount === 'function') window.createRandomTestAccount();
      else alert('테스트 계정 기능을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
      return;
    }
    const autoBuildButton = event.target.closest && event.target.closest('[data-wl-auto-build]');
    if(autoBuildButton){
      autoBuildWishlist();
      return;
    }
    const closePicker = event.target.closest && event.target.closest('[data-wl-picker-close]');
    const backdrop = event.target.closest && event.target.closest('[data-wl-picker-backdrop]');
    if(closePicker || (backdrop && event.target === backdrop)){
      closeCharacterPicker();
      return;
    }
    const statusCharacter = event.target.closest && event.target.closest('[data-wl-status-name]');
    if(statusCharacter){
      event.stopPropagation();
      const name = String(statusCharacter.dataset.wlStatusName || '').trim();
      if(name){
        cycleCharacterStatus(name);
        renderWishlist();
      }
      return;
    }
    const includeButton = event.target.closest && event.target.closest('[data-wl-include-name]');
    if(includeButton){
      const name = String(includeButton.dataset.wlIncludeName || '').trim();
      if(name){
        const key = norm(name);
        excludedCharacters = excludedCharacters.filter(value => norm(value) !== key);
        renderWishlist();
      }
      return;
    }
    const favoriteClear = event.target.closest && event.target.closest('[data-wl-favorite-clear]');
    if(favoriteClear){
      const name = String(favoriteClear.dataset.wlFavoriteClear || '').trim();
      if(name){
        const key = norm(name);
        favoriteCharacters = favoriteCharacters.filter(value => norm(value) !== key);
        renderWishlist();
      }
      return;
    }
    const slotTile = event.target.closest && event.target.closest('.wl-slot');
    const rowTrigger = event.target.closest && event.target.closest('.wl-row-select-trigger');
    const slotCompany = slotTile ? slotTile.dataset.company : (rowTrigger ? rowTrigger.dataset.company : '');
    if(slotCompany && COMPANIES.includes(slotCompany) && (slotTile || rowTrigger)){
      hideWishlistHoverCard();
      event.preventDefault();
      openCharacterPicker(slotCompany, 0);
      return;
    }
    const cancel = event.target.closest && event.target.closest('[data-wl-cancel]');
    if(cancel){
      cancelWishlist();
      return;
    }
    const confirmButton = event.target.closest && event.target.closest('[data-wl-confirm]');
    if(confirmButton){
      if(!savePicks()){
        alert('위시리스트를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');
        return;
      }
      renderWishlist();
      return;
    }
    const button = event.target.closest && event.target.closest('[data-wl-clear-company]');
    if(!button) return;
    const company = button.dataset.wlClearCompany;
    if(!COMPANIES.includes(company)) return;
    picks[company] = Array(5).fill('');
    renderWishlist();
  }

  function cancelWishlist(){
    picks = clonePicks(savedPicks);
    excludedCharacters = savedExcludedCharacters.slice();
    favoriteCharacters = savedFavoriteCharacters.slice();
    renderWishlist();
    if(pickerSlot !== null) renderCharacterPicker();
  }

  // Align the fixed settings card with the wishlist panel when opened. It does not move on scroll.
  function alignWishlistControlPosition(){
    const control = document.getElementById('wishlist160WallControl');
    const panel = document.getElementById('wishlistPanel');
    if(!control || !panel || panel.hidden) return;
    if(window.innerWidth <= 1080){
      control.style.removeProperty('left');
      control.style.removeProperty('top');
      return;
    }
    const rect = panel.getBoundingClientRect();
    if(!rect.width) return;
    control.style.left = Math.max(8, rect.left - control.offsetWidth - 16) + 'px';
    control.style.top = Math.max(8, rect.top) + 'px';
  }

  function hideWishlist(){
    hideWishlistHoverCard();
    const activePanel = document.getElementById('wishlistPanel');
    if(activePanel) activePanel.hidden = true;
    const switcher = document.getElementById('wishlistAccountSwitcher');
    if(switcher) switcher.hidden = true;
    document.body.classList.remove('wishlist-view');
    render160WallControl();
  }

  function showWishlist(){
    picks = clonePicks(loadPicks());
    savedPicks = clonePicks(picks);
    excludedCharacters = loadExcludedCharacters();
    savedExcludedCharacters = excludedCharacters.slice();
    favoriteCharacters = loadFavoriteCharacters();
    savedFavoriteCharacters = favoriteCharacters.slice();
    const activePanel = ensurePanel();
    if(!activePanel) return;
    activePanel.hidden = false;
    document.body.classList.remove('outpost-view','sole-view','drop-rate-view','pedia-view');
    document.body.classList.add('wishlist-view');
    renderAccountSwitcher();
    render160WallControl();
    document.getElementById('kpis')?.setAttribute('hidden','');
    document.getElementById('outpostPanel')?.setAttribute('hidden','');
    document.getElementById('soleScorePanel')?.classList.remove('active');
    document.getElementById('pediaPanel')?.setAttribute('hidden','');
    document.querySelectorAll('.main-view-nav').forEach(button =>
      button.classList.toggle('active', button.dataset.view === 'wishlist')
    );
    const title = document.getElementById('pageTitle');
    if(title) title.textContent = '위시리스트 모집';
    try{ window.closeSidebar && window.closeSidebar(); }catch(_){}
    renderWishlist();
    requestAnimationFrame(alignWishlistControlPosition);
    loadImageMap().then(() => {
      if(document.body.classList.contains('wishlist-view')) renderWishlist();
    });
  }

  function patchMainViewSwitch(){
    const original = window.switchMainView;
    if(typeof original !== 'function' || original.__wishlistPatched) return;
    const wrapped = function(view){
      if(view === 'wishlist'){
        original.call(this,'characters');
        showWishlist();
        return;
      }
      hideWishlist();
      return original.apply(this,arguments);
    };
    wrapped.__wishlistPatched = true;
    wrapped.__wishlistOriginal = original;
    window.switchMainView = wrapped;
  }

  function patchAccountSwitch(){
    const original = window.switchAccount;
    if(typeof original !== 'function' || original.__wishlistPatched) return;
    const wrapped = function(){
      const result = original.apply(this,arguments);
      if(document.body.classList.contains('wishlist-view')){
        picks = clonePicks(loadPicks());
        savedPicks = clonePicks(picks);
        excludedCharacters = loadExcludedCharacters();
        savedExcludedCharacters = excludedCharacters.slice();
        favoriteCharacters = loadFavoriteCharacters();
        savedFavoriteCharacters = favoriteCharacters.slice();
        wallStatus = loadWallStatus();
        pvpPriority = loadPvpPriority();
        copyPriority = loadCopyPriority();
        renderAccountSwitcher();
        render160WallControl();
        renderWishlist();
      }
      return result;
    };
    wrapped.__wishlistPatched = true;
    wrapped.__wishlistOriginal = original;
    window.switchAccount = wrapped;
  }

  function init(){
    injectStyle();
    ensureNav();
    ensurePanel();
    renderAccountSwitcher();
    ensure160WallControl();
    render160WallControl();
    patchMainViewSwitch();
    patchAccountSwitch();
    window.addEventListener('resize', alignWishlistControlPosition);
    window.renderWishlist = renderWishlist;
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
})();