import Phaser from 'phaser';
import {
  ability,
  advance,
  checkAbility,
  createBattle,
  currentUnitId,
  def,
  enemyDecide,
  perform,
  preview,
  startBattle,
  upcomingTurns,
  validTargets,
} from '../battle/engine';
import type { Action, BattleEvent, BattleState, IconKey, UnitDef } from '../battle/types';
import type { Manifest, Placement } from '../core/assets';
import { canFullscreen, isFullscreen, toggleFullscreen } from '../core/screen';
import { loadSettings, saveSettings } from '../core/settings';
import { sfx } from '../core/sfx';
import { BASE_H, BASE_W, LAYOUT_EVENT, type Layout, type Viewport } from '../core/viewport';
import { COLOR, FONT_BODY, FONT_COMPACT, HEX, LINE_16, outlined, text } from '../ui/theme';
import { Button, panel } from '../ui/widgets';

// ---------- Справочные таблицы графики ----------

const ICON: Record<IconKey, string> = {
  sword: 'ui/icons/sword',
  shield: 'ui/icons/shield',
  fire: 'ui/icons/fire',
  potion: 'ui/icons/potion',
  bow: 'ui/icons/bow',
};

const SHADOW: Record<string, string> = {
  warrior: 'shadows/guard',
  mage: 'shadows/mage',
  archer: 'shadows/archer',
  healer: 'shadows/healer',
  goblin: 'shadows/goblin',
  brute: 'shadows/brute',
  sprout: 'shadows/sprout',
};

/** Непрозрачная часть спрайта внутри кадра: x0, y0, x1, y1. */
const BBOX: Record<string, [number, number, number, number]> = {
  warrior: [14, 8, 42, 49],
  mage: [12, 6, 40, 49],
  archer: [12, 9, 41, 49],
  healer: [14, 8, 42, 49],
  goblin: [0, 0, 34, 28],
  brute: [0, 0, 52, 51],
  sprout: [0, 0, 28, 23],
};

/** Левый верхний угол портрета 22×22 в кадре спрайта. */
const PORTRAIT: Record<string, [number, number]> = {
  warrior: [17, 8],
  mage: [15, 12],
  archer: [15, 10],
  healer: [17, 10],
  goblin: [6, 2],
  brute: [15, 14],
  sprout: [3, 0],
};
const PORTRAIT_SIZE = 22;

const STRIP_CELLS = 7;
const CELL = 26;
const CARD_W = 142;
const BTN_W = 100;
const CONFIRM_W = 104;
const BAR_H = 42;
const SIDE_BTN = 36;

// Пиксельные иконки для кнопок звука и полного экрана.
const ICON_SOUND_ON = [
  '.....#..........',
  '....##.....#....',
  '...###...#..#...',
  '######....#..#..',
  '######..#..#.#..',
  '######..#..#.#..',
  '######....#..#..',
  '...###...#..#...',
  '....##.....#....',
  '.....#..........',
];
const ICON_SOUND_OFF = [
  '.....#..........',
  '....##..........',
  '...###..#...#...',
  '######...#.#....',
  '######....#.....',
  '######...#.#....',
  '######..#...#...',
  '...###..........',
  '....##..........',
  '.....#..........',
];
const ICON_FS_ENTER = [
  '####......####',
  '#............#',
  '#............#',
  '#............#',
  '..............',
  '..............',
  '..............',
  '..............',
  '#............#',
  '#............#',
  '#............#',
  '####......####',
];
const ICON_FS_EXIT = [
  '...#......#...',
  '...#......#...',
  '...#......#...',
  '####......####',
  '..............',
  '..............',
  '..............',
  '..............',
  '####......####',
  '...#......#...',
  '...#......#...',
  '...#......#...',
];

function drawPixels(g: Phaser.GameObjects.Graphics, rows: string[], x: number, y: number, color: number): void {
  g.fillStyle(color, 1);
  rows.forEach((row, ry) => [...row].forEach((ch, rx) => ch === '#' && g.fillRect(x + rx, y + ry, 1, 1)));
}

// ---------- Отображение бойца ----------

interface UnitView {
  id: string;
  def: UnitDef;
  hero: boolean;
  /** Точка ног в координатах арены 480×270. */
  home: { x: number; y: number };
  /** Видимые границы фигуры в координатах арены. */
  box: { x0: number; y0: number; x1: number; y1: number };
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics;
  bars: Phaser.GameObjects.Graphics;
  zone: Phaser.GameObjects.Zone;
  guardIcon: Phaser.GameObjects.Image;
  windupMark: Phaser.GameObjects.Text;
  breath: Phaser.Tweens.Tween | null;
  hpShown: number;
  mpShown: number;
}

type Phase = 'intro' | 'input' | 'busy' | 'over';

export class BattleScene extends Phaser.Scene {
  private state!: BattleState;
  private manifest!: Manifest;
  private viewport!: Viewport;
  private layout!: Layout;
  /** Номер боя: старые асинхронные цепочки после перезапуска прекращаются. */
  private gen = 0;
  private phase: Phase = 'intro';

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
  private cardPortrait!: Phaser.GameObjects.Image;
  private cardName!: Phaser.GameObjects.Text;
  private cardHp!: Phaser.GameObjects.Text;
  private cardMp!: Phaser.GameObjects.Text;
  private abilityButtons: Button[] = [];
  private confirmBtn!: Button;
  private soundBtn!: Button;
  private fsBtn!: Button | null;
  private activeMarker!: Phaser.GameObjects.Image;
  private brackets!: Phaser.GameObjects.Graphics;

  private overlay!: Phaser.GameObjects.Container;
  private overlayShade!: Phaser.GameObjects.Rectangle;
  private overlayPanel!: Phaser.GameObjects.Container;

