import Phaser from 'phaser';
import { Engine, ITEM_ABILITIES, PASS, STATUS, kitOf, type AbilityDef, type Action, type BattleState, type Ev, type Unit } from '../battle/core';
import { assetUrl, type Manifest } from '../core/assets';
import { canFullscreen, isFullscreen, toggleFullscreen } from '../core/screen';
import { loadSettings, saveSettings } from '../core/settings';
import { sfx } from '../core/sfx';
import { BASE_H, BASE_W, LAYOUT_EVENT, type Layout, type Viewport } from '../core/viewport';
import { ENEMIES } from '../data/enemies';
import { HERO } from '../data/kit';
import type { BattleSetup } from '../game/progress';
import { BG_ART, ENEMY_ART, ICON_ART, heroArt } from '../game/art';
import { COLOR, FONT_BODY, FONT_COMPACT, HEX, LINE_16, outlined, text } from '../ui/theme';
import { Button, panel } from '../ui/widgets';

export interface BattleData { setup: BattleSetup; onEnd: (st: BattleState) => void }

const STRIP_CELLS = 7;
const CELL = 24;
const CARD_W = 118;
const BAR_H = 42;
const SIDE_BTN = 32;
const HERO_Y = 200;

const SIZE: Record<string, [number, number]> = { s: [22, 22], m: [28, 32], l: [38, 40], xl: [48, 54] };

interface UnitView {
  uid: string;
  hero: boolean;
  home: { x: number; y: number };
  w: number;
  h: number;
  body: Phaser.GameObjects.Container;
  img: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics;
  shadow: Phaser.GameObjects.Ellipse;
  bars: Phaser.GameObjects.Graphics;
  marks: Phaser.GameObjects.Graphics;
  windup: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  breath: Phaser.Tweens.Tween | null;
  hpShown: number;
  mpShown: number;
  gone: boolean;
}

type Phase = 'intro' | 'input' | 'busy' | 'over';

function initials(name: string): string {
  const p = name.split(/[\s-]+/).filter(Boolean);
  return (p.length > 1 ? p[0][0] + p[1][0] : name.slice(0, 2)).toUpperCase();
}
const hexNum = (c: string) => parseInt(c.replace('#', ''), 16);

export class BattleScene extends Phaser.Scene {
  private data0!: BattleData;
  private e!: Engine;
  private manifest!: Manifest;
  private viewport!: Viewport;
  private layout!: Layout;
  private gen = 0;
  private phase: Phase = 'intro';
  private speed = 1;

  private world!: Phaser.GameObjects.Container;
  private bgLayer!: Phaser.GameObjects.Container;
  private groundLayer!: Phaser.GameObjects.Container;
  private unitLayer!: Phaser.GameObjects.Container;
  private overLayer!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  private views = new Map<string, UnitView>();

  private hud!: Phaser.GameObjects.Container;
  private strip!: Phaser.GameObjects.Container;
  private info!: Phaser.GameObjects.Container;
  private infoBg!: Phaser.GameObjects.NineSlice;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoBody!: Phaser.GameObjects.Text;
  private infoWidth = 300;
  private card!: Phaser.GameObjects.Container;
  private cardName!: Phaser.GameObjects.Text;
  private cardStats!: Phaser.GameObjects.Text;
  private cardBar!: Phaser.GameObjects.Graphics;
  private cardColor!: Phaser.GameObjects.Rectangle;
  private abilityButtons: Button[] = [];
  private confirmBtn!: Button;
  private sideButtons: Button[] = [];
  private activeMarker!: Phaser.GameObjects.Image;
  private brackets!: Phaser.GameObjects.Graphics;

  private overlay!: Phaser.GameObjects.Container;
  private overlayShade!: Phaser.GameObjects.Rectangle;
  private overlayPanel!: Phaser.GameObjects.Container;

  private sel: { ab: string | null; tgt: string | null } = { ab: null, tgt: null };
  private bagMode = false;
  private shownAbilities: AbilityDef[] = [];
  private lastEnemyTarget: string | null = null;
  private resolveAction: ((a: Action) => void) | null = null;

  private pauseReasons = new Set<'hidden' | 'portrait' | 'menu'>();
  private waitingResumeTap = false;
  private isPaused = false;

  constructor() {
    super('battle');
  }

  init(data: BattleData): void {
    this.data0 = data;
  }

  /** Подгрузить рисунки героев отряда, если их ещё нет. */
  preload(): void {
    const manifest = this.registry.get('manifest') as Manifest;
    for (const u of this.data0.setup.state.units) {
      const art = u.side === 'hero' ? heroArt(u.key) : undefined;
      if (!art || this.textures.exists(art.texture)) continue;
      const img = manifest.images.find((i) => i.key === art.texture);
      if (img) this.load.image(img.key, assetUrl(img.url));
    }
  }

  // ======================= Создание =======================

