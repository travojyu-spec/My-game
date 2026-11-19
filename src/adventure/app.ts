import { ability, advance, checkAbility, createBattle, currentUnitId, def, enemyDecide, perform, preview, startBattle, upcomingTurns } from '../battle/engine';
import type { Action, BattleEvent, BattleState } from '../battle/types';
import { assetUrl } from '../core/assets';
import { canFullscreen, toggleFullscreen } from '../core/screen';
import { loadSettings, saveSettings } from '../core/settings';
import { sfx } from '../core/sfx';
import { awardVictory, beginAttempt, cancelAttempt, hire, loadCampaign, newCampaign, saveCampaign, setParty, type Campaign } from './campaign';
import { ENCOUNTERS, HEROES, HERO_IDS, ICONS, type HeroId } from './content';
import type { AdventureScene, ArtCatalog, UnitPoint } from './scene';

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
type Panel='none'|'inn'|'roster'|'quests'|'menu'|'reset'|'victory'|'defeat';
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

export class AdventureApp {
  private campaign:Campaign=loadCampaign();
  private battle:BattleState|null=null;
  private encounter=1;
  private selected='';private target='';private busy=false;private paused=false;
  private generation=0;
  private panel:Panel='none';
  private points:UnitPoint[]=[];
  private notice='';
  private outcome:{gold:number;joined:HeroId[];first:boolean}|null=null;
  private lastAction='';
  private scene!:AdventureScene;
  private ui:HTMLElement;
  private modal:HTMLElement;
  private targets:HTMLElement;
  constructor(private catalog:ArtCatalog){
    this.ui=document.getElementById('ui')!;this.modal=document.getElementById('modal')!;this.targets=document.getElementById('targets')!;
    document.addEventListener('click',e=>this.click(e));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.panel!=='none'&&!['victory','defeat'].includes(this.panel))this.close();});
    window.addEventListener('resize',()=>this.layout());
    window.visualViewport?.addEventListener('resize',()=>this.layout());
    document.addEventListener('visibilitychange',()=>{if(document.hidden){sfx.pageHidden();if(this.battle?.result==='ongoing'){this.paused=true;this.panel='menu';this.render();}}else sfx.pageVisible();});
  }
  ready(scene:AdventureScene):void {this.scene=scene;document.getElementById('boot')!.classList.add('done');this.hub();}
  setPoints(points:UnitPoint[]):void {this.points=points;this.renderTargets();}
  private persist():void {saveCampaign(this.campaign);}
  private heroImage(id:HeroId):string{return assetUrl(this.catalog.heroes.find(h=>h.id===id)!.url);}
  private coin():string{return `<img class="coin" src="${assetUrl('assets/chatgpt/opening/gold.png')}" alt="">`;}
  private hub():void {
    this.generation++;this.battle=null;this.busy=false;this.paused=false;this.panel='none';this.notice='';this.outcome=null;
    this.scene.showHub(this.campaign.party);this.render();this.layout();
  }
  private layout():void {
    if(!this.scene)return;
    const top=document.getElementById('topbar')?.getBoundingClientRect().bottom??48;
    const bottom=document.getElementById('bottom')?.getBoundingClientRect().height??138;
    this.scene.resize(window.innerWidth,window.innerHeight,top,bottom+8);
  }
  private topbar():string {
    const where=this.battle?ENCOUNTERS[this.encounter-1].title:'Привал у ручья';
    return `<header id="topbar"><div class="location"><span class="eyebrow">${this.battle?`БОЙ · РАУНД ${this.battle.round}`:'ЛЕСНАЯ ДОРОГА'}</span><strong>${where}</strong></div><div class="chapter-dots" aria-label="Пройдено поручений: ${this.campaign.completed} из 3">${[1,2,3].map(n=>`<span class="${n<=this.campaign.completed?'done':''}">${n}</span>`).join('<i></i>')}</div><div class="gold">${this.coin()}<b>${this.campaign.gold}</b></div><button class="small" data-action="sound" aria-label="${sfx.enabled?'Выключить':'Включить'} звук">Звук ${sfx.enabled?'вкл':'выкл'}</button>${canFullscreen()?'<button class="small fullscreen" data-action="fullscreen" aria-label="Во весь экран">⛶</button>':''}<button class="small" data-action="menu">Меню</button></header>`;
  }
  private render():void {
    this.ui.innerHTML=this.topbar()+(this.battle?this.battleUI():this.hubUI());
    this.renderTargets();this.renderPanel();
    if(this.battle)this.scene.sync(this.battle,currentUnitId(this.battle),this.target);
  }
  private hubUI():string {
    const n=Math.min(3,this.campaign.completed+1),e=ENCOUNTERS[n-1];
    const text=this.campaign.completed===0?'Гоблин не пускает путников к ручью. Старк берётся расчистить дорогу.':this.campaign.completed===1?'Фрирен и Ферн идут с вами. На тропе замечен бронированный грибной громила.':this.campaign.completed===2?'Мэгумин и Убийца гоблинов присоединились к отряду. Осталось освободить старый шлюз.':'Дорога открыта. В таверну пришли две наёмницы. Соберите отряд и возьмите новый контракт.';
    return `<section id="bottom" class="hub-panel parchment"><div class="quest-copy"><span class="eyebrow">${this.campaign.completed<3?`ПОРУЧЕНИЕ ${n} ИЗ 3`:'ПЕРВАЯ ГЛАВА ПРОЙДЕНА'}</span><h1>${this.campaign.completed<3?e.title:'Дорога открыта'}</h1><p>${text}</p></div><div class="hub-actions"><button class="primary" data-action="start" data-id="${n}">${this.campaign.completed<3?'В путь':'Контракт на шлюзе'} <span>+${this.campaign.completed<3?e.gold:20} зол.</span></button><div class="secondary-actions"><button data-action="inn">Таверна</button><button data-action="roster">Отряд ${this.campaign.party.length}/5</button><button data-action="quests">Поручения</button></div><small>Здоровье и мана восстановлены · прогресс сохраняется</small></div></section>`;
  }
  private chooseDefaults():void {
    if(!this.battle)return;const actor=currentUnitId(this.battle);if(!actor)return;
    const choices=def(actor).abilities.filter(id=>this.encounter!==1||id==='axe');
    if(!choices.includes(this.selected)||!checkAbility(this.battle,actor,this.selected).ok)this.selected=choices.find(id=>checkAbility(this.battle!,actor,id).ok)??choices[0];
    const check=checkAbility(this.battle,actor,this.selected);
    if(check.ok&&!check.targets.includes(this.target))this.target=check.targets[0];
  }
  private battleUI():string {
    const b=this.battle!,actor=currentUnitId(b);if(!actor)return '';
    const hero=def(actor).side==='hero',can=hero&&!this.busy&&!this.paused&&b.result==='ongoing';
    const choices=def(actor).abilities.filter(id=>this.encounter!==1||id==='axe');
    const a=ability(this.selected);const check=hero&&a?checkAbility(b,actor,a.id):null;
    const action:Action={actor,ability:this.selected,target:this.target};
    let detail=hero&&a?a.text:'Противник готовит действие…';
    let result='';
    if(hero&&check?.ok&&check.targets.includes(this.target)){
      const p=preview(b,action);
      result=a.effect.kind==='damage'&&a.effect.all?'Все враги':`${def(this.target).name}${p.kind==='guard'?' · защита':` · ${p.kind==='heal'?'+':'−'}${p.amount} HP`}`;
    }else if(check&&!check.ok)detail=check.reason;
    const enemies=Object.values(b.units).filter(u=>u.alive&&u.windupTarget);
    const warn=enemies.map(u=>`${def(u.id).name} замахнулся на ${def(u.windupTarget!).nameAcc}!`).join(' ');
    const order=upcomingTurns(b,5).map(id=>`<span class="${id===actor?'current':''}">${def(id).name}</span>`).join('<i>›</i>');
    return `<div class="battle-message" role="status">${esc(warn||this.lastAction||ENCOUNTERS[this.encounter-1].hint)}</div><section id="bottom" class="battle-panel parchment"><div class="turn-line"><strong>${hero?'Ходит':'Ход врага:'} ${def(actor).name}</strong><div class="turn-order" aria-label="Очередь ходов">${order}</div><button class="small" data-action="help">?</button></div><div class="battle-controls"><div class="abilities">${choices.map(id=>{const a=ability(id),check=checkAbility(b,actor,id);return `<button class="ability ${this.selected===id?'selected':''}" data-action="ability" data-id="${id}" ${!can||!check.ok?'disabled':''} title="${esc(check.ok?a.text:check.reason)}"><img src="${assetUrl(ICONS[a.icon])}" alt=""><span>${a.label}<small>${a.cost?`${a.cost} маны`:'Без маны'}</small></span></button>`;}).join('')}</div><div class="ability-description"><p>${esc(detail)}</p><strong>${result}</strong></div><button class="primary apply" data-action="apply" ${!can||!check?.ok?'disabled':''}>${this.busy?'Действие…':'Применить'}</button></div></section>`;
  }
  private renderTargets():void {
    const b=this.battle;if(!b){this.targets.innerHTML='';return;}
    const actor=currentUnitId(b),hero=actor&&def(actor).side==='hero',check=hero&&this.selected?checkAbility(b,actor,this.selected):null;
    const targets=check?.ok?check.targets:[];
    this.targets.innerHTML=this.points.map(p=>{
      const u=b.units[p.id],d=def(p.id);if(!u)return '';
      const choose=targets.includes(p.id)&&!this.busy&&!this.paused&&b.result==='ongoing';
      return `<button class="unit-target ${d.side} ${this.target===p.id&&choose?'chosen':''} ${!u.alive?'fallen':''} ${p.id===actor?'acting':''}" data-action="target" data-id="${p.id}" aria-label="${d.name}: ${u.hp} из ${d.maxHp} здоровья${choose?', выбрать цель':''}" ${!choose?'disabled':''} style="left:${p.x}px;top:${p.top}px;width:${Math.max(d.side==='hero'?88:100,p.width)}px;height:${p.y-p.top+32}px"><span class="unit-label"><b>${d.name}</b><span class="bars"><span class="hp-track"><i style="width:${u.hp/d.maxHp*100}%"></i></span>${d.side==='hero'?`<span class="mp-track"><i style="width:${u.mp/d.maxMp*100}%"></i></span>`:''}</span><small>${!u.alive?'Без сознания':u.exhausted?'Отдыхает':`${u.hp}/${d.maxHp}${d.maxMp?` · ${u.mp} MP`:''}${u.barrier||u.guardedBy?' · щит':''}`}</small></span></button>`;
    }).join('');
  }
  private card(id:HeroId):string {
    const h=HEROES[id],d=def(id),owned=this.campaign.unlocked.includes(id),active=this.campaign.party.includes(id);
    let control='';
    if(this.panel==='inn')control=owned?'<span class="owned">В вашем отряде</span>':`<button class="primary" data-action="hire" data-id="${id}" ${this.campaign.completed<3||this.campaign.gold<h.price!?'disabled':''}>Нанять · ${h.price} зол.</button>`;
    else control=this.campaign.completed<3?'<span class="owned">В основном отряде</span>':`<button data-action="party" data-id="${id}" ${active&&this.campaign.party.length===1?'disabled':''}>${active?'В резерв':'В отряд'}</button>`;
    return `<article class="hero-card ${active?'in-party':''}"><div class="hero-preview"><img src="${this.heroImage(id)}" alt="${d.name}, вид со спины"></div><div class="hero-info"><h3>${d.name}</h3><small>${h.role}</small><p>${d.traits}</p><span class="hero-stats">${d.maxHp} HP · ${d.maxMp} MP · скорость ${d.speed}</span>${control}</div></article>`;
  }
  private renderPanel():void {
    if(this.panel==='none'){this.modal.hidden=true;this.modal.innerHTML='';return;}
    this.modal.hidden=false;
    let title='',body='',actions='';
    if(this.panel==='inn'){
      title='Таверна у ручья';
      body=`<p>${this.campaign.completed<3?'Наёмницы придут, когда дорога до шлюза будет свободна. Основные спутники присоединяются бесплатно по сюжету.':'Разовый наём за игровое золото. Героиня останется с вами навсегда; при полном отряде будет ждать в резерве.'}</p><div class="hire-grid">${this.card('nara')}${this.card('mira')}</div>`;
    }else if(this.panel==='roster'){
      title=`Ваш отряд · ${this.campaign.party.length}/5`;
      body=`<p>${this.campaign.completed<3?'Основные спутники присоединятся после побед. Пять главных героев бесплатны.':'Выберите до пяти бойцов. На следующий контракт идут герои из активного отряда; остальные остаются в резерве.'}</p><div class="roster-grid">${HERO_IDS.filter(id=>this.campaign.unlocked.includes(id)).map(id=>this.card(id)).join('')}</div>`;
    }else if(this.panel==='quests'){
      title='Доска поручений';body=`<div class="quest-list">${ENCOUNTERS.map(e=>`<article><span class="quest-number">${e.id}</span><div><h3>${e.title}</h3><p>${e.caption}</p><small>${e.id<=this.campaign.completed?`Пройдено · повтор: ${e.repeatGold} зол.`:`Награда: ${e.gold} зол.`}</small></div><button data-action="start" data-id="${e.id}" ${e.id>this.campaign.completed+1?'disabled':''}>${e.id<=this.campaign.completed?'Повторить':'В путь'}</button></article>`).join('')}</div>`;
    }else if(this.panel==='menu'){
      title=this.battle?'Привал · пауза':'Лесная дорога';body=`<p>${this.battle?'Бой приостановлен. Возвращение в привал начнёт это поручение заново, без потери золота.':'Первая глава: три боя, пять основных спутников и две наёмницы.'}</p>`;
      actions=`<button class="primary" data-action="close">${this.battle?'Продолжить бой':'Продолжить'}</button>${this.battle?'<button data-action="hub">Вернуться в привал</button>':''}<button data-action="reset">Новая игра</button>`;
    }else if(this.panel==='reset'){
      title='Начать заново?';body='<p>Поручения, нанятые герои и золото этой игры будут сброшены.</p>';actions='<button data-action="close">Отмена</button><button data-action="reset-confirm">Начать новую игру</button>';
    }else if(this.panel==='victory'){
      const o=this.outcome!;title=this.encounter===3&&o.first?'Дорога открыта!':'Победа!';
      const line=o.joined.length?`${o.joined.map(id=>def(id).name).join(' и ')} присоединяются бесплатно.`:this.encounter===3?'В таверне доступны Нара и Мира. Повторный контракт приносит 20 золотых.':'Поручение выполнено.';
      body=`<div class="reward">${this.coin()} +${o.gold} золота</div><p>${line}</p>${o.joined.length?`<div class="joined">${o.joined.map(id=>`<figure><img src="${this.heroImage(id)}" alt=""><figcaption>${def(id).name}</figcaption></figure>`).join('')}</div>`:''}<p class="muted">В привале здоровье и мана полностью восстановятся.</p>`;
      actions=`<button class="primary" data-action="hub">${this.encounter===3?'Вернуться в привал':'К спутникам и следующему поручению'}</button>`;
    }else if(this.panel==='defeat'){
      title='Отряд отступает';body='<p>Путники помогли вернуться к ручью. Золото и спутники сохранены. Попробуйте убрать лекаря первым и защитить цель замаха.</p>';actions=`<button class="primary" data-action="start" data-id="${this.encounter}">Попробовать ещё раз</button><button data-action="hub">В привал</button>`;
    }
    const terminal=['victory','defeat','reset'].includes(this.panel);
    this.modal.innerHTML=`<section class="dialog parchment" role="dialog" aria-modal="true" aria-label="${title}"><header><h2>${title}</h2>${!terminal?'<button class="small" data-action="close" aria-label="Закрыть">Закрыть ×</button>':''}</header><div class="dialog-scroll">${body}${this.notice?`<p class="notice" role="status">${esc(this.notice)}</p>`:''}</div><footer>${actions||'<button data-action="close">Вернуться в привал</button>'}</footer></section>`;
  }
  private close():void {this.panel='none';this.notice='';this.paused=false;this.render();this.layout();}
  private async start(id:number):Promise<void> {
    if(id>this.campaign.completed+1||!ENCOUNTERS[id-1])return;
    this.generation++;this.campaign=beginAttempt(cancelAttempt(this.campaign),id);this.persist();
    this.encounter=id;this.panel='none';this.paused=false;this.busy=false;this.selected='';this.target='';this.notice='';this.outcome=null;this.lastAction='';
    const e=ENCOUNTERS[id-1],party=this.campaign.completed===3?this.campaign.party:e.party;
    this.battle=createBattle(Date.now(),[...party,...e.enemies].map(def));startBattle(this.battle);
    this.chooseDefaults();this.scene.showBattle(id,this.battle);this.render();this.layout();
    await this.drive(this.generation);
  }
  private async gate(generation:number):Promise<boolean> {
    while(generation===this.generation&&(this.paused||document.hidden||window.innerHeight>window.innerWidth))await delay(100);
    return generation===this.generation;
  }
  private async drive(generation:number):Promise<void> {
    if(!await this.gate(generation)||!this.battle)return;
    if(this.battle.result!=='ongoing'){this.finish();return;}
    const actor=currentUnitId(this.battle)!;
    if(def(actor).side==='hero'){this.busy=false;this.selected='';this.chooseDefaults();sfx.play('turn');this.render();return;}
    this.busy=true;this.render();await delay(500);
    if(!await this.gate(generation)||!this.battle)return;
    await this.execute(enemyDecide(this.battle,actor),generation);
  }
  private sounds(events:BattleEvent[]):void {
    const use=events.find(e=>e.type==='use');
    if(use?.type==='use'){const fx=ability(use.ability).fx;sfx.play(fx==='fireball'?'fire':fx==='heal'?'heal':fx==='guard'?'guard':fx==='arrow'?'arrow':fx==='slam'?'heavy':'hit');}
    if(events.some(e=>e.type==='windup'))sfx.play('windup');
  }
  private async execute(action:Action,generation:number):Promise<void> {
    if(!this.battle||generation!==this.generation)return;
    this.busy=true;
    const events=perform(this.battle,action);if(!events.length){this.busy=false;this.render();return;}
    const a=ability(action.ability);
    const hit=events.filter(e=>e.type==='damage'||e.type==='heal').map(e=>`${def(e.target).name}: ${e.type==='heal'?'+':'−'}${e.amount}`).join(' · ');
    this.lastAction=`${def(action.actor).name} — ${a.name}${hit?` · ${hit}`:''}`;
    this.sounds(events);this.render();await this.scene.animate(events);
    if(!await this.gate(generation)||!this.battle)return;
    if(this.battle.result!=='ongoing'){this.finish();return;}
    advance(this.battle);this.chooseDefaults();this.render();await this.drive(generation);
  }
  private finish():void {
    if(!this.battle||this.panel==='victory'||this.panel==='defeat')return;
    this.busy=false;
    if(this.battle.result==='victory'){
      const o=awardVictory(this.campaign,this.campaign.attempt?.token??'');this.campaign=o.campaign;this.outcome=o;this.persist();this.panel='victory';sfx.play('victory');
    }else{this.campaign=cancelAttempt(this.campaign);this.persist();this.panel='defeat';sfx.play('defeat');}
    this.render();
  }
  private click(e:MouseEvent):void {
    const el=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');if(!el||el.disabled)return;
    const act=el.dataset.action!,id=el.dataset.id!;sfx.unlock();sfx.play('tap');
    if(act==='sound'){sfx.enabled=!sfx.enabled;saveSettings({...loadSettings(),sound:sfx.enabled});this.render();}
    else if(act==='fullscreen')toggleFullscreen();
    else if(act==='start')void this.start(Number(id));
    else if(act==='hub'){this.campaign=cancelAttempt(this.campaign);this.persist();this.hub();}
    else if(act==='close')this.close();
    else if(act==='menu'){this.panel='menu';this.paused=!!this.battle;this.render();}
    else if(act==='reset'){this.panel='reset';this.render();}
    else if(act==='reset-confirm'){this.campaign=newCampaign();this.persist();this.hub();}
    else if(act==='inn'||act==='roster'||act==='quests'){if(this.battle)return;this.panel=act;this.notice='';this.render();}
    else if(act==='help'){this.panel='menu';this.paused=true;this.renderPanel();const body=this.modal.querySelector('.dialog-scroll');if(body)body.innerHTML=`<p>${ENCOUNTERS[this.encounter-1].hint}</p><p>Нажмите на способность, затем на цель и «Применить». В начале хода восстанавливается 1 мана. Щит смягчает удар, а огонь особенно силён против грибов.</p>`;}
    else if(act==='ability'&&this.battle&&!this.busy&&!this.paused){this.selected=id;this.chooseDefaults();this.render();}
    else if(act==='target'&&this.battle&&!this.busy&&!this.paused){this.target=id;this.render();}
    else if(act==='apply'&&this.battle&&!this.busy&&!this.paused){const actor=currentUnitId(this.battle);if(actor&&def(actor).side==='hero')void this.execute({actor,ability:this.selected,target:this.target},this.generation);}
    else if(act==='hire'){
      try{this.campaign=hire(this.campaign,id as HeroId);this.persist();this.notice=`${def(id).name} нанята. ${this.campaign.party.includes(id as HeroId)?'В активном отряде.':'В резерве — добавьте её через «Отряд».'}`;sfx.play('select');}catch(err){this.notice=(err as Error).message;}
      this.render();
    }else if(act==='party'){
      try{const hero=id as HeroId,party=this.campaign.party.includes(hero)?this.campaign.party.filter(i=>i!==hero):[...this.campaign.party,hero];this.campaign=setParty(this.campaign,party);this.persist();this.notice='Состав отряда сохранён.';this.scene.showHub(this.campaign.party);}catch(err){this.notice=(err as Error).message;}
      this.render();
    }
  }
}