  // Выбор игрока
  private sel: { ability: string | null; target: string | null } = { ability: null, target: null };
  private lastEnemyTarget: string | null = null;
  private resolveAction: ((a: Action) => void) | null = null;

  // Пауза
  private pauseReasons = new Set<'hidden' | 'portrait'>();
  private waitingResumeTap = false;
  private isPaused = false;

  constructor() {
    super('battle');
  }

  // ======================= Создание =======================

  create(): void {
    this.gen += 1;
    this.phase = 'intro';
    this.views.clear();
    this.abilityButtons = [];
    this.sel = { ability: null, target: null };
    this.resolveAction = null;
    this.pauseReasons.clear();
    this.waitingResumeTap = false;
    this.isPaused = false;

    this.manifest = this.registry.get('manifest') as Manifest;
    this.viewport = this.registry.get('viewport') as Viewport;
    this.state = createBattle((Math.random() * 2 ** 31) | 0);

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

  private buildWorld(): void {
    this.world = this.add.container(0, 0);
    this.bgLayer = this.add.container(0, 0);
    this.groundLayer = this.add.container(0, 0);
    this.unitLayer = this.add.container(0, 0);
    this.overLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.world.add([this.bgLayer, this.groundLayer, this.unitLayer, this.overLayer, this.fxLayer]);

    // Фон продлевается зеркальными копиями на широких и высоких экранах.
    const bgKey = this.manifest.world_layers[0].texture;
    for (let gy = -1; gy <= 1; gy++) {
      for (let gx = -1; gx <= 1; gx++) {
        if (gx === 0 && gy === 0) continue;
        const img = this.add
          .image(gx * BASE_W, gy * BASE_H, bgKey)
          .setOrigin(0, 0)
          .setFlip(gx !== 0, gy !== 0)
          .setTint(0xc8c8c8);
        this.bgLayer.add(img);
      }
    }
    for (const layer of this.manifest.world_layers) this.bgLayer.add(this.placeImage(layer));

    const placements = [...this.manifest.enemies, ...this.manifest.party].sort((a, b) => a.y - b.y);
    for (const p of placements) this.createUnitView(p);

    this.activeMarker = this.add.image(0, 0, 'ui/active_turn').setOrigin(0.5, 1).setVisible(false);
    this.overLayer.add(this.activeMarker);
    this.tweens.add({ targets: this.activeMarker, y: '-=3', duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.brackets = this.add.graphics();
    this.overLayer.add(this.brackets);
    this.tweens.add({ targets: this.brackets, alpha: { from: 1, to: 0.45 }, duration: 420, yoyo: true, repeat: -1 });
  }

  private placeImage(p: Placement): Phaser.GameObjects.Image {
    const tex = this.textures.get(p.texture).getSourceImage();
    return this.add
      .image(Math.round(p.x - p.origin_x * tex.width), Math.round(p.y - p.origin_y * tex.height), p.texture)
      .setOrigin(0, 0);
  }

  private createUnitView(p: Placement): void {
    const id = p.id!;
    const d = def(id);
    const hero = d.side === 'hero';
    const src = this.textures.get(p.texture).getSourceImage();
    const left = Math.round(p.x - p.origin_x * src.width);
    const top = Math.round(p.y - p.origin_y * src.height);
    const bb = BBOX[id];
    const box = { x0: left + bb[0], y0: top + bb[1], x1: left + bb[2], y1: top + bb[3] };
    const home = { x: p.x, y: p.y };

    const shadow = this.add.image(Math.round(home.x), home.y + (hero ? 0 : -1), SHADOW[id]).setOrigin(0.5, 0.5);
    const ring = this.add.graphics();
    this.groundLayer.add([shadow, ring]);

    // Спрайт с опорой в точке ног: так «дыхание» и выпады не сдвигают ступни.
    const footY = (home.y - top) / src.height;
    const sprite = this.add.image(home.x, home.y, p.texture).setOrigin(p.origin_x, footY);
    this.unitLayer.add(sprite);

    const bars = this.add.graphics();
    const guardIcon = this.add.image(box.x1 + 2, box.y0 + 2, ICON.shield).setOrigin(0.5, 0.5).setVisible(false);
    const windupMark = outlined(this, box.x0 - 6, box.y0 - 4, '!', FONT_BODY, COLOR.dmg).setOrigin(0.5, 0.5).setVisible(false);
    this.overLayer.add([bars, guardIcon, windupMark]);

    // Крупная зона касания: не меньше 40 единиц по ширине и 48 по высоте.
    const zw = Math.max(40, box.x1 - box.x0 + 8);
    const zh = Math.max(48, home.y - box.y0 + 14);
    const zone = this.add.zone(home.x, home.y + 6, zw, zh).setOrigin(0.5, 1).setInteractive();
    zone.on('pointerup', () => this.onUnitTap(id));
    this.overLayer.add(zone);

    const view: UnitView = {
      id, def: d, hero, home, box, sprite, shadow, ring, bars, zone, guardIcon, windupMark,
      breath: null, hpShown: d.maxHp, mpShown: d.maxMp,
    };
    // Лёгкое «дыхание» вместо покадровой анимации.
    view.breath = this.tweens.add({
      targets: sprite,
      scaleY: 1.03,
      duration: 900 + Math.random() * 300,
      delay: Math.random() * 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.views.set(id, view);
    this.drawBars(view);
  }

  private buildHud(): void {
    this.hud = this.add.container(0, 0);

    // Очередь ходов
    this.strip = this.add.container(0, 0);
    this.hud.add(this.strip);

    // Информационная панель
    this.info = this.add.container(0, 0);
    this.infoBg = panel(this, 0, 0, 300, 40);
    this.infoTitle = text(this, 8, 6, '', FONT_COMPACT, COLOR.ink);
    this.infoBody = text(this, 8, 6 + LINE_16, '', FONT_COMPACT, COLOR.inkSoft);
    this.info.add([this.infoBg, this.infoTitle, this.infoBody]);
    this.hud.add(this.info);

    // Карточка текущего бойца
    this.card = this.add.container(0, 0);
    const cardBg = panel(this, 0, 0, CARD_W, BAR_H);
    const frame = this.add.rectangle(5, 9, PORTRAIT_SIZE + 2, PORTRAIT_SIZE + 2, HEX.ink).setOrigin(0, 0);
    this.cardPortrait = this.add.image(0, 0, 'heroes/warrior').setOrigin(0, 0);
    this.cardName = text(this, 33, 4, '', FONT_COMPACT, COLOR.ink);
    this.cardHp = text(this, 33, 4 + LINE_16, '', FONT_COMPACT, COLOR.hp);
    this.cardMp = text(this, 33, 4 + LINE_16, '', FONT_COMPACT, COLOR.mp);
    this.card.add([cardBg, frame, this.cardPortrait, this.cardName, this.cardHp, this.cardMp]);
    this.card.setVisible(false);
    this.hud.add(this.card);

    // Кнопки способностей и подтверждения
    for (let i = 0; i < 2; i++) {
      const b = new Button(this, { width: BTN_W, height: BAR_H, label: ' ', icon: ICON.sword, pad: 2 }, () =>
        this.onAbilityTap(i),
      );
      this.abilityButtons.push(b);
      this.hud.add(b);
    }
    this.confirmBtn = new Button(this, { width: CONFIRM_W, height: BAR_H, label: 'Применить', pad: 2 }, () =>
      this.confirm(),
    );
    this.confirmBtn.setSelected(true);
    this.hud.add(this.confirmBtn);

    // Звук и полный экран
    const settings = loadSettings();
    sfx.enabled = settings.sound;
    this.soundBtn = new Button(
      this,
      {
        width: SIDE_BTN,
        height: SIDE_BTN,
        pad: 4,
        draw: (g, w, h) => drawPixels(g, sfx.enabled ? ICON_SOUND_ON : ICON_SOUND_OFF, Math.round((w - 16) / 2), Math.round((h - 1 - 10) / 2), HEX.ink),
      },
      () => {
        sfx.enabled = !sfx.enabled;
        saveSettings({ ...loadSettings(), sound: sfx.enabled });
        this.soundBtn.redraw();
        sfx.play('tap');
        this.showInfo(sfx.enabled ? 'Звук включён' : 'Звук выключен', '');
      },
    );
    this.hud.add(this.soundBtn);
    this.fsBtn = null;
    if (canFullscreen()) {
      const fs = new Button(
        this,
        {
          width: SIDE_BTN,
          height: SIDE_BTN,
          pad: 4,
          draw: (g, w, h) => drawPixels(g, isFullscreen() ? ICON_FS_EXIT : ICON_FS_ENTER, Math.round((w - 14) / 2), Math.round((h - 1 - 12) / 2), HEX.ink),
        },
        () => {
          sfx.play('tap');
          toggleFullscreen();
        },
      );
      this.fsBtn = fs;
      this.hud.add(fs);
      const onFs = () => fs.redraw();
      document.addEventListener('fullscreenchange', onFs);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('fullscreenchange', onFs));
    }
    this.setPlayerControls(false);
  }

  private buildOverlay(): void {
    this.overlay = this.add.container(0, 0).setVisible(false);
    this.overlayShade = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.6).setOrigin(0, 0).setInteractive();
    this.overlayPanel = this.add.container(0, 0);
    this.overlay.add([this.overlayShade, this.overlayPanel]);
    this.overlayShade.on('pointerup', () => {
      if (this.waitingResumeTap) this.resumeFromTap();
    });
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

    // Правый верх: полный экран и звук столбиком
    let sideY = top;
    if (this.fsBtn) {
      this.fsBtn.setPosition(right - SIDE_BTN, sideY);
      sideY += SIDE_BTN + 6;
    }
    this.soundBtn.setPosition(right - SIDE_BTN, sideY);

    // Очередь ходов — слева столбиком
    this.strip.setPosition(left, top);

    // Панель подсказок — сверху между очередью и кнопками
    const x0 = left + CELL + 8;
    const x1 = right - SIDE_BTN - 8;
    this.infoWidth = Math.min(340, x1 - x0);
    this.info.setPosition(Math.round((x0 + x1) / 2 - this.infoWidth / 2), top);
    this.relayoutInfo();

    // Нижняя панель: карточка слева, действия справа (под большие пальцы)
    const barY = bottom - BAR_H;
    this.card.setPosition(left, barY);
    this.confirmBtn.setPosition(right - CONFIRM_W, barY);
    this.abilityButtons[1].setPosition(right - CONFIRM_W - 6 - BTN_W, barY);
    this.abilityButtons[0].setPosition(right - CONFIRM_W - 12 - BTN_W * 2, barY);

    this.overlayShade.setSize(W, H);
    this.overlayShade.input?.hitArea.setSize(W, H);
    this.layoutOverlayPanel();

    // Повернули в портрет — бой ставится на паузу, пока экран снова не станет горизонтальным.
    this.setPauseReason('portrait', l.portrait);
  }

  // ======================= Основной цикл боя =======================

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, () => r()));
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((r) => {
      this.tweens.add({ ...cfg, onComplete: () => r() });
    });
  }

