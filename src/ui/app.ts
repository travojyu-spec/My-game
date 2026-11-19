// Экраны между боями (DOM): титул, карта региона, город, таверна, герои, магазин, кузница, события.
import './app.css';
import { Engine, STATUS, type AbilityDef, type BattleState, type Unit } from '../battle/core';
import { ENEMIES } from '../data/enemies';
import { CROSS_INFO, HERO, HEROES, ROLE_NAME, TEAM_INFO, teamFlags } from '../data/kit';
import { EVENTS, FORGE_MAX, ITEM_MAX, REGIONS, SHOP, START_HEROES, forgeCost, priceMul } from '../data/regions';
import {
  ITEM_NAME, PARTY_SIZE, applyEffects, applyResult, canBuy, deleteSave, freePoints, heroStats, huntEnemies, isDone, isOpen,
  loadSave, makeBattle, markDone, newSave, regionOf, tryJoin, writeSave, xpToNext, type BattleResult, type BattleSetup, type Save,
} from '../game/progress';
import { canFullscreen, isFullscreen, toggleFullscreen } from '../core/screen';
import { loadSettings, saveSettings } from '../core/settings';
import { sfx } from '../core/sfx';

export type BattleRunner = (setup: BattleSetup) => Promise<BattleState>;
export type ArtLookup = (key: string) => string | null;

type Kids = (Node | string | null | undefined | false)[];
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, kids: Kids = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'text') el.textContent = String(v);
    else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
const btn = (label: string, on: () => void, cls = '', disabled = false) =>
  h('button', { class: cls, type: 'button', disabled, onclick: () => { sfx.play('tap'); on(); } }, [label]);

const ICON: Record<string, string> = { town: '🏠', battle: '⚔', elite: '💀', event: '❓', camp: '🔥', boss: '👑' };
const KIND_NAME: Record<string, string> = { town: 'Город', battle: 'Бой', elite: 'Сильные враги', event: 'Событие', camp: 'Привал', boss: 'Босс' };

/** Где герой появляется в сюжете. */
const JOIN_REGION: Record<string, number> = {};
for (const k of START_HEROES) JOIN_REGION[k] = 1;
for (const r of REGIONS) for (const st of r.stages) if (st.join) JOIN_REGION[st.join] = r.id;
const HERO_ORDER = [...HEROES].sort((a, b) => (JOIN_REGION[a.key] ?? 99) - (JOIN_REGION[b.key] ?? 99));

export class App {
  private root: HTMLElement;
  private s: Save | null = null;
  private modalEl: HTMLElement | null = null;
  private toastTimer = 0;

  constructor(private runBattle: BattleRunner, private art: ArtLookup) {
    this.root = document.getElementById('ui')!;
  }

  // ======================= Общее =======================

  private save(): void { if (this.s) writeSave(this.s); }
  private show(on: boolean): void { this.root.classList.toggle('on', on); }

