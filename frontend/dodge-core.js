/* Mongle Dodge: fixed-step survival engine, deterministic RNG, no dependencies. */
(function(root){
 'use strict';
 const W=640,H=480,TAU=Math.PI*2;
 const PHASES=[{id:'warm',name:'준비 운동',start:0,end:15,hint:'느린 별을 보며 몸을 풀어요.'},{id:'aim',name:'조준 사격',start:15,end:30,hint:'점선은 발사 방향! 옆으로 비켜요.'},{id:'ring',name:'꽃잎 패턴',start:30,end:45,hint:'원이 퍼지기 전에 빈 방향을 찾아요.'},{id:'burst',name:'버닝 타임',start:45,end:55,hint:'초록 통로로 이동! 화살비가 내려요.'},{id:'rest',name:'숨 고르기',start:55,end:65,hint:'잘 버텼어요. 잠깐 숨을 골라요.'}];
 function rng(seed){let n=2166136261;for(const c of String(seed)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function distanceSegment(x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,d=dx*dx+dy*dy,t=d?clamp(-(x1*dx+y1*dy)/d,0,1):0;return Math.hypot(x1+dx*t,y1+dy*t);}
 function phaseAt(time){const local=time%65;return PHASES.find(p=>local<p.end)||PHASES[4];}
 class Game{
  constructor(seed='MONGLE'){this.seed=seed;this.rand=rng(seed);this.player={x:W/2,y:H*.7,r:6};this.hp=3;this.time=0;this.countdown=3;this.status='countdown';this.shots=[];this.warnings=[];this.effects=[];this.phase=PHASES[0];this.cycle=0;this.nextWave=1;this.wave=0;this.invincible=0;this.bonus=0;this.grazes=0;this.hits=0;this.score=0;this.accumulator=0;this.gapX=320;this.gapWidth=150;this.peak=0;}
  pause(){if(['playing','countdown'].includes(this.status)){this.resumeState=this.status;this.status='paused';}}
  resume(){if(this.status==='paused')this.status=this.resumeState;}
  end(){this.status='over';}
  update(dt,input={}){if(!['playing','countdown'].includes(this.status))return;this.accumulator+=clamp(Number(dt)||0,0,.25);while(this.accumulator>=1/120&&this.status!=='over'){this.accumulator-=1/120;this.step(1/120,input);}}
  step(dt,input){
   if(this.status==='countdown'){this.countdown=Math.max(0,this.countdown-dt);if(this.countdown<.00001)this.status='playing';return;}
   if(this.status!=='playing')return;
   const p=this.player,px=p.x,py=p.y;let dx=clamp(Number(input.x)||0,-1,1),dy=clamp(Number(input.y)||0,-1,1);const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}const speed=input.focus?110:240;p.x=clamp(p.x+dx*speed*dt,12,W-12);p.y=clamp(p.y+dy*speed*dt,12,H-12);
   this.time+=dt;this.invincible=Math.max(0,this.invincible-dt);const phase=phaseAt(this.time),cycle=Math.floor(this.time/65);
   if(phase.id!==this.phase.id||cycle!==this.cycle){const old=this.phase.id;this.phase=phase;this.cycle=cycle;this.nextWave=this.time+.8;
    if(phase.id==='burst'){this.shots=[];this.warnings=[];this.gapX=clamp(p.x+(p.x<W/2?135:-135),100,W-100);}
    if(phase.id==='rest'){this.shots=[];this.warnings=[];if(old==='burst'){this.bonus+=200*(1+this.cycle);this.effects.push({x:320,y:230,life:1.6,text:'BURST CLEAR +'+200*(1+this.cycle)});}}
   }
   if(this.time>=this.nextWave&&phase.id!=='rest'){this.scheduleWave();const rates={warm:1.45,aim:1.05,ring:1.7,burst:.32};this.nextWave=this.time+rates[phase.id]/(1+Math.min(this.cycle,5)*.07);}
   const waiting=this.warnings;this.warnings=[];for(const w of waiting){w.delay-=dt;if(w.delay<=0)this.fire(w);else this.warnings.push(w);}
   for(const b of this.shots){const bx=b.x,by=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;const d=distanceSegment(bx-px,by-py,b.x-p.x,b.y-p.y);
    if(!this.invincible&&d<p.r+b.r){this.hp--;this.hits++;this.invincible=2;b.life=0;this.effects.push({x:p.x,y:p.y,life:.8,text:'♡'});if(this.hp<=0){this.status='over';break;}}
    else if(!this.invincible&&!b.grazed&&d<p.r+b.r+12){b.grazed=true;this.grazes++;this.bonus+=5;this.effects.push({x:p.x,y:p.y-20,life:.5,text:'+5'});}
   }
   this.shots=this.shots.filter(b=>b.life>0&&b.x>-70&&b.x<W+70&&b.y>-70&&b.y<H+70);
   this.effects=this.effects.map(e=>({...e,life:e.life-dt})).filter(e=>e.life>0);this.score=Math.floor(this.time*10)+this.bonus;this.peak=Math.max(this.peak,this.shots.length);
  }
  edge(){const side=Math.floor(this.rand()*4),n=this.rand();return side===0?{x:20+n*600,y:-12}:side===1?{x:W+12,y:20+n*440}:side===2?{x:20+n*600,y:H+12}:{x:-12,y:20+n*440};}
  scheduleWave(){
   const type=this.phase.id,level=Math.min(this.cycle,5);this.wave++;
   if(type==='burst'){
    // Fixed, visibly marked safe lane within each burst; no side shots during it.
    this.warnings.push({kind:'rain',delay:.7,total:.7,x:0,y:0,gap:this.gapX,speed:185+level*18,offset:this.rand()*16});return;
   }
   if(type==='ring'){
    const sites=[{x:130,y:100},{x:510,y:100},{x:320,y:90},{x:140,y:350},{x:500,y:350}];
    const good=sites.filter(s=>Math.hypot(s.x-this.player.x,s.y-this.player.y)>=160);const s=good[Math.floor(this.rand()*good.length)];
    const gap=Math.atan2(this.player.y-s.y,this.player.x-s.x);
    this.warnings.push({kind:level>0&&this.wave%2===0?'spiral':'ring',...s,delay:1,total:1,angle:this.rand()*TAU,gap,speed:86+level*12});return;
   }
   const s=this.edge(),angle=Math.atan2(this.player.y-s.y,this.player.x-s.x);
   this.warnings.push({kind:type==='warm'?'single':'aim',...s,delay:type==='warm'?.65:.85,total:type==='warm'?.65:.85,angle:angle+(type==='warm'?(this.rand()-.5)*.8:0),speed:(type==='warm'?100:138)+level*14,count:type==='warm'?1:level>0?5:3});
  }
  bullet(x,y,angle,speed,type='star'){if(this.shots.length>=320)return;this.shots.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:type==='arrow'?5:5.5,type,life:10,grazed:false});}
  fire(w){
   if(w.kind==='rain'){for(let x=18+w.offset;x<W;x+=34)if(Math.abs(x-w.gap)>this.gapWidth/2+12)this.bullet(x,-15,Math.PI/2,w.speed,'arrow');return;}
   if(w.kind==='single'||w.kind==='aim'){for(let i=0;i<w.count;i++)this.bullet(w.x,w.y,w.angle+(i-(w.count-1)/2)*.17,w.speed,'arrow');return;}
   if(w.kind==='spiral'){
    for(let i=0;i<16;i++)this.warnings.push({kind:'spiral-ray',x:w.x,y:w.y,angle:w.angle+i*.23,gap:w.gap,speed:w.speed,delay:i*.065,total:1});return;
   }
   const count=w.kind==='spiral-ray'?4:24;
   for(let i=0;i<count;i++){const a=w.angle+i*TAU/count,d=Math.abs(Math.atan2(Math.sin(a-w.gap),Math.cos(a-w.gap)));if(d<.48)continue;
    this.bullet(w.x,w.y,a,w.speed,'star');}
  }
 }
 const api={Game,W,H,PHASES,phaseAt,distanceSegment,rng};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DodgeCore=api;
})(typeof window!=='undefined'?window:globalThis);
