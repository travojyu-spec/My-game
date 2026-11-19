import Phaser from 'phaser';
import { assetUrl, embeddedManifest, loadFont } from './core/assets';
import { canFullscreen, enterFullscreen } from './core/screen';
import { loadSettings } from './core/settings';
import { sfx } from './core/sfx';
import { AdventureApp } from './adventure/app';
import { AdventureScene, type ArtCatalog } from './adventure/scene';
import './adventure/game.css';

async function start():Promise<void>{
  window.addEventListener('pointerdown',()=>sfx.unlock(),{capture:true});
  sfx.enabled=loadSettings().sound;
  const full=document.getElementById('rotate-fullscreen') as HTMLButtonElement;
  full.hidden=!canFullscreen();full.addEventListener('click',()=>void enterFullscreen());
  const catalog:ArtCatalog=embeddedManifest?embeddedManifest as unknown as ArtCatalog:await fetch('assets/chatgpt/manifest.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error(`Каталог: ${r.status}`);return r.json() as Promise<ArtCatalog>;});
  document.documentElement.style.setProperty('--frame',`url("${assetUrl('assets/chatgpt/approved/ui/window_1.png')}")`);
  await loadFont();
  const app=new AdventureApp(catalog);
  const scene=new AdventureScene(catalog,()=>app.ready(scene),points=>app.setPoints(points));
  new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#173123',banner:false,disableContextMenu:true,render:{antialias:true},scale:{mode:Phaser.Scale.NONE,width:window.innerWidth,height:window.innerHeight},audio:{noAudio:true},input:{activePointers:1},scene:[scene]});
}
start().catch(err=>{console.error(err);document.getElementById('boot-text')!.textContent='Не удалось загрузить игру. Обновите страницу.';});
