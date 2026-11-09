/* TEST SERVER ONLY — Manual overload equipment expectation calculator.
 * Current equipment is manually entered; no synced account data is used or changed.
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
const partNames=['머리','갑옷','장갑','신발'];
const storageKey='nikke-ol-current-goals-v1';
const nav=document.querySelector('.sidebar .nav');
const main=document.querySelector('main.main')||document.querySelector('main');
if(!nav||!main||typeof window.switchMainView!=='function')return;
const css="\n#overloadPanel[hidden],#overloadPanel [hidden]{display:none!important}\nbody.overload-view .main>:not(#overloadPanel):not(.topbar):not(#settingsPopover){display:none!important}\nbody.overload-view .main>.topbar{display:none!important}\nbody.overload-view #overloadPanel{display:block!important}\n#overloadPanel{box-sizing:border-box;max-width:1450px;width:100%;margin:14px auto 35px;padding:0 12px;color:#273b51}\n#overloadPanel *{box-sizing:border-box}\n#overloadPanel button,#overloadPanel select,#overloadPanel input{font:inherit}\n#overloadPanel button{cursor:pointer}\n#overloadPanel [hidden]{display:none!important}\n#overloadPanel .ol-head h2{font-size:26px;font-weight:1000;margin:0}\n#overloadPanel .ol-lead,#overloadPanel .ol-muted{font-size:12px;color:#70829a;line-height:1.6;margin:7px 0 12px}\n#overloadPanel .ol-layout{display:grid;grid-template-columns:minmax(0,1.16fr) minmax(0,1fr);gap:13px;align-items:start}\n#overloadPanel .ol-card{background:#fff;border:1px solid #d6e2ed;border-radius:12px;padding:16px;margin-bottom:13px;min-width:0;box-shadow:0 3px 12px rgba(20,50,80,.05)}\n#overloadPanel .ol-card h3{font-size:17px;font-weight:1000;color:#24658e;margin:0 0 9px}\n#overloadPanel .ol-current-grid{display:block}\n#overloadPanel .ol-piece{border:1px solid #dce7f1;border-radius:9px;background:#f6faff;padding:10px;min-width:0}\n#overloadPanel .ol-piece.is-excluded{opacity:.5}\n#overloadPanel .ol-piece-head{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-bottom:8px}\n#overloadPanel .ol-piece-head label{display:flex;gap:5px;align-items:center;font-size:13px;color:#24658e;font-weight:950}\n#overloadPanel .ol-clear{background:transparent;border:none;color:#647f95;font-size:10px;text-decoration:underline;padding:3px}\n#overloadPanel .ol-input-line{display:grid;grid-template-columns:30px minmax(0,1fr) 48px;align-items:center;gap:4px;margin-bottom:5px}\n#overloadPanel .ol-input-line:last-child{margin-bottom:0}\n#overloadPanel .ol-line-no{font-size:11px;font-weight:900}\n#overloadPanel select{width:100%;min-width:0;border:1px solid #c6d9e9;border-radius:7px;padding:7px 5px;font-size:11px;background:#fff;color:#273e52}\n#overloadPanel .ol-lock-label{display:flex;align-items:center;justify-content:end;gap:2px;font-size:10px;white-space:nowrap}\n#overloadPanel .ol-controls{display:flex;gap:10px;flex-wrap:wrap;margin:11px 0;font-size:12px;font-weight:850}\n#overloadPanel .ol-controls label{display:inline-flex;align-items:center;gap:4px}\n#overloadPanel .ol-targets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}\n#overloadPanel .ol-targets label{display:block;font-size:12px;font-weight:900;margin-bottom:6px}\n#overloadPanel .ol-alt{display:flex;flex-wrap:wrap;gap:5px;margin:9px 0}\n#overloadPanel .ol-alt label{padding:7px;background:#f7fbff;border:1px solid #d6e2ec;border-radius:7px;font-size:11px;display:inline-flex;align-items:center;gap:4px}\n#overloadPanel .ol-actions{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}\n#overloadPanel .ol-btn{border:1px solid #bfdae9;background:#f2f9fd;color:#24759d;border-radius:8px;padding:9px 10px;font-size:11px;font-weight:900}\n#overloadPanel .ol-btn.primary{background:#178fc6;border-color:#117ead;color:#fff}\n#overloadPanel .ol-btn.big{width:100%;font-size:14px;padding:12px}\n#overloadPanel .ol-result-area{width:100%;max-width:100%;min-width:0;margin:0 0 13px;overflow-wrap:anywhere}\n#overloadPanel .ol-output{width:100%;max-width:100%;min-width:0;padding:13px;background:#eef9ff;border:1px solid #b9d9ee;border-radius:9px;overflow-wrap:anywhere}\n#overloadPanel .ol-output h3{font-size:23px;font-weight:950;color:#116f9a;margin:0}\n#overloadPanel .ol-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:11px 0}\n#overloadPanel .ol-metric{padding:9px;border:1px solid #d6e6f0;background:#fff;border-radius:8px}\n#overloadPanel .ol-metric small{display:block;color:#72899b;font-size:10px}\n#overloadPanel .ol-metric b{font-size:18px;display:block;margin-top:4px}\n#overloadPanel .ol-table-scroll{width:100%;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}\n#overloadPanel .ol-results{width:100%;min-width:350px;table-layout:fixed;border-collapse:collapse;font-size:12px;margin:10px 0}\n#overloadPanel .ol-results th,#overloadPanel .ol-results td{padding:8px 4px;border-bottom:1px solid #cadce9;text-align:right}\n#overloadPanel .ol-results th:first-child,#overloadPanel .ol-results td:first-child{text-align:left}\n#overloadPanel .ol-results tfoot{font-weight:900}\n#overloadPanel .ol-alert{padding:11px;border:1px solid #e7d6a5;background:#fff8e7;color:#795a20;border-radius:9px;font-size:12px;line-height:1.65;margin:10px 0}\n#overloadPanel details>summary{font-size:15px;font-weight:950;color:#24658e;cursor:pointer}\n#overloadPanel .ol-tier-inputs{display:flex;gap:11px;flex-wrap:wrap;margin:12px 0}\n#overloadPanel .ol-tier-inputs label{display:flex;flex-direction:column;gap:6px;min-width:130px;flex:1;font-size:11px;font-weight:850}\n#overloadPanel .ol-sources a{color:#147cab;text-decoration:underline}\nhtml.dark-theme #overloadPanel{color:#e7f1ff}\nhtml.dark-theme #overloadPanel .ol-card{background:#16263b;border-color:#3a526c}\nhtml.dark-theme #overloadPanel .ol-card h3,html.dark-theme #overloadPanel details>summary,html.dark-theme #overloadPanel .ol-piece-head label{color:#9cdaff}\nhtml.dark-theme #overloadPanel .ol-lead,html.dark-theme #overloadPanel .ol-muted{color:#abc1d9}\nhtml.dark-theme #overloadPanel .ol-piece,html.dark-theme #overloadPanel .ol-alt label,html.dark-theme #overloadPanel .ol-metric{background:#20334b;border-color:#435a73;color:#e1edff}\nhtml.dark-theme #overloadPanel select{background:#22364e;border-color:#475f78;color:#eaf3ff}\nhtml.dark-theme #overloadPanel .ol-output{background:#173b54;border-color:#427eab;color:#dbf2ff}\nhtml.dark-theme #overloadPanel .ol-output h3{color:#a7e2ff}\nhtml.dark-theme #overloadPanel .ol-btn{background:#20334b;border-color:#435a73;color:#e1edff}\nhtml.dark-theme #overloadPanel .ol-btn.primary{background:#116e9b;color:#fff}\nhtml.dark-theme #overloadPanel .ol-alert{background:#332c1d;color:#ffe0a3;border-color:#806e44}\n@media(max-width:1050px){#overloadPanel .ol-layout{grid-template-columns:1fr}}\n@media(max-width:600px){#overloadPanel{padding:0 5px}#overloadPanel .ol-head h2{font-size:21px}#overloadPanel .ol-card{padding:10px}#overloadPanel .ol-current-grid{display:block}#overloadPanel .ol-targets{grid-template-columns:1fr}#overloadPanel .ol-grid{grid-template-columns:1fr}}\n";
const style=document.createElement('style');style.id='ol-test-style';style.textContent=css;document.head.appendChild(style);
const button=document.createElement('button');
button.type='button';button.className='main-view-nav';button.dataset.view='overload';button.textContent='오버로드 기대값 계산기';
button.addEventListener('click',()=>window.switchMainView('overload'));
const anchor=nav.querySelector('[data-view="syncro"]');
if(anchor)anchor.insertAdjacentElement('afterend',button);else nav.appendChild(button);
const panel=document.createElement('section');panel.id='overloadPanel';panel.hidden=true;
panel.innerHTML=[
  '<header class="ol-head"><h2>오버로드 모듈 기대값 계산기 <span style="font-size:12px;color:#2284ae">TEST</span></h2><p class="ol-lead">현재 옵션과 잠금을 왼쪽에 입력하고, 오른쪽에 원하는 효과를 선택해 필요한 모듈 기대값을 계산합니다.</p></header>',
  '<div class="ol-layout"><section class="ol-card"><h3>1. 내 현황</h3><p class="ol-muted">계산할 장비 부위를 하나 선택하고, 현재 효과가 있는 줄은 옵션을 선택하세요. 이미 잠근 줄은 잠금 체크를 합니다. 전부 빈 부위는 최초 개조부터 계산합니다.</p>',
  '<div class="ol-tier-inputs"><label>계산할 장비 부위<select data-ol-part-select>'+partNames.map(name=>'<option value="'+name+'">'+name+'</option>').join('')+'</select></label></div>',
  '<div class="ol-current-grid">'+partNames.map(name=>
     '<div class="ol-piece" data-ol-piece="'+name+'"><div class="ol-piece-head"><label>'+name+'</label><button type="button" class="ol-clear" data-ol-clear="'+name+'">초기화</button></div>'+
     [0,1,2].map(i=>'<div class="ol-input-line"><span class="ol-line-no">'+(i+1)+'줄</span><select data-ol-current="'+i+'" aria-label="'+name+' '+(i+1)+'줄 효과"></select><label class="ol-lock-label"><input type="checkbox" data-ol-lock="'+i+'" aria-label="'+name+' '+(i+1)+'줄 잠금">잠금</label></div>').join('')+'</div>'
   ).join('')+'</div><p class="ol-muted">한 번에 한 부위만 계산합니다. 부위별 입력값은 브라우저에 따로 저장되며, 계정 장비 데이터는 수정되지 않습니다.</p></section>',
  '<section class="ol-card"><h3>2. 원하는 효과 목표</h3>',
  '<div class="ol-controls"><label><input type="radio" name="ol-target-mode" value="any" checked> 순서 무관</label><label><input type="radio" name="ol-target-mode" value="fixed"> 줄 위치 지정</label></div>',
  '<div class="ol-targets"><div><label data-ol-goal-label="a">필수 옵션 1</label><select data-ol-goal="a"></select></div><div><label data-ol-goal-label="b">필수 옵션 2</label><select data-ol-goal="b"></select></div></div>',
  '<p class="ol-muted" data-ol-goal-label="c">추가 조건: 아래 효과 중 하나라도 있으면 성공 (선택 사항)</p><div class="ol-alt" data-ol-alts></div><p class="ol-muted">필수 옵션은 아래에서도 자동으로 체크되며, 추가 조건에 중복 계산되지 않습니다.</p>',
  '<div class="ol-actions"><button type="button" class="ol-btn" data-ol-preset="triple">우코 + 공증 + (장탄/크확/크뎀)</button><button type="button" class="ol-btn" data-ol-preset="double">우코 + 공증</button><button type="button" class="ol-btn" data-ol-preset="clear">목표 초기화</button></div>',
  '<button type="button" class="ol-btn primary big" data-ol-calculate>모듈 기대값 계산</button>',
  '<p class="ol-muted">선택한 장비 한 부위에만 목표를 적용합니다. 목표 효과가 발견되면 잠그는 전략과 기존 잠금만 유지하는 전략을 비교합니다.</p></section></div>',
  '<section class="ol-result-area" data-ol-calculation aria-live="polite"></section>',
  '<details class="ol-card"><summary>수치 재설정(T단계) 기대값</summary><p class="ol-muted">원하는 효과를 이미 갖고 있는 상태에서 수치만 높이는 경우의 기대값입니다.</p>',
  '<div class="ol-tier-inputs"><label>현재 수치 단계<select data-ol-current-tier></select></label><label>목표 최소 단계<select data-ol-target-tier></select></label><label>다른 줄 잠금 수<select data-ol-tier-locks><option value="0">0줄 (1모듈/회)</option><option value="1">1줄 (2모듈/회)</option><option value="2">2줄 (3모듈/회)</option></select></label></div>',
  '<button type="button" class="ol-btn primary" data-ol-tier-calc>수치작 기대값 계산</button><div data-ol-tier-result aria-live="polite"></div></details>',
  '<details class="ol-card"><summary>확률 · 계산 기준</summary><div class="ol-alert">게임 내 공지된 확률과 비용이 다르면 게임 값을 우선하세요. 기대값은 평균일 뿐 결과를 보장하지 않습니다.</div>',
  '<p class="ol-muted"><b>줄 등장:</b> 1줄 100% · 2줄 50% · 3줄 30%, 줄별 독립 등장.</p>',
  '<p class="ol-muted"><b>효과 확률:</b> 우코·공증·크뎀·방어 각 10%, 장탄·명중·차뎀·차속·크확 각 12%. 같은 장비에는 중복 효과가 나오지 않습니다.</p>',
  '<p class="ol-muted"><b>모듈 비용:</b> 잠금 0/1/2줄의 변경비 1/2/3개, 새 영구 잠금 첫 줄 2개·둘째 줄 3개. 미개조 부위는 최초 개조비 1개 포함.</p>',
  '<p class="ol-muted"><b>자동 잠금 기대값:</b> 현재 옵션에서 목표와 맞는 줄을 최대 2줄까지 잠그고 나머지를 반복 변경합니다. 신규 잠금비는 포함하고 옵션의 T단계 목표는 제외합니다. 최적 전략 보장은 없습니다.</p>',
  '<p class="ol-muted"><b>잠금 유지 기대값:</b> 신규 잠금 없이 현재 잠금만 유지하며 반복 변경하는 이론 기대값입니다.</p>',
  '<p class="ol-muted ol-sources">참고: <a href="https://www.prydwen.gg/nikke/guides/overload-gear-reroll" target="_blank" rel="noopener noreferrer">Prydwen</a> · <a href="https://nikke.beomtachi.com/guides/overload-gear/" target="_blank" rel="noopener noreferrer">2026 개편</a></p></details>'
].join('');
main.appendChild(panel);
const one=sel=>panel.querySelector(sel);
const all=sel=>Array.from(panel.querySelectorAll(sel));
function optionHtml(){return '<option value="">옵션 없음</option>'+effects.map(e=>'<option value="'+e.k+'">'+e.n+' ('+e.w+'%)</option>').join('')}
all('[data-ol-goal],[data-ol-current]').forEach(select=>select.innerHTML=optionHtml());
all('[data-ol-current-tier],[data-ol-target-tier]').forEach(select=>{select.innerHTML=tiers.map((_,i)=>'<option value="'+(i+1)+'">T'+(i+1)+'</option>').join('')});
one('[data-ol-current-tier]').value='5';one('[data-ol-target-tier]').value='11';
one('[data-ol-goal="a"]').value='ele';one('[data-ol-goal="b"]').value='atk';
one('[data-ol-alts]').innerHTML=effects.map(e=>
  '<label><input type="checkbox" data-ol-alt="'+e.k+'"'+(['ammo','crit','critd'].includes(e.k)?' checked':'')+'> '+e.n+'</label>').join('');
// Manual alternatives are separate from required goals' automatic visual checks.
const manuallySelectedAlts=new Set(all('[data-ol-alt]:checked').map(ch=>ch.dataset.olAlt));
function currentRows(name){
  const node=one('[data-ol-piece="'+name+'"]');
  const rows=[0,1,2].map(i=>({
    k:node.querySelector('[data-ol-current="'+i+'"]').value||null,
    t:11,lock:node.querySelector('[data-ol-lock="'+i+'"]').checked
  }));
  const values=rows.filter(r=>r.k).map(r=>r.k);
  if(new Set(values).size!==values.length)throw Error(name+': 같은 효과를 두 줄에 중복 지정할 수 없습니다.');
  if(rows.some(r=>r.lock&&!r.k))throw Error(name+': 빈 줄을 잠글 수 없습니다.');
  if(rows.filter(r=>r.lock).length>2)throw Error(name+': 잠금은 최대 2줄입니다.');
  return rows;
}

function refreshInputs(){
  partNames.forEach(name=>{
    const node=one('[data-ol-piece="'+name+'"]');
    node.hidden=name!==one('[data-ol-part-select]').value;
    for(let i=0;i<3;i++){
      const k=node.querySelector('[data-ol-current="'+i+'"]').value;
      const lock=node.querySelector('[data-ol-lock="'+i+'"]');
      if(!k)lock.checked=false;
      lock.disabled=!k;
    }
  });
}
function refreshGoalLabels(){
  const fixed=one('[name="ol-target-mode"]:checked').value==='fixed';
  one('[data-ol-goal-label="a"]').textContent=fixed?'1줄 필수 효과':'필수 옵션 1';
  one('[data-ol-goal-label="b"]').textContent=fixed?'2줄 필수 효과':'필수 옵션 2';
  one('[data-ol-goal-label="c"]').textContent=fixed?'3줄: 아래 효과 중 하나':'추가 조건: 아래 효과 중 하나라도 있으면 성공 (선택 사항)';
}
function syncRequiredGoalChecks(changedGoal){
  const first=one('[data-ol-goal="a"]'),second=one('[data-ol-goal="b"]');
  // Duplicate required effects cannot occupy two different lines.
  if(first.value && first.value===second.value){
    if(changedGoal==='a')second.value='';
    else first.value='';
  }
  const required=new Set([first.value,second.value].filter(Boolean));
  all('[data-ol-alt]').forEach(ch=>{
    const isRequired=required.has(ch.dataset.olAlt);
    if(isRequired)manuallySelectedAlts.delete(ch.dataset.olAlt);
    ch.checked=isRequired||manuallySelectedAlts.has(ch.dataset.olAlt);
    ch.disabled=isRequired;
    ch.parentElement.classList.toggle('ol-alt-required',isRequired);
    ch.parentElement.title=isRequired?'필수 옵션으로 선택되어 자동 체크됨':'';
  });
}
function saveSettings(){
  const pieces=Object.fromEntries(partNames.map(name=>{
    const node=one('[data-ol-piece="'+name+'"]');
    return [name,{include:name===one('[data-ol-part-select]').value,
      lines:[0,1,2].map(i=>({k:node.querySelector('[data-ol-current="'+i+'"]').value,
        lock:node.querySelector('[data-ol-lock="'+i+'"]').checked}))}];
  }));
  const goal={a:one('[data-ol-goal="a"]').value,b:one('[data-ol-goal="b"]').value,
    alts:Array.from(manuallySelectedAlts),
    mode:one('[name="ol-target-mode"]:checked').value};
  try{localStorage.setItem(storageKey,JSON.stringify({pieces,goal,selectedPart:one('[data-ol-part-select]').value}))}catch(_){}
}
function restoreSettings(){
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(!saved||typeof saved!=='object')return;
    // Keep all saved piece configurations from the previous four-piece UI.
    one('[data-ol-part-select]').value=partNames.includes(saved.selectedPart)?saved.selectedPart:
      (partNames.find(name=>saved.pieces&&saved.pieces[name]&&saved.pieces[name].include===true)||partNames[0]);
    for(const name of partNames){
      const info=saved.pieces&&saved.pieces[name];
      if(!info||!Array.isArray(info.lines))continue;
      const node=one('[data-ol-piece="'+name+'"]');
      for(let i=0;i<3;i++){
        const value=info.lines[i]||{};
        node.querySelector('[data-ol-current="'+i+'"]').value=byKey.has(value.k)?value.k:'';
        node.querySelector('[data-ol-lock="'+i+'"]').checked=!!value.lock;
      }
    }
    const goal=saved.goal||{};
    if(goal.a===''||byKey.has(goal.a))one('[data-ol-goal="a"]').value=goal.a;
    if(goal.b===''||byKey.has(goal.b))one('[data-ol-goal="b"]').value=goal.b;
    if(Array.isArray(goal.alts)){
      manuallySelectedAlts.clear();
      goal.alts.filter(k=>byKey.has(k)).forEach(k=>manuallySelectedAlts.add(k));
    }
    if(goal.mode==='fixed')one('[name="ol-target-mode"][value="fixed"]').checked=true;
  }catch(_){}
}
restoreSettings();syncRequiredGoalChecks();refreshInputs();refreshGoalLabels();
function targets(){
  const a=one('[data-ol-goal="a"]').value,b=one('[data-ol-goal="b"]').value;
  // Automatically checked required effects must not count as optional OR goals.
  const c=all('[data-ol-alt]:checked:not(:disabled)').map(node=>node.dataset.olAlt);
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
function enumerateRolls(locked,visit){
  const rows=[blank(),blank(),blank()];
  const initial=new Set(locked.filter(r=>r.lock&&r.k).map(r=>r.k));
  function walk(i,used,p){
    if(i===3){visit(copy(rows),p);return}
    if(locked[i].lock){rows[i]={...locked[i]};walk(i+1,used,p);return}
    if(rates[i]!==1){rows[i]=blank();walk(i+1,used,p*(1-rates[i]))}
    const eligible=effects.filter(e=>!used.has(e.k));
    const total=eligible.reduce((n,e)=>n+e.w,0);
    for(const e of eligible){
      rows[i]={k:e.k,t:11,lock:false};
      const next=new Set(used);next.add(e.k);
      walk(i+1,next,p*rates[i]*e.w/total);
    }
  }
  walk(0,initial,1);
}
function lockTargets(rows,goal,m){
  const result=copy(rows),selected=bestMatches(rows,goal,m);
  let cost=0;
  for(const i of selected){
    const n=result.filter(r=>r.lock).length;
    if(n>=2)break;
    if(!result[i].lock&&result[i].k){result[i].lock=true;cost+=2+n}
  }
  return {rows:result,cost};
}
// Exact expected module cost of the greedy matching-option lock strategy.
// A newly found matching option is permanently locked (maximum two lines).
// Rerolls without a new lock are self-loops and are solved algebraically.
function expectedAutoLocks(goal,m,start,memo){
  if(valid(start,goal,m))return 0;
  const first=lockTargets(start,goal,m);
  function solve(locked){
    const key=locked.map((r,i)=>r.lock?i+':'+r.k:'-').join('|');
    if(memo.has(key))return memo.get(key);
    let unchanged=0,future=0;
    enumerateRolls(locked,(rows,p)=>{
      if(valid(rows,goal,m))return;
      const next=lockTargets(rows,goal,m);
      const nextKey=next.rows.map((r,i)=>r.lock?i+':'+r.k:'-').join('|');
      if(key===nextKey){unchanged+=p;return}
      future+=p*(next.cost+solve(next.rows));
    });
    const denominator=1-unchanged;
    const result=denominator>1e-12?(1+locked.filter(r=>r.lock).length+future)/denominator:Infinity;
    memo.set(key,result);return result;
  }
  return first.cost+solve(first.rows);
}
function metric(label,value){return '<div class="ol-metric"><small>'+label+'</small><b>'+value+'</b></div>'}
function calculate(){
  const output=one('[data-ol-calculation]');
  try{
    const goal=targets(),m=one('[name="ol-target-mode"]:checked').value;
    const name=one('[data-ol-part-select]').value;
    const start=currentRows(name),done=valid(start,goal,m);
    const p=exactProbability(goal,m,start);
    const locks=start.filter(r=>r.lock).length;
    const keep=done?0:p?(1+locks)/p:Infinity;
    const auto=done?0:expectedAutoLocks(goal,m,start,new Map());
    const count=n=>Number.isFinite(n)?fmt(n)+'개':'달성 불가';
    output.innerHTML='<div class="ol-output"><h3>'+count(auto)+'</h3>'+
      '<p class="ol-muted">'+esc(name)+' 장비 한 부위의 자동 잠금 전략 기준 예상 모듈 수입니다.'+(done?' 현재 목표를 이미 달성했습니다.':'')+'</p>'+
      '<div class="ol-grid">'+metric('자동 잠금 예상',count(auto))+metric('기존 잠금만 유지',count(keep))+'</div>'+
      '<p class="ol-muted">신규 잠금비 포함, 목표 T단계 제외. 옵션이 없는 부위는 최초 개조비 1개를 포함합니다. 목표 효과를 순차적으로 잠그는 단순 전략이며, 최적 전략을 보장하지 않습니다.</p></div>';
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
  manuallySelectedAlts.clear();
  if(key==='triple')['ammo','crit','critd'].forEach(k=>manuallySelectedAlts.add(k));
  syncRequiredGoalChecks();
  one('[data-ol-calculation]').innerHTML='';saveSettings();
}
panel.addEventListener('click',ev=>{
  const btn=ev.target.closest('button');if(!btn)return;
  if(btn.hasAttribute('data-ol-clear')){
    const node=one('[data-ol-piece="'+btn.dataset.olClear+'"]');
    node.querySelectorAll('[data-ol-current]').forEach(sel=>sel.value='');
    node.querySelectorAll('[data-ol-lock]').forEach(box=>box.checked=false);
    refreshInputs();saveSettings();one('[data-ol-calculation]').innerHTML='';return;
  }
  if(btn.hasAttribute('data-ol-preset')){preset(btn.dataset.olPreset);return}
  if(btn.hasAttribute('data-ol-calculate')){calculate();return}
  if(btn.hasAttribute('data-ol-tier-calc')){calculateTier();return}
});
panel.addEventListener('change',ev=>{
  const el=ev.target;
  if(el.hasAttribute('data-ol-lock')&&el.checked){
    const node=el.closest('[data-ol-piece]');
    if(node.querySelectorAll('[data-ol-lock]:checked').length>2){
      el.checked=false;
      one('[data-ol-calculation]').innerHTML='<div class="ol-alert">한 장비에서 잠글 수 있는 옵션은 최대 2줄입니다.</div>';
      refreshInputs();saveSettings();return;
    }
  }
  if(el.hasAttribute('data-ol-alt')){
    if(el.checked)manuallySelectedAlts.add(el.dataset.olAlt);
    else manuallySelectedAlts.delete(el.dataset.olAlt);
  }
  syncRequiredGoalChecks(el.getAttribute('data-ol-goal'));
  refreshInputs();refreshGoalLabels();saveSettings();
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
    const title=document.getElementById('pageTitle');if(title)title.textContent='오버로드 기대값 계산기';
  }
  return response;
};
window.NIKKE_OL_TEST_MODEL=Object.freeze({effects,rates,tiers,exactProbability,valid,expectedAutoLocks});
})();
