(() => {
  'use strict';
  const originalFetch = window.fetch.bind(window);
  const isSkillDataUrl = (input) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    return /assets\/nikke-skills\.json(?:\?|$)/.test(url);
  };

  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init);
    if (!isSkillDataUrl(input) || !response.ok) return response;
    try {
      const data = await response.clone().json();
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
