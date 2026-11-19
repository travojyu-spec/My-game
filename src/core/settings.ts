// Настройки игрока. Чтение и запись вынесены в отдельные функции со стабильным
// форматом, чтобы при упаковке в приложение (Capacitor) заменить хранилище
// в одном месте. Так же стоит оформлять будущие сохранения прогресса.

const KEY = 'pnp-battle/settings';

export interface Settings {
  version: 1;
  sound: boolean;
  /** Скорость анимаций боя: 1 или 2. */
  speed?: number;
}

const DEFAULTS: Settings = { version: 1, sound: true, speed: 1 };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const data = JSON.parse(raw) as Partial<Settings>;
    if (data.version !== 1) return { ...DEFAULTS };
    return { ...DEFAULTS, ...data, version: 1 };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Хранилище может быть недоступно (приватный режим) — игра продолжает работать.
  }
}
