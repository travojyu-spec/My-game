// Маги и поддержка.
import type { AbilityDef, Engine, Unit } from '../battle/core';
import { I, MAGES, N, avgHp, cookMult, hero, isMonster, mostWounded, node } from './kit';

type AL = AbilityDef[];

// ===================== Мэгумин =====================
function explosion(e: Engine, u: Unit, extraExhaust = 0): void {
  const conc = (u.res.conc ?? 0) / 100;
  const p = 5.0 * (1 + conc) * (N(u, 'A1') ? 1.2 : 1) * (N(u, 'A5') ? 2 : 1);
  e.say('ВЗРЫВ!');
  for (const x of e.enemies()) {
    e.hit(u, x, p, { type: 'fire', magic: true, ignoreResist: true, pierce: N(u, 'A2') ? 0.25 : 0, tag: 'explosion', sure: true, single: false, execute: N(u, 'A5') ? 0.2 : 0 });
  }
  u.res.conc = 0;
  u.res.exploded = 1;
  let ex = (N(u, 'B3') ? 1 : N(u, 'B1') ? 2 : 3) + extraExhaust;
  if (e.team('konosuba3')) ex = Math.max(1, ex - 1);
  e.add(u, 'exhausted', ex, 1);
  if (e.team('konosuba2')) { const d = e.byKey('darkness'); if (d) e.add(d, 'taunt', ex, 1); }
  if (N(u, 'B4')) u.limit = Math.min(100, u.limit + 50);
}
hero({
  key: 'megumin', name: 'Мэгумин', nameAcc: 'Мэгумин', role: 'mage', work: 'Коносуба', color: '#c0303a',
  hp: 60, atk: 12, def: 0, spd: 4, mp: 0, mpRegen: 0, mpName: 'Мана', tags: ['female'],
  passive: 'Только Взрыв: игнорирует сопротивления. После Взрыва 3 хода без сил. Шкала Предела копится от Концентрации.',
  tree: {
    A: ['Мощь взрыва', [node('Сильнее', '+20% к Взрыву'), node('Сквозь броню', 'Взрыв пробивает 25% брони'), node('Глубокая концентрация', 'Концентрация до +150%'), node('Метка ×2', 'Метка удваивает урон Взрыва'), node('Совершенный взрыв', '+100% и добивает врагов ниже 20%')]],
    B: ['Выносливость', [node('Отруб 2', 'Без сил 2 хода'), node('Без беззащитности', 'Без сил не получает лишний урон'), node('Отруб 1', 'Без сил 1 ход'), node('Вдохновение', 'После Взрыва +50 к шкале Предела'), node('Ещё один!', 'Два Взрыва за бой')]],
    C: ['Алый демон', [node('Пример', 'Концентрация даёт отряду +5% урона на 2 хода'), node('Две метки', 'Метка ставится ещё на случайного врага'), node('Плащ', 'Концентрация даёт ей щит'), node('Трепет', 'Пока она копит, враги боятся (−10% урона)'), node('Предвестие', 'После 3 Концентраций все враги оглушены страхом на ход')]],
  },
  abilities: (e, u) => {
    const exhausted = e.has(u, 'exhausted');
    const awake = () => (exhausted ? 'Мэгумин без сил — доступна только ульта.' : null);
    return [
      {
        id: 'mg_conc', name: 'Концентрация', label: 'Копить', icon: 'icons/conc', kind: 'basic', target: 'self', fx: 'buff', check: awake,
        desc: `+25% к следующему Взрыву (сейчас +${u.res.conc ?? 0}%).`,
        run: (e2, u2) => {
          e2.res(u2, 'conc', 25, N(u2, 'A3') ? 150 : 100);
          u2.limit = Math.min(100, u2.limit + 20);
          if (N(u2, 'C1')) for (const x of e2.alliesOf(u2)) e2.add(x, 'atkUp', 2, 5);
          if (N(u2, 'C3')) e2.add(u2, 'shield', 99, Math.round(u2.maxHp * 0.15));
          if (N(u2, 'C4')) for (const x of e2.enemies()) e2.add(x, 'fear', 1, 10);
          u2.res.concN = (u2.res.concN ?? 0) + 1;
          if (N(u2, 'C5') && u2.res.concN >= 3 && !u2.res.c5) { u2.res.c5 = 1; for (const x of e2.enemies()) e2.add(x, 'stun', 1, 1); e2.say('Враги дрожат от страха!'); }
        },
      },
      { id: 'mg_boom', name: 'ВЗРЫВ!', label: 'ВЗРЫВ', icon: I.fire, kind: 'skill', target: 'allEnemies', perBattle: N(u, 'B5') ? 2 : 1, magic: true, fx: 'aoe', check: awake,
        desc: 'Огромный урон по всем врагам. Потом Мэгумин без сил.', run: (e2, u2) => explosion(e2, u2) },
      { id: 'mg_mark', name: 'Метка Алого демона', label: 'Метка', icon: 'icons/mark', kind: 'skill', target: 'enemyAny', cd: 2, fx: 'magic', check: awake,
        desc: 'Взрыв по отмеченному врагу ×1,5.',
        run: (e2, u2, t) => {
          const v = N(u2, 'A4') ? 2 : 1.5;
          e2.add(t!, 'mark', 3, v);
          if (N(u2, 'C2')) { const o = e2.enemies().find((x) => x !== t && !e2.has(x, 'mark')); if (o) e2.add(o, 'mark', 3, v); }
        } },
      { id: 'mg_ult', name: 'Второй взрыв', label: 'Взрыв 2', icon: 'icons/boom2', kind: 'ult', target: 'allEnemies', magic: true, fx: 'aoe',
        desc: 'Взрыв сверх лимита — даже из отруба. Отруб +2 хода.',
        check: (_e2, u2) => (u2.res.exploded ? null : 'Сначала нужен первый Взрыв.'),
        run: (e2, u2) => { e2.del(u2, 'exhausted'); explosion(e2, u2, 2); } },
    ];
  },
  hooks: {
    canActWhileSkipped: (e, u) => e.has(u, 'exhausted') && u.limit >= 100 && !!u.res.exploded,
  },
});

// ===================== Ферн =====================
function fernBolt(e: Engine, u: Unit, t: Unit, p: number, single = true): void {
  let k = 1;
  const key = 'seen' + t.uid;
  if (!u.res[key]) { u.res[key] = 1; k *= 1.5; }
  if (N(u, 'C3') && t.tags.includes('mage')) k *= 1.3;
  const deb = t.statuses.some((s) => ['burn', 'bleed', 'poison', 'stun', 'slow', 'fear', 'atkDown', 'vuln', 'wet', 'mark', 'mud'].includes(s.id));
  e.hit(u, t, p * k, {
    magic: true, single, crit: N(u, 'C1') && deb ? 0.25 : 0, ignoreShield: N(u, 'C2') || N(u, 'C5'),
    pierce: N(u, 'C5') ? 1 : 0, ignoreResist: N(u, 'C5'), execute: N(u, 'C4') ? 0.15 : 0,
  });
}
hero({
  key: 'fern', name: 'Ферн', nameAcc: 'Ферн', role: 'mage', work: 'Фрирен', color: '#8a5fb5',
  hp: 80, atk: 12, def: 0.05, spd: 9, mp: 40, mpRegen: 6, mpName: 'Мана', tags: ['female'], threat: 0.3,
  passive: 'Сокрытие маны: враги редко выбирают её целью; первый удар по каждому врагу +50%. Не поддаётся подчинению.',
  mods: { A1: { spd: 2 } },
  tree: {
    A: ['Скорость', [node('Быстрее', '+2 скорости'), node('Первая', 'В первом раунде всегда ходит первой'), node('Залп ×9', '«Залп» — 9 снарядов'), node('Двойной Зольтраак', 'В чётных раундах Зольтраак бьёт дважды'), node('Опережение', 'Доп. ход в начале каждого третьего раунда')]],
    B: ['Защитная магия', [node('Крепкий щит', 'Щит +30%'), node('Щит отряду', 'Щит на весь отряд'), node('Отражение', 'Щит возвращает 30% поглощённого'), node('Сам восстанавливается', 'В начале хода щит самому раненому'), node('Барьер', 'Раз за бой, когда отряд ниже 40%, все получают блок удара')]],
    C: ['Точность', [node('По слабым', '+25% крита по ослабленным'), node('Сквозь щиты', 'Снаряды игнорируют щиты'), node('Против магов', '+30% по магам'), node('Добивание', 'Добивает врагов ниже 15% здоровья'), node('Убийственная магия', 'Зольтраак игнорирует защиту и сопротивления')]],
  },
  abilities: (_e, u) => [
    { id: 'f_zolt', name: 'Зольтраак', label: 'Зольтраак', icon: 'icons/zoltraak', kind: 'basic', target: 'enemy', magic: true, fx: 'magic', desc: 'Быстрый магический снаряд.',
      run: (e2, u2, t) => { fernBolt(e2, u2, t!, 1.1); if (N(u2, 'A4') && e2.s.round % 2 === 0) { const x = t!.alive ? t! : e2.randFoes(u2, 1)[0]; if (x) fernBolt(e2, u2, x, 1.1); } } },
    { id: 'f_volley', name: 'Залп', label: 'Залп', icon: 'icons/volley', kind: 'skill', target: 'allEnemies', cost: 8, magic: true, fx: 'magic', desc: '6 снарядов по случайным врагам.',
      run: (e2, u2) => { for (const x of e2.randFoes(u2, N(u2, 'A3') ? 9 : 6)) fernBolt(e2, u2, x, 0.4, false); } },
    { id: 'f_shield', name: 'Защитная магия', label: 'Щит', icon: I.shield, kind: 'skill', target: N(u, 'B2') ? 'allAllies' : 'ally', cost: 6, magic: true, fx: 'buff',
      desc: 'Щит, поглощающий урон.',
      run: (e2, u2, t) => {
        for (const x of N(u2, 'B2') ? e2.alliesOf(u2) : [t!]) {
          const k = (N(u2, 'B1') ? 1.3 : 1) * (e2.team('frieren2') && x.key === 'stark' ? 1.5 : 1);
          e2.add(x, 'shield', 99, Math.round(u2.atk * 2.5 * k), N(u2, 'B3') ? { reflect: 0.3 } : undefined);
        }
      } },
    { id: 'f_ult', name: 'Бесконечный залп', label: 'Шквал', icon: 'icons/barrage', kind: 'ult', target: 'allEnemies', magic: true, fx: 'magic', desc: '15 снарядов, пробивают щиты.',
      run: (e2, u2) => { for (const x of e2.randFoes(u2, 15)) e2.hit(u2, x, 0.5, { magic: true, ignoreShield: true, single: false }); } },
  ] satisfies AL as AL,
  hooks: {
    turnStart: (e, u) => {
      if (N(u, 'B4')) { const w = mostWounded(e, u); if (w && !e.has(w, 'shield')) e.add(w, 'shield', 99, Math.round(u.atk * 0.6)); }
      if (N(u, 'A5') && e.s.round % 3 === 0 && u.res.a5 !== e.s.round) { u.res.a5 = e.s.round; e.extraTurn(u); }
    },
    onPartyDamaged: (e, u) => {
      if (N(u, 'B5') && !u.res.b5 && avgHp(e, u) < 0.4) { u.res.b5 = 1; for (const x of e.alliesOf(u)) e.add(x, 'block', 99, 1); e.say('Барьер Ферн!'); }
    },
  },
});

