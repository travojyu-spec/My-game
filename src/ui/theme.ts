import Phaser from 'phaser';

export const FONT_FAMILY = '"Tiny5", monospace';
/** Tiny5 рисуется без искажений при размерах, кратных 8. Основные — 16 и 24. */
export const FONT_COMPACT = 16;
export const FONT_BODY = 24;
/** Высота строки Tiny5 16px: ascent 14 + descent 4. */
export const LINE_16 = 18;

export const COLOR = {
  ink: '#3b2414',
  inkSoft: '#6b4a2e',
  warn: '#b3261e',
  hp: '#b3261e',
  mp: '#2457b5',
  light: '#fff3d6',
  gold: '#ffd75a',
  outline: '#1c100a',
  dmg: '#ff6a55',
  fire: '#ffb347',
  heal: '#8dff7a',
  mana: '#8fc4ff',
  armor: '#d8d8d8',
};

export const HEX = {
  ink: 0x3b2414,
  outline: 0x1c100a,
  barBack: 0x2a1a10,
  hpHero: 0x62d24c,
  hpEnemy: 0xe24b3c,
  hpLow: 0xf2a33a,
  mp: 0x4a8df2,
  ring: 0xfff3d6,
  ringSelected: 0xffd75a,
  heroCell: 0x3f86f0,
  enemyCell: 0xe24b3c,
  gold: 0xffd75a,
  shade: 0x0f1a10,
};

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number = FONT_COMPACT,
  color: string = COLOR.ink,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  return scene.add
    .text(Math.round(x), Math.round(y), value, {
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      color,
      ...extra,
    })
    .setOrigin(0, 0);
}

/** Текст с тёмной обводкой для чисел урона поверх сцены. */
export function outlined(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color: string,
): Phaser.GameObjects.Text {
  return text(scene, x, y, value, size, color, {
    stroke: COLOR.outline,
    strokeThickness: size / 4,
  });
}
