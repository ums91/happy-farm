import type { SupabaseClient } from '@supabase/supabase-js';
import { getCloudSupabaseClient, getCloudUserId, queueCloudSave } from './cloudSave';

const SAVE_KEY='happyFarmPhaserSaveV1';
const VISITOR_BACKUP_KEY='happyFarmVisitorOriginalSaveV1';
const VISITOR_MODE_KEY='happyFarmVisitorModeV1';
type Farmer={friend_code:string;farmer_name:string;farm_name:string;level:number;xp?:number};
type Friend=Farmer&{friend_user_id:string;friends_since?:string};
type Request=Farmer&{request_id:string;direction:'incoming'|'outgoing';created_at:string};
let client:SupabaseClient|null=null;
let userId:string|null=null;
let initialized=false;
let activeTab:'friends'|'add'|'requests'|'gifts'|'visits'|'jobs'='friends';
const el=(id:string)=>document.getElementById(id);
function escapeHtml(value:unknown):string{return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));}
function getLocalProfile(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');const xp=Math.max(0,Number(s.xp)||0);let level=1,total=0;while(level<100){const next=120+14*(level-1)*(level-1);if(xp<total+next)break;total+=next;level++;}return{farmerName:String(s.farmerName||'New Farmer').slice(0,24),farmName:String(s.farmName||'My Farm').slice(0,28),level,xp};}catch{return{farmerName:'New Farmer',farmName:'My Farm',level:1,xp:0};}}
async function visitFriend(friend:Friend,button:HTMLButtonElement){
 if(!client||!userId){setMessage('Sign in before visiting a neighbour.',true);return;}
 if(sessionStorage.getItem(VISITOR_MODE_KEY)){setMessage('You are already visiting a neighbour.',true);return;}
 button.disabled=true;button.textContent='Loading farm…';
 try{
  const {data,error}=await client.rpc('hf_get_friend_farm',{p_friend_user_id:friend.friend_user_id});
  if(error)throw error;
  const save=(Array.isArray(data)?data[0]:data) as Record<string,unknown>|null;
  if(!save||!Array.isArray(save.plots)||!Array.isArray(save.animals)||!save.inventory||!save.feed)throw new Error('This neighbour farm save is incomplete or unavailable.');
  const ownSave=localStorage.getItem(SAVE_KEY);
  if(!ownSave)throw new Error('Your local farm save could not be found. Visit cancelled to protect your farm.');
  const {data:visitData,error:visitError}=await client.rpc('hf_record_friend_visit',{p_friend_user_id:friend.friend_user_id});
  if(visitError)throw visitError;
  const visit=(Array.isArray(visitData)?visitData[0]:visitData) as {points_awarded:number;total_visit_points:number;already_visited:boolean};
  localStorage.setItem(VISITOR_BACKUP_KEY,ownSave);
  sessionStorage.setItem(VISITOR_MODE_KEY,JSON.stringify({farmerName:friend.farmer_name,farmName:friend.farm_name,level:friend.level,visitPointsAwarded:Number(visit?.points_awarded)||0}));
  localStorage.setItem(SAVE_KEY,JSON.stringify(save));
  window.location.reload();
 }catch(e){button.disabled=false;button.textContent='🏡 Visit Farm';setMessage(e instanceof Error?e.message:String(e),true);}
}

type CoopJob={job_id:string;title:string;description:string;requirement_key:string;requirement_label:string;requirement_emoji:string;target_quantity:number;contributed_quantity:number;starts_at:string;ends_at:string;status:'active'|'completed'|'expired';reward_coins:number;reward_xp:number;reward_badge:string|null;my_contribution:number;my_reward_claimed:boolean;participant_count:number};
const coopCatalog:Record<string,{kind:'crop'|'fruit'|'produce'|'crafted';key:string;emoji:string;label:string}>={
 wheat:{kind:'crop',key:'wheat',emoji:'🌾',label:'Wheat'},carrot:{kind:'crop',key:'carrot',emoji:'🥕',label:'Carrots'},
 corn:{kind:'crop',key:'corn',emoji:'🌽',label:'Corn'},strawberry:{kind:'crop',key:'strawberry',emoji:'🍓',label:'Strawberries'},
 tomato:{kind:'crop',key:'tomato',emoji:'🍅',label:'Tomatoes'},pumpkin:{kind:'crop',key:'pumpkin',emoji:'🎃',label:'Pumpkins'},
 blueberry:{kind:'crop',key:'blueberry',emoji:'🫐',label:'Blueberries'},watermelon:{kind:'crop',key:'watermelon',emoji:'🍉',label:'Watermelons'},
 apples:{kind:'fruit',key:'apples',emoji:'🍎',label:'Apples'},pears:{kind:'fruit',key:'pears',emoji:'🍐',label:'Pears'},
 cherries:{kind:'fruit',key:'cherries',emoji:'🍒',label:'Cherries'},oranges:{kind:'fruit',key:'oranges',emoji:'🍊',label:'Oranges'},
 eggs:{kind:'produce',key:'eggs',emoji:'🥚',label:'Eggs'},milk:{kind:'produce',key:'milk',emoji:'🥛',label:'Milk'},
 flour:{kind:'crafted',key:'flour',emoji:'🌾',label:'Flour'},bread:{kind:'crafted',key:'bread',emoji:'🍞',label:'Bread'},
 pastry:{kind:'crafted',key:'pastry',emoji:'🥐',label:'Pastries'},grapes:{kind:'crafted',key:'grapes',emoji:'🍇',label:'Grapes'}
};
function localAvailableForJob(requirement:string):number{
 const item=coopCatalog[requirement];if(!item)return 0;
 try{const save=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}') as Record<string,any>;
  const amount=item.kind==='crop'?save.harvestedCrops?.[item.key]:item.kind==='fruit'?save.fruitInventory?.[item.key]:item.kind==='produce'?save.produce?.[item.key]:save.crafted?.[item.key];
  return Math.max(0,Math.floor(Number(amount)||0));
 }catch{return 0;}
}
function deductLocalContribution(requirement:string,quantity:number):void{
 const item=coopCatalog[requirement];if(!item)throw new Error('Unsupported contribution item.');
 const raw=localStorage.getItem(SAVE_KEY);if(!raw)throw new Error('Your local farm save is missing. Contribution cancelled.');
 const save=JSON.parse(raw) as Record<string,any>;
 const bucket=item.kind==='crop'?'harvestedCrops':item.kind==='fruit'?'fruitInventory':item.kind==='produce'?'produce':'crafted';
 const current=Number(save[bucket]?.[item.key]);
 if(!Number.isFinite(current)||current<quantity)throw new Error('Your available stock changed. Refresh the job before contributing.');
 save[bucket][item.key]=current-quantity;
 localStorage.setItem(SAVE_KEY,JSON.stringify(save));
 localStorage.setItem('happyFarmLocalUpdatedAtV1',String(Math.max(Date.now(),Number(localStorage.getItem('happyFarmLocalUpdatedAtV1')||0)+1)));
 localStorage.setItem('happyFarmLocalDirtyV1','true');
 queueCloudSave();
}
function formatJobRemaining(value:string):string{
 const ms=Math.max(0,Date.parse(value)-Date.now());const days=Math.floor(ms/86400000),hours=Math.floor(ms%86400000/3600000),minutes=Math.floor(ms%3600000/60000);
 return days?days+'d '+hours+'h':hours?hours+'h '+minutes+'m':minutes+'m';
}
async function renderCooperativeJobs(host:HTMLElement,api:SupabaseClient):Promise<void>{
 host.innerHTML='<div class="friends-loading">🚜 Loading village community jobs…</div>';
 const {data,error}=await api.rpc('hf_list_cooperative_jobs');if(error)throw error;
 const jobs=(data||[]) as CoopJob[];
 if(!jobs.length){host.innerHTML='<div class="friends-empty"><strong>No community jobs available</strong><p>Check back soon for the next village goal.</p></div>';return;}
 host.innerHTML='<div class="coop-jobs-intro"><strong>🤝 Together, our farms grow stronger</strong><p>Contribute crops and animal goods before the timer ends. Every farmer who contributes earns the shared reward when the village completes the goal.</p></div>'+jobs.map(job=>{
  const pct=Math.min(100,Math.round(job.contributed_quantity/job.target_quantity*100)),done=job.status==='completed',expired=Date.parse(job.ends_at)<=Date.now(),available=localAvailableForJob(job.requirement_key),claimed=job.my_reward_claimed;
  const eligible=job.my_contribution>0;
  return '<article class="coop-job-card" data-coop-card="'+escapeHtml(job.job_id)+'"><div class="coop-job-heading"><span class="coop-job-emoji">'+escapeHtml(job.requirement_emoji)+'</span><div><strong>'+escapeHtml(job.title)+'</strong><small>'+escapeHtml(job.description)+'</small></div><span class="coop-job-status '+(done?'complete':expired?'expired':'active')+'">'+(done?'✓ Goal reached':expired?'Ended':'● Live')+'</span></div><div class="coop-progress-label"><strong>'+job.contributed_quantity.toLocaleString()+' / '+job.target_quantity.toLocaleString()+' '+escapeHtml(job.requirement_label)+'</strong><span>'+pct+'%</span></div><div class="coop-progress-track"><i style="width:'+pct+'%"></i></div><div class="coop-job-meta"><span>👩‍🌾 '+Number(job.participant_count||0)+' farmers</span><span>⏳ '+(done?'Completed':formatJobRemaining(job.ends_at)+' left')+'</span><span>🤝 You: '+Number(job.my_contribution||0)+'</span></div><div class="coop-reward-row"><span>🏅 Reward <b>🪙 '+job.reward_coins+'</b> · <b>⭐ '+job.reward_xp+' XP</b>'+(job.reward_badge?' · '+escapeHtml(job.reward_badge):'')+'</span><span>Stock: '+available+'</span></div>'+(done?(eligible?'<button class="coop-job-action" data-claim-coop="'+escapeHtml(job.job_id)+'" '+(claimed?'disabled':'')+'>'+(claimed?'✓ Reward claimed':'🎁 Claim your reward')+'</button>':'<p class="coop-job-note">The village reached its goal. You did not contribute to this job.</p>'):expired?'<p class="coop-job-note">This job expired before the community goal was reached.</p>':available>0?'<div class="coop-contribute-row"><label>Contribute <input type="number" min="1" max="'+Math.min(100,available,job.target_quantity-job.contributed_quantity)+'" value="'+Math.min(5,available,job.target_quantity-job.contributed_quantity)+'" data-coop-qty="'+escapeHtml(job.job_id)+'"></label><button class="coop-job-action" data-contribute-coop="'+escapeHtml(job.job_id)+'">🚜 Contribute goods</button></div>':'<p class="coop-job-note">You need '+escapeHtml(job.requirement_label.toLowerCase())+' in storage to contribute.</p>')+'</article>';
 }).join('');
 host.querySelectorAll<HTMLButtonElement>('[data-contribute-coop]').forEach(button=>button.addEventListener('click',async()=>{
  const id=button.dataset.contributeCoop||'',job=jobs.find(item=>item.job_id===id);if(!job)return;
  const input=host.querySelector<HTMLInputElement>('[data-coop-qty="'+CSS.escape(id)+'"]');
  const quantity=Math.floor(Number(input?.value)||0),available=localAvailableForJob(job.requirement_key);
  if(quantity<1||quantity>100||quantity>available){setMessage('Choose a valid amount from your available storage (maximum 100 at a time).',true);return;}
  button.disabled=true;button.textContent='Contributing…';
  try{
   // Recheck local stock immediately before calling the atomic server contribution.
   if(localAvailableForJob(job.requirement_key)<quantity)throw new Error('Your stock changed. Refresh the job and try again.');
   const {data,error}=await api.rpc('hf_contribute_cooperative_job',{p_job_id:id,p_quantity:quantity});if(error)throw error;
   const result=(Array.isArray(data)?data[0]:data) as {contributed_now:number;total_contributed:number;my_total:number;job_status:string};
   const accepted=Number(result?.contributed_now)||0;if(accepted<1)throw new Error('No items were accepted.');
   deductLocalContribution(job.requirement_key,accepted);
   window.dispatchEvent(new Event('happyfarm:coop-inventory-changed'));
   setMessage('🌾 Contributed '+accepted+' '+job.requirement_label.toLowerCase()+'. Village progress: '+Number(result.total_contributed).toLocaleString()+'.');
   await renderCooperativeJobs(host,api);
  }catch(e){setMessage(e instanceof Error?e.message:String(e),true);button.disabled=false;button.textContent='🚜 Contribute goods';}
 }));
 host.querySelectorAll<HTMLButtonElement>('[data-claim-coop]').forEach(button=>button.addEventListener('click',async()=>{
  const id=button.dataset.claimCoop||'';button.disabled=true;button.textContent='Claiming…';
  try{
   const {data,error}=await api.rpc('hf_claim_cooperative_job_reward',{p_job_id:id});if(error)throw error;
   const reward=(Array.isArray(data)?data[0]:data) as {coins:number;xp:number;badge:string|null};
   const raw=localStorage.getItem(SAVE_KEY);if(!raw)throw new Error('Reward accepted, but local save is missing. Use cloud recovery before continuing.');
   const save=JSON.parse(raw) as Record<string,any>;
   save.coins=Math.max(0,Number(save.coins)||0)+Number(reward.coins||0);
   save.xp=Math.max(0,Number(save.xp)||0)+Number(reward.xp||0);
   save.cooperativeBadges=Array.isArray(save.cooperativeBadges)?save.cooperativeBadges:[];
   if(reward.badge&&!save.cooperativeBadges.includes(reward.badge))save.cooperativeBadges.push(reward.badge);
   localStorage.setItem(SAVE_KEY,JSON.stringify(save));localStorage.setItem('happyFarmLocalDirtyV1','true');queueCloudSave();
   window.dispatchEvent(new Event('happyfarm:coop-reward-claimed'));
   setMessage('🎉 Reward claimed! +'+reward.coins+' coins · +'+reward.xp+' XP'+(reward.badge?' · Badge: '+reward.badge:''));
   await renderCooperativeJobs(host,api);
  }catch(e){setMessage(e instanceof Error?e.message:String(e),true);button.disabled=false;button.textContent='🎁 Claim your reward';}
 }));
}