// ===================== Эдвард =====================
hero({
  key: 'edward', name: 'Эдвард Элрик', nameAcc: 'Эдварда', role: 'mage', work: 'Стальной алхимик', color: '#c8302c',
  hp: 100, atk: 12, def: 0.15, spd: 6, mp: 30, mpRegen: 5, mpName: 'Мана',
  passive: 'Равноценный обмен: не хватает маны — платит здоровьем ×2. Первое умение в бою бесплатно (хлопок ладонями).',
  tree: {
    A: ['Земля', [node('Острые копья', 'Копья +25%'), node('Стена', 'Новое умение: щит всему отряду'), node('Крепкая хватка', 'Копья оглушают на 2 хода'), node('Лес копий', 'Копья бьют всех врагов'), node('Крепость', 'Стена ещё и блокирует первый удар')]],
    B: ['Огонь', [node('Жар', 'Горение сильнее'), node('Шире', 'Взрыв по соседям сильнее'), node('Сквозь щиты', 'Взрыв снимает щиты'), node('Экономно', 'Взрыв дешевле на треть'), node('Цепная реакция', 'Горящие враги взрываются при смерти')]],
    C: ['Лёд и молния', [node('Ледяные шипы', 'Новое умение: лёд с замедлением'), node('Разряд', 'Новое умение: молния по 3 целям'), node('Заморозка', 'Лёд замораживает с шансом 25%'), node('Длинная цепь', 'Разряд бьёт 5 целей'), node('Буря', 'Разряд бьёт всех, замороженных ×2')]],
  },
  abilities: (_e, u) => {
    const l: AL = [
      { id: 'ed_blade', name: 'Клинок автоброни', label: 'Клинок', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee', desc: 'Удар клинком из руки.',
        run: (e, u2, t) => { e.hit(u2, t!, 1.1); } },
      { id: 'ed_spears', name: 'Каменные копья', label: 'Копья', icon: 'icons/spears', kind: 'skill', target: N(u, 'A4') ? 'allEnemies' : 'enemy', cost: 8, magic: true, fx: 'magic',
        desc: 'Копья из земли: урон и оглушение.',
        run: (e, u2, t) => {
          const k = N(u2, 'A1') ? 1.25 : 1;
          for (const x of N(u2, 'A4') ? e.enemies() : [t!]) {
            const n = e.hit(u2, x, (N(u2, 'A4') ? 0.9 : 1.6) * k, { type: 'earth', magic: true, single: x === t });
            if (n > 0 && x.alive && (x === t || !N(u2, 'A4'))) e.add(x, 'stun', N(u2, 'A3') ? 2 : 1, 1);
            if (n > 0 && x.alive && N(u2, 'A4') && x === e.enemies()[0]) e.add(x, 'stun', 1, 1);
          }
        } },
      { id: 'ed_blast', name: 'Взрывная трансмутация', label: 'Взрыв', icon: I.fire, kind: 'skill', target: 'enemy', cost: N(u, 'B4') ? 7 : 10, magic: true, fx: 'magic',
        desc: 'Огонь по цели и соседям, горение.',
        run: (e, u2, t) => {
          if (N(u2, 'B3')) e.del(t!, 'shield');
          const n = e.hit(u2, t!, 1.3, { type: 'fire', magic: true });
          if (n > 0 && t!.alive) e.add(t!, 'burn', 3, Math.round(u2.atk * (N(u2, 'B1') ? 0.45 : 0.3)));
          for (const x of e.adj(t!)) e.hit(u2, x, N(u2, 'B2') ? 1.0 : 0.65, { type: 'fire', magic: true, single: false });
        } },
    ];
    if (N(u, 'A2')) l.push({ id: 'ed_wall', name: 'Стена', label: 'Стена', icon: I.shield, kind: 'skill', target: 'allAllies', cost: 10, magic: true, fx: 'buff',
      desc: 'Каменная стена: щит всему отряду.',
      run: (e, u2) => { for (const x of e.alliesOf(u2)) { e.add(x, 'shield', 99, u2.atk * 2); if (N(u2, 'A5')) e.add(x, 'block', 99, 1); } } });
    if (N(u, 'C1')) l.push({ id: 'ed_ice', name: 'Ледяные шипы', label: 'Лёд', icon: 'icons/ice', kind: 'skill', target: 'enemy', cost: 8, magic: true, fx: 'magic',
      desc: 'Лёд с замедлением.',
      run: (e, u2, t) => {
        const n = e.hit(u2, t!, 1.4, { type: 'ice', magic: true });
        if (n > 0 && t!.alive) { e.add(t!, 'slow', 2, 30); if (N(u2, 'C3') && e.rnd() < 0.25) e.add(t!, 'freeze', 1, 1); }
      } });
    if (N(u, 'C2')) l.push({ id: 'ed_bolt', name: 'Разряд', label: 'Разряд', icon: 'icons/bolt', kind: 'skill', target: 'allEnemies', cost: 10, magic: true, fx: 'magic',
      desc: 'Молния по нескольким врагам.',
      run: (e, u2) => {
        const l2 = N(u2, 'C5') ? e.enemies() : e.enemies().slice(0, N(u2, 'C4') ? 5 : 3);
        for (const x of l2) e.hit(u2, x, (N(u2, 'C5') && e.has(x, 'freeze') ? 2 : 1), { type: 'lightning', magic: true, single: false });
      } });
    l.push({ id: 'ed_ult', name: 'Трансмутация поля', label: 'Поле', icon: 'icons/field', kind: 'ult', target: 'allEnemies', magic: true, fx: 'aoe',
      desc: 'Всё поле боя поднимается против врагов: урон и оглушение.',
      run: (e, u2) => { for (const x of e.enemies()) { const n = e.hit(u2, x, 2.5, { type: 'earth', magic: true, single: false, sure: true }); if (n > 0 && x.alive && !x.boss) e.add(x, 'stun', 1, 1); } } });
    return l;
  },
  hooks: {
    onAnyDeath: (e, u, v) => {
      if (N(u, 'B5') && v.side !== u.side && v.res.burnMark) for (const x of e.enemies()) e.hit(u, x, 1, { type: 'fire', sure: true, single: false });
    },
    onDealt: (e, _u, t) => { if (e.has(t, 'burn')) t.res.burnMark = 1; },
  },
});