  private async runBattle(gen: number): Promise<void> {
    this.showInfo('Бой у старого шлюза', 'Гоблин и два гриба преграждают путь!');
    this.refreshStrip();
    await this.wait(900);
    if (gen !== this.gen) return;

    await this.playEvents(startBattle(this.state), gen);
    while (gen === this.gen && this.state.result === 'ongoing') {
      const id = currentUnitId(this.state)!;
      let action: Action;
      if (def(id).side === 'hero') {
        action = await this.waitForPlayer(id);
      } else {
        await this.wait(550);
        if (gen !== this.gen) return;
        action = enemyDecide(this.state, id);
      }
      if (gen !== this.gen) return;
      this.phase = 'busy';
      this.setPlayerControls(false);
      await this.playEvents(perform(this.state, action), gen);
      if (gen !== this.gen) return;
      if (this.state.result !== 'ongoing') break;
      await this.wait(250);
      await this.playEvents(advance(this.state), gen);
    }
    if (gen !== this.gen) return;
    this.phase = 'over';
    await this.wait(500);
    if (gen === this.gen) this.showResult();
  }

  private waitForPlayer(id: string): Promise<Action> {
    this.phase = 'input';
    this.sel = { ability: null, target: null };
    this.updateAbilityButtons(id);
    this.setPlayerControls(true);
    this.showTurnPrompt(id);
    return new Promise((resolve) => {
      this.resolveAction = resolve;
    });
  }

