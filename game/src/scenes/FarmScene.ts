import Phaser from 'phaser';
import { initializeCloudSaves, queueCloudSave } from '../services/cloudSave';
import { initializeFriends } from '../services/friends';
import { playSfx } from '../services/sfx';

type Tool = 'select' | 'plow' | 'plant' | 'harvest' | 'move' | 'store' | 'remove' | 'feed-hen' | 'feed-cow';
type PlotState = 'grass' | 'tilled' | 'growing' | 'ready' | 'withered';
type CropId = 'wheat' | 'carrot' | 'corn' | 'strawberry' | 'tomato' | 'pumpkin' | 'blueberry' | 'watermelon';
interface Plot { col: number; row: number; state: PlotState; watered: boolean; growth: number; crop: CropId; readyAt: number; witherAt: number }
type AnimalId = 'hen' | 'cow' | 'chick' | 'calf';
interface Animal { id: AnimalId; readyAt: number; assigned?: boolean; growthFeedings?: number }
interface BuildingProgress { coopLevel: number; barnLevel: number; warehouseLevel: number }
interface AnimalProduce { eggs: number; milk: number }
type BuildingId = 'coop'|'barn'|'silo'|'bakery'|'greenhouse'|'windmill'|'stable'|'well'|'workshop'|'waterTower';
type ProductId='flour'|'bread'|'pastry'|'grapes';
interface ProductionJob { recipe:string; readyAt:number }
interface FarmSave { version: 19; workshopCompost?:number; water?:number; waterCollectedAt?:number; farmExpansionLevel?:number; landTiles?:string[]; landExpansionCount?:number; questRefreshAt?:number; questProgressBaseline?:Partial<Record<'harvests'|'hens'|'cows'|'eggs'|'milk',number>>; eventStartedAt?:number; eventStartHarvests?:number; eventClaimed?:boolean; claimedMilestones?:number[]; harvestedCrops?:Partial<Record<CropId,number>>; fruitInventory?:Record<'apples'|'pears'|'cherries'|'oranges',number>; fruitTreeReadyAt?:Record<string,number>; farmerName?:string; farmName?:string; buildingLevels?:Partial<Record<BuildingId,number>>; productionJobs?:Partial<Record<BuildingId,ProductionJob|null>>; crafted?:Partial<Record<ProductId,number>>; randomQuests?: Array<{id:string;title:string;description:string;target:number;coins:number;xp:number;icon:string;metric:'harvests'|'hens'|'cows'|'eggs'|'milk'}>; claimedQuests?: string[]; ordersCompleted?: Record<string,number>; animals: Animal[]; harvests: number; coins: number; xp: number; selectedCrop?: CropId; decor?: Record<string,{col:number;row:number}>; storedDecor?:string[]; feed: { hen: number; cow: number }; buildings?: BuildingProgress; produce?: AnimalProduce; inventory: Record<CropId, number>; plots: Array<{ col:number; row:number; state:PlotState; watered:boolean; growth:number; crop?:CropId; readyAt?:number; witherAt?:number }> }
const CROPS: Record<CropId,{name:string;emoji:string;cost:number;reward:number;xp:number;growMs:number;color:number;unlockLevel:number}> = {
 wheat:{name:'Wheat',emoji:'🌾',cost:8,reward:22,xp:2,growMs:5*60*1000,color:0xe4b83f,unlockLevel:1},
 carrot:{name:'Carrot',emoji:'🥕',cost:14,reward:38,xp:3,growMs:10*60*1000,color:0xef873e,unlockLevel:1},
 corn:{name:'Corn',emoji:'🌽',cost:22,reward:62,xp:4,growMs:25*60*1000,color:0xf2c94c,unlockLevel:7},
 strawberry:{name:'Strawberry',emoji:'🍓',cost:32,reward:95,xp:5,growMs:60*60*1000,color:0xd94f55,unlockLevel:13},
 tomato:{name:'Tomato',emoji:'🍅',cost:45,reward:135,xp:6,growMs:2*60*60*1000,color:0xe65c45,unlockLevel:19},
 pumpkin:{name:'Pumpkin',emoji:'🎃',cost:65,reward:195,xp:7,growMs:4*60*60*1000,color:0xe98d35,unlockLevel:25},
 blueberry:{name:'Blueberry',emoji:'🫐',cost:95,reward:285,xp:8,growMs:6*60*60*1000,color:0x6556a8,unlockLevel:31},
 watermelon:{name:'Watermelon',emoji:'🍉',cost:140,reward:420,xp:10,growMs:8*60*60*1000,color:0x65a94f,unlockLevel:37}
};

