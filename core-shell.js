/* LUDIA NAIL core recovery shell v2.48.0
 * Keeps navigation + theme usable even if a later feature script throws.
 */
(()=>{'use strict';
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  const titles={opsHome:'오늘, 필요한 것만.',booking:'예약',customers:'고객',more:'더보기',home:'ART STUDIO',create:'디자인 스튜디오',library:'ART 보관함',collection:'이달의 아트',settings:'DNA · 재료'};
  function fallbackView(v){
    document.body.classList.toggle('booking-view',v==='booking');
    $$('.screen').forEach(x=>x.classList.remove('active'));
    const target=$('#'+v+'Screen');if(!target)return;
    target.classList.add('active');
    $$('.rail-nav [data-nav],.mobile-nav [data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===v||(['home','create','library','collection','settings'].includes(v)&&x.dataset.nav==='more')));
    $$('.art-tabs [data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===v));
    const title=$('#pageTitle');if(title)title.textContent=titles[v]||'LUDIA NAIL';
    try{if(v==='booking'&&typeof window.renderBooking==='function')window.renderBooking();if(v==='customers'&&typeof window.renderCustomers==='function')window.renderCustomers()}catch(error){console.error('[LUDIA core shell render]',error)}
    window.scrollTo({top:0,behavior:'smooth'});
  }
  if(!window.__ludiaNavBound){
    $$('[data-nav]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();fallbackView(b.dataset.nav)}));
    window.__ludiaNavBound='fallback';
  }
  function fallbackTheme(){
    const dark=document.documentElement.dataset.theme!=='dark';
    document.documentElement.dataset.theme=dark?'dark':'light';
    document.body.classList.toggle('dark-mode',dark);
    localStorage.setItem('ludiaTheme',dark?'dark':'light');
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=dark?'#111113':'#f6f4ef';
    const top=$('#themeBtn'),book=$('#bookingThemeBtn'),home=$('#homeThemeBtn');
    if(top)top.classList.toggle('is-dark',dark);
    if(book){book.classList.toggle('is-dark',dark);book.setAttribute('aria-pressed',dark?'true':'false')}
    if(home){home.classList.toggle('is-dark',dark);home.setAttribute('aria-pressed',dark?'true':'false')}
  }
  if(!window.__ludiaThemeBound){
    $('#themeBtn')?.addEventListener('click',fallbackTheme);
    $('#bookingThemeBtn')?.addEventListener('click',fallbackTheme);
    $('#homeThemeBtn')?.addEventListener('click',fallbackTheme);
    window.__ludiaThemeBound='fallback';
  }
  window.addEventListener('error',e=>console.error('[LUDIA runtime]',e.error||e.message));
  window.addEventListener('unhandledrejection',e=>console.error('[LUDIA promise]',e.reason));
})();