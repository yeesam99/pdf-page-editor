(function(){
 'use strict';
 const $=id=>document.getElementById(id),E=window.BlockOnlineEngine,SHAPES=window.BlockGameCore.SHAPES;
 const colors={I:'#8dcddd',O:'#edd080',T:'#b69bd8',S:'#a0cdb0',Z:'#eaa2aa',J:'#99b2dd',L:'#eab78a'};
 let socket=null,state=null,game=null,session=null,seq=0,pending=[],offset=0,synced=false,rtt=0,connected=false,intentional=false,retry=0,retryTimer=null,reconnectUntil=0,lastPacket=0,toastTimer=null;
 const presses=new Map(),opponents=new Map(),SESSION='mongle-online-session-v1';
 try{session=JSON.parse(sessionStorage.getItem(SESSION)||'null');$('nickname').value=localStorage.getItem('mongle-online-name')||'';}catch{}
 const requested=new URLSearchParams(location.search).get('room');if(requested)$('room-code').value=requested.toUpperCase().slice(0,6);
 function storeSession(value){session=value;try{if(value)sessionStorage.setItem(SESSION,JSON.stringify(value));else sessionStorage.removeItem(SESSION);}catch{}}
 function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3800);}
 function network(text,bad=false){$('connection').textContent=text;document.querySelector('.network').classList.toggle('bad',bad);}
 function endpoint(){const u=new URL(window.BLOCK_ONLINE_SERVER||location.origin);if(!['http:','https:','ws:','wss:'].includes(u.protocol))throw Error('HTTP 서버로 페이지를 열어주세요.');u.protocol=u.protocol==='https:'||u.protocol==='wss:'?'wss:':'ws:';if(location.protocol==='https:'&&u.protocol!=='wss:')throw Error('온라인 서버에 보안 연결이 필요해요.');u.pathname='/ws';u.search='';u.hash='';return u.href;}
 function busy(value){$('create').disabled=$('join').disabled=value;}
 function send(value){if(socket?.readyState!==WebSocket.OPEN)return false;socket.send(JSON.stringify(value));return true;}
 function serverNow(){return performance.now()+offset;}
 function disconnectView(){connected=false;clearPresses();$('ready').disabled=$('start-match').disabled=$('rematch').disabled=true;draw();}
 function exitRoom(message){intentional=true;clearTimeout(retryTimer);storeSession(null);state=null;game=null;pending=[];clearPresses();socket?.close();socket=null;connected=false;$('room').hidden=true;$('entry').hidden=false;busy(false);network(message||'방에서 나왔어요. 새 방에서 다시 만나요.');}
 function connect(request){
   let url;try{url=endpoint();}catch(e){network(e.message,true);busy(false);return;}
   clearTimeout(retryTimer);intentional=false;busy(true);synced=false;const ws=new WebSocket(url);socket=ws;
   network(request.type==='resume'?'연결을 복구하고 있어요. 경기는 계속 진행돼요.':'대전 서버에 연결 중이에요…');
   const timeout=setTimeout(()=>{if(ws===socket&&(!connected||!state))ws.close();},15000);
   ws.addEventListener('open',()=>{if(ws!==socket)return;lastPacket=performance.now();ws.send(JSON.stringify(request));ws.send(JSON.stringify({type:'ping',sent:performance.now()}));});
   ws.addEventListener('message',event=>{
     if(ws!==socket)return;lastPacket=performance.now();let m;try{m=JSON.parse(event.data);}catch{return;}
     if(m.type==='pong'){if(Number.isFinite(m.sent)&&Number.isFinite(m.now)){rtt=Math.max(0,performance.now()-m.sent);offset=m.now+rtt/2-performance.now();synced=true;$('latency').textContent=Math.round(rtt)+' ms';}return;}
     if(m.type==='joined'){clearTimeout(timeout);connected=true;retry=0;reconnectUntil=0;seq=0;pending=[];storeSession({code:m.code,token:m.token});$('entry').hidden=true;$('room').hidden=false;network('연결됨 · 같은 방에서 실시간으로 함께해요');return;}
     if(m.type==='state'){if(!connected)return;receive(m);return;}
     if(m.type==='left'){exitRoom();return;}
     if(m.type==='expired'){exitRoom(m.message);return;}
     if(m.type==='error'){
       notify(m.message);
       if(!connected){clearTimeout(timeout);if(request.type==='resume'){exitRoom(m.message);}else{intentional=true;ws.close();busy(false);network(m.message,true);}}
     }
   });
   ws.addEventListener('error',()=>{if(ws===socket)network('연결이 원활하지 않아요. 서버가 시작 중이면 잠시 기다려주세요.',true);});
   ws.addEventListener('close',()=>{
     clearTimeout(timeout);if(ws!==socket||intentional)return;disconnectView();
     if(session){if(!reconnectUntil)reconnectUntil=performance.now()+19000;if(performance.now()<reconnectUntil){network('재연결 중 · 시간과 블록은 계속 움직이고 있어요',true);retryTimer=setTimeout(()=>connect({type:'resume',...session}),Math.min(3000,500*Math.pow(1.6,retry++)));return;}}
     if(session)exitRoom('연결을 복구하지 못했어요. 방에 다시 입장해주세요.');else{busy(false);network('서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.',true);}
   });
 }
 function enter(type){if(socket&&socket.readyState<2)return;const name=$('nickname').value.trim();if(!name){notify('닉네임을 입력해주세요.');$('nickname').focus();return;}const code=$('room-code').value.trim().toUpperCase();if(type==='join'&&!/^[A-F0-9]{6}$/.test(code)){notify('6자리 방 코드를 확인해주세요.');return;}try{localStorage.setItem('mongle-online-name',name);}catch{}connect({type,name,code});}
 $('create').addEventListener('click',()=>enter('create'));$('join').addEventListener('click',()=>enter('join'));$('room-code').addEventListener('input',()=>{$('room-code').value=$('room-code').value.toUpperCase().replace(/[^A-F0-9]/g,'');});
 $('ready').addEventListener('click',()=>send({type:'ready',ready:!state?.players.find(p=>p.id===state.you)?.ready}));
 $('start-match').addEventListener('click',()=>send({type:'start'}));$('rematch').addEventListener('click',()=>send({type:'rematch'}));
 $('leave').addEventListener('click',()=>{if(state&&['playing','countdown'].includes(state.phase)&&!confirm('경기에서 나갈까요? 현재 점수로 플레이가 종료돼요.'))return;if(connected)send({type:'leave'});else exitRoom();});
 async function copy(text){try{await navigator.clipboard.writeText(text);notify('복사했어요. 친구에게 보내주세요.');}catch{window.prompt('아래 내용을 복사해주세요.',text);}}
 $('invite').addEventListener('click',()=>{if(!state)return;const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('room',state.code);copy(u.href);});
 $('copy-result').addEventListener('click',()=>{if(state?.phase==='finished')copy('몽글 블록 · 3분 온라인 점수 대결\n'+state.players.map(p=>p.rank+'위 '+p.name+' · '+p.score.toLocaleString()+'점').join('\n'));});
 function elem(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
 function receive(m){
   const previous=state,changed=!state||state.round!==m.round;state=m;if(!synced)offset=m.now-performance.now();
   if(changed){pending=[];seq=0;clearPresses();}
   seq=Math.max(seq,m.ack);pending=pending.filter(p=>p.seq>m.ack&&p.round===m.round);
   game=m.own?E.restore(m.own):null;if(game)for(const p of pending)E.apply(game,p.action);
   if(m.phase!=='playing'||game?.status!=='playing')clearPresses();
   updateUI();draw();
   if(m.phase==='playing'&&previous?.phase!=='playing'&&!document.hidden)$('board').focus({preventScroll:true});
 }
 function updateUI(){
   if(!state)return;const me=state.players.find(p=>p.id===state.you),host=state.host===state.you,waiting=state.phase==='waiting',finished=state.phase==='finished';
   $('room-label').textContent=state.code;$('members').textContent=state.players.length+' / 4명';$('lobby').hidden=!waiting;$('match').hidden=waiting;
   $('ready').textContent=me.ready?'준비 완료 · 취소':'준비하기 ✓';$('ready').disabled=!connected;$('ready').setAttribute('aria-pressed',String(me.ready));
   $('start-match').hidden=!host;$('start-match').disabled=!connected||state.players.length<2||state.players.some(p=>!p.ready||!p.connected);
   $('lobby-hint').textContent=host?'모두 준비되면 시작 버튼을 눌러주세요.':'준비를 마치면 방장이 경기를 시작해요.';
   // Only rebuild the waiting roster when its display data changes.
   const rosterKey=JSON.stringify(state.players.map(p=>[p.id,p.name,p.ready,p.connected,p.id===state.host]));
   if($('roster').dataset.key!==rosterKey){$('roster').dataset.key=rosterKey;$('roster').replaceChildren();
     for(const p of state.players){const card=elem('div','player-seat'+(p.ready?' is-ready':''));card.append(elem('span','avatar','▦'),elem('b','',p.name+(p.id===state.you?' · 나':'')),elem('small','',(!p.connected?'재접속 대기':p.ready?'준비 완료':'준비 중')+(p.id===state.host?' · 방장':'')));$('roster').append(card);}
     for(let i=state.players.length;i<4;i++){const card=elem('div','player-seat empty');card.append(elem('span','avatar','+'),elem('b','','친구를 기다려요'));$('roster').append(card);}
   }
   $('my-name').textContent=me.name;$('my-score').textContent=me.score.toLocaleString();$('my-lines').textContent=me.lines;$('my-level').textContent=me.level;$('my-rank').textContent=me.rank+'위 / '+state.players.length+'명';$('my-status').textContent=me.status==='over'?'FINISHED · 관전 중':'HAPPY STACKING';
   $('ranking-title').textContent=finished?'최종 순위 ✧':'지금의 순위 ✧';
   const rankingKey=JSON.stringify(state.players.map(p=>[p.id,p.name,p.score,p.rank,p.status,p.connected]));
   if($('ranking').dataset.key!==rankingKey){$('ranking').dataset.key=rankingKey;$('ranking').replaceChildren();for(const p of state.players){const row=elem('li','rank-row'+(p.id===state.you?' me':''));const name=elem('span','rank-name',p.name);name.append(elem('small','',p.id===state.you?'나':!p.connected?'연결 끊김':p.status==='over'?'종료':''));row.append(elem('span','rank-number',p.rank),name,elem('span','rank-score',p.score.toLocaleString()));$('ranking').append(row);}}
   for(const [id,card]of opponents)if(!state.players.some(p=>p.id===id&&p.id!==state.you)){card.root.remove();opponents.delete(id);}
   for(const p of state.players.filter(p=>p.id!==state.you)){
     let card=opponents.get(p.id);if(!card){const root=elem('section','opponent'),name=elem('h3'),canvas=elem('canvas'),score=elem('b'),status=elem('small');canvas.width=120;canvas.height=240;canvas.setAttribute('aria-label',p.name+'의 게임판');root.append(name,canvas,score,status);$('opponents').append(root);card={root,name,canvas,score,status};opponents.set(p.id,card);}
     card.name.textContent=p.name;card.name.title=p.name;card.score.textContent=p.score.toLocaleString()+'점';card.status.textContent=!p.connected?'연결 끊김':p.status==='over'?'플레이 종료':p.lines+'줄 · '+p.rank+'위';card.root.classList.toggle('ended',p.status==='over');
   }
   $('result').hidden=!finished;$('rematch').hidden=!host;$('rematch').disabled=!connected;
   if(finished){const winners=state.players.filter(p=>p.rank===1).map(p=>p.name).join(', ');$('result-title').textContent=winners+' · '+(state.players.filter(p=>p.rank===1).length>1?'공동 1위!':'1위!');$('result-note').textContent='나는 '+me.rank+'위 · '+me.score.toLocaleString()+'점. '+(host?'대기실로 돌아가 다시 시작할 수 있어요.':'방장이 대기실로 돌아가면 다시 준비해주세요.');}
   $('match-title').textContent=finished?'같이 쌓아서, 더 즐거웠어요.':'각자의 속도로, 차곡차곡.';
 }
 function cell(c,x,y,size,type,ghost=false){c.save();c.beginPath();c.roundRect(x+1,y+1,size-2,size-2,Math.max(1,size*.16));if(ghost){c.strokeStyle=colors[type];c.fillStyle=colors[type]+'22';c.fill();c.setLineDash([3,3]);c.stroke();}else{c.fillStyle=colors[type]||'#b69bd8';c.fill();c.fillStyle='#ffffff66';c.fillRect(x+size*.2,y+size*.17,size*.6,Math.max(1,size*.1));if(size>20){c.fillStyle='#65516d88';c.fillRect(x+size*.34,y+size*.55,2,2);c.fillRect(x+size*.64,y+size*.55,2,2);}}c.restore();}
 function paintBoard(canvas,g,own=false){const c=canvas.getContext('2d'),size=canvas.width/10;c.clearRect(0,0,canvas.width,canvas.height);c.fillStyle='#fffcff';c.fillRect(0,0,canvas.width,canvas.height);c.strokeStyle='#eee7f2';c.lineWidth=.5;for(let x=0;x<10;x++){c.beginPath();c.moveTo(x*size,0);c.lineTo(x*size,canvas.height);c.stroke();}for(let y=0;y<20;y++){c.beginPath();c.moveTo(0,y*size);c.lineTo(canvas.width,y*size);c.stroke();}
   if(!g?.board)return;g.board.forEach((r,y)=>{if(y>=2)r.forEach((t,x)=>{if(t)cell(c,x*size,(y-2)*size,size,t);});});
   if(g.status==='over'||!g.piece)return;const p=g.piece;if(own){const gy=g.ghostY();p.m.forEach((r,y)=>r.forEach((v,x)=>{if(v&&gy+y>=2)cell(c,(p.x+x)*size,(gy+y-2)*size,size,p.type,true);}));}p.m.forEach((r,y)=>r.forEach((v,x)=>{if(v&&p.y+y>=2)cell(c,(p.x+x)*size,(p.y+y-2)*size,size,p.type);}));
 }
 function mini(canvas,types){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);types.forEach((t,i)=>{if(!t)return;const points=[];SHAPES[t].forEach((r,y)=>r.forEach((v,x)=>{if(v)points.push([x,y]);}));const minX=Math.min(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxX=Math.max(...points.map(p=>p[0])),size=20,ox=(100-(maxX-minX+1)*size)/2;for(const [x,y]of points)cell(c,ox+(x-minX)*size,i*70+15+(y-minY)*size,size,t);});}
 function draw(){paintBoard($('board'),game,true);mini($('hold'),game?[game.held]:[]);mini($('next'),game?game.queue.slice(0,3):[]);if(state)for(const p of state.players){const card=opponents.get(p.id);if(card)paintBoard(card.canvas,p);}updateClock();}
 function updateClock(){if(!state||state.phase==='waiting')return;const left=Math.max(0,state.endAt-serverNow()),seconds=Math.ceil(left/1000);$('timer').textContent=state.phase==='finished'?'00:00':String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');if(state.phase==='countdown')$('timer').textContent='03:00';document.querySelector('.clock').classList.toggle('urgent',state.phase==='playing'&&left<30000);
   let title='',note='';if(!connected){title='재연결 중';note='서버에서 경기는 계속 진행돼요';}else if(state.phase==='countdown'){title=String(Math.max(1,Math.ceil((state.startAt-serverNow())/1000)));note='같은 블록, 같은 시작';}else if(state.phase==='finished'){title='GOOD\nGAME!';note='오른쪽에서 최종 순위를 확인하세요';}else if(game?.status==='over'){title='잘 쌓았어요!';note='점수는 확정됐어요. 친구들의 경기를 지켜봐요.';}else if(left<=0){title='집계 중';note='서버의 최종 결과를 기다리고 있어요.';}
   $('board-overlay').hidden=!title;$('overlay-title').textContent=title;$('overlay-note').textContent=note;
 }
 function canPlay(){return connected&&state?.phase==='playing'&&game?.status==='playing'&&serverNow()<state.endAt;}
 function action(action){if(!canPlay())return;const message={type:'input',round:state.round,seq:++seq,action};if(pending.length>=100){network('응답이 지연되고 있어요. 연결을 확인 중이에요.',true);socket?.close();return;}pending.push(message);E.apply(game,action);send(message);draw();}
 function release(id){const t=presses.get(id);if(t){clearTimeout(t.delay);clearInterval(t.repeat);presses.delete(id);}}
 function clearPresses(){for(const id of [...presses.keys()])release(id);}
 function press(id,name){if(presses.has(id)||!canPlay())return;action(name);const t={};presses.set(id,t);if(['left','right','down'].includes(name))t.delay=setTimeout(()=>{action(name);t.repeat=setInterval(()=>action(name),name==='down'?40:60);},name==='down'?70:160);}
 const keys={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'rotate',KeyX:'rotate',KeyZ:'ccw',Space:'drop',KeyC:'hold',ShiftLeft:'hold',ShiftRight:'hold'};
 document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey||e.target.tagName==='BUTTON'&&e.code==='Space')return;if(keys[e.code]&&canPlay()){e.preventDefault();if(!e.repeat)press(e.code,keys[e.code]);}});
 document.addEventListener('keyup',e=>release(e.code));window.addEventListener('blur',clearPresses);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearPresses();});
 document.querySelectorAll('[data-action]').forEach(b=>{b.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);press('p'+e.pointerId,b.dataset.action);});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>release('p'+e.pointerId));b.addEventListener('click',e=>{if(e.detail===0)action(b.dataset.action);});});
 setInterval(()=>{if(socket?.readyState===WebSocket.OPEN){if(performance.now()-lastPacket>12000){socket.close();return;}send({type:'ping',sent:performance.now()});}},3000);
 function frame(){updateClock();requestAnimationFrame(frame);}requestAnimationFrame(frame);
 if(session&&(!requested||requested.toUpperCase()===session.code)){reconnectUntil=performance.now()+19000;connect({type:'resume',...session});}else if(session)storeSession(null);
})();
