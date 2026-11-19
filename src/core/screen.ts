// Полноэкранный режим и ориентация. Браузер разрешает их только из обработчика касания.

export function canFullscreen(): boolean {
  return !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false;
}

export function isFullscreen(): boolean {
  return !!document.fullscreenElement;
}

export async function enterFullscreen(): Promise<void> {
  if (!canFullscreen() || isFullscreen()) return;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    // Фиксация горизонтали работает только в полноэкранном режиме и не везде.
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.('landscape').catch(() => undefined);
  } catch {
    // Отказ браузера не мешает игре.
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!isFullscreen()) return;
  try {
    await document.exitFullscreen();
  } catch {
    /* ignore */
  }
}

export function toggleFullscreen(): void {
  if (isFullscreen()) void exitFullscreen();
  else void enterFullscreen();
}
