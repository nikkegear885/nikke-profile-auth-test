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
  let skillFilterEnabled = false;
  let skillFilterLevel = 10;

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
      'body.skill-status-view #kpis{display:none!important}' +
      '#skillStatusPanel{margin:0 0 24px;padding:0 14px 24px;color:var(--text,#263449);min-width:0}' +
      '.skill-status-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;padding:12px 14px;border:1px solid #d8e3ed;border-radius:12px;background:#fff}' +
      '.skill-status-filter-toggle{min-height:38px;padding:0 14px;border:1px solid #bed0df;border-radius:9px;background:#f3f7fb;color:#37556e;font-size:12px;font-weight:900;cursor:pointer;transition:background .15s,border-color .15s,color .15s}' +
      '.skill-status-filter-toggle.active{background:#176e9f;border-color:#176e9f;color:#fff;box-shadow:0 3px 8px rgba(23,110,159,.16)}' +
      '.skill-status-filter-level-wrap{display:flex;align-items:center;gap:7px;color:#526b80;font-size:12px;font-weight:800}' +
      '.skill-status-filter-level{height:36px;min-width:76px;padding:0 9px;border:1px solid #cbd9e5;border-radius:8px;background:#fff;color:#2e4356;font-size:12px;font-weight:900}' +
      '.skill-status-filter-state{margin-left:auto;color:#718397;font-size:11px;font-weight:800}' +
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
      'html.dark-theme .skill-status-toolbar{background:#111e2c;border-color:#304356}' +
      'html.dark-theme .skill-status-filter-toggle{background:#1b2b3c;border-color:#405469;color:#d5e2ef}' +
      'html.dark-theme .skill-status-filter-toggle.active{background:#176e9f;border-color:#4ba9de;color:#fff}' +
      'html.dark-theme .skill-status-filter-level-wrap{color:#b8cadb}' +
      'html.dark-theme .skill-status-filter-level{background:#152537;border-color:#405469;color:#e0eaf5}' +
      'html.dark-theme .skill-status-filter-state{color:#95a9bd}' +
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
      '<div class="skill-status-toolbar">' +
        '<button type="button" id="skillStatusFilterToggle" class="skill-status-filter-toggle" aria-pressed="false">스킬레벨 필터</button>' +
        '<label class="skill-status-filter-level-wrap" for="skillStatusFilterLevel"><span>기준 레벨</span>' +
          '<select id="skillStatusFilterLevel" class="skill-status-filter-level" aria-label="스킬레벨 필터 기준 레벨">' +
            Array.from({length:10}, function (_, index) { return '<option value="' + (index + 1) + '"' + (index === 9 ? ' selected' : '') + '>' + (index + 1) + '레벨</option>'; }).join('') +
          '</select>' +
        '</label>' +
        '<span id="skillStatusFilterState" class="skill-status-filter-state">전체 보유 캐릭터 표시</span>' +
      '</div>' +
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

  function syncSkillFilterControls() {
    const button = document.getElementById('skillStatusFilterToggle');
    const level = document.getElementById('skillStatusFilterLevel');
    const state = document.getElementById('skillStatusFilterState');
    if (button) {
      button.classList.toggle('active', skillFilterEnabled);
      button.setAttribute('aria-pressed', String(skillFilterEnabled));
      button.title = skillFilterEnabled
        ? '스킬레벨 필터가 적용 중입니다. 눌러서 해제할 수 있습니다.'
        : '1스킬, 2스킬, 버스트 중 하나라도 선택한 레벨 이상인 캐릭터만 표시합니다.';
    }
    if (level && String(level.value) !== String(skillFilterLevel)) level.value = String(skillFilterLevel);
    if (state) state.textContent = skillFilterEnabled
      ? skillFilterLevel + '레벨 이상 · 필터 적용 중'
      : '전체 보유 캐릭터 표시';
  }

  function rowMeetsSkillThreshold(row) {
    if (!skillFilterEnabled) return true;
    const threshold = Number(skillFilterLevel) || 1;
    return ['스킬1', '스킬2', '버스트스킬'].some(function (key) {
      const value = Number(String(row && row[key] == null ? '' : row[key]).replace(/,/g, ''));
      return Number.isFinite(value) && value >= threshold;
    });
  }

  function renderSkillStatus() {
    const body = document.getElementById('skillStatusBody');
    if (!body) return;
    syncSkillFilterControls();
    const ownedRows = getOwnedRows();
    if (ownedRows === null) {
      body.innerHTML = '<tr><td colspan="4" class="skill-status-empty">보유 목록을 확인할 수 없습니다. 먼저 현재 계정을 동기화한 뒤 확인해 주세요.</td></tr>';
      return;
    }
    const filteredRows = ownedRows.filter(rowMeetsSkillThreshold);
    if (!filteredRows.length) {
      body.innerHTML = '<tr><td colspan="4" class="skill-status-empty">' +
        (skillFilterEnabled
          ? skillFilterLevel + '레벨 이상인 스킬이 있는 보유 캐릭터가 없습니다.'
          : '보유 캐릭터가 없습니다.') +
        '</td></tr>';
      return;
    }
    body.innerHTML = filteredRows.map(function (row) {
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
    document.getElementById('skillStatusFilterToggle')?.addEventListener('click', function () {
      skillFilterEnabled = !skillFilterEnabled;
      renderSkillStatus();
    });
    document.getElementById('skillStatusFilterLevel')?.addEventListener('change', function (event) {
      skillFilterLevel = Math.max(1, Math.min(10, Number(event.target.value) || 10));
      renderSkillStatus();
    });
    installAccountRefresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();