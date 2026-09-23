/* LUDIA NAIL · Customer 360 profile editor
 * Uses the existing Supabase Auth session only; never reads or stores a password.
 */
(()=>{
  const $=s=>document.querySelector(s);
  let selected=null,config=null,busy=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const getCustomer=card=>{const p=window.LudiaSalonCloud?.getLastPayload?.();const name=card.querySelector('.customer-top b')?.textContent?.trim();const phone=card.querySelector('.customer-top small')?.textContent?.split('·')[0]?.trim();return p?.customers?.find(c=>c.name===name&&(phone==='연락처 없음'||!phone||c.phone===phone))||p?.customers?.find(c=>c.name===name)||null};
  function authToken(){try{const raw=localStorage.getItem('ludia-salon-auth');if(!raw)return null;const v=JSON.parse(raw);return v?.access_token||v?.currentSession?.access_token||v?.session?.access_token||null}catch{return null}}
  function jwtSub(token){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub||null}catch{return null}}
  async function cfg(){if(config)return config;const r=await fetch('/api/salon-config',{cache:'no-store'});if(!r.ok)throw new Error('config_unavailable');config=await r.json();if(!config?.url||!config?.anonKey)throw new Error('cloud_not_configured');return config}
  async function rpc(customerId,memo,tags,preferences){
    const token=authToken(),c=await cfg(),uid=jwtSub(token);if(!token||!uid)throw new Error('login_required');
    const headers={apikey:c.anonKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
    const member=await fetch(`${c.url}/rest/v1/ludia_salon_members?select=salon_id&user_id=eq.${encodeURIComponent(uid)}&is_active=eq.true&limit=1`,{headers});if(!member.ok)throw new Error('salon_lookup_failed');
    const rows=await member.json(),salonId=rows?.[0]?.salon_id;if(!salonId)throw new Error('salon_required');
    const res=await fetch(`${c.url}/rest/v1/rpc/ludia_update_customer_profile`,{method:'POST',headers,body:JSON.stringify({p_salon_id:salonId,p_customer_id:customerId,p_memo:memo,p_tags:tags,p_preferences:preferences})});
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.message||'profile_update_failed')}return res.json();
  }
  function findMemoSection(){return [...document.querySelectorAll('#customer360Body .c360-section')].find(s=>s.querySelector('.c360-title b')?.textContent?.trim()==='고객 메모')}
  function install(){
    const section=findMemoSection();if(!section||section.dataset.editorReady||!selected?.cloudId)return;section.dataset.editorReady='1';
    const title=section.querySelector('.c360-title');if(!title)return;const hint=title.querySelector('span');if(hint)hint.outerHTML='<button type="button" class="c360-edit-btn" data-c360-edit>편집</button>';
    title.querySelector('[data-c360-edit]')?.addEventListener('click',()=>openEditor(section));
  }
  function openEditor(section){
    if(section.querySelector('.c360-editor'))return;const p=selected.preferences&&typeof selected.preferences==='object'?selected.preferences:{};
    const form=document.createElement('form');form.className='c360-editor';form.innerHTML=`
      <label><span>주의사항 · 메모</span><textarea name="memo" maxlength="2000" rows="4" placeholder="알러지, 손톱 상태, 시술 시 꼭 확인할 내용">${esc(selected.note||'')}</textarea></label>
      <label><span>태그</span><input name="tags" maxlength="300" value="${esc((selected.tags||[]).join(', '))}" placeholder="VIP, 손톱얇음, 웨딩" /></label>
      <div class="c360-editor-grid"><label><span>선호 컬러</span><input name="preferredColor" maxlength="80" value="${esc(p.preferredColor||p.color||'')}" placeholder="누드 핑크" /></label><label><span>아트 취향</span><input name="artStyle" maxlength="80" value="${esc(p.artStyle||p.style||'')}" placeholder="시럽 · 미니멀" /></label></div>
      <label><span>파츠 취향</span><input name="partsPreference" maxlength="80" value="${esc(p.partsPreference||p.parts||'')}" placeholder="작은 파츠 선호 / 파츠 없음" /></label>
      <div class="c360-editor-actions"><button type="button" class="soft-btn" data-edit-cancel>취소</button><button type="submit" class="primary-btn">저장</button></div><p class="c360-editor-status" aria-live="polite"></p>`;
    section.appendChild(form);section.querySelector('.c360-note')?.classList.add('editing-hidden');section.querySelector('.c360-prefs')?.classList.add('editing-hidden');
    form.querySelector('[data-edit-cancel]').addEventListener('click',()=>closeEditor(section));form.addEventListener('submit',e=>save(e,section));form.querySelector('textarea')?.focus();
  }
  function closeEditor(section){section.querySelector('.c360-editor')?.remove();section.querySelector('.c360-note')?.classList.remove('editing-hidden');section.querySelector('.c360-prefs')?.classList.remove('editing-hidden')}
  async function save(e,section){
    e.preventDefault();if(busy)return;const form=e.currentTarget,button=form.querySelector('[type="submit"]'),status=form.querySelector('.c360-editor-status'),fd=new FormData(form);
    const memo=String(fd.get('memo')||'').trim(),tags=String(fd.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,20),old=selected.preferences&&typeof selected.preferences==='object'?selected.preferences:{};
    const preferences={...old,preferredColor:String(fd.get('preferredColor')||'').trim(),artStyle:String(fd.get('artStyle')||'').trim(),partsPreference:String(fd.get('partsPreference')||'').trim()};
    busy=true;button.disabled=true;button.textContent='저장 중';status.textContent='';
    try{const saved=await rpc(selected.cloudId,memo,tags,preferences);selected.note=saved.memo||'';selected.tags=Array.isArray(saved.tags)?saved.tags:tags;selected.preferences=saved.preferences||preferences;
      const note=section.querySelector('.c360-note');if(note)note.textContent=selected.note||'등록된 주의사항이나 메모가 없습니다.';
      let chips=section.querySelector('.c360-prefs');if(chips)chips.remove();const visible=Object.entries(selected.preferences).filter(([,v])=>v!==null&&v!==''&&v!==false).slice(0,5);if(visible.length){chips=document.createElement('div');chips.className='c360-prefs';chips.innerHTML=visible.map(([k,v])=>`<span><b>${esc(k)}</b> ${esc(Array.isArray(v)?v.join(' · '):v)}</span>`).join('');note?.after(chips)}
      closeEditor(section);window.LudiaSalonCloud?.refresh?.();
    }catch(err){console.error('[LUDIA Customer Editor]',err);status.textContent=err.message==='login_required'?'로그인 세션을 다시 확인해 주세요.':'저장하지 못했어요. 잠시 후 다시 시도해 주세요.'}
    finally{busy=false;if(button){button.disabled=false;button.textContent='저장'}}
  }
  document.addEventListener('click',e=>{const card=e.target.closest('#customerGrid .customer-card');if(card)selected=getCustomer(card)},true);
  const observer=new MutationObserver(()=>{if($('#customer360Sheet.open'))install()});observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();