// ===================== Алукард =====================
function casull(e: Engine, u: Unit, t: Unit): void {
  u.res.casull = (u.res.casull ?? 0) + 1;
  const released = 3 - (u.res.seal ?? 3);
  let ls = 0.2 + 0.1 * released + (N(u, 'B1') ? 0.1 : 0);
  if (N(u, 'B4') && u.res.casull % 3 === 0) ls = 1;
  const n = e.hit(u, t, 1.2 * (N(u, 'A1') ? 1.2 : 1), { pierce: N(u, 'A4') ? 0.5 : 0 });
  if (n > 0) e.heal(u, n * ls, true, N(u, 'B3') ? 1 : 0);
}
hero({
  key: 'alucard', name: 'Алукард', nameAcc: 'Алукарда', role: 'mage', work: 'Хеллсинг', color: '#9b111e',
  hp: 125, atk: 13, def: 0.1, spd: 6, mp: 6, mpRegen: 2, mpName: 'Энергия', tags: ['undead', 'vampire'], resist: { holy: 2 },
  passive: 'Бессмертный: +5% здоровья в начале хода; святой урон по нему ×2. Печать: 3 → 2 → 1, каждая ступень +25% урона и +10% вампиризма.',
  mods: { A3: { crit: 0.2 } },
  tree: {
    A: ['Стрелок', [node('Касулл+', '«Касулл» +20%'), node('Без перезарядки', '«Шакал» без перезарядки'), node('Меткость', '+20% крита'), node('Бронебой', 'Оба пистолета пробивают 50% брони'), node('Две пушки', '«Касулл» стреляет ещё по одной цели')]],
    B: ['Вампир', [node('Жажда', 'Вампиризм +10%'), node('Регенерация', 'Восстанавливает 8% в ход'), node('Кровавый щит', 'Лишнее лечение становится щитом'), node('Кровь', 'Каждый третий «Касулл» — вампиризм 100%'), node('Не умирает', 'Раз за бой встаёт с 50%')]],
    C: ['Печать', [node('Без цены', 'Снятие печати не стоит здоровья'), node('Сильнее', 'Каждая ступень +35%'), node('Баскервиль', 'На печати 1 пёс 3 хода кусает врагов'), node('Долгая армия', 'Армия душ 4 хода'), node('Освобождение', 'Начинает бой с печатью 1')]],
  },
  abilities: (_e, u) => [
    { id: 'al_casull', name: 'Касулл', label: 'Касулл', icon: I.bow, kind: 'basic', target: 'enemy', fx: 'shot', desc: 'Выстрел с вампиризмом.',
      run: (e2, u2, t) => { casull(e2, u2, t!); if (N(u2, 'A5')) { const o = e2.enemies().find((x) => x !== t); if (o) casull(e2, u2, o); } } },
    { id: 'al_jackal', name: 'Шакал', label: 'Шакал', icon: 'icons/jackal', kind: 'skill', target: 'enemy', cost: 3, cd: N(u, 'A2') ? undefined : 2, fx: 'shot',
      desc: 'Тяжёлый выстрел освящёнными пулями: пробивает броню, ×2 по нежити.',
      run: (e2, u2, t) => { const k = t!.tags.includes('undead') || t!.tags.includes('vampire') ? 2 : 1; e2.hit(u2, t!, 2.2 * k, { pierce: 0.5 }); } },
    { id: 'al_seal', name: 'Снятие печати', label: `Печать ${u.res.seal ?? 3}`, icon: 'icons/seal', kind: 'skill', target: 'self', fx: 'buff',
      desc: N(u, 'C1') ? 'Печать на ступень ниже: сильнее и жаднее.' : 'Печать на ступень ниже: сильнее и жаднее. Стоит 10% здоровья.',
      check: (_e2, u2) => ((u2.res.seal ?? 3) <= 1 ? 'Печать уже на уровне 1.' : null),
      run: (e2, u2) => {
        if (!N(u2, 'C1')) u2.hp = Math.max(1, u2.hp - Math.round(u2.maxHp * 0.1));
        u2.res.seal = (u2.res.seal ?? 3) - 1;
        e2.float(u2, `Печать ${u2.res.seal}`, '#ff3b3b');
        if (u2.res.seal === 1 && N(u2, 'C3')) e2.add(u2, 'hound', 3, 1);
      } },
    { id: 'al_ult', name: 'Уровень 0', label: 'Уровень 0', icon: 'icons/souls', kind: 'ult', target: 'allEnemies', fx: 'aoe',
      desc: 'Только на печати 1: армия душ 3 хода бьёт всех врагов, а вампиризм лечит отряд.',
      check: (_e2, u2) => ((u2.res.seal ?? 3) <= 1 ? null : 'Сначала снимите печать до уровня 1.'),
      run: (e2, u2) => { u2.res.seal = 0; e2.add(u2, 'souls', N(u2, 'C4') ? 4 : 3, 1); soulsStrike(e2, u2); } },
  ] satisfies AL as AL,
  hooks: {
    battleStart: (_e, u) => { u.res.seal = N(u, 'C5') ? 1 : 3; u.res.lives = N(u, 'B5') ? 1 : 0; },
    turnStart: (e, u) => {
      e.heal(u, u.maxHp * (N(u, 'B2') ? 0.08 : 0.05), true);
      if (e.has(u, 'hound')) { const t = e.randFoes(u, 1)[0]; if (t) e.hit(u, t, 0.8, { single: false }); }
      if (e.has(u, 'souls')) soulsStrike(e, u);
    },
    dealMult: (e, u, t) => {
      let m = 1 + (3 - (u.res.seal ?? 3)) * (N(u, 'C2') ? 0.35 : 0.25);
      if (e.team('aquaAlucard')) m += 0.15;
      if (e.team('hunters') && (t.tags.includes('demon') || t.tags.includes('undead'))) m += 0.15;
      return m;
    },
    onExpire: (_e, u, st) => { if (st.id === 'souls') u.res.seal = 1; },
    onAnyDeath: (_e, u, v) => { if (v === u && u.res.lives > 0) { u.res.lives = 0; u.statuses.push({ id: 'rising', turns: 99, value: 0.5 }); } },
    resLine: (_e, u) => `Печать: ${u.res.seal ?? 3}`,
  },
});
function soulsStrike(e: Engine, u: Unit): void {
  let total = 0;
  for (const x of e.enemies()) total += e.hit(u, x, 1.0, { type: 'dark', sure: true, single: false });
  const allies = e.alliesOf(u);
  for (const a of allies) e.heal(a, (total * 0.3) / allies.length, true);
}

// ===================== Рудеус =====================
hero({
  key: 'rudeus', name: 'Рудеус', nameAcc: 'Рудеуса', role: 'mage', work: 'Реинкарнация безработного', color: '#5c7d3a',
  hp: 85, atk: 12, def: 0.05, spd: 6, mp: 60, mpRegen: 8, mpName: 'Мана',
  passive: 'Безмолвное колдовство: огромный запас маны, тишина не действует.',
  mods: { A4: { crit: 0.2 } },
  tree: {
    A: ['Камень', [node('Тяжелее', 'Каменная пушка +25%'), node('Вращение', 'Пушка пробивает щиты'), node('Две пушки', 'Пушка бьёт ещё одну цель (50%)'), node('Точность', '+20% крита'), node('На пределе', 'Каждая третья пушка ×3')]],
    B: ['Контроль', [node('Глубже', 'Трясина 3 хода'), node('Вязко', 'В трясине нельзя уклониться'), node('Цепь', '«Электро» перескакивает ещё на 2 цели'), node('Туман', 'Трясина ослепляет врагов'), node('Болото и шторм', '«Электро» оглушает всех в трясине')]],
    C: ['Магическая броня', [node('Дольше', 'Броня 4 хода'), node('Прикрытие', 'Включая броню, даёт щит отряду'), node('Размах', 'Удары брони задевают соседей'), node('Без отката', 'После брони нет усталости'), node('Версия 1', 'Броня сама включается в начале боя на 2 хода')]],
  },
  abilities: (e, u) => {
    const armor = e.has(u, 'magicArmor');
    return [
      armor
        ? { id: 'r_punch', name: 'Удар брони', label: 'Кулак', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee', desc: 'Удар магической бронёй ×2, без учёта защиты.',
          run: (e2: Engine, u2: Unit, t: Unit | null) => { e2.hit(u2, t!, 2, { pierce: 1 }); if (N(u2, 'C3')) for (const x of e2.adj(t!)) e2.hit(u2, x, 1, { single: false }); } }
        : { id: 'r_cannon', name: 'Каменная пушка', label: 'Пушка', icon: 'icons/stone', kind: 'basic', target: 'enemy', magic: true, fx: 'magic', desc: 'Сильный каменный снаряд.',
          run: (e2: Engine, u2: Unit, t: Unit | null) => {
            u2.res.cannon = (u2.res.cannon ?? 0) + 1;
            const k = (N(u2, 'A1') ? 1.25 : 1) * (N(u2, 'A5') && u2.res.cannon % 3 === 0 ? 3 : 1);
            e2.hit(u2, t!, 1.3 * k, { type: 'earth', magic: true, pierce: 0.25, ignoreShield: N(u2, 'A2') });
            if (N(u2, 'A3')) { const o = e2.enemies().find((x) => x !== t); if (o) e2.hit(u2, o, 0.65 * k, { type: 'earth', magic: true, single: false }); }
          } },
      { id: 'r_mud', name: 'Трясина', label: 'Трясина', icon: 'icons/mud', kind: 'skill', target: 'allEnemies', cost: 8, magic: true, fx: 'magic',
        desc: 'Все враги замедлены на 2 хода.',
        run: (e2, u2) => { for (const x of e2.enemies()) { const t = N(u2, 'B1') ? 3 : 2; e2.add(x, 'slow', t, 30); if (N(u2, 'B2')) e2.add(x, 'mud', t, 1); if (N(u2, 'B4')) e2.add(x, 'accDown', t, 30); } } },
      { id: 'r_electric', name: 'Электро', label: 'Электро', icon: 'icons/bolt', kind: 'skill', target: 'enemy', cost: 8, magic: true, fx: 'magic',
        desc: 'Молния с оглушением.',
        run: (e2, u2, t) => {
          const n = e2.hit(u2, t!, 1.4, { type: 'lightning', magic: true });
          if (n > 0 && t!.alive) e2.add(t!, 'stun', 1, 1);
          if (N(u2, 'B3')) for (const x of e2.enemies().filter((y) => y !== t).slice(0, 2)) e2.hit(u2, x, 0.7, { type: 'lightning', magic: true, single: false });
          if (N(u2, 'B5')) for (const x of e2.enemies()) if (e2.has(x, 'mud')) e2.add(x, 'stun', 1, 1);
        } },
      { id: 'r_ult', name: 'Магическая броня', label: 'Броня', icon: 'icons/armor', kind: 'ult', target: 'self', fx: 'buff',
        desc: '3 хода броня поглощает урон, удары кулаком ×2.',
        run: (e2, u2) => armorOn(e2, u2, N(u2, 'C1') ? 4 : 3) },
    ] as AL;
  },
  hooks: {
    battleStart: (e, u) => { if (N(u, 'C5')) armorOn(e, u, 2); },
    dealMult: (e) => (e.byKey('roxy') ? 1.1 : 1),
    onExpire: (e, u, st) => { if (st.id === 'magicArmor' && !N(u, 'C4')) e.add(u, 'exhausted', 1, 1); },
  },
});
function armorOn(e: Engine, u: Unit, turns: number): void {
  e.add(u, 'magicArmor', turns, 1);
  e.add(u, 'shield', 99, Math.round(u.maxHp * 0.3));
  if (N(u, 'C2')) for (const x of e.alliesOf(u)) if (x !== u) e.add(x, 'shield', 99, Math.round(u.atk * 1.5));
}

