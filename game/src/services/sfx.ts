const ENABLED_KEY='happyFarmSfxEnabledV1';
const VOLUME_KEY='happyFarmSfxVolumeV1';
type SfxName='plow'|'plant'|'harvest'|'feed'|'egg'|'milk'|'coin'|'purchase'|'level'|'hen'|'chick'|'cow'|'rooster'|'bird'|'market'|'quest'|'reward'|'delivery';
// CC0 animal recordings/stylized calls from SFXMint. URLs are immutable and may be hotlinked under CC0 1.0.
const sampleUrls:Partial<Record<SfxName,string>>={
  hen:'https://sfxmint.com/dl/hen-cluck-02.mp3',
  chick:'https://sfxmint.com/dl/hen-cluck-02.mp3',
  cow:'https://sfxmint.com/dl/cow-moo-02.mp3',
  rooster:'https://sfxmint.com/dl/rooster-crow-02.mp3',
  bird:'https://sfxmint.com/dl/animal-bird-24.mp3'
};
const sampleCache=new Map<string,HTMLAudioElement>();
function playSample(name:SfxName,rate=1):void{
  const url=sampleUrls[name];if(!url)return;
  let source=sampleCache.get(url);
  if(!source){source=new Audio(url);source.preload='auto';sampleCache.set(url,source);}
  const audio=source.cloneNode(true) as HTMLAudioElement;
  audio.volume=Math.min(1,Math.max(0,volume*(name==='bird'?.22:.72)));
  audio.playbackRate=rate;
  void audio.play().catch(()=>{/* Browser may require another user gesture before audio playback. */});
}
let context:AudioContext|null=null;
let enabled=true;
let volume=0.55;
let initialized=false;
let ambientTimer:number|null=null;
let ambientUnlocked=false;

function stopAmbientBirds():void{
  if(ambientTimer!==null){window.clearTimeout(ambientTimer);ambientTimer=null;}
}
function scheduleAmbientBird():void{
  stopAmbientBirds();
  if(!ambientUnlocked||!enabled||document.hidden)return;
  ambientTimer=window.setTimeout(()=>{
    ambientTimer=null;
    if(enabled&&!document.hidden)playSample('bird');
    scheduleAmbientBird();
  },26000+Math.random()*22000);
}

