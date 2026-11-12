import Phaser from 'phaser';
import { FarmScene } from './scenes/FarmScene';
import './styles.css';
import { initializeMusicControls } from './services/music';
import { initializeSfxControls } from './services/sfx';

initializeMusicControls();
initializeSfxControls();

const VISITOR_MODE_KEY='happyFarmVisitorModeV1';
const VISITOR_BACKUP_KEY='happyFarmVisitorOriginalSaveV1';
const SAVE_KEY='happyFarmPhaserSaveV1';
// A closed tab clears sessionStorage. If a visit was interrupted, recover the
// original local farm before Phaser reads the temporary visitor snapshot.
if(!sessionStorage.getItem(VISITOR_MODE_KEY)){
  const interruptedBackup=localStorage.getItem(VISITOR_BACKUP_KEY);
  if(interruptedBackup){
    try{JSON.parse(interruptedBackup);localStorage.setItem(SAVE_KEY,interruptedBackup);}catch(error){console.error('Could not recover the local farm after a visitor session:',error);}
    localStorage.removeItem(VISITOR_BACKUP_KEY);
  }
}
const visitorRaw=sessionStorage.getItem(VISITOR_MODE_KEY);
if(visitorRaw){
  let visitor:{farmerName?:string;farmName?:string;level?:number}={};
  try{visitor=JSON.parse(visitorRaw);}catch{/* Keep the safe read-only visitor shell. */}
  document.body.classList.add('visitor-mode');
  const style=document.createElement('style');
  style.textContent=`
    /* Visitor farms are strictly read-only: leave only the farm view and return banner visible. */
    body.visitor-mode .topbar,body.visitor-mode .top-actions,body.visitor-mode .resources,
    body.visitor-mode .left-nav,body.visitor-mode .field-toolbar,body.visitor-mode .activity-drawer,
    body.visitor-mode .footer,body.visitor-mode .world-hint,body.visitor-mode .audio-dock,
    body.visitor-mode #settings-open,body.visitor-mode #edit-farm-profile,
    body.visitor-mode [id$="-modal"],body.visitor-mode .modal-backdrop,
    body.visitor-mode .side-panel,body.visitor-mode .drawer,body.visitor-mode .market-window,
    body.visitor-mode .world-panel{display:none!important}
    body.visitor-mode #game{pointer-events:none!important}
    body.visitor-mode button,body.visitor-mode input,body.visitor-mode select,
    body.visitor-mode textarea,body.visitor-mode [role="button"]{pointer-events:none!important}
    body.visitor-mode .visitor-banner,body.visitor-mode .visitor-banner *{pointer-events:auto!important}
    body.visitor-mode .world-panel{padding-bottom:0}
    body.visitor-mode .visitor-banner{position:fixed;z-index:30000;top:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:14px;max-width:calc(100vw - 24px);padding:10px 15px;border:2px solid #b58b4b;border-radius:16px;background:linear-gradient(#fff6d9,#e8c783);box-shadow:0 4px 14px #0004;color:#67451f;font:700 13px system-ui;white-space:nowrap}
    body.visitor-mode .visitor-banner button{border:1px solid #6d8f3c;border-radius:9px;padding:8px 12px;background:linear-gradient(#b9df82,#83b74d);color:#345b26;font-weight:900;cursor:pointer}
    @media(max-width:520px){body.visitor-mode .visitor-banner{gap:7px;padding:8px;font-size:10px}body.visitor-mode .visitor-banner button{padding:7px;font-size:10px}}
  `;
  document.head.append(style);
  // Block delegated UI handlers and keyboard shortcuts while viewing a neighbour's farm.
  document.addEventListener('click',(event)=>{
    if(!(event.target instanceof Element)||!event.target.closest('.visitor-banner')){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  document.addEventListener('keydown',(event)=>{
    if(event.key==='Escape'||event.key==='Tab')return;
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  const banner=document.createElement('div');
  banner.className='visitor-banner';
  const label=document.createElement('span');
  label.textContent='🏡 Visiting '+(visitor.farmName||'Neighbour Farm')+' · '+(visitor.farmerName||'Neighbour')+' · Level '+(visitor.level||1);
  const exit=document.createElement('button');
  exit.type='button';exit.textContent='← Return to My Farm';
  exit.addEventListener('click',()=>{
    const ownSave=localStorage.getItem(VISITOR_BACKUP_KEY);
    if(!ownSave){window.alert('Your local farm backup is missing. Visitor mode will stay open to avoid replacing your farm with an empty save.');return;}
    try{JSON.parse(ownSave);localStorage.setItem(SAVE_KEY,ownSave);localStorage.removeItem(VISITOR_BACKUP_KEY);sessionStorage.removeItem(VISITOR_MODE_KEY);window.location.reload();}
    catch(error){window.alert('Could not restore your farm: '+(error instanceof Error?error.message:String(error)));}
  });
  banner.append(label,exit);document.body.append(banner);
}

const loadingScreen=document.getElementById('loading-screen');
const loadingFill=document.getElementById('loading-progress-fill');
const loadingStatus=document.getElementById('loading-status');
const loadingPercent=document.getElementById('loading-percent');
window.addEventListener('happyfarm:loading',(event)=>{
  const progress=Math.max(0,Math.min(1,Number((event as CustomEvent<{progress:number}>).detail?.progress)||0));
  if(loadingFill)(loadingFill as HTMLElement).style.width=Math.round(progress*100)+'%';
  if(loadingPercent)loadingPercent.textContent=Math.round(progress*100)+'%';
  if(loadingStatus&&progress>=1)loadingStatus.firstChild!.textContent='Opening the farm… ';
});
window.addEventListener('happyfarm:ready',()=>{
  if(loadingFill)(loadingFill as HTMLElement).style.width='100%';
  if(loadingPercent)loadingPercent.textContent='100%';
  if(loadingStatus)loadingStatus.firstChild!.textContent='Your farm is ready! ';
  window.setTimeout(()=>loadingScreen?.classList.add('is-hidden'),450);
  window.setTimeout(()=>loadingScreen?.remove(),1150);
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1100,
  height: 720,
  transparent: true,
  antialias: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1100,
    height: 720,
  },
  // The farm supports one-finger taps/panning and two-finger pinch zoom.
  // Phaser otherwise enables only one active touch pointer by default.
  input: { activePointers: 3 },
  scene: [FarmScene],
  render: { roundPixels: true, powerPreference: 'high-performance' },
});

window.addEventListener('beforeunload', () => game.destroy(true));
