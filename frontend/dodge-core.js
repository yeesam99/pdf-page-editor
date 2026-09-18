/* Mongle Dodge v2: one hit, endless survival; no rounds or route indicators. */
(function(root){
 'use strict';
 const W=640,H=480,TAU=Math.PI*2;
 function rng(seed){let n=2166136261;for(const c of String(seed)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function distanceSegment(x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,d=dx*dx+dy*dy,t=d?clamp(-(x1*dx+y1*dy)/d,0,1):0;return Math.hypot(x1+dx*t,y1+dy*t);}
 class Game{
  constructor(seed='STAR-RUN'){
   this.seed=seed;this.rand=rng(seed);this.player={x:W/2,y:H*.7,r:5};this.hp=1;this.time=0;this.countdown=3;this.status='countdown';this.shots=[];this.pending=[];this.effects=[];this.grazes=0;this.hits=0;this.score=0;this.accumulator=0;this.peak=0;
   this.nextAim=.7;this.nextPattern=5;this.nextSurge=22+this.rand()*6;this.surgeUntil=0;this.surge=false;this.patternCount=0;this.lastPattern='';this.difficulty=0;
  }
  pause(){if(['playing','countdown'].includes(this.status)){this.resumeState=this.status;this.status='paused';}}
  resume(){if(this.status==='paused')this.status=this.resumeState;}
  end(){this.status='over';}
  update(dt,input={}){if(!['playing','countdown'].includes(this.status))return;this.accumulator+=clamp(Number(dt)||0,0,.25);while(this.accumulator>=1/120&&this.status!=='over'){this.accumulator-=1/120;this.step(1/120,input);}}
  step(dt,input){
   if(this.status==='countdown'){this.countdown=Math.max(0,this.countdown-dt);if(this.countdown<.00001)this.status='playing';return;}
   if(this.status!=='playing')return;
   const p=this.player,px=p.x,py=p.y;let dx=clamp(Number(input.x)||0,-1,1),dy=clamp(Number(input.y)||0,-1,1);const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}
   const speed=input.focus?110:255;p.x=clamp(p.x+dx*speed*dt,12,W-12);p.y=clamp(p.y+dy*speed*dt,12,H-12);
   this.time+=dt;this.difficulty=this.time/40;
   if(this.time>=this.nextSurge){this.surgeUntil=this.time+4.5+this.rand()*2;this.nextSurge=this.surgeUntil+12+this.rand()*9;}
   this.surge=this.time<this.surgeUntil;
   // Independent clocks overlap attacks; nothing clears bullets between patterns.
   if(this.time>=this.nextAim){this.aim();this.nextAim=this.time+Math.max(.24,1.2/(1+this.difficulty*.65))*(this.surge?.6:1);}
   if(this.time>=this.nextPattern){this.pattern();this.nextPattern=this.time+Math.max(1.7,4.6/(1+this.difficulty*.3))*(this.surge?.68:1);}
   const queued=this.pending;this.pending=[];for(const item of queued){item.delay-=dt;if(item.delay<=0)this.fire(item);else this.pending.push(item);}
   for(const b of this.shots){const bx=b.x,by=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;const d=distanceSegment(bx-px,by-py,b.x-p.x,b.y-p.y);
    if(d<p.r+b.r){this.hp=0;this.hits=1;this.status='over';this.effects.push({x:p.x,y:p.y,life:1,text:'×'});break;}
    if(!b.grazed&&d<p.r+b.r+10){b.grazed=true;this.grazes++;}
   }
   this.shots=this.shots.filter(b=>b.life>0&&b.x>-70&&b.x<W+70&&b.y>-70&&b.y<H+70);
   this.effects=this.effects.map(e=>({...e,life:e.life-dt})).filter(e=>e.life>0);this.score=Math.floor(this.time*1000);this.peak=Math.max(this.peak,this.shots.length);
  }
  edge(){
   const sites=[{x:24+this.rand()*592,y:-18},{x:W+18,y:24+this.rand()*432},{x:24+this.rand()*592,y:H+18},{x:-18,y:24+this.rand()*432}];
   const good=sites.filter(s=>Math.hypot(s.x-this.player.x,s.y-this.player.y)>165);return good[Math.floor(this.rand()*good.length)];
  }
  aim(){const s=this.edge(),a=Math.atan2(this.player.y-s.y,this.player.x-s.x),d=this.difficulty;
   const count=this.time<8?1:this.time<35?3:5;
   for(let i=0;i<count;i++)this.bullet(s.x,s.y,a+(i-(count-1)/2)*.15,Math.min(270,145+d*23),'arrow');
  }
  pattern(){
   const options=this.time<12?['ring']:['ring','spiral','curtain'];const available=options.filter(s=>s!==this.lastPattern);const pool=available.length?available:options;
   const kind=pool[Math.floor(this.rand()*pool.length)];this.lastPattern=kind;this.patternCount++;
   const d=this.difficulty,a=this.rand()*TAU;
   if(kind==='curtain'){
    const side=this.rand()<.5?'top':'left',offset=this.rand()*30,slant=(this.rand()-.5)*.28;
    for(let i=0;i<(this.surge?4:3);i++)this.pending.push({kind,side,offset:(offset+i*17)%48,angle:slant,delay:i*.34,speed:Math.min(235,118+d*16)});return;
   }
   const sites=[{x:70,y:65},{x:W-70,y:65},{x:70,y:H-65},{x:W-70,y:H-65},{x:320,y:55},{x:320,y:H-55}];
   const good=sites.filter(s=>Math.hypot(s.x-this.player.x,s.y-this.player.y)>210);const s=good[Math.floor(this.rand()*good.length)];
   if(kind==='ring'){
    // The opening is independent of the player. Read the moving bullets.
    const count=24+Math.min(8,Math.floor(d)*2),skip=Math.floor(this.rand()*count);
    for(let i=0;i<2;i++)this.pending.push({kind,...s,angle:a+i*.14,count,skip,delay:i*.55,speed:Math.min(190,97+d*13)});
   }else{
    const direction=this.rand()<.5?-1:1;
    for(let i=0;i<22;i++)this.pending.push({kind,...s,angle:a+direction*i*.22,delay:i*.075,speed:Math.min(195,110+d*13)});
   }
  }
  bullet(x,y,angle,speed,type='star'){
   // No point-blank spawning even when approaching an ongoing emitter.
   if(this.shots.length>=480||Math.hypot(x-this.player.x,y-this.player.y)<105)return;
   this.shots.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:type==='arrow'?4:4.5,type,life:11,grazed:false});
  }
  fire(w){
   if(w.kind==='curtain'){const length=w.side==='top'?W:H;for(let n=14+w.offset;n<length;n+=48)this.bullet(w.side==='top'?n:-18,w.side==='top'?-18:n,(w.side==='top'?Math.PI/2:0)+w.angle,w.speed,'arrow');return;}
   const count=w.kind==='ring'?w.count:4;
   for(let i=0;i<count;i++){if(w.kind==='ring'&&(i===w.skip||i===(w.skip+1)%count))continue;this.bullet(w.x,w.y,w.angle+i*TAU/count,w.speed,'star');}
  }
 }
 const api={Game,W,H,distanceSegment,rng};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DodgeCore=api;
})(typeof window!=='undefined'?window:globalThis);
