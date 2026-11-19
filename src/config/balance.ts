import type { AbilityDef, UnitDef } from '../battle/types';

// Временные значения для прототипа. Всё, что влияет на баланс, собрано здесь,
// чтобы числа можно было менять после теста, не трогая код боя.

export const RULES = {
  /** Сколько маны герой восстанавливает в начале своего хода. */
  manaRegenPerTurn: 1,
  /** Доля урона, которую получает воин, принимая удар за союзника. */
  guardDamageShare: 0.5,
  /** Гриб-лекарь лечит союзника, если тому не хватает хотя бы столько здоровья. */
  sproutHealThreshold: 5,
};

export const ABILITIES: Record<string, AbilityDef> = {
  // Воин
  strike: {
    id: 'strike', name: 'Удар мечом', label: 'Удар', icon: 'sword', cost: 0, target: 'enemy',
    effect: { kind: 'damage', power: 6, type: 'physical' }, fx: 'melee',
    text: 'Бьёт врага мечом.',
  },
  guard: {
    id: 'guard', name: 'Защита', label: 'Защита', icon: 'shield', cost: 2, target: 'ally-other',
    effect: { kind: 'guard' }, fx: 'guard',
    text: 'До следующего хода воин принимает удары за союзника и получает половину урона.',
  },
  // Маг
  staffMage: {
    id: 'staffMage', name: 'Удар посохом', label: 'Посох', icon: 'sword', cost: 0, target: 'enemy',
    effect: { kind: 'damage', power: 3, type: 'physical' }, fx: 'melee',
    text: 'Слабый удар посохом.',
  },
  fireball: {
    id: 'fireball', name: 'Огненный шар', label: 'Огонь', icon: 'fire', cost: 4, target: 'enemy',
    effect: { kind: 'damage', power: 8, type: 'fire' }, fx: 'fireball',
    text: 'Огненный урон. Прожигает броню гриба-броневика.',
  },
  // Лучник
  shot: {
    id: 'shot', name: 'Выстрел', label: 'Выстрел', icon: 'bow', cost: 0, target: 'enemy',
    effect: { kind: 'damage', power: 5, type: 'physical' }, fx: 'arrow',
    text: 'Стреляет в выбранного врага.',
  },
  aimed: {
    id: 'aimed', name: 'Меткий выстрел', label: 'Меткий', icon: 'bow', cost: 3, target: 'enemy',
    effect: { kind: 'damage', power: 9, type: 'physical' }, fx: 'arrow',
    text: 'Сильный выстрел. Броню пробивает плохо.',
  },
  // Лекарь
  staffHealer: {
    id: 'staffHealer', name: 'Удар посохом', label: 'Посох', icon: 'sword', cost: 0, target: 'enemy',
    effect: { kind: 'damage', power: 3, type: 'physical' }, fx: 'melee',
    text: 'Слабый удар посохом.',
  },
  heal: {
    id: 'heal', name: 'Лечение', label: 'Лечение', icon: 'potion', cost: 3, target: 'ally-wounded',
    effect: { kind: 'heal', power: 10 }, fx: 'heal',
    text: 'Восстанавливает здоровье раненому союзнику или себе.',
  },
  // Враги
  slingshot: {
    id: 'slingshot', name: 'Рогатка', label: 'Рогатка', icon: 'sword', cost: 0, target: 'enemy',
    effect: { kind: 'damage', power: 5, type: 'physical' }, fx: 'pebble',
    text: 'Стреляет в самого раненого героя.',
  },
  windup: {
    id: 'windup', name: 'Замах', label: 'Замах', icon: 'sword', cost: 0, target: 'enemy',
    effect: { kind: 'guard' }, fx: 'slam',
    text: 'Выбирает героя и замахивается. В следующий ход ударит его.',
  },
  slam: {
    id: 'slam', name: 'Сокрушение', label: 'Удар', icon: 'sword', cost: 0, target: 'enemy',
    effect: { kind: 'damage', power: 16, type: 'physical' }, fx: 'slam',
    text: 'Тяжёлый удар по цели замаха.',
  },
  mend: {
    id: 'mend', name: 'Грибной отвар', label: 'Лечение', icon: 'potion', cost: 0, target: 'ally-wounded',
    effect: { kind: 'heal', power: 9 }, fx: 'heal',
    text: 'Лечит самого раненого гриба или гоблина.',
  },
  spores: {
    id: 'spores', name: 'Споры', label: 'Споры', icon: 'sword', cost: 0, target: 'enemy',
    effect: { kind: 'damage', power: 4, type: 'physical' }, fx: 'spores',
    text: 'Если лечить некого, пускает споры в случайного героя.',
  },
};

export const UNITS: UnitDef[] = [
  {
    id: 'warrior', name: 'Воин', nameAcc: 'Воина', side: 'hero', maxHp: 38, maxMp: 4, speed: 6,
    abilities: ['strike', 'guard'],
    traits: 'Защитник отряда. Может принимать удары за союзника.',
  },
  {
    id: 'mage', name: 'Маг', nameAcc: 'Мага', side: 'hero', maxHp: 22, maxMp: 10, speed: 5,
    abilities: ['staffMage', 'fireball'],
    traits: 'Мало здоровья. Огонь — лучший ответ на броню.',
  },
  {
    id: 'archer', name: 'Лучник', nameAcc: 'Лучника', side: 'hero', maxHp: 26, maxMp: 6, speed: 8,
    abilities: ['shot', 'aimed'],
    traits: 'Ходит первым. Хорош против слабо защищённых врагов.',
  },
  {
    id: 'healer', name: 'Лекарь', nameAcc: 'Лекаря', side: 'hero', maxHp: 26, maxMp: 9, speed: 3,
    abilities: ['staffHealer', 'heal'],
    traits: 'Лечит отряд. Следите за его маной.',
  },
  {
    id: 'goblin', name: 'Гоблин', nameAcc: 'Гоблина', side: 'enemy', maxHp: 18, maxMp: 0, speed: 7,
    abilities: ['slingshot'], brain: 'goblin',
    traits: 'Стреляет из рогатки в самого раненого героя.',
  },
  {
    id: 'brute', name: 'Гриб-броневик', nameAcc: 'Гриба-броневика', side: 'enemy', maxHp: 46, maxMp: 0, speed: 2,
    abilities: ['windup', 'slam'], brain: 'brute',
    resist: { physical: 0.5, fire: 1.5 },
    traits: 'Броня: обычный урон ×½, огонь ×1,5. Замахивается, а следующим ходом бьёт.',
  },
  {
    id: 'sprout', name: 'Гриб-лекарь', nameAcc: 'Гриба-лекаря', side: 'enemy', maxHp: 22, maxMp: 0, speed: 4,
    abilities: ['mend', 'spores'], brain: 'sprout',
    traits: 'Лечит раненых союзников. Лучше убрать его первым.',
  },
];

export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
