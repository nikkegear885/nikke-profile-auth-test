(() => {
'use strict';
const DATA_URL='assets/nikke-skills.json?v=1026';
let cache=null;
const esc=(v)=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function load(){
  if(cache)return cache;
  const r=await fetch(DATA_URL,{cache:'no-store'});
  if(!r.ok)throw new Error('스킬 데이터 요청 실패: '+r.status);
  cache=await r.json();
  return cache;
}
function pick(o,...keys){for(const k of keys){if(o&&o[k]!=null&&o[k]!=='')return o[k];}return ''}
function vals(detail){return Array.isArray(detail?.v)?detail.v:[]}
function text(detail,level){
  let t=String(detail?.t??detail?.template??'');
  const v=vals(detail)[level]||[];
  v.forEach((x,i)=>{t=t.split('{'+i+'}').join(String(x??''));});
  return t.replace(/<\/?(?:color|word_group)(?:=[^>]*)?>/gi,'').trim();
}
function skillIcon(detail){
  const src=pick(detail,'icon','icon_url','iconUrl','image','image_url');
  return src?'<img class="pedia-enhance-skill-icon" src="'+esc(src)+'" alt="">':'';
}
function renderSkillCard(label,name,detail){
  const levels=vals(detail).slice(0,10);
  const cool=pick(detail,'c','cooltime','coolTime');
  const info=pick(detail,'info_description','infoDescription','info');
  const internal=Object.entries(detail||{}).filter(([k])=>!['t','v','c','template','values','cooltime','coolTime','name','icon','icon_url','iconUrl','image','image_url','info_description','infoDescription','info'].includes(k));
  return '<section class="pedia-enhance-skill-card">'+
    '<div class="pedia-enhance-skill-head">'+skillIcon(detail)+'<div class="pedia-enhance-skill-title"><b>'+esc(label)+' · '+esc(name)+'</b><span>'+(cool!==''?'쿨타임 '+esc(cool)+'s':'')+'</span></div></div>'+
    '<div class="pedia-enhance-levels">'+levels.map((_,i)=>'<button type="button" class="pedia-enhance-lv'+(i===0?' active':'')+'" data-lv="'+i+'">Lv.'+(i+1)+'</button>').join('')+'</div>'+
    '<div class="pedia-enhance-desc" data-desc>'+esc(text(detail,0)||'설명 없음')+'</div>'+
    (info?'<div class="pedia-enhance-info"><b>추가 설명</b><div>'+esc(info)+'</div></div>':'')+
    (internal.length?'<details class="pedia-enhance-internal"><summary>기타 내부 스킬 값</summary><pre>'+esc(JSON.stringify(Object.fromEntries(internal),null,2))+'</pre></details>':'')+
    '</section>';
}
function ensureStyle(){
 if(document.getElementById('pedia-enhance-style'))return;
 const s=document.createElement('style');s.id='pedia-enhance-style';s.textContent=`
 .pedia-enhance-basic{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:12px}
 .pedia-enhance-basic-item{border:1px solid #c9dce6;border-radius:8px;background:#fff;padding:8px 9px}.pedia-enhance-basic-item b{display:block;font-size:8px;color:#718797;margin-bottom:3px}.pedia-enhance-basic-item span{font-size:11px;font-weight:900;color:#294b5e}
 .pedia-enhance-skill-card{margin-top:10px;border:1px solid #c9dce6;border-radius:10px;background:#fff;overflow:hidden}.pedia-enhance-skill-head{display:flex;align-items:center;gap:9px;padding:10px 12px;background:#edf7fb;border-bottom:1px solid #d7e5ec}.pedia-enhance-skill-icon{width:36px;height:36px;border-radius:7px;object-fit:cover}.pedia-enhance-skill-title{min-width:0;display:flex;flex-direction:column;gap:3px;font-size:12px}.pedia-enhance-skill-title span{font-size:9px;color:#718797}.pedia-enhance-levels{display:flex;gap:5px;flex-wrap:wrap;padding:9px 12px 0}.pedia-enhance-lv{border:1px solid #bfd5df;border-radius:6px;background:#fff;color:#60798a;padding:4px 7px;font-size:9px;font-weight:900;cursor:pointer}.pedia-enhance-lv.active{border-color:#72b0cf;background:#e7f5fb;color:#2d6d8e}.pedia-enhance-desc{padding:11px 12px 13px;white-space:pre-line;font-size:11px;line-height:1.6;color:#405b6c}.pedia-enhance-info{margin:0 12px 12px;padding:9px 10px;border-radius:7px;background:#f3f8fb;color:#405b6c;font-size:10px;line-height:1.5}.pedia-enhance-info b{display:block;margin-bottom:4px}.pedia-enhance-internal{margin:0 12px 12px;border-top:1px solid #d7e5ec;padding-top:8px;font-size:10px;color:#60798a}.pedia-enhance-internal pre{white-space:pre-wrap;word-break:break-word;font-size:9px;max-height:180px;overflow:auto}.html.dark-theme .pedia-enhance-basic-item,.html.dark-theme .pedia-enhance-skill-card{background:#151f31;border-color:#354761}.html.dark-theme .pedia-enhance-basic-item span,.html.dark-theme .pedia-enhance-desc{color:#dce6f3}.html.dark-theme .pedia-enhance-basic-item b,.html.dark-theme .pedia-enhance-skill-title span{color:#93a2b9}.html.dark-theme .pedia-enhance-info{background:#0d1627;color:#dce6f3}.html.dark-theme .pedia-enhance-lv{background:#0d1525;border-color:#344660;color:#aebbd0}.html.dark-theme .pedia-enhance-lv.active{background:#20334c;border-color:#5b88b0;color:#d6ebff}
 @media(max-width:650px){.pedia-enhance-basic{grid-template-columns:repeat(2,minmax(0,1fr))}}
 `;document.head.appendChild(s);
}
function classify(entries){
 const a=Object.entries(entries||{});
 if(a.length<=2)return a.map((x,i)=>[i===0?'스킬 1':'버스트',x[0],x[1]]);
 return [['스킬 1',a[0][0],a[0][1]],['스킬 2',a[1][0],a[1][1]],['버스트',a[a.length-1][0],a[a.length-1][1]]];
}
async function enhance(){
 const modal=document.getElementById('pediaSkillModal');
 if(!modal||!modal.classList.contains('open'))return;
 const title=modal.querySelector('#pediaSkillTitle');
 const name=(title?.textContent||'').replace(/\s*·\s*스킬 정보.*$/,'').trim();
 if(!name)return;
 try{
  const data=await load();const d=data[name];if(!d)return;
  ensureStyle();
  const body=modal.querySelector('#pediaSkillBody');if(!body)return;
  const basic=[['등급',pick(d,'r')],['기업',pick(d,'co','company')],['클래스',pick(d,'c','class')],['속성',pick(d,'e','element')],['버스트 단계',pick(d,'b','burst')],['스쿼드',pick(d,'s','squad')],['무기 종류',pick(d,'w','weapon','weapon_type','weaponType')],['ID',pick(d,'i','id')]].filter(x=>x[1]!=='' );
  const basicHtml='<div class="pedia-enhance-basic">'+basic.map(([k,v])=>'<div class="pedia-enhance-basic-item"><b>'+esc(k)+'</b><span>'+esc(v)+'</span></div>').join('')+'</div>';
  const cards=classify(d.k).map(([label,n,detail])=>renderSkillCard(label,n,detail)).join('');
  body.innerHTML=basicHtml+cards;
  body.querySelectorAll('.pedia-enhance-skill-card').forEach((card,idx)=>{
    const parts=classify(d.k);const detail=parts[idx]?.[2];const desc=card.querySelector('[data-desc]');
    card.querySelectorAll('.pedia-enhance-lv').forEach(btn=>btn.addEventListener('click',()=>{card.querySelectorAll('.pedia-enhance-lv').forEach(x=>x.classList.remove('active'));btn.classList.add('active');desc.textContent=text(detail,Number(btn.dataset.lv))||'설명 없음';}));
  });
 }catch(e){console.error('[pedia-enhance]',e);}
}
const obs=new MutationObserver(enhance);obs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
document.addEventListener('click',()=>setTimeout(enhance,80),true);
})();