// ===================== Рокси =====================
hero({
  key: 'roxy', name: 'Рокси', nameAcc: 'Рокси', role: 'mage', work: 'Реинкарнация безработного', color: '#3d6fd1',
  hp: 80, atk: 11, def: 0.05, spd: 6, mp: 50, mpRegen: 6, mpName: 'Мана', tags: ['female'],
  passive: 'Наставница: вода и лёд +20%. Рудеус и Сильфи в отряде +10% урона.',
  tree: {
    A: ['Вода и лёд', [node('Сильнее', 'Водяной шар +25%'), node('Водопад', 'Новое умение: вода по всем'), node('Заморозка', 'Ледяное копьё замораживает мокрых (25%)'), node('Холоднее', 'Лёд по мокрым +20%'), node('Ледяной прорыв', 'Ледяное копьё замораживает всех мокрых')]],
    B: ['Буря', [node('Дольше', 'Гроза 4 раунда'), node('Сильная гроза', 'Молнии грозы ×1,3'), node('Тёплый дождь', 'Дождь лечит отряд на 3% за раунд'), node('Шторм', 'Шкала Предела копится быстрее'), node('Гроза святого уровня', 'Молнии ×2 по мокрым')]],
    C: ['Наставница', [node('Два ученика', '«Урок» ещё и на случайного мага'), node('Подпитка', '«Урок» даёт 3 маны'), node('Опыт', '+15% опыта отряду за бой'), node('Поддержка', '«Урок» снимает тишину и замедление'), node('Школа', 'Маги отряда +20% урона весь бой')]],
  },
  abilities: (_e, u) => {
    const l: AL = [
      { id: 'rx_ball', name: 'Водяной шар', label: 'Вода', icon: 'icons/water', kind: 'basic', target: 'enemy', magic: true, fx: 'magic', desc: 'Вода; цель становится мокрой.',
        run: (e, u2, t) => { const n = e.hit(u2, t!, 1.1 * (N(u2, 'A1') ? 1.25 : 1), { type: 'water', magic: true }); if (n > 0 && t!.alive) e.add(t!, 'wet', 2, 1); } },
      { id: 'rx_ice', name: 'Ледяное копьё', label: 'Лёд', icon: 'icons/ice', kind: 'skill', target: 'enemy', cost: 8, magic: true, fx: 'magic', desc: 'Лёд с замедлением.',
        run: (e, u2, t) => {
          const wet = e.has(t!, 'wet');
          const n = e.hit(u2, t!, 1.5 * (N(u2, 'A4') && wet ? 1.2 : 1), { type: 'ice', magic: true });
          if (n > 0 && t!.alive) { e.add(t!, 'slow', 2, 30); if (N(u2, 'A3') && wet && e.rnd() < 0.25) e.add(t!, 'freeze', 1, 1); }
          if (N(u2, 'A5')) for (const x of e.enemies()) if (e.has(x, 'wet')) e.add(x, 'freeze', 1, 1);
        } },
    ];
    if (N(u, 'A2')) l.push({ id: 'rx_fall', name: 'Водопад', label: 'Водопад', icon: 'icons/waterfall', kind: 'skill', target: 'allEnemies', cost: 12, magic: true, fx: 'aoe',
      desc: 'Вода по всем врагам, все мокрые.', run: (e, u2) => { for (const x of e.enemies()) { e.hit(u2, x, 0.9, { type: 'water', magic: true, single: false }); if (x.alive) e.add(x, 'wet', 2, 1); } } });
    l.push({ id: 'rx_lesson', name: 'Урок', label: 'Урок', icon: 'icons/lesson', kind: 'skill', target: 'allyOther', cost: 8, fx: 'buff',
      desc: 'Союзнику +30% к заклинаниям и дешевле на 2 хода.',
      run: (e, u2, t) => {
        const list = [t!];
        if (e.team('mushoku3')) for (const k of ['rudeus', 'sylphy']) { const s = e.byKey(k); if (s && !list.includes(s)) list.push(s); }
        if (N(u2, 'C1')) { const m = e.alliesOf(u2).find((x) => x !== u2 && !list.includes(x) && MAGES.includes(x.key)); if (m) list.push(m); }
        for (const x of list) { e.add(x, 'lesson', 2, 30); if (N(u2, 'C2')) e.mp(x, 3); if (N(u2, 'C4')) e.cleanse(x, ['silence', 'slow']); }
      } });
    l.push({ id: 'rx_ult', name: 'Кумулонимбус', label: 'Гроза', icon: 'icons/storm', kind: 'ult', target: 'allEnemies', magic: true, fx: 'aoe',
      desc: '3 раунда гроза: в начале раунда молнии по всем врагам, все мокрые.',
      run: (e, u2) => {
        e.s.field = e.s.field.filter((f) => f.id !== 'storm');
        e.s.field.push({ id: 'storm', turns: N(u2, 'B1') ? 4 : 3, value: 1, data: { src: u2.uid } });
        for (const x of e.enemies()) { e.add(x, 'wet', 2, 1); e.hit(u2, x, N(u2, 'B2') ? 1.3 : 1.0, { type: 'lightning', magic: true, single: false, sure: true }); }
      } });
    return l;
  },
  hooks: {
    battleStart: (e, u) => { if (N(u, 'C5')) for (const x of e.alliesOf(u)) if (MAGES.includes(x.key)) e.add(x, 'atkUp', 99, 20); },
    dealMult: (_e, _u, _t, o) => (o.type === 'water' || o.type === 'ice' ? 1.2 : 1),
  },
});

