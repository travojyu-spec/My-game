import type Phaser from 'phaser';

/** База координат графики. */
export const BASE_W = 480;
export const BASE_H = 270;
/** Предел плотности пикселей холста, чтобы не перегружать слабые телефоны. */
const MAX_DPR = 3;

export interface Layout {
  /** Размер холста в физических пикселях. */
  deviceW: number;
  deviceH: number;
  /** Сколько физических пикселей в одной единице игры. */
  unit: number;
  /** Видимая область в единицах игры (не меньше 480×270). */
  width: number;
  height: number;
  /** Смещение мира 480×270, чтобы он стоял по центру. */
  worldX: number;
  worldY: number;
  /** Безопасные отступы (вырез камеры, системные панели) в единицах игры. */
  safe: { left: number; right: number; top: number; bottom: number };
  /** Сколько CSS-пикселей в единице игры — для проверки размера зон касания. */
  cssPerUnit: number;
  portrait: boolean;
}

export const LAYOUT_EVENT = 'layout-changed';

/**
 * Холст рисуется в физическом разрешении экрана, а мир масштабируется камерой.
 * Так пиксели спрайтов получаются одинакового размера при любом масштабе
 * (режим smoothPixelArt), а интерфейс подстраивается под реальную ширину телефона.
 */
export class Viewport {
  layout!: Layout;
  private game: Phaser.Game | null = null;
  private probe: HTMLElement;
  private pending = 0;

  constructor(private host: HTMLElement) {
    this.probe = document.getElementById('safe-probe')!;
    this.layout = this.measure();
    const schedule = () => this.schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    document.addEventListener('fullscreenchange', schedule);
  }

  attach(game: Phaser.Game): void {
    this.game = game;
    this.apply();
  }

  private schedule(): void {
    cancelAnimationFrame(this.pending);
    // Двойной кадр: после поворота браузер сообщает размеры не сразу.
    this.pending = requestAnimationFrame(() => {
      this.pending = requestAnimationFrame(() => this.apply());
    });
  }

  private measure(): Layout {
    const cssW = Math.max(1, this.host.clientWidth);
    const cssH = Math.max(1, this.host.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const deviceW = Math.round(cssW * dpr);
    const deviceH = Math.round(cssH * dpr);

    // Масштаб подбирается так, чтобы мир 480×270 целиком помещался на экране.
    const unit = Math.min(deviceW / BASE_W, deviceH / BASE_H);
    const width = deviceW / unit;
    const height = deviceH / unit;

    const cs = getComputedStyle(this.probe);
    const toUnits = (px: string) => (parseFloat(px) || 0) * (dpr / unit);
    const safe = {
      left: toUnits(cs.paddingLeft),
      right: toUnits(cs.paddingRight),
      top: toUnits(cs.paddingTop),
      bottom: toUnits(cs.paddingBottom),
    };

    return {
      deviceW,
      deviceH,
      unit,
      width,
      height,
      worldX: Math.floor((width - BASE_W) / 2),
      worldY: Math.floor((height - BASE_H) / 2),
      safe,
      cssPerUnit: unit / dpr,
      portrait: cssH > cssW,
    };
  }

  private apply(): void {
    const next = this.measure();
    const prev = this.layout;
    this.layout = next;
    if (!this.game) return;
    const scale = this.game.scale;
    const dpr = next.deviceW / Math.max(1, this.host.clientWidth);
    if (scale.width !== next.deviceW || scale.height !== next.deviceH || prev.unit !== next.unit) {
      scale.zoom = 1 / dpr;
      scale.resize(next.deviceW, next.deviceH);
      const canvas = this.game.canvas;
      canvas.style.width = `${this.host.clientWidth}px`;
      canvas.style.height = `${this.host.clientHeight}px`;
      scale.updateBounds();
    }
    this.game.events.emit(LAYOUT_EVENT, next);
  }
}
