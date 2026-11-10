import Phaser from 'phaser';

type Tool = 'select' | 'plow' | 'plant' | 'water' | 'harvest' | 'move';
type PlotState = 'grass' | 'tilled' | 'growing' | 'ready' | 'withered';
type CropId = 'wheat' | 'carrot' | 'corn' | 'strawberry' | 'tomato' | 'pumpkin' | 'blueberry' | 'watermelon';
interface Plot { col: number; row: number; state: PlotState; watered: boolean; growth: number; crop: CropId; readyAt: number; witherAt: number }
type AnimalId = 'hen' | 'cow';
interface Animal { id: AnimalId; readyAt: number; assigned?: boolean }
interface BuildingProgress { coopLevel: number; barnLevel: number; warehouseLevel: number }
interface AnimalProduce { eggs: number; milk: number }
type BuildingId = 'coop'|'barn'|'silo'|'bakery'|'greenhouse'|'windmill';
type ProductId='flour'|'bread'|'pastry'|'grapes';
interface ProductionJob { recipe:string; readyAt:number }
interface FarmSave { version: 15; questRefreshAt?:number; questProgressBaseline?:Partial<Record<'harvests'|'hens'|'cows'|'eggs'|'milk',number>>; eventStartedAt?:number; eventStartHarvests?:number; eventClaimed?:boolean; claimedMilestones?:number[]; harvestedCrops?:Partial<Record<CropId,number>>; fruitInventory?:Record<'apples'|'pears'|'cherries',number>; fruitTreeReadyAt?:Record<string,number>; farmerName?:string; farmName?:string; buildingLevels?:Partial<Record<BuildingId,number>>; productionJobs?:Partial<Record<BuildingId,ProductionJob|null>>; crafted?:Partial<Record<ProductId,number>>; randomQuests?: Array<{id:string;title:string;description:string;target:number;coins:number;xp:number;icon:string;metric:'harvests'|'hens'|'cows'|'eggs'|'milk'}>; claimedQuests?: string[]; ordersCompleted?: Record<string,number>; animals: Animal[]; harvests: number; coins: number; xp: number; selectedCrop?: CropId; decor?: Record<string,{col:number;row:number}>; feed: { hen: number; cow: number }; buildings?: BuildingProgress; produce?: AnimalProduce; inventory: Record<CropId, number>; plots: Array<{ col:number; row:number; state:PlotState; watered:boolean; growth:number; crop?:CropId; readyAt?:number; witherAt?:number }> }
const CROPS: Record<CropId,{name:string;emoji:string;cost:number;reward:number;xp:number;growMs:number;color:number;unlockLevel:number}> = {
 wheat:{name:'Wheat',emoji:'🌾',cost:5,reward:18,xp:5,growMs:15000,color:0xe4b83f,unlockLevel:1},
 carrot:{name:'Carrot',emoji:'🥕',cost:9,reward:31,xp:8,growMs:22000,color:0xef873e,unlockLevel:1},
 corn:{name:'Corn',emoji:'🌽',cost:14,reward:48,xp:12,growMs:30000,color:0xf2c94c,unlockLevel:2},
 strawberry:{name:'Strawberry',emoji:'🍓',cost:20,reward:70,xp:18,growMs:42000,color:0xd94f55,unlockLevel:3},
 tomato:{name:'Tomato',emoji:'🍅',cost:27,reward:91,xp:22,growMs:55000,color:0xe65c45,unlockLevel:4},
 pumpkin:{name:'Pumpkin',emoji:'🎃',cost:36,reward:125,xp:29,growMs:70000,color:0xe98d35,unlockLevel:5},
 blueberry:{name:'Blueberry',emoji:'🫐',cost:48,reward:165,xp:38,growMs:90000,color:0x6556a8,unlockLevel:7},
 watermelon:{name:'Watermelon',emoji:'🍉',cost:65,reward:220,xp:50,growMs:120000,color:0x65a94f,unlockLevel:9}
};

const COLS = 13;
const ROWS = 13;
const TILE_W = 76;
const TILE_H = 38;
const ORIGIN_X = 0;
const ORIGIN_Y = 40;

export class FarmScene extends Phaser.Scene {
  private plots = new Map<string, Plot>();
  private plotOverlays = new Map<string, Phaser.GameObjects.Graphics>();
  private growthTimers = new Map<string, Phaser.Time.TimerEvent>();
  private plotGraphics!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
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
  private buildings: BuildingProgress = { coopLevel: 1, barnLevel: 1, warehouseLevel: 1 };
  private produce: AnimalProduce = { eggs: 0, milk: 0 };
  private activeBuilding: BuildingId|null = null;
  private farmerName='New Farmer';
  private farmName='My Farm';
  private buildingLevels: Record<BuildingId,number>={coop:1,barn:1,silo:1,bakery:0,greenhouse:0,windmill:0};
  private productionJobs: Record<BuildingId,ProductionJob|null>={coop:null,barn:null,silo:null,bakery:null,greenhouse:null,windmill:null};
  private crafted: Record<ProductId,number>={flour:0,bread:0,pastry:0,grapes:0};
  private animalActors: Phaser.GameObjects.Container[] = [];
  private sceneryGraphics: Phaser.GameObjects.Graphics[] = [];
  private sceneryLabels: Phaser.GameObjects.Text[] = [];
  private decor: Record<string,{col:number;row:number}> = {tree1:{col:1,row:1},tree2:{col:3,row:0},tree3:{col:5,row:1},tree4:{col:7,row:0},tree5:{col:10,row:1},tree6:{col:12,row:2},tree7:{col:0,row:7},tree8:{col:12,row:7},appleTree1:{col:1,row:10},appleTree2:{col:3,row:11},pearTree1:{col:10,row:10},cherryTree1:{col:11,row:11},farmhouse:{col:5,row:2},barn:{col:9,row:3},silo:{col:11,row:3},pen:{col:2,row:5},coop:{col:4,row:5}};
  private fruitInventory:Record<'apples'|'pears'|'cherries',number>={apples:0,pears:0,cherries:0};
  private harvestedCrops:Record<CropId,number>={wheat:0,carrot:0,corn:0,strawberry:0,tomato:0,pumpkin:0,blueberry:0,watermelon:0};
  private fruitTreeReadyAt:Record<string,number>={};
  private fruitTreeBadges:Record<string,Phaser.GameObjects.Text>={};
  private movingDecor: string | null = null;
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
  private cameraDragging = false;
  private dragPoint = new Phaser.Math.Vector2();
  private readonly saveKey = 'happyFarmPhaserSaveV1';

  constructor() { super('FarmScene'); }