// ===================== Марсиль =====================
hero({
  key: 'marcille', name: 'Марсиль', nameAcc: 'Марсиль', role: 'mage', work: 'Подземелье вкусностей', color: '#f2d27a',
  hp: 75, atk: 12, def: 0.05, spd: 5, mp: 70, mpRegen: 7, mpName: 'Мана', tags: ['female'],
  passive: 'Учёная-эльфийка: ×1,5 против нежити, призраков и живых доспехов. Брезгливая: блюда из монстров дают ей половину бонуса.',
  tree: {
    A: ['Атака', [node('Мощнее', 'Взрыв +25%'), node('Пламя', 'Взрыв поджигает'), node('Молния', 'Взрыв добавляет молнию по второй цели'), node('Шире', 'Взрыв бьёт всех врагов'), node('Великий взрыв', 'Взрыв ×2, потом ход отдыха')]],
    B: ['Барьеры', [node('Крепче', 'Барьер +30%'), node('Отражение', 'Барьер возвращает 20% поглощённого'), node('Против духов', 'Барьер снимает с врагов-духов баффы'), node('Стена', 'Барьер даёт ещё +10% защиты на 2 хода'), node('Неприступный круг', 'Первый барьер: отряд 2 хода поглощает заклинания')]],
    C: ['Древняя магия', [node('Обнаружение', 'В начале боя враги уязвимы +10%'), node('Голем', 'В начале боя голем закрывает самого слабого на 2 удара'), node('Сон', 'Новое умение: усыпить врага на 2 хода'), node('Половина цены', 'Воскрешение за половину шкалы'), node('Запретная магия', 'Новое умение: раз за бой огромный урон всем ценой половины здоровья')]],
  },
  abilities: (_e, u) => {
    const l: AL = [
      { id: 'mc_arrow', name: 'Магическая стрела', label: 'Стрела', icon: 'icons/arrowmagic', kind: 'basic', target: 'enemy', magic: true, fx: 'magic', desc: 'Магический снаряд.',
        run: (e, u2, t) => { e.hit(u2, t!, 1.1, { magic: true }); } },
      { id: 'mc_blast', name: 'Взрыв', label: 'Взрыв', icon: I.fire, kind: 'skill', target: N(u, 'A4') ? 'allEnemies' : 'enemy', cost: 10, magic: true, fx: 'magic',
        desc: 'Огонь по цели и соседям.',
        run: (e, u2, t) => {
          const k = (N(u2, 'A1') ? 1.25 : 1) * (N(u2, 'A5') ? 2 : 1);
          const main = N(u2, 'A4') ? e.enemies() : [t!];
          for (const x of main) {
            const n = e.hit(u2, x, (N(u2, 'A4') ? 0.9 : 1.4) * k, { type: 'fire', magic: true, single: x === t });
            if (n > 0 && N(u2, 'A2') && x.alive) e.add(x, 'burn', 3, Math.round(u2.atk * 0.3));
          }
          if (!N(u2, 'A4')) for (const x of e.adj(t!)) e.hit(u2, x, 0.7 * k, { type: 'fire', magic: true, single: false });
          if (N(u2, 'A3')) { const o = e.enemies().find((x) => x !== t); if (o) e.hit(u2, o, 0.8, { type: 'lightning', magic: true, single: false }); }
          if (N(u2, 'A5')) e.add(u2, 'exhausted', 1, 1);
        } },
      { id: 'mc_barrier', name: 'Барьер', label: 'Барьер', icon: I.shield, kind: 'skill', target: 'allAllies', cost: 10, magic: true, fx: 'buff',
        desc: 'Щит всему отряду.',
        run: (e, u2) => {
          for (const x of e.alliesOf(u2)) {
            e.add(x, 'shield', 99, Math.round(u2.atk * 1.5 * (N(u2, 'B1') ? 1.3 : 1)), N(u2, 'B2') ? { reflect: 0.2 } : undefined);
            if (N(u2, 'B4')) e.add(x, 'defUp', 2, 10);
            if (N(u2, 'B5') && !u2.res.b5) e.add(x, 'absorbMagic', 2, 0, { keep: true });
          }
          if (N(u2, 'B3')) for (const x of e.enemies()) if (x.tags.includes('spirit') || x.tags.includes('undead')) e.dispel(x, 99);
          u2.res.b5 = 1;
        } },
    ];
    if (N(u, 'C3')) l.push({ id: 'mc_sleep', name: 'Сон', label: 'Сон', icon: 'icons/sleep', kind: 'skill', target: 'enemy', cost: 8, magic: true, fx: 'magic',
      desc: 'Усыпляет врага на 2 хода (не босса). Удар будит.', check: () => null,
      run: (e, _u2, t) => { if (t!.boss) e.float(t!, 'не действует', '#aaaaaa'); else e.add(t!, 'sleep', 2, 1); } });
    if (N(u, 'C5')) l.push({ id: 'mc_forbidden', name: 'Запретная магия', label: 'Запрет', icon: 'icons/forbidden', kind: 'skill', target: 'allEnemies', perBattle: 1, magic: true, fx: 'aoe',
      desc: 'Огромный тёмный урон всем врагам ценой половины здоровья.',
      run: (e, u2) => { u2.hp = Math.max(1, Math.round(u2.hp / 2)); for (const x of e.enemies()) e.hit(u2, x, 4, { type: 'dark', magic: true, sure: true, single: false }); } });
    l.push({ id: 'mc_ult', name: 'Древнее воскрешение', label: 'Воскрес.', icon: 'icons/revive', kind: 'ult', target: 'allyDead', limit: N(u, 'C4') ? 50 : 100, fx: 'heal',
      desc: 'Поднимает павшего с полным здоровьем.', run: (e, _u2, t) => e.revive(t!, 1) });
    return l;
  },
  hooks: {
    battleStart: (e, u) => {
      if (N(u, 'C1')) for (const x of e.enemies()) e.add(x, 'vuln', 99, 10);
      if (N(u, 'C2')) { const w = e.alliesOf(u).sort((a, b) => a.maxHp - b.maxHp)[0]; if (w) e.add(w, 'block', 99, 2); }
    },
    dealMult: (_e, _u, t) => (t.tags.some((g) => ['undead', 'construct', 'spirit'].includes(g)) ? 1.5 : 1),
  },
});

// ===================== Аква =====================
function blessTarget(e: Engine, u: Unit, t: Unit): Unit {
  if (N(u, 'C2') || e.team('konosuba3') || e.preview) return t;
  if (e.rnd() < 0.1) { const r = e.pick(e.alliesOf(u)); if (r !== t) e.float(u, 'невезение!', '#ff8ad8'); return r; }
  return t;
}
function aquaHeal(e: Engine, u: Unit, t: Unit, frac: number): void {
  let n = (t.maxHp * 0.3 + u.atk * 2) * frac * (N(u, 'A1') ? 1.25 : 1);
  if (t.key === 'alucard' && e.team('aquaAlucard')) n *= 0.5;
  e.heal(t, n, false, N(u, 'A4') ? 1 : 0);
  if (N(u, 'A2')) e.cleanse(t);
}
hero({
  key: 'aqua', name: 'Аква', nameAcc: 'Акву', role: 'support', work: 'Коносуба', color: '#5ab8f0',
  hp: 90, atk: 9, def: 0.05, spd: 5, mp: 80, mpRegen: 8, mpName: 'Мана', tags: ['female'],
  passive: 'Богиня воды: большой запас маны. Невезение: 10% шанс, что Благословение достанется случайному союзнику.',
  tree: {
    A: ['Исцеление', [node('Сильнее', 'Лечение +25%'), node('Очищение', 'Лечение снимает негатив'), node('Высшее исцеление', 'Лечение действует на всех (60%)'), node('Избыток', 'Лишнее лечение становится щитом'), node('Чудо', 'Раз за бой павший союзник сам встаёт с 30%')]],
    B: ['Благословение', [node('Дольше', '4 хода'), node('Вдвоём', 'Ещё на одного союзника'), node('Быстрее', 'Даёт ускорение'), node('Всем', 'На весь отряд'), node('Божественная воля', 'Первое благословение: отряд +30% ко всему на 2 хода')]],
    C: ['Искусство вечеринки', [node('Фокус', 'Новое умение: враг −20% урона'), node('Удача', 'Невезение больше не срабатывает'), node('Изгнание нежити', 'Новое умение: святой удар по всем'), node('Слёзы богини', 'Когда её бьют, отряд +10% урона'), node('Овация', 'Фокус раз за бой оглушает всех врагов')]],
  },
  abilities: (_e, u) => {
    const l: AL = [
      { id: 'aq_blow', name: 'Божественный удар', label: 'Удар', icon: 'icons/godblow', kind: 'basic', target: 'enemy', fx: 'melee', desc: 'Святой удар, ×2 по нежити и демонам.',
        run: (e, u2, t) => { e.hit(u2, t!, 1.2, { type: 'holy' }); } },
      { id: 'aq_heal', name: 'Исцеление', label: 'Лечение', icon: I.potion, kind: 'skill', target: N(u, 'A3') ? 'allAllies' : 'allyWounded', cost: 8, magic: true, fx: 'heal',
        desc: N(u, 'A3') ? 'Лечит весь отряд.' : 'Большое лечение союзника.',
        run: (e, u2, t) => { if (N(u2, 'A3')) for (const x of e.alliesOf(u2)) aquaHeal(e, u2, x, 0.6); else aquaHeal(e, u2, t!, 1); } },
      { id: 'aq_bless', name: 'Благословение', label: 'Благосл.', icon: 'icons/bless', kind: 'skill', target: N(u, 'B4') ? 'allAllies' : 'ally', cost: 8, magic: true, fx: 'buff',
        desc: '+20% урона и защиты на 3 хода.',
        run: (e, u2, t) => {
          const list = N(u2, 'B4') ? e.alliesOf(u2) : [blessTarget(e, u2, t!)];
          if (N(u2, 'B2') && !N(u2, 'B4')) { const o = e.alliesOf(u2).find((x) => !list.includes(x)); if (o) list.push(o); }
          const d = N(u2, 'B1') ? 4 : 3;
          for (const x of list) { e.add(x, 'atkUp', d, 20); e.add(x, 'defUp', d, 20); if (N(u2, 'B3')) e.add(x, 'haste', d, 20); }
          if (N(u2, 'B5') && !u2.res.b5) { u2.res.b5 = 1; for (const x of e.alliesOf(u2)) { e.add(x, 'atkUp', 2, 30); e.add(x, 'defUp', 2, 30); } e.say('Божественная воля!'); }
        } },
    ];
    if (N(u, 'C1')) {
      if (N(u, 'C5') && !u.res.ovation) l.push({ id: 'aq_ovation', name: 'Овация', label: 'Овация', icon: 'icons/ovation', kind: 'skill', target: 'allEnemies', cost: 4, fx: 'buff',
        desc: 'Все враги засмотрелись и пропускают ход.', run: (e, u2) => { u2.res.ovation = 1; for (const x of e.enemies()) e.add(x, 'stun', 1, 1); } });
      else l.push({ id: 'aq_trick', name: 'Фокус', label: 'Фокус', icon: 'icons/trick', kind: 'skill', target: 'enemyAny', cost: 4, fx: 'buff',
        desc: 'Враг отвлёкся: −20% урона на 2 хода.', run: (e, _u2, t) => e.add(t!, 'atkDown', 2, 20) });
    }
    if (N(u, 'C3')) l.push({ id: 'aq_turn', name: 'Изгнание нежити', label: 'Изгнание', icon: 'icons/turnundead', kind: 'skill', target: 'allEnemies', cost: 12, magic: true, fx: 'aoe',
      desc: 'Святой свет по всем: нежить и демоны ×4.',
      run: (e, u2) => { for (const x of e.enemies()) e.hit(u2, x, x.tags.includes('undead') || x.tags.includes('demon') ? 1.0 : 0.5, { type: 'holy', magic: true, single: false }); } });
    l.push({ id: 'aq_ult', name: 'Воскрешение', label: 'Воскрес.', icon: 'icons/resurrect', kind: 'ult', target: 'allAllies', fx: 'heal',
      desc: 'Поднимает всех павших с 30%; если павших нет — полностью лечит отряд.',
      run: (e, u2) => {
        const dead = e.alliesOf(u2, true).filter((x) => !x.alive);
        if (dead.length) for (const x of dead) e.revive(x, 0.3);
        else for (const x of e.alliesOf(u2)) e.heal(x, x.maxHp);
      } });
    return l;
  },
  hooks: {
    onAnyDeath: (e, u, v) => {
      if (N(u, 'A5') && !u.res.miracle && v.side === u.side && v !== u && u.alive) {
        u.res.miracle = 1;
        v.statuses.push({ id: 'rising', turns: 99, value: 0.3 });
        e.float(u, 'Чудо!', '#5ab8f0');
      }
    },
    onDamaged: (e, u) => { if (N(u, 'C4')) for (const x of e.alliesOf(u)) e.add(x, 'atkUp', 2, 10); },
  },
});

