import Phaser from 'phaser';
import { initializeCloudSaves, queueCloudSave } from '../services/cloudSave';

type Tool = 'select' | 'plow' | 'plant' | 'water' | 'harvest' | 'move';
type PlotState = 'grass' | 'tilled' | 'growing' | 'ready' | 'withered';
type CropId = 'wheat' | 'carrot' | 'corn' | 'strawberry' | 'tomato' | 'pumpkin' | 'blueberry' | 'watermelon';
interface Plot { col: number; row: number; state: PlotState; watered: boolean; growth: number; crop: CropId; readyAt: number; witherAt: number }
type AnimalId = 'hen' | 'cow';
interface Animal { id: AnimalId; readyAt: number; assigned?: boolean }
interface BuildingProgress { coopLevel: number; barnLevel: number; warehouseLevel: number }
interface AnimalProduce { eggs: number; milk: number }
type BuildingId = 'coop'|'barn'|'silo'|'bakery'|'greenhouse'|'windmill'|'stable'|'well'|'workshop'|'waterTower';
type ProductId='flour'|'bread'|'pastry'|'grapes';
interface ProductionJob { recipe:string; readyAt:number }
interface FarmSave { version: 16; farmExpansionLevel?:number; questRefreshAt?:number; questProgressBaseline?:Partial<Record<'harvests'|'hens'|'cows'|'eggs'|'milk',number>>; eventStartedAt?:number; eventStartHarvests?:number; eventClaimed?:boolean; claimedMilestones?:number[]; harvestedCrops?:Partial<Record<CropId,number>>; fruitInventory?:Record<'apples'|'pears'|'cherries',number>; fruitTreeReadyAt?:Record<string,number>; farmerName?:string; farmName?:string; buildingLevels?:Partial<Record<BuildingId,number>>; productionJobs?:Partial<Record<BuildingId,ProductionJob|null>>; crafted?:Partial<Record<ProductId,number>>; randomQuests?: Array<{id:string;title:string;description:string;target:number;coins:number;xp:number;icon:string;metric:'harvests'|'hens'|'cows'|'eggs'|'milk'}>; claimedQuests?: string[]; ordersCompleted?: Record<string,number>; animals: Animal[]; harvests: number; coins: number; xp: number; selectedCrop?: CropId; decor?: Record<string,{col:number;row:number}>; feed: { hen: number; cow: number }; buildings?: BuildingProgress; produce?: AnimalProduce; inventory: Record<CropId, number>; plots: Array<{ col:number; row:number; state:PlotState; watered:boolean; growth:number; crop?:CropId; readyAt?:number; witherAt?:number }> }
const CROPS: Record<CropId,{name:string;emoji:string;cost:number;reward:number;xp:number;growMs:number;color:number;unlockLevel:number}> = {
 wheat:{name:'Wheat',emoji:'🌾',cost:5,reward:18,xp:5,growMs:2*60*1000,color:0xe4b83f,unlockLevel:1},
 carrot:{name:'Carrot',emoji:'🥕',cost:9,reward:31,xp:8,growMs:5*60*1000,color:0xef873e,unlockLevel:1},
 corn:{name:'Corn',emoji:'🌽',cost:14,reward:48,xp:12,growMs:10*60*1000,color:0xf2c94c,unlockLevel:7},
 strawberry:{name:'Strawberry',emoji:'🍓',cost:20,reward:70,xp:18,growMs:20*60*1000,color:0xd94f55,unlockLevel:13},
 tomato:{name:'Tomato',emoji:'🍅',cost:27,reward:91,xp:22,growMs:30*60*1000,color:0xe65c45,unlockLevel:19},
 pumpkin:{name:'Pumpkin',emoji:'🎃',cost:36,reward:125,xp:29,growMs:45*60*1000,color:0xe98d35,unlockLevel:25},
 blueberry:{name:'Blueberry',emoji:'🫐',cost:48,reward:165,xp:38,growMs:60*60*1000,color:0x6556a8,unlockLevel:31},
 watermelon:{name:'Watermelon',emoji:'🍉',cost:65,reward:220,xp:50,growMs:90*60*1000,color:0x65a94f,unlockLevel:37}
};

const COLS = 13;
const ROWS = 13;
const FARM_SIZES = [7,9,11,13] as const;
const FARM_EXPANSION_COSTS = [0,800,1800,3500] as const;
const FARM_EXPANSION_LEVELS = [1,3,5,7] as const;
const TILE_W = 76;
const TILE_H = 38;
const ORIGIN_X = 0;
const ORIGIN_Y = 40;

export class FarmScene extends Phaser.Scene {
  private plots = new Map<string, Plot>();
  private plotOverlays = new Map<string, Phaser.GameObjects.Graphics>();
  private tomatoSprites = new Map<string, Phaser.GameObjects.Image>();
  private cropSprites = new Map<string, Phaser.GameObjects.Image>();
  private buildingAssetSprites = new Map<string, Phaser.GameObjects.Image>();
  private windmillRotorSprites = new Map<string, Phaser.GameObjects.Image>();
  private growthTimers = new Map<string, Phaser.Time.TimerEvent>();
  private plotGraphics!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private placementOverlay!: Phaser.GameObjects.Graphics;
  private selected: Plot | null = null;
  private cropHoverTooltip: HTMLDivElement|null = null;
  private hoveredCropPlot: Plot|null = null;
  private hoverPointer = {x:0,y:0};
  private activeTool: Tool = 'select';
  private coins = 250;
  private xp = 0;
  private inventory: Record<CropId,number> = {wheat:3,carrot:0,corn:0,strawberry:0,tomato:0,pumpkin:0,blueberry:0,watermelon:0};
  private selectedCrop: CropId = 'wheat';
  private animals: Animal[] = [];
  private feed: Record<AnimalId, number> = { hen: 0, cow: 0 };
  private buildings: BuildingProgress = { coopLevel: 0, barnLevel: 0, warehouseLevel: 0 };
  private produce: AnimalProduce = { eggs: 0, milk: 0 };
  private activeBuilding: BuildingId|null = null;
  private farmerName='New Farmer';
  private farmName='My Farm';
  private buildingLevels: Record<BuildingId,number>={coop:0,barn:0,silo:0,bakery:0,greenhouse:0,windmill:0,stable:0,well:0,workshop:0,waterTower:0};
  private productionJobs: Record<BuildingId,ProductionJob|null>={coop:null,barn:null,silo:null,bakery:null,greenhouse:null,windmill:null,stable:null,well:null,workshop:null,waterTower:null};
  private crafted: Record<ProductId,number>={flour:0,bread:0,pastry:0,grapes:0};
  private animalActors: Phaser.GameObjects.Container[] = [];
  private animalSprites = new Map<Phaser.GameObjects.Container, Phaser.GameObjects.Sprite>();
  private animalReservedCells=new Set<string>();
  private sceneryGraphics: Phaser.GameObjects.Graphics[] = [];
  private sceneryLabels: Phaser.GameObjects.Text[] = [];
  private farmExpansionLevel=0;
  private displayedLevel=1;
  private farmhouseVisualLevel=1;
  private decor: Record<string,{col:number;row:number}> = {farmhouse:{col:3,row:1}};
  private fruitInventory:Record<'apples'|'pears'|'cherries',number>={apples:0,pears:0,cherries:0};
  private harvestedCrops:Record<CropId,number>={wheat:0,carrot:0,corn:0,strawberry:0,tomato:0,pumpkin:0,blueberry:0,watermelon:0};
  private fruitTreeReadyAt:Record<string,number>={};
  private fruitTreeBadges:Record<string,Phaser.GameObjects.Text>={};
  private movingDecor: string | null = null;
  private movingPlotKey: string | null = null;
  private movingPreviewTile: {col:number;row:number}|null = null;
  private movingPreviewValid = false;
  private harvests = 0;
  private claimedQuests: string[] = [];
  private randomQuests: Array<{id:string;title:string;description:string;target:number;coins:number;xp:number;icon:string;metric:'harvests'|'hens'|'cows'|'eggs'|'milk'}> = [];
  private questCycle = 0;
  private questRefreshAt=0;
  private questProgressBaseline:Record<'harvests'|'hens'|'cows'|'eggs'|'milk',number>={harvests:0,hens:0,cows:0,eggs:0,milk:0};
  private eventStartedAt=0;
  private eventStartHarvests=0;
  private eventClaimed=false;
  private claimedMilestones:number[]=[];
  private ordersCompleted: Record<string,number> = {};
  private woodlandBackdrop: Phaser.GameObjects.Image|null = null;
  private cameraDragging = false;
  private minFarmZoom = 0.55;
  private dragPoint = new Phaser.Math.Vector2();
  private readonly saveKey = 'happyFarmPhaserSaveV1';

  constructor() { super('FarmScene'); }

