import Phaser from 'phaser';
import { COLOR, FONT_COMPACT, LINE_16, text } from './theme';

// Срезы рамки кнопки action_button.png (30×24): левый 3, правый 5, верх 4, низ 5.
const SLICE = { l: 3, r: 5, t: 4, b: 5 };

export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  active = false,
): Phaser.GameObjects.NineSlice {
  return scene.add
    .nineslice(x, y, active ? 'ui/action_button_active' : 'ui/action_button', undefined, w, h, SLICE.l, SLICE.r, SLICE.t, SLICE.b)
    .setOrigin(0, 0);
}

export interface ButtonOptions {
  width: number;
  height: number;
  label?: string;
  icon?: string;
  /** Дополнительная невидимая зона касания вокруг кнопки. */
  pad?: number;
  /** Иконка над подписью (узкие кнопки умений). */
  stack?: boolean;
  /** Нарисовать содержимое вручную (иконки звука и экрана). */
  draw?: (g: Phaser.GameObjects.Graphics, w: number, h: number) => void;
}

/**
 * Кнопка на касание: срабатывает при отпускании пальца над ней.
 * Недоступную кнопку тоже можно нажать — тогда игра объясняет причину.
 */
export class Button extends Phaser.GameObjects.Container {
  readonly btnW: number;
  readonly btnH: number;
  private bg: Phaser.GameObjects.NineSlice;
  private bgActive: Phaser.GameObjects.NineSlice;
  private content: Phaser.GameObjects.Container;
  private labelText: Phaser.GameObjects.Text | null = null;
  private iconImage: Phaser.GameObjects.Image | null = null;
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private zone: Phaser.GameObjects.Zone;
  private drawFn?: ButtonOptions['draw'];
  private stack = false;
  selected = false;
  disabled = false;

  constructor(scene: Phaser.Scene, opts: ButtonOptions, onTap: () => void) {
    super(scene, 0, 0);
    this.btnW = opts.width;
    this.btnH = opts.height;
    this.stack = !!opts.stack;
    this.bg = panel(scene, 0, 0, this.btnW, this.btnH);
    this.bgActive = panel(scene, 0, 0, this.btnW, this.btnH, true).setVisible(false);
    this.content = scene.add.container(0, 0);
    this.add([this.bg, this.bgActive, this.content]);

    if (opts.draw) {
      this.drawFn = opts.draw;
      this.gfx = scene.add.graphics();
      this.content.add(this.gfx);
    }
    if (opts.icon) {
      this.iconImage = scene.add.image(0, 0, opts.icon).setOrigin(0, 0);
      this.content.add(this.iconImage);
    }
    if (opts.label !== undefined) {
      this.labelText = text(scene, 0, 0, opts.label, FONT_COMPACT, COLOR.ink);
      this.content.add(this.labelText);
    }
    this.arrange();

    const pad = opts.pad ?? 0;
    this.zone = scene.add.zone(-pad, -pad, this.btnW + pad * 2, this.btnH + pad * 2).setOrigin(0, 0);
    this.zone.setInteractive({ useHandCursor: true });
    this.add(this.zone);

    this.zone.on('pointerdown', () => this.content.setY(1));
    this.zone.on('pointerout', () => this.content.setY(0));
    this.zone.on('pointerup', () => {
      this.content.setY(0);
      if (this.visible) onTap();
    });
    scene.add.existing(this);
  }

  /** Раскладка: иконка слева, подпись справа; без иконки подпись по центру. */
  private arrange(): void {
    const icon = this.iconImage;
    const label = this.labelText;
    const cy = Math.floor((this.btnH - 1) / 2); // нижний ряд рамки темнее, центр чуть выше
    if (label) {
      label.setScale(1);
      const room = this.btnW - 6;
      if (label.width > room) label.setScale(room / label.width);
    }
    if (this.stack && icon && label) {
      icon.setPosition(Math.round((this.btnW - icon.width) / 2), 4);
      label.setPosition(Math.round((this.btnW - label.displayWidth) / 2), this.btnH - LINE_16 - 3);
    } else if (icon && label) {
      const gap = 5;
      const total = icon.width + gap + label.width;
      const x0 = Math.round((this.btnW - total) / 2);
      icon.setPosition(x0, Math.round(cy - icon.height / 2));
      label.setPosition(x0 + icon.width + gap, Math.round(cy - LINE_16 / 2) + 1);
    } else if (icon) {
      icon.setPosition(Math.round((this.btnW - icon.width) / 2), Math.round(cy - icon.height / 2));
    } else if (label) {
      label.setPosition(Math.round((this.btnW - label.width) / 2), Math.round(cy - LINE_16 / 2) + 1);
    }
    if (this.gfx && this.drawFn) {
      this.gfx.clear();
      this.drawFn(this.gfx, this.btnW, this.btnH);
    }
  }

  setLabel(value: string): this {
    if (this.labelText) {
      this.labelText.setText(value);
      this.arrange();
    }
    return this;
  }

  setIcon(key: string): this {
    this.iconImage?.setTexture(key);
    this.arrange();
    return this;
  }

  redraw(): this {
    this.arrange();
    return this;
  }

  setSelected(on: boolean): this {
    this.selected = on;
    this.bgActive.setVisible(on);
    this.bg.setVisible(!on);
    return this;
  }

  setDisabled(on: boolean): this {
    this.disabled = on;
    const a = on ? 0.45 : 1;
    this.bg.setAlpha(on ? 0.75 : 1);
    this.iconImage?.setAlpha(a);
    this.labelText?.setAlpha(on ? 0.55 : 1);
    this.gfx?.setAlpha(a);
    return this;
  }

  /** Короткое покачивание — «так нельзя». */
  shake(): void {
    const x = this.x;
    this.scene.tweens.add({
      targets: this,
      x: { from: x - 3, to: x },
      duration: 220,
      ease: (t: number) => Math.sin(t * Math.PI * 6) * (1 - t) + t,
      onComplete: () => this.setX(x),
    });
  }
}