const COLS = 19;
const ROWS = 19;
const INITIAL_FARM_SIZE = 5;
const MAX_FARM_SIZE = 19;
const DECOR_ASSET_ORDER = ["apple_barrels_crate","apple_barrels_crate_sheet2","apple_barrels_variant","apple_tree","apple_tree_sheet1","apple_tree_variant","apple_tree_variant2","apple_tree_variant_sheet2","bird_bath","bird_bath_sheet1","bird_bath_stone","bird_bath_stone_sheet2","bird_bath_variant","birdhouse_post","birdhouse_post_sheet1","birdhouse_post_variant","birdhouse_post_variant2","campfire_circle","campfire_stumps","campfire_stumps_sheet2","campfire_variant","cushioned_swing","double_lantern_post","evergreen_tree","evergreen_tree_sheet1","evergreen_tree_variant","evergreen_tree_variant_sheet2","farm_direction_sign","farm_signpost","farm_signpost_sheet1","festival_bunting","festival_bunting_sheet2","firewood_stack","flower_arch_bench","flower_arch_bench_sheet1","flower_arch_bench_variant","flower_archway","flower_archway_sheet2","flower_cart","flower_cart_sheet2","flower_cart_variant","flower_fountain","flower_gate_arch","flower_gate_arch_sheet1","flower_gate_arch_sheet3","flower_market_cart","hollow_log_planter_sheet1","lamp_post_flower","large_stone_fountain","large_stone_fountain_sheet2","lavender_bush","lavender_bush_sheet2","lily_pond","lily_pond_reeds","lily_pond_sheet2","mossy_rock_cluster","mossy_rock_cluster_sheet2","mossy_rock_variant","mossy_rocks","mossy_rocks_sheet1","mossy_rocks_variant2","orange_blossom_tree","orange_blossom_tree_sheet2","orange_fruit_tree","orange_fruit_tree_sheet2","orange_tree_variant2","ornate_lamp_post","ornate_lamp_post_sheet2","park_bench_variant","pear_tree","picket_fence_flower","picnic_table","picnic_table_sheet2","picnic_table_variant","picnic_table_variant2","pine_tree_variant","pink_blossom_tree","pink_blossom_tree_sheet1","pink_blossom_tree_variant","pink_blossom_tree_variant2","pink_blossom_tree_variant_sheet2","pink_flower_bush","pink_flower_bush_sheet2","pink_flower_bush_variant","pink_flower_hedge","pink_flower_hedge_sheet1","purple_flower_bush","purple_flower_bush_sheet2","purple_flower_hedge","purple_flower_hedge_sheet1","purple_flower_pot","red_hand_pump","red_roof_gazebo","red_roof_well","red_roof_well_sheet1","red_roof_well_variant","red_roof_well_variant2","red_roof_well_variant_sheet2","rock_cluster","rock_cluster_sheet2","rock_flowerbed","rooster_signpost","rooster_signpost_sheet2","rope_fence","rose_bush","rose_bush_sheet2","round_flowerbed","scarecrow","scarecrow_variant","small_green_tree","stepping_stone_path","stepping_stone_path_sheet2","stone_birdbath","stone_lamp_wall","stone_wall","stone_wall_lamp","stone_wall_sheet1","stone_well_variant","string_lights","string_lights_sheet2","sunflower_cart","sunflower_cart_sheet2","sunflower_cart_variant","sunflower_cart_variant_sheet4","tiered_fountain_variant","tiered_stone_fountain","tiered_stone_fountain_sheet1","waterfall_pond","waterfall_pond_sheet2","white_blossom_tree","white_picket_fence","white_picket_fence_flowers","white_picket_fence_flowers_sheet2","white_picket_fence_sheet1","white_picket_fence_sheet4","wisteria_garden_arch","wisteria_swing","wisteria_swing_bench","wisteria_swing_sheet2","wisteria_tree","wisteria_trellis","wooden_bridge","wooden_farm_gate","wooden_fence","wooden_fence_sheet1","wooden_park_bench","wooden_park_bench_sheet2","wooden_windmill","wooden_windmill_sheet1","wooden_windmill_variant","wooden_windmill_variant2","yellow_flower_bush","yellow_flower_bush_sheet2","yellow_flower_hedge","yellow_flower_hedge_sheet1"] as const;
const DECOR_ASSET_DUPLICATES = new Set<string>(["apple_barrels_crate_sheet2","apple_tree_sheet1","apple_tree_variant_sheet2","bird_bath_sheet1","bird_bath_stone_sheet2","birdhouse_post_sheet1","campfire_stumps_sheet2","evergreen_tree_sheet1","evergreen_tree_variant_sheet2","farm_signpost_sheet1","festival_bunting_sheet2","flower_arch_bench_sheet1","flower_archway_sheet2","flower_cart_sheet2","flower_gate_arch_sheet1","large_stone_fountain_sheet2","lavender_bush_sheet2","lily_pond_sheet2","mossy_rock_cluster_sheet2","mossy_rocks_sheet1","orange_blossom_tree_sheet2","orange_fruit_tree_sheet2","ornate_lamp_post_sheet2","picnic_table_sheet2","pink_blossom_tree_sheet1","pink_blossom_tree_variant_sheet2","pink_flower_bush_sheet2","pink_flower_hedge_sheet1","purple_flower_bush_sheet2","purple_flower_hedge_sheet1","red_roof_well_sheet1","red_roof_well_variant_sheet2","rock_cluster_sheet2","rooster_signpost_sheet2","rose_bush_sheet2","stepping_stone_path_sheet2","stone_wall_sheet1","string_lights_sheet2","sunflower_cart_sheet2","tiered_stone_fountain_sheet1","waterfall_pond_sheet2","white_picket_fence_sheet1","white_picket_fence_flowers_sheet2","wisteria_swing_sheet2","wooden_fence_sheet1","wooden_park_bench_sheet2","wooden_windmill_sheet1","yellow_flower_bush_sheet2","yellow_flower_hedge_sheet1"]);
const DECOR_ASSETS = DECOR_ASSET_ORDER.filter(asset=>!DECOR_ASSET_DUPLICATES.has(asset));
const DECOR_ASSET_ALIASES:Record<string,string>={"apple_barrels_crate_sheet2":"apple_barrels_crate","apple_tree_sheet1":"apple_tree","apple_tree_variant_sheet2":"apple_tree_variant","bird_bath_sheet1":"bird_bath","bird_bath_stone_sheet2":"bird_bath_stone","birdhouse_post_sheet1":"birdhouse_post","campfire_stumps_sheet2":"campfire_stumps","evergreen_tree_sheet1":"evergreen_tree","evergreen_tree_variant_sheet2":"evergreen_tree_variant","farm_signpost_sheet1":"farm_signpost","festival_bunting_sheet2":"festival_bunting","flower_arch_bench_sheet1":"flower_arch_bench","flower_archway_sheet2":"flower_archway","flower_cart_sheet2":"flower_cart","flower_gate_arch_sheet1":"flower_gate_arch","large_stone_fountain_sheet2":"large_stone_fountain","lavender_bush_sheet2":"lavender_bush","lily_pond_sheet2":"lily_pond","mossy_rock_cluster_sheet2":"mossy_rock_cluster","mossy_rocks_sheet1":"mossy_rocks","orange_blossom_tree_sheet2":"orange_blossom_tree","orange_fruit_tree_sheet2":"orange_fruit_tree","ornate_lamp_post_sheet2":"ornate_lamp_post","picnic_table_sheet2":"picnic_table","pink_blossom_tree_sheet1":"pink_blossom_tree","pink_blossom_tree_variant_sheet2":"pink_blossom_tree_variant","pink_flower_bush_sheet2":"pink_flower_bush","pink_flower_hedge_sheet1":"pink_flower_hedge","purple_flower_bush_sheet2":"purple_flower_bush","purple_flower_hedge_sheet1":"purple_flower_hedge","red_roof_well_sheet1":"red_roof_well","red_roof_well_variant_sheet2":"red_roof_well_variant","rock_cluster_sheet2":"rock_cluster","rooster_signpost_sheet2":"rooster_signpost","rose_bush_sheet2":"rose_bush","stepping_stone_path_sheet2":"stepping_stone_path","stone_wall_sheet1":"stone_wall","string_lights_sheet2":"string_lights","sunflower_cart_sheet2":"sunflower_cart","tiered_stone_fountain_sheet1":"tiered_stone_fountain","waterfall_pond_sheet2":"waterfall_pond","white_picket_fence_sheet1":"white_picket_fence","white_picket_fence_flowers_sheet2":"white_picket_fence_flowers","wisteria_swing_sheet2":"wisteria_swing","wooden_fence_sheet1":"wooden_fence","wooden_park_bench_sheet2":"wooden_park_bench","wooden_windmill_sheet1":"wooden_windmill","yellow_flower_bush_sheet2":"yellow_flower_bush","yellow_flower_hedge_sheet1":"yellow_flower_hedge"};

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
  private decorAssetSprites = new Map<string, Phaser.GameObjects.Image>();
  private decorAssetShadows = new Map<string, Phaser.GameObjects.Ellipse>();
  private windmillRotorSprites = new Map<string, Phaser.GameObjects.Image>();
  private growthTimers = new Map<string, Phaser.Time.TimerEvent>();
  private plotGraphics!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private placementOverlay!: Phaser.GameObjects.Graphics;
  private selected: Plot | null = null;
  private cropHoverTooltip: HTMLDivElement|null = null;
  private cropActionPlot: Plot|null = null;
  private hoveredCropPlot: Plot|null = null;
  private hoveredFruitTreeId: string|null = null;
  private hoverPointer = {x:0,y:0};
  private activeTool: Tool = 'select';
  private coins = 250;
  private xp = 0;
  private inventory: Record<CropId,number> = {wheat:3,carrot:0,corn:0,strawberry:0,tomato:0,pumpkin:0,blueberry:0,watermelon:0};
  private selectedCrop: CropId = 'wheat';
  private animals: Animal[] = [];
  private feed: Record<AnimalId, number> = { hen: 0, cow: 0, chick: 0, calf: 0 };
  private buildings: BuildingProgress = { coopLevel: 0, barnLevel: 0, warehouseLevel: 0 };
  private produce: AnimalProduce = { eggs: 0, milk: 0 };
  private activeBuilding: BuildingId|null = null;
  private farmerName='New Farmer';
  private farmName='My Farm';
  private waterUnits=0;
  private waterCollectedAt=0;
  private buildingLevels: Record<BuildingId,number>={coop:0,barn:0,silo:0,bakery:0,greenhouse:0,windmill:0,stable:0,well:0,workshop:0,waterTower:0};
  private productionJobs: Record<BuildingId,ProductionJob|null>={coop:null,barn:null,silo:null,bakery:null,greenhouse:null,windmill:null,stable:null,well:null,workshop:null,waterTower:null};
  private crafted: Record<ProductId,number>={flour:0,bread:0,pastry:0,grapes:0};
  private workshopCompost=0;
  private animalActors: Phaser.GameObjects.Container[] = [];
  private animalSprites = new Map<Phaser.GameObjects.Container, Phaser.GameObjects.Sprite>();
  private animalReservedCells=new Set<string>();
  private animalTroughs=new Map<AnimalId,Phaser.GameObjects.Container>();
  private animalHungryBadges=new Map<number,Phaser.GameObjects.Text>();
  private animalProduceBadges=new Map<number,Phaser.GameObjects.Text>();
  private buildingProduceBadges=new Map<'coop'|'barn',Phaser.GameObjects.Text>();
  private productionReadyBadges=new Map<'bakery'|'greenhouse'|'windmill'|'workshop',Phaser.GameObjects.Text>();
  private wellWaterBadge:Phaser.GameObjects.Text|null=null;
  private cropWaterBadges=new Map<string,Phaser.GameObjects.Text>();
  private sceneryGraphics: Phaser.GameObjects.Graphics[] = [];
  private sceneryLabels: Phaser.GameObjects.Text[] = [];
  private landTiles = new Set<string>();
  private landExpansionCountValue=0;
  private landExpansionPreviewLabel:Phaser.GameObjects.Text|null=null;
  private displayedLevel=1;
  private farmhouseVisualLevel=1;
  private decor: Record<string,{col:number;row:number}> = {farmhouse:{col:3,row:1}};
  private storedDecor:string[]=[];
  private fruitInventory:Record<'apples'|'pears'|'cherries'|'oranges',number>={apples:0,pears:0,cherries:0,oranges:0};
  private harvestedCrops:Record<CropId,number>={wheat:0,carrot:0,corn:0,strawberry:0,tomato:0,pumpkin:0,blueberry:0,watermelon:0};
  private fruitTreeReadyAt:Record<string,number>={};
  private fruitTreeBadges:Record<string,Phaser.GameObjects.Text>={};
  private movingDecor: string | null = null;
  private pendingDecorId: string | null = null;
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
  private persistenceBlocked = false;

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
    DECOR_ASSETS.forEach(asset=>this.load.image('decor-'+asset,`${import.meta.env.BASE_URL}assets/decor/${asset}.png`));
    this.load.spritesheet('animal-cow', `${import.meta.env.BASE_URL}assets/animals/cow.png`, { frameWidth: 384, frameHeight: 256 });
    this.load.spritesheet('animal-hen', `${import.meta.env.BASE_URL}assets/animals/hen.png`, { frameWidth: 48, frameHeight: 48 });
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
    this.updateToolCursor();
    this.bindCropSelector();
    this.bindMarket();
    this.bindSideRail();
    this.refreshHud();
    this.bindDailyReward();
    if (!sessionStorage.getItem('happyFarmVisitorModeV1')) initializeCloudSaves();
    initializeFriends();
    this.refreshSelection();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => { if((this.questRefreshAt>0&&Date.now()>=this.questRefreshAt)||(this.eventStartedAt>0&&Date.now()-this.eventStartedAt>=604800000)){this.ensureQuestAndEventCycles();this.renderSideRail();} this.updateCropLifecycle(); this.updateProduction(); this.updateProductionReadyBadges(); this.updateFruitTrees(); this.updateWellWaterBadge(); this.updateAnimalHungryIndicators(); this.updateBuildingProduceBadges(); this.updateCropWaterBadges(); this.refreshCropHoverTooltip(); if(this.activeBuilding==='coop'||this.activeBuilding==='barn')this.renderBuildingPanel(this.activeBuilding);else if(this.activeBuilding)this.renderGenericBuildingPanel(this.activeBuilding); } });
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
    this.rewardAmount=50;
    const amount=document.getElementById('daily-reward-amount');if(amount)amount.textContent='50';
    const button=document.getElementById('daily-reward-claim') as HTMLButtonElement|null;
    if(button){button.disabled=false;button.textContent='Collect 50 coins';}
    const copy=document.getElementById('daily-reward-copy');if(copy)copy.textContent='Your daily farm gift is ready. Collect 50 coins to keep growing!';
    const modal=document.getElementById('daily-reward-modal');modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');
  }
  private claimDailyReward():void {
    if(this.rewardAvailableAt>Date.now())return;
    this.coins+=this.rewardAmount;this.rewardAvailableAt=Date.now()+24*60*60*1000;
    try{localStorage.setItem(this.rewardKey,String(this.rewardAvailableAt));}catch{}
    this.saveFarm();this.refreshHud();
    const button=document.getElementById('daily-reward-claim') as HTMLButtonElement|null;
    if(button){button.disabled=true;button.textContent='✓ Reward collected';}
    const copy=document.getElementById('daily-reward-copy');if(copy)copy.textContent='50 coins added to your farm balance. Happy farming!';
    this.updateDailyRewardCountdown();
    const modal=document.getElementById('daily-reward-modal');modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');
  }
  private updateDailyRewardCountdown():void {
    const next=document.getElementById('daily-reward-next');if(!next)return;
    const remaining=this.rewardAvailableAt-Date.now();
    if(remaining<=0){next.textContent='Your next gift is ready now!';return;}
    const hours=Math.floor(remaining/3600000),minutes=Math.floor((remaining%3600000)/60000);
    next.textContent='Next reward in '+hours+'h '+String(minutes).padStart(2,'0')+'m · 50 coins every 24 hours';
  }

  private fitFarmToViewport(): void {
    const camera=this.cameras.main,width=Math.max(320,this.scale.width),height=Math.max(360,this.scale.height);
    const spanX=Math.max(TILE_W,(this.farmSize-1)*TILE_W+24);
    const spanY=Math.max(TILE_H,(this.farmSize-1)*TILE_H+24);
    const fitX=(width-56)/spanX;
    const fitY=(height-(height<700?178:110))/spanY;
    this.minFarmZoom=Phaser.Math.Clamp(Math.min(1.28,fitX,fitY),0.32,1.28);
    camera.setZoom(Phaser.Math.Clamp(Math.min(1.28,fitX*1.12,fitY*1.12),this.minFarmZoom,1.28));
    camera.centerOn(0,ORIGIN_Y+(this.farmSize-1)*TILE_H/2);
  }

  private xpForLevel(level:number):number { const target=Math.max(1,Math.min(100,Math.floor(level)));let total=0;for(let current=1;current<target;current++)total+=120+14*(current-1)*(current-1);return total; }
  private get farmerLevel():number { let level=1;while(level<100&&this.xp>=this.xpForLevel(level+1))level++;return level; }
  private get levelProgress():number { return this.xp-this.xpForLevel(this.farmerLevel); }
  private get xpNeededForNextLevel():number { const level=this.farmerLevel;return level>=100?0:120+14*(level-1)*(level-1); }
  private get farmSize():number { let size=INITIAL_FARM_SIZE;for(const tile of this.landTiles){const [col,row]=tile.split(':').map(Number);size=Math.max(size,col+1,row+1);}return Math.min(MAX_FARM_SIZE,size); }
  private isFarmTile(col:number,row:number):boolean{return this.landTiles.has(this.key(col,row));}
  private findLandExpansion(size:number):Array<{col:number;row:number}>|null {
    for(let row=0;row<=MAX_FARM_SIZE-size;row++)for(let col=0;col<=MAX_FARM_SIZE-size;col++){
      const cells:Array<{col:number;row:number}>=[];let valid=true,adjacent=false;
      for(let dy=0;dy<size;dy++)for(let dx=0;dx<size;dx++){
        const x=col+dx,y=row+dy;if(this.isFarmTile(x,y)){valid=false;continue;}cells.push({col:x,row:y});
        if(this.isFarmTile(x-1,y)||this.isFarmTile(x+1,y)||this.isFarmTile(x,y-1)||this.isFarmTile(x,y+1))adjacent=true;
      }
      if(valid&&adjacent)return cells;
    }
    return null;
  }
  private get landExpansionCount():number{return this.landExpansionCountValue;}
  private nextLandExpansion(size:1|2|3|4):{size:number;level:number;cost:number;cells:Array<{col:number;row:number}>}|null {
    const count=this.landExpansionCount;
    const baseLevel=({1:3,2:5,3:14,4:24} as Record<number,number>)[size];
    const baseCost=({1:350,2:950,3:2600,4:5200} as Record<number,number>)[size];
    const stepCost=({1:180,2:320,3:650,4:1100} as Record<number,number>)[size];
    const level=baseLevel+count*2,cost=baseCost+count*stepCost,cells=this.findLandExpansion(size);
    return cells?{size,level,cost,cells}:null;
  }
  private expandLand(size:1|2|3|4):void {
    const expansion=this.nextLandExpansion(size);if(!expansion||this.farmerLevel<expansion.level||this.coins<expansion.cost)return;
    this.coins-=expansion.cost;expansion.cells.forEach(cell=>this.landTiles.add(this.key(cell.col,cell.row)));this.landExpansionCountValue++;
    this.redrawFarmTiles();this.drawScenery();this.renderFruitTreeBadges();this.fitFarmToViewport();
    this.playLandClearingAnimation(expansion.cells);
    this.saveFarm();this.refreshHud();this.renderMarket('buildings');
    this.toast(`Land cleared! ${expansion.size} × ${expansion.size} new farmland unlocked.`);
  }

  /**
   * A short staggered clearing effect on newly purchased tiles: an earthy
   * reveal fades into the new grass while dust and leaves drift away.
   * All effects are temporary display objects and never enter the save data.
   */
  private playLandClearingAnimation(cells:Array<{col:number;row:number}>):void {
    cells.forEach((cell,index)=>{
      const point=this.toWorld(cell.col,cell.row),delay=index*65;
      const reveal=this.add.graphics().setDepth(12000+cell.row);
      reveal.fillStyle(0x98734a,0.78);
      reveal.lineStyle(2,0xf4d58a,0.95);
      reveal.beginPath();
      reveal.moveTo(point.x,point.y-TILE_H/2+2);
      reveal.lineTo(point.x+TILE_W/2-2,point.y);
      reveal.lineTo(point.x,point.y+TILE_H/2-2);
      reveal.lineTo(point.x-TILE_W/2+2,point.y);
      reveal.closePath();reveal.fillPath();reveal.strokePath();
      this.tweens.add({targets:reveal,alpha:0,duration:520,delay,ease:'Quad.easeOut',onComplete:()=>reveal.destroy()});

      // Dust puffs rise and disperse from the parcel as the soil is revealed.
      for(let puff=0;puff<3;puff++){
        const dust=this.add.ellipse(point.x+(puff-1)*13,point.y-3,14+puff*3,8+puff*2,0xe8d6b1,0.72).setDepth(13000+cell.row);
        this.tweens.add({targets:dust,x:dust.x+(puff-1)*12,y:dust.y-19-puff*3,alpha:0,scaleX:1.9,scaleY:1.7,duration:620+puff*80,delay:delay+puff*55,ease:'Sine.easeOut',onComplete:()=>dust.destroy()});
      }

      // A few small leaves drift outward, giving the edge a forest-clearing feel.
      for(let leaf=0;leaf<3;leaf++){
        const angle=(leaf/3)*Math.PI*2+(index%3)*0.35;
        const startX=point.x+Math.cos(angle)*12,startY=point.y+Math.sin(angle)*7;
        const foliage=this.add.ellipse(startX,startY,8,4,leaf===1?0x83ad48:0x6e963e,0.95).setDepth(13500+cell.row).setRotation(angle);
        this.tweens.add({targets:foliage,x:startX+Math.cos(angle)*25,y:startY+Math.sin(angle)*18-12,angle:foliage.angle+160,alpha:0,scale:0.45,duration:780,delay:delay+leaf*45,ease:'Sine.easeOut',onComplete:()=>foliage.destroy()});
      }
    });
  }
  // Crop-field capacity grows with farmer level and purchased land, so expansions create usable growing space too.
  private get plowLimit():number {
    const levelSlots=8+Math.max(0,Math.floor((this.farmerLevel-10)/3));
    const landSlots=Math.floor(Math.max(0,this.landTiles.size-INITIAL_FARM_SIZE*INITIAL_FARM_SIZE)/4);
    return Math.min(100,levelSlots+landSlots);
  }
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
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS || !this.isFarmTile(col,row)) return null;
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
    for(let row=0;row<MAX_FARM_SIZE;row++)for(let col=0;col<MAX_FARM_SIZE;col++){
      if(!this.isFarmTile(col,row))continue;
      const point=this.toWorld(col,row),shades=[0x9bcf69,0xa5d875,0x94c762,0xaedb7d,0x9fce70,0x98c96b,0xb0d77a],shade=shades[(col*7+row*11)%shades.length]??0x9bcf69;
      // A soft contact shadow gives each isometric grass tile a little lift from the woodland floor.
      this.plotGraphics.fillStyle(0x426d37,0.12);this.plotGraphics.fillEllipse(point.x+1,point.y+5,TILE_W*0.88,TILE_H*0.58);
      this.diamond(this.plotGraphics,point.x,point.y,shade,0x78ae54);
      // Fine sunlit grass strokes and darker turf flecks keep the field from reading as a flat grid.
      this.plotGraphics.lineStyle(1,0xd8ef9e,0.3);this.plotGraphics.beginPath();this.plotGraphics.moveTo(point.x-27,point.y-1);this.plotGraphics.lineTo(point.x,point.y-17);this.plotGraphics.lineTo(point.x+24,point.y-1);this.plotGraphics.strokePath();
      const detail=(col*17+row*29)%7;
      this.plotGraphics.fillStyle(0x5f9846,0.24);this.plotGraphics.fillEllipse(point.x-17+detail*2,point.y+1,5,2.5);this.plotGraphics.fillEllipse(point.x+9-detail,point.y-5,4,2);
      if((col*3+row*5)%7===0)this.drawGrassTuft(point.x-9,point.y+1);
      if((col*5+row*3)%19===0){this.plotGraphics.fillStyle(0x4f8b40,0.92);this.plotGraphics.fillEllipse(point.x+13,point.y+3,5,3);this.plotGraphics.fillEllipse(point.x+17,point.y,4,3);}
      if((col*13+row*7)%23===0){const fx=point.x-12,fy=point.y-3;this.plotGraphics.fillStyle(0xf4d77b,0.95);this.plotGraphics.fillCircle(fx,fy,1.7);this.plotGraphics.fillStyle(0xffffff,0.9);this.plotGraphics.fillCircle(fx+2,fy-1,1.2);}
      const plot=this.plots.get(this.key(col,row));if(plot&&plot.state!=='grass')this.redrawPlot(plot);
    }
    this.drawFarmBoundary();
    this.drawLandExpansionPreview();
    this.drawFlowerPatches();
  }

  /**
   * Softens the playable-land outline with tufts, tiny stones and a shaded
   * grass fringe. The edge is derived from unlocked neighbours, so it
   * naturally follows every land expansion rather than assuming a square.
   */
  private drawFarmBoundary():void {
    const g=this.plotGraphics;
    const edges=[
      {dc:-1,dr:0,dx:-TILE_W/4,dy:-TILE_H/4},
      {dc:1,dr:0,dx:TILE_W/4,dy:TILE_H/4},
      {dc:0,dr:-1,dx:TILE_W/4,dy:-TILE_H/4},
      {dc:0,dr:1,dx:-TILE_W/4,dy:TILE_H/4}
    ];
    for(let row=0;row<MAX_FARM_SIZE;row++)for(let col=0;col<MAX_FARM_SIZE;col++){
      if(!this.isFarmTile(col,row))continue;
      const p=this.toWorld(col,row);
      edges.forEach((edge,index)=>{
        if(this.isFarmTile(col+edge.dc,row+edge.dr))return;
        const x=p.x+edge.dx*1.55,y=p.y+edge.dy*1.55;
        // A low, irregular fringe breaks the hard edge of the isometric tiles.
        g.fillStyle(0x416d35,0.22);g.fillEllipse(x,y+3,19,6);
        g.fillStyle(0x5b963f,0.95);g.fillEllipse(x-4,y,8,4);g.fillEllipse(x+3,y-2,7,4);
        g.lineStyle(1.4,0x477f38,0.9);g.beginPath();
        g.moveTo(x-2,y+1);g.lineTo(x-5,y-5);
        g.moveTo(x+1,y+1);g.lineTo(x+3,y-6);
        g.moveTo(x+4,y+1);g.lineTo(x+7,y-3);g.strokePath();
        if((col*11+row*7+index*3)%3===0){
          g.fillStyle(0x9b9277,0.9);g.fillEllipse(x+9,y+2,5,3);
          g.fillStyle(0xc0b99d,0.8);g.fillCircle(x+8,y+1,1);
        }
        if((col*5+row*13+index)%4===0){
          g.fillStyle(0xe8d98d,0.95);g.fillCircle(x-8,y-3,1.6);
          g.fillStyle(0xffffff,0.8);g.fillCircle(x-7,y-4,0.8);
        }
      });
    }
  }

  /**
   * Shows the next purchasable land parcel on the actual farm map, similar to
   * FarmVille's golden expansion outline. The preview is intentionally a ghost
   * overlay: it never becomes playable until the player purchases it.
   */
  private drawLandExpansionPreview():void {
    this.landExpansionPreviewLabel?.destroy();
    this.landExpansionPreviewLabel=null;
    const g=this.plotGraphics;

    // Lightly mark every currently reachable expansion tile. This planning grid
    // is visible at every farmer level; only the parcel the player can unlock
    // now receives the stronger gold purchase outline.
    const neighbours=[[-1,0],[1,0],[0,-1],[0,1]] as const;
    for(let row=0;row<MAX_FARM_SIZE;row++)for(let col=0;col<MAX_FARM_SIZE;col++){
      if(this.isFarmTile(col,row))continue;
      const adjacent=neighbours.some(([dc,dr])=>this.isFarmTile(col+dc,row+dr));
      if(!adjacent)continue;
      const p=this.toWorld(col,row);
      g.fillStyle(0xe8f1c9,0.10);
      g.lineStyle(0.9,0xf2e6b9,0.48);
      g.beginPath();g.moveTo(p.x,p.y-TILE_H/2+2);g.lineTo(p.x+TILE_W/2-2,p.y);g.lineTo(p.x,p.y+TILE_H/2-2);g.lineTo(p.x-TILE_W/2+2,p.y);g.closePath();g.fillPath();g.strokePath();
    }

    const preferredSize=this.farmerLevel>=24?4:this.farmerLevel>=14?3:this.farmerLevel>=5?2:1;
    let expansion=this.nextLandExpansion(preferredSize);
    if(!expansion){
      for(let size=preferredSize-1;size>=1&&!expansion;size--)expansion=this.nextLandExpansion(size as 1|2|3);
    }
    // Do not advertise a locked parcel as purchasable. The pale grid above
    // remains visible so players can see where future farm land can extend.
    if(!expansion||this.farmerLevel<expansion.level)return;

    let centerX=0,centerY=0;
    expansion.cells.forEach(cell=>{
      const p=this.toWorld(cell.col,cell.row);centerX+=p.x;centerY+=p.y;
      g.fillStyle(0xffd66b,0.24);g.lineStyle(2.8,0xffd45c,1);
      g.beginPath();g.moveTo(p.x,p.y-TILE_H/2+2);g.lineTo(p.x+TILE_W/2-2,p.y);g.lineTo(p.x,p.y+TILE_H/2-2);g.lineTo(p.x-TILE_W/2+2,p.y);g.closePath();g.fillPath();g.strokePath();
      g.lineStyle(1,0xfff2bd,0.85);g.beginPath();g.moveTo(p.x-15,p.y);g.lineTo(p.x+15,p.y);g.strokePath();
    });
    centerX/=expansion.cells.length;centerY/=expansion.cells.length;
    const label='🗺️ '+expansion.size+' × '+expansion.size+' LAND\n🪙 '+expansion.cost+' COINS';
    const badge=this.add.text(centerX,centerY-TILE_H*0.72,label,{
      fontFamily:'Arial',fontSize:expansion.size>=3?'12px':'11px',fontStyle:'bold',
      color:'#fff8dc',align:'center',lineSpacing:2,
      backgroundColor:'#876022',padding:{x:8,y:6},stroke:'#fff0b8',strokeThickness:1
    }).setOrigin(0.5).setDepth(24000);
    badge.setInteractive({useHandCursor:true});
    badge.on('pointerdown',()=>{this.openMarket();this.renderMarket('buildings');document.querySelectorAll<HTMLButtonElement>('[data-market-tab]').forEach(tab=>tab.classList.toggle('active',tab.dataset.marketTab==='buildings'));});
    this.tweens.add({targets:badge,y:badge.y-3,duration:1100,ease:'Sine.inOut',yoyo:true,repeat:-1});
    this.landExpansionPreviewLabel=badge;
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


  private fruitKind(id:string):'apples'|'pears'|'cherries'|'oranges'|null {
    const asset=this.decorAssetForId(id)||'';
    if(id.startsWith('appleTree')||asset.startsWith('apple_tree'))return 'apples';
    if(id.startsWith('pearTree')||id.startsWith('decor_pear_tree')||asset==='pear_tree')return 'pears';
    if(id.startsWith('cherryTree')||asset.startsWith('pink_blossom_tree'))return 'cherries';
    if(asset.startsWith('orange_fruit_tree')||asset.startsWith('orange_tree')||id.startsWith('decor_orange_fruit_tree')||id.startsWith('decor_orange_tree'))return 'oranges';
    return null;
  }
  private fruitConfig(kind:'apples'|'pears'|'cherries'|'oranges'):{emoji:string;name:string;interval:number} {
    if(kind==='apples')return {emoji:'🍎',name:'Apple',interval:4*60*60*1000};
    if(kind==='pears')return {emoji:'🍐',name:'Pear',interval:6*60*60*1000};
    if(kind==='oranges')return {emoji:'🍊',name:'Orange',interval:5*60*60*1000};
    return {emoji:'🍒',name:'Cherry',interval:3*60*60*1000};
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
      const badge=this.add.text(p.x,p.y-104,'',{fontFamily:'Arial',fontSize:'15px',fontStyle:'bold',color:'#fff7cf',backgroundColor:'#315b2b',padding:{x:7,y:4},stroke:'#203d1f',strokeThickness:2}).setOrigin(.5).setDepth(20000);
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
      const remaining=this.fruitTreeReadyAt[id]!-now;const badge=this.fruitTreeBadges[id];if(!badge)return;const treePos=this.decor[id]!;const treeWorld=this.toWorld(treePos.col,treePos.row);badge.setPosition(treeWorld.x,treeWorld.y-104);
      if(remaining<=0){badge.setText(this.fruitConfig(kind).emoji+' Collect').setVisible(true).setBackgroundColor('#397b27');}
      else {badge.setVisible(false);}
    });
    if(changed)this.saveFarm();
  }
  private harvestFruitTree(id:string):void {
    if (sessionStorage.getItem('happyFarmVisitorModeV1')) return;
    const kind=this.fruitKind(id);if(!kind)return;
    const readyAt=this.fruitTreeReadyAt[id]||0;const cfg=this.fruitConfig(kind);
    if(Date.now()<readyAt){const remaining=readyAt-Date.now();const mins=Math.floor(remaining/60000),secs=Math.ceil((remaining%60000)/1000);this.toast(cfg.name+' tree is growing fruit · '+mins+':'+String(secs).padStart(2,'0')+' remaining.');return;}
    this.fruitInventory[kind]+=1;playSfx('harvest');this.fruitTreeReadyAt[id]=Date.now()+cfg.interval;
    const reward=kind==='apples'?55:kind==='pears'?65:kind==='oranges'?60:75;
    const treePos=this.toWorld(this.decor[id]!.col,this.decor[id]!.row);
    this.showHarvestReward(treePos.x,treePos.y-72,reward);
    this.saveFarm();this.refreshHud();this.updateFruitTrees();
    this.toast('Harvested 1 '+cfg.name+' · sell value '+reward+' coins · next fruit in '+Math.round(cfg.interval/60000)+' minutes.');
  }

  private decorDisplayName(asset:string):string {
    // Names were checked against the actual PNG artwork, not inferred from file slugs.
    const names:Record<string,string>={
      apple_barrels_crate:'Hay Wagon',apple_barrels_crate_sheet2:'Hay Wagon (Alternate)',apple_barrels_variant:'Apple Barrel Display',
      apple_tree:'Apple Tree',apple_tree_sheet1:'Apple Tree (Alternate)',apple_tree_variant:'Sunflower Wagon',apple_tree_variant2:'Wisteria Tree',apple_tree_variant_sheet2:'Sunflower Wagon (Alternate)',
      bird_bath:'Bluebird Birdbath',bird_bath_sheet1:'Bluebird Birdbath (Alternate)',bird_bath_stone:'Apple Barrel Display',bird_bath_stone_sheet2:'Apple Barrel Display (Alternate)',bird_bath_variant:'Picnic Table',
      birdhouse_post:'Garden Birdhouse',birdhouse_post_sheet1:'Garden Birdhouse (Alternate)',birdhouse_post_variant:'Flowering Birdhouse',birdhouse_post_variant2:'Wooden Park Bench',
      campfire_circle:'Stone Campfire',campfire_stumps:'Farm Market Stall',campfire_stumps_sheet2:'Farm Market Stall (Alternate)',campfire_variant:'Flower Market Cart',
      cushioned_swing:'Garden Birdhouse',double_lantern_post:'Farm Direction Sign',
      evergreen_tree:'Pine Tree',evergreen_tree_sheet1:'Pine Tree (Alternate)',evergreen_tree_variant:'Golden Autumn Tree',evergreen_tree_variant_sheet2:'Golden Autumn Tree (Alternate)',
      farm_direction_sign:'Scarecrow',farm_signpost:'Wooden Direction Sign',farm_signpost_sheet1:'Wooden Direction Sign (Alternate)',
      festival_bunting:'Apple Tree',festival_bunting_sheet2:'Apple Tree (Alternate)',firewood_stack:'Firewood Stack',
      flower_arch_bench:'Flower Arch Bench',flower_arch_bench_sheet1:'Flower Arch Bench (Alternate)',flower_arch_bench_variant:'Flower Garden Arch',
      flower_archway:'Flower Archway',flower_archway_sheet2:'Flower Archway (Alternate)',flower_cart:'Hay Bales',flower_cart_sheet2:'Hay Bales (Alternate)',flower_cart_variant:'Wooden Windmill',
      flower_fountain:'Flower Fountain',flower_gate_arch:'Flower Gate Arch',flower_gate_arch_sheet1:'Flower Gate Arch (Alternate)',flower_gate_arch_sheet3:'Flower Gate Entrance',
      flower_market_cart:'Flower Market Cart',hollow_log_planter_sheet1:'Hollow Log Flower Planter',lamp_post_flower:'Flowering Lamp Post',
      large_stone_fountain:'Large Stone Fountain',large_stone_fountain_sheet2:'Large Stone Fountain (Alternate)',lavender_bush:'Lavender Hedge',lavender_bush_sheet2:'Lavender Hedge (Alternate)',
      lily_pond:'Picnic Table by the Pond',lily_pond_reeds:'Lily Pond',lily_pond_sheet2:'Picnic Table by the Pond (Alternate)',
      mossy_rock_cluster:'Mossy Rock Cluster',mossy_rock_cluster_sheet2:'Mossy Rock Cluster (Alternate)',mossy_rock_variant:'Mossy Rock',
      mossy_rocks:'Flowering Rock Cluster',mossy_rocks_sheet1:'Flowering Rock Cluster (Alternate)',mossy_rocks_variant2:'Stone Campfire',
      orange_blossom_tree:'Lily Pond',orange_blossom_tree_sheet2:'Lily Pond (Alternate)',orange_fruit_tree:'Pink Blossom Tree',orange_fruit_tree_sheet2:'Pink Blossom Tree (Alternate)',orange_tree_variant2:'Green Fruit Tree',
      ornate_lamp_post:'Ornate Lamp Post',ornate_lamp_post_sheet2:'Ornate Lamp Post (Alternate)',park_bench_variant:'Flower Cart',
      pear_tree:'Pear Tree',picket_fence_flower:'Flowering Picket Fence',picnic_table:'Picnic Table',picnic_table_sheet2:'Picnic Table (Alternate)',picnic_table_variant:'Tiered Fountain',picnic_table_variant2:'Purple Flower Planter',
      pine_tree_variant:'Hay Bales',pink_blossom_tree:'Pink Blossom Tree',pink_blossom_tree_sheet1:'Pink Blossom Tree (Alternate)',pink_blossom_tree_variant:'Lily Pond',pink_blossom_tree_variant2:'Orange Tree',pink_blossom_tree_variant_sheet2:'Garden Pond',
      pink_flower_bush:'Pink Flower Bush',pink_flower_bush_sheet2:'Pink Flower Bush (Alternate)',pink_flower_bush_variant:'Pink Flower Border',
      pink_flower_hedge:'Pink Flower Hedge',pink_flower_hedge_sheet1:'Pink Flower Hedge (Alternate)',purple_flower_bush:'Purple Lavender Bush',purple_flower_bush_sheet2:'Purple Lavender Bush (Alternate)',purple_flower_hedge:'Purple Flower Hedge',purple_flower_hedge_sheet1:'Purple Flower Hedge (Alternate)',purple_flower_pot:'Purple Flower Pot',
      red_hand_pump:'Red Hand Water Pump',red_roof_gazebo:'Red Roof Gazebo',red_roof_well:'Red Roof Well',red_roof_well_sheet1:'Red Roof Well (Alternate)',red_roof_well_variant:'Stone Birdbath',red_roof_well_variant2:'Red Roof Well with Flowers',red_roof_well_variant_sheet2:'Rock Flowerbed',
      rock_cluster:'Pink Flowerbed',rock_cluster_sheet2:'Pink Flowerbed (Alternate)',rock_flowerbed:'Flowering Rock Garden',rooster_signpost:'Rooster Direction Sign',rooster_signpost_sheet2:'Rooster Direction Sign (Alternate)',rope_fence:'Rope Fence',
      rose_bush:'Stepping Stone Path',rose_bush_sheet2:'Stepping Stone Path (Alternate)',round_flowerbed:'Round Flowerbed',scarecrow:'Scarecrow',scarecrow_variant:'Wisteria Garden Swing',small_green_tree:'Firewood Logs',
      stepping_stone_path:'Pine Tree',stepping_stone_path_sheet2:'Pine Tree (Alternate)',stone_birdbath:'Stone Birdbath',stone_lamp_wall:'Stone Wall with Lanterns',stone_wall:'Stone Wall',stone_wall_lamp:'Stone Wall Lantern Section',stone_wall_sheet1:'Stone Wall (Alternate)',stone_well_variant:'Red Roof Well',
      string_lights:'Apple Tree',string_lights_sheet2:'Apple Tree (Alternate)',sunflower_cart:'Campfire with Stumps',sunflower_cart_sheet2:'Campfire with Stumps (Alternate)',sunflower_cart_variant:'Sunflower Wagon',sunflower_cart_variant_sheet4:'Flowering Rock Cluster',
      tiered_fountain_variant:'Sunflower Flower Cart',tiered_stone_fountain:'Tiered Stone Fountain',tiered_stone_fountain_sheet1:'Tiered Stone Fountain (Alternate)',waterfall_pond:'Garden Swing',waterfall_pond_sheet2:'Garden Swing (Alternate)',
      white_blossom_tree:'Mossy Rock Garden',white_picket_fence:'White Picket Fence',white_picket_fence_flowers:'Flowering White Picket Fence',white_picket_fence_flowers_sheet2:'Flowering White Picket Fence (Alternate)',white_picket_fence_sheet1:'White Picket Fence (Alternate)',white_picket_fence_sheet4:'White Picket Fence with Flowers',
      wisteria_garden_arch:'Stepping Stone Garden Path',wisteria_swing:'Flower Cart',wisteria_swing_bench:'Wisteria Swing Bench',wisteria_swing_sheet2:'Flower Cart (Alternate)',wisteria_tree:'Leafy Green Tree',wisteria_trellis:'Orange Fruit Tree',
      wooden_bridge:'Wooden Bridge',wooden_farm_gate:'Wooden Farm Gate',wooden_fence:'Wooden Fence',wooden_fence_sheet1:'Wooden Fence (Alternate)',wooden_park_bench:'Wooden Park Bench',wooden_park_bench_sheet2:'Wooden Park Bench (Alternate)',
      wooden_windmill:'Wooden Windmill',wooden_windmill_sheet1:'Wooden Windmill (Alternate)',wooden_windmill_variant:'Windmill with Flower Cart',wooden_windmill_variant2:'Flowering Windmill Base',
      yellow_flower_bush:'Yellow Rose Bush',yellow_flower_bush_sheet2:'Yellow Rose Bush (Alternate)',yellow_flower_hedge:'Yellow Flower Hedge',yellow_flower_hedge_sheet1:'Yellow Flower Hedge (Alternate)'
    };
    return names[asset]||asset.split('_').filter(w=>!/^sheet\d*$/i.test(w)&&!/^variant\d*$/i.test(w)).map(w=>w[0]?.toUpperCase()+w.slice(1)).join(' ');
  }

  private decorAssetForId(id:string):string|null {
    if(['farmhouse','barn','coop','silo','bakery','greenhouse','windmill','stable','well','workshop','waterTower'].includes(id))return null;
    if(id.startsWith('appleTree'))return 'apple_tree';
    if(id.startsWith('pearTree')||id.startsWith('decor_pear_tree'))return 'wisteria_tree';
    if(id.startsWith('cherryTree'))return 'pink_blossom_tree';
    if(id.startsWith('flowerbed'))return 'round_flowerbed';
    if(id.startsWith('fountain'))return 'tiered_stone_fountain';
    if(id.startsWith('scarecrow'))return 'scarecrow';
    if(id.startsWith('bench'))return 'wooden_park_bench';
    if(id.startsWith('mangoTree')||id.startsWith('mango_tree'))return 'wisteria_tree';
    if(id.startsWith('pineTree')||id.startsWith('pine_tree'))return 'pine_tree_variant';
    if(id.startsWith('tree'))return 'evergreen_tree';
    if(id.startsWith('decor_')){const slug=id.slice(6).replace(/[0-9]+$/,'');return DECOR_ASSET_ALIASES[slug]||slug;}
    return null;
  }

  private renderDecorAssets():void {
    this.decorAssetSprites.forEach(sprite=>sprite.destroy());
    this.decorAssetSprites.clear();
    this.decorAssetShadows.forEach(shadow=>shadow.destroy());
    this.decorAssetShadows.clear();
    Object.entries(this.decor).forEach(([id,pos])=>{
      const asset=this.decorAssetForId(id),texture=asset?'decor-'+asset:'';
      if(!asset||!this.textures.exists(texture))return;
      const p=this.toWorld(pos.col,pos.row);
      const source=this.textures.get(texture).getSourceImage() as HTMLImageElement;
      const slug=asset;
      const tree=/tree|pine|evergreen|blossom/.test(slug);
      const tableOrSeat=/picnic_table|park_bench|wooden_park_bench|bench/.test(slug);
      const tinyProp=/birdhouse|bird_bath|sign|lamp|flower_pot|planter|rock|stone|firewood|hay|crate|barrel|pump|path|fence|hedge|bush|flowerbed|flower_bush|flower_hedge/.test(slug);
      const large=/gazebo|arch|swing|windmill|fountain|well|pond|waterfall|bridge|cart|market|campfire/.test(slug);
      // Use building-relative world sizes: furniture and garden details should
      // occupy only a fraction of a tile, while trees and landmarks can rise above it.
      // Keep the picnic table/benches deliberately compact so they read as furniture.
      const maxW=tree?76:tableOrSeat?42:tinyProp?34:large?82:58;
      const maxH=tree?98:tableOrSeat?28:tinyProp?32:large?70:48;
      const scale=Math.min(maxW/source.width,maxH/source.height);
      const displayW=source.width*scale;
      const shadow=this.add.ellipse(p.x,p.y+1,Math.max(24,displayW*0.66),tree?11:large?15:9,0x34502a,0.22)
        .setDepth(p.y+20);
      const sprite=this.add.image(p.x,p.y+4,texture).setOrigin(0.5,1).setScale(scale).setDepth(p.y+24);
      this.decorAssetShadows.set(id,shadow);
      this.decorAssetSprites.set(id,sprite);
      // A light, asynchronous breeze gives foliage life without moving its ground anchor.
      if(tree){
        this.tweens.add({targets:sprite,angle:1.15,duration:2600+((pos.col*17+pos.row*11)%700),ease:'Sine.inOut',yoyo:true,repeat:-1,delay:(pos.col*190+pos.row*130)%1100});
      }else if(/bush|hedge|flower|lavender/.test(slug)){
        this.tweens.add({targets:sprite,angle:0.65,duration:3200+((pos.col*13+pos.row*7)%900),ease:'Sine.inOut',yoyo:true,repeat:-1,delay:(pos.col*140+pos.row*170)%1300});
      }
    });
  }

  private drawScenery(): void {
    this.sceneryGraphics.forEach(x=>x.destroy()); this.sceneryGraphics=[];
    this.sceneryLabels.forEach(x=>x.destroy()); this.sceneryLabels=[];
    const g=this.add.graphics();this.sceneryGraphics.push(g);
    // Subtle farm-edge flowers remain part of the ground scenery.
    [[-330,145],[-300,165],[315,135],[345,158],[-360,320],[365,330]].forEach(([x,y],i)=>{
      g.fillStyle(0x4d873f,0.85);g.fillEllipse(x!,y!+4,17,7);
      const color=[0xf5a8c5,0xffe18a,0xffffff][i%3]!;
      g.fillStyle(color,1);g.fillCircle(x!,y!,4);g.fillCircle(x!-4,y!+2,3);g.fillCircle(x!+4,y!+2,3);
      g.fillStyle(0xf4c94e,1);g.fillCircle(x!,y!+2,2);
    });
    this.renderDecorAssets();
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
    this.animalActors.forEach(actor=>{this.tweens.killTweensOf(actor);const sprite=this.animalSprites.get(actor);if(sprite)this.tweens.killTweensOf(sprite);actor.destroy();});this.animalActors=[];this.animalSprites.clear();this.animalReservedCells.clear();this.animalTroughs.forEach(t=>t.destroy());this.animalTroughs.clear();this.animalHungryBadges.forEach(b=>b.destroy());this.animalHungryBadges.clear();this.animalProduceBadges.forEach(b=>b.destroy());this.animalProduceBadges.clear();
    // Resolve animal home anchors defensively: older saves may contain animals before
    // their matching building decor has been restored or placed.
    const farmhouse=this.decor.farmhouse||{col:3,row:1};
    const henHome=this.decor.coop||{col:Math.min(COLS-1,farmhouse.col+2),row:farmhouse.row+1};
    const barnHome=this.decor.barn||{col:Math.min(COLS-1,farmhouse.col+3),row:Math.min(ROWS-1,farmhouse.row+3)};
    const cowHome=barnHome;
    this.animals.forEach((animal,index)=>{
      const cow=animal.id==='cow'||animal.id==='calf',baby=this.isBabyAnimal(animal.id);
      const home=cow?cowHome:henHome;
      const homeTile=this.nearestAnimalCell(home);
      if(!homeTile){this.toast('No clear grass tile available for an animal. Move a building or field first.');return;}
      const center=this.toWorld(homeTile.col,homeTile.row);
      if(!this.animalTroughs.has(animal.id))this.createAnimalTrough(animal.id,center.x+(cow?20:17),center.y+12);
      const bounds={width:TILE_W*4,height:TILE_H*4};
      const actor=this.add.container(center.x,center.y);actor.setDepth(center.y+24+index*0.01);
      this.animalReservedCells.add(this.animalCellKey(homeTile));
      // Keep animal sprites at a consistent world scale. The old cow container
      // multiplier (0.275) was applied on top of setDisplaySize and made cows
      // disproportionately tiny beside hens and buildings.
      actor.setScale(1);
      // Adult cows should read only modestly larger than hens in the isometric view;
      // calves remain visibly smaller. Keep sprite dimensions explicit (no container multiplier).
      const growthScale=baby?0.65+Math.min(3,Math.max(0,Number(animal.growthFeedings)||0))/3*0.35:1;
      const animalWidth=(animal.id==='chick'?27:cow?40:27)*growthScale;
      const animalHeight=(animal.id==='chick'?26:cow?28:26)*growthScale;
      actor.add(this.add.ellipse(0,6,cow?(baby?21:31):animal.id==='chick'?17:24,cow?(baby?5:7):6,0x263e25,0.2));
      const texture=animal.id==='chick'?'animal-chick':cow?'animal-cow':'animal-hen';
      if(this.textures.exists(texture)){
        const sprite=this.add.sprite(0,-2,texture).setDisplaySize(animalWidth,animalHeight).setAlpha(1).setVisible(true);
        sprite.setDepth(2);
        actor.add(sprite);
        this.animalSprites.set(actor,sprite);
        if(animal.id==='chick')sprite.play('chick-idle',true);else this.animateAnimalIdle(actor,sprite);
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
    this.updateAnimalHungryIndicators();
  }

  // FarmVille-style resting is genuinely still: hold a single idle frame so no legs cycle.
  private sizeAnimalSprite(actor:Phaser.GameObjects.Container,sprite:Phaser.GameObjects.Sprite,growthScale?:number):void{
    const animal=this.animals[this.animalActors.indexOf(actor)];
    if(!animal)return;
    const cow=animal.id==='cow'||animal.id==='calf',baby=this.isBabyAnimal(animal.id);
    const scale=growthScale??(baby?0.65+Math.min(3,Math.max(0,Number(animal.growthFeedings)||0))/3*0.35:1);
    const width=animal.id==='chick'?27:cow?40:27;
    const height=animal.id==='chick'?26:cow?28:26;
    // Animation frames use large source canvases (the cow frame is 384x256).
    // Reapply display dimensions whenever an animation changes; setScale(1) exposes the full source frame.
    sprite.setDisplaySize(width*scale,height*scale);
  }

  private animateAnimalIdle(actor:Phaser.GameObjects.Container,sprite:Phaser.GameObjects.Sprite):void{
    if(!actor.active||!sprite.active)return;
    this.tweens.killTweensOf(sprite);
    sprite.anims.stop();
    sprite.setAngle(0).setY(-2);
    sprite.setFrame(0);
    this.sizeAnimalSprite(actor,sprite);
    // Breathing is a small multiplier on the intended display scale, not a pixel-scale reset.
    this.tweens.add({targets:sprite,y:-2.7,scaleY:sprite.scaleY*1.025,duration:1500,ease:'Sine.inOut',yoyo:true,repeat:-1});
  }

  private wanderAnimal(actor:Phaser.GameObjects.Container,cx:number,cy:number,limitX:number,limitY:number,cow:boolean):void{
    if(!actor.active)return;
    const sprite=this.animalSprites.get(actor),baseScale=1;
    const current=this.toTile(actor.x,actor.y);
    if(!current)return;
    let destination:{col:number;row:number}|null=null;
    for(let attempt=0;attempt<28;attempt++){
      const candidate={col:current.col+Phaser.Math.Between(-2,2),row:current.row+Phaser.Math.Between(-2,2)};
      if(candidate.col===current.col&&candidate.row===current.row)continue;
      if(candidate.col<0||candidate.row<0||candidate.col>=COLS||candidate.row>=ROWS)continue;
      const point=this.toWorld(candidate.col,candidate.row);
      // Keep hens and chicks roaming around their coop instead of drifting across the whole farm.
      if(Math.abs(point.x-cx)>limitX||Math.abs(point.y-cy)>limitY)continue;
      if(this.animalCellBlocked(candidate,actor))continue;
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
          const isChick=sprite.texture.key==='animal-chick';
          const peck=isChick?'chick-peck':(cow?'cow-eat':'hen-peck');
          sprite.play(peck,true);
          this.time.delayedCall(Phaser.Math.Between(cow?2200:1100,cow?4200:2100),()=>{
            if(!actor.active||!sprite.active)return;
            // Hens occasionally pause to cluck after pecking; chicks keep their shorter peck cycle.
            // Cows occasionally lift their heads and give a cheerful tail-up reaction;
            // hens cluck after pecking, while chicks keep their quick little peck cycle.
            const happyCow=cow&&Math.random()<0.22;
            if(happyCow){sprite.play('cow-happy');this.time.delayedCall(900,()=>{
              if(!actor.active||!sprite.active)return;
              this.animateAnimalIdle(actor,sprite);
              this.time.delayedCall(Phaser.Math.Between(2600,5200),()=>this.wanderAnimal(actor,cx,cy,limitX,limitY,cow));
            });return;}
            const cluck=!cow&&!isChick&&Math.random()<0.32;
            if(cluck){sprite.play('hen-cluck');this.time.delayedCall(650,()=>{
              if(!actor.active||!sprite.active)return;
              this.animateAnimalIdle(actor,sprite);
              this.time.delayedCall(Phaser.Math.Between(2200,4600),()=>this.wanderAnimal(actor,cx,cy,limitX,limitY,cow));
            });return;}
            this.animateAnimalIdle(actor,sprite);
            this.time.delayedCall(Phaser.Math.Between(isChick?1600:2600,isChick?3600:6200),()=>this.wanderAnimal(actor,cx,cy,limitX,limitY,cow));
          });
        }else this.time.delayedCall(3000,()=>this.wanderAnimal(actor,cx,cy,limitX,limitY,cow));
      }
    });
  }

  private createAnimalTrough(kind:AnimalId,x:number,y:number):void{
    const trough=this.add.container(x,y).setDepth(y+18);
    const art=this.add.graphics(),width=kind==='cow'?28:21,height=kind==='cow'?10:8;
    art.fillStyle(0x49301d,0.28);art.fillEllipse(0,7,width+7,6);
    art.fillStyle(0x8b512b,1);art.fillRoundedRect(-width/2,-height/2,width,height,2);
    art.fillStyle(0xc18a4d,1);art.fillRect(-width/2+2,-height/2+2,width-4,height-4);
    art.lineStyle(2,0x633a20,1);art.strokeRoundedRect(-width/2,-height/2,width,height,2);
    art.fillStyle(0x6b9a3e,1);for(let n=-2;n<=2;n++)art.fillEllipse(n*4,-1,5,3);
    art.lineStyle(1,0xd3a06a,0.9);art.lineBetween(-width/2+3,height/2-1,width/2-3,height/2-1);
    trough.add(art);this.animalTroughs.set(kind,trough);
  }
  private animateAnimalTrough(kind:AnimalId):void{
    const trough=this.animalTroughs.get(kind);if(!trough?.active)return;
    const chicken=kind==='hen'||kind==='chick',feedColor=chicken?0xf2b72f:0x82b84b;
    this.tweens.killTweensOf(trough);trough.setScale(1);
    this.tweens.add({targets:trough,scaleX:1.08,scaleY:0.94,duration:150,yoyo:true,repeat:5,ease:'Sine.inOut'});
    for(let i=0;i<7;i++){
      const morsel=this.add.circle(trough.x+Phaser.Math.Between(-11,11),trough.y-2,Phaser.Math.Between(2,4),feedColor,1).setDepth(trough.depth+9);
      this.tweens.add({targets:morsel,x:morsel.x+Phaser.Math.Between(-12,12),y:morsel.y-Phaser.Math.Between(9,22),alpha:0,scale:0.35,duration:Phaser.Math.Between(420,760),delay:i*65,ease:'Cubic.out',onComplete:()=>morsel.destroy()});
    }
    const nibble=this.add.text(trough.x,trough.y-15,chicken?'✦':'✧',{fontSize:'14px',color:chicken?'#ffe18a':'#d8f0a0',stroke:'#5b4727',strokeThickness:2}).setOrigin(.5).setDepth(trough.depth+10);
    this.tweens.add({targets:nibble,y:nibble.y-19,alpha:0,scale:1.35,duration:850,ease:'Sine.out',onComplete:()=>nibble.destroy()});
  }
  private moveAnimalToTrough(actor:Phaser.GameObjects.Container,kind:AnimalId,index:number):void{
    const trough=this.animalTroughs.get(kind);if(!actor.active||!trough?.active)return;
    const cow=kind==='cow'||kind==='calf',baseScale=1,spacing=cow?10:8;
    const offset=(index%3-1)*spacing;
    const targetX=trough.x+offset,targetY=trough.y+(Math.floor(index/3)%2)*7+8;
    const sprite=this.animalSprites.get(actor);
    this.tweens.killTweensOf(actor);
    if(sprite){this.tweens.killTweensOf(sprite);sprite.play(kind==='chick'?'chick-walk':cow?'cow-walk':'hen-walk',true);}
    this.tweens.add({targets:actor,x:targetX,y:targetY,duration:Phaser.Math.Between(450,850),ease:'Sine.inOut',
      onStart:()=>actor.setScale((targetX<actor.x?-1:1)*baseScale,baseScale),
      onUpdate:()=>actor.setDepth(actor.y+this.animalActors.indexOf(actor)),
      onComplete:()=>{if(!actor.active)return;actor.setScale(actor.scaleX<0?-baseScale:baseScale,baseScale);if(sprite){sprite.setAngle(0).setY(-2);sprite.play(kind==='chick'?'chick-peck':cow?'cow-eat':'hen-peck',true);}this.playFeedingAnimation(actor);}
    });
  }
  private playFeedingAnimation(actor:Phaser.GameObjects.Container):void{
    if(!actor.active)return;
    const baseScale=Math.abs(actor.scaleY),sprite=this.animalSprites.get(actor);
    if(sprite){
      this.tweens.killTweensOf(sprite);
      const key=sprite.texture.key,cow=key==='animal-cow'||key==='animal-calf',chick=key==='animal-chick';
      sprite.play(chick?'chick-peck':(cow?'cow-eat':'hen-peck'),true);
      this.tweens.add({targets:sprite,angle:-10,y:4,duration:210,yoyo:true,repeat:5,ease:'Sine.inOut',onComplete:()=>{if(actor.active&&sprite.active){sprite.setAngle(0).setY(-2);this.animateAnimalIdle(actor,sprite);}}});
    }
    this.tweens.add({targets:actor,scaleY:baseScale*0.965,duration:190,yoyo:true,repeat:5,ease:'Sine.inOut',
      onComplete:()=>{
        if(!actor.active)return;
        actor.setScale(actor.scaleX<0?-baseScale:baseScale,baseScale);
        const chicken=sprite?.texture.key==='animal-hen'||sprite?.texture.key==='animal-chick';
        const treat=this.add.text(actor.x,actor.y-27,chicken?'🌽':'🌿',{fontSize:'14px',stroke:'#60452b',strokeThickness:2}).setOrigin(.5).setDepth(actor.depth+10);
        this.tweens.add({targets:treat,y:treat.y-18,alpha:0,scale:1.2,duration:950,ease:'Sine.out',onComplete:()=>treat.destroy()});
      }
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
        const body=this.add.image(p.x,p.y+24,'windmill-body').setOrigin(0.5,1).setScale(scale).setDepth(p.y+24);
        this.buildingAssetSprites.set(id,body);
        // The axle sits at roughly 75% width and 36% height in the prepared body art.
        const axleX=p.x-source.width*scale/2+source.width*0.75*scale;
        const axleY=p.y+24-source.height*scale+source.height*0.36*scale;
        const rotor=this.add.image(axleX,axleY,'windmill-rotor').setOrigin(0.5,0.5).setScale(scale).setDepth(p.y+26);
        this.windmillRotorSprites.set(id,rotor);
        this.tweens.add({targets:rotor,angle:360,duration:9000,repeat:-1,ease:'Linear'});
        continue;
      }
      const texture = `building-${asset.folder}-${level}`;
      if (!this.textures.exists(texture)) continue;
      const source = this.textures.get(texture).getSourceImage() as HTMLImageElement;
      // Well level PNGs are sprite strips: the intended well is the middle band.
      // Cropping to that band prevents neighbouring asset fragments appearing above/below it.
      const wellCropY = source.height * 0.18;
      const wellCropHeight = source.height * 0.64;
      const displayHeight = id === 'well' ? wellCropHeight : source.height;
      const scale = Math.min(132 / source.width, 124 / displayHeight);
      const sprite = this.add.image(p.x, p.y + 24, texture)
        .setOrigin(0.5, id === 'well' ? (wellCropY + wellCropHeight) / source.height : 1)
        .setScale(scale)
        .setDepth(p.y + 30);
      if (id === 'well') sprite.setCrop(0, wellCropY, source.width, wellCropHeight);
      this.buildingAssetSprites.set(id, sprite);
    }
  }

  private touchPositions = new Map<number,{x:number;y:number;startX:number;startY:number}>();
  private touchGesture = false;
  private pinchDistance = 0;

  private handleWorldTap(pointer: Phaser.Input.Pointer): void {
    if (sessionStorage.getItem('happyFarmVisitorModeV1')) return;
    const world=this.cameras.main.getWorldPoint(pointer.x,pointer.y);
    if(this.activeTool==='select'){
      // Ready water appears above the Well and is collected with one click.
      if(this.wellWaterBadge?.active&&Phaser.Math.Distance.Between(world.x,world.y,this.wellWaterBadge.x,this.wellWaterBadge.y)<26){this.collectWellWater();return;}
      // Finished goods can be collected from the floating badge above each production building.
      const productionHit=[...this.productionReadyBadges.entries()].find(([,badge])=>badge.active&&badge.visible&&Phaser.Math.Distance.Between(world.x,world.y,badge.x,badge.y)<28);
      if(productionHit){this.collectProduction(productionHit[0]);return;}
      // Tap the ready egg/milk badge or the coop/shed itself to collect the whole ready batch.
      const buildingHit=[...this.buildingProduceBadges.entries()].find(([id,badge])=>{
        if(!badge.active)return false;
        const pos=this.decor[id];if(!pos)return false;
        const p=this.toWorld(pos.col,pos.row);
        return Phaser.Math.Distance.Between(world.x,world.y,badge.x,badge.y)<28|| (Math.abs(world.x-p.x)<66&&Math.abs(world.y-p.y)<94);
      });
      if(buildingHit){this.collectBuildingProduce(buildingHit[0]);return;}
      // Status symbols are children of their animal containers. Their x/y are local
      // coordinates, so hit-test against the parent actor's world position.
      const hungryHit=[...this.animalHungryBadges.entries()].find(([index,badge])=>{
        const actor=this.animalActors[index];
        if(!badge.active||!actor?.active)return false;
        const badgeWorldX=actor.x+badge.x*actor.scaleX;
        const badgeWorldY=actor.y+badge.y*actor.scaleY;
        return Phaser.Math.Distance.Between(world.x,world.y,badgeWorldX,badgeWorldY)<24;
      });
      if(hungryHit){const animal=this.animals[hungryHit[0]];if(animal)this.feedAnimalAt(hungryHit[0],animal.id);return;}
      // Also allow tapping the animal itself while its hungry bowl is visible.
      const hungryAnimalHit=this.animals.findIndex((animal,index)=>{
        const actor=this.animalActors[index];
        return animal.assigned!==false&&animal.readyAt<=Date.now()&&!!actor?.active&&
          Phaser.Math.Distance.Between(world.x,world.y,actor.x,actor.y)<24;
      });
      if(hungryAnimalHit>=0){this.feedAnimalAt(hungryAnimalHit,this.animals[hungryAnimalHit].id);return;}
      // Water icons are lightweight tap targets above eligible growing crops.
      if(this.waterUnits>0){
        const waterHit=[...this.cropWaterBadges.entries()].find(([key,badge])=>{
          const plot=this.plots.get(key);
          return badge.active&&Phaser.Math.Distance.Between(world.x,world.y,badge.x,badge.y)<20&&plot?.state==='growing'&&!plot.watered;
        });
        if(waterHit){const plot=this.plots.get(waterHit[0]);if(plot){this.waterPlot(plot);return;}}
      }

    }
    // Newly purchased trees/decor remain in hand until the player chooses a valid tile.
    if(this.pendingDecorId){
      const tile=this.toTile(world.x,world.y);
      if(!tile){this.toast('Choose an unlocked farm tile to place this item.');return;}
      this.movingDecor=this.pendingDecorId;this.movingPlotKey=null;this.movingPreviewTile=tile;
      this.movingPreviewValid=this.canPlaceDecor(tile,this.pendingDecorId);this.drawPlacementOverlay();
      if(!this.movingPreviewValid)this.toast('That spot is occupied or outside your farm. Drag to a green tile.');
      return;
    }
    if(this.activeTool==='store'||this.activeTool==='remove'){
      const hit=Object.keys(this.decor).reverse().find(id=>{
        const p=this.toWorld(this.decor[id]!.col,this.decor[id]!.row),dx=Math.abs(world.x-p.x),dy=Math.abs(world.y-p.y);
        const tree=this.fruitKind(id)!==null||/tree|pine/i.test(this.decorAssetForId(id)||'');
        const building=['farmhouse','barn','coop','pen','silo','bakery','greenhouse','windmill','stable','well','workshop','waterTower'].includes(id);
        return tree?(dx<52&&dy<100):building?(dx<72&&dy<112):(dx<48&&dy<58);
      });
      if(!hit){this.toast('Tap a farm item to '+(this.activeTool==='store'?'store':'remove')+' it.');return;}
      if(hit==='farmhouse'){this.toast('Your farmhouse cannot be stored or removed.');return;}
      const itemName=hit.replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase());
      if(this.activeTool==='store'){
        if(!window.confirm('Store '+itemName+' in Inventory?\n\nYou can place it on your farm again later.'))return;
        this.storedDecor.push(hit);delete this.decor[hit];delete this.fruitTreeReadyAt[hit];this.drawScenery();this.renderOwnedAnimals();this.renderFruitTreeBadges();this.saveFarm();this.refreshHud();this.toast(hit+' stored in Inventory. You can place it again anytime.');
      }
      else{
        if(!window.confirm('Are you sure you want to permanently remove '+itemName+'?\n\nThis cannot be undone. Choose Cancel to keep it on your farm.'))return;
        delete this.decor[hit];delete this.fruitTreeReadyAt[hit];this.drawScenery();this.renderOwnedAnimals();this.renderFruitTreeBadges();this.saveFarm();this.refreshHud();this.toast(hit+' removed from your farm permanently.');
      }
      return;
    }
    if(this.activeTool==='move'){
      // toTile() returns the nearest grid centre even when the pointer is outside
      // that cell's diamond. In move mode that can make a tap on a field resolve
      // to a tree anchor one or two cells away. Accept a cell only when the pointer
      // is physically inside its isometric diamond.
      const candidate=this.toTile(world.x,world.y);
      const tile=candidate?(()=>{
        const centre=this.toWorld(candidate.col,candidate.row);
        const inside=Math.abs(world.x-centre.x)/(TILE_W/2)+Math.abs(world.y-centre.y)/(TILE_H/2)<=1;
        return inside?candidate:null;
      })():null;
      const plot=tile?this.plots.get(this.key(tile.col,tile.row)):undefined;
      if(plot&&plot.state!=='grass'){
        this.movingPlotKey=this.key(plot.col,plot.row);this.movingDecor=null;
        this.movingPreviewTile={col:plot.col,row:plot.row};this.movingPreviewValid=true;
        this.drawPlacementOverlay();this.toast('Drag the field to a green grid cell.');return;
      }
      // Decor is selectable only in its own anchor cell. This avoids the old wide
      // canopy hitboxes grabbing a nearby field or object.
      const hit=tile?Object.keys(this.decor).reverse().find(id=>{
        const pos=this.decor[id];
        return !!pos&&pos.col===tile.col&&pos.row===tile.row;
      }):undefined;
      if(hit){
        this.movingDecor=hit;this.movingPlotKey=null;
        const pos=this.decor[hit]!;this.movingPreviewTile={col:pos.col,row:pos.row};
        this.movingPreviewValid=true;this.drawPlacementOverlay();
        this.toast('Drag '+hit+' to a green grid cell.');return;
      }
      this.toast('Tap the centre tile of a field or farm item to move it.');
      return;
    }
    // Prioritise orchard collection badges over the underlying grass/field tile.
    if(this.activeTool==='select'){
      const fruitBadgeHit=Object.entries(this.fruitTreeBadges).find(([,badge])=>badge.active&&badge.visible&&Phaser.Math.Distance.Between(world.x,world.y,badge.x,badge.y)<27);
      if(fruitBadgeHit){this.harvestFruitTree(fruitBadgeHit[0]);return;}
      const fruitTreeHit=Object.keys(this.decor).find(id=>this.fruitKind(id)!==null&&(()=>{
        const p=this.toWorld(this.decor[id]!.col,this.decor[id]!.row);
        return Phaser.Math.Distance.Between(world.x,world.y-38,p.x,p.y-49)<48;
      })());
      if(fruitTreeHit){this.harvestFruitTree(fruitTreeHit);return;}
      const farmhousePos=this.decor.farmhouse;
      if(farmhousePos){
        const p=this.toWorld(farmhousePos.col,farmhousePos.row);
        if(Math.abs(world.x-p.x)<68&&Math.abs(world.y-(p.y-30))<70){this.openInventory();return;}
      }
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
        else if(['growing','ready','withered'].includes(plot.state))this.showCropActionPopup(plot,pointer.x,pointer.y);
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
    const asset=this.decorAssetForId(id)||'';
    if(/gazebo|arch|swing|windmill|fountain|well|pond|waterfall|bridge|cart|market|campfire/.test(asset))return [{dc:0,dr:0},{dc:1,dr:0},{dc:0,dr:1},{dc:1,dr:1}];
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
    if(tile.col<0||tile.row<0||tile.col>=MAX_FARM_SIZE||tile.row>=MAX_FARM_SIZE||!this.isFarmTile(tile.col,tile.row))return true;
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
      if(cell.col<0||cell.row<0||cell.col>=MAX_FARM_SIZE||cell.row>=MAX_FARM_SIZE||!this.isFarmTile(cell.col,cell.row))return false;
      const target=this.plots.get(this.key(cell.col,cell.row));
      if(!target||target.state!=='grass')return false;
      return !this.decorOccupiesCell(cell.col,cell.row,movingId);
    });
  }

  private canMovePlot(sourceKey:string,tile:{col:number;row:number}):boolean {
    const source=this.plots.get(sourceKey),target=this.plots.get(this.key(tile.col,tile.row));
    if(!source||!target||source===target||target.state!=='grass'||!this.isFarmTile(tile.col,tile.row))return false;
    return !this.decorOccupiesCell(tile.col,tile.row);
  }

  private drawPlacementOverlay():void {
    const g=this.placementOverlay;if(!g)return;g.clear();
    if(this.activeTool!=='move'){return;}
    // Show the isometric cell grid only while editing the farm.
    for(let row=0;row<MAX_FARM_SIZE;row++)for(let col=0;col<MAX_FARM_SIZE;col++){
      if(!this.isFarmTile(col,row))continue;
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
          if(this.pendingDecorId===this.movingDecor){
            const placedId=this.pendingDecorId;
            this.decor[placedId]={col:tile.col,row:tile.row};
            this.pendingDecorId=null;
            this.drawScenery();this.renderOwnedAnimals();
            if(this.fruitKind(placedId)){this.initializeFruitTrees();this.renderFruitTreeBadges();}
            this.saveFarm();this.refreshHud();this.toast('Item placed. You can move it anytime with the Move tool.');
            this.activeTool='select';document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.tool==='select'));
          }else if(current&&(current.col!==tile.col||current.row!==tile.row)){
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
      const visitorMode=sessionStorage.getItem('happyFarmVisitorModeV1')!==null;
      if(visitorMode&&!pointer.wasTouch)return;
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
          if(!sessionStorage.getItem('happyFarmVisitorModeV1')&&wasTap&&this.activeTool!=='move')this.handleWorldTap(pointer);
          if(!sessionStorage.getItem('happyFarmVisitorModeV1'))this.finishMovingItem();
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
    const rows=[...Array(MAX_FARM_SIZE)].map((_,i)=>i).filter(row=>!preferLowerFarm||row>=2);
    for(const row of rows){
      for(let col=0;col<MAX_FARM_SIZE;col++){
        if(!this.isFarmTile(col,row))continue;
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
    tip.addEventListener('click',event=>{
      const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-water-plot]');
      if(!button)return;
      const plot=this.cropActionPlot||this.hoveredCropPlot;
      if(!plot||plot.state!=='growing'||plot.watered||this.waterUnits<1)return;
      this.waterPlot(plot);this.showCropActionPopup(plot,this.hoverPointer.x,this.hoverPointer.y);
    });
  }
  private showCropActionPopup(plot:Plot,x:number,y:number):void{
    const tip=this.cropHoverTooltip;if(!tip)return;
    this.cropActionPlot=plot;this.hoveredCropPlot=plot;this.hoverPointer={x,y};
    const crop=CROPS[plot.crop],remaining=Math.max(0,plot.readyAt-Date.now()),totalSeconds=Math.ceil(remaining/1000),hours=Math.floor(totalSeconds/3600),mins=Math.floor((totalSeconds%3600)/60),secs=totalSeconds%60;
    const status=plot.state==='ready'?'Ready to harvest!':plot.state==='withered'?'Withered · Plow to clear':'Harvest in '+(hours>0?hours+'h ':'')+(mins>0?mins+'m ':'')+secs+'s';
    const action=plot.state==='growing'?(plot.watered?'<span>💧 Already watered</span>':this.waterUnits>0?'<button type="button" class="crop-water-action" data-water-plot>💧 Water field · 1</button>':'<span>💧 No water · collect at the Well</span>'):'';
    tip.innerHTML='<strong>'+crop.emoji+' '+crop.name+'</strong><span>'+status+'</span>'+action;
    tip.style.left=Math.max(8,Math.min(this.scale.width-190,x+14))+'px';tip.style.top=Math.max(8,Math.min(this.scale.height-100,y-48))+'px';tip.style.display='flex';tip.style.pointerEvents='auto';
  }
  private updateCropWaterBadges():void{
    const eligible=new Set<string>();
    if(this.waterUnits>0){
      for(const plot of this.plots.values()){
        if(plot.state!=='growing'||plot.watered)continue;
        const key=this.key(plot.col,plot.row),p=this.toWorld(plot.col,plot.row);eligible.add(key);
        let badge=this.cropWaterBadges.get(key);
        if(!badge){
          badge=this.add.text(p.x,p.y-43,'💧',{fontFamily:'Arial',fontSize:'20px',padding:{x:0,y:0},shadow:{offsetX:0,offsetY:1,color:'#214d67',blur:3,fill:true}})
            .setOrigin(.5).setDepth(p.y+45);
          this.cropWaterBadges.set(key,badge);
          this.tweens.add({targets:badge,y:badge.y-3,duration:700,yoyo:true,repeat:-1,ease:'Sine.inOut'});
        }
        badge.setPosition(p.x,p.y-43).setDepth(p.y+45).setVisible(true);
      }
    }
    for(const [key,badge] of this.cropWaterBadges){
      if(!eligible.has(key)){this.tweens.killTweensOf(badge);badge.destroy();this.cropWaterBadges.delete(key);}
    }
  }
  private waterPlot(plot:Plot):void{
    if(plot.state!=='growing'||plot.watered){this.toast(plot.watered?'This field has already been watered.':'Only growing crops can be watered.');return;}
    if(this.waterUnits<1){this.toast('No water available. Collect water from your Well.');return;}
    this.waterUnits-=1;plot.watered=true;this.scheduleGrowth(plot,Math.max(1500,Math.ceil((plot.readyAt-Date.now())/2)));
    this.playWateringEffect(plot);this.redrawPlot(plot);this.updateCropWaterBadges();this.saveFarm();this.refreshHud();this.refreshSelection();this.toast(CROPS[plot.crop].name+' watered · 1 water used · remaining growth time halved.');
  }
  private playWateringEffect(plot:Plot):void {
    const p=this.toWorld(plot.col,plot.row);
    for(let i=0;i<7;i++){
      const drop=this.add.ellipse(p.x+Phaser.Math.Between(-22,22),p.y-28-Phaser.Math.Between(0,12),5,9,0x75d8f2,0.95).setDepth(p.y+18);
      this.tweens.add({targets:drop,x:drop.x+Phaser.Math.Between(-9,9),y:p.y+Phaser.Math.Between(-2,10),alpha:0,scaleX:0.35,scaleY:0.35,duration:480,onComplete:()=>drop.destroy()});
    }
    const splash=this.add.ellipse(p.x,p.y+2,18,5,0x8bdcf0,0.65).setDepth(p.y+17);
    this.tweens.add({targets:splash,scaleX:3.2,scaleY:2.1,alpha:0,duration:520,onComplete:()=>splash.destroy()});
  }

  private updateCropHover(pointer:Phaser.Input.Pointer):void {
    if(!this.cropHoverTooltip)return;
    const world=this.cameras.main.getWorldPoint(pointer.x,pointer.y);
    const fruitTreeHit=Object.keys(this.decor).find(id=>this.fruitKind(id)!==null&&(()=>{
      const p=this.toWorld(this.decor[id]!.col,this.decor[id]!.row);
      return Phaser.Math.Distance.Between(world.x,world.y-38,p.x,p.y-49)<48;
    })());
    if(fruitTreeHit){
      this.hoveredCropPlot=null;this.hoveredFruitTreeId=fruitTreeHit;
      this.hoverPointer={x:pointer.x,y:pointer.y};this.refreshCropHoverTooltip();return;
    }
    this.hoveredFruitTreeId=null;
    const tile=this.toTile(world.x,world.y),plot=tile?this.plots.get(this.key(tile.col,tile.row)):undefined;
    if(!plot||!['growing','ready','withered'].includes(plot.state)){this.hoveredCropPlot=null;this.cropHoverTooltip.style.display='none';return;}
    this.hoveredCropPlot=plot;this.hoverPointer={x:pointer.x,y:pointer.y};this.refreshCropHoverTooltip();
  }
  private refreshCropHoverTooltip():void {
    const tip=this.cropHoverTooltip;if(!tip)return;
    if(this.hoveredFruitTreeId){
      const id=this.hoveredFruitTreeId,kind=this.fruitKind(id),readyAt=this.fruitTreeReadyAt[id]||0;
      if(!kind){this.hoveredFruitTreeId=null;tip.style.display='none';return;}
      const cfg=this.fruitConfig(kind),remaining=readyAt-Date.now();
      let status='Ready to harvest!';
      if(remaining>0){
        const totalSeconds=Math.ceil(remaining/1000),hours=Math.floor(totalSeconds/3600),minutes=Math.floor((totalSeconds%3600)/60),seconds=totalSeconds%60;
        status='Harvest in '+(hours>0?hours+'h ':'')+(minutes>0?minutes+'m ':'')+seconds+'s';
      }
      tip.innerHTML='<strong>'+cfg.emoji+' '+cfg.name+' tree</strong><span>'+status+'</span>';
      tip.style.left=Math.min(this.scale.width-180,this.hoverPointer.x+14)+'px';tip.style.top=Math.max(8,this.hoverPointer.y-48)+'px';tip.style.display='flex';return;
    }
    const plot=this.hoveredCropPlot;if(!plot)return;
    if(!['growing','ready','withered'].includes(plot.state)){tip.style.display='none';this.hoveredCropPlot=null;return;}
    const crop=CROPS[plot.crop];let status='';
    if(plot.state==='ready')status='Ready to harvest!';
    else if(plot.state==='withered')status='Withered · Plow to clear';
    else {const ms=Math.max(0,plot.readyAt-Date.now()),totalSeconds=Math.ceil(ms/1000),hours=Math.floor(totalSeconds/3600),mins=Math.floor((totalSeconds%3600)/60),secs=totalSeconds%60;status='Harvest in '+(hours>0?hours+'h ':'')+(mins>0?mins+'m ':'')+secs+'s';}
    this.cropActionPlot=plot;
    const waterAction=plot.state==='growing'?(plot.watered?'<span>💧 Watered · growth boosted</span>':this.waterUnits>0?'<button type="button" class="crop-water-action" data-water-plot>💧 Water · 1</button>':'<span>💧 No water available</span>'):'';
    tip.innerHTML='<strong>'+crop.emoji+' '+crop.name+'</strong><span>'+status+'</span>'+waterAction;
    tip.style.left=Math.max(8,Math.min(this.scale.width-190,this.hoverPointer.x+14))+'px';tip.style.top=Math.max(8,this.hoverPointer.y-58)+'px';tip.style.display='flex';tip.style.pointerEvents='auto';
  }

  private applyTool(plot: Plot): void {
    // Resolve elapsed crop timers synchronously before handling a click.
    if(plot.state==='growing'&&plot.readyAt>0&&plot.readyAt<=Date.now()){
      plot.state='ready';plot.growth=100;plot.readyAt=0;plot.witherAt=Date.now()+Math.max(300000,CROPS[plot.crop].growMs*2);
      this.growthTimers.get(this.key(plot.col,plot.row))?.remove(false);this.growthTimers.delete(this.key(plot.col,plot.row));this.scheduleWithering(plot);this.redrawPlot(plot);
    }
    switch (this.activeTool) {
      case 'plow':
        if (plot.state === 'grass' && this.establishedFieldCount >= this.plowLimit) {
          const nextLevel=this.farmerLevel<13?13:13+3*(Math.floor((this.farmerLevel-13)/3)+1);
          this.toast('Field limit reached ('+this.plowLimit+'). Next field unlocks at Level '+nextLevel+'.');
          break;
        }
        if (plot.state === 'grass' || plot.state === 'withered') { plot.state = 'tilled'; plot.witherAt = 0; plot.readyAt = 0; plot.growth = 0; playSfx('plow'); }
        break;
      case 'plant':
        if (plot.state === 'tilled') this.sowSelectedPlot();
        break;
      case 'harvest':
        if (plot.state === 'ready') { const crop=CROPS[plot.crop]; const reward=this.toWorld(plot.col,plot.row); plot.state='tilled'; plot.growth=0; plot.readyAt=0; plot.witherAt=0; plot.watered=false; this.growthTimers.get(this.key(plot.col,plot.row))?.remove(false); this.growthTimers.delete(this.key(plot.col,plot.row)); this.harvestedCrops[plot.crop]++; const masteryCount=this.harvestedCrops[plot.crop]; if(masteryCount>0&&masteryCount%10===0){const masteryBonus=25+Math.floor(masteryCount/10)*5;this.coins+=masteryBonus;this.xp+=10;this.toast(crop.name+' mastery Level '+(masteryCount/10)+'! +'+masteryBonus+' coins · +10 XP.');} this.xp+=crop.xp; this.harvests += 1; playSfx('harvest'); this.playHarvestEffect(reward.x,reward.y); this.showHarvestReward(reward.x,reward.y-28,crop.reward); this.toast(`${crop.emoji} ${crop.name} harvested · sell value ${crop.reward} coins · added to Sell inventory`); }
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
      if(plot.state!=='growing'||plot.readyAt>Date.now())return;
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
      if (plot.state === 'growing' && plot.readyAt > 0 && plot.readyAt <= now) {
        // Fallback when a Phaser timer is delayed or missed: elapsed crops become harvestable.
        plot.state='ready';plot.growth=100;plot.readyAt=0;plot.witherAt=now+Math.max(300000,CROPS[plot.crop].growMs*2);
        this.growthTimers.get(this.key(plot.col,plot.row))?.remove(false);this.growthTimers.delete(this.key(plot.col,plot.row));
        this.redrawPlot(plot);this.scheduleWithering(plot);changed=true;
        continue;
      }
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
    // Raised soil ridges and darker furrows give each plot a cultivated, planted-bed look.
    g.lineStyle(2, plot.watered ? 0x986b45 : 0xb78655, 0.88);
    for (let i = -2; i <= 2; i += 1) {
      const yy=p.y+i*5;
      g.beginPath();g.moveTo(p.x-25,yy+1);g.lineTo(p.x-12,yy-1);g.lineTo(p.x+8,yy+1);g.lineTo(p.x+25,yy-1);g.strokePath();
    }
    g.lineStyle(1,0x4f3928,0.28);
    for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(p.x-20,p.y+i*8+3);g.lineTo(p.x+20,p.y+i*8+3);g.strokePath();}
    g.fillStyle(plot.watered?0x557d3d:0x4d3828,plot.watered?0.2:0.24);
    [[-17,-5],[9,-8],[18,5],[-7,8]].forEach(([dx,dy])=>g.fillEllipse(p.x+dx!,p.y+dy!,3,1.6));
    if (plot.crop === 'tomato' && (plot.state === 'growing' || plot.state === 'ready') && this.textures.exists(`crop-tomato-${1}`)) {
      const stage = plot.state === 'ready' ? 5 : Math.min(5, Math.floor(plot.growth / 20) + 1);
      const size=plot.state==='ready'?46:26+stage*4;
      g.fillStyle(0x342a20,0.2);g.fillEllipse(p.x,p.y+5,Math.min(28,size*0.58),5);
      const sprite = this.add.image(p.x, p.y + 9, `crop-tomato-${stage}`);
      // Keep the crop artwork centred within the current isometric field diamond.
      sprite.setOrigin(0.5, 0.88).setDisplaySize(size, size).setDepth(p.y + 24);
      this.tomatoSprites.set(id, sprite);
    } else if (['wheat','carrot','corn','strawberry','pumpkin'].includes(plot.crop) && (plot.state === 'growing' || plot.state === 'ready') && this.textures.exists(`crop-${plot.crop}`)) {
      const stage = plot.state === 'ready' ? 4 : Math.min(4, Math.floor(plot.growth / 20));
      const size=plot.state==='ready'?46:26+stage*5;
      g.fillStyle(0x342a20,0.2);g.fillEllipse(p.x,p.y+5,Math.min(28,size*0.58),5);
      const sprite = this.add.image(p.x, p.y + 9, `crop-${plot.crop}`, stage);
      // Every growth stage shares the centre and baseline of its own soil diamond.
      sprite.setOrigin(0.5, 0.88).setDisplaySize(size, size).setDepth(p.y + 24);
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
    modal?.classList.remove('market-mode','inventory-mode');modal?.classList.add('field-seed-mode','open');modal?.setAttribute('aria-hidden','false');
    const panel=modal?.querySelector<HTMLElement>('.market-window');if(panel){panel.style.left='';panel.style.top='';}
    this.renderFieldSeedPicker();
  }
  private renderFieldSeedPicker():void {
    const host=document.getElementById('market-items');if(!host)return;
    const level=this.farmerLevel,selected=this.selected?this.selected.state:'grass';
    const rows=(Object.entries(CROPS) as Array<[CropId,typeof CROPS[CropId]]>).map(([id,c])=>{
      const locked=level<c.unlockLevel,active=this.selectedCrop===id,harvested=this.harvestedCrops[id],mastery=harvested%10;
      const growSeconds=Math.round(c.growMs/1000),growTime=growSeconds>=3600?Math.floor(growSeconds/3600)+'h '+Math.floor((growSeconds%3600)/60)+'m':growSeconds>=60?Math.floor(growSeconds/60)+'m':growSeconds+' sec';
      return '<article class="market-item field-seed-card '+(active?'chosen':'')+(locked?' locked':'')+'"><div class="market-art">'+c.emoji+'</div><div class="market-copy"><strong>'+c.name+(active?' · Selected':'')+'</strong><div class="seed-stats"><span>⏱ '+growTime+'</span><span>🪙 Sell '+c.reward+'</span><span>🌱 Plant '+c.cost+'</span></div><small>🏅 Mastery '+Math.floor(harvested/10)+' · '+mastery+'/10 to bonus · Harvested '+harvested+'</small>'+(locked?'<small class="seed-unlock">🔒 Unlocks at Level '+c.unlockLevel+'</small>':'')+'</div><button class="market-buy" data-field-seed="'+id+'" '+(locked?'disabled':'')+'>'+(locked?'Locked':active?'Selected':'Select seed')+'</button></article>';
    }).join('');
    host.innerHTML='<section class="inventory-section"><div class="seed-picker-context"><h3>🌱 Field '+(this.selected?(this.selected.col+1)+', '+(this.selected.row+1):'')+' · '+selected+'</h3><p>Select a crop, then tap other ploughed fields to plant the same seed. Coins are charged for each field you sow.</p></div><div class="quest-list seed-picker-grid">'+rows+'</div></section>';
  }

  private sowSelectedPlot():void {
    const plot=this.selected;if(!plot)return;
    const crop=CROPS[this.selectedCrop];if(this.farmerLevel<crop.unlockLevel){this.toast('Reach Level '+crop.unlockLevel+' to unlock '+crop.name+'.');return;}
    if(plot.state!=='tilled'){this.toast('Plow this field before sowing.');return;}
    if(this.coins<crop.cost){this.toast('Not enough coins to plant '+crop.name+'. You need '+crop.cost+' coins.');return;}
    this.coins-=crop.cost;playSfx('plant');
    plot.state='growing';plot.crop=this.selectedCrop;plot.growth=0;plot.watered=false;this.scheduleGrowth(plot,crop.growMs);
    this.redrawPlot(plot);this.saveFarm();this.refreshHud();this.refreshSelection();this.drawSelection();this.toast(crop.name+' sown · '+crop.cost+' coins deducted. The selected seed remains active.');
  }

  private updateToolCursor():void{
    const canvas=this.game.canvas;if(!canvas)return;
    const cursors:Partial<Record<Tool,string>>={
      select:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M5 3 L25 20 L16 21 L12 29 Z" fill="#fff" stroke="#26351f" stroke-width="2" stroke-linejoin="round"/></svg>',
      plow:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M7 27 L23 7" stroke="#8b542c" stroke-width="4" stroke-linecap="round"/><path d="M17 5 L27 9 L22 15 L13 11 Z" fill="#b8c6ce" stroke="#26351f" stroke-width="1.6"/></svg>',
      harvest:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M7 27 L21 12" stroke="#8b542c" stroke-width="4" stroke-linecap="round"/><path d="M20 12 Q29 2 29 12 Q27 22 15 22 Q22 18 20 12Z" fill="#d9e3d1" stroke="#26351f" stroke-width="1.6"/></svg>',
      move:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M16 3 L11 9 H14 V14 H9 V11 L3 16 L9 21 V18 H14 V23 H11 L16 29 L21 23 H18 V18 H23 V21 L29 16 L23 11 V14 H18 V9 H21 Z" fill="#fff" stroke="#26351f" stroke-width="1.7" stroke-linejoin="round"/></svg>'
    };
    const svg=cursors[this.activeTool];
    canvas.style.cursor=svg?'url("data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)+'") 3 3, auto':'default';
  }

  private bindToolbar(): void {
    document.getElementById('tool-sell')?.addEventListener('click',()=>{this.openMarket();document.querySelector<HTMLButtonElement>('[data-market-tab=sell]')?.click();});
    document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(button => {
      button.addEventListener('click', () => {
        this.activeTool = button.dataset.tool as Tool; this.pendingDecorId=null; this.movingDecor=null; this.movingPlotKey=null;this.movingPreviewTile=null;this.movingPreviewValid=false;this.drawPlacementOverlay();
        document.querySelectorAll('[data-tool]').forEach(el => el.classList.remove('active'));
        button.classList.add('active');
        if(this.activeTool==='select'&&this.selected?.state==='tilled')this.openFieldSeedPicker();
        this.refreshSelection();this.updateToolCursor();
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
        return `<option value="${id}" ${locked ? 'disabled' : ''}>${crop.emoji} ${crop.name} · ${locked ? 'Unlock LV ' + crop.unlockLevel : crop.cost + ' coins / field'}</option>`;
      }).join('');
    picker.value = this.selectedCrop;
    const count = document.getElementById('selected-seed-count');
    if (count) count.textContent = `${CROPS[this.selectedCrop].cost} coins / field`;
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
    document.querySelectorAll<HTMLButtonElement>('[data-market-tab]').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('[data-market-tab]').forEach(x=>x.classList.remove('active'));tab.classList.add('active');const cat=tab.dataset.marketTab||'seeds';const intro=document.getElementById('market-intro');if(intro)intro.textContent=cat==='seeds'?'Choose seeds for your next harvest.':cat==='animals'?'Welcome new animals to your farm.':cat==='trees'?'Browse shade trees and fruit trees for your orchard.':cat==='decor'?'Browse flowers, ornaments, paths and other farm decorations.':cat==='buildings'?'Build and upgrade new farm facilities as your farmer levels up.':cat==='sell'?'Sell harvested crops, orchard fruit, animal produce and crafted goods for coins.':'Buy the correct feed for each animal. Feed is required to produce eggs and milk.';this.renderMarket(cat);}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){this.closeMarket();document.getElementById('farm-profile-modal')?.classList.remove('open');document.getElementById('farm-profile-modal')?.setAttribute('aria-hidden','true');}});
    document.getElementById('animal-action')?.addEventListener('click',()=>this.careForAnimals());
     document.getElementById('market-items')?.addEventListener('click',e=>{const target=e.target as HTMLElement;const seed=target.closest<HTMLButtonElement>('[data-field-seed]');if(seed&&!seed.disabled){this.selectedCrop=seed.dataset.fieldSeed as CropId;this.activeTool='plant';document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.tool==='plant'));this.closeMarket();this.refreshCropSelector();this.refreshSelection();this.toast(CROPS[this.selectedCrop].name+' selected. Tap each ploughed field to sow.');}const sell=target.closest<HTMLButtonElement>('[data-sell-item]');if(sell&&!sell.disabled)this.sellInventoryItem(sell.dataset.sellItem||'');if(target.closest('#sell-produce'))this.sellProduce();const quest=target.closest<HTMLButtonElement>('[data-claim-quest]');if(quest)this.claimQuest(quest.dataset.claimQuest||'');const order=target.closest<HTMLButtonElement>('[data-fulfil-order]');if(order)this.fulfilOrder(order.dataset.fulfilOrder||'');const warehouse=target.closest<HTMLButtonElement>('#upgrade-warehouse');if(warehouse){const cost=this.buildings.warehouseLevel*1000;if(this.buildings.warehouseLevel<10&&this.coins>=cost){this.coins-=cost;this.buildings.warehouseLevel++;this.buildingLevels.silo=this.buildings.warehouseLevel;this.saveFarm();this.refreshHud();this.renderInventory();this.toast('Silo upgraded. Egg and milk storage expanded!');}}const toggle=target.closest<HTMLButtonElement>('[data-animal-toggle]');if(toggle){const animal=this.animals[Number(toggle.dataset.animalToggle)];if(animal){animal.assigned=animal.assigned===false;this.saveFarm();this.refreshHud();if(this.activeBuilding==='coop'||this.activeBuilding==='barn')this.renderBuildingPanel(this.activeBuilding);else if(this.activeBuilding)this.renderGenericBuildingPanel(this.activeBuilding);else this.renderInventory();this.toast(animal.assigned?'Animal assigned to production.':'Animal is resting.');}}const action=target.closest<HTMLButtonElement>('[data-building-action]')?.dataset.buildingAction;if(action&&(this.activeBuilding==='coop'||this.activeBuilding==='barn'))this.runBuildingAction(this.activeBuilding,action as 'collect'|'feed');const start=target.closest<HTMLButtonElement>('[data-production-start]')?.dataset.productionStart;if(start&&this.activeBuilding)this.startProduction(this.activeBuilding,start);if(target.closest('#collect-production')&&this.activeBuilding)this.collectProduction(this.activeBuilding);const delivery=target.closest<HTMLButtonElement>('[data-fulfil-crafted]')?.dataset.fulfilCrafted;if(delivery)this.fulfilCraftedOrder(delivery);const compost=target.closest<HTMLButtonElement>('[data-apply-compost]');if(compost)this.applyWorkshopCompost(compost.dataset.applyCompost||'');});
  }
  private careForAnimals(): void { if(!this.animals.length){this.openMarket();document.querySelector<HTMLButtonElement>('[data-market-tab=animals]')?.click();return;}let collected=0,fed=0,waiting=0;for(const kind of ['hen','cow'] as AnimalId[]){const result=this.collectAndFeed(kind);collected+=result.collected;fed+=result.fed;waiting+=result.waiting;}this.saveFarm();this.refreshHud();this.toast('Stored '+collected+' product(s) · fed '+fed+' · waiting for feed: '+waiting+'.');}
  private animalProductionDuration(kind:AnimalId):number{return kind==='hen'?10*60*1000:30*60*1000;}
  private animalFeedType(kind:AnimalId):'hen'|'cow'{return kind==='chick'?'hen':kind==='calf'?'cow':kind;}
  private isBabyAnimal(kind:AnimalId):boolean{return kind==='chick'||kind==='calf';}
  private matureAnimal(index:number):void{const animal=this.animals[index];if(!animal||!this.isBabyAnimal(animal.id))return;animal.id=animal.id==='chick'?'hen':'cow';animal.readyAt=0;animal.growthFeedings=undefined;this.renderOwnedAnimals();this.saveFarm();this.refreshHud();this.toast(animal.id==='hen'?'Your chick has grown into a hen!':'Your calf has grown into a cow!');}
  private productionCapacity(kind:AnimalId):number{return 10+((kind==='hen'?this.buildings.coopLevel:this.buildings.barnLevel)-1)*5+(this.buildings.warehouseLevel-1)*10;}
  private collectAndFeed(kind:AnimalId):{collected:number;fed:number;waiting:number}{let collected=0,fed=0,waiting=0;const now=Date.now();const field=kind==='hen'?'eggs':'milk';for(const animal of this.animals.filter(a=>a.id===kind&&a.assigned!==false)){if(animal.readyAt>0&&animal.readyAt<=now){if(this.produce[field]<this.productionCapacity(kind)){this.produce[field]++;animal.readyAt=0;collected++;}else{waiting++;continue;}}if(animal.readyAt===0){if(this.feed[kind]>0){this.feed[kind]--;animal.readyAt=now+this.animalProductionDuration(kind);fed++;const actor=this.animalActors[this.animals.indexOf(animal)];if(actor)this.moveAnimalToTrough(actor,kind,fed-1);this.animateAnimalTrough(kind);}else waiting++;}}return{collected,fed,waiting};}
  private updateBuildingProduceBadges():void{
    (['coop','barn'] as const).forEach(id=>{
      const kind:AnimalId=id==='coop'?'hen':'cow';
      const ready=this.animals.filter(a=>a.id===kind&&a.assigned!==false&&a.readyAt>0&&a.readyAt<=Date.now()).length;
      const pos=this.decor[id];let badge=this.buildingProduceBadges.get(id);
      if(!pos||ready===0){if(badge){badge.destroy();this.buildingProduceBadges.delete(id);}return;}
      const p=this.toWorld(pos.col,pos.row),label=(id==='coop'?'🥚':'🥛')+(ready>1?' '+ready:'');
      if(!badge){
        badge=this.add.text(p.x,p.y-(id==='coop'?82:88),label,{fontFamily:'Arial',fontSize:'21px',padding:{x:0,y:0},shadow:{offsetX:0,offsetY:2,color:'#3c2c18',blur:4,fill:true}}).setOrigin(.5).setDepth(20000);
        this.buildingProduceBadges.set(id,badge);
        this.tweens.add({targets:badge,y:badge.y-4,duration:700,yoyo:true,repeat:-1,ease:'Sine.inOut'});
      }else if(badge.text!==label)badge.setText(label);
      badge.setPosition(p.x,p.y-(id==='coop'?82:88)).setDepth(20000).setVisible(true);
    });
  }

  private collectBuildingProduce(id:'coop'|'barn'):void{
    const kind:AnimalId=id==='coop'?'hen':'cow',field=id==='coop'?'eggs':'milk';
    const ready=this.animals.map((animal,index)=>({animal,index})).filter(x=>x.animal.id===kind&&x.animal.assigned!==false&&x.animal.readyAt>0&&x.animal.readyAt<=Date.now());
    if(!ready.length)return;
    let collected=0;
    for(const item of ready){
      if(this.produce[field]>=this.productionCapacity(kind))break;
      this.produce[field]++;item.animal.readyAt=0;collected++;
      const actor=this.animalActors[item.index];if(actor)this.animateAnimalCollection(actor,kind);
    }
    if(!collected){this.toast((id==='coop'?'Egg':'Milk')+' storage is full. Sell stored produce before collecting more.');return;}
    playSfx(id==='coop'?'egg':'milk');this.saveFarm();this.refreshHud();this.updateBuildingProduceBadges();this.updateAnimalHungryIndicators();
    if(this.activeBuilding===id)this.renderBuildingPanel(id);
    this.toast('Collected '+collected+' '+(id==='coop'?'egg':'milk')+(collected===1?'':'s')+' from the '+(id==='coop'?'coop':'shed')+'.');
  }

  private updateAnimalHungryIndicators():void{
    const now=Date.now();
    this.animals.forEach((animal,index)=>{
      const actor=this.animalActors[index],active=animal.assigned!==false&&!!actor?.active;
      const baby=this.isBabyAnimal(animal.id),cow=animal.id==='cow'||animal.id==='calf';
      let symbol='💤',hungry=false,status='resting';
      if(active&&animal.readyAt===0){symbol='🥣';hungry=true;status='hungry';}
      else if(active&&animal.readyAt>now){
        if(baby){symbol='🌱';status='growing-'+(animal.growthFeedings||0);}
        else{symbol='⏳';status='producing';}
      }else if(active&&baby){
        symbol='🥣';hungry=true;status='feed-again';
      }else if(active){
        symbol=cow?'🥛':'🥚';status='ready';
      }
      let badge=this.animalHungryBadges.get(index);
      if(!badge){
        // Parent the tiny, transparent symbol to the animal container so it follows
        // every tween/wander frame with no one-second positional update delay.
        badge=this.add.text(0,-25,symbol,{
          fontFamily:'Arial',fontSize:'9px',fontStyle:'bold',color:'#ffffff',
          padding:{x:0,y:0},stroke:'#49331f',strokeThickness:1,
          shadow:{offsetX:0,offsetY:1,color:'#382718',blur:1,fill:true}
        }).setOrigin(.5).setDepth(30);
        actor?.add(badge);
        this.animalHungryBadges.set(index,badge);
      }else{
        const previous=badge.getData('status');
        if(previous!==status){this.tweens.killTweensOf(badge);badge.setData('status',status);}
        badge.setText(symbol).setStyle({backgroundColor:undefined});
      }
      badge.setData('status',status);
      badge.setPosition(0,-25);
      if(hungry&&!this.tweens.isTweening(badge)){
        this.tweens.add({targets:badge,y:-27,duration:700,yoyo:true,repeat:-1,ease:'Sine.inOut'});
      }else if(!hungry&&this.tweens.isTweening(badge)){
        this.tweens.killTweensOf(badge);
        badge.setY(-25);
      }
    });
    for(const [index,badge] of this.animalHungryBadges){
      if(index>=this.animals.length||!this.animalActors[index]?.active){
        this.tweens.killTweensOf(badge);badge.destroy();this.animalHungryBadges.delete(index);
      }
    }
    for(const [index,badge] of this.animalProduceBadges){
      if(index>=this.animals.length||!this.animalActors[index]?.active){badge.destroy();this.animalProduceBadges.delete(index);}
    }
  }
  private feedAnimalAt(index:number,kind:AnimalId):void{
    const animal=this.animals[index],actor=this.animalActors[index];
    if(!animal||animal.id!==kind||animal.assigned===false){this.toast('Select a '+(kind==='hen'||kind==='chick'?'hen or chick':'cow or calf')+' to feed.');return;}
    const feedType=this.animalFeedType(kind);
    if(this.isBabyAnimal(kind)){
      if(animal.readyAt>Date.now()){this.toast('This young animal has been fed. It will need feed again later.');return;}
      if(this.feed[feedType]<=0){this.toast('No '+feedType+' feed in storage. Visit the Market to buy feed.');return;}
      this.feed[feedType]--;playSfx('feed');animal.growthFeedings=(animal.growthFeedings||0)+1;
      animal.readyAt=Date.now()+this.animalProductionDuration(feedType);
      if(actor){this.moveAnimalToTrough(actor,kind,this.animals.slice(0,index).filter(a=>a.id===kind).length);const sprite=this.animalSprites.get(actor);if(sprite)this.sizeAnimalSprite(actor,sprite);}
      this.animateAnimalTrough(kind);
      if(animal.growthFeedings>=3){this.matureAnimal(index);return;}
      this.saveFarm();this.refreshHud();this.updateAnimalHungryIndicators();this.toast((kind==='chick'?'Chick':'Calf')+' fed · '+(3-animal.growthFeedings)+' more feedings to grow.');return;
    }
    if(animal.readyAt>0){this.toast('This animal has already been fed.');return;}
    if(this.feed[feedType]<=0){this.toast('No '+feedType+' feed in storage. Visit the Market to buy feed.');return;}
    this.feed[feedType]--;playSfx('feed');animal.readyAt=Date.now()+this.animalProductionDuration(kind);
    if(actor)this.moveAnimalToTrough(actor,kind,this.animals.slice(0,index).filter(a=>a.id===kind).length);
    this.animateAnimalTrough(kind);this.saveFarm();this.refreshHud();this.updateAnimalHungryIndicators();
    this.toast((kind==='hen'?'Hen':'Cow')+' fed · '+(kind==='hen'?'Egg':'Milk')+' production started.');
    if(this.activeBuilding===(kind==='hen'?'coop':'barn'))this.renderBuildingPanel(kind==='hen'?'coop':'barn');
  }
  private animateAnimalCollection(actor:Phaser.GameObjects.Container,kind:AnimalId):void{
    if(!actor.active)return;
    const sprite=this.animalSprites.get(actor),cow=kind==='cow';
    if(sprite?.active){
      this.tweens.killTweensOf(sprite);
      sprite.play(cow?'cow-happy':'hen-cluck',true);
      this.time.delayedCall(cow?1100:750,()=>{if(actor.active&&sprite.active)this.animateAnimalIdle(actor,sprite);});
    }
    const icon=this.add.text(actor.x,actor.y-28,cow?'🥛':'🥚',{fontFamily:'Arial',fontSize:cow?'20px':'18px'}).setOrigin(.5).setDepth(actor.depth+20);
    this.tweens.add({targets:icon,y:icon.y-30,alpha:0,scale:1.25,duration:1050,ease:'Cubic.easeOut',onComplete:()=>icon.destroy()});
    const sparkle=this.add.circle(actor.x,actor.y-16,5,0xffed9b,0.9).setDepth(actor.depth+19);
    this.tweens.add({targets:sparkle,scale:2.8,alpha:0,duration:520,ease:'Cubic.easeOut',onComplete:()=>sparkle.destroy()});
  }
  private runBuildingAction(id:'coop'|'barn',action:'collect'|'feed'):void{const kind:AnimalId=id==='coop'?'hen':'cow';let collected=0,fed=0,waiting=0;if(action==='collect'){const field=kind==='hen'?'eggs':'milk';for(const animal of this.animals.filter(a=>a.id===kind&&a.assigned!==false&&a.readyAt>0&&a.readyAt<=Date.now())){if(this.produce[field]>=this.productionCapacity(kind))break;this.produce[field]++;animal.readyAt=0;collected++;const actor=this.animalActors[this.animals.indexOf(animal)];if(actor)this.animateAnimalCollection(actor,kind);}}else{for(const animal of this.animals.filter(a=>a.id===kind&&a.assigned!==false&&a.readyAt===0)){if(this.feed[kind]>0){this.feed[kind]--;animal.readyAt=Date.now()+this.animalProductionDuration(kind);fed++;const actor=this.animalActors[this.animals.indexOf(animal)];if(actor)this.moveAnimalToTrough(actor,kind,fed-1);}else waiting++;}}this.saveFarm();this.refreshHud();this.renderBuildingPanel(id);this.toast(action==='collect'?'Collected '+collected+' '+(kind==='hen'?'eggs':'milk')+'.':'Fed '+fed+' animal(s) · '+waiting+' waiting for feed.');}
  private buildingCapacity(id: AnimalId): number { return 2 + ((id==='hen'?this.buildings.coopLevel:this.buildings.barnLevel)-1)*2; }
  private openGenericBuilding(id:BuildingId):void {
    this.activeBuilding=id;const modal=document.getElementById('market-modal');const title=modal?.querySelector('.market-header h2');if(title)title.textContent=id==='silo'?'Grain Silo':id==='bakery'?'Village Bakery':id==='greenhouse'?'Greenhouse':id==='windmill'?'Windmill':id==='stable'?'Horse Stable':id==='well'?'Stone Well':id==='workshop'?'Farm Workshop':'Water Tower';
    modal?.querySelector('.market-tabs')?.classList.add('inventory-hidden');const intro=document.getElementById('market-intro');if(intro)intro.textContent='Upgrade this farm building as you progress.';modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');this.renderGenericBuildingPanel(id);
  }
  private get waterCapacity():number{return this.decor.well?10+Math.max(0,this.buildingLevels.well-1)*5+(this.decor.waterTower?20+Math.max(0,this.buildingLevels.waterTower-1)*10:0):0;}
   private get wellWaterYield():number{return this.decor.well?3+Math.max(0,this.buildingLevels.well-1)*2:0;}
  private updateWellWaterBadge():void{
     const pos=this.decor.well,ready=!!pos&&this.waterUnits<this.waterCapacity&&(!this.waterCollectedAt||Date.now()-this.waterCollectedAt>=30*60*1000);
     if(!ready||!pos){if(this.wellWaterBadge){this.wellWaterBadge.destroy();this.wellWaterBadge=null;}return;}
     const p=this.toWorld(pos.col,pos.row),x=p.x,y=p.y-94;
     if(!this.wellWaterBadge){
       this.wellWaterBadge=this.add.text(x,y,'💧 Collect',{fontFamily:'Arial',fontSize:'15px',fontStyle:'bold',color:'#effaff',backgroundColor:'#2478a6',padding:{x:7,y:4},stroke:'#174765',strokeThickness:2}).setOrigin(.5).setDepth(20000);
       this.wellWaterBadge.setInteractive({useHandCursor:true});
       this.wellWaterBadge.on('pointerdown',(_pointer:any,_x:number,_y:number,event:any)=>{event?.stopPropagation?.();this.collectWellWater();});
       this.tweens.add({targets:this.wellWaterBadge,y:y-4,duration:700,yoyo:true,repeat:-1,ease:'Sine.inOut'});
     }else this.wellWaterBadge.setPosition(x,y).setVisible(true);
   }

   private collectWellWater():void{if(!this.decor.well){this.toast('Build a Stone Well to collect water.');return;}const now=Date.now(),cooldown=30*60*1000;if(this.waterCollectedAt&&now-this.waterCollectedAt<cooldown){const left=Math.ceil((cooldown-(now-this.waterCollectedAt))/60000);this.toast('The Well needs '+left+' more minute(s) to refill.');return;}const gained=Math.min(this.wellWaterYield,this.waterCapacity-this.waterUnits);if(gained<=0){this.toast('Water storage is full.');return;}this.waterUnits+=gained;this.waterCollectedAt=now;this.updateWellWaterBadge();this.saveFarm();this.refreshHud();if(this.activeBuilding==='well')this.renderGenericBuildingPanel('well');this.toast('Collected '+gained+' water from the Well.');}
  private renderGenericBuildingPanel(id:BuildingId):void {
    if(id==='bakery'||id==='greenhouse'||id==='windmill'){this.renderProductionPanel(id);return;}
    if(id==='workshop'){this.renderWorkshopPanel();return;}
    const level=this.buildingLevels[id]||this.buildings.warehouseLevel;const cost=level*350;const names:Record<BuildingId,string>={coop:'Chicken Run',barn:'Cow Pasture',silo:'Grain Silo',bakery:'Village Bakery',greenhouse:'Greenhouse',windmill:'Windmill',stable:'Horse Stable',well:'Stone Well',workshop:'Farm Workshop',waterTower:'Water Tower'};
    const perks:Record<BuildingId,string>={coop:'Expands the chicken run, adding 2 hen spaces and 5 egg storage per level.',barn:'Expands the cow pasture, adding 2 cow spaces and 5 milk storage per level.',silo:'Adds 10 shared animal-product storage spaces per level.',bakery:'A growing production hub for baked-goods recipes.',greenhouse:'A glasshouse for advanced crops and specialist growing.',windmill:'A landmark mill that completes your homestead.',stable:'Unlocks the next chapter of farm companions and stable upgrades.',well:'A reliable water source for your growing homestead.',workshop:'Craft nutrient-rich compost from harvested crops and use it to speed up growing fields.',waterTower:'A landmark water system for your expanded farm.'};
    const host=document.getElementById('market-items');if(!host)return;
    const waterPanel=id==='well'?'<section class="inventory-section"><h3>💧 Water supply</h3><p>Water available: <strong>'+this.waterUnits+' / '+this.waterCapacity+'</strong>. The Well collects '+this.wellWaterYield+' water every 30 minutes at its current level. Each growing field uses 1 water and has its remaining growth time cut in half.</p><button class="market-buy" id="collect-well-water" '+(!this.decor.well||this.waterUnits>=this.waterCapacity|| (this.waterCollectedAt>0&&Date.now()-this.waterCollectedAt<30*60*1000)?'disabled':'')+'>💧 Collect '+this.wellWaterYield+' water</button></section>':id==='waterTower'?'<section class="inventory-section"><h3>💧 Expanded water storage</h3><p>Water Tower adds 20 storage capacity, plus 10 for each upgrade level. Current capacity: '+this.waterCapacity+'.</p></section>':'';
    host.innerHTML=waterPanel+'<section class="inventory-section"><h3>🏗️ '+names[id]+' · Level '+level+'</h3><p>'+perks[id]+'</p><div class="building-levels">'+[1,2,3,4,5].map(n=>'<span class="'+(n<=level?'reached':'')+'">★</span>').join('')+'</div><p>Upgrade cost: '+cost+' coins. Maximum level: 5.</p><button class="market-buy" id="upgrade-generic-building" '+(level>=5||this.coins<cost?'disabled':'')+'>'+(level>=5?'Maximum level reached':'🪙 '+cost+' · Upgrade to Level '+(level+1))+'</button></section>';
    host.querySelector<HTMLButtonElement>('#collect-well-water')?.addEventListener('click',()=>this.collectWellWater());
    host.querySelector<HTMLButtonElement>('#upgrade-generic-building')?.addEventListener('click',()=>{if(level>=5||this.coins<cost)return;this.coins-=cost;if(id==='silo')this.buildings.warehouseLevel++;this.buildingLevels[id]=level+1;this.drawScenery();this.saveFarm();this.refreshHud();this.renderGenericBuildingPanel(id);this.toast(names[id]+' upgraded to Level '+(level+1)+'.');});
  }

  private renderWorkshopPanel():void {
    const host=document.getElementById('market-items');if(!host)return;
    const job=this.productionJobs.workshop,remaining=job?Math.max(0,Math.ceil((job.readyAt-Date.now())/1000)):0,level=this.buildingLevels.workshop||1;
    const ready=!!job&&remaining===0,duration=Math.max(30,Math.round(90*(1-(level-1)*.1)));
    const growing=Array.from(this.plots.entries()).filter(([,p])=>p.state==='growing').sort((a,b)=>a[1].readyAt-b[1].readyAt);
    const fields=growing.map(([key,p])=>'<article class="market-item"><div class="market-copy"><strong>'+CROPS[p.crop].emoji+' '+CROPS[p.crop].name+' · Field '+(p.col+1)+', '+(p.row+1)+'</strong><small>'+Math.max(1,Math.ceil((p.readyAt-Date.now())/60000))+' min remaining</small></div><button class="market-buy" data-apply-compost="'+key+'" '+(this.workshopCompost<=0?'disabled':'')+'>🌿 Apply compost</button></article>').join('');
    const batch=job?'<section class="inventory-section production-active"><div class="production-status-row"><h3>🧪 Compost batch</h3><strong class="'+(ready?'production-ready':'')+'">'+(ready?'Ready to collect':'In production')+'</strong></div><p>🌿 Nutrient-rich compost · '+(ready?'Finished':remaining+'s remaining')+'</p><div class="production-track"><i style="width:'+Math.max(0,Math.min(100,(1-(job.readyAt-Date.now())/(duration*1000))*100))+'%"></i></div><button class="market-buy" id="collect-production" '+(!ready?'disabled':'')+'>Collect 1 compost</button></section>':'<section class="inventory-section"><h3>🧪 Compost recipe</h3><p>Combine 2 Wheat and 1 Carrot. Crafting time: '+duration+' seconds.</p><div class="production-ingredients"><span class="production-ingredient '+(this.inventory.wheat>=2?'available':'missing')+'">🌾 '+this.inventory.wheat+'/2 Wheat</span><span class="production-ingredient '+(this.inventory.carrot>=1?'available':'missing')+'">🥕 '+this.inventory.carrot+'/1 Carrot</span></div><button class="market-buy" data-production-start="compost" '+(this.inventory.wheat<2||this.inventory.carrot<1?'disabled':'')+'>Start compost batch</button></section>';
    host.innerHTML='<section class="inventory-section production-building-heading"><h3>🛠️ Farm Workshop <span class="production-level">Level '+level+'</span></h3><p>Turn harvested crops into nutrient-rich compost. Apply compost to a growing field to reduce its remaining growth time by 20%.</p><div class="building-levels">'+[1,2,3,4,5].map(n=>'<span class="'+(n<=level?'reached':'')+'">★</span>').join('')+'</div></section>'+batch+'<section class="inventory-section"><div class="production-status-row"><h3>🌿 Compost storage</h3><strong>× '+this.workshopCompost+'</strong></div><p>Each compost batch speeds up one growing field by 20% of its remaining time.</p></section><section class="inventory-section"><h3>🌱 Growing fields · Apply compost</h3><div class="quest-list">'+(fields||'<p>No crops are currently growing. Sow a field first, then return here to apply compost.</p>')+'</div></section><section class="inventory-section"><div class="production-status-row"><h3>⬆️ Workshop upgrade</h3><strong>Level '+level+'/5</strong></div><p>Each upgrade reduces crafting time by 10%. Upgrade cost: '+(level*350)+' coins.</p><button class="market-buy" id="upgrade-generic-building" '+(level>=5||this.coins<level*350?'disabled':'')+'>'+(level>=5?'Maximum level reached':'🪙 '+(level*350)+' · Upgrade to Level '+(level+1))+'</button></section>';
    host.querySelector<HTMLButtonElement>('[data-production-start]')?.addEventListener('click',()=>this.startWorkshopProduction('compost'));
    host.querySelector<HTMLButtonElement>('#upgrade-generic-building')?.addEventListener('click',()=>{const cost=level*350;if(level>=5||this.coins<cost)return;this.coins-=cost;this.buildingLevels.workshop=level+1;this.saveFarm();this.refreshHud();this.renderWorkshopPanel();this.toast('Farm Workshop upgraded to Level '+(level+1)+'.');});
  }
  private startWorkshopProduction(recipeId:string):void {
    if(recipeId!=='compost'||this.productionJobs.workshop)return;
    if(this.inventory.wheat<2||this.inventory.carrot<1){this.toast('You need 2 Wheat and 1 Carrot to make compost.');return;}
    this.inventory.wheat-=2;this.inventory.carrot-=1;
    const level=this.buildingLevels.workshop||1,duration=Math.max(30000,90000*(1-(level-1)*.1));
    this.productionJobs.workshop={recipe:'compost',readyAt:Date.now()+duration};
    this.saveFarm();this.refreshHud();this.updateProductionReadyBadges();this.renderWorkshopPanel();this.toast('Compost batch started in the Workshop.');
  }
  private collectWorkshopProduction():void {
    const job=this.productionJobs.workshop;if(!job||job.readyAt>Date.now()||job.recipe!=='compost')return;
    this.workshopCompost++;this.xp+=6;this.productionJobs.workshop=null;
    this.saveFarm();this.refreshHud();this.updateProductionReadyBadges();this.renderWorkshopPanel();this.toast('Collected 1 compost · +6 XP');
  }
  private applyWorkshopCompost(key:string):void {
    const plot=this.plots.get(key);if(!plot||plot.state!=='growing'||this.workshopCompost<=0){this.toast('Compost can only be applied to a growing field.');return;}
    const remaining=Math.max(0,plot.readyAt-Date.now());if(remaining<=0){this.updateCropLifecycle();return;}
    const reduction=Math.max(1000,Math.floor(remaining*.2));this.workshopCompost--;this.scheduleGrowth(plot,Math.max(1000,remaining-reduction));
    plot.growth=Math.min(99,plot.growth+Math.floor((reduction/Math.max(1,CROPS[plot.crop].growMs))*100));
    this.redrawPlot(plot);this.saveFarm();this.refreshHud();this.renderWorkshopPanel();this.toast('Compost applied · crop growth accelerated by 20% of remaining time.');
  }

  private productionRecipes(id:'bakery'|'greenhouse'|'windmill'):Array<{id:string;name:string;icon:string;seconds:number;inputs:Partial<Record<CropId,number>>;goods:Partial<Record<ProductId,number>>;output:ProductId;quantity:number;coins:number;xp:number}> {
    if(id==='windmill')return [{id:'flour',name:'Mill Wheat into Flour',icon:'🌾',seconds:45,inputs:{wheat:2},goods:{},output:'flour',quantity:2,coins:0,xp:5}];
    if(id==='bakery')return [{id:'bread',name:'Bake Fresh Bread',icon:'🍞',seconds:75,inputs:{},goods:{flour:2},output:'bread',quantity:1,coins:0,xp:9},{id:'pastry',name:'Bake Country Pastries',icon:'🥐',seconds:110,inputs:{},goods:{flour:2},output:'pastry',quantity:1,coins:0,xp:13}];
    return [{id:'grapes',name:'Grow Greenhouse Grapes',icon:'🍇',seconds:100,inputs:{strawberry:2},goods:{},output:'grapes',quantity:2,coins:0,xp:11}];
  }
  private productName(id:ProductId):string{return ({flour:'Flour',bread:'Fresh Bread',pastry:'Country Pastries',grapes:'Greenhouse Grapes'} as Record<ProductId,string>)[id];}
  private updateProductionReadyBadges():void {
    (['greenhouse','windmill','bakery','workshop'] as const).forEach(id=>{
      const pos=this.decor[id],job=this.productionJobs[id];
      const ready=!!pos&&!!job&&job.readyAt<=Date.now();
      let badge=this.productionReadyBadges.get(id);
      if(!ready||!pos){
        if(badge){badge.destroy();this.productionReadyBadges.delete(id);}
        return;
      }
      const point=this.toWorld(pos.col,pos.row),label=id==='greenhouse'?'🍇 Collect':id==='windmill'?'🌾 Collect':id==='workshop'?'🌿 Collect':'🍞 Collect';
      if(!badge){
        badge=this.add.text(point.x,point.y-104,label,{fontFamily:'Arial',fontSize:'15px',fontStyle:'bold',color:'#fff9e9',backgroundColor:'#32834b',padding:{x:8,y:5},stroke:'#245b35',strokeThickness:2}).setOrigin(.5).setDepth(20000);
        this.productionReadyBadges.set(id,badge);
        this.tweens.add({targets:badge,y:badge.y-5,duration:700,yoyo:true,repeat:-1,ease:'Sine.inOut'});
      }else badge.setPosition(point.x,point.y-104).setText(label).setVisible(true).setDepth(20000);
    });
  }

  private updateProduction():void {
    if(this.activeBuilding==='bakery'||this.activeBuilding==='greenhouse'||this.activeBuilding==='windmill')this.renderProductionPanel(this.activeBuilding);
    else if(this.activeBuilding==='workshop')this.renderWorkshopPanel();
  }
  private renderProductionPanel(id:'bakery'|'greenhouse'|'windmill'):void {
    const host=document.getElementById('market-items');if(!host)return;
    const level=this.buildingLevels[id],job=this.productionJobs[id],recipes=this.productionRecipes(id),now=Date.now();
    const names={bakery:'Village Bakery',greenhouse:'Greenhouse',windmill:'Windmill'} as const;
    const descriptions={windmill:'Grind harvested wheat into flour. Flour is used by the Bakery.',bakery:'Turn flour into baked goods for farm orders and extra coins.',greenhouse:'Grow premium grapes using strawberries as starter crops.'} as const;
    const formatTime=(seconds:number)=>seconds>=60?Math.floor(seconds/60)+'m '+String(seconds%60).padStart(2,'0')+'s':seconds+'s';
    const cards=recipes.map(r=>{
      const available=Object.entries(r.inputs).every(([key,n])=>this.inventory[key as CropId]>=(n||0))&&Object.entries(r.goods).every(([key,n])=>this.crafted[key as ProductId]>=(n||0));
      const inputs=[...Object.entries(r.inputs).map(([k,n])=>({name:CROPS[k as CropId].name,icon:CROPS[k as CropId].emoji,have:this.inventory[k as CropId],need:n||0})),...Object.entries(r.goods).map(([k,n])=>({name:this.productName(k as ProductId),icon:({flour:'🌾',bread:'🍞',pastry:'🥐',grapes:'🍇'} as Record<ProductId,string>)[k as ProductId],have:this.crafted[k as ProductId],need:n||0}))];
      const duration=Math.max(10,Math.round(r.seconds*(1-(level-1)*.1)));
      const ingredients=inputs.map(item=>'<span class="production-ingredient '+(item.have>=item.need?'available':'missing')+'">'+item.icon+' '+item.have+'/'+item.need+' '+item.name+'</span>').join('');
      return '<article class="market-item production-recipe-card"><div class="market-art">'+r.icon+'</div><div class="market-copy"><strong>'+r.name+'</strong><small>Produces '+r.quantity+' '+this.productName(r.output)+' · '+formatTime(duration)+' · +'+r.xp+' XP</small><div class="production-ingredients">'+ingredients+'</div></div><button class="market-buy" data-production-start="'+r.id+'" '+(job||!available?'disabled':'')+'>'+(job?'Queue busy':available?'Start batch':'Need ingredients')+'</button></article>';
    }).join('');
    const active=job?recipes.find(r=>r.id===job.recipe):null,remaining=job?Math.max(0,Math.ceil((job.readyAt-now)/1000)):0;
    const progress=active&&job?Math.max(0,Math.min(100,(1-(job.readyAt-now)/(Math.max(10000,active.seconds*1000*(1-(level-1)*.1))))*100)):0;
    const jobCard=job&&active?'<section class="inventory-section production-active"><div class="production-status-row"><h3>⏳ Current batch</h3><strong class="'+(remaining===0?'production-ready':'')+'">'+(remaining===0?'Ready to collect':'In production')+'</strong></div><p>'+active.icon+' '+active.name+' <span class="production-countdown">'+(remaining>0?formatTime(remaining):'Finished')+'</span></p><div class="production-track"><i style="width:'+progress+'%"></i></div><button class="market-buy" id="collect-production" '+(remaining>0?'disabled':'')+'>Collect '+active.quantity+' '+this.productName(active.output)+'</button></section>':'<section class="inventory-section production-idle"><h3>🏭 Production queue</h3><p>Choose a recipe below to start a batch. One batch can run at a time; you can leave the farm and return when it is ready.</p></section>';
    const stock=Object.entries(this.inventory).filter(([,n])=>n>0).map(([key,n])=>'<span class="production-stock-chip">'+CROPS[key as CropId].emoji+' '+CROPS[key as CropId].name+' × '+n+'</span>').join('');
    host.innerHTML='<section class="inventory-section production-building-heading"><h3>🏗️ '+names[id]+' <span class="production-level">Level '+level+'</span></h3><p>'+descriptions[id]+'</p><div class="building-levels">'+[1,2,3,4,5].map(n=>'<span class="'+(n<=level?'reached':'')+'">★</span>').join('')+'</div></section>'+jobCard+'<section class="inventory-section"><div class="production-status-row"><h3>📋 Recipes</h3><small>Ingredients are deducted when a batch starts</small></div><div class="quest-list">'+cards+'</div></section><section class="inventory-section"><h3>🌱 Available farm crops</h3><div class="production-stock">'+(stock||'<span class="market-intro">No harvested crops in storage yet.</span>')+'</div></section><section class="inventory-section"><h3>📦 Crafted goods</h3><div class="inventory-grid">'+(['flour','bread','pastry','grapes'] as ProductId[]).map(p=>'<article class="market-item"><div class="market-art">'+({flour:'🌾',bread:'🍞',pastry:'🥐',grapes:'🍇'} as Record<ProductId,string>)[p]+'</div><div class="market-copy"><strong>'+this.productName(p)+'</strong></div><span class="inventory-quantity">× '+this.crafted[p]+'</span></article>').join('')+'</div></section><section class="inventory-section"><div class="production-status-row"><h3>⬆️ Upgrade building</h3><strong>Level '+level+'/5</strong></div><p>Each upgrade reduces production time by 10%. Upgrade cost: '+(level*350)+' coins.</p><button class="market-buy" id="upgrade-generic-building" '+(level>=5||this.coins<level*350?'disabled':'')+'>'+(level>=5?'Maximum level reached':'🪙 '+(level*350)+' · Upgrade to Level '+(level+1))+'</button></section>';
    host.querySelector<HTMLButtonElement>('#upgrade-generic-building')?.addEventListener('click',()=>{const cost=level*350;if(level>=5||this.coins<cost)return;this.coins-=cost;this.buildingLevels[id]=level+1;this.saveFarm();this.refreshHud();this.renderProductionPanel(id);this.toast(names[id]+' upgraded to Level '+(level+1)+'.');});
  }
  private startProduction(id:BuildingId,recipeId:string):void {
    if(id!=='bakery'&&id!=='greenhouse'&&id!=='windmill'&&id!=='workshop')return;
    if(this.productionJobs[id])return;
    if(id==='workshop'){this.startWorkshopProduction(recipeId);return;}
    const recipe=this.productionRecipes(id).find(r=>r.id===recipeId);if(!recipe)return;
    if(!Object.entries(recipe.inputs).every(([k,n])=>this.inventory[k as CropId]>=(n||0))||!Object.entries(recipe.goods).every(([k,n])=>this.crafted[k as ProductId]>=(n||0))){this.toast('Not enough ingredients for this recipe.');return;}
    Object.entries(recipe.inputs).forEach(([k,n])=>this.inventory[k as CropId]-=(n||0));
    Object.entries(recipe.goods).forEach(([k,n])=>this.crafted[k as ProductId]-=(n||0));
    const duration=Math.max(10000,recipe.seconds*1000*(1-(this.buildingLevels[id]-1)*.1));
    this.productionJobs[id]={recipe:recipe.id,readyAt:Date.now()+duration};
    this.saveFarm();this.refreshHud();this.updateProductionReadyBadges();this.renderProductionPanel(id);this.toast(recipe.name+' started.');
  }
  private collectProduction(id:BuildingId):void {
    if(id!=='bakery'&&id!=='greenhouse'&&id!=='windmill'&&id!=='workshop')return;
    const job=this.productionJobs[id];if(!job||job.readyAt>Date.now())return;
    if(id==='workshop'){this.collectWorkshopProduction();return;}
    const recipe=this.productionRecipes(id).find(r=>r.id===job.recipe);if(!recipe)return;
    this.crafted[recipe.output]+=recipe.quantity;this.xp+=recipe.xp;this.productionJobs[id]=null;
    this.saveFarm();this.refreshHud();this.updateProductionReadyBadges();this.renderProductionPanel(id);this.toast('Collected '+recipe.quantity+' '+this.productName(recipe.output)+' · +'+recipe.xp+' XP');
  }
  private fulfilCraftedOrder(id:string):void {
    const orders:Record<string,{product:ProductId;quantity:number;coins:number;xp:number}>={bread:{product:'bread',quantity:1,coins:58,xp:16},pastry:{product:'pastry',quantity:1,coins:86,xp:24},grapes:{product:'grapes',quantity:2,coins:72,xp:20}};
    const order=orders[id];if(!order||this.crafted[order.product]<order.quantity)return;
    this.crafted[order.product]-=order.quantity;this.coins+=order.coins;this.xp+=order.xp;this.ordersCompleted['crafted-'+id]=(this.ordersCompleted['crafted-'+id]||0)+1;
    this.saveFarm();this.refreshHud();this.renderInventory();this.renderSideRail();this.toast('Crafted-goods delivery complete · +'+order.coins+' coins · +'+order.xp+' XP');
  }

  private openBuilding(id: 'coop'|'barn'): void { document.getElementById('market-modal')?.classList.remove('inventory-mode');this.activeBuilding=id; const modal=document.getElementById('market-modal'); const title=modal?.querySelector('.market-header h2'); if(title)title.textContent=id==='coop'?'Chicken Run':'Cow Pasture'; modal?.querySelector('.market-tabs')?.classList.add('inventory-hidden'); const intro=document.getElementById('market-intro'); if(intro)intro.textContent='Manage housing, collect products and keep production moving.'; modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');this.renderBuildingPanel(id); }
  private renderBuildingPanel(id:'coop'|'barn'):void{
    const kind:AnimalId=id==='coop'?'hen':'cow';
    const babyKind:AnimalId=id==='coop'?'chick':'calf';
    const level=id==='coop'?this.buildings.coopLevel:this.buildings.barnLevel;
    const capacity=this.buildingCapacity(kind),storage=this.productionCapacity(kind);
    const field=id==='coop'?'eggs':'milk',feedCount=this.feed[kind];
    const family=this.animals.filter(a=>a.id===kind||a.id===babyKind);
    const adults=this.animals.filter(a=>a.id===kind);
    const young=family.filter(a=>a.id===babyKind).length;
    const now=Date.now();
    const ready=adults.filter(a=>a.assigned!==false&&a.readyAt>0&&a.readyAt<=now).length;
    const producing=adults.filter(a=>a.assigned!==false&&a.readyAt>now).length;
    const hungry=adults.filter(a=>a.assigned!==false&&a.readyAt===0).length;
    const resting=family.filter(a=>a.assigned===false).length;
    const collectable=Math.min(ready,Math.max(0,storage-this.produce[field]));
    const feedable=Math.min(hungry,feedCount);
    const cycle=this.animalProductionDuration(kind);
    const fmt=(ms:number)=>{const s=Math.max(0,Math.ceil(ms/1000));return s>=60?Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s':s+'s';};
    const rows=family.map((a)=>{
      const index=this.animals.indexOf(a),isBaby=a.id===babyKind;
      const remaining=Math.max(0,a.readyAt-now);
      const status=a.assigned===false?'Resting':a.readyAt===0?'Needs feed':remaining>0?(isBaby?'Growing · ':'Producing · ')+fmt(remaining):isBaby?'Ready for next feeding':'Ready to collect';
      const pct=a.assigned===false||a.readyAt===0?0:remaining===0?100:Math.max(0,Math.min(100,(1-remaining/cycle)*100));
      const progressLabel=isBaby?'Growth feedings: '+(a.growthFeedings||0)+'/3':(kind==='hen'?'Egg':'Milk')+' production';
      return '<article class="animal-progress"><div class="production-status-row"><strong>'+(isBaby?(id==='coop'?'🐣 Baby Chick':'🐮 Baby Calf'):(id==='coop'?'🐔 Hen':'🐄 Cow'))+'</strong><span class="production-level">'+status+'</span></div><small>'+progressLabel+'</small><div class="production-track"><i style="width:'+pct+'%"></i></div><button class="market-buy" data-animal-toggle="'+index+'">'+(a.assigned===false?'Assign to production':'Set to rest')+'</button></article>';
    }).join('');
    const cost=level*250,feedName=id==='coop'?'Chicken Feed':'Cow Feed';
    const host=document.getElementById('market-items');if(!host)return;
    host.innerHTML=
      '<section class="inventory-section production-building-heading"><div class="production-status-row"><h3>'+(id==='coop'?'🐔 Chicken Coop':'🐄 Cow Shed')+'</h3><span class="production-level">Level '+level+'/5</span></div><p>Manage your animals, feed stock and '+(id==='coop'?'egg':'milk')+' production from one place.</p><div class="building-levels">'+[1,2,3,4,5].map(n=>'<span class="'+(n<=level?'reached':'')+'">★</span>').join('')+'</div></section>'+
      '<section class="inventory-section"><h3>📊 Farm status</h3><div class="inventory-grid"><article class="market-item"><div class="market-art">🏡</div><div class="market-copy"><strong>'+family.length+' / '+capacity+' spaces</strong><small>'+adults.length+' adult · '+young+' young · '+resting+' resting</small></div></article><article class="market-item"><div class="market-art">'+(id==='coop'?'🥚':'🥛')+'</div><div class="market-copy"><strong>'+this.produce[field]+' / '+storage+' '+field+'</strong><small>'+ready+' ready to collect · '+producing+' producing</small></div></article></div></section>'+
      '<section class="inventory-section"><div class="production-status-row"><h3>🥣 Feed stock</h3><strong>× '+feedCount+'</strong></div><p>'+feedName+' · '+(id==='coop'?'10 minutes':'30 minutes')+' per adult production cycle. Baby animals need 3 feedings to mature.</p><div class="production-track"><i style="width:'+Math.min(100,feedCount*10)+'%"></i></div><div class="building-actions"><span class="market-intro">'+(feedCount>0?'Feed is ready to use. Select '+feedName+' on the farm toolbar and tap an eligible animal.':'Out of feed. Visit the Market to restock.')+'</span></div></section>'+
      '<section class="inventory-section"><h3>⚡ Quick actions</h3><div class="building-actions"><button class="market-buy" data-building-action="feed" '+(feedable===0?'disabled':'')+'>🥣 Feed hungry adults ('+feedable+')</button><button class="market-buy" data-building-action="collect" '+(collectable===0?'disabled':'')+'>'+(id==='coop'?'🥚':'🥛')+' Collect '+collectable+' '+field+'</button></div><small class="market-intro">Quick feed applies to hungry adult animals only. Feed chicks and calves individually on the farm. Collectable produce is limited by available storage.</small></section>'+
      '<section class="inventory-section"><div class="production-status-row"><h3>🐾 Animal roster</h3><small>'+family.length+' housed</small></div>'+(rows||'<p>No animals housed yet. Visit the Market to buy your first '+(id==='coop'?'chick or hen':'calf or cow')+'.</p>')+'</section>'+
      '<section class="inventory-section"><div class="production-status-row"><h3>🏗️ Building upgrade</h3><strong>Level '+level+'/5</strong></div><p class="market-intro">Upgrade to add 2 animal spaces and 5 '+field+' storage. Cost: '+cost+' coins.</p><button class="market-buy" id="upgrade-building" '+(this.coins<cost||level>=5?'disabled':'')+'>'+(level>=5?'Maximum level reached':this.coins<cost?'Need '+(cost-this.coins)+' more coins':'🪙 '+cost+' · Upgrade building')+'</button></section>';
    host.querySelector<HTMLButtonElement>('#upgrade-building')?.addEventListener('click',()=>{
      if(level>=5||this.coins<cost)return;
      this.coins-=cost;if(id==='coop')this.buildings.coopLevel++;else this.buildings.barnLevel++;
      this.drawScenery();this.renderOwnedAnimals();this.saveFarm();this.refreshHud();this.renderBuildingPanel(id);
      this.toast('Building upgraded! Housing and storage increased.');
    });
  }
  private sellInventoryItem(key:string):void {
    const crop=key.startsWith('crop:')?key.slice(5) as CropId:null;
    const fruit=key.startsWith('fruit:')?key.slice(6) as 'apples'|'pears'|'cherries'|'oranges':null;
    const product=key.startsWith('product:')?key.slice(8) as ProductId:null;
    const animal=key==='eggs'||key==='milk'?key:null;
    let quantity=0,price=0,label='';
    if(crop&&crop in CROPS){quantity=this.harvestedCrops[crop];price=CROPS[crop].reward;label=CROPS[crop].name;if(quantity)this.harvestedCrops[crop]=0;}
    else if(fruit&&fruit in this.fruitInventory){quantity=this.fruitInventory[fruit];price=fruit==='apples'?55:fruit==='pears'?65:fruit==='oranges'?60:75;label=fruit[0]!.toUpperCase()+fruit.slice(1);if(quantity)this.fruitInventory[fruit]=0;}
    else if(animal){quantity=this.produce[animal];price=animal==='eggs'?12:28;label=animal;if(quantity)this.produce[animal]=0;}
    else if(product&&product in this.crafted){quantity=this.crafted[product];price=({flour:24,bread:58,pastry:86,grapes:36} as Record<ProductId,number>)[product];label=this.productName(product);if(quantity)this.crafted[product]=0;}
    if(!quantity){this.toast('Nothing available to sell.');return;}
    const total=quantity*price;playSfx('coin');this.coins+=total;this.xp+=Math.max(1,Math.floor(total/20));this.saveFarm();this.refreshHud();this.renderMarket('sell');this.toast('Sold '+quantity+' '+label+' for '+total+' coins · XP earned.');
  }
  private sellProduce(): void { const value=this.produce.eggs*12+this.produce.milk*28; if(value<=0){this.toast('No animal products to sell yet.');return;}const eggs=this.produce.eggs,milk=this.produce.milk;this.produce={eggs:0,milk:0};playSfx('coin');this.coins+=value;this.xp+=eggs*2+milk*4;this.saveFarm();this.refreshHud();this.renderInventory();this.toast('Sold '+eggs+' eggs and '+milk+' milk for '+value+' coins!'); }
  private openMarket(): void {
    const modal=document.getElementById('market-modal');
    modal?.classList.remove('inventory-mode','field-seed-mode');modal?.classList.add('market-mode');
    const title=modal?.querySelector('.market-header h2'); if(title) title.textContent='Farm Market';
    modal?.querySelector('.market-tabs')?.classList.remove('inventory-hidden');
    const intro=document.getElementById('market-intro'); if(intro) intro.textContent='Seeds, animals and supplies for a thriving farm.';
    modal?.classList.add('open'); modal?.setAttribute('aria-hidden','false');
    document.querySelectorAll<HTMLButtonElement>('[data-market-tab]').forEach(t=>t.classList.toggle('active',t.dataset.marketTab==='seeds'));
    this.renderMarket('seeds');
  }
  private openInventory(): void {
    const modal=document.getElementById('market-modal');
    modal?.classList.remove('market-mode','field-seed-mode');modal?.classList.add('inventory-mode');
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
  private renderEvents():string {const progress=Math.max(0,this.harvests-this.eventStartHarvests),target=20,done=progress>=target,remaining=Math.max(0,604800000-(Date.now()-this.eventStartedAt)),days=Math.floor(remaining/86400000),hours=Math.floor(remaining%86400000/3600000);return '<article class="market-item quest-card"><div class="market-art">🎉</div><div class="market-copy"><strong>Weekly Harvest Festival</strong><small>Harvest 20 crops before the festival ends. '+days+'d '+hours+'h remaining.</small><div class="quest-track"><i style="width:'+Math.min(100,progress/target*100)+'%"></i></div><small>'+Math.min(target,progress)+' / '+target+' harvests · Reward: 150 coins + 30 XP</small></div><button class="market-buy" data-claim-event '+(!done||this.eventClaimed?'disabled':'')+'>'+(this.eventClaimed?'Claimed':done?'Claim reward':'In progress')+'</button></article>';}
  private claimEvent():void {if(this.eventClaimed||this.harvests-this.eventStartHarvests<20)return;this.eventClaimed=true;playSfx('level');this.coins+=150;this.xp+=30;this.saveFarm();this.refreshHud();this.toast('Harvest Festival complete · +150 coins · +30 XP');}
  private renderRewards():string {return [10,25,50,100].map(n=>{const claimed=this.claimedMilestones.includes(n),done=this.harvests>=n;return '<article class="market-item quest-card"><div class="market-art">🏅</div><div class="market-copy"><strong>'+n+' Lifetime Harvests</strong><small>'+Math.min(n,this.harvests)+' / '+n+' crops · Reward: '+n*10+' coins + '+n*2+' XP</small><div class="quest-track"><i style="width:'+Math.min(100,this.harvests/n*100)+'%"></i></div></div><button class="market-buy" data-claim-milestone="'+n+'" '+(!done||claimed?'disabled':'')+'>'+(claimed?'Claimed':done?'Claim reward':'In progress')+'</button></article>';}).join('');}
  private claimMilestone(n:number):void {if(![10,25,50,100].includes(n)||this.harvests<n||this.claimedMilestones.includes(n))return;this.claimedMilestones.push(n);playSfx('level');this.coins+=n*4;this.xp+=n;this.saveFarm();this.refreshHud();this.toast('Harvest milestone reward collected!');}
  private createRandomQuests():void {
    this.questCycle++;
    const pool = [
      {id:'harvest',title:'Golden Harvest',description:'Harvest 5 crops from your fields.',target:5,coins:75,xp:18,icon:'🌾',metric:'harvests' as const},
      {id:'harvest12',title:'Village Granary',description:'Harvest 12 crops for the village.',target:12,coins:150,xp:35,icon:'🚜',metric:'harvests' as const},
      {id:'hens',title:'A Clucking Good Day',description:'Keep 2 hens on your farm.',target:2,coins:90,xp:22,icon:'🐔',metric:'hens' as const},
      {id:'cows',title:'Dairy Delight',description:'Raise 2 dairy cows.',target:2,coins:130,xp:30,icon:'🐄',metric:'cows' as const},
      {id:'eggs',title:'Fresh from the Coop',description:'Collect 3 eggs into storage.',target:3,coins:65,xp:16,icon:'🥚',metric:'eggs' as const},
      {id:'milk',title:'Milk Pail Mission',description:'Store 2 bottles of fresh milk.',target:2,coins:40,xp:6,icon:'🥛',metric:'milk' as const}
    ];
    this.randomQuests=[...pool].sort(()=>Math.random()-.5).slice(0,4).map((q,i)=>({...q,id:q.id+'-'+this.questCycle+'-'+i}));
  }
  private questDefinitions(): Array<{id:string;title:string;description:string;target:number;progress:number;coins:number;xp:number;icon:string}> {
    if(this.randomQuests.length)return this.randomQuests.map(q=>({...q,progress:this.questProgress(q.metric)}));
    return [
      {id:'first-harvest',title:'First Harvest',description:'Harvest your first crop.',target:1,progress:this.harvests,coins:20,xp:3,icon:'🌾'},
      {id:'busy-farmer',title:'A Busy Farmer',description:'Harvest 10 crops in total.',target:10,progress:this.harvests,coins:55,xp:8,icon:'🚜'},
      {id:'first-hen',title:'A Feathered Friend',description:'Welcome a hen to your farm.',target:1,progress:this.animals.filter(a=>a.id==='hen').length,coins:25,xp:4,icon:'🐔'},
      {id:'first-cow',title:'Milk Matters',description:'Welcome a cow to your farm.',target:1,progress:this.animals.filter(a=>a.id==='cow').length,coins:40,xp:6,icon:'🐄'},
      {id:'better-coop',title:'Room to Roam',description:'Upgrade your chicken coop to level 2.',target:2,progress:this.buildings.coopLevel,coins:50,xp:7,icon:'🏡'},
      {id:'bigger-silo',title:'Store More',description:'Upgrade your silo to level 2.',target:2,progress:this.buildings.warehouseLevel,coins:50,xp:7,icon:'🏚️'}
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
    this.claimedQuests.push(id);playSfx('level');this.coins+=quest.coins;this.xp+=quest.xp;
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
    this.ordersCompleted[id]=(this.ordersCompleted[id]||0)+1;playSfx('coin');
    this.saveFarm();this.refreshHud();this.renderInventory();this.renderSideRail();
    this.toast('Delivery complete: +'+order.coins+' coins · +'+order.xp+' XP');
  }

  private renderInventory(): void {
    const host=document.getElementById('market-items'); if(!host) return;
    const fruitCards='<article class="market-item"><div class="market-art">🍎</div><div class="market-copy"><strong>Apples</strong><small>Harvested from apple trees</small></div><span class="inventory-quantity">× '+this.fruitInventory.apples+'</span></article><article class="market-item"><div class="market-art">🍐</div><div class="market-copy"><strong>Pears</strong><small>Harvested from pear trees</small></div><span class="inventory-quantity">× '+this.fruitInventory.pears+'</span></article><article class="market-item"><div class="market-art">🍒</div><div class="market-copy"><strong>Cherries</strong><small>Harvested from blossom trees</small></div><span class="inventory-quantity">× '+this.fruitInventory.cherries+'</span></article><article class="market-item"><div class="market-art">🍊</div><div class="market-copy"><strong>Oranges</strong><small>Harvested from orange trees</small></div><span class="inventory-quantity">× '+this.fruitInventory.oranges+'</span></article>';

    const hens=this.animals.filter(a=>a.id==='hen'||a.id==='chick'); const cows=this.animals.filter(a=>a.id==='cow'||a.id==='calf');
    const animalCard=(emoji:string,name:string,items:Animal[])=>'<article class="market-item"><div class="market-art">'+emoji+'</div><div class="market-copy"><strong>'+name+'</strong><small>'+items.filter(a=>a.id==='chick'||a.id==='calf').length+' young · '+items.filter(a=>a.id==='hen'||a.id==='cow').length+' adult · '+items.filter(a=>a.readyAt>0&&a.readyAt<=Date.now()).length+' ready</small></div><span class="inventory-quantity">× '+items.length+'</span></article>';
    const growing=Array.from(this.plots.values()).filter(p=>p.state==='growing').length; const ready=Array.from(this.plots.values()).filter(p=>p.state==='ready').length;
    const produceCards='<article class="market-item"><div class="market-art">🥚</div><div class="market-copy"><strong>Eggs</strong><small>Sell value: 12 coins each</small></div><span class="inventory-quantity">× '+this.produce.eggs+'</span></article><article class="market-item"><div class="market-art">🥛</div><div class="market-copy"><strong>Milk</strong><small>Sell value: 28 coins each</small></div><span class="inventory-quantity">× '+this.produce.milk+'</span></article>';
     const feedCards='<article class="market-item">'+this.marketArtImage('feed/chicken-feed-thumb.png','Chicken feed','🌽')+'<div class="market-copy"><strong>Chicken feed</strong><small>For egg-laying hens and growing chicks</small></div><span class="inventory-quantity">× '+this.feed.hen+'</span></article><article class="market-item">'+this.marketArtImage('feed/cow-feed-thumb.png','Cow feed','🌿')+'<div class="market-copy"><strong>Cow feed</strong><small>For milk-producing cows and growing calves</small></div><span class="inventory-quantity">× '+this.feed.cow+'</span></article>';
    const storedCards=this.storedDecor.map((id,index)=>{const asset=this.decorAssetForId(id);const name=asset?this.decorDisplayName(asset):id;return '<article class="market-item"><div class="market-art">📦</div><div class="market-copy"><strong>'+name+'</strong><small>Stored farm item · ready to place</small></div><button class="market-buy" data-restore-stored="'+index+'">Place on farm</button></article>';}).join('');
     const inventoryBuildings=[{id:'coop',name:'Chicken Coop',emoji:'🐔',unlock:4},{id:'barn',name:'Cow Shed',emoji:'🐄',unlock:7},{id:'silo',name:'Grain Silo',emoji:'🌾',unlock:10},{id:'bakery',name:'Village Bakery',emoji:'🥖',unlock:14},{id:'greenhouse',name:'Greenhouse',emoji:'🌿',unlock:20},{id:'windmill',name:'Windmill',emoji:'🌬️',unlock:27},{id:'well',name:'Stone Well',emoji:'🪣',unlock:5},{id:'stable',name:'Horse Stable',emoji:'🐎',unlock:42},{id:'workshop',name:'Farm Workshop',emoji:'🛠️',unlock:52},{id:'waterTower',name:'Water Tower',emoji:'💧',unlock:64}] as Array<{id:BuildingId;name:string;emoji:string;unlock:number}>;
     const buildingUpgradeCards=inventoryBuildings.map(item=>{
       const level=this.buildingLevels[item.id]||0,locked=this.farmerLevel<item.unlock,owned=level>0;
       const label=locked?'🔒 Unlocks at Level '+item.unlock:owned?'Open upgrade options':'Build in Market';
       return '<article class="market-item '+(locked?'inventory-building-locked':'')+'"><div class="market-art">'+item.emoji+'</div><div class="market-copy"><strong>'+item.name+(owned?' · Level '+level+'/5':'')+'</strong><small>'+(locked?'Building upgrades are unavailable until Farmer Level '+item.unlock+'.':owned?'Building unlocked · View available upgrade.':'Unlocked · Build this facility first.')+'</small></div><button class="market-buy" data-inventory-building="'+item.id+'" '+(locked?'disabled':'')+'>'+label+'</button></article>';
     }).join('');
    const warehouseCost=this.buildings.warehouseLevel*1000; host.innerHTML=(this.storedDecor.length?'<section class="inventory-section"><h3>📦 Stored trees & decorations ('+this.storedDecor.length+')</h3><div class="quest-list">'+storedCards+'</div></section>':'<section class="inventory-section"><h3>📦 Stored items</h3><p>No trees or decorations are currently stored.</p></section>')+fruitCards+'<section class="inventory-section"><h3>🏗️ Building upgrades & unlocks</h3><p>Locked buildings become available as your farmer levels up. Select an unlocked building to view its build or upgrade options.</p><div class="quest-list">'+buildingUpgradeCards+'</div></section><section class="inventory-section"><h3>📦 Order & delivery board</h3><p>Fulfil market requests with stored animal products. Each delivery pays coins and XP; contracts can be completed again.</p><div class="quest-list">'+this.renderOrders()+'</div></section><section class="inventory-section"><h3>📜 Farm quests & ribbons</h3><div class="quest-list">'+this.renderQuests()+'</div></section><section class="inventory-section"><h3>🏚️ Silo & shared storage · Level '+this.buildings.warehouseLevel+'</h3><p>Shared warehouse expansion adds 10 extra spaces to both eggs and milk storage. Silo bonus: +'+((this.buildings.warehouseLevel-1)*10)+' spaces per product type.</p><button class="market-buy" id="upgrade-warehouse" '+(this.coins<warehouseCost||this.buildings.warehouseLevel>=10?'disabled':'')+'>'+(this.buildings.warehouseLevel>=10?'Maximum level reached':'🪙 '+warehouseCost+' · Upgrade silo storage')+'</button></section><section class="inventory-section"><h3>🥚 Animal produce</h3><div class="inventory-grid">'+produceCards+'</div><button class="market-buy" id="sell-produce" '+(this.produce.eggs+this.produce.milk===0?'disabled':'')+'>Sell all animal products</button></section><section class="inventory-section"><h3>🥣 Animal feed storage</h3><div class="inventory-grid">'+feedCards+'</div></section><section class="inventory-section"><h3>🏭 Crafted goods & village deliveries</h3><div class="inventory-grid">'+(['flour','bread','pastry','grapes'] as ProductId[]).map(p=>'<article class="market-item"><div class="market-art">'+({flour:'🌾',bread:'🍞',pastry:'🥐',grapes:'🍇'} as Record<ProductId,string>)[p]+'</div><div class="market-copy"><strong>'+this.productName(p)+'</strong></div><span class="inventory-quantity">× '+this.crafted[p]+'</span></article>').join('')+'</div><div class="quest-list">'+([{id:'bread',name:'Bread delivery',qty:1,coins:58},{id:'pastry',name:'Pastry delivery',qty:1,coins:86},{id:'grapes',name:'Grape basket',qty:2,coins:72}] as Array<{id:string;name:string;qty:number;coins:number}>).map(o=>'<article class="market-item"><div class="market-copy"><strong>'+o.name+'</strong><small>'+o.qty+' required · Reward '+o.coins+' coins</small></div><button class="market-buy" data-fulfil-crafted="'+o.id+'" '+(this.crafted[o.id as ProductId]<o.qty?'disabled':'')+'>Deliver</button></article>').join('')+'</div></section><section class="inventory-section"><h3>🐾 Farm animals</h3><div class="inventory-grid">'+animalCard('🐔','Happy Hen',hens)+animalCard('🐄','Daisy Cow',cows)+'</div></section><section class="inventory-section inventory-stats"><h3>🌾 Field activity</h3><div class="inventory-stat"><strong>'+growing+'</strong><small>Growing</small></div><div class="inventory-stat"><strong>'+ready+'</strong><small>Ready to harvest</small></div><div class="inventory-stat"><strong>'+this.harvests+'</strong><small>Total harvests</small></div></section>';
    host.querySelectorAll<HTMLButtonElement>('[data-restore-stored]').forEach(btn=>btn.addEventListener('click',()=>{const index=Number(btn.dataset.restoreStored);const id=this.storedDecor[index];if(!id||this.pendingDecorId)return;this.storedDecor.splice(index,1);this.pendingDecorId=id;this.activeTool='move';document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.tool==='move'));this.closeMarket();this.saveFarm();this.toast('Choose a green farm tile to place your stored item.');}));
     host.querySelectorAll<HTMLButtonElement>('[data-inventory-building]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.disabled)return;this.closeMarket();this.openMarket();document.querySelectorAll<HTMLButtonElement>('[data-market-tab]').forEach(tab=>tab.classList.toggle('active',tab.dataset.marketTab==='buildings'));this.renderMarket('buildings');}));
  }
  private closeMarket(): void {this.activeBuilding=null;document.getElementById('market-modal')?.classList.remove('open','field-seed-mode','inventory-mode','market-mode');const panel=document.querySelector<HTMLElement>('#market-modal .market-window');if(panel){panel.style.left='';panel.style.top='';}document.getElementById('market-modal')?.setAttribute('aria-hidden','true');document.getElementById('market-modal')?.querySelector('.market-tabs')?.classList.remove('inventory-hidden');}
  private marketArtImage(path:string,alt:string,fallback:string):string {
    const src=import.meta.env.BASE_URL+'assets/'+path;
    const animal=path==='animals/cow.png'?' cow-atlas':path==='animals/hen.png'?' hen-atlas':'';
    return '<div class="market-art'+animal+'"><img class="market-thumb" src="'+src+'" alt="'+alt+'" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.textContent=\''+fallback+'\';"></div>';
  }

  private renderMarket(category='seeds'): void {
    const host=document.getElementById('market-items');if(!host)return;
    if(category==='sell'){
      const row=(emoji:string,name:string,qty:number,unit:number,key:string,art?:string)=>'<article class="market-item">'+(art?this.marketArtImage(art,name,emoji):'<div class="market-art">'+emoji+'</div>')+'<div class="market-copy"><strong>'+name+'</strong><small>In storage: '+qty+' · '+unit+' coins each</small></div><button class="market-buy" data-sell-item="'+key+'" '+(qty<=0?'disabled':'')+'>Sell all · '+(qty*unit)+' 🪙</button></article>';
      host.innerHTML='<section class="inventory-section"><h3>🌾 Harvested crops</h3><div class="inventory-grid">'+(Object.entries(CROPS) as Array<[CropId,typeof CROPS[CropId]]>).map(([id,c])=>row(c.emoji,c.name,this.harvestedCrops[id],c.reward,'crop:'+id)).join('')+'</div></section><section class="inventory-section"><h3>🍎 Orchard fruit</h3><div class="inventory-grid">'+row('🍎','Apples',this.fruitInventory.apples,55,'fruit:apples','decor/apple_tree.png')+row('🍐','Pears',this.fruitInventory.pears,65,'fruit:pears','decor/pear_tree.png')+row('🍒','Cherries',this.fruitInventory.cherries,75,'fruit:cherries','decor/pink_blossom_tree.png')+row('🍊','Oranges',this.fruitInventory.oranges,60,'fruit:oranges','decor/orange_fruit_tree.png')+'</div></section><section class="inventory-section"><h3>🥚 Animal produce</h3><div class="inventory-grid">'+row('🥚','Eggs',this.produce.eggs,12,'eggs')+row('🥛','Milk',this.produce.milk,28,'milk')+'</div></section><section class="inventory-section"><h3>🏭 Crafted goods</h3><div class="inventory-grid">'+row('🌾','Flour',this.crafted.flour,24,'product:flour')+row('🍞','Bread',this.crafted.bread,58,'product:bread')+row('🥐','Pastries',this.crafted.pastry,86,'product:pastry')+row('🍇','Grapes',this.crafted.grapes,36,'product:grapes')+'</div></section>';
      return;
    }
    if(category==='feed'){host.innerHTML='<article class="market-item">'+this.marketArtImage('feed/chicken-feed-thumb.png','Chicken feed','🌽')+'<div class="market-copy"><strong>Chicken feed</strong><small>Feed one hen or chick · starts a 10-minute egg or growth cycle · in storage: '+this.feed.hen+'</small></div><button class="market-buy" data-buy-feed="hen" '+(this.coins<25?'disabled':'')+'>🪙 25 · Buy</button></article><article class="market-item">'+this.marketArtImage('feed/cow-feed-thumb.png','Cow feed','🌿')+'<div class="market-copy"><strong>Cow feed</strong><small>Feed one cow or calf · starts a 30-minute milk or growth cycle · in storage: '+this.feed.cow+'</small></div><button class="market-buy" data-buy-feed="cow" '+(this.coins<40?'disabled':'')+'>🪙 40 · Buy</button></article>';host.querySelectorAll<HTMLButtonElement>('[data-buy-feed]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buyFeed as AnimalId;const price=id==='hen'?25:40;if(this.coins<price)return;this.coins-=price;this.feed[id]++;this.saveFarm();this.refreshHud();this.closeMarket();this.activeTool='select';document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.tool==='select'));this.updateToolCursor();this.refreshSelection();this.toast((id==='hen'?'Hen/chick':'Cow/calf')+' feed added · tap the hungry bowl above an animal to feed it.');}));return;} if(category==='animals'){
      const hens=this.animals.filter(a=>a.id==='hen'||a.id==='chick').length,cows=this.animals.filter(a=>a.id==='cow'||a.id==='calf').length;
      const card=(id:'chick'|'calf'|'hen'|'cow',name:string,emoji:string,cost:number,desc:string,count:number,cap:number)=>{
        const reason=count>=cap?'Housing full · upgrade the '+(id==='chick'||id==='hen'?'Chicken Coop':'Cow Shed')+' to add space':this.coins<cost?'Need '+(cost-this.coins)+' more coins':'';
        const disabled=reason!=='';
        return '<article class="market-item">'+this.marketArtImage('animals/'+(id==='chick'?'chick-thumb.svg':id==='calf'?'calf-thumb.svg':id==='cow'?'cow.png':'hen.png'),name,emoji)+'<div class="market-copy"><strong>'+name+'</strong><small>'+desc+' · housed: '+count+'/'+cap+'</small>'+(disabled?'<small class="market-requirement">'+reason+'</small>':'')+'</div><button class="market-buy" data-buy-animal="'+id+'" '+(disabled?'disabled':'')+'>'+(disabled?reason:'🪙 '+cost+' · Buy')+'</button></article>';
      };
      host.innerHTML=card('chick','Baby Chick','🐣',90,'Needs 3 feedings to grow into a hen',hens,this.buildingCapacity('hen'))+card('hen','Happy Hen','🐔',220,'Ready to lay eggs after feeding',hens,this.buildingCapacity('hen'))+card('calf','Baby Calf','🐮',240,'Needs 3 feedings to grow into a cow',cows,this.buildingCapacity('cow'))+card('cow','Daisy Cow','🐄',480,'Produces milk after feeding',cows,this.buildingCapacity('cow'));
      host.querySelectorAll<HTMLButtonElement>('[data-buy-animal]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buyAnimal as AnimalId;const cost:Record<AnimalId,number>={chick:90,hen:220,calf:240,cow:480};const cap=this.buildingCapacity(id==='chick'||id==='hen'?'hen':'cow');const count=this.animals.filter(a=>(id==='chick'||id==='hen'?a.id==='chick'||a.id==='hen':a.id==='calf'||a.id==='cow')).length;if(this.coins<cost[id]||count>=cap)return;this.coins-=cost[id];this.animals.push({id,readyAt:0,growthFeedings:0});this.renderOwnedAnimals();this.saveFarm();this.refreshHud();this.toast(id==='chick'?'A baby chick joined your farm!':id==='calf'?'A baby calf joined your farm!':'A new animal joined your farm!');this.renderMarket('animals');}));
      return;
    } if(category==='buildings'){
      const level=this.farmerLevel;
      const options=[{id:'coop',name:'Chicken Coop',emoji:'🐔',cost:650,unlock:4,desc:'Build your first hen house and unlock egg production.'},{id:'barn',name:'Cow Shed',emoji:'🐄',cost:1100,unlock:7,desc:'House cows and begin collecting fresh milk.'},{id:'silo',name:'Grain Silo',emoji:'🌾',cost:1450,unlock:10,desc:'Expand storage for animal products.'},{id:'bakery',name:'Village Bakery',emoji:'🥖',cost:1900,unlock:14,desc:'A village bakery for the next stage of farm life.'},{id:'greenhouse',name:'Greenhouse',emoji:'🌿',cost:2500,unlock:20,desc:'A glasshouse for year-round growing.'},{id:'windmill',name:'Windmill',emoji:'🌬️',cost:3400,unlock:27,desc:'A landmark mill that completes your homestead.'},{id:'well',name:'Stone Well',emoji:'🪣',cost:850,unlock:5,desc:'Unlocks at Level 5. Collect 3 water every 30 minutes; well upgrades increase the amount collected.'},{id:'stable',name:'Horse Stable',emoji:'🐎',cost:5200,unlock:42,desc:'A new home for future farm companions.'},{id:'workshop',name:'Farm Workshop',emoji:'🛠️',cost:6500,unlock:52,desc:'Craft and improve tools for the next farm era.'},{id:'waterTower',name:'Water Tower',emoji:'💧',cost:8200,unlock:64,desc:'A landmark upgrade for your expanded farm.'}];
      const expansionCards=([1,2,3,4] as const).map(size=>{
        const expansion=this.nextLandExpansion(size);
        if(!expansion)return '';
        const cells=size*size,available=level>=expansion.level&&this.coins>=expansion.cost;
        const status=level<expansion.level?'🔒 Level '+expansion.level:this.coins<expansion.cost?'Need '+expansion.cost+' coins':'🪙 '+expansion.cost+' · Expand';
        return '<article class="market-item farm-expansion-card"><div class="market-art">🗺️</div><div class="market-copy"><strong>Expand farm · '+size+' × '+size+'</strong><small>Add '+cells+' connected land tiles for crops, animals and decorations. Requires Farmer Level '+expansion.level+'.</small></div><button class="market-buy" data-farm-expand="'+size+'" '+(available?'':'disabled')+'>'+status+'</button></article>';
      }).join('');
      const expansionCard=expansionCards||'<article class="market-item farm-expansion-card"><div class="market-art">🏡</div><div class="market-copy"><strong>Maximum farm land reached</strong><small>Your farm has reached the 19 × 19 land boundary.</small></div><button class="market-buy" disabled>Fully expanded</button></article>';
      host.innerHTML=expansionCard+options.map(item=>{const owned=this.buildingLevels[item.id as BuildingId]>0;const folder=({coop:'chicken-coop',barn:'barn',silo:'silo',bakery:'village-bakery',greenhouse:'greenhouse',windmill:'windmill',well:'well',stable:'stable',workshop:'workshop',waterTower:'water-tower'} as Record<string,string>)[item.id];const art=this.marketArtImage('buildings/'+folder+'/'+folder+'-level-1.png',item.name,item.emoji);return '<article class="market-item">'+art+'<div class="market-copy"><strong>'+item.name+(owned?' · Level '+this.buildingLevels[item.id as BuildingId]:'')+'</strong><small>'+item.desc+' Unlocks at Level '+item.unlock+'. Upgrade cost: '+(this.buildingLevels[item.id as BuildingId]*900||item.cost)+' coins.</small></div><button class="market-buy" data-building-buy="'+item.id+'" '+(level<item.unlock||(!owned&&this.coins<item.cost)||(owned&&this.coins<this.buildingLevels[item.id as BuildingId]*350)||this.buildingLevels[item.id as BuildingId]>=5?'disabled':'')+'>'+(level<item.unlock?'🔒 Level '+item.unlock: this.buildingLevels[item.id as BuildingId]>=5?'Max level':owned?'🪙 '+(this.buildingLevels[item.id as BuildingId]*350)+' · Upgrade':'🪙 '+item.cost+' · Build')+'</button></article>';}).join('');
      host.querySelectorAll<HTMLButtonElement>('[data-farm-expand]').forEach(btn=>btn.addEventListener('click',()=>this.expandLand(([1,2,3,4].includes(Number(btn.dataset.farmExpand))?Number(btn.dataset.farmExpand):1) as 1|2|3|4)));
      host.querySelectorAll<HTMLButtonElement>('[data-building-buy]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buildingBuy as BuildingId;const item=options.find(x=>x.id===id);if(!item||level<item.unlock||this.buildingLevels[id]>=5)return;const cost=this.buildingLevels[id]>0?this.buildingLevels[id]*900:item.cost;if(this.coins<cost)return;const placement=!this.decor[id]?this.findFreeDecorTile(false):null;if(!this.decor[id]&&!placement){this.toast('Your farm is full. Move or clear an object before building.');return;}this.coins-=cost;this.buildingLevels[id]=Math.max(1,this.buildingLevels[id]+1);if(placement)this.decor[id]=placement;if(id==='coop')this.buildings.coopLevel=this.buildingLevels.coop;if(id==='barn')this.buildings.barnLevel=this.buildingLevels.barn;if(id==='silo')this.buildings.warehouseLevel=this.buildingLevels.silo;this.drawScenery();this.saveFarm();this.refreshHud();this.renderMarket('buildings');this.toast(item.name+' upgraded to Level '+this.buildingLevels[id]+'.');}));return;
    }if(category==='trees'||category==='decor'){
      // Use an explicit artwork-verified list. Filename matching incorrectly pulled carts,
      // ponds, logs and other non-tree props into Trees, while missing some true tree variants.
      const TREE_ASSETS=new Set<string>(['apple_tree','evergreen_tree','evergreen_tree_variant','orange_tree_variant2','pear_tree','pink_blossom_tree','pink_blossom_tree_variant2','wisteria_tree','wisteria_trellis']);
      const isTreeAsset=(asset:string)=>TREE_ASSETS.has(asset);
      const legacyTreeMap:Record<string,string>={apple_tree:'appleTree',pear_tree:'pearTree',pink_blossom_tree:'cherryTree'};
      const sourceAssets=DECOR_ASSETS.filter(asset=>isTreeAsset(asset)===(category==='trees'));
      const treeFruit=(asset:string)=>asset==='apple_tree'?'🍎':asset==='pear_tree'?'🍐':asset.includes('orange')?'🍊':asset.includes('pink_blossom')?'🍒':'🌳';
      const decorMeta=(asset:string,index:number)=>{const tree=isTreeAsset(asset);const small=/bush|hedge|flowerbed|flower_pot|rock|fence|path|stump|firewood|hay/.test(asset);const grand=/gazebo|arch|swing|windmill|fountain|well|pond|waterfall|bridge|cart|market|campfire/.test(asset);const unlock=Math.min(95,3+Math.floor(index*92/DECOR_ASSET_ORDER.length));const base=grand?4200:tree?1850:small?480:asset.includes('bench')||asset.includes('bird')||asset.includes('lamp')||asset.includes('sign')?1450:2600;const variant=asset.includes('variant')?1.18:1;return {unlock,cost:Math.round(base*variant/10)*10};};
      const items=sourceAssets.map(asset=>{const legacyId=legacyTreeMap[asset];const index=DECOR_ASSET_ORDER.indexOf(asset as typeof DECOR_ASSET_ORDER[number]);const meta=decorMeta(asset,index);const name=this.decorDisplayName(asset);const emoji=category==='trees'?treeFruit(asset):(/flower|bush|hedge|rose|lavender/.test(asset)?'🌸':/bench|swing/.test(asset)?'🪑':/lamp|light/.test(asset)?'🏮':/fence|gate|wall/.test(asset)?'🪵':'🌿');return {id:legacyId||'decor_'+asset,asset,name,emoji,cost:legacyId==='appleTree'?650:legacyId==='pearTree'?700:legacyId==='cherryTree'?780:meta.cost,unlock:meta.unlock,desc:category==='trees'?'Plant this tree on your farm'+(this.fruitKind(legacyId||'decor_'+asset)?' and harvest its fruit':'')+'.':'Decorate your homestead with this handcrafted farm item.'};});
      host.innerHTML=items.map(item=>{const locked=this.farmerLevel<item.unlock;const owned=Object.keys(this.decor).some(k=>k===item.id||k.startsWith(item.id));const artAsset=item.asset==='pear_tree'?'wisteria_tree':item.asset;const art=this.marketArtImage('decor/'+artAsset+'.png',item.name,item.emoji);return '<article class="market-item">'+art+'<div class="market-copy"><strong>'+item.name+'</strong><small>'+item.desc+' · Unlocks at Level '+item.unlock+(owned?' · Already placed':'')+'</small></div><button class="market-buy" data-buy-decor="'+item.id+'" '+(locked||this.coins<item.cost?'disabled':'')+'>'+(locked?'🔒 Level '+item.unlock:'🪙 '+item.cost+' · Buy')+'</button></article>';}).join('');
      host.querySelectorAll<HTMLButtonElement>('[data-buy-decor]').forEach(btn=>btn.addEventListener('click',()=>{const item=items.find(x=>x.id===btn.dataset.buyDecor);if(!item||this.farmerLevel<item.unlock||this.coins<item.cost||this.pendingDecorId)return;this.coins-=item.cost;const count=Object.keys(this.decor).filter(k=>k.startsWith(item.id)).length;const placedId=item.id+(count+1);this.pendingDecorId=placedId;this.movingDecor=null;this.movingPlotKey=null;this.movingPreviewTile=null;this.movingPreviewValid=false;this.activeTool='move';document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.tool==='move'));this.closeMarket();this.refreshHud();this.drawPlacementOverlay();this.toast('Bought '+item.name+'. Tap or drag it to your chosen green farm tile to place it.');}));return;
    }
        const level=this.farmerLevel;const cropArt:Partial<Record<CropId,string>>={tomato:'crops/tomato/tomato-fruit.png'};host.innerHTML=(Object.entries(CROPS) as Array<[CropId,typeof CROPS[CropId]]>).map(([id,crop])=>{const locked=level<crop.unlockLevel;const art=cropArt[id];const image=art?this.marketArtImage(art,crop.name,crop.emoji):'<div class="market-art">'+crop.emoji+'</div>';return `<article class="market-item ${locked?'crop-locked':''}">${image}<div class="market-copy"><strong>${crop.name}</strong><small>${locked?'Unlocks at level '+crop.unlockLevel:Math.round(crop.growMs/1000)+'s grow · '+Math.round(Math.max(300000,crop.growMs*2)/1000)+'s harvest window'} · reward ${crop.reward} coins · +${crop.xp} XP · planting cost ${crop.cost} coins per field</small></div><button class="market-buy" data-buy-seed="${id}" ${locked?'disabled':''}>${locked?'🔒 Level '+crop.unlockLevel:'Select seed'}</button></article>`;}).join('');
    host.querySelectorAll<HTMLButtonElement>('[data-buy-seed]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buySeed as CropId;const crop=CROPS[id];if(!crop||this.farmerLevel<crop.unlockLevel)return;this.selectedCrop=id;this.activeTool='plant';document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('active',(el as HTMLElement).dataset.tool==='plant'));this.saveFarm();this.refreshHud();this.closeMarket();this.refreshCropSelector();this.refreshSelection();this.toast(crop.name+' selected. Each field costs '+crop.cost+' coins to plant.');}));
  }
  private playHarvestEffect(x:number,y:number):void {
    const ring=this.add.circle(x,y-8,7,0xffe68a,0).setStrokeStyle(3,0xffe68a,0.95).setDepth(29998);
    this.tweens.add({targets:ring,scale:3.2,alpha:0,duration:430,ease:'Cubic.easeOut',onComplete:()=>ring.destroy()});
    const colors=[0xffdf69,0xf5f0b0,0x8bcf62,0xffffff,0xf3a65c,0x9ed8e8];
    for(let i=0;i<colors.length;i++){
      const angle=(Math.PI*2*i/colors.length)+Phaser.Math.FloatBetween(-0.18,0.18);
      const distance=Phaser.Math.Between(20,34);
      const bit=this.add.circle(x,y-10,Phaser.Math.Between(2,4),colors[i]!,1).setDepth(29999);
      this.tweens.add({targets:bit,x:x+Math.cos(angle)*distance,y:y-10+Math.sin(angle)*distance-Phaser.Math.Between(8,20),alpha:0,scale:0.25,angle:Phaser.Math.Between(-150,150),duration:Phaser.Math.Between(420,620),ease:'Cubic.easeOut',onComplete:()=>bit.destroy()});
    }
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
        this.landTiles.clear();for(let row=0;row<INITIAL_FARM_SIZE;row++)for(let col=0;col<INITIAL_FARM_SIZE;col++)this.landTiles.add(this.key(col,row));
        this.coins=250;this.xp=0;this.waterUnits=0;this.waterCollectedAt=0;this.inventory={wheat:3,carrot:0,corn:0,strawberry:0,tomato:0,pumpkin:0,blueberry:0,watermelon:0};
        for(const [col,row] of [[2,2],[3,2],[2,3]]){const plot=this.plots.get(this.key(col,row));if(plot)plot.state='tilled';}
        this.saveFarm();
        return;
      }
      const save = JSON.parse(raw) as any;
      if (![1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19].includes(save.version) || !Array.isArray(save.plots)) {
        this.persistenceBlocked = true;
        console.error('Happy Farm found an unsupported or incomplete save. Saving is disabled to protect the existing data.');
        const status = document.getElementById('cloud-save-status');
        if (status) status.textContent = 'Save needs recovery · automatic writes paused to protect your farm';
        return;
      }
      this.coins = Math.max(0, Math.floor(save.coins));
      this.farmerName=typeof save.farmerName==='string'&&save.farmerName.trim()?save.farmerName.slice(0,24):'New Farmer';
      this.farmName=typeof save.farmName==='string'&&save.farmName.trim()?save.farmName.slice(0,28):'My Farm';
      if(save.water!==undefined)this.waterUnits=Math.max(0,Math.floor(Number(save.water)||0));else this.waterUnits=0;this.waterCollectedAt=Math.max(0,Number(save.waterCollectedAt)||0);if(save.buildingLevels&&typeof save.buildingLevels==='object')for(const id of ['coop','barn','silo','bakery','greenhouse','windmill','stable','well','workshop','waterTower'] as BuildingId[])this.buildingLevels[id]=Math.max(this.buildingLevels[id],Math.min(5,Math.floor(Number(save.buildingLevels[id])||0)));this.randomQuests = Array.isArray(save.randomQuests) ? save.randomQuests : [];this.questRefreshAt=Number(save.questRefreshAt)||0;if(save.questProgressBaseline)this.questProgressBaseline={...this.questProgressBaseline,...save.questProgressBaseline};this.eventStartedAt=Number(save.eventStartedAt)||0;this.eventStartHarvests=Math.max(0,Number(save.eventStartHarvests)||0);this.eventClaimed=Boolean(save.eventClaimed);this.claimedMilestones=Array.isArray(save.claimedMilestones)?save.claimedMilestones.filter((n:number)=>[10,25,50,100].includes(n)):[];
      this.questCycle = this.randomQuests.length ? Math.max(1,...this.randomQuests.map(q=>Number((q.id.match(/-(\d+)-\d+$/)||[])[1])||1)) : 0;
      this.claimedQuests = Array.isArray(save.claimedQuests) ? save.claimedQuests.filter((id:string)=>(['first-harvest','busy-farmer','first-hen','first-cow','better-coop','bigger-silo'].includes(id) || this.randomQuests.some(q=>q.id===id))) : [];
      this.ordersCompleted = save.version >= 9 && save.ordersCompleted && typeof save.ordersCompleted === 'object' ? Object.fromEntries(Object.entries(save.ordersCompleted).map(([id,count])=>[id,Math.max(0,Math.floor(Number(count)||0))]).filter(([id])=>['egg-crate','milk-run','farm-breakfast'].includes(String(id)))) : {};
      this.xp = Math.max(0, Math.floor(save.xp));
      this.displayedLevel=this.farmerLevel;
      if(Array.isArray(save.storedDecor))this.storedDecor=save.storedDecor.filter((id:unknown)=>typeof id==='string'&&id!=='farmhouse');
      if(save.decor && typeof save.decor==='object' && !Array.isArray(save.decor)) {
        const restored:Record<string,{col:number;row:number}>={};
        for(const [id,value] of Object.entries(save.decor as Record<string,unknown>)) {
          const pos=value as {col?:unknown;row?:unknown};
          const allowed=id in this.decor || /^decor_[a-z0-9_]+\d*$/i.test(id) || /^(appleTree|pearTree|cherryTree|flowerbed|fountain|scarecrow|bench|bakery|greenhouse|windmill|coop|barn|silo|stable|well|workshop|waterTower)\d*$/.test(id);
          if(allowed && Number.isInteger(pos?.col) && Number.isInteger(pos?.row) && Number(pos.col)>=0 && Number(pos.col)<COLS && Number(pos.row)>=0 && Number(pos.row)<ROWS) restored[id]={col:Number(pos.col),row:Number(pos.row)};
        }
        this.decor={...this.decor,...restored};
      }
      if (save.selectedCrop && save.selectedCrop in CROPS && this.farmerLevel >= CROPS[save.selectedCrop as CropId].unlockLevel) this.selectedCrop = save.selectedCrop as CropId;
      this.landTiles.clear();
      if(Array.isArray(save.landTiles)){
        this.landExpansionCountValue=Math.max(0,Math.floor(Number(save.landExpansionCount)||0));
        for(const tile of save.landTiles){if(typeof tile!=='string')continue;const [col,row]=tile.split(':').map(Number);if(Number.isInteger(col)&&Number.isInteger(row)&&col>=0&&row>=0&&col<MAX_FARM_SIZE&&row<MAX_FARM_SIZE)this.landTiles.add(this.key(col,row));}
      }else{
        this.landExpansionCountValue=0;
        const legacySize=([7,9,11,13][Phaser.Math.Clamp(Number.isInteger(save.farmExpansionLevel)?save.farmExpansionLevel:3,0,3)]||13);
        for(let row=0;row<legacySize;row++)for(let col=0;col<legacySize;col++)this.landTiles.add(this.key(col,row));
      }
      if(this.landTiles.size===0)for(let row=0;row<INITIAL_FARM_SIZE;row++)for(let col=0;col<INITIAL_FARM_SIZE;col++)this.landTiles.add(this.key(col,row));
      if (save.version >= 2 && save.inventory) this.inventory = {...this.inventory,...save.inventory};
      if (save.version >= 4 && save.feed) this.feed = {...this.feed,hen:save.feed.hen||0,cow:save.feed.cow||0,chick:save.feed.hen||0,calf:save.feed.cow||0};
       if (save.version >= 6 && save.buildings) this.buildings = {...this.buildings,...save.buildings,warehouseLevel:save.buildings.warehouseLevel||1};
      if(save.fruitInventory)this.fruitInventory={...this.fruitInventory,...save.fruitInventory};
      if(save.harvestedCrops)this.harvestedCrops={...this.harvestedCrops,...save.harvestedCrops};
      if(save.fruitTreeReadyAt&&typeof save.fruitTreeReadyAt==='object')this.fruitTreeReadyAt={...save.fruitTreeReadyAt};
      if(save.workshopCompost!==undefined)this.workshopCompost=Math.max(0,Math.floor(Number(save.workshopCompost)||0));
      if(save.version>=12){if(save.productionJobs)for(const id of ['bakery','greenhouse','windmill','workshop'] as BuildingId[])this.productionJobs[id]=save.productionJobs[id]||null;if(save.crafted)this.crafted={...this.crafted,...save.crafted};}
      this.buildingLevels.coop=Math.max(this.buildingLevels.coop,this.buildings.coopLevel);this.buildingLevels.barn=Math.max(this.buildingLevels.barn,this.buildings.barnLevel);this.buildingLevels.silo=Math.max(this.buildingLevels.silo,this.buildings.warehouseLevel);this.waterUnits=Math.min(this.waterUnits,this.waterCapacity);
       if (save.version >= 6 && save.produce) this.produce = {...this.produce,...save.produce};
      this.animals=this.animals.map(a=>({...a,assigned:a.assigned!==false,growthFeedings:Math.max(0,Math.min(3,Number(a.growthFeedings)||0))}));
      if (save.version >= 3) { this.animals = Array.isArray(save.animals) ? save.animals.map((a:Animal)=>({...a,assigned:a.assigned!==false,growthFeedings:Math.max(0,Math.min(3,Number(a.growthFeedings)||0))})) : []; this.harvests = Number(save.harvests) || 0; }
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
    } catch (error) {
      // Never turn an unreadable existing save into a new starter farm automatically.
      this.persistenceBlocked = true;
      console.error('Happy Farm could not read its existing save. Automatic writes are paused to protect it:', error);
      const status = document.getElementById('cloud-save-status');
      if (status) status.textContent = 'Save unreadable · automatic writes paused to protect your farm';
    }
  }

  private saveFarm(): void {
    const save: FarmSave = {
      version: 19,
      water:this.waterUnits,
      waterCollectedAt:this.waterCollectedAt,
      landTiles:[...this.landTiles],
      landExpansionCount:this.landExpansionCountValue,
      harvestedCrops:{...this.harvestedCrops},
      fruitInventory:{...this.fruitInventory},
      fruitTreeReadyAt:{...this.fruitTreeReadyAt},
      farmerName:this.farmerName,
      farmName:this.farmName,
      buildingLevels:{...this.buildingLevels},
      productionJobs:{...this.productionJobs},
      crafted:{...this.crafted},
      workshopCompost:this.workshopCompost,
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
      storedDecor:[...this.storedDecor],
      inventory: {...this.inventory},
      feed: {...this.feed},
      buildings: {...this.buildings},
      produce: {...this.produce},
      plots: Array.from(this.plots.values()).map(plot => ({
        col: plot.col, row: plot.row, state: plot.state, watered: plot.watered, growth: plot.growth, crop:plot.crop, readyAt:plot.readyAt, witherAt:plot.witherAt,
      })),
    };
    try {
      if (this.persistenceBlocked) {
        const status = document.getElementById('cloud-save-status');
        if (status) status.textContent = 'Save protection active · no changes written';
        return;
      }
      // Keep a rolling recovery history before replacing the current local save.
      // The newest snapshot is written only after the previous one is safely archived.
      const backupKey = 'happyFarmRecoveryBackupsV1';
      const previousRaw = localStorage.getItem(this.saveKey);
      if (previousRaw) {
        try {
          const previous = JSON.parse(previousRaw) as Record<string, unknown>;
          const backupsRaw = localStorage.getItem(backupKey);
          const backups = backupsRaw ? JSON.parse(backupsRaw) as Array<{ savedAt: number; save: Record<string, unknown> }> : [];
          const isDuplicate = backups.some(entry => JSON.stringify(entry.save) === previousRaw);
          if (!isDuplicate) {
            backups.unshift({ savedAt: Date.now(), save: previous });
            // Keep up to 12 distinct previous snapshots, including developed farms.
            localStorage.setItem(backupKey, JSON.stringify(backups.slice(0, 12)));
          }
        } catch (backupError) {
          // Fail closed: never replace the only known-good save if its recovery copy failed.
          this.persistenceBlocked = true;
          console.error('Happy Farm could not create a local recovery copy; save overwrite blocked:', backupError);
          const status = document.getElementById('cloud-save-status');
          if (status) status.textContent = 'Recovery copy failed · save overwrite blocked to protect your farm';
          return;
        }
      }
      localStorage.setItem(this.saveKey, JSON.stringify(save));
      localStorage.setItem('happyFarmLocalUpdatedAtV1', String(Math.max(Date.now(), Number(localStorage.getItem('happyFarmLocalUpdatedAtV1') || 0) + 1)));
      queueCloudSave();
    } catch (error) {
      // Storage may be disabled or full. Keep the previous save untouched and warn visibly.
      console.error('Happy Farm could not write the local save:', error);
      const status = document.getElementById('cloud-save-status');
      if (status) status.textContent = 'Local save failed · previous farm data preserved';
    }
  }

  private refreshHud(): void {
    const coins = document.getElementById('coins');
    const xp = document.getElementById('xp');
    const waterMeter=document.getElementById('water-count');if(waterMeter)waterMeter.textContent=this.waterUnits+' / '+this.waterCapacity;
    if (coins) coins.textContent = String(this.coins);
    const level = this.farmerLevel;
    if(level>this.displayedLevel){const bonus=level*20;this.coins+=bonus;this.displayedLevel=level;this.toast('Level '+level+' reached! Farmhouse upgraded · +'+bonus+' coins.');}
    if(level!==this.displayedLevel||level!==this.farmhouseVisualLevel)this.redrawFarmTiles();
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
    if (progress) progress.textContent = this.farmerLevel >= 100 ? `${this.xp.toLocaleString()} total XP · MAX` : `${this.levelProgress} / ${this.xpNeededForNextLevel} XP · ${this.xp.toLocaleString()} total`;
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
    const actions: Record<Tool, string> = { select: 'Choose a tool to work this plot.', plow: 'Plow open or withered land to prepare the soil.', plant: `Plant ${CROPS[this.selectedCrop].name} · ${CROPS[this.selectedCrop].cost} coins per field.`, harvest: this.selected.state === 'withered' ? 'This crop has withered. Select Plow to clear the plot.' : 'Harvest ripe crops before their harvest window closes.', move: 'Drag a tree, farmhouse, barn, silo or animal pen to a new grid position.', store: 'Tap a placed tree, decoration or building to move it into your inventory.', remove: 'Tap a placed tree, decoration or building to permanently remove it.', 'feed-hen':'Select Hen Feed, then tap a hungry hen to feed it.', 'feed-cow':'Select Cow Feed, then tap a hungry cow to feed it.' };
    host.innerHTML = `<span class="selection-kicker">LAND · ${this.selected.col + 1}, ${this.selected.row + 1}</span><strong>${names[this.selected.state]}</strong><p>${actions[this.activeTool]}</p>`;
  }
}
