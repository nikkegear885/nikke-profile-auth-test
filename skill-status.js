/* TEST SITE ONLY: owned-character skill level view. */
(function () {
  'use strict';

  const PANEL_ID = 'skillStatusPanel';
  const PEDIA_URL = 'assets/nikke-pedia-master.json?v=1055';
  const OWNED_PREFIX = 'nikke_synced_owned_characters_v1_';
  const UNOWNED_PREFIX = 'nikke_unowned_characters_v1_';
  const ACCOUNT_DATA_PREFIX = 'nikkeGearManagerV6_account_';
  const HIDDEN_CHARACTERS_PREFIX = 'nikke_skill_status_hidden_characters_v1_';
  let initialized = false;
  let imageMap = {};
  let imageLoadPromise = null;
  let skillFilterLevel = 10;
  let skillSortKey = '';
  let skillSortDirection = 'desc';
  let showHiddenCharacters = false;

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

  function currentRows(accountOverride) {
    const hasExplicitAccount = accountOverride !== undefined && accountOverride !== null && String(accountOverride).trim() !== '';
    const account = hasExplicitAccount ? String(accountOverride).trim() : activeAccountName();
    if (account) {
      try {
        const raw = localStorage.getItem(ACCOUNT_DATA_PREFIX + encodeURIComponent(account));
        if (raw !== null) {
          const savedRows = JSON.parse(raw);
          if (Array.isArray(savedRows)) return savedRows;
        }
      } catch (_) {}
    }
    // An explicit account lookup must never fall back to another account's in-memory rows.
    if (hasExplicitAccount) return [];
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

  function getOwnedRows(accountOverride) {
    const hasExplicitAccount = accountOverride !== undefined && accountOverride !== null && String(accountOverride).trim() !== '';
    const account = hasExplicitAccount ? String(accountOverride).trim() : activeAccountName();
    const rows = hasExplicitAccount ? currentRows(account) : currentRows();
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
          // An empty unowned list is not proof that every character is owned.
          // Without a synced roster or explicit row markers, keep ownership unknown.
          if (!names.length) return null;
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
      '.skill-status-filter-description{display:inline-flex;align-items:center;gap:7px;color:#37556e;font-size:13px;font-weight:900;white-space:nowrap}' +
      '.skill-status-filter-level{height:36px;min-width:78px;padding:0 9px;border:1px solid #b9d0e3;border-radius:8px;background:#f3f8fc;color:#2e5f82;font-size:13px;font-weight:900;cursor:pointer}' +
      '.skill-status-hide-manage-toggle{min-height:38px;padding:0 13px;border:1px solid #d4c4ed;border-radius:9px;background:#f8f3ff;color:#7654a7;font-size:12px;font-weight:900;cursor:pointer}' +
      '.skill-status-hide-manage-toggle.active{background:#7654a7;border-color:#7654a7;color:#fff}' +
      '.skill-status-restore-all-button{min-height:38px;padding:0 13px;border:1px solid #b8ddc5;border-radius:9px;background:#f2fbf5;color:#267344;font-size:12px;font-weight:900;cursor:pointer}' +
      '.skill-status-restore-all-button:disabled{opacity:.45;cursor:not-allowed}' +
      '.skill-status-hide-state{width:100%;color:#7654a7;font-size:11px;font-weight:800}' +
      '.skill-status-row-hidden td{opacity:.58;background:rgba(130,105,165,.06)}' +
      '.skill-status-row-hidden .skill-status-character-name{text-decoration:line-through}' +
      '.skill-status-character-tools{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0}' +
      '.skill-status-hide-row-button{min-height:25px;padding:2px 8px;border:1px solid #d6c4e9;border-radius:6px;background:#fff;color:#7654a7;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}' +
      '.skill-status-hide-row-button.restore{border-color:#b8ddc5;color:#267344;background:#f2fbf5}' +
      'html.dark-theme .skill-status-hide-manage-toggle{background:#2a203a;border-color:#594675;color:#d9c6f6}' +
      'html.dark-theme .skill-status-hide-manage-toggle.active{background:#7654a7;border-color:#a98bd2;color:#fff}' +
      'html.dark-theme .skill-status-restore-all-button{background:#17291f;border-color:#315f43;color:#a6e3ba}' +
      'html.dark-theme .skill-status-hide-state{color:#c7a9f2}' +
      'html.dark-theme .skill-status-row-hidden td{background:rgba(130,105,165,.1)}' +
      'html.dark-theme .skill-status-hide-row-button{background:#211a2d;border-color:#594675;color:#d9c6f6}' +
      'html.dark-theme .skill-status-hide-row-button.restore{background:#17291f;border-color:#315f43;color:#a6e3ba}' +
      '.skill-status-wrap{border:1px solid #d8e3ed;border-radius:14px;background:#fff;overflow:hidden}' +
      '.skill-status-table{width:100%;border-collapse:collapse;table-layout:fixed}' +
      '.skill-status-table th{padding:12px 10px;background:#f2f6fa;color:#526b80;text-align:center;font-size:12px;font-weight:900;border-bottom:1px solid #d8e3ed}' +
      '.skill-status-table td{padding:8px 10px;border-bottom:1px solid #e5ecf2;text-align:center;font-size:13px;color:#2e4356}' +
      '.skill-status-table tr:last-child td{border-bottom:0}' +
      '.skill-status-table .skill-character-cell{display:flex;align-items:center;gap:10px;text-align:left;min-width:0;font-weight:800}' +
      '.skill-status-character-image{flex:0 0 48px;width:48px;height:56px;object-fit:cover;object-position:center top;border-radius:7px;background:#edf2f6}' +
      '.skill-status-character-name{overflow-wrap:anywhere;line-height:1.35}' +
      '.skill-status-level{font-size:15px!important;font-weight:900;font-variant-numeric:tabular-nums}' +
      '.skill-status-sort-button{display:inline-flex;align-items:center;justify-content:center;gap:5px;width:100%;padding:3px 0;border:0;background:transparent;color:inherit;font:inherit;font-weight:inherit;cursor:pointer;white-space:nowrap}' +
      '.skill-status-sort-button:hover{color:#1685bd}' +
      '.skill-status-sort-indicator{font-size:11px;opacity:.7}' +
      'html.dark-theme .skill-status-sort-button:hover{color:#77c8f2}' +
      '.skill-status-empty{padding:24px 14px;text-align:center;color:#718397;font-size:13px;line-height:1.6}' +
      'html.dark-theme .skill-status-toolbar{background:#111e2c;border-color:#304356}' +
      'html.dark-theme .skill-status-filter-description{color:#d5e2ef}' +
      'html.dark-theme .skill-status-filter-level{background:#152537;border-color:#405469;color:#e0eaf5}' +
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
    panel.setAttribute('aria-label', '니케 스킬현황');
    panel.innerHTML =
      '<div class="skill-status-toolbar">' +
        '<label class="skill-status-filter-description" for="skillStatusFilterLevel">' +
          '<select id="skillStatusFilterLevel" class="skill-status-filter-level" aria-label="필터 기준 스킬 레벨">' +
            Array.from({length:10}, function (_, index) { return '<option value="' + (index + 1) + '"' + (index === 9 ? ' selected' : '') + '>' + (index + 1) + '레벨</option>'; }).join('') +
          '</select>' +
          '<span>이상 스킬인 니케만 보기</span>' +
        '</label>' +
        '<button type="button" id="skillStatusHideManageToggle" class="skill-status-hide-manage-toggle" aria-pressed="false">원하는 캐릭터 숨기기</button>' +
        '<button type="button" id="skillStatusRestoreAllButton" class="skill-status-restore-all-button">숨긴 캐릭터 취소하기</button>' +
        '<span id="skillStatusHideState" class="skill-status-hide-state" aria-live="polite"></span>' +
      '</div>' +
      '<div class="skill-status-wrap">' +
        '<table class="skill-status-table">' +
          '<thead><tr><th style="width:52%">캐릭터</th><th><button type="button" class="skill-status-sort-button" data-skill-sort="스킬1" aria-label="1스킬 레벨순 정렬"><span>1스킬 레벨</span><span class="skill-status-sort-indicator" aria-hidden="true">↕</span></button></th><th><button type="button" class="skill-status-sort-button" data-skill-sort="스킬2" aria-label="2스킬 레벨순 정렬"><span>2스킬 레벨</span><span class="skill-status-sort-indicator" aria-hidden="true">↕</span></button></th><th><button type="button" class="skill-status-sort-button" data-skill-sort="버스트스킬" aria-label="버스트 레벨순 정렬"><span>버스트 레벨</span><span class="skill-status-sort-indicator" aria-hidden="true">↕</span></button></th></tr></thead>' +
          '<tbody id="skillStatusBody"><tr><td colspan="4" class="skill-status-empty">보유 캐릭터를 확인하고 있습니다.</td></tr></tbody>' +
        '</table>' +
      '</div>';
    const insertBefore = main.querySelector('#characterPanel,#outpostPanel');
    if (insertBefore) main.insertBefore(panel, insertBefore);
    else main.appendChild(panel);
  }

  function getHiddenCharacters() {
    const account = activeAccountName();
    if (!account) return new Set();
    try {
      const saved = JSON.parse(localStorage.getItem(HIDDEN_CHARACTERS_PREFIX + encodeURIComponent(account)) || '[]');
      return new Set(Array.isArray(saved) ? saved.map(normalizeName).filter(Boolean) : []);
    } catch (_) {
      return new Set();
    }
  }

  function saveHiddenCharacters(hiddenNames) {
    const account = activeAccountName();
    if (!account) return;
    try {
      localStorage.setItem(HIDDEN_CHARACTERS_PREFIX + encodeURIComponent(account), JSON.stringify(Array.from(hiddenNames)));
    } catch (_) {}
  }

  function syncHideManagementControls(hiddenCount) {
    const button = document.getElementById('skillStatusHideManageToggle');
    const restoreAllButton = document.getElementById('skillStatusRestoreAllButton');
    const state = document.getElementById('skillStatusHideState');
    if (button) {
      button.classList.toggle('active', showHiddenCharacters);
      button.setAttribute('aria-pressed', String(showHiddenCharacters));
      button.textContent = '원하는 캐릭터 숨기기';
      button.title = showHiddenCharacters
        ? '숨김으로 지정한 캐릭터를 표시 중입니다. 눌러서 다시 숨깁니다.'
        : '숨김으로 지정한 캐릭터는 숨겨져 있습니다. 눌러서 표시하거나, 각 캐릭터 옆 숨기기 버튼으로 지정할 수 있습니다.';
    }
    if (restoreAllButton) {
      restoreAllButton.disabled = hiddenCount === 0;
      restoreAllButton.title = hiddenCount
        ? '숨김 처리한 캐릭터 ' + hiddenCount + '명을 모두 숨김 해제합니다.'
        : '숨김 처리한 캐릭터가 없습니다.';
    }
    if (state) {
      state.textContent = hiddenCount
        ? '숨김 지정 ' + hiddenCount + '명 · ' + (showHiddenCharacters ? '표시 중' : '숨김 중')
        : '숨긴 캐릭터 없음';
    }
  }

  function toggleCharacterHidden(name) {
    const normalized = normalizeName(name);
    if (!normalized) return;
    const hiddenNames = getHiddenCharacters();
    if (hiddenNames.has(normalized)) hiddenNames.delete(normalized);
    else hiddenNames.add(normalized);
    saveHiddenCharacters(hiddenNames);
    renderSkillStatus();
  }

  function restoreAllHiddenCharacters() {
    if (!activeAccountName()) return;
    saveHiddenCharacters(new Set());
    showHiddenCharacters = false;
    renderSkillStatus();
  }

  function syncSkillFilterControls() {
    const level = document.getElementById('skillStatusFilterLevel');
    if (level && String(level.value) !== String(skillFilterLevel)) {
      level.value = String(skillFilterLevel);
    }
  }

  function numericSkillLevel(row, key) {
    const raw = row && row[key] != null ? String(row[key]).replace(/,/g, '').trim() : '';
    if (!raw) return -1;
    const value = Number(raw);
    return Number.isFinite(value) ? value : -1;
  }

  function numericCombatPower(row) {
    const raw = row && row['전투력'] != null ? String(row['전투력']).replace(/,/g, '').trim() : '';
    if (!raw) return -1;
    const value = Number(raw);
    return Number.isFinite(value) ? value : -1;
  }

  function updateSkillSortIndicators() {
    document.querySelectorAll('[data-skill-sort]').forEach(function (button) {
      const key = button.dataset.skillSort || '';
      const indicator = button.querySelector('.skill-status-sort-indicator');
      const active = key === skillSortKey;
      if (indicator) indicator.textContent = active ? (skillSortDirection === 'desc' ? '↓' : '↑') : '↕';
      button.setAttribute('aria-sort', active ? (skillSortDirection === 'desc' ? 'descending' : 'ascending') : 'none');
      button.setAttribute('aria-label', button.querySelector('span')?.textContent + (active
        ? (skillSortDirection === 'desc' ? ' 내림차순 정렬 중' : ' 오름차순 정렬 중')
        : ' 정렬'));
    });
  }

  function handleSkillSortClick(key) {
    if (!key) return;
    if (skillSortKey === key) {
      skillSortDirection = skillSortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      skillSortKey = key;
      skillSortDirection = 'desc';
    }
    renderSkillStatus();
  }

  function rowMeetsSkillThreshold(row) {
    const threshold = Number(skillFilterLevel) || 1;
    return ['스킬1', '스킬2', '버스트스킬'].some(function (key) {
      const value = Number(String(row && row[key] == null ? '' : row[key]).replace(/,/g, ''));
      return Number.isFinite(value) && value >= threshold;
    });
  }

  function renderSkillStatus(accountOverride) {
    const body = document.getElementById('skillStatusBody');
    if (!body) return;
    const hasExplicitAccount = accountOverride !== undefined && accountOverride !== null && String(accountOverride).trim() !== '';
    const account = hasExplicitAccount ? String(accountOverride).trim() : activeAccountName();
    syncSkillFilterControls();
    const ownedRows = hasExplicitAccount ? getOwnedRows(account) : getOwnedRows();
    if (ownedRows === null) {
      syncHideManagementControls(getHiddenCharacters().size);
      body.innerHTML = '<tr><td colspan="4" class="skill-status-empty">보유 목록을 확인할 수 없습니다. 먼저 현재 계정을 동기화한 뒤 확인해 주세요.</td></tr>';
      return;
    }

    const hiddenNames = getHiddenCharacters();
    syncHideManagementControls(hiddenNames.size);
    // Each row can be hidden or restored at any time. The toolbar button only controls
    // whether rows marked as hidden are included in the visible list.
    const filteredRows = ownedRows.filter(function (row) {
      return rowMeetsSkillThreshold(row) &&
        (showHiddenCharacters || !hiddenNames.has(normalizeName(row && row['이름'])));
    });

    if (skillSortKey) {
      filteredRows.sort(function (a, b) {
        const difference = numericSkillLevel(a, skillSortKey) - numericSkillLevel(b, skillSortKey);
        if (difference !== 0) return skillSortDirection === 'desc' ? -difference : difference;
        const powerDifference = numericCombatPower(b) - numericCombatPower(a);
        if (powerDifference !== 0) return powerDifference;
        return String(a && a['이름'] || '').localeCompare(String(b && b['이름'] || ''), 'ko');
      });
    } else {
      // Default ordering is highest combat power first until a skill column is chosen.
      filteredRows.sort(function (a, b) {
        const difference = numericCombatPower(b) - numericCombatPower(a);
        if (difference !== 0) return difference;
        return String(a && a['이름'] || '').localeCompare(String(b && b['이름'] || ''), 'ko');
      });
    }
    updateSkillSortIndicators();

    if (!filteredRows.length) {
      body.innerHTML = '<tr><td colspan="4" class="skill-status-empty">' +
        (hiddenNames.size && !showHiddenCharacters
          ? skillFilterLevel + '레벨 이상인 스킬이 있는 니케가 없습니다. 숨긴 캐릭터를 확인하려면 상단의 ‘원하는 캐릭터 숨기기’ 버튼을 눌러 주세요.'
          : skillFilterLevel + '레벨 이상인 스킬을 가진 보유 니케가 없습니다.') +
        '</td></tr>';
      return;
    }

    body.innerHTML = filteredRows.map(function (row) {
      const name = String(row && row['이름'] || '').trim();
      const normalizedName = normalizeName(name);
      const isHidden = hiddenNames.has(normalizedName);
      const image = getImage(name);
      const rowClass = isHidden ? ' class="skill-status-row-hidden"' : '';
      const characterTools = '<div class="skill-status-character-tools">' +
        '<span class="skill-status-character-name">' + escapeHtml(name) + '</span>' +
        '<button type="button" class="skill-status-hide-row-button ' + (isHidden ? 'restore' : '') + '" data-skill-hide-character="' + escapeHtml(name) + '" aria-label="' + escapeHtml(isHidden ? '다시 표시 ' + name : '숨기기 ' + name) + '">' +
          (isHidden ? '다시 표시' : '숨기기') +
        '</button>' +
      '</div>';

      return '<tr' + rowClass + '>' +
        '<td><div class="skill-character-cell">' +
          (image ? '<img class="skill-status-character-image" loading="lazy" src="' + escapeHtml(image) + '" alt="" onerror="this.style.display=\'none\'">' : '<span class="skill-status-character-image" aria-hidden="true"></span>') +
          characterTools +
        '</div></td>' +
        '<td class="skill-status-level">' + escapeHtml(formatLevel(row['스킬1'])) + '</td>' +
        '<td class="skill-status-level">' + escapeHtml(formatLevel(row['스킬2'])) + '</td>' +
        '<td class="skill-status-level">' + escapeHtml(formatLevel(row['버스트스킬'])) + '</td>' +
      '</tr>';
    }).join('');

    body.querySelectorAll('[data-skill-hide-character]').forEach(function (button) {
      button.addEventListener('click', function () {
        toggleCharacterHidden(button.dataset.skillHideCharacter || '');
      });
    });
  }

  window.__NIKKE_GM_REFRESH_SKILL_STATUS__ = function (account) {
    const name = account == null ? '' : String(account).trim();
    renderSkillStatus(name || undefined);
  };

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
    if (title) title.textContent = '니케 스킬현황';
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
    button.textContent = '니케 스킬현황';
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
    document.getElementById('skillStatusFilterLevel')?.addEventListener('change', function (event) {
      skillFilterLevel = Math.max(1, Math.min(10, Number(event.target.value) || 10));
      renderSkillStatus();
    });
    document.getElementById('skillStatusHideManageToggle')?.addEventListener('click', function () {
      showHiddenCharacters = !showHiddenCharacters;
      renderSkillStatus();
    });
    document.getElementById('skillStatusRestoreAllButton')?.addEventListener('click', restoreAllHiddenCharacters);
    document.querySelectorAll('[data-skill-sort]').forEach(function (button) {
      button.addEventListener('click', function () {
        handleSkillSortClick(button.dataset.skillSort || '');
      });
    });
    updateSkillSortIndicators();
    installAccountRefresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();