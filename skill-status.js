/* TEST SITE ONLY: owned-character skill level view. */
(function () {
  'use strict';

  const PANEL_ID = 'skillStatusPanel';
  const PEDIA_URL = 'assets/nikke-pedia-master.json?v=1055';
  const OWNED_PREFIX = 'nikke_synced_owned_characters_v1_';
  const UNOWNED_PREFIX = 'nikke_unowned_characters_v1_';
  let initialized = false;
  let imageMap = {};
  let imageLoadPromise = null;

  function normalizeName(value) {
    return String(value == null ? '' : value)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s:：·•._'’“”"\x60\-–—()\[\]{}]/g, '');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (ch) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch];
    });
  }

  function currentRows() {
    try {
      if (typeof data !== 'undefined' && Array.isArray(data)) return data;
    } catch (_) {}
    return [];
  }

  function activeAccountName() {
    try {
      if (typeof activeAccount !== 'undefined' && activeAccount != null) return String(activeAccount).trim();
    } catch (_) {}
    return '';
  }

  function getOwnedRows() {
    const rows = currentRows();
    const account = activeAccountName();
    if (!rows.length || !account) return null;

    try {
      const raw = localStorage.getItem(OWNED_PREFIX + encodeURIComponent(account));
      if (raw !== null) {
        const names = JSON.parse(raw);
        if (Array.isArray(names)) {
          const owned = new Set(names.map(normalizeName).filter(Boolean));
          return rows.filter(function (row) {
            return row && owned.has(normalizeName(row['이름']));
          });
        }
      }
    } catch (_) {}

    if (rows.some(function (row) { return row && typeof row.__nikkeSyncedOwned === 'boolean'; })) {
      return rows.filter(function (row) { return row && row.__nikkeSyncedOwned === true; });
    }

    try {
      const rawUnowned = localStorage.getItem(UNOWNED_PREFIX + encodeURIComponent(account));
      if (rawUnowned !== null) {
        const names = JSON.parse(rawUnowned);
        if (Array.isArray(names)) {
          const unowned = new Set(names.map(normalizeName).filter(Boolean));
          return rows.filter(function (row) {
            const name = normalizeName(row && row['이름']);
            return name && !unowned.has(name);
          });
        }
      }
    } catch (_) {}

    return null;
  }

  function formatLevel(value) {
    if (value === null || value === undefined || String(value).trim() === '') return '—';
    const number = Number(String(value).replace(/,/g, ''));
    if (!Number.isFinite(number)) return '—';
    return String(Math.max(0, Math.floor(number)));
  }

  function getImage(name) {
    try {
      if (typeof NIKKE_PEDIA_IMAGES !== 'undefined' && NIKKE_PEDIA_IMAGES) {
        const direct = NIKKE_PEDIA_IMAGES[name] || NIKKE_PEDIA_IMAGES['#' + normalizeName(name)];
        if (direct) return String(direct);
      }
    } catch (_) {}
    return imageMap[normalizeName(name)] || '';
  }

  function loadImages() {
    if (imageLoadPromise) return imageLoadPromise;
    imageLoadPromise = (async function () {
      try {
        const response = await fetch(PEDIA_URL, {cache:'no-store'});
        if (!response.ok) throw new Error('도감 이미지를 불러오지 못했습니다.');
        const list = await response.json();
        if (Array.isArray(list)) {
          list.forEach(function (item) {
            const name = String(item && item.name || '').trim();
            const image = String(item && item.image || '').trim();
            if (name && /^https?:\/\//i.test(image)) imageMap[normalizeName(name)] = image;
          });
        }
      } catch (_) {}
    })();
    return imageLoadPromise;
  }

  function injectStyle() {
    if (document.getElementById('skillStatusStyle')) return;
    const style = document.createElement('style');
    style.id = 'skillStatusStyle';
    style.textContent =
      '#skillStatusPanel{margin:0 0 24px;padding:0 14px 24px;color:var(--text,#263449);min-width:0}' +
      '.skill-status-wrap{border:1px solid #d8e3ed;border-radius:14px;background:#fff;overflow:hidden}' +
      '.skill-status-table{width:100%;border-collapse:collapse;table-layout:fixed}' +
      '.skill-status-table th{padding:12px 10px;background:#f2f6fa;color:#526b80;text-align:center;font-size:12px;font-weight:900;border-bottom:1px solid #d8e3ed}' +
      '.skill-status-table td{padding:8px 10px;border-bottom:1px solid #e5ecf2;text-align:center;font-size:13px;color:#2e4356}' +
      '.skill-status-table tr:last-child td{border-bottom:0}' +
      '.skill-status-table .skill-character-cell{display:flex;align-items:center;gap:10px;text-align:left;min-width:0;font-weight:800}' +
      '.skill-status-character-image{flex:0 0 48px;width:48px;height:56px;object-fit:cover;object-position:center top;border-radius:7px;background:#edf2f6}' +
      '.skill-status-character-name{overflow-wrap:anywhere;line-height:1.35}' +
      '.skill-status-level{font-size:15px!important;font-weight:900;font-variant-numeric:tabular-nums}' +
      '.skill-status-empty{padding:24px 14px;text-align:center;color:#718397;font-size:13px;line-height:1.6}' +
      'html.dark-theme .skill-status-wrap{background:#111e2c;border-color:#304356}' +
      'html.dark-theme .skill-status-table th{background:#1b2b3c;color:#b8cadb;border-color:#304356}' +
      'html.dark-theme .skill-status-table td{color:#dbe6f1;border-color:#2b3c4e}' +
      'html.dark-theme .skill-status-character-image{background:#26384a}' +
      'html.dark-theme .skill-status-empty{color:#a1b2c4}' +
      '@media(max-width:560px){.skill-status-table th{padding:9px 4px;font-size:10px}.skill-status-table td{padding:7px 4px;font-size:12px}.skill-status-table .skill-character-cell{gap:6px}.skill-status-character-image{flex-basis:36px;width:36px;height:44px}.skill-status-level{font-size:13px!important}}';
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if (document.getElementById(PANEL_ID)) return;
    const main = document.querySelector('main.main');
    if (!main) return;
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.setAttribute('aria-label', '스킬 현황 확인');
    panel.innerHTML =
      '<div class="skill-status-wrap">' +
        '<table class="skill-status-table">' +
          '<thead><tr><th style="width:52%">캐릭터</th><th>1스킬 레벨</th><th>2스킬 레벨</th><th>버스트 레벨</th></tr></thead>' +
          '<tbody id="skillStatusBody"><tr><td colspan="4" class="skill-status-empty">보유 캐릭터를 확인하고 있습니다.</td></tr></tbody>' +
        '</table>' +
      '</div>';
    const insertBefore = main.querySelector('#characterPanel,#outpostPanel');
    if (insertBefore) main.insertBefore(panel, insertBefore);
    else main.appendChild(panel);
  }

  function renderSkillStatus() {
    const body = document.getElementById('skillStatusBody');
    if (!body) return;
    const ownedRows = getOwnedRows();
    if (ownedRows === null) {
      body.innerHTML = '<tr><td colspan="4" class="skill-status-empty">보유 목록을 확인할 수 없습니다. 먼저 현재 계정을 동기화한 뒤 확인해 주세요.</td></tr>';
      return;
    }
    if (!ownedRows.length) {
      body.innerHTML = '<tr><td colspan="4" class="skill-status-empty">보유 캐릭터가 없습니다.</td></tr>';
      return;
    }
    body.innerHTML = ownedRows.map(function (row) {
      const name = String(row && row['이름'] || '').trim();
      const image = getImage(name);
      return '<tr>' +
        '<td><div class="skill-character-cell">' +
          (image ? '<img class="skill-status-character-image" loading="lazy" src="' + escapeHtml(image) + '" alt="" onerror="this.style.display=\'none\'">' : '<span class="skill-status-character-image" aria-hidden="true"></span>') +
          '<span class="skill-status-character-name">' + escapeHtml(name) + '</span>' +
        '</div></td>' +
        '<td class="skill-status-level">' + escapeHtml(formatLevel(row['스킬1'])) + '</td>' +
        '<td class="skill-status-level">' + escapeHtml(formatLevel(row['스킬2'])) + '</td>' +
        '<td class="skill-status-level">' + escapeHtml(formatLevel(row['버스트스킬'])) + '</td>' +
      '</tr>';
    }).join('');
  }

  function showSkillStatus() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.hidden = false;
    const kpis = document.getElementById('kpis');
    const characterPanel = document.getElementById('characterPanel');
    const outpostPanel = document.getElementById('outpostPanel');
    if (kpis) kpis.hidden = true;
    if (characterPanel) characterPanel.hidden = true;
    if (outpostPanel) outpostPanel.hidden = true;
    document.getElementById('soleScorePanel')?.classList.remove('active');
    document.getElementById('pediaPanel')?.setAttribute('hidden', '');
    document.body.classList.remove('outpost-view','sole-view','pedia-view','drop-rate-view','stage-deck-view');
    document.body.classList.add('skill-status-view');
    document.querySelectorAll('.main-view-nav').forEach(function (button) {
      button.classList.toggle('active', button.dataset.view === 'skillStatus');
    });
    const title = document.getElementById('pageTitle');
    if (title) title.textContent = '스킬 현황 확인';
    renderSkillStatus();
    loadImages().then(renderSkillStatus);
    try { if (typeof closeSidebar === 'function') closeSidebar(); } catch (_) {}
  }

  function hideSkillStatus() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.hidden = true;
    document.body.classList.remove('skill-status-view');
  }

  function ensureNavFallback() {
    const nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('[data-view="skillStatus"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'main-view-nav';
    button.dataset.view = 'skillStatus';
    button.textContent = '스킬 현황 확인';
    button.addEventListener('click', function () {
      if (typeof window.switchMainView === 'function') window.switchMainView('skillStatus');
    });
    nav.appendChild(button);
  }

  function installNavigation() {
    if (typeof window.switchMainView !== 'function' || window.switchMainView.__skillStatusPatched) return;
    const original = window.switchMainView;
    const wrapped = function (view) {
      if (view === 'skillStatus') {
        original.apply(this, arguments);
        showSkillStatus();
        return;
      }
      hideSkillStatus();
      const result = original.apply(this, arguments);
      if (view === 'characters') {
        const characterPanel = document.getElementById('characterPanel');
        if (characterPanel) characterPanel.hidden = false;
      }
      return result;
    };
    wrapped.__skillStatusPatched = true;
    wrapped.__skillStatusOriginal = original;
    window.switchMainView = wrapped;
  }

  function installAccountRefresh() {
    if (typeof window.switchAccount === 'function' && !window.switchAccount.__skillStatusPatched) {
      const original = window.switchAccount;
      const wrapped = function () {
        const result = original.apply(this, arguments);
        if (!document.getElementById(PANEL_ID)?.hidden) renderSkillStatus();
        return result;
      };
      wrapped.__skillStatusPatched = true;
      window.switchAccount = wrapped;
    }
    if (typeof window.__NIKKE_GM_APPLY_SYNC__ === 'function' && !window.__NIKKE_GM_APPLY_SYNC__.__skillStatusPatched) {
      const original = window.__NIKKE_GM_APPLY_SYNC__;
      const wrapped = function () {
        const result = original.apply(this, arguments);
        if (result && typeof result.then === 'function') {
          return result.then(function (value) {
            if (!document.getElementById(PANEL_ID)?.hidden) renderSkillStatus();
            return value;
          });
        }
        if (!document.getElementById(PANEL_ID)?.hidden) renderSkillStatus();
        return result;
      };
      wrapped.__skillStatusPatched = true;
      window.__NIKKE_GM_APPLY_SYNC__ = wrapped;
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    injectStyle();
    ensurePanel();
    ensureNavFallback();
    installNavigation();
    installAccountRefresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();