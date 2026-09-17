(function(){
 'use strict';
 const $=id=>document.getElementById(id),{Game,SHAPES}=window.BlockGameCore;
 const colors={I:'#8dcddd',O:'#edd080',T:'#b69bd8',S:'#a0cdb0',Z:'#eaa2aa',J:'#99b2dd',L:'#eab78a'};
 const board=$('board'),ctx=board.getContext('2d'),next=$('next').getContext('2d'),hold=$('hold').getContext('2d');
 let game=null,mode='classic',best={classic:0,challenge:0},storage=true,recorded=false,seenLocks=0,last=performance.now(),toastTimer;
 const presses=new Map();
 try{const data=JSON.parse(localStorage.getItem('mongle-block-best-v1')||'{}');for(const k of Object.keys(best))if(Number.isFinite(data[k])&&data[k]>=0)best[k]=Math.floor(data[k]);}catch{storage=false;}
 function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2800);}
 function newCode(){const a=new Uint32Array(1);crypto.getRandomValues(a);return 'MG-'+a[0].toString(36).toUpperCase().slice(0,7);}
 function normalize(text){return String(text).trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,24)||'MONGLE';}
 function formatTime(ms){const n=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
 function active(){return game&&['playing','paused'].includes(game.status);}
 function configure(){document.querySelectorAll('[data-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.mode===mode));b.disabled=!!active();});$('challenge-options').hidden=mode!=='challenge';$('challenge-code').disabled=!!active();$('new-code').disabled=!!active();$('best').textContent=best[mode].toLocaleString();$('best-inline').textContent=best[mode].toLocaleString();$('storage-note').textContent=storage?'이 브라우저에 저장돼요':'저장소 사용 불가 · 현재 화면에서만 기록';$('mode-description').innerHTML=mode==='classic'?'천천히 시작해서 점점 빠르게.<br>블록이 천장에 닿기 전까지 즐겨요.':'같은 코드로 친구와 가볍게 대결!<br>3분 동안 얼마나 쌓고 비울 수 있을까요?';}
 function roundRect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
 function block(c,x,y,size,type,ghost=false){
   c.save();roundRect(c,x+1.5,y+1.5,size-3,size-3,Math.max(2,size*.18));
   if(ghost){c.fillStyle=colors[type]+'25';c.fill();c.strokeStyle=colors[type];c.lineWidth=1.4;c.setLineDash([3,3]);c.stroke();}
   else {c.fillStyle=colors[type];c.fill();c.fillStyle='#ffffff55';roundRect(c,x+5,y+4,size-10,Math.max(2,size*.12),2);c.fill();
     // Tiny sleepy faces, drawn in code so no image assets are required.
     if(size>=18){c.fillStyle='#65516d99';c.beginPath();c.arc(x+size*.38,y+size*.57,1,0,7);c.arc(x+size*.63,y+size*.57,1,0,7);c.fill();c.strokeStyle='#65516d77';c.lineWidth=1;c.beginPath();c.arc(x+size*.505,y+size*.64,size*.08,0,Math.PI);c.stroke();}}
   c.restore();
 }
 function renderMini(c,types,height){c.clearRect(0,0,120,height);types.forEach((type,i)=>{if(!type)return;const m=SHAPES[type],points=[];m.forEach((r,y)=>r.forEach((v,x)=>{if(v)points.push([x,y]);}));const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));const size=23,ox=(120-(maxX-minX+1)*size)/2,oy=i*70+(70-(maxY-minY+1)*size)/2;points.forEach(([x,y])=>block(c,ox+(x-minX)*size,oy+(y-minY)*size,size,type));});}
 function draw(){
   ctx.clearRect(0,0,300,600);ctx.fillStyle='#fffcff';ctx.fillRect(0,0,300,600);ctx.strokeStyle='#eee7f2';ctx.lineWidth=.6;
   for(let x=0;x<=10;x++){ctx.beginPath();ctx.moveTo(x*30,0);ctx.lineTo(x*30,600);ctx.stroke();}for(let y=0;y<=20;y++){ctx.beginPath();ctx.moveTo(0,y*30);ctx.lineTo(300,y*30);ctx.stroke();}
   if(!game){renderMini(next,[],210);renderMini(hold,[],70);return;}
   game.board.forEach((r,y)=>{if(y>=2)r.forEach((type,x)=>{if(type)block(ctx,x*30,(y-2)*30,30,type);});});
   if(game.status!=='over'){
     const p=game.piece,gy=game.ghostY();p.m.forEach((r,y)=>r.forEach((v,x)=>{if(v&&gy+y>=2)block(ctx,(p.x+x)*30,(gy+y-2)*30,30,p.type,true);}));
     p.m.forEach((r,y)=>r.forEach((v,x)=>{if(v&&p.y+y>=2)block(ctx,(p.x+x)*30,(p.y+y-2)*30,30,p.type);}));
   }
   renderMini(next,game.queue.slice(0,3),210);renderMini(hold,[game.held],70);
 }
 function retina(){for(const [canvas,c,w,h]of [[board,ctx,300,600],[$('next'),next,120,210],[$('hold'),hold,120,70]]){const d=Math.min(2,window.devicePixelRatio||1);canvas.width=w*d;canvas.height=h*d;c.setTransform(d,0,0,d,0,0);}draw();}
 function clearPresses(){for(const t of presses.values()){clearTimeout(t.delay);clearInterval(t.repeat);}presses.clear();}
 function overlay(title,message,button,eyebrow){$('overlay').hidden=false;$('overlay-title').textContent=title;$('overlay-message').textContent=message;$('start').textContent=button;$('overlay-eyebrow').textContent=eyebrow;}
 function updateUI(){
   if(!game)return;
   $('score').textContent=game.score.toLocaleString();$('level').textContent=String(game.level).padStart(2,'0');$('lines').textContent=game.lines;$('level-progress').style.width=`${game.lines%10*10}%`;
   $('time-label').textContent=mode==='challenge'?'남은 시간':'플레이 시간';$('time').textContent=formatTime(mode==='challenge'?180000-game.elapsed:Math.floor(game.elapsed/1000)*1000);
   $('hold-label').textContent=game.canHold?'C로 보관':'이번 블록은 사용 완료';$('pause').disabled=game.status==='over';$('restart').disabled=false;$('end-game').disabled=game.status==='over';
   $('play-label').textContent=game.status==='paused'?'TAKE A LITTLE BREAK':game.status==='over'?'NICE PLAY!':mode==='challenge'?'3 MIN CHALLENGE':'HAPPY STACKING';
   $('pause').textContent=game.status==='paused'?'▶':'Ⅱ';$('pause').setAttribute('aria-label',game.status==='paused'?'계속하기':'일시정지');
   if(game.locks!==seenLocks){seenLocks=game.locks;$('feedback').textContent=game.lastClear?[null,'한 줄, 사뿐하게!','두 줄, 기분 좋은 정리!','세 줄, 멋진데요?','네 줄! 몽글몽글 대성공!'][game.lastClear]:'다음 블록도 차곡차곡';}
   if(game.status==='over'&&!recorded){recorded=true;clearPresses();const fresh=game.score>best[mode];best[mode]=Math.max(best[mode],game.score);try{localStorage.setItem('mongle-block-best-v1',JSON.stringify(best));}catch{storage=false;}
     overlay(game.reason==='time'?'3분, 알차게 채웠어요!':'오늘도 잘 쌓았어요!',`${game.score.toLocaleString()}점 · ${game.lines}줄 · 레벨 ${game.level}\n${fresh?'새로운 나의 최고 기록!':'조금 쉬었다가 한 판 더?'}`, '한 번 더 플레이 →','GOOD GAME, LITTLE STACKER');$('share-result').hidden=false;configure();
   }
 }
 function start(){clearPresses();const seed=mode==='challenge'?normalize($('challenge-code').value):newCode();$('challenge-code').value=mode==='challenge'?seed:$('challenge-code').value;game=new Game({mode,seed});recorded=false;seenLocks=0;last=performance.now();$('overlay').hidden=true;$('share-result').hidden=true;$('feedback').textContent=mode==='challenge'?`도전 코드 · ${seed}`:'조금씩 쌓아볼까요?';configure();updateUI();draw();board.focus({preventScroll:true});}
 function pause(){if(!game||game.status==='over')return;clearPresses();if(game.status==='playing'){game.pause();overlay('잠깐, 숨 고르기','편하게 쉬어요.\n시간과 블록은 멈춰 있어요.','이어서 플레이 →','PAUSE & BREATHE');$('share-result').hidden=true;}else{game.resume();last=performance.now();$('overlay').hidden=true;board.focus({preventScroll:true});}updateUI();draw();}
 function action(name){if(!game||game.status!=='playing')return;switch(name){case'left':game.move(-1);break;case'right':game.move(1);break;case'down':game.softDrop();break;case'rotate':game.rotate(1);break;case'ccw':game.rotate(-1);break;case'drop':game.hardDrop();break;case'hold':game.hold();break;}updateUI();draw();}
 function press(id,name){if(presses.has(id)||!game||game.status!=='playing')return;action(name);if(game.status!=='playing')return;const t={};presses.set(id,t);if(['left','right','down'].includes(name))t.delay=setTimeout(()=>{t.repeat=setInterval(()=>action(name),name==='down'?40:60);action(name);},name==='down'?70:160);}
 function release(id){const t=presses.get(id);if(t){clearTimeout(t.delay);clearInterval(t.repeat);presses.delete(id);}}
 const keys={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate',KeyX:'rotate',KeyZ:'ccw',Space:'drop',KeyC:'hold',ShiftLeft:'hold',ShiftRight:'hold'};
 document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;if(e.ctrlKey||e.metaKey||e.altKey)return;
   if(e.code==='KeyP'||e.code==='Escape'){if(active()){e.preventDefault();if(!e.repeat)pause();}return;}
   if(!game||game.status!=='playing')return;
   // Let Space/Enter activate focused buttons rather than both clicking and dropping.
   if(e.target.tagName==='BUTTON'&&e.code==='Space')return;
   if(keys[e.code]){e.preventDefault();if(!e.repeat)press(e.code,keys[e.code]);}
 });
 document.addEventListener('keyup',e=>release(e.code));
 document.querySelectorAll('[data-action]').forEach(b=>{
   b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);press('p'+e.pointerId,b.dataset.action);});
   for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,e=>release('p'+e.pointerId));
   b.addEventListener('click',e=>{if(e.detail===0)action(b.dataset.action);});
 });
 $('start').addEventListener('click',()=>game?.status==='paused'?pause():start());$('pause').addEventListener('click',pause);
 $('restart').addEventListener('click',()=>{if(!active()||confirm('현재 게임을 끝내고 처음부터 시작할까요?'))start();});
 $('end-game').addEventListener('click',()=>{if(active()&&confirm('현재 점수로 게임을 끝내고 모드를 다시 선택할까요?')){game.end('quit');updateUI();draw();}});
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{if(active())return;mode=b.dataset.mode;game=null;recorded=false;configure();$('share-result').hidden=true;overlay('작은 블록, 큰 즐거움','착지할 자리를 보고\n마음에 드는 곳에 톡!','플레이 시작 →',"LET'S STACK SOME JOY");$('score').textContent='0';$('level').textContent='01';$('lines').textContent='0';$('time').textContent=mode==='challenge'?'03:00':'00:00';$('time-label').textContent=mode==='challenge'?'남은 시간':'플레이 시간';$('level-progress').style.width='0%';$('play-label').textContent='READY TO PLAY';$('feedback').textContent='조금씩 쌓아볼까요?';$('restart').disabled=true;draw();}));
 $('new-code').addEventListener('click',()=>$('challenge-code').value=newCode());
 $('challenge-code').addEventListener('change',()=>$('challenge-code').value=normalize($('challenge-code').value));
 async function copy(text){try{await navigator.clipboard.writeText(text);notify('복사했어요. 친구에게 붙여넣어 주세요.');}catch{const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.top='0';document.body.appendChild(t);t.select();let ok=false;try{ok=document.execCommand('copy');}catch{}t.remove();if(ok)notify('복사했어요.');else window.prompt('아래 내용을 직접 복사해주세요.',text);}}
 function challengeLink(code){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('mode','challenge');url.searchParams.set('code',code);return url.href;}
 $('copy-link').addEventListener('click',()=>{const code=active()?game.seed:normalize($('challenge-code').value);$('challenge-code').value=code;copy(location.protocol==='file:'?`몽글 블록 도전 코드: ${code} (3분 도전에서 입력)` :challengeLink(code));});
 $('share-result').addEventListener('click',()=>{if(!game||game.status!=='over')return;copy(`몽글 블록 · ${game.mode==='challenge'?'3분 도전':'기본 모드'}\n${game.score.toLocaleString()}점 / ${game.lines}줄 / 레벨 ${game.level}\n${game.mode==='challenge'?`코드: ${game.seed}\n${location.protocol==='file:'?'':challengeLink(game.seed)}`:''}\n개인 브라우저에서 기록한 점수입니다.`);});
 function autoPause(){if(game?.status==='playing')pause();else clearPresses();}
 window.addEventListener('blur',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});window.addEventListener('resize',retina);
 const params=new URLSearchParams(location.search);if(params.get('mode')==='challenge'||params.has('code')){mode='challenge';$('challenge-code').value=normalize(params.get('code')||'MONGLE');$('time').textContent='03:00';$('time-label').textContent='남은 시간';}
 configure();retina();
 function frame(now){const dt=now-last;last=now;if(game?.status==='playing'){game.update(dt);updateUI();draw();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
