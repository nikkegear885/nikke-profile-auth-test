/* TEST SERVER ONLY — NIKKE Overload simulator and custom module expectation calculator.
 * No user account or equipment data is read or changed.
 */
(function(){
'use strict';
if(document.getElementById('overloadPanel'))return;
const effects=[
  {k:'ele',n:'우월 코드 대미지',w:10,a:9.54,b:29.16},
  {k:'atk',n:'공격력',w:10,a:4.77,b:14.63},
  {k:'ammo',n:'최대 장탄 수',w:12,a:27.84,b:85.37},
  {k:'hit',n:'명중률',w:12,a:4.77,b:14.63},
  {k:'cdmg',n:'차지 대미지',w:12,a:4.77,b:14.63},
  {k:'cspd',n:'차지 속도',w:12,a:1.98,b:6.09},
  {k:'crit',n:'크리티컬 확률',w:12,a:2.30,b:7.07},
  {k:'critd',n:'크리티컬 대미지',w:10,a:6.64,b:20.36},
  {k:'def',n:'방어력',w:10,a:4.77,b:14.63}
];
const byKey=new Map(effects.map(e=>[e.k,e]));
const rates=[1,.5,.3];
const tiers=Array.from({length:15},(_,i)=>i<5?12:i<10?7:1);
const blank=()=>({k:null,t:null,lock:false});
const copy=rows=>rows.map(r=>({...r}));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(n)?n.toLocaleString('ko-KR',{maximumFractionDigits:n<10?2:1}):'불가';
let gear=[blank(),blank(),blank()],candidate=null,modules=0,attempts=0,mode='any';
const nav=document.querySelector('.sidebar .nav');
const main=document.querySelector('main.main')||document.querySelector('main');
if(!nav||!main||typeof window.switchMainView!=='function')return;
function weighted(items,banned){
  const choices=items.filter(i=>!banned||!banned.has(i.k));
  const total=choices.reduce((sum,i)=>sum+i.w,0);
  if(!total)return null;
  let r=Math.random()*total;
  for(const c of choices){r-=c.w;if(r<0)return c}
  return choices[choices.length-1];
}
function drawTier(except){
  const choices=tiers.map((w,i)=>({k:i+1,w}));
  return weighted(choices,except==null?null:new Set([except])).k;
}
function rerollEffects(before,first){
  const result=copy(before);
  const used=new Set(before.filter(r=>r.lock&&r.k).map(r=>r.k));
  for(let i=0;i<3;i++){
    if(result[i].lock)continue;
    if(Math.random()>=rates[i]){result[i]=blank();continue}
    const item=weighted(effects,used);
    if(!item){result[i]=blank();continue}
    used.add(item.k);
    let t=first?11:drawTier();
    if(!first&&before[i].k===item.k&&before[i].t===t)t=drawTier(t);
    result[i]={k:item.k,t,lock:false};
  }
  return result;
}
function rerollValues(rows){
  return rows.map(r=>!r.k||r.lock?{...r}:{...r,t:drawTier(r.t)});
}
function val(r){
  if(!r.k)return '—';
  const e=byKey.get(r.k);
  return (e.a+(e.b-e.a)*(r.t-1)/14).toFixed(2)+'%';
}
const css=[
  '#overloadPanel[hidden]{display:none!important}',
  'body.overload-view .main>:not(#overloadPanel):not(.topbar):not(#settingsPopover){display:none!important}',
  'body.overload-view .main>.topbar{display:none!important}',
  'body.overload-view #overloadPanel{display:block!important}',
  '#overloadPanel{box-sizing:border-box;width:100%;max-width:1100px;margin:14px auto 35px;padding:0 12px;color:#273b51}',
  '#overloadPanel *{box-sizing:border-box}',
  '#overloadPanel button,#overloadPanel select,#overloadPanel input{font:inherit}',
  '#overloadPanel button{cursor:pointer}',
  '#overloadPanel button:disabled{opacity:.35;cursor:not-allowed}',
  '#overloadPanel [hidden]{display:none!important}',
  '#overloadPanel .ol-head h2{font-size:27px;font-weight:1000;margin:0}',
  '#overloadPanel .ol-lead{font-size:12px;color:#73869b;margin:7px 0 13px;line-height:1.6}',
  '#overloadPanel .ol-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}',
  '#overloadPanel .ol-tab{padding:10px 14px;border:1px solid #c9d9e9;border-radius:8px;background:#fff;color:#567089;font-size:12px;font-weight:900}',
  '#overloadPanel .ol-tab[aria-selected=true]{background:#e4f5ff;color:#096b9b;border-color:#42a1cf}',
  '#overloadPanel .ol-card{background:#fff;border:1px solid #d6e2ed;border-radius:12px;padding:17px;margin-bottom:12px;box-shadow:0 3px 12px rgba(20,50,80,.05)}',
  '#overloadPanel .ol-card h3{font-size:17px;font-weight:1000;color:#24658e;margin:0 0 11px}',
  '#overloadPanel .ol-muted{font-size:12px;color:#70829a;line-height:1.7;margin:8px 0}',
  '#overloadPanel .ol-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:13px 0}',
  '#overloadPanel .ol-stat{padding:11px;border:1px solid #e2e9f2;border-radius:8px;background:#f6faff}',
  '#overloadPanel .ol-stat small{font-size:11px;display:block;color:#788a9e}',
  '#overloadPanel .ol-stat strong{font-size:20px;display:block;margin-top:4px}',
  '#overloadPanel .ol-lines{display:grid;gap:8px}',
  '#overloadPanel .ol-line{display:grid;grid-template-columns:45px minmax(0,1fr) 102px 94px;align-items:center;gap:8px;padding:11px;border:1px solid #dce6f0;border-radius:9px;background:#f8fbff}',
  '#overloadPanel .ol-line.locked{background:#fff9ed;border-color:#e5c67d}',
  '#overloadPanel .ol-line .ol-num{font-size:14px;font-weight:1000}',
  '#overloadPanel .ol-line strong{font-size:13px;display:block;overflow-wrap:anywhere}',
  '#overloadPanel .ol-line small{color:#7c91a5;font-size:10px;display:block;margin-top:4px}',
  '#overloadPanel .ol-line .ol-val{text-align:right;font-weight:900;font-size:13px}',
  '#overloadPanel .ol-lock{padding:8px 5px;border-radius:7px;border:1px solid #d9bb87;background:#fff3da;color:#8c662a;font-size:11px;font-weight:900}',
  '#overloadPanel .ol-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}',
  '#overloadPanel .ol-btn{padding:10px 14px;border-radius:8px;border:1px solid #bfdae9;background:#f2f9fd;color:#24759d;font-size:12px;font-weight:900}',
  '#overloadPanel .ol-btn.primary{background:#178fc6;border-color:#117ead;color:#fff}',
  '#overloadPanel .ol-btn.danger{color:#a44747;border-color:#e4bbbb;background:#fff7f7}',
  '#overloadPanel .ol-controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0;font-size:12px;font-weight:850}',
  '#overloadPanel .ol-controls label{display:inline-flex;align-items:center;gap:5px}',
  '#overloadPanel .ol-targets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
  '#overloadPanel .ol-targets label{display:block;font-size:12px;font-weight:900;margin-bottom:6px}',
  '#overloadPanel .ol-targets select{width:100%;padding:10px;border:1px solid #c6d9e9;border-radius:8px;background:#fff;color:#273e52}',
  '#overloadPanel .ol-tier-inputs{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin:12px 0}',
  '#overloadPanel .ol-tier-inputs label{display:flex;flex-direction:column;gap:6px;min-width:140px;font-size:12px;font-weight:900}',
  '#overloadPanel .ol-tier-inputs select{min-height:39px;border:1px solid #c6d9e9;border-radius:8px;padding:6px;background:#fff;color:#273e52}',
  '#overloadPanel .ol-alt{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}',
  '#overloadPanel .ol-alt label{padding:7px 9px;border:1px solid #d6e2ec;border-radius:8px;background:#f7fbff;font-size:12px;display:inline-flex;align-items:center;gap:5px}',
  '#overloadPanel .ol-output{padding:15px;border-radius:10px;background:#eef9ff;border:1px solid #b9d9ee;margin-top:13px}',
  '#overloadPanel .ol-output h3{margin:0;color:#116f9a;font-size:23px}',
  '#overloadPanel .ol-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}',
  '#overloadPanel .ol-metric{padding:10px;border:1px solid #d6e6f0;border-radius:8px;background:#fff}',
  '#overloadPanel .ol-metric small{display:block;color:#72899b;font-size:11px}',
  '#overloadPanel .ol-metric b{font-size:19px;display:block;margin-top:4px}',
  '#overloadPanel .ol-alert{padding:12px;border:1px solid #e7d6a5;background:#fff8e7;color:#795a20;border-radius:9px;font-size:12px;line-height:1.7}',
  '#overloadPanel .ol-sources a{color:#147cab;text-decoration:underline}',
  'html.dark-theme #overloadPanel{color:#e7f1ff}',
  'html.dark-theme #overloadPanel .ol-card{background:#16263b;border-color:#3a526c}',
  'html.dark-theme #overloadPanel .ol-card h3{color:#9cdaff}',
  'html.dark-theme #overloadPanel .ol-muted,html.dark-theme #overloadPanel .ol-lead{color:#abc1d9}',
  'html.dark-theme #overloadPanel .ol-tab,html.dark-theme #overloadPanel .ol-stat,html.dark-theme #overloadPanel .ol-line,html.dark-theme #overloadPanel .ol-alt label,html.dark-theme #overloadPanel .ol-metric,html.dark-theme #overloadPanel .ol-btn{background:#20334b;border-color:#435a73;color:#e1edff}',
  'html.dark-theme #overloadPanel .ol-tab[aria-selected=true],html.dark-theme #overloadPanel .ol-output{background:#173b54;border-color:#427eab;color:#dbf2ff}',
  'html.dark-theme #overloadPanel .ol-btn.primary{background:#116e9b;color:#fff}',
  'html.dark-theme #overloadPanel .ol-line.locked{background:#3b3326;border-color:#927749}',
  'html.dark-theme #overloadPanel .ol-targets select,html.dark-theme #overloadPanel .ol-tier-inputs select{background:#22364e;border-color:#475f78;color:#eaf3ff}',
  'html.dark-theme #overloadPanel .ol-alert{background:#332c1d;color:#ffe0a3;border-color:#806e44}',
  '@media(max-width:650px){#overloadPanel{padding:0 5px}#overloadPanel .ol-head h2{font-size:22px}#overloadPanel .ol-card{padding:11px}#overloadPanel .ol-targets{grid-template-columns:1fr}#overloadPanel .ol-line{grid-template-columns:32px minmax(0,1fr) 63px 72px;gap:3px;padding:8px 5px}#overloadPanel .ol-line strong,#overloadPanel .ol-line .ol-val{font-size:11px}#overloadPanel .ol-lock{font-size:9px;padding:8px 2px}#overloadPanel .ol-grid{grid-template-columns:1fr 1fr}}'
].join('\n');
const style=document.createElement('style');style.id='ol-test-style';style.textContent=css;document.head.appendChild(style);
const button=document.createElement('button');
button.type='button';button.className='main-view-nav';button.dataset.view='overload';button.textContent='오버로드 시뮬·모듈 계산';
button.addEventListener('click',()=>window.switchMainView('overload'));
const anchor=nav.querySelector('[data-view="syncro"]');
if(anchor)anchor.insertAdjacentElement('afterend',button);else nav.appendChild(button);
const panel=document.createElement('section');panel.id='overloadPanel';panel.hidden=true;
panel.innerHTML=[
  '<header class="ol-head"><h2>오버로드 연구실 <span style="font-size:12px;color:#2284ae">TEST</span></h2><p class="ol-lead">오버로드 옵션을 직접 굴리고 목표 옵션의 평균 커스텀 모듈 비용을 계산합니다. 게임 계정 장비 데이터에는 반영되지 않습니다.</p></header>',
  '<nav class="ol-nav"><button class="ol-tab" data-ol-page-btn="sim" aria-selected="true">오버로드 시뮬레이터</button><button class="ol-tab" data-ol-page-btn="calc" aria-selected="false">모듈 기대값 계산기</button><button class="ol-tab" data-ol-page-btn="rules" aria-selected="false">확률·안내</button></nav>',
  '<div data-ol-page="sim"><article class="ol-card"><h3>장비 1부위 오버로드 시뮬레이터</h3><p class="ol-muted">효과 변경, 수치 재설정, 영구 잠금, 결과 유지·변경을 실험할 수 있습니다.</p>',
  '<div class="ol-stats"><div class="ol-stat"><small>사용 모듈</small><strong data-ol-modules>0개</strong></div><div class="ol-stat"><small>진행 횟수</small><strong data-ol-attempts>0회</strong></div><div class="ol-stat"><small>다음 변경 비용</small><strong data-ol-next>1개</strong></div></div>',
  '<div class="ol-lines" data-ol-lines></div>',
  '<div class="ol-actions"><button class="ol-btn primary" data-ol-first>최초 개조 · 1모듈</button><button class="ol-btn primary" data-ol-effects>효과 변경</button><button class="ol-btn" data-ol-values>수치 재설정</button><button class="ol-btn danger" data-ol-reset>초기화</button></div>',
  '<div data-ol-proposal-wrap hidden><h3 style="margin-top:18px">변경 후보 옵션</h3><div class="ol-lines" data-ol-proposal></div><div class="ol-actions"><button class="ol-btn primary" data-ol-accept>새 옵션 적용</button><button class="ol-btn" data-ol-reject>기존 옵션 유지</button></div></div>',
  '<p class="ol-muted">잠금 버튼을 누르는 즉시 모듈이 차감되며 해제해도 환급되지 않습니다. 새 옵션을 거절하더라도 변경 모듈은 소비됩니다. 같은 효과·같은 단계가 재등장하면 수치를 재추첨합니다.</p></article></div>',
  '<div data-ol-page="calc" hidden><article class="ol-card"><h3>목표 옵션 · 모듈 기대값</h3>',
  '<div class="ol-controls"><label><input type="checkbox" data-ol-use-current> 현재 시뮬레이터 장비·잠금을 기준으로 계산</label><label>동일 목표 장비 부위 <select data-ol-piece-count><option value="1">1부위</option><option value="2">2부위</option><option value="3">3부위</option><option value="4">4부위 (12줄)</option></select></label></div>',
  '<div class="ol-controls"><label><input type="radio" name="ol-target-mode" value="any" checked> 옵션 순서 무관</label><label><input type="radio" name="ol-target-mode" value="fixed"> 1·2·3번 줄 위치 지정</label></div>',
  '<div class="ol-targets"><div><label data-ol-goal-label="a">필수 옵션 1</label><select data-ol-goal="a"></select></div><div><label data-ol-goal-label="b">필수 옵션 2</label><select data-ol-goal="b"></select></div></div>',
  '<p class="ol-muted" data-ol-goal-label="c">세 번째 조건: 체크한 옵션 중 하나라도 있으면 성공 (선택하지 않으면 세 번째 조건 없음)</p><div class="ol-alt" data-ol-alts></div>',
  '<div class="ol-actions"><button class="ol-btn" data-ol-preset="triple">우코 + 공증 + (장탄/크확/크뎀)</button><button class="ol-btn" data-ol-preset="double">우코 + 공증</button><button class="ol-btn" data-ol-preset="clear">모두 해제</button></div>',
  '<button class="ol-btn primary" data-ol-calculate>모듈 기대값 계산</button><div data-ol-calculation aria-live="polite"></div>',
  '<p class="ol-muted">줄 지정 모드에서는 첫 번째 필수 옵션=1줄, 두 번째=2줄, 세 번째 선택 그룹=3줄입니다. 줄 위치 무관 모드에서는 3종을 서로 다른 줄에서 찾습니다.</p></article>',
  '<article class="ol-card"><h3>수치 재설정(T단계) 기대값</h3><p class="ol-muted">원하는 효과는 이미 갖고 있고 그 줄의 T단계만 높이는 경우입니다. 이전 수치와 완전히 같은 결과가 재등장하지 않는 2026년 규칙을 적용합니다.</p>',
  '<div class="ol-tier-inputs"><label>현재 수치 단계<select data-ol-current-tier></select></label><label>목표 최소 단계<select data-ol-target-tier></select></label><label>다른 줄 잠금 수<select data-ol-tier-locks><option value="0">0줄 (1모듈/회)</option><option value="1">1줄 (2모듈/회)</option><option value="2">2줄 (3모듈/회)</option></select></label></div>',
  '<div class="ol-actions"><button class="ol-btn primary" data-ol-tier-calc>수치작 기대값 계산</button></div><div data-ol-tier-result aria-live="polite"></div>',
  '<p class="ol-muted">수치 재설정 시 다른 잠금 옵션의 수치는 유지됩니다. 이미 목표 수치 이상이면 추가 비용은 0개로 계산합니다. 신규 잠금 비용은 제외합니다.</p></article></div>',
  '<div data-ol-page="rules" hidden><article class="ol-card"><h3>계산 기준 · 참고사항</h3>',
  '<div class="ol-alert">게임 내 공지된 확률과 비용이 변경되면 실제 게임 값을 우선하세요. 기대값은 평균적인 수학 모델이며 결과를 보장하지 않습니다.</div>',
  '<p class="ol-muted"><b>줄 등장:</b> 1줄 100% · 2줄 50% · 3줄 30%. 각각 독립적으로 등장합니다. 정확히 1줄 35% / 2줄 50% / 3줄 15%.</p>',
  '<p class="ol-muted"><b>옵션 출현:</b> 우코·공증·크리뎀·방어 각 10%, 장탄·명중·차지뎀·차속·크확 각 12%. 중복 옵션 없이 남은 가중치 사이에서 재정규화합니다.</p>',
  '<p class="ol-muted"><b>옵션 수치:</b> T1~5 각 12%, T6~10 각 7%, T11~15 각 1%. 최초 개조는 11단계 고정.</p>',
  '<p class="ol-muted"><b>모듈 비용:</b> 최초 개조 1개. 잠금 0/1/2줄의 효과 변경·수치 재설정 1/2/3개. 영구 잠금 첫 줄 2개·둘째 줄 3개(예약한 잠금은 변경 시 비용 소모).</p>',
  '<p class="ol-muted"><b>정확한 기대값:</b> 현재 잠금 상태를 그대로 유지하며, 목표 옵션이 한 번에 모두 등장할 때까지 반복한다고 가정. 새 잠금 비용은 제외합니다.</p>',
  '<p class="ol-muted"><b>자동 잠금 추정:</b> 목표 옵션을 발견하면 영구 잠금하는 단순 전략의 몬테카를로 평균. 최초 개조비·수치 T단계 목표는 제외하고, 새 잠금 비용을 포함합니다. 2~4부위는 동일 목표를 반복한다고 가정합니다. 최적 전략 보장은 없습니다.</p>',
  '<p class="ol-muted ol-sources">참고: <a href="https://www.prydwen.gg/nikke/guides/overload-gear-reroll" target="_blank" rel="noopener noreferrer">Prydwen</a> · <a href="https://nikke-optimizer.pages.dev/" target="_blank" rel="noopener noreferrer">Overload Optimizer</a> · <a href="https://nikke.beomtachi.com/guides/overload-gear/" target="_blank" rel="noopener noreferrer">2026 개편 설명</a></p>',
  '</article></div>'
].join('');
main.appendChild(panel);
const one=sel=>panel.querySelector(sel);
const all=sel=>Array.from(panel.querySelectorAll(sel));
function optionHtml(){return '<option value="">지정 안 함</option>'+effects.map(e=>'<option value="'+e.k+'">'+e.n+' ('+e.w+'%)</option>').join('')}
all('[data-ol-goal]').forEach(s=>s.innerHTML=optionHtml());
all('[data-ol-current-tier],[data-ol-target-tier]').forEach(select=>{select.innerHTML=tiers.map((_,i)=>'<option value="'+(i+1)+'">T'+(i+1)+'</option>').join('')});
one('[data-ol-current-tier]').value='5';one('[data-ol-target-tier]').value='11';
one('[data-ol-goal="a"]').value='ele';
one('[data-ol-goal="b"]').value='atk';
one('[data-ol-alts]').innerHTML=effects.map(e=>
  '<label><input type="checkbox" data-ol-alt="'+e.k+'"'+(['ammo','crit','critd'].includes(e.k)?' checked':'')+'> '+e.n+'</label>').join('');
function locks(){return gear.filter(r=>r.lock).length}

function lineHtml(rows,controls){
  return rows.map((r,i)=>'<div class="ol-line'+(r.lock?' locked':'')+'"><span class="ol-num">'+(i+1)+'줄</span>'+
   '<div><strong>'+(r.k?esc(byKey.get(r.k).n):'옵션 없음')+'</strong><small>'+(r.k?'T'+r.t+' · '+byKey.get(r.k).w+'%':'등장 확률 '+rates[i]*100+'%')+'</small></div>'+
   '<div class="ol-val">'+val(r)+'</div>'+
   (controls?'<button type="button" class="ol-lock" data-ol-lock="'+i+'"'+(!r.k||candidate?' disabled':'')+'>'+
     (r.lock?'잠금 해제':'잠금')+'</button>':
     '<span style="font-size:11px;text-align:center">'+(r.lock?'유지':'변경')+'</span>')+'</div>').join('');
}
function render(){
  one('[data-ol-modules]').textContent=fmt(modules)+'개';
  one('[data-ol-attempts]').textContent=fmt(attempts)+'회';
  one('[data-ol-next]').textContent=fmt(1+locks())+'개';
  one('[data-ol-lines]').innerHTML=lineHtml(gear,true);
  one('[data-ol-proposal-wrap]').hidden=!candidate;
  if(candidate)one('[data-ol-proposal]').innerHTML=lineHtml(candidate,false);
  one('[data-ol-first]').disabled=!!candidate;
  one('[data-ol-effects]').disabled=!!candidate||!gear[0].k||locks()>=3;
  one('[data-ol-values]').disabled=!!candidate||!gear[0].k||locks()>=3;
}
function doRoll(kind){
  if(!gear[0].k||candidate)return;
  modules+=1+locks();attempts++;
  candidate=kind==='effect'?rerollEffects(gear,false):rerollValues(gear);
  render();
}
function targets(){
  const a=one('[data-ol-goal="a"]').value,b=one('[data-ol-goal="b"]').value;
  const c=all('[data-ol-alt]:checked').map(node=>node.dataset.olAlt);
  const slots=[[a],[b],c].map(g=>g.filter(Boolean));
  const groups=slots.filter(g=>g.length);
  const used=new Set();
  for(const g of groups)for(const k of g){
    if(used.has(k))throw Error('서로 다른 목표 조건에 같은 옵션을 중복 지정할 수 없습니다.');
    used.add(k);
  }
  if(!groups.length)throw Error('목표 옵션을 하나 이상 설정해 주세요.');
  return {groups,slots};
}
function valid(rows,goal,m){
  if(m==='fixed')return goal.slots.every((g,i)=>!g.length||(rows[i].k&&g.includes(rows[i].k)));
  function match(j,used){
    if(j>=goal.groups.length)return true;
    for(let i=0;i<3;i++)if(!used.has(i)&&rows[i].k&&goal.groups[j].includes(rows[i].k)){
      used.add(i);if(match(j+1,used))return true;used.delete(i);
    }
    return false;
  }
  return match(0,new Set());
}
function exactProbability(goal,m,lockedRows){
  let p=0;
  const rows=[blank(),blank(),blank()];
  const initial=new Set(lockedRows.filter(r=>r.lock&&r.k).map(r=>r.k));
  function visit(i,used,weight){
    if(i===3){if(valid(rows,goal,m))p+=weight;return}
    if(lockedRows[i].lock){rows[i]={...lockedRows[i]};visit(i+1,used,weight);return}
    if(rates[i]!==1){rows[i]=blank();visit(i+1,used,weight*(1-rates[i]))}
    const list=effects.filter(e=>!used.has(e.k));
    const total=list.reduce((sum,e)=>sum+e.w,0);
    list.forEach(e=>{
      rows[i]={k:e.k,t:11,lock:false};
      const next=new Set(used);next.add(e.k);
      visit(i+1,next,weight*rates[i]*e.w/total);
    });
  }
  visit(0,initial,1);
  return p;
}
function bestMatches(rows,goal,m){
  const groups=m==='fixed'?goal.slots:goal.groups;
  let best=[],bestScore=-1,choices=[],used=new Set();
  function search(j){
    if(j>=groups.length){
      // Preserve already-locked matches when an OR group contains several options.
      // Otherwise a second option from the same group could be locked, making the goal impossible.
      const score=choices.length*10+choices.filter(i=>rows[i].lock).length;
      if(score>bestScore){best=choices.slice();bestScore=score}
      return;
    }
    search(j+1);
    for(let i=0;i<3;i++)if((m!=='fixed'||i===j)&&!used.has(i)&&rows[i].k&&groups[j].includes(rows[i].k)){
      used.add(i);choices.push(i);search(j+1);choices.pop();used.delete(i);
    }
  }
  search(0);return [...new Set(best)];
}
function automaticLockEstimate(goal,m,starting,n){
  const outcomes=[];
  for(let t=0;t<n;t++){
    let rows=copy(starting),cost=0,done=false;
    for(let step=0;step<4500;step++){
      if(valid(rows,goal,m)){done=true;break}
      const indices=bestMatches(rows,goal,m);
      for(const i of indices){
        const nlock=rows.filter(r=>r.lock).length;
        if(!rows[i].lock&&nlock<2){cost+=2+nlock;rows[i].lock=true}
      }
      cost+=1+rows.filter(r=>r.lock).length;
      rows=rerollEffects(rows,false);
    }
    if(done)outcomes.push(cost);
  }
  if(!outcomes.length)return {success:0,mean:Infinity,median:Infinity,p95:Infinity};
  outcomes.sort((a,b)=>a-b);
  return {success:outcomes.length,
    mean:outcomes.reduce((a,b)=>a+b,0)/outcomes.length,
    median:outcomes[Math.floor((outcomes.length-1)*.5)],
    p95:outcomes[Math.floor((outcomes.length-1)*.95)]};
}
function metric(label,value){return '<div class="ol-metric"><small>'+label+'</small><b>'+value+'</b></div>'}
function calculate(){
  const output=one('[data-ol-calculation]');
  try{
    const goal=targets();
    const withCurrent=one('[data-ol-use-current]').checked;
    const pieces=Number(one('[data-ol-piece-count]').value)||1;
    if(withCurrent&&pieces!==1)throw Error('현재 장비 옵션과 잠금을 이용한 기대값은 1부위에서만 계산할 수 있습니다.');
    if(withCurrent&&(candidate||!gear[0].k))throw Error('현재 장비를 기준으로 계산하려면 먼저 효과 변경 결과를 확정한 개조 장비가 필요합니다.');
    const start=withCurrent?copy(gear):[blank(),blank(),blank()];
    const already=withCurrent&&valid(start,goal,mode);
    const p=exactProbability(goal,mode,start);
    const currentLocks=start.filter(r=>r.lock).length;
    const expected=already?0:p?(1+currentLocks)/p:Infinity;
    const trial=already?{success:1600,mean:0,median:0,p95:0}:p>0?automaticLockEstimate(goal,mode,start,1600):null;
    const percent=(100*p).toFixed(p<.0001?6:p<.001?4:2)+'%';
    const totalExpected=expected*pieces;
    const completedAll=trial && trial.success===1600;
    output.innerHTML='<div class="ol-output"><h3>'+(already?'현재 목표 달성':p?fmt(totalExpected)+'개':'달성 불가')+'</h3>'+
      '<p class="ol-muted">각 장비에 동일 목표를 적용한 '+pieces+'부위 기대 모듈 합계입니다. 현재 잠금 유지 전략이며 신규 잠금·최초 개조 비용 제외.</p>'+
      '<div class="ol-grid">'+metric('1회 목표 달성 확률',percent)+metric('평균 시도 횟수',fmt(already?0:p?pieces/p:Infinity)+'회')+
        metric('잠금 유지 기대 모듈',fmt(totalExpected)+'개')+'</div>'+
      (trial?'<h3 style="font-size:15px;margin:17px 0 8px">성공 옵션 자동 잠금 · 시뮬레이션</h3>'+
        '<div class="ol-grid">'+metric('추정 합계 평균',completedAll?fmt(trial.mean*pieces)+'개':'산출 보류')+
        metric('1부위 중앙값',fmt(trial.median)+'개')+metric('1부위 95% 완료',fmt(trial.p95)+'개')+'</div>'+
        '<p class="ol-muted">1,600회 중 '+trial.success+'회 완료. '+(completedAll?'동일 목표 부위 수에 비례한 예상 평균입니다. ':'미완료 표본이 있으므로 평균은 표시하지 않습니다. ')+'옵션 자동 잠금의 단순 시뮬레이션으로 잠금 비용 포함 · 최적 전략 아님.</p>':
        '<p class="ol-alert">잠긴 옵션이 목표와 충돌하거나 목표 달성이 불가능합니다. 현재 잠금과 줄 조건을 바꿔 보세요.</p>')+
      '<p class="ol-muted">이 계산은 옵션 종류만 목표로 합니다. T단계 최소치, 잠금 방식의 전역 최적화는 포함되지 않습니다.</p></div>';
  }catch(e){output.innerHTML='<div class="ol-alert">'+esc(e.message||'계산 실패')+'</div>'}
}
function calculateTier(){
  const output=one('[data-ol-tier-result]');
  const current=Number(one('[data-ol-current-tier]').value);
  const minimum=Number(one('[data-ol-target-tier]').value);
  const nLocked=Number(one('[data-ol-tier-locks]').value);
  if(current>=minimum){
    output.innerHTML='<div class="ol-output"><h3>0개</h3><p class="ol-muted">현재 수치가 이미 목표 단계 이상입니다.</p></div>';return;
  }
  // Under the 2026 duplicate-result rule, repeating the exact previous tier is excluded.
  const chance=tiers.slice(minimum-1).reduce((a,b)=>a+b,0)/(100-tiers[current-1]);
  const expectedRolls=1/chance;
  const expectedModules=expectedRolls*(1+nLocked);
  output.innerHTML='<div class="ol-output"><h3>'+fmt(expectedModules)+'개</h3>'+
    '<p class="ol-muted">다른 줄 '+nLocked+'줄 잠금 유지 · 매번 T'+minimum+' 이상이 나올 때까지 수치 재설정</p>'+
    '<div class="ol-grid">'+metric('1회 성공 확률',(chance*100).toFixed(3)+'%')+
    metric('평균 재설정 횟수',fmt(expectedRolls)+'회')+
    metric('평균 모듈',fmt(expectedModules)+'개')+'</div>'+
    '<p class="ol-muted">현재 T'+current+'을 다시 뽑을 확률을 제거한 조건부 확률이며, 결과가 불리하면 기존 수치를 유지한다고 가정합니다.</p></div>';
}
function preset(key){
  one('[data-ol-goal="a"]').value=key==='clear'?'':'ele';
  one('[data-ol-goal="b"]').value=key==='clear'?'':'atk';
  all('[data-ol-alt]').forEach(ch=>ch.checked=key==='triple'&&['ammo','crit','critd'].includes(ch.dataset.olAlt));
  one('[data-ol-calculation]').innerHTML='';
}
panel.addEventListener('click',ev=>{
  const btn=ev.target.closest('button');if(!btn)return;
  const page=btn.dataset.olPageBtn;
  if(page){all('[data-ol-page]').forEach(node=>node.hidden=node.dataset.olPage!==page);all('[data-ol-page-btn]').forEach(node=>node.setAttribute('aria-selected',String(node.dataset.olPageBtn===page)));return}
  if(btn.hasAttribute('data-ol-first')){
    if(candidate)return;
    if(gear[0].k&&!confirm('기존 옵션을 버리고 장비를 다시 최초 개조할까요?'))return;
    gear=rerollEffects([blank(),blank(),blank()],true);modules++;attempts++;render();return;
  }
  if(btn.hasAttribute('data-ol-effects')){doRoll('effect');return}
  if(btn.hasAttribute('data-ol-values')){doRoll('values');return}
  if(btn.hasAttribute('data-ol-lock')){
    if(candidate)return;
    const i=Number(btn.dataset.olLock);if(!gear[i]||!gear[i].k)return;
    if(gear[i].lock){gear[i].lock=false}else if(locks()<2){modules+=2+locks();gear[i].lock=true;}
    render();return;
  }
  if(btn.hasAttribute('data-ol-accept')){if(candidate){gear=candidate;candidate=null;render()}return}
  if(btn.hasAttribute('data-ol-reject')){candidate=null;render();return}
  if(btn.hasAttribute('data-ol-reset')){
    if(modules&&!confirm('시뮬레이션 사용 모듈과 현재 장비를 모두 초기화할까요?'))return;
    gear=[blank(),blank(),blank()];candidate=null;modules=0;attempts=0;render();return;
  }
  if(btn.hasAttribute('data-ol-preset')){preset(btn.dataset.olPreset);return}
  if(btn.hasAttribute('data-ol-calculate')){calculate();return}
  if(btn.hasAttribute('data-ol-tier-calc')){calculateTier();return}
});
panel.addEventListener('change',ev=>{
  if(ev.target.name!=='ol-target-mode')return;
  mode=ev.target.value==='fixed'?'fixed':'any';
  one('[data-ol-goal-label="a"]').textContent=mode==='fixed'?'1번 줄 필수 옵션':'필수 옵션 1';
  one('[data-ol-goal-label="b"]').textContent=mode==='fixed'?'2번 줄 필수 옵션':'필수 옵션 2';
  one('[data-ol-goal-label="c"]').textContent=mode==='fixed'?'3번 줄: 아래 옵션 중 하나':'세 번째 조건: 체크한 옵션 중 하나라도 있으면 성공 (선택하지 않으면 세 번째 조건 없음)';
  one('[data-ol-calculation]').innerHTML='';
});
const previous=window.switchMainView;
window.switchMainView=function(view){
  const response=previous.apply(this,arguments);
  const active=view==='overload';
  document.body.classList.toggle('overload-view',active);
  panel.hidden=!active;
  if(active){
    document.querySelectorAll('.main-view-nav').forEach(n=>n.classList.toggle('active',n.dataset.view==='overload'));
    const title=document.getElementById('pageTitle');if(title)title.textContent='오버로드 연구실';
  }
  return response;
};
window.NIKKE_OL_TEST_MODEL=Object.freeze({effects,rates,tiers,exactProbability,rerollEffects,rerollValues,valid});
render();
})();
