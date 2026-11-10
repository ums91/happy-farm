import Phaser from 'phaser';

type Tool = 'select' | 'plow' | 'plant' | 'water' | 'harvest';
type PlotState = 'grass' | 'tilled' | 'growing' | 'ready';
type CropId = 'wheat' | 'carrot' | 'corn' | 'strawberry';
interface Plot { col: number; row: number; state: PlotState; watered: boolean; growth: number; crop: CropId; readyAt: number }
type AnimalId = 'hen' | 'cow';
interface Animal { id: AnimalId; readyAt: number }
interface FarmSave { version: 3; animals: Animal[]; harvests: number; coins: number; xp: number; inventory: Record<CropId, number>; plots: Array<{ col:number; row:number; state:PlotState; watered:boolean; growth:number; crop?:CropId; readyAt?:number }> }
const CROPS: Record<CropId,{name:string;emoji:string;cost:number;reward:number;xp:number;growMs:number;color:number}> = {
 wheat:{name:'Wheat',emoji:'🌾',cost:5,reward:18,xp:5,growMs:15000,color:0xe4b83f},
 carrot:{name:'Carrot',emoji:'🥕',cost:9,reward:31,xp:8,growMs:22000,color:0xef873e},
 corn:{name:'Corn',emoji:'🌽',cost:14,reward:48,xp:12,growMs:30000,color:0xf2c94c},
 strawberry:{name:'Strawberry',emoji:'🍓',cost:20,reward:70,xp:18,growMs:42000,color:0xd94f55}
};