// ===================== Камина =====================
function kBuff(u: Unit): number { return Math.min(2, 1 + (1 - u.hp / u.maxHp)); }
hero({
  key: 'kamina', name: 'Камина', nameAcc: 'Камину', role: 'support', work: 'Гуррен-Лаганн', color: '#2c6ad1',
  hp: 110, atk: 11, def: 0.1, spd: 6, mp: 6, mpRegen: 2, mpName: 'Энергия',
  passive: 'Вожак: пока Камина в строю, отряд +5% урона. Чем меньше у него здоровья, тем сильнее его баффы (до ×2). Дух копится от ударов.',
  tree: {
    A: ['Кличи', [node('Громче', 'Клич держится 3 хода'), node('Броня духа', 'Клич даёт +10% защиты'), node('Не робей!', 'Клич снимает оглушение, страх и замедление'), node('Без устали', 'Каждый третий клич бесплатный'), node('Непобедимая банда', 'Первый клич действует до конца боя')]],
    B: ['Брат', [node('Верь в себя', '«Пробей небеса!» даёт +50% урона на 2 хода'), node('Брат', 'Одиночные баффы вдвое сильнее'), node('Спираль', '«Пробей небеса!» даёт +60 к шкале'), node('Вперёд!', 'Первый раз брат сразу ходит'), node('Верь в меня', 'Падая, Камина даёт брату +100% урона и полную шкалу')]],
    C: ['Безрассудство', [node('Напролом', 'Ниже 50% здоровья +20% урона'), node('Злость', 'Дух растёт от полученных ударов'), node('Гига-дрель', 'Новое умение: удар за 3 Духа'), node('Не сдаваться', 'Первый смертельный удар оставляет 1 ОЗ'), node('Пробивающий небеса', 'Гига-дрель бьёт всех и пробивает броню')]],
  },
  abilities: (_e, u) => {
    const l: AL = [
      { id: 'k_katana', name: 'Катана', label: 'Катана', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee', desc: 'Удар катаной, +1 Дух.',
        run: (e, u2, t) => { e.hit(u2, t!, 1.1); e.res(u2, 'spirit', 1, 5); } },
      { id: 'k_cry', name: 'Кто, по-твоему, я такой?!', label: 'Клич', icon: 'icons/cry', kind: 'skill', target: 'allAllies',
        cost: N(u, 'A4') && ((u.res.cries ?? 0) + 1) % 3 === 0 ? 0 : 2, fx: 'buff',
        desc: 'Отряду +20% урона (+5% за Дух) на 2 хода.',
        run: (e, u2) => {
          u2.res.cries = (u2.res.cries ?? 0) + 1;
          const v = Math.round((20 + 5 * (u2.res.spirit ?? 0)) * kBuff(u2));
          const d = N(u2, 'A5') && !u2.res.a5 ? 99 : N(u2, 'A1') ? 3 : 2;
          u2.res.a5 = 1;
          for (const x of e.alliesOf(u2)) {
            e.add(x, 'atkUp', d, v);
            if (N(u2, 'A2')) e.add(x, 'defUp', d, 10);
            if (N(u2, 'A3')) e.cleanse(x, ['stun', 'fear', 'slow']);
          }
          if (e.team('escanorKamina')) { const s = e.byKey('escanor'); if (s) { s.res.kamina = 0.3; s.res.sun = (s.res.sun ?? 1) + 0.3; } }
          e.say('Кто, по-твоему, я такой?!');
        } },
      { id: 'k_pierce', name: 'Пробей небеса!', label: 'Небеса', icon: 'icons/drill', kind: 'skill', target: 'allyOther', cost: 2, fx: 'buff',
        desc: 'Союзнику ускорение и +30 к шкале Предела.',
        run: (e, u2, t) => {
          const k = (N(u2, 'B2') ? 2 : 1) * kBuff(u2);
          e.add(t!, 'haste', 2, Math.round(30 * k));
          e.limit(t!, N(u2, 'B3') ? 60 : 30);
          if (N(u2, 'B1')) e.add(t!, 'atkUp', 2, Math.round(50 * k));
          u2.res.brother = Number(t!.uid.replace(/\D/g, '')) || 0;
          t!.res.isBrother = 1;
          if (N(u2, 'B4') && !u2.res.b4) { u2.res.b4 = 1; e.extraTurn(t!); }
        } },
    ];
    if (N(u, 'C3')) l.push({ id: 'k_giga', name: 'Гига-дрель', label: 'Гига-дрель', icon: 'icons/gigadrill', kind: 'skill', target: N(u, 'C5') ? 'allEnemies' : 'enemy', fx: 'melee',
      desc: 'Удар дрелью за 3 Духа.', check: (_e, u2) => ((u2.res.spirit ?? 0) >= 3 ? null : `Нужно 3 Духа, есть ${u2.res.spirit ?? 0}.`),
      run: (e, u2, t) => { u2.res.spirit -= 3; for (const x of N(u2, 'C5') ? e.enemies() : [t!]) e.hit(u2, x, 3, { pierce: N(u2, 'C5') ? 1 : 0, single: x === t }); } });
    l.push({ id: 'k_ult', name: 'Банда Гуррен', label: 'Банда', icon: 'icons/gurren', kind: 'ult', target: 'allAllies', fx: 'buff',
      desc: 'Весь отряд сразу получает дополнительный ход.',
      run: (e, u2) => { for (const x of e.alliesOf(u2)) if (!e.s.extra.includes(x.uid)) e.s.extra.push(x.uid); e.say('Банда Гуррен, вперёд!'); } });
    return l;
  },
  hooks: {
    dealMult: (_e, u) => (N(u, 'C1') && u.hp < u.maxHp * 0.5 ? 1.2 : 1),
    onDamaged: (e, u) => { if (N(u, 'C2')) e.res(u, 'spirit', 1, 5); },
    onFatal: (_e, u) => { if (N(u, 'C4') && !u.res.c4) { u.res.c4 = 1; return true; } return false; },
    onAnyDeath: (e, u, v) => {
      if (v !== u || !N(u, 'B5')) return;
      const b = e.alliesOf(u).find((x) => x.res.isBrother);
      if (b) { e.add(b, 'atkUp', 99, 100); b.limit = 100; e.say(`${b.name}: «Я верю в тебя, братан!»`); }
    },
    resLine: (_e, u) => `Дух: ${u.res.spirit ?? 0}`,
  },
});

