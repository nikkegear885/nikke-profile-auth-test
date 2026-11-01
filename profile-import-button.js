/* NIKKE Gear Manager - direct BlaBlaLink public profile sync */
(function(){
  'use strict';

  // Keep the existing modal layout; only its test-site sync provider changes.
  var pendingRoster = null;
  function externalApi(){
    var api=window.__NIKKE_GM_EXTERNAL_SYNC__;
    if(!api)throw new Error('외부 API 동기화 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
    return api;
  }
  var overlay = null;
  var targetAccount = '';
  var working = false;
  // Keep the sync dialog visible while the legacy roster apply routine runs.
  var suppressLegacyClose = false;

  function text(v){
    return String(v == null ? '' : v);
  }

  function getAccounts(){
    // Use the same account names shown in the main site's top-right switcher.
    // Ignore the extra random-account controls available only on the test site.
    var visible = Array.from(document.querySelectorAll('.actions.account-switcher .account-switch-btn'))
      .map(function(b){ return text(b.dataset.account || b.textContent).trim(); })
      .filter(Boolean).slice(0,2);
    if(visible.length===2 && visible[0]!==visible[1])return visible;
    try{
      if(typeof ACCOUNTS !== 'undefined' && Array.isArray(ACCOUNTS)&&ACCOUNTS.length===2){
        return ACCOUNTS.slice();
      }
    }catch(_){}
    return ['계정1','계정2'];
  }

  function validateProfileUrl(value){
    var u;
    try{
      u = new URL(String(value || '').trim());
    }catch(_){
      throw new Error('올바른 BlaBlaLink 프로필 URL을 입력해 주세요.');
    }
    if(
      u.protocol !== 'https:' ||
      u.hostname !== 'www.blablalink.com' ||
      u.pathname !== '/user' ||
      !u.searchParams.get('openid')
    ){
      throw new Error('공개 BlaBlaLink 프로필 URL을 정확하게 입력해 주세요.');
    }
    return u.toString();
  }

  async function requestSessionCheck(url){
    var api=externalApi();
    if(!api.allowExternalRequest())throw new Error('외부 API 이용 동의가 취소되었습니다.');
    var roster=await api.getRoster(url);
    var areas=api.candidates(roster);
    if(!areas.length)throw new Error('공개 프로필에서 보유 니케가 확인되는 서버를 찾지 못했습니다.');
    return {
      responseOk:true,
      payload:{
        ok:true,
        message:'외부 NIKKE API가 공개 프로필의 보유 니케를 정상적으로 조회했습니다. 계정 데이터는 변경하지 않았습니다.'+
          (areas.length>1?' 여러 서버가 있으므로 동기화 시 서버를 선택해야 합니다.':''),
        checked_area:areas.length===1?areas[0].area_id:null
      }
    };
  }

  function regionLabel(areaId){
    return ({'81':'일본 (JP)','82':'북미 (NA)','83':'한국 (KR)','84':'글로벌 (Global)','85':'동남아 (SEA)'})[String(areaId)] || ('지역 ' + String(areaId));
  }

  function injectStyle(){
    if(document.getElementById('bl-direct-sync-style')) return;
    var style = document.createElement('style');
    style.id = 'bl-direct-sync-style';
    style.textContent = [
      '.bl-direct-backdrop{position:fixed;inset:0;z-index:100001;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(2,5,14,.58);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}',
      '.bl-direct-backdrop.open{display:flex}',
      '.bl-direct-modal{width:min(590px,96vw);max-height:92vh;overflow:auto;border:1px solid #c7d9e5;border-radius:16px;background:#f8fcfe;color:#334e60;box-shadow:0 28px 90px rgba(0,0,0,.38)}',
      'html.dark-theme .bl-direct-modal{background:#101827;color:#e7edf9;border-color:#30415e}',
      '.bl-direct-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #d4e4ec;background:#edf7fb}',
      '.bl-direct-help-link{margin-left:auto;white-space:nowrap;color:#1976d2!important;text-decoration:underline!important;text-underline-offset:2px;font-size:10px;font-weight:900}',
      '.bl-direct-footer{display:flex;justify-content:flex-end;padding:0 16px 14px}',
      /* Strongly emphasize the site-guide action at the bottom-right of the sync modal. */
      '.bl-direct-footer{display:flex;justify-content:flex-end;padding:0 16px 14px}',
      '.bl-direct-site-help{display:inline-flex;align-items:center;justify-content:center;gap:7px;max-width:100%;box-sizing:border-box;padding:9px 13px;border:2px solid #df9328;border-radius:9px;background:#ffedcf;color:#874500!important;text-decoration:none!important;font-size:12px;font-weight:1000;line-height:1.35;text-align:right;white-space:normal;box-shadow:0 3px 0 rgba(166,93,14,.16),0 4px 12px rgba(214,142,50,.22);transition:transform .15s ease,background .15s ease,border-color .15s ease,box-shadow .15s ease}',
      '.bl-direct-site-help:before{content:"ⓘ";display:inline-flex;align-items:center;justify-content:center;flex:0 0 18px;width:18px;height:18px;border-radius:50%;background:#d98513;color:#fff;font-size:13px;font-weight:1000;line-height:1}',
      '.bl-direct-site-help:hover,.bl-direct-site-help:focus-visible{transform:translateY(-1px);background:#ffdfa6;border-color:#c9780d;color:#713800!important;box-shadow:0 4px 0 rgba(166,93,14,.16),0 6px 15px rgba(214,142,50,.30);outline:2px solid rgba(223,147,40,.22);outline-offset:2px}',
      'html.dark-theme .bl-direct-site-help{background:#382713;border-color:#e6a13b;color:#ffe0a5!important;box-shadow:0 3px 0 rgba(0,0,0,.25),0 4px 13px rgba(0,0,0,.24)}',
      'html.dark-theme .bl-direct-site-help:before{background:#e6a13b;color:#2b1b08}',
      'html.dark-theme .bl-direct-site-help:hover,html.dark-theme .bl-direct-site-help:focus-visible{background:#4b3319;border-color:#ffc56a;color:#fff0ce!important}',
      '.bl-direct-footer .known-bugs-top-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;height:40px!important;min-height:40px!important;max-height:40px!important;box-sizing:border-box!important;margin:0!important;line-height:1!important;white-space:nowrap!important}',
      '.known-bugs-overlay{z-index:100100!important}',
      'html.dark-theme .bl-direct-head{background:#141f32;border-bottom-color:#293952}',
      '.bl-direct-head h3{margin:0;font-size:16px}',
      '.bl-direct-head small{display:block;margin-top:3px;color:#718797;font-size:10px}',
      'html.dark-theme .bl-direct-head small{color:#8796ad}',
      '.bl-direct-close{width:32px;height:32px;padding:0;border:1px solid #bfd6e2;border-radius:8px;background:#fff;color:#62798a;font-size:21px;line-height:1}',
      'html.dark-theme .bl-direct-close{background:#0d1525;border-color:#33435f;color:#b6c4d9}',
      '.bl-direct-body{padding:16px}',
      '.bl-direct-label{display:block;margin:0 0 6px;font-size:11px;font-weight:900;color:#486577}',
      'html.dark-theme .bl-direct-label{color:#aebbd0}',
      '.bl-direct-input{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #c1d7e2;border-radius:8px;background:#fff;color:#314a5b;outline:none;font-size:12px}',
      'html.dark-theme .bl-direct-input{border-color:#33445f;background:#0b1323;color:#eaf0fc}',
      '.bl-direct-input:focus{border-color:#73acd0;box-shadow:0 0 0 3px rgba(94,162,202,.12)}',
      '.bl-direct-accounts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}',
      '.bl-direct-account{border:1px solid #bfd5e0;border-radius:9px;background:#fff;color:#61798a;padding:10px 11px;text-align:left;cursor:pointer}',
      'html.dark-theme .bl-direct-account{background:#0c1424;border-color:#2b3a54;color:#aebbd0}',
      '.bl-direct-account.active{border-color:#d79a3c;background:#fff4e4;color:#9a5a12;box-shadow:inset 0 0 0 1px rgba(215,154,60,.18)}',
      'html.dark-theme .bl-direct-account.active{border-color:#d49b42;background:#2c2114;color:#ffd38a}',
      '.bl-direct-account b{display:block;font-size:11px}',
      '.bl-direct-account span{display:block;margin-top:3px;font-size:9px;opacity:.78}',
      '.bl-direct-note{margin-top:12px;padding:10px 11px;border:1px solid #d3e1e8;border-radius:9px;background:#f3f8fb;color:#71828f;font-size:10px;line-height:1.55}',
      'html.dark-theme .bl-direct-note{border-color:#2d3c55;background:#0d1627;color:#93a2b8}',
      '.bl-direct-status{margin-top:10px;min-height:18px;font-size:10px;line-height:1.5}',
      '.bl-direct-status.success{color:#2e8765}',
      '.bl-direct-status.error{color:#bd5e62}',
      '.bl-direct-region-picker{margin-top:12px;padding:11px;border:1px solid #d8b46e;border-radius:9px;background:#fff8e9}',
      '.bl-direct-region-picker[hidden]{display:none!important}',
      'html.dark-theme .bl-direct-region-picker{border-color:#755a2e;background:#2a2114}',
      '.bl-direct-region-label{display:block;margin-bottom:6px;font-size:11px;font-weight:900}',
      '.bl-direct-region-select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #d5b46f;border-radius:7px;background:#fff;color:#493c24;font-size:12px;font-weight:800}',
      'html.dark-theme .bl-direct-region-select{border-color:#755a2e;background:#121a29;color:#f2e2bd}',
      '.bl-direct-region-hint{margin-top:6px;font-size:10px;line-height:1.45;color:#8a6b30}',
      'html.dark-theme .bl-direct-region-hint{color:#d1b675}',
      '.bl-direct-actions{display:flex;gap:8px;margin-top:14px}',
      '.bl-direct-check{display:block;width:100%;margin-top:8px;padding:8px 10px;border:1px solid #8dc6ad;border-radius:8px;background:#effaf4;color:#247552;font-size:11px;font-weight:900;cursor:pointer}',
      '.bl-direct-check:hover:not(:disabled){background:#e0f5e9;border-color:#65ae8d}',
      '.bl-direct-check:disabled{opacity:.55;cursor:not-allowed}',
      'html.dark-theme .bl-direct-check{border-color:#376e58;background:#142b24;color:#9be0ba}',
      'html.dark-theme .bl-direct-check:hover:not(:disabled){background:#1c3a30;border-color:#4c9877}',
      '.bl-direct-primary{flex:1;border:1px solid #d88926;border-radius:9px;background:#f39a2f;color:#fff;padding:10px 12px;font-size:11px;font-weight:900;cursor:pointer}',
      '.bl-direct-primary:disabled{opacity:.55;cursor:not-allowed}',
      '.bl-direct-secondary{border:1px solid #bfd5e0;border-radius:9px;background:#fff;color:#61798a;padding:10px 12px;font-size:11px;font-weight:900;cursor:pointer}',
      'html.dark-theme .bl-direct-secondary{background:#0c1424;border-color:#2b3a54;color:#aebbd0}',
      '.bl-direct-profile{display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px 11px;border:1px solid #cddfe8;border-radius:9px;background:#fff}',
      '.bl-direct-profile[hidden]{display:none!important}',
      '.bl-direct-profile img{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#e8eef3}',
      '.bl-direct-profile-name{font-size:12px;font-weight:900}',
      '.bl-direct-profile-sub{margin-top:3px;font-size:9px;color:#718797}',
      'html.dark-theme .bl-direct-profile{background:#0c1424;border-color:#2b3a54}',
      'html.dark-theme .bl-direct-profile-sub{color:#8d9bb1}'
    ].join('');
    document.head.appendChild(style);
  }

  function accountsLabel(){
    var accounts = getAccounts();
    return [accounts[0] || '계정1', accounts[1] || '계정2'];
  }

  function ensureModal(){
    injectStyle();
    if(overlay) return overlay;

    overlay = document.createElement('div');
    overlay.className = 'bl-direct-backdrop';
    overlay.innerHTML =
      '<div class="bl-direct-modal" role="dialog" aria-modal="true" aria-labelledby="blDirectTitle">' +
        '<div class="bl-direct-head">' +
          '<div><h3 id="blDirectTitle">BlaBlaLink 계정 동기화</h3><small>공개 프로필 URL만 입력하면 장비 현황을 불러옵니다.</small></div>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-left:auto">' +
            '<a class="bl-direct-help-link" href="https://gall.dcinside.com/mgallery/board/view?id=gov&no=5423342" target="_blank" rel="noopener noreferrer">블라링크 계정주소 확인법</a>' +

            '<button type="button" class="bl-direct-close" aria-label="닫기">×</button>' +
          '</div>' +
        '</div>' +
        '<div class="bl-direct-body">' +
          '<label class="bl-direct-label" for="blDirectUrl">공개 BlaBlaLink 프로필 URL</label>' +
          '<input id="blDirectUrl" class="bl-direct-input" type="url" autocomplete="off" placeholder="https://www.blablalink.com/user?openid=...">' +
          '<div class="bl-direct-accounts">' +
            '<button type="button" class="bl-direct-account" data-slot="0"><b id="blDirectA1">계정1</b><span>이 계정에 동기화</span></button>' +
            '<button type="button" class="bl-direct-account" data-slot="1"><b id="blDirectA2">계정2</b><span>이 계정에 동기화</span></button>' +
          '</div>' +
          '<div style="margin-top:6px;font-size:10px;color:#71828f;text-align:center">계정명은 우측 톱니 아이콘을 눌러 변경가능합니다</div>' +
          '<div class="bl-direct-region-picker" id="blDirectRegionPicker" hidden>' +
            '<label class="bl-direct-region-label" for="blDirectRegionSelect">동기화할 NIKKE 지역 선택</label>' +
            '<select class="bl-direct-region-select" id="blDirectRegionSelect"><option value="">지역 선택…</option></select>' +
            '<div class="bl-direct-region-hint">같은 프로필에서 여러 지역의 로스터가 발견되었습니다. 실제로 플레이하는 지역을 선택해야 다른 서버의 보유·돌파·코강 정보가 섞이지 않습니다.</div>' +
          '</div>' +
          '<div class="bl-direct-actions">' +
            '<button type="button" class="bl-direct-primary">동기화 시작</button>' +
            '<button type="button" class="bl-direct-secondary">닫기</button>' +
          '</div>' +
          '<button type="button" class="bl-direct-check">외부 API 조회 확인 · 계정 데이터 변경 없음</button>' +
          '<div class="bl-direct-status" id="blDirectStatus"></div>' +
          '<div class="bl-direct-note">비밀번호·Cookie·game_token은 입력하지 않습니다. 공개 프로필 ID를 제3자 운영 NIKKE API로 전송해 조회합니다. 첫 사용 시 한 번 동의를 받습니다.</div>' +
          '<div class="bl-direct-profile" id="blDirectProfile" hidden>' +
            '<img id="blDirectAvatar" alt="">' +
            '<div><div class="bl-direct-profile-name" id="blDirectName"></div><div class="bl-direct-profile-sub" id="blDirectSub"></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="bl-direct-footer">' +
          '<button type="button" class="btn known-bugs-top-btn" id="knownBugsBtn" onclick="openKnownBugsPanel()">인지한 버그</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    function close(){
      overlay.classList.remove('open');
    }

    overlay.querySelector('.bl-direct-close').addEventListener('click', close);
    overlay.querySelector('.bl-direct-secondary').addEventListener('click', close);
    overlay.addEventListener('click', function(e){
      if(e.target === overlay) close();
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && overlay.classList.contains('open')) close();
    });

    overlay.querySelectorAll('.bl-direct-account').forEach(function(btn){
      btn.addEventListener('click', function(){
        var accounts = getAccounts();
        var idx = Number(btn.getAttribute('data-slot') || 0);
        targetAccount = accounts[idx] || accounts[0] || '계정1';
        overlay.querySelectorAll('.bl-direct-account').forEach(function(x){
          x.classList.remove('active');
        });
        btn.classList.add('active');
      });
    });

    overlay.querySelector('.bl-direct-check').addEventListener('click', async function(){
      if(working) return;

      var input = overlay.querySelector('#blDirectUrl');
      var status = overlay.querySelector('#blDirectStatus');
      var checkButton = overlay.querySelector('.bl-direct-check');
      var primary = overlay.querySelector('.bl-direct-primary');

      var url;
      try{
        url = validateProfileUrl(input.value.trim());
      }catch(err){
        status.className = 'bl-direct-status error';
        status.textContent = text(err && err.message || err);
        return;
      }

      working = true;
      checkButton.disabled = true;
      primary.disabled = true;
      status.className = 'bl-direct-status';
      status.textContent = '외부 NIKKE API의 공개 프로필 조회를 확인하는 중…';

      try{
        var checkResult = await requestSessionCheck(url);
        var payload = checkResult.payload;
        if(!checkResult.responseOk || !payload || payload.ok !== true){
          throw new Error((payload && payload.message) || '세션 유효성 확인에 실패했습니다.');
        }
        status.className = 'bl-direct-status success';
        status.textContent = payload.message || '외부 API 조회가 정상입니다. 계정 데이터는 변경하지 않았습니다.';
        if(payload.checked_area){
          status.textContent += ' 확인 지역: ' + regionLabel(payload.checked_area) + '.';
        }
      }catch(err){
        status.className = 'bl-direct-status error';
        status.textContent = text(err && err.message || err || '세션 유효성 확인에 실패했습니다.');
      }finally{
        working = false;
        checkButton.disabled = false;
        primary.disabled = false;
      }
    });

    overlay.querySelector('#blDirectUrl').addEventListener('input', function(){
      var picker = overlay.querySelector('#blDirectRegionPicker');
      var select = overlay.querySelector('#blDirectRegionSelect');
      var primary = overlay.querySelector('.bl-direct-primary');
      if(picker) picker.hidden = true;
      if(select) select.innerHTML = '<option value="">지역 선택…</option>';
      if(primary) primary.textContent = '동기화 시작';
      pendingRoster=null;
    });

    overlay.querySelector('.bl-direct-primary').addEventListener('click', async function(){
      if(working) return;

      var input = overlay.querySelector('#blDirectUrl');
      var status = overlay.querySelector('#blDirectStatus');
      var primary = overlay.querySelector('.bl-direct-primary');
      var card = overlay.querySelector('#blDirectProfile');
      var regionPicker = overlay.querySelector('#blDirectRegionPicker');
      var regionSelect = overlay.querySelector('#blDirectRegionSelect');
      var requestedAreaId = null;
      var accounts = getAccounts();

      targetAccount = targetAccount || accounts[0] || '계정1';

      if(regionPicker && !regionPicker.hidden){
        var selectedAreaValue = regionSelect ? String(regionSelect.value || '').trim() : '';
        if(!selectedAreaValue){
          status.className = 'bl-direct-status error';
          status.textContent = '여러 지역에서 로스터가 발견되었습니다. 동기화할 지역을 먼저 선택해 주세요.';
          if(regionSelect) regionSelect.focus();
          return;
        }
        requestedAreaId = Number(selectedAreaValue);
      }

      var url;
      try{
        url = validateProfileUrl(input.value.trim());
      }catch(err){
        status.className = 'bl-direct-status error';
        status.textContent = text(err && err.message || err);
        return;
      }

      var engine;
      try{
        engine=externalApi();
        if(!engine.allowExternalRequest()){
          status.className='bl-direct-status error';
          status.textContent='외부 API 이용 동의가 취소되었습니다.';
          return;
        }
      }catch(err){
        status.className='bl-direct-status error';
        status.textContent=text(err&&err.message||err);
        return;
      }
      working = true;
      primary.disabled = true;
      card.hidden = true;
      status.className = 'bl-direct-status';
      status.textContent = requestedAreaId===null
        ? '외부 API로 모든 서버의 보유·스킬·장비를 조회하는 중…'
        : '선택한 서버의 보유·스킬·장비 정보를 처리하는 중…';

      try{
        var roster;
        if(requestedAreaId!==null){
          if(!pendingRoster || pendingRoster.url!==url)
            throw new Error('서버 선택 정보가 만료되었습니다. 다시 조회해 주세요.');
          roster=pendingRoster.roster;
        }else{
          roster=await engine.getRoster(url);
        }
        var available=engine.candidates(roster);
        if(!available.length)
          throw new Error('보유 니케가 있는 서버를 찾지 못했습니다. 프로필 공개 설정을 확인해 주세요.');
        if(requestedAreaId===null && available.length>1){
          pendingRoster={url:url,roster:roster};
          if(regionSelect){
            regionSelect.innerHTML='<option value="">지역 선택…</option>';
            available.forEach(function(candidate){
              var option=document.createElement('option');
              option.value=String(candidate.area_id);
              option.textContent=regionLabel(candidate.area_id)+' · '+candidate.character_count+'명';
              regionSelect.appendChild(option);
            });
          }
          if(regionPicker)regionPicker.hidden=false;
          primary.textContent='선택한 지역으로 동기화';
          status.className='bl-direct-status';
          status.textContent='여러 서버에서 보유 니케가 확인되었습니다. 사용할 서버를 선택해 주세요.';
          return;
        }
        var areaId=requestedAreaId===null?available[0].area_id:requestedAreaId;
        if(!available.some(function(a){return a.area_id===areaId;}))
          throw new Error('선택한 서버가 공개 프로필의 보유 목록에 없습니다.');
        var info={username:'',avatar:''};
        var profileLookupError='';
        try{info=await engine.getProfile(url,areaId);}catch(error){
          profileLookupError=String(error&&error.message||error||'프로필 조회 실패').slice(0,250);
          console.warn('[NIKKE GM] campaign profile lookup failed',profileLookupError);
          info.progressError=profileLookupError;
        }
        var payload=engine.convert(roster,areaId,info);
        pendingRoster=null;

        var apply = window.__NIKKE_GM_APPLY_SYNC__;
        if(typeof apply !== 'function'){
          throw new Error('사이트 동기화 기능을 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
        }

        try{
          localStorage.setItem('nikke_bl_profile_url_' + encodeURIComponent(targetAccount), url);
        }catch(_){}

        var profile = payload.profile || {};
        if(profile.username || profile.avatar){
          card.hidden = false;
          var img = overlay.querySelector('#blDirectAvatar');
          if(profile.avatar){
            img.src = profile.avatar;
            img.hidden = false;
          }else{
            img.hidden = true;
            img.removeAttribute('src');
          }
          overlay.querySelector('#blDirectName').textContent = profile.username || '닉네임 없음';
          overlay.querySelector('#blDirectSub').textContent =
            String(payload.character_count || 0) + '명 · 상세 ' + String(payload.detail_count || 0) + '건';
        }

        suppressLegacyClose=true;
        try{apply(payload, targetAccount);}
        finally{suppressLegacyClose=false;}
        // Store level snapshots for every roster region, and attach any
        // campaign returned for a DIFFERENT verified region only to that region.
        var availableRegions=[];
        try{
          availableRegions=window.__NIKKE_GM_ACCOUNT_PROGRESS__?.registerAreas(payload,targetAccount)||[];
        }catch(regionError){
          console.warn('[NIKKE GM] region snapshots unavailable',regionError);
        }
        var progressResult={saved:false,applied:false,stageResolved:false};
        try{
          progressResult=window.__NIKKE_GM_ACCOUNT_PROGRESS__?.accept(payload,targetAccount)||
            progressResult;
        }catch(progressError){
          progressResult.reason=String(progressError&&progressError.message||progressError);
          console.warn('[NIKKE GM] profile campaign import failed',progressError);
        }

        if(regionPicker) regionPicker.hidden = true;
        if(regionSelect) regionSelect.innerHTML = '<option value="">지역 선택…</option>';
        primary.textContent = '동기화 시작';
        var stageImported=progressResult.applied===true;
        var stageSaved=progressResult.saved===true&&progressResult.stageResolved===true;
        var partialImported=progressResult.saved===true&&!stageSaved;
        var detail=progressResult.reason||profileLookupError||
          payload.accountProgress?.progressError||'API에서 스테이지 정보를 찾지 못했습니다.';
        var otherRegion=/(반환 서버|서버의 프로필을 확인하지 못했습니다|다른 서버의 스테이지)/.test(detail);
        status.className=stageImported?'bl-direct-status success':'bl-direct-status error';
        status.textContent='장비·스킬 동기화 완료 · '+regionLabel(payload.area_id)+
          (availableRegions.length?' · 진행도 저장 서버 '+availableRegions.length+'곳':'')+'. '+
          (stageImported
            ? '전초기지 생산량에 노말 '+progressResult.normal+' / 하드 '+
              (progressResult.hard||'미클리어')+' 자동 입력 확인.'
            : stageSaved
              ? '스테이지 저장됨, 화면 적용 실패: '+String(detail).slice(0,250)
              : (partialImported?'싱크로·전초기지 레벨은 저장했습니다. ':'')+
                '스테이지 자동 입력 실패: '+String(detail).slice(0,250)+
                (otherRegion
                  ? ' · 선택한 서버의 로스터·레벨은 저장했습니다. API가 실제로 반환한 다른 서버의 스테이지는 해당 서버에 따로 저장했습니다. 전초기지 생산량의 조회 서버 메뉴에서 전환할 수 있습니다. 조회되지 않은 스테이지는 직접 저장해 주세요.'
                  : ' · API에서 스테이지가 미공개이거나 누락된 경우 자동 입력할 수 없습니다.'));
      }catch(err){
        status.className = 'bl-direct-status error';
        status.textContent = text(err && err.message || err || '동기화에 실패했습니다.');
      }finally{
        working = false;
        primary.disabled = false;
      }
    });

    return overlay;
  }

  function refreshLabels(){
    var labels = accountsLabel();
    var a = overlay.querySelector('#blDirectA1');
    var b = overlay.querySelector('#blDirectA2');
    if(a) a.textContent = labels[0];
    if(b) b.textContent = labels[1];

    overlay.querySelectorAll('.bl-direct-account').forEach(function(btn, i){
      btn.classList.toggle('active', labels[i] === targetAccount);
    });
  }

  window.openBlablalinkSyncGuide = function(){
    var modal = ensureModal();
    var accounts = getAccounts();
    // Never retain an obsolete or generated test-account target after renaming.
    if(!accounts.includes(targetAccount)){
      var current='';
      try{if(typeof activeAccount!=='undefined')current=String(activeAccount||'');}catch(_){}
      targetAccount=accounts.includes(current)?current:(accounts[0]||'계정1');
    }
    refreshLabels();
    // A profile shown from an earlier API request must not appear under a new target account.
    var previousProfile=modal.querySelector('#blDirectProfile');
    if(previousProfile)previousProfile.hidden=true;

    var savedKey = 'nikke_bl_profile_url_' + encodeURIComponent(targetAccount);
    try{
      var saved = localStorage.getItem(savedKey) || '';
      var input = modal.querySelector('#blDirectUrl');
      if(input && !input.value.trim()) input.value = saved;
    }catch(_){}

    modal.classList.add('open');
    setTimeout(function(){
      var input = modal.querySelector('#blDirectUrl');
      if(input) input.focus();
    },0);
  };

  window.closeBlablalinkSyncGuide = function(){
    // The production import routine automatically closes the sync dialog.
    // On test it must stay visible so campaign errors cannot be silently hidden.
    if(suppressLegacyClose)return;
    if(overlay) overlay.classList.remove('open');
    var old = document.getElementById('blsyncModal');
    if(old) old.hidden = true;
  };
})();