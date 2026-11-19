// Типы боевой логики. Модуль не зависит от Phaser, чтобы правила можно было
// тестировать отдельно и позже сохранять состояние боя в стабильном формате.

export type Side = 'hero' | 'enemy';
export type DamageType = 'physical' | 'fire';
export type IconKey = 'sword' | 'shield' | 'fire' | 'potion' | 'bow';

/** Кого можно выбрать целью. */
export type TargetRule =
  | 'enemy' // живой противник
  | 'ally' // живой союзник, включая себя
  | 'ally-other' // живой союзник, кроме себя
  | 'ally-wounded'; // раненый живой союзник, включая себя

export type Effect =
  | { kind: 'damage'; power: number; type: DamageType }
  | { kind: 'heal'; power: number }
  | { kind: 'guard' };

export interface AbilityDef {
  id: string;
  /** Полное название для описания. */
  name: string;
  /** Короткая подпись на кнопке. */
  label: string;
  icon: IconKey;
  cost: number;
  target: TargetRule;
  effect: Effect;
  /** Описание для игрока. */
  text: string;
  /** Как выглядит действие: ближний бой, снаряд, заклинание. */
  fx: 'melee' | 'arrow' | 'pebble' | 'fireball' | 'heal' | 'guard' | 'spores' | 'slam';
}

export type EnemyBrain = 'goblin' | 'brute' | 'sprout';

export interface UnitDef {
  id: string;
  name: string;
  /** Имя в винительном падеже: «бьёт Мага». */
  nameAcc: string;
  side: Side;
  maxHp: number;
  maxMp: number;
  /** Чем больше, тем раньше ход в раунде. */
  speed: number;
  abilities: string[];
  /** Множители входящего урона по типам. */
  resist?: Partial<Record<DamageType, number>>;
  brain?: EnemyBrain;
  /** Короткое описание особенностей для экрана информации. */
  traits: string;
}

export interface UnitState {
  id: string;
  hp: number;
  mp: number;
  alive: boolean;
  /** id воина, который защищает этого бойца. */
  guardedBy: string | null;
  /** id бойца, которого защищает этот воин. */
  guarding: string | null;
  /** Для громилы: цель замаха, удар придёт в его следующий ход. */
  windupTarget: string | null;
}

export type BattleResult = 'ongoing' | 'victory' | 'defeat';

export interface BattleState {
  /** Версия формата, если позже появятся сохранения. */
  version: 1;
  round: number;
  /** Порядок ходов на раунд (id бойцов). */
  order: string[];
  /** Индекс текущего бойца в order. */
  turnIndex: number;
  units: Record<string, UnitState>;
  result: BattleResult;
  /** Состояние генератора случайных чисел, чтобы бой можно было восстановить. */
  rngSeed: number;
}

export interface Action {
  actor: string;
  ability: string;
  target: string;
}

/** События для анимации. Логика возвращает их, сцена проигрывает по порядку. */
export type BattleEvent =
  | { type: 'turnStart'; unit: string; round: number; mpGain: number }
  | { type: 'guardEnd'; guard: string; ward: string }
  | { type: 'use'; actor: string; ability: string; target: string }
  | {
      type: 'damage';
      source: string;
      target: string;
      /** Если удар принял защитник, тут исходная цель. */
      redirectedFrom: string | null;
      amount: number;
      damageType: DamageType;
      mod: 'weak' | 'resist' | null;
    }
  | { type: 'heal'; source: string; target: string; amount: number }
  | { type: 'guard'; guard: string; ward: string }
  | { type: 'windup'; actor: string; target: string }
  | { type: 'death'; unit: string }
  | { type: 'end'; result: Exclude<BattleResult, 'ongoing'> };

export interface Unavailable {
  ok: false;
  reason: string;
}
export interface Available {
  ok: true;
  targets: string[];
}
export type AbilityCheck = Available | Unavailable;
