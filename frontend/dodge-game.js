(function(){
 'use strict';
 const $=id=>document.getElementById(id),{Game,W,H}=window.DodgeCore,canvas=$('arena'),ctx=canvas.getContext('2d');
 let game=null,last=performance.now(),best=0,stored=true,saved=false,focus=false,joy={x:0,y:0},pointer=null,toastTimer;
 const keys=new Set(),phases=[...document.querySelectorAll('[data-phase]')];
 try{const n=Number(localStorage.getItem('mongle-dodge-best-v1'));if(Number.isFinite(n)&&n>=0)best=Math.floor(n);}catch{stored=false;}
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),timeText=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
 function notify(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2800);}
 function normalize(s){return String(s).trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,24)||'STAR-RUN';}
 function clearInput(){keys.clear();joy={x:0,y:0};pointer=null;$('stick').style.transform='translate(0px,0px)';}
 function active(){return game&&game.status!=='over';}
 function precision(){return focus||keys.has('ShiftLeft')||keys.has('ShiftRight');}
 function inputs(){return {x:(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0)+joy.x,y:(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0)+joy.y,focus:precision()};}
 function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
 function star(x,y,r,color,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.48:r;const px=Math.cos(a)*d,py=Math.sin(a)*d;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.restore();}
 function slime(x,y,invincible=false){ctx.save();ctx.translate(x,y);ctx.fillStyle='#b9dcca';ctx.strokeStyle='#8cbaa2';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(-17,10);ctx.bezierCurveTo(-24,8,-18,-17,0,-17);ctx.bezierCurveTo(19,-17,23,9,17,11);ctx.quadraticCurveTo(0,18,-17,10);ctx.fill();ctx.stroke();ctx.fillStyle='#668474';ctx.beginPath();ctx.arc(-6,-2,1.5,0,7);ctx.arc(6,-2,1.5,0,7);ctx.fill();ctx.beginPath();ctx.arc(0,1,3,0,Math.PI);ctx.stroke();ctx.fillStyle='#eaa9b077';ctx.beginPath();ctx.ellipse(-10,3,3,1.5,0,0,7);ctx.ellipse(10,3,3,1.5,0,0,7);ctx.fill();ctx.fillStyle='#7f669e';ctx.beginPath();ctx.arc(0,8,2.5,0,7);ctx.fill();if(invincible){ctx.strokeStyle='#ac92d0';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(0,0,27,0,7);ctx.stroke();}ctx.restore();}
 function draw(){
   const t=game?.time||0,burst=game?.phase.id==='burst';ctx.clearRect(0,0,W,H);ctx.fillStyle=burst?'#fff6f3':'#fcfbff';ctx.fillRect(0,0,W,H);
   ctx.fillStyle=burst?'#ecd8d4':'#e4dfee';for(let x=20;x<W;x+=32)for(let y=16;y<H;y+=32){ctx.beginPath();ctx.arc(x,y,.9,0,7);ctx.fill();}
   if(!game){slime(320,320);return;}
   if(burst){ctx.fillStyle='#bedfc84d';ctx.fillRect(game.gapX-game.gapWidth/2,0,game.gapWidth,H);ctx.strokeStyle='#99bca3';ctx.setLineDash([5,7]);ctx.beginPath();ctx.moveTo(game.gapX-game.gapWidth/2,0);ctx.lineTo(game.gapX-game.gapWidth/2,H);ctx.moveTo(game.gapX+game.gapWidth/2,0);ctx.lineTo(game.gapX+game.gapWidth/2,H);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#7d9e88';ctx.font='10px Arial';ctx.textAlign='center';ctx.fillText('SAFE LANE',game.gapX,H-13);}
   for(const w of game.warnings){
    ctx.save();const progress=1-w.delay/w.total;ctx.globalAlpha=.35+progress*.55;ctx.strokeStyle='#c4a0cf';ctx.fillStyle='#c5a6d5';ctx.lineWidth=1.5;
    if(w.kind==='rain'){for(let x=18+w.offset;x<W;x+=34)if(Math.abs(x-w.gap)>game.gapWidth/2+12){ctx.beginPath();ctx.moveTo(x-4,5);ctx.lineTo(x,11);ctx.lineTo(x+4,5);ctx.stroke();}}
    else if(w.kind==='ring'||w.kind==='spiral'){ctx.beginPath();ctx.arc(w.x,w.y,12+progress*12,0,Math.PI*2);ctx.stroke();ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(w.x,w.y,34,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#9abcab';ctx.lineWidth=5;ctx.beginPath();ctx.arc(w.x,w.y,34,w.gap-.48,w.gap+.48);ctx.stroke();star(w.x,w.y,7,'#b7a0d1',t);}
    else if(w.kind!=='spiral-ray'){const x=clamp(w.x,8,W-8),y=clamp(w.y,8,H-8);ctx.beginPath();ctx.arc(x,y,5+progress*6,0,7);ctx.stroke();ctx.setLineDash([4,7]);ctx.globalAlpha=.2;ctx.beginPath();ctx.moveTo(w.x,w.y);ctx.lineTo(w.x+Math.cos(w.angle)*900,w.y+Math.sin(w.angle)*900);ctx.stroke();}
    ctx.restore();
   }
   for(const b of game.shots){if(b.type==='star')star(b.x,b.y,8,'#b599d1',t*.8);else{ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));ctx.strokeStyle=burst?'#dc99a2':'#b3a0d0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(7,0);ctx.moveTo(0,-4);ctx.lineTo(7,0);ctx.lineTo(0,4);ctx.stroke();ctx.restore();}}
   const p=game.player;ctx.save();if(game.invincible>0)ctx.globalAlpha=.6+.3*Math.sin(t*20);slime(p.x,p.y,game.invincible>0);ctx.restore();
   // The collision circle is always centered on the engine position.
   ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.strokeStyle=precision()?'#796199':'#79619977';ctx.lineWidth=precision()?2:1;ctx.stroke();ctx.fillStyle='#796199';ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,7);ctx.fill();
   for(const e of game.effects){ctx.save();ctx.globalAlpha=Math.min(1,e.life*2);ctx.fillStyle=e.text==='♡'?'#cf8099':'#9d80b9';ctx.font=e.text.length>5?'bold 18px Arial':'bold 15px Arial';ctx.textAlign='center';ctx.fillText(e.text,e.x,e.y-(1-e.life)*18);ctx.restore();}
   const local=t%65;if(local>=42&&local<45&&game.status!=='countdown'){ctx.fillStyle='#c68198';ctx.font='bold 23px Arial';ctx.textAlign='center';ctx.fillText(`버닝까지 ${Math.ceil(45-local)}`,W/2,48);}
   if(burst&&local<46.4){ctx.fillStyle='#cd7d8b';ctx.font='bold 36px Arial';ctx.textAlign='center';ctx.fillText('BURST!',W/2,66);}
   if(game.status==='countdown'){ctx.fillStyle='#fffaffba';ctx.fillRect(0,0,W,H);ctx.fillStyle='#a088bd';ctx.font='bold 66px Arial';ctx.textAlign='center';ctx.fillText(String(Math.max(1,Math.ceil(game.countdown))),W/2,H/2);ctx.font='15px Arial';ctx.fillText('작은 점을 지켜주세요',W/2,H/2+35);}
 }
 function resize(){const d=Math.min(2,window.devicePixelRatio||1);canvas.width=W*d;canvas.height=H*d;ctx.setTransform(d,0,0,d,0,0);draw();}
 function show(title,text,label,kicker){$('overlay').hidden=false;$('overlay-title').textContent=title;$('overlay-text').textContent=text;$('start').textContent=label;$('overlay-kicker').textContent=kicker;}
 function ui(){
   $('best').textContent=best.toLocaleString();$('storage-note').textContent=stored?'이 브라우저에 저장돼요':'기록 저장 불가 · 현재 화면에서만 유지';$('seed').disabled=!!active();$('random').disabled=!!active();$('restart').disabled=!game;$('end').disabled=!active();$('pause').disabled=!active();
   if(!game)return;
   $('score').textContent=game.score.toLocaleString();$('time').textContent=timeText(game.time);$('graze').textContent=game.grazes;$('hearts').textContent=Array.from({length:3},(_,i)=>i<game.hp?'♥':'♡').join(' ');$('hearts').setAttribute('aria-label',`생명 ${game.hp}개`);
   $('phase').textContent=game.status==='paused'?'PAUSED':game.status==='countdown'?'READY?':game.status==='over'?'NICE DODGE!':game.phase.name;
   $('hint').textContent=game.phase.hint;$('difficulty').textContent=`STAGE ${String(game.cycle+1).padStart(2,'0')}`;
   $('pause').textContent=game.status==='paused'?'▶':'Ⅱ';$('pause').setAttribute('aria-label',game.status==='paused'?'계속하기':'일시정지');
   document.querySelector('.arena-shell').classList.toggle('burst',game.phase.id==='burst');phases.forEach(el=>el.classList.toggle('active',el.dataset.phase===game.phase.id));
   const local=game.time%65;$('phase-progress').style.width=`${(local-game.phase.start)/(game.phase.end-game.phase.start)*100}%`;$('phase-left').textContent=`${game.phase.name} · ${Math.max(0,Math.ceil(game.phase.end-local))}초 남음`;
   if(game.status==='over'&&!saved){saved=true;clearInput();const record=game.score>best;best=Math.max(best,game.score);try{localStorage.setItem('mongle-dodge-best-v1',String(best));}catch{stored=false;}
    show('별비를 잘 헤쳐왔어요!',`${timeText(game.time)} 생존 · ${game.score.toLocaleString()}점\n${record?'새로운 최고 기록!':'다음에는 조금 더 멀리 가볼까요?'}`,'한 번 더 도전 →','GOOD RUN, LITTLE SLIME');$('share-result').hidden=false;$('best').textContent=best.toLocaleString();$('storage-note').textContent=stored?'이 브라우저에 저장돼요':'기록 저장 불가 · 현재 화면에서만 유지';
   }
 }
 function start(){clearInput();focus=false;$('focus').setAttribute('aria-pressed','false');const code=normalize($('seed').value);$('seed').value=code;game=new Game(code);saved=false;last=performance.now();$('overlay').hidden=true;$('share-result').hidden=true;ui();draw();canvas.focus({preventScroll:true});}
 function pause(reason){if(!active())return;clearInput();if(game.status==='paused'){game.resume();last=performance.now();$('overlay').hidden=true;canvas.focus({preventScroll:true});}else{game.pause();show('잠깐 쉬어가요',reason||'시간과 별비가 모두 멈췄어요.','이어서 플레이 →','PAUSE & BREATHE');$('share-result').hidden=true;}ui();draw();}
 $('start').addEventListener('click',()=>game?.status==='paused'?pause():start());$('pause').addEventListener('click',()=>pause());
 $('restart').addEventListener('click',()=>{if(!active()||confirm('현재 기록을 끝내고 새로 시작할까요?'))start();});$('end').addEventListener('click',()=>{if(active()&&confirm('현재 점수로 게임을 끝낼까요?')){game.end();ui();draw();}});
 const moveKeys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'];
 document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;if(['KeyP','Escape'].includes(e.code)&&active()){e.preventDefault();if(!e.repeat)pause();return;}if(moveKeys.includes(e.code)&&active()){e.preventDefault();if(game.status!=='paused')keys.add(e.code);}});
 document.addEventListener('keyup',e=>keys.delete(e.code));
 const pad=$('joystick');function moveStick(e){const r=pad.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/(r.width*.34),y=(e.clientY-r.top-r.height/2)/(r.height*.34);const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}joy={x,y};$('stick').style.transform=`translate(${x*28}px,${y*28}px)`;}
 pad.addEventListener('pointerdown',e=>{if(e.button!==0||pointer!==null||!active()||game.status==='paused')return;pointer=e.pointerId;pad.setPointerCapture(pointer);moveStick(e);});pad.addEventListener('pointermove',e=>{if(e.pointerId===pointer)moveStick(e);});for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,e=>{if(e.pointerId===pointer){pointer=null;joy={x:0,y:0};$('stick').style.transform='translate(0px,0px)';}});
 $('focus').addEventListener('click',()=>{focus=!focus;$('focus').setAttribute('aria-pressed',String(focus));});
 $('seed').addEventListener('change',()=>$('seed').value=normalize($('seed').value));$('random').addEventListener('click',()=>{const n=new Uint32Array(1);crypto.getRandomValues(n);$('seed').value='STAR-'+n[0].toString(36).toUpperCase();});
 function link(code){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('code',code);return u.href;}
 async function copy(text){try{await navigator.clipboard.writeText(text);notify('복사했어요. 친구에게 보내보세요.');}catch{window.prompt('아래 내용을 직접 복사해주세요.',text);}}
 $('copy-link').addEventListener('click',()=>{const code=active()?game.seed:normalize($('seed').value);copy(location.protocol==='file:'?`몽글 닷지 도전 코드: ${code}`:link(code));});$('share-result').addEventListener('click',()=>{if(game?.status==='over')copy(`몽글 닷지 ✦ ${game.score.toLocaleString()}점\n${timeText(game.time)} 생존 / 스친 별 ${game.grazes}개\n코드: ${game.seed}\n${location.protocol==='file:'?'':link(game.seed)}\n개인 브라우저 기록 · 온라인 검증 없음`);});
 function autoPause(){clearInput();if(active()&&game.status!=='paused')pause('다른 화면으로 이동해서 자동으로 멈췄어요.');}
 window.addEventListener('blur',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});window.addEventListener('resize',resize);
 const params=new URLSearchParams(location.search);if(params.has('code'))$('seed').value=normalize(params.get('code'));ui();resize();
 function frame(now){const dt=(now-last)/1000;last=now;if(active()&&game.status!=='paused'){if(dt>.25)pause('화면이 잠시 지연되어 멈췄어요. 준비되면 이어서 플레이하세요.');else game.update(dt,inputs());ui();draw();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