  create(): void {
    this.fitFarmToViewport();
    this.scale.on('resize', () => this.fitFarmToViewport());
    this.plotGraphics = this.add.graphics().setDepth(-5);
    this.overlay = this.add.graphics();
    this.placementOverlay = this.add.graphics().setDepth(25000);
    this.drawWorld();
    this.load.on('progress',(value:number)=>window.dispatchEvent(new CustomEvent('happyfarm:loading',{detail:{progress:value}})));
    this.load.image('enchanted-woodland', `${import.meta.env.BASE_URL}assets/environment/Lush%20Forest%20Farm%20Border%20Scene.png`);
    this.load.image('windmill-body', `${import.meta.env.BASE_URL}assets/buildings/windmill/windmill-body.png`);
    this.load.image('windmill-rotor', `${import.meta.env.BASE_URL}assets/buildings/windmill/windmill-rotor.png`);
    this.load.spritesheet('animal-cow', `${import.meta.env.BASE_URL}assets/animals/cow.png`, { frameWidth: 384, frameHeight: 256 });
    this.load.spritesheet('animal-hen', `${import.meta.env.BASE_URL}assets/animals/hen.png`, { frameWidth: 44, frameHeight: 40 });
    this.load.spritesheet('animal-chick', `${import.meta.env.BASE_URL}assets/animals/chick.png`, { frameWidth: 44, frameHeight: 40 });
    for (let stage = 1; stage <= 5; stage += 1) {
      this.load.image(`crop-tomato-${stage}`, `${import.meta.env.BASE_URL}assets/crops/tomato/tomato-stage-${stage}-${['seeds','sprout','young','flowering','ripe'][stage - 1]}.png`);
    }
    for (const building of ['farmhouse','windmill','greenhouse','village-bakery','chicken-coop','cow-shed','barn','silo','well','workshop','stable','water-tower'] as const) {
      for (let level = 1; level <= 6; level += 1) {
        this.load.image(`building-${building}-${level}`, `${import.meta.env.BASE_URL}assets/buildings/${building}/${building}-level-${level}.png`);
      }
    }
    for (const crop of ['wheat','carrot','corn','strawberry','pumpkin'] as const) {
      this.load.spritesheet(`crop-${crop}`, `${import.meta.env.BASE_URL}assets/crops/${crop}/${crop}-growth.png`, { frameWidth: 160, frameHeight: 160 });
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {this.createAnimalAnimations();this.renderWoodlandBackdrop();this.redrawFarmTiles();this.drawScenery();this.renderOwnedAnimals();window.dispatchEvent(new Event('happyfarm:ready'));});
    this.load.start();
    this.loadFarm();
    this.redrawFarmTiles();
    this.fitFarmToViewport();
    this.ensureQuestAndEventCycles();
    this.drawScenery();
    this.initializeFruitTrees();
    this.renderFruitTreeBadges();
    this.renderOwnedAnimals();
    this.createCropHoverTooltip();
    this.bindWorldInput();
    this.bindToolbar();
    this.bindCropSelector();
    this.bindMarket();
    this.bindSideRail();
    this.refreshHud();
    this.bindDailyReward();
    initializeCloudSaves();
    this.refreshSelection();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => { if((this.questRefreshAt>0&&Date.now()>=this.questRefreshAt)||(this.eventStartedAt>0&&Date.now()-this.eventStartedAt>=604800000)){this.ensureQuestAndEventCycles();this.renderSideRail();} this.updateCropLifecycle(); this.updateProduction(); this.updateFruitTrees(); this.refreshCropHoverTooltip(); if(this.activeBuilding==='coop'||this.activeBuilding==='barn')this.renderBuildingPanel(this.activeBuilding);else if(this.activeBuilding)this.renderGenericBuildingPanel(this.activeBuilding); } });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      const camera=this.cameras.main;const anchor=camera.getWorldPoint(_pointer.x,_pointer.y);camera.setZoom(Phaser.Math.Clamp(camera.zoom-dy*0.0015,this.minFarmZoom,1.8));const after=camera.getWorldPoint(_pointer.x,_pointer.y);camera.scrollX+=anchor.x-after.x;camera.scrollY+=anchor.y-after.y;
    });
  }

  private readonly rewardKey='happyFarmDailyRewardV1';
  private rewardAvailableAt=0;
  private rewardAmount=100;
  private bindDailyReward():void {
    try{this.rewardAvailableAt=Number(localStorage.getItem(this.rewardKey)||0)||0;}catch{this.rewardAvailableAt=0;}
    document.getElementById('daily-reward-claim')?.addEventListener('click',()=>this.claimDailyReward());
    const rewardModal=document.getElementById('daily-reward-modal');
    const dismissReward=()=>{rewardModal?.classList.remove('open');rewardModal?.setAttribute('aria-hidden','true');};
    document.getElementById('daily-reward-dismiss')?.addEventListener('click',dismissReward);
    rewardModal?.addEventListener('click',(event)=>{if(event.target===rewardModal)dismissReward();});
    document.addEventListener('keydown',(event)=>{if(event.key==='Escape'){dismissReward();const drawer=document.getElementById('activity-drawer');drawer?.classList.remove('open');drawer?.setAttribute('aria-hidden','true');}});
    /* Show the daily reward when it is ready; the visible close button and backdrop tap can dismiss it. */
    if(this.rewardAvailableAt<=Date.now())this.showDailyReward();else this.updateDailyRewardCountdown();
    this.time.addEvent({delay:1000,loop:true,callback:()=>this.updateDailyRewardCountdown()});
  }
  private showDailyReward():void {
    this.rewardAmount=100;
    const amount=document.getElementById('daily-reward-amount');if(amount)amount.textContent='100';
    const button=document.getElementById('daily-reward-claim') as HTMLButtonElement|null;
    if(button){button.disabled=false;button.textContent='Collect 100 coins';}
    const copy=document.getElementById('daily-reward-copy');if(copy)copy.textContent='Your farm welcome gift is ready. Collect 100 coins to keep growing!';
    const modal=document.getElementById('daily-reward-modal');modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');
  }
  private claimDailyReward():void {
    if(this.rewardAvailableAt>Date.now())return;
    this.coins+=this.rewardAmount;this.rewardAvailableAt=Date.now()+12*60*60*1000;
    try{localStorage.setItem(this.rewardKey,String(this.rewardAvailableAt));}catch{}
    this.saveFarm();this.refreshHud();
    const button=document.getElementById('daily-reward-claim') as HTMLButtonElement|null;
    if(button){button.disabled=true;button.textContent='✓ Reward collected';}
    const copy=document.getElementById('daily-reward-copy');if(copy)copy.textContent='100 coins added to your farm balance. Happy farming!';
    this.updateDailyRewardCountdown();
    const modal=document.getElementById('daily-reward-modal');modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');
  }
  private updateDailyRewardCountdown():void {
    const next=document.getElementById('daily-reward-next');if(!next)return;
    const remaining=this.rewardAvailableAt-Date.now();
    if(remaining<=0){next.textContent='Your next gift is ready now!';return;}
    const hours=Math.floor(remaining/3600000),minutes=Math.floor((remaining%3600000)/60000);
    next.textContent='Next reward in '+hours+'h '+String(minutes).padStart(2,'0')+'m · 100 coins every 12 hours';
  }

  private fitFarmToViewport(): void {
    const camera=this.cameras.main,width=Math.max(320,this.scale.width),height=Math.max(360,this.scale.height);
    const spanX=Math.max(TILE_W,(this.farmSize-1)*TILE_W+24);
    const spanY=Math.max(TILE_H,(this.farmSize-1)*TILE_H+24);
    const fitX=(width-56)/spanX;
    const fitY=(height-(height<700?178:110))/spanY;
    this.minFarmZoom=Phaser.Math.Clamp(Math.min(1.28,fitX,fitY),0.55,1.28);
    camera.setZoom(Phaser.Math.Clamp(Math.min(1.28,fitX*1.12,fitY*1.12),this.minFarmZoom,1.28));
    camera.centerOn(0,ORIGIN_Y+(this.farmSize-1)*TILE_H/2);
  }

  private xpForLevel(level:number):number { const target=Math.max(1,Math.floor(level));let total=0;for(let current=1;current<target;current++)total+=100+(current-1)*75;return total; }
  private get farmerLevel():number { let level=1;while(level<100&&this.xp>=this.xpForLevel(level+1))level++;return level; }
  private get levelProgress():number { return this.xp-this.xpForLevel(this.farmerLevel); }
  private get xpNeededForNextLevel():number { return 100+(this.farmerLevel-1)*75; }
  private get farmSize():number{return FARM_SIZES[this.farmExpansionLevel]||FARM_SIZES[0];}
  // Eight usable fields through Level 12; one more at 13, 16, 19, and every three levels thereafter.
  private get plowLimit():number { return 8+Math.max(0,Math.floor((this.farmerLevel-10)/3)); }
  private get establishedFieldCount():number { return [...this.plots.values()].filter(plot=>plot.state!=='grass').length; }
  private key(col: number, row: number): string { return col + ':' + row; }

  private toWorld(col: number, row: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2((col - row) * TILE_W / 2 + ORIGIN_X, (col + row) * TILE_H / 2 + ORIGIN_Y);
  }

  private toTile(x: number, y: number): { col: number; row: number } | null {
    const px = x - ORIGIN_X;
    const py = y - ORIGIN_Y;
    const a = px / (TILE_W / 2);
    const b = py / (TILE_H / 2);
    const col = Math.round((a + b) / 2);
    const row = Math.round((b - a) / 2);
    if (col < 0 || row < 0 || col >= this.farmSize || row >= this.farmSize) return null;
    return { col, row };
  }

  private diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, fill: number, stroke = 0x5c9147): void {
    g.fillStyle(fill, 1);
    g.lineStyle(1.3, stroke, 0.75);
    g.beginPath();
    g.moveTo(x, y - TILE_H / 2);
    g.lineTo(x + TILE_W / 2, y);
    g.lineTo(x, y + TILE_H / 2);
    g.lineTo(x - TILE_W / 2, y);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }

  private drawWorld(): void {
    this.plotGraphics.clear();
    // The woodland concept is the exterior; retain only the interactive farm grid here.
    for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++)if(!this.plots.has(this.key(col,row)))this.plots.set(this.key(col,row),{col,row,state:'grass',watered:false,growth:0,crop:'wheat',readyAt:0,witherAt:0});
    this.redrawFarmTiles();
  }

  private renderWoodlandBackdrop(): void {
    if (!this.textures.exists('enchanted-woodland')) return;
    this.woodlandBackdrop?.destroy();
    const source=this.textures.get('enchanted-woodland').getSourceImage() as HTMLImageElement;
    const scale=Math.max(1420/source.width,790/source.height);
    this.woodlandBackdrop=this.add.image(0,225,'enchanted-woodland')
      .setOrigin(0.5,0.5)
      .setDisplaySize(source.width*scale,source.height*scale)
      .setDepth(-21);
  }

  private redrawFarmTiles():void {
    this.plotGraphics.clear();
    for(let row=0;row<this.farmSize;row++)for(let col=0;col<this.farmSize;col++){
      const point=this.toWorld(col,row),shades=[0x9bcf69,0xa5d875,0x94c762,0xaedb7d,0x9fce70],shade=shades[(col*7+row*11)%shades.length]??0x9bcf69;
      this.diamond(this.plotGraphics,point.x,point.y,shade,0x78ae54);
      this.plotGraphics.lineStyle(1,0xd8ef9e,0.28);this.plotGraphics.beginPath();this.plotGraphics.moveTo(point.x-27,point.y-1);this.plotGraphics.lineTo(point.x,point.y-17);this.plotGraphics.lineTo(point.x+24,point.y-1);this.plotGraphics.strokePath();
      if((col*3+row*5)%13===0)this.drawGrassTuft(point.x,point.y);
      if((col*11+row*7)%31===0){this.plotGraphics.fillStyle(0x5c9846,0.9);this.plotGraphics.fillEllipse(point.x+13,point.y+3,5,3);this.plotGraphics.fillEllipse(point.x+17,point.y,4,3);}
      const plot=this.plots.get(this.key(col,row));if(plot&&plot.state!=='grass')this.redrawPlot(plot);
    }
    this.drawFlowerPatches();
  }

  private drawFlowerPatches():void {
    const g=this.plotGraphics,size=this.farmSize;
    const flowers=[[1,Math.min(3,size-1)],[Math.min(size-2,5),1],[Math.min(size-2,5),Math.min(size-2,5)],[Math.max(0,size-2),Math.floor(size/2)]];
    flowers.forEach(([col,row],index)=>{const p=this.toWorld(col!,row!),colors=[0xffe58a,0xffa8a8,0xffffff,0xd8a8ee];g.fillStyle(0x4d923e,1);g.fillEllipse(p.x,p.y+3,8,4);g.fillStyle(colors[index%colors.length]!,1);g.fillCircle(p.x,p.y-2,3);g.fillCircle(p.x-3,p.y,2);g.fillCircle(p.x+3,p.y,2);g.fillStyle(0xf4c84f,1);g.fillCircle(p.x,p.y,1.5);});
  }

  private drawGrassTuft(x: number, y: number): void {
    this.plotGraphics.lineStyle(1.5, 0x6b9e47, 0.8);
    this.plotGraphics.beginPath();
    this.plotGraphics.moveTo(x - 3, y + 2);
    this.plotGraphics.lineTo(x - 1, y - 3);
    this.plotGraphics.moveTo(x, y + 2);
    this.plotGraphics.lineTo(x + 2, y - 4);
    this.plotGraphics.strokePath();
  }


  private fruitKind(id:string):'apples'|'pears'|'cherries'|null {
    if(id.startsWith('appleTree'))return 'apples';
    if(id.startsWith('pearTree'))return 'pears';
    if(id.startsWith('cherryTree'))return 'cherries';
    return null;
  }
  private fruitConfig(kind:'apples'|'pears'|'cherries'):{emoji:string;name:string;interval:number} {
    return kind==='apples'?{emoji:'🍎',name:'Apple',interval:4*60*60*1000}:kind==='pears'?{emoji:'🍐',name:'Pear',interval:6*60*60*1000}:{emoji:'🍒',name:'Cherry',interval:3*60*60*1000};
  }
  private initializeFruitTrees():void {
    const now=Date.now();
    Object.keys(this.decor).forEach(id=>{const kind=this.fruitKind(id);if(kind&&!this.fruitTreeReadyAt[id])this.fruitTreeReadyAt[id]=now+this.fruitConfig(kind).interval;});
    this.saveFarm();
  }
  private renderFruitTreeBadges():void {
    Object.values(this.fruitTreeBadges).forEach(b=>b.destroy());this.fruitTreeBadges={};
    Object.keys(this.decor).forEach(id=>{
      const kind=this.fruitKind(id);if(!kind)return;
      const p=this.toWorld(this.decor[id]!.col,this.decor[id]!.row);
      const badge=this.add.text(p.x+26,p.y-91,'',{fontFamily:'Arial',fontSize:'13px',fontStyle:'bold',color:'#fff7cf',backgroundColor:'#315b2b',padding:{x:5,y:3},stroke:'#203d1f',strokeThickness:2}).setOrigin(.5).setDepth(20000);
      badge.setInteractive({useHandCursor:true});badge.on('pointerdown',()=>this.harvestFruitTree(id));
      this.fruitTreeBadges[id]=badge;
    });
    this.updateFruitTrees();
  }
  private updateFruitTrees():void {
    const now=Date.now();let changed=false;
    Object.keys(this.decor).forEach(id=>{
      const kind=this.fruitKind(id);if(!kind)return;
      if(!this.fruitTreeReadyAt[id]){this.fruitTreeReadyAt[id]=now+this.fruitConfig(kind).interval;changed=true;}
      const remaining=this.fruitTreeReadyAt[id]!-now;const badge=this.fruitTreeBadges[id];if(!badge)return;const treePos=this.decor[id]!;const treeWorld=this.toWorld(treePos.col,treePos.row);badge.setPosition(treeWorld.x+26,treeWorld.y-91);
      if(remaining<=0){badge.setText(this.fruitConfig(kind).emoji+' Ready!').setVisible(true).setBackgroundColor('#397b27');}
      else {const mins=Math.ceil(remaining/60000);badge.setText(this.fruitConfig(kind).emoji+' '+mins+'m').setVisible(true).setBackgroundColor('#315b2b');}
    });
    if(changed)this.saveFarm();
  }
  private harvestFruitTree(id:string):void {
    const kind=this.fruitKind(id);if(!kind)return;
    const readyAt=this.fruitTreeReadyAt[id]||0;const cfg=this.fruitConfig(kind);
    if(Date.now()<readyAt){const remaining=readyAt-Date.now();const mins=Math.floor(remaining/60000),secs=Math.ceil((remaining%60000)/1000);this.toast(cfg.name+' tree is growing fruit · '+mins+':'+String(secs).padStart(2,'0')+' remaining.');return;}
    this.fruitInventory[kind]+=1;this.fruitTreeReadyAt[id]=Date.now()+cfg.interval;
    const reward=kind==='apples'?32:kind==='pears'?36:42;
    const treePos=this.toWorld(this.decor[id]!.col,this.decor[id]!.row);
    this.showHarvestReward(treePos.x,treePos.y-72,reward);
    this.saveFarm();this.refreshHud();this.updateFruitTrees();
    this.toast('Harvested 1 '+cfg.name+' · sell value '+reward+' coins · next fruit in '+Math.round(cfg.interval/60000)+' minutes.');
  }

  private drawScenery(): void {
    this.sceneryGraphics.forEach(x=>x.destroy()); this.sceneryGraphics=[];
    this.sceneryLabels.forEach(x=>x.destroy()); this.sceneryLabels=[];
    const g = this.add.graphics(); this.sceneryGraphics.push(g);
    // Layered orchard trees: trunk, canopy shadow, clustered leaves and sunlit highlights.
    Object.keys(this.decor).filter(id=>id.startsWith('tree')||id.startsWith('appleTree')||id.startsWith('pearTree')||id.startsWith('cherryTree')).forEach((id, i) => {
      const pos=this.decor[id]!; const p = this.toWorld(pos.col, pos.row);
      const palette = [0x356f36, 0x477f3b, 0x568d43, 0x3d7838];
      const canopyY = p.y - 49;
      // Soft cast shadow, branching trunk and layered foliage give the tree a fuller silhouette.
      g.fillStyle(0x294c2a, 0.22); g.fillEllipse(p.x + 7, p.y + 5, 76, 20);
      g.fillStyle(0x5a3b27, 1);
      g.fillPoints([{x:p.x-7,y:p.y-5},{x:p.x-5,y:p.y-39},{x:p.x-14,y:p.y-54},{x:p.x-10,y:p.y-57},{x:p.x,y:p.y-43},{x:p.x+9,y:p.y-58},{x:p.x+13,y:p.y-54},{x:p.x+5,y:p.y-34},{x:p.x+8,y:p.y-4}], true);
      g.lineStyle(2,0x9b7046,0.8);g.beginPath();g.moveTo(p.x-2,p.y-9);g.lineTo(p.x-3,p.y-38);g.lineTo(p.x-11,p.y-51);g.moveTo(p.x+2,p.y-34);g.lineTo(p.x+10,p.y-53);g.strokePath();
      const leaf = palette[i % palette.length]!;
      g.fillStyle(0x244f2b,0.48);
      g.fillEllipse(p.x,canopyY+8,77,52);
      g.fillStyle(leaf,1);
      [[0,0,24],[-24,8,19],[24,8,20],[-14,-17,19],[14,-20,20],[-34,-7,13],[34,-5,14],[0,18,20]].forEach(([dx,dy,r])=>g.fillCircle(p.x+dx!,canopyY+dy!,r!));
      g.fillStyle(0x75a94f,0.82);
      [[-17,-18,7],[8,-25,8],[25,-4,6],[-30,4,6],[1,9,7]].forEach(([dx,dy,r])=>g.fillCircle(p.x+dx!,canopyY+dy!,r!));
      g.fillStyle(0x2c6233,0.58);
      [[-13,2],[7,-8],[22,13],[-27,-7],[0,-31]].forEach(([dx,dy])=>g.fillCircle(p.x+dx!,canopyY+dy!,3));
      if (i % 3 === 0) { g.fillStyle(0xe9a34b,1); [[-19,2],[18,12],[5,-19]].forEach(([dx,dy])=>g.fillCircle(p.x+dx!,canopyY+dy!,3)); }
      if(id.startsWith('appleTree')){g.fillStyle(0xc83e37,1);[[-18,-5],[15,4],[2,-22],[25,-16]].forEach(([dx,dy])=>g.fillCircle(p.x+dx!,canopyY+dy!,4));}
      if(id.startsWith('pearTree')){g.fillStyle(0xc9cf4e,1);[[-17,-4],[15,3],[2,-22],[25,-16]].forEach(([dx,dy])=>g.fillEllipse(p.x+dx!,canopyY+dy!,7,9));}
      if(id.startsWith('cherryTree')){g.fillStyle(0xb72e45,1);[[-18,-5],[15,4],[2,-22],[25,-16]].forEach(([dx,dy])=>g.fillCircle(p.x+dx!,canopyY+dy!,3));}
    });
    // Animals roam freely around their coop and cow shed; no enclosure fences.
    // Flowering borders near the path.
    [[-330, 145], [-300, 165], [315, 135], [345, 158], [-360, 320], [365, 330]].forEach(([x, y], i) => {
      g.fillStyle(0x4d873f, 0.85);
      g.fillEllipse(x!, y! + 4, 17, 7);
      const color = [0xf5a8c5, 0xffe18a, 0xffffff][i % 3]!;
      g.fillStyle(color, 1);
      g.fillCircle(x!, y!, 4);
      g.fillCircle(x! - 4, y! + 2, 3);
      g.fillCircle(x! + 4, y! + 2, 3);
      g.fillStyle(0xf4c94e, 1);
      g.fillCircle(x!, y! + 2, 2);
    });
    Object.entries(this.decor).forEach(([id,pos])=>{
      const p=this.toWorld(pos.col,pos.row);
      if(id.startsWith('flowerbed')){g.fillStyle(0x6b8f42,1);g.fillEllipse(p.x,p.y+3,35,11);[0xffa4bd,0xffe17b,0xffffff,0xc7a4ee].forEach((c,i)=>{g.fillStyle(c,1);g.fillCircle(p.x-12+i*8,p.y-5-(i%2)*3,4);});}
      if(id.startsWith('fountain')){g.fillStyle(0x8b9b9a,1);g.fillEllipse(p.x,p.y,35,12);g.fillStyle(0xc5d9d4,1);g.fillEllipse(p.x,p.y-5,26,9);g.fillStyle(0x7fc9e5,0.9);g.fillEllipse(p.x,p.y-9,15,6);g.fillStyle(0xb8e8f4,1);g.fillCircle(p.x,p.y-17,3);}
      if(id.startsWith('scarecrow')){g.lineStyle(4,0x80552f,1);g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x,p.y-38);g.moveTo(p.x-16,p.y-28);g.lineTo(p.x+16,p.y-28);g.strokePath();g.fillStyle(0xd7a45b,1);g.fillCircle(p.x,p.y-43,8);g.fillStyle(0x9b4939,1);g.fillTriangle(p.x-12,p.y-45,p.x+12,p.y-45,p.x,p.y-58);g.fillStyle(0x6b9c48,1);g.fillRect(p.x-11,p.y-35,22,14);}
      if(id.startsWith('bench')){g.fillStyle(0x79502f,1);g.fillRoundedRect(p.x-19,p.y-13,38,7,2);g.fillRoundedRect(p.x-19,p.y-23,38,6,2);g.fillRect(p.x-15,p.y-7,4,12);g.fillRect(p.x+11,p.y-7,4,12);}
    });
    // Building PNGs are the authoritative building visuals; draw them above the ground scenery.
    this.renderBuildingAssets();
  }

  private createAnimalAnimations(): void {
    const define=(key:string,name:string,row:number,count:number,rate:number,repeat:number,columns=8)=>{
      const start=row*columns;
      this.anims.create({key:name,frames:this.anims.generateFrameNumbers(key,{start,end:start+count-1}),frameRate:rate,repeat});
    };
    // cow.png is a 4 × 4 atlas of 384 × 256 full-body frames (1536 × 1024).
    // The hen and chick atlases retain their original 44 × 40 frame grid.
    define('animal-cow','cow-idle',0,4,4,-1,4);
    define('animal-cow','cow-walk',1,4,8,-1,4);
    define('animal-cow','cow-eat',2,4,6,-1,4);
    define('animal-cow','cow-happy',3,4,7,0,4);
    define('animal-cow','cow-rest',0,4,3,-1,4);
    define('animal-hen','hen-idle',0,4,4,-1);
    define('animal-hen','hen-walk',1,6,9,-1);
    define('animal-hen','hen-peck',2,4,7,3);
    define('animal-hen','hen-lay',3,4,5,0);
    define('animal-hen','hen-cluck',4,3,6,0);
    define('animal-hen','hen-rest',5,3,4,-1);
    define('animal-chick','chick-idle',0,4,4,-1);
    define('animal-chick','chick-walk',1,6,9,-1);
    define('animal-chick','chick-peck',2,4,7,3);
    define('animal-chick','chick-rest',3,3,4,-1);
  }

  private renderOwnedAnimals(): void {
    this.animalActors.forEach(actor=>{this.tweens.killTweensOf(actor);const sprite=this.animalSprites.get(actor);if(sprite)this.tweens.killTweensOf(sprite);actor.destroy();});this.animalActors=[];this.animalSprites.clear();this.animalReservedCells.clear();
    // Resolve animal home anchors defensively: older saves may contain animals before
    // their matching building decor has been restored or placed.
    const farmhouse=this.decor.farmhouse||{col:3,row:1};
    const henHome=this.decor.coop||{col:Math.min(COLS-1,farmhouse.col+2),row:farmhouse.row+1};
    const cowHome=this.decor.barn||{col:Math.min(COLS-1,farmhouse.col+3),row:Math.min(ROWS-1,farmhouse.row+3)};
    this.animals.forEach((animal,index)=>{
      const cow=animal.id==='cow';
      const home=cow?cowHome:henHome;
      const homeTile=this.nearestAnimalCell(home);
      if(!homeTile){this.toast('No clear grass tile available for an animal. Move a building or field first.');return;}
      const center=this.toWorld(homeTile.col,homeTile.row);
      const bounds={width:TILE_W*4,height:TILE_H*4};
      const actor=this.add.container(center.x,center.y);actor.setDepth(center.y+index);
      this.animalReservedCells.add(this.animalCellKey(homeTile));
      const scale=cow?0.74:0.58;
      actor.setScale(scale);
      actor.add(this.add.ellipse(0,6,cow?32:22,7,0x263e25,0.18));
      const texture=cow?'animal-cow':'animal-hen';
      if(this.textures.exists(texture)){
        const sprite=this.add.sprite(0,-2,texture).setDisplaySize(cow?88:35,cow?59:32).setAlpha(1).setVisible(true);
        sprite.setDepth(2);
        actor.add(sprite);
        this.animalSprites.set(actor,sprite);
        this.animateAnimalIdle(actor,sprite);
      }else{
        // Keep the original vector animal as a graceful fallback while artwork loads.
        const body=this.add.graphics();
        if(cow){
          body.fillStyle(0xf6f1e5,1);body.fillEllipse(-2,-14,39,27);body.fillStyle(0x4b4540,1);body.fillEllipse(-13,-19,13,10);body.fillEllipse(2,-8,12,9);body.fillStyle(0xf4eee0,1);body.fillEllipse(15,-19,19,21);body.fillStyle(0xe6b7a8,1);body.fillEllipse(25,-15,15,10);body.fillStyle(0x4a4038,1);body.fillCircle(19,-24,1.5);
        }else{
          body.fillStyle(0xf0dfbd,1);body.fillEllipse(-1,-11,25,20);body.fillStyle(0xf5ead1,1);body.fillEllipse(7,-17,11,11);body.fillStyle(0xd94f42,1);body.fillEllipse(4,-25,4,5);body.fillCircle(9,-25,3);body.fillStyle(0xd99c3c,1);body.fillTriangle(12,-17,22,-14,12,-12);body.fillStyle(0x352e28,1);body.fillCircle(9,-19,1.5);
        }
        actor.add(body);
      }
      this.animalActors.push(actor);
      const marginX=bounds.width/2-(cow?28:19),marginY=bounds.height/2-(cow?25:18);
      if(animal.assigned===false){const sprite=this.animalSprites.get(actor);if(sprite){sprite.setAngle(0).setY(1).play(cow?'cow-rest':'hen-rest',true);this.tweens.add({targets:sprite,y:2,duration:cow?1900:1250,yoyo:true,repeat:-1,ease:'Sine.inOut'});}}else this.time.delayedCall(Phaser.Math.Between(2200,5200),()=>this.wanderAnimal(actor,center.x,center.y,marginX,marginY,cow));
    });
    // A small chick companion brings life to an occupied chicken run without changing save data.
    if(this.animals.some(a=>a.id==='hen')&&this.textures.exists('animal-chick')){
      const chickTile=this.nearestAnimalCell(henHome);
      if(!chickTile)return;
      const chickPos=this.toWorld(chickTile.col,chickTile.row);
      this.animalReservedCells.add(this.animalCellKey(chickTile));
      const chick=this.add.container(chickPos.x,chickPos.y);chick.setDepth(chickPos.y+14);
      chick.add(this.add.ellipse(0,4,15,4,0x263e25,0.18));
      const chickSprite=this.add.sprite(0,-1,'animal-chick').setDisplaySize(18,16.4);chick.add(chickSprite);this.animalSprites.set(chick,chickSprite);
      this.animalActors.push(chick);
      chickSprite.play('chick-idle');this.animateAnimalIdle(chick,chickSprite);
      this.wanderAnimal(chick,chickPos.x,chickPos.y,TILE_W*2-15,TILE_H*2-15,false);
    }
  }

  // FarmVille-style resting is genuinely still: hold a single idle frame so no legs cycle.
  private animateAnimalIdle(actor:Phaser.GameObjects.Container,sprite:Phaser.GameObjects.Sprite):void{
    if(!actor.active||!sprite.active)return;
    this.tweens.killTweensOf(sprite);
    sprite.anims.stop();
    sprite.setAngle(0).setY(-2);
    sprite.setFrame(0);
  }

  private wanderAnimal(actor:Phaser.GameObjects.Container,cx:number,cy:number,limitX:number,limitY:number,cow:boolean):void{
    if(!actor.active)return;
    const sprite=this.animalSprites.get(actor),baseScale=cow?0.74:0.58;
    const current=this.toTile(actor.x,actor.y);
    if(!current)return;
    let destination:{col:number;row:number}|null=null;
    for(let attempt=0;attempt<28;attempt++){
      const candidate={col:current.col+Phaser.Math.Between(-2,2),row:current.row+Phaser.Math.Between(-2,2)};
      if(candidate.col===current.col&&candidate.row===current.row)continue;
      if(this.animalCellBlocked(candidate,actor))continue;
      const point=this.toWorld(candidate.col,candidate.row);
      if(this.animalRouteIsClear({x:actor.x,y:actor.y},point,actor)){destination=candidate;break;}
    }
    if(!destination){
      const spriteNow=this.animalSprites.get(actor);if(spriteNow)this.animateAnimalIdle(actor,spriteNow);
      this.time.delayedCall(Phaser.Math.Between(2800,5600),()=>this.wanderAnimal(actor,cx,cy,limitX,limitY,cow));
      return;
    }
    const dest=this.toWorld(destination.col,destination.row),key=this.animalCellKey(destination);
    this.animalReservedCells.add(key);
    const duration=Phaser.Math.Between(cow?2800:1700,cow?4600:3000);
    if(sprite){
      this.tweens.killTweensOf(sprite);sprite.setAngle(0);
      sprite.play(sprite.texture.key==='animal-chick'?'chick-walk':(cow?'cow-walk':'hen-walk'),true);
      this.tweens.add({targets:sprite,y:-5,angle:cow?-2:2,duration:260,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    }
    this.tweens.add({targets:actor,x:dest.x,y:dest.y,duration,ease:'Sine.inOut',
      onStart:()=>actor.setScale((dest.x<actor.x?-1:1)*baseScale,baseScale),
      onUpdate:()=>actor.setDepth(actor.y+this.animalActors.indexOf(actor)),
      onComplete:()=>{
        if(!actor.active)return;
        this.animalReservedCells.delete(this.animalCellKey(current));
        actor.setScale(baseScale,baseScale);
        if(sprite){
          this.tweens.killTweensOf(sprite);sprite.setAngle(0).setY(-2);
          sprite.play(cow?'cow-eat':(sprite.texture.key==='animal-chick'?'chick-peck':'hen-peck'),true);
          this.time.delayedCall(Phaser.Math.Between(cow?2200:1000,cow?4200:1900),()=>{
            if(!actor.active||!sprite.active)return;
            this.animateAnimalIdle(actor,sprite);
            this.time.delayedCall(Phaser.Math.Between(2600,6200),()=>this.wanderAnimal(actor,cx,cy,limitX,limitY,cow));
          });
        }else this.time.delayedCall(3000,()=>this.wanderAnimal(actor,cx,cy,limitX,limitY,cow));
      }
    });
  }

  private playFeedingAnimation(actor:Phaser.GameObjects.Container):void{
    if(!actor.active)return;
    const baseScale=Math.abs(actor.scaleY),sprite=this.animalSprites.get(actor);
    if(sprite){this.tweens.killTweensOf(sprite);const cow=sprite.texture.key==='animal-cow';sprite.play(sprite.texture.key==='animal-chick'?'chick-peck':(cow?'cow-eat':'hen-peck'),true);this.tweens.add({targets:sprite,angle:-8,y:3,duration:260,yoyo:true,repeat:3,ease:'Sine.inOut',onComplete:()=>{if(actor.active)this.animateAnimalIdle(actor,sprite);}});}
    this.tweens.add({targets:actor,scaleY:baseScale*0.94,duration:220,yoyo:true,repeat:2,ease:'Sine.inOut',
      onComplete:()=>{if(!actor.active)return;actor.setScale(actor.scaleX<0?-baseScale:baseScale,baseScale);const feed=this.add.text(actor.x,actor.y-25,'🌿',{fontSize:'13px'}).setOrigin(.5).setDepth(actor.depth+10);this.tweens.add({targets:feed,y:feed.y-15,alpha:0,duration:850,onComplete:()=>feed.destroy()});}
    });
  }

  private renderBuildingAssets(): void {
    this.buildingAssetSprites.forEach(sprite => sprite.destroy());
    this.buildingAssetSprites.clear();
    this.windmillRotorSprites.forEach(sprite => {this.tweens.killTweensOf(sprite);sprite.destroy();});
    this.windmillRotorSprites.clear();
    const assets: Record<string, { folder: string; level: number }> = {
      farmhouse: { folder: 'farmhouse', level: Math.min(6,1+Math.floor((this.farmerLevel-1)/3)) },
      barn: { folder: 'cow-shed', level: this.buildings.barnLevel },
      coop: { folder: 'chicken-coop', level: this.buildings.coopLevel },
      silo: { folder: 'silo', level: this.buildings.warehouseLevel },
      bakery: { folder: 'village-bakery', level: this.buildingLevels.bakery || 1 },
      greenhouse: { folder: 'greenhouse', level: this.buildingLevels.greenhouse || 1 },
      windmill: { folder: 'windmill', level: this.buildingLevels.windmill || 1 },
      workshop: { folder: 'workshop', level: this.buildingLevels.workshop || 1 },
      stable: { folder: 'stable', level: this.buildingLevels.stable || 1 },
      well: { folder: 'well', level: this.buildingLevels.well || 1 },
      waterTower: { folder: 'water-tower', level: this.buildingLevels.waterTower || 1 }
    };
    for (const [id, asset] of Object.entries(assets)) {
      const pos = this.decor[id];
      if (!pos) continue;
      const level = Phaser.Math.Clamp(Math.floor(asset.level), 1, 6);
      const p = this.toWorld(pos.col, pos.row);
      if(id==='windmill'&&this.textures.exists('windmill-body')&&this.textures.exists('windmill-rotor')){
        const source=this.textures.get('windmill-body').getSourceImage() as HTMLImageElement;
        const scale=Math.min(132/source.width,124/source.height);
        const body=this.add.image(p.x,p.y+24,'windmill-body').setOrigin(0.5,1).setScale(scale).setDepth(p.y+30);
        this.buildingAssetSprites.set(id,body);
        // The axle sits at roughly 75% width and 36% height in the prepared body art.
        const axleX=p.x-source.width*scale/2+source.width*0.75*scale;
        const axleY=p.y+24-source.height*scale+source.height*0.36*scale;
        const rotor=this.add.image(axleX,axleY,'windmill-rotor').setOrigin(0.5,0.5).setScale(scale).setDepth(p.y+32);
        this.windmillRotorSprites.set(id,rotor);
        this.tweens.add({targets:rotor,angle:360,duration:9000,repeat:-1,ease:'Linear'});
        continue;
      }
      const texture = `building-${asset.folder}-${level}`;
      if (!this.textures.exists(texture)) continue;
      const source = this.textures.get(texture).getSourceImage() as HTMLImageElement;
      const scale = Math.min(132 / source.width, 124 / source.height);
      const sprite = this.add.image(p.x, p.y + 24, texture).setOrigin(0.5, 1).setScale(scale).setDepth(p.y + 30);
      this.buildingAssetSprites.set(id, sprite);
    }
  }

  private touchPositions = new Map<number,{x:number;y:number;startX:number;startY:number}>();
  private touchGesture = false;
  private pinchDistance = 0;

  private handleWorldTap(pointer: Phaser.Input.Pointer): void {
    const world=this.cameras.main.getWorldPoint(pointer.x,pointer.y);
    if(this.activeTool==='move'){
      const hit=Object.keys(this.decor).reverse().find(id=>{
        const p=this.toWorld(this.decor[id]!.col,this.decor[id]!.row);
        const dx=Math.abs(world.x-p.x),dy=Math.abs(world.y-p.y);
        const isTree=id.startsWith('tree')||this.fruitKind(id)!==null;
        const isBuilding=['farmhouse','barn','coop','pen','silo','bakery','greenhouse','windmill'].includes(id);
        return isTree?(dx<48&&dy<92):isBuilding?(dx<68&&dy<100):(dx<42&&dy<52);
      });
      if(hit){
        this.movingDecor=hit;this.movingPlotKey=null;
        const pos=this.decor[hit]!;this.movingPreviewTile={col:pos.col,row:pos.row};
        this.movingPreviewValid=true;this.drawPlacementOverlay();
        this.toast('Drag '+hit+' to a green grid cell.');return;
      }
      const tile=this.toTile(world.x,world.y),plot=tile?this.plots.get(this.key(tile.col,tile.row)):undefined;
      if(plot&&plot.state!=='grass'){
        this.movingPlotKey=this.key(plot.col,plot.row);this.movingDecor=null;
        this.movingPreviewTile={col:plot.col,row:plot.row};this.movingPreviewValid=true;
        this.drawPlacementOverlay();this.toast('Drag the field to a green grid cell.');return;
      }
      return;
    }
    // Prioritise orchard trees over the underlying grass/field tile.
    if(this.activeTool==='select'){
      const fruitTreeHit=Object.keys(this.decor).find(id=>this.fruitKind(id)!==null&&(()=>{
        const p=this.toWorld(this.decor[id]!.col,this.decor[id]!.row);
        return Phaser.Math.Distance.Between(world.x,world.y-38,p.x,p.y-49)<48;
      })());
      if(fruitTreeHit){this.harvestFruitTree(fruitTreeHit);return;}
      const buildingHit=(['coop','barn','silo','bakery','greenhouse','windmill','stable','well','workshop','waterTower'] as const).find(id=>{
        const pos=this.decor[id];if(!pos)return false;const p=this.toWorld(pos.col,pos.row);
        return Math.abs(world.x-p.x)<57&&Math.abs(world.y-(p.y-28))<62;
      });
      if(buildingHit){if(buildingHit==='coop'||buildingHit==='barn')this.openBuilding(buildingHit);else this.openGenericBuilding(buildingHit);return;}
    }
    const tile=this.toTile(world.x,world.y);
    const plot=tile?this.plots.get(this.key(tile.col,tile.row)):undefined;
    if(plot){
      this.selected=plot;
      if(this.activeTool==='select'){
        if(plot.state==='tilled')this.openFieldSeedPicker();
        this.refreshSelection();this.drawSelection();return;
      }
      if(this.activeTool==='plant'){
        if(plot.state==='tilled'){this.sowSelectedPlot();return;}
        if(plot.state==='grass'||plot.state==='withered'){this.toast('Plow this field first, then tap it to sow.');return;}
      }
      this.applyTool(plot);this.refreshSelection();this.drawSelection();return;
    }
  }

  private placementFootprint(id:string):Array<{dc:number;dr:number}> {
    const buildings=['farmhouse','barn','coop','silo','bakery','greenhouse','windmill','stable','well','workshop','waterTower'];
    if(buildings.includes(id))return [{dc:0,dr:0},{dc:1,dr:0},{dc:0,dr:1},{dc:1,dr:1}];
    return [{dc:0,dr:0}];
  }

  private placementCells(tile:{col:number;row:number},id:string):Array<{col:number;row:number}> {
    return this.placementFootprint(id).map(offset=>({col:tile.col+offset.dc,row:tile.row+offset.dr}));
  }

  private decorOccupiesCell(col:number,row:number,exceptId?:string):boolean {
    return Object.entries(this.decor).some(([id,pos])=>id!==exceptId&&this.placementCells(pos,id).some(cell=>cell.col===col&&cell.row===row));
  }

  private animalCellKey(tile:{col:number;row:number}):string{return this.key(tile.col,tile.row);}

  private animalCellBlocked(tile:{col:number;row:number},actor?:Phaser.GameObjects.Container):boolean {
    if(tile.col<0||tile.row<0||tile.col>=this.farmSize||tile.row>=this.farmSize)return true;
    const plot=this.plots.get(this.key(tile.col,tile.row));
    if(!plot||plot.state!=='grass'||this.decorOccupiesCell(tile.col,tile.row))return true;
    const key=this.animalCellKey(tile);
    const actorTile=actor?this.toTile(actor.x,actor.y):null;
    if(this.animalReservedCells.has(key)&&(!actorTile||actorTile.col!==tile.col||actorTile.row!==tile.row))return true;
    return this.animalActors.some(other=>other!==actor&&other.active&&(()=>{const t=this.toTile(other.x,other.y);return !!t&&t.col===tile.col&&t.row===tile.row;})());
  }

  private nearestAnimalCell(home:{col:number;row:number}):{col:number;row:number}|null {
    for(let radius=0;radius<=5;radius++){
      for(let dr=-radius;dr<=radius;dr++)for(let dc=-radius;dc<=radius;dc++){
        if(Math.max(Math.abs(dc),Math.abs(dr))!==radius)continue;
        const tile={col:home.col+dc,row:home.row+dr};
        if(!this.animalCellBlocked(tile))return tile;
      }
    }
    return null;
  }

  private animalRouteIsClear(from:{x:number;y:number},to:{x:number;y:number},actor:Phaser.GameObjects.Container):boolean {
    const distance=Phaser.Math.Distance.Between(from.x,from.y,to.x,to.y);
    const steps=Math.max(2,Math.ceil(distance/12));
    const checked=new Set<string>();
    for(let i=1;i<=steps;i++){
      const t=i/steps,worldX=Phaser.Math.Linear(from.x,to.x,t),worldY=Phaser.Math.Linear(from.y,to.y,t);
      const tile=this.toTile(worldX,worldY);if(!tile) return false;
      const key=this.animalCellKey(tile);if(checked.has(key))continue;checked.add(key);
      if(this.animalCellBlocked(tile,actor))return false;
    }
    return true;
  }

  private canPlaceDecor(tile:{col:number;row:number},movingId:string):boolean {
    const cells=this.placementCells(tile,movingId);
    return cells.every(cell=>{
      if(cell.col<0||cell.row<0||cell.col>=this.farmSize||cell.row>=this.farmSize)return false;
      const target=this.plots.get(this.key(cell.col,cell.row));
      if(!target||target.state!=='grass')return false;
      return !this.decorOccupiesCell(cell.col,cell.row,movingId);
    });
  }

  private canMovePlot(sourceKey:string,tile:{col:number;row:number}):boolean {
    const source=this.plots.get(sourceKey),target=this.plots.get(this.key(tile.col,tile.row));
    if(!source||!target||source===target||target.state!=='grass'||tile.col>=this.farmSize||tile.row>=this.farmSize)return false;
    return !this.decorOccupiesCell(tile.col,tile.row);
  }

  private drawPlacementOverlay():void {
    const g=this.placementOverlay;if(!g)return;g.clear();
    if(this.activeTool!=='move'){return;}
    // Show the isometric cell grid only while editing the farm.
    for(let row=0;row<this.farmSize;row++)for(let col=0;col<this.farmSize;col++){
      const p=this.toWorld(col,row);
      g.lineStyle(1,0xf2ffe5,0.42);
      g.beginPath();g.moveTo(p.x,p.y-TILE_H/2);g.lineTo(p.x+TILE_W/2,p.y);
      g.lineTo(p.x,p.y+TILE_H/2);g.lineTo(p.x-TILE_W/2,p.y);g.closePath();g.strokePath();
    }
    if(!this.movingPreviewTile)return;
    const cells=this.movingDecor?this.placementCells(this.movingPreviewTile,this.movingDecor):[this.movingPreviewTile];
    const valid=this.movingPreviewValid;
    cells.forEach(cell=>{
      const p=this.toWorld(cell.col,cell.row);
      g.fillStyle(valid?0x36e66b:0xf04444,valid?0.38:0.42);
      g.lineStyle(3,valid?0x8dffad:0xff8b8b,0.98);
      g.beginPath();g.moveTo(p.x,p.y-TILE_H/2);g.lineTo(p.x+TILE_W/2,p.y);
      g.lineTo(p.x,p.y+TILE_H/2);g.lineTo(p.x-TILE_W/2,p.y);g.closePath();g.fillPath();g.strokePath();
    });
  }

  private moveActiveItem(pointer:Phaser.Input.Pointer):void {
    if(!this.movingDecor&&!this.movingPlotKey)return;
    const world=this.cameras.main.getWorldPoint(pointer.x,pointer.y),tile=this.toTile(world.x,world.y);
    if(!tile){this.movingPreviewTile=null;this.movingPreviewValid=false;this.drawPlacementOverlay();return;}
    this.movingPreviewTile=tile;
    if(this.movingPlotKey===this.key(tile.col,tile.row)){this.movingPreviewValid=true;this.drawPlacementOverlay();return;}
    this.movingPreviewValid=this.movingDecor
      ? this.canPlaceDecor(tile,this.movingDecor)
      : this.canMovePlot(this.movingPlotKey!,tile);
    this.drawPlacementOverlay();
  }

  private finishMovingItem():void {
    if(this.movingDecor||this.movingPlotKey){
      const tile=this.movingPreviewTile;
      if(tile&&this.movingPreviewValid){
        if(this.movingDecor){
          const current=this.decor[this.movingDecor];
          if(current&&(current.col!==tile.col||current.row!==tile.row)){
            this.decor[this.movingDecor]={col:tile.col,row:tile.row};
            this.drawScenery();this.renderOwnedAnimals();this.renderFruitTreeBadges();
            this.saveFarm();this.toast('Farm layout saved.');
          }
        }else if(this.movingPlotKey){
          const source=this.plots.get(this.movingPlotKey),target=this.plots.get(this.key(tile.col,tile.row));
          if(source&&target&&source!==target){
            const saved={state:target.state,watered:target.watered,growth:target.growth,crop:target.crop,readyAt:target.readyAt,witherAt:target.witherAt};
            Object.assign(target,{state:source.state,watered:source.watered,growth:source.growth,crop:source.crop,readyAt:source.readyAt,witherAt:source.witherAt});
            Object.assign(source,saved);this.redrawPlot(source);this.redrawPlot(target);
            this.selected=target;this.refreshSelection();this.drawSelection();this.saveFarm();this.toast('Field moved.');
          }
        }
      }else this.toast('Invalid position. Item returned to its original cell.');
    }
    this.movingDecor=null;this.movingPlotKey=null;this.movingPreviewTile=null;this.movingPreviewValid=false;
    this.drawPlacementOverlay();
  }

  private bindWorldInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if(pointer.wasTouch){
        this.touchPositions.set(pointer.id,{x:pointer.x,y:pointer.y,startX:pointer.x,startY:pointer.y});
        if(this.touchPositions.size===1&&this.activeTool==='move')this.handleWorldTap(pointer);
        if(this.touchPositions.size>=2){
          this.movingDecor=null;this.movingPlotKey=null;
          this.touchGesture=true;
          const pts=Array.from(this.touchPositions.values());
          this.pinchDistance=Phaser.Math.Distance.Between(pts[0]!.x,pts[0]!.y,pts[1]!.x,pts[1]!.y);
        }
        return;
      }
      if(pointer.rightButtonDown()||pointer.middleButtonDown()){
        this.cameraDragging=true;this.dragPoint.set(pointer.x,pointer.y);return;
      }
      this.handleWorldTap(pointer);
    });
    this.input.on('pointermove',(pointer:Phaser.Input.Pointer)=>{
      if(!pointer.wasTouch)this.updateCropHover(pointer);
      if(pointer.wasTouch&&this.touchPositions.has(pointer.id)){
        const touch=this.touchPositions.get(pointer.id)!;
        const previousX=touch.x,previousY=touch.y;
        touch.x=pointer.x;touch.y=pointer.y;
        const pts=Array.from(this.touchPositions.values());
        if(pts.length>=2){
          this.movingDecor=null;this.movingPlotKey=null;
          const camera=this.cameras.main;
          const midpoint={x:(pts[0]!.x+pts[1]!.x)/2,y:(pts[0]!.y+pts[1]!.y)/2};
          const distance=Phaser.Math.Distance.Between(pts[0]!.x,pts[0]!.y,pts[1]!.x,pts[1]!.y);
          if(this.pinchDistance>0&&distance>0){
            const anchor=camera.getWorldPoint(midpoint.x,midpoint.y);
            camera.setZoom(Phaser.Math.Clamp(camera.zoom*(distance/this.pinchDistance),this.minFarmZoom,2.0));
            const after=camera.getWorldPoint(midpoint.x,midpoint.y);
            camera.scrollX+=anchor.x-after.x;camera.scrollY+=anchor.y-after.y;
          }
          this.pinchDistance=distance;this.touchGesture=true;return;
        }
        const moved=Math.hypot(pointer.x-touch.startX,pointer.y-touch.startY)>7;
        if(moved&&this.activeTool==='move'&&(this.movingDecor||this.movingPlotKey)){
          this.touchGesture=true;this.moveActiveItem(pointer);return;
        }
        if(moved){
          this.cameraDragging=true;this.touchGesture=true;
        }
        if(this.cameraDragging){
          this.cameras.main.scrollX-=(pointer.x-previousX)/this.cameras.main.zoom;
          this.cameras.main.scrollY-=(pointer.y-previousY)/this.cameras.main.zoom;
        }
        return;
      }
      if((this.movingDecor||this.movingPlotKey)&&pointer.isDown){
        this.moveActiveItem(pointer);return;
      }
      if(this.cameraDragging&&pointer.isDown){
        this.cameras.main.scrollX-=(pointer.x-this.dragPoint.x)/this.cameras.main.zoom;
        this.cameras.main.scrollY-=(pointer.y-this.dragPoint.y)/this.cameras.main.zoom;
        this.dragPoint.set(pointer.x,pointer.y);
      }
    });
    this.input.on('pointerup',(pointer:Phaser.Input.Pointer)=>{
      if(pointer.wasTouch&&this.touchPositions.has(pointer.id)){
        const touch=this.touchPositions.get(pointer.id)!;
        const wasTap=!this.touchGesture&&Math.hypot(pointer.x-touch.startX,pointer.y-touch.startY)<=10;
        this.touchPositions.delete(pointer.id);
        if(this.touchPositions.size===0){
          if(wasTap&&this.activeTool!=='move')this.handleWorldTap(pointer);
          this.finishMovingItem();
          this.touchGesture=false;this.pinchDistance=0;this.cameraDragging=false;
        } else {
          const pts=Array.from(this.touchPositions.values());
          this.pinchDistance=pts.length>=2?Phaser.Math.Distance.Between(pts[0]!.x,pts[0]!.y,pts[1]!.x,pts[1]!.y):0;
        }
        return;
      }
      this.cameraDragging=false;
      this.finishMovingItem();
    });
    this.input.on('pointerupoutside',(pointer:Phaser.Input.Pointer)=>{
      if(pointer.wasTouch)this.touchPositions.delete(pointer.id);
      this.cameraDragging=false;
      this.movingDecor=null;this.movingPlotKey=null;this.movingPreviewTile=null;this.movingPreviewValid=false;this.drawPlacementOverlay();
      if(this.touchPositions.size===0){this.touchGesture=false;this.pinchDistance=0;}
    });
    this.input.mouse?.disableContextMenu();
  }


  private findFreeDecorTile(preferLowerFarm=true):{col:number;row:number}|null {
    const occupied=new Set(Object.values(this.decor).map(pos=>this.key(pos.col,pos.row)));
    const rows=preferLowerFarm
      ? [...Array(Math.max(0,this.farmSize-2))].map((_,i)=>i+2)
      : [...Array(this.farmSize)].map((_,i)=>i);
    for(const row of rows){
      for(let col=0;col<this.farmSize;col++){
        const key=this.key(col,row);
        const plot=this.plots.get(key);
        if(plot?.state==='grass'&&!occupied.has(key))return {col,row};
      }
    }
    return null;
  }

  private createCropHoverTooltip():void {
    const host=document.getElementById('game');if(!host)return;
    const tip=document.createElement('div');tip.className='crop-hover-tooltip';tip.setAttribute('role','status');tip.style.display='none';host.appendChild(tip);this.cropHoverTooltip=tip;
  }
  private updateCropHover(pointer:Phaser.Input.Pointer):void {
    if(!this.cropHoverTooltip)return;
    const world=this.cameras.main.getWorldPoint(pointer.x,pointer.y),tile=this.toTile(world.x,world.y);
    const plot=tile?this.plots.get(this.key(tile.col,tile.row)):undefined;
    if(!plot||!['growing','ready','withered'].includes(plot.state)){this.hoveredCropPlot=null;this.cropHoverTooltip.style.display='none';return;}
    this.hoveredCropPlot=plot;this.hoverPointer={x:pointer.x,y:pointer.y};this.refreshCropHoverTooltip();
  }
  private refreshCropHoverTooltip():void {
    const tip=this.cropHoverTooltip,plot=this.hoveredCropPlot;if(!tip||!plot)return;
    if(!['growing','ready','withered'].includes(plot.state)){tip.style.display='none';this.hoveredCropPlot=null;return;}
    const crop=CROPS[plot.crop];let status='';
    if(plot.state==='ready')status='Ready to harvest!';
    else if(plot.state==='withered')status='Withered · Plow to clear';
    else {const ms=Math.max(0,plot.readyAt-Date.now()),seconds=Math.ceil(ms/1000),mins=Math.floor(seconds/60),secs=seconds%60;status='Harvest in '+(mins>0?mins+'m ':'')+secs+'s';}
    tip.innerHTML='<strong>'+crop.emoji+' '+crop.name+'</strong><span>'+status+'</span>';
    tip.style.left=Math.min(this.scale.width-160,this.hoverPointer.x+14)+'px';tip.style.top=Math.max(8,this.hoverPointer.y-48)+'px';tip.style.display='flex';
  }

  private applyTool(plot: Plot): void {
    switch (this.activeTool) {
      case 'plow':
        if (plot.state === 'grass' && this.establishedFieldCount >= this.plowLimit) {
          const nextLevel=this.farmerLevel<13?13:13+3*(Math.floor((this.farmerLevel-13)/3)+1);
          this.toast('Field limit reached ('+this.plowLimit+'). Next field unlocks at Level '+nextLevel+'.');
          break;
        }
        if (plot.state === 'grass' || plot.state === 'withered') { plot.state = 'tilled'; plot.witherAt = 0; plot.readyAt = 0; plot.growth = 0; }
        break;
      case 'plant':
        if (plot.state === 'tilled') {
          if (this.inventory[this.selectedCrop] > 0) { plot.state = 'growing'; plot.crop = this.selectedCrop; plot.growth = 0; plot.witherAt = 0; this.inventory[this.selectedCrop]--; this.scheduleGrowth(plot, CROPS[this.selectedCrop].growMs); }
          else this.toast(`No ${CROPS[this.selectedCrop].name} seeds. Buy seeds from the Market first.`);
        }
        break;
      case 'water':
        if (plot.state === 'growing' && !plot.watered) { plot.watered = true; this.scheduleGrowth(plot, Math.max(1500, Math.ceil((plot.readyAt - Date.now()) / 2))); }
        break;
      case 'harvest':
        if (plot.state === 'ready') { const crop=CROPS[plot.crop]; const reward=this.toWorld(plot.col,plot.row); plot.state='tilled'; plot.growth=0; plot.readyAt=0; plot.witherAt=0; plot.watered=false; this.growthTimers.get(this.key(plot.col,plot.row))?.remove(false); this.growthTimers.delete(this.key(plot.col,plot.row)); this.harvestedCrops[plot.crop]++; this.xp+=crop.xp; this.harvests += 1; this.showHarvestReward(reward.x,reward.y-28,crop.reward); this.toast(`${crop.emoji} ${crop.name} harvested · sell value ${crop.reward} coins · added to Sell inventory`); }
        break;
      case 'select':
        break;
    }
    this.redrawPlot(plot);
    this.refreshHud();
    this.saveFarm();
  }

  private scheduleGrowth(plot: Plot, delay: number): void {
    const id = this.key(plot.col, plot.row);
    plot.readyAt = Date.now() + delay;
    plot.witherAt = 0;
    this.growthTimers.get(id)?.remove(false);
    this.growthTimers.set(id, this.time.delayedCall(delay, () => {
      plot.state = 'ready';
      plot.growth = 100;
      plot.readyAt = 0;
      plot.witherAt = Date.now() + Math.max(300000, CROPS[plot.crop].growMs * 2);
      this.redrawPlot(plot);
      this.scheduleWithering(plot);
      if (this.selected === plot) this.refreshSelection();
      this.saveFarm();
    }));
  }

  private scheduleWithering(plot: Plot): void {
    const delay = Math.max(0, plot.witherAt - Date.now());
    this.time.delayedCall(delay, () => {
      if (plot.state !== 'ready' || !plot.witherAt || plot.witherAt > Date.now()) return;
      plot.state = 'withered';
      plot.witherAt = 0;
      this.redrawPlot(plot);
      if (this.selected === plot) this.refreshSelection();
      this.saveFarm();
      this.toast('A crop has withered. Plow the plot to prepare it again.');
    });
  }

  private updateCropLifecycle(): void {
    const now = Date.now();
    let changed = false;
    for (const plot of this.plots.values()) {
      if (plot.state === 'growing' && plot.readyAt > 0) {
        const total = CROPS[plot.crop].growMs / (plot.watered ? 2 : 1);
        const remaining = Math.max(0, plot.readyAt - now);
        const progress = Math.min(99, Math.floor((1 - remaining / total) * 100));
        const stageStep = ['tomato','wheat','carrot','corn','strawberry','pumpkin'].includes(plot.crop) ? 20 : 25;
        const previousStage = Math.floor(plot.growth / stageStep);
        plot.growth = progress;
        if (Math.floor(progress / stageStep) !== previousStage) {
          this.redrawPlot(plot);
          changed = true;
        }
      }
      if (plot.state === 'ready' && plot.witherAt > 0 && plot.witherAt <= now) {
        plot.state = 'withered';
        plot.witherAt = 0;
        this.redrawPlot(plot);
        changed = true;
      }
    }
    if (changed) {
      if (this.selected) this.refreshSelection();
      this.saveFarm();
    }
  }

  private redrawPlot(plot: Plot): void {
    const id = this.key(plot.col, plot.row);
    this.plotOverlays.get(id)?.destroy();
    this.plotOverlays.delete(id);
    this.tomatoSprites.get(id)?.destroy();
    this.tomatoSprites.delete(id);
    this.cropSprites.get(id)?.destroy();
    this.cropSprites.delete(id);
    if (plot.state === 'grass') return;
    const p = this.toWorld(plot.col, plot.row);
    const g = this.add.graphics().setDepth(-4);
    this.plotOverlays.set(id, g);
    this.diamond(g, p.x, p.y, plot.state === 'withered' ? 0x725b45 : 0x805332, plot.state === 'withered' ? 0x574332 : 0x68452f);
    g.lineStyle(2, 0xb78655, 0.9);
    for (let i = -2; i <= 2; i += 1) {
      g.beginPath();
      g.moveTo(p.x - 25, p.y + i * 5);
      g.lineTo(p.x + 25, p.y + i * 5);
      g.strokePath();
    }
    if (plot.crop === 'tomato' && (plot.state === 'growing' || plot.state === 'ready') && this.textures.exists(`crop-tomato-${1}`)) {
      const stage = plot.state === 'ready' ? 5 : Math.min(5, Math.floor(plot.growth / 20) + 1);
      const sprite = this.add.image(p.x, p.y - 13, `crop-tomato-${stage}`);
      sprite.setDisplaySize(76, 76).setDepth(p.y + 2);
      this.tomatoSprites.set(id, sprite);
    } else if (['wheat','carrot','corn','strawberry','pumpkin'].includes(plot.crop) && (plot.state === 'growing' || plot.state === 'ready') && this.textures.exists(`crop-${plot.crop}`)) {
      const stage = plot.state === 'ready' ? 4 : Math.min(4, Math.floor(plot.growth / 20));
      const sprite = this.add.image(p.x, p.y - 13, `crop-${plot.crop}`, stage);
      sprite.setDisplaySize(76, 76).setDepth(p.y + 2);
      this.cropSprites.set(id, sprite);
    } else if (plot.state === 'growing' || plot.state === 'ready' || plot.state === 'withered') {
      this.drawCrop(g, p.x, p.y, plot);
    }
  }

  private drawCrop(g: Phaser.GameObjects.Graphics, x: number, y: number, plot: Plot): void {
    const crop=CROPS[plot.crop];
    const stage=plot.state==='ready'?1:plot.state==='withered'?0:Math.max(0.18,plot.growth/100);
    const h=plot.state==='ready'?27:plot.state==='withered'?8:8+Math.round(stage*18);
    if(plot.state==='withered'){
      g.lineStyle(2,0x927b54,1);g.beginPath();g.moveTo(x,y+2);g.lineTo(x-4,y-h);g.moveTo(x-2,y-5);g.lineTo(x-12,y-11);g.moveTo(x-3,y-8);g.lineTo(x+8,y-13);g.strokePath();
      g.fillStyle(0x9b875b,1);g.fillEllipse(x-8,y-7,8,4);g.fillEllipse(x+7,y-9,8,4);return;
    }
    const stem=plot.watered?0x347e43:0x438b3d;
    const leafColor=plot.watered?0x5eaa4d:0x78b64f;
    const stems=crop.name==='Wheat'?3:crop.name==='Corn'?2:4;
    for(let n=0;n<stems;n++){
      const ox=(n-(stems-1)/2)*5;
      const topY=y-h-(n%2)*3;
      g.lineStyle(crop.name==='Wheat'?2.2:2.8,stem,1);g.beginPath();g.moveTo(x+ox,y+2);g.lineTo(x+ox+(n%2?2:-2),topY);g.strokePath();
      if(crop.name==='Wheat'){
        g.fillStyle(0x6b9e43,1);g.fillEllipse(x+ox-5,topY+8,11,4);g.fillEllipse(x+ox+5,topY+14,10,4);
        if(plot.state==='ready'){
          g.lineStyle(2,0xc99a37,1);for(let k=0;k<4;k++){g.beginPath();g.moveTo(x+ox,topY+2+k*4);g.lineTo(x+ox+(k%2?5:-5),topY-2+k*4);g.strokePath();}
          g.fillStyle(0xe8c45b,1);g.fillEllipse(x+ox,topY-2,5,10);
        }
      }else if(crop.name==='Carrot'){
        g.fillStyle(leafColor,1);g.fillEllipse(x+ox-5,topY+5,13,5);g.fillEllipse(x+ox+5,topY+2,12,5);g.fillEllipse(x+ox,topY-3,5,10);
        if(plot.state==='ready'){g.fillStyle(0xf28b32,1);g.fillTriangle(x+ox-5,y-4,x+ox+5,y-4,x+ox,y+10);g.fillStyle(0x4c923e,1);g.fillTriangle(x+ox,y-4,x+ox-5,y-13,x+ox-1,y-7);g.fillTriangle(x+ox,y-4,x+ox+6,y-14,x+ox+2,y-7);}
      }else if(crop.name==='Corn'){
        g.fillStyle(leafColor,1);g.fillPoints([{x:x+ox,y:topY+15},{x:x+ox-13,y:topY+4},{x:x+ox-4,y:topY+18}],true);g.fillPoints([{x:x+ox,y:topY+18},{x:x+ox+13,y:topY+6},{x:x+ox+4,y:topY+20}],true);
        if(plot.state==='ready'){g.fillStyle(0xf0cf59,1);g.fillRoundedRect(x+ox-3,topY+1,7,16,3);g.fillStyle(0xffe68b,1);for(let k=0;k<3;k++)g.fillCircle(x+ox-1,topY+4+k*4,1);}
      }else{
        g.fillStyle(leafColor,1);g.fillEllipse(x+ox-6,topY+8,14,6);g.fillEllipse(x+ox+6,topY+4,14,6);g.fillEllipse(x+ox,topY-1,10,6);
        if(plot.state==='ready'){
          const fruit=crop.name==='Strawberry'?0xd94c53:crop.name==='Tomato'?0xd94b38:crop.name==='Pumpkin'?0xe58b35:crop.name==='Blueberry'?0x536cb5:0x3b9b55;
          g.fillStyle(fruit,1);
          if(crop.name==='Pumpkin'){g.fillEllipse(x+ox,topY+9,15,12);g.lineStyle(1,0xb96128,0.8);g.beginPath();g.moveTo(x+ox,topY+3);g.lineTo(x+ox,topY+15);g.strokePath();}
          else if(crop.name==='Watermelon'){g.fillEllipse(x+ox,topY+9,16,10);g.lineStyle(1,0x1e713f,1);g.beginPath();g.moveTo(x+ox-5,topY+6);g.lineTo(x+ox-3,topY+12);g.moveTo(x+ox+2,topY+5);g.lineTo(x+ox+4,topY+12);g.strokePath();}
          else {g.fillCircle(x+ox,topY+8,6);g.fillStyle(0x4e8c3d,1);g.fillEllipse(x+ox+3,topY+2,7,3);}
          if(crop.name==='Strawberry'){g.fillStyle(0xffe6a0,1);g.fillCircle(x+ox-2,topY+7,0.8);g.fillCircle(x+ox+2,topY+9,0.8);}
        }
      }
    }
    if(plot.state==='ready'&&crop.name==='Wheat'){g.fillStyle(0xf4d16c,1);g.fillEllipse(x,y-h-6,5,12);}
  }

  private drawSelection(): void {
    this.overlay.clear();
    if (!this.selected) return;
    const p = this.toWorld(this.selected.col, this.selected.row);
    this.overlay.lineStyle(3, 0xfff6b2, 1);
    this.overlay.beginPath();
    this.overlay.moveTo(p.x, p.y - TILE_H / 2);
    this.overlay.lineTo(p.x + TILE_W / 2, p.y);
    this.overlay.lineTo(p.x, p.y + TILE_H / 2);
    this.overlay.lineTo(p.x - TILE_W / 2, p.y);
    this.overlay.closePath();
    this.overlay.strokePath();
  }


  private bindSideRail():void {
    const quests=document.getElementById('rail-quests');
    quests?.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-claim-quest]');if(b)this.claimQuest(b.dataset.claimQuest||'');});
    document.getElementById('rail-events')?.addEventListener('click',e=>{if((e.target as HTMLElement).closest('[data-claim-event]'))this.claimEvent();});
    document.getElementById('rail-rewards')?.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-claim-milestone]');if(b)this.claimMilestone(Number(b.dataset.claimMilestone));});
    document.getElementById('rail-orders')?.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-fulfil-order]');if(b)this.fulfilOrder(b.dataset.fulfilOrder||'');});
    this.renderSideRail();
  }
  private renderSideRail():void {
    const q=document.getElementById('rail-quests'),o=document.getElementById('rail-orders');
    if(q)q.innerHTML=this.renderQuests(true);
    if(o)o.innerHTML=this.renderOrders();
    const events=document.getElementById('rail-events');if(events)events.innerHTML=this.renderEvents();
    const rewards=document.getElementById('rail-rewards');if(rewards)rewards.innerHTML=this.renderRewards();
  }
  private openFieldSeedPicker():void {
    if(!this.selected)return;
    const modal=document.getElementById('market-modal');const title=modal?.querySelector('.market-header h2');
    if(title)title.textContent='Choose seeds for this field';
    modal?.querySelector('.market-tabs')?.classList.add('inventory-hidden');
    const intro=document.getElementById('market-intro');
    if(intro)intro.textContent='Choose an unlocked crop, buy seeds if needed, then sow this plot. Locked crops show their farmer level.';
    modal?.classList.add('field-seed-mode','open');modal?.setAttribute('aria-hidden','false');
    const panel=modal?.querySelector<HTMLElement>('.market-window');if(panel&&this.selected){const p=this.toWorld(this.selected.col,this.selected.row);const camera=this.cameras.main;const rect=document.getElementById('game')?.getBoundingClientRect();if(rect){const sx=rect.left+(p.x-camera.worldView.x)*camera.zoom;const sy=rect.top+(p.y-camera.worldView.y)*camera.zoom;panel.style.left=Math.max(12,Math.min(window.innerWidth-520,sx-210))+'px';panel.style.top=Math.max(72,Math.min(window.innerHeight-300,sy-220))+'px';}}
    this.renderFieldSeedPicker();
  }
  private renderFieldSeedPicker():void {
    const host=document.getElementById('market-items');if(!host)return;
    const level=this.farmerLevel;
    const selected=this.selected?this.selected.state:'grass';
    const rows=(Object.entries(CROPS) as Array<[CropId,typeof CROPS[CropId]]>).map(([id,c])=>{
      const locked=level<c.unlockLevel,active=this.selectedCrop===id;
      return '<article class="market-item field-seed-card '+(active?'chosen':'')+'"><div class="market-art">'+c.emoji+'</div><div class="market-copy"><strong>'+c.name+(active?' · Selected':'')+'</strong><small>'+ (locked?'🔒 Unlock at Level '+c.unlockLevel:'Grow '+Math.round(c.growMs/1000)+' sec · Sell for '+c.reward+' coins · In bag: '+this.inventory[id])+'</small></div><button class="market-buy" data-field-seed="'+id+'" '+(locked?'disabled':'')+'>'+(locked?'Locked':active?'Selected':'Select')+'</button><button class="market-buy seed-buy" data-field-buy="'+id+'" '+(locked||this.coins<c.cost?'disabled':'')+'>🪙 '+c.cost+' · Buy</button></article>';
    }).join('');
    host.innerHTML='<section class="inventory-section"><h3>🌱 Choose a seed · Field '+(this.selected? (this.selected.col+1)+', '+(this.selected.row+1):'')+' · '+selected+'</h3><p>Selecting a crop will sow this field immediately. The seed is taken from your bag, or purchased for '+CROPS[this.selectedCrop].cost+' coins if you have none.</p><div class="quest-list">'+rows+'</div></section>';
  }
  private sowSelectedPlot():void {
    const plot=this.selected;if(!plot)return;
    const crop=CROPS[this.selectedCrop];if(this.farmerLevel<crop.unlockLevel){this.toast('Reach Level '+crop.unlockLevel+' to unlock '+crop.name+'.');return;}
    if(plot.state!=='tilled'){this.toast('Plow this field before sowing.');return;}
    if(this.inventory[this.selectedCrop]<=0){
      if(this.coins<crop.cost){this.toast('Not enough coins to buy '+crop.name+' seeds.');this.openFieldSeedPicker();return;}
      this.coins-=crop.cost;
    } else this.inventory[this.selectedCrop]--;
    plot.state='growing';plot.crop=this.selectedCrop;plot.growth=0;plot.watered=false;this.scheduleGrowth(plot,crop.growMs);
    this.redrawPlot(plot);this.saveFarm();this.refreshHud();this.closeMarket();this.refreshSelection();this.drawSelection();this.toast(crop.name+' planted · '+(this.inventory[this.selectedCrop]>=0?'seed applied':'')+'');
  }

  private bindToolbar(): void {
    document.getElementById('tool-sell')?.addEventListener('click',()=>{this.openMarket();document.querySelector<HTMLButtonElement>('[data-market-tab=sell]')?.click();});
    document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(button => {
      button.addEventListener('click', () => {
        this.activeTool = button.dataset.tool as Tool; this.movingDecor=null; this.movingPlotKey=null;this.movingPreviewTile=null;this.movingPreviewValid=false;this.drawPlacementOverlay();
        document.querySelectorAll('[data-tool]').forEach(el => el.classList.remove('active'));
        button.classList.add('active');
        if(this.activeTool==='plant'&&this.selected)this.openFieldSeedPicker();
        this.refreshSelection();
      });
    });
  }


  private bindCropSelector(): void {
    const picker = document.getElementById('crop-picker') as HTMLSelectElement | null;
    if (!picker) return;
    picker.addEventListener('change', () => {
      const crop = picker.value as CropId;
      if (!CROPS[crop] || this.farmerLevel < CROPS[crop].unlockLevel) return;
      this.selectedCrop = crop;
      this.refreshCropSelector();
      this.refreshSelection();
    });
    this.refreshCropSelector();
  }

  private refreshCropSelector(): void {
    const picker = document.getElementById('crop-picker') as HTMLSelectElement | null;
    if (!picker) return;
    const level = this.farmerLevel;
    picker.innerHTML = (Object.entries(CROPS) as Array<[CropId, typeof CROPS[CropId]]>)
      .map(([id, crop]) => {
        const locked = level < crop.unlockLevel;
        return `<option value="${id}" ${locked ? 'disabled' : ''}>${crop.emoji} ${crop.name} · ${locked ? 'Unlock LV ' + crop.unlockLevel : this.inventory[id] + ' seeds'}</option>`;
      }).join('');
    picker.value = this.selectedCrop;
    const count = document.getElementById('selected-seed-count');
    if (count) count.textContent = `${this.inventory[this.selectedCrop]} available`;
  }

  private editFarmProfile():void {
    const farmerInput=document.getElementById('profile-farmer-name') as HTMLInputElement|null;
    const farmInput=document.getElementById('profile-farm-name') as HTMLInputElement|null;
    const error=document.getElementById('profile-form-error');
    if(farmerInput)farmerInput.value=this.farmerName;
    if(farmInput)farmInput.value=this.farmName;
    if(error)error.textContent='';
    const modal=document.getElementById('farm-profile-modal');
    modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');
    farmerInput?.focus();
    farmerInput?.select();
  }
  private bindMarket(): void {
    const showDrawer=(section:'quests'|'orders'|'events'|'rewards')=>{
      const drawer=document.getElementById('activity-drawer');if(!drawer)return;
      const title=document.getElementById('drawer-title');if(title)title.textContent=({quests:'Farm Quests',orders:'Orders & Delivery',events:'Farm Events',rewards:'Farm Rewards'} as Record<string,string>)[section];
      ['quests','orders','events','rewards'].forEach(key=>{
        const panel=document.getElementById('rail-'+key);if(!panel)return;
        const active=key===section;panel.classList.toggle('drawer-hidden',!active);
        panel.hidden=!active;panel.style.display=active?'':'none';
      });
      drawer.hidden=false;drawer.style.display='block';drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');
    };
    const closeDrawer=()=>{const drawer=document.getElementById('activity-drawer');if(!drawer)return;drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');drawer.hidden=true;drawer.style.display='none';};
    document.getElementById('left-quests')?.addEventListener('click',()=>showDrawer('quests'));
    document.getElementById('top-quests')?.addEventListener('click',()=>showDrawer('quests'));
    document.getElementById('left-orders')?.addEventListener('click',()=>showDrawer('orders'));
    document.getElementById('top-orders')?.addEventListener('click',()=>showDrawer('orders'));
    document.getElementById('left-events')?.addEventListener('click',()=>showDrawer('events'));
    document.getElementById('left-rewards')?.addEventListener('click',()=>showDrawer('rewards'));
    const drawerClose=document.getElementById('drawer-close');
    const dismissDrawer=(event:Event)=>{event.preventDefault();event.stopPropagation();closeDrawer();};
    drawerClose?.addEventListener('click',dismissDrawer);
    drawerClose?.addEventListener('pointerup',dismissDrawer,{capture:true});
    drawerClose?.addEventListener('touchend',dismissDrawer,{capture:true,passive:false});
    document.getElementById('top-inventory')?.addEventListener('click',()=>this.openInventory());
    document.getElementById('top-settings')?.addEventListener('click',()=>this.editFarmProfile());
    document.getElementById('settings-open')?.addEventListener('click',()=>this.editFarmProfile());
    document.getElementById('coins-plus')?.addEventListener('click',()=>this.openMarket());
    document.getElementById('market-open')?.addEventListener('click',()=>this.openMarket());
    document.getElementById('edit-farm-profile')?.addEventListener('click',()=>this.editFarmProfile());
    document.getElementById('edit-farm-shortcut')?.addEventListener('click',()=>this.editFarmProfile());
    document.getElementById('buildings-open')?.addEventListener('click',()=>{this.openMarket();document.querySelector<HTMLButtonElement>('[data-market-tab=buildings]')?.click();});
    document.getElementById('decor-open')?.addEventListener('click',()=>{this.openMarket();document.querySelector<HTMLButtonElement>('[data-market-tab=decor]')?.click();});
    document.getElementById('inventory-open')?.addEventListener('click',()=>this.openInventory());
    const profileModal=document.getElementById('farm-profile-modal');
    const closeProfile=()=>{profileModal?.classList.remove('open');profileModal?.setAttribute('aria-hidden','true');};
    document.getElementById('farm-profile-close')?.addEventListener('click',closeProfile);
    document.getElementById('farm-profile-cancel')?.addEventListener('click',closeProfile);
    profileModal?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeProfile();});
    document.getElementById('farm-profile-form')?.addEventListener('submit',e=>{
      e.preventDefault();
      const farmerInput=document.getElementById('profile-farmer-name') as HTMLInputElement|null;
      const farmInput=document.getElementById('profile-farm-name') as HTMLInputElement|null;
      const error=document.getElementById('profile-form-error');
      const farmer=farmerInput?.value.trim().slice(0,24)||'';
      const farm=farmInput?.value.trim().slice(0,28)||'';
      if(!farmer||!farm){if(error)error.textContent='Please enter both your farmer and farm names.';return;}
      this.farmerName=farmer;this.farmName=farm;this.saveFarm();this.refreshHud();closeProfile();this.toast('Your farm profile has been updated.');
    });
    document.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(x=>x.addEventListener('click',()=>this.closeMarket()));
    document.getElementById('market-modal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)this.closeMarket();});
    document.querySelectorAll<HTMLButtonElement>('[data-market-tab]').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('[data-market-tab]').forEach(x=>x.classList.remove('active'));tab.classList.add('active');const cat=tab.dataset.marketTab||'seeds';const intro=document.getElementById('market-intro');if(intro)intro.textContent=cat==='seeds'?'Choose seeds for your next harvest.':cat==='animals'?'Welcome new animals to your farm.':cat==='decor'?'Grow your orchard and personalise your homestead.':cat==='buildings'?'Build and upgrade new farm facilities as your farmer levels up.':cat==='sell'?'Sell harvested crops, orchard fruit, animal produce and crafted goods for coins.':'Buy the correct feed for each animal. Feed is required to produce eggs and milk.';this.renderMarket(cat);}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){this.closeMarket();document.getElementById('farm-profile-modal')?.classList.remove('open');document.getElementById('farm-profile-modal')?.setAttribute('aria-hidden','true');}});
    document.getElementById('animal-action')?.addEventListener('click',()=>this.careForAnimals());
     document.getElementById('market-items')?.addEventListener('click',e=>{const target=e.target as HTMLElement;const seed=target.closest<HTMLButtonElement>('[data-field-seed]');if(seed&&!seed.disabled){this.selectedCrop=seed.dataset.fieldSeed as CropId;this.activeTool='plant';document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.tool==='plant'));if(this.selected?.state==='tilled')this.sowSelectedPlot();else{this.closeMarket();this.toast(CROPS[this.selectedCrop].name+' selected. Tap prepared fields to sow.');}}const fieldBuy=target.closest<HTMLButtonElement>('[data-field-buy]');if(fieldBuy&&!fieldBuy.disabled){const id=fieldBuy.dataset.fieldBuy as CropId;const crop=CROPS[id];if(crop&&this.selected&&this.selected.state==='tilled'&&this.farmerLevel>=crop.unlockLevel&&this.coins>=crop.cost){this.coins-=crop.cost;this.inventory[id]++;this.selectedCrop=id;this.saveFarm();this.refreshHud();this.renderFieldSeedPicker();this.toast(crop.name+' seeds purchased and added to your bag.');}else if(crop&&this.coins<crop.cost)this.toast('Not enough coins to buy '+crop.name+' seeds.');}const sell=target.closest<HTMLButtonElement>('[data-sell-item]');if(sell&&!sell.disabled)this.sellInventoryItem(sell.dataset.sellItem||'');if(target.closest('#sell-produce'))this.sellProduce();const quest=target.closest<HTMLButtonElement>('[data-claim-quest]');if(quest)this.claimQuest(quest.dataset.claimQuest||'');const order=target.closest<HTMLButtonElement>('[data-fulfil-order]');if(order)this.fulfilOrder(order.dataset.fulfilOrder||'');const warehouse=target.closest<HTMLButtonElement>('#upgrade-warehouse');if(warehouse){const cost=this.buildings.warehouseLevel*400;if(this.buildings.warehouseLevel<10&&this.coins>=cost){this.coins-=cost;this.buildings.warehouseLevel++;this.buildingLevels.silo=this.buildings.warehouseLevel;this.saveFarm();this.refreshHud();this.renderInventory();this.toast('Silo upgraded. Egg and milk storage expanded!');}}const toggle=target.closest<HTMLButtonElement>('[data-animal-toggle]');if(toggle){const animal=this.animals[Number(toggle.dataset.animalToggle)];if(animal){animal.assigned=animal.assigned===false;this.saveFarm();this.refreshHud();if(this.activeBuilding==='coop'||this.activeBuilding==='barn')this.renderBuildingPanel(this.activeBuilding);else if(this.activeBuilding)this.renderGenericBuildingPanel(this.activeBuilding);else this.renderInventory();this.toast(animal.assigned?'Animal assigned to production.':'Animal is resting.');}}const action=target.closest<HTMLButtonElement>('[data-building-action]')?.dataset.buildingAction;if(action&&(this.activeBuilding==='coop'||this.activeBuilding==='barn'))this.runBuildingAction(this.activeBuilding,action as 'collect'|'feed');const start=target.closest<HTMLButtonElement>('[data-production-start]')?.dataset.productionStart;if(start&&this.activeBuilding)this.startProduction(this.activeBuilding,start);if(target.closest('#collect-production')&&this.activeBuilding)this.collectProduction(this.activeBuilding);const delivery=target.closest<HTMLButtonElement>('[data-fulfil-crafted]')?.dataset.fulfilCrafted;if(delivery)this.fulfilCraftedOrder(delivery);});
  }
  private careForAnimals(): void { if(!this.animals.length){this.openMarket();document.querySelector<HTMLButtonElement>('[data-market-tab=animals]')?.click();return;}let collected=0,fed=0,waiting=0;for(const kind of ['hen','cow'] as AnimalId[]){const result=this.collectAndFeed(kind);collected+=result.collected;fed+=result.fed;waiting+=result.waiting;}this.saveFarm();this.refreshHud();this.toast('Stored '+collected+' product(s) · fed '+fed+' · waiting for feed: '+waiting+'.');}
  private productionCapacity(kind:AnimalId):number{return 10+((kind==='hen'?this.buildings.coopLevel:this.buildings.barnLevel)-1)*5+(this.buildings.warehouseLevel-1)*10;}
  private collectAndFeed(kind:AnimalId):{collected:number;fed:number;waiting:number}{let collected=0,fed=0,waiting=0;const now=Date.now();const field=kind==='hen'?'eggs':'milk';for(const animal of this.animals.filter(a=>a.id===kind&&a.assigned!==false)){if(animal.readyAt>0&&animal.readyAt<=now){if(this.produce[field]<this.productionCapacity(kind)){this.produce[field]++;animal.readyAt=0;collected++;}else{waiting++;continue;}}if(animal.readyAt===0){if(this.feed[kind]>0){this.feed[kind]--;animal.readyAt=now+(kind==='hen'?45000:60000);fed++;const actor=this.animalActors[this.animals.indexOf(animal)];if(actor)this.playFeedingAnimation(actor);}else waiting++;}}return{collected,fed,waiting};}
  private runBuildingAction(id:'coop'|'barn',action:'collect'|'feed'):void{const kind:AnimalId=id==='coop'?'hen':'cow';let collected=0,fed=0,waiting=0;if(action==='collect'){const field=kind==='hen'?'eggs':'milk';for(const animal of this.animals.filter(a=>a.id===kind&&a.assigned!==false&&a.readyAt>0&&a.readyAt<=Date.now())){if(this.produce[field]>=this.productionCapacity(kind))break;this.produce[field]++;animal.readyAt=0;collected++;}}else{for(const animal of this.animals.filter(a=>a.id===kind&&a.assigned!==false&&a.readyAt===0)){if(this.feed[kind]>0){this.feed[kind]--;animal.readyAt=Date.now()+(kind==='hen'?45000:60000);fed++;const actor=this.animalActors[this.animals.indexOf(animal)];if(actor)this.playFeedingAnimation(actor);}else waiting++;}}this.saveFarm();this.refreshHud();this.renderBuildingPanel(id);this.toast(action==='collect'?'Collected '+collected+' '+(kind==='hen'?'eggs':'milk')+'.':'Fed '+fed+' animal(s) · '+waiting+' waiting for feed.');}
  private buildingCapacity(id: AnimalId): number { return 2 + ((id==='hen'?this.buildings.coopLevel:this.buildings.barnLevel)-1)*2; }
  private openGenericBuilding(id:BuildingId):void {
    this.activeBuilding=id;const modal=document.getElementById('market-modal');const title=modal?.querySelector('.market-header h2');if(title)title.textContent=id==='silo'?'Grain Silo':id==='bakery'?'Village Bakery':id==='greenhouse'?'Greenhouse':id==='windmill'?'Windmill':id==='stable'?'Horse Stable':id==='well'?'Stone Well':id==='workshop'?'Farm Workshop':'Water Tower';
    modal?.querySelector('.market-tabs')?.classList.add('inventory-hidden');const intro=document.getElementById('market-intro');if(intro)intro.textContent='Upgrade this farm building as you progress.';modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');this.renderGenericBuildingPanel(id);
  }
  private renderGenericBuildingPanel(id:BuildingId):void {
    if(id==='bakery'||id==='greenhouse'||id==='windmill'){this.renderProductionPanel(id);return;}
    const level=this.buildingLevels[id]||this.buildings.warehouseLevel;const cost=level*350;const names:Record<BuildingId,string>={coop:'Chicken Run',barn:'Cow Pasture',silo:'Grain Silo',bakery:'Village Bakery',greenhouse:'Greenhouse',windmill:'Windmill',stable:'Horse Stable',well:'Stone Well',workshop:'Farm Workshop',waterTower:'Water Tower'};
    const perks:Record<BuildingId,string>={coop:'Expands the chicken run, adding 2 hen spaces and 5 egg storage per level.',barn:'Expands the cow pasture, adding 2 cow spaces and 5 milk storage per level.',silo:'Adds 10 shared animal-product storage spaces per level.',bakery:'A growing production hub for baked-goods recipes.',greenhouse:'A glasshouse for advanced crops and specialist growing.',windmill:'A landmark mill that completes your homestead.',stable:'Unlocks the next chapter of farm companions and stable upgrades.',well:'A reliable water source for your growing homestead.',workshop:'A dedicated place for future tool crafting and farm improvements.',waterTower:'A landmark water system for your expanded farm.'};
    const host=document.getElementById('market-items');if(!host)return;
    host.innerHTML='<section class="inventory-section"><h3>🏗️ '+names[id]+' · Level '+level+'</h3><p>'+perks[id]+'</p><div class="building-levels">'+[1,2,3,4,5].map(n=>'<span class="'+(n<=level?'reached':'')+'">★</span>').join('')+'</div><p>Upgrade cost: '+cost+' coins. Maximum level: 5.</p><button class="market-buy" id="upgrade-generic-building" '+(level>=5||this.coins<cost?'disabled':'')+'>'+(level>=5?'Maximum level reached':'🪙 '+cost+' · Upgrade to Level '+(level+1))+'</button></section>';
    host.querySelector<HTMLButtonElement>('#upgrade-generic-building')?.addEventListener('click',()=>{if(level>=5||this.coins<cost)return;this.coins-=cost;if(id==='silo')this.buildings.warehouseLevel++;this.buildingLevels[id]=level+1;this.drawScenery();this.saveFarm();this.refreshHud();this.renderGenericBuildingPanel(id);this.toast(names[id]+' upgraded to Level '+(level+1)+'.');});
  }

  private productionRecipes(id:'bakery'|'greenhouse'|'windmill'):Array<{id:string;name:string;icon:string;seconds:number;inputs:Partial<Record<CropId,number>>;goods:Partial<Record<ProductId,number>>;output:ProductId;quantity:number;coins:number;xp:number}> {
    if(id==='windmill')return [{id:'flour',name:'Mill Wheat into Flour',icon:'🌾',seconds:45,inputs:{wheat:2},goods:{},output:'flour',quantity:2,coins:0,xp:5}];
    if(id==='bakery')return [{id:'bread',name:'Bake Fresh Bread',icon:'🍞',seconds:75,inputs:{},goods:{flour:2},output:'bread',quantity:1,coins:0,xp:9},{id:'pastry',name:'Bake Country Pastries',icon:'🥐',seconds:110,inputs:{},goods:{flour:2},output:'pastry',quantity:1,coins:0,xp:13}];
    return [{id:'grapes',name:'Grow Greenhouse Grapes',icon:'🍇',seconds:100,inputs:{strawberry:2},goods:{},output:'grapes',quantity:2,coins:0,xp:11}];
  }
  private productName(id:ProductId):string{return ({flour:'Flour',bread:'Fresh Bread',pastry:'Country Pastries',grapes:'Greenhouse Grapes'} as Record<ProductId,string>)[id];}
  private updateProduction():void {
    if(this.activeBuilding==='bakery'||this.activeBuilding==='greenhouse'||this.activeBuilding==='windmill')this.renderProductionPanel(this.activeBuilding);
  }
  private renderProductionPanel(id:'bakery'|'greenhouse'|'windmill'):void {
    const host=document.getElementById('market-items');if(!host)return;
    const level=this.buildingLevels[id],job=this.productionJobs[id],recipes=this.productionRecipes(id),now=Date.now();
    const cards=recipes.map(r=>{const available=Object.entries(r.inputs).every(([key,n])=>this.inventory[key as CropId]>=(n||0))&&Object.entries(r.goods).every(([key,n])=>this.crafted[key as ProductId]>=(n||0));const costs=[...Object.entries(r.inputs).map(([k,n])=>(n||0)+' '+CROPS[k as CropId].name),...Object.entries(r.goods).map(([k,n])=>(n||0)+' '+this.productName(k as ProductId))].join(' + ');return '<article class="market-item"><div class="market-art">'+r.icon+'</div><div class="market-copy"><strong>'+r.name+'</strong><small>Uses '+costs+' · '+Math.max(10,Math.round(r.seconds*(1-(level-1)*.1)))+' sec · Produces '+r.quantity+' '+this.productName(r.output)+'</small></div><button class="market-buy" data-production-start="'+r.id+'" '+(job||!available?'disabled':'')+'>'+(job?'Busy':available?'Start':'Missing ingredients')+'</button></article>';}).join('');
    const active=job?recipes.find(r=>r.id===job.recipe):null,remaining=job?Math.max(0,Math.ceil((job.readyAt-now)/1000)):0;
    const jobCard=job&&active?'<section class="inventory-section"><h3>⏳ Production in progress</h3><p>'+active.icon+' '+active.name+' · '+(remaining>0?remaining+' seconds remaining':'Ready to collect')+'</p><div class="production-track"><i style="width:'+Math.max(0,Math.min(100,(1-(job.readyAt-now)/(active.seconds*1000))*100))+'%"></i></div><button class="market-buy" id="collect-production" '+(remaining>0?'disabled':'')+'>Collect '+active.quantity+' '+this.productName(active.output)+'</button></section>':'<section class="inventory-section"><h3>🏭 Production queue</h3><p>One production order can run at a time. Building upgrades reduce production time by 10% per level.</p></section>';
    host.innerHTML='<section class="inventory-section"><h3>🏗️ '+({bakery:'Village Bakery',greenhouse:'Greenhouse',windmill:'Windmill'} as Record<string,string>)[id]+' · Level '+level+'</h3><p>'+({windmill:'Turn harvested wheat into flour for your bakery.',bakery:'Use flour to bake goods for delivery and sale.',greenhouse:'Grow premium grapes using strawberry seeds.'} as Record<string,string>)[id]+'</p><div class="building-levels">'+[1,2,3,4,5].map(n=>'<span class="'+(n<=level?'reached':'')+'">★</span>').join('')+'</div></section>'+jobCard+'<section class="inventory-section"><h3>📋 Available recipes</h3><div class="quest-list">'+cards+'</div></section><section class="inventory-section"><h3>📦 Crafted goods</h3><div class="inventory-grid">'+(['flour','bread','pastry','grapes'] as ProductId[]).map(p=>'<article class="market-item"><div class="market-art">'+({flour:'🌾',bread:'🍞',pastry:'🥐',grapes:'🍇'} as Record<ProductId,string>)[p]+'</div><div class="market-copy"><strong>'+this.productName(p)+'</strong></div><span class="inventory-quantity">× '+this.crafted[p]+'</span></article>').join('')+'</div></section><section class="inventory-section"><h3>⬆️ Building upgrade · Level '+level+'</h3><p>Each upgrade reduces production time by 10%, up to Level 5.</p><button class="market-buy" id="upgrade-generic-building" '+(level>=5||this.coins<level*350?'disabled':'')+'>'+(level>=5?'Maximum level reached':'🪙 '+(level*350)+' · Upgrade to Level '+(level+1))+'</button></section>';
    host.querySelector<HTMLButtonElement>('#upgrade-generic-building')?.addEventListener('click',()=>{const cost=level*350;if(level>=5||this.coins<cost)return;this.coins-=cost;this.buildingLevels[id]=level+1;this.saveFarm();this.refreshHud();this.renderProductionPanel(id);this.toast('Building upgraded to Level '+(level+1)+'.');});
  }
  private startProduction(id:BuildingId,recipeId:string):void {
    if(id!=='bakery'&&id!=='greenhouse'&&id!=='windmill')return;
    if(this.productionJobs[id])return;
    const recipe=this.productionRecipes(id).find(r=>r.id===recipeId);if(!recipe)return;
    if(!Object.entries(recipe.inputs).every(([k,n])=>this.inventory[k as CropId]>=(n||0))||!Object.entries(recipe.goods).every(([k,n])=>this.crafted[k as ProductId]>=(n||0))){this.toast('Not enough ingredients for this recipe.');return;}
    Object.entries(recipe.inputs).forEach(([k,n])=>this.inventory[k as CropId]-=(n||0));
    Object.entries(recipe.goods).forEach(([k,n])=>this.crafted[k as ProductId]-=(n||0));
    const duration=Math.max(10000,recipe.seconds*1000*(1-(this.buildingLevels[id]-1)*.1));
    this.productionJobs[id]={recipe:recipe.id,readyAt:Date.now()+duration};
    this.saveFarm();this.refreshHud();this.renderProductionPanel(id);this.toast(recipe.name+' started.');
  }
  private collectProduction(id:BuildingId):void {
    if(id!=='bakery'&&id!=='greenhouse'&&id!=='windmill')return;
    const job=this.productionJobs[id];if(!job||job.readyAt>Date.now())return;
    const recipe=this.productionRecipes(id).find(r=>r.id===job.recipe);if(!recipe)return;
    this.crafted[recipe.output]+=recipe.quantity;this.xp+=recipe.xp;this.productionJobs[id]=null;
    this.saveFarm();this.refreshHud();this.renderProductionPanel(id);this.toast('Collected '+recipe.quantity+' '+this.productName(recipe.output)+' · +'+recipe.xp+' XP');
  }
  private fulfilCraftedOrder(id:string):void {
    const orders:Record<string,{product:ProductId;quantity:number;coins:number;xp:number}>={bread:{product:'bread',quantity:1,coins:58,xp:16},pastry:{product:'pastry',quantity:1,coins:86,xp:24},grapes:{product:'grapes',quantity:2,coins:72,xp:20}};
    const order=orders[id];if(!order||this.crafted[order.product]<order.quantity)return;
    this.crafted[order.product]-=order.quantity;this.coins+=order.coins;this.xp+=order.xp;this.ordersCompleted['crafted-'+id]=(this.ordersCompleted['crafted-'+id]||0)+1;
    this.saveFarm();this.refreshHud();this.renderInventory();this.renderSideRail();this.toast('Crafted-goods delivery complete · +'+order.coins+' coins · +'+order.xp+' XP');
  }

  private openBuilding(id: 'coop'|'barn'): void { this.activeBuilding=id; const modal=document.getElementById('market-modal'); const title=modal?.querySelector('.market-header h2'); if(title)title.textContent=id==='coop'?'Chicken Run':'Cow Pasture'; modal?.querySelector('.market-tabs')?.classList.add('inventory-hidden'); const intro=document.getElementById('market-intro'); if(intro)intro.textContent='Manage housing, collect products and keep production moving.'; modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');this.renderBuildingPanel(id); }
  private renderBuildingPanel(id:'coop'|'barn'):void{const kind:AnimalId=id==='coop'?'hen':'cow';const level=id==='coop'?this.buildings.coopLevel:this.buildings.barnLevel;const capacity=this.buildingCapacity(kind);const storage=this.productionCapacity(kind);const field=kind==='hen'?'eggs':'milk';const owned=this.animals.filter(a=>a.id===kind);const ready=owned.filter(a=>a.readyAt>0&&a.readyAt<=Date.now()).length;const producing=owned.filter(a=>a.readyAt>Date.now()).length;const idle=owned.length-ready-producing;const cycle=kind==='hen'?45000:60000;const progress=owned.map((a,i)=>{const remaining=Math.max(0,a.readyAt-Date.now());const pct=a.readyAt===0?0:a.readyAt<=Date.now()?100:Math.max(0,Math.min(100,(1-remaining/cycle)*100));return '<div class="animal-progress"><span>'+(kind==='hen'?'🐔 Hen ':'🐄 Cow ')+(i+1)+(a.assigned===false?' · Resting':'')+'</span><strong>'+(a.assigned===false?'Not assigned':a.readyAt===0?'Needs feed':remaining===0?'Ready':Math.ceil(remaining/1000)+'s')+'</strong><div class="production-track"><i style="width:'+pct+'%"></i></div><button class="market-buy" data-animal-toggle="'+this.animals.indexOf(a)+'">'+(a.assigned===false?'Assign to production':'Unassign')+'</button></div>';}).join('');const cost=level*250;const host=document.getElementById('market-items');if(!host)return;host.innerHTML='<section class="inventory-section"><h3>'+(kind==='hen'?'🥚 Egg production':'🥛 Milk production')+'</h3><div class="inventory-grid"><article class="market-item"><div class="market-art">'+(kind==='hen'?'🥚':'🥛')+'</div><div class="market-copy"><strong>'+owned.length+' / '+capacity+' animals housed</strong><small>'+ready+' ready · '+producing+' producing · '+idle+' need feed</small></div></article><article class="market-item"><div class="market-art">📦</div><div class="market-copy"><strong>Produce storage</strong><small>'+this.produce[field]+' / '+storage+' '+field+' stored</small></div></article></div>'+ (progress||'<p>No animals housed yet. Visit the Market to buy one.</p>')+'</section><section class="inventory-section"><h3>🥣 Feed & collection</h3><p>Feed in storage: '+this.feed[kind]+' · '+(kind==='hen'?'45':'60')+' seconds per production cycle.</p><div class="building-actions"><button class="market-buy" data-building-action="collect" '+(ready===0||this.produce[field]>=storage?'disabled':'')+'>Collect '+(kind==='hen'?'eggs':'milk')+'</button><button class="market-buy" data-building-action="feed" '+(idle===0||this.feed[kind]===0?'disabled':'')+'>Feed idle animals</button></div></section><section class="inventory-section"><h3>🏗️ Building upgrade · Level '+level+'</h3><p class="market-intro">Next level: '+(capacity+2)+' animal spaces and '+(storage+5)+' produce storage. Each upgrade adds 2 housing spaces and 5 storage spaces.</p><button class="market-buy" id="upgrade-building" '+(this.coins<cost||level>=5?'disabled':'')+'>'+(level>=5?'Maximum level reached':'🪙 '+cost+' · Upgrade building')+'</button></section>';host.querySelector<HTMLButtonElement>('#upgrade-building')?.addEventListener('click',()=>{if(level>=5||this.coins<cost)return;this.coins-=cost;if(id==='coop')this.buildings.coopLevel++;else this.buildings.barnLevel++;this.drawScenery();this.renderOwnedAnimals();this.saveFarm();this.refreshHud();this.renderBuildingPanel(id);this.toast('Building upgraded! Housing and storage increased.');});}
  private sellInventoryItem(key:string):void {
    const crop=key.startsWith('crop:')?key.slice(5) as CropId:null;
    const fruit=key.startsWith('fruit:')?key.slice(6) as 'apples'|'pears'|'cherries':null;
    const product=key.startsWith('product:')?key.slice(8) as ProductId:null;
    const animal=key==='eggs'||key==='milk'?key:null;
    let quantity=0,price=0,label='';
    if(crop&&crop in CROPS){quantity=this.harvestedCrops[crop];price=CROPS[crop].reward;label=CROPS[crop].name;if(quantity)this.harvestedCrops[crop]=0;}
    else if(fruit&&fruit in this.fruitInventory){quantity=this.fruitInventory[fruit];price=fruit==='apples'?32:fruit==='pears'?36:42;label=fruit[0]!.toUpperCase()+fruit.slice(1);if(quantity)this.fruitInventory[fruit]=0;}
    else if(animal){quantity=this.produce[animal];price=animal==='eggs'?12:28;label=animal;if(quantity)this.produce[animal]=0;}
    else if(product&&product in this.crafted){quantity=this.crafted[product];price=({flour:24,bread:58,pastry:86,grapes:36} as Record<ProductId,number>)[product];label=this.productName(product);if(quantity)this.crafted[product]=0;}
    if(!quantity){this.toast('Nothing available to sell.');return;}
    const total=quantity*price;this.coins+=total;this.xp+=Math.max(1,Math.floor(total/20));this.saveFarm();this.refreshHud();this.renderMarket('sell');this.toast('Sold '+quantity+' '+label+' for '+total+' coins · XP earned.');
  }
  private sellProduce(): void { const value=this.produce.eggs*12+this.produce.milk*28; if(value<=0){this.toast('No animal products to sell yet.');return;}const eggs=this.produce.eggs,milk=this.produce.milk;this.produce={eggs:0,milk:0};this.coins+=value;this.xp+=eggs*2+milk*4;this.saveFarm();this.refreshHud();this.renderInventory();this.toast('Sold '+eggs+' eggs and '+milk+' milk for '+value+' coins!'); }
  private openMarket(): void {
    const modal=document.getElementById('market-modal');
    const title=modal?.querySelector('.market-header h2'); if(title) title.textContent='Farm Market';
    modal?.querySelector('.market-tabs')?.classList.remove('inventory-hidden');
    const intro=document.getElementById('market-intro'); if(intro) intro.textContent='Seeds, animals and supplies for a thriving farm.';
    modal?.classList.add('open'); modal?.setAttribute('aria-hidden','false');
    document.querySelectorAll<HTMLButtonElement>('[data-market-tab]').forEach(t=>t.classList.toggle('active',t.dataset.marketTab==='seeds'));
    this.renderMarket('seeds');
  }
  private openInventory(): void {
    const modal=document.getElementById('market-modal');
    const title=modal?.querySelector('.market-header h2'); if(title) title.textContent='Farm Inventory';
    modal?.querySelector('.market-tabs')?.classList.add('inventory-hidden');
    const intro=document.getElementById('market-intro'); if(intro) intro.textContent='Your stored seeds, farm animals and field activity.';
    modal?.classList.add('open'); modal?.setAttribute('aria-hidden','false'); this.renderInventory();
  }
  private questProgress(metric:'harvests'|'hens'|'cows'|'eggs'|'milk'):number {
    const total=metric==='harvests'?this.harvests:metric==='hens'?this.animals.filter(a=>a.id==='hen').length:metric==='cows'?this.animals.filter(a=>a.id==='cow').length:metric==='eggs'?this.produce.eggs:this.produce.milk;
    return Math.max(0,total-(this.questProgressBaseline[metric]||0));
  }
  private ensureQuestAndEventCycles():void {
    const now=Date.now();
    if(!this.questRefreshAt){this.questRefreshAt=now+86400000;if(!this.randomQuests.length){this.questProgressBaseline={harvests:this.harvests,hens:this.animals.filter(a=>a.id==='hen').length,cows:this.animals.filter(a=>a.id==='cow').length,eggs:this.produce.eggs,milk:this.produce.milk};this.createRandomQuests();}}
    else if(now>=this.questRefreshAt){this.questProgressBaseline={harvests:this.harvests,hens:this.animals.filter(a=>a.id==='hen').length,cows:this.animals.filter(a=>a.id==='cow').length,eggs:this.produce.eggs,milk:this.produce.milk};this.claimedQuests=[];this.createRandomQuests();this.questRefreshAt=now+86400000;}
    if(!this.eventStartedAt||now-this.eventStartedAt>=604800000){this.eventStartedAt=now;this.eventStartHarvests=this.harvests;this.eventClaimed=false;}
    this.saveFarm();
  }
  private renderEvents():string {const progress=Math.max(0,this.harvests-this.eventStartHarvests),target=20,done=progress>=target,remaining=Math.max(0,604800000-(Date.now()-this.eventStartedAt)),days=Math.floor(remaining/86400000),hours=Math.floor(remaining%86400000/3600000);return '<article class="market-item quest-card"><div class="market-art">🎉</div><div class="market-copy"><strong>Weekly Harvest Festival</strong><small>Harvest 20 crops before the festival ends. '+days+'d '+hours+'h remaining.</small><div class="quest-track"><i style="width:'+Math.min(100,progress/target*100)+'%"></i></div><small>'+Math.min(target,progress)+' / '+target+' harvests · Reward: 300 coins + 80 XP</small></div><button class="market-buy" data-claim-event '+(!done||this.eventClaimed?'disabled':'')+'>'+(this.eventClaimed?'Claimed':done?'Claim reward':'In progress')+'</button></article>';}
  private claimEvent():void {if(this.eventClaimed||this.harvests-this.eventStartHarvests<20)return;this.eventClaimed=true;this.coins+=300;this.xp+=80;this.saveFarm();this.refreshHud();this.toast('Harvest Festival complete · +300 coins · +80 XP');}
  private renderRewards():string {return [10,25,50,100].map(n=>{const claimed=this.claimedMilestones.includes(n),done=this.harvests>=n;return '<article class="market-item quest-card"><div class="market-art">🏅</div><div class="market-copy"><strong>'+n+' Lifetime Harvests</strong><small>'+Math.min(n,this.harvests)+' / '+n+' crops · Reward: '+n*10+' coins + '+n*2+' XP</small><div class="quest-track"><i style="width:'+Math.min(100,this.harvests/n*100)+'%"></i></div></div><button class="market-buy" data-claim-milestone="'+n+'" '+(!done||claimed?'disabled':'')+'>'+(claimed?'Claimed':done?'Claim reward':'In progress')+'</button></article>';}).join('');}
  private claimMilestone(n:number):void {if(![10,25,50,100].includes(n)||this.harvests<n||this.claimedMilestones.includes(n))return;this.claimedMilestones.push(n);this.coins+=n*10;this.xp+=n*2;this.saveFarm();this.refreshHud();this.toast('Harvest milestone reward collected!');}
  private createRandomQuests():void {
    this.questCycle++;
    const pool = [
      {id:'harvest',title:'Golden Harvest',description:'Harvest 5 crops from your fields.',target:5,coins:75,xp:18,icon:'🌾',metric:'harvests' as const},
      {id:'harvest12',title:'Village Granary',description:'Harvest 12 crops for the village.',target:12,coins:150,xp:35,icon:'🚜',metric:'harvests' as const},
      {id:'hens',title:'A Clucking Good Day',description:'Keep 2 hens on your farm.',target:2,coins:90,xp:22,icon:'🐔',metric:'hens' as const},
      {id:'cows',title:'Dairy Delight',description:'Raise 2 dairy cows.',target:2,coins:130,xp:30,icon:'🐄',metric:'cows' as const},
      {id:'eggs',title:'Fresh from the Coop',description:'Collect 3 eggs into storage.',target:3,coins:65,xp:16,icon:'🥚',metric:'eggs' as const},
      {id:'milk',title:'Milk Pail Mission',description:'Store 2 bottles of fresh milk.',target:2,coins:80,xp:20,icon:'🥛',metric:'milk' as const}
    ];
    this.randomQuests=[...pool].sort(()=>Math.random()-.5).slice(0,4).map((q,i)=>({...q,id:q.id+'-'+this.questCycle+'-'+i}));
  }
  private questDefinitions(): Array<{id:string;title:string;description:string;target:number;progress:number;coins:number;xp:number;icon:string}> {
    if(this.randomQuests.length)return this.randomQuests.map(q=>({...q,progress:this.questProgress(q.metric)}));
    return [
      {id:'first-harvest',title:'First Harvest',description:'Harvest your first crop.',target:1,progress:this.harvests,coins:40,xp:10,icon:'🌾'},
      {id:'busy-farmer',title:'A Busy Farmer',description:'Harvest 10 crops in total.',target:10,progress:this.harvests,coins:120,xp:30,icon:'🚜'},
      {id:'first-hen',title:'A Feathered Friend',description:'Welcome a hen to your farm.',target:1,progress:this.animals.filter(a=>a.id==='hen').length,coins:50,xp:15,icon:'🐔'},
      {id:'first-cow',title:'Milk Matters',description:'Welcome a cow to your farm.',target:1,progress:this.animals.filter(a=>a.id==='cow').length,coins:80,xp:20,icon:'🐄'},
      {id:'better-coop',title:'Room to Roam',description:'Upgrade your chicken coop to level 2.',target:2,progress:this.buildings.coopLevel,coins:100,xp:25,icon:'🏡'},
      {id:'bigger-silo',title:'Store More',description:'Upgrade your silo to level 2.',target:2,progress:this.buildings.warehouseLevel,coins:100,xp:25,icon:'🏚️'}
    ];
  }
  private renderQuests(onlyUnclaimed=false): string {
    return this.questDefinitions().filter(q=>!onlyUnclaimed||!this.claimedQuests.includes(q.id)).map(q=>{
      const claimed=this.claimedQuests.includes(q.id),done=q.progress>=q.target;
      const pct=Math.min(100,Math.round(q.progress/q.target*100));
      return '<article class="market-item quest-card"><div class="market-art">'+q.icon+'</div><div class="market-copy"><strong>'+q.title+(claimed?' · Complete':'')+'</strong><small>'+q.description+'</small><div class="quest-track"><i style="width:'+pct+'%"></i></div><small>'+Math.min(q.progress,q.target)+' / '+q.target+' · Reward: '+q.coins+' coins, '+q.xp+' XP</small></div><button class="market-buy" data-claim-quest="'+q.id+'" '+(!done||claimed?'disabled':'')+'>'+(claimed?'Claimed':done?'Claim reward':'In progress')+'</button></article>';
    }).join('');
  }
  private claimQuest(id:string):void {
    const quest=this.questDefinitions().find(q=>q.id===id);
    if(!quest||quest.progress<quest.target||this.claimedQuests.includes(id))return;
    this.claimedQuests.push(id);this.coins+=quest.coins;this.xp+=quest.xp;
    if(this.questDefinitions().every(q=>this.claimedQuests.includes(q.id)))this.createRandomQuests();
    this.saveFarm();this.refreshHud();this.renderInventory();this.renderSideRail();this.toast('Quest complete: '+quest.title+' · +'+quest.coins+' coins · +'+quest.xp+' XP');
  }
  private deliveryOrders(): Array<{id:string;title:string;description:string;icon:string;eggs:number;milk:number;coins:number;xp:number}> {
    return [
      {id:'egg-crate',title:'Market Egg Crate',description:'Pack 2 fresh eggs for the village grocer.',icon:'🥚',eggs:2,milk:0,coins:34,xp:12},
      {id:'milk-run',title:'Morning Milk Run',description:'Deliver 1 bottle of fresh milk.',icon:'🥛',eggs:0,milk:1,coins:42,xp:15},
      {id:'farm-breakfast',title:'Farmhouse Breakfast',description:'Prepare 1 egg and 1 bottle of milk.',icon:'🍳',eggs:1,milk:1,coins:62,xp:22}
    ];
  }
  private renderOrders(): string {
    return this.deliveryOrders().map(order=>{
      const canFulfil=this.produce.eggs>=order.eggs&&this.produce.milk>=order.milk;
      const completed=this.ordersCompleted[order.id]||0;
      const need=[order.eggs?order.eggs+' egg(s)':'',order.milk?order.milk+' milk':''].filter(Boolean).join(' + ');
      return '<article class="market-item quest-card"><div class="market-art">'+order.icon+'</div><div class="market-copy"><strong>'+order.title+'</strong><small>'+order.description+'</small><small>Needs: '+need+' · Reward: '+order.coins+' coins, '+order.xp+' XP · Delivered: '+completed+'</small></div><button class="market-buy" data-fulfil-order="'+order.id+'" '+(!canFulfil?'disabled':'')+'>'+(canFulfil?'🚚 Deliver':'Need more goods')+'</button></article>';
    }).join('');
  }
  private fulfilOrder(id:string): void {
    const order=this.deliveryOrders().find(item=>item.id===id);
    if(!order||this.produce.eggs<order.eggs||this.produce.milk<order.milk)return;
    this.produce.eggs-=order.eggs;this.produce.milk-=order.milk;
    this.coins+=order.coins;this.xp+=order.xp;
    this.ordersCompleted[id]=(this.ordersCompleted[id]||0)+1;
    this.saveFarm();this.refreshHud();this.renderInventory();this.renderSideRail();
    this.toast('Delivery complete: +'+order.coins+' coins · +'+order.xp+' XP');
  }

  private renderInventory(): void {
    const host=document.getElementById('market-items'); if(!host) return;
    const fruitCards='<article class="market-item"><div class="market-art">🍎</div><div class="market-copy"><strong>Apples</strong><small>Harvested from apple trees</small></div><span class="inventory-quantity">× '+this.fruitInventory.apples+'</span></article><article class="market-item"><div class="market-art">🍐</div><div class="market-copy"><strong>Pears</strong><small>Harvested from pear trees</small></div><span class="inventory-quantity">× '+this.fruitInventory.pears+'</span></article><article class="market-item"><div class="market-art">🍒</div><div class="market-copy"><strong>Cherries</strong><small>Harvested from cherry trees</small></div><span class="inventory-quantity">× '+this.fruitInventory.cherries+'</span></article>';
    const seedCards=(Object.entries(CROPS) as Array<[CropId,typeof CROPS[CropId]]>).map(([id,crop])=>'<article class="market-item"><div class="market-art">'+crop.emoji+'</div><div class="market-copy"><strong>'+crop.name+' Seeds</strong><small>Ready to plant in a plowed field</small></div><span class="inventory-quantity">× '+this.inventory[id]+'</span></article>').join('');
    const hens=this.animals.filter(a=>a.id==='hen'); const cows=this.animals.filter(a=>a.id==='cow');
    const animalCard=(emoji:string,name:string,items:Animal[])=>'<article class="market-item"><div class="market-art">'+emoji+'</div><div class="market-copy"><strong>'+name+'</strong><small>'+(items.length?items.filter(a=>a.readyAt>0&&a.readyAt<=Date.now()).length+' product(s) ready · '+items.filter(a=>a.readyAt>Date.now()).length+' producing':'None owned')+'</small></div><span class="inventory-quantity">× '+items.length+'</span></article>';
    const growing=Array.from(this.plots.values()).filter(p=>p.state==='growing').length; const ready=Array.from(this.plots.values()).filter(p=>p.state==='ready').length;
    const produceCards='<article class="market-item"><div class="market-art">🥚</div><div class="market-copy"><strong>Eggs</strong><small>Sell value: 12 coins each</small></div><span class="inventory-quantity">× '+this.produce.eggs+'</span></article><article class="market-item"><div class="market-art">🥛</div><div class="market-copy"><strong>Milk</strong><small>Sell value: 28 coins each</small></div><span class="inventory-quantity">× '+this.produce.milk+'</span></article>';
     const feedCards='<article class="market-item"><div class="market-art">🌾</div><div class="market-copy"><strong>Hen feed</strong><small>For egg-laying hens</small></div><span class="inventory-quantity">× '+this.feed.hen+'</span></article><article class="market-item"><div class="market-art">🌿</div><div class="market-copy"><strong>Cow feed</strong><small>For milk-producing cows</small></div><span class="inventory-quantity">× '+this.feed.cow+'</span></article>';
    const warehouseCost=this.buildings.warehouseLevel*400; host.innerHTML=fruitCards+'<section class="inventory-section"><h3>📦 Order & delivery board</h3><p>Fulfil market requests with stored animal products. Each delivery pays coins and XP; contracts can be completed again.</p><div class="quest-list">'+this.renderOrders()+'</div></section><section class="inventory-section"><h3>📜 Farm quests & ribbons</h3><div class="quest-list">'+this.renderQuests()+'</div></section><section class="inventory-section"><h3>🏚️ Silo & shared storage · Level '+this.buildings.warehouseLevel+'</h3><p>Shared warehouse expansion adds 10 extra spaces to both eggs and milk storage. Silo bonus: +'+((this.buildings.warehouseLevel-1)*10)+' spaces per product type.</p><button class="market-buy" id="upgrade-warehouse" '+(this.coins<warehouseCost||this.buildings.warehouseLevel>=10?'disabled':'')+'>'+(this.buildings.warehouseLevel>=10?'Maximum level reached':'🪙 '+warehouseCost+' · Upgrade silo storage')+'</button></section><section class="inventory-section"><h3>🌱 Seed storage</h3><div class="inventory-grid">'+seedCards+'</div></section><section class="inventory-section"><h3>🥚 Animal produce</h3><div class="inventory-grid">'+produceCards+'</div><button class="market-buy" id="sell-produce" '+(this.produce.eggs+this.produce.milk===0?'disabled':'')+'>Sell all animal products</button></section><section class="inventory-section"><h3>🥣 Animal feed storage</h3><div class="inventory-grid">'+feedCards+'</div></section><section class="inventory-section"><h3>🏭 Crafted goods & village deliveries</h3><div class="inventory-grid">'+(['flour','bread','pastry','grapes'] as ProductId[]).map(p=>'<article class="market-item"><div class="market-art">'+({flour:'🌾',bread:'🍞',pastry:'🥐',grapes:'🍇'} as Record<ProductId,string>)[p]+'</div><div class="market-copy"><strong>'+this.productName(p)+'</strong></div><span class="inventory-quantity">× '+this.crafted[p]+'</span></article>').join('')+'</div><div class="quest-list">'+([{id:'bread',name:'Bread delivery',qty:1,coins:58},{id:'pastry',name:'Pastry delivery',qty:1,coins:86},{id:'grapes',name:'Grape basket',qty:2,coins:72}] as Array<{id:string;name:string;qty:number;coins:number}>).map(o=>'<article class="market-item"><div class="market-copy"><strong>'+o.name+'</strong><small>'+o.qty+' required · Reward '+o.coins+' coins</small></div><button class="market-buy" data-fulfil-crafted="'+o.id+'" '+(this.crafted[o.id as ProductId]<o.qty?'disabled':'')+'>Deliver</button></article>').join('')+'</div></section><section class="inventory-section"><h3>🐾 Farm animals</h3><div class="inventory-grid">'+animalCard('🐔','Happy Hen',hens)+animalCard('🐄','Daisy Cow',cows)+'</div></section><section class="inventory-section inventory-stats"><h3>🌾 Field activity</h3><div class="inventory-stat"><strong>'+growing+'</strong><small>Growing</small></div><div class="inventory-stat"><strong>'+ready+'</strong><small>Ready to harvest</small></div><div class="inventory-stat"><strong>'+this.harvests+'</strong><small>Total harvests</small></div></section>';
  }
  private closeMarket(): void {this.activeBuilding=null;document.getElementById('market-modal')?.classList.remove('open','field-seed-mode');const panel=document.querySelector<HTMLElement>('#market-modal .market-window');if(panel){panel.style.left='';panel.style.top='';}document.getElementById('market-modal')?.setAttribute('aria-hidden','true');document.getElementById('market-modal')?.querySelector('.market-tabs')?.classList.remove('inventory-hidden');}
  private renderMarket(category='seeds'): void {
    const host=document.getElementById('market-items');if(!host)return;
    if(category==='sell'){
      const row=(emoji:string,name:string,qty:number,unit:number,key:string)=>'<article class="market-item"><div class="market-art">'+emoji+'</div><div class="market-copy"><strong>'+name+'</strong><small>In storage: '+qty+' · '+unit+' coins each</small></div><button class="market-buy" data-sell-item="'+key+'" '+(qty<=0?'disabled':'')+'>Sell all · '+(qty*unit)+' 🪙</button></article>';
      host.innerHTML='<section class="inventory-section"><h3>🌾 Harvested crops</h3><div class="inventory-grid">'+(Object.entries(CROPS) as Array<[CropId,typeof CROPS[CropId]]>).map(([id,c])=>row(c.emoji,c.name,this.harvestedCrops[id],c.reward,'crop:'+id)).join('')+'</div></section><section class="inventory-section"><h3>🍎 Orchard fruit</h3><div class="inventory-grid">'+row('🍎','Apples',this.fruitInventory.apples,32,'fruit:apples')+row('🍐','Pears',this.fruitInventory.pears,36,'fruit:pears')+row('🍒','Cherries',this.fruitInventory.cherries,42,'fruit:cherries')+'</div></section><section class="inventory-section"><h3>🥚 Animal produce</h3><div class="inventory-grid">'+row('🥚','Eggs',this.produce.eggs,12,'eggs')+row('🥛','Milk',this.produce.milk,28,'milk')+'</div></section><section class="inventory-section"><h3>🏭 Crafted goods</h3><div class="inventory-grid">'+row('🌾','Flour',this.crafted.flour,24,'product:flour')+row('🍞','Bread',this.crafted.bread,58,'product:bread')+row('🥐','Pastries',this.crafted.pastry,86,'product:pastry')+row('🍇','Grapes',this.crafted.grapes,36,'product:grapes')+'</div></section>';
      return;
    }
    if(category==='feed'){host.innerHTML='<article class="market-item"><div class="market-art">🌾</div><div class="market-copy"><strong>Hen feed</strong><small>Feed one hen · starts a 45-second egg cycle · in storage: '+this.feed.hen+'</small></div><button class="market-buy" data-buy-feed="hen" '+(this.coins<12?'disabled':'')+'>🪙 12 · Buy</button></article><article class="market-item"><div class="market-art">🌿</div><div class="market-copy"><strong>Cow feed</strong><small>Feed one cow · starts a 60-second milk cycle · in storage: '+this.feed.cow+'</small></div><button class="market-buy" data-buy-feed="cow" '+(this.coins<18?'disabled':'')+'>🪙 18 · Buy</button></article>';host.querySelectorAll<HTMLButtonElement>('[data-buy-feed]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buyFeed as AnimalId;const price=id==='hen'?12:18;if(this.coins<price)return;this.coins-=price;this.feed[id]++;this.saveFarm();this.refreshHud();this.renderMarket('feed');this.toast((id==='hen'?'Hen':'Cow')+' feed added to storage.');}));return;} if(category==='animals'){const hens=this.animals.filter(a=>a.id==='hen').length,cows=this.animals.filter(a=>a.id==='cow').length;host.innerHTML='<article class="market-item"><div class="market-art">🐔</div><div class="market-copy"><strong>Happy Hen</strong><small>Lays an egg after feeding · chicken run: '+hens+'/'+this.buildingCapacity('hen')+'</small></div><button class="market-buy" data-buy-animal="hen" '+(this.coins<75||hens>=this.buildingCapacity('hen')?'disabled':'')+'>🪙 75 · Buy</button></article><article class="market-item"><div class="market-art">🐄</div><div class="market-copy"><strong>Daisy Cow</strong><small>Produces milk after feeding · cow pasture: '+cows+'/'+this.buildingCapacity('cow')+'</small></div><button class="market-buy" data-buy-animal="cow" '+(this.coins<160||cows>=this.buildingCapacity('cow')?'disabled':'')+'>🪙 160 · Buy</button></article>';host.querySelectorAll<HTMLButtonElement>('[data-buy-animal]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buyAnimal as AnimalId;const cost=id==='hen'?75:160;if(this.coins<cost||this.animals.filter(a=>a.id===id).length>=this.buildingCapacity(id))return;this.coins-=cost;this.animals.push({id,readyAt:0});this.renderOwnedAnimals();this.saveFarm();this.refreshHud();this.toast('A new animal joined your farm!');this.renderMarket('animals');}));return;} if(category==='buildings'){
      const level=this.farmerLevel;
      const options=[{id:'coop',name:'Chicken Coop',emoji:'🐔',cost:180,unlock:2,desc:'Build your first hen house and unlock egg production.'},{id:'barn',name:'Cow Shed',emoji:'🐄',cost:320,unlock:3,desc:'House cows and begin collecting fresh milk.'},{id:'silo',name:'Grain Silo',emoji:'🌾',cost:420,unlock:4,desc:'Expand storage for animal products.'},{id:'bakery',name:'Village Bakery',emoji:'🥖',cost:550,unlock:5,desc:'A village bakery for the next stage of farm life.'},{id:'greenhouse',name:'Greenhouse',emoji:'🌿',cost:700,unlock:7,desc:'A glasshouse for year-round growing.'},{id:'windmill',name:'Windmill',emoji:'🌬️',cost:950,unlock:9,desc:'A landmark mill that completes your homestead.'},{id:'well',name:'Stone Well',emoji:'🪣',cost:1200,unlock:11,desc:'A new water source for your growing farm.'},{id:'stable',name:'Horse Stable',emoji:'🐎',cost:1600,unlock:13,desc:'A new home for future farm companions.'},{id:'workshop',name:'Farm Workshop',emoji:'🛠️',cost:2100,unlock:15,desc:'Craft and improve tools for the next farm era.'},{id:'waterTower',name:'Water Tower',emoji:'💧',cost:2800,unlock:18,desc:'A landmark upgrade for your expanded farm.'}];
      const nextTier=this.farmExpansionLevel+1,nextSize=FARM_SIZES[nextTier],expandCost=FARM_EXPANSION_COSTS[nextTier],expandLevel=FARM_EXPANSION_LEVELS[nextTier];
      const expansionCard=nextTier<FARM_SIZES.length
        ? '<article class="market-item farm-expansion-card"><div class="market-art">🗺️</div><div class="market-copy"><strong>Expand your farm · '+this.farmSize+' × '+this.farmSize+' → '+nextSize+' × '+nextSize+'</strong><small>Unlock more square farmland for crops, animals and decorations. Requires Farmer Level '+expandLevel+'.</small></div><button class="market-buy" data-farm-expand '+(level<expandLevel||this.coins<expandCost?'disabled':'')+'>'+(level<expandLevel?'🔒 Level '+expandLevel: '🪙 '+expandCost+' · Expand')+'</button></article>'
        : '<article class="market-item farm-expansion-card"><div class="market-art">🏡</div><div class="market-copy"><strong>Maximum farm size reached</strong><small>Your homestead is fully expanded to 13 × 13 tiles.</small></div><button class="market-buy" disabled>Fully expanded</button></article>';
      host.innerHTML=expansionCard+options.map(item=>{const owned=this.buildingLevels[item.id as BuildingId]>0;return '<article class="market-item"><div class="market-art">'+item.emoji+'</div><div class="market-copy"><strong>'+item.name+(owned?' · Level '+this.buildingLevels[item.id as BuildingId]:'')+'</strong><small>'+item.desc+' Unlocks at Level '+item.unlock+'. Upgrade cost: '+(this.buildingLevels[item.id as BuildingId]*350||item.cost)+' coins.</small></div><button class="market-buy" data-building-buy="'+item.id+'" '+(level<item.unlock||(!owned&&this.coins<item.cost)||(owned&&this.coins<this.buildingLevels[item.id as BuildingId]*350)||this.buildingLevels[item.id as BuildingId]>=5?'disabled':'')+'>'+(level<item.unlock?'🔒 Level '+item.unlock: this.buildingLevels[item.id as BuildingId]>=5?'Max level':owned?'🪙 '+(this.buildingLevels[item.id as BuildingId]*350)+' · Upgrade':'🪙 '+item.cost+' · Build')+'</button></article>';}).join('');
      host.querySelector<HTMLButtonElement>('[data-farm-expand]')?.addEventListener('click',()=>{
        if(nextTier>=FARM_SIZES.length||level<expandLevel||this.coins<expandCost)return;
        this.coins-=expandCost;this.farmExpansionLevel=nextTier;
        this.redrawFarmTiles();this.drawScenery();this.renderFruitTreeBadges();this.fitFarmToViewport();
        this.saveFarm();this.refreshHud();this.renderMarket('buildings');
        this.toast(`Your farm expanded to ${this.farmSize} x ${this.farmSize} tiles!`);
      });
      host.querySelectorAll<HTMLButtonElement>('[data-building-buy]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buildingBuy as BuildingId;const item=options.find(x=>x.id===id);if(!item||level<item.unlock||this.buildingLevels[id]>=5)return;const cost=this.buildingLevels[id]>0?this.buildingLevels[id]*350:item.cost;if(this.coins<cost)return;const placement=!this.decor[id]?this.findFreeDecorTile(false):null;if(!this.decor[id]&&!placement){this.toast('Your farm is full. Move or clear an object before building.');return;}this.coins-=cost;this.buildingLevels[id]=Math.max(1,this.buildingLevels[id]+1);if(placement)this.decor[id]=placement;if(id==='coop')this.buildings.coopLevel=this.buildingLevels.coop;if(id==='barn')this.buildings.barnLevel=this.buildingLevels.barn;if(id==='silo')this.buildings.warehouseLevel=this.buildingLevels.silo;this.drawScenery();this.saveFarm();this.refreshHud();this.renderMarket('buildings');this.toast(item.name+' upgraded to Level '+this.buildingLevels[id]+'.');}));return;
    }if(category==='decor'){
      const items=[{id:'appleTree',name:'Apple Tree',emoji:'🍎',cost:95,desc:'An orchard tree with ripe red apples.'},{id:'pearTree',name:'Pear Tree',emoji:'🍐',cost:95,desc:'A leafy tree with golden pears.'},{id:'cherryTree',name:'Cherry Tree',emoji:'🍒',cost:110,desc:'A fruit tree with ruby-red cherries.'},{id:'flowerbed',name:'Flower Bed',emoji:'🌷',cost:35,desc:'A colourful patch of seasonal flowers.'},{id:'fountain',name:'Stone Fountain',emoji:'⛲',cost:140,desc:'A water feature for your homestead.'},{id:'scarecrow',name:'Scarecrow',emoji:'🧑‍🌾',cost:65,desc:'A cheerful guardian for your crops.'},{id:'bench',name:'Garden Bench',emoji:'🪑',cost:55,desc:'A cosy resting spot beside the path.'}];
      host.innerHTML=items.map(item=>'<article class="market-item"><div class="market-art">'+item.emoji+'</div><div class="market-copy"><strong>'+item.name+'</strong><small>'+item.desc+'</small></div><button class="market-buy" data-buy-decor="'+item.id+'" '+(this.coins<item.cost?'disabled':'')+'>🪙 '+item.cost+' · Buy</button></article>').join('');
      host.querySelectorAll<HTMLButtonElement>('[data-buy-decor]').forEach(btn=>btn.addEventListener('click',()=>{
        const item=items.find(x=>x.id===btn.dataset.buyDecor);if(!item||this.coins<item.cost)return;
        const spot=this.findFreeDecorTile(true);
        if(!spot){this.toast('Your farm is full. Move or clear an object before buying more decorations.');return;}
        this.coins-=item.cost;const count=Object.keys(this.decor).filter(k=>k.startsWith(item.id)).length;
        this.decor[item.id+(count+1)]=spot;this.drawScenery();if(item.id==='appleTree'||item.id==='pearTree'||item.id==='cherryTree'){this.initializeFruitTrees();this.renderFruitTreeBadges();}this.saveFarm();this.refreshHud();this.renderMarket('decor');this.toast(item.name+' added to your farm!');
      }));return;
    }
    const level=this.farmerLevel;host.innerHTML=(Object.entries(CROPS) as Array<[CropId,typeof CROPS[CropId]]>).map(([id,crop])=>{const locked=level<crop.unlockLevel;return `<article class="market-item ${locked?'crop-locked':''}"><div class="market-art">${crop.emoji}</div><div class="market-copy"><strong>${crop.name}</strong><small>${locked?'Unlocks at level '+crop.unlockLevel:Math.round(crop.growMs/1000)+'s grow · '+Math.round(Math.max(300000,crop.growMs*2)/1000)+'s harvest window'} · reward ${crop.reward} coins · +${crop.xp} XP · bag: ${this.inventory[id]}</small></div><button class="market-buy" data-buy-seed="${id}" ${locked||this.coins<crop.cost?'disabled':''}>${locked?'🔒 Level '+crop.unlockLevel:'🪙 '+crop.cost+' · Buy'}</button></article>`;}).join('');
    host.querySelectorAll<HTMLButtonElement>('[data-buy-seed]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buySeed as CropId;const crop=CROPS[id];if(!crop||this.farmerLevel<crop.unlockLevel||this.coins<crop.cost)return;this.coins-=crop.cost;this.inventory[id]++;this.saveFarm();this.refreshHud();this.refreshSelection();this.toast(`${crop.emoji} ${crop.name} seeds added to your bag`);}));
  }
  private showHarvestReward(x:number,y:number,amount:number):void {
    const reward=this.add.text(x,y,'🪙 +'+amount,{fontFamily:'Arial',fontSize:'22px',fontStyle:'bold',color:'#fff5a8',stroke:'#704516',strokeThickness:5,shadow:{offsetX:1,offsetY:2,color:'#3b2a12',blur:4,fill:true}}).setOrigin(.5).setDepth(30000);
    this.tweens.add({targets:reward,y:y-58,alpha:0,scale:1.18,duration:1250,ease:'Cubic.easeOut',onComplete:()=>reward.destroy()});
  }
  private toast(message:string): void {const el=document.getElementById('game-toast');if(!el)return;el.textContent=message;el.classList.add('show');window.setTimeout(()=>el.classList.remove('show'),2200);}

  private loadFarm(): void {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (!raw) {
        this.farmExpansionLevel=0;
        this.coins=250;this.xp=0;this.inventory={wheat:3,carrot:0,corn:0,strawberry:0,tomato:0,pumpkin:0,blueberry:0,watermelon:0};
        for(const [col,row] of [[2,2],[3,2],[2,3]]){const plot=this.plots.get(this.key(col,row));if(plot)plot.state='tilled';}
        this.saveFarm();
        return;
      }
      const save = JSON.parse(raw) as any;
      if (![1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].includes(save.version) || !Array.isArray(save.plots)) return;
      this.coins = Math.max(0, Math.floor(save.coins));
      this.farmerName=typeof save.farmerName==='string'&&save.farmerName.trim()?save.farmerName.slice(0,24):'New Farmer';
      this.farmName=typeof save.farmName==='string'&&save.farmName.trim()?save.farmName.slice(0,28):'My Farm';
      if(save.buildingLevels&&typeof save.buildingLevels==='object')for(const id of ['coop','barn','silo','bakery','greenhouse','windmill','stable','well','workshop','waterTower'] as BuildingId[])this.buildingLevels[id]=Math.max(this.buildingLevels[id],Math.min(5,Math.floor(Number(save.buildingLevels[id])||0)));this.randomQuests = Array.isArray(save.randomQuests) ? save.randomQuests : [];this.questRefreshAt=Number(save.questRefreshAt)||0;if(save.questProgressBaseline)this.questProgressBaseline={...this.questProgressBaseline,...save.questProgressBaseline};this.eventStartedAt=Number(save.eventStartedAt)||0;this.eventStartHarvests=Math.max(0,Number(save.eventStartHarvests)||0);this.eventClaimed=Boolean(save.eventClaimed);this.claimedMilestones=Array.isArray(save.claimedMilestones)?save.claimedMilestones.filter((n:number)=>[10,25,50,100].includes(n)):[];
      this.questCycle = this.randomQuests.length ? Math.max(1,...this.randomQuests.map(q=>Number((q.id.match(/-(\d+)-\d+$/)||[])[1])||1)) : 0;
      this.claimedQuests = Array.isArray(save.claimedQuests) ? save.claimedQuests.filter((id:string)=>(['first-harvest','busy-farmer','first-hen','first-cow','better-coop','bigger-silo'].includes(id) || this.randomQuests.some(q=>q.id===id))) : [];
      this.ordersCompleted = save.version >= 9 && save.ordersCompleted && typeof save.ordersCompleted === 'object' ? Object.fromEntries(Object.entries(save.ordersCompleted).map(([id,count])=>[id,Math.max(0,Math.floor(Number(count)||0))]).filter(([id])=>['egg-crate','milk-run','farm-breakfast'].includes(String(id)))) : {};
      this.xp = Math.max(0, Math.floor(save.xp));
      this.displayedLevel=this.farmerLevel;
      if(save.decor && typeof save.decor==='object' && !Array.isArray(save.decor)) {
        const restored:Record<string,{col:number;row:number}>={};
        for(const [id,value] of Object.entries(save.decor as Record<string,unknown>)) {
          const pos=value as {col?:unknown;row?:unknown};
          const allowed=id in this.decor || /^(appleTree|pearTree|cherryTree|flowerbed|fountain|scarecrow|bench|bakery|greenhouse|windmill|coop|barn|silo|stable|well|workshop|waterTower)\d*$/.test(id);
          if(allowed && Number.isInteger(pos?.col) && Number.isInteger(pos?.row) && Number(pos.col)>=0 && Number(pos.col)<COLS && Number(pos.row)>=0 && Number(pos.row)<ROWS) restored[id]={col:Number(pos.col),row:Number(pos.row)};
        }
        this.decor={...this.decor,...restored};
      }
      if (save.selectedCrop && save.selectedCrop in CROPS && this.farmerLevel >= CROPS[save.selectedCrop as CropId].unlockLevel) this.selectedCrop = save.selectedCrop as CropId;
      this.farmExpansionLevel=Number.isInteger(save.farmExpansionLevel)?Phaser.Math.Clamp(save.farmExpansionLevel,0,3):3; // Legacy farms retain their previously unlocked land.
      if (save.version >= 2 && save.inventory) this.inventory = {...this.inventory,...save.inventory};
      if (save.version >= 4 && save.feed) this.feed = {...this.feed,...save.feed};
       if (save.version >= 6 && save.buildings) this.buildings = {...this.buildings,...save.buildings,warehouseLevel:save.buildings.warehouseLevel||1};
      if(save.fruitInventory)this.fruitInventory={...this.fruitInventory,...save.fruitInventory};
      if(save.harvestedCrops)this.harvestedCrops={...this.harvestedCrops,...save.harvestedCrops};
      if(save.fruitTreeReadyAt&&typeof save.fruitTreeReadyAt==='object')this.fruitTreeReadyAt={...save.fruitTreeReadyAt};
      if(save.version>=12){if(save.productionJobs)for(const id of ['bakery','greenhouse','windmill','workshop'] as BuildingId[])this.productionJobs[id]=save.productionJobs[id]||null;if(save.crafted)this.crafted={...this.crafted,...save.crafted};}
      this.buildingLevels.coop=Math.max(this.buildingLevels.coop,this.buildings.coopLevel);this.buildingLevels.barn=Math.max(this.buildingLevels.barn,this.buildings.barnLevel);this.buildingLevels.silo=Math.max(this.buildingLevels.silo,this.buildings.warehouseLevel);
       if (save.version >= 6 && save.produce) this.produce = {...this.produce,...save.produce};
      this.animals=this.animals.map(a=>({...a,assigned:a.assigned!==false}));
      if (save.version >= 3) { this.animals = Array.isArray(save.animals) ? save.animals.map((a:Animal)=>({...a,assigned:a.assigned!==false})) : []; this.harvests = Number(save.harvests) || 0; }
      for (const saved of save.plots) {
        const plot = this.plots.get(this.key(saved.col, saved.row));
        if (!plot || !['grass', 'tilled', 'growing', 'ready', 'withered'].includes(saved.state)) continue;
        plot.state = saved.state;
        plot.watered = Boolean(saved.watered);
        plot.growth = Math.max(0, Math.min(100, Number(saved.growth) || 0));
        if (saved.crop && saved.crop in CROPS) plot.crop = saved.crop;
        plot.readyAt = saved.readyAt || 0;
        plot.witherAt = save.version >= 5 ? (saved.witherAt || 0) : 0;
        if (plot.state === 'ready' && plot.witherAt > 0) this.scheduleWithering(plot);
        if (plot.state === 'growing') { const remaining=plot.readyAt ? plot.readyAt-Date.now() : (plot.watered ? 5000 : CROPS[plot.crop].growMs); if (remaining<=0) {plot.state='ready';plot.growth=100;plot.readyAt=0;plot.witherAt=Date.now()+Math.max(300000,CROPS[plot.crop].growMs*2);this.scheduleWithering(plot);} else this.scheduleGrowth(plot,remaining); }
        this.redrawPlot(plot);
      }
    } catch {
      // Ignore malformed or unavailable browser storage and start a fresh farm.
    }
  }

  private saveFarm(): void {
    const save: FarmSave = {
      version: 16,
      farmExpansionLevel:this.farmExpansionLevel,
      harvestedCrops:{...this.harvestedCrops},
      fruitInventory:{...this.fruitInventory},
      fruitTreeReadyAt:{...this.fruitTreeReadyAt},
      farmerName:this.farmerName,
      farmName:this.farmName,
      buildingLevels:{...this.buildingLevels},
      productionJobs:{...this.productionJobs},
      crafted:{...this.crafted},
      randomQuests: this.randomQuests,
      questRefreshAt:this.questRefreshAt, questProgressBaseline:{...this.questProgressBaseline}, eventStartedAt:this.eventStartedAt, eventStartHarvests:this.eventStartHarvests, eventClaimed:this.eventClaimed, claimedMilestones:[...this.claimedMilestones],
      ordersCompleted: {...this.ordersCompleted},
      claimedQuests: [...this.claimedQuests],
      animals: this.animals,
      harvests: this.harvests,
      coins: this.coins,
      xp: this.xp,
      selectedCrop: this.selectedCrop,
      decor: Object.fromEntries(Object.entries(this.decor).map(([id,pos])=>[id,{col:pos.col,row:pos.row}])),
      inventory: {...this.inventory},
      feed: {...this.feed},
      buildings: {...this.buildings},
      produce: {...this.produce},
      plots: Array.from(this.plots.values()).map(plot => ({
        col: plot.col, row: plot.row, state: plot.state, watered: plot.watered, growth: plot.growth, crop:plot.crop, readyAt:plot.readyAt, witherAt:plot.witherAt,
      })),
    };
    try {
      localStorage.setItem(this.saveKey, JSON.stringify(save));
      localStorage.setItem('happyFarmLocalUpdatedAtV1', String(Math.max(Date.now(), Number(localStorage.getItem('happyFarmLocalUpdatedAtV1') || 0) + 1)));
      queueCloudSave();
    } catch {
      // Storage may be disabled or full; gameplay remains available for this session.
    }
  }

  private refreshHud(): void {
    const coins = document.getElementById('coins');
    const xp = document.getElementById('xp');
    if (coins) coins.textContent = String(this.coins);
    const level = this.farmerLevel;
    if(level>this.displayedLevel){const bonus=level*50;this.coins+=bonus;this.displayedLevel=level;this.toast('Level '+level+' reached! Farmhouse upgraded · +'+bonus+' coins.');}
    if(level!==this.farmhouseVisualLevel){this.farmhouseVisualLevel=level;this.drawScenery();}
    if (xp) xp.textContent = `Level ${level} · ${this.xp} XP`;
    const levelBadge = document.getElementById('farmer-level');
    if (levelBadge) levelBadge.textContent = `LEVEL ${level}`;
    const farmerName=document.getElementById('farmer-name');if(farmerName)farmerName.textContent=this.farmerName;
    const farmLabel=document.getElementById('farm-name-label');if(farmLabel)farmLabel.textContent=this.farmName.toUpperCase();
    const farmerSub = document.querySelector<HTMLElement>('.profile-card small');
    if (farmerSub) farmerSub.textContent = level === 1 ? 'Your farm adventure begins!' : level < 5 ? 'Growing into a skilled farmer!' : 'A flourishing farm awaits!';
    const progress = document.getElementById('progress-text');
    const fill = document.getElementById('progress-fill');
    if (progress) progress.textContent = `${this.levelProgress} / ${this.xpNeededForNextLevel} XP`;
    if (fill) (fill as HTMLElement).style.width = `${Math.min(100,this.levelProgress/this.xpNeededForNextLevel*100)}%`;
    const animalStatus=document.getElementById('animal-status'); if(animalStatus){const now=Date.now();const ready=this.animals.filter(a=>a.readyAt>0&&a.readyAt<=now).length;const producing=this.animals.filter(a=>a.readyAt>now).length;const waiting=this.animals.filter(a=>a.readyAt===0).length;animalStatus.textContent=this.animals.length?this.animals.length+' animal(s) · '+ready+' ready · '+producing+' producing · '+waiting+' waiting · eggs '+this.produce.eggs+' / milk '+this.produce.milk+'.':'No animals yet. Visit the Coop or Dairy Barn to manage housing.';}
    const w=document.getElementById('wheat-count'); if(w) w.textContent=String(this.inventory.wheat);
    const inv=document.getElementById('inventory-count'); if(inv) inv.textContent=String(Object.values(this.inventory).reduce((a,b)=>a+b,0)+this.feed.hen+this.feed.cow);
    this.refreshCropSelector();
    this.renderSideRail();
    const bal=document.getElementById('market-balance'); if(bal) bal.textContent=`${this.coins} coins`;
  }

  private refreshSelection(): void {
    const host = document.getElementById('selection');
    if (!host) return;
    if (!this.selected) {
      host.innerHTML = '<span class="selection-kicker">SELECTED LAND</span><strong>Choose a plot</strong><p>Select a field tile to see what you can do there.</p>';
      return;
    }
    const names: Record<PlotState, string> = { grass: 'Open grassland', tilled: 'Freshly plowed soil', growing: 'Growing crop', ready: 'Ready to harvest', withered: 'Withered crop · plow to clear' };
    const actions: Record<Tool, string> = { select: 'Choose a tool to work this plot.', plow: 'Plow open or withered land to prepare the soil.', plant: `Plant ${CROPS[this.selectedCrop].name} · ${this.inventory[this.selectedCrop]} seeds in your bag.`, water: 'Water once to cut remaining growth time in half.', harvest: this.selected.state === 'withered' ? 'This crop has withered. Select Plow to clear the plot.' : 'Harvest ripe crops before their harvest window closes.', move: 'Drag a tree, farmhouse, barn, silo or animal pen to a new grid position.' };
    host.innerHTML = `<span class="selection-kicker">LAND · ${this.selected.col + 1}, ${this.selected.row + 1}</span><strong>${names[this.selected.state]}</strong><p>${actions[this.activeTool]}</p>`;
  }
}