  private toast(text: string): void {
    document.querySelector('.u-toast')?.remove();
    const el = h('div', { class: 'u-toast', text });
    this.root.append(el);
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.remove(), 2200);
  }

  private modal(content: HTMLElement): HTMLElement {
    this.closeModal();
    const m = h('div', { class: 'u-modal' }, [content]);
    this.root.append(m);
    this.modalEl = m;
    return m;
  }
  private closeModal(): void { this.modalEl?.remove(); this.modalEl = null; }

  /** Простое окно: заголовок, текст, кнопки. */
  private dialog(title: string, text: string, buttons: HTMLElement[], body?: HTMLElement, cls = 'narrow'): void {
    this.modal(h('div', { class: 'u-panel ' + cls }, [
      h('h2', { text: title }),
      text ? h('div', { class: 'ptext', text }) : null,
      body ? h('div', { class: 'pbody u-scroll' }, [body]) : null,
      h('div', { class: 'pbtns' }, buttons),
    ]));
  }

  private face(key: string, big = false): HTMLElement {
    const d = HERO[key] ?? null;
    const e = ENEMIES[key] ?? null;
    const name = d?.name ?? e?.name ?? key;
    const color = d?.color ?? e?.color ?? '#777';
    const url = this.art('portraits/' + key) ?? this.art('heroes/' + key) ?? (e?.sprite ? this.art(e.sprite) : null);
    const el = h('div', { class: 'u-face' + (big ? ' big' : ''), style: `background-color:${color}` }, [url ? '' : initials(name)]);
    if (url) el.style.backgroundImage = `url("${url}")`;
    return el;
  }

  private screen(top: HTMLElement[], body: HTMLElement, bottom: HTMLElement[] | null): void {
    this.root.replaceChildren(
      h('div', { class: 'u-top' }, top),
      h('div', { class: 'u-body' }, [body]),
      bottom ? h('div', { class: 'u-bottom' }, bottom) : '',
    );
    this.show(true);
  }

  // ======================= Титул =======================

  start(): void {
    this.s = loadSave();
    this.title();
  }

  private title(): void {
    this.closeModal();
    const has = !!loadSave();
    this.root.replaceChildren(h('div', { class: 'u-title' }, [
      h('h1', { text: 'Перекрёсток миров' }),
      h('div', { class: 'ver', text: 'Пошаговая партийная RPG · 24 героя · 12 миров' }),
      h('div', { class: 'row' }, [
        has ? btn('Продолжить', () => { this.s = loadSave(); this.map(); }, 'primary') : null,
        btn('Новая игра', () => {
          if (has) this.dialog('Новая игра?', 'Текущее сохранение будет стёрто.', [btn('Отмена', () => this.closeModal()), btn('Начать заново', () => this.newGame(), 'danger')]);
          else this.newGame();
        }, has ? '' : 'primary'),
      ]),
    ]));
    this.show(true);
  }

  private newGame(): void {
    deleteSave();
    this.s = newSave();
    this.save();
    this.closeModal();
    this.map();
  }

  // ======================= Карта региона =======================

  private map(): void {
    const s = this.s!;
    const r = regionOf(s.region);
    s.at[r.id] ??= 0;
    const n = r.stages.length;
    const pos = (i: number) => ({ x: 7 + (i * 86) / (n - 1), y: 48 + (i % 2 ? -20 : 18) + Math.sin(i * 1.7) * 6 });

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    for (let i = 0; i + 1 < n; i++) {
      const a = pos(i);
      const b = pos(i + 1);
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(a.x)); line.setAttribute('y1', String(a.y));
      line.setAttribute('x2', String(b.x)); line.setAttribute('y2', String(b.y));
      line.setAttribute('stroke', isDone(s, r.id, i) ? '#f1dcad' : '#6b5a44');
      line.setAttribute('stroke-width', '1.2');
      line.setAttribute('stroke-dasharray', isDone(s, r.id, i) ? '' : '2 2');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      line.style.strokeWidth = '4px';
      svg.append(line);
    }
    const mapEl = h('div', { class: 'u-map', style: `background:linear-gradient(180deg, ${r.color} 0%, #1d140d 120%)` }, [svg]);
    const bg = r.bg ? this.art(r.bg) : null;
    if (bg) mapEl.style.background = `linear-gradient(rgba(20,12,6,.55), rgba(20,12,6,.75)), url("${bg}") center/cover`;
    r.stages.forEach((st, i) => {
      const p = pos(i);
      const open = isOpen(s, r.id, i);
      const done = isDone(s, r.id, i);
      const cls = ['u-node', open ? 'open' : 'locked', done ? 'done' : '', st.kind === 'boss' ? 'boss' : '', s.at[r.id] === i ? 'here' : ''].join(' ');
      const icon = this.art('ui/map/' + st.kind);
      mapEl.append(h('div', { class: cls, style: `left:${p.x}%;top:${p.y}%`, onclick: () => this.stage(i) }, [
        icon ? h('img', { src: icon, style: 'width:28px;height:28px;image-rendering:pixelated' }) : ICON[st.kind],
      ]));
      mapEl.append(h('div', { class: 'u-node-label', style: `left:${p.x}%;top:calc(${p.y}% + ${st.kind === 'boss' ? 30 : 26}px)`, text: st.name }));
    });

    const party = h('div', { class: 'u-party' }, s.party.map((k) => this.chip(k)));
    this.screen(
      [
        h('div', { class: 'title' }, [`${r.id}. ${r.name} `, h('span', { class: 'sub', text: `· ${r.work}` })]),
        h('span', { class: 'u-gold', text: `${s.gold} з.` }),
        btn('Регионы', () => this.regions(), 'small'),
        btn('Меню', () => this.menu(), 'small'),
      ],
      mapEl,
      [party, btn('Отряд', () => this.tavern(), 'small'), btn('Сумка', () => this.bag(), 'small'), btn('Герои', () => this.heroesList(), 'small')],
    );
    // Прибытие в регион: вступление, затем город (там могут присоединиться герои).
    const arrive = () => {
      if (isDone(s, r.id, 0)) { this.closeModal(); return; }
      this.closeModal();
      s.at[r.id] = 0;
      this.visit(0, () => this.map());
    };
    if (!s.seen[r.id]) {
      s.seen[r.id] = 1;
      this.save();
      this.dialog(`${r.name}`, `«${r.work}»\n\n${r.intro}`, [btn('Вперёд!', arrive, 'primary')]);
    } else if (!isDone(s, r.id, 0)) arrive();
  }

  private chip(key: string): HTMLElement {
    const s = this.s!;
    const hs = s.heroes[key];
    const st = heroStats(key, hs);
    const hp = Math.round(st.maxHp * hs.hp);
    const pts = freePoints(hs);
    return h('div', { class: 'u-chip', onclick: () => this.hero(key) }, [
      this.face(key),
      h('div', { class: 'col' }, [
        h('div', { class: 'nm', text: `${HERO[key].name}${pts > 0 ? ' ★' : ''}` }),
        h('div', { class: 'u-bar' + (hs.hp < 0.35 ? ' low' : '') }, [h('i', { style: `width:${Math.round(hs.hp * 100)}%` })]),
        h('div', { class: 'u-muted nm', text: `ур.${hs.level} ♥${hp}/${st.maxHp}` }),
      ]),
    ]);
  }

  private stage(i: number): void {
    const s = this.s!;
    const r = regionOf(s.region);
    const st = r.stages[i];
    if (!isOpen(s, r.id, i)) { sfx.play('deny'); this.toast('Сначала пройдите предыдущий этап.'); return; }
    s.at[r.id] = i;
    this.save();
    switch (st.kind) {
      case 'town': return this.town(i);
      case 'camp': return this.camp(i);
      case 'event': return this.eventStage(i);
      default: return this.battleStage(i);
    }
  }

  /** Отметить мирный этап и принять героя. */
  private visit(i: number, then: () => void): void {
    const s = this.s!;
    const st = regionOf(s.region).stages[i];
    markDone(s, s.region, i);
    const j = tryJoin(s, st);
    this.save();
    if (j) this.joinDialog(st.join!, j, then);
    else then();
  }

  private joinDialog(key: string, text: string, then: () => void): void {
    const d = HERO[key];
    const body = h('div', { class: 'u-row' }, [this.face(key, true), h('div', { class: 'grow' }, [
      h('div', { text: `${d.name} · ${ROLE_NAME[d.role]}` }),
      h('div', { class: 'u-muted', text: `«${d.work}»` }),
      h('div', { class: 'u-muted', text: d.passive }),
    ])]);
    const inParty = this.s!.party.includes(key);
    this.dialog('Новый герой!', text + (inParty ? '' : '\n\nОтряд полон — героя можно взять в таверне города.'), [btn('Отлично', () => { this.closeModal(); then(); }, 'primary')], body);
  }

  // ======================= Город и привал =======================

  private town(i: number): void {
    this.visit(i, () => {
      const s = this.s!;
      const r = regionOf(s.region);
      const b = r.bounty;
      const kills = s.kills[b.enemy] ?? 0;
      const claimed = !!s.bounty[r.id];
      const reward = 80 * r.id;
      const list = h('div', {}, [
        h('div', { class: 'u-row' }, [h('div', { class: 'grow' }, [h('div', { text: 'Отдых в таверне' }), h('div', { class: 'u-muted', text: 'Весь отряд полностью восстанавливает здоровье.' })]),
          btn('Отдохнуть', () => { for (const x of Object.values(s.heroes)) x.hp = 1; this.save(); sfx.play('heal'); this.toast('Отряд отдохнул.'); this.map(); this.town(i); })]),
        h('div', { class: 'u-row' }, [h('div', { class: 'grow' }, [h('div', { text: 'Таверна: отряд' }), h('div', { class: 'u-muted', text: 'Выбрать 4 героев в отряд.' })]), btn('Отряд', () => this.tavern())]),
        h('div', { class: 'u-row' }, [h('div', { class: 'grow' }, [h('div', { text: 'Магазин' }), h('div', { class: 'u-muted', text: 'Зелья, бомбы, перья феникса.' })]), btn('Магазин', () => this.shop())]),
        h('div', { class: 'u-row' }, [h('div', { class: 'grow' }, [h('div', { text: 'Кузница' }), h('div', { class: 'u-muted', text: 'Улучшить оружие (+6% атаки) и броню (+6% здоровья).' })]), btn('Кузница', () => this.forge())]),
        h('div', { class: 'u-row' }, [h('div', { class: 'grow' }, [
          h('div', { text: `Задание: ${ENEMIES[b.enemy].name} × ${b.count}` }),
          h('div', { class: claimed ? 'u-good' : 'u-muted', text: claimed ? 'Награда получена.' : `Убито: ${Math.min(kills, b.count)} из ${b.count}. Награда: ${reward} золота и перо феникса.` }),
        ]), btn('Сдать', () => {
          s.gold += reward; s.items.phoenix = Math.min(ITEM_MAX, (s.items.phoenix ?? 0) + 1); s.bounty[r.id] = 1; this.save(); sfx.play('victory'); this.toast(`+${reward} золота`); this.map(); this.town(i);
        }, 'primary', claimed || kills < b.count)]),
        h('div', { class: 'u-row' }, [h('div', { class: 'grow' }, [h('div', { text: 'Охота' }), h('div', { class: 'u-muted', text: 'Случайный бой с местными монстрами: опыт и золото.' })]),
          btn('Охотиться', () => { this.closeModal(); void this.fight(makeBattle(s, r.id, huntEnemies(s, r.id), 'hunt', null, 'Охота')); })]),
      ]);
      this.dialog(r.stages[i].name, '', [btn('На карту', () => { this.closeModal(); this.map(); }, 'primary')], list, '');
    });
  }

  private camp(i: number): void {
    this.visit(i, () => {
      const s = this.s!;
      this.dialog(regionOf(s.region).stages[i].name, 'Безопасное место. Костёр восстанавливает половину здоровья всего отряда.', [
        btn('Отряд', () => this.tavern()),
        btn('Уйти', () => { this.closeModal(); this.map(); }),
        btn('Отдохнуть', () => {
          for (const x of Object.values(s.heroes)) x.hp = Math.min(1, x.hp + 0.5);
          this.save(); sfx.play('heal'); this.closeModal(); this.toast('Отряд отдохнул у костра.'); this.map();
        }, 'primary'),
      ]);
    });
  }

  // ======================= События =======================

  private eventStage(i: number): void {
    const s = this.s!;
    const r = regionOf(s.region);
    const st = r.stages[i];
    const ev = EVENTS[st.event!];
    if (isDone(s, r.id, i)) {
      this.dialog(st.name, 'Здесь вы уже побывали.', [btn('Назад', () => { this.closeModal(); this.map(); })]);
      return;
    }
    const k = 1 + 0.5 * (r.id - 1);
    const opts = ev.options.map((o) => {
      const cost = o.cost ? Math.round(o.cost * k) : 0;
      const label = cost ? o.label.replace(/\d+ золота/, `${cost} золота`) : o.label;
      return btn(label, () => {
        if (cost > s.gold) { sfx.play('deny'); this.toast('Не хватает золота.'); return; }
        s.gold -= cost;
        let seed = s.seed;
        const out = applyEffects(s, r.id, o.fx, () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; s.seed = seed; return (seed % 1000) / 1000; });
        const text = [o.text, out.text].filter(Boolean).join('\n');
        if (out.fight) {
          this.save();
          this.dialog(ev.title, text, [btn('В бой!', () => { this.closeModal(); void this.fight(makeBattle(s, r.id, out.fight!, 'event', i, ev.title)); }, 'primary')]);
          return;
        }
        this.visit(i, () => {
          this.dialog(ev.title, text || 'Ничего не произошло.', [btn('Дальше', () => { this.closeModal(); this.map(); }, 'primary')]);
        });
      });
    });
    this.dialog(ev.title, ev.text, [...opts, btn('Уйти', () => { this.closeModal(); this.map(); })]);
  }

  // ======================= Бои =======================

  private battleStage(i: number): void {
    const s = this.s!;
    const r = regionOf(s.region);
    const st = r.stages[i];
    const kind = st.kind === 'boss' ? 'boss' : st.kind === 'elite' ? 'elite' : 'battle';
    const list = h('div', {}, countList(st.enemies!).map(([k, n]) => {
      const e = ENEMIES[k];
      return h('div', { class: 'u-row' }, [this.face(k), h('div', { class: 'grow' }, [
        h('div', { text: `${e.name}${n > 1 ? ' × ' + n : ''}${e.boss ? ' · БОСС' : ''}` }),
        h('div', { class: 'u-muted', text: e.desc }),
      ])]);
    }));
    const weak = s.party.some((k) => s.heroes[k].hp < 0.35);
    const done = isDone(s, r.id, i);
    this.dialog(`${KIND_NAME[st.kind]}: ${st.name}`, (done ? 'Этап уже пройден, можно сразиться снова.\n' : '') + (weak ? 'Кто-то в отряде сильно ранен — загляните на привал или в город.' : ''), [
      btn('Отряд', () => this.tavern()),
      btn('Назад', () => { this.closeModal(); this.map(); }),
      btn('В бой!', () => { this.closeModal(); void this.fight(makeBattle(s, r.id, st.enemies!, kind, i, st.name)); }, 'primary'),
    ], list);
  }

  private async fight(setup: BattleSetup): Promise<void> {
    const s = this.s!;
    if (!s.party.length) { this.toast('Отряд пуст.'); return; }
    this.save();
    this.show(false);
    const st = await this.runBattle(setup);
    const res = applyResult(s, setup, st);
    this.save();
    this.map();
    this.results(setup, res);
  }

  private results(setup: BattleSetup, res: BattleResult): void {
    const s = this.s!;
    if (!res.victory) {
      // Поражение: отряд приходит в себя в городе региона.
      for (const x of Object.values(s.heroes)) x.hp = 1;
      s.at[setup.region] = 0;
      this.save();
      this.map();
      this.dialog('Поражение', `Отряд отступил в город и пришёл в себя.\nПотеряно ${res.lostGold} золота.`, [btn('Ладно', () => this.closeModal(), 'primary')]);
      return;
    }
    const lines = [`Опыт: +${res.xp} каждому в отряде (запасным половина).`, `Золото: +${res.gold}.`];
    if (res.drops.length) lines.push('Трофеи: ' + res.drops.map((d) => ITEM_NAME[d]).join(', ') + '.');
    for (const u of res.levelUps) lines.push(`${HERO[u.key].name}: уровень ${u.level}!${freePoints(s.heroes[u.key]) > 0 ? ' Есть очки навыков.' : ''}`);
    const next = () => {
      const joins = [...res.joins];
      const step = () => {
        const j = joins.shift();
        if (j) {
          const key = regionOf(setup.region).stages[setup.stage!].join!;
          this.joinDialog(key, j, step);
          return;
        }
        if (res.regionDone) this.regionDone(setup.region);
        else this.closeModal();
      };
      step();
    };
    sfx.play('victory');
    this.dialog('Победа!', lines.join('\n'), [btn('Дальше', next, 'primary')]);
  }

  private regionDone(id: number): void {
    const s = this.s!;
    const r = regionOf(id);
    if (s.ended && id === REGIONS.length) {
      this.dialog('Конец пути', `${r.outro}\n\nВсе 12 миров пройдены. Можно продолжать охоту и прокачку в любом регионе.`, [btn('Ура!', () => this.closeModal(), 'primary')]);
      return;
    }
    const nr = regionOf(id + 1);
    this.dialog(`${r.name}: пройдено!`, `${r.outro}\n\nОткрыт новый регион: ${nr.name} («${nr.work}»).`, [
      btn('Остаться', () => this.closeModal()),
      btn('Отправиться', () => { s.region = nr.id; this.save(); this.closeModal(); this.map(); }, 'primary'),
    ]);
  }

  // ======================= Регионы, сумка, меню =======================

  private regions(): void {
    const s = this.s!;
    const list = h('div', {}, REGIONS.map((r) => {
      const open = r.id <= s.maxRegion;
      const done = isDone(s, r.id, r.stages.length - 1);
      return h('div', { class: 'u-row' }, [
        h('div', { class: 'grow' }, [
          h('div', { text: open ? `${r.id}. ${r.name}` : `${r.id}. ???` }),
          h('div', { class: 'u-muted', text: open ? `«${r.work}»${done ? ' · пройден' : ''}` : 'Победите босса предыдущего региона.' }),
        ]),
        open ? btn(r.id === s.region ? 'Здесь' : 'Отправиться', () => { s.region = r.id; this.save(); this.closeModal(); this.map(); }, '', r.id === s.region) : null,
      ]);
    }));
    this.dialog('Регионы', '', [btn('Закрыть', () => this.closeModal(), 'primary')], list);
  }

  private bag(): void {
    const s = this.s!;
    const list = h('div', {}, SHOP.map((it) => h('div', { class: 'u-row' }, [
      h('div', { class: 'grow' }, [h('div', { text: `${it.name} × ${s.items[it.id] ?? 0}` }), h('div', { class: 'u-muted', text: it.desc })]),
    ])));
    this.dialog('Сумка', 'Предметы используются в бою кнопкой «Сумка». Пополнить — в магазине города.', [btn('Закрыть', () => this.closeModal(), 'primary')], list);
  }

  private menu(): void {
    const settings = loadSettings();
    this.dialog('Меню', `Сохранение автоматическое. Боёв проведено: ${this.s!.battles}.`, [
      btn(sfx.enabled ? 'Звук: вкл' : 'Звук: выкл', () => { sfx.enabled = !sfx.enabled; saveSettings({ ...settings, sound: sfx.enabled }); this.menu(); }),
      canFullscreen() ? btn(isFullscreen() ? 'Окно' : 'Весь экран', () => { toggleFullscreen(); this.closeModal(); }) : null,
      btn('Титульный экран', () => this.title()),
      btn('Закрыть', () => this.closeModal(), 'primary'),
    ].filter(Boolean) as HTMLElement[]);
  }

  // ======================= Таверна (выбор отряда) =======================

  private tavern(): void {
    const s = this.s!;
    const grid = h('div', { class: 'u-grid' });
    for (const d of HERO_ORDER) {
      const have = !!s.heroes[d.key];
      const idx = s.party.indexOf(d.key);
      const card = h('div', { class: 'u-card' + (idx >= 0 ? ' sel' : '') + (have ? '' : ' locked') }, have ? [
        this.face(d.key),
        h('div', { class: 'nm', text: d.name }),
        h('div', { class: 'rl', text: `${ROLE_NAME[d.role]} · ур.${s.heroes[d.key].level}` }),
        idx >= 0 ? h('div', { text: `в отряде #${idx + 1}` }) : null,
      ] : [
        h('div', { class: 'u-face', style: 'background:#555' }, ['?']),
        h('div', { class: 'nm', text: '???' }),
        h('div', { class: 'rl', text: `Регион ${JOIN_REGION[d.key]}` }),
      ]);
      card.addEventListener('click', () => {
        if (!have) { sfx.play('deny'); this.toast(`Герой присоединится в регионе ${JOIN_REGION[d.key]}: ${regionOf(JOIN_REGION[d.key]).name}.`); return; }
        sfx.play('tap');
        if (idx >= 0) {
          if (s.party.length <= 1) { this.toast('В отряде должен быть хотя бы один герой.'); return; }
          s.party.splice(idx, 1);
        } else {
          if (s.party.length >= PARTY_SIZE) { this.toast('В отряде уже 4 героя — сначала уберите кого-то.'); return; }
          s.party.push(d.key);
        }
        this.save();
        this.tavern();
      });
      grid.append(card);
    }
    const flags = teamFlags(s.party);
    const syn: string[] = [];
    for (const t of TEAM_INFO) {
      if (flags.includes(t.id + '2')) syn.push(`${t.name}: ${t.two}`);
      if (t.three && flags.includes(t.id + '3')) syn.push(`${t.name} (все трое): ${t.three}`);
    }
    for (const c of CROSS_INFO) if (flags.includes(c.flag)) syn.push(c.text);
    const body = h('div', {}, [
      grid,
      h('div', { class: 'ptext', style: 'padding:8px 0 0', text: syn.length ? 'Сыгранность:\n' + syn.join('\n') : 'Сыгранность: герои из одного произведения дают бонусы друг другу.' }),
    ]);
    this.dialog('Таверна: отряд', 'Коснитесь героя, чтобы взять или убрать. Порядок — места слева направо.', [
      btn('Закрыть', () => { this.closeModal(); this.map(); }, 'primary'),
    ], body, 'full');
  }

  // ======================= Герои =======================

  private heroesList(): void {
    const s = this.s!;
    const list = h('div', {}, HERO_ORDER.filter((d) => s.heroes[d.key]).map((d) => {
      const hs = s.heroes[d.key];
      const pts = freePoints(hs);
      return h('div', { class: 'u-row', onclick: () => this.hero(d.key), style: 'cursor:pointer' }, [
        this.face(d.key),
        h('div', { class: 'grow' }, [
          h('div', { text: `${d.name} · ур.${hs.level}${s.party.includes(d.key) ? ' · в отряде' : ''}` }),
          h('div', { class: pts > 0 ? 'u-gold-ink' : 'u-muted', text: pts > 0 ? `Очков навыков: ${pts}` : `${ROLE_NAME[d.role]} · «${d.work}»` }),
        ]),
      ]);
    }));
    this.dialog(`Герои (${Object.keys(s.heroes).length} из ${HEROES.length})`, '', [btn('Закрыть', () => this.closeModal(), 'primary')], list);
  }

  private hero(key: string, tab: 'tree' | 'abilities' | 'info' = 'abilities'): void {
    const s = this.s!;
    const d = HERO[key];
    const hs = s.heroes[key];
    const st = heroStats(key, hs);
    const pts = freePoints(hs);
    const left = h('div', { class: 'left u-scroll' }, [
      h('div', { class: 'u-row' }, [this.face(key, true), h('div', { class: 'grow' }, [
        h('div', { text: d.name }),
        h('div', { class: 'u-muted', text: `${ROLE_NAME[d.role]} · ур.${hs.level}` }),
        h('div', { class: 'u-muted', text: `«${d.work}»` }),
      ])]),
      h('div', { class: 'u-bar xp' }, [h('i', { style: `width:${Math.round((hs.xp / xpToNext(hs.level)) * 100)}%` })]),
      h('div', { class: 'u-muted', text: `Опыт ${hs.xp}/${xpToNext(hs.level)}` }),
      h('div', { class: 'u-stats' }, [
        'Здоровье', h('span', { text: `${Math.round(st.maxHp * hs.hp)}/${st.maxHp}` }),
        'Атака', h('span', { text: String(st.atk) }),
        'Защита', h('span', { text: `${Math.round(st.def * 100)}%` }),
        'Скорость', h('span', { text: String(st.spd) }),
        d.mpName, h('span', { text: String(st.maxMp) }),
        'Уклонение', h('span', { text: `${Math.round(st.dodge * 100)}%` }),
        'Крит', h('span', { text: `${Math.round(st.crit * 100)}%` }),
        'Оружие', h('span', { text: `+${hs.weapon}` }),
        'Броня', h('span', { text: `+${hs.armor}` }),
      ]),
    ]);
    const tabs = h('div', { class: 'u-tabs' }, [
      btn('Умения', () => this.hero(key, 'abilities'), tab === 'abilities' ? 'on small' : 'small'),
      btn(`Дерево${pts > 0 ? ' ★' + pts : ''}`, () => this.hero(key, 'tree'), tab === 'tree' ? 'on small' : 'small'),
      btn('Пассивка', () => this.hero(key, 'info'), tab === 'info' ? 'on small' : 'small'),
    ]);
    let content: HTMLElement;
    if (tab === 'abilities') {
      content = h('div', {}, previewAbilities(key, hs.nodes).map((a) => h('div', { class: 'u-ab' }, [
        h('div', { class: 'an', text: a.name }),
        h('div', { class: 'ak', text: abilityTags(a, d.mpName) }),
        h('div', { class: 'ad', text: a.desc }),
      ])));
    } else if (tab === 'info') {
      content = h('div', {}, [
        h('div', { class: 'u-ab' }, [h('div', { class: 'an', text: 'Пассивная способность' }), h('div', { class: 'ad', text: d.passive })]),
        h('div', { class: 'u-ab' }, [h('div', { class: 'an', text: 'Шкала Предела' }), h('div', { class: 'ad', text: 'Копится от ударов и полученного урона. Полная шкала открывает ульту.' })]),
        ...TEAM_INFO.filter((t) => t.heroes.includes(key)).map((t) => h('div', { class: 'u-ab' }, [
          h('div', { class: 'an', text: `Сыгранность: ${t.name}` }), h('div', { class: 'ad', text: `Двое: ${t.two}${t.three ? '\nТрое: ' + t.three : ''}` }),
        ])),
      ]);
    } else {
      content = h('div', { class: 'u-tree' }, (['A', 'B', 'C'] as const).map((b) => {
        const [bname, nodes] = d.tree[b];
        return h('div', { class: 'u-branch' }, [
          h('h3', { text: bname }),
          ...nodes.map((nd, i) => {
            const id = b + (i + 1);
            const have = hs.nodes.includes(id);
            const why = canBuy(hs, id);
            const el = h('div', { class: 'u-tnode' + (have ? ' have' : !why ? ' can' : '') }, [
              h('span', { class: 'tn', text: `${i + 1}. ${nd.n}` }), h('span', { class: 'td', text: nd.t }),
            ]);
            el.addEventListener('click', () => {
              if (have) return;
              if (why) { sfx.play('deny'); this.toast(why); return; }
              this.dialog(nd.n, `${nd.t}\n\nИзучить за 1 очко?`, [
                btn('Отмена', () => this.hero(key, 'tree')),
                btn('Изучить', () => { hs.nodes.push(id); this.save(); sfx.play('select'); this.hero(key, 'tree'); }, 'primary'),
              ]);
            });
            return el;
          }),
        ]);
      }));
    }
    const right = h('div', { class: 'right' }, [tabs, h('div', { class: 'u-scroll', style: 'flex:1;min-height:0' }, [
      tab === 'tree' ? h('div', { class: 'u-muted', style: 'margin-bottom:4px', text: `Очков: ${pts}. Одно очко за каждые 2 уровня, навыки ветки — по порядку.` }) : null,
      content,
    ])]);
    this.modal(h('div', { class: 'u-panel full' }, [
      h('div', { class: 'pbody' }, [h('div', { class: 'u-hero' }, [left, right])]),
      h('div', { class: 'pbtns' }, [btn('Закрыть', () => { this.closeModal(); this.map(); }, 'primary')]),
    ]));
  }

  // ======================= Магазин и кузница =======================

  private shop(): void {
    const s = this.s!;
    const k = priceMul(s.region);
    const list = h('div', {}, SHOP.map((it) => {
      const price = Math.round(it.price * k);
      const have = s.items[it.id] ?? 0;
      return h('div', { class: 'u-row' }, [
        h('div', { class: 'grow' }, [h('div', { text: `${it.name} · в сумке ${have}/${ITEM_MAX}` }), h('div', { class: 'u-muted', text: it.desc })]),
        btn(`${price} з.`, () => {
          if (s.gold < price) { sfx.play('deny'); this.toast('Не хватает золота.'); return; }
          if (have >= ITEM_MAX) { this.toast('Сумка полна.'); return; }
          s.gold -= price; s.items[it.id] = have + 1; this.save(); sfx.play('select'); this.shop();
        }, '', have >= ITEM_MAX),
      ]);
    }));
    this.dialog(`Магазин · ${s.gold} золота`, '', [btn('Готово', () => { this.closeModal(); this.map(); }, 'primary')], list);
  }

  private forge(): void {
    const s = this.s!;
    const list = h('div', {}, HERO_ORDER.filter((d) => s.heroes[d.key]).map((d) => {
      const hs = s.heroes[d.key];
      const up = (slot: 'weapon' | 'armor') => {
        const lvl = hs[slot];
        const cost = forgeCost(lvl);
        if (lvl >= FORGE_MAX) return btn('Макс.', () => undefined, 'small', true);
        return btn(`${slot === 'weapon' ? 'Оружие' : 'Броня'} ${cost}`, () => {
          if (s.gold < cost) { sfx.play('deny'); this.toast('Не хватает золота.'); return; }
          s.gold -= cost; hs[slot] = lvl + 1; this.save(); sfx.play('guard'); this.forge();
        }, 'small');
      };
      return h('div', { class: 'u-row' }, [
        this.face(d.key),
        h('div', { class: 'grow' }, [h('div', { text: d.name + (s.party.includes(d.key) ? ' · в отряде' : '') }), h('div', { class: 'u-muted', text: `Оружие +${hs.weapon} · Броня +${hs.armor}` })]),
        up('weapon'), up('armor'),
      ]);
    }));
    this.dialog(`Кузница · ${s.gold} золота`, '', [btn('Готово', () => { this.closeModal(); this.map(); }, 'primary')], list, '');
  }
}

