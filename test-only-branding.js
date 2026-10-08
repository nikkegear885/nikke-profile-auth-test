/* TEST SITE ONLY
 * This file is intentionally referenced only by the test repository.
 * Never copy this file or its script tag into the production repository.
 * The hostname guard is an additional safety net.
 */
(function(){
  'use strict';
  var isTestHost = window.location.hostname === 'nikkegear885.github.io' &&
                   (window.location.pathname === '/nikke-profile-auth-test/' ||
                    window.location.pathname === '/nikke-profile-auth-test');
  if(!isTestHost) return;

  function applyTestBranding(){
    document.title = 'TEST | 니케 장비관리';

    var brand = document.querySelector('.brand h1');
    if(brand && !brand.dataset.testBrandApplied){
      brand.textContent = 'TEST 니케 장비관리';
      brand.dataset.testBrandApplied = '1';
    }

    var pageTitle = document.getElementById('pageTitle');
    if(pageTitle && !pageTitle.dataset.testBrandApplied){
      var text = (pageTitle.textContent || '').trim();
      if(text && !/^TEST\\s/.test(text)){
        pageTitle.textContent = 'TEST ' + text;
      }
      pageTitle.dataset.testBrandApplied = '1';
    }
  }

  function applyPageTitleGuard(){
    var pageTitle = document.getElementById('pageTitle');
    if(!pageTitle) return;
    var current = (pageTitle.textContent || '').trim();
    if(current && !/^TEST\\s/.test(current)){
      pageTitle.textContent = 'TEST ' + current;
    }
    pageTitle.dataset.testBrandApplied = '1';
  }

  function init(){
    applyTestBranding();
    var title = document.getElementById('pageTitle');
    if(title){
      new MutationObserver(function(){
        applyPageTitleGuard();
      }).observe(title,{childList:true,characterData:true,subtree:true});
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
