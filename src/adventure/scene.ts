import Phaser from 'phaser';
import { assetUrl, type ManifestImage } from '../core/assets';
import { def } from '../battle/engine';
import type { BattleEvent, BattleState } from '../battle/types';
import { ENCOUNTERS, ENEMY_TEXTURES, HEROES, type HeroId } from './content';

interface Geometry { width:number; height:number; origin_x:number; origin_y:number; opaque_bounds:{x:number;y:number;width:number;height:number}; }
export interface ArtCatalog { images:ManifestImage[]; heroes:(Geometry & {id:string;texture:string;url:string})[]; opening_objects:Record<string,Geometry>; }
export interface UnitPoint { id:string;x:number;y:number;top:number;width:number; }
interface Figure { image:Phaser.GameObjects.Image; shadow:Phaser.GameObjects.Ellipse; ring:Phaser.GameObjects.Ellipse; x:number;y:number; }

/** The canvas is the world. All controls and target hit areas are accessible HTML. */
export class AdventureScene extends Phaser.Scene {
  private layer!:Phaser.GameObjects.Container;
  private figures=new Map<string,Figure>();
  private mode:'hub'|'battle'='hub';
  private party:HeroId[]=['stark'];
  private encounter=1;
  private battle:BattleState|null=null;
  private active:string|null=null;
  private target:string|null=null;
  private w=0; private h=0; private dpr=1;
  private top=48; private bottom=138;
  private ready=false;
  constructor(private catalog:ArtCatalog,private onReady:()=>void,private onPoints:(points:UnitPoint[])=>void){super('Adventure');}
  preload():void {
    for(const i of this.catalog.images)this.load.image(i.key,assetUrl(i.url));
    this.load.on('progress',(v:number)=>{const e=document.getElementById('boot-text');if(e)e.textContent=`Разворачиваем карту… ${Math.round(v*100)}%`;});
    this.load.on('loaderror',()=>{const e=document.getElementById('boot-text');if(e)e.textContent='Не удалось загрузить рисунок. Обновите страницу.';});
  }
  create():void {
    for(const i of this.catalog.images)if(i.width<500)this.textures.get(i.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.layer=this.add.container();this.ready=true;
    this.onReady();
  }
  resize(w:number,h:number,top:number,bottom:number):void {
    this.w=w;this.h=h;this.top=top;this.bottom=bottom;
    this.dpr=Math.min(window.devicePixelRatio||1,2);
    if(!this.ready)return;
    this.scale.zoom=1/this.dpr;this.scale.resize(Math.round(w*this.dpr),Math.round(h*this.dpr));
    this.game.canvas.style.width=`${w}px`;this.game.canvas.style.height=`${h}px`;this.scale.updateBounds();
    this.draw();
  }
  showHub(party:HeroId[]):void {this.mode='hub';this.party=party;this.battle=null;if(this.ready)this.draw();}
  showBattle(encounter:number,battle:BattleState):void {this.mode='battle';this.encounter=encounter;this.battle=battle;if(this.ready)this.draw();}
  sync(battle:BattleState,active:string|null,target:string|null):void {
    this.battle=battle;this.active=active;this.target=target;
    for(const [id,f] of this.figures){const u=battle.units[id];if(!u)continue;f.image.setAlpha(!u.alive?0.18:u.exhausted?0.6:1);f.shadow.setAlpha(u.alive?0.22:0.06);f.ring.setVisible(u.alive&&(id===active||id===target));f.ring.setStrokeStyle(2,id===target?0xf3c969:0xa7dfad,0.95);}
  }
  private image(key:string,x:number,y:number,height:number,geometry?:Geometry):Phaser.GameObjects.Image {
    const im=this.add.image(x,y,key);this.layer.add(im);
    if(geometry){im.setOrigin(geometry.origin_x,geometry.origin_y).setScale(height/geometry.opaque_bounds.height);}
    else {im.setOrigin(0.5,1).setScale(height/im.height);}
    return im;
  }
  private prop(name:string,x:number,y:number,height:number):void {this.image(`cg/opening/${name}`,x,y,height,this.catalog.opening_objects[name]);}
  private draw():void {
    if(!this.w||!this.h)return;
    this.tweens.killAll();this.layer.removeAll(true);this.layer.setScale(this.dpr);this.figures.clear();
    const key=this.mode==='hub'?'cg/opening/hub_ground':ENCOUNTERS[this.encounter-1].background;
    const bg=this.add.image(this.w/2,this.h/2,key);bg.setScale(Math.max(this.w/bg.width,this.h/bg.height));this.layer.add(bg);
    const aTop=this.top+(this.mode==='battle'?30:8),aBottom=this.h-this.bottom,area=Math.max(110,aBottom-aTop);
    if(this.mode==='hub'){
      this.prop('inn',this.w*0.24,aTop+area*0.61,Math.min(area*0.84,this.w*0.36));
      this.prop('quest_board',this.w*0.77,aTop+area*0.65,Math.min(area*0.46,this.w*0.2));
      const n=this.party.length,span=Math.min(this.w*0.66,n*130),slot=span/n;
      this.party.forEach((id,i)=>this.figure(id,this.w/2-span/2+slot*(i+0.5),aBottom-6,Math.min(area*0.4,slot*1.25),false));
      this.onPoints([]);
    } else if(this.battle){
      if(this.encounter===2)this.image('cg/approved/props/crossing_1',this.w*0.18,aTop+area*0.3,area*0.48);
      if(this.encounter===3)this.image('cg/approved/props/sluice_1',this.w*0.77,aTop+area*0.44,area*0.60);
      this.image('cg/approved/props/plants_2',this.w*0.06,aBottom,Math.min(70,area*0.25));
      const enemies=Object.keys(this.battle.units).filter(id=>def(id).side==='enemy');
      const heroes=Object.keys(this.battle.units).filter(id=>def(id).side==='hero');
      const points:UnitPoint[]=[];
      const enemySpan=Math.min(this.w*0.56,enemies.length*190),eSlot=enemySpan/enemies.length;
      enemies.forEach((id,i)=>{const height=Math.min(area*(id.startsWith('goblin')?0.20:0.25),eSlot*0.8,145);points.push(this.figure(id,this.w*0.55-enemySpan/2+eSlot*(i+0.5),aTop+area*0.25,height,true));});
      const span=Math.min(this.w*0.78,heroes.length*180),slot=span/heroes.length;
      heroes.forEach((id,i)=>{const height=Math.min(area*0.32,slot*1.12,180);points.push(this.figure(id,this.w/2-span/2+slot*(i+0.5),aBottom-32,height,true));});
      this.onPoints(points);this.sync(this.battle,this.active,this.target);
    }
  }
  private figure(id:string,x:number,y:number,height:number,battle:boolean):UnitPoint {
    const hero=HEROES[id as HeroId],meta=hero?this.catalog.heroes.find(h=>h.id===id):undefined;
    const shadow=this.add.ellipse(x,y+1,height*0.63,Math.max(6,height*0.11),0x172b19,0.22);this.layer.add(shadow);
    const ring=this.add.ellipse(x,y+2,height*0.76,Math.max(9,height*0.16)).setStrokeStyle(2,0xf4d481).setVisible(false);this.layer.add(ring);
    const im=this.image(hero?.texture??ENEMY_TEXTURES[id],x,y,height,meta);
    this.figures.set(id,{image:im,shadow,ring,x,y});
    if(!battle)im.setAlpha(1);
    return {id,x,y,top:y-height,width:Math.max(60,height*0.75)};
  }
  async animate(events:BattleEvent[]):Promise<void> {
    for(const e of events){
      if(e.type==='use'){
        const f=this.figures.get(e.actor);if(f)this.tweens.add({targets:f.image,y:f.y+(def(e.actor).side==='hero'?-8:8),duration:110,yoyo:true});
      } else if(e.type==='damage'||e.type==='heal'){
        const f=this.figures.get(e.target);if(!f)continue;
        const key=e.type==='heal'?'heal_1':e.damageType==='fire'||e.damageType==='magic'?'fire_1':'attack_1';
        this.effect(f,key);
        const text=this.add.text(f.x,f.y-f.image.displayHeight*0.55,`${e.type==='heal'?'+':'−'}${e.amount}`,{fontFamily:'Tiny5',fontSize:'28px',color:e.type==='heal'?'#b3ed8d':'#ffefc5',stroke:'#35231e',strokeThickness:5}).setOrigin(0.5);this.layer.add(text);
        this.tweens.add({targets:text,y:text.y-25,alpha:0,delay:200,duration:550,onComplete:()=>text.destroy()});
        if(e.type==='damage'){f.image.setTint(0xffb9a0);this.time.delayedCall(160,()=>{if(f.image.active)f.image.clearTint();});}
      } else if(e.type==='guard'){const f=this.figures.get(e.ward);if(f)this.effect(f,'guard_1');}
      else if(e.type==='windup'){const f=this.figures.get(e.actor);if(f){const t=this.add.text(f.x,f.y-f.image.displayHeight-12,'!',{fontFamily:'Tiny5',fontSize:32,color:'#ffba63',stroke:'#47251d',strokeThickness:4}).setOrigin(0.5);this.layer.add(t);this.tweens.add({targets:t,y:t.y-14,alpha:0,duration:900,onComplete:()=>t.destroy()});}}
    }
    await new Promise<void>(resolve=>setTimeout(resolve,550));
  }
  private effect(f:Figure,key:string):void {
    const fx=this.add.image(f.x,f.y-f.image.displayHeight*0.4,`cg/effects/${key}`).setDisplaySize(72,72);this.layer.add(fx);
    this.tweens.add({targets:fx,alpha:0,scaleX:fx.scaleX*1.35,scaleY:fx.scaleY*1.35,duration:500,onComplete:()=>fx.destroy()});
  }
}
