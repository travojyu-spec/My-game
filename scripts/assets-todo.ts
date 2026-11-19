// Список картинок, которых ещё нет в public/assets (их рисует ChatGPT).
// Запуск: npm run assets  → обновляет ASSETS_TODO.md
import { readFileSync, writeFileSync } from 'node:fs';
import { Engine, ITEM_ABILITIES, type Unit } from '../src/battle/core';
import { ENEMY_LIST } from '../src/data/enemies';
import { HEROES } from '../src/data/kit';
import '../src/data/heroesA';
import '../src/data/heroesB';
import { REGIONS } from '../src/data/regions';

const manifest = JSON.parse(readFileSync('public/assets/manifest.json', 'utf8')) as { images: { key: string }[] };
const have = new Set(manifest.images.map((i) => i.key));
const SIZE: Record<string, string> = { s: '22×22', m: '28×32', l: '38×40', xl: '48×54' };

const rows: string[] = [];
const missing = (k: string) => !have.has(k);
let total = 0;
function section(title: string, note: string, items: [string, string][]): void {
  const l = items.filter(([k]) => missing(k));
  if (!l.length) return;
  total += l.length;
  rows.push(`\n## ${title} (${l.length})\n\n${note}\n\n| Ключ (имя файла без .png) | Что нарисовать |\n|---|---|`);
  for (const [k, d] of l) rows.push(`| \`${k}\` | ${d} |`);
}

section('Герои — спрайты в бою', 'Как `heroes/warrior.png`: холст 52×54, фигура ~30 px, вид в 3/4 со спины — герои стоят внизу и смотрят вверх на врагов. Узнаваемый облик по оригиналу.',
  HEROES.map((h) => [`heroes/${h.key}`, `${h.name} («${h.work}»)`]));
section('Герои — портреты', 'Квадрат 32×32: лицо и плечи анфас. Используются в меню, таверне, карточке героя.',
  HEROES.map((h) => [`portraits/${h.key}`, `${h.name} («${h.work}»)`]));
section('Враги и боссы', 'Вид спереди (враги стоят вверху и смотрят на отряд), как `enemies/goblin.png`. Размер — примерный ориентир, подойдёт и крупнее.',
  ENEMY_LIST.filter((e) => !e.sprite).map((e) => [`enemies/${e.key}`, `${e.name}${e.boss ? ' — БОСС' : ''} («${REGIONS[e.region - 1].work}»), около ${SIZE[e.size]}. ${e.desc}`]));
section('Фоны регионов', 'Как `world/forest_path.png`: 480×270, нижняя половина — ровная земля, где стоят бойцы.',
  REGIONS.map((r) => [r.bg ?? '', `${r.name} («${r.work}»)`]));

// Иконки умений: собираем со всех героев со всеми узлами дерева.
const icons = new Map<string, string>();
for (const h of HEROES) {
  const nodes = ['A', 'B', 'C'].flatMap((b) => [1, 2, 3, 4, 5].map((i) => b + i));
  for (const ns of [[], nodes]) {
    const u = { uid: 'h0', key: h.key, side: 'hero', name: h.name, nameAcc: h.nameAcc, pos: 0, level: 1, maxHp: 100, hp: 100, atk: 10, def: 0, spd: 5, maxMp: 10, mp: 10, mpRegen: 0, mpName: '', dodge: 0, crit: 0, limit: 0, alive: true, statuses: [], res: { sun: 2, noon: 1, exploded: 1, seal: 1 }, cd: {}, uses: {}, nodes: ns, tags: [], resist: {}, boss: false, xp: 0, gold: 0 } as Unit;
    const e = new Engine({ v: 1, round: 1, order: [], turn: 0, extra: [], cur: 'h0', units: [u], seed: 1, result: 'ongoing', field: [], team: [], items: {}, region: 1 });
    for (const a of e.abilities(u)) if (!icons.has(a.icon)) icons.set(a.icon, `${h.name}: «${a.name}»`);
  }
}
for (const a of ITEM_ABILITIES) icons.set(a.icon, `Предмет: ${a.name}`);
section('Иконки умений и предметов', 'Как `ui/icons/sword.png`: около 16×17, та же палитра и обводка.', [...icons]);
section('Значки карты', 'Кружки этапов на карте региона, около 24×24.', [
  ['ui/map/town', 'Город'], ['ui/map/battle', 'Бой'], ['ui/map/elite', 'Сильные враги'], ['ui/map/event', 'Событие'], ['ui/map/camp', 'Привал'], ['ui/map/boss', 'Босс'],
]);

const head = `# Визуал для ChatGPT

Всё, что ниже, игра сейчас рисует заглушками (цветные квадраты с инициалами).
Готовые PNG кладутся в \`public/assets/<ключ>.png\` и добавляются в \`public/assets/manifest.json\`
(массив \`images\`: \`key\`, \`url\`, \`width\`, \`height\`). Код подхватит их сам — менять ничего не нужно.

Стиль: пиксель-арт как у текущих ассетов (лес, гоблин, воин), без сглаживания, прозрачный фон.
Персонажи и монстры — по оригиналам произведений.

Всего не хватает: ${total}.`;
writeFileSync('ASSETS_TODO.md', head + '\n' + rows.join('\n') + '\n');
console.log('ASSETS_TODO.md: не хватает', total);
