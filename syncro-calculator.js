/* NIKKE Gear Manager test site: Synchro level calculator */
(function syncroCalculatorApp(){
  "use strict";
  const SOURCE=window.NIKKE_SYNCRO_SOURCE;
  const root=document.getElementById("syn-app");
  if(!SOURCE||!root){document.body.insertAdjacentHTML("afterbegin","<p>계산기 데이터를 불러오지 못했습니다. 새로고침해 주세요.</p>");return;}
  const names=["코어더스트","배틀데이터","크레딧"];
  const currencyNames=["코더","배데","크레딧"];
  const storageKey="nikke-syncro-calc-test-v1";
  const clone=x=>JSON.parse(JSON.stringify(x));
  const fmt=(n,d=0)=>Number.isFinite(+n)?new Intl.NumberFormat("ko-KR",{maximumFractionDigits:d}).format(+n):"-";
  const safe=n=>Number.isFinite(+n)?+n:0;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateByDay=(date,day)=>{const a=String(date).split("-").map(Number);const d=new Date(Date.UTC(a[0]||2026,(a[1]||10)-1,a[2]||28));d.setUTCDate(d.getUTCDate()+day-1);return d;};
  const dateTxt=d=>d.toISOString().slice(0,10);
  const defaults=()=>Object.assign(clone(SOURCE.defaults),{daily:clone(SOURCE.daily),packages:clone(SOURCE.packages)});
  // Yellow background cells in the original spreadsheet:
  // Input B5:B9, B13:D14, B16, A31:A42; Results A28:A36, F30, F31, F36.
  const allowedPackageChoices=new Set([2,3,8]);
  // Only display is reordered. SOURCE.packages remains index-stable for calculations.
  const packageDisplayOrder=[8,1,2,0,4,5,6,7,3];
  const packageDisplayNames=[
    "월간 더블업 더블 업 패키지",
    "이벤트 패키지",
    "월간 커스텀 패키지 1",
    "월간 커스텀 패키지 2",
    "주간 코어 더스트 세트",
    "일일 코어 더스트 팩",
    "일일 배틀 데이터 팩",
    "일일 퍼펙트 부스트 팩",
    "월정액 2"
  ];
  const editableKeys=new Set(["current","goal","outpost","sweep","date","subtractOwned"]);
  let state=defaults();
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey));
    if(saved&&typeof saved==="object"){
      // Rebuild fixed rules from the original data even when an older site version
      // saved changes to non-yellow cells (prices, hours, schedules, ratios).
      for(const key of ["current","goal","outpost","sweep"]){
        if(Number.isFinite(Number(saved[key])))state[key]=Number(saved[key]);
      }
      if(typeof saved.date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(saved.date))state.date=saved.date;
      if(typeof saved.subtractOwned==="boolean")state.subtractOwned=saved.subtractOwned;
      for(const key of ["ownedHours","ownedUnits"]){
        if(Array.isArray(saved[key])&&saved[key].length===3)
          state[key]=saved[key].map(value=>Math.max(0,safe(value)));
      }
      if(Array.isArray(saved.daily)&&saved.daily.length===state.daily.length)
        state.daily.forEach((row,i)=>{if(typeof saved.daily[i]?.on==="boolean")row.on=saved.daily[i].on;});
      if(Array.isArray(saved.packages)&&saved.packages.length===state.packages.length)
        state.packages.forEach((row,i)=>{
          if(typeof saved.packages[i]?.on==="boolean")row.on=saved.packages[i].on;
          if(allowedPackageChoices.has(i)&&[0,1,2].includes(Number(saved.packages[i]?.choice)))
            row.choice=Number(saved.packages[i].choice);
        });
    }
  }catch(e){}
  // Replace legacy editable non-yellow data with fixed source values.
  try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(e){}
  const field=(caption,key,min,max,step="1")=>`<label class="syn-field">${caption}<input data-key="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${safe(state[key])}"></label>`;
  function pkgGrantH(p){
    if(safe(p.choice)>=0 && p.choice!==-1 && Number.isInteger(+p.choice)){
      const index=+p.choice, arr=[0,0,0];if(index<3)arr[index]=safe(p.baseH)*safe(state.ratios[index]);return arr;
    }
    return Array.isArray(p.h)?p.h.map(safe):[0,0,0];
  }

  function enforcePackageEditPolicy(){
    const table=root.querySelector(".syn-package-list");
    if(!table||typeof table.querySelectorAll!=="function")return;
    const controls=table.querySelectorAll("input, select, textarea, button");
    for(const control of controls){
      const idx=Number(control.dataset.package);
      const yellow=control.dataset.yellowCell==="true";
      const validIndex=Number.isInteger(idx)&&idx>=0&&idx<9;
      const isCheckbox=control.tagName==="INPUT"&&control.type==="checkbox"&&control.dataset.field==="on";
      const isChoice=control.tagName==="SELECT"&&control.dataset.field==="choice"&&allowedPackageChoices.has(idx);
      if(!(yellow&&validIndex&&(isCheckbox||isChoice))){
        control.disabled=true;
        control.setAttribute("aria-disabled","true");
      }
    }
  }
  function render(){
    root.innerHTML=`
    <div class="syn-wrap">
      <h1 class="syn-sr-only">싱크로 레벨업 계산기</h1>
      <div class="syn-utility">
        <span class="syn-utility-note">구글 시트 계산 규칙 기준 · 전초기지 1~800레벨 · 최대 싱크로 1000레벨</span>
        <div class="syn-actions"><button class="syn-btn" id="syn-reset" type="button">입력값 초기화</button></div>
      </div>
      <div id="syn-output">
        <div class="syn-top-grid">
          <section class="syn-box syn-input-panel">
            <div class="syn-box-head">1. 싱크로 정보 입력</div>
            <div class="syn-box-body">
              <div class="syn-form">
                ${field("현재 싱크로 레벨","current",200,999)}
                ${field("목표 싱크로 레벨","goal",201,1000)}
                ${field("전초기지 레벨","outpost",1,800)}
                ${field("단기섬멸 횟수 / 일","sweep",1,11)}
                <label class="syn-field">시작 날짜<input type="date" data-key="date" value="${escape(state.date)}"></label>
              </div>
              <p class="syn-hint">현재 레벨 다음 단계부터 목표 레벨까지 계산 · 단기섬멸 1회 = 2시간</p>
            </div>
          </section>
          <section class="syn-highlight syn-result-panel" aria-label="목표 달성 예상">
            <div class="sub">전체 목표 달성 예상</div>
            <div class="big" id="syn-overall-date">-</div>
            <div class="foot" id="syn-overall-days">-</div>
          </section>
          <section class="syn-highlight syn-result-panel" aria-label="목표 달성까지 과금액">
            <div class="sub">목표 달성까지 패키지 과금액</div>
            <div class="big" id="syn-overall-cost">-</div>
            <div class="foot" id="syn-overall-sub">선택한 패키지만 계산</div>
          </section>
        </div>
      </div>
      <div class="syn-detail-grid">
        <section class="syn-box syn-owned-panel" aria-label="보유 재화 입력 및 차감">
          <div class="syn-box-head">2. 보유 재화 입력 및 차감</div>
          <div class="syn-box-body">
            <label class="syn-check"><input type="checkbox" data-key="subtractOwned" ${state.subtractOwned?"checked":""}>보유 재화를 필요량에서 차감</label>
            <p class="syn-hint" id="syn-hourly">전초기지 시간당 생산량</p>
            <div class="syn-wealth">
              ${names.map((name,j)=>`<div class="syn-wealth-card">
                <div class="syn-wealth-title">${name}</div>
                <label class="syn-field">보유 재화 상자(h)<input type="number" min="0" step="any" data-owned="ownedHours" data-index="${j}" value="${safe(state.ownedHours[j])}"></label>
                <label class="syn-field">보유 재화(낱개)<input type="number" min="0" step="any" data-owned="ownedUnits" data-index="${j}" value="${safe(state.ownedUnits[j])}"></label>
                <div class="syn-hint" id="syn-owned-${j}">-</div>
              </div>`).join("")}
            </div>
          </div>
        </section>
        <section class="syn-box syn-package-panel" aria-label="과금 패키지 선택">
          <div class="syn-box-head">3. 과금 패키지</div>
          <div class="syn-box-body">
            <div class="syn-package-list">
              ${packageDisplayOrder.map(i=>{
                const p=state.packages[i],displayName=packageDisplayNames[i];
                return `<div class="syn-package-item ${allowedPackageChoices.has(i)?"syn-has-choice":"syn-no-choice"}">
                  <label class="syn-package-toggle">
                    <input type="checkbox" aria-label="${escape(displayName)} 사용" data-yellow-cell="true" data-package="${i}" data-field="on" ${p.on?"checked":""}>
                    <span>${escape(displayName)}</span>
                  </label>
                  ${allowedPackageChoices.has(i)
                    ? `<select class="syn-cell-input syn-select syn-package-select" aria-label="${escape(displayName)} 선택 재화" data-yellow-cell="true" data-package="${i}" data-field="choice">
                      ${["코더","배데","크레딧"].map((name,j)=>`<option value="${j}" ${+p.choice===j?"selected":""}>${name}</option>`).join("")}
                    </select>`
                    : ""}
                </div>`;
              }).join("")}
            </div>
          </div>
        </section>
      </div>
      <section class="syn-box syn-daily-panel syn-daily-wide" aria-label="일일 재화 수급 항목 선택">
        <div class="syn-box-head">4. 일일 재화 수급</div>
        <div class="syn-box-body">
          <div class="syn-daily-list">
            ${state.daily.map((r,i)=>`<label class="syn-daily-item">
              <input type="checkbox" aria-label="${escape(r.name)} 사용" data-daily="${i}" data-field="on" ${r.on?"checked":""}>
              <span>${escape(r.name)}</span>
            </label>`).join("")}
          </div>
        </div>
      </section>
      <div class="syn-resource-cards" id="syn-resource-cards"></div>
      <p class="syn-progress-explain">진행률 막대 = 보유 재화 ÷ 전체 필요 재화 (100% 상한). 보유 재화 차감 설정과 별개로 현재 보유량을 표시합니다.</p>
      <details class="syn-box"><summary>5. 구간별 필요 재화 세부표</summary><div class="syn-box-body syn-result-detail"><div class="syn-table-wrap"><table class="syn-table"><thead><tr><th>레벨 구간</th><th>적용 횟수</th><th>필요 코더</th><th>필요 배데</th><th>필요 크레딧</th></tr></thead>
        <tbody id="syn-band-table"></tbody></table></div></div></details>
      <div class="syn-status" id="syn-status">계산 중...</div>
      <div class="syn-note">자료 기준: 싱크로 레벨업 계산기 (2026-10-28) · 설정은 이 브라우저의 테섭 저장 공간에만 보관됩니다. 원본 구글 시트는 수정하지 않습니다.</div>
    </div>`;
    enforcePackageEditPolicy();
    update();
  }
  function calculate(){
    const level=Math.min(999,Math.max(200,Math.trunc(safe(state.current))));
    const goal=Math.min(1000,Math.max(201,Math.trunc(safe(state.goal))));
    const outpost=Math.min(800,Math.max(1,Math.trunc(safe(state.outpost))));
    const rate=SOURCE.rates[outpost-1];
    const bands=SOURCE.bands.map(b=>({start:b.start,end:b.end,need:b.need,qty:Math.max(0,Math.min(goal,b.end)-Math.max(level+1,b.start)+1)}));
    const total=[0,0,0];bands.forEach(b=>{for(let j=0;j<3;j++)total[j]+=b.qty*safe(b.need[j]);});
    const owned=state.ownedHours.map((h,i)=>safe(h)*rate[i]+safe(state.ownedUnits[i]));
    const needed=total.map((v,i)=>Math.max(0,v-(state.subtractOwned?owned[i]:0)));
    const daily=[0,0,0], dailyRows=[];
    for(const r of state.daily){
      const row=[0,0,0];
      for(let j=0;j<3;j++){
        const hours=r.name==="단기섬멸"?safe(state.sweep)*2:safe(r.h[j]);
        row[j]=r.on?(hours*rate[j]+safe(r.fixed[j]))/Math.max(.0000001,safe(r.period)):0;
        daily[j]+=row[j];
      }
      dailyRows.push(row);
    }
    const grants=state.packages.map(p=>pkgGrantH(p).map((h,j)=>h*rate[j]+(j===0?safe(p.coreFixed):0)));
    const reached=[null,null,null],acc=[0,0,0],count=state.packages.map(()=>0);
    let spent=0,completeDay=null,subExpiry=0;
    for(let day=1;day<=1500;day++){
      const previousReached=acc.map((n,j)=>n>=needed[j]);
      const when=dateByDay(state.date,day);
      const weekday=when.getUTCDay()||7, monthDay=when.getUTCDate();
      let subToday=false;
      for(let k=0;k<state.packages.length;k++){
        const p=state.packages[k], gr=grants[k];if(!p.on)continue;
        const relevant=gr.some((v,j)=>v>0&&!previousReached[j]);
        if(p.cycle==="월정액"){
          if(relevant && day>subExpiry){
            count[k]++;spent+=safe(p.price);subExpiry=day+Math.max(1,Math.trunc(safe(state.subscriptionDays)))-1;
          }
          if(day<=subExpiry)subToday=true;
          continue;
        }
        if(!relevant)continue;
        const scheduled=p.cycle==="일일"||
          p.cycle==="주간"&&weekday===safe(state.weeklyDay)||
          p.cycle==="월간"&&monthDay===safe(state.monthlyDay);
        if(scheduled){
          count[k]++;spent+=safe(p.price);for(let j=0;j<3;j++)acc[j]+=gr[j];
        }
      }
      for(let j=0;j<3;j++)acc[j]+=daily[j]+(subToday?grants[8][j]:0);
      for(let j=0;j<3;j++)if(reached[j]===null && acc[j]>=needed[j]-1e-7)reached[j]=day;
      if(reached.every(d=>d!==null)){completeDay=day;break;}
    }
    return {level,goal,outpost,rate,bands,total,owned,needed,daily,dailyRows,grants,reached,count,spent,completeDay};
  }
  function el(id){return document.getElementById(id);}
  function update(){
    const c=calculate();
    el("syn-overall-date").textContent=c.completeDay===null?"1500일 내 미도달":dateTxt(dateByDay(state.date,c.completeDay));
    el("syn-overall-days").textContent=c.completeDay===null?"수급 설정을 조정해 주세요":`${fmt(c.completeDay)}일 소요 · ${fmt(c.goal-c.level)}레벨 상승`;
    el("syn-overall-cost").textContent=fmt(c.spent)+"원";
    el("syn-overall-sub").textContent="활성화된 패키지 구매 기준 · 목표 달성까지 합산";
    el("syn-hourly").textContent=`전초기지 ${c.outpost}레벨 · 시간당 코더 ${fmt(c.rate[0],2)}, 배데 ${fmt(c.rate[1],2)}, 크레딧 ${fmt(c.rate[2],2)}`;
    el("syn-resource-cards").innerHTML=names.map((name,j)=>{
      const ratio=c.total[j]>0?Math.min(100,100*c.owned[j]/c.total[j]):100;
      return `<article class="syn-resource"><div class="title">${name}</div><div class="date">${c.reached[j]===null?"1500일 내 미도달":dateTxt(dateByDay(state.date,c.reached[j]))}</div>
        <div class="metric"><span>소요 기간</span><strong>${c.reached[j]===null?"미도달":fmt(c.reached[j])+"일"}</strong></div>
        <div class="metric"><span>총 필요 재화</span><strong>${fmt(c.total[j])}</strong></div>
        <div class="metric"><span>보유 차감 후</span><strong>${fmt(c.needed[j])}</strong></div>
        <div class="metric"><span>일일 기본 수급</span><strong>${fmt(c.daily[j])}</strong></div>
        <div class="syn-progress-caption"><span>보유 재화 충족률</span><strong>${fmt(ratio,1)}%</strong></div>
        <div class="syn-bar" role="progressbar" aria-label="${name} 보유 재화 충족률" aria-valuenow="${Math.round(ratio)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.max(0,ratio)}%"></span></div>
      </article>`;
    }).join("");
    for(let j=0;j<3;j++){
      el("syn-owned-"+j).textContent="낱개 환산: "+fmt(c.owned[j]);
    }
    el("syn-band-table").innerHTML=c.bands.filter(b=>b.qty).map(b=>`<tr><td>${b.start}~${b.end}</td><td>${fmt(b.qty)}</td>${[0,1,2].map(j=>`<td>${fmt(b.qty*safe(b.need[j]))}</td>`).join("")}</tr>`).join("")||
      '<tr><td colspan="5">현재 레벨과 목표 레벨을 확인해 주세요.</td></tr>';
    const status=el("syn-status");
    if(c.goal<=c.level){status.classList.add("warn");status.textContent="목표 레벨은 현재 레벨보다 높아야 해요.";}
    else if(c.completeDay===null){status.classList.add("warn");status.textContent="1500일 이내에 목표에 도달하지 못해요. 기본 수급량이나 패키지 설정을 확인해 주세요.";}
    else{status.classList.remove("warn");status.textContent="원본 시트의 레벨별 비용·시간당 생산량·일일 수급·패키지 지급 규칙을 반영한 예상 결과입니다. 구매 조건과 재화 수급 가정이 실제 게임과 다르면 결과도 달라질 수 있어요.";}
  }
  function onEdit(e){
    const x=e.target;if(!x.dataset)return;
    if(x.dataset.key){
      const k=x.dataset.key;
      if(!editableKeys.has(k))return;
      state[k]=x.type==="checkbox"?Boolean(x.checked):x.type==="date"?x.value:safe(x.value);
      if(["current","goal"].includes(k))state[k]=Math.trunc(state[k]);
    }else if(x.dataset.owned){
      const i=Number(x.dataset.index);
      if(!["ownedHours","ownedUnits"].includes(x.dataset.owned)||![0,1,2].includes(i))return;
      state[x.dataset.owned][i]=Math.max(0,safe(x.value));
    }else if(x.dataset.daily!==undefined){
      const i=Number(x.dataset.daily);
      if(x.dataset.field!=="on"||!Number.isInteger(i)||i<0||i>=state.daily.length)return;
      state.daily[i].on=Boolean(x.checked);
    }else if(x.dataset.package!==undefined){
      if(x.dataset.yellowCell!=="true")return;
      const i=Number(x.dataset.package),key=x.dataset.field;
      if(!Number.isInteger(i)||i<0||i>=state.packages.length)return;
      if(key==="on")state.packages[i].on=Boolean(x.checked);
      else if(key==="choice"&&allowedPackageChoices.has(i)&&[0,1,2].includes(Number(x.value)))
        state.packages[i].choice=Number(x.value);
      else return;
    }else return;
    if(e.type==="change"){
      if(x.dataset.key==="current")x.value=state.current=Math.min(999,Math.max(200,Math.trunc(state.current)));
      if(x.dataset.key==="goal")x.value=state.goal=Math.min(1000,Math.max(201,Math.trunc(state.goal)));
      if(x.dataset.key==="outpost")x.value=state.outpost=Math.min(800,Math.max(1,Math.trunc(state.outpost)));
      if(x.dataset.key==="sweep")x.value=state.sweep=Math.min(11,Math.max(1,Math.trunc(state.sweep)));
    }
    try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(e){}
    update();
  }
  root.addEventListener("input",onEdit);
  root.addEventListener("change",onEdit);
  root.addEventListener("click",e=>{
    if(e.target.id==="syn-reset"){
      if(!confirm("싱크로 계산기의 입력값과 체크 상태를 원본 시트 기본값으로 초기화할까요?"))return;
      state=defaults();try{localStorage.removeItem(storageKey);}catch(e){}render();
    }
  });
  render();
})();
