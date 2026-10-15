/* NIKKE Gear Manager - Wishlist Recommendation (test site only) */
(function(){
  'use strict';

  const COMPANIES = ['엘리시온','미실리스','테트라','필그림','어브노멀'];
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

  let picks = loadPicks();
  let imageMap = new Map();
  let imageLoadPromise = null;
  let panel = null;

  function loadPicks(){
    const output = blankWishlist();
    try{
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
    }catch(_){}
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
      'body.wishlist-view #wishlistPanel{display:block!important}',
      '#wishlistPanel[hidden]{display:none!important}',
      '#wishlistPanel{margin:0 18px 20px;min-width:0;overflow:visible}',
      '#wishlistPanel .wl-head{padding:18px 20px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}',
      '#wishlistPanel .wl-head h3{margin:0;font-size:18px;font-weight:900;color:var(--text)}',
      '#wishlistPanel .wl-head p{margin:6px 0 0;font-size:11px;line-height:1.65;color:var(--muted);max-width:760px}',
      '#wishlistPanel .wl-note{padding:10px 14px;margin:14px 16px 0;border:1px solid var(--line);border-radius:9px;font-size:11px;line-height:1.6;color:var(--muted);background:rgba(127,149,177,.06)}',
      '#wishlistPanel .wl-company-list{display:grid;gap:18px;padding:16px}',
      '#wishlistPanel .wl-company{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:rgba(127,149,177,.035)}',
      '#wishlistPanel .wl-company-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);background:rgba(127,149,177,.055)}',
      '#wishlistPanel .wl-company-title{display:flex;align-items:center;gap:10px;min-width:0;font-size:14px;font-weight:900;color:var(--text)}',
      '#wishlistPanel .wl-count{display:inline-flex;align-items:center;justify-content:center;min-width:42px;padding:4px 8px;border-radius:999px;border:1px solid var(--line);font-size:10px;font-weight:900;color:var(--muted)}',
      '#wishlistPanel .wl-clear{flex:none;border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:7px;padding:6px 9px;font-size:10px;font-weight:800;cursor:pointer}',
      '#wishlistPanel .wl-clear:hover{border-color:var(--accent);color:var(--text)}',
      '#wishlistPanel .wl-slots{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;padding:12px}',
      '#wishlistPanel .wl-slot{min-width:0;border:1px solid var(--line);border-radius:9px;padding:8px;background:var(--panel);display:flex;flex-direction:column;gap:8px}',
      '#wishlistPanel .wl-slot-number{font-size:9px;font-weight:900;letter-spacing:.06em;color:var(--muted)}',
      '#wishlistPanel .wl-photo{position:relative;aspect-ratio:3/4;overflow:hidden;border-radius:7px;background:rgba(127,149,177,.10);display:flex;align-items:center;justify-content:center}',
      '#wishlistPanel .wl-photo img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}',
      '#wishlistPanel .wl-photo-fallback{padding:8px;text-align:center;font-size:11px;font-weight:800;color:var(--muted);overflow-wrap:anywhere}',
      '#wishlistPanel .wl-stage{position:absolute;left:5px;bottom:5px;z-index:2;padding:4px 6px;border-radius:6px;background:rgba(15,23,41,.88);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:10px;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,.24)}',
      '#wishlistPanel .wl-character-name{min-height:30px;font-size:11px;line-height:1.4;font-weight:900;color:var(--text);overflow-wrap:anywhere}',
      '#wishlistPanel .wl-slot select{display:block;width:100%;min-width:0;height:34px;border:1px solid var(--line);border-radius:7px;padding:0 6px;background:var(--bg);color:var(--text);font-size:10px;outline:none}',
      '#wishlistPanel .wl-slot select:focus{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}',
      '#wishlistPanel .wl-slot-empty .wl-photo{border:1px dashed var(--line);background:transparent}',
      '#wishlistPanel .wl-empty-mark{font-size:12px;font-weight:900;color:var(--muted);text-align:center;padding:8px}',
      '#wishlistPanel .wl-slot.is-unowned .wl-photo img{filter:grayscale(1);opacity:.38}',
      '#wishlistPanel .wl-slot.is-unowned .wl-photo:after{content:"";position:absolute;inset:0;background:rgba(80,86,96,.26);pointer-events:none}',
      '#wishlistPanel .wl-unowned{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;background:rgba(67,73,84,.32);color:#fff;font-size:14px;font-weight:1000;letter-spacing:.02em;text-shadow:0 1px 4px rgba(0,0,0,.8)}',
      '#wishlistPanel .wl-slot.is-unowned .wl-character-name{color:var(--muted)}',
      '#wishlistPanel .wl-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:0 16px 16px;color:var(--muted);font-size:10px}',
      'html:not(.dark-theme) #wishlistPanel .wl-slot{background:#fff;border-color:#c9dce6}',
      'html:not(.dark-theme) #wishlistPanel .wl-slot select{background:#fff;color:#294b5e;border-color:#c5dae5}',
      'html:not(.dark-theme) #wishlistPanel .wl-photo{background:#edf4f8}',
      'html:not(.dark-theme) #wishlistPanel .wl-stage{background:rgba(41,67,87,.92)}',
      'html:not(.dark-theme) #wishlistPanel .wl-company{background:rgba(255,255,255,.65)}',
      '@media(max-width:1000px){#wishlistPanel .wl-slots{grid-template-columns:repeat(3,minmax(0,1fr))}}',
      '@media(max-width:650px){#wishlistPanel{margin:0 12px 16px}#wishlistPanel .wl-head{padding:14px}#wishlistPanel .wl-company-list{padding:10px;gap:12px}#wishlistPanel .wl-slots{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:8px}#wishlistPanel .wl-slot{padding:7px}#wishlistPanel .wl-note{margin:10px 10px 0}#wishlistPanel .wl-footer{padding:0 10px 12px;align-items:flex-start;flex-direction:column}}',
      '@media(max-width:390px){#wishlistPanel .wl-slots{grid-template-columns:1fr 1fr}}'
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
    const main = document.querySelector('main.main');
    if(!main) return null;
    panel = document.createElement('section');
    panel.id = 'wishlistPanel';
    panel.className = 'panel wishlist-panel';
    panel.hidden = true;
    panel.innerHTML =
      '<div class="wl-head"><div><h3>위시리스트 추천</h3>' +
      '<p>기업별로 추천할 니케를 5명씩 지정하세요. 선택 목록은 이 브라우저에 저장됩니다. 보유 여부와 돌파 단계는 현재 선택한 계정의 관리 데이터를 기준으로 표시합니다.</p></div></div>' +
      '<div class="wl-note">선택한 니케를 참고해 인게임 위시리스트를 설정할 수 있습니다. 사이트에서 게임의 모집 설정을 직접 변경하지는 않습니다. 미보유 표시는 장비 현황에서 해당 니케를 미보유로 체크한 상태를 따릅니다.</div>' +
      '<div class="wl-company-list" id="wishlistCompanyList"></div>' +
      '<div class="wl-footer"><span>기업별 최대 5명 · 같은 기업 안에서는 중복 선택할 수 없습니다.</span><span id="wishlistSavedStatus">자동 저장</span></div>';
    const before = main.querySelector('#pediaPanel, #soleScorePanel, #outpostPanel, #characterPanel');
    if(before) main.insertBefore(panel,before);
    else main.appendChild(panel);
    panel.addEventListener('change', onPanelChange);
    panel.addEventListener('click', onPanelClick);
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

  function buildSlot(company, slot, characters){
    const name = picks[company][slot] || '';
    const unowned = !!name && isMarkedUnowned(name);
    const stage = getBreakthrough(name);
    const image = name ? findImage(name) : '';
    const photo = name
      ? (image
          ? '<img loading="lazy" src="' + esc(image) + '" alt="' + esc(name) + '" onerror="this.style.display=\'none\'">'
          : '<div class="wl-photo-fallback">' + esc(name) + '</div>')
      : '<div class="wl-empty-mark">+<br>니케 선택</div>';
    const status = name
      ? (unowned
          ? '<span class="wl-unowned">미보유</span>'
          : '<span class="wl-stage">' + stage + '돌</span>')
      : '';
    return '<article class="wl-slot' + (!name ? ' wl-slot-empty' : '') + (unowned ? ' is-unowned' : '') + '">' +
      '<div class="wl-slot-number">SLOT ' + (slot + 1) + '</div>' +
      '<div class="wl-photo">' + photo + status + '</div>' +
      '<div class="wl-character-name" title="' + esc(name || '선택 안 됨') + '">' + esc(name || '선택 안 됨') + '</div>' +
      '<select class="wl-select" data-company="' + esc(company) + '" data-slot="' + slot + '" aria-label="' + esc(company + ' 위시리스트 슬롯 ' + (slot + 1)) + '">' +
      buildOptionList(company,slot,characters) + '</select>' +
      '</article>';
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
      const count = picks[company].filter(Boolean).length;
      return '<section class="wl-company" data-wl-company="' + esc(company) + '">' +
        '<div class="wl-company-head"><div class="wl-company-title">' + esc(company) +
        '<span class="wl-count">' + count + ' / 5</span></div>' +
        '<button type="button" class="wl-clear" data-wl-clear-company="' + esc(company) + '">초기화</button></div>' +
        '<div class="wl-slots">' + Array.from({length:5},(_,slot) => buildSlot(company,slot,characters)).join('') + '</div>' +
        '</section>';
    }).join('');
    const status = activePanel.querySelector('#wishlistSavedStatus');
    if(status) status.textContent = '저장됨 · ' + COMPANIES.reduce((sum,company) => sum + picks[company].filter(Boolean).length,0) + ' / 25명';
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
    savePicks();
    renderWishlist();
  }

  function onPanelClick(event){
    const button = event.target.closest && event.target.closest('[data-wl-clear-company]');
    if(!button) return;
    const company = button.dataset.wlClearCompany;
    if(!COMPANIES.includes(company)) return;
    picks[company] = Array(5).fill('');
    savePicks();
    renderWishlist();
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

  function hideWishlist(){
    const activePanel = document.getElementById('wishlistPanel');
    if(activePanel) activePanel.hidden = true;
    document.body.classList.remove('wishlist-view');
  }

  function showWishlist(){
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
    if(title) title.textContent = '위시리스트 추천';
    try{ window.closeSidebar && window.closeSidebar(); }catch(_){}
    renderWishlist();
    loadImageMap().then(renderWishlist);
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
      if(document.body.classList.contains('wishlist-view')) renderWishlist();
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