const COLS = 13;
const ROWS = 11;
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
  private activeTool: Tool = 'select';
  private coins = 250;
  private xp = 0;
  private inventory: Record<CropId,number> = {wheat:3,carrot:0,corn:0,strawberry:0};
  private selectedCrop: CropId = 'wheat';
  private animals: Animal[] = [];
  private harvests = 0;
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
    this.drawScenery();
    this.bindWorldInput();
    this.bindToolbar();
    this.bindMarket();
    this.refreshHud();
    this.refreshSelection();
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.55, 1.35));
    });
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
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const point = this.toWorld(col, row);
        this.plots.set(this.key(col, row), { col, row, state: 'grass', watered: false, growth: 0, crop: 'wheat', readyAt: 0 });
        const shades = [0x9bcf69, 0xa5d875, 0x94c762, 0xaedb7d, 0x9fce70];
        this.diamond(this.plotGraphics, point.x, point.y, shades[(col * 7 + row * 11) % shades.length] ?? 0x9bcf69, 0x78ae54);
        if ((col * 3 + row * 5) % 13 === 0) this.drawGrassTuft(point.x, point.y);
      }
    }
    this.drawPath();
    this.drawFence();
    this.drawFlowerPatches();
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

  private drawScenery(): void {
    const g = this.add.graphics();
    [[1, 1], [3, 0], [5, 1], [7, 0], [10, 1], [12, 2]].forEach(([col, row], i) => {
      const p = this.toWorld(col!, row!);
      g.fillStyle(0x765338, 1);
      g.fillRoundedRect(p.x - 5, p.y - 26, 10, 31, 3);
      g.fillStyle([0x4c8b43, 0x5b9a48, 0x6da74f][i % 3] ?? 0x4c8b43, 1);
      g.fillCircle(p.x, p.y - 37, 21);
      g.fillCircle(p.x - 13, p.y - 29, 14);
      g.fillCircle(p.x + 13, p.y - 29, 14);
      g.fillCircle(p.x - 8, p.y - 48, 12);
      g.fillStyle(0x8cbd5d, 0.8);
      g.fillCircle(p.x - 7, p.y - 46, 5);
      g.fillStyle(0xe7a5a0, 0.9);
      if (i % 2 === 0) g.fillCircle(p.x + 10, p.y - 35, 3);
    });
    const home = this.toWorld(5, 2);
    const barn = this.toWorld(9, 3);
    this.drawBuilding(g, home.x, home.y - 12, 0xd9c28c, 0x9c5544, 'HOME');
    this.drawBuilding(g, barn.x, barn.y - 15, 0xc66f54, 0x864338, 'BARN');
    const silo = this.toWorld(11, 3);
    g.fillStyle(0xe4e4d5, 1);
    g.fillRoundedRect(silo.x + 18, silo.y - 49, 25, 55, 8);
    g.fillStyle(0xb8c4b3, 1);
    g.fillEllipse(silo.x + 30, silo.y - 49, 25, 11);
    this.drawAnimalPen(g);
  }

  private drawAnimalPen(g: Phaser.GameObjects.Graphics): void {
    const p = this.toWorld(2, 5);
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
    // Friendly stylized cow and hen placeholders inside the paddock.
    g.fillStyle(0xf8f4e8, 1);
    g.fillEllipse(p.x - 13, p.y - 10, 27, 18);
    g.fillStyle(0x55483d, 1);
    g.fillEllipse(p.x - 19, p.y - 14, 9, 7);
    g.fillEllipse(p.x - 5, p.y - 6, 8, 6);
    g.fillEllipse(p.x - 2, p.y - 17, 13, 12);
    g.fillStyle(0xe8b7a0, 1);
    g.fillEllipse(p.x - 2, p.y - 13, 7, 5);
    g.fillStyle(0xf4e5c8, 1);
    g.fillEllipse(p.x + 20, p.y - 9, 12, 10);
    g.fillStyle(0xd95f42, 1);
    g.fillTriangle(p.x + 24, p.y - 14, p.x + 29, p.y - 14, p.x + 27, p.y - 19);
    g.fillStyle(0x4c4034, 1);
    g.fillCircle(p.x + 23, p.y - 11, 1.5);
  }

  private drawBuilding(g: Phaser.GameObjects.Graphics, x: number, y: number, wall: number, roof: number, label: string): void {
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(x + 4, y + 11, 86, 27);
    g.fillStyle(wall, 1);
    g.fillRect(x - 31, y - 36, 62, 42);
    g.fillStyle(roof, 1);
    g.beginPath();
    g.moveTo(x - 42, y - 34);
    g.lineTo(x, y - 66);
    g.lineTo(x + 42, y - 34);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x704c37, 1);
    g.fillRect(x - 8, y - 5, 16, 11);
    g.fillStyle(0xf1e5bd, 1);
    g.fillRect(x - 24, y - 23, 11, 11);
    g.fillRect(x + 13, y - 23, 11, 11);
    g.fillStyle(0xffffff, 0.85);
    g.fillRoundedRect(x - 25, y + 12, 50, 14, 5);
    g.fillStyle(0x435b32, 1);
    this.add.text(x, y + 19, label, { fontFamily: 'Arial', fontSize: '8px', fontStyle: 'bold', color: '#435b32' }).setOrigin(0.5);
  }

  private bindWorldInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
        this.cameraDragging = true;
        this.dragPoint.set(pointer.x, pointer.y);
        return;
      }
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tile = this.toTile(world.x, world.y);
      if (!tile) return;
      const plot = this.plots.get(this.key(tile.col, tile.row));
      if (!plot) return;
      this.selected = plot;
      this.applyTool(plot);
      this.refreshSelection();
      this.drawSelection();
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.cameraDragging && pointer.isDown) {
        this.cameras.main.scrollX -= (pointer.x - this.dragPoint.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - this.dragPoint.y) / this.cameras.main.zoom;
        this.dragPoint.set(pointer.x, pointer.y);
      }
    });
    this.input.on('pointerup', () => { this.cameraDragging = false; });
    this.input.on('pointerupoutside', () => { this.cameraDragging = false; });
    this.input.mouse?.disableContextMenu();
  }

  private applyTool(plot: Plot): void {
    switch (this.activeTool) {
      case 'plow':
        if (plot.state === 'grass') plot.state = 'tilled';
        break;
      case 'plant':
        if (plot.state === 'tilled' && this.inventory[this.selectedCrop] > 0) { plot.state = 'growing'; plot.crop = this.selectedCrop; plot.growth = 0; this.inventory[this.selectedCrop]--; this.scheduleGrowth(plot, CROPS[this.selectedCrop].growMs); }
        break;
      case 'water':
        if (plot.state === 'growing' && !plot.watered) { plot.watered = true; this.scheduleGrowth(plot, Math.max(1500, Math.ceil((plot.readyAt - Date.now()) / 2))); }
        break;
      case 'harvest':
        if (plot.state === 'ready') { const crop=CROPS[plot.crop]; plot.state='tilled'; plot.growth=0; plot.readyAt=0; plot.watered=false; this.growthTimers.get(this.key(plot.col,plot.row))?.remove(false); this.growthTimers.delete(this.key(plot.col,plot.row)); this.coins+=crop.reward; this.xp+=crop.xp; this.harvests += 1; this.toast(`${crop.emoji} ${crop.name} harvested · +${crop.reward} coins`); }
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
    this.growthTimers.get(id)?.remove(false);
    this.growthTimers.set(id, this.time.delayedCall(delay, () => {
      plot.state = 'ready';
      plot.growth = 100;
      plot.readyAt = 0;
      this.redrawPlot(plot);
      if (this.selected === plot) this.refreshSelection();
      this.saveFarm();
    }));
  }

  private redrawPlot(plot: Plot): void {
    const id = this.key(plot.col, plot.row);
    this.plotOverlays.get(id)?.destroy();
    this.plotOverlays.delete(id);
    if (plot.state === 'grass') return;
    const p = this.toWorld(plot.col, plot.row);
    const g = this.add.graphics();
    this.plotOverlays.set(id, g);
    this.diamond(g, p.x, p.y, 0x805332, 0x68452f);
    g.lineStyle(2, 0xb78655, 0.9);
    for (let i = -2; i <= 2; i += 1) {
      g.beginPath();
      g.moveTo(p.x - 25, p.y + i * 5);
      g.lineTo(p.x + 25, p.y + i * 5);
      g.strokePath();
    }
    if (plot.state === 'growing' || plot.state === 'ready') this.drawCrop(g, p.x, p.y, plot);
  }

  private drawCrop(g: Phaser.GameObjects.Graphics, x: number, y: number, plot: Plot): void {
    const height = plot.state === 'ready' ? 25 : 10;
    g.lineStyle(3, 0x397d39, 1);
    g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x - 2, y - height); g.strokePath();
    g.beginPath(); g.moveTo(x - 1, y - height * 0.45); g.lineTo(x - 12, y - height * 0.7); g.strokePath();
    g.beginPath(); g.moveTo(x - 1, y - height * 0.65); g.lineTo(x + 11, y - height * 0.9); g.strokePath();
    g.fillStyle(plot.state === 'ready' ? CROPS[plot.crop].color : 0x70a94f, 1);
    g.fillCircle(x - 2, y - height, plot.state === 'ready' ? 5 : 3);
    if (plot.state === 'ready') {
      g.fillStyle(0xf6d86b, 1);
      g.fillEllipse(x - 9, y - 12, 8, 5);
      g.fillEllipse(x + 7, y - 17, 8, 5);
      g.fillStyle(0x4f8d3c, 1);
      g.fillEllipse(x + 10, y - 7, 9, 5);
    } else {
      g.fillStyle(0x75b85a, 1);
      g.fillEllipse(x - 8, y - 7, 8, 4);
      g.fillEllipse(x + 7, y - 9, 8, 4);
    }
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

  private bindToolbar(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(button => {
      button.addEventListener('click', () => {
        this.activeTool = button.dataset.tool as Tool;
        document.querySelectorAll('[data-tool]').forEach(el => el.classList.remove('active'));
        button.classList.add('active');
        this.refreshSelection();
      });
    });
  }


  private bindMarket(): void {
    document.getElementById('market-open')?.addEventListener('click',()=>this.openMarket());
    document.getElementById('inventory-open')?.addEventListener('click',()=>this.openMarket());
    document.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(x=>x.addEventListener('click',()=>this.closeMarket()));
    document.getElementById('market-modal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)this.closeMarket();});
    document.querySelectorAll<HTMLButtonElement>('[data-market-tab]').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('[data-market-tab]').forEach(x=>x.classList.remove('active'));tab.classList.add('active');const cat=tab.dataset.marketTab||'seeds';const intro=document.getElementById('market-intro');if(intro)intro.textContent=cat==='seeds'?'Buy seeds, then choose Plant and tap a prepared field.':'Animal care and farm decorations are planned for a coming update.';this.renderMarket(cat);}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')this.closeMarket();});
    document.getElementById('animal-action')?.addEventListener('click',()=>this.careForAnimals());
  }
  private careForAnimals(): void { if(!this.animals.length){this.openMarket();document.querySelector<HTMLButtonElement>('[data-market-tab=animals]')?.click();return;} let collected=0,fed=0;const now=Date.now();for(const a of this.animals){if(a.readyAt>0&&a.readyAt<=now){this.coins+=a.id==='hen'?12:28;this.xp+=a.id==='hen'?3:6;a.readyAt=0;collected++;}if(a.readyAt===0){a.readyAt=now+(a.id==='hen'?45000:60000);fed++;}}this.saveFarm();this.refreshHud();this.toast('Collected '+collected+' product(s); fed '+fed+' animal(s).');}
  private openMarket(): void {document.getElementById('market-modal')?.classList.add('open');document.getElementById('market-modal')?.setAttribute('aria-hidden','false');this.renderMarket();}
  private closeMarket(): void {document.getElementById('market-modal')?.classList.remove('open');document.getElementById('market-modal')?.setAttribute('aria-hidden','true');}
  private renderMarket(category='seeds'): void {
    const host=document.getElementById('market-items');if(!host)return;
    if(category==='animals'){host.innerHTML='<article class="market-item"><div class="market-art">🐔</div><div class="market-copy"><strong>Happy Hen</strong><small>Lays an egg after feeding · owned: '+this.animals.filter(a=>a.id==='hen').length+'</small></div><button class="market-buy" data-buy-animal="hen" '+(this.coins<75?'disabled':'')+'>🪙 75 · Buy</button></article><article class="market-item"><div class="market-art">🐄</div><div class="market-copy"><strong>Daisy Cow</strong><small>Produces milk after feeding · owned: '+this.animals.filter(a=>a.id==='cow').length+'</small></div><button class="market-buy" data-buy-animal="cow" '+(this.coins<160?'disabled':'')+'>🪙 160 · Buy</button></article>';host.querySelectorAll<HTMLButtonElement>('[data-buy-animal]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buyAnimal as AnimalId;const cost=id==='hen'?75:160;if(this.coins<cost)return;this.coins-=cost;this.animals.push({id,readyAt:0});this.saveFarm();this.refreshHud();this.toast('A new animal joined your farm!');this.renderMarket('animals');}));return;} if(category==='decor'){host.innerHTML='<article class="market-item"><div class="market-art">🌷</div><div class="market-copy"><strong>Decorations</strong><small>Placeable decorations are coming in a future update.</small></div></article>';return;}
    host.innerHTML=(Object.entries(CROPS) as Array<[CropId,typeof CROPS[CropId]]>).map(([id,crop])=>`<article class="market-item"><div class="market-art">${crop.emoji}</div><div class="market-copy"><strong>${crop.name}</strong><small>${crop.growMs/1000}s · reward ${crop.reward} coins · bag: ${this.inventory[id]}</small></div><button class="market-buy" data-buy-seed="${id}" ${this.coins<crop.cost?'disabled':''}>🪙 ${crop.cost} · Buy</button></article>`).join('');
    host.querySelectorAll<HTMLButtonElement>('[data-buy-seed]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buySeed as CropId;const crop=CROPS[id];if(!crop||this.coins<crop.cost)return;this.coins-=crop.cost;this.inventory[id]++;this.selectedCrop=id;this.saveFarm();this.refreshHud();this.refreshSelection();this.toast(`${crop.emoji} ${crop.name} seeds added to your bag`);}));
  }
  private toast(message:string): void {const el=document.getElementById('game-toast');if(!el)return;el.textContent=message;el.classList.add('show');window.setTimeout(()=>el.classList.remove('show'),2200);}

  private loadFarm(): void {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (!raw) return;
      const save = JSON.parse(raw) as any;
      if (![1,2,3].includes(save.version) || !Array.isArray(save.plots)) return;
      this.coins = Math.max(0, Math.floor(save.coins));
      this.xp = Math.max(0, Math.floor(save.xp));
      if (save.version >= 2 && save.inventory) this.inventory = {...this.inventory,...save.inventory};
      if (save.version >= 3) { this.animals = Array.isArray(save.animals) ? save.animals : []; this.harvests = Number(save.harvests) || 0; }
      for (const saved of save.plots) {
        const plot = this.plots.get(this.key(saved.col, saved.row));
        if (!plot || !['grass', 'tilled', 'growing', 'ready'].includes(saved.state)) continue;
        plot.state = saved.state;
        plot.watered = Boolean(saved.watered);
        plot.growth = saved.growth === 100 ? 100 : 0;
        if (saved.crop && saved.crop in CROPS) plot.crop = saved.crop;
        plot.readyAt = saved.readyAt || 0;
        if (plot.state === 'growing') { const remaining=plot.readyAt ? plot.readyAt-Date.now() : (plot.watered ? 5000 : CROPS[plot.crop].growMs); if (remaining<=0) {plot.state='ready';plot.growth=100;plot.readyAt=0;} else this.scheduleGrowth(plot,remaining); }
        this.redrawPlot(plot);
      }
    } catch {
      // Ignore malformed or unavailable browser storage and start a fresh farm.
    }
  }

  private saveFarm(): void {
    const save: FarmSave = {
      version: 3,
      animals: this.animals,
      harvests: this.harvests,
      coins: this.coins,
      xp: this.xp,
      inventory: {...this.inventory},
      plots: Array.from(this.plots.values()).map(plot => ({
        col: plot.col, row: plot.row, state: plot.state, watered: plot.watered, growth: plot.growth, crop:plot.crop, readyAt:plot.readyAt,
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
    if (xp) xp.textContent = `Level 1 · ${this.xp} XP`;
    const progress = document.getElementById('progress-text');
    const fill = document.getElementById('progress-fill');
    if (progress) progress.textContent = `${this.xp % 100} / 100 XP`;
    if (fill) (fill as HTMLElement).style.width = `${this.xp % 100}%`;
    const animalStatus=document.getElementById('animal-status'); if(animalStatus){const ready=this.animals.filter(a=>a.readyAt>0&&a.readyAt<=Date.now()).length;animalStatus.textContent=this.animals.length?this.animals.length+' animal(s) · '+ready+' product(s) ready. Feed them to start production.':'No animals yet. Buy a hen or cow in the Market.';}
    const w=document.getElementById('wheat-count'); if(w) w.textContent=String(this.inventory.wheat);
    const inv=document.getElementById('inventory-count'); if(inv) inv.textContent=String(Object.values(this.inventory).reduce((a,b)=>a+b,0));
    const bal=document.getElementById('market-balance'); if(bal) bal.textContent=`${this.coins} coins`;
    this.renderMarket();
  }

  private refreshSelection(): void {
    const host = document.getElementById('selection');
    if (!host) return;
    if (!this.selected) {
      host.innerHTML = '<span class="selection-kicker">SELECTED LAND</span><strong>Choose a plot</strong><p>Select a field tile to see what you can do there.</p>';
      return;
    }
    const names: Record<PlotState, string> = { grass: 'Open grassland', tilled: 'Freshly plowed soil', growing: 'Growing crop', ready: 'Ready to harvest' };
    const actions: Record<Tool, string> = { select: 'Choose a tool to work this plot.', plow: 'Plow open grass to prepare the soil.', plant: `Plant ${CROPS[this.selectedCrop].name} · ${this.inventory[this.selectedCrop]} seeds in your bag.`, water: 'Water once to cut remaining growth time in half.', harvest: 'Harvest your crop for coins and experience.' };
    host.innerHTML = `<span class="selection-kicker">LAND · ${this.selected.col + 1}, ${this.selected.row + 1}</span><strong>${names[this.selected.state]}</strong><p>${actions[this.activeTool]}</p>`;
  }
}
