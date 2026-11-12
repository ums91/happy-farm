import type { SupabaseClient } from '@supabase/supabase-js';
import { getCloudSupabaseClient, getCloudUserId } from './cloudSave';

const SAVE_KEY='happyFarmPhaserSaveV1';
const supabaseUrl=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const supabaseKey=(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY) as string|undefined;
type Farmer={friend_code:string;farmer_name:string;farm_name:string;level:number;xp?:number};
type Friend=Farmer&{friend_user_id:string;friends_since?:string};
type Request=Farmer&{request_id:string;direction:'incoming'|'outgoing';created_at:string};
let client:SupabaseClient|null=null;
let userId:string|null=null;
let initialized=false;
let activeTab:'friends'|'add'|'requests'='friends';
const el=(id:string)=>document.getElementById(id);
function escapeHtml(value:unknown):string{return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));}
function getLocalProfile(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');const xp=Math.max(0,Number(s.xp)||0);let level=1,total=0;while(level<100){const next=120+14*(level-1)*(level-1);if(xp<total+next)break;total+=next;level++;}return{farmerName:String(s.farmerName||'New Farmer').slice(0,24),farmName:String(s.farmName||'My Farm').slice(0,28),level,xp};}catch{return{farmerName:'New Farmer',farmName:'My Farm',level:1,xp:0};}}
function setMessage(message:string,error=false){const node=el('friends-status');if(node){node.textContent=message;node.classList.toggle('is-error',error);}}
function show(){el('friends-modal')?.classList.add('open');el('friends-modal')?.setAttribute('aria-hidden','false');void render();}
function hide(){el('friends-modal')?.classList.remove('open');el('friends-modal')?.setAttribute('aria-hidden','true');}
function setTab(tab:'friends'|'add'|'requests'){activeTab=tab;document.querySelectorAll<HTMLButtonElement>('[data-friends-tab]').forEach(b=>b.classList.toggle('active',b.dataset.friendsTab===tab));void render();}
async function syncProfile(){if(!client||!userId)throw new Error('Sign in to create your Farmer ID.');const p=getLocalProfile();const {data,error}=await client.rpc('hf_sync_my_farmer_profile',{p_farmer_name:p.farmerName,p_farm_name:p.farmName,p_level:p.level,p_xp:p.xp});if(error)throw error;return (Array.isArray(data)?data[0]:data) as Farmer;}
async function render(){
 const host=el('friends-content');if(!host)return;
 if(!supabaseUrl||!supabaseKey||!client){host.innerHTML='<div class="friends-empty"><strong>Cloud friends are not configured</strong><p>Configure Supabase cloud saves to use Friends & Neighbours.</p></div>';return;}
 if(!userId){host.innerHTML='<div class="friends-empty"><strong>Sign in to meet your neighbours</strong><p>Friends are linked to your cloud account so your list stays safe across devices.</p><button type="button" id="friends-signin">☁ Sign in / Create account</button></div>';el('friends-signin')?.addEventListener('click',()=>{hide();el('cloud-account')?.click();});return;}
 host.innerHTML='<div class="friends-loading">🌻 Loading your neighbours…</div>';
 try{
  const me=await syncProfile();
  const code=el('my-friend-code');if(code)code.textContent=me.friend_code;
  const name=el('my-farmer-name');if(name)name.textContent=me.farmer_name;
  if(activeTab==='friends'){
   const {data,error}=await client.rpc('hf_list_friends');if(error)throw error;
   const friends=(data||[]) as Friend[];
   host.innerHTML=friends.length?'<div class="friends-list">'+friends.map(f=>'<article class="friend-card"><div class="friend-avatar">👨‍🌾</div><div class="friend-info"><strong>'+escapeHtml(f.farmer_name)+'</strong><small>'+escapeHtml(f.farm_name)+' · Level '+f.level+'</small><small>Friend Code: '+escapeHtml(f.friend_code)+'</small></div><button type="button" class="friend-remove" data-remove-friend="'+escapeHtml(f.friend_user_id)+'" title="Remove neighbour">✕</button></article>').join('')+'</div>':'<div class="friends-empty"><div class="friends-big-icon">🌻</div><strong>Your neighbour list is waiting!</strong><p>Add farmers using their Friend Code to start building your neighbourhood.</p><button type="button" id="friends-add-first">＋ Add your first friend</button></div>';
   host.querySelector('#friends-add-first')?.addEventListener('click',()=>setTab('add'));
   host.querySelectorAll<HTMLButtonElement>('[data-remove-friend]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Remove this neighbour from your friends list?'))return;try{const {error}=await client!.rpc('hf_remove_friend',{p_friend_user_id:b.dataset.removeFriend});if(error)throw error;setMessage('Neighbour removed.');await render();}catch(e){setMessage(e instanceof Error?e.message:String(e),true);}}));
  }else if(activeTab==='add'){
   host.innerHTML='<form class="friends-add-form" id="friends-search-form"><label for="friend-code-input">Enter a Farmer Friend Code</label><div class="friends-code-row"><input id="friend-code-input" maxlength="8" minlength="8" autocomplete="off" placeholder="e.g. A1B2C3D4" required/><button type="submit">Search</button></div><p>Ask your friend to share the 8-character code shown on their Friends panel.</p></form><div id="friends-search-result"></div>';
   el('friends-search-form')?.addEventListener('submit',async event=>{event.preventDefault();const input=el('friend-code-input') as HTMLInputElement;const result=el('friends-search-result');if(!result)return;const code=input.value.trim().toUpperCase();if(!/^[A-Z0-9]{8}$/.test(code)){result.innerHTML='<p class="friends-error">Enter a valid 8-character Friend Code.</p>';return;}result.innerHTML='<p>Searching…</p>';try{const {data,error}=await client!.rpc('hf_search_farmer',{p_friend_code:code});if(error)throw error;const found=(data||[]) as Farmer[];if(!found.length){result.innerHTML='<p class="friends-error">No farmer found with that code.</p>';return;}const f=found[0];result.innerHTML='<article class="friend-card friend-search-result"><div class="friend-avatar">👨‍🌾</div><div class="friend-info"><strong>'+escapeHtml(f.farmer_name)+'</strong><small>'+escapeHtml(f.farm_name)+' · Level '+f.level+'</small><small>Friend Code: '+escapeHtml(f.friend_code)+'</small></div><button id="send-friend-request" type="button">＋ Add</button></article>';el('send-friend-request')?.addEventListener('click',async()=>{const btn=el('send-friend-request') as HTMLButtonElement;btn.disabled=true;try{const {error}=await client!.rpc('hf_send_friend_request',{p_friend_code:code});if(error)throw error;result.innerHTML='<p class="friends-success">Friend request sent to '+escapeHtml(f.farmer_name)+'!</p>';}catch(e){btn.disabled=false;result.innerHTML='<p class="friends-error">'+escapeHtml(e instanceof Error?e.message:String(e))+'</p>';}});}catch(e){result.innerHTML='<p class="friends-error">'+escapeHtml(e instanceof Error?e.message:String(e))+'</p>';}}); 
  }else{
   const {data,error}=await client.rpc('hf_list_friend_requests');if(error)throw error;const requests=(data||[]) as Request[];
   host.innerHTML=requests.length?'<div class="friends-list">'+requests.map(r=>'<article class="friend-card"><div class="friend-avatar">'+(r.direction==='incoming'?'📨':'⏳')+'</div><div class="friend-info"><strong>'+escapeHtml(r.farmer_name)+'</strong><small>'+escapeHtml(r.farm_name)+' · Level '+r.level+'</small><small>'+(r.direction==='incoming'?'Wants to be your neighbour':'Request sent · Waiting for response')+'</small></div>'+(r.direction==='incoming'?'<div class="friend-request-actions"><button type="button" data-accept-request="'+escapeHtml(r.request_id)+'">Accept</button><button type="button" data-decline-request="'+escapeHtml(r.request_id)+'">Decline</button></div>':'')+'</article>').join('')+'</div>':'<div class="friends-empty"><div class="friends-big-icon">📬</div><strong>No pending requests</strong><p>New neighbour requests will appear here.</p></div>';
   for(const [selector,accept] of [['[data-accept-request]',true],['[data-decline-request]',false]] as const)host.querySelectorAll<HTMLButtonElement>(selector).forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{const {error}=await client!.rpc('hf_respond_friend_request',{p_request_id:b.dataset.acceptRequest||b.dataset.declineRequest,p_accept:accept});if(error)throw error;setMessage(accept?'Neighbour added!':'Request declined.');await render();}catch(e){setMessage(e instanceof Error?e.message:String(e),true);b.disabled=false;}}));
  }
 }catch(e){host.innerHTML='<div class="friends-empty"><strong>Could not load Friends & Neighbours</strong><p>'+escapeHtml(e instanceof Error?e.message:String(e))+'</p><p>Check that the Happy Farm friends migration has been applied in Supabase.</p></div>';}
}
export function initializeFriends():void{
 if(initialized)return;initialized=true;
 el('top-friends')?.addEventListener('click',show);el('friends-close')?.addEventListener('click',hide);
 el('friends-modal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)hide();});
 document.querySelectorAll<HTMLButtonElement>('[data-friends-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.friendsTab as 'friends'|'add'|'requests')));
 if(!supabaseUrl||!supabaseKey){return;}
 client=getCloudSupabaseClient();
 userId=getCloudUserId();
 window.addEventListener('happyfarm:auth-changed',()=>{userId=getCloudUserId();if(el('friends-modal')?.classList.contains('open'))void render();});
}
