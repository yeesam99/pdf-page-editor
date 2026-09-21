'use strict';
const {randomBytes}=require('node:crypto');
const {Game}=require('../frontend/block-game-core.js');
const {BattleGame}=require('../frontend/block-battle-core.js');
const {apply,snapshot,ranking,ACTIONS}=require('../frontend/block-online-engine.js');
const token=()=>randomBytes(24).toString('hex');
const fail=message=>{throw new Error(message);};
class Rooms{
  constructor({now=()=>Date.now(),duration=180000,countdown=3000,grace=20000}={}){this.now=now;this.duration=duration;this.countdown=countdown;this.grace=grace;this.rooms=new Map();}
  create(client,name,mode='score'){if(!['score','battle'].includes(mode))fail('지원하지 않는 게임 모드예요.');if(this.rooms.size>=100)fail('현재 방이 가득 찼어요. 잠시 후 다시 시도해주세요.');let code;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(this.rooms.has(code));const room={code,mode,phase:'waiting',players:[],host:null,startAt:0,endAt:0,lastTick:0,created:this.now(),round:0,winnerIds:[]};this.rooms.set(code,room);try{this.join(client,code,name);}catch(e){this.rooms.delete(code);throw e;}return room;}
  join(client,code,name){
    if(client.room)fail('먼저 현재 방에서 나가주세요.');const room=this.rooms.get(String(code).toUpperCase());if(!room)fail('방을 찾을 수 없어요. 코드를 확인해주세요.');
    if(room.phase!=='waiting')fail('이미 시작한 방이에요. 경기가 끝난 뒤 입장해주세요.');if(room.players.length>=4)fail('방 인원은 최대 4명이에요.');
    const nickname=typeof name==='string'?name.trim().replace(/[\x00-\x1f\x7f]/g,'').slice(0,16):'';if(!nickname)fail('닉네임을 입력해주세요.');
    const p={id:randomBytes(8).toString('hex'),token:token(),name:nickname,client,ready:false,game:null,ack:0,disconnectedAt:null,lastInput:-Infinity};
    room.players.push(p);room.host||=p.id;client.room=room;client.player=p;return p;
  }
  resume(client,code,secret){if(client.room)fail('이미 방에 연결되어 있어요.');const room=this.rooms.get(String(code).toUpperCase());const p=room?.players.find(p=>p.token===secret);if(!p||p.disconnectedAt!==null&&this.now()-p.disconnectedAt>this.grace)fail('재접속 시간이 지났거나 방이 종료됐어요.');if(p.client)fail('이미 다른 연결에서 접속 중이에요.');p.client=client;p.disconnectedAt=null;client.room=room;client.player=p;this.host(room);return p;}
  host(room){if(!room.players.some(p=>p.id===room.host&&p.client))room.host=room.players.find(p=>p.client)?.id||room.players[0]?.id||null;}
  ready(client,ready){const room=client.room,p=client.player;if(!room||room.phase!=='waiting')fail('대기실에서만 준비할 수 있어요.');p.ready=ready===true;}
  start(client){const r=client.room;if(!r||r.host!==client.player.id)fail('방장만 시작할 수 있어요.');if(r.phase!=='waiting'||r.players.length<2||r.players.some(p=>!p.client||!p.ready))fail('2명 이상, 모두 연결하고 준비해야 시작할 수 있어요.');r.phase='countdown';r.round++;r.winnerIds=[];r.startAt=this.now()+this.countdown;r.endAt=r.mode==='battle'?0:r.startAt+this.duration;r.lastTick=r.startAt;const seed=token();for(const [i,p] of r.players.entries()){p.game=new (r.mode==='battle'?BattleGame:Game)({mode:'classic',seed});p.ack=0;p.lastInput=-Infinity;p.incoming=[];p.sent=0;p.cancelled=0;p.finishAt=null;p.targetCursor=(i+1)%r.players.length;p.lastEvent=null;}}
  input(client,msg){const r=client.room,p=client.player;if(!r||r.phase!=='playing'||msg.round!==r.round||!Number.isSafeInteger(msg.seq)||msg.seq<=p.ack||msg.seq>p.ack+1000||!ACTIONS.includes(msg.action))return;
    // Strictly use server time and state. Never trust a posted board or score.
    if(r.mode!=='battle'&&this.now()>=r.endAt){this.finish(r);return;}p.ack=msg.seq;if(this.now()-p.lastInput<12)return;p.lastInput=this.now();apply(p.game,msg.action);if(r.mode==='battle'){this.resolveAttacks(r);this.markDeaths(r);}
  }
  finish(r){if(r.phase==='finished')return;if(r.mode==='battle'){this.markDeaths(r);r.winnerIds=r.players.filter(p=>p.game?.status==='playing').map(p=>p.id);}for(const p of r.players)if(p.game?.status==='playing')p.game.end(r.mode==='battle'?'win':'time');r.phase='finished';r.finishedAt=this.now();}
  markDeaths(r){const at=this.now();for(const p of r.players)if(p.game?.status==='over'&&p.game.reason!=='win'&&p.finishAt===null)p.finishAt=at;}
  target(r,p){for(let i=0;i<r.players.length;i++){const index=(p.targetCursor+i)%r.players.length,t=r.players[index];if(t!==p&&t.game?.status==='playing')return{player:t,next:(index+1)%r.players.length};}return null;}
  resolveAttacks(r){
    const locked=[];
    for(const p of r.players){const events=p.game?.events||[];p.game.events=[];for(const event of events){
      locked.push(p);let lines=event.attack,cancelled=0;
      while(lines&&p.incoming.length){const batch=p.incoming[0],n=Math.min(lines,batch.lines);lines-=n;batch.lines-=n;cancelled+=n;if(!batch.lines)p.incoming.shift();}
      p.cancelled+=cancelled;let sent=0,targetName='';
      if(lines&&p.game.status==='playing'){const target=this.target(r,p);if(target){const t=target.player;sent=Math.min(lines,Math.max(0,60-t.incoming.reduce((sum,b)=>sum+b.lines,0)));if(sent){t.incoming.push({lines:sent,hole:randomBytes(1)[0]%10,readyAt:this.now()+1000});p.targetCursor=target.next;p.sent+=sent;targetName=t.name;}}}
      if(event.label||cancelled)p.lastEvent={...event,cancelled,sent,targetName,at:this.now()};
    }}
    // Rise only after a piece locks. Incoming attacks first have a 1s counter window.
    for(const p of new Set(locked)){const holes=[];while(p.incoming.length&&holes.length<8&&p.incoming[0].readyAt<=this.now()){const b=p.incoming[0],n=Math.min(b.lines,8-holes.length);for(let i=0;i<n;i++)holes.push(b.hole);b.lines-=n;if(!b.lines)p.incoming.shift();}if(holes.length)p.game.addGarbage(holes);}
  }
  rematch(client){const r=client.room;if(!r||r.host!==client.player.id||r.phase!=='finished')fail('방장이 경기 종료 후 대기실로 돌아갈 수 있어요.');r.players=r.players.filter(p=>p.client);r.phase='waiting';r.startAt=r.endAt=0;for(const p of r.players){p.ready=false;p.game=null;p.ack=0;}this.host(r);}
  disconnect(client,explicit=false){const r=client.room,p=client.player;if(!r||p.client!==client)return;p.client=null;p.disconnectedAt=this.now();client.room=null;client.player=null;
    if(explicit){p.token=token();p.disconnectedAt=this.now()-this.grace-1;if(p.game?.status==='playing')p.game.end('left');if(r.mode==='battle')this.markDeaths(r);}
    if(r.phase==='countdown'){r.phase='waiting';for(const other of r.players){other.ready=false;other.game=null;}r.startAt=r.endAt=0;}
    p.ready=false;if(explicit&&r.phase==='waiting')r.players=r.players.filter(x=>x!==p);this.host(r);if(!r.players.length)this.rooms.delete(r.code);
  }
  tick(){const now=this.now();for(const r of this.rooms.values()){
    for(const p of r.players)if(!p.client&&p.disconnectedAt!==null&&now-p.disconnectedAt>this.grace){if(p.game?.status==='playing')p.game.end('disconnect');if(r.phase==='waiting')r.players=r.players.filter(x=>x!==p);}
    this.host(r);if(!r.players.length||r.players.every(p=>!p.client&&now-p.disconnectedAt>this.grace)){this.rooms.delete(r.code);continue;}
    if(r.phase==='countdown'&&now>=r.startAt)r.phase='playing';
    if(r.phase==='playing'){
      const target=r.mode==='battle'?now:Math.min(now,r.endAt);let delta=target-r.lastTick;r.lastTick=target;
      // Catch up gravity with short steps, bounded for a stalled server.
      delta=Math.min(1000,Math.max(0,delta));while(delta>0){const step=Math.min(16,delta);for(const p of r.players)if(p.game?.status==='playing')p.game.update(step);if(r.mode==='battle'){this.resolveAttacks(r);this.markDeaths(r);}delta-=step;}
      if(r.mode==='battle'){this.markDeaths(r);if(r.players.filter(p=>p.game?.status==='playing').length<=1)this.finish(r);}else if(now>=r.endAt||r.players.every(p=>p.game?.status==='over'))this.finish(r);
    }
    // Connected but abandoned lobbies/results cannot occupy memory indefinitely.
    if(r.phase==='waiting'&&now-r.created>7200000||r.phase==='finished'&&now-r.finishedAt>1800000){for(const p of r.players)if(p.client){p.client.send({type:'expired',message:'오래 사용하지 않은 방이 종료됐어요.'});p.client.room=null;p.client.player=null;}this.rooms.delete(r.code);}
  }}
  view(client){const r=client.room;if(!r)return null;let players=r.players.map(p=>({id:p.id,name:p.name,ready:p.ready,connected:!!p.client,score:p.game?.score||0,lines:p.game?.lines||0,level:p.game?.level||1,status:p.game?.status||'waiting',reason:p.game?.reason||'',board:p.game?.board||null,piece:p.game?.piece||null,incoming:(p.incoming||[]).reduce((n,b)=>n+b.lines,0),sent:p.sent||0,cancelled:p.cancelled||0,finishAt:p.finishAt??null}));
    if(r.mode==='battle'){players.sort((a,b)=>(b.finishAt??Infinity)-(a.finishAt??Infinity)||a.id.localeCompare(b.id));let rank=1;players=players.map((p,i)=>{if(i&&p.finishAt!==players[i-1].finishAt)rank=i+1;return{...p,rank};});}else players=ranking(players);
    const own=client.player,target=r.mode==='battle'&&own.game?this.target(r,own):null;
    return{type:'state',protocol:2,now:this.now(),code:r.code,mode:r.mode,phase:r.phase,round:r.round,host:r.host,you:own.id,startAt:r.startAt,endAt:r.endAt,finishedAt:r.finishedAt||0,duration:this.duration,winnerIds:r.winnerIds,players,own:snapshot(own.game),ack:own.ack,lastEvent:own.lastEvent||null,targetId:target?.player.id||null};}
}
module.exports={Rooms};
