import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ability, advance, checkAbility, createBattle, currentUnitId, def, enemyDecide, living, perform, preview, startBattle } from '../src/battle/engine';
import { awardVictory, beginAttempt, hire, newCampaign, sanitizeCampaign, setParty } from '../src/adventure/campaign';
import { ENCOUNTERS, type HeroId } from '../src/adventure/content';
import type { BattleState } from '../src/battle/types';

function play(encounter:number,seed:number,party?:HeroId[]):BattleState{
  const e=ENCOUNTERS[encounter-1],b=createBattle(seed,[...(party??e.party),...e.enemies].map(def));startBattle(b);
  for(let n=0;n<250&&b.result==='ongoing';n++){
    const actor=currentUnitId(b)!;
    if(def(actor).side==='enemy')assert.ok(perform(b,enemyDecide(b,actor)).length);
    else{
      // A simple offensive strategy: healer first, goblin second, then the armoured enemy.
      const target=living(b,'enemy').sort((a,z)=>(a.id.startsWith('sprout')?0:a.id.startsWith('goblin')?1:2)-(z.id.startsWith('sprout')?0:z.id.startsWith('goblin')?1:2))[0].id;
      const options=def(actor).abilities.filter(id=>(encounter!==1||id==='axe')&&checkAbility(b,actor,id).ok&&ability(id).effect.kind==='damage');
      options.sort((x,y)=>preview(b,{actor,ability:y,target}).amount-preview(b,{actor,ability:x,target}).amount);
      const act={actor,ability:options[0],target};assert.ok(perform(b,act).length);
    }
    for(const u of Object.values(b.units)){assert.ok(u.hp>=0&&u.hp<=def(u.id).maxHp);assert.ok(u.mp>=0&&u.mp<=def(u.id).maxMp);}
    if(b.result==='ongoing')advance(b);
  }
  assert.equal(b.result,'victory',`Encounter ${encounter}, seed ${seed}`);return b;
}
for(let seed=1;seed<=100;seed++)for(let encounter=1;encounter<=3;encounter++)play(encounter,seed);
const final=play(3,9);assert.ok(final.units.megumin.exhausted);assert.equal(final.units.megumin.mp,0);

let c=newCampaign();assert.deepEqual(c.party,['stark']);assert.throws(()=>hire(c,'nara'));assert.throws(()=>beginAttempt(c,3));
for(let id=1;id<=3;id++){
 c=beginAttempt(c,id,`test-${id}`);const reward=awardVictory(c,`test-${id}`);c=reward.campaign;
 assert.equal(reward.gold,ENCOUNTERS[id-1].gold);assert.equal(awardVictory(c,`test-${id}`).gold,0);
 assert.deepEqual(sanitizeCampaign(JSON.parse(JSON.stringify(c))),c);
}
assert.equal(c.gold,180);assert.equal(c.party.length,5);assert.equal(c.unlocked.length,5);
c=hire(c,'nara');assert.equal(c.gold,90);assert.equal(c.party.length,5);assert.ok(c.unlocked.includes('nara'));assert.throws(()=>hire(c,'nara'));assert.throws(()=>hire(c,'mira'));
c=setParty(c,['stark','frieren','fern','megumin','nara']);assert.throws(()=>setParty(c,[]));assert.throws(()=>setParty(c,['nara','nara']));assert.throws(()=>setParty(c,['mira']));
for(let i=0;i<2;i++){c=beginAttempt(c,3,`repeat-${i}`);c=awardVictory(c,`repeat-${i}`).campaign;}
c=hire(c,'mira');assert.equal(c.gold,10);assert.equal(c.unlocked.length,7);
play(3,71,['stark','frieren','fern','nara','mira']);
assert.deepEqual(sanitizeCampaign({version:999}),newCampaign());assert.equal(sanitizeCampaign({...c,gold:-9}).gold,0);

const b=createBattle(1,['frieren','goblin_02'].map(def));startBattle(b);
const before=JSON.stringify(b);assert.deepEqual(perform(b,{actor:'goblin_02',ability:'slingshot',target:'frieren'}),[]);assert.equal(JSON.stringify(b),before);
perform(b,{actor:'frieren',ability:'barrier',target:'frieren'});advance(b);
const wardHp=b.units.frieren.hp;perform(b,{actor:'goblin_02',ability:'slingshot',target:'frieren'});assert.equal(wardHp-b.units.frieren.hp,3);assert.equal(b.units.frieren.barrier,false);
const cover=createBattle(2,['goblin_slayer','fern','goblin_02'].map(def));startBattle(cover);advance(cover);
assert.equal(currentUnitId(cover),'goblin_slayer');perform(cover,{actor:'goblin_slayer',ability:'cover',target:'fern'});advance(cover);
const fernHp=cover.units.fern.hp,guardHp=cover.units.goblin_slayer.hp;
perform(cover,{actor:'goblin_02',ability:'slingshot',target:'fern'});assert.equal(cover.units.fern.hp,fernHp);assert.equal(guardHp-cover.units.goblin_slayer.hp,3);assert.equal(cover.units.fern.guardedBy,null);

const catalog=JSON.parse(readFileSync('public/assets/chatgpt/manifest.json','utf8'));
for(const i of catalog.images){const bytes=readFileSync(`public/${i.url}`);assert.equal(createHash('sha256').update(bytes).digest('hex'),i.sha256);}
for(const h of catalog.heroes)assert.deepEqual(readFileSync(h.master),readFileSync(h.file));
console.log('PASS: 300 seeded chapter battles, paid heroes, rewards / saves / party, invalid actions, barrier / cover, 42 original image hashes.');
