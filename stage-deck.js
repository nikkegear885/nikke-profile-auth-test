/* Stage Deck Builder for NIKKE Gear Manager test site.
 * Adds a separate view only; does not modify main site or inventory data.
 */
(function () {
  'use strict';

  const PEDIA_URL = 'assets/nikke-pedia-master.json?v=1049';
  const SKILLS_URL = 'assets/nikke-skills.json?v=1048';
  const STORAGE_KEY = 'nikke_stage_deck_v1';
  const SHOW_UNOWNED_STORAGE_KEY = 'nikke_stage_deck_show_unowned_v1';
  const RANDOM_ACCOUNT_OPTIONS_STORAGE_KEY = 'nikke_stage_deck_random_account_options_v1';
  const RANDOM_ACCOUNT_ROSTER_STORAGE_KEY = 'nikke_stage_deck_random_owned_roster_v1';
  const RANDOM_ACCOUNT_ROSTER_ACTIVE_KEY = 'nikke_stage_deck_random_roster_active_v1';
  const STAGE_GACHA_STATE_KEY = 'nikke_stage_deck_gacha_state_v1';
  const SLOT_COUNT = 5;
  let showUnownedCharacters = (() => {
    try { return localStorage.getItem(SHOW_UNOWNED_STORAGE_KEY) === '1'; }
    catch (_) { return false; }
  })();
  let pedia = [];
  let metaByName = {};
  let slots = Array(SLOT_COUNT).fill('');
  let activeSlot = 0;
  let query = '';
  let burstFilter = '';
  let sortMode = 'power_desc';
  let initialized = false;

  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));

  function getRawRows() {
    try {
      if (Array.isArray(window.__NIKKE_RAW)) return window.__NIKKE_RAW;
      if (typeof RAW !== 'undefined' && Array.isArray(RAW)) return RAW;
    } catch (_) {}
    return [];
  }

  // Match wishlist.js: the account's synced owned roster is the source of truth.
  const OWNED_ROSTER_STORAGE_PREFIX = 'nikke_synced_owned_characters_v1_';
  const ACCOUNT_DATA_STORAGE_PREFIX = 'nikkeGearManagerV6_account_';
  const ACTIVE_ACCOUNT_STORAGE_KEY = 'nikke_active_account_v1';
  const ACCOUNT_NAMES_STORAGE_KEY = 'nikke_account_names_v1';
  const TEST_ACCOUNT_NAME = '랜덤 테스트 계정';
  const normalizeRosterName = value => String(value == null ? '' : value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s:：·•._'’“”"\-–—()\[\]{}]/g, '');

  // Stage-deck-only categories copied from the site's established limited/distribution roster.
  const LIMITED_RANDOM_NAMES = new Set([
  "2B",
  "A2",
  "렘",
  "마키마",
  "파워",
  "레이",
  "레이 (가칭)",
  "아스카",
  "아스카 : WILLE",
  "마리",
  "미사토",
  "로산나 : 시크 오션",
  "루드밀라 : 윈터 오너",
  "루피 : 윈터 쇼퍼",
  "디젤 : 윈터 스위츠",
  "길로틴 : 윈터 슬레이어",
  "네온 : 블루 오션",
  "도로시 : 세렌디피티",
  "메어리 : 베이 갓데스",
  "메이든 : 아이스 로즈",
  "미카 : 스노우 버디",
  "브리드 : 사일런트 트랙",
  "사쿠라 : 블룸 인 서머",
  "아니스 : 스파클링 서머",
  "헬름 : 아쿠아마린",
  "마르차나 : 마린 스터디",
  "신데렐라 : 크리스탈 웨이브",
  "에밀리아",
  "에이다",
  "유키코",
  "이브",
  "일레그 : 붐 앤 쇼크",
  "질",
  "치사토",
  "퀸(마코토)",
  "타키나",
  "레이븐",
  "클레어",
  "쿠루미",
  "히메노",
  "사쿠라 스즈하라"
].map(normalizeRosterName));
  const DISTRIBUTION_RANDOM_NAMES = new Set([
  "앵커",
  "네베",
  "차임",
  "킬로",
  "파스칼",
  "앤 : 미라클 페어리",
  "아이기스",
  "길티",
  "신",
  "퀀시",
  "라푼젤:퓨어그레이스",
  "람",
  "릴리",
  "모리",
  "아비스타",
  "니힐리스타",
  "스노우 화이트 : 이노센트 데이즈",
  "라이"
].map(normalizeRosterName));

  function getActiveAccountName() {
    try {
      let accounts = ['계정1', '계정2'];
      const savedNames = JSON.parse(localStorage.getItem(ACCOUNT_NAMES_STORAGE_KEY) || 'null');
      if (Array.isArray(savedNames) && savedNames.length === 2 && savedNames.every(value => String(value).trim())) {
        accounts = savedNames.map(value => String(value).trim());
      }
      const savedAccount = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
      const hasSavedTestAccount = !!localStorage.getItem(ACCOUNT_DATA_STORAGE_PREFIX + encodeURIComponent(TEST_ACCOUNT_NAME));
      if (accounts.includes(savedAccount) || (savedAccount === TEST_ACCOUNT_NAME && hasSavedTestAccount)) return savedAccount;
      return accounts[0];
    } catch (_) {
      return '계정1';
    }
  }

  function getSyncedOwnedRoster() {
    // The stage-deck random roster is isolated from the site-wide active account.
    try {
      if (localStorage.getItem(RANDOM_ACCOUNT_ROSTER_ACTIVE_KEY) === '1') {
        const rawRandomRoster = localStorage.getItem(RANDOM_ACCOUNT_ROSTER_STORAGE_KEY);
        const savedRandomRoster = JSON.parse(rawRandomRoster || '[]');
        if (Array.isArray(savedRandomRoster)) {
          return new Set(savedRandomRoster.map(normalizeRosterName).filter(Boolean));
        }
        return new Set();
      }
    } catch (_) {}
    const account = getActiveAccountName();
    if (!account) return null;
    try {
      const raw = localStorage.getItem(OWNED_ROSTER_STORAGE_PREFIX + encodeURIComponent(account));
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) return new Set(saved.map(normalizeRosterName).filter(Boolean));
      }
    } catch (_) {}
    // Compatibility fallback: some older synced accounts saved the ownership marker with account rows.
    try {
      const raw = localStorage.getItem(ACCOUNT_DATA_STORAGE_PREFIX + encodeURIComponent(account));
      if (raw !== null) {
        const rows = JSON.parse(raw);
        if (Array.isArray(rows) && rows.some(row => row && typeof row.__nikkeSyncedOwned === 'boolean')) {
          return new Set(rows
            .filter(row => row && row.__nikkeSyncedOwned === true)
            .map(row => normalizeRosterName(row['이름'] || row.name))
            .filter(Boolean));
        }
      }
    } catch (_) {}
    return null;
  }

  function showNotice(message) {
    try {
      if (typeof window.toast === 'function') window.toast(message);
      else {
        const notice = document.getElementById('stageDeckNotice');
        if (notice) {
          notice.textContent = message;
          notice.hidden = false;
          clearTimeout(notice._hideTimer);
          notice._hideTimer = setTimeout(() => { notice.hidden = true; }, 2200);
        }
      }
    } catch (_) {}
  }

  function injectStyle() {
    if (document.getElementById('stageDeckStyle')) return;
    const style = document.createElement('style');
    style.id = 'stageDeckStyle';
    style.textContent = `
      body.stage-deck-view #kpis{display:none!important;}
      #stageDeckPanel{margin:0 0 24px;padding:0 14px 24px;color:var(--text,#263449);min-width:0}
      .stage-deck-head{padding:16px 18px;margin:0 0 16px;border:1px solid #d8e4ee;border-radius:14px;background:linear-gradient(135deg,#f7fbff,#eef6fc)}
      .stage-deck-head h3{font-size:20px;line-height:1.25;margin:0 0 6px;font-weight:900;color:#253b55}
      .stage-deck-head p{margin:0;color:#647b90;font-size:12px;line-height:1.55}
      .stage-deck-top{border:1px solid #d9e4ed;border-radius:16px;background:#fff;padding:18px 14px 14px;margin-bottom:14px;box-shadow:0 5px 18px rgba(47,87,119,.06)}
      .stage-deck-top-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
      .stage-deck-top-title{font-size:13px;font-weight:900;color:#324b65}
      .stage-deck-top-note{font-size:11px;color:#7890a5}
      .stage-deck-slots{display:grid;grid-template-columns:repeat(5,minmax(0,86px));justify-content:center;gap:12px}
      .stage-deck-slot{position:relative;min-width:0;aspect-ratio:4/5;border:2px solid #d4e0ea;border-radius:10px;background:#f5f8fb;color:#8298aa;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;transition:border-color .12s,box-shadow .12s,transform .12s;padding:0}
      .stage-deck-slot:hover{border-color:#7da9d3;transform:translateY(-1px)}
      .stage-deck-slot.active{border-color:#168bce;box-shadow:0 0 0 3px rgba(22,139,206,.14)}
      .stage-deck-slot .stage-slot-plus{font-size:42px;font-weight:300;line-height:1}
      .stage-deck-slot .stage-slot-num{position:absolute;left:6px;top:5px;font-size:10px;font-weight:900;color:#8295a8;z-index:2}
      .stage-deck-slot img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
      
      .stage-deck-slot .stage-slot-remove{position:absolute;right:4px;top:4px;width:20px;height:20px;border:0;border-radius:50%;background:rgba(17,35,52,.82);color:#fff;display:grid;place-items:center;font-size:14px;line-height:1;z-index:3;cursor:pointer;padding:0}
      .stage-deck-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;padding:10px 12px;border:1px solid #d8e4ee;border-radius:12px;background:#f7fafc}
      .stage-deck-account-creation{margin:0 0 14px;padding:15px;border:1px solid #c7ddeb;border-radius:14px;background:linear-gradient(135deg,#f8fcff,#edf7ff);box-shadow:0 5px 18px rgba(47,87,119,.06)}
      .stage-deck-account-disclosure{margin:0 0 14px;border:1px solid #b8d2e6;border-radius:13px;background:#fff;overflow:hidden}
      .stage-deck-account-disclosure>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;list-style:none;padding:13px 15px;cursor:pointer;font-size:13px;font-weight:1000;color:#2e5270;background:#eff7fd;user-select:none}
      .stage-deck-account-disclosure>summary::-webkit-details-marker{display:none}
      .stage-deck-account-disclosure>summary:before{content:'＋';display:inline-grid;place-items:center;flex:0 0 22px;width:22px;height:22px;border-radius:7px;background:#dceefa;color:#236f9d;font-size:15px}
      .stage-deck-account-disclosure>summary span:first-of-type{flex:1}
      .stage-deck-account-disclosure[open]>summary:before{content:'−'}
      .stage-deck-account-disclosure .stage-deck-disclosure-hint{font-size:10px;font-weight:800;color:#7190a8}
      .stage-deck-account-disclosure .stage-deck-account-creation{margin:0;border:0;border-top:1px solid #d4e4f0;border-radius:0;box-shadow:none}
      html.dark-theme .stage-deck-account-disclosure{background:#101b2b;border-color:#304359}
      html.dark-theme .stage-deck-account-disclosure>summary{background:#17283a;color:#dceafa}
      html.dark-theme .stage-deck-account-disclosure>summary:before{background:#203d56;color:#b9e5ff}
      html.dark-theme .stage-deck-account-disclosure .stage-deck-account-creation{border-top-color:#304359}
      html.dark-theme .stage-deck-account-disclosure .stage-deck-disclosure-hint{color:#8ea3b8}
      .stage-deck-account-disclosure[open]>summary .stage-deck-disclosure-hint{font-size:0}
      .stage-deck-account-disclosure[open]>summary .stage-deck-disclosure-hint:after{content:'눌러서 닫기';font-size:10px}

      .stage-deck-account-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
      .stage-deck-account-title h4{margin:0 0 5px;color:#253f59;font-size:15px;font-weight:1000}
      .stage-deck-account-title p{margin:0;color:#6e8498;font-size:11px;line-height:1.5}
      .stage-deck-account-actions{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;flex:0 0 auto}
      .stage-deck-account-actions .stage-deck-random-account,.stage-deck-account-actions .stage-deck-ten-pull{height:40px;padding:0 15px;border-radius:9px;font-size:12px;font-weight:1000}
      .stage-deck-account-actions .stage-deck-ten-pull{border:1px solid #168bce;background:#168bce;color:#fff;cursor:pointer;box-shadow:0 3px 8px rgba(22,139,206,.18)}
      .stage-deck-account-actions .stage-deck-ten-pull:hover{background:#0878b8}
      .stage-deck-top-actions{display:flex;align-items:center;gap:8px}
      .stage-deck-gacha-result.batch{display:block;padding:8px}
      .stage-deck-gacha-batch-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;width:100%}
      .stage-deck-gacha-batch-item{min-width:0;overflow:hidden;border:1px solid #d8e4ed;border-radius:8px;background:#fff}
      .stage-deck-gacha-batch-item img{display:block;width:100%;height:88px;object-fit:cover;object-position:center top;border-radius:0}
      .stage-deck-gacha-batch-copy{display:flex;flex-direction:column;gap:3px;padding:6px;min-width:0}
      .stage-deck-gacha-batch-copy .stage-deck-gacha-result-name{font-size:11px;line-height:1.25;overflow-wrap:anywhere}
      .stage-deck-gacha-batch-copy>span:last-child{font-size:9px;color:#8a6b4b;line-height:1.3}
      html.dark-theme .stage-deck-account-creation{background:linear-gradient(135deg,#111d2c,#17283a);border-color:#304359}
      html.dark-theme .stage-deck-account-title h4{color:#e1edf8}
      html.dark-theme .stage-deck-account-title p{color:#8ea3b8}
      html.dark-theme .stage-deck-gacha-batch-item{background:#101b2b;border-color:#304359}
      @media(max-width:650px){
        .stage-deck-account-head{flex-direction:column}
        .stage-deck-account-actions{justify-content:flex-start;width:100%}
        .stage-deck-account-actions .stage-deck-random-account,.stage-deck-account-actions .stage-deck-ten-pull{flex:1}
        .stage-deck-top-head{align-items:flex-start}
        .stage-deck-top-actions{align-items:flex-end;flex-direction:column;gap:5px}
        .stage-deck-gacha-batch-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .stage-deck-gacha-batch-item img{height:115px}
      }
      .stage-deck-search-wrap{position:relative;display:flex;align-items:center;flex:1 1 240px;min-width:170px}
      .stage-deck-search{width:100%;min-width:0;height:38px;border:1px solid #ccdae5;border-radius:9px;background:#fff;color:#263b50;padding:0 12px;font-size:12px;outline:none}
      .stage-deck-search:focus{border-color:#2a91d2;box-shadow:0 0 0 3px rgba(42,145,210,.13)}
      .stage-deck-filter-btn{height:38px;min-width:40px;padding:0 13px;border:1px solid #c9d8e4;border-radius:9px;background:#fff;color:#4e6780;font-size:12px;font-weight:900;cursor:pointer}
      .stage-deck-filter-btn:hover{border-color:#7da9d3}
      .stage-deck-filter-btn.active{background:#168bce;border-color:#168bce;color:#fff;box-shadow:0 3px 8px rgba(22,139,206,.18)}
      .stage-deck-unowned-toggle{height:38px;padding:0 12px;border:1px solid #c9d8e4;border-radius:9px;background:#fff;color:#4e6780;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap}
      .stage-deck-unowned-toggle:hover{border-color:#7da9d3}
      .stage-deck-unowned-toggle.active{background:#e9faf3;border-color:#8bcfb6;color:#187b59}
      html.dark-theme .stage-deck-unowned-toggle{background:#172437;border-color:#354a62;color:#b6cce0}
      html.dark-theme .stage-deck-unowned-toggle.active{background:#183b32;border-color:#327b68;color:#a4f0d4}
      .stage-deck-sort{height:38px;max-width:190px;min-width:135px;border:1px solid #c9d8e4;border-radius:9px;background:#fff;color:#405a73;padding:0 9px;font-size:11px;font-weight:800}
      .stage-deck-clear{height:38px;padding:0 12px;border:1px solid #d9caca;border-radius:9px;background:#fff;color:#925453;font-size:11px;font-weight:900;cursor:pointer}
      .stage-deck-auto-recommend{height:38px;padding:0 13px;border:1px solid #168bce;border-radius:9px;background:#168bce;color:#fff;font-size:11px;font-weight:1000;cursor:pointer;white-space:nowrap;box-shadow:0 3px 8px rgba(22,139,206,.16)}
      .stage-deck-auto-recommend:hover{background:#0878b8;border-color:#0878b8}
      html.dark-theme .stage-deck-auto-recommend{background:#176e9f;border-color:#4ba9de;color:#fff}
      html.dark-theme .stage-deck-auto-recommend:hover{background:#2184ba}

      .stage-deck-clear:hover{background:#fff4f3;border-color:#c99896}
      .stage-deck-random-account{height:38px;padding:0 12px;border:1px solid #78b3df;border-radius:9px;background:#eaf6ff;color:#24699a;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap}
      .stage-deck-random-account:hover{background:#dff0ff;border-color:#4c9ed8}
      .stage-deck-gacha-reset{height:38px;padding:0 12px;border:1px solid #c9d8e4;border-radius:9px;background:#fff;color:#596f82;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap}
      .stage-deck-gacha-reset:hover{border-color:#92a9bc;background:#f6f9fc}
      .stage-deck-gacha-rates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;flex-basis:100%;padding-top:12px}
      .stage-deck-gacha-rates>div{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border:1px solid #d9e4ed;border-radius:9px;background:#fff}
      .stage-deck-gacha-rates strong{font-size:13px;color:#30475e}
      .stage-deck-gacha-rates span{font-size:10px;line-height:1.4;color:#7a8da0}
      .stage-deck-gacha-panel{margin:0 0 14px;padding:14px;border:1px solid #d8e4ee;border-radius:12px;background:#f7fafc}
      .stage-deck-gacha-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
      .stage-deck-gacha-panel-head strong{font-size:13px;color:#30475e}
      .stage-deck-gacha-panel-head span{font-size:11px;color:#7890a5}
      .stage-deck-gacha-result{min-height:68px;display:flex;align-items:center;gap:12px;padding:10px;border:1px dashed #cbd9e4;border-radius:10px;background:#fff;color:#7890a5;font-size:12px}
      .stage-deck-gacha-result img{width:58px;height:72px;object-fit:cover;border-radius:7px}
      .stage-deck-gacha-result-copy{display:flex;flex-direction:column;gap:4px;min-width:0}
      .stage-deck-gacha-result-name{font-size:14px;font-weight:900;color:#30475e}
      .stage-deck-gacha-rarity{font-size:11px;font-weight:900}
      .stage-deck-gacha-rarity.ssr{color:#bf8b18}
      .stage-deck-gacha-rarity.sr{color:#8460d1}
      .stage-deck-gacha-rarity.r{color:#427ab0}
      .stage-deck-gacha-duplicate{font-size:10px;color:#ad6a35;font-weight:800}
      .stage-deck-gacha-history{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
      .stage-deck-gacha-history span{padding:4px 7px;border:1px solid #d8e4ee;border-radius:6px;background:#fff;color:#6e8598;font-size:10px}
      html.dark-theme .stage-deck-gacha-reset{background:#172437;border-color:#354a62;color:#c4d5e6}
      html.dark-theme .stage-deck-gacha-rates>div,html.dark-theme .stage-deck-gacha-result,html.dark-theme .stage-deck-gacha-history span{background:#101b2b;border-color:#304359}
      html.dark-theme .stage-deck-gacha-rates strong,html.dark-theme .stage-deck-gacha-result-name,html.dark-theme .stage-deck-gacha-panel-head strong{color:#dce6f1}
      html.dark-theme .stage-deck-gacha-rates span,html.dark-theme .stage-deck-gacha-panel-head span,html.dark-theme .stage-deck-gacha-result{color:#8ea3b8}
      @media(max-width:650px){.stage-deck-gacha-rates{grid-template-columns:1fr}.stage-deck-gacha-result img{width:50px;height:62px}}
      .stage-deck-random-settings{margin:0 0 12px;border:1px solid #d8e4ee;border-radius:10px;background:#f7fafc;color:#405a73}
      .stage-deck-random-settings summary{padding:10px 12px;font-size:12px;font-weight:900;cursor:pointer;user-select:none}
      .stage-deck-random-settings-body{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:0 12px 12px;border-top:1px solid #d8e4ee}
      .stage-deck-random-owned{display:flex;align-items:center;gap:10px;flex:1 1 250px;min-width:220px;padding-top:12px}
      .stage-deck-random-owned label{font-size:11px;font-weight:900;white-space:nowrap}
      .stage-deck-random-owned input{width:100%;min-width:90px;accent-color:#168bce}
      .stage-deck-random-owned output{min-width:38px;text-align:right;font-size:12px;font-weight:900;color:#24699a}
      .stage-deck-random-includes{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:12px}
      .stage-deck-random-switch{display:inline-flex;align-items:center;gap:7px;border:1px solid #ccdae5;border-radius:8px;background:#fff;padding:6px 9px;font-size:11px;font-weight:800;cursor:pointer}
      .stage-deck-random-switch input{accent-color:#168bce}
      .stage-deck-random-switch strong{min-width:30px;padding:3px 5px;border-radius:5px;background:#e9faf3;color:#187b59;text-align:center;font-size:10px}
      .stage-deck-random-switch:has(input:not(:checked)) strong{background:#fbeaea;color:#a04444}
      .stage-deck-use-actual-roster{height:38px;padding:0 12px;border:1px solid #c9d8e4;border-radius:9px;background:#fff;color:#4e6780;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap}
      .stage-deck-use-actual-roster[hidden]{display:none!important}
      html.dark-theme .stage-deck-random-switch{background:#172437;border-color:#354a62;color:#dce6f1}
      html.dark-theme .stage-deck-random-switch strong{background:#183b32;color:#a4f0d4}
      html.dark-theme .stage-deck-random-switch:has(input:not(:checked)) strong{background:#48272e;color:#ffb8bc}
      html.dark-theme .stage-deck-use-actual-roster{background:#172437;border-color:#354a62;color:#c4d5e6}
      .stage-deck-random-note{flex-basis:100%;margin-top:-3px;color:#8195a8;font-size:10px;line-height:1.45}
      html.dark-theme .stage-deck-random-settings{background:#101b2b;border-color:#304359;color:#dce6f1}
      html.dark-theme .stage-deck-random-settings-body{border-color:#304359}
      html.dark-theme .stage-deck-random-owned output{color:#9ecfff}
      @media(max-width:650px){.stage-deck-random-settings-body{gap:4px}.stage-deck-random-owned{flex-basis:100%;min-width:0}.stage-deck-random-includes{gap:10px}}
      .stage-deck-count{margin-left:auto;color:#6e8598;font-size:11px;font-weight:800;white-space:nowrap}
      .stage-deck-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(142px,1fr));gap:12px}
      .stage-deck-card{position:relative;min-width:0;border:1px solid #d9e4ed;border-radius:12px;background:#fff;overflow:hidden;cursor:pointer;box-shadow:0 3px 12px rgba(40,78,110,.05);transition:transform .12s,border-color .12s,box-shadow .12s}
      .stage-deck-card.unowned .stage-deck-card-img img{filter:grayscale(1)!important}
      .stage-deck-card:hover{transform:translateY(-2px);border-color:#81b2d8;box-shadow:0 8px 18px rgba(40,91,133,.13)}
      .stage-deck-card.selected{border:2px solid #168bce;box-shadow:none}
      .stage-deck-card-img{position:relative;width:100%;aspect-ratio:3/4;background:#edf3f7;overflow:hidden}
      .stage-deck-card-img img{width:100%;height:100%;object-fit:cover;display:block}
      .stage-deck-card-burst{position:absolute;left:7px;top:7px;min-width:23px;height:23px;padding:0 5px;border-radius:6px;background:rgba(17,30,44,.86);color:#fff;display:grid;place-items:center;font-size:11px;font-weight:900}
      .stage-deck-card-picked{position:absolute;right:7px;top:7px;width:24px;height:24px;border-radius:50%;background:#168bce;color:white;display:grid;place-items:center;font-weight:900;font-size:13px;box-shadow:0 2px 7px rgba(0,0,0,.2)}
      .stage-deck-card-name{min-height:30px;padding:5px 7px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:12px;line-height:1.25;font-weight:900;color:#30475e;overflow-wrap:anywhere}
      .stage-deck-empty{grid-column:1/-1;padding:44px 16px;text-align:center;border:1px dashed #cad9e5;border-radius:12px;color:#8195a8;font-size:12px}
      #stageDeckNotice{position:sticky;bottom:10px;z-index:5;margin:12px auto 0;width:max-content;max-width:100%;border-radius:9px;background:#1d3348;color:#fff;padding:9px 14px;font-size:11px;font-weight:800;box-shadow:0 8px 22px rgba(0,0,0,.16)}
      #stageDeckPanel[hidden]{display:none!important}
      html.dark-theme #stageDeckPanel{color:#dce6f1}
      html.dark-theme .stage-deck-head{background:linear-gradient(135deg,#111d2c,#17283a);border-color:#304359}
      html.dark-theme .stage-deck-head h3,.dark-theme .stage-deck-top-title{color:#e1edf8}
      html.dark-theme .stage-deck-head p,.dark-theme .stage-deck-top-note,.dark-theme .stage-deck-count{color:#8ea3b8}
      html.dark-theme .stage-deck-top,html.dark-theme .stage-deck-toolbar,html.dark-theme .stage-deck-card{background:#111b2a;border-color:#2d3b50}
      html.dark-theme .stage-deck-slot{background:#0d1725;border-color:#34465b;color:#91a6bb}
      html.dark-theme .stage-deck-slot.active{border-color:#49a9e8}
      html.dark-theme .stage-deck-slot .stage-slot-name{background:#1b2b3d;color:#d9e8f5}
      html.dark-theme .stage-deck-search,html.dark-theme .stage-deck-sort,html.dark-theme .stage-deck-filter-btn,html.dark-theme .stage-deck-clear{background:#0e1725;color:#d1dfed;border-color:#35465b}
      html.dark-theme .stage-deck-filter-btn.active{background:#168bce;border-color:#168bce;color:#fff}
      html.dark-theme .stage-deck-card-name{color:#d9e6f2}
      html.dark-theme .stage-deck-card-img{background:#1a2736}
      html.dark-theme .stage-deck-chip{background:#172536;border-color:#304359;color:#a9bed1}
      html.dark-theme .stage-deck-empty{border-color:#3a4c62;color:#8ea3b8}
      @media(max-width:680px){
        #stageDeckPanel{padding:0 8px 18px}
        .stage-deck-head{padding:13px 14px}
        .stage-deck-slots{grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}
        .stage-deck-top{padding:12px 8px}
        .stage-deck-slot .stage-slot-name{font-size:9px}
        .stage-deck-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
        .stage-deck-toolbar{gap:6px;padding:8px}
        .stage-deck-search-wrap{flex:1 1 100%}
        .stage-deck-sort{flex:1;max-width:none}
        .stage-deck-count{margin-left:0}
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if (document.getElementById('stageDeckPanel')) return;
    const main = document.querySelector('main.main');
    if (!main) return;
    const panel = document.createElement('section');
    panel.id = 'stageDeckPanel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="stage-deck-head">
        <h3>스테이지 덱 추천</h3>
        <p>아래 도감에서 니케를 누르면 위쪽 5인 덱에 배치됩니다. 위 슬롯을 먼저 누르면 원하는 위치에 넣거나 교체할 수 있습니다.</p>
      </div>
      <section class="stage-deck-top" aria-label="스테이지 덱 슬롯">
        <div class="stage-deck-top-head"><span class="stage-deck-top-title">선택한 니케 <span id="stageDeckSelectedCount">0 / 5</span></span><span class="stage-deck-top-actions"><span class="stage-deck-top-note">슬롯을 눌러 배치 위치 선택</span><button type="button" class="stage-deck-auto-recommend" id="stageDeckAutoRecommend" title="보유한 니케 중 무작위로 5명을 추천합니다">자동추천</button><button type="button" class="stage-deck-clear" id="stageDeckClear">덱 비우기</button></span></div>
        <div class="stage-deck-slots" id="stageDeckSlots"></div>
      </section>
      <details class="stage-deck-account-disclosure" id="stageDeckAccountDisclosure">
        <summary><span>계정 생성 · 뽑기</span><span class="stage-deck-disclosure-hint">눌러서 열기</span></summary>
      <section class="stage-deck-account-creation" id="stageDeckAccountCreation" aria-label="계정 생성 및 뽑기">
        <div class="stage-deck-account-head">
          <div class="stage-deck-account-title">
            <h4>계정 생성 · 뽑기 시뮬레이터</h4>
            <p>뽑은 니케만 스테이지 추천 전용 보유 목록에 반영됩니다. 실제 계정 보유 데이터와는 분리됩니다.</p>
          </div>
          <div class="stage-deck-account-actions">
            <button type="button" class="stage-deck-random-account" id="stageDeckRandomAccount" title="확률에 따라 캐릭터 1명을 뽑습니다">1회 뽑기</button>
            <button type="button" class="stage-deck-ten-pull" id="stageDeckTenPull" title="확률에 따라 캐릭터 10명을 뽑습니다">10회 뽑기</button>
            <button type="button" class="stage-deck-gacha-reset" id="stageDeckGachaReset">뽑기 초기화</button>
            <button type="button" class="stage-deck-use-actual-roster" id="stageDeckUseActualRoster" hidden>실제 보유 목록</button>
          </div>
        </div>
        <details class="stage-deck-random-settings" id="stageDeckRandomSettings">
          <summary>뽑기 확률 및 캐릭터 설정</summary>
          <div class="stage-deck-random-settings-body">
            <div class="stage-deck-gacha-rates" aria-label="뽑기 확률">
              <div><strong>SSR 4%</strong><span>필그림 0.5% · 기타 SSR 3.5%</span></div>
              <div><strong>SR 43%</strong><span>SR 캐릭터</span></div>
              <div><strong>R 53%</strong><span>R 캐릭터</span></div>
            </div>
            <div class="stage-deck-random-includes">
              <label class="stage-deck-random-switch"><input type="checkbox" id="stageDeckIncludeLimited" checked><span>한정 캐</span><strong data-stage-random-status="limited">ON</strong></label>
              <label class="stage-deck-random-switch"><input type="checkbox" id="stageDeckIncludeDistribution" checked><span>배포 캐</span><strong data-stage-random-status="distribution">ON</strong></label>
            </div>
            <div class="stage-deck-random-note">1회 뽑기는 1명, 10회 뽑기는 10명을 각각 독립 확률로 획득합니다. 전체 뽑기 기준 필그림 SSR은 0.5%, 그 외 SSR은 3.5%입니다. OFF로 끈 유형은 등장 대상에서 제외됩니다. 결과는 스테이지 추천 전용으로 저장됩니다.</div>
          </div>
        </details>
        <section class="stage-deck-gacha-panel" id="stageDeckGachaPanel" aria-label="뽑기 결과">
          <div class="stage-deck-gacha-panel-head"><strong>뽑기 결과</strong><span id="stageDeckGachaStats">누적 0회 · 보유 0명</span></div>
          <div id="stageDeckGachaResult" class="stage-deck-gacha-result">‘1회 뽑기’ 또는 ‘10회 뽑기’를 눌러 시작하세요.</div>
          <div id="stageDeckGachaHistory" class="stage-deck-gacha-history"></div>
        </section>
      </section>
      </details>
      <div class="stage-deck-toolbar">
        <label class="stage-deck-search-wrap"><input id="stageDeckSearch" class="stage-deck-search" type="search" placeholder="니케 이름 검색…" autocomplete="off" aria-label="니케 이름 검색"></label>
        <button type="button" class="stage-deck-filter-btn" data-burst="1" aria-pressed="false">Ⅰ</button>
        <button type="button" class="stage-deck-filter-btn" data-burst="2" aria-pressed="false">Ⅱ</button>
        <button type="button" class="stage-deck-filter-btn" data-burst="3" aria-pressed="false">Ⅲ</button>
        <button type="button" class="stage-deck-unowned-toggle" id="stageDeckUnownedToggle" aria-pressed="false">미보유 캐릭터 보이기</button>
        <select id="stageDeckSort" class="stage-deck-sort" aria-label="캐릭터 정렬">
          <option value="power_desc">전투력 높은 순</option>
          <option value="name_asc">이름순</option>
          <option value="pedia">도감 순</option>
          <option value="burst">버스트 순</option>
        </select>
        <span class="stage-deck-count" id="stageDeckVisibleCount"></span>
      </div>
      <div class="stage-deck-grid" id="stageDeckGrid" aria-label="캐릭터 도감 목록"></div>
      <div id="stageDeckNotice" hidden aria-live="polite"></div>
    `;
    const insertBefore = main.querySelector('#soleScorePanel,#outpostPanel,#characterPanel');
    if (insertBefore) main.insertBefore(panel, insertBefore);
    else main.appendChild(panel);
  }

  function ensureNav() {
    const nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('[data-view="stageDeck"]')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'main-view-nav';
    btn.dataset.view = 'stageDeck';
    btn.textContent = '스테이지 덱 추천';
    btn.addEventListener('click', () => window.switchMainView && window.switchMainView('stageDeck'));
    nav.appendChild(btn);
  }

  function loadSavedDeck() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) slots = Array.from({length:SLOT_COUNT}, (_,i) => typeof saved[i] === 'string' ? saved[i] : '');
    } catch (_) {}
    const seen = new Set();
    slots = slots.map(name => {
      if (!name || seen.has(name)) return '';
      seen.add(name);
      return name;
    });
    activeSlot = Math.max(0, slots.findIndex(name => !name));
    if (activeSlot < 0) activeSlot = 0;
  }

  function saveDeck() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)); } catch (_) {}
    renderSlots();
    renderGrid();
  }

  function getCharacter(name) {
    return pedia.find(item => item.name === name);
  }

  function getMeta(name) {
    return metaByName[name] || {};
  }

  function getPower(name) {
    const rows = getRawRows();
    const row = rows.find(item => String(item && (item['이름'] || item.name) || '').trim() === name);
    const value = Number(row && (row['전투력'] || row.power || row.combatPower));
    return Number.isFinite(value) ? value : 0;
  }

  function renderSlots() {
    const container = document.getElementById('stageDeckSlots');
    const count = document.getElementById('stageDeckSelectedCount');
    if (!container) return;
    const chosen = slots.filter(Boolean).length;
    if (count) count.textContent = chosen + ' / ' + SLOT_COUNT;
    container.innerHTML = slots.map((name, index) => {
      const item = name ? getCharacter(name) : null;
      const image = item && /^https?:\/\//i.test(String(item.image || '')) ? item.image : '';
      const current = index === activeSlot;
      if (!item) {
        return '<div class="stage-deck-slot '+(current?'active':'')+'" data-slot="'+index+'" role="button" tabindex="0" aria-label="'+(index+1)+'번 슬롯 선택, 비어 있음"><span class="stage-slot-num">'+(index+1)+'</span><span class="stage-slot-plus">+</span></div>';
      }
      return '<div class="stage-deck-slot '+(current?'active':'')+'" data-slot="'+index+'" role="button" tabindex="0" aria-label="'+(index+1)+'번 슬롯 선택: '+esc(name)+'"><span class="stage-slot-num">'+(index+1)+'</span>'+(image?'<img src="'+esc(image)+'" alt="'+esc(name)+'">':'<span class="stage-slot-plus">＋</span>')+'<button type="button" class="stage-slot-remove" data-remove-slot="'+index+'" aria-label="'+(index+1)+'번 슬롯 비우기">×</button></div>';
    }).join('');
    container.querySelectorAll('[data-slot]').forEach(el => {
      const index = Number(el.dataset.slot);
      const handleSlot = () => {
        if (slots[index]) {
          removeCharacterFromDeck(index);
        } else {
          activeSlot = index;
          renderSlots();
        }
      };
      el.addEventListener('click', event => {
        if (event.target.closest('[data-remove-slot]')) return;
        handleSlot();
      });
      el.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleSlot(); }
      });
    });
    container.querySelectorAll('[data-remove-slot]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      removeCharacterFromDeck(Number(button.dataset.removeSlot));
    }));
  }

  function loadStageDeckRandomSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(RANDOM_ACCOUNT_OPTIONS_STORAGE_KEY) || '{}') || {}; } catch (_) {}
    return {
      includeLimited: saved.includeLimited !== false,
      includeDistribution: saved.includeDistribution !== false
    };
  }

  function saveStageDeckRandomSettings() {
    const limitedInput = document.getElementById('stageDeckIncludeLimited');
    const distributionInput = document.getElementById('stageDeckIncludeDistribution');
    const old = loadStageDeckRandomSettings();
    const settings = {
      includeLimited: limitedInput ? limitedInput.checked : old.includeLimited,
      includeDistribution: distributionInput ? distributionInput.checked : old.includeDistribution
    };
    try { localStorage.setItem(RANDOM_ACCOUNT_OPTIONS_STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
    updateRandomInclusionStatus(settings);
  }

  function loadStageDeckGachaState() {
    const empty = {pulls:0, counts:{}, history:[], rarityCounts:{SSR:0,SR:0,R:0}, pilgrimSSR:0};
    try {
      const saved = JSON.parse(localStorage.getItem(STAGE_GACHA_STATE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return empty;
      return {
        pulls: Math.max(0, Number(saved.pulls) || 0),
        counts: saved.counts && typeof saved.counts === 'object' ? saved.counts : {},
        history: Array.isArray(saved.history) ? saved.history.slice(-20) : [],
        rarityCounts: {
          SSR: Math.max(0, Number(saved.rarityCounts && saved.rarityCounts.SSR) || 0),
          SR: Math.max(0, Number(saved.rarityCounts && saved.rarityCounts.SR) || 0),
          R: Math.max(0, Number(saved.rarityCounts && saved.rarityCounts.R) || 0)
        },
        pilgrimSSR: Math.max(0, Number(saved.pilgrimSSR) || 0)
      };
    } catch (_) { return empty; }
  }

  function saveStageDeckGachaState(state) {
    const ownedNames = Object.keys(state.counts).filter(name => Number(state.counts[name]) > 0);
    try {
      localStorage.setItem(STAGE_GACHA_STATE_KEY, JSON.stringify(state));
      localStorage.setItem(RANDOM_ACCOUNT_ROSTER_STORAGE_KEY, JSON.stringify(ownedNames));
      localStorage.setItem(RANDOM_ACCOUNT_ROSTER_ACTIVE_KEY, '1');
      return true;
    } catch (_) {
      showNotice('뽑기 결과를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');
      return false;
    }
  }

  function getAvailableGachaPool(settings) {
    return pedia.map(item => ({item, name:String(item && item.name || '').trim(), meta:getMeta(String(item && item.name || '').trim())}))
      .filter(entry => {
        if (!entry.name) return false;
        const rarity = String(entry.meta.rarity || '').toUpperCase();
        if (!['SSR','SR','R'].includes(rarity)) return false;
        const normalized = normalizeRosterName(entry.name);
        if (!settings.includeLimited && LIMITED_RANDOM_NAMES.has(normalized)) return false;
        if (!settings.includeDistribution && DISTRIBUTION_RANDOM_NAMES.has(normalized)) return false;
        return true;
      });
  }

  function chooseRandom(items) {
    return items.length ? items[Math.floor(Math.random() * items.length)] : null;
  }

  function renderStageDeckGachaStatus(latest = null) {
    const state = loadStageDeckGachaState();
    const stats = document.getElementById('stageDeckGachaStats');
    const result = document.getElementById('stageDeckGachaResult');
    const history = document.getElementById('stageDeckGachaHistory');
    if (stats) stats.textContent = '누적 ' + state.pulls + '회 · 보유 ' + Object.keys(state.counts).filter(name => Number(state.counts[name]) > 0).length + '명 · 필그림 SSR ' + state.pilgrimSSR + '회';
    const batch = Array.isArray(latest) && latest.length > 1 ? latest : null;
    const outcome = batch ? null : (Array.isArray(latest) ? latest[0] : latest) || state.history[state.history.length - 1] || null;
    if (result) {
      if (batch) {
        result.classList.add('batch');
        result.innerHTML = '<div class="stage-deck-gacha-batch-grid">' + batch.map(entry => {
          const item = getCharacter(entry.name);
          const image = item && String(item.image || '').startsWith('http') ? String(item.image) : '';
          const rarity = String(entry.rarity || '').toLowerCase();
          return '<div class="stage-deck-gacha-batch-item">' +
            (image ? '<img src="' + esc(image) + '" alt="' + esc(entry.name) + '">' : '') +
            '<div class="stage-deck-gacha-batch-copy"><span class="stage-deck-gacha-rarity ' + esc(rarity) + '">' + esc(entry.rarity) + (entry.pilgrim ? ' · 필그림' : '') + '</span>' +
            '<strong class="stage-deck-gacha-result-name">' + esc(entry.name) + '</strong>' +
            '<span>' + (entry.duplicate ? '중복 ' + esc(entry.characterCount) + '번째' : '신규 획득') + '</span></div></div>';
        }).join('') + '</div>';
      } else {
        result.classList.remove('batch');
        if (!outcome) {
          result.textContent = '‘1회 뽑기’ 또는 ‘10회 뽑기’를 눌러 시작하세요.';
        } else {
          const item = getCharacter(outcome.name);
          const image = item && String(item.image || '').startsWith('http') ? String(item.image) : '';
          const rarity = String(outcome.rarity || '').toLowerCase();
          result.innerHTML = (image ? '<img src="' + esc(image) + '" alt="' + esc(outcome.name) + '">' : '') +
            '<div class="stage-deck-gacha-result-copy"><span class="stage-deck-gacha-rarity ' + esc(rarity) + '">' + esc(outcome.rarity) + (outcome.pilgrim ? ' · 필그림' : '') + '</span>' +
            '<strong class="stage-deck-gacha-result-name">' + esc(outcome.name) + '</strong>' +
            '<span>' + esc(outcome.company || '') + (outcome.duplicate ? ' · 중복 획득 (' + esc(outcome.characterCount) + '번째)' : ' · 신규 획득') + '</span></div>';
        }
      }
    }
    if (history) {
      history.innerHTML = state.history.slice(-10).reverse().map(entry =>
        '<span title="' + esc(entry.name) + '">' + esc(entry.pull) + '. ' + esc(entry.rarity) + ' ' + esc(entry.name) + '</span>'
      ).join('');
    }
    const actualButton = document.getElementById('stageDeckUseActualRoster');
    if (actualButton) actualButton.hidden = localStorage.getItem(RANDOM_ACCOUNT_ROSTER_ACTIVE_KEY) !== '1';
    const resetButton = document.getElementById('stageDeckGachaReset');
    if (resetButton) resetButton.hidden = state.pulls === 0 && localStorage.getItem(RANDOM_ACCOUNT_ROSTER_ACTIVE_KEY) !== '1';
  }

  function drawStageDeckGacha(pullCount = 1) {
    const settings = loadStageDeckRandomSettings();
    const eligible = getAvailableGachaPool(settings);
    if (!eligible.length) {
      showNotice('선택한 한정·배포 설정에 해당하는 뽑기 대상이 없습니다.');
      return;
    }
    const ssr = eligible.filter(entry => String(entry.meta.rarity || '').toUpperCase() === 'SSR');
    const pilgrimSSR = ssr.filter(entry => String(entry.meta.company || '').trim() === '필그림');
    const otherSSR = ssr.filter(entry => String(entry.meta.company || '').trim() !== '필그림');
    const sr = eligible.filter(entry => String(entry.meta.rarity || '').toUpperCase() === 'SR');
    const r = eligible.filter(entry => String(entry.meta.rarity || '').toUpperCase() === 'R');
    const state = loadStageDeckGachaState();
    const outcomes = [];
    const requestedPulls = Number(pullCount) === 10 ? 10 : 1;

    for (let drawIndex = 0; drawIndex < requestedPulls; drawIndex++) {
      // Rates are per pull: SSR 4%, SR 43%, R 53%. Pilgrim SSR is 0.5% of all pulls.
      const roll = Math.random();
      const rarity = roll < 0.04 ? 'SSR' : (roll < 0.47 ? 'SR' : 'R');
      let selected = null;
      let isPilgrim = false;
      if (rarity === 'SSR') {
        if (pilgrimSSR.length && otherSSR.length) {
          isPilgrim = Math.random() < 0.125;
          selected = chooseRandom(isPilgrim ? pilgrimSSR : otherSSR);
        } else {
          selected = chooseRandom(pilgrimSSR.length ? pilgrimSSR : otherSSR);
          isPilgrim = !!selected && String(selected.meta.company || '').trim() === '필그림';
        }
      } else if (rarity === 'SR') {
        selected = chooseRandom(sr);
      } else {
        selected = chooseRandom(r);
      }
      if (!selected) {
        showNotice(rarity + ' 등급의 뽑기 대상 캐릭터가 없습니다. 한정·배포 설정을 확인해 주세요.');
        break;
      }

      const name = selected.name;
      const oldCount = Math.max(0, Number(state.counts[name]) || 0);
      state.pulls += 1;
      state.counts[name] = oldCount + 1;
      state.rarityCounts[rarity] = (state.rarityCounts[rarity] || 0) + 1;
      if (rarity === 'SSR' && isPilgrim) state.pilgrimSSR += 1;
      const outcome = {
        pull: state.pulls,
        name,
        rarity,
        company: String(selected.meta.company || ''),
        pilgrim: rarity === 'SSR' && isPilgrim,
        duplicate: oldCount > 0,
        characterCount: oldCount + 1
      };
      state.history.push(outcome);
      outcomes.push(outcome);
    }

    if (!outcomes.length) return;
    state.history = state.history.slice(-20);
    if (!saveStageDeckGachaState(state)) return;
    updateRandomInclusionStatus(settings);
    renderStageDeckGachaStatus(outcomes.length > 1 ? outcomes : outcomes[0]);
    renderGrid();
    if (outcomes.length === 1) {
      const outcome = outcomes[0];
      showNotice(outcome.duplicate ? '중복 획득: ' + outcome.name : '신규 획득: ' + outcome.name + ' (' + outcome.rarity + ')');
    } else {
      const ssrCount = outcomes.filter(outcome => outcome.rarity === 'SSR').length;
      const newCount = outcomes.filter(outcome => !outcome.duplicate).length;
      const duplicateCount = outcomes.length - newCount;
      showNotice(outcomes.length + '회 뽑기 완료 · SSR ' + ssrCount + '명 · 신규 ' + newCount + '명 · 중복 ' + duplicateCount + '회');
    }
  }

  function clearStageDeckGacha() {
    if (!confirm('스테이지 추천 전용 뽑기 기록과 보유 목록을 초기화할까요?')) return;
    const empty = {pulls:0, counts:{}, history:[], rarityCounts:{SSR:0,SR:0,R:0}, pilgrimSSR:0};
    try {
      localStorage.setItem(STAGE_GACHA_STATE_KEY, JSON.stringify(empty));
      localStorage.setItem(RANDOM_ACCOUNT_ROSTER_STORAGE_KEY, JSON.stringify([]));
      localStorage.setItem(RANDOM_ACCOUNT_ROSTER_ACTIVE_KEY, '1');
    } catch (_) {}
    renderStageDeckGachaStatus();
    renderGrid();
    updateRandomInclusionStatus();
    showNotice('스테이지 추천 전용 뽑기를 초기화했습니다.');
  }

  function updateRandomInclusionStatus(settings = loadStageDeckRandomSettings()) {
    const limitedStatus = document.querySelector('[data-stage-random-status="limited"]');
    const distributionStatus = document.querySelector('[data-stage-random-status="distribution"]');
    if (limitedStatus) limitedStatus.textContent = settings.includeLimited ? 'ON' : 'OFF';
    if (distributionStatus) distributionStatus.textContent = settings.includeDistribution ? 'ON' : 'OFF';
    const actualButton = document.getElementById('stageDeckUseActualRoster');
    if (actualButton) actualButton.hidden = localStorage.getItem(RANDOM_ACCOUNT_ROSTER_ACTIVE_KEY) !== '1';
  }

  function useActualOwnedRoster() {
    try { localStorage.removeItem(RANDOM_ACCOUNT_ROSTER_ACTIVE_KEY); } catch (_) {}
    updateRandomInclusionStatus();
    renderStageDeckGachaStatus();
    renderGrid();
    showNotice('실제 계정의 보유 니케 목록으로 돌아왔습니다.');
  }

  function initStageDeckRandomSettings() {
    const settings = loadStageDeckRandomSettings();
    const limitedInput = document.getElementById('stageDeckIncludeLimited');
    const distributionInput = document.getElementById('stageDeckIncludeDistribution');
    if (limitedInput) limitedInput.checked = settings.includeLimited;
    if (distributionInput) distributionInput.checked = settings.includeDistribution;
    limitedInput?.addEventListener('change', saveStageDeckRandomSettings);
    distributionInput?.addEventListener('change', saveStageDeckRandomSettings);

    // Retire a previous bulk-random roster only if it came from the old stage-deck-only feature.
    try {
      if (localStorage.getItem(STAGE_GACHA_STATE_KEY) === null && localStorage.getItem(RANDOM_ACCOUNT_ROSTER_ACTIVE_KEY) === '1') {
        const empty = {pulls:0, counts:{}, history:[], rarityCounts:{SSR:0,SR:0,R:0}, pilgrimSSR:0};
        localStorage.setItem(STAGE_GACHA_STATE_KEY, JSON.stringify(empty));
        localStorage.setItem(RANDOM_ACCOUNT_ROSTER_STORAGE_KEY, JSON.stringify([]));
      }
    } catch (_) {}
    renderStageDeckGachaStatus();
    updateRandomInclusionStatus(settings);
  }

  function updateUnownedToggleButton() {
    const button = document.getElementById('stageDeckUnownedToggle');
    if (!button) return;
    button.classList.toggle('active', showUnownedCharacters);
    button.textContent = showUnownedCharacters ? '미보유 캐릭터 숨기기' : '미보유 캐릭터 보이기';
    button.setAttribute('aria-pressed', String(showUnownedCharacters));
  }

  function toggleUnownedCharacters() {
    showUnownedCharacters = !showUnownedCharacters;
    try {
      if (showUnownedCharacters) localStorage.setItem(SHOW_UNOWNED_STORAGE_KEY, '1');
      else localStorage.removeItem(SHOW_UNOWNED_STORAGE_KEY);
    } catch (_) {}
    updateUnownedToggleButton();
    renderGrid();
  }

  function renderGrid() {
    const grid = document.getElementById('stageDeckGrid');
    const visibleCount = document.getElementById('stageDeckVisibleCount');
    if (!grid) return;
    const q = query.trim().toLocaleLowerCase();
    let list = pedia.filter(item => {
      if (q && !item.name.toLocaleLowerCase().includes(q)) return false;
      if (burstFilter && String(getMeta(item.name).burst || '') !== burstFilter) return false;
      return true;
    });
    const ownedRoster = getSyncedOwnedRoster();
    const isOwnedName = name => !!ownedRoster && ownedRoster.has(normalizeRosterName(name));
    // By default, show only characters confirmed as owned by the active synced account.
    if (!showUnownedCharacters) list = list.filter(item => isOwnedName(item.name));
    const compareBySelectedSort = (a,b) => {
      if (sortMode === 'name_asc') return a.name.localeCompare(b.name, 'ko');
      if (sortMode === 'burst') return String(getMeta(a.name).burst||'9').localeCompare(String(getMeta(b.name).burst||'9')) || a.name.localeCompare(b.name,'ko');
      if (sortMode === 'power_desc') return getPower(b.name)-getPower(a.name) || a.name.localeCompare(b.name,'ko');
      return 0;
    };
    // Owned characters always form the first group; the selected sort remains in effect within each group.
    list = list.slice().sort((a,b) => {
      if (ownedRoster) {
        const ownershipDiff = Number(isOwnedName(b.name)) - Number(isOwnedName(a.name));
        if (ownershipDiff) return ownershipDiff;
      }
      return compareBySelectedSort(a,b);
    });
    const ownedVisibleCount = ownedRoster ? list.filter(item => isOwnedName(item.name)).length : 0;
    if (visibleCount) {
      visibleCount.textContent = ownedRoster
        ? '보유 ' + ownedVisibleCount + '명 · 표시 ' + list.length + ' / ' + pedia.length + '명'
        : (showUnownedCharacters
          ? '보유 정보 미확인 · 전체 목록 ' + list.length + ' / ' + pedia.length + '명'
          : '보유 정보 미확인 · 계정 동기화 필요 · 0 / ' + pedia.length + '명');
    }
    updateUnownedToggleButton();
    if (!list.length) {
      grid.innerHTML = !showUnownedCharacters && !ownedRoster
        ? '<div class="stage-deck-empty">보유 니케 정보를 확인할 수 없습니다. 계정을 동기화하거나 ‘미보유 캐릭터 보이기’를 눌러 전체 도감을 확인하세요.</div>'
        : (!showUnownedCharacters && ownedRoster
          ? '<div class="stage-deck-empty">조건에 맞는 보유 니케가 없습니다. ‘미보유 캐릭터 보이기’를 눌러 전체 도감을 확인할 수 있습니다.</div>'
          : '<div class="stage-deck-empty">조건에 맞는 니케가 없습니다.</div>');
      return;
    }
    grid.innerHTML = list.map(item => {
      const name = String(item.name || '');
      const image = /^https?:\/\//i.test(String(item.image || '')) ? String(item.image) : '';
      const meta = getMeta(name);
      const burst = String(meta.burst || '').match(/[123]/)?.[0] || '';
      const pickedIndex = slots.indexOf(name);
      const owned = isOwnedName(name);
      return '<article class="stage-deck-card '+(!owned?'unowned ':'')+(pickedIndex>=0?'selected':'')+'" data-character="'+esc(name)+'" tabindex="0" role="button" aria-label="'+esc(name)+(owned?', 보유 니케':', 미보유 니케')+' 선택"><div class="stage-deck-card-img">'+(image?'<img loading="lazy" src="'+esc(image)+'" alt="'+esc(name)+'" onerror="this.style.display=\'none\'">':'')+(burst?'<span class="stage-deck-card-burst">'+burst+'</span>':'')+(pickedIndex>=0?'<span class="stage-deck-card-picked">'+(pickedIndex+1)+'</span>':'')+'</div><div class="stage-deck-card-name">'+esc(name)+'</div></article>';
    }).join('');
    grid.querySelectorAll('[data-character]').forEach(card => {
      const pick = () => addCharacter(card.dataset.character || '');
      card.addEventListener('click', pick);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); }
      });
    });
  }

  function autoRecommendDeck() {
    const ownedRoster = getSyncedOwnedRoster();
    if (!ownedRoster) {
      showNotice('보유 니케 정보를 확인할 수 없습니다. 계정을 동기화하거나 뽑기 시뮬레이터를 이용해 주세요.');
      return;
    }
    const candidates = pedia.filter(item => item && item.name && ownedRoster.has(normalizeRosterName(item.name)));
    if (!candidates.length) {
      showNotice('현재 보유 목록에 추천할 니케가 없습니다.');
      return;
    }
    // Fisher-Yates shuffle ensures a random, non-duplicated selection from owned characters.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    slots = Array(SLOT_COUNT).fill('');
    candidates.slice(0, SLOT_COUNT).forEach((item, index) => { slots[index] = item.name; });
    activeSlot = 0;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)); } catch (_) {}
    renderSlots();
    renderGrid();
    const selectedCount = candidates.length < SLOT_COUNT ? candidates.length : SLOT_COUNT;
    showNotice('보유 니케 중 무작위 ' + selectedCount + '명을 덱에 배치했습니다.');
  }

  function removeCharacterFromDeck(index) {
    if (!Number.isInteger(index) || index < 0 || index >= SLOT_COUNT || !slots[index]) return;
    slots[index] = '';
    activeSlot = index;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)); } catch (_) {}
    renderSlots();
    renderGrid();
  }

  function addCharacter(name) {
    if (!name) return;
    const existing = slots.indexOf(name);
    if (existing >= 0) {
      removeCharacterFromDeck(existing);
      return;
    }
    slots[activeSlot] = name;
    const nextEmpty = slots.findIndex(value => !value);
    activeSlot = nextEmpty >= 0 ? nextEmpty : (activeSlot + 1) % SLOT_COUNT;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)); } catch (_) {}
    renderSlots();
    renderGrid();
  }

  async function loadCharacterData() {
    const [pediaResponse, skillsResponse] = await Promise.all([
      fetch(PEDIA_URL, {cache:'no-store'}),
      fetch(SKILLS_URL, {cache:'no-store'})
    ]);
    if (!pediaResponse.ok) throw new Error('도감 목록을 불러오지 못했습니다.');
    pedia = (await pediaResponse.json()).filter(item => item && typeof item.name === 'string' && item.name.trim());
    if (skillsResponse.ok) {
      const skills = await skillsResponse.json();
      Object.keys(skills || {}).forEach(name => {
        const item = skills[name] || {};
        metaByName[name] = {
          burst: String(item.b || '').replace(/[^123]/g,'').slice(0,1),
          company: String(item.co || ''),
          className: String(item.c || ''),
          element: String(item.e || ''),
          rarity: String(item.r || '')
        };
      });
    }
  }

  async function showStageDeck() {
    const panel = document.getElementById('stageDeckPanel');
    if (!panel) return;
    panel.hidden = false;
    document.getElementById('kpis')?.setAttribute('hidden','');
    document.getElementById('characterPanel')?.setAttribute('hidden','');
    document.getElementById('outpostPanel')?.setAttribute('hidden','');
    document.getElementById('soleScorePanel')?.classList.remove('active');
    document.getElementById('pediaPanel')?.setAttribute('hidden','');
    document.body.classList.remove('outpost-view','sole-view','pedia-view','drop-rate-view');
    document.body.classList.add('stage-deck-view');
    document.querySelectorAll('.main-view-nav').forEach(btn => btn.classList.toggle('active', btn.dataset.view === 'stageDeck'));
    const title = document.getElementById('pageTitle');
    if (title) title.textContent = '스테이지 덱 추천';
    try { if (typeof window.closeSidebar === 'function') window.closeSidebar(); } catch (_) {}
    if (!pedia.length) {
      const grid = document.getElementById('stageDeckGrid');
      if (grid) grid.innerHTML = '<div class="stage-deck-empty">도감 데이터를 불러오는 중…</div>';
      try {
        await loadCharacterData();
        renderSlots();
        renderGrid();
      } catch (error) {
        if (grid) grid.innerHTML = '<div class="stage-deck-empty">'+esc(error && error.message || '도감 데이터를 불러오지 못했습니다.')+'</div>';
      }
    } else {
      renderSlots();
      renderGrid();
    }
  }

  function hideStageDeck() {
    document.getElementById('stageDeckPanel')?.setAttribute('hidden','');
    document.body.classList.remove('stage-deck-view');
  }

  function patchNavigation() {
    if (typeof window.switchMainView !== 'function' || window.switchMainView.__stageDeckPatched) return;
    const original = window.switchMainView;
    const wrapped = function(view) {
      if (view === 'stageDeck') {
        showStageDeck();
        return;
      }
      hideStageDeck();
      return original.apply(this, arguments);
    };
    wrapped.__stageDeckPatched = true;
    wrapped.__stageDeckOriginal = original;
    window.switchMainView = wrapped;
  }

  function init() {
    if (initialized) return;
    initialized = true;
    injectStyle();
    ensurePanel();
    ensureNav();
    loadSavedDeck();
    renderSlots();
    document.getElementById('stageDeckUnownedToggle')?.addEventListener('click', toggleUnownedCharacters);
    updateUnownedToggleButton();
    document.getElementById('stageDeckSearch')?.addEventListener('input', event => {
      query = event.target.value || '';
      renderGrid();
    });
    document.getElementById('stageDeckSort')?.addEventListener('change', event => {
      sortMode = event.target.value || 'power_desc';
      renderGrid();
    });
    document.querySelectorAll('.stage-deck-filter-btn[data-burst]').forEach(button => button.addEventListener('click', () => {
      const value = button.dataset.burst || '';
      burstFilter = burstFilter === value ? '' : value;
      document.querySelectorAll('.stage-deck-filter-btn[data-burst]').forEach(other => {
        const isActive = other.dataset.burst === burstFilter;
        other.classList.toggle('active', isActive);
        other.setAttribute('aria-pressed', String(isActive));
      });
      renderGrid();
    }));
    document.getElementById('stageDeckAutoRecommend')?.addEventListener('click', autoRecommendDeck);
    document.getElementById('stageDeckClear')?.addEventListener('click', () => {
      slots = Array(SLOT_COUNT).fill('');
      activeSlot = 0;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)); } catch (_) {}
      renderSlots();
      renderGrid();
    });
    initStageDeckRandomSettings();
    document.getElementById('stageDeckRandomAccount')?.addEventListener('click', () => drawStageDeckGacha(1));
    document.getElementById('stageDeckTenPull')?.addEventListener('click', () => drawStageDeckGacha(10));
    document.getElementById('stageDeckGachaReset')?.addEventListener('click', clearStageDeckGacha);
    document.getElementById('stageDeckUseActualRoster')?.addEventListener('click', useActualOwnedRoster);
    patchNavigation();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
