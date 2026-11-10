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
  private animalActors: Phaser.GameObjects.Container[] = [];
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
    this.renderOwnedAnimals();
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
        this.plots.set(this.key(col, row), { col, row, state: 'grass', watered: false, growth: 0, crop: 'wheat', readyAt: 0 });
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
    // Layered orchard trees: trunk, canopy shadow, clustered leaves and sunlit highlights.
    [[1, 1], [3, 0], [5, 1], [7, 0], [10, 1], [12, 2], [0, 7], [12, 7]].forEach(([col, row], i) => {
      const p = this.toWorld(col!, row!);
      const palette = [0x397b3c, 0x4b8d43, 0x5b9948, 0x47833d];
      g.fillStyle(0x3f6e38, 0.24);
      g.fillEllipse(p.x + 5, p.y + 4, 62, 17);
      g.fillStyle(0x765338, 1);
      g.fillRoundedRect(p.x - 6, p.y - 28, 12, 37, 3);
      g.fillStyle(0x65452f, 0.55);
      g.fillRect(p.x - 2, p.y - 24, 3, 28);
      g.fillStyle(palette[i % palette.length]!, 1);
      g.fillCircle(p.x, p.y - 42, 24);
      g.fillCircle(p.x - 17, p.y - 34, 17);
      g.fillCircle(p.x + 17, p.y - 34, 17);
      g.fillCircle(p.x - 9, p.y - 56, 15);
      g.fillCircle(p.x + 10, p.y - 54, 14);
      g.fillStyle(0x8fc96a, 0.85);
      g.fillCircle(p.x - 10, p.y - 55, 9);
      g.fillCircle(p.x + 12, p.y - 43, 6);
      if (i % 3 === 0) {
        g.fillStyle(0xe8a34b, 1);
        g.fillCircle(p.x + 18, p.y - 30, 3);
        g.fillCircle(p.x - 18, p.y - 42, 3);
      }
    });
    // Small garden beds and stepping stones around the homestead.
    const home = this.toWorld(5, 2);
    const barn = this.toWorld(9, 3);
    this.drawBuilding(g, home.x, home.y - 12, 0xe7d4a0, 0xa84f3c, 'FARMHOUSE');
    this.drawBuilding(g, barn.x, barn.y - 15, 0xc97855, 0x8e3e35, 'BARN');
    const silo = this.toWorld(11, 3);
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
    // The paddock is populated only by animals the player has purchased.
    g.fillStyle(0x6f9d45, 0.25);
    g.fillEllipse(p.x, p.y + 12, 70, 12);
  }

  private renderOwnedAnimals(): void {
    this.animalActors.forEach(actor => actor.destroy());
    this.animalActors = [];
    const pen = this.toWorld(2, 5);
    this.animals.forEach((animal, index) => {
      const startX = pen.x - 25 + (index % 4) * 17;
      const startY = pen.y - 7 + Math.floor(index / 4) * 9;
      const actor = this.add.container(startX, startY);
      actor.setDepth(startY + index);
      actor.add(this.add.ellipse(0, 8, animal.id === 'cow' ? 34 : 22, 8, 0x304b2a, 0.24));
      const legs: Phaser.GameObjects.Graphics[] = [];
      const legCount = animal.id === 'cow' ? 4 : 2;
      for (let leg = 0; leg < legCount; leg += 1) {
        const limb = this.add.graphics();
        const lx = animal.id === 'cow' ? (leg % 2 === 0 ? -10 : 8) : (leg === 0 ? -5 : 4);
        limb.lineStyle(animal.id === 'cow' ? 4 : 2.5, animal.id === 'cow' ? 0xf5f0df : 0xd69a3d, 1);
        limb.beginPath(); limb.moveTo(lx, -3); limb.lineTo(lx + (leg % 2 ? 1 : -1), animal.id === 'cow' ? 8 : 6); limb.strokePath();
        if (animal.id === 'cow') { limb.fillStyle(0x4d443c, 1); limb.fillRoundedRect(lx - 2, 5, 5, 3, 1); }
        actor.add(limb); legs.push(limb);
      }
      const body = this.add.graphics();
      if (animal.id === 'cow') {
        body.fillStyle(0xfaf6e9, 1); body.fillEllipse(-1, -12, 34, 23);
        body.fillStyle(0x4b443e, 1); body.fillEllipse(-10, -17, 11, 9); body.fillEllipse(5, -7, 10, 8); body.fillEllipse(-2, -5, 6, 5);
        body.fillStyle(0xf7f1e3, 1); body.fillEllipse(14, -19, 18, 18); body.fillEllipse(19, -15, 13, 11);
        body.fillStyle(0xe9bca8, 1); body.fillEllipse(23, -11, 13, 9);
        body.fillStyle(0xfaf6e9, 1); body.fillTriangle(10, -24, 7, -31, 15, -27); body.fillTriangle(20, -25, 27, -31, 26, -23);
        body.fillStyle(0xd9b878, 1); body.fillTriangle(13, -25, 15, -31, 17, -24); body.fillTriangle(22, -25, 24, -30, 26, -23);
        body.fillStyle(0x3d342e, 1); body.fillCircle(20, -18, 1.5); body.fillCircle(27, -12, 1);
        body.fillStyle(0xe7b9a4, 1); body.fillEllipse(1, -1, 11, 8);
        body.lineStyle(2, 0xf7f1e3, 1); body.beginPath(); body.moveTo(-16, -15); body.lineTo(-22, -8); body.strokePath();
        body.lineStyle(3, 0x4b443e, 1); body.beginPath(); body.moveTo(-22, -8); body.lineTo(-25, -5); body.strokePath();
      } else {
        body.fillStyle(0xf5e9cb, 1); body.fillEllipse(0, -9, 25, 20);
        body.fillStyle(0xfff9e9, 1); body.fillEllipse(-8, -12, 11, 11);
        body.fillStyle(0xe3c99d, 1); body.fillEllipse(-2, -8, 13, 9);
        body.fillStyle(0xd95f42, 1); body.fillEllipse(4, -21, 5, 5); body.fillCircle(9, -20, 3);
        body.fillTriangle(10, -13, 19, -10, 10, -8);
        body.fillStyle(0x40372f, 1); body.fillCircle(7, -15, 1.5);
        body.fillStyle(0xfff5e0, 1); body.fillTriangle(-10, -12, -18, -18, -13, -7);
      }
      actor.add(body);
      if (animal.id === 'hen') {
        const wing = this.add.graphics(); wing.fillStyle(0xe5c99a, 1); wing.fillEllipse(-5, -8, 11, 7);
        wing.lineStyle(1, 0xc7a97c, 0.9); wing.beginPath(); wing.moveTo(-9, -8); wing.lineTo(-3, -5); wing.strokePath();
        actor.add(wing);
        this.tweens.add({ targets: wing, angle: -9, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: index * 130 });
      }
      this.animalActors.push(actor);
      const roam = 8 + (index % 3) * 4, walkDuration = 2200 + (index % 4) * 350;
      this.tweens.add({ targets: actor, x: startX + roam, duration: walkDuration, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: index * 190,
        onYoyo: () => actor.setScale(-1, 1), onRepeat: () => actor.setScale(1, 1) });
      this.tweens.add({ targets: actor, y: startY - (animal.id === 'cow' ? 1.5 : 2.5), duration: 360, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: index * 80 });
      legs.forEach((leg, legIndex) => this.tweens.add({ targets: leg, angle: (legIndex % 2 === 0 ? 1 : -1) * 17,
        duration: 190 + (legIndex % 2) * 30, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: index * 110 + legIndex * 75 }));
      if (animal.id === 'cow') this.tweens.add({ targets: body, angle: 1.5, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: index * 100 });
    });
  }

  private drawBuilding(g: Phaser.GameObjects.Graphics, x: number, y: number, wall: number, roof: number, label: string): void {
    // Ground shadow and foundation.
    g.fillStyle(0x385a31, 0.24);
    g.fillEllipse(x + 4, y + 13, 108, 31);
    g.fillStyle(0x8b704a, 1);
    g.fillRoundedRect(x - 38, y + 1, 76, 9, 3);
    // Side wall adds an isometric side plane.
    g.fillStyle(Phaser.Display.Color.IntegerToColor(wall).darken(18).color, 1);
    g.fillPoints([{x:x + 31,y:y - 34},{x:x + 43,y:y - 26},{x:x + 43,y:y + 8},{x:x + 31,y:y + 5}], true);
    g.fillStyle(wall, 1);
    g.fillRect(x - 31, y - 36, 62, 42);
    g.fillStyle(0xf4e5bd, 1);
    g.fillRect(x - 31, y - 36, 62, 5);
    // Roof with a darker fascia and a warm sunlit front.
    g.fillStyle(0x603b31, 1);
    g.fillTriangle(x - 47, y - 32, x, y - 72, x + 47, y - 32);
    g.fillStyle(roof, 1);
    g.beginPath();
    g.moveTo(x - 43, y - 35);
    g.lineTo(x, y - 69);
    g.lineTo(x + 43, y - 35);
    g.lineTo(x + 31, y - 29);
    g.lineTo(x, y - 58);
    g.lineTo(x - 31, y - 29);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0xf0b879, 0.8);
    g.beginPath(); g.moveTo(x, y - 65); g.lineTo(x, y - 57); g.strokePath();
    // Door, windows, flower boxes and chimney.
    g.fillStyle(0x69442f, 1);
    g.fillRoundedRect(x - 8, y - 8, 16, 14, 2);
    g.fillStyle(0xd9b77d, 1);
    g.fillCircle(x + 4, y - 1, 1.3);
    g.fillStyle(0x9dd9e8, 1);
    g.fillRect(x - 25, y - 24, 12, 12);
    g.fillRect(x + 13, y - 24, 12, 12);
    g.lineStyle(2, 0xf8edcf, 1);
    g.strokeRect(x - 25, y - 24, 12, 12);
    g.strokeRect(x + 13, y - 24, 12, 12);
    g.lineStyle(2, 0xf8edcf, 0.9);
    g.beginPath(); g.moveTo(x - 19, y - 24); g.lineTo(x - 19, y - 12); g.moveTo(x - 25, y - 18); g.lineTo(x - 13, y - 18); g.strokePath();
    g.beginPath(); g.moveTo(x + 19, y - 24); g.lineTo(x + 19, y - 12); g.moveTo(x + 13, y - 18); g.lineTo(x + 25, y - 18); g.strokePath();
    g.fillStyle(0xffffff, 0.92);
    g.fillRoundedRect(x - 35, y + 12, 70, 15, 6);
    this.add.text(x, y + 19, label, { fontFamily: 'Arial', fontSize: '8px', fontStyle: 'bold', color: '#526c39' }).setOrigin(0.5);
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
    document.getElementById('inventory-open')?.addEventListener('click',()=>this.openInventory());
    document.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(x=>x.addEventListener('click',()=>this.closeMarket()));
    document.getElementById('market-modal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)this.closeMarket();});
    document.querySelectorAll<HTMLButtonElement>('[data-market-tab]').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('[data-market-tab]').forEach(x=>x.classList.remove('active'));tab.classList.add('active');const cat=tab.dataset.marketTab||'seeds';const intro=document.getElementById('market-intro');if(intro)intro.textContent=cat==='seeds'?'Buy seeds, then choose Plant and tap a prepared field.':'Animal care and farm decorations are planned for a coming update.';this.renderMarket(cat);}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')this.closeMarket();});
    document.getElementById('animal-action')?.addEventListener('click',()=>this.careForAnimals());
  }
  private careForAnimals(): void { if(!this.animals.length){this.openMarket();document.querySelector<HTMLButtonElement>('[data-market-tab=animals]')?.click();return;} let collected=0,fed=0;const now=Date.now();for(const a of this.animals){if(a.readyAt>0&&a.readyAt<=now){this.coins+=a.id==='hen'?12:28;this.xp+=a.id==='hen'?3:6;a.readyAt=0;collected++;}if(a.readyAt===0){a.readyAt=now+(a.id==='hen'?45000:60000);fed++;}}this.saveFarm();this.refreshHud();this.toast('Collected '+collected+' product(s); fed '+fed+' animal(s).');}
  private openMarket(): void {
    const modal=document.getElementById('market-modal');
    const title=modal?.querySelector('.market-header h2'); if(title) title.textContent='Farm Market';
    modal?.querySelector('.market-tabs')?.classList.remove('inventory-hidden');
    const intro=document.getElementById('market-intro'); if(intro) intro.textContent='Buy seeds and animals to grow your farm.';
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
  private renderInventory(): void {
    const host=document.getElementById('market-items'); if(!host) return;
    const seedCards=(Object.entries(CROPS) as Array<[CropId,typeof CROPS[CropId]]>).map(([id,crop])=>'<article class="market-item"><div class="market-art">'+crop.emoji+'</div><div class="market-copy"><strong>'+crop.name+' Seeds</strong><small>Ready to plant in a plowed field</small></div><span class="inventory-quantity">× '+this.inventory[id]+'</span></article>').join('');
    const hens=this.animals.filter(a=>a.id==='hen'); const cows=this.animals.filter(a=>a.id==='cow');
    const animalCard=(emoji:string,name:string,items:Animal[])=>'<article class="market-item"><div class="market-art">'+emoji+'</div><div class="market-copy"><strong>'+name+'</strong><small>'+(items.length?items.filter(a=>a.readyAt>0&&a.readyAt<=Date.now()).length+' product(s) ready · '+items.filter(a=>a.readyAt>Date.now()).length+' producing':'None owned')+'</small></div><span class="inventory-quantity">× '+items.length+'</span></article>';
    const growing=Array.from(this.plots.values()).filter(p=>p.state==='growing').length; const ready=Array.from(this.plots.values()).filter(p=>p.state==='ready').length;
    host.innerHTML='<section class="inventory-section"><h3>🌱 Seed storage</h3><div class="inventory-grid">'+seedCards+'</div></section><section class="inventory-section"><h3>🐾 Farm animals</h3><div class="inventory-grid">'+animalCard('🐔','Happy Hen',hens)+animalCard('🐄','Daisy Cow',cows)+'</div></section><section class="inventory-section inventory-stats"><h3>🌾 Field activity</h3><div class="inventory-stat"><strong>'+growing+'</strong><small>Growing</small></div><div class="inventory-stat"><strong>'+ready+'</strong><small>Ready to harvest</small></div><div class="inventory-stat"><strong>'+this.harvests+'</strong><small>Total harvests</small></div></section>';
  }
  private closeMarket(): void {document.getElementById('market-modal')?.classList.remove('open');document.getElementById('market-modal')?.setAttribute('aria-hidden','true');document.getElementById('market-modal')?.querySelector('.market-tabs')?.classList.remove('inventory-hidden');}
  private renderMarket(category='seeds'): void {
    const host=document.getElementById('market-items');if(!host)return;
    if(category==='animals'){host.innerHTML='<article class="market-item"><div class="market-art">🐔</div><div class="market-copy"><strong>Happy Hen</strong><small>Lays an egg after feeding · owned: '+this.animals.filter(a=>a.id==='hen').length+'</small></div><button class="market-buy" data-buy-animal="hen" '+(this.coins<75?'disabled':'')+'>🪙 75 · Buy</button></article><article class="market-item"><div class="market-art">🐄</div><div class="market-copy"><strong>Daisy Cow</strong><small>Produces milk after feeding · owned: '+this.animals.filter(a=>a.id==='cow').length+'</small></div><button class="market-buy" data-buy-animal="cow" '+(this.coins<160?'disabled':'')+'>🪙 160 · Buy</button></article>';host.querySelectorAll<HTMLButtonElement>('[data-buy-animal]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.buyAnimal as AnimalId;const cost=id==='hen'?75:160;if(this.coins<cost)return;this.coins-=cost;this.animals.push({id,readyAt:0});this.renderOwnedAnimals();this.saveFarm();this.refreshHud();this.toast('A new animal joined your farm!');this.renderMarket('animals');}));return;} if(category==='decor'){host.innerHTML='<article class="market-item"><div class="market-art">🌷</div><div class="market-copy"><strong>Decorations</strong><small>Placeable decorations are coming in a future update.</small></div></article>';return;}
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
