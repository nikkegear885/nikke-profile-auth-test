/* NIKKE Gear Manager - Wishlist Recommendation (test site only) */
(function(){
  'use strict';

  const COMPANIES = ['엘리시온','미실리스','테트라','필그림'];
  const STORAGE_KEY = 'nikke_wishlist_recommendations_v1';
  const EXCLUDED_STORAGE_KEY = 'nikke_wishlist_excluded_characters_v1';
  const FAVORITE_STORAGE_KEY = 'nikke_wishlist_favorite_characters_v1';
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

  function isEligibleWishlistName(name, company){
    if(!String(name || '').trim()) return false;
    // Overspec characters are available under Pilgrim only.
    if(isOverspecWishlistName(name) && company !== '필그림') return false;
    // Every company, including Pilgrim, excludes limited/distribution, SR and R characters.
    // Pilgrim's separate rule applies only to the 160-wall auto-priority logic below.
    return !isWishlistExcluded(name) && isSSRCharacter(name);
  }

  // Internal-only performance ranking for auto wishlist recommendations.
  // Do not render these labels or ranks in the Pedia or other UI.
  // Lower rank number means higher priority. The Solo Raid MLB tier and PvP tier share rank 4.
  // No Elysion PvP candidates have been supplied yet.
  const WISHLIST_PERFORMANCE_TIERS = [
    {rank:1, label:'필수캐', names:['마스트 : 로망틱 메이드','헬름']},
    {rank:2, label:'범용캐', names:['베스티 : 택티컬 업','앵커 : 이노센트 메이드']},
    {rank:3, label:'애장품 성능', names:['프리바티','팬텀','미란다']},
    {rank:4, label:'솔레 명함 추천 = PVP', names:['아르카나','솔린 : 프로스트 티켓','아르카나 : 포츈 메이트']},
    {rank:5, label:'애장품 비성능', names:['츠바이']},
    {rank:6, label:'명함 추천', names:['D : 킬러 와이프','츠바이','은화 : 택티컬 업','델타 : 닌자 시프']},
    {rank:7, label:'0.01%라도 사용 가능성', names:['엠마 : 택티컬 업']},
    {rank:8, label:'도감용', names:[
      '브리드','프리바티 : 언카인드 메이드','메이든','마스트','베스티','엠마',
      '폴리','솔린','디젤','은화','길로틴','D','시그널','마르차나','키리','K',
      '소라','레이블','E.H.'
    ]}
  ];
  const WISHLIST_PERFORMANCE_PRIORITY = (() => {
    const priorities = new Map();
    WISHLIST_PERFORMANCE_TIERS.forEach(tier => tier.names.forEach(name => {
      const key = norm(name);
      // If a Nikke appears in multiple groups, retain its highest (lowest-numbered) priority.
      if(!priorities.has(key) || tier.rank < priorities.get(key)) priorities.set(key, tier.rank);
    }));
    return priorities;
  })();
  const DEFAULT_PERFORMANCE_PRIORITY = Math.max(...WISHLIST_PERFORMANCE_TIERS.map(tier => tier.rank)) + 1;
  const WISHLIST_TREASURE_UPSIDE_NAMES = new Set(
    WISHLIST_PERFORMANCE_TIERS
      .filter(tier => tier.label === '애장품 성능')
      .flatMap(tier => tier.names.map(norm))
  );
  function getWishlistPerformancePriority(name){
    return WISHLIST_PERFORMANCE_PRIORITY.get(norm(name)) ?? DEFAULT_PERFORMANCE_PRIORITY;
  }
  // Non-performance collectible characters should not be auto-recommended at 2+ breakthrough.
  // This rule only affects auto-build; manual picker eligibility and Pedia display remain unchanged.
  const WISHLIST_EXCLUDE_AT_TWO_BREAKTHROUGHS = new Set(
    WISHLIST_PERFORMANCE_TIERS
      .filter(tier => tier.label === '애장품 비성능')
      .flatMap(tier => tier.names.map(norm))
  );
  function shouldExcludeFromAutoWishlist(name){
    return WISHLIST_EXCLUDE_AT_TWO_BREAKTHROUGHS.has(norm(name)) && getBreakthrough(name) >= 2;
  }

  function isTreasurePerformanceBelowTwo(name, breakthrough){
    return WISHLIST_TREASURE_UPSIDE_NAMES.has(norm(name)) && breakthrough < 2;
  }

  function getCopyPrioritySortGroup(name, performancePriority, breakthrough, unowned){
    const treasureTarget = isTreasurePerformanceBelowTwo(name, breakthrough);
    if(copyPriority === 0){
      // Stage 1: treasure-item performance characters below 2 breakthrough can outrank required characters.
      if(treasureTarget) return 0;
      if(performancePriority === 1) return 1;
      return 2;
    }
    if(copyPriority === 1){
      // Stage 2: upgrade treasure-item performance characters below 2 first,
      // then acquire first copies through the "명함 추천" performance tier.
      if(treasureTarget) return 0;
      if(unowned && performancePriority <= 6) return 1;
      return 2;
    }
    // Stage 3: treasure-item performance characters below 2 first,
    // then any missing first copy through the full roster, including collection-only units.
    if(treasureTarget) return 0;
    return unowned ? 1 : 2;
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

  const COPY_PRIORITY_LABELS = ['필수캐 우선','명함 추천','도감작'];
  const COPY_PRIORITY_DESCRIPTIONS = [
    '성능캐 돌파를 최우선으로 합니다',
    '사용가능성이 있는 니케 명함을 우선으로합니다',
    '명함을 최우선으로 합니다'
  ];
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
      .sort((a,b) => String(a['이름']).localeCompare(String(b['이름']), 'ko'));
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

  function isMarkedUnowned(name){
    try{
      if(typeof unownedCharacters !== 'undefined' && unownedCharacters){
        if(typeof unownedCharacters.has === 'function'){
          if(unownedCharacters.has(name)) return true;
          for(const savedName of unownedCharacters){
            if(norm(savedName) === norm(name)) return true;
          }
        }
      }
    }catch(_){}
    return false;
  }

  function getBreakthrough(name){
    const row = findAccountRow(name);
    if(!row) return 0;
    const raw = row['돌파'];
    const value = Number(raw);
    if(Number.isFinite(value)) return Math.max(0,Math.min(3,Math.floor(value)));
    const match = String(raw == null ? '' : raw).match(/\d+/);
    return match ? Math.max(0,Math.min(3,Number(match[0]))) : 0;
  }

  function getCoreEnhancement(name){
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
      '#wishlist160WallControl{position:fixed;left:calc(50% - 231px - 184px);top:142px;z-index:50;box-sizing:border-box;width:164px;padding:12px;border:1px solid #d8dee8;border-radius:11px;background:#fff;color:#344054;box-shadow:0 5px 18px rgba(27,48,75,.10);font-family:inherit}',
      '#wishlist160WallControl .wl-160-title{margin:0 0 9px;font-size:12px;font-weight:1000;line-height:1.35;text-align:center;color:#38465a}',
      '#wishlist160WallControl .wl-160-options{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
      '#wishlist160WallControl .wl-160-button{height:34px;border:1px solid #d3dbe7;border-radius:7px;background:#f7f9fc;color:#69778b;font-size:13px;font-weight:1000;cursor:pointer;transition:background .12s,border-color .12s,color .12s}',
      '#wishlist160WallControl .wl-160-button[data-wl-160-wall="O"].active{border-color:#239b76;background:#e5f7ef;color:#16724f;box-shadow:inset 0 0 0 1px rgba(35,155,118,.14)}',
      '#wishlist160WallControl .wl-160-button[data-wl-160-wall="X"].active{border-color:#8a96a8;background:#e8edf4;color:#344054;box-shadow:inset 0 0 0 1px rgba(90,106,128,.12)}',
      '#wishlist160WallControl .wl-160-note{margin-top:8px;color:#78869a;font-size:9px;line-height:1.4;text-align:center}',
      '#wishlist160WallControl .wl-copy-priority-divider{height:1px;margin:12px 1px 10px;background:#e3e8ef}',
      '#wishlist160WallControl .wl-copy-priority-heading{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-bottom:8px;color:#38465a;font-size:11px;font-weight:1000}',
      '#wishlist160WallControl .wl-copy-priority-value{padding:3px 6px;border:1px solid #cbd8e8;border-radius:999px;background:#edf4fc;color:#3e6797;font-size:9px;font-weight:900;white-space:nowrap}',
      '#wishlist160WallControl .wl-copy-priority-slider{display:block;width:100%;height:18px;margin:2px 0 0;accent-color:#668fda;cursor:pointer}',
      '#wishlist160WallControl .wl-copy-priority-ends{display:flex;justify-content:space-between;align-items:center;margin-top:3px;color:#728096;font-size:10px;font-weight:900}',
      '#wishlist160WallControl .wl-copy-priority-note{margin-top:7px;color:#8793a6;font-size:9px;line-height:1.4;text-align:center}',
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
      'html.dark-theme #wishlist160WallControl .wl-copy-priority-ends{color:#a3b1c7}',
      'html.dark-theme #wishlist160WallControl .wl-copy-priority-note{color:#92a0b7}',
      'html.dark-theme #wishlist160WallControl{border-color:#354761;background:#151f31;color:#edf3ff;box-shadow:0 5px 18px rgba(0,0,0,.25)}',
      'html.dark-theme #wishlist160WallControl .wl-160-title{color:#edf3ff}',
      'html.dark-theme #wishlist160WallControl .wl-160-button{border-color:#354761;background:#0d1525;color:#adbacd}',
      'html.dark-theme #wishlist160WallControl .wl-160-button[data-wl-160-wall="O"].active{border-color:#3b9f7d;background:#173d33;color:#a5f0d0}',
      'html.dark-theme #wishlist160WallControl .wl-160-button[data-wl-160-wall="X"].active{border-color:#72819b;background:#273449;color:#e1e9f5}',
      '@media(max-width:1000px){#wishlist160WallControl{position:relative;left:auto;top:auto;width:calc(100% - 24px);max-width:462px;margin:8px auto;padding:8px 12px}#wishlist160WallControl .wl-160-title{margin-bottom:6px}#wishlist160WallControl .wl-160-note{margin-top:5px}}',
      '#wishlistPanel[hidden]{display:none!important}',
      '#wishlistPanel{position:relative!important;z-index:auto;display:block!important;box-sizing:border-box!important;width:calc(100% - 24px)!important;max-width:462px!important;min-width:0!important;padding:0!important;margin:0 auto 16px!important;overflow:visible;background:transparent;color:#25282d}',
      '#wishlistPanel .wl-dialog{position:relative;display:flex;flex-direction:column;width:100%;height:auto;min-height:0;overflow:visible;border:1px solid #dedfe1;border-radius:12px;background:#f8f8f8;box-shadow:0 2px 12px rgba(0,0,0,.10)}',
      '#wishlistPanel .wl-modal-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;min-height:31px;padding:3px 7px;overflow:hidden;background:linear-gradient(135deg,#f5f5f5 0%,#eeeeef 42%,#fafafa 100%);border-bottom:1px solid #dedfe1}',
      '#wishlistPanel .wl-modal-head:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,transparent 0 8%,rgba(210,214,218,.35) 8% 20%,transparent 20% 37%,rgba(255,255,255,.62) 37% 48%,transparent 48% 62%,rgba(218,221,224,.35) 62% 77%,transparent 77%)}',
      '#wishlistPanel .wl-modal-title{position:relative;display:flex;align-items:center;gap:4px;color:#16a5df;font-size:11px;font-weight:1000;letter-spacing:-.04em}',
      '#wishlistPanel .wl-random-test-account-button{position:relative;z-index:1;flex:none;max-width:54%;padding:4px 7px;border:1px solid #b98a38;border-radius:5px;background:#fff8e8;color:#795315;font-size:9px;font-weight:1000;line-height:1.2;white-space:nowrap;cursor:pointer}',
      '#wishlistPanel .wl-random-test-account-button:hover{border-color:#d5a750;background:#fff0cf;color:#65430e}',
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
      '#wishlistPanel .wl-company-head{position:relative;display:flex;align-items:center;justify-content:center;flex:none;min-height:46px;padding:4px 32px;border-bottom:1px solid #f0f0f0}',
      '#wishlistPanel .wl-company-brand{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:#777}',
      '#wishlistPanel .wl-company-symbol{height:25px;display:flex;align-items:center;justify-content:center;font-size:32px;line-height:1;font-weight:1000;color:#777;letter-spacing:-.08em}',
      '#wishlistPanel .wl-company-name{display:none;font-size:8px;font-weight:900;letter-spacing:.1em;color:#858585}',
      '#wishlistPanel .wl-info{position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;width:23px;height:23px;border:0;border-radius:50%;background:#888;color:#fff;font:italic 900 16px/1 Georgia,serif;cursor:help}',
      '#wishlistPanel .wl-slots{display:grid;grid-template-columns:repeat(5,minmax(0,min(64px,calc((100vw - 64px)/5))));justify-content:center;gap:5px;align-items:start;padding:15px 8px 17px}',
      '#wishlistPanel .wl-slot{position:relative;min-width:0;aspect-ratio:1 / 1;border:0;border-radius:8px;background:transparent;box-shadow:none;overflow:visible}',
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
      '#wishlistPanel .wl-tile.wl-photo-only:before,#wishlistPanel .wl-tile.wl-photo-only:after{display:none!important;content:none!important}',
      '#wishlistPanel .wl-picked-image{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;object-position:center;border-radius:7px}',
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
      '#wishlistPanel .wl-picker-dialog{display:flex;flex-direction:column;width:100%;max-height:min(68vh,620px);overflow:hidden;border:1px solid #d5dbe5;border-radius:10px;background:#f8fafc;color:#222936;box-shadow:0 6px 18px rgba(0,0,0,.15)}',
      '@keyframes wl-picker-expand{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}',
      '#wishlistPanel .wl-picker-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #dde3ec;background:linear-gradient(135deg,#fff,#edf3fa)}',
      '#wishlistPanel .wl-picker-title{margin:0;color:#168fc5;font-size:17px;font-weight:1000}',
      '#wishlistPanel .wl-picker-close{flex:none;width:34px;height:34px;border:0;border-radius:8px;background:#e7ebf1;color:#576171;font-size:25px;line-height:1;cursor:pointer}',
      '#wishlistPanel .wl-picker-search-wrap{padding:12px 14px 8px}',
      '#wishlistPanel .wl-picker-search{box-sizing:border-box;width:100%;height:38px;padding:0 12px;border:1px solid #cbd4e0;border-radius:8px;background:#fff;color:#222936;font-size:13px;outline:none}',
      '#wishlistPanel .wl-picker-search:focus{border-color:#169fd6;box-shadow:0 0 0 3px rgba(22,159,214,.14)}',
      '#wishlistPanel .wl-picker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));align-content:start;gap:8px;flex:1;min-height:100px;max-height:min(48vh,420px);padding:8px 14px 14px;overflow:auto}',
      '#wishlistPanel .wl-picker-item{position:relative;display:flex;min-width:0;flex-direction:column;align-items:center;gap:6px;padding:8px 5px;border:1px solid #dce2ea;border-radius:9px;background:#fff;color:#333b49;cursor:pointer;transition:border-color .12s,background .12s,transform .12s}',
      '#wishlistPanel .wl-picker-item:hover:not(:disabled){transform:translateY(-1px);border-color:#37a8d7;background:#f0faff}',
      '#wishlistPanel .wl-picker-item.is-current{border:2px solid #149fd6;padding:7px 4px;background:#e9f8ff}',
      '#wishlistPanel .wl-picker-item.is-manual-excluded{border-color:#e45b70;background:#fff0f2}',
      '#wishlistPanel .wl-picker-item.is-favorite{border-color:#d5a33b;background:#fff8e7}',
      '#wishlistPanel .wl-picker-item:disabled{opacity:.36;cursor:not-allowed;filter:grayscale(.7)}',
      '#wishlistPanel .wl-picker-photo{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;width:72px;height:auto;overflow:visible;border-radius:7px;background:transparent}',
      '#wishlistPanel .wl-picker-image-wrap{position:relative;display:block;flex:none;width:72px;height:72px;overflow:hidden;border-radius:7px;background:#e6ebf2}',
      '#wishlistPanel .wl-picker-state-marker{position:absolute;left:2px;top:2px;z-index:8;padding:3px 5px;border-radius:4px;background:rgba(195,43,67,.94);color:#fff;font-size:9px;font-weight:1000;line-height:1.1;box-shadow:0 1px 3px rgba(0,0,0,.28);pointer-events:none}',
      '#wishlistPanel .wl-picker-state-marker.is-favorite{background:rgba(155,104,15,.95);color:#fff7d6}',
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
      '#wishlistPanel .wl-excluded-panel{position:absolute;left:calc(100% + 16px);top:0;z-index:1;box-sizing:border-box;width:290px;max-width:calc(100vw - 500px);max-height:calc(100vh - 155px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #dce2e9;border-radius:12px;background:#f8fafc;color:#303948;box-shadow:0 5px 20px rgba(25,44,70,.09)}',
      '#wishlistPanel .wl-excluded-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 13px;border-bottom:1px solid #e1e6ed;background:linear-gradient(135deg,#fff,#edf3fa)}',
      '#wishlistPanel .wl-excluded-title{font-size:13px;font-weight:1000;color:#354459}',
      '#wishlistPanel .wl-excluded-count{flex:none;padding:3px 7px;border-radius:999px;background:#e8edf4;color:#536175;font-size:10px;font-weight:1000}',
      '#wishlistPanel .wl-excluded-note{padding:9px 13px 7px;color:#6f7c8f;font-size:10px;line-height:1.5}',
      '#wishlistPanel .wl-excluded-list{display:flex;flex-direction:column;gap:6px;min-height:36px;max-height:min(34vh,300px);padding:0 10px 11px;overflow:auto}',
      '#wishlistPanel .wl-favorite-section{flex:none;border-top:1px solid #e1e6ed}',
      '#wishlistPanel .wl-favorite-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 13px;border-bottom:1px solid #e1e6ed;background:linear-gradient(135deg,#fff,#fff4dc)}',
      '#wishlistPanel .wl-favorite-count{flex:none;padding:3px 7px;border-radius:999px;background:#f7e5b8;color:#8e6411;font-size:10px;font-weight:1000}',
      '#wishlistPanel .wl-favorite-list{display:flex;flex-direction:column;gap:6px;min-height:32px;max-height:min(24vh,200px);padding:8px 10px 11px;overflow:auto}',
      '#wishlistPanel .wl-favorite-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 8px;border:1px solid #ead9ad;border-radius:8px;background:#fffaf0}',
      '#wishlistPanel .wl-favorite-remove{flex:none;padding:5px 7px;border:1px solid #dbc78e;border-radius:6px;background:#fff3d0;color:#846018;font-size:10px;font-weight:1000;cursor:pointer}',
      '#wishlistPanel .wl-favorite-remove:hover{border-color:#b98b29;background:#ffebad}',
      '#wishlistPanel .wl-excluded-empty{padding:14px 7px;color:#8a95a5;text-align:center;font-size:11px;line-height:1.6}',
      '#wishlistPanel .wl-excluded-row{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 8px;border:1px solid #e2e7ee;border-radius:8px;background:#fff}',
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
      'html.dark-theme #wishlistPanel .wl-excluded-panel{border-color:#354761;background:#151f31;color:#e8eef9;box-shadow:0 5px 20px rgba(0,0,0,.25)}',
      'html.dark-theme #wishlistPanel .wl-excluded-head{border-color:#354761;background:linear-gradient(135deg,#1a2639,#111a2b)}',
      'html.dark-theme #wishlistPanel .wl-excluded-title{color:#e8eef9}',
      'html.dark-theme #wishlistPanel .wl-excluded-count{background:#27364c;color:#cbd6e6}',
      'html.dark-theme #wishlistPanel .wl-excluded-note,html.dark-theme #wishlistPanel .wl-excluded-empty{color:#9aa9be}',
      'html.dark-theme #wishlistPanel .wl-excluded-row{border-color:#354761;background:#101a2b}',
      'html.dark-theme #wishlistPanel .wl-favorite-section{border-color:#354761}',
      'html.dark-theme #wishlistPanel .wl-favorite-head{border-color:#354761;background:linear-gradient(135deg,#302817,#211b12)}',
      'html.dark-theme #wishlistPanel .wl-favorite-count{background:#59461f;color:#ffe7a1}',
      'html.dark-theme #wishlistPanel .wl-favorite-row{border-color:#66532d;background:#201b12}',
      'html.dark-theme #wishlistPanel .wl-favorite-remove{border-color:#6c572d;background:#3c3018;color:#ffe7a1}',
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
      '#wishlistPanel .wl-picker-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-top:1px solid #dde3ec;background:#f0f3f7;color:#707b8b;font-size:11px}',
      '#wishlistPanel .wl-picker-clear{flex:none;padding:8px 12px;border:1px solid #d7a9ad;border-radius:7px;background:#fff5f5;color:#b3434a;font-size:12px;font-weight:900;cursor:pointer}',
      '#wishlistPanel .wl-picker-empty{grid-column:1/-1;padding:28px 10px;text-align:center;color:#758196;font-size:13px}',
      '#wishlistPanel .wl-auto-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:7px;padding:5px 8px 9px}',
      '#wishlistPanel .wl-auto-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:32px;padding:7px 14px;border:1px solid #1597ca;border-radius:7px;background:linear-gradient(180deg,#19b5ed,#079bd7);color:#fff;font-size:12px;font-weight:1000;cursor:pointer;box-shadow:0 2px 4px rgba(0,110,160,.15)}',
      '#wishlistPanel .wl-auto-button:hover{filter:brightness(1.04);transform:translateY(-1px)}',
      '#wishlistPanel .wl-auto-note{flex-basis:100%;text-align:center;color:#7a8490;font-size:9px;line-height:1.35}',
      '#wishlistPanel .wl-status{flex:none;padding:0 12px 6px;text-align:right;color:#80858b;font-size:9px}',
      '#wishlistPanel .wl-footer{display:flex;justify-content:center;gap:16px;flex:none;padding:5px 12px 6px;border-top:1px solid #dedede;background:#f8f8f8}',
      '#wishlistPanel .wl-action{display:flex;align-items:center;justify-content:center;gap:7px;width:clamp(120px,25%,220px);min-height:42px;border-radius:6px;font-size:16px;font-weight:1000;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.12)}',
      '#wishlistPanel .wl-cancel{border:2px solid #aaa;background:#fff;color:#343434}',
      '#wishlistPanel .wl-confirm{border:2px solid #0da5e2;background:#0ba8eb;color:white}',
      '#wishlistPanel .wl-action:hover{filter:brightness(.97);transform:translateY(-1px)}',
      '@media(max-width:1000px){#wishlistPanel .wl-excluded-panel{position:relative;left:auto;top:auto;width:calc(100% - 24px);max-width:462px;max-height:none;margin:12px auto 0}#wishlistPanel .wl-excluded-list{max-height:260px}#wishlistPanel .wl-favorite-list{max-height:200px}}',
      '@media(max-width:650px){#wishlistPanel{width:100%;margin:0 auto 12px}#wishlistPanel .wl-dialog{width:100%;height:auto;border-radius:10px}#wishlistPanel .wl-modal-head{min-height:27px;padding:3px 6px}#wishlistPanel .wl-modal-title{font-size:11px;gap:4px}#wishlistPanel .wl-refresh-icon{width:17px;height:17px;border-width:2px}#wishlistPanel .wl-intro{padding:3px 4px;font-size:9px;line-height:1.2}#wishlistPanel .wl-intro .wl-subline{font-size:8px;margin-top:2px}#wishlistPanel .wl-company-list{gap:6px;padding:2px 7px 6px}#wishlistPanel .wl-company-head{min-height:41px;padding:4px 34px}#wishlistPanel .wl-company-symbol{height:25px;font-size:30px}#wishlistPanel .wl-company-name{font-size:7px}#wishlistPanel .wl-info{width:20px;height:20px;right:6px;font-size:14px}#wishlistPanel .wl-slots{gap:4px;padding:12px 5px 15px}#wishlistPanel .wl-slot{aspect-ratio:1 / 1;border-radius:4px}#wishlistPanel .wl-corner-mark{width:16px;height:18px;font-size:9px}#wishlistPanel .wl-selected-name{padding:14px 2px 7px;font-size:7px}#wishlistPanel .wl-stage{top:2px;right:2px;padding:1px 2px;font-size:7px;min-width:14px}#wishlistPanel .wl-plus{font-size:28px}#wishlistPanel .wl-empty-mark{gap:1px;padding:2px;font-size:7px}#wishlistPanel .wl-footer{gap:8px;padding:5px 8px 6px}#wishlistPanel .wl-action{width:42%;min-height:36px;font-size:13px}}',
      '@media(max-width:380px){#wishlistPanel .wl-company-list{padding-left:6px;padding-right:6px}#wishlistPanel .wl-slots{gap:4px;padding-left:5px;padding-right:5px}#wishlistPanel .wl-selected-name{font-size:8px}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureNav(){
    const nav = document.querySelector('.nav');
    if(!nav || nav.querySelector('[data-view="wishlist"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'main-view-nav';
    button.dataset.view = 'wishlist';
    button.textContent = '위시리스트 추천';
    button.addEventListener('click', () => window.switchMainView && window.switchMainView('wishlist'));
    const pediaButton = nav.querySelector('[data-view="pedia"]');
    if(pediaButton) pediaButton.after(button);
    else nav.appendChild(button);
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
      '<div class="wl-160-title">160벽 돌파 여부</div>' +
      '<div class="wl-160-options">' +
        '<button type="button" class="wl-160-button" data-wl-160-wall="O" aria-pressed="false">O</button>' +
        '<button type="button" class="wl-160-button" data-wl-160-wall="X" aria-pressed="false">X</button>' +
      '</div>' +
      '<div class="wl-160-note">X 선택 시 1~2돌파 니케 우선</div>' +
      '<div class="wl-copy-priority-divider"></div>' +
      '<div class="wl-copy-priority-heading"><span>추천 우선도</span><button type="button" class="wl-copy-priority-help" data-wl-copy-priority-help data-tooltip="성능캐 돌파를 최우선으로 합니다" aria-label="현재 추천 우선도 설명">!</button><span class="wl-copy-priority-value" data-wl-copy-priority-value>필수캐 우선</span></div>' +
      '<input class="wl-copy-priority-slider" data-wl-copy-priority type="range" min="0" max="2" step="1" value="0" aria-label="위시리스트 추천 우선도" />' +
      '<div class="wl-copy-priority-ends"><span>필수캐</span><span>도감작</span></div>' +
      '<div class="wl-copy-priority-note">자동 편성 추천 순서에 적용</div>';
    control.addEventListener('input', event => {
      const slider = event.target.closest && event.target.closest('[data-wl-copy-priority]');
      if(!slider) return;
      const value = Number(slider.value);
      if(!Number.isInteger(value) || value < 0 || value > 2) return;
      copyPriority = value;
      saveCopyPriority();
      render160WallControl();
    });
    control.addEventListener('click', event => {
      const button = event.target.closest && event.target.closest('[data-wl-160-wall]');
      if(!button) return;
      const value = button.getAttribute('data-wl-160-wall');
      if(value !== 'O' && value !== 'X') return;
      wallStatus = value;
      saveWallStatus();
      render160WallControl();
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
    control.querySelectorAll('[data-wl-160-wall]').forEach(button => {
      const active = button.getAttribute('data-wl-160-wall') === wallStatus;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const slider = control.querySelector('[data-wl-copy-priority]');
    if(slider) slider.value = String(copyPriority);
    const valueLabel = control.querySelector('[data-wl-copy-priority-value]');
    if(valueLabel) valueLabel.textContent = COPY_PRIORITY_LABELS[copyPriority] || '필수캐 우선';
    const help = control.querySelector('[data-wl-copy-priority-help]');
    if(help){
      help.setAttribute('data-tooltip', COPY_PRIORITY_DESCRIPTIONS[copyPriority] || COPY_PRIORITY_DESCRIPTIONS[1]);
      help.setAttribute('aria-label', COPY_PRIORITY_DESCRIPTIONS[copyPriority] || COPY_PRIORITY_DESCRIPTIONS[1]);
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
          '<button type="button" class="wl-random-test-account-button" data-wl-random-test-account title="무작위 보유·돌파 데이터가 있는 테스트 계정을 생성합니다">무작위 계정 테스트</button>' +
        '</div>' +
        '<div class="wl-intro">' +
          '<p>대원 모집에서 <span class="wl-blue">SSR 니케를 획득</span>하면<br>더 높은 확률로 위시리스트에 등록한 니케를 획득할 수 있습니다.</p>' +
          '<p class="wl-subline">(SSR 니케 모집 총 확률은 변하지 않습니다)</p>' +
        '</div>' +
        '<div class="wl-auto-toolbar">' +
          '<button type="button" class="wl-auto-button" data-wl-auto-build>✦ 계정 상태로 자동 편성</button>' +
          '<div class="wl-auto-note">전 기업 공통: SSR만 선택 · 한정·배포 제외 / 필그림 160벽 우선순위는 별도</div>' +
        '</div>' +
        '<div class="wl-company-list" id="wishlistCompanyList"></div>' +
        '<div class="wl-status" id="wishlistSavedStatus">변경 사항 없음</div>' +
        '<div class="wl-footer">' +
          '<button type="button" class="wl-action wl-cancel" data-wl-cancel><span aria-hidden="true">×</span> 취소</button>' +
          '<button type="button" class="wl-action wl-confirm" data-wl-confirm><span aria-hidden="true">✓</span> 결정</button>' +
        '</div>' +
      '</div>' +
      '<aside class="wl-excluded-panel" id="wishlistExcludedPanel" aria-label="자동편성 제외 캐릭터">' +
        '<div class="wl-excluded-head"><div class="wl-excluded-title">자동편성 제외 캐릭터</div><span class="wl-excluded-count" data-wl-excluded-count>0명</span></div>' +
        '<div class="wl-excluded-note">캐릭터 사진을 눌러 상태를 <b>기본 → 제외 → 애정캐 → 기본</b> 순서로 변경해.</div>' +
        '<div class="wl-excluded-list" data-wl-excluded-list><div class="wl-excluded-empty">제외된 니케가 없어.</div></div>' +
        '<div class="wl-favorite-section">' +
          '<div class="wl-favorite-head"><div class="wl-excluded-title">애정캐</div><span class="wl-favorite-count" data-wl-favorite-count>0명</span></div>' +
          '<div class="wl-favorite-list" data-wl-favorite-list><div class="wl-excluded-empty">애정캐로 지정한 니케가 없어.</div></div>' +
        '</div>' +
      '</aside>' +
      '<div class="wl-picker-backdrop" data-wl-picker-backdrop hidden>' +
        '<div class="wl-picker-dialog" role="region" aria-labelledby="wlPickerTitle">' +
          '<div class="wl-picker-head"><h3 class="wl-picker-title" id="wlPickerTitle">니케 상태 설정</h3><button type="button" class="wl-picker-close" data-wl-picker-close aria-label="접기">×</button></div>' +
          '<div class="wl-picker-search-wrap"><input type="search" class="wl-picker-search" data-wl-picker-search placeholder="니케 이름 검색" aria-label="니케 이름 검색" autocomplete="off"></div>' +
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
        '</div>' +
        (unowned ? '<span class="wl-photo-status">미보유</span>' : '');
    }else{
      tile = '<div class="wl-tile wl-empty-tile">' +
        '<div class="wl-empty-mark"><span class="wl-plus">＋</span></div></div>';
    }
    const accessibleName = name ? name + (unowned ? ' · 미보유' : ' · ' + stage + '돌') : '클릭해서 니케 선택';
    // Use the in-page hover card instead of browser-native title tooltips.
    const selector = '<button type="button" class="wl-select-trigger" data-company="' + esc(company) + '" data-slot="' + slot + '" aria-label="' + esc(company + ' 위시리스트 슬롯 ' + (slot + 1) + ' 선택' + (name ? ': ' + accessibleName : '')) + '"></button>';
    return '<article class="wl-slot' + (!name ? ' wl-slot-empty' : '') + (unowned ? ' is-unowned' : '') + '" data-wl-slot="true" aria-label="' + esc(accessibleName) + '">' +
      tile + selector +
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
    const slot = target.matches && target.matches('.wl-slot') ? target : (target.closest && target.closest('.wl-slot'));
    const card = ensureWishlistHoverCard();
    const imageBox = card.querySelector('.wl-hover-card-image');
    const nameLabel = card.querySelector('.wl-hover-card-name');
    const companyLabel = card.querySelector('.wl-hover-card-company');
    const meta = card.querySelector('.wl-hover-card-meta');

    card.classList.toggle('is-compact',!slot);
    imageBox.replaceChildren();
    meta.replaceChildren();
    imageBox.style.display = slot ? '' : 'none';

    if(slot){
      const trigger = slot.querySelector('.wl-select-trigger');
      const company = trigger ? String(trigger.dataset.company || '') : '';
      const slotIndex = trigger ? Number(trigger.dataset.slot) : -1;
      const name = company && Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < 5
        ? String((picks[company] && picks[company][slotIndex]) || '')
        : '';
      nameLabel.textContent = name || '니케 추가';
      companyLabel.textContent = name ? company : (company ? company + ' · 빈 슬롯' : '위시리스트');
      if(name){
        const imageUrl = findImage(name);
        if(imageUrl){
          const image = document.createElement('img');
          image.src = imageUrl;
          image.alt = '';
          image.draggable = false;
          imageBox.appendChild(image);
        }else{
          const fallback = document.createElement('span');
          fallback.className = 'wl-hover-card-fallback';
          fallback.textContent = name.slice(0,1);
          imageBox.appendChild(fallback);
        }
        const stage = getBreakthrough(name);
        const core = getCoreEnhancement(name);
        const unowned = isMarkedUnowned(name);
        addWishlistHoverChip(meta,stage + '돌파');
        if(core > 0) addWishlistHoverChip(meta,'코어 +' + core);
        addWishlistHoverChip(meta,unowned ? '미보유' : '보유',unowned ? 'is-unowned' : '');
      }else{
        addWishlistHoverChip(meta,'클릭해서 니케 선택');
      }
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
    hoverCard.classList.remove('is-visible','is-compact');
    hoverCard.setAttribute('aria-hidden','true');
    hoverCardAnchor = null;
  }

  function findWishlistHoverTarget(target){
    return target && target.closest ? target.closest('.wl-slot, [data-wl-hover-text]') : null;
  }

  function onPanelPointerOver(event){
    if(event.pointerType === 'touch') return;
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
    });
    if(!characters.length){
      grid.innerHTML = '<div class="wl-picker-empty">검색 결과가 없습니다.</div>';
      return;
    }
    grid.innerHTML = characters.map(row => {
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
  }

  function onPanelInput(event){
    if(event.target && event.target.matches && event.target.matches('[data-wl-picker-search]')) renderCharacterPicker();
  }

  function onPickerKeydown(event){
    if(event.key === 'Escape' && pickerSlot !== null) closeCharacterPicker();
  }

  function onOutsidePickerClick(event){
    if(pickerSlot === null || !pickerCompany || !panel) return;
    const backdrop = panel.querySelector('[data-wl-picker-backdrop]');
    if(!backdrop || backdrop.hidden || backdrop.contains(event.target)) return;
    // Slot clicks switch the expanded list (or toggle the current one) in the panel handler.
    if(event.target && event.target.closest && event.target.closest('.wl-select-trigger')) return;
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
    const overLimitFavorites = COMPANIES.map(company => ({
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
    COMPANIES.forEach(company => {
      const candidates = getCharactersForCompany(company)
        .filter(row => {
          const name = String(row['이름'] || '').trim();
          const favorite = isFavoriteCharacter(name);
          if(isManuallyExcludedCharacter(name) || getCoreEnhancement(name) >= 7) return false;
          if(!favorite && shouldExcludeFromAutoWishlist(name)) return false;
          if(copyPriority === 1 && !favorite){
            const priority = getWishlistPerformancePriority(name);
            const breakthrough = getBreakthrough(name);
            // Favourite units bypass this stage limit, except Core +7 units handled above.
            return priority <= 6 || isTreasurePerformanceBelowTwo(name, breakthrough);
          }
          return true;
        });
      candidates.sort((a,b) => {
        const aName = String(a['이름'] || '').trim();
        const bName = String(b['이름'] || '').trim();
        const aBreakthrough = getBreakthrough(aName);
        const bBreakthrough = getBreakthrough(bName);
        const aFavorite = isFavoriteCharacter(aName);
        const bFavorite = isFavoriteCharacter(bName);
        if(aFavorite !== bFavorite) return aFavorite ? -1 : 1;
        if(wallStatus === 'X' && company !== '필그림'){
          // 160벽 X 선택 시 10단계 중 1돌파·2돌파만 최우선으로 추천한다.
          // 3돌파와 코어 강화 1~7은 이 우선 그룹에 포함하지 않는다.
          const aTargetPriority = aBreakthrough >= 1 && aBreakthrough <= 2;
          const bTargetPriority = bBreakthrough >= 1 && bBreakthrough <= 2;
          if(aTargetPriority !== bTargetPriority) return aTargetPriority ? -1 : 1;
        }

        const aUnowned = isMarkedUnowned(aName);
        const bUnowned = isMarkedUnowned(bName);
        const aPerformancePriority = getWishlistPerformancePriority(aName);
        const bPerformancePriority = getWishlistPerformancePriority(bName);
        const aGroup = getCopyPrioritySortGroup(aName,aPerformancePriority,aBreakthrough,aUnowned);
        const bGroup = getCopyPrioritySortGroup(bName,bPerformancePriority,bBreakthrough,bUnowned);

        // Keep the 160-wall targeting rule above the selected-stage priorities.
        if(aGroup !== bGroup) return aGroup - bGroup;
        if(aPerformancePriority !== bPerformancePriority) return aPerformancePriority - bPerformancePriority;
        // Within the treasure-performance target group, favor characters closer to 2 breakthroughs.
        if(aGroup === 0 && aBreakthrough !== bBreakthrough) return bBreakthrough - aBreakthrough;
        if(aUnowned !== bUnowned){
          if(aGroup === 0) return aUnowned ? 1 : -1;
          return aUnowned ? -1 : 1;
        }
        if(!aUnowned && !bUnowned){
          const breakthroughDiff = bBreakthrough - aBreakthrough;
          if(breakthroughDiff) return breakthroughDiff;
        }
        return aName.localeCompare(bName,'ko');
      });
      picks[company] = candidates.slice(0,5).map(row => String(row['이름'] || '').trim());
      while(picks[company].length < 5) picks[company].push('');
    });
    renderWishlist();
  }

  function renderWishlist(){
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
          '<div class="wl-company-brand"><span class="wl-company-symbol" aria-hidden="true">' + esc(COMPANY_SYMBOLS[company] || '◇') + '</span>' +
          '<span class="wl-company-name">' + esc(company) + '</span></div>' +
          '<button type="button" class="wl-info" data-wl-hover-text="' + esc(company + ' 위시리스트 니케를 5명까지 추천합니다. 사진을 눌러 제외/애정캐 상태를 바꿀 수 있습니다.') + '" aria-label="' + esc(company + ' 안내') + '">i</button>' +
        '</div>' +
        '<div class="wl-slots">' + Array.from({length:5},(_,slot) => buildSlot(company,slot,characters)).join('') + '</div>' +
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
      list.innerHTML = '<div class="wl-excluded-empty">제외된 니케가 없어.</div>';
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
    ).join('') : '<div class="wl-excluded-empty">애정캐로 지정한 니케가 없어.</div>';
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
    const slotTrigger = event.target.closest && event.target.closest('.wl-select-trigger');
    if(slotTrigger && COMPANIES.includes(slotTrigger.dataset.company)){
      hideWishlistHoverCard();
      event.preventDefault();
      openCharacterPicker(slotTrigger.dataset.company, Number(slotTrigger.dataset.slot));
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
    window.renderWishlist = renderWishlist;
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
})();