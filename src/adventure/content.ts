import { ABILITIES, UNIT_BY_ID } from '../config/balance';
import type { AbilityDef, UnitDef } from '../battle/types';

export const HERO_IDS = ['stark','frieren','fern','megumin','goblin_slayer','nara','mira'] as const;
export type HeroId = typeof HERO_IDS[number];
export interface HeroProfile { id: HeroId; texture: string; role: string; price?: number; }
export const HEROES: Record<HeroId, HeroProfile> = {
  stark:{id:'stark',texture:'cg/heroes/stark',role:'Воин'},
  frieren:{id:'frieren',texture:'cg/heroes/frieren',role:'Маг · защита'},
  fern:{id:'fern',texture:'cg/heroes/fern',role:'Маг · точный урон'},
  megumin:{id:'megumin',texture:'cg/heroes/megumin',role:'Маг · взрыв'},
  goblin_slayer:{id:'goblin_slayer',texture:'cg/heroes/goblin_slayer',role:'Защитник'},
  nara:{id:'nara',texture:'cg/opening/ranger',role:'Табакси · лучница',price:90},
  mira:{id:'mira',texture:'cg/opening/healer',role:'Дженази · лекарь',price:120},
};
const extras: AbilityDef[] = [
 {id:'axe',name:'Рубящий удар',label:'Удар',icon:'sword',cost:0,target:'enemy',effect:{kind:'damage',power:6,type:'physical'},fx:'melee',text:'6 физического урона выбранному врагу.'},
 {id:'heavyAxe',name:'Сильный удар',label:'Сильный',icon:'sword',cost:3,target:'enemy',effect:{kind:'damage',power:10,type:'physical'},fx:'melee',text:'10 физического урона. Броня уменьшает его вдвое.'},
 {id:'frierenBolt',name:'Магический снаряд',label:'Снаряд',icon:'fire',cost:0,target:'enemy',effect:{kind:'damage',power:5,type:'magic'},fx:'fireball',text:'5 магического урона. Проходит сквозь броню грибов.'},
 {id:'barrier',name:'Барьер',label:'Барьер',icon:'shield',cost:3,target:'ally',effect:{kind:'guard',barrier:true},fx:'guard',text:'Следующий удар по выбранному союзнику вдвое слабее.'},
 {id:'fernBolt',name:'Магический выстрел',label:'Выстрел',icon:'fire',cost:0,target:'enemy',effect:{kind:'damage',power:6,type:'magic'},fx:'fireball',text:'6 магического урона. Броня не мешает.'},
 {id:'fernAim',name:'Прицельное заклинание',label:'Точный',icon:'fire',cost:3,target:'enemy',effect:{kind:'damage',power:10,type:'magic'},fx:'fireball',text:'10 магического урона одной цели.'},
 {id:'staff3',name:'Удар посохом',label:'Посох',icon:'sword',cost:0,target:'enemy',effect:{kind:'damage',power:3,type:'physical'},fx:'melee',text:'3 физического урона.'},
 {id:'explosion',name:'Взрыв',label:'Взрыв',icon:'fire',cost:12,target:'enemy',effect:{kind:'damage',power:12,type:'fire',all:true,exhaust:true},fx:'fireball',text:'12 огнём всем врагам. По громилам — 18. Один раз за бой: после взрыва Мэгумин отдыхает до его конца.'},
 {id:'shortSword',name:'Короткий меч',label:'Удар',icon:'sword',cost:0,target:'enemy',effect:{kind:'damage',power:5,type:'physical'},fx:'melee',text:'5 физического урона.'},
 {id:'cover',name:'Прикрытие',label:'Прикрыть',icon:'shield',cost:2,target:'ally-other',effect:{kind:'guard',once:true},fx:'guard',text:'Следующий удар по союзнику принимает Убийца гоблинов, получая половину урона.'},
 {id:'naraShot',name:'Выстрел из лука',label:'Выстрел',icon:'bow',cost:0,target:'enemy',effect:{kind:'damage',power:5,type:'physical'},fx:'arrow',text:'5 физического урона. Нара действует раньше остальных.'},
 {id:'naraAim',name:'Меткий выстрел',label:'Меткий',icon:'bow',cost:3,target:'enemy',effect:{kind:'damage',power:9,type:'physical',ignoreArmor:true},fx:'arrow',text:'9 физического урона, игнорирует броню.'},
 {id:'miraHeal',name:'Лечение',label:'Лечить',icon:'potion',cost:3,target:'ally-wounded',effect:{kind:'heal',power:10},fx:'heal',text:'Восстанавливает выбранному союзнику 10 здоровья.'},
 {id:'pebble3',name:'Рогатка',label:'Рогатка',icon:'sword',cost:0,target:'enemy',effect:{kind:'damage',power:3,type:'physical'},fx:'pebble',text:'3 урона из рогатки.'},
 {id:'slam14',name:'Сокрушение',label:'Удар',icon:'sword',cost:0,target:'enemy',effect:{kind:'damage',power:14,type:'physical'},fx:'slam',text:'14 урона по цели замаха.'},
 {id:'mend8',name:'Грибной отвар',label:'Лечение',icon:'potion',cost:0,target:'ally-wounded',effect:{kind:'heal',power:8},fx:'heal',text:'Восстанавливает союзнику 8 здоровья.'},
 {id:'spores3',name:'Споры',label:'Споры',icon:'potion',cost:0,target:'enemy',effect:{kind:'damage',power:3,type:'physical'},fx:'spores',text:'3 урона спорами.'},
];
const defs: UnitDef[] = [
 {id:'stark',name:'Старк',nameAcc:'Старка',side:'hero',maxHp:30,maxMp:6,speed:8,abilities:['axe','heavyAxe'],traits:'Надёжный воин. Сильный удар наносит 10 урона.'},
 {id:'frieren',name:'Фрирен',nameAcc:'Фрирен',side:'hero',maxHp:22,maxMp:9,speed:10,abilities:['frierenBolt','barrier'],traits:'Магия проходит сквозь броню. Барьер смягчает следующий удар.'},
 {id:'fern',name:'Ферн',nameAcc:'Ферн',side:'hero',maxHp:24,maxMp:9,speed:11,abilities:['fernBolt','fernAim'],traits:'Быстрые точные заклинания против одной цели.'},
 {id:'megumin',name:'Мэгумин',nameAcc:'Мэгумин',side:'hero',maxHp:20,maxMp:12,speed:4,abilities:['staff3','explosion'],traits:'Взрыв бьёт всех врагов. Затем Мэгумин отдыхает до конца боя.'},
 {id:'goblin_slayer',name:'Убийца гоблинов',nameAcc:'Убийцу гоблинов',side:'hero',maxHp:40,maxMp:6,speed:9,abilities:['shortSword','cover'],traits:'Прикрывает союзника и принимает удар с половиной урона.'},
 {id:'nara',name:'Нара',nameAcc:'Нару',side:'hero',maxHp:25,maxMp:6,speed:12,abilities:['naraShot','naraAim'],traits:'Быстрая лучница. Меткий выстрел игнорирует броню.'},
 {id:'mira',name:'Мира',nameAcc:'Миру',side:'hero',maxHp:24,maxMp:9,speed:7,abilities:['staff3','miraHeal'],traits:'Лечит союзника на 10 здоровья. Берегите её ману.'},
 {id:'goblin_01',name:'Гоблин',nameAcc:'Гоблина',side:'enemy',maxHp:9,maxMp:0,speed:6,abilities:['pebble3'],brain:'goblin',traits:'Одинокий гоблин. Двух обычных ударов Старка достаточно.'},
 {id:'goblin_02',name:'Гоблин',nameAcc:'Гоблина',side:'enemy',maxHp:16,maxMp:0,speed:6,abilities:['slingshot'],brain:'goblin',traits:'Стреляет в самого раненого героя.'},
 {id:'brute_02',name:'Грибной громила',nameAcc:'Громилу',side:'enemy',maxHp:36,maxMp:0,speed:3,abilities:['windup','slam14'],brain:'brute',resist:{physical:0.5,fire:1.5},traits:'Броня уменьшает физический урон вдвое. Замах предупреждает о сильном ударе.'},
 {id:'guard_03',name:'Страж шлюза',nameAcc:'Стража шлюза',side:'enemy',maxHp:65,maxMp:0,speed:3,abilities:['windup','slam'],brain:'brute',resist:{physical:0.5,fire:1.5},traits:'Сильный грибной страж. Прикройте цель замаха или поставьте барьер.'},
 {id:'goblin_03',name:'Гоблин',nameAcc:'Гоблина',side:'enemy',maxHp:18,maxMp:0,speed:6,abilities:['slingshot'],brain:'goblin',traits:'Добивает раненых. Опасен вместе с громилой.'},
 {id:'sprout_03',name:'Гриб-лекарь',nameAcc:'Гриба-лекаря',side:'enemy',maxHp:18,maxMp:0,speed:5,abilities:['mend8','spores3'],brain:'sprout',traits:'Лечит врагов на 8. Лучше убрать его первым.'},
];
export function registerOpening(): void {
  for (const a of extras) ABILITIES[a.id] = a;
  for (const u of defs) UNIT_BY_ID[u.id] = u;
}
registerOpening();

