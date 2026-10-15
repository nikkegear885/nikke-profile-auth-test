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
      '#wishlistPanel[hidden]{display:none!important}',
      '#wishlistPanel{position:relative!important;z-index:auto;display:block!important;box-sizing:border-box!important;width:calc(100% - 24px)!important;max-width:760px!important;min-width:0!important;padding:0!important;margin:0 auto 16px!important;overflow:visible;background:transparent;color:#25282d}',
      '#wishlistPanel .wl-dialog{position:relative;display:flex;flex-direction:column;width:100%;height:auto;min-height:0;overflow:visible;border:1px solid #dedfe1;border-radius:12px;background:#f8f8f8;box-shadow:0 2px 12px rgba(0,0,0,.10)}',
      '#wishlistPanel .wl-modal-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;min-height:48px;padding:6px 14px;overflow:hidden;background:linear-gradient(135deg,#f5f5f5 0%,#eeeeef 42%,#fafafa 100%);border-bottom:1px solid #dedfe1}',
      '#wishlistPanel .wl-modal-head:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(135deg,transparent 0 8%,rgba(210,214,218,.35) 8% 20%,transparent 20% 37%,rgba(255,255,255,.62) 37% 48%,transparent 48% 62%,rgba(218,221,224,.35) 62% 77%,transparent 77%)}',
      '#wishlistPanel .wl-modal-title{position:relative;display:flex;align-items:center;gap:7px;color:#16a5df;font-size:18px;font-weight:1000;letter-spacing:-.04em}',
      '#wishlistPanel .wl-refresh-icon{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:3px solid #16a5df;border-right-color:transparent;border-radius:50%;font-size:0;position:relative;transform:rotate(-35deg)}',
      '#wishlistPanel .wl-refresh-icon:after{content:"";position:absolute;right:-3px;top:-4px;width:0;height:0;border-top:7px solid transparent;border-bottom:7px solid transparent;border-left:10px solid #16a5df;transform:rotate(28deg)}',
      '#wishlistPanel .wl-close{position:relative;flex:none;width:42px;height:42px;border:0;background:transparent;color:#777;font-size:42px;font-weight:300;line-height:1;cursor:pointer}',
      '#wishlistPanel .wl-close:hover{color:#222}',
      '#wishlistPanel .wl-intro{flex:none;padding:9px 14px 8px;text-align:center;color:#16181b;font-size:clamp(13px,1.5vw,17px);font-weight:900;line-height:1.35;letter-spacing:-.035em}',
      '#wishlistPanel .wl-intro p{margin:0}',
      '#wishlistPanel .wl-intro .wl-blue{color:#16a5df}',
      '#wishlistPanel .wl-intro .wl-subline{margin-top:4px;color:#16a5df;font-size:clamp(12px,1.35vw,15px)}',
      '#wishlistPanel .wl-company-list{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:none;gap:6px;flex:0 0 auto;min-height:0;padding:2px 12px 8px;overflow:visible}',
      '#wishlistPanel .wl-company{display:flex;flex-direction:column;min-height:0;border:1px solid #e3e3e3;border-radius:6px;background:rgba(255,255,255,.94);box-shadow:0 1px 2px rgba(0,0,0,.045)}',
      '#wishlistPanel .wl-company-head{position:relative;display:flex;align-items:center;justify-content:center;flex:none;min-height:52px;padding:5px 38px;border-bottom:1px solid #f0f0f0}',
      '#wishlistPanel .wl-company-brand{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:#777}',
      '#wishlistPanel .wl-company-symbol{height:35px;display:flex;align-items:center;justify-content:center;font-size:32px;line-height:1;font-weight:1000;color:#777;letter-spacing:-.08em}',
      '#wishlistPanel .wl-company-name{display:none;font-size:8px;font-weight:900;letter-spacing:.1em;color:#858585}',
      '#wishlistPanel .wl-info{position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;width:23px;height:23px;border:0;border-radius:50%;background:#888;color:#fff;font:italic 900 16px/1 Georgia,serif;cursor:help}',
      '#wishlistPanel .wl-slots{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;align-items:stretch;padding:6px 12px 8px}',
      '#wishlistPanel .wl-slot{position:relative;min-width:0;aspect-ratio:1 / 1;border:0;border-radius:8px;background:transparent;box-shadow:none;overflow:visible}',
      '#wishlistPanel .wl-tile{position:absolute;inset:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid #8a8a8a;border-radius:9px;background:repeating-linear-gradient(0deg,rgba(90,90,90,.045) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(255,255,255,.28) 0 1px,transparent 1px 3px),linear-gradient(135deg,#f5f5f5 0%,#dedede 64%,#d0d0d0 100%);box-shadow:inset 0 1px 2px rgba(255,255,255,.96),inset 0 -2px 3px rgba(100,100,100,.16),0 3px 5px rgba(0,0,0,.32);}',
      '#wishlistPanel .wl-tile:before{content:"";position:absolute;left:0;top:21%;width:34%;height:35%;background:linear-gradient(180deg,rgba(255,255,255,.85) 0 31%,rgba(200,200,200,.56) 31% 38%,rgba(255,255,255,.62) 38% 68%,rgba(190,190,190,.4) 68% 75%,rgba(240,240,240,.38) 75%);border-right:1px solid rgba(255,255,255,.45);pointer-events:none}', '#wishlistPanel .wl-tile:after{content:"";position:absolute;inset:0;pointer-events:none}',
      '#wishlistPanel .wl-corner-mark{position:absolute;left:0;top:0;z-index:2;width:21px;height:23px;display:flex;align-items:center;justify-content:center;clip-path:polygon(0 0,100% 0,100% 74%,50% 100%,0 74%);background:#a53bea;color:white;font-size:11px;font-weight:1000;box-shadow:0 1px 3px rgba(0,0,0,.2)}',
      '#wishlistPanel .wl-empty-mark{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;padding:0;text-align:center;color:#333;font-size:0;font-weight:900;line-height:1}',
      '#wishlistPanel .wl-plus{position:relative;z-index:2;font-family:Arial,sans-serif;font-size:clamp(36px,4vw,52px);font-weight:300;line-height:1;color:#303030;text-shadow:0 1px 0 rgba(255,255,255,.8)}',
      '#wishlistPanel .wl-selected-name{max-width:100%;padding:19px 5px 12px;text-align:center;overflow-wrap:anywhere;word-break:keep-all;color:#3a3b3e;font-size:clamp(9px,1.1vw,12px);font-weight:1000;line-height:1.25}',
      '#wishlistPanel .wl-stage{position:absolute;top:3px;right:3px;z-index:3;min-width:19px;padding:2px 3px;border-radius:4px;background:rgba(35,37,40,.9);border:1px solid rgba(255,255,255,.8);color:#fff;font-size:8px;font-weight:1000;text-align:center}',
      '#wishlistPanel .wl-unowned{position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;background:rgba(70,74,80,.66);color:#fff;font-size:clamp(11px,1.5vw,15px);font-weight:1000;letter-spacing:.02em;text-shadow:0 1px 4px rgba(0,0,0,.6)}',
      '#wishlistPanel .wl-slot.is-unowned .wl-tile{filter:grayscale(1);background:#d0d0d0}',
      '#wishlistPanel .wl-slot.is-unowned .wl-selected-name{color:#777}',
      '#wishlistPanel .wl-slot:focus-within{outline:3px solid rgba(22,165,223,.45);outline-offset:2px}',
      '#wishlistPanel .wl-select{position:absolute;inset:0;z-index:8;width:100%;height:100%;opacity:0;cursor:pointer}',
      '#wishlistPanel .wl-status{flex:none;padding:0 12px 6px;text-align:right;color:#80858b;font-size:9px}',
      '#wishlistPanel .wl-footer{display:flex;justify-content:center;gap:16px;flex:none;padding:8px 12px 10px;border-top:1px solid #dedede;background:#f8f8f8}',
      '#wishlistPanel .wl-action{display:flex;align-items:center;justify-content:center;gap:7px;width:clamp(120px,25%,220px);min-height:42px;border-radius:6px;font-size:16px;font-weight:1000;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.12)}',
      '#wishlistPanel .wl-cancel{border:2px solid #aaa;background:#fff;color:#343434}',
      '#wishlistPanel .wl-confirm{border:2px solid #0da5e2;background:#0ba8eb;color:white}',
      '#wishlistPanel .wl-action:hover{filter:brightness(.97);transform:translateY(-1px)}',
      '@media(max-width:650px){#wishlistPanel{width:100%;margin:0 auto 12px}#wishlistPanel .wl-dialog{width:100%;height:auto;border-radius:10px}#wishlistPanel .wl-modal-head{min-height:42px;padding:5px 10px}#wishlistPanel .wl-modal-title{font-size:16px}#wishlistPanel .wl-refresh-icon{width:23px;height:23px;border-width:3px}#wishlistPanel .wl-intro{padding:8px 8px 6px;font-size:clamp(12px,3.2vw,15px)}#wishlistPanel .wl-intro .wl-subline{font-size:clamp(11px,2.8vw,13px)}#wishlistPanel .wl-company-list{gap:6px;padding:2px 7px 7px}#wishlistPanel .wl-company-head{min-height:42px;padding:3px 34px}#wishlistPanel .wl-company-symbol{height:28px;font-size:26px}#wishlistPanel .wl-company-name{font-size:7px}#wishlistPanel .wl-info{width:20px;height:20px;right:6px;font-size:14px}#wishlistPanel .wl-slots{gap:4px;padding:4px 5px 6px}#wishlistPanel .wl-slot{aspect-ratio:1 / 1;border-radius:4px}#wishlistPanel .wl-corner-mark{width:16px;height:18px;font-size:9px}#wishlistPanel .wl-selected-name{padding:17px 2px 9px;font-size:8px}#wishlistPanel .wl-stage{top:2px;right:2px;padding:1px 2px;font-size:7px;min-width:14px}#wishlistPanel .wl-plus{font-size:36px}#wishlistPanel .wl-empty-mark{gap:1px;padding:2px;font-size:7px}#wishlistPanel .wl-footer{gap:8px;padding:6px 8px 8px}#wishlistPanel .wl-action{width:42%;min-height:36px;font-size:13px}}',
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
        '<div class="wl-company-list" id="wishlistCompanyList"></div>' +
        '<div class="wl-status" id="wishlistSavedStatus">변경 사항 없음</div>' +
        '<div class="wl-footer">' +
          '<button type="button" class="wl-action wl-cancel" data-wl-cancel><span aria-hidden="true">×</span> 취소</button>' +
          '<button type="button" class="wl-action wl-confirm" data-wl-confirm><span aria-hidden="true">✓</span> 결정</button>' +
        '</div>' +
      '</div>';
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
    const tile = name
      ? '<div class="wl-tile' + (unowned ? ' is-unowned' : '') + '">' +
          '<span class="wl-corner-mark" aria-hidden="true">◇</span>' +
          '<div class="wl-selected-name">' + esc(name) + '</div>' +
          (!unowned ? '<span class="wl-stage">' + stage + '돌</span>' : '<span class="wl-unowned">미보유</span>') +
        '</div>'
      : '<div class="wl-tile wl-empty-tile">' +
          '<div class="wl-empty-mark"><span class="wl-plus">＋</span></div></div>';
    return '<article class="wl-slot' + (!name ? ' wl-slot-empty' : '') + (unowned ? ' is-unowned' : '') + '" title="' + esc(name ? name + (unowned ? ' · 미보유' : ' · ' + stage + '돌') : '클릭해서 니케 선택') + '">' +
      tile +
      '<select class="wl-select" data-company="' + esc(company) + '" data-slot="' + slot + '" aria-label="' + esc(company + ' 위시리스트 슬롯 ' + (slot + 1)) + '" title="' + esc(name || '니케 선택') + '">' +
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