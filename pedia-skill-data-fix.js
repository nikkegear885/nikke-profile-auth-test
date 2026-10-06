(() => {
  'use strict';
  const originalFetch = window.fetch.bind(window);
  const isSkillDataUrl = (input) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    return /assets\/nikke-skills\.json(?:\?|$)/.test(url);
  };
  const normalize = (v) => String(v ?? '').normalize('NFKC').toLowerCase().replace(/[\s:：·•._'’“”"`\-–—()\[\]{}]/g, '');

  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init);
    if (!isSkillDataUrl(input) || !response.ok) return response;
    try {
      const data = await response.clone().json();

      // 도감 이름과 스킬 JSON의 키가 조금 다른 경우에도 연결합니다.
      // 가장 안전한 기준은 니케 ID이며, ID가 없으면 정규화한 이름을 사용합니다.
      try {
        const masterResponse = await originalFetch('assets/nikke-pedia-master.json?v=1028', { cache: 'no-store' });
        if (masterResponse.ok) {
          const master = await masterResponse.json();
          if (Array.isArray(master)) {
            for (const item of master) {
              if (!item || !item.name) continue;
              let skill = data[item.name];
              if (!skill) {
                const id = Number(item.id ?? item.i);
                if (Number.isFinite(id)) {
                  skill = Object.values(data).find(x => x && Number(x.i) === id);
                }
              }
              if (!skill) {
                const wanted = normalize(item.name);
                const found = Object.entries(data).find(([key, value]) => normalize(key) === wanted || normalize(value?.name) === wanted);
                if (found) skill = found[1];
              }
              if (skill) data[item.name] = skill;
            }
          }
        }
      } catch (aliasError) {
        console.warn('[pedia] name/id alias mapping failed', aliasError);
      }

      Object.values(data || {}).forEach(nikke => {
        if (!nikke || !nikke.k || typeof nikke.k !== 'object') return;
        Object.values(nikke.k).forEach(skill => {
          if (!skill || typeof skill !== 'object') return;
          if (skill.template == null && skill.t != null) skill.template = skill.t;
          if (skill.values == null && Array.isArray(skill.v)) skill.values = skill.v;
          if (skill.cooltime == null && skill.c != null) skill.cooltime = skill.c;
        });
      });

      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    } catch (e) {
      console.warn('[pedia] skill data normalization failed', e);
      return response;
    }
  };
})();