  // ======================= Действия игрока =======================

  private actorId(): string {
    return currentUnitId(this.state)!;
  }

  private onAbilityTap(index: number): void {
    if (this.phase !== 'input' || this.isPaused) return;
    const actor = this.actorId();
    const abilityId = def(actor).abilities[index];
    const check = checkAbility(this.state, actor, abilityId);

    if (!check.ok) {
      sfx.play('deny');
      this.abilityButtons[index].shake();
      this.clearSelection();
      this.showInfo(this.abilityTitle(abilityId), check.reason, true);
      return;
    }
    if (this.sel.ability === abilityId) {
      // Повторное касание отменяет выбор.
      sfx.play('tap');
      this.clearSelection();
      this.showTurnPrompt(actor);
      return;
    }
    sfx.play('select');
    this.sel.ability = abilityId;
    const prev = this.sel.target;
    this.sel.target = prev && check.targets.includes(prev) ? prev : this.defaultTarget(actor, abilityId, check.targets);
    this.refreshSelection();
  }

  private defaultTarget(actor: string, abilityId: string, targets: string[]): string {
    const a = ability(abilityId);
    if (a.target === 'enemy') {
      return this.lastEnemyTarget && targets.includes(this.lastEnemyTarget) ? this.lastEnemyTarget : targets[0];
    }
    if (a.effect.kind === 'guard') {
      const aim = this.state.units.brute?.alive ? this.state.units.brute.windupTarget : null;
      if (aim && targets.includes(aim)) return aim;
    }
    // Самый раненый союзник
    return [...targets].sort((x, y) => {
      const ux = this.state.units[x];
      const uy = this.state.units[y];
      return ux.hp / def(x).maxHp - uy.hp / def(y).maxHp;
    })[0] ?? actor;
  }

  private onUnitTap(id: string): void {
    if (this.isPaused || this.phase === 'over') return;
    if (this.phase === 'input' && this.sel.ability) {
      const targets = validTargets(this.state, this.actorId(), this.sel.ability);
      if (targets.includes(id)) {
        if (this.sel.target === id) {
          this.confirm();
        } else {
          sfx.play('tap');
          this.sel.target = id;
          this.refreshSelection();
        }
        return;
      }
      sfx.play('deny');
      const a = ability(this.sel.ability);
      const need =
        a.target === 'enemy' ? 'нужен противник' : a.target === 'ally-wounded' ? 'нужен раненый союзник' : 'нужен союзник';
      this.showInfo(this.abilityTitle(this.sel.ability), `${def(id).name} не подходит: ${need}.\n${this.previewLine()}`, true);
      return;
    }
    sfx.play('tap');
    this.showUnitInfo(id);
  }

  private confirm(): void {
    if (this.phase !== 'input' || this.isPaused || !this.sel.ability || !this.sel.target) return;
    const resolve = this.resolveAction;
    if (!resolve) return;
    // Защита от повторных касаний: сразу закрываем ввод.
    this.resolveAction = null;
    this.phase = 'busy';
    const action: Action = { actor: this.actorId(), ability: this.sel.ability, target: this.sel.target };
    if (ability(action.ability).target === 'enemy') this.lastEnemyTarget = action.target;
    sfx.play('select');
    this.clearSelection();
    this.setPlayerControls(false);
    resolve(action);
  }

  private clearSelection(): void {
    this.sel = { ability: null, target: null };
    this.refreshSelection();
  }

  private refreshSelection(): void {
    this.abilityButtons.forEach((b, i) => {
      const actor = currentUnitId(this.state);
      const abilityId = actor ? def(actor).abilities[i] : null;
      b.setSelected(!!abilityId && abilityId === this.sel.ability);
    });
    this.confirmBtn.setVisible(this.phase === 'input' && !!this.sel.ability && !!this.sel.target);

    const targets =
      this.phase === 'input' && this.sel.ability ? validTargets(this.state, this.actorId(), this.sel.ability) : [];
    for (const v of this.views.values()) {
      v.ring.clear();
      if (!targets.includes(v.id)) continue;
      const selected = v.id === this.sel.target;
      const rw = Math.max(v.shadow.width + 8, 26);
      v.ring.lineStyle(selected ? 2 : 1, selected ? HEX.ringSelected : HEX.ring, selected ? 1 : 0.85);
      v.ring.strokeEllipse(v.home.x, v.home.y, rw, 9);
    }
    this.drawBrackets();
    if (this.phase === 'input' && this.sel.ability) {
      this.showInfo(this.abilityTitle(this.sel.ability), `${ability(this.sel.ability).text}\n${this.previewLine()}`);
    }
  }

