'use strict';
const {WebSocketServer}=require('ws'),{randomUUID,randomInt}=require('node:crypto');
const core=require('./code-core.cjs');
function attachCode(server,{allowedOrigins='' }={}){
 const rooms=new Map(),wss=new WebSocketServer({noServer:true,maxPayload:2048});
 const send=(w,m)=>{if(w.readyState===1)w.send(JSON.stringify(m));};
 const {alive,finish,next,fail,view}=core;
 function publish(r){for(const p of r.players)if(p.ws)send(p.ws,view(r,p));}
 server.on('upgrade',(req,socket,head)=>{if(req.url!=='/code-ws')return;const allowed=new Set(allowedOrigins.split(',').map(s=>s.trim()));allowed.add('https://'+req.headers.host);allowed.add('http://'+req.headers.host);if(!allowed.has(req.headers.origin)||wss.clients.size>=200){socket.destroy();return;}wss.handleUpgrade(req,socket,head,w=>wss.emit('connection',w));});
 wss.on('connection',w=>{let room,player,count=0,at=Date.now();const joinTimer=setTimeout(()=>{if(!room)w.close();},30000);
 w.on('message',data=>{try{if(Date.now()-at>1000){at=Date.now();count=0;}if(++count>20)throw Error('요청이 너무 빠릅니다.');const m=JSON.parse(data);if(!m||typeof m!=='object')throw Error('잘못된 요청');
 if(['create','join','resume'].includes(m.type)){if(m.version!==3)throw Error('게임 페이지를 새로고침해주세요.');if(room)throw Error('이미 입장했습니다.');let r;
 if(m.type==='create'){if(rooms.size>=100)throw Error('방이 가득 찼습니다.');let code;do{code=String(randomInt(100000,1000000));}while(rooms.has(code));r={code,phase:'lobby',players:[],deck:[],log:'친구를 초대하세요.',again:false};rooms.set(code,r);}else r=rooms.get(String(m.code));if(!r)throw Error('방을 찾을 수 없습니다.');
 let p;if(m.type==='resume'){p=r.players.find(p=>p.token===m.token);if(!p||p.ws)throw Error('재접속할 수 없습니다.');}else{if(r.phase!=='lobby'||r.players.length>=6)throw Error('진행 중이거나 정원이 찼습니다.');p={id:randomUUID(),token:randomUUID(),name:String(m.name||'플레이어').trim().slice(0,16)||'플레이어',tiles:[],out:false};r.players.push(p);if(!r.host)r.host=p.id;}
 room=r;player=p;p.ws=w;p.gone=null;clearTimeout(joinTimer);send(w,{type:'joined',code:r.code,token:p.token});publish(r);return;}
 if(!room)throw Error('먼저 입장하세요.');const r=room,p=player;
 if(r.announcement)throw Error('추리 공개 중입니다. 2초만 기다려주세요.');
 if(m.type==='leave'){p.out=true;p.tiles.forEach(t=>t.open=true);p.ws=null;if(r.phase==='play'){if(r.turn===p.id){r.pending=null;next(r);}else finish(r);}else if(r.phase==='setup'){if(r.players.every(x=>x.out||x.setupDone))core.begin(r);}else r.players=r.players.filter(x=>x!==p);if(r.host===p.id)r.host=r.players.find(x=>x.ws)?.id;r.log=p.name+' 퇴장';publish(r);room=null;player=null;send(w,{type:'left'});return;}
 if(m.type==='start'){
 if(r.host!==p.id||!['lobby','done'].includes(r.phase))throw Error('대기실이나 결과 화면에서 방장만 시작할 수 있습니다.');
 const connected=r.players.filter(x=>x.ws);if(connected.length<2)throw Error('2명 이상 필요합니다.');r.players=connected;core.start(r);
 }else if(m.type==='move-joker')core.moveJoker(r,p,m.tile,m.index);
 else if(m.type==='setup-ready')core.ready(r,p);
 else if(m.type==='guess')core.submitGuess(r,p,m);
 else core.action(r,p,m);
 publish(r);
 }catch(e){send(w,{type:'error',message:e.message});}});
 w.on('close',()=>{clearTimeout(joinTimer);if(player&&player.ws===w){player.ws=null;player.gone=Date.now();publish(room);}});w.on('error',()=>{});
 });
 const timer=setInterval(()=>{for(const r of rooms.values()){
 let changed=false;
 if(r.announcement){if(core.resolveGuess(r))publish(r);continue;}
 if(!r.players.some(p=>p.ws)){r.emptySince??=Date.now();if(Date.now()-r.emptySince>120000){rooms.delete(r.code);continue;}}else r.emptySince=null;
 for(const p of r.players)if(!p.ws&&p.gone&&Date.now()-p.gone>60000&&!p.out){p.out=true;p.tiles.forEach(t=>t.open=true);changed=true;if(r.host===p.id)r.host=r.players.find(x=>x.ws)?.id;if(r.phase==='lobby')r.players=r.players.filter(x=>x!==p);}
 if(r.phase==='setup'&&(Date.now()>r.deadline||r.players.every(x=>x.out||x.setupDone))){r.players.forEach(p=>p.setupDone=true);core.begin(r);changed=true;}
 if(r.phase==='play'){if(finish(r))changed=true;else if(!alive(r.players.find(p=>p.id===r.turn))){r.pending=null;next(r);changed=true;}else if(Date.now()>r.deadline){fail(r,r.players.find(p=>p.id===r.turn));changed=true;}}
 if(changed)publish(r);
 }},100);
 return {rooms,close(){clearInterval(timer);for(const w of wss.clients)w.terminate();wss.close();}};
}
module.exports={attachCode};
