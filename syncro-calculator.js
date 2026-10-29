/* NIKKE Gear Manager test site: Synchro level calculator */
(function syncroCalculatorApp(){
  "use strict";
  const SOURCE=window.NIKKE_SYNCRO_SOURCE;
  const root=document.getElementById("syn-app");
  if(!SOURCE||!root){document.body.insertAdjacentHTML("afterbegin","<p>계산기 데이터를 불러오지 못했습니다. 새로고침해 주세요.</p>");return;}
  const names=["코어더스트","배틀데이터","크레딧"];
  const currencyNames=["코더","배데","크레딧"];
  const storageKey="nikke-syncro-calc-test-v4";
  const campaignStageCounts={"15":37,"16":33,"17":38,"18":40,"19":42,"20":41,"21":42,"22":43,"23":42,"24":44,"25":40,"26":42,"27":44,"28":43,"29":42,"30":42,"31":44,"32":45,"33":42,"34":46,"35":44,"36":45,"37":44,"38":45,"39":44,"40":44,"41":44,"42":44,"43":44,"44":44,"45":44,"46":44,"47":44,"48":44};
  const campaignMilestones=[{"mode":"normal","chapter":32,"level":221},{"mode":"normal","chapter":34,"level":231},{"mode":"normal","chapter":36,"level":241},{"mode":"normal","chapter":38,"level":251},{"mode":"normal","chapter":40,"level":281},{"mode":"normal","chapter":42,"level":301},{"mode":"normal","chapter":44,"level":321},{"mode":"normal","chapter":46,"level":331},{"mode":"normal","chapter":48,"level":341},{"mode":"hard","chapter":16,"level":241},{"mode":"hard","chapter":18,"level":261},{"mode":"hard","chapter":20,"level":281},{"mode":"hard","chapter":22,"level":301},{"mode":"hard","chapter":24,"level":321},{"mode":"hard","chapter":26,"level":341},{"mode":"hard","chapter":28,"level":350},{"mode":"hard","chapter":30,"level":361},{"mode":"hard","chapter":31,"level":381},{"mode":"hard","chapter":32,"level":461},{"mode":"hard","chapter":34,"level":481},{"mode":"hard","chapter":36,"level":501},{"mode":"hard","chapter":38,"level":521},{"mode":"hard","chapter":40,"level":581},{"mode":"hard","chapter":42,"level":601},{"mode":"hard","chapter":44,"level":621},{"mode":"hard","chapter":46,"level":641},{"mode":"hard","chapter":48,"level":681}];
  const boxDurations=[1,2,8,12,24];
  const clone=x=>JSON.parse(JSON.stringify(x));
  const fmt=(n,d=0)=>Number.isFinite(+n)?new Intl.NumberFormat("ko-KR",{maximumFractionDigits:d}).format(+n):"-";
  const safe=n=>Number.isFinite(+n)?+n:0;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateByDay=(date,day)=>{const a=String(date).split("-").map(Number);const d=new Date(Date.UTC(a[0]||2026,(a[1]||10)-1,a[2]||28));d.setUTCDate(d.getUTCDate()+day-1);return d;};
  const dateTxt=d=>d.toISOString().slice(0,10);
  // The old "ownedHours" field represented one total of hours per resource.
  // Preserve that total and migrate it into the 1-hour denomination at first load.
  const defaults=()=>{
    const initial=Object.assign(clone(SOURCE.defaults),{daily:clone(SOURCE.daily),packages:clone(SOURCE.packages),progressMode:"fixed",progressNormal:true,progressHard:true});
    initial.ownedBoxes=initial.ownedHours.map(h=>boxDurations.map((duration,i)=>i===0?Math.max(0,safe(h)):0));
    return initial;
  };
  const ownedBoxHours=boxes=>boxDurations.reduce((total,h,i)=>total+Math.max(0,safe(boxes[i]))*h,0);
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
  const editableKeys=new Set(["current","goal","outpost","sweep","date","subtractOwned","progressMode","progressNormal","progressHard"]);
  // Indexed by 1-based daily sweep count (first clear is free).
  // 1회=0, 2회=50, 3회=70, ... 11회=450 jewels per individual clear.
  const sweepJewelPrice=[0,0,50,70,100,150,200,250,300,350,400,450];
  const jewelsPerDay=()=>state.daily.some(row=>row.name==="단기섬멸"&&row.on)
    ? sweepJewelPrice.slice(1,Math.min(11,Math.max(1,Math.trunc(safe(state.sweep))))+1).reduce((sum,price)=>sum+price,0):0;
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
      if(["fixed","progress"].includes(saved.progressMode))state.progressMode=saved.progressMode;
      if(typeof saved.progressNormal==="boolean")state.progressNormal=saved.progressNormal;
      if(typeof saved.progressHard==="boolean")state.progressHard=saved.progressHard;
      for(const key of ["ownedHours","ownedUnits"]){
        if(Array.isArray(saved[key])&&saved[key].length===3)
          state[key]=saved[key].map(value=>Math.max(0,safe(value)));
      }
      if(Array.isArray(saved.ownedBoxes)&&saved.ownedBoxes.length===3&&
         saved.ownedBoxes.every(row=>Array.isArray(row)&&row.length===boxDurations.length)){
        state.ownedBoxes=saved.ownedBoxes.map(row=>row.map(value=>Math.max(0,safe(value))));
      }else if(Array.isArray(saved.ownedBoxes)&&saved.ownedBoxes.length===3&&
               saved.ownedBoxes.every(row=>Array.isArray(row)&&row.length===6)){
        // v1.449 stored [1h,2h,4h,8h,12h,24h]. Convert each 4h box
        // into four 1h boxes while preserving all other denominations.
        state.ownedBoxes=saved.ownedBoxes.map(row=>[
          Math.max(0,safe(row[0]))+4*Math.max(0,safe(row[2])),
          Math.max(0,safe(row[1])),
          Math.max(0,safe(row[3])),
          Math.max(0,safe(row[4])),
          Math.max(0,safe(row[5]))
        ]);
      }else{
        // Legacy users previously entered their combined box-hours in one input.
        state.ownedBoxes=state.ownedHours.map(hours=>boxDurations.map((duration,i)=>i===0?Math.max(0,safe(hours)):0));
      }
      if(Array.isArray(saved.daily))
        state.daily.forEach(row=>{
          // Preserve saved switches by name when new income rows are appended.
          const previous=saved.daily.find(item=>item?.name===row.name);
          if(typeof previous?.on==="boolean")row.on=previous.on;
        });
      if(Array.isArray(saved.packages)&&saved.packages.length===state.packages.length)
        state.packages.forEach((row,i)=>{
          if(typeof saved.packages[i]?.on==="boolean")row.on=saved.packages[i].on;
          if(allowedPackageChoices.has(i)&&[0,1,2].includes(Number(saved.packages[i]?.choice)))
            row.choice=Number(saved.packages[i].choice);
        });
    }
  }catch(e){}
  state.ownedHours=state.ownedBoxes.map(ownedBoxHours);
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
        <span class="syn-utility-note">전초기지 생산량: 사이트 내 인게임 확인 표(1~800레벨) · 레벨업 비용: 원본 시트</span>
        <div class="syn-actions"><button class="syn-btn" id="syn-reset" type="button">입력값 초기화</button></div>
      </div>
      <div id="syn-output">
        <div class="syn-top-grid">
          <section class="syn-box syn-input-panel">
            <div class="syn-box-head">1. 정보입력</div>
            <div class="syn-box-body">
              <div class="syn-form">
                ${field("현재 싱크로 레벨","current",1,999)}
                ${field("목표 싱크로 레벨","goal",2,1000)}
                ${field("전초기지 레벨","outpost",1,800)}
                ${field("단기섬멸 횟수 / 일","sweep",1,11)}
                <label class="syn-field">시작 날짜<input type="date" data-key="date" value="${escape(state.date)}"></label>
              </div>
                <div class="syn-progress-options">
                  <div class="syn-progress-modes">
                    <span class="syn-progress-label">전초기지 생산량 계산 방식</span>
                    <div class="syn-mode-buttons" role="group" aria-label="전초기지 생산량 계산 방식">
                      <button type="button" data-progress-mode="fixed" class="${state.progressMode==="fixed"?"active":""}" aria-pressed="${state.progressMode==="fixed"}">현재 전초기지 고정</button>
                      <button type="button" data-progress-mode="progress" class="${state.progressMode==="progress"?"active":""}" aria-pressed="${state.progressMode==="progress"}">싱크로 달성에 따른 전초기지 상승</button>
                    </div>
                  </div>
                  <div class="syn-progress-choices" id="syn-progress-choices" ${state.progressMode==="progress"?"":"hidden"}>
                    <label class="syn-check"><input type="checkbox" data-key="progressNormal" ${state.progressNormal?"checked":""}>노말 챕터 반영</label>
                    <label class="syn-check"><input type="checkbox" data-key="progressHard" ${state.progressHard?"checked":""}>하드 챕터 반영</label>
                    <span class="syn-progress-tip">보스 클리어 기준 싱크로를 달성하면 해당 구간 스테이지를 일괄 반영합니다. 5스테이지당 전초기지 +1 (추정)</span>
                  </div>
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
            <div class="syn-jewel-usage" id="syn-overall-jewels">쥬얼 소모량 계산 중...</div>
            <div class="foot" id="syn-overall-sub">선택한 패키지만 계산</div>
          </section>
        </div>
      </div>
       <section class="syn-box syn-progress-overview" id="syn-progress-overview" hidden aria-label="전초기지 상승 시뮬레이션 결과">
         <div class="syn-box-head">전초기지 상승 시뮬레이션</div>
         <div class="syn-box-body">
           <div class="syn-progress-stats" id="syn-progress-stats"></div>
           <p class="syn-progress-disclaimer">현재 전초기지 레벨을 시작값으로 사용하며 이미 지난 기준은 중복 적용하지 않습니다. 보스 클리어 시점에 각 구간 스테이지를 일괄 반영하는 추정 계산입니다. 잔여 스테이지는 0개로 가정하며 전초기지는 800레벨을 상한으로 계산합니다.</p>
           <details class="syn-progress-details"><summary>챕터별 전초기지 상승 내역</summary><div class="syn-table-wrap"><table class="syn-table"><thead><tr><th>모드</th><th>보스 챕터</th><th>기준 싱크로</th><th>반영 스테이지</th><th>전초기지 상승</th><th>도달 날짜</th><th>전초기지</th></tr></thead><tbody id="syn-progress-events"></tbody></table></div></details>
         </div>
       </section>
      <div class="syn-detail-grid">
        <section class="syn-box syn-owned-panel" aria-label="보유 재화 입력">
          <div class="syn-box-head">2. 보유 재화 입력</div>
          <div class="syn-box-body">
            <label class="syn-check"><input type="checkbox" data-key="subtractOwned" ${state.subtractOwned?"checked":""}>보유 재화를 필요량에서 차감</label>
            <p class="syn-hint" id="syn-hourly">전초기지 시간당 생산량</p>
            <div class="syn-wealth">
              ${names.map((name,j)=>`<div class="syn-wealth-card">
                <div class="syn-wealth-title">${name}</div>
                <label class="syn-field syn-wealth-raw">보유 재화(낱개)
                  <input type="number" min="0" step="any" data-owned="ownedUnits" data-index="${j}" value="${safe(state.ownedUnits[j])}">
                </label>
                <div class="syn-wealth-subhead"><span>보유 상자 (개수)</span><span>스크롤 ↓</span></div>
                <div class="syn-wealth-boxes" role="group" aria-label="${escape(name)} 시간별 보유 상자">
                  ${boxDurations.map((hours,i)=>`<label class="syn-wealth-box-row">
                    <span>${hours}시간</span>
                    <input type="number" min="0" step="1" inputmode="numeric" data-owned-box="${j}" data-duration="${hours}"
                      aria-label="${escape(name)} ${hours}시간 상자 개수" value="${safe(state.ownedBoxes[j][i])}">
                  </label>`).join("")}
                </div>
                <div class="syn-hint" id="syn-owned-${j}">-</div>
              </div>`).join("")}
            </div>
          </div>
        </section>
        <section class="syn-box syn-package-panel" aria-label="과금 패키지 선택">
          <div class="syn-box-head syn-header-controls">
            <span>3. 과금 패키지</span>
            <span class="syn-check-actions" role="group" aria-label="과금 패키지 일괄 선택">
              <button type="button" data-bulk-target="packages" data-bulk-set="all">전부 체크</button>
              <button type="button" data-bulk-target="packages" data-bulk-set="none">전부 체크 해제</button>
            </span>
          </div>
          <div class="syn-box-body">
            <div class="syn-package-list">
              ${packageDisplayOrder.map(i=>{
                const p=state.packages[i],displayName=packageDisplayNames[i];
                return `<div class="syn-package-item ${allowedPackageChoices.has(i)?"syn-has-choice":"syn-no-choice"}">
                  <div class="syn-package-row-main">
                    <label class="syn-package-toggle">
                      <input type="checkbox" aria-label="${escape(displayName)} 사용" data-yellow-cell="true" data-package="${i}" data-field="on" ${p.on?"checked":""}>
                      <span>${escape(displayName)}</span>
                    </label>
                    <div class="syn-package-efficiency" data-package-efficiency="${i}"></div>
                  </div>
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
      <section class="syn-box syn-daily-panel syn-daily-wide" aria-label="재화 수급 체크 항목 선택">
        <div class="syn-box-head syn-header-controls">
          <span>4. 재화 수급 체크</span>
          <span class="syn-check-actions" role="group" aria-label="재화 수급 일괄 선택">
            <button type="button" data-bulk-target="daily" data-bulk-set="all">전부 체크</button>
            <button type="button" data-bulk-target="daily" data-bulk-set="none">전부 체크 해제</button>
          </span>
        </div>
        <div class="syn-box-body">
          <div class="syn-daily-list">
            ${state.daily.map((r,i)=>`<label class="syn-daily-item">
              <input type="checkbox" aria-label="${escape(i===0?"전초기지 자연생산":r.name)} 사용" data-daily="${i}" data-field="on" ${r.on?"checked":""}>
              <span>${escape(i===0?"전초기지 자연생산":r.name)}</span>
            </label>`).join("")}
          </div>
        </div>
      </section>
      <div class="syn-resource-cards" id="syn-resource-cards"></div>
      <p class="syn-progress-explain">진행률 막대 = 보유 재화 ÷ 전체 필요 재화 (100% 상한). 보유 재화 차감 설정과 별개로 현재 보유량을 표시합니다.</p>
      <details class="syn-box"><summary>5. 구간별 필요 재화 세부표</summary><div class="syn-box-body syn-result-detail"><div class="syn-table-wrap"><table class="syn-table"><thead><tr><th>레벨 구간</th><th>적용 횟수</th><th>필요 코더</th><th>필요 배데</th><th>필요 크레딧</th></tr></thead>
        <tbody id="syn-band-table"></tbody></table></div></div></details>
      <div class="syn-status" id="syn-status">계산 중...</div>
      <div class="syn-note">자료 기준: 전초기지 생산량은 사이트 내 인게임 확인 표, 레벨업 비용·수급 규칙은 원본 시트(2026-10-28) · 입력 설정은 테섭 브라우저에 저장됩니다. 원본 시트는 수정하지 않습니다.</div>
    </div>`;
    enforcePackageEditPolicy();
    update();
  }
  function buildProgressPlan(current,goal){
  if(state.progressMode!=="progress")return [];
  const candidates=campaignMilestones.filter(m=>m.mode==="normal"?state.progressNormal:state.progressHard).map(m=>{
    const prev=campaignMilestones.filter(v=>v.mode===m.mode&&v.chapter<m.chapter).reduce((n,v)=>Math.max(n,v.chapter),m.chapter-2);
    let stages=0;for(let chapter=prev+1;chapter<=m.chapter;chapter++)stages+=safe(campaignStageCounts[chapter]);
    return {...m,stages};
  }).filter(m=>m.level>current&&m.level<=goal).sort((a,b)=>a.level-b.level||(a.mode==="normal"?-1:1));
  let remainder=0;
  return candidates.map(m=>{remainder+=m.stages;const gain=Math.floor(remainder/5);remainder%=5;return {...m,gain};});
}
  function simulateProgress(base){
  const {level,goal,outpost,rate,bands,total,owned,needed,daily,dailyRows,grants,packages}=base;
  const events=buildProgressPlan(level,goal);
  const stepCosts=Array.from({length:goal+1},(_,lv)=>{
    const b=bands.find(row=>lv>=row.start&&lv<=row.end);
    return b?b.need.map(safe):[0,0,0];
  });
  const balance=state.subtractOwned?owned.slice():[0,0,0],earned=[0,0,0],reached=[null,null,null],count=packages.map(()=>0),progressLog=[];
  let spent=0,completeDay=null,subExpiry=0,levelReached=level,currentOutpost=outpost,eventIndex=0;
  for(let day=1;day<=1500;day++){
    const dayRate=SOURCE.rates[currentOutpost-1],dayIncome=[0,0,0];
    for(const row of state.daily)if(row.on){
      for(let j=0;j<3;j++){
        const hours=row.name==="단기섬멸"?safe(state.sweep)*2:safe(row.h[j]);
        dayIncome[j]+=(hours*dayRate[j]+safe(row.fixed[j]))/Math.max(.0000001,safe(row.period));
      }
    }
    const dayGrants=packages.map(p=>pkgGrantH(p).map((h,j)=>h*dayRate[j]+(j===0?safe(p.coreFixed):0)));
    const previous=earned.map((v,j)=>v>=needed[j]-1e-7),when=dateByDay(state.date,day);
    const weekday=when.getUTCDay()||7,monthDay=when.getUTCDate();
    let subscriptionToday=false;
    for(let k=0;k<packages.length;k++){
      const pkg=packages[k],grant=dayGrants[k];if(!pkg.on)continue;
      const relevant=grant.some((v,j)=>v>0&&!previous[j]);
      if(pkg.cycle==="월정액"){
        if(relevant&&day>subExpiry){count[k]++;spent+=safe(pkg.price);subExpiry=day+Math.max(1,Math.trunc(safe(state.subscriptionDays)))-1;}
        if(day<=subExpiry)subscriptionToday=true;
        continue;
      }
      if(!relevant)continue;
      const scheduled=pkg.cycle==="일일"||(pkg.cycle==="주간"&&weekday===safe(state.weeklyDay))||(pkg.cycle==="월간"&&monthDay===safe(state.monthlyDay));
      if(scheduled){count[k]++;spent+=safe(pkg.price);for(let j=0;j<3;j++){balance[j]+=grant[j];earned[j]+=grant[j];}}
    }
    for(let j=0;j<3;j++){
      const income=dayIncome[j]+(subscriptionToday?dayGrants[8][j]:0);
      balance[j]+=income;earned[j]+=income;
      if(reached[j]===null&&earned[j]>=needed[j]-1e-7)reached[j]=day;
    }
    while(levelReached<goal){
      const cost=stepCosts[levelReached+1];
      if(!cost.every((value,j)=>balance[j]+1e-7>=value))break;
      for(let j=0;j<3;j++)balance[j]=Math.max(0,balance[j]-cost[j]);
      levelReached++;
      while(eventIndex<events.length&&levelReached>=events[eventIndex].level){
        const ev=events[eventIndex++],before=currentOutpost;
        currentOutpost=Math.min(800,currentOutpost+ev.gain);
        progressLog.push({...ev,day,before,outpost:currentOutpost,actualGain:currentOutpost-before});
      }
    }
    if(levelReached>=goal){completeDay=day;break;}
  }
  const lastRate=SOURCE.rates[currentOutpost-1],dailyEnd=[0,0,0];
  for(const r of state.daily)if(r.on)for(let j=0;j<3;j++){
    const hours=r.name==="단기섬멸"?safe(state.sweep)*2:safe(r.h[j]);
    dailyEnd[j]+=(hours*lastRate[j]+safe(r.fixed[j]))/Math.max(.0000001,safe(r.period));
  }
  return {level,goal,outpost,rate,bands,total,owned,needed,daily,dailyRows,grants,reached,count,spent,completeDay,endOutpost:currentOutpost,dailyEnd,progressLog,events,levelReached};
}
  function calculate(onlyPackage=null,modeOverride=null){
    // null: active selections; -1: free only; index: one package; array: selected package indices.
    const packages=onlyPackage===null?state.packages:state.packages.map((p,i)=>({
      ...p,on:Array.isArray(onlyPackage)?onlyPackage.includes(i):i===onlyPackage
    }));
    const level=Math.min(999,Math.max(1,Math.trunc(safe(state.current))));
    const goal=Math.min(1000,Math.max(2,Math.trunc(safe(state.goal))));
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
    const grants=packages.map(p=>pkgGrantH(p).map((h,j)=>h*rate[j]+(j===0?safe(p.coreFixed):0)));
    if((modeOverride||state.progressMode)==="progress")return simulateProgress({level,goal,outpost,rate,bands,total,owned,needed,daily,dailyRows,grants,packages});
    const reached=[null,null,null],acc=[0,0,0],count=packages.map(()=>0);
    let spent=0,completeDay=null,subExpiry=0;
    for(let day=1;day<=1500;day++){
      const previousReached=acc.map((n,j)=>n>=needed[j]);
      const when=dateByDay(state.date,day);
      const weekday=when.getUTCDay()||7, monthDay=when.getUTCDate();
      let subToday=false;
      for(let k=0;k<packages.length;k++){
        const p=packages[k], gr=grants[k];if(!p.on)continue;
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
    return {level,goal,outpost,rate,bands,total,owned,needed,daily,dailyRows,grants,reached,count,spent,completeDay,endOutpost:outpost,dailyEnd:daily,progressLog:[],events:[],levelReached:completeDay===null?level:goal};
  }
  function el(id){return document.getElementById(id);}
  // The global target date is determined by the slowest of three resources.
  // A core-only subscription can therefore improve its resource completion date
  // without changing the overall date when credits or battle data are limiting.
  // Measure independent resource-day savings for each package versus free.
  // This is an efficiency contribution metric, not literal overall days saved.
  function resourceDaysSaved(free,withPackage){
    if(!free||!withPackage||!free.reached.every(Number.isFinite)||
       !withPackage.reached.every(Number.isFinite))return null;
    return free.reached.reduce((sum,day,j)=>
      sum+Math.max(0,day-withPackage.reached[j]),0);
  }
  function updatePackageEfficiency(active){
    const free=calculate(-1);
    const standalone=state.packages.map((p,i)=>calculate(i));
    const subscription=standalone[8];
    const monthImpact=resourceDaysSaved(free,subscription);
    const priceReference=monthImpact>0&&subscription.spent>0?monthImpact/subscription.spent:0;
    const selected=state.packages.map((p,i)=>p.on?i:null).filter(i=>i!==null);
    for(const i of packageDisplayOrder){
      const target=root.querySelector(`[data-package-efficiency="${i}"]`);
      if(!target)continue;
      const p=state.packages[i],alone=standalone[i];
      const impact=resourceDaysSaved(free,alone);
      const costScore=priceReference>0&&impact!==null&&alone.spent>0
        ? 100*(impact/alone.spent)/priceReference:null;
      const timeScore=monthImpact>0&&impact!==null?100*impact/monthImpact:null;
      const priceText=costScore===null?"비교 불가":`${fmt(costScore,1)}%`;
      const timeText=timeScore===null?"비교 불가":`${fmt(timeScore,1)}%`;
      const actual=p.on;
      const scenario=actual?active:calculate([...selected,i]);
      const count=scenario.count[i]||0;
      const estimatedCost=scenario.completeDay!==null?count*safe(p.price):null;
      const otherDetail=actual?"현재 체크된 패키지 조합":"현재 조합에 이 패키지만 추가했을 때";
      const overallSaved=free.completeDay!==null&&alone.completeDay!==null
        ? Math.max(0,free.completeDay-alone.completeDay):null;
      const hint=`${otherDetail} · 목표까지 ${fmt(count)}회 구매 · 단독 구매 시 전체 목표 ${overallSaved===null?"산정 불가":fmt(overallSaved)+"일 단축"}`;
      target.innerHTML=`
        <div class="syn-package-values">
          <span class="syn-package-value" title="재화별 충족일 단축 합계 ÷ 총 구매비용을 월정액 100%와 비교합니다. 전체 목표일 단축과 다를 수 있습니다.">가격 효율 <strong>${priceText}</strong></span>
          <span class="syn-package-value" title="코더·배데·크레딧 각각의 충족일 단축 합계를 월정액 100%와 비교합니다. 전체 목표일 단축과 다를 수 있습니다.">기간 단축 효율 <strong>${timeText}</strong></span>
        </div>
        <div class="syn-package-spend" title="${escape(hint)}">목표까지 예상 구매비용 ${estimatedCost===null?"산정 불가":fmt(estimatedCost)+"원"}</div>`;
    }
  }
  function updateProgressOverview(c){
  const panel=el("syn-progress-overview"),choices=el("syn-progress-choices");
  if(choices)choices.hidden=state.progressMode!=="progress";
  if(!panel)return;
  panel.hidden=state.progressMode!=="progress";
  if(panel.hidden)return;
  const fixed=calculate(null,"fixed");
  const delta=fixed.completeDay!==null&&c.completeDay!==null?fixed.completeDay-c.completeDay:null;
  const deltaText=delta===null?"산정 불가":delta>=0?`${fmt(delta)}일 단축`:`${fmt(-delta)}일 증가`;
  el("syn-progress-stats").innerHTML=`
    <div class="syn-progress-stat"><span>시작 전초기지</span><strong>Lv.${fmt(c.outpost)}</strong></div>
    <div class="syn-progress-stat"><span>예상 최종 전초기지</span><strong>Lv.${fmt(c.endOutpost)} (+${fmt(c.endOutpost-c.outpost)})</strong></div>
    <div class="syn-progress-stat"><span>고정 방식 예상</span><strong>${fixed.completeDay===null?"1,500일 내 미도달":fmt(fixed.completeDay)+"일"}</strong></div>
    <div class="syn-progress-stat"><span>고정 방식 대비</span><strong>${deltaText}</strong></div>`;
  const log=new Map(c.progressLog.map(m=>[m.mode+":"+m.chapter,m]));
  el("syn-progress-events").innerHTML=c.events.length?c.events.map(m=>{
    const actual=log.get(m.mode+":"+m.chapter);
    return `<tr><td>${m.mode==="normal"?"노말":"하드"}</td><td>${m.chapter}챕터</td><td>${m.level}</td><td>${m.stages}</td><td>+${m.gain}</td><td>${actual?dateTxt(dateByDay(state.date,actual.day)):"미도달"}</td><td>${actual?"Lv."+fmt(actual.outpost):"—"}</td></tr>`;
  }).join(""):'<tr><td colspan="7">선택한 싱크로 구간에 적용되는 기준이 없습니다.</td></tr>';
}
  function update(){
    root.querySelectorAll("[data-progress-mode]").forEach(button=>{
      const active=button.dataset.progressMode===state.progressMode;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    });
    const c=calculate();
    updatePackageEfficiency(c);
    updateProgressOverview(c);
    el("syn-overall-date").textContent=c.completeDay===null?"1500일 내 미도달":dateTxt(dateByDay(state.date,c.completeDay));
    el("syn-overall-days").textContent=c.completeDay===null?"수급 설정을 조정해 주세요":`${fmt(c.completeDay)}일 소요 · ${fmt(c.goal-c.level)}레벨 상승`;
    el("syn-overall-cost").textContent=fmt(c.spent)+"원";
    const dailyJewels=jewelsPerDay();
    const jewelEl=el("syn-overall-jewels");
    jewelEl.textContent=c.completeDay===null?"쥬얼 소모량 산정 불가":`쥬얼 소모량 ${fmt(dailyJewels*c.completeDay)}개`;
    jewelEl.title=`단기섬멸 ${Math.trunc(safe(state.sweep))}회/일 · 하루 ${fmt(dailyJewels)}쥬얼 · 1회 무료, 2회부터 회당 비용 적용`;
    el("syn-overall-sub").textContent="활성화된 패키지 구매 기준 · 목표 달성까지 합산";
    const endRate=SOURCE.rates[c.endOutpost-1];
    el("syn-hourly").textContent=state.progressMode==="progress"?`시작 전초기지 Lv.${c.outpost} (시간당 코더 ${fmt(c.rate[0],2)}) → 예상 최종 Lv.${c.endOutpost} (시간당 코더 ${fmt(endRate[0],2)}) · 보유 상자는 시작 시점 생산량 적용`:`전초기지 ${c.outpost}레벨 · 시간당 코더 ${fmt(c.rate[0],2)}, 배데 ${fmt(c.rate[1],2)}, 크레딧 ${fmt(c.rate[2],2)}`;
    el("syn-resource-cards").innerHTML=names.map((name,j)=>{
      const ratio=c.total[j]>0?Math.min(100,100*c.owned[j]/c.total[j]):100;
      return `<article class="syn-resource"><div class="title">${name}</div><div class="date">${c.reached[j]===null?"1500일 내 미도달":dateTxt(dateByDay(state.date,c.reached[j]))}</div>
        <div class="metric"><span>소요 기간</span><strong>${c.reached[j]===null?"미도달":fmt(c.reached[j])+"일"}</strong></div>
        <div class="metric"><span>총 필요 재화</span><strong>${fmt(c.total[j])}</strong></div>
        <div class="metric"><span>보유 차감 후</span><strong>${fmt(c.needed[j])}</strong></div>
        <div class="metric"><span>일일 기본 수급</span><strong>${state.progressMode==="progress"?fmt(c.daily[j])+" → "+fmt(c.dailyEnd[j]):fmt(c.daily[j])}</strong></div>
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
    else{status.classList.remove("warn");status.textContent="사이트의 인게임 확인 전초기지 시간당 생산량과 원본 시트의 레벨업 비용·일일 수급·패키지 규칙을 반영한 예상 결과입니다. 구매 조건과 재화 수급 가정이 실제 게임과 다르면 결과도 달라질 수 있어요.";}
    if(c.level<200){
      status.classList.add("warn");
      status.textContent+=" 주의: 현재 보유한 레벨업 비용 데이터는 201레벨부터입니다. 1~200레벨의 비용은 제외되므로 예상 날짜·과금액은 정확한 전체 구간 계산이 아닙니다.";
    }
  }
  function onEdit(e){
    const x=e.target;if(!x.dataset)return;
    if(x.dataset.key){
      const k=x.dataset.key;
      if(!editableKeys.has(k))return;
      state[k]=x.type==="checkbox"?Boolean(x.checked):(x.type==="date"||k==="progressMode")?x.value:safe(x.value);
      if(["current","goal"].includes(k))state[k]=Math.trunc(state[k]);
    }else if(x.dataset.ownedBox!==undefined){
      const j=Number(x.dataset.ownedBox),duration=Number(x.dataset.duration);
      const i=boxDurations.indexOf(duration);
      if(![0,1,2].includes(j)||i<0)return;
      state.ownedBoxes[j][i]=Math.max(0,Math.trunc(safe(x.value)));
      state.ownedHours[j]=ownedBoxHours(state.ownedBoxes[j]);
      if(e.type==="change")x.value=state.ownedBoxes[j][i];
    }else if(x.dataset.owned){
      const i=Number(x.dataset.index);
      if(x.dataset.owned!=="ownedUnits"||![0,1,2].includes(i))return;
      state.ownedUnits[i]=Math.max(0,safe(x.value));
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
      if(x.dataset.key==="current")x.value=state.current=Math.min(999,Math.max(1,Math.trunc(state.current)));
      if(x.dataset.key==="goal")x.value=state.goal=Math.min(1000,Math.max(2,Math.trunc(state.goal)));
      if(x.dataset.key==="outpost")x.value=state.outpost=Math.min(800,Math.max(1,Math.trunc(state.outpost)));
      if(x.dataset.key==="sweep")x.value=state.sweep=Math.min(11,Math.max(1,Math.trunc(state.sweep)));
    }
    try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(e){}
    update();
  }
  root.addEventListener("input",onEdit);
  root.addEventListener("change",onEdit);
  root.addEventListener("click",e=>{
    const modeButton=e.target.closest("button[data-progress-mode]");
    if(modeButton){
      const mode=modeButton.dataset.progressMode;
      if(!["fixed","progress"].includes(mode))return;
      if(state.progressMode!==mode){
        state.progressMode=mode;
        try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(e){}
        update();
      }
      return;
    }
    const bulk=e.target.closest("[data-bulk-target][data-bulk-set]");
    if(bulk){
      const target=bulk.dataset.bulkTarget,checked=bulk.dataset.bulkSet==="all";
      if(!["packages","daily"].includes(target)||!["all","none"].includes(bulk.dataset.bulkSet))return;
      state[target].forEach(item=>{item.on=checked;});
      const selector=target==="packages"?'input[data-package][data-field="on"]':'input[data-daily][data-field="on"]';
      root.querySelectorAll(selector).forEach(input=>{input.checked=checked;});
      try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(e){}
      update();
      return;
    }
    if(e.target.id==="syn-reset"){
      if(!confirm("싱크로 계산기의 입력값과 체크 상태를 원본 시트 기본값으로 초기화할까요?"))return;
      state=defaults();try{localStorage.removeItem(storageKey);}catch(e){}render();
    }
  });
  render();
})();