export interface Encounter { id: number; title: string; caption: string; background: string; enemies: string[]; party: HeroId[]; gold: number; repeatGold: number; join: HeroId[]; hint: string; }
export const ENCOUNTERS: Encounter[] = [
 {id:1,title:'Опушка',caption:'Первое поручение',background:'cg/approved/backgrounds/forest_1',enemies:['goblin_01'],party:['stark'],gold:30,repeatGold:0,join:['frieren','fern'],hint:'Выбери «Удар», затем нажми «Применить». Единственная цель уже выбрана.'},
 {id:2,title:'Лесная тропа',caption:'Сила отряда',background:'cg/approved/backgrounds/forest_2',enemies:['goblin_02','brute_02'],party:['stark','frieren','fern'],gold:60,repeatGold:0,join:['megumin','goblin_slayer'],hint:'Броня громилы ослабляет физические удары. Магия Фрирен и Ферн проходит сквозь неё.'},
 {id:3,title:'Старый шлюз',caption:'Дорога должна быть открыта',background:'cg/approved/backgrounds/forest_3',enemies:['guard_03','goblin_03','sprout_03'],party:['stark','frieren','fern','megumin','goblin_slayer'],gold:90,repeatGold:20,join:[],hint:'Гриб-лекарь восстанавливает врагам здоровье. Уберите его первым и следите за целью замаха.'},
];
export const ENEMY_TEXTURES: Record<string,string> = {goblin_01:'cg/approved/enemies/goblin_2',goblin_02:'cg/approved/enemies/goblin_2',brute_02:'cg/approved/enemies/brute_1',guard_03:'cg/approved/enemies/brute_3',goblin_03:'cg/approved/enemies/goblin_2',sprout_03:'cg/approved/enemies/healer_2'};
export const ICONS: Record<string,string> = {sword:'assets/chatgpt/approved/icons/attack_1.png',fire:'assets/chatgpt/approved/icons/fire_3.png',shield:'assets/chatgpt/approved/icons/shield_1.png',potion:'assets/chatgpt/approved/icons/potion_1.png',bow:'assets/chatgpt/opening/bow.png'};
