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
  let state=defaults();
  try{
    const data=JSON.parse(localStorage.getItem(storageKey));
    if(data&&typeof data==="object"){
      state=Object.assign(state,data);
      if(!Array.isArray(data.daily)||data.daily.length!==12)state.daily=clone(SOURCE.daily);
      if(!Array.isArray(data.packages)||data.packages.length!==9)state.packages=clone(SOURCE.packages);
    }
  }catch(e){}
  const numberInput=(value,attrs="")=>`<input class="syn-cell-input" type="number" step="any" min="0" value="${safe(value)}" ${attrs}>`;
  const field=(caption,key,min,max,step="1")=>`<label class="syn-field">${caption}<input data-key="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${safe(state[key])}"></label>`;
  const dayInput=(row,i,k)=>numberInput(row[k],`data-daily="${i}" data-field="${k}"`);
  function inputFieldOfRow(row,i,key,j){
    const isSweep=row.name==="단기섬멸"&&key==="h";
    return numberInput(isSweep?state.sweep*2:row[key][j],`data-daily="${i}" data-field="${key}" data-index="${j}" ${isSweep?"disabled title='단기섬멸 횟수 × 2시간'":""}`);
  }
  function pkgGrantH(p){
    if(safe(p.choice)>=0 && p.choice!==-1 && Number.isInteger(+p.choice)){
      const index=+p.choice, arr=[0,0,0];if(index<3)arr[index]=safe(p.baseH)*safe(state.ratios[index]);return arr;
    }
    return Array.isArray(p.h)?p.h.map(safe):[0,0,0];
  }
  function render(){
    root.innerHTML=`
    <div class="syn-wrap">
      <header class="syn-head">
        <div><div class="syn-eyebrow">NIKKE · DOROSYNC</div><h1>싱크로 레벨업 계산기</h1><div class="syn-note">구글 시트 계산식 기준 · 전초기지 1~800 · 최대 싱크로 1000레벨</div></div>
        <div class="syn-actions"><a class="syn-link" href="https://docs.google.com/spreadsheets/d/1D2Yu_HYfgWmBhKFQenWxwE-EipH_hb0NJgOFCKb2VtY/edit" target="_blank" rel="noopener noreferrer">원본 시트 보기</a><button class="syn-btn" id="syn-reset" type="button">기본값으로 초기화</button></div>
      </header>
      <section class="syn-box"><div class="syn-box-head">1. 싱크로 정보 입력</div><div class="syn-box-body">
        <div class="syn-form">${field("현재 싱크로 레벨","current",200,999)}${field("목표 싱크로 레벨","goal",201,1000)}${field("전초기지 레벨","outpost",1,800)}${field("단기섬멸 횟수 / 일","sweep",1,11)}
          <label class="syn-field">시작 날짜<input type="date" data-key="date" value="${escape(state.date)}"></label></div>
        <p class="syn-hint">현재 레벨 다음 단계부터 목표 레벨까지의 비용을 합산해요. 단기섬멸 1회당 2시간 생산량으로 계산해요.</p>
      </div></section>
      <div id="syn-output">
        <div class="syn-summary">
          <div class="syn-highlight"><div class="sub">전체 목표 달성 예상</div><div class="big" id="syn-overall-date">-</div><div class="foot" id="syn-overall-days">-</div></div>
          <div class="syn-highlight"><div class="sub">전체 목표 달성까지의 패키지 과금액</div><div class="big" id="syn-overall-cost">-</div><div class="foot" id="syn-overall-sub">선택한 패키지만 계산</div></div>
        </div>
        <div class="syn-resource-cards" id="syn-resource-cards"></div>
      </div>
      <details class="syn-box" open><summary>2. 보유 재화 입력 및 차감</summary>
        <div class="syn-box-body"><label class="syn-check"><input type="checkbox" data-key="subtractOwned" ${state.subtractOwned?"checked":""}>보유 재화를 필요량에서 차감</label>
          <p class="syn-hint" id="syn-hourly">전초기지 시간당 생산량</p>
          <div class="syn-wealth">${names.map((name,j)=>`<div class="syn-wealth-card"><div class="syn-wealth-title">${name}</div>
            <label class="syn-field">보유 재화 상자(h)<input type="number" min="0" step="any" data-owned="ownedHours" data-index="${j}" value="${safe(state.ownedHours[j])}"></label>
            <label class="syn-field">보유 재화(낱개)<input type="number" min="0" step="any" data-owned="ownedUnits" data-index="${j}" value="${safe(state.ownedUnits[j])}"></label>
            <div class="syn-hint" id="syn-owned-${j}">-</div></div>`).join("")}</div>
        </div>
      </details>
      <details class="syn-box"><summary>3. 일일 수급 재화 · 12개 항목 (수정 가능)</summary>
        <div class="syn-box-body"><div class="syn-table-wrap"><table class="syn-table"><thead><tr><th>사용</th><th>항목</th><th>주기(일)</th><th>코더 h</th><th>코더 고정</th><th>배데 h</th><th>배데 고정</th><th>크레딧 h</th><th>크레딧 고정</th><th>일일 코더</th><th>일일 배데</th><th>일일 크레딧</th></tr></thead>
        <tbody>${state.daily.map((r,i)=>`<tr>
          <td><input type="checkbox" aria-label="${escape(r.name)} 사용" data-daily="${i}" data-field="on" ${r.on?"checked":""}></td><td class="syn-name">${escape(r.name)}</td>
          <td class="syn-num">${dayInput(r,i,"period")}</td>
          ${[0,1,2].map(j=>`<td class="syn-num">${inputFieldOfRow(r,i,"h",j)}</td><td class="syn-num">${inputFieldOfRow(r,i,"fixed",j)}</td>`).join("")}
          ${[0,1,2].map(j=>`<td id="syn-daily-${i}-${j}">-</td>`).join("")}
        </tr>`).join("")}</tbody></table></div>
        <p class="syn-hint">사용 체크된 항목만 반영. 시간(h) × 전초기지 시간당 생산량 + 고정량을 주기(일)로 나눠 일일 수급으로 계산해요.</p>
        </div><div class="syn-kpis"><span>일일 코어더스트 <strong id="syn-daily-total-0">-</strong></span><span>일일 배틀데이터 <strong id="syn-daily-total-1">-</strong></span><span>일일 크레딧 <strong id="syn-daily-total-2">-</strong></span></div>
      </details>
      <details class="syn-box" open><summary>4. 과금 패키지 시뮬레이션 (사용 체크)</summary>
        <div class="syn-box-body">
          <div class="syn-setup">
            <label class="syn-field">주간 구매 요일<select data-key="weeklyDay">${["월","화","수","목","금","토","일"].map((x,i)=>`<option value="${i+1}" ${state.weeklyDay===i+1?"selected":""}>${x}요일</option>`).join("")}</select></label>
            <label class="syn-field">월간 구매일<input type="number" min="1" max="31" data-key="monthlyDay" value="${safe(state.monthlyDay)}"></label>
            <label class="syn-field">월정액 적용 일수<input type="number" min="1" max="365" data-key="subscriptionDays" value="${safe(state.subscriptionDays)}"></label>
            ${["코더","배데","크레딧"].map((n,i)=>`<label class="syn-field">${n} 커스텀 비율<input type="number" min="0" step="any" data-ratio="${i}" value="${safe(state.ratios[i])}"></label>`).join("")}
          </div>
          <div class="syn-table-wrap"><table class="syn-table"><thead><tr><th>사용</th><th>패키지</th><th>주기</th><th>가격(원)</th><th>기준 h</th><th>선택 재화</th><th>코더 h</th><th>배데 h</th><th>크레딧 h</th><th>코더 고정</th><th>구매 횟수</th><th>총 과금</th></tr></thead>
          <tbody>${state.packages.map((p,i)=>`<tr>
            <td><input type="checkbox" aria-label="${escape(p.name)} 사용" data-package="${i}" data-field="on" ${p.on?"checked":""}></td>
            <td class="syn-name">${escape(p.name)}</td><td>${escape(p.cycle)}</td>
            <td class="syn-num">${numberInput(p.price,`data-package="${i}" data-field="price"`)}</td>
            <td class="syn-num">${numberInput(p.baseH,`data-package="${i}" data-field="baseH" ${+p.choice<0?"disabled":""}`)}</td>
            <td><select class="syn-cell-input syn-select" data-package="${i}" data-field="choice">
              <option value="-1" ${+p.choice<0?"selected":""}>직접 입력</option>
              ${["코더","배데","크레딧"].map((c,j)=>`<option value="${j}" ${+p.choice===j?"selected":""}>${c}</option>`).join("")}
            </select></td>
            ${[0,1,2].map(j=>`<td class="syn-num">${numberInput(pkgGrantH(p)[j],`data-package="${i}" data-field="h" data-index="${j}" ${+p.choice>=0?"disabled":""}`)}</td>`).join("")}
            <td class="syn-num">${numberInput(p.coreFixed,`data-package="${i}" data-field="coreFixed"`)}</td>
            <td id="syn-pkg-count-${i}">-</td><td id="syn-pkg-price-${i}">-</td>
          </tr>`).join("")}</tbody></table></div>
          <p class="syn-hint">월간은 지정 구매일, 주간은 지정 요일, 일일은 매일 구매합니다. 월정액은 지정 일수 동안 매일 지급되며 만료 후 재구매됩니다. 이미 필요한 재화를 모두 모은 패키지는 추가 구매하지 않습니다.</p>
        </div>
      </details>
      <details class="syn-box"><summary>5. 구간별 필요 재화 세부표</summary><div class="syn-box-body syn-result-detail"><div class="syn-table-wrap"><table class="syn-table"><thead><tr><th>레벨 구간</th><th>적용 횟수</th><th>필요 코더</th><th>필요 배데</th><th>필요 크레딧</th></tr></thead>
        <tbody id="syn-band-table"></tbody></table></div></div></details>
      <div class="syn-status" id="syn-status">계산 중...</div>
      <div class="syn-note">자료 기준: 싱크로 레벨업 계산기 (2026-10-28) · 설정은 이 브라우저의 테섭 저장 공간에만 보관됩니다. 원본 구글 시트는 수정하지 않습니다.</div>
    </div>`;
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
        <div class="metric"><span>일일 기본 수급</span><strong>${fmt(c.daily[j])}</strong></div><div class="syn-bar"><span style="width:${Math.max(0,ratio)}%"></span></div>
      </article>`;
    }).join("");
    for(let j=0;j<3;j++){
      el("syn-owned-"+j).textContent="낱개 환산: "+fmt(c.owned[j]);
      el("syn-daily-total-"+j).textContent=fmt(c.daily[j],2);
    }
    for(let i=0;i<c.dailyRows.length;i++)for(let j=0;j<3;j++)el(`syn-daily-${i}-${j}`).textContent=fmt(c.dailyRows[i][j]);
    for(let i=0;i<state.packages.length;i++){
      el(`syn-pkg-count-${i}`).textContent=fmt(c.count[i]);
      el(`syn-pkg-price-${i}`).textContent=fmt(c.count[i]*safe(state.packages[i].price))+"원";
      const row=root.querySelectorAll(`input[data-package="${i}"][data-field="h"]`);
      row.forEach((input,j)=>{input.value=c.grants[i][j]===0?"0":pkgGrantH(state.packages[i])[j];input.disabled=+state.packages[i].choice>=0;});
      const base=root.querySelector(`input[data-package="${i}"][data-field="baseH"]`);base.disabled=+state.packages[i].choice<0;
    }
    root.querySelectorAll('input[data-daily][data-field="h"]').forEach(input=>{
      const r=state.daily[+input.dataset.daily];if(r.name==="단기섬멸")input.value=fmt(safe(state.sweep)*2,4).replace(/,/g,"");
    });
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
      const k=x.dataset.key;state[k]=x.type==="checkbox"?x.checked:x.type==="date"?x.value:safe(x.value);
      if(["current","goal"].includes(k))state[k]=Math.trunc(state[k]);
    }else if(x.dataset.owned){state[x.dataset.owned][+x.dataset.index]=safe(x.value);}
    else if(x.dataset.ratio!==undefined){state.ratios[+x.dataset.ratio]=safe(x.value);}
    else if(x.dataset.daily!==undefined){
      const r=state.daily[+x.dataset.daily],key=x.dataset.field;
      if(key==="on")r.on=x.checked;
      else if(key==="h"||key==="fixed")r[key][+x.dataset.index]=safe(x.value);
      else r[key]=safe(x.value);
    }else if(x.dataset.package!==undefined){
      const r=state.packages[+x.dataset.package],key=x.dataset.field;
      if(key==="on")r.on=x.checked;
      else if(key==="h")r.h[+x.dataset.index]=safe(x.value);
      else r[key]=safe(x.value);
    }else return;
    if(e.type==="change"){
      if(x.dataset.key==="current")x.value=state.current=Math.min(999,Math.max(200,Math.trunc(state.current)));
      if(x.dataset.key==="goal")x.value=state.goal=Math.min(1000,Math.max(201,Math.trunc(state.goal)));
      if(x.dataset.key==="outpost")x.value=state.outpost=Math.min(800,Math.max(1,Math.trunc(state.outpost)));
      if(x.dataset.key==="sweep")x.value=state.sweep=Math.min(11,Math.max(1,Math.trunc(state.sweep)));
      if(x.dataset.key==="monthlyDay")x.value=state.monthlyDay=Math.min(31,Math.max(1,Math.trunc(state.monthlyDay)));
      if(x.dataset.key==="subscriptionDays")x.value=state.subscriptionDays=Math.min(365,Math.max(1,Math.trunc(state.subscriptionDays)));
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
