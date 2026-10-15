/* NIKKE Gear Manager - Wishlist Recommendation (test site only) */
(function(){
  'use strict';

  const COMPANIES = ['엘리시온','미실리스','테트라','필그림'];
  const STORAGE_KEY = 'nikke_wishlist_recommendations_v1';
  const IMAGE_URL = 'assets/nikke-pedia-master.json?v=1047';
  const norm = value => String(value == null ? '' : value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s:：·•._'’“”"\-–—()\[\]{}]/g, '');
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
  let imageMap = new Map();
  let imageLoadPromise = null;
  let panel = null;
  let pickerSlot = null;

  function activePicksStorageKey(){
    try{
      if(typeof activeAccount !== 'undefined' && String(activeAccount || '').trim()){
        return STORAGE_KEY + '_' + encodeURIComponent(String(activeAccount).trim());
      }
    }catch(_){}
    return STORAGE_KEY;
  }

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
      savedPicks = clonePicks(picks);
      return true;
    }catch(_){
      return false;
    }
  }

  function getAllCharacters(){
    try{
      const list = Array.isArray(window.__NIKKE_RAW) ? window.__NIKKE_RAW : [];
      const seen = new Set();
      return list.filter(row => {
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
      .filter(row => String(row['기업'] || '').trim() === company)
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
      '#wishlistPanel[hidden]{display:none!important}',
      '#wishlistPanel{position:relative!important;z-index:auto;display:block!important;box-sizing:border-box!important;width:calc(100% - 24px)!important;max-width:462px!important;min-width:0!important;padding:0!important;margin:0 auto 16px!important;overflow:visible;background:transparent;color:#25282d}',
      '#wishlistPanel .wl-dialog{position:relative;display:flex;flex-direction:column;width:100%;height:auto;min-height:0;overflow:visible;border:1px solid #dedfe1;border-radius:12px;background:#f8f8f8;box-shadow:0 2px 12px rgba(0,0,0,.10)}',
      '#wishlistPanel .wl-modal-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;min-height:31px;padding:3px 7px;overflow:hidden;background:linear-gradient(135deg,#f5f5f5 0%,#eeeeef 42%,#fafafa 100%);border-bottom:1px solid #dedfe1}',
      '#wishlistPanel .wl-modal-head:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,transparent 0 8%,rgba(210,214,218,.35) 8% 20%,transparent 20% 37%,rgba(255,255,255,.62) 37% 48%,transparent 48% 62%,rgba(218,221,224,.35) 62% 77%,transparent 77%)}',
      '#wishlistPanel .wl-modal-title{position:relative;display:flex;align-items:center;gap:4px;color:#16a5df;font-size:11px;font-weight:1000;letter-spacing:-.04em}',
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
      '#wishlistPanel .wl-slots{display:grid;grid-template-columns:repeat(5,minmax(0,min(64px,calc((100vw - 64px)/5))));justify-content:center;gap:5px;align-items:stretch;padding:15px 8px 17px}',
      '#wishlistPanel .wl-slot{position:relative;min-width:0;aspect-ratio:1 / 1;border:0;border-radius:8px;background:transparent;box-shadow:none;overflow:visible}',
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
      '#wishlistPanel .wl-picker-backdrop[hidden]{display:none!important}',
      '#wishlistPanel .wl-picker-backdrop{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(9,14,24,.72);backdrop-filter:blur(3px)}',
      '#wishlistPanel .wl-picker-dialog{display:flex;flex-direction:column;width:min(720px,calc(100vw - 32px));max-height:min(86vh,820px);overflow:hidden;border:1px solid #d5dbe5;border-radius:14px;background:#f8fafc;color:#222936;box-shadow:0 22px 80px rgba(0,0,0,.38)}',
      '#wishlistPanel .wl-picker-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #dde3ec;background:linear-gradient(135deg,#fff,#edf3fa)}',
      '#wishlistPanel .wl-picker-title{margin:0;color:#168fc5;font-size:17px;font-weight:1000}',
      '#wishlistPanel .wl-picker-close{flex:none;width:34px;height:34px;border:0;border-radius:8px;background:#e7ebf1;color:#576171;font-size:25px;line-height:1;cursor:pointer}',
      '#wishlistPanel .wl-picker-search-wrap{padding:12px 14px 8px}',
      '#wishlistPanel .wl-picker-search{box-sizing:border-box;width:100%;height:38px;padding:0 12px;border:1px solid #cbd4e0;border-radius:8px;background:#fff;color:#222936;font-size:13px;outline:none}',
      '#wishlistPanel .wl-picker-search:focus{border-color:#169fd6;box-shadow:0 0 0 3px rgba(22,159,214,.14)}',
      '#wishlistPanel .wl-picker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));align-content:start;gap:8px;min-height:100px;padding:8px 14px 14px;overflow:auto}',
      '#wishlistPanel .wl-picker-item{display:flex;min-width:0;flex-direction:column;align-items:center;gap:6px;padding:8px 5px;border:1px solid #dce2ea;border-radius:9px;background:#fff;color:#333b49;cursor:pointer;transition:border-color .12s,background .12s,transform .12s}',
      '#wishlistPanel .wl-picker-item:hover:not(:disabled){transform:translateY(-1px);border-color:#37a8d7;background:#f0faff}',
      '#wishlistPanel .wl-picker-item.is-current{border:2px solid #149fd6;padding:7px 4px;background:#e9f8ff}',
      '#wishlistPanel .wl-picker-item:disabled{opacity:.36;cursor:not-allowed;filter:grayscale(.7)}',
      '#wishlistPanel .wl-picker-photo{display:grid;place-items:center;width:72px;height:72px;overflow:hidden;border-radius:7px;background:#e6ebf2}',
      '#wishlistPanel .wl-picker-photo img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}',
      '#wishlistPanel .wl-picker-placeholder{color:#738093;font-size:24px;font-weight:900}',
      '#wishlistPanel .wl-picker-name{width:100%;min-height:2.5em;overflow-wrap:anywhere;text-align:center;font-size:11px;font-weight:900;line-height:1.25}',
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
        '</div>' +
        '<div class="wl-intro">' +
          '<p>대원 모집에서 <span class="wl-blue">SSR 니케를 획득</span>하면<br>더 높은 확률로 위시리스트에 등록한 니케를 획득할 수 있습니다.</p>' +
          '<p class="wl-subline">(SSR 니케 모집 총 확률은 변하지 않습니다)</p>' +
        '</div>' +
        '<div class="wl-auto-toolbar">' +
          '<button type="button" class="wl-auto-button" data-wl-auto-build>✦ 계정 상태로 자동 편성</button>' +
          '<div class="wl-auto-note">임시 기준: 미보유 우선 → 낮은 돌파 → 이름순 · 도감 전체가 후보이므로 모집 제외 니케가 포함될 수 있습니다.</div>' +
        '</div>' +
        '<div class="wl-company-list" id="wishlistCompanyList"></div>' +
        '<div class="wl-status" id="wishlistSavedStatus">변경 사항 없음</div>' +
        '<div class="wl-footer">' +
          '<button type="button" class="wl-action wl-cancel" data-wl-cancel><span aria-hidden="true">×</span> 취소</button>' +
          '<button type="button" class="wl-action wl-confirm" data-wl-confirm><span aria-hidden="true">✓</span> 결정</button>' +
        '</div>' +
      '</div>' +
      '<div class="wl-picker-backdrop" data-wl-picker-backdrop hidden>' +
        '<div class="wl-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="wlPickerTitle">' +
          '<div class="wl-picker-head"><h3 class="wl-picker-title" id="wlPickerTitle">엘리시온 니케 선택</h3><button type="button" class="wl-picker-close" data-wl-picker-close aria-label="닫기">×</button></div>' +
          '<div class="wl-picker-search-wrap"><input type="search" class="wl-picker-search" data-wl-picker-search placeholder="엘리시온 니케 이름 검색" autocomplete="off"></div>' +
          '<div class="wl-picker-grid" data-wl-picker-grid></div>' +
          '<div class="wl-picker-foot"><span>이미 다른 칸에 선택한 니케는 중복 선택할 수 없습니다.</span><button type="button" class="wl-picker-clear" data-wl-picker-clear>이 칸 비우기</button></div>' +
        '</div>' +
      '</div>' +
    '</section>';
    const main = document.querySelector('main.main') || document.querySelector('main');
    if(main){
      const before = main.querySelector('#pediaPanel, #soleScorePanel, #outpostPanel, #characterPanel');
      if(before) main.insertBefore(panel,before);
      else main.appendChild(panel);
    }else{
      document.body.appendChild(panel);
    }
    panel.addEventListener('change', onPanelChange);
    panel.addEventListener('click', onPanelClick);
    panel.addEventListener('input', onPanelInput);
    document.addEventListener('keydown', onPickerKeydown);
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
    const isElysion = company === '엘리시온';
    const unowned = !!name && isMarkedUnowned(name);
    const stage = getBreakthrough(name);
    let tile;
    if(isElysion && name){
      const image = findImage(name);
      tile = '<div class="wl-tile wl-photo-only">' +
        (image ? '<img class="wl-picked-image" src="' + esc(image) + '" alt="' + esc(name) + '" draggable="false">' : '') +
        '</div>';
    }else if(name){
      tile = '<div class="wl-tile' + (unowned ? ' is-unowned' : '') + '">' +
        '<span class="wl-corner-mark" aria-hidden="true">◇</span>' +
        '<div class="wl-selected-name">' + esc(name) + '</div>' +
        (!unowned ? '<span class="wl-stage">' + stage + '돌</span>' : '<span class="wl-unowned">미보유</span>') +
        '</div>';
    }else{
      tile = '<div class="wl-tile wl-empty-tile">' +
        '<div class="wl-empty-mark"><span class="wl-plus">＋</span></div></div>';
    }
    const title = name ? name + (isElysion ? '' : (unowned ? ' · 미보유' : ' · ' + stage + '돌')) : '클릭해서 니케 선택';
    const selector = isElysion
      ? '<button type="button" class="wl-select-trigger" data-company="' + esc(company) + '" data-slot="' + slot + '" aria-label="' + esc(company + ' 위시리스트 슬롯 ' + (slot + 1) + ' 선택') + '" title="' + esc(title) + '"></button>'
      : '<select class="wl-select" data-company="' + esc(company) + '" data-slot="' + slot + '" aria-label="' + esc(company + ' 위시리스트 슬롯 ' + (slot + 1)) + '" title="' + esc(name || '니케 선택') + '">' +
        buildOptionList(company,slot,characters) + '</select>';
    return '<article class="wl-slot' + (!name ? ' wl-slot-empty' : '') + (unowned && !isElysion ? ' is-unowned' : '') + '" title="' + esc(title) + '">' +
      tile + selector +
      '</article>';
  }

  function openCharacterPicker(slot){
    if(!Number.isInteger(slot) || slot < 0 || slot > 4) return;
    pickerSlot = slot;
    const backdrop = panel && panel.querySelector('[data-wl-picker-backdrop]');
    if(!backdrop) return;
    const search = backdrop.querySelector('[data-wl-picker-search]');
    if(search) search.value = '';
    backdrop.hidden = false;
    renderCharacterPicker();
    loadImageMap().then(renderCharacterPicker);
    if(search) search.focus();
  }

  function closeCharacterPicker(){
    const backdrop = panel && panel.querySelector('[data-wl-picker-backdrop]');
    if(backdrop) backdrop.hidden = true;
    pickerSlot = null;
  }

  function renderCharacterPicker(){
    if(pickerSlot === null || !panel) return;
    const backdrop = panel.querySelector('[data-wl-picker-backdrop]');
    const grid = backdrop && backdrop.querySelector('[data-wl-picker-grid]');
    const search = backdrop && backdrop.querySelector('[data-wl-picker-search]');
    if(!grid || !backdrop || backdrop.hidden) return;
    const query = norm(search ? search.value : '');
    const current = picks['엘리시온'][pickerSlot] || '';
    const selectedElsewhere = new Set(picks['엘리시온'].filter((value,index) => index !== pickerSlot && value).map(norm));
    const characters = getCharactersForCompany('엘리시온').filter(row => {
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
      const duplicate = selectedElsewhere.has(norm(name));
      const isCurrent = !!current && norm(current) === norm(name);
      const photo = image
        ? '<img src="' + esc(image) + '" alt="" loading="lazy" draggable="false">'
        : '<span class="wl-picker-placeholder">' + esc(name.slice(0,1)) + '</span>' ;
      return '<button type="button" class="wl-picker-item' + (isCurrent ? ' is-current' : '') + '" data-wl-pick-name="' + esc(name) + '"' + (duplicate ? ' disabled' : '') + '>' +
        '<span class="wl-picker-photo">' + photo + '</span>' +
        '<span class="wl-picker-name">' + esc(name) + '</span>' +
        '</button>';
    }).join('');
  }

  function onPanelInput(event){
    if(event.target && event.target.matches && event.target.matches('[data-wl-picker-search]')) renderCharacterPicker();
  }

  function onPickerKeydown(event){
    if(event.key === 'Escape' && pickerSlot !== null) closeCharacterPicker();
  }

  function autoBuildWishlist(){
    const all = getAllCharacters();
    if(!all.length){
      alert('캐릭터 데이터를 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
      return;
    }
    COMPANIES.forEach(company => {
      const candidates = getCharactersForCompany(company).slice();
      candidates.sort((a,b) => {
        const aName = String(a['이름'] || '').trim();
        const bName = String(b['이름'] || '').trim();
        const aUnowned = isMarkedUnowned(aName);
        const bUnowned = isMarkedUnowned(bName);
        if(aUnowned !== bUnowned) return aUnowned ? -1 : 1;
        if(!aUnowned){
          const breakthroughDiff = getBreakthrough(aName) - getBreakthrough(bName);
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
    const activePanel = ensurePanel();
    if(!activePanel) return;
    const list = activePanel.querySelector('#wishlistCompanyList');
    if(!list) return;
    const all = getAllCharacters();
    if(!all.length){
      list.innerHTML = '<div class="wl-note">캐릭터 데이터를 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.</div>';
      return;
    }
    list.innerHTML = COMPANIES.map(company => {
      const characters = getCharactersForCompany(company);
      return '<section class="wl-company" data-wl-company="' + esc(company) + '">' +
        '<div class="wl-company-head">' +
          '<div class="wl-company-brand"><span class="wl-company-symbol" aria-hidden="true">' + esc(COMPANY_SYMBOLS[company] || '◇') + '</span>' +
          '<span class="wl-company-name">' + esc(company) + '</span></div>' +
          '<button type="button" class="wl-info" title="' + esc(company + ' 위시리스트 니케를 5명까지 선택할 수 있습니다.') + '" aria-label="' + esc(company + ' 안내') + '">i</button>' +
        '</div>' +
        '<div class="wl-slots">' + Array.from({length:5},(_,slot) => buildSlot(company,slot,characters)).join('') + '</div>' +
      '</section>';
    }).join('');
    const status = activePanel.querySelector('#wishlistSavedStatus');
    const changed = JSON.stringify(picks) !== JSON.stringify(savedPicks);
    if(status) status.textContent = (changed ? '변경 사항 있음 · 결정 버튼을 눌러 저장' : '저장된 위시리스트') +
      ' · ' + COMPANIES.reduce((sum,company) => sum + picks[company].filter(Boolean).length,0) + ' / 20명';
  }

  function onPanelChange(event){
    const select = event.target.closest && event.target.closest('.wl-select');
    if(!select) return;
    const company = select.dataset.company;
    const slot = Number(select.dataset.slot);
    if(!COMPANIES.includes(company) || !Number.isInteger(slot) || slot < 0 || slot > 4) return;
    const name = String(select.value || '').trim();
    if(name && picks[company].some((value,index) => index !== slot && norm(value) === norm(name))){
      renderWishlist();
      return;
    }
    picks[company][slot] = name;
    renderWishlist();
  }

  function onPanelClick(event){
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
    const pickerClear = event.target.closest && event.target.closest('[data-wl-picker-clear]');
    if(pickerClear){
      if(pickerSlot !== null) picks['엘리시온'][pickerSlot] = '';
      closeCharacterPicker();
      renderWishlist();
      return;
    }
    const picked = event.target.closest && event.target.closest('[data-wl-pick-name]');
    if(picked){
      if(pickerSlot === null || picked.disabled) return;
      const name = String(picked.dataset.wlPickName || '').trim();
      if(!name || picks['엘리시온'].some((value,index) => index !== pickerSlot && norm(value) === norm(name))) return;
      picks['엘리시온'][pickerSlot] = name;
      closeCharacterPicker();
      renderWishlist();
      return;
    }
    const slotTrigger = event.target.closest && event.target.closest('.wl-select-trigger');
    if(slotTrigger && slotTrigger.dataset.company === '엘리시온'){
      event.preventDefault();
      openCharacterPicker(Number(slotTrigger.dataset.slot));
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
    renderWishlist();
  }

  function hideWishlist(){
    const activePanel = document.getElementById('wishlistPanel');
    if(activePanel) activePanel.hidden = true;
    document.body.classList.remove('wishlist-view');
  }

  function showWishlist(){
    picks = clonePicks(loadPicks());
    savedPicks = clonePicks(picks);
    const activePanel = ensurePanel();
    if(!activePanel) return;
    activePanel.hidden = false;
    document.body.classList.remove('outpost-view','sole-view','drop-rate-view','pedia-view');
    document.body.classList.add('wishlist-view');
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