  private drawBrackets(): void {
    const g = this.brackets;
    g.clear();
    if (!this.sel.target || !this.sel.ability) return;
    const v = this.views.get(this.sel.target)!;
    const x0 = v.box.x0 - 3;
    const y0 = v.box.y0 - 3;
    const x1 = v.box.x1 + 3;
    const y1 = v.home.y + 3;
    const L = 5;
    g.fillStyle(HEX.ringSelected, 1);
    for (const [cx, cy, sx, sy] of [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x0, y1, 1, -1],
      [x1, y1, -1, -1],
    ] as const) {
      g.fillRect(sx > 0 ? cx : cx - L + 1, sy > 0 ? cy : cy - 1, L, 2);
      g.fillRect(sx > 0 ? cx : cx - 1, sy > 0 ? cy : cy - L + 1, 2, L);
    }
  }

  private abilityTitle(abilityId: string): string {
    const a = ability(abilityId);
    return a.cost > 0 ? `${a.name} · ${a.cost} маны` : a.name;
  }

  private previewLine(): string {
    if (!this.sel.ability || !this.sel.target) return '';
    const p = preview(this.state, { actor: this.actorId(), ability: this.sel.ability, target: this.sel.target });
    const name = def(this.sel.target).name;
    if (p.kind === 'heal') return `→ ${name}: +${p.amount} здоровья`;
    if (p.kind === 'guard') return `→ ${name} под защитой до хода воина`;
    const note = p.mod === 'resist' ? ' (броня)' : p.mod === 'weak' ? ' (уязвим!)' : '';
    return `→ ${name}: −${p.amount}${note}`;
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

  private showTurnPrompt(id: string): void {
    const d = def(id);
    const title = `Раунд ${this.state.round} · Ход: ${d.name}`;
    const u = this.state.units[id];
    const aim = this.state.units.brute?.alive ? this.state.units.brute.windupTarget : null;
    let hint = 'Выберите действие внизу. Касание бойца — подробности.';
    if (aim && id === 'warrior' && u.mp >= ability('guard').cost) {
      hint = `Броневик замахнулся на ${def(aim).nameAcc}. Его можно защитить.`;
    }
    this.showInfo(title, hint);
  }

  private showUnitInfo(id: string): void {
    const d = def(id);
    const u = this.state.units[id];
    let title = `${d.name}  ♥${u.hp}/${d.maxHp}`;
    if (d.side === 'hero') title += `  ♦${u.mp}/${d.maxMp}`;
    const status: string[] = [];
    if (!u.alive) status.push(d.side === 'hero' ? 'Без сознания, пропускает ход.' : 'Побеждён.');
    if (u.guardedBy) status.push('Под защитой воина.');
    if (u.guarding) status.push(`Защищает: ${def(u.guarding).nameAcc}.`);
    const aim = this.state.units.brute?.alive ? this.state.units.brute.windupTarget : null;
    if (aim === id) status.push('На него замахнулся броневик!');
    if (id === 'brute' && aim) status.push(`Замахнулся на ${def(aim).nameAcc}.`);
    this.showInfo(title, [d.traits, ...status].join(' '));
  }

  private setPlayerControls(on: boolean): void {
    for (const b of this.abilityButtons) b.setVisible(on);
    this.confirmBtn.setVisible(on && !!this.sel.ability && !!this.sel.target);
  }

  private updateAbilityButtons(actor: string): void {
    def(actor).abilities.forEach((abilityId, i) => {
      const a = ability(abilityId);
      const b = this.abilityButtons[i];
      b.setIcon(ICON[a.icon]).setLabel(a.label).setSelected(false);
      b.setDisabled(!checkAbility(this.state, actor, abilityId).ok);
    });
  }

  private updateCard(id: string): void {
    const d = def(id);
    const u = this.state.units[id];
    const tex = this.views.get(id)!.sprite.texture.key;
    const [px, py] = PORTRAIT[id];
    this.cardPortrait.setTexture(tex).setCrop(px, py, PORTRAIT_SIZE, PORTRAIT_SIZE).setPosition(6 - px, 10 - py);
    this.card.setVisible(true);
    this.cardName.setText(d.name);
    this.cardHp.setText(`♥${u.hp}/${d.maxHp}`);
    if (d.side === 'hero') {
      this.cardMp.setText(`♦${u.mp}/${d.maxMp}`).setVisible(true);
      this.cardMp.setX(this.cardHp.x + Math.round(this.cardHp.width) + 6);
    } else {
      this.cardMp.setVisible(false);
    }
  }

  private refreshStrip(): void {
    this.strip.removeAll(true);
    const ids = upcomingTurns(this.state, STRIP_CELLS);
    const current = this.state.round > 0 ? currentUnitId(this.state) : null;
    ids.forEach((id, i) => {
      const y = i * (CELL + 2);
      const hero = def(id).side === 'hero';
      const active = i === 0 && id === current;
      const g = this.add.graphics();
      g.fillStyle(active ? HEX.gold : HEX.outline, 1).fillRect(0, y, CELL, CELL);
      g.fillStyle(hero ? 0x24405f : 0x5a2420, 1).fillRect(2, y + 2, CELL - 4, CELL - 4);
      g.fillStyle(hero ? HEX.heroCell : HEX.enemyCell, 1).fillRect(2, y + CELL - 4, CELL - 4, 2);
      const tex = this.views.get(id)!.sprite.texture.key;
      const [px, py] = PORTRAIT[id];
      const img = this.add
        .image(2 - px, y + 2 - py, tex)
        .setOrigin(0, 0)
        .setCrop(px, py, PORTRAIT_SIZE, PORTRAIT_SIZE);
      this.strip.add([g, img]);
      const zone = this.add.zone(0, y, CELL, CELL).setOrigin(0, 0).setInteractive();
      zone.on('pointerup', () => this.onUnitTap(id));
      this.strip.add(zone);
    });
  }

  // ======================= Полоски здоровья и маны =======================

  private drawBars(v: UnitView): void {
    const g = v.bars;
    g.clear();
    const u = this.state.units[v.id];
    if (!v.hero && !u.alive && v.hpShown <= 0) return;
    const w = 30;
    const x = Math.round(v.home.x - w / 2);
    const hpH = 4;
    const mpH = 3;
    const y = v.hero ? v.home.y + 4 : v.box.y0 - 9;
    const total = v.hero ? hpH + 1 + mpH : hpH;
    g.fillStyle(HEX.outline, 1).fillRect(x - 1, y - 1, w + 2, total + 2);
    g.fillStyle(HEX.barBack, 1).fillRect(x, y, w, hpH);
    const ratio = Math.max(0, v.hpShown / v.def.maxHp);
    const color = v.hero ? (ratio < 0.35 ? HEX.hpLow : HEX.hpHero) : HEX.hpEnemy;
    g.fillStyle(color, 1).fillRect(x, y, Math.round(w * ratio), hpH);
    if (v.hero) {
      g.fillStyle(HEX.barBack, 1).fillRect(x, y + hpH + 1, w, mpH);
      const mr = v.def.maxMp > 0 ? Math.max(0, v.mpShown / v.def.maxMp) : 0;
      g.fillStyle(HEX.mp, 1).fillRect(x, y + hpH + 1, Math.round(w * mr), mpH);
    }
  }

  private animateBars(v: UnitView): void {
    const u = this.state.units[v.id];
    const fromHp = v.hpShown;
    const fromMp = v.mpShown;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 380,
      ease: 'Quad.Out',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 1;
        v.hpShown = fromHp + (u.hp - fromHp) * t;
        v.mpShown = fromMp + (u.mp - fromMp) * t;
        this.drawBars(v);
      },
    });
  }

  // ======================= Проигрывание событий =======================

  private async playEvents(events: BattleEvent[], gen: number): Promise<void> {
    const returns: Promise<void>[] = [];
    for (let i = 0; i < events.length; i++) {
      if (gen !== this.gen) return;
      const e = events[i];
      switch (e.type) {
        case 'turnStart':
          await this.onTurnStart(e.unit, e.mpGain);
          break;
        case 'guardEnd':
          this.views.get(e.ward)!.guardIcon.setVisible(false);
          break;
        case 'use': {
          const next = events.slice(i + 1).find((x) => x.type === 'damage' || x.type === 'heal');
          await this.animateUse(e.actor, e.ability, e.target, next, returns);
          break;
        }
        case 'damage':
          await this.onDamage(e);
          break;
        case 'heal':
          await this.onHeal(e.target, e.amount);
          break;
        case 'guard':
          await this.onGuard(e.guard, e.ward);
          break;
        case 'windup':
          await this.onWindup(e.actor, e.target);
          break;
        case 'death':
          await this.onDeath(e.unit);
          break;
        case 'end':
          break;
      }
    }
    await Promise.all(returns);
  }

  private async onTurnStart(id: string, mpGain: number): Promise<void> {
    const v = this.views.get(id)!;
    this.refreshStrip();
    this.updateCard(id);
    this.activeMarker.setVisible(true).setPosition(v.home.x, (v.hero ? v.box.y0 : v.box.y0 - 10) - 3);
    if (mpGain > 0) {
      this.animateBars(v);
      this.float(v, `+${mpGain} мана`, COLOR.mana, 0);
    }
    if (v.hero) {
      sfx.play('turn');
    } else {
      this.showInfo(`Раунд ${this.state.round} · Ход: ${v.def.name}`, 'Враг выбирает действие…');
    }
  }

  private narrate(actor: string, abilityId: string, target: string): void {
    const a = def(actor);
    const t = def(target);
    const tAcc = actor === target ? 'себя' : t.nameAcc;
    let line: string;
    switch (abilityId) {
      case 'slingshot': line = `${a.name} стреляет из рогатки в ${tAcc}.`; break;
      case 'windup': line = `${a.name} замахивается на ${tAcc}!`; break;
      case 'slam': line = `${a.name} обрушивает удар на ${tAcc}!`; break;
      case 'mend': line = `${a.name} лечит ${tAcc}.`; break;
      case 'spores': line = `${a.name} пускает споры в ${tAcc}.`; break;
      case 'guard': line = `${a.name} прикрывает ${tAcc}.`; break;
      default: line = `${a.name}: ${ability(abilityId).name} → ${t.name}.`;
    }
    const body = abilityId === 'windup' ? 'Удар придёт в его следующий ход. Воин может прикрыть цель.' : '';
    this.showInfo(line, body);
  }

  private chest(v: UnitView): { x: number; y: number } {
    return { x: v.home.x, y: Math.round(v.box.y0 + (v.home.y - v.box.y0) * 0.45) };
  }

  private async animateUse(
    actorId: string,
    abilityId: string,
    targetId: string,
    next: BattleEvent | undefined,
    returns: Promise<void>[],
  ): Promise<void> {
    this.narrate(actorId, abilityId, targetId);
    if (abilityId === 'slam') this.views.get(targetId)!.windupMark.setVisible(false);
    const a = ability(abilityId);
    const actor = this.views.get(actorId)!;

    // Воин встаёт перед союзником, если удар перенаправлен на него.
    let impactId = targetId;
    if (next && next.type === 'damage' && next.redirectedFrom) {
      impactId = next.target;
      const guard = this.views.get(next.target)!;
      const ward = this.views.get(next.redirectedFrom)!;
      this.unitLayer.bringToTop(guard.sprite);
      await this.tween({
        targets: guard.sprite,
        x: ward.home.x + (guard.home.x < ward.home.x ? -8 : 8),
        y: ward.home.y - 8,
        duration: 200,
        ease: 'Quad.Out',
      });
      this.float(guard, 'Защита!', COLOR.light, -8);
      sfx.play('guard');
    }
    const impact = this.views.get(impactId)!;
    const from = this.chest(actor);
    const to = impactId === targetId ? this.chest(impact) : { x: impact.sprite.x, y: impact.sprite.y - 20 };

    switch (a.fx) {
      case 'melee':
      case 'slam': {
        const dx = to.x - actor.home.x;
        const dy = to.y - from.y;
        const k = a.fx === 'slam' ? 0.75 : 0.6;
        await this.tween({
          targets: actor.sprite,
          x: actor.home.x + dx * k,
          y: actor.home.y + dy * k,
          duration: a.fx === 'slam' ? 220 : 160,
          ease: 'Quad.In',
        });
        if (a.fx === 'slam') this.cameras.main.shake(180, 0.006);
        returns.push(
          this.tween({ targets: actor.sprite, x: actor.home.x, y: actor.home.y, duration: 240, delay: 80, ease: 'Quad.Out' }),
        );
        break;
      }
      case 'arrow':
        sfx.play('arrow');
        await this.projectile('arrow', from, to, 230);
        break;
      case 'pebble':
        await this.projectile('pebble', from, to, 320);
        break;
      case 'fireball':
        sfx.play('fire');
        await this.hop(actor);
        await this.projectile('fireball', from, to, 380);
        break;
      case 'spores':
        await this.projectile('spores', from, to, 420);
        break;
      case 'heal':
        await this.hop(actor);
        break;
      case 'guard':
        await this.hop(actor);
        break;
    }
  }

  private hop(v: UnitView): Promise<void> {
    return this.tween({ targets: v.sprite, y: v.home.y - 5, duration: 110, yoyo: true, ease: 'Quad.Out' });
  }

  private projectile(kind: 'arrow' | 'pebble' | 'fireball' | 'spores', from: { x: number; y: number }, to: { x: number; y: number }, ms: number): Promise<void> {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    let obj: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
    if (kind === 'fireball') {
      obj = this.add.image(from.x, from.y, ICON.fire).setOrigin(0.5, 0.5);
      this.tweens.add({ targets: obj, scale: { from: 0.7, to: 1.1 }, duration: ms });
    } else {
      const g = this.add.graphics();
      if (kind === 'arrow') {
        g.fillStyle(0x3d2215, 1).fillRect(-7, -1, 9, 2);
        g.fillStyle(0xce9655, 1).fillRect(-6, -0.5, 7, 1);
        g.fillStyle(0xd3d3d6, 1).fillRect(1, -1, 2, 2);
        g.fillStyle(0xd9453b, 1).fillRect(-8, -1.5, 2, 3);
        g.setRotation(angle);
      } else if (kind === 'pebble') {
        g.fillStyle(0x2a2a2a, 1).fillRect(-1.5, -1.5, 3, 3);
        g.fillStyle(0x9a9a96, 1).fillRect(-1, -1, 2, 2);
      } else {
        g.fillStyle(0xc77dff, 1);
        for (const [sx, sy] of [[0, 0], [-4, 2], [3, -3], [-2, -4]]) g.fillRect(sx, sy, 2, 2);
      }
      g.setPosition(from.x, from.y);
      obj = g;
    }
    this.fxLayer.add(obj);
    const arc = kind === 'pebble' ? 16 : kind === 'spores' ? 6 : 0;
    return new Promise((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        ease: kind === 'arrow' ? 'Linear' : 'Sine.In',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 1;
          obj.setPosition(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * arc);
        },
        onComplete: () => {
          obj.destroy();
          resolve();
        },
      });
    });
  }

  private flash(v: UnitView): void {
    v.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(90, () => {
      v.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      if (!this.state.units[v.id].alive && v.hero) v.sprite.setTint(0x7a7a7a);
    });
  }

  private float(v: UnitView, value: string, color: string, dy: number, size = FONT_COMPACT): void {
    const baseY = (v.hero ? v.box.y0 : v.box.y0 - 10) - 4 + dy;
    const t = outlined(this, v.home.x, baseY, value, size, color).setOrigin(0.5, 1);
    t.setX(Math.round(v.home.x));
    this.fxLayer.add(t);
    this.tweens.add({ targets: t, y: baseY - 16, duration: 900, ease: 'Quad.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 650, duration: 300, onComplete: () => t.destroy() });
  }

  private async onDamage(e: Extract<BattleEvent, { type: 'damage' }>): Promise<void> {
    const v = this.views.get(e.target)!;
    const heavy = e.amount >= 10;
    sfx.play(e.damageType === 'fire' ? 'fire' : heavy ? 'heavy' : 'hit');
    this.flash(v);
    const x = v.sprite.x;
    this.tweens.add({
      targets: v.sprite,
      x: { from: x - 2, to: x },
      duration: 240,
      ease: (t: number) => Math.sin(t * Math.PI * 5) * (1 - t) + t,
    });
    this.float(v, `−${e.amount}`, e.damageType === 'fire' ? COLOR.fire : COLOR.dmg, 0, heavy ? FONT_BODY : FONT_COMPACT);
    if (e.mod === 'resist') this.float(v, 'броня', COLOR.armor, -18);
    if (e.mod === 'weak') this.float(v, 'уязвим!', COLOR.fire, -22);
    this.animateBars(v);
    await this.wait(420);

    // Воин возвращается на место после того, как принял удар.
    if (e.redirectedFrom) {
      await this.tween({ targets: v.sprite, x: v.home.x, y: v.home.y, duration: 220, ease: 'Quad.Out' });
    }
  }

  private async onHeal(targetId: string, amount: number): Promise<void> {
    const v = this.views.get(targetId)!;
    sfx.play('heal');
    for (let i = 0; i < 6; i++) {
      const g = this.add.graphics();
      g.fillStyle(0x8dff7a, 1).fillRect(-1, -3, 2, 6).fillRect(-3, -1, 6, 2);
      g.setPosition(v.home.x - 10 + Math.random() * 20, v.home.y - 6 - Math.random() * 18);
      this.fxLayer.add(g);
      this.tweens.add({
        targets: g,
        y: g.y - 14,
        alpha: 0,
        delay: i * 60,
        duration: 600,
        onComplete: () => g.destroy(),
      });
    }
    this.float(v, `+${amount}`, COLOR.heal, 0);
    this.animateBars(v);
    await this.wait(480);
  }

  private async onGuard(guardId: string, wardId: string): Promise<void> {
    const guard = this.views.get(guardId)!;
    const ward = this.views.get(wardId)!;
    sfx.play('guard');
    const icon = this.add.image(guard.home.x, guard.box.y0, ICON.shield);
    this.fxLayer.add(icon);
    await this.tween({ targets: icon, x: ward.guardIcon.x, y: ward.guardIcon.y, duration: 260, ease: 'Quad.Out' });
    icon.destroy();
    ward.guardIcon.setVisible(true);
    this.float(ward, 'под защитой', COLOR.light, 0);
    this.animateBars(guard);
    await this.wait(300);
  }

  private async onWindup(actorId: string, targetId: string): Promise<void> {
    const actor = this.views.get(actorId)!;
    const target = this.views.get(targetId)!;
    sfx.play('windup');
    await this.tween({ targets: actor.sprite, y: actor.home.y - 6, duration: 260, ease: 'Back.Out' });
    target.windupMark.setVisible(true).setScale(0.2);
    this.tween({ targets: target.windupMark, scale: 1, duration: 200, ease: 'Back.Out' });
    await this.tween({ targets: actor.sprite, y: actor.home.y, duration: 200, ease: 'Quad.In' });
    await this.wait(700);
  }

  private async onDeath(id: string): Promise<void> {
    const v = this.views.get(id)!;
    sfx.play('death');
    v.breath?.stop();
    v.sprite.setScale(1);
    for (const other of this.views.values()) {
      if (!this.state.units.brute?.windupTarget || other.id !== this.state.units.brute.windupTarget) {
        other.windupMark.setVisible(false);
      }
    }
    v.guardIcon.setVisible(false);
    v.windupMark.setVisible(false);
    if (v.hero) {
      v.sprite.setTint(0x7a7a7a);
      await this.tween({ targets: v.sprite, alpha: 0.45, duration: 350 });
      this.float(v, 'без сил', COLOR.armor, -14);
    } else {
      v.zone.disableInteractive();
      this.tweens.add({ targets: [v.shadow, v.bars], alpha: 0, duration: 400 });
      await this.tween({ targets: v.sprite, alpha: 0, y: v.home.y + 4, duration: 450, ease: 'Quad.In' });
    }
    this.refreshStrip();
  }

  // ======================= Пауза =======================

  private onPageHidden(): void {
    sfx.pageHidden();
    if (this.phase === 'over') return;
    this.setPauseReason('hidden', true);
    this.waitingResumeTap = true;
    this.showOverlay('Пауза', 'Коснитесь экрана, чтобы продолжить бой.', null);
    // Причина «скрыто» снимается сразу: дальше ждём касания игрока.
    this.setPauseReason('hidden', false);
  }

  private resumeFromTap(): void {
    this.waitingResumeTap = false;
    this.hideOverlay();
    sfx.play('tap');
    this.updatePause();
  }

  private setPauseReason(reason: 'hidden' | 'portrait', on: boolean): void {
    if (on) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    this.updatePause();
  }

  private updatePause(): void {
    const shouldPause = this.pauseReasons.size > 0 || this.waitingResumeTap;
    if (shouldPause === this.isPaused) return;
    this.isPaused = shouldPause;
    this.time.paused = shouldPause;
    if (shouldPause) this.tweens.pauseAll();
    else this.tweens.resumeAll();
  }

  // ======================= Оверлей: пауза и итог =======================

  private showOverlay(title: string, body: string, button: { label: string; onTap: () => void } | null): void {
    this.overlayPanel.removeAll(true);
    const w = 260;
    const titleText = text(this, 0, 10, title, FONT_BODY, COLOR.ink);
    const bodyText = text(this, 0, 0, body, FONT_COMPACT, COLOR.inkSoft, { align: 'center' }).setWordWrapWidth(w - 24, true);
    const titleH = Math.round(titleText.height);
    bodyText.setPosition(Math.round((w - bodyText.width) / 2), 10 + titleH + 4);
    titleText.setX(Math.round((w - titleText.width) / 2));
    let h = 10 + titleH + 4 + Math.round(bodyText.height) + 12;
    const items: Phaser.GameObjects.GameObject[] = [];
    if (button) {
      const btn = new Button(this, { width: 140, height: 42, label: button.label, pad: 4 }, button.onTap);
      btn.setSelected(true).setPosition(Math.round((w - 140) / 2), h);
      h += 42 + 12;
      items.push(btn);
    }
    const bg = panel(this, 0, 0, w, h);
    this.overlayPanel.add([bg, titleText, bodyText, ...items]);
    this.overlayPanel.setSize(w, h);
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

  private hideOverlay(): void {
    this.overlay.setVisible(false);
  }

  private showResult(): void {
    const win = this.state.result === 'victory';
    sfx.play(win ? 'victory' : 'defeat');
    this.activeMarker.setVisible(false);
    const alive = Object.values(this.state.units).filter((u) => u.alive && def(u.id).side === 'hero').length;
    const body = win
      ? `Путь у шлюза свободен. Раундов: ${this.state.round}. В строю: ${alive} из 4.`
      : 'Отряд отступает. Попробуйте другую тактику: сначала уберите гриба-лекаря, а броневика жгите огнём.';
    this.showInfo(win ? 'Победа!' : 'Поражение', win ? 'Отличная работа.' : 'Не сдавайтесь!');
    this.showOverlay(win ? 'Победа!' : 'Поражение', body, {
      label: 'Ещё раз',
      onTap: () => {
        sfx.play('select');
        this.scene.restart();
      },
    });
  }
}
