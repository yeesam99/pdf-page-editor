'use strict';
const $=id=>document.getElementById(id);let ws,state,choice;const key='mongle-code-session';
const label=n=>n==='joker'?'조커':n===null?'?':String(n);
function button(text,click,disabled=false){const b=document.createElement('button');b.textContent=text;b.onclick=click;b.disabled=disabled;return b;}
function send(m){if(ws?.readyState===1)ws.send(JSON.stringify(m));else $('status').textContent='서버 연결을 확인해주세요.';}
function connect(m){if(ws)ws.close();$('status').textContent='서버 연결 중…';const socket=new WebSocket((window.BLOCK_ONLINE_SERVER||location.origin).replace(/^http/,'ws')+'/code-ws');ws=socket;socket.onopen=()=>send({...m,version:2});socket.onclose=()=>{if(ws===socket)$('status').textContent='연결이 끊겼습니다. 새로고침하면 재접속합니다.';};socket.onerror=()=>{if(ws===socket)$('status').textContent='서버에 연결할 수 없습니다.';};socket.onmessage=e=>{if(ws!==socket)return;const m=JSON.parse(e.data);if(m.type==='error'){$('status').textContent=m.message;if(!state){sessionStorage.removeItem(key);ws=null;socket.close();}return;}if(m.type==='joined'){sessionStorage.setItem(key,JSON.stringify(m));return;}if(m.type==='left'){sessionStorage.removeItem(key);location.reload();return;}if(m.type==='state'){state=m;choice=m.selection?.actor===m.you?{player:m.selection.player,tile:m.selection.tile}:null;render();}};}
$('create').onclick=()=>connect({type:'create',name:$('name').value});$('join').onclick=()=>connect({type:'join',name:$('name').value,code:$('code').value});$('start').onclick=()=>send({type:'start'});$('leave').onclick=()=>send({type:'leave'});$('pass').onclick=()=>{choice=null;send({type:'pass'});};
function render(){
 const s=state,me=s.players.find(p=>p.id===s.you),myTurn=s.phase==='play'&&s.turn===s.you,canGuess=myTurn&&!s.pending;
 $('entry').hidden=true;$('room').hidden=false;
 $('info').textContent=`방 ${s.code} · ${s.players.length}/6명 · 남은 타일 ${s.remaining}`;
 $('log').textContent=s.log;
 $('status').textContent=s.phase==='done'?`승리: ${s.winner}`:s.phase==='lobby'?'친구에게 방 코드를 알려주세요.':s.phase==='setup'?'초기 배치: 조커 위치를 정하고 배치 완료를 눌러주세요.':s.pending?'가져온 타일을 내 줄에 배치하세요.':myTurn?'내 차례입니다. 상대 타일을 선택하세요.':'상대가 추리하고 있습니다.';
 $('start').hidden=s.host!==s.you||!['lobby','done'].includes(s.phase);
 $('pass').disabled=!canGuess||!s.again;
 $('table').replaceChildren();
 for(const p of s.players){
  const box=document.createElement('section');box.className='panel hand'+(s.turn===p.id&&s.phase==='play'?' turn':'');
  const h=document.createElement('h3');h.textContent=p.name+(p.id===s.you?' · 나':'')+(!p.connected?' · 연결 끊김':'')+(p.out||p.tiles.length&&p.tiles.every(t=>t.open)?' · 관전':'');box.append(h);
  if(s.phase==='setup'&&p.id!==s.you){const desc=document.createElement('p');desc.textContent=`타일 ${p.tileCount}개 · ${p.setupDone?'배치 완료':'배치 중'}`;box.append(desc);}
  const row=document.createElement('div');row.className='tiles';
  for(const [i,t] of p.tiles.entries()){
   const cell=document.createElement('div');cell.className='tile-cell';
   const picked=(s.selection?.tile===t.id)||choice?.tile===t.id;
   const last=(s.attempts||[]).at(-1),lastHit=last?.tile===t.id;

   const b=button(label(t.n),()=>{choice={player:p.id,tile:t.id};send({type:'select',...choice});render();},!canGuess||p.id===s.you||p.out||t.open);
   b.className='tile '+(t.color?'white':'black')+(t.open?' open':'')+(picked?' selected':'')+(t.n==='joker'?' joker':'')+(t.isNew?' new-tile':'')+(lastHit?(last.correct?' last-correct':' last-wrong'):'');
   b.setAttribute('aria-label',`${i+1}번째 ${t.color?'흰색':'검정'} 타일 ${label(t.n)}${t.isNew?' · 새로 가져온 타일':''}`);cell.append(b);
   const position=document.createElement('small');position.textContent=`${i+1}번${t.open?' · 공개':''}`;cell.append(position);
   if(picked){const tag=document.createElement('span');tag.className='selection-badge';const actor=s.players.find(x=>x.id===s.selection?.actor);tag.textContent=(actor&&actor.id!==s.you?actor.name:'내가')+' 선택 중';cell.append(tag);}
   if(lastHit){const result=document.createElement('span');result.className=last.correct?'correct-badge':'wrong-badge';result.textContent=`${last.correct?'✓':'✕'} ${label(last.guess)} ${last.correct?'정답':'오답'}`;cell.append(result);}
   if(t.wrongGuesses?.length){const note=document.createElement('small');note.className='wrong-notes';note.textContent='아닌 값: '+t.wrongGuesses.map(label).join(', ');cell.append(note);}
   if(t.isNew){const badge=document.createElement('span');badge.className='new-tile-badge';badge.textContent='새 타일';cell.append(badge);}
   if(s.phase==='setup'&&p.id===s.you&&t.n==='joker'&&!p.setupDone&&!p.out){
    const controls=document.createElement('div');controls.className='move-controls';
    controls.append(button('←',()=>send({type:'move-joker',tile:t.id,index:i-1}),i===0),button('→',()=>send({type:'move-joker',tile:t.id,index:i+1}),i===p.tiles.length-1));cell.append(controls);
   }
   row.append(cell);
  }
  box.append(row);$('table').append(box);
 }
 const placement=$('placement');placement.replaceChildren();placement.hidden=true;
 if(s.phase==='setup'&&me&&!me.out){placement.hidden=false;const note=document.createElement('p');note.textContent=me.setupDone?'배치 완료! 다른 참가자를 기다리고 있습니다.':'조커 아래 화살표로 위치를 정하세요. 조커가 없어도 배치 완료를 눌러주세요. 60초가 지나면 현재 배치로 확정됩니다.';placement.append(note,button(me.setupDone?'배치 완료됨':'배치 완료',()=>send({type:'setup-ready'}),me.setupDone));}
 if(s.pending){placement.hidden=false;const title=document.createElement('h3');title.textContent=`가져온 타일: ${s.pending.color?'흰색':'검정'} ${label(s.pending.n)}`;placement.append(title);const note=document.createElement('p');note.textContent=s.pending.n==='joker'?'원하는 틈을 선택하세요. 배치한 뒤에는 조커를 옮길 수 없습니다.':'숫자 순서를 지키는 틈 중 하나를 선택하세요. 기존 조커 위치는 유지됩니다.';placement.append(note);for(const i of s.pending.slots)placement.append(button(i===0?'맨 앞':i===me.tiles.length?'맨 뒤':`${i}번과 ${i+1}번 사이`,()=>send({type:'place',index:i})));}
 const selectionHint=$('selectionHint');
 const selectedPlayer=s.players.find(p=>p.id===(s.selection?.player||choice?.player));
 const selectedIndex=selectedPlayer?.tiles.findIndex(t=>t.id===(s.selection?.tile||choice?.tile));
 selectionHint.textContent=selectedPlayer&&selectedIndex>=0?`${selectedPlayer.name}의 ${selectedIndex+1}번 타일 선택 중 · 숫자 또는 조커를 누르세요.`:'상대의 숨겨진 타일을 먼저 선택하세요.';
 const history=$('attempts');history.replaceChildren();
 for(const a of [...(s.attempts||[])].reverse()){const item=document.createElement('li');item.className=a.correct?'attempt-correct':'attempt-wrong';item.textContent=`${a.actor===s.you?'나':a.actorName} → ${a.playerName}의 당시 ${a.position}번 타일 · ${label(a.guess)} 추리 → ${a.correct?'정답':'오답'}`;history.append(item);}
 $('historyEmpty').hidden=!!s.attempts?.length;
 $('numbers').replaceChildren();
 for(const n of [...Array(12).keys(),'joker']){
  const valid=canGuess&&s.players.some(p=>p.id===choice?.player&&p.tiles.some(t=>t.id===choice.tile&&!t.open));
  $('numbers').append(button(label(n),()=>{send({type:'guess',...choice,n});choice=null;},!valid));
 }
 updateClock();
}
function updateClock(){if(!state)return;$('clock').textContent=['setup','play'].includes(state.phase)?`남은 시간 ${Math.max(0,Math.ceil((state.deadline-Date.now())/1000))}초`:'';}
setInterval(updateClock,500);
try{const saved=JSON.parse(sessionStorage.getItem(key));if(saved)connect({type:'resume',code:saved.code,token:saved.token});}catch{sessionStorage.removeItem(key);}