// ---------- помощники ----------

function initials(name: string): string {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

function countList(l: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const k of l) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m];
}

/** Умения героя вне боя: собираем с фиктивным боем. */
function previewAbilities(key: string, nodes: string[]): AbilityDef[] {
  const d = HERO[key];
  const u: Unit = {
    uid: 'h0', key, side: 'hero', name: d.name, nameAcc: d.nameAcc, pos: 0, level: 1, maxHp: d.hp, hp: d.hp, atk: d.atk, def: d.def, spd: d.spd,
    maxMp: d.mp, mp: d.mp, mpRegen: d.mpRegen, mpName: d.mpName, dodge: 0, crit: 0, limit: 0, alive: true, statuses: [], res: {}, cd: {}, uses: {},
    nodes, tags: [], resist: {}, boss: false, xp: 0, gold: 0,
  };
  const e = new Engine({ v: 1, round: 1, order: [], turn: 0, extra: [], cur: 'h0', units: [u], seed: 1, result: 'ongoing', field: [], team: [], items: {}, region: 1 });
  try { e.kit(u).hooks.battleStart?.(e, u); } catch { /* только для описаний */ }
  return e.abilities(u);
}

function abilityTags(a: AbilityDef, mpName: string): string {
  const t: string[] = [];
  t.push(a.kind === 'basic' ? 'Базовое' : a.kind === 'ult' ? `Ульта (шкала ${a.limit ?? 100})` : 'Умение');
  if (a.cost) t.push(`${a.cost} ${mpName.toLowerCase()}`);
  if (a.cd) t.push(`перезарядка ${a.cd}`);
  if (a.perBattle) t.push(`${a.perBattle} раз за бой`);
  if (a.magic) t.push('магия');
  return t.join(' · ');
}

export { STATUS };