function audioContext():AudioContext|null{
  try{
    const Ctx=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!Ctx)return null;
    context??=new Ctx();
    if(context.state==='suspended')void context.resume();
    return context;
  }catch{return null;}
}
function tone(ctx:AudioContext,frequency:number,start:number,duration:number,gain:number,type:OscillatorType='sine',endFrequency=frequency):void{
  const osc=ctx.createOscillator(),amp=ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(frequency,start);osc.frequency.exponentialRampToValueAtTime(Math.max(1,endFrequency),start+duration);
  amp.gain.setValueAtTime(0.0001,start);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,gain*volume),start+.012);amp.gain.exponentialRampToValueAtTime(.0001,start+duration);
  osc.connect(amp);amp.connect(ctx.destination);osc.start(start);osc.stop(start+duration+.02);
}
function noise(ctx:AudioContext,start:number,duration:number,gain:number,filter:number):void{
  const size=Math.ceil(ctx.sampleRate*duration),buffer=ctx.createBuffer(1,size,ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<size;i++)data[i]=Math.random()*2-1;
  const src=ctx.createBufferSource(),low=ctx.createBiquadFilter(),amp=ctx.createGain();
  src.buffer=buffer;low.type='lowpass';low.frequency.value=filter;
  amp.gain.setValueAtTime(gain*volume,start);amp.gain.exponentialRampToValueAtTime(.0001,start+duration);
  src.connect(low);low.connect(amp);amp.connect(ctx.destination);src.start(start);src.stop(start+duration);
}
export function playSfx(name:SfxName):void{
  if(!enabled)return;
  if(name==='hen'||name==='chick'||name==='cow'||name==='rooster'||name==='bird'){playSample(name,name==='chick'?1.35:1);return;}
  if(name==='egg')playSample('hen');
  if(name==='milk')playSample('cow');
  const ctx=audioContext();if(!ctx)return;const t=ctx.currentTime;
  switch(name){
    case'plow':noise(ctx,t,.22,.12,650);tone(ctx,115,t,.18,.08,'triangle',75);break;
    case'plant':tone(ctx,540,t,.08,.10,'sine',760);tone(ctx,820,t+.07,.10,.07,'sine',980);break;
    case'harvest':tone(ctx,660,t,.18,.13,'sine',880);tone(ctx,990,t+.10,.22,.11,'sine',1320);tone(ctx,1320,t+.22,.25,.08,'sine',1580);break;
    case'feed':noise(ctx,t,.13,.09,1100);tone(ctx,420,t+.05,.13,.07,'sine',520);break;
    case'egg':tone(ctx,880,t,.12,.12,'sine',1040);tone(ctx,1175,t+.11,.18,.09,'sine',1390);break;
    case'milk':tone(ctx,440,t,.16,.10,'sine',550);tone(ctx,660,t+.12,.20,.09,'sine',880);break;
    case'coin':tone(ctx,1250,t,.09,.12,'sine',1550);tone(ctx,1750,t+.08,.16,.10,'sine',1950);break;
    case'market':tone(ctx,620,t,.07,.07,'sine',740);tone(ctx,880,t+.06,.09,.06,'sine',990);break;
    case'quest':[784,988,1175].forEach((f,i)=>tone(ctx,f,t+i*.10,.20,.10,'sine',f*1.06));break;
    case'reward':[659,784,988,1318].forEach((f,i)=>tone(ctx,f,t+i*.09,.22,.11,'sine',f*1.04));break;
    case'delivery':tone(ctx,523,t,.10,.09,'sine',659);tone(ctx,784,t+.11,.13,.10,'sine',988);tone(ctx,1175,t+.25,.20,.10,'sine',1397);break;
    case'purchase':tone(ctx,523,t,.12,.10,'sine',659);tone(ctx,659,t+.12,.12,.10,'sine',784);tone(ctx,784,t+.24,.20,.10,'sine',1047);break;
    case'level':[523,659,784,1047,1318].forEach((f,i)=>tone(ctx,f,t+i*.11,.28,.10,'sine',f*1.03));break;
  }
}
export function initializeSfxControls():void{
  if(initialized)return;initialized=true;
  const toggle=document.getElementById('sfx-toggle') as HTMLButtonElement|null;
  const slider=document.getElementById('sfx-volume') as HTMLInputElement|null;
  const output=document.getElementById('sfx-volume-value') as HTMLOutputElement|null;
  if(!toggle||!slider||!output)return;
  enabled=localStorage.getItem(ENABLED_KEY)!=='false';
  const stored=localStorage.getItem(VOLUME_KEY);const parsed=stored===null?.55:Number(stored);
  volume=Number.isFinite(parsed)?Math.min(1,Math.max(0,parsed)):.55;
  const render=()=>{toggle.textContent='♪';toggle.setAttribute('aria-label',enabled?'Turn sound effects off':'Turn sound effects on');toggle.setAttribute('aria-pressed',String(enabled));toggle.title=enabled?'Turn sound effects off':'Turn sound effects on';slider.value=String(Math.round(volume*100));output.value=Math.round(volume*100)+'%';output.textContent=output.value;};
  toggle.addEventListener('click',()=>{enabled=!enabled;localStorage.setItem(ENABLED_KEY,String(enabled));if(enabled){void audioContext();scheduleAmbientBird();}else stopAmbientBirds();render();});
  slider.addEventListener('input',()=>{volume=Math.min(1,Math.max(0,Number(slider.value)/100));localStorage.setItem(VOLUME_KEY,String(volume));render();});
  const unlockAudio=():void=>{
    if(!enabled)return;
    void audioContext();
    ambientUnlocked=true;
    scheduleAmbientBird();
  };
  document.addEventListener('pointerdown',unlockAudio,{once:true});
  document.addEventListener('keydown',unlockAudio,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAmbientBirds();else scheduleAmbientBird();});
  window.addEventListener('happyfarm:sfx',event=>{const name=(event as CustomEvent<{sound:SfxName}>).detail?.sound;if(name)playSfx(name);});
  render();
}