  create(): void {
    this.gen += 1;
    this.phase = 'intro';
    this.views.clear();
    this.abilityButtons = [];
    this.sideButtons = [];
    this.sel = { ab: null, tgt: null };
    this.bagMode = false;
    this.lastEnemyTarget = null;
    this.resolveAction = null;
    this.pauseReasons.clear();
    this.waitingResumeTap = false;
    this.isPaused = false;
    this.speed = loadSettings().speed ?? 1;

    this.manifest = this.registry.get('manifest') as Manifest;
    this.viewport = this.registry.get('viewport') as Viewport;
    this.e = new Engine(this.data0.setup.state);

    const region = this.data0.setup;
    void region;
    this.cameras.main.setOrigin(0, 0).setBackgroundColor(HEX.shade);

    this.buildWorld();
    this.buildHud();
    this.buildOverlay();

    const onLayout = (l: Layout) => this.applyLayout(l);
    const onHidden = () => this.onPageHidden();
    const onVisible = () => sfx.pageVisible();
    this.game.events.on(LAYOUT_EVENT, onLayout);
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.game.events.on(Phaser.Core.Events.VISIBLE, onVisible);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(LAYOUT_EVENT, onLayout);
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      this.game.events.off(Phaser.Core.Events.VISIBLE, onVisible);
    });

    this.applyLayout(this.viewport.layout);
    void this.runBattle(this.gen);
  }

  // ---------- Текстуры-заглушки ----------

  /** Квадратик с рамкой, пока ChatGPT не нарисовал спрайт. */
  private placeholder(key: string, w: number, h: number, color: string): string {
    const tk = `ph/${key}`;
    if (this.textures.exists(tk)) return tk;
    const t = this.textures.createCanvas(tk, w, h)!;
    const c = t.getContext();
    const base = Phaser.Display.Color.HexStringToColor(color);
    const dark = base.clone().darken(45).rgba;
    const light = base.clone().lighten(18).rgba;
    c.fillStyle = '#1c100a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = dark;
    c.fillRect(1, 1, w - 2, h - 2);
    c.fillStyle = color;
    c.fillRect(2, 2, w - 4, h - 4);
    c.fillStyle = light;
    c.fillRect(2, 2, w - 4, 2);
    c.fillRect(2, 2, 2, h - 4);
    t.refresh();
    return tk;
  }

  private textureFor(u: Unit): { key: string; ph: boolean; w: number; h: number; scale: number; ox: number; oy: number } {
    if (u.side === 'hero') {
      const art = heroArt(u.key);
      if (art && this.textures.exists(art.texture)) return this.hdHero(u.key, art.texture, art);
      const k = 'heroes/' + u.key;
      if (this.textures.exists(k)) { const s = this.textures.get(k).getSourceImage(); return { key: k, ph: false, w: s.width, h: s.height, scale: 1, ox: 0.5, oy: 1 }; }
      return { key: this.placeholder(u.key, 26, 36, HERO[u.key]?.color ?? '#888'), ph: true, w: 26, h: 36, scale: 1, ox: 0.5, oy: 1 };
    }
    const d = ENEMIES[u.key];
    for (const k of [ENEMY_ART[u.key], d?.sprite, 'enemies/' + u.key]) {
      if (k && this.textures.exists(k)) { const s = this.textures.get(k).getSourceImage(); return { key: k, ph: false, w: s.width, h: s.height, scale: 1, ox: 0.5, oy: 1 }; }
    }
    const [w, h] = SIZE[d?.size ?? 'm'];
    return { key: this.placeholder(u.key, w, h, d?.color ?? '#888'), ph: true, w, h, scale: 1, ox: 0.5, oy: 1 };
  }

  /**
   * Крупный оригинал героя уменьшается при загрузке боя до размера на экране этого телефона
   * (плавное ступенчатое уменьшение), сам PNG не меняется.
   */
  private hdHero(key: string, tex: string, art: NonNullable<ReturnType<typeof heroArt>>) {
    const unit = this.viewport.layout.unit;
    const figure = 44; // высота фигуры в игровых единицах
    const f = (figure * unit) / art.opaque_bounds.height;
    const W = Math.max(1, Math.round(art.width * f));
    const H = Math.max(1, Math.round(art.height * f));
    const tk = `hd/${key}@${W}x${H}`;
    if (!this.textures.exists(tk)) {
      let src: CanvasImageSource = this.textures.get(tex).getSourceImage() as HTMLImageElement;
      let sw = art.width;
      let sh = art.height;
      while (sw / 2 > W) {
        const c = document.createElement('canvas');
        c.width = Math.round(sw / 2);
        c.height = Math.round(sh / 2);
        const cx = c.getContext('2d')!;
        cx.imageSmoothingEnabled = true;
        cx.imageSmoothingQuality = 'high';
        cx.drawImage(src, 0, 0, c.width, c.height);
        src = c; sw = c.width; sh = c.height;
      }
      const t = this.textures.createCanvas(tk, W, H)!;
      const cx = t.getContext();
      cx.imageSmoothingEnabled = true;
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(src, 0, 0, W, H);
      t.refresh();
      t.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    const k = 1 / unit;
    return {
      key: tk, ph: false, scale: k, ox: art.origin_x, oy: art.origin_y,
      w: Math.round(art.opaque_bounds.width * f * k), h: Math.round(figure),
    };
  }

  // ---------- Мир ----------

  private buildWorld(): void {
    this.world = this.add.container(0, 0);
    this.bgLayer = this.add.container(0, 0);
    this.groundLayer = this.add.container(0, 0);
    this.unitLayer = this.add.container(0, 0);
    this.overLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.world.add([this.bgLayer, this.groundLayer, this.unitLayer, this.overLayer, this.fxLayer]);

    const bg0 = this.data0.setup.bg;
    const bg = bg0 && BG_ART[bg0] && this.textures.exists(BG_ART[bg0]) ? BG_ART[bg0] : bg0;
    if (bg && this.textures.exists(bg)) {
      for (let gy = -1; gy <= 1; gy++) for (let gx = -1; gx <= 1; gx++) {
        if (gx === 0 && gy === 0) continue;
        this.bgLayer.add(this.add.image(gx * BASE_W, gy * BASE_H, bg).setOrigin(0, 0).setFlip(gx !== 0, gy !== 0).setTint(0xc8c8c8));
      }
      this.bgLayer.add(this.add.image(0, 0, bg).setOrigin(0, 0));
      if (bg === this.manifest.world_layers[0]?.texture) {
        for (const p of this.manifest.world_layers.slice(1)) {
          const src = this.textures.get(p.texture).getSourceImage();
          this.bgLayer.add(this.add.image(Math.round(p.x - p.origin_x * src.width), Math.round(p.y - p.origin_y * src.height), p.texture).setOrigin(0, 0));
        }
      }
    } else this.drawPlaceholderBg();

    for (const u of this.e.s.units) this.createView(u);
    this.layoutUnits(false);

    this.activeMarker = this.add.image(0, 0, 'ui/active_turn').setOrigin(0.5, 1).setVisible(false);
    this.overLayer.add(this.activeMarker);
    this.tweens.add({ targets: this.activeMarker, y: '-=3', duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.brackets = this.add.graphics();
    this.overLayer.add(this.brackets);
    this.tweens.add({ targets: this.brackets, alpha: { from: 1, to: 0.45 }, duration: 420, yoyo: true, repeat: -1 });
  }

  /** Фон региона без арта: небо, земля и немного «шума». */
  private drawPlaceholderBg(): void {
    const reg = this.data0.setup.region;
    const colors = ['#5f8f4a', '#6a5a4a', '#3f5f3f', '#6f7f8f', '#7f6a4a', '#4a7f7f', '#7f4a4a', '#3f6f9f', '#8f6f3f', '#5f3f4f', '#4f3f3f', '#6f5f3f'];
    const base = Phaser.Display.Color.HexStringToColor(colors[(reg - 1) % colors.length]);
    const sky = base.clone().darken(30).color;
    const ground = base.clone().darken(5).color;
    const g = this.add.graphics();
    g.fillStyle(sky, 1).fillRect(-BASE_W, -BASE_H, BASE_W * 3, BASE_H + 100);
    g.fillStyle(ground, 1).fillRect(-BASE_W, 100, BASE_W * 3, BASE_H * 2);
    g.fillStyle(base.clone().darken(15).color, 1).fillRect(-BASE_W, 98, BASE_W * 3, 4);
    let seed = reg * 977;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    g.fillStyle(base.clone().lighten(10).color, 0.6);
    for (let i = 0; i < 160; i++) g.fillRect(Math.floor(-BASE_W + rnd() * BASE_W * 3), Math.floor(104 + rnd() * 200), 2, 1);
    g.fillStyle(base.clone().darken(40).color, 0.5);
    for (let i = 0; i < 60; i++) g.fillRect(Math.floor(-BASE_W + rnd() * BASE_W * 3), Math.floor(-40 + rnd() * 130), 1, 1);
    this.bgLayer.add(g);
    this.cameras.main.setBackgroundColor(sky);
  }

  private createView(u: Unit): UnitView {
    const hero = u.side === 'hero';
    const tex = this.textureFor(u);
    const shadow = this.add.ellipse(0, 0, Math.max(16, tex.w * 0.8), 6, 0x000000, 0.35);
    const ring = this.add.graphics();
    this.groundLayer.add([shadow, ring]);
    const body = this.add.container(0, 0);
    const img = this.add.image(0, 0, tex.key).setOrigin(tex.ox, tex.oy).setScale(tex.scale);
    body.add(img);
    if (tex.ph) {
      const t = outlined(this, 0, -Math.round(tex.h / 2), initials(u.name), FONT_COMPACT, COLOR.light).setOrigin(0.5, 0.5);
      body.add(t);
    }
    if (!hero) img.setFlipX(false);
    this.unitLayer.add(body);
    const bars = this.add.graphics();
    const marks = this.add.graphics();
    const windup = outlined(this, 0, 0, '!', FONT_BODY, COLOR.dmg).setOrigin(0.5, 1).setVisible(false);
    const zone = this.add.zone(0, 0, Math.max(36, tex.w + 8), Math.max(44, tex.h + 12)).setOrigin(0.5, 1).setInteractive();
    zone.on('pointerup', () => this.onUnitTap(u.uid));
    this.overLayer.add([bars, marks, windup, zone]);
    const v: UnitView = {
      uid: u.uid, hero, home: { x: 0, y: 0 }, w: tex.w, h: tex.h, body, img, ring, shadow, bars, marks, windup, zone,
      breath: null, hpShown: u.hp, mpShown: u.mp, gone: false,
    };
    v.breath = this.tweens.add({ targets: body, scaleY: 1.03, duration: 900 + Math.random() * 300, delay: Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    if (!u.alive) this.setDeadLook(v);
    this.views.set(u.uid, v);
    return v;
  }

  /** Раскладка бойцов: герои снизу в ряд, враги сверху по своим местам. */
  private layoutUnits(animate: boolean): void {
    const heroes = this.e.s.units.filter((x) => x.side === 'hero');
    const n = heroes.length;
    heroes.forEach((u) => {
      const v = this.views.get(u.uid)!;
      this.placeView(v, 240 + (u.pos - (n - 1) / 2) * 46, HERO_Y, animate);
    });
    const foes = this.e.s.units.filter((x) => x.side === 'enemy');
    const m = Math.max(...foes.map((x) => x.pos)) + 1;
    const sp = m <= 3 ? 70 : 54;
    for (const u of foes) {
      const v = this.views.get(u.uid)!;
      if (v.gone && !u.alive) continue;
      const big = ENEMIES[u.key]?.size === 'xl';
      this.placeView(v, 240 + (u.pos - (m - 1) / 2) * sp, big ? 138 : 127 + (u.pos % 2 ? 9 : 0), animate);
    }
    this.unitLayer.sort('y');
  }

  private placeView(v: UnitView, x: number, y: number, animate: boolean): void {
    v.home = { x: Math.round(x), y: Math.round(y) };
    if (animate) this.tweens.add({ targets: v.body, x: v.home.x, y: v.home.y, duration: 300 });
    else v.body.setPosition(v.home.x, v.home.y);
    v.shadow.setPosition(v.home.x, v.home.y);
    v.zone.setPosition(v.home.x, v.home.y + 6);
    v.windup.setPosition(v.home.x - v.w / 2 - 4, v.home.y - v.h);
    this.drawBars(v);
  }

  private top(v: UnitView): number { return v.home.y - v.h; }

  // ---------- Интерфейс ----------

  private buildHud(): void {
    this.hud = this.add.container(0, 0);
    this.strip = this.add.container(0, 0);
    this.hud.add(this.strip);

    this.info = this.add.container(0, 0);
    this.infoBg = panel(this, 0, 0, 300, 40);
    this.infoTitle = text(this, 8, 6, '', FONT_COMPACT, COLOR.ink);
    this.infoBody = text(this, 8, 6 + LINE_16, '', FONT_COMPACT, COLOR.inkSoft);
    this.info.add([this.infoBg, this.infoTitle, this.infoBody]);
    this.hud.add(this.info);

    this.card = this.add.container(0, 0);
    const bg = panel(this, 0, 0, CARD_W, BAR_H);
    this.cardColor = this.add.rectangle(5, 6, 4, BAR_H - 14, 0xffffff).setOrigin(0, 0);
    this.cardName = text(this, 13, 2, '', FONT_COMPACT, COLOR.ink);
    this.cardStats = text(this, 13, LINE_16 - 2, '', FONT_COMPACT, COLOR.inkSoft);
    this.cardBar = this.add.graphics();
    this.card.add([bg, this.cardColor, this.cardName, this.cardStats, this.cardBar]);
    this.card.setVisible(false);
    this.hud.add(this.card);

    this.confirmBtn = new Button(this, { width: 96, height: 32, label: 'Применить', pad: 4 }, () => this.confirm());
    this.confirmBtn.setSelected(true).setVisible(false);
    this.hud.add(this.confirmBtn);

    const mk = (label: string, onTap: () => void) => {
      const b = new Button(this, { width: SIDE_BTN + 8, height: SIDE_BTN, label, pad: 3 }, onTap);
      this.sideButtons.push(b);
      this.hud.add(b);
      return b;
    };
    const sound = mk(sfx.enabled ? '♪' : '–', () => {
      sfx.enabled = !sfx.enabled;
      saveSettings({ ...loadSettings(), sound: sfx.enabled });
      sound.setLabel(sfx.enabled ? '♪' : '–');
      sfx.play('tap');
      this.showInfo(sfx.enabled ? 'Звук включён' : 'Звук выключен', '');
    });
    const sp = mk(`×${this.speed}`, () => {
      this.speed = this.speed === 1 ? 2 : 1;
      saveSettings({ ...loadSettings(), speed: this.speed });
      sp.setLabel(`×${this.speed}`);
      sfx.play('tap');
      this.showInfo(`Скорость боя ×${this.speed}`, '');
    });
    if (canFullscreen()) {
      const fs = mk(isFullscreen() ? '▣' : '□', () => { sfx.play('tap'); toggleFullscreen(); });
      const onFs = () => fs.setLabel(isFullscreen() ? '▣' : '□');
      document.addEventListener('fullscreenchange', onFs);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('fullscreenchange', onFs));
    }
    mk('⚑', () => this.retreatMenu());
  }

  private buildOverlay(): void {
    this.overlay = this.add.container(0, 0).setVisible(false);
    this.overlayShade = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.6).setOrigin(0, 0).setInteractive();
    this.overlayPanel = this.add.container(0, 0);
    this.overlay.add([this.overlayShade, this.overlayPanel]);
    this.overlayShade.on('pointerup', () => { if (this.waitingResumeTap) this.resumeFromTap(); });
  }

  // ======================= Раскладка =======================

  private applyLayout(l: Layout): void {
    this.layout = l;
    const cam = this.cameras.main;
    cam.setSize(l.deviceW, l.deviceH);
    cam.setZoom(l.unit);
    cam.setScroll(0, 0);
    this.world.setPosition(l.worldX, l.worldY);
    const W = l.width;
    const H = l.height;
    const left = Math.ceil(l.safe.left) + 4;
    const right = Math.floor(W - l.safe.right) - 4;
    const top = Math.ceil(l.safe.top) + 4;
    const bottom = Math.floor(H - l.safe.bottom) - 4;

    let sy = top;
    for (const b of this.sideButtons) { b.setPosition(right - b.btnW, sy); sy += SIDE_BTN + 4; }
    this.strip.setPosition(left, top);
    const x0 = left + CELL + 8;
    const x1 = right - SIDE_BTN - 16;
    this.infoWidth = Math.min(420, x1 - x0);
    this.info.setPosition(Math.round((x0 + x1) / 2 - this.infoWidth / 2), top);
    this.relayoutInfo();

    const barY = bottom - BAR_H;
    this.card.setPosition(left, barY);
    this.confirmBtn.setPosition(right - this.confirmBtn.btnW, barY - 32 - 6);
    this.layoutAbilityButtons();

    this.overlayShade.setSize(W, H);
    this.overlayShade.input?.hitArea.setSize(W, H);
    this.layoutOverlayPanel();
    this.setPauseReason('portrait', l.portrait);
  }

  private layoutAbilityButtons(): void {
    if (!this.layout) return;
    const l = this.layout;
    const left = Math.ceil(l.safe.left) + 4 + CARD_W + 6;
    const right = Math.floor(l.width - l.safe.right) - 4;
    const barY = Math.floor(l.height - l.safe.bottom) - 4 - BAR_H;
    let x = right;
    for (let i = this.abilityButtons.length - 1; i >= 0; i--) {
      const b = this.abilityButtons[i];
      x -= b.btnW;
      b.setPosition(x, barY);
      x -= 3;
    }
    void left;
  }

  // ======================= Основной цикл =======================

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms / this.speed, () => r()));
  }
  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    const c = { ...cfg } as Phaser.Types.Tweens.TweenBuilderConfig & { duration?: number; delay?: number };
    if (c.duration) c.duration /= this.speed;
    if (typeof c.delay === 'number') c.delay /= this.speed;
    return new Promise((r) => { this.tweens.add({ ...c, onComplete: () => r() }); });
  }

  private async runBattle(gen: number): Promise<void> {
    const st = this.data0.setup;
    const foes = this.e.s.units.filter((x) => x.side === 'enemy');
    this.showInfo(st.title, foes.length === 1 ? `${foes[0].name} преграждает путь!` : `Враги: ${foes.length}. К бою!`);
    this.refreshStrip();
    await this.wait(800);
    if (gen !== this.gen) return;
    await this.play(this.e.start(), gen);
    while (gen === this.gen && this.e.s.result === 'ongoing') {
      const u = this.e.cur;
      let act: Action;
      if (u.side === 'hero') act = await this.waitForPlayer(u);
      else {
        await this.wait(450);
        if (gen !== this.gen) return;
        act = this.e.decide(u);
      }
      if (gen !== this.gen || this.e.s.result !== 'ongoing') break;
      this.phase = 'busy';
      this.setPlayerControls(false);
      await this.play(this.e.perform(act), gen);
    }
    if (gen !== this.gen) return;
    this.phase = 'over';
    await this.wait(500);
    if (gen === this.gen) this.showResult();
  }

  private waitForPlayer(u: Unit): Promise<Action> {
    this.phase = 'input';
    this.sel = { ab: null, tgt: null };
    this.bagMode = false;
    this.buildAbilityButtons(u);
    this.setPlayerControls(true);
    this.showTurnPrompt(u);
    this.refreshSelection();
    return new Promise((resolve) => { this.resolveAction = resolve; });
  }

  // ======================= Кнопки умений =======================

  private buildAbilityButtons(u: Unit): void {
    for (const b of this.abilityButtons) b.destroy();
    this.abilityButtons = [];
    const list: AbilityDef[] = this.bagMode ? [...ITEM_ABILITIES, PASS] : this.e.abilities(u);
    this.shownAbilities = list;
    const l = this.layout;
    const avail = (l ? Math.floor(l.width - l.safe.right) - Math.ceil(l.safe.left) : BASE_W) - 8 - CARD_W - 6;
    const count = list.length + 1;
    const w = Math.max(40, Math.min(72, Math.floor((avail - 3 * (count - 1)) / count)));
    list.forEach((a, i) => {
      let label = a.label;
      if (a.kind === 'item') label = `${a.label} ${this.e.s.items[a.id] ?? 0}`;
      let icon = this.textures.exists(a.icon) ? a.icon : a.kind === 'item' ? 'ui/icons/potion' : a.kind === 'ult' ? 'ui/icons/fire' : 'ui/icons/sword';
      if (ICON_ART[icon] && this.textures.exists(ICON_ART[icon])) icon = ICON_ART[icon];
      const b = new Button(this, { width: w, height: BAR_H, label, icon, pad: 2, stack: true }, () => this.onAbilityTap(i));
      b.setDisabled(!!this.e.check(u, a));
      if (a.kind === 'ult' && !this.e.check(u, a)) b.setSelected(true);
      this.abilityButtons.push(b);
      this.hud.add(b);
    });
    const bagIcon = this.bagMode ? 'ui/icons/sword' : 'ui/icons/potion';
    const bag = new Button(this, { width: w, height: BAR_H, label: this.bagMode ? 'Назад' : 'Сумка', icon: this.textures.exists(ICON_ART[bagIcon]) ? ICON_ART[bagIcon] : bagIcon, pad: 2, stack: true }, () => {
      if (this.phase !== 'input' || this.isPaused) return;
      sfx.play('tap');
      this.bagMode = !this.bagMode;
      this.sel = { ab: null, tgt: null };
      this.buildAbilityButtons(this.e.cur);
      this.refreshSelection();
      if (this.bagMode) this.showInfo('Сумка', 'Предмет тратит ход. «Оборона» — пропуск хода с защитой.');
      else this.showTurnPrompt(this.e.cur);
    });
    this.abilityButtons.push(bag);
    this.hud.add(bag);
    this.layoutAbilityButtons();
  }

  private onAbilityTap(i: number): void {
    if (this.phase !== 'input' || this.isPaused) return;
    const u = this.e.cur;
    const a = this.shownAbilities[i];
    const why = this.e.check(u, a);
    if (why) {
      sfx.play('deny');
      this.abilityButtons[i].shake();
      this.sel = { ab: null, tgt: null };
      this.refreshSelection();
      this.showInfo(this.abilityTitle(u, a), `${why}\n${a.desc}`, true);
      return;
    }
    if (this.sel.ab === a.id) {
      sfx.play('tap');
      this.sel = { ab: null, tgt: null };
      this.refreshSelection();
      this.showTurnPrompt(u);
      return;
    }
    sfx.play('select');
    this.sel.ab = a.id;
    if (this.e.needsTarget(a)) {
      const ts = this.e.validTargets(u, a).map((x) => x.uid);
      this.sel.tgt = this.sel.tgt && ts.includes(this.sel.tgt) ? this.sel.tgt : this.defaultTarget(u, a, ts);
    } else this.sel.tgt = null;
    this.refreshSelection();
  }

  private defaultTarget(u: Unit, a: AbilityDef, ts: string[]): string | null {
    if (!ts.length) return null;
    if (a.target === 'enemy' || a.target === 'enemyAny') {
      if (this.lastEnemyTarget && ts.includes(this.lastEnemyTarget)) return this.lastEnemyTarget;
      return [...ts].sort((x, y) => this.e.u(x).hp - this.e.u(y).hp)[0];
    }
    if (a.target === 'allyDead') return ts[0];
    if (a.target === 'allyOther' || a.target === 'ally' || a.target === 'allyWounded') {
      return [...ts].sort((x, y) => this.e.u(x).hp / this.e.u(x).maxHp - this.e.u(y).hp / this.e.u(y).maxHp)[0];
    }
    void u;
    return ts[0];
  }

  private onUnitTap(uid: string): void {
    if (this.isPaused || this.phase === 'over') return;
    const a = this.sel.ab ? this.e.ability(this.e.cur, this.sel.ab) : null;
    if (this.phase === 'input' && a && this.e.needsTarget(a)) {
      const ts = this.e.validTargets(this.e.cur, a).map((x) => x.uid);
      if (ts.includes(uid)) {
        if (this.sel.tgt === uid) this.confirm();
        else { sfx.play('tap'); this.sel.tgt = uid; this.refreshSelection(); }
        return;
      }
      sfx.play('deny');
      const need: Record<string, string> = {
        enemy: 'нужен враг (провокация заставляет бить провокатора)', enemyAny: 'нужен враг', ally: 'нужен союзник', allyOther: 'нужен другой союзник',
        allyWounded: 'нужен раненый союзник', allyDead: 'нужен павший союзник',
      };
      this.showInfo(this.abilityTitle(this.e.cur, a), `${this.e.u(uid).name} не подходит: ${need[a.target] ?? 'не та цель'}.`, true);
      return;
    }
    sfx.play('tap');
    this.showUnitInfo(uid);
  }

  private confirm(): void {
    if (this.phase !== 'input' || this.isPaused || !this.sel.ab) return;
    const u = this.e.cur;
    const a = this.e.ability(u, this.sel.ab);
    if (!a) return;
    if (this.e.needsTarget(a) && !this.sel.tgt) return;
    const resolve = this.resolveAction;
    if (!resolve) return;
    this.resolveAction = null;
    this.phase = 'busy';
    if (a.target === 'enemy' || a.target === 'enemyAny') this.lastEnemyTarget = this.sel.tgt;
    const act: Action = { uid: u.uid, ab: a.id, tgt: this.e.needsTarget(a) ? this.sel.tgt : null };
    sfx.play('select');
    this.sel = { ab: null, tgt: null };
    this.refreshSelection();
    this.setPlayerControls(false);
    resolve(act);
  }

  private refreshSelection(): void {
    const u = this.phase === 'input' ? this.e.cur : null;
    this.abilityButtons.forEach((b, i) => {
      const a = this.shownAbilities[i];
      if (!a) return;
      const ready = a.kind === 'ult' && u && !this.e.check(u, a);
      b.setSelected(a.id === this.sel.ab || !!ready);
    });
    const a = u && this.sel.ab ? this.e.ability(u, this.sel.ab) ?? null : null;
    const needs = a ? this.e.needsTarget(a) : false;
    this.confirmBtn.setVisible(!!a && (!needs || !!this.sel.tgt));
    const ts = a && u ? (needs ? this.e.validTargets(u, a) : []).map((x) => x.uid) : [];
    for (const v of this.views.values()) {
      v.ring.clear();
      if (!ts.includes(v.uid)) continue;
      const selected = v.uid === this.sel.tgt;
      v.ring.lineStyle(selected ? 2 : 1, selected ? HEX.ringSelected : HEX.ring, selected ? 1 : 0.85);
      v.ring.strokeEllipse(v.home.x, v.home.y, Math.max(v.w + 8, 26), 9);
    }
    this.drawBrackets();
    if (a && u) this.showInfo(this.abilityTitle(u, a), `${a.desc}\n${this.previewLine(u, a)}`);
  }

  private drawBrackets(): void {
    const g = this.brackets;
    g.clear();
    if (!this.sel.tgt || !this.sel.ab) return;
    const v = this.views.get(this.sel.tgt);
    if (!v) return;
    const x0 = v.home.x - v.w / 2 - 3;
    const y0 = this.top(v) - 3;
    const x1 = v.home.x + v.w / 2 + 3;
    const y1 = v.home.y + 3;
    const L = 5;
    g.fillStyle(HEX.ringSelected, 1);
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]] as const) {
      g.fillRect(sx > 0 ? cx : cx - L + 1, sy > 0 ? cy : cy - 1, L, 2);
      g.fillRect(sx > 0 ? cx : cx - 1, sy > 0 ? cy : cy - L + 1, 2, L);
    }
  }

  private abilityTitle(u: Unit, a: AbilityDef): string {
    const t = [a.name];
    const cost = this.e.costOf(u, a);
    if (cost) t.push(`${cost} ${u.mpName.toLowerCase()}`);
    if (a.cd) t.push(`откат ${a.cd}`);
    if (a.kind === 'ult') t.push('ульта');
    return t.join(' · ');
  }

  /** Короткий прогноз результата по пробному прогону. */
  private previewLine(u: Unit, a: AbilityDef): string {
    if (this.e.needsTarget(a) && !this.sel.tgt) return '';
    const evs = this.e.previewOf({ uid: u.uid, ab: a.id, tgt: this.sel.tgt });
    const dmg = new Map<string, number>();
    const heal = new Map<string, number>();
    for (const ev of evs) {
      if (ev.k === 'hit' && ev.src !== ev.uid) dmg.set(ev.uid, (dmg.get(ev.uid) ?? 0) + ev.n);
      if (ev.k === 'heal' && ev.n > 0) heal.set(ev.uid, (heal.get(ev.uid) ?? 0) + ev.n);
    }
    const parts: string[] = [];
    for (const [uid, n] of dmg) parts.push(`${this.e.u(uid)?.name ?? '?'} −${n}`);
    for (const [uid, n] of heal) parts.push(`${this.e.u(uid)?.name ?? '?'} +${n}`);
    if (!parts.length) return '';
    return '→ ' + (parts.length > 3 ? parts.slice(0, 3).join(', ') + ` и ещё ${parts.length - 3}` : parts.join(', '));
  }

  // ======================= Панели =======================

  private showInfo(title: string, body: string, warn = false): void {
    this.infoTitle.setText(title);
    this.infoBody.setText(body).setColor(warn ? COLOR.warn : COLOR.inkSoft);
    this.relayoutInfo();
  }

  private relayoutInfo(): void {
    const w = this.infoWidth;
    this.infoTitle.setWordWrapWidth(w - 16, true);
    this.infoBody.setWordWrapWidth(w - 16, true);
    const hasBody = this.infoBody.text.length > 0;
    this.infoBody.setY(6 + Math.round(this.infoTitle.height));
    const h = 6 + Math.round(this.infoTitle.height) + (hasBody ? Math.round(this.infoBody.height) : 0) + 6;
    this.infoBg.setSize(w, Math.max(h, 30));
  }

  private showTurnPrompt(u: Unit): void {
    const line = kitOf(u.key).hooks.resLine?.(this.e, u);
    const windups = this.e.enemies().filter((x) => x.res.windupT);
    let hint = 'Выберите действие внизу. Касание бойца — подробности.';
    if (windups.length) hint = `${windups[0].name} готовит сильный удар! Защитите отряд или собейте замах.`;
    if (u.limit >= 100) hint = 'Шкала Предела полна — ульта готова!';
    this.showInfo(`Раунд ${this.e.s.round} · Ход: ${u.name}${line ? ' · ' + line : ''}`, hint);
  }

  private showUnitInfo(uid: string): void {
    const u = this.e.u(uid);
    if (!u) return;
    let title = `${u.name} ур.${u.level}  ♥${Math.max(0, u.hp)}/${u.maxHp}`;
    if (u.side === 'hero') title += `  ♦${u.mp}/${u.maxMp}  ⚡${Math.floor(u.limit)}%`;
    const lines: string[] = [];
    if (!u.alive) lines.push(u.side === 'hero' ? 'Без сознания.' : 'Побеждён.');
    const line = kitOf(u.key).hooks.resLine?.(this.e, u);
    if (line) lines.push(line);
    const st = u.statuses.filter((x) => STATUS[x.id]).map((x) => `${STATUS[x.id].name}${x.turns < 99 ? ` (${x.turns})` : ''}`);
    if (st.length) lines.push(st.join(', '));
    if (u.res.windupT) lines.push('Готовит сильный удар!');
    if (u.side === 'enemy') {
      const d = ENEMIES[u.key];
      if (d) lines.push(d.desc);
      const weak = Object.entries(u.resist).filter(([, v]) => v > 1).map(([k]) => TYPE_NAME[k] ?? k);
      const strong = Object.entries(u.resist).filter(([, v]) => v < 1).map(([k]) => TYPE_NAME[k] ?? k);
      if (weak.length) lines.push('Уязвим: ' + weak.join(', '));
      if (strong.length) lines.push('Стойкий: ' + strong.join(', '));
    } else lines.push(HERO[u.key]?.passive ?? '');
    this.showInfo(title, lines.join('\n'));
  }

  private setPlayerControls(on: boolean): void {
    for (const b of this.abilityButtons) b.setVisible(on);
    this.confirmBtn.setVisible(on && !!this.sel.ab);
  }

  private updateCard(u: Unit): void {
    this.card.setVisible(true);
    this.cardColor.setFillStyle(hexNum(u.side === 'hero' ? HERO[u.key]?.color ?? '#888' : ENEMIES[u.key]?.color ?? '#888'));
    this.cardName.setText(`${u.name}`);
    const s = u.side === 'hero' ? `♥${u.hp} ♦${u.mp}` : `♥${u.hp}/${u.maxHp}`;
    this.cardStats.setText(s);
    const nameRoom = CARD_W - 18;
    this.cardName.setScale(this.cardName.width > nameRoom ? nameRoom / this.cardName.width : 1);
    const g = this.cardBar;
    g.clear();
    if (u.side === 'hero') {
      const w = CARD_W - 18;
      g.fillStyle(HEX.outline, 1).fillRect(12, BAR_H - 9, w + 2, 4);
      g.fillStyle(HEX.barBack, 1).fillRect(13, BAR_H - 8, w, 2);
      g.fillStyle(u.limit >= 100 ? 0xffffff : HEX.gold, 1).fillRect(13, BAR_H - 8, Math.round((w * u.limit) / 100), 2);
    }
  }

  private refreshStrip(): void {
    this.strip.removeAll(true);
    const ids = this.e.s.round > 0 ? this.e.upcoming(STRIP_CELLS) : this.e.s.units.filter((x) => x.alive).map((x) => x.uid).slice(0, STRIP_CELLS);
    const cur = this.e.s.round > 0 ? this.e.s.cur : null;
    ids.forEach((id, i) => {
      const u = this.e.u(id);
      if (!u) return;
      const y = i * (CELL + 2);
      const hero = u.side === 'hero';
      const active = i === 0 && id === cur;
      const col = hexNum(hero ? HERO[u.key]?.color ?? '#888' : ENEMIES[u.key]?.color ?? '#888');
      const g = this.add.graphics();
      g.fillStyle(active ? HEX.gold : HEX.outline, 1).fillRect(0, y, CELL, CELL);
      g.fillStyle(col, 1).fillRect(2, y + 2, CELL - 4, CELL - 4);
      g.fillStyle(hero ? HEX.heroCell : HEX.enemyCell, 1).fillRect(2, y + CELL - 4, CELL - 4, 2);
      const t = outlined(this, CELL / 2, y + CELL / 2 - 1, initials(u.name), FONT_COMPACT, COLOR.light).setOrigin(0.5, 0.5);
      const zone = this.add.zone(0, y, CELL, CELL).setOrigin(0, 0).setInteractive();
      zone.on('pointerup', () => this.onUnitTap(id));
      this.strip.add([g, t, zone]);
    });
  }

  // ======================= Полоски и значки =======================

  private drawBars(v: UnitView): void {
    const g = v.bars;
    g.clear();
    v.marks.clear();
    const u = this.e.u(v.uid);
    if (!u || (v.gone && !u.alive)) return;
    const w = Math.max(28, Math.min(48, v.w));
    const x = Math.round(v.home.x - w / 2);
    const hpH = 4;
    const y = v.hero ? v.home.y + 4 : this.top(v) - 8;
    const total = v.hero ? hpH + 1 + 3 + 1 + 2 : hpH;
    g.fillStyle(HEX.outline, 1).fillRect(x - 1, y - 1, w + 2, total + 2);
    g.fillStyle(HEX.barBack, 1).fillRect(x, y, w, hpH);
    const ratio = Math.max(0, v.hpShown / u.maxHp);
    const color = v.hero ? (ratio < 0.35 ? HEX.hpLow : HEX.hpHero) : HEX.hpEnemy;
    g.fillStyle(color, 1).fillRect(x, y, Math.round(w * ratio), hpH);
    if (this.e.has(u, 'shield')) {
      const sr = Math.min(1, this.e.val(u, 'shield') / u.maxHp);
      g.fillStyle(0xcfe8ff, 1).fillRect(x, y, Math.max(1, Math.round(w * sr)), 1);
    }
    if (v.hero) {
      g.fillStyle(HEX.barBack, 1).fillRect(x, y + hpH + 1, w, 3);
      const mr = u.maxMp > 0 ? Math.max(0, v.mpShown / u.maxMp) : 0;
      g.fillStyle(HEX.mp, 1).fillRect(x, y + hpH + 1, Math.round(w * mr), 3);
      g.fillStyle(HEX.barBack, 1).fillRect(x, y + hpH + 5, w, 2);
      g.fillStyle(u.limit >= 100 ? 0xffffff : HEX.gold, 1).fillRect(x, y + hpH + 5, Math.round((w * u.limit) / 100), 2);
    }
    // Значки статусов: цветные квадратики
    const sts = u.statuses.filter((s) => STATUS[s.id] && s.id !== 'guarding').slice(0, 8);
    const my = v.hero ? y + total + 3 : y - 6;
    sts.forEach((s, i) => {
      const c = hexNum(STATUS[s.id].color);
      const sx = x + i * 6;
      v.marks.fillStyle(STATUS[s.id].good ? 0x1c3a10 : 0x3a100c, 1).fillRect(sx - 1, my - 1, 6, 6);
      v.marks.fillStyle(c, 1).fillRect(sx, my, 4, 4);
    });
    if (this.e.has(u, 'guarding')) {
      v.marks.fillStyle(0xd8d8d8, 1).fillRect(x + w + 2, y - 1, 3, 6);
    }
    v.windup.setVisible(!!u.res.windupT && u.alive);
  }

  private redrawAll(): void { for (const v of this.views.values()) this.drawBars(v); }

  private animateBars(v: UnitView): void {
    const u = this.e.u(v.uid);
    if (!u) return;
    const fromHp = v.hpShown;
    const fromMp = v.mpShown;
    this.tweens.addCounter({
      from: 0, to: 1, duration: 380 / this.speed, ease: 'Quad.Out',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 1;
        v.hpShown = fromHp + (Math.max(0, u.hp) - fromHp) * t;
        v.mpShown = fromMp + (u.mp - fromMp) * t;
        this.drawBars(v);
      },
    });
  }

  // ======================= Проигрывание событий =======================

  private async play(evs: Ev[], gen: number): Promise<void> {
    const returns: Promise<void>[] = [];
    for (let i = 0; i < evs.length; i++) {
      if (gen !== this.gen) return;
      const ev = evs[i];
      switch (ev.k) {
        case 'round':
          this.showInfo(`Раунд ${ev.n}`, '');
          this.refreshStrip();
          break;
        case 'turn': {
          const u = this.e.u(ev.uid);
          const v = this.views.get(ev.uid);
          if (!u || !v) break;
          this.refreshStrip();
          this.updateCard(u);
          this.activeMarker.setVisible(true).setPosition(v.home.x, this.top(v) - (v.hero ? 2 : 12));
          this.animateBars(v);
          if (u.side === 'hero') sfx.play('turn');
          else this.showInfo(`Раунд ${this.e.s.round} · Ход: ${u.name}`, u.res.windupT ? 'Готовит сильный удар!' : 'Враг выбирает действие…');
          break;
        }
        case 'skip': {
          const v = this.views.get(ev.uid);
          if (v) this.float(v, ev.why.toLowerCase() + ': пропуск', COLOR.armor, -8);
          await this.wait(450);
          break;
        }
        case 'use': {
          const next = evs.slice(i + 1).find((x) => x.k === 'hit' || x.k === 'heal' || x.k === 'miss');
          await this.animateUse(ev, next, returns);
          break;
        }
        case 'hit': await this.onHit(ev); break;
        case 'miss': {
          const v = this.views.get(ev.uid);
          if (v) { this.float(v, 'мимо', COLOR.light, 0); this.dodge(v); }
          sfx.play('tap');
          await this.wait(260);
          break;
        }
        case 'heal': await this.onHeal(ev.uid, ev.n); break;
        case 'st': {
          const v = this.views.get(ev.uid);
          if (v) this.drawBars(v);
          if (ev.on && STATUS[ev.id] && !['shield', 'guarding', 'dispelledMark'].includes(ev.id) && v) {
            this.float(v, STATUS[ev.id].name.toLowerCase(), STATUS[ev.id].good ? COLOR.heal : COLOR.fire, -14);
            await this.wait(120);
          }
          break;
        }
        case 'float': {
          const v = this.views.get(ev.uid);
          if (v) this.float(v, ev.text, ev.color, -20);
          await this.wait(200);
          break;
        }
        case 'cover': await this.onCover(ev.uid, ev.ward); break;
        case 'death': await this.onDeath(ev.uid); break;
        case 'revive': {
          const v = this.views.get(ev.uid);
          if (v) {
            v.gone = false;
            v.img.clearTint();
            v.body.setAlpha(1);
            v.zone.setInteractive();
            v.shadow.setAlpha(1);
            v.bars.setAlpha(1);
            v.hpShown = 0;
            this.animateBars(v);
            this.float(v, 'встаёт!', COLOR.heal, -10);
            sfx.play('heal');
          }
          await this.wait(400);
          break;
        }
        case 'spawn': {
          const u = this.e.u(ev.uid);
          const v = this.createView(u);
          this.layoutUnits(true);
          v.body.setAlpha(0);
          this.tween({ targets: v.body, alpha: 1, duration: 300 });
          await this.wait(350);
          break;
        }
        case 'say':
          this.showInfo(ev.text, '');
          await this.wait(700);
          break;
        case 'end':
          break;
      }
    }
    await Promise.all(returns);
    this.redrawAll();
    const cur = this.e.s.result === 'ongoing' ? this.e.cur : null;
    if (cur) this.updateCard(cur);
  }

  private chest(v: UnitView): { x: number; y: number } {
    return { x: v.body.x, y: Math.round(v.home.y - v.h * 0.55) };
  }

  private async animateUse(ev: Extract<Ev, { k: 'use' }>, next: Ev | undefined, returns: Promise<void>[]): Promise<void> {
    const actor = this.views.get(ev.uid);
    const u = this.e.u(ev.uid);
    if (!actor || !u) return;
    const tName = ev.tgt && ev.tgt !== ev.uid ? ` → ${this.e.u(ev.tgt)?.name ?? ''}` : '';
    this.showInfo(`${u.name}: ${ev.name}${tName}`, '');
    const impactId = next && 'uid' in next ? next.uid : ev.tgt;
    const impact = impactId ? this.views.get(impactId) : undefined;
    const foeRowY = u.side === 'hero' ? 110 : HERO_Y - 20;
    const to = impact && impact !== actor ? this.chest(impact) : { x: 240, y: foeRowY };
    const from = this.chest(actor);
    switch (ev.fx) {
      case 'melee': {
        if (!impact || impact === actor) { await this.hop(actor); break; }
        const dx = to.x - actor.home.x;
        const dy = to.y + (u.side === 'hero' ? 20 : -10) - actor.home.y;
        await this.tween({ targets: actor.body, x: actor.home.x + dx * 0.7, y: actor.home.y + dy * 0.7, duration: 170, ease: 'Quad.In' });
        returns.push(this.tween({ targets: actor.body, x: actor.home.x, y: actor.home.y, duration: 240, delay: 120, ease: 'Quad.Out' }));
        break;
      }
      case 'shot':
        sfx.play('arrow');
        await this.projectile('bolt', from, to, 230);
        break;
      case 'magic':
        sfx.play('fire');
        await this.hop(actor);
        await this.projectile('orb', from, to, 330);
        break;
      case 'aoe':
        sfx.play('heavy');
        await this.hop(actor);
        this.cameras.main.shake(200 / this.speed, 0.006);
        await this.projectile('orb', from, { x: 240, y: foeRowY }, 280);
        break;
      case 'heal':
      case 'buff':
        sfx.play(ev.fx === 'heal' ? 'heal' : 'guard');
        await this.hop(actor);
        break;
      default:
        break;
    }
  }

  private hop(v: UnitView): Promise<void> {
    return this.tween({ targets: v.body, y: v.home.y - 5, duration: 110, yoyo: true, ease: 'Quad.Out' });
  }

  private dodge(v: UnitView): void {
    this.tween({ targets: v.body, x: v.home.x + (v.hero ? -8 : 8), duration: 100, yoyo: true, ease: 'Quad.Out' });
  }

  private projectile(kind: 'bolt' | 'orb', from: { x: number; y: number }, to: { x: number; y: number }, ms: number): Promise<void> {
    const g = this.add.graphics();
    if (kind === 'bolt') {
      g.fillStyle(0x3d2215, 1).fillRect(-6, -1, 9, 2);
      g.fillStyle(0xd3d3d6, 1).fillRect(2, -1, 3, 2);
      g.setRotation(Math.atan2(to.y - from.y, to.x - from.x));
    } else {
      g.fillStyle(0xffb347, 1).fillRect(-3, -3, 6, 6);
      g.fillStyle(0xfff3a0, 1).fillRect(-1, -1, 3, 3);
    }
    g.setPosition(from.x, from.y);
    this.fxLayer.add(g);
    return new Promise((resolve) => {
      this.tweens.addCounter({
        from: 0, to: 1, duration: ms / this.speed, ease: kind === 'bolt' ? 'Linear' : 'Sine.In',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 1;
          g.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * (kind === 'orb' ? 10 : 0));
        },
        onComplete: () => { g.destroy(); resolve(); },
      });
    });
  }

  private flash(v: UnitView): void {
    v.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(90, () => {
      v.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      const u = this.e.u(v.uid);
      if (u && !u.alive && v.hero) v.img.setTint(0x7a7a7a);
    });
  }

  private float(v: UnitView, value: string, color: string, dy: number, size = FONT_COMPACT): void {
    const baseY = this.top(v) - (v.hero ? 4 : 14) + dy;
    const t = outlined(this, Math.round(v.home.x), baseY, value, size, color).setOrigin(0.5, 1);
    this.fxLayer.add(t);
    this.tweens.add({ targets: t, y: baseY - 16, duration: 900 / this.speed, ease: 'Quad.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 650 / this.speed, duration: 300 / this.speed, onComplete: () => t.destroy() });
  }

  private async onHit(ev: Extract<Ev, { k: 'hit' }>): Promise<void> {
    const v = this.views.get(ev.uid);
    if (!v) return;
    const u = this.e.u(ev.uid);
    const heavy = u ? ev.n >= u.maxHp * 0.2 : false;
    const color = ev.type === 'fire' ? COLOR.fire : ev.type === 'ice' || ev.type === 'water' ? COLOR.mana : ev.type === 'lightning' ? COLOR.gold : COLOR.dmg;
    sfx.play(ev.type === 'fire' ? 'fire' : heavy || ev.crit ? 'heavy' : 'hit');
    if (ev.n > 0) {
      this.flash(v);
      const x = v.body.x;
      this.tweens.add({ targets: v.body, x: { from: x - 2, to: x }, duration: 240 / this.speed, ease: (t: number) => Math.sin(t * Math.PI * 5) * (1 - t) + t });
      this.float(v, `${ev.crit ? 'крит −' : '−'}${ev.n}`, color, 0, heavy || ev.crit ? FONT_BODY : FONT_COMPACT);
    } else if (ev.absorbed > 0) this.float(v, `щит ${ev.absorbed}`, COLOR.armor, 0);
    else if (ev.mod === 'immune') this.float(v, 'иммунитет', COLOR.armor, 0);
    if (ev.n > 0 && ev.absorbed > 0) this.float(v, `щит ${ev.absorbed}`, COLOR.armor, -18);
    if (ev.mod === 'resist') this.float(v, 'стойкий', COLOR.armor, -18);
    if (ev.mod === 'weak') this.float(v, 'уязвим!', COLOR.fire, -22);
    this.animateBars(v);
    await this.wait(ev.src === ev.uid ? 260 : 340);
  }

  private async onHeal(uid: string, amount: number): Promise<void> {
    const v = this.views.get(uid);
    if (!v) return;
    sfx.play('heal');
    for (let i = 0; i < 5; i++) {
      const g = this.add.graphics();
      g.fillStyle(0x8dff7a, 1).fillRect(-1, -3, 2, 6).fillRect(-3, -1, 6, 2);
      g.setPosition(v.home.x - 10 + Math.random() * 20, v.home.y - 6 - Math.random() * 18);
      this.fxLayer.add(g);
      this.tweens.add({ targets: g, y: g.y - 14, alpha: 0, delay: (i * 60) / this.speed, duration: 600 / this.speed, onComplete: () => g.destroy() });
    }
    if (amount > 0) this.float(v, `+${amount}`, COLOR.heal, 0);
    this.animateBars(v);
    await this.wait(320);
  }

  private async onCover(guardId: string, wardId: string): Promise<void> {
    const g = this.views.get(guardId);
    const w = this.views.get(wardId);
    if (!g || !w) return;
    sfx.play('guard');
    await this.tween({ targets: g.body, x: w.home.x + (g.home.x < w.home.x ? -10 : 10), y: w.home.y - 6, duration: 180, ease: 'Quad.Out' });
    this.float(g, 'прикрыл!', COLOR.light, -8);
    this.tween({ targets: g.body, x: g.home.x, y: g.home.y, duration: 260, delay: 450, ease: 'Quad.Out' });
  }

  private setDeadLook(v: UnitView): void {
    if (v.hero) {
      v.img.setTint(0x7a7a7a);
      v.body.setAlpha(0.45);
    } else {
      v.gone = true;
      v.body.setAlpha(0);
      v.shadow.setAlpha(0);
      v.bars.clear();
      v.marks.clear();
      v.zone.disableInteractive();
    }
  }

  private async onDeath(uid: string): Promise<void> {
    const v = this.views.get(uid);
    if (!v) return;
    sfx.play('death');
    v.windup.setVisible(false);
    v.ring.clear();
    if (v.hero) {
      v.img.setTint(0x7a7a7a);
      await this.tween({ targets: v.body, alpha: 0.45, duration: 350 });
      this.float(v, 'без сил', COLOR.armor, -14);
    } else {
      v.gone = true;
      v.zone.disableInteractive();
      this.tweens.add({ targets: [v.shadow], alpha: 0, duration: 400 / this.speed });
      v.bars.clear();
      v.marks.clear();
      await this.tween({ targets: v.body, alpha: 0, y: v.home.y + 4, duration: 420, ease: 'Quad.In' });
    }
    this.refreshStrip();
  }

  // ======================= Пауза и отступление =======================

  private onPageHidden(): void {
    sfx.pageHidden();
    if (this.phase === 'over') return;
    this.waitingResumeTap = true;
    this.showOverlay('Пауза', 'Коснитесь экрана, чтобы продолжить бой.', []);
    this.updatePause();
  }

  private resumeFromTap(): void {
    this.waitingResumeTap = false;
    this.hideOverlay();
    sfx.play('tap');
    this.updatePause();
  }

  private retreatMenu(): void {
    if (this.phase === 'over' || this.waitingResumeTap) return;
    sfx.play('tap');
    this.setPauseReason('menu', true);
    this.showOverlay('Отступить?', 'Бой засчитается как поражение: отряд вернётся в город и потеряет 10% золота.', [
      { label: 'Сражаться', onTap: () => { this.hideOverlay(); this.setPauseReason('menu', false); } },
      { label: 'Отступить', onTap: () => {
        this.hideOverlay();
        this.setPauseReason('menu', false);
        this.e.s.result = 'defeat';
        this.gen += 1;
        this.phase = 'over';
        this.resolveAction = null;
        this.finish();
      } },
    ]);
  }

  private setPauseReason(reason: 'hidden' | 'portrait' | 'menu', on: boolean): void {
    if (on) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    this.updatePause();
  }

  private updatePause(): void {
    const should = this.pauseReasons.size > 0 || this.waitingResumeTap;
    if (should === this.isPaused) return;
    this.isPaused = should;
    this.time.paused = should;
    if (should) this.tweens.pauseAll();
    else this.tweens.resumeAll();
  }

  private showOverlay(title: string, body: string, buttons: { label: string; onTap: () => void }[]): void {
    this.overlayPanel.removeAll(true);
    const w = 280;
    const titleText = text(this, 0, 10, title, FONT_BODY, COLOR.ink);
    const bodyText = text(this, 0, 0, body, FONT_COMPACT, COLOR.inkSoft, { align: 'center' }).setWordWrapWidth(w - 24, true);
    const titleH = Math.round(titleText.height);
    bodyText.setPosition(Math.round((w - bodyText.width) / 2), 10 + titleH + 4);
    titleText.setX(Math.round((w - titleText.width) / 2));
    let hgt = 10 + titleH + 4 + Math.round(bodyText.height) + 12;
    const items: Phaser.GameObjects.GameObject[] = [];
    if (buttons.length) {
      const bw = buttons.length > 1 ? 120 : 160;
      const total = buttons.length * bw + (buttons.length - 1) * 10;
      buttons.forEach((b, i) => {
        const btn = new Button(this, { width: bw, height: 40, label: b.label, pad: 4 }, b.onTap);
        btn.setSelected(i === buttons.length - 1).setPosition(Math.round((w - total) / 2 + i * (bw + 10)), hgt);
        items.push(btn);
      });
      hgt += 40 + 12;
    }
    const bg = panel(this, 0, 0, w, hgt);
    this.overlayPanel.add([bg, titleText, bodyText, ...items]);
    this.overlayPanel.setSize(w, hgt);
    this.overlay.setVisible(true);
    this.children.bringToTop(this.overlay);
    this.layoutOverlayPanel();
  }

  private layoutOverlayPanel(): void {
    if (!this.layout) return;
    const w = this.overlayPanel.width || 260;
    const h = this.overlayPanel.height || 100;
    this.overlayPanel.setPosition(Math.round((this.layout.width - w) / 2), Math.round((this.layout.height - h) / 2));
  }

  private hideOverlay(): void { this.overlay.setVisible(false); }

  private showResult(): void {
    const win = this.e.s.result === 'victory';
    sfx.play(win ? 'victory' : 'defeat');
    this.activeMarker.setVisible(false);
    this.setPlayerControls(false);
    const alive = this.e.heroes().length;
    const body = win ? `Раундов: ${this.e.s.round}. В строю: ${alive} из ${this.e.s.units.filter((x) => x.side === 'hero').length}.` : 'Отряд пал. Он очнётся в городе.';
    this.showOverlay(win ? 'Победа!' : 'Поражение', body, [{ label: 'Дальше', onTap: () => { this.hideOverlay(); this.finish(); } }]);
  }

  private finish(): void {
    sfx.play('select');
    const cb = this.data0.onEnd;
    this.data0.onEnd = () => undefined;
    cb(this.e.s);
  }
}

const TYPE_NAME: Record<string, string> = {
  phys: 'оружие', fire: 'огонь', ice: 'лёд', lightning: 'молния', earth: 'земля', water: 'вода', wind: 'ветер', holy: 'свет', dark: 'тьма',
};
