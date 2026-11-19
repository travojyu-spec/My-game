import Phaser from 'phaser';
import { assetUrl, embeddedManifest, loadFont, MANIFEST_URL, type Manifest } from './core/assets';
import { canFullscreen, enterFullscreen } from './core/screen';
import { loadSettings } from './core/settings';
import { sfx } from './core/sfx';
import { Viewport } from './core/viewport';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import type { BattleState } from './battle/core';
import type { BattleSetup } from './game/progress';
import { App } from './ui/app';

function bootMessage(text: string): void {
  const el = document.getElementById('boot-text');
  if (el) el.textContent = text;
}

async function loadManifest(): Promise<Manifest> {
  if (embeddedManifest) return embeddedManifest;
  const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`manifest.json: ${res.status}`);
  return (await res.json()) as Manifest;
}

async function start(): Promise<void> {
  // Звук включается первым касанием игрока.
  window.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
  sfx.enabled = loadSettings().sound;

  const rotateBtn = document.getElementById('rotate-fullscreen') as HTMLButtonElement;
  if (canFullscreen()) {
    rotateBtn.hidden = false;
    rotateBtn.addEventListener('click', () => void enterFullscreen());
  }

  const [manifest, fontOk] = await Promise.all([loadManifest(), loadFont()]);
  if (!fontOk) console.warn('Шрифт Tiny5 не загрузился вовремя, текст может отличаться.');

  const host = document.getElementById('game')!;
  const viewport = new Viewport(host);
  const L = viewport.layout;

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: host,
    backgroundColor: '#0f1a10',
    banner: false,
    disableContextMenu: true,
    // Чёткие пиксели одинакового размера при дробном масштабе.
    render: { smoothPixelArt: true },
    scale: {
      mode: Phaser.Scale.NONE,
      width: L.deviceW,
      height: L.deviceH,
      zoom: host.clientWidth / L.deviceW,
    },
    // Звуки синтезируются вручную, встроенное аудио Phaser не нужно.
    audio: { noAudio: true },
    input: { activePointers: 1 },
    scene: [BootScene, BattleScene],
    callbacks: {
      preBoot: (g) => {
        g.registry.set('manifest', manifest);
        g.registry.set('viewport', viewport);
        g.registry.set('onReady', () => {
          // Пока открыты меню, игровой цикл спит — экономия батареи.
          g.loop.sleep();
          app.start();
        });
      },
      postBoot: (g) => viewport.attach(g),
    },
  });

  const images = new Map(manifest.images.map((i) => [i.key, assetUrl(i.url)]));
  const runBattle = (setup: BattleSetup) =>
    new Promise<BattleState>((resolve) => {
      game.loop.wake();
      game.scene.start('battle', {
        setup,
        onEnd: (st: BattleState) => {
          game.scene.stop('battle');
          game.loop.sleep();
          resolve(st);
        },
      });
    });
  const app = new App(runBattle, (key) => images.get(key) ?? null);
  // Для отладки из консоли.
  (window as unknown as { game: Phaser.Game }).game = game;
}

start().catch((err) => {
  console.error(err);
  bootMessage('Не удалось загрузить игру. Обновите страницу.');
});