function setMessage(message:string,error=false){const node=el('friends-status');if(node){node.textContent=message;node.classList.toggle('is-error',error);}}
function show(){el('friends-modal')?.classList.add('open');el('friends-modal')?.setAttribute('aria-hidden','false');void render();}
function hide(){el('friends-modal')?.classList.remove('open');el('friends-modal')?.setAttribute('aria-hidden','true');}
function setTab(tab:'friends'|'add'|'requests'|'gifts'|'visits'|'jobs'){activeTab=tab;document.querySelectorAll<HTMLButtonElement>('[data-friends-tab]').forEach(b=>b.classList.toggle('active',b.dataset.friendsTab===tab));void render();}
async function syncProfile(api:SupabaseClient){if(!userId)throw new Error('Sign in to create your Farmer ID.');const p=getLocalProfile();const {data,error}=await api.rpc('hf_sync_my_farmer_profile',{p_farmer_name:p.farmerName,p_farm_name:p.farmName,p_level:p.level,p_xp:p.xp});if(error)throw error;return (Array.isArray(data)?data[0]:data) as Farmer;}
async function render(){
 const host=el('friends-content');if(!host)return;
 const api=client;
 if(!api){host.innerHTML='<div class="friends-empty"><strong>Cloud friends are not configured</strong><p>Configure Supabase cloud saves to use Friends & Neighbours.</p></div>';return;}
 if(!userId){host.innerHTML='<div class="friends-empty"><strong>Sign in to meet your neighbours</strong><p>Friends are linked to your cloud account so your list stays safe across devices.</p><button type="button" id="friends-signin">☁ Sign in / Create account</button></div>';el('friends-signin')?.addEventListener('click',()=>{hide();el('cloud-account')?.click();});return;}
 host.innerHTML='<div class="friends-loading">🌻 Loading your neighbours…</div>';
 try{
  const me=await syncProfile(api);
  const code=el('my-friend-code');if(code)code.textContent=me.friend_code;
  const name=el('my-farmer-name');if(name)name.textContent=me.farmer_name;
   const [{data:points,error:pointsError},{data:visitPoints,error:visitPointsError}]=await Promise.all([api.rpc('hf_get_my_neighbour_points'),api.rpc('hf_get_my_visit_points')]);if(pointsError)throw pointsError;if(visitPointsError)throw visitPointsError;
   setMessage('🌟 Neighbour points: '+Number(points||0).toLocaleString()+' · 🏡 Visit points: '+Number(visitPoints||0).toLocaleString());
  if(activeTab==='friends'){
   const {data,error}=await api.rpc('hf_list_friends');if(error)throw error;
   const friends=(data||[]) as Friend[];
   host.innerHTML=friends.length?'<div class="friends-list">'+friends.map(f=>'<article class="friend-card"><div class="friend-avatar">👨‍🌾</div><div class="friend-info"><strong>'+escapeHtml(f.farmer_name)+'</strong><small>'+escapeHtml(f.farm_name)+' · Level '+f.level+'</small><small>Friend Code: '+escapeHtml(f.friend_code)+'</small></div><button type="button" class="friend-visit" data-visit-friend="'+escapeHtml(f.friend_user_id)+'">🏡 Visit Farm</button><button type="button" class="friend-help" data-help-friend="'+escapeHtml(f.friend_user_id)+'">🌻 Help today · +5 points</button><button type="button" class="friend-gift" data-send-gift="'+escapeHtml(f.friend_user_id)+'">🎁 Send 25 coins</button><button type="button" class="friend-remove" data-remove-friend="'+escapeHtml(f.friend_user_id)+'" title="Remove neighbour">✕</button></article>').join('')+'</div>':'<div class="friends-empty"><div class="friends-big-icon">🌻</div><strong>Your neighbour list is waiting!</strong><p>Add farmers using their Friend Code to start building your neighbourhood.</p><button type="button" id="friends-add-first">＋ Add your first friend</button></div>';
   host.querySelector('#friends-add-first')?.addEventListener('click',()=>setTab('add'));
   host.querySelectorAll<HTMLButtonElement>('[data-visit-friend]').forEach(b=>b.addEventListener('click',()=>{const friend=friends.find(f=>f.friend_user_id===b.dataset.visitFriend);if(friend)void visitFriend(friend,b);}));
   host.querySelectorAll<HTMLButtonElement>('[data-help-friend]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;b.textContent='Helping…';try{const {data,error}=await api.rpc('hf_help_neighbour',{p_friend_user_id:b.dataset.helpFriend});if(error)throw error;const result=(Array.isArray(data)?data[0]:data) as {points_awarded:number;total_points:number};setMessage('🌻 Neighbour helped! +'+Number(result?.points_awarded||5)+' points · Total '+Number(result?.total_points||0).toLocaleString());await render();}catch(e){setMessage(e instanceof Error?e.message:String(e),true);b.disabled=false;b.textContent='🌻 Help today · +5 points';}}));
   host.querySelectorAll<HTMLButtonElement>('[data-send-gift]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;b.textContent='Sending…';try{const {error}=await api.rpc('hf_send_gift',{p_friend_user_id:b.dataset.sendGift});if(error)throw error;setMessage('Gift sent! Your neighbour can collect 25 coins.');await render();}catch(e){setMessage(e instanceof Error?e.message:String(e),true);b.disabled=false;b.textContent='🎁 Send 25 coins';}}));
   host.querySelectorAll<HTMLButtonElement>('[data-remove-friend]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Remove this neighbour from your friends list?'))return;try{const {error}=await api.rpc('hf_remove_friend',{p_friend_user_id:b.dataset.removeFriend});if(error)throw error;setMessage('Neighbour removed.');await render();}catch(e){setMessage(e instanceof Error?e.message:String(e),true);}}));
  }else if(activeTab==='add'){
   host.innerHTML='<form class="friends-add-form" id="friends-search-form"><label for="friend-code-input">Enter a Farmer Friend Code</label><div class="friends-code-row"><input id="friend-code-input" maxlength="8" minlength="8" autocomplete="off" placeholder="e.g. A1B2C3D4" required/><button type="submit">Search</button></div><p>Ask your friend to share the 8-character code shown on their Friends panel.</p></form><div id="friends-search-result"></div>';
   el('friends-search-form')?.addEventListener('submit',async event=>{event.preventDefault();const input=el('friend-code-input') as HTMLInputElement;const result=el('friends-search-result');if(!result)return;const code=input.value.trim().toUpperCase();if(!/^[A-Z0-9]{8}$/.test(code)){result.innerHTML='<p class="friends-error">Enter a valid 8-character Friend Code.</p>';return;}result.innerHTML='<p>Searching…</p>';try{const {data,error}=await api.rpc('hf_search_farmer',{p_friend_code:code});if(error)throw error;const found=(data||[]) as Farmer[];if(!found.length){result.innerHTML='<p class="friends-error">No farmer found with that code.</p>';return;}const f=found[0];result.innerHTML='<article class="friend-card friend-search-result"><div class="friend-avatar">👨‍🌾</div><div class="friend-info"><strong>'+escapeHtml(f.farmer_name)+'</strong><small>'+escapeHtml(f.farm_name)+' · Level '+f.level+'</small><small>Friend Code: '+escapeHtml(f.friend_code)+'</small></div><button id="send-friend-request" type="button">＋ Add</button></article>';el('send-friend-request')?.addEventListener('click',async()=>{const btn=el('send-friend-request') as HTMLButtonElement;btn.disabled=true;try{const {error}=await api.rpc('hf_send_friend_request',{p_friend_code:code});if(error)throw error;result.innerHTML='<p class="friends-success">Friend request sent to '+escapeHtml(f.farmer_name)+'!</p>';}catch(e){btn.disabled=false;result.innerHTML='<p class="friends-error">'+escapeHtml(e instanceof Error?e.message:String(e))+'</p>';}});}catch(e){result.innerHTML='<p class="friends-error">'+escapeHtml(e instanceof Error?e.message:String(e))+'</p>';}}); 
  }else if(activeTab==='gifts'){
   const [inbox,sent]=await Promise.all([api.rpc('hf_list_my_gifts'),api.rpc('hf_list_sent_gifts')]);
   if(inbox.error)throw inbox.error;if(sent.error)throw sent.error;
   const received=(inbox.data||[]) as Array<{gift_id:string;sender_name:string;sender_farm:string;coins:number;sent_at:string}>;
   const outgoing=(sent.data||[]) as Array<{receiver_name:string;coins:number;sent_at:string}>;
   host.innerHTML='<section class="friends-gift-section"><h3>🎁 Gifts waiting for you</h3>'+(received.length?received.map(g=>'<article class="friend-card"><div class="friend-avatar">🎁</div><div class="friend-info"><strong>'+escapeHtml(g.sender_name)+'</strong><small>'+escapeHtml(g.sender_farm)+' sent you a gift</small><small>🪙 '+g.coins+' coins</small></div><button type="button" class="friend-visit" data-claim-gift="'+escapeHtml(g.gift_id)+'">Collect</button></article>').join(''):'<div class="friends-empty"><p>No gifts waiting right now. Ask your neighbours to send you one!</p></div>')+'</section><section class="friends-gift-section"><h3>📨 Gifts sent today</h3>'+(outgoing.length?outgoing.map(g=>'<p class="friends-gift-sent">🎁 '+escapeHtml(g.receiver_name)+' · '+g.coins+' coins · Sent</p>').join(''):'<p class="friends-gift-sent">You have not sent any gifts today.</p>')+'</section>';
   host.querySelectorAll<HTMLButtonElement>('[data-claim-gift]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;b.textContent='Collecting…';try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)throw new Error('Your local farm save is unavailable. Gift collection was not attempted.');const save=JSON.parse(raw) as Record<string,unknown>;if(!Number.isFinite(Number(save.coins)))throw new Error('Your local farm save is invalid. Gift collection was not attempted.');const {data,error}=await api.rpc('hf_claim_gift',{p_gift_id:b.dataset.claimGift});if(error)throw error;const amount=Number(data)||0;if(amount<=0)throw new Error('This gift has already been collected.');save.coins=Math.max(0,Number(save.coins)||0)+amount;localStorage.setItem(SAVE_KEY,JSON.stringify(save));queueCloudSave();window.location.reload();}catch(e){b.disabled=false;b.textContent='Collect';setMessage(e instanceof Error?e.message:String(e),true);}}));
  }else if(activeTab==='jobs'){
   await renderCooperativeJobs(host,api);
  }else if(activeTab==='visits'){
   const [{data:visitsData,error:visitsError},{data:visitorsData,error:visitorsError}]=await Promise.all([api.rpc('hf_list_my_friend_visits'),api.rpc('hf_list_my_farm_visitors')]);
   if(visitsError)throw visitsError;if(visitorsError)throw visitorsError;
   const visits=(visitsData||[]) as Array<{farmer_name:string;farm_name:string;visited_at:string;points_awarded:number}>;
   const visitors=(visitorsData||[]) as Array<{farmer_name:string;farm_name:string;visited_at:string;points_awarded:number}>;
   const formatVisitDate=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?'Date unavailable':date.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});};
   const visitRows=(rows:typeof visits,empty:string,pointLabel:(points:number)=>string)=>rows.length?'<div class="friends-visit-list">'+rows.map(v=>'<article class="friends-visit-row"><div class="friend-avatar">🏡</div><div class="friend-info"><strong>'+escapeHtml(v.farmer_name)+'</strong><small>'+escapeHtml(v.farm_name)+'</small><small>'+escapeHtml(formatVisitDate(v.visited_at))+'</small></div><span class="friends-visit-points">'+escapeHtml(pointLabel(Number(v.points_awarded)||0))+'</span></article>').join('')+'</div>':'<p class="friends-visit-empty">'+empty+'</p>';
   host.innerHTML='<section class="friends-visit-section"><h3>🚶 Neighbours you visited</h3><p class="friends-visit-intro">Your latest 20 outgoing visits. Earn 10 visit points for each neighbour once per day.</p>'+visitRows(visits,'You have not visited any neighbours yet.',points=>'+'+points+' pts earned')+'</section><section class="friends-visit-section"><h3>👋 Farmers who visited you</h3><p class="friends-visit-intro">Your latest 20 incoming farm visits.</p>'+visitRows(visitors,'No one has visited your farm yet. Share your Farmer ID with neighbours!',points=>'Visitor earned +'+points+' pts')+'</section>';
  }else{
   const {data,error}=await api.rpc('hf_list_friend_requests');if(error)throw error;const requests=(data||[]) as Request[];
   host.innerHTML=requests.length?'<div class="friends-list">'+requests.map(r=>'<article class="friend-card"><div class="friend-avatar">'+(r.direction==='incoming'?'📨':'⏳')+'</div><div class="friend-info"><strong>'+escapeHtml(r.farmer_name)+'</strong><small>'+escapeHtml(r.farm_name)+' · Level '+r.level+'</small><small>'+(r.direction==='incoming'?'Wants to be your neighbour':'Request sent · Waiting for response')+'</small></div>'+(r.direction==='incoming'?'<div class="friend-request-actions"><button type="button" data-accept-request="'+escapeHtml(r.request_id)+'">Accept</button><button type="button" data-decline-request="'+escapeHtml(r.request_id)+'">Decline</button></div>':'')+'</article>').join('')+'</div>':'<div class="friends-empty"><div class="friends-big-icon">📬</div><strong>No pending requests</strong><p>New neighbour requests will appear here.</p></div>';
   for(const [selector,accept] of [['[data-accept-request]',true],['[data-decline-request]',false]] as const)host.querySelectorAll<HTMLButtonElement>(selector).forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{const {error}=await api.rpc('hf_respond_friend_request',{p_request_id:b.dataset.acceptRequest||b.dataset.declineRequest,p_accept:accept});if(error)throw error;setMessage(accept?'Neighbour added!':'Request declined.');await render();}catch(e){setMessage(e instanceof Error?e.message:String(e),true);b.disabled=false;}}));
  }
 }catch(e){host.innerHTML='<div class="friends-empty"><strong>Could not load Friends & Neighbours</strong><p>'+escapeHtml(e instanceof Error?e.message:String(e))+'</p><p>Check that the Happy Farm friends migration has been applied in Supabase.</p></div>';}
}
export function initializeFriends():void{
 if(initialized)return;initialized=true;
 el('top-friends')?.addEventListener('click',show);el('friends-close')?.addEventListener('click',hide);
 el('friends-modal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)hide();});
 el('copy-friend-code')?.addEventListener('click',async()=>{const code=el('my-friend-code')?.textContent||'';if(!code||code==='--------')return;try{await navigator.clipboard.writeText(code);setMessage('Friend Code copied. Share it with your neighbour!');}catch{setMessage('Your Friend Code is '+code);}});
 document.querySelectorAll<HTMLButtonElement>('[data-friends-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.friendsTab as 'friends'|'add'|'requests'|'gifts'|'visits'|'jobs')));
 client=getCloudSupabaseClient();
 userId=getCloudUserId();
 window.addEventListener('happyfarm:auth-changed',()=>{userId=getCloudUserId();if(el('friends-modal')?.classList.contains('open'))void render();});
}