// ===================== Ями =====================
hero({
  key: 'yami', name: 'Ями Сукэхиро', nameAcc: 'Ями', role: 'support', work: 'Чёрный клевер', color: '#1d1d1d',
  hp: 115, atk: 13, def: 0.1, spd: 6, mp: 40, mpRegen: 6, mpName: 'Мана', dodge: 0.2,
  passive: 'Ки: чувствует атаки — отряд +10% уклонения, сам Ями +20%.',
  mods: { C4: { dodge: 0.15 } },
  tree: {
    A: ['Тёмная магия', [node('Тьма', '+20% тёмного урона'), node('Срыв', 'Разрез снимает бафф'), node('Тёмный покров', 'Разрез: тьма поглотит следующее заклинание по Ями'), node('Мгла', 'Удар снижает точность врага'), node('Абсолютный разрез', 'Разрез бьёт всех врагов')]],
    B: ['Капитан', [node('Сильнее', '«Превзойди» +70 к шкале'), node('Двоим', '«Превзойди» ещё на одного союзника'), node('Встряска', '«Превзойди» снимает негатив'), node('Сам себе', 'Своя шкала растёт вдвое быстрее'), node('Чёрные быки', 'После его ульты каждый, кто применит свою ульту, ходит ещё раз')]],
    C: ['Ки', [node('Чутьё', 'Аура уклонения 15%'), node('Ответ', 'Уклонившись, контратакует'), node('Чтение атаки', 'Отряд получает на 15% меньше урона'), node('Неуловимый', '+15% уклонения Ями'), node('Чтение Ки', 'Раз за раунд прикрывает самого раненого и контратакует')]],
  },
  abilities: () => [
    { id: 'y_blade', name: 'Тёмный клинок', label: 'Клинок', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee', desc: 'Тёмный удар, игнорирует 20% защиты.',
      run: (e, u, t) => { const n = e.hit(u, t!, 1.2 * (N(u, 'A1') ? 1.2 : 1), { type: 'dark', pierce: 0.2 }); if (n > 0 && N(u, 'A4') && t!.alive) e.add(t!, 'accDown', 2, 15); } },
    { id: 'y_slash', name: 'Разрез измерения', label: 'Разрез', icon: 'icons/dimension', kind: 'skill', target: 'enemyAny', cost: 8, magic: true, fx: 'melee',
      desc: 'Удар по любой цели сквозь провокацию и щиты.',
      run: (e, u, t) => {
        for (const x of N(u, 'A5') ? e.enemies() : [t!]) {
          e.hit(u, x, 1.9 * (N(u, 'A1') ? 1.2 : 1), { type: 'dark', magic: true, ignoreShield: true, single: x === t });
          if (N(u, 'A2') && x.alive) e.dispel(x, 1);
        }
        if (N(u, 'A3')) e.add(u, 'absorbMagic', 1, 0);
      } },
    { id: 'y_limit', name: 'Превзойди свои пределы!', label: 'Превзойди', icon: 'icons/limitbreak', kind: 'skill', target: 'allyOther', cost: 8, fx: 'buff',
      desc: 'Союзнику +50 к шкале Предела и +25% урона на 2 хода.',
      run: (e, u, t) => {
        const list = [t!];
        if (N(u, 'B2')) { const o = e.alliesOf(u).find((x) => x !== u && x !== t); if (o) list.push(o); }
        for (const x of list) {
          e.limit(x, N(u, 'B1') ? 70 : 50);
          e.add(x, 'limitBreak', 2, 25);
          if (N(u, 'B3')) e.cleanse(x);
          if (e.team('bulls2') && x.key === 'asta') e.mp(x, 2);
        }
      } },
    { id: 'y_ult', name: 'Здесь и сейчас', label: 'Здесь!', icon: 'icons/herenow', kind: 'ult', target: 'allAllies', fx: 'buff',
      desc: 'Весь отряд получает полную шкалу Предела, Ями +50% урона на 2 хода.',
      run: (e, u) => {
        for (const x of e.alliesOf(u)) if (x !== u) { x.limit = 100; if (N(u, 'B5')) x.res.bulls = 1; }
        e.add(u, 'limitBreak', 2, 50);
        e.say('Превзойди свои пределы прямо здесь и сейчас!');
      } },
  ],
  hooks: {
    dealMult: (e, _u, t) => (e.team('bulls2') && e.has(t, 'dispelledMark') ? 1.2 : 1),
    onDodge: (e, u, a) => { if (N(u, 'C2') && a.alive) e.hit(u, a, 0.8, { counter: true, sure: true, single: true }); },
    allyTakenMult: (_e, u) => (N(u, 'C3') ? 0.85 : 1),
    roundStart: (e, u) => {
      if (!N(u, 'C5')) return;
      const w = mostWounded(e, u, u);
      if (w) { e.add(u, 'guarding', 1, 0.5, { wards: [w.uid] }); e.add(u, 'counter', 1, 0.8); }
    },
  },
});

// ===================== Сильфи =====================
function sylHeal(e: Engine, u: Unit, t: Unit, frac: number): void {
  let n = (t.maxHp * 0.25 + u.atk * 2) * frac * (N(u, 'B1') ? 1.25 : 1);
  if (e.team('mushoku3') && t.key === 'rudeus') n *= 2;
  e.heal(t, n, false, N(u, 'B4') ? 1 : 0);
  if (N(u, 'B2')) e.cleanse(t);
}
hero({
  key: 'sylphy', name: 'Сильфи', nameAcc: 'Сильфи', role: 'support', work: 'Реинкарнация безработного', color: '#b8e0d2',
  hp: 85, atk: 10, def: 0.05, spd: 8, mp: 50, mpRegen: 7, mpName: 'Мана', tags: ['female'],
  passive: 'Безмолвная магия: быстрая, тишина не действует.',
  mods: { C2: { dodge: 0.2 } },
  tree: {
    A: ['Ветер', [node('Острее', 'Клинок ветра +25%'), node('Сквозь щиты', 'Ветер игнорирует щиты'), node('Буря', '«Порыв» бьёт всех врагов'), node('Попутный ветер', 'Удар ускоряет случайного союзника'), node('Вихрь', 'Клинок ветра бьёт всех')]],
    B: ['Исцеление', [node('Сильнее', 'Лечение +25%'), node('Очищение', 'Лечение снимает негатив'), node('Всем', 'Лечение действует на всех (60%)'), node('Избыток', 'Лишнее лечение становится щитом'), node('Неистощимая', 'Лечение вдвое дешевле')]],
    C: ['Фитц', [node('Охрана', 'Новое умение: прикрыть союзника'), node('Ловкость', '+20% уклонения'), node('Засада', 'В первом раунде ходит дважды'), node('Ответ ветром', 'Прикрывая, контратакует'), node('Рыцарь Фитц', 'Прикрывает 2 хода и получает вдвое меньше')]],
  },
  abilities: (_e, u) => {
    const l: AL = [
      { id: 'sy_wind', name: 'Воздушный клинок', label: 'Ветер', icon: 'icons/wind', kind: 'basic', target: N(u, 'A5') ? 'allEnemies' : 'enemy', magic: true, fx: 'magic', desc: 'Клинок ветра.',
        run: (e, u2, t) => {
          for (const x of N(u2, 'A5') ? e.enemies() : [t!]) e.hit(u2, x, (N(u2, 'A5') ? 0.8 : 1.1) * (N(u2, 'A1') ? 1.25 : 1), { type: 'wind', magic: true, ignoreShield: N(u2, 'A2'), single: x === t });
          if (N(u2, 'A4')) e.add(e.pick(e.alliesOf(u2)), 'haste', 1, 20);
        } },
      { id: 'sy_heal', name: 'Исцеление', label: 'Лечение', icon: I.potion, kind: 'skill', target: N(u, 'B3') ? 'allAllies' : 'allyWounded', cost: N(u, 'B5') ? 4 : 8, magic: true, fx: 'heal',
        desc: 'Лечение союзника.', run: (e, u2, t) => { if (N(u2, 'B3')) for (const x of e.alliesOf(u2)) sylHeal(e, u2, x, 0.6); else sylHeal(e, u2, t!, 1); } },
      { id: 'sy_gust', name: 'Порыв ветра', label: 'Порыв', icon: 'icons/gust', kind: 'skill', target: N(u, 'A3') ? 'allEnemies' : 'enemyAny', cost: 6, magic: true, fx: 'magic',
        desc: 'Сбивает замах врага и замедляет его.',
        run: (e, u2, t) => { for (const x of N(u2, 'A3') ? e.enemies() : [t!]) { if (x.res.windupT) { x.res.windupT = 0; x.res.windupA = 0; e.float(x, 'замах сбит!', '#e0ffe0'); } e.add(x, 'slow', 2, 30); } } },
    ];
    if (N(u, 'C1')) l.push({ id: 'sy_guard', name: 'Охрана', label: 'Охрана', icon: I.shield, kind: 'skill', target: 'allyOther', cost: 4, fx: 'buff',
      desc: 'Прикрывает союзника.',
      run: (e, u2, t) => {
        e.add(u2, 'guarding', N(u2, 'C5') ? 2 : 1, N(u2, 'C5') ? 0.5 : 1, { wards: [t!.uid], keep: N(u2, 'C5') });
        if (N(u2, 'C4')) e.add(u2, 'counter', N(u2, 'C5') ? 2 : 1, 0.8);
      } });
    l.push({ id: 'sy_ult', name: 'Ураган', label: 'Ураган', icon: 'icons/hurricane', kind: 'ult', target: 'allEnemies', magic: true, fx: 'aoe',
      desc: 'Ветер по всем врагам, сбивает замахи; отряду +20% уклонения на 2 хода.',
      run: (e, u2) => {
        for (const x of e.enemies()) { e.hit(u2, x, 2, { type: 'wind', magic: true, single: false, sure: true }); x.res.windupT = 0; x.res.windupA = 0; }
        for (const x of e.alliesOf(u2)) e.add(x, 'dodgeUp', 2, 20);
      } });
    return l;
  },
  hooks: {
    dealMult: (e) => (e.byKey('roxy') ? 1.1 : 1),
    turnStart: (e, u) => { if (N(u, 'C3') && e.s.round === 1 && !u.res.c3) { u.res.c3 = 1; e.extraTurn(u); } },
  },
});