  create(): void {
    this.fitFarmToViewport();
    this.scale.on('resize', () => this.fitFarmToViewport());
    this.plotGraphics = this.add.graphics();
    this.overlay = this.add.graphics();
    this.drawWorld();
    this.loadFarm();
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
    this.refreshSelection();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => { this.updateCropLifecycle(); this.updateProduction(); this.updateFruitTrees(); this.refreshCropHoverTooltip(); if(this.activeBuilding==='coop'||this.activeBuilding==='barn')this.renderBuildingPanel(this.activeBuilding);else if(this.activeBuilding)this.renderGenericBuildingPanel(this.activeBuilding); } });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.55, 1.35));
    });
  }

  private readonly rewardKey='happyFarmDailyRewardV1';
  private rewardAvailableAt=0;
  private rewardAmount=100;
  private bindDailyReward():void {
    try{this.rewardAvailableAt=Number(localStorage.getItem(this.rewardKey)||0)||0;}catch{this.rewardAvailableAt=0;}
    document.getElementById('daily-reward-claim')?.addEventListener('click',()=>this.claimDailyReward());
    if(this.rewardAvailableAt<=Date.now())this.showDailyReward();
    else this.updateDailyRewardCountdown();
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
    const camera = this.cameras.main;
    const width = Math.max(320, this.scale.width);
    const height = Math.max(360, this.scale.height);
    // Fit the complete isometric field with a little breathing room on every edge.
    const fitX = (width - 72) / 980;
    const fitY = (height - 96) / 560;
    camera.setZoom(Phaser.Math.Clamp(Math.min(1.05, fitX, fitY), 0.58, 1.05));
    camera.centerOn(0, 245);
  }

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
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
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
    this.drawForestBorder();
    // A soft meadow base extends beyond the cultivated diamond field.
    const meadow = this.add.graphics();
    meadow.fillStyle(0x5d9d48, 1);
    meadow.fillEllipse(0, 246, 1080, 470);
    meadow.fillStyle(0x8bc85d, 1);
    meadow.fillEllipse(0, 235, 1040, 440);
    meadow.fillStyle(0xb2dc79, 0.24);
    meadow.fillEllipse(-90, 125, 430, 150);
    meadow.fillEllipse(245, 320, 370, 120);
    // Dappled meadow texture, kept outside the crop interaction layer.
    for (let i = 0; i < 90; i += 1) {
      const x = ((i * 137) % 990) - 495;
      const y = ((i * 83) % 420) + 22;
      meadow.fillStyle(i % 3 === 0 ? 0xd7ec9a : 0x477e3d, i % 3 === 0 ? 0.16 : 0.09);
      meadow.fillEllipse(x, y, 18 + (i % 4) * 5, 5 + (i % 3) * 2);
    }
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const point = this.toWorld(col, row);
        this.plots.set(this.key(col, row), { col, row, state: 'grass', watered: false, growth: 0, crop: 'wheat', readyAt: 0, witherAt: 0 });
        const shades = [0x9bcf69, 0xa5d875, 0x94c762, 0xaedb7d, 0x9fce70];
        const shade = shades[(col * 7 + row * 11) % shades.length] ?? 0x9bcf69;
        this.diamond(this.plotGraphics, point.x, point.y, shade, 0x78ae54);
        // Soft tile glint and occasional clover give the field a hand-painted feel.
        this.plotGraphics.lineStyle(1, 0xd8ef9e, 0.28);
        this.plotGraphics.beginPath();
        this.plotGraphics.moveTo(point.x - 27, point.y - 1);
        this.plotGraphics.lineTo(point.x, point.y - 17);
        this.plotGraphics.lineTo(point.x + 24, point.y - 1);
        this.plotGraphics.strokePath();
        if ((col * 3 + row * 5) % 13 === 0) this.drawGrassTuft(point.x, point.y);
        if ((col * 11 + row * 7) % 31 === 0) {
          this.plotGraphics.fillStyle(0x5c9846, 0.9);
          this.plotGraphics.fillEllipse(point.x + 13, point.y + 3, 5, 3);
          this.plotGraphics.fillEllipse(point.x + 17, point.y, 4, 3);
        }
      }
    }
    this.drawPath();
    this.drawFence();
    this.drawFlowerPatches();
  }

  private drawForestBorder(): void {
    const forest=this.add.graphics();
    const trees:Array<[number,number]>=[];
    for(let i=0;i<20;i++){trees.push([-545+i*57,-12-(i%3)*17],[-545+i*57,535+(i%4)*13]);}
    for(let i=0;i<14;i++){trees.push([-565,35+i*38],[565,35+i*38]);}
    trees.forEach(([x,y],i)=>{
      const r=27+(i%4)*4;
      forest.fillStyle(0x244b2c,0.4);forest.fillEllipse(x+5,y+13,r*2.2,r*.65);
      forest.fillStyle(0x68452c,1);forest.fillRoundedRect(x-5,y-5,10,34,4);
      forest.fillStyle([0x285b32,0x326b37,0x3d783b,0x28552e][i%4]!,1);
      forest.fillCircle(x,y-23,r);forest.fillCircle(x-r*.55,y-13,r*.72);forest.fillCircle(x+r*.55,y-14,r*.75);
      forest.fillStyle(0x79a94e,0.72);forest.fillCircle(x-r*.3,y-35,r*.28);forest.fillCircle(x+r*.35,y-26,r*.22);
    });
    forest.setDepth(-20);
  }

  private drawFence(): void {
    const g = this.plotGraphics;
    const fencePoints = [this.toWorld(0, 0), this.toWorld(4, 0), this.toWorld(8, 0), this.toWorld(12, 0)];
    g.lineStyle(5, 0x8a6038, 1);
    fencePoints.forEach((p, i) => {
      if (i < fencePoints.length - 1) {
        const next = fencePoints[i + 1]!;
        g.beginPath(); g.moveTo(p.x, p.y - 9); g.lineTo(next.x, next.y - 9); g.strokePath();
      }
      g.fillStyle(0xb9854b, 1);
      g.fillRoundedRect(p.x - 3, p.y - 19, 6, 22, 2);
      g.fillStyle(0xe2bd7b, 1);
      g.fillRoundedRect(p.x - 4, p.y - 20, 8, 4, 2);
    });
  }

  private drawFlowerPatches(): void {
    const g = this.add.graphics();
    const flowers = [[2,4],[4,6],[7,4],[10,6],[1,9],[6,10],[11,9],[8,2]];
    flowers.forEach(([col,row], index) => {
      const p = this.toWorld(col!, row!);
      const colors = [0xffe58a,0xffa8a8,0xffffff,0xd8a8ee];
      g.fillStyle(0x4d923e, 1);
      g.fillEllipse(p.x, p.y + 3, 8, 4);
      g.fillStyle(colors[index % colors.length]!, 1);
      g.fillCircle(p.x, p.y - 2, 3);
      g.fillCircle(p.x - 3, p.y, 2);
      g.fillCircle(p.x + 3, p.y, 2);
      g.fillStyle(0xf4c84f, 1);
      g.fillCircle(p.x, p.y, 1.5);
    });
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

  private drawPath(): void {
    const g = this.plotGraphics;
    const points = [this.toWorld(0, 8), this.toWorld(3, 8), this.toWorld(5, 7), this.toWorld(8, 7), this.toWorld(11, 8), this.toWorld(12, 8)];
    g.lineStyle(25, 0x9b784b, 1);
    g.beginPath();
    g.moveTo(points[0]!.x, points[0]!.y);
    points.slice(1).forEach(p => g.lineTo(p.x, p.y));
    g.strokePath();
    g.lineStyle(17, 0xc5a16a, 1);
    g.beginPath();
    g.moveTo(points[0]!.x, points[0]!.y);
    points.slice(1).forEach(p => g.lineTo(p.x, p.y));
    g.strokePath();
  }

  private fruitKind(id:string):'apples'|'pears'|'cherries'|null {
    if(id.startsWith('appleTree'))return 'apples';
    if(id.startsWith('pearTree'))return 'pears';
    if(id.startsWith('cherryTree'))return 'cherries';
    return null;
  }
  private fruitConfig(kind:'apples'|'pears'|'cherries'):{emoji:string;name:string;interval:number} {
    return kind==='apples'?{emoji:'🍎',name:'Apple',interval:35*60*1000}:kind==='pears'?{emoji:'🍐',name:'Pear',interval:40*60*1000}:{emoji:'🍒',name:'Cherry',interval:30*60*1000};
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
    this.saveFarm();this.refreshHud();this.updateFruitTrees();
    this.toast('Harvested 1 '+cfg.name+' · next fruit in '+Math.round(cfg.interval/60000)+' minutes.');
  }

  private drawScenery(): void {
    this.sceneryGraphics.forEach(x=>x.destroy()); this.sceneryGraphics=[];
    this.sceneryLabels.forEach(x=>x.destroy()); this.sceneryLabels=[];
    const g = this.add.graphics(); this.sceneryGraphics.push(g);
    // Layered orchard trees: trunk, canopy shadow, clustered leaves and sunlit highlights.
    (['tree1','tree2','tree3','tree4','tree5','tree6','tree7','tree8',...Object.keys(this.decor).filter(id=>id.startsWith('appleTree')||id.startsWith('pearTree')||id.startsWith('cherryTree'))]).forEach((id, i) => {
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
    // Small garden beds and stepping stones around the homestead.
    const homePos=this.decor.farmhouse!; const barnPos=this.decor.barn!;
    const home = this.toWorld(homePos.col, homePos.row);
    const barn = this.toWorld(barnPos.col, barnPos.row);
    this.drawBuilding(g, home.x, home.y - 12, 0xe7d4a0, 0xa84f3c, 'FARMHOUSE');
    this.drawBarn(g,barn.x,barn.y-15);
    const coopPos=this.decor.coop!; const coop=this.toWorld(coopPos.col,coopPos.row);
    this.drawCoop(g,coop.x,coop.y-10);
    const siloPos=this.decor.silo!; const silo = this.toWorld(siloPos.col, siloPos.row);
    g.fillStyle(0x426f3d, 0.22);
    g.fillEllipse(silo.x + 31, silo.y + 5, 52, 15);
    g.fillStyle(0xc9d4c5, 1);
    g.fillRoundedRect(silo.x + 17, silo.y - 52, 29, 59, 9);
    g.fillStyle(0xe8eee1, 1);
    g.fillRoundedRect(silo.x + 21, silo.y - 48, 20, 51, 7);
    g.fillStyle(0xa8b7a2, 1);
    g.fillEllipse(silo.x + 31, silo.y - 52, 29, 12);
    g.fillStyle(0x8b4939, 1);
    g.fillTriangle(silo.x + 15, silo.y - 48, silo.x + 31, silo.y - 64, silo.x + 47, silo.y - 48);
    this.drawAdditionalBuildings(g);
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
    this.drawAnimalPen(g);
  }

  private drawAnimalPen(g: Phaser.GameObjects.Graphics): void {
    const pos=this.decor.pen!; const p = this.toWorld(pos.col, pos.row);
    const left = p.x - 42;
    const top = p.y - 27;
    g.fillStyle(0x9a7043, 1);
    g.fillRoundedRect(left, top, 82, 43, 5);
    g.lineStyle(4, 0xe0bd7d, 1);
    g.strokeRect(left, top, 82, 43);
    g.lineStyle(3, 0x8b6138, 1);
    for (let i = 1; i < 5; i += 1) {
      g.beginPath(); g.moveTo(left + i * 16, top); g.lineTo(left + i * 16, top + 43); g.strokePath();
    }
    // The paddock is populated only by animals the player has purchased.
    g.fillStyle(0x6f9d45, 0.25);
    g.fillEllipse(p.x, p.y + 12, 70, 12);
  }

  private renderOwnedAnimals(): void {
    this.animalActors.forEach(actor=>actor.destroy());this.animalActors=[];
    const penPos=this.decor.pen!;const pen=this.toWorld(penPos.col,penPos.row);
    this.animals.forEach((animal,index)=>{
      const cow=animal.id==='cow';
      const startX=pen.x-28+(index%4)*(cow?23:18);
      const startY=pen.y-8+Math.floor(index/4)*12;
      const actor=this.add.container(startX,startY);actor.setDepth(startY+index);
      actor.add(this.add.ellipse(0,8,cow?43:27,9,0x263e25,0.24));
      // Legs sit behind the body so the animal reads as a single grounded character.
      const legs:Phaser.GameObjects.Graphics[]=[];
      const legXs=cow?[-13,-5,10,18]:[-7,5];
      legXs.forEach((lx)=>{
        const leg=this.add.graphics();
        if(cow){
          leg.fillStyle(0xf2eee0,1);leg.fillRoundedRect(lx-3,-10,6,17,2);
          leg.fillStyle(0x51483f,1);leg.fillRoundedRect(lx-3,4,7,5,2);
          leg.fillStyle(0x302c28,0.7);leg.fillRect(lx-2,7,5,1);
        }else{
          leg.fillStyle(0xc58b42,1);leg.fillRoundedRect(lx-1.5,-7,3,13,1);
          leg.lineStyle(1.5,0xb97932,1);leg.beginPath();leg.moveTo(lx,5);leg.lineTo(lx-4,7);leg.moveTo(lx,5);leg.lineTo(lx+4,7);leg.strokePath();
        }
        actor.add(leg);legs.push(leg);
      });
      const tail=this.add.graphics();
      if(cow){
        tail.lineStyle(3,0xf2eee0,1);tail.beginPath();tail.moveTo(-17,-16);tail.lineTo(-25,-8);tail.lineTo(-27,-2);tail.strokePath();
        tail.lineStyle(4,0x3f3934,1);tail.beginPath();tail.moveTo(-27,-2);tail.lineTo(-30,2);tail.strokePath();
      }else{
        tail.fillStyle(0xf6f0df,1);tail.fillTriangle(-12,-15,-24,-23,-18,-10);tail.fillTriangle(-11,-13,-25,-12,-17,-7);
      }
      actor.add(tail);
      const body=this.add.graphics();
      if(cow){
        // Rounded dairy-cow silhouette with coat patches, neck and a softly shaded muzzle.
        body.fillStyle(0xaaa497,0.32);body.fillEllipse(-1,-9,40,24);
        body.fillStyle(0xf6f1e5,1);body.fillEllipse(-2,-14,39,27);
        body.fillStyle(0x4b4540,1);body.fillEllipse(-13,-19,13,10);body.fillEllipse(2,-8,12,9);body.fillEllipse(-2,-5,7,5);
        body.fillStyle(0xffffff,0.45);body.fillEllipse(-8,-23,14,5);
        body.fillStyle(0xf4eee0,1);body.fillEllipse(15,-19,19,21);
        body.fillStyle(0x4a433d,1);body.fillEllipse(11,-27,7,5);
        // Head, ears, horns and muzzle.
        body.fillStyle(0xf2eee2,1);body.fillEllipse(19,-22,18,17);
        body.fillStyle(0xe6b7a8,1);body.fillEllipse(25,-15,15,10);
        body.fillStyle(0xf7c9b5,1);body.fillEllipse(24,-17,11,6);
        body.fillStyle(0x4a4038,1);body.fillEllipse(19,-23,2,2);body.fillEllipse(29,-17,1.2,1);
        body.fillStyle(0x3b3530,1);body.fillCircle(19,-24,1.5);
        body.fillStyle(0xf2eee2,1);body.fillTriangle(11,-27,6,-33,15,-30);body.fillTriangle(23,-28,29,-33,28,-25);
        body.fillStyle(0xd8a982,1);body.fillTriangle(14,-29,14,-35,18,-29);body.fillTriangle(23,-29,26,-35,27,-28);
        body.fillStyle(0xe9c5b4,1);body.fillEllipse(13,-14,5,3);
        // Udder and subtle belly contour.
        body.fillStyle(0xe8b7a8,1);body.fillEllipse(-1,-1,12,7);
        body.fillStyle(0xc98f86,1);body.fillCircle(-4,1,1.2);body.fillCircle(1,2,1.2);body.fillCircle(5,1,1.2);
        body.lineStyle(1,0xd4cabb,0.8);body.beginPath();body.moveTo(-15,-7);body.lineTo(8,-5);body.strokePath();
      }else{
        // A compact buff hen with a layered breast, wing feathers and comb.
        body.fillStyle(0xc7a56d,0.25);body.fillEllipse(0,-8,30,22);
        body.fillStyle(0xf0dfbd,1);body.fillEllipse(-1,-11,25,20);
        body.fillStyle(0xfff4df,1);body.fillEllipse(-7,-13,12,12);
        body.fillStyle(0xd2b17c,1);body.fillEllipse(-1,-8,15,10);
        body.fillStyle(0xc69b5e,1);body.fillEllipse(-5,-8,12,7);
        body.lineStyle(1,0xa9844e,0.8);body.beginPath();body.moveTo(-10,-9);body.lineTo(-3,-5);body.moveTo(-7,-12);body.lineTo(0,-8);body.strokePath();
        body.fillStyle(0xf5ead1,1);body.fillEllipse(7,-17,11,11);
        body.fillStyle(0xd94f42,1);body.fillEllipse(4,-25,4,5);body.fillCircle(9,-25,3);body.fillCircle(13,-22,2.5);
        body.fillStyle(0xd99c3c,1);body.fillTriangle(12,-17,22,-14,12,-12);
        body.fillStyle(0x352e28,1);body.fillCircle(9,-19,1.5);
        body.fillStyle(0xffffff,0.9);body.fillCircle(9.5,-19.5,0.55);
        body.fillStyle(0xe4cda5,1);body.fillTriangle(-9,-14,-17,-20,-13,-9);
      }
      actor.add(body);
      if(!cow){
        const wing=this.add.graphics();wing.fillStyle(0xd4b17b,1);wing.fillEllipse(-4,-10,13,8);
        wing.lineStyle(1,0xa98552,0.85);wing.beginPath();wing.moveTo(-9,-10);wing.lineTo(-3,-7);wing.moveTo(-7,-13);wing.lineTo(0,-9);wing.strokePath();
        actor.add(wing);
        this.tweens.add({targets:wing,angle:-7,duration:650,yoyo:true,repeat:-1,ease:'Sine.inOut',delay:index*130});
        this.tweens.add({targets:body,angle:1.2,duration:950,yoyo:true,repeat:-1,ease:'Sine.inOut',delay:index*100});
      }else{
        this.tweens.add({targets:tail,angle:7,duration:1100,yoyo:true,repeat:-1,ease:'Sine.inOut',delay:index*90});
        this.tweens.add({targets:body,angle:0.8,duration:1250,yoyo:true,repeat:-1,ease:'Sine.inOut',delay:index*120});
      }
      this.animalActors.push(actor);
      const roam=7+(index%3)*4,duration=2600+(index%4)*420;
      this.tweens.add({targets:actor,x:startX+roam,duration,yoyo:true,repeat:-1,ease:'Sine.inOut',delay:index*180,
        onYoyo:()=>actor.setScale(-1,1),onRepeat:()=>actor.setScale(1,1)});
      this.tweens.add({targets:actor,y:startY-(cow?1.2:1.8),duration:cow?520:420,yoyo:true,repeat:-1,ease:'Sine.inOut',delay:index*90});
      legs.forEach((leg,legIndex)=>this.tweens.add({targets:leg,angle:(legIndex%2===0?1:-1)*(cow?10:14),
        duration:cow?260:220,yoyo:true,repeat:-1,ease:'Sine.inOut',delay:index*100+legIndex*65}));
    });
  }

  private drawBarn(g:Phaser.GameObjects.Graphics,x:number,y:number):void {
    g.fillStyle(0x29482b,.25);g.fillEllipse(x+8,y+15,135,28);
    g.fillStyle(0x9b7549,1);g.fillRoundedRect(x-49,y-2,100,12,3);
    g.fillStyle(0xc97855,1);g.fillRect(x-39,y-47,78,48);
    g.fillStyle(0xe49a6b,1);g.fillRect(x-35,y-43,70,4);
    g.fillStyle(0x773c32,1);g.fillTriangle(x-54,y-43,x,y-91,x+54,y-43);
    g.fillStyle(0x9b4439,1);g.fillPoints([{x:x-50,y:y-43},{x,y:y-86},{x:x+50,y:y-43},{x:x+35,y:y-35},{x,y:y-72},{x:x-35,y:y-35}],true);
    g.fillStyle(0x713c32,1);g.fillRoundedRect(x-22,y-36,44,36,3);
    g.lineStyle(3,0xe4c18b,1);g.strokeRect(x-22,y-36,44,36);g.beginPath();g.moveTo(x,y-35);g.lineTo(x,y);g.strokePath();
    g.fillStyle(0x4d332b,1);g.fillRect(x-8,y-13,16,13);
    g.fillStyle(0xf0d79b,1);g.fillRect(x-31,y-59,62,10);
    g.fillStyle(0x6f3c31,1);g.fillTriangle(x-7,y-60,x,y-72,x+7,y-60);
    g.fillStyle(0xb9dfe6,1);g.fillRect(x-8,y-55,16,5);
    g.lineStyle(2,0x6f3b31,1);g.beginPath();g.moveTo(x-39,y-18);g.lineTo(x-28,y-18);g.moveTo(x+28,y-18);g.lineTo(x+39,y-18);g.strokePath();
    this.sceneryLabels.push(this.add.text(x,y+20,'DAIRY BARN',{fontFamily:'Arial',fontSize:'8px',fontStyle:'bold',color:'#526c39'}).setOrigin(.5));
  }
  private drawCoop(g:Phaser.GameObjects.Graphics,x:number,y:number):void {
    g.fillStyle(0x29482b,.25);g.fillEllipse(x+4,y+14,118,24);
    g.fillStyle(0x80603b,1);g.fillRoundedRect(x-45,y-3,90,12,3);
    g.fillStyle(0xe7d7a8,1);g.fillRect(x-36,y-35,72,34);
    g.fillStyle(0xc6ad79,1);g.fillRect(x-36,y-35,72,5);
    g.fillStyle(0x8c4b35,1);g.fillTriangle(x-49,y-32,x,y-75,x+49,y-32);
    g.fillStyle(0xb65c3d,1);g.fillPoints([{x:x-44,y:y-33},{x,y:y-70},{x:x+44,y:y-33},{x:x+31,y:y-28},{x,y:y-56},{x:x-31,y:y-28}],true);
    g.fillStyle(0x6c392d,1);g.fillRect(x-13,y-24,26,25);
    g.fillStyle(0x3f2d25,1);g.fillRect(x-9,y-19,18,16);
    g.fillStyle(0xf2d58e,1);g.fillRect(x-6,y-17,12,2);
    g.fillStyle(0x8a5d37,1);g.fillRect(x-31,y-26,11,12);g.fillStyle(0xb7e2e8,1);g.fillRect(x-29,y-24,7,8);
    // Attached fenced chicken run, mesh and nesting-box sign.
    g.fillStyle(0x8a6139,1);g.fillRect(x+35,y-8,32,5);g.fillRect(x+35,y-8,4,18);g.fillRect(x+63,y-8,4,18);
    g.lineStyle(1,0xd7c08c,.9);for(let xx=x+40;xx<x+64;xx+=6){g.beginPath();g.moveTo(xx,y-7);g.lineTo(xx,y+9);g.strokePath();}
    g.fillStyle(0xfff4d5,1);g.fillRoundedRect(x-20,y-49,40,11,4);
    this.sceneryLabels.push(this.add.text(x,y-43,'HEN HOUSE',{fontFamily:'Arial',fontSize:'7px',fontStyle:'bold',color:'#79502e'}).setOrigin(.5));
  }
  private drawAdditionalBuildings(g:Phaser.GameObjects.Graphics):void {
    (['bakery','greenhouse','windmill'] as BuildingId[]).forEach((id)=>{
      if(this.buildingLevels[id]<=0||!this.decor[id])return;
      const p=this.toWorld(this.decor[id]!.col,this.decor[id]!.row);
      if(id==='bakery'){
        this.drawBuilding(g,p.x,p.y-10,0xe9c99a,0x9e4c38,'VILLAGE BAKERY');
        g.fillStyle(0x5d3a2b,1);g.fillRoundedRect(p.x-13,p.y-23,26,20,4);g.fillStyle(0xe9a45b,1);g.fillEllipse(p.x,p.y-13,17,11);g.fillStyle(0xffdf9c,1);g.fillEllipse(p.x,p.y-15,10,5);
      }else if(id==='greenhouse'){
        g.fillStyle(0x426f3d,.2);g.fillEllipse(p.x+5,p.y+9,105,24);
        g.fillStyle(0x8b6841,1);g.fillRect(p.x-43,p.y-5,86,12);
        g.fillStyle(0x9bd5c0,.78);g.fillPoints([{x:p.x-42,y:p.y-5},{x:p.x-30,y:p.y-48},{x:p.x+30,y:p.y-48},{x:p.x+42,y:p.y-5}],true);
        g.lineStyle(4,0x6e9d65,1);g.strokePoints([{x:p.x-42,y:p.y-5},{x:p.x-30,y:p.y-48},{x:p.x+30,y:p.y-48},{x:p.x+42,y:p.y-5}],true);
        g.lineStyle(2,0xe9fff0,.9);g.beginPath();g.moveTo(p.x,p.y-47);g.lineTo(p.x,p.y+5);g.moveTo(p.x-27,p.y-29);g.lineTo(p.x+27,p.y-29);g.strokePath();
        g.fillStyle(0x4c873e,1);[-20,-7,8,21].forEach(dx=>{g.fillRect(p.x+dx,p.y-15,3,15);g.fillCircle(p.x+dx,p.y-19,6);});
        this.sceneryLabels.push(this.add.text(p.x,p.y+17,'GREENHOUSE',{fontFamily:'Arial',fontSize:'8px',fontStyle:'bold',color:'#526c39'}).setOrigin(.5));
      }else{
        this.drawBuilding(g,p.x,p.y-12,0xe2d5ad,0x9a5a3e,'WINDMILL');
        g.lineStyle(5,0xf1e6c9,1);g.beginPath();g.moveTo(p.x,p.y-61);g.lineTo(p.x-29,p.y-94);g.moveTo(p.x,p.y-61);g.lineTo(p.x+29,p.y-94);g.moveTo(p.x,p.y-61);g.lineTo(p.x-29,p.y-28);g.moveTo(p.x,p.y-61);g.lineTo(p.x+29,p.y-28);g.strokePath();
        g.fillStyle(0x8b5135,1);g.fillCircle(p.x,p.y-61,7);
      }
    });
  }
  private drawBuilding(g: Phaser.GameObjects.Graphics, x: number, y: number, wall: number, roof: number, label: string): void {
    // Grounding, masonry foundation and a shaded side wall.
    g.fillStyle(0x29482b,0.24);g.fillEllipse(x+7,y+16,124,32);
    g.fillStyle(0x766044,1);g.fillRoundedRect(x-43,y+1,88,10,3);
    g.fillStyle(0xb69a6a,1);g.fillRect(x-42,y-2,86,4);
    const side=Phaser.Display.Color.IntegerToColor(wall).darken(25).color;
    g.fillStyle(side,1);g.fillPoints([{x:x+31,y:y-37},{x:x+48,y:y-27},{x:x+48,y:y+8},{x:x+31,y:y+5}],true);
    g.fillStyle(wall,1);g.fillRect(x-31,y-38,62,44);
    g.fillStyle(Phaser.Display.Color.IntegerToColor(wall).lighten(12).color,1);g.fillRect(x-31,y-38,62,5);
    // Roof fascia and two planes with fine shingle seams.
    g.fillStyle(0x50352d,1);g.fillTriangle(x-51,y-33,x,y-77,x+51,y-33);
    g.fillStyle(roof,1);g.fillPoints([{x:x-46,y:y-35},{x:x,y:y-72},{x:x+45,y:y-35},{x:x+31,y:y-29},{x:x,y:y-57},{x:x-31,y:y-29}],true);
    g.fillStyle(Phaser.Display.Color.IntegerToColor(roof).darken(20).color,1);
    g.fillPoints([{x:x,y:y-72},{x:x+45,y:y-35},{x:x+31,y:y-29},{x:x,y:y-57}],true);
    g.lineStyle(1.2,0xf0c58a,0.6);
    for(let row=0;row<3;row++){const yy=y-61+row*9;g.beginPath();g.moveTo(x-28+row*9,yy);g.lineTo(x-7+row*3,yy-15);g.moveTo(x+5+row*5,yy-4);g.lineTo(x+25+row*4,yy+7);g.strokePath();}
    g.lineStyle(2,0x704638,0.9);g.beginPath();g.moveTo(x-43,y-34);g.lineTo(x,y-70);g.lineTo(x+44,y-34);g.strokePath();
    // Chimney, cap and a small drifting smoke puff.
    g.fillStyle(0x9a5a43,1);g.fillRect(x+24,y-75,11,27);g.fillStyle(0x633d32,1);g.fillRect(x+22,y-77,15,4);
    g.fillStyle(0xffffff,0.22);g.fillCircle(x+33,y-86,4);g.fillCircle(x+38,y-93,3);
    // Plaster highlights, timber framing and recessed door.
    g.fillStyle(0xffffff,0.16);g.fillRect(x-27,y-31,54,3);
    g.lineStyle(3,0x79543a,0.85);g.beginPath();g.moveTo(x-28,y-35);g.lineTo(x-28,y+2);g.moveTo(x+28,y-35);g.lineTo(x+28,y+2);g.moveTo(x-29,y-6);g.lineTo(x+29,y-6);g.strokePath();
    g.fillStyle(0x4c3328,1);g.fillRoundedRect(x-9,y-12,18,19,2);
    g.fillStyle(0x8b6543,1);g.fillRect(x-6,y-9,12,16);g.fillStyle(0xe6c77d,1);g.fillCircle(x+4,y-2,1.5);
    // Glass windows with reflections, muntins and flower boxes.
    [-20,20].forEach(wx=>{
      g.fillStyle(0x31566a,1);g.fillRect(x+wx-7,y-28,14,15);
      g.fillStyle(0x9ed9e9,1);g.fillRect(x+wx-5,y-26,10,11);
      g.fillStyle(0xffffff,0.65);g.fillTriangle(x+wx-5,y-26,x+wx+4,y-26,x+wx-5,y-17);
      g.lineStyle(2,0xf8e9c9,1);g.strokeRect(x+wx-7,y-28,14,15);
      g.beginPath();g.moveTo(x+wx,y-27);g.lineTo(x+wx,y-14);g.moveTo(x+wx-6,y-21);g.lineTo(x+wx+6,y-21);g.strokePath();
      g.fillStyle(0x805238,1);g.fillRect(x+wx-9,y-12,18,3);
      g.fillStyle(0x4d873e,1);g.fillEllipse(x+wx-4,y-15,7,5);g.fillEllipse(x+wx+4,y-15,7,5);
      g.fillStyle(0xf0b2a5,1);g.fillCircle(x+wx,y-18,2);
    });
    // Small siding boards on the visible side.
    g.lineStyle(1,0xffffff,0.2);for(let yy=y-1;yy<y+7;yy+=4){g.beginPath();g.moveTo(x+34,yy);g.lineTo(x+45,yy+3);g.strokePath();}
    g.fillStyle(0xfffdf0,0.94);g.fillRoundedRect(x-38,y+12,76,16,7);
    this.sceneryLabels.push(this.add.text(x,y+20,label,{fontFamily:'Arial',fontSize:'8px',fontStyle:'bold',color:'#526c39'}).setOrigin(0.5));
  }

  private touchPositions = new Map<number,{x:number;y:number;startX:number;startY:number}>();
  private touchGesture = false;
  private pinchDistance = 0;

  private handleWorldTap(pointer: Phaser.Input.Pointer): void {
    const world=this.cameras.main.getWorldPoint(pointer.x,pointer.y);
    if(this.activeTool==='move'){
      const hit=Object.keys(this.decor).find(id=>{const p=this.toWorld(this.decor[id]!.col,this.decor[id]!.row);return Phaser.Math.Distance.Between(world.x,world.y,p.x,p.y)<58;});
      this.movingDecor=hit||null;if(hit)this.toast('Moving '+hit+'. Drag to a new tile.');return;
    }
    const tile=this.toTile(world.x,world.y);
    const plot=tile?this.plots.get(this.key(tile.col,tile.row)):undefined;
    // Field interaction takes priority over nearby scenery hitboxes. This prevents
    // buildings and orchard trees from swallowing taps on prepared soil.
    if(plot&&(this.activeTool!=='select'||plot.state==='tilled'||plot.state==='grass'||plot.state==='withered')){
      this.selected=plot;
      if(this.activeTool==='select'){this.openFieldSeedPicker();this.refreshSelection();this.drawSelection();return;}
      if(this.activeTool==='plant'){
        if(plot.state==='tilled'){this.sowSelectedPlot();return;}
        if(plot.state==='grass'||plot.state==='withered'){this.toast('Plow this field first, then tap it to sow.');return;}
      }
      this.applyTool(plot);this.refreshSelection();this.drawSelection();return;
    }
    if(this.activeTool==='select'){
      const fruitTreeHit=Object.keys(this.decor).find(id=>this.fruitKind(id)!==null&&(()=>{const p=this.toWorld(this.decor[id]!.col,this.decor[id]!.row);return Phaser.Math.Distance.Between(world.x,world.y-38,p.x,p.y-49)<42;})());
      if(fruitTreeHit){this.harvestFruitTree(fruitTreeHit);return;}
      const buildingHit=(['coop','barn','silo','bakery','greenhouse','windmill'] as const).find(id=>{const pos=this.decor[id];if(!pos)return false;const p=this.toWorld(pos.col,pos.row);return Math.abs(world.x-p.x)<57&&Math.abs(world.y-(p.y-28))<62;});
      if(buildingHit){if(buildingHit==='coop'||buildingHit==='barn')this.openBuilding(buildingHit);else this.openGenericBuilding(buildingHit);return;}
    }
    if(plot){this.selected=plot;this.applyTool(plot);this.refreshSelection();this.drawSelection();}
  }

  private bindWorldInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if(pointer.wasTouch){
        this.touchPositions.set(pointer.id,{x:pointer.x,y:pointer.y,startX:pointer.x,startY:pointer.y});
        if(this.touchPositions.size>=2){
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
          const distance=Phaser.Math.Distance.Between(pts[0]!.x,pts[0]!.y,pts[1]!.x,pts[1]!.y);
          if(this.pinchDistance>0&&distance>0){
            this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom*(distance/this.pinchDistance),0.55,1.35));
          }
          this.pinchDistance=distance;this.touchGesture=true;return;
        }
        if(Math.hypot(pointer.x-touch.startX,pointer.y-touch.startY)>10){
          this.cameraDragging=true;this.touchGesture=true;
        }
        if(this.cameraDragging){
          this.cameras.main.scrollX-=(pointer.x-previousX)/this.cameras.main.zoom;
          this.cameras.main.scrollY-=(pointer.y-previousY)/this.cameras.main.zoom;
        }
        return;
      }
      if(this.movingDecor&&pointer.isDown){
        const w=this.cameras.main.getWorldPoint(pointer.x,pointer.y);
        const tile=this.toTile(w.x,w.y);
        if(tile){this.decor[this.movingDecor]={col:tile.col,row:tile.row};this.drawScenery();this.renderOwnedAnimals();}
        return;
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
          if(wasTap)this.handleWorldTap(pointer);
          this.touchGesture=false;this.pinchDistance=0;this.cameraDragging=false;
        } else {
          const pts=Array.from(this.touchPositions.values());
          this.pinchDistance=pts.length>=2?Phaser.Math.Distance.Between(pts[0]!.x,pts[0]!.y,pts[1]!.x,pts[1]!.y):0;
        }
        return;
      }
      this.cameraDragging=false;
      if(this.movingDecor){this.saveFarm();this.toast('Farm layout saved.');this.movingDecor=null;}
    });
    this.input.on('pointerupoutside',(pointer:Phaser.Input.Pointer)=>{
      if(pointer.wasTouch)this.touchPositions.delete(pointer.id);
      this.cameraDragging=false;
      if(this.touchPositions.size===0){this.touchGesture=false;this.pinchDistance=0;}
    });
    this.input.mouse?.disableContextMenu();
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
        if (plot.state === 'ready') { const crop=CROPS[plot.crop]; plot.state='tilled'; plot.growth=0; plot.readyAt=0; plot.witherAt=0; plot.watered=false; this.growthTimers.get(this.key(plot.col,plot.row))?.remove(false); this.growthTimers.delete(this.key(plot.col,plot.row)); this.harvestedCrops[plot.crop]++; this.xp+=crop.xp; this.harvests += 1; this.toast(`${crop.emoji} ${crop.name} harvested · added to Sell inventory`); }
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
        const previousStage = Math.floor(plot.growth / 25);
        plot.growth = progress;
        if (Math.floor(progress / 25) !== previousStage) {
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
    if (plot.state === 'grass') return;
    const p = this.toWorld(plot.col, plot.row);
    const g = this.add.graphics();
    this.plotOverlays.set(id, g);
    this.diamond(g, p.x, p.y, plot.state === 'withered' ? 0x725b45 : 0x805332, plot.state === 'withered' ? 0x574332 : 0x68452f);
    g.lineStyle(2, 0xb78655, 0.9);
    for (let i = -2; i <= 2; i += 1) {
      g.beginPath();
      g.moveTo(p.x - 25, p.y + i * 5);
      g.lineTo(p.x + 25, p.y + i * 5);
      g.strokePath();
    }
    if (plot.state === 'growing' || plot.state === 'ready' || plot.state === 'withered') this.drawCrop(g, p.x, p.y, plot);
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
    const level=Math.floor(this.xp/100)+1;
    const selected=this.selected?this.selected.state:'grass';
    const rows=(Object.entries(CROPS) as Array<[CropId,typeof CROPS[CropId]]>).map(([id,c])=>{
      const locked=level<c.unlockLevel,active=this.selectedCrop===id;
      return '<article class="market-item field-seed-card '+(active?'chosen':'')+'"><div class="market-art">'+c.emoji+'</div><div class="market-copy"><strong>'+c.name+(active?' · Selected':'')+'</strong><small>'+ (locked?'🔒 Unlock at Level '+c.unlockLevel:'Grow '+Math.round(c.growMs/1000)+' sec · Sell for '+c.reward+' coins · In bag: '+this.inventory[id])+'</small></div><button class="market-buy" data-field-seed="'+id+'" '+(locked?'disabled':'')+'>'+(locked?'Locked':active?'Selected':'Select')+'</button><button class="market-buy seed-buy" data-field-buy="'+id+'" '+(locked||this.coins<c.cost?'disabled':'')+'>🪙 '+c.cost+' · Buy</button></article>';
    }).join('');
    host.innerHTML='<section class="inventory-section"><h3>🌱 Choose a seed · Field '+(this.selected? (this.selected.col+1)+', '+(this.selected.row+1):'')+' · '+selected+'</h3><p>Selecting a crop will sow this field immediately. The seed is taken from your bag, or purchased for '+CROPS[this.selectedCrop].cost+' coins if you have none.</p><div class="quest-list">'+rows+'</div></section>';
  }
  private sowSelectedPlot():void {
    const plot=this.selected;if(!plot)return;
    const crop=CROPS[this.selectedCrop];if(Math.floor(this.xp/100)+1<crop.unlockLevel){this.toast('Reach Level '+crop.unlockLevel+' to unlock '+crop.name+'.');return;}
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
        this.activeTool = button.dataset.tool as Tool; this.movingDecor=null;
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
      if (!CROPS[crop] || Math.floor(this.xp / 100) + 1 < CROPS[crop].unlockLevel) return;
      this.selectedCrop = crop;
      this.refreshCropSelector();
      this.refreshSelection();
    });
    this.refreshCropSelector();
  }

  private refreshCropSelector(): void {
    const picker = document.getElementById('crop-picker') as HTMLSelectElement | null;
    if (!picker) return;
    const level = Math.floor(this.xp / 100) + 1;
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
    const farmer=window.prompt('Farmer name:',this.farmerName);if(farmer===null)return;
    const farm=window.prompt('Farm name:',this.farmName);if(farm===null)return;
    const cleanFarmer=farmer.trim().slice(0,24),cleanFarm=farm.trim().slice(0,28);
    if(!cleanFarmer||!cleanFarm){this.toast('Please enter a name for both your farmer and farm.');return;}
    this.farmerName=cleanFarmer;this.farmName=cleanFarm;this.saveFarm();this.refreshHud();this.toast('Your farm profile has been updated.');
  }
  private bindMarket(): void {
    const showDrawer=(section:'quests'|'orders'|'events'|'rewards')=>{
      const drawer=document.getElementById('activity-drawer');if(!drawer)return;
      const title=document.getElementById('drawer-title');if(title)title.textContent=({quests:'Farm Quests',orders:'Orders & Delivery',events:'Farm Events',rewards:'Farm Rewards'} as Record<string,string>)[section];
      ['quests','orders','events','rewards'].forEach(key=>document.getElementById('rail-'+key)?.classList.toggle('drawer-hidden',key!==section));
      drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');
    };
    const closeDrawer=()=>{const drawer=document.getElementById('activity-drawer');drawer?.classList.remove('open');drawer?.setAttribute('aria-hidden','true');};
    document.getElementById('left-quests')?.addEventListener('click',()=>showDrawer('quests'));
    document.getElementById('top-quests')?.addEventListener('click',()=>showDrawer('quests'));
    document.getElementById('left-orders')?.addEventListener('click',()=>showDrawer('orders'));
    document.getElementById('top-orders')?.addEventListener('click',()=>showDrawer('orders'));
    document.getElementById('left-events')?.addEventListener('click',()=>showDrawer('events'));
    document.getElementById('left-rewards')?.addEventListener('click',()=>showDrawer('rewards'));
    document.getElementById('drawer-close')?.addEventListener('click',closeDrawer);
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
    document.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(x=>x.addEventListener('click',()=>this.closeMarket()));
    document.getElementById('market-modal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)this.closeMarket();});
    document.querySelectorAll<HTMLButtonElement>('[data-market-tab]').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('[data-market-tab]').forEach(x=>x.classList.remove('active'));tab.classList.add('active');const cat=tab.dataset.marketTab||'seeds';const intro=document.getElementById('market-intro');if(intro)intro.textContent=cat==='seeds'?'Choose seeds for your next harvest.':cat==='animals'?'Welcome new animals to your farm.':cat==='decor'?'Grow your orchard and personalise your homestead.':cat==='buildings'?'Build and upgrade new farm facilities as your farmer levels up.':cat==='sell'?'Sell harvested crops, orchard fruit, animal produce and crafted goods for coins.':'Buy the correct feed for each animal. Feed is required to produce eggs and milk.';this.renderMarket(cat);}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')this.closeMarket();});
    document.getElementById('animal-action')?.addEventListener('click',()=>this.careForAnimals());
     document.getElementById('market-items')?.addEventListener('click',e=>{const target=e.target as HTMLElement;const seed=target.closest<HTMLButtonElement>('[data-field-seed]');if(seed&&!seed.disabled){this.selectedCrop=seed.dataset.fieldSeed as CropId;this.activeTool='plant';document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.tool==='plant'));if(this.selected?.state==='tilled')this.sowSelectedPlot();else{this.closeMarket();this.toast(CROPS[this.selectedCrop].name+' selected. Tap prepared fields to sow.');}}const fieldBuy=target.closest<HTMLButtonElement>('[data-field-buy]');if(fieldBuy&&!fieldBuy.disabled){const id=fieldBuy.dataset.fieldBuy as CropId;const crop=CROPS[id];if(crop&&this.selected&&this.selected.state==='tilled'&&Math.floor(this.xp/100)+1>=crop.unlockLevel&&this.coins>=crop.cost){this.coins-=crop.cost;this.inventory[id]++;this.selectedCrop=id;this.saveFarm();this.refreshHud();this.renderFieldSeedPicker();this.toast(crop.name+' seeds purchased and added to your bag.');}else if(crop&&this.coins<crop.cost)this.toast('Not enough coins to buy '+crop.name+' seeds.');}const sell=target.closest<HTMLButtonElement>('[data-sell-item]');if(sell&&!sell.disabled)this.sellInventoryItem(sell.dataset.sellItem||'');if(target.closest('#sell-produce'))this.sellProduce();const quest=target.closest<HTMLButtonElement>('[data-claim-quest]');if(quest)this.claimQuest(quest.dataset.claimQuest||'');const order=target.closest<HTMLButtonElement>('[data-fulfil-order]');if(order)this.fulfilOrder(order.dataset.fulfilOrder||'');const warehouse=target.closest<HTMLButtonElement>('#upgrade-warehouse');if(warehouse){const cost=this.buildings.warehouseLevel*400;if(this.buildings.warehouseLevel<10&&this.coins>=cost){this.coins-=cost;this.buildings.warehouseLevel++;this.buildingLevels.silo=this.buildings.warehouseLevel;this.saveFarm();this.refreshHud();this.renderInventory();this.toast('Silo upgraded. Egg and milk storage expanded!');}}const toggle=target.closest<HTMLButtonElement>('[data-animal-toggle]');if(toggle){const animal=this.animals[Number(toggle.dataset.animalToggle)];if(animal){animal.assigned=animal.assigned===false;this.saveFarm();this.refreshHud();if(this.activeBuilding==='coop'||this.activeBuilding==='barn')this.renderBuildingPanel(this.activeBuilding);else if(this.activeBuilding)this.renderGenericBuildingPanel(this.activeBuilding);else this.renderInventory();this.toast(animal.assigned?'Animal assigned to production.':'Animal is resting.');}}const action=target.closest<HTMLButtonElement>('[data-building-action]')?.dataset.buildingAction;if(action&&(this.activeBuilding==='coop'||this.activeBuilding==='barn'))this.runBuildingAction(this.activeBuilding,action as 'collect'|'feed');const start=target.closest<HTMLButtonElement>('[data-production-start]')?.dataset.productionStart;if(start&&this.activeBuilding)this.startProduction(this.activeBuilding,start);if(target.closest('#collect-production')&&this.activeBuilding)this.collectProduction(this.activeBuilding);const delivery=target.closest<HTMLButtonElement>('[data-fulfil-crafted]')?.dataset.fulfilCrafted;if(delivery)this.fulfilCraftedOrder(delivery);});
  }
  private careForAnimals(): void { if(!this.animals.length){this.openMarket();document.querySelector<HTMLButtonElement>('[data-market-tab=animals]')?.click();return;}let collected=0,fed=0,waiting=0;for(const kind of ['hen','cow'] as AnimalId[]){const result=this.collectAndFeed(kind);collected+=result.collected;fed+=result.fed;waiting+=result.waiting;}this.saveFarm();this.refreshHud();this.toast('Stored '+collected+' product(s) · fed '+fed+' · waiting for feed: '+waiting+'.');}
  private productionCapacity(kind:AnimalId):number{return 10+((kind==='hen'?this.buildings.coopLevel:this.buildings.barnLevel)-1)*5+(this.buildings.warehouseLevel-1)*10;}
  private collectAndFeed(kind:AnimalId):{collected:number;fed:number;waiting:number}{let collected=0,fed=0,waiting=0;const now=Date.now();const field=kind==='hen'?'eggs':'milk';for(const animal of this.animals.filter(a=>a.id===kind&&a.assigned!==false)){if(animal.readyAt>0&&animal.readyAt<=now){if(this.produce[field]<this.productionCapacity(kind)){this.produce[field]++;animal.readyAt=0;collected++;}else{waiting++;continue;}}if(animal.readyAt===0){if(this.feed[kind]>0){this.feed[kind]--;animal.readyAt=now+(kind==='hen'?45000:60000);fed++;}else waiting++;}}return{collected,fed,waiting};}
  private runBuildingAction(id:'coop'|'barn',action:'collect'|'feed'):void{const kind:AnimalId=id==='coop'?'hen':'cow';let collected=0,fed=0,waiting=0;if(action==='collect'){const field=kind==='hen'?'eggs':'milk';for(const animal of this.animals.filter(a=>a.id===kind&&a.assigned!==false&&a.readyAt>0&&a.readyAt<=Date.now())){if(this.produce[field]>=this.productionCapacity(kind))break;this.produce[field]++;animal.readyAt=0;collected++;}}else{for(const animal of this.animals.filter(a=>a.id===kind&&a.assigned!==false&&a.readyAt===0)){if(this.feed[kind]>0){this.feed[kind]--;animal.readyAt=Date.now()+(kind==='hen'?45000:60000);fed++;}else waiting++;}}this.saveFarm();this.refreshHud();this.renderBuildingPanel(id);this.toast(action==='collect'?'Collected '+collected+' '+(kind==='hen'?'eggs':'milk')+'.':'Fed '+fed+' animal(s) · '+waiting+' waiting for feed.');}
  private buildingCapacity(id: AnimalId): number { return 2 + ((id==='hen'?this.buildings.coopLevel:this.buildings.barnLevel)-1)*2; }
  private openGenericBuilding(id:BuildingId):void {
    this.activeBuilding=id;const modal=document.getElementById('market-modal');const title=modal?.querySelector('.market-header h2');if(title)title.textContent=id==='silo'?'Grain Silo':id==='bakery'?'Village Bakery':id==='greenhouse'?'Greenhouse':'Windmill';
    modal?.querySelector('.market-tabs')?.classList.add('inventory-hidden');const intro=document.getElementById('market-intro');if(intro)intro.textContent='Upgrade this farm building as you progress.';modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');this.renderGenericBuildingPanel(id);
  }
  private renderGenericBuildingPanel(id:BuildingId):void {
    if(id==='bakery'||id==='greenhouse'||id==='windmill'){this.renderProductionPanel(id);return;}
    const level=this.buildingLevels[id]||this.buildings.warehouseLevel;const cost=level*350;const names:Record<BuildingId,string>={coop:'Chicken Coop',barn:'Dairy Barn',silo:'Grain Silo',bakery:'Village Bakery',greenhouse:'Greenhouse',windmill:'Windmill'};
    const perks:Record<BuildingId,string>={coop:'Adds 2 hen spaces and 5 egg storage per level.',barn:'Adds 2 cow spaces and 5 milk storage per level.',silo:'Adds 10 shared animal-product storage spaces per level.',bakery:'A growing production hub for future baked-goods recipes.',greenhouse:'Unlocks advanced crop-growing space and future specialist crops.',windmill:'A landmark upgrade on your way to a thriving farm.'};
    const host=document.getElementById('market-items');if(!host)return;
    host.innerHTML='<section class="inventory-section"><h3>🏗️ '+names[id]+' · Level '+level+'</h3><p>'+perks[id]+'</p><div class="building-levels">'+[1,2,3,4,5].map(n=>'<span class="'+(n<=level?'reached':'')+'">★</span>').join('')+'</div><p>Upgrade cost: '+cost+' coins. Maximum level: 5.</p><button class="market-buy" id="upgrade-generic-building" '+(level>=5||this.coins<cost?'disabled':'')+'>'+(level>=5?'Maximum level reached':'🪙 '+cost+' · Upgrade to Level '+(level+1))+'</button></section>';
    host.querySelector<HTMLButtonElement>('#upgrade-generic-building')?.addEventListener('click',()=>{if(level>=5||this.coins<cost)return;this.coins-=cost;if(id==='silo')this.buildings.warehouseLevel++;this.buildingLevels[id]=level+1;this.saveFarm();this.refreshHud();this.renderGenericBuildingPanel(id);this.toast(names[id]+' upgraded to Level '+(level+1)+'.');});
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

  private openBuilding(id: 'coop'|'barn'): void { this.activeBuilding=id; const modal=document.getElementById('market-modal'); const title=modal?.querySelector('.market-header h2'); if(title)title.textContent=id==='coop'?'Chicken Coop':'Dairy Barn'; modal?.querySelector('.market-tabs')?.classList.add('inventory-hidden'); const intro=document.getElementById('market-intro'); if(intro)intro.textContent='Manage housing, collect products and keep production moving.'; modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');this.renderBuildingPanel(id); }
  private renderBuildingPanel(id:'coop'|'barn'):void{const kind:AnimalId=id==='coop'?'hen':'cow';const level=id==='coop'?this.buildings.coopLevel:this.buildings.barnLevel;const capacity=this.buildingCapacity(kind);const storage=this.productionCapacity(kind);const field=kind==='hen'?'eggs':'milk';const owned=this.animals.filter(a=>a.id===kind);const ready=owned.filter(a=>a.readyAt>0&&a.readyAt<=Date.now()).length;const producing=owned.filter(a=>a.readyAt>Date.now()).length;const idle=owned.length-ready-producing;const cycle=kind==='hen'?45000:60000;const progress=owned.map((a,i)=>{const remaining=Math.max(0,a.readyAt-Date.now());const pct=a.readyAt===0?0:a.readyAt<=Date.now()?100:Math.max(0,Math.min(100,(1-remaining/cycle)*100));return '<div class="animal-progress"><span>'+(kind==='hen'?'🐔 Hen ':'🐄 Cow ')+(i+1)+(a.assigned===false?' · Resting':'')+'</span><strong>'+(a.assigned===false?'Not assigned':a.readyAt===0?'Needs feed':remaining===0?'Ready':Math.ceil(remaining/1000)+'s')+'</strong><div class="production-track"><i style="width:'+pct+'%"></i></div><button class="market-buy" data-animal-toggle="'+this.animals.indexOf(a)+'">'+(a.assigned===false?'Assign to production':'Unassign')+'</button></div>';}).join('');const cost=level*250;const host=document.getElementById('market-items');if(!host)return;host.innerHTML='<section class="inventory-section"><h3>'+(kind==='hen'?'🥚 Egg production':'🥛 Milk production')+'</h3><div class="inventory-grid"><article class="market-item"><div class="market-art">'+(kind==='hen'?'🥚':'🥛')+'</div><div class="market-copy"><strong>'+owned.length+' / '+capacity+' animals housed</strong><small>'+ready+' ready · '+producing+' producing · '+idle+' need feed</small></div></article><article class="market-item"><div class="market-art">📦</div><div class="market-copy"><strong>Produce storage</strong><small>'+this.produce[field]+' / '+storage+' '+field+' stored</small></div></article></div>'+ (progress||'<p>No animals housed yet. Visit the Market to buy one.</p>')+'</section><section class="inventory-section"><h3>🥣 Feed & collection</h3><p>Feed in storage: '+this.feed[kind]+' · '+(kind==='hen'?'45':'60')+' seconds per production cycle.</p><div class="building-actions"><button class="market-buy" data-building-action="collect" '+(ready===0||this.produce[field]>=storage?'disabled':'')+'>Collect '+(kind==='hen'?'eggs':'milk')+'</button><button class="market-buy" data-building-action="feed" '+(idle===0||this.feed[kind]===0?'disabled':'')+'>Feed idle animals</button></div></section><section class="inventory-section"><h3>🏗️ Building upgrade · Level '+level+'</h3><p class="market-intro">Next level: '+(capacity+2)+' animal spaces and '+(storage+5)+' produce storage. Each upgrade adds 2 housing spaces and 5 storage spaces.</p><button class="market-buy" id="upgrade-building" '+(this.coins<cost||level>=5?'disabled':'')+'>'+(level>=5?'Maximum level reached':'🪙 '+cost+' · Upgrade building')+'</button></section>';host.querySelector<HTMLButtonElement>('#upgrade-building')?.addEventListener('click',()=>{if(level>=5||this.coins<cost)return;this.coins-=cost;if(id==='coop')this.buildings.coopLevel++;else this.buildings.barnLevel++;this.saveFarm();this.refreshHud();this.renderBuildingPanel(id);this.toast('Building upgraded! Housing and storage increased.');});}
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
    if(category==='feed'){host.innerHTML='<article class="market-item"><div class="market-art">🌾</div><div class="market-copy"><strong>Hen feed</strong><small>Feed one hen · starts a 45-second egg cycle · in storage: '+this.feed.hen+'</small></div><button class="market-buy" data-buy-feed="hen" '+(this.coins<12?'disabled':'')+'>🪙 12 · Buy</button></article><article class="market-item"><div class="market-art">🌿</div><div class="market-copy"><strong>Cow feed</strong><small>Feed one cow · starts a 60-second milk cycle · in storage: '+this.feed.cow+'</small></div><button class="market-buy" data-buy-feed="cow" '+(this.coins<18?'disabled':'')+'>🪙 18 · Buy</button></article>';host.querySelectorAll<HTMLButtonElement>('[data-buy-feed]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buyFeed as AnimalId;const price=id==='hen'?12:18;if(this.coins<price)return;this.coins-=price;this.feed[id]++;this.saveFarm();this.refreshHud();this.renderMarket('feed');this.toast((id==='hen'?'Hen':'Cow')+' feed added to storage.');}));return;} if(category==='animals'){const hens=this.animals.filter(a=>a.id==='hen').length,cows=this.animals.filter(a=>a.id==='cow').length;host.innerHTML='<article class="market-item"><div class="market-art">🐔</div><div class="market-copy"><strong>Happy Hen</strong><small>Lays an egg after feeding · housing: '+hens+'/'+this.buildingCapacity('hen')+'</small></div><button class="market-buy" data-buy-animal="hen" '+(this.coins<75||hens>=this.buildingCapacity('hen')?'disabled':'')+'>🪙 75 · Buy</button></article><article class="market-item"><div class="market-art">🐄</div><div class="market-copy"><strong>Daisy Cow</strong><small>Produces milk after feeding · housing: '+cows+'/'+this.buildingCapacity('cow')+'</small></div><button class="market-buy" data-buy-animal="cow" '+(this.coins<160||cows>=this.buildingCapacity('cow')?'disabled':'')+'>🪙 160 · Buy</button></article>';host.querySelectorAll<HTMLButtonElement>('[data-buy-animal]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buyAnimal as AnimalId;const cost=id==='hen'?75:160;if(this.coins<cost||this.animals.filter(a=>a.id===id).length>=this.buildingCapacity(id))return;this.coins-=cost;this.animals.push({id,readyAt:0});this.renderOwnedAnimals();this.saveFarm();this.refreshHud();this.toast('A new animal joined your farm!');this.renderMarket('animals');}));return;} if(category==='buildings'){
      const level=Math.floor(this.xp/100)+1;
      const options=[{id:'bakery',name:'Village Bakery',emoji:'🥖',cost:550,unlock:4,desc:'A village bakery for the next stage of farm life.'},{id:'greenhouse',name:'Greenhouse',emoji:'🌿',cost:700,unlock:6,desc:'A glasshouse for year-round growing.'},{id:'windmill',name:'Windmill',emoji:'🌬️',cost:950,unlock:8,desc:'A landmark mill that completes your homestead.'}];
      host.innerHTML=options.map(item=>{const owned=this.buildingLevels[item.id as BuildingId]>0;return '<article class="market-item"><div class="market-art">'+item.emoji+'</div><div class="market-copy"><strong>'+item.name+(owned?' · Level '+this.buildingLevels[item.id as BuildingId]:'')+'</strong><small>'+item.desc+' Unlocks at Level '+item.unlock+'. Upgrade cost: '+(this.buildingLevels[item.id as BuildingId]*350||item.cost)+' coins.</small></div><button class="market-buy" data-building-buy="'+item.id+'" '+(level<item.unlock||(!owned&&this.coins<item.cost)||(owned&&this.coins<this.buildingLevels[item.id as BuildingId]*350)||this.buildingLevels[item.id as BuildingId]>=5?'disabled':'')+'>'+(level<item.unlock?'🔒 Level '+item.unlock: this.buildingLevels[item.id as BuildingId]>=5?'Max level':owned?'🪙 '+(this.buildingLevels[item.id as BuildingId]*350)+' · Upgrade':'🪙 '+item.cost+' · Build')+'</button></article>';}).join('');
      host.querySelectorAll<HTMLButtonElement>('[data-building-buy]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buildingBuy as BuildingId;const item=options.find(x=>x.id===id);if(!item||level<item.unlock||this.buildingLevels[id]>=5)return;const cost=this.buildingLevels[id]>0?this.buildingLevels[id]*350:item.cost;if(this.coins<cost)return;this.coins-=cost;this.buildingLevels[id]=Math.max(1,this.buildingLevels[id]+1);if(!this.decor[id]){const spots:Record<string,{col:number;row:number}>={bakery:{col:2,row:2},greenhouse:{col:7,row:9},windmill:{col:10,row:6}};this.decor[id]=spots[id]!;}this.drawScenery();this.saveFarm();this.refreshHud();this.renderMarket('buildings');this.toast(item.name+' upgraded to Level '+this.buildingLevels[id]+'.');}));return;
    }if(category==='decor'){
      const items=[{id:'appleTree',name:'Apple Tree',emoji:'🍎',cost:95,desc:'An orchard tree with ripe red apples.'},{id:'pearTree',name:'Pear Tree',emoji:'🍐',cost:95,desc:'A leafy tree with golden pears.'},{id:'cherryTree',name:'Cherry Tree',emoji:'🍒',cost:110,desc:'A fruit tree with ruby-red cherries.'},{id:'flowerbed',name:'Flower Bed',emoji:'🌷',cost:35,desc:'A colourful patch of seasonal flowers.'},{id:'fountain',name:'Stone Fountain',emoji:'⛲',cost:140,desc:'A water feature for your homestead.'},{id:'scarecrow',name:'Scarecrow',emoji:'🧑‍🌾',cost:65,desc:'A cheerful guardian for your crops.'},{id:'bench',name:'Garden Bench',emoji:'🪑',cost:55,desc:'A cosy resting spot beside the path.'}];
      host.innerHTML=items.map(item=>'<article class="market-item"><div class="market-art">'+item.emoji+'</div><div class="market-copy"><strong>'+item.name+'</strong><small>'+item.desc+'</small></div><button class="market-buy" data-buy-decor="'+item.id+'" '+(this.coins<item.cost?'disabled':'')+'>🪙 '+item.cost+' · Buy</button></article>').join('');
      host.querySelectorAll<HTMLButtonElement>('[data-buy-decor]').forEach(btn=>btn.addEventListener('click',()=>{
        const item=items.find(x=>x.id===btn.dataset.buyDecor);if(!item||this.coins<item.cost)return;
        this.coins-=item.cost;const count=Object.keys(this.decor).filter(k=>k.startsWith(item.id)).length;
        const spots=[[1,10],[3,11],[5,10],[7,11],[9,10],[11,11]];const spot=spots[count%spots.length]!;
        this.decor[item.id+(count+1)]={col:spot[0],row:spot[1]};this.drawScenery();if(item.id==='appleTree'||item.id==='pearTree'||item.id==='cherryTree'){this.initializeFruitTrees();this.renderFruitTreeBadges();}this.saveFarm();this.refreshHud();this.renderMarket('decor');this.toast(item.name+' added to your farm!');
      }));return;
    }
    const level=Math.floor(this.xp/100)+1;host.innerHTML=(Object.entries(CROPS) as Array<[CropId,typeof CROPS[CropId]]>).map(([id,crop])=>{const locked=level<crop.unlockLevel;return `<article class="market-item ${locked?'crop-locked':''}"><div class="market-art">${crop.emoji}</div><div class="market-copy"><strong>${crop.name}</strong><small>${locked?'Unlocks at level '+crop.unlockLevel:Math.round(crop.growMs/1000)+'s grow · '+Math.round(Math.max(300000,crop.growMs*2)/1000)+'s harvest window'} · reward ${crop.reward} coins · +${crop.xp} XP · bag: ${this.inventory[id]}</small></div><button class="market-buy" data-buy-seed="${id}" ${locked||this.coins<crop.cost?'disabled':''}>${locked?'🔒 Level '+crop.unlockLevel:'🪙 '+crop.cost+' · Buy'}</button></article>`;}).join('');
    host.querySelectorAll<HTMLButtonElement>('[data-buy-seed]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buySeed as CropId;const crop=CROPS[id];if(!crop||Math.floor(this.xp/100)+1<crop.unlockLevel||this.coins<crop.cost)return;this.coins-=crop.cost;this.inventory[id]++;this.saveFarm();this.refreshHud();this.refreshSelection();this.toast(`${crop.emoji} ${crop.name} seeds added to your bag`);}));
  }
  private toast(message:string): void {const el=document.getElementById('game-toast');if(!el)return;el.textContent=message;el.classList.add('show');window.setTimeout(()=>el.classList.remove('show'),2200);}

  private loadFarm(): void {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (!raw) return;
      const save = JSON.parse(raw) as any;
      if (![1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].includes(save.version) || !Array.isArray(save.plots)) return;
      this.coins = Math.max(0, Math.floor(save.coins));
      this.farmerName=typeof save.farmerName==='string'&&save.farmerName.trim()?save.farmerName.slice(0,24):'New Farmer';
      this.farmName=typeof save.farmName==='string'&&save.farmName.trim()?save.farmName.slice(0,28):'My Farm';
      if(save.buildingLevels&&typeof save.buildingLevels==='object')for(const id of ['coop','barn','silo','bakery','greenhouse','windmill'] as BuildingId[])this.buildingLevels[id]=Math.max(this.buildingLevels[id],Math.min(5,Math.floor(Number(save.buildingLevels[id])||0)));this.randomQuests = Array.isArray(save.randomQuests) ? save.randomQuests : [];this.questRefreshAt=Number(save.questRefreshAt)||0;if(save.questProgressBaseline)this.questProgressBaseline={...this.questProgressBaseline,...save.questProgressBaseline};this.eventStartedAt=Number(save.eventStartedAt)||0;this.eventStartHarvests=Math.max(0,Number(save.eventStartHarvests)||0);this.eventClaimed=Boolean(save.eventClaimed);this.claimedMilestones=Array.isArray(save.claimedMilestones)?save.claimedMilestones.filter((n:number)=>[10,25,50,100].includes(n)):[];
      this.questCycle = this.randomQuests.length ? Math.max(1,...this.randomQuests.map(q=>Number((q.id.match(/-(\\d+)-\\d+$/)||[])[1])||1)) : 0;
      this.claimedQuests = Array.isArray(save.claimedQuests) ? save.claimedQuests.filter((id:string)=>(['first-harvest','busy-farmer','first-hen','first-cow','better-coop','bigger-silo'].includes(id) || this.randomQuests.some(q=>q.id===id))) : [];
      this.ordersCompleted = save.version >= 9 && save.ordersCompleted && typeof save.ordersCompleted === 'object' ? Object.fromEntries(Object.entries(save.ordersCompleted).map(([id,count])=>[id,Math.max(0,Math.floor(Number(count)||0))]).filter(([id])=>['egg-crate','milk-run','farm-breakfast'].includes(String(id)))) : {};
      this.xp = Math.max(0, Math.floor(save.xp));
      if(save.decor && typeof save.decor==='object') for(const [id,pos] of Object.entries(save.decor as Record<string,{col:number;row:number}>)){if((id in this.decor || /^(appleTree|pearTree|cherryTree|flowerbed|fountain|scarecrow|bench|bakery|greenhouse|windmill)\\d*$/.test(id)) && Number.isInteger(pos.col)&&Number.isInteger(pos.row)&&pos.col>=0&&pos.col<COLS&&pos.row>=0&&pos.row<ROWS)this.decor[id]={col:pos.col,row:pos.row};}
      if (save.selectedCrop && save.selectedCrop in CROPS && Math.floor(this.xp / 100) + 1 >= CROPS[save.selectedCrop as CropId].unlockLevel) this.selectedCrop = save.selectedCrop as CropId;
      if (save.version >= 2 && save.inventory) this.inventory = {...this.inventory,...save.inventory};
      if (save.version >= 4 && save.feed) this.feed = {...this.feed,...save.feed};
       if (save.version >= 6 && save.buildings) this.buildings = {...this.buildings,...save.buildings,warehouseLevel:save.buildings.warehouseLevel||1};
      if(save.fruitInventory)this.fruitInventory={...this.fruitInventory,...save.fruitInventory};
      if(save.harvestedCrops)this.harvestedCrops={...this.harvestedCrops,...save.harvestedCrops};
      if(save.fruitTreeReadyAt&&typeof save.fruitTreeReadyAt==='object')this.fruitTreeReadyAt={...save.fruitTreeReadyAt};
      if(save.version>=12){if(save.productionJobs)for(const id of ['bakery','greenhouse','windmill'] as BuildingId[])this.productionJobs[id]=save.productionJobs[id]||null;if(save.crafted)this.crafted={...this.crafted,...save.crafted};}
      this.buildingLevels.coop=this.buildings.coopLevel;this.buildingLevels.barn=this.buildings.barnLevel;this.buildingLevels.silo=this.buildings.warehouseLevel;
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
      version: 15,
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
      decor: this.decor,
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
    } catch {
      // Storage may be disabled or full; gameplay remains available for this session.
    }
  }

  private refreshHud(): void {
    const coins = document.getElementById('coins');
    const xp = document.getElementById('xp');
    if (coins) coins.textContent = String(this.coins);
    const level = Math.floor(this.xp / 100) + 1;
    if (xp) xp.textContent = `Level ${level} · ${this.xp} XP`;
    const levelBadge = document.getElementById('farmer-level');
    if (levelBadge) levelBadge.textContent = `LEVEL ${level}`;
    const farmerName=document.getElementById('farmer-name');if(farmerName)farmerName.textContent=this.farmerName;
    const farmLabel=document.getElementById('farm-name-label');if(farmLabel)farmLabel.textContent=this.farmName.toUpperCase();
    const farmerSub = document.querySelector<HTMLElement>('.profile-card small');
    if (farmerSub) farmerSub.textContent = level === 1 ? 'Your farm adventure begins!' : level < 5 ? 'Growing into a skilled farmer!' : 'A flourishing farm awaits!';
    const progress = document.getElementById('progress-text');
    const fill = document.getElementById('progress-fill');
    if (progress) progress.textContent = `${this.xp % 100} / 100 XP`; 
    if (fill) (fill as HTMLElement).style.width = `${this.xp % 100}%`;
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
