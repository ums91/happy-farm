import Phaser from 'phaser';
import { FarmScene } from './scenes/FarmScene';
import './styles.css';
import { initializeMusicControls } from './services/music';
import { initializeSfxControls } from './services/sfx';

initializeMusicControls();
initializeSfxControls();

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
