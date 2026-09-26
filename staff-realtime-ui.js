/* LUDIA NAIL · realtime bridge for staff today operations */
(()=>{'use strict';
let client=null,channel=null,salonId=null,reloadTimer=null,started=false;
const active=()=>document.querySelector('[data-staff-mode="today"]')?.classList.contains('active')&&!document.querySelector('#staffDay')?.classList.contains('hidden');
function refreshSoon(){clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>{if(!active()||document.hidden)return;document.querySelector('[data-staff-mode="today"]')?.click()},180)}
async function start(){if(started||!window.supabase?.createClient)return;started=true;try{const r=await fetch('/api/salon-config',{cache:'no-store'}),cfg=await r.json();if(!cfg?.configured){started=false;return}client=await window.LudiaSalonCloud.getClient();const {data:{session}}=await client.auth.getSession();if(!session?.user){started=false;return}const {data,error}=await client.from('ludia_salon_members').select('salon_id').eq('user_id',session.user.id).eq('is_active',true).limit(1);if(error)throw error;salonId=data?.[0]?.salon_id;if(!salonId){started=false;return}channel=client.channel(`ludia-staff-floor-${salonId}`).on('postgres_changes',{event:'*',schema:'public',table:'ludia_appointments',filter:`salon_id=eq.${salonId}`},refreshSoon).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('[LUDIA staff realtime]',status)});}catch(error){started=false;console.warn('[LUDIA staff realtime]',error)}}
function stop(){clearTimeout(reloadTimer);if(channel&&client)client.removeChannel(channel).catch(()=>{});channel=null;salonId=null;started=false}
document.addEventListener('click',e=>{if(e.target.closest('.native-settings-group button')?.querySelector('b')?.textContent.trim()==='직원'||e.target.closest('[data-staff-mode="today"]'))setTimeout(start,0)});
document.addEventListener('visibilitychange',()=>{if(document.hidden)return;if(active()){start();refreshSoon()}});
window.addEventListener('beforeunload',stop,{once:true});
})();

