import { ENCOUNTERS, HEROES, HERO_IDS, type HeroId } from './content';

const KEY = 'my-game/campaign/v1';
export interface Attempt { token: string; encounter: number; }
export interface Campaign { version: 1; completed: number; gold: number; unlocked: HeroId[]; party: HeroId[]; claims: number[]; attempt: Attempt | null; }
export function newCampaign(): Campaign { return {version:1,completed:0,gold:0,unlocked:['stark'],party:['stark'],claims:[],attempt:null}; }
function core(completed:number): HeroId[] { return ['stark',...(completed>=1?['frieren','fern']:[]),...(completed>=2?['megumin','goblin_slayer']:[])] as HeroId[]; }
export function sanitizeCampaign(raw: unknown): Campaign {
  if (!raw || typeof raw!=='object' || (raw as Campaign).version!==1) return newCampaign();
  const d=raw as Partial<Campaign>;
  const claims=Array.isArray(d.claims)?[1,2,3].filter(x=>d.claims!.includes(x)):[];
  let completed=0;while(claims.includes(completed+1)&&completed<3)completed++;
  const baseline=core(completed);
  const paid=completed===3&&Array.isArray(d.unlocked)?d.unlocked.filter(id=>id==='nara'||id==='mira'):[];
  const unlocked=[...new Set([...baseline,...paid])];
  const selected=Array.isArray(d.party)?[...new Set(d.party)].filter(id=>HERO_IDS.includes(id)&&unlocked.includes(id)).slice(0,5):[];
  const party=completed<3?baseline:selected.length?selected:baseline;
  const gold=typeof d.gold==='number'&&Number.isFinite(d.gold)?Math.max(0,Math.min(1000000,Math.floor(d.gold))):0;
  const a=d.attempt;
  const attempt=a&&typeof a.token==='string'&&a.token.length>0&&a.token.length<100&&Number.isInteger(a.encounter)&&a.encounter>=1&&a.encounter<=Math.min(3,completed+1)?a:null;
  return {version:1,completed,gold,unlocked,party,claims:[1,2,3].slice(0,completed),attempt};
}
export function loadCampaign(): Campaign { try {return sanitizeCampaign(JSON.parse(localStorage.getItem(KEY)??'null'));}catch{return newCampaign();} }
export function saveCampaign(c: Campaign): void { try {localStorage.setItem(KEY,JSON.stringify(c));}catch{/* In-memory play remains available. */} }
export function beginAttempt(c: Campaign, encounter:number, token:string=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`): Campaign {
  if(!ENCOUNTERS[encounter-1]||encounter>c.completed+1)throw Error('Поручение пока недоступно.');
  if(c.attempt?.encounter===encounter)return c;
  return {...c,attempt:{token,encounter}};
}
export function awardVictory(c: Campaign, token:string): {campaign:Campaign;gold:number;joined:HeroId[];first:boolean} {
  const a=c.attempt;
  if(!a||a.token!==token)return {campaign:c,gold:0,joined:[],first:false};
  const encounter=ENCOUNTERS[a.encounter-1];
  const first=!c.claims.includes(a.encounter);
  if(first&&a.encounter!==c.completed+1)throw Error('Нарушен порядок поручений.');
  const gold=first?encounter.gold:encounter.repeatGold;
  const joined=first?encounter.join.filter(id=>!c.unlocked.includes(id)):[];
  const unlocked=[...new Set([...c.unlocked,...joined])];
  const completed=first?Math.max(c.completed,a.encounter):c.completed;
  const party=first?core(completed):c.party;
  return {campaign:{...c,completed,gold:c.gold+gold,unlocked,party,claims:first?[...c.claims,a.encounter]:c.claims,attempt:null},gold,joined,first};
}
export function cancelAttempt(c:Campaign): Campaign { return {...c,attempt:null}; }
export function hire(c:Campaign,id:HeroId): Campaign {
  const price=HEROES[id]?.price;
  if(!price||c.completed<3)throw Error('Наём откроется после расчистки шлюза.');
  if(c.unlocked.includes(id))throw Error('Уже в вашем отряде.');
  if(c.gold<price)throw Error(`Не хватает ${price-c.gold} золота.`);
  return {...c,gold:c.gold-price,unlocked:[...c.unlocked,id],party:c.party.length<5?[...c.party,id]:c.party};
}
export function setParty(c:Campaign,party:HeroId[]): Campaign {
  if(c.completed<3)throw Error('Основные спутники присоединяются по сюжету.');
  if(party.length<1||party.length>5||new Set(party).size!==party.length||party.some(id=>!c.unlocked.includes(id)))throw Error('В отряде может быть от одного до пяти доступных героев.');
  return {...c,party:[...party]};
}