// ===================== Сэнши =====================
const FOOD: Record<string, { name: string; apply: (e: Engine, x: Unit, d: number, half: number) => void }> = {
  slime: { name: 'желе из слизня', apply: (e, x, d, h) => e.add(x, 'defUp', d, 20 * h) },
  mandrake: { name: 'суп из мандрагоры', apply: (e, x, _d, h) => e.mp(x, Math.round(3 * h)) },
  basilisk: { name: 'жаркое из василиска', apply: (e, x, d, h) => e.add(x, 'atkUp', d, 20 * h) },
  frog: { name: 'жареные лапки', apply: (e, x, d, h) => e.add(x, 'dodgeUp', d, 15 * h) },
  mushroom: { name: 'грибное рагу', apply: (e, x, d, h) => e.add(x, 'regen', d, 5 * h) },
  shell: { name: 'живые доспехи на углях', apply: (e, x, d, h) => e.add(x, 'defUp', d, 25 * h) },
  cabbage: { name: 'салат из летающей капусты', apply: (e, x, d, h) => e.add(x, 'haste', d, 20 * h) },
  meat: { name: 'жаркое', apply: (e, x, d, h) => e.add(x, 'atkUp', d, 10 * h) },
};
function cook(e: Engine, u: Unit, free = false): void {
  if (!free) u.res.ingr -= 1;
  const kind = Object.keys(FOOD)[u.res.food ?? 5] ?? 'meat';
  const f = FOOD[kind] ?? FOOD.meat;
  const d = N(u, 'A4') ? 4 : 3;
  e.say(`Сэнши готовит: ${f.name}`);
  for (const x of e.alliesOf(u)) {
    const half = x.key === 'marcille' && !e.team('meshi2') ? 0.5 : 1;
    e.heal(x, x.maxHp * 0.2 * (N(u, 'A1') ? 1.25 : 1) * cookMult(e) * half);
    f.apply(e, x, d, half * cookMult(e));
    e.add(x, 'fed', d, 1);
    if (N(u, 'A2')) e.cleanse(x, ['poison']);
  }
}
export const FOOD_KEYS = Object.keys(FOOD);
hero({
  key: 'senshi', name: 'Сэнши', nameAcc: 'Сэнши', role: 'support', work: 'Подземелье вкусностей', color: '#a0703c',
  hp: 130, atk: 11, def: 0.2, spd: 4, mp: 6, mpRegen: 2, mpName: 'Энергия',
  passive: 'Повар подземелья: побеждённые монстры дают Ингредиенты. Блюда лечат отряд и дают бафф по виду монстра. После боя отряд восстанавливает 10% здоровья.',
  mods: { B1: { hp: 0.15 } },
  tree: {
    A: ['Повар', [node('Вкуснее', 'Блюда лечат +25%'), node('Противоядие', 'Блюда снимают яд'), node('Хозяйственный', '+1 ингредиент с каждого монстра'), node('Сытно', 'Бафф блюда на ход дольше'), node('Деликатес', 'Блюдо из босса: +10% урона отряду до конца региона')]],
    B: ['Воин', [node('Крепыш', '+15% здоровья'), node('Котёл-щит', 'Новое умение: прикрыть союзника'), node('Мясник', 'Топор +25% по монстрам'), node('Сюда!', 'Прикрывая, провоцирует'), node('Адамантовый котёл', 'Каждый раунд блокирует первый удар')]],
    C: ['Голем-огород', [node('Урожай', 'В начале боя +1 ингредиент'), node('Голем', 'Голем закрывает самого раненого на 2 удара'), node('Крепкий голем', 'Голем закрывает на 4 удара'), node('Богатый урожай', 'В начале боя +2 ингредиента'), node('Обед готов', 'Каждый бой начинается с готового блюда')]],
  },
  abilities: (_e, u) => {
    const l: AL = [
      { id: 'sn_axe', name: 'Топор', label: 'Топор', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee', desc: 'Удар топором.',
        run: (e, u2, t) => { e.hit(u2, t!, 1.2 * (N(u2, 'B3') && isMonster(t!) ? 1.25 : 1)); } },
      { id: 'sn_butcher', name: 'Разделка', label: 'Разделка', icon: 'icons/butcher', kind: 'skill', target: 'enemy', cost: 2, fx: 'melee',
        desc: '×1,5 по монстрам; если добивает — лишний ингредиент.',
        run: (e, u2, t) => { e.hit(u2, t!, 1.4 * (isMonster(t!) ? 1.5 : 1)); if (!t!.alive && isMonster(t!)) e.res(u2, 'ingr', 1, 20); } },
      { id: 'sn_cook', name: 'Готовка', label: 'Готовка', icon: I.potion, kind: 'skill', target: 'allAllies', cost: 2, fx: 'heal',
        desc: 'Тратит ингредиент: лечит отряд на 20% и даёт бафф по виду монстра.',
        check: (_e, u2) => ((u2.res.ingr ?? 0) >= 1 ? null : 'Нет ингредиентов — победите монстра.'),
        run: (e, u2) => cook(e, u2) },
    ];
    if (N(u, 'B2')) l.push({ id: 'sn_pot', name: 'Котёл-щит', label: 'Котёл', icon: I.shield, kind: 'skill', target: 'allyOther', cost: 2, fx: 'buff',
      desc: 'До своего хода прикрывает союзника котлом (70% урона).',
      run: (e, u2, t) => { e.add(u2, 'guarding', 1, 0.7, { wards: [t!.uid] }); if (N(u2, 'B4')) e.add(u2, 'taunt', 1, 1); } });
    l.push({ id: 'sn_ult', name: 'Пир', label: 'Пир', icon: 'icons/feast', kind: 'ult', target: 'allAllies', fx: 'heal',
      desc: 'Все ингредиенты в дело: большое лечение и баффы всем.',
      run: (e, u2) => {
        const n = u2.res.ingr ?? 0;
        u2.res.ingr = 0;
        for (const x of e.alliesOf(u2)) {
          e.heal(x, x.maxHp * (0.2 + 0.1 * n) * cookMult(e));
          e.add(x, 'atkUp', 3, 20); e.add(x, 'defUp', 3, 20); e.add(x, 'regen', 3, 5);
        }
        e.say('Пир!');
      } });
    return l;
  },
  hooks: {
    battleStart: (e, u) => {
      u.res.ingr = (N(u, 'C4') ? 2 : N(u, 'C1') ? 1 : 0) + (e.team('meshi2') ? 1 : 0);
      u.res.food = FOOD_KEYS.indexOf('meat');
      if (N(u, 'C2')) { const w = mostWounded(e, u); if (w) e.add(w, 'block', 99, N(u, 'C3') ? 4 : 2); }
      if (N(u, 'C5')) cook(e, u, true);
    },
    roundStart: (e, u) => { if (N(u, 'B5')) e.add(u, 'block', 1, 1); },
    onAnyDeath: (e, u, v, killer) => {
      if (v.side === u.side || !isMonster(v) || !killer || killer.side !== u.side) return;
      e.res(u, 'ingr', N(u, 'A3') ? 2 : 1, 20);
      const ft = v.tags.find((g) => g.startsWith('food:'))?.slice(5) ?? 'meat';
      u.res.food = Math.max(0, FOOD_KEYS.indexOf(ft));
      e.float(u, '+ингредиент', '#f5deb3');
    },
    resLine: (_e, u) => `Ингредиенты: ${u.res.ingr ?? 0}`,
  },
});
