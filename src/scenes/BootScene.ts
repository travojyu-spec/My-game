import Phaser from 'phaser';
import { assetUrl, type Manifest } from '../core/assets';

// Временная иконка лука: в наборе ассетов нет отдельной иконки для лучника.
// Нарисована в палитре иконки меча; её стоит заменить PNG от художника.
const BOW_ICON = [
  '.............ach',
  '............acca',
  '...........accca',
  '..........acccea',
  '...........aeea.',
  '..........ajka..',
  '.........ajka...',
  '........ajka....',
  '.......ajka.....',
  '......ajka......',
  '.aa..ajka.......',
  'arraajka........',
  'arrrjka.........',
  '.ajjka..........',
  'akkkRa..........',
  '.aaRRRa.........',
  '...aRa..........',
];
const BOW_PALETTE: Record<string, string> = {
  a: '#3d2215', j: '#ce9655', k: '#b07b48', c: '#d3d3d6', e: '#8d8d90', h: '#dbdfe3', r: '#d9453b', R: '#9e2a22',
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    const manifest = this.registry.get('manifest') as Manifest;
    for (const img of manifest.images) this.load.image(img.key, assetUrl(img.url));

    const failed: string[] = [];
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => failed.push(file.key));
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      const el = document.getElementById('boot-text');
      if (el) el.textContent = `Загрузка… ${Math.round(p * 100)}%`;
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (failed.length) {
        const el = document.getElementById('boot-text');
        if (el) el.textContent = `Не загрузились файлы: ${failed.join(', ')}`;
        console.error('Ассеты не загружены:', failed);
      }
    });
  }

  create(): void {
    this.makeBowIcon();
    const manifest = this.registry.get('manifest') as Manifest;
    const missing = manifest.images.filter((i) => !this.textures.exists(i.key) || this.textures.get(i.key).key === '__MISSING');
    if (missing.length) return; // сообщение уже показано
    document.getElementById('boot')?.classList.add('done');
    this.scene.start('battle');
  }

  private makeBowIcon(): void {
    if (this.textures.exists('ui/icons/bow')) return;
    const w = BOW_ICON[0].length;
    const h = BOW_ICON.length;
    const tex = this.textures.createCanvas('ui/icons/bow', w, h)!;
    const ctx = tex.getContext();
    BOW_ICON.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        ctx.fillStyle = BOW_PALETTE[ch];
        ctx.fillRect(x, y, 1, 1);
      }),
    );
    tex.refresh();
  }
}
