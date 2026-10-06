'use strict';
const {randomBytes}=require('node:crypto');
const {options,generate,nextCell}=require('./maze-core.cjs');
const fail=message=>{throw Error(message);},token=()=>randomBytes(20).toString('hex');
class MazeRooms{
  constructor({now=()=>Date.now(),countdown=3000,grace=20000}={}){this.now=now;this.countdown=countdown;this.grace=grace;this.rooms=new Map();}
  create(c,name,settings){if(c.room)fail('현재 방에서 먼저 나가주세요.');if(this.rooms.size>=100)fail('방이 가득 찼어요.');const config=options(settings);let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(this.rooms.has(code));const r={code,settings:config,players:[],host:null,phase:'waiting',round:0,map:null,startAt:0,finishedAt:0,created:this.now()};this.rooms.set(code,r);try{this.join(c,code,name);}catch(e){this.rooms.delete(code);throw e;}return r;}
  join(c,code,name){if(c.room)fail('현재 방에서 먼저 나가주세요.');const r=this.rooms.get(String(code).toUpperCase());if(!r)fail('미로 방을 찾을 수 없어요.');if(r.phase!=='waiting')fail('이미 시작한 경기예요.');if(r.players.length>=4)fail('최대 4명까지 입장할 수 있어요.');name=typeof name==='string'?name.trim().replace(/[\x00-\x1f\x7f]/g,'').slice(0,16):'';if(!name)fail('닉네임을 입력해주세요.');const p={id:token(),token:token(),name,client:c,ready:false,color:[0,1,2,3].find(i=>!r.players.some(p=>p.color===i)),disconnectedAt:null,status:'waiting',cell:0,seq:0,direction:-1,inputAt:0,nextMove:0,consumed:new Set(),event:null,finishAt:null,steps:0,watch:null};r.players.push(p);r.host||=p.id;c.room=r;c.player=p;c.mapRound=null;return p;}
  resume(c,code,secret){if(c.room)fail('이미 접속했어요.');const r=this.rooms.get(String(code).toUpperCase()),p=r?.players.find(p=>p.token===secret);if(!p||p.disconnectedAt!==null&&this.now()-p.disconnectedAt>this.grace)fail('재접속 시간이 지났어요.');if(p.client)fail('이미 다른 연결에서 접속 중이에요.');p.client=c;p.disconnectedAt=null;p.direction=-1;c.room=r;c.player=p;c.mapRound=null;this.host(r);return p;}
  host(r){if(!r.players.some(p=>p.id===r.host&&p.client))r.host=r.players.find(p=>p.client)?.id||null;}
  settings(c,value){const r=c.room;if(!r||r.host!==c.player.id||r.phase!=='waiting')fail('방장이 대기실에서만 설정할 수 있어요.');r.settings=options(value);for(const p of r.players)p.ready=false;}
  ready(c,value){if(c.room?.phase!=='waiting')fail('대기실에서만 준비할 수 있어요.');c.player.ready=value===true;}
  start(c){const r=c.room;if(!r||r.host!==c.player.id)fail('방장만 시작할 수 있어요.');if(r.phase!=='waiting'||r.players.length<2||r.players.some(p=>!p.client||!p.ready))fail('2명 이상이 연결하고 모두 준비해주세요.');r.map=generate(r.settings);r.round++;r.phase='countdown';r.startAt=this.now()+this.countdown;r.finishedAt=0;for(const p of r.players){Object.assign(p,{status:'racing',cell:r.map.start,steps:0,seq:0,direction:-1,inputAt:0,nextMove:r.startAt,finishAt:null,watch:null,event:null});p.consumed=new Set();}}
  input(c,m){const r=c.room,p=c.player;if(!r||r.phase!=='playing'||p.status!=='racing'||m.round!==r.round||!Number.isSafeInteger(m.seq)||m.seq<=p.seq||m.seq>p.seq+1000||!Number.isInteger(m.direction)||m.direction< -1||m.direction>3)return;p.seq=m.seq;p.direction=m.direction;p.inputAt=this.now();this.move(r,p,this.now());this.complete(r);}
  move(r,p,now){const direction=p.direction;p.direction=-1;if(p.status!=='racing'||!p.client||direction<0||now<p.nextMove)return;p.nextMove=now+30;
   // One command resolves one straight-axis dash immediately. Corners need a new command.
   for(let i=0;i<Math.max(r.map.width,r.map.height);i++){const previous=p.cell,next=nextCell(r.map,previous,direction);if(next===previous)return;p.cell=next;p.steps++;
    if(r.map.traps.includes(next)&&!p.consumed.has(next)){p.consumed.add(next);p.cell=r.map.start;p.direction=-1;p.event={at:now,text:'귀환 상자! 출발지로 돌아왔어요.'};return;}
    if(p.cell===r.map.exit){p.status='finished';p.finishAt=now;p.direction=-1;p.event={at:now,text:'출구 도착! 다른 선수의 경기를 관전하세요.'};return;}
    const onward=[0,1,2,3].filter(d=>{const cell=nextCell(r.map,next,d);return cell!==next&&cell!==previous;});
    if(onward.length!==1||onward[0]!==direction)return;
   }
  }
  watch(c,id){const r=c.room,p=c.player;if(!r||p.status==='racing')fail('도착하거나 포기한 뒤 관전할 수 있어요.');if(!r.players.some(p=>p.id===id&&p.status==='racing'))fail('관전할 선수가 없어요.');p.watch=id;}
  giveup(c){if(c.room?.phase!=='playing'||c.player.status!=='racing')return;c.player.status='dnf';c.player.direction=-1;this.complete(c.room);}
  complete(r){if(r.phase==='playing'&&r.players.every(p=>p.status!=='racing')){r.phase='finished';r.finishedAt=this.now();}}
  rematch(c){const r=c.room;if(!r||r.host!==c.player.id||r.phase!=='finished')fail('경기 종료 후 방장이 재대결할 수 있어요.');r.players=r.players.filter(p=>p.client);r.phase='waiting';r.map=null;r.startAt=0;r.finishedAt=0;r.created=this.now();for(const p of r.players){p.ready=false;p.status='waiting';p.finishAt=null;p.steps=0;p.event=null;p.direction=-1;p.watch=null;}this.host(r);}
  disconnect(c,explicit=false){const r=c.room,p=c.player;if(!r||p.client!==c)return;p.client=null;p.disconnectedAt=this.now();p.direction=-1;p.ready=false;c.room=c.player=null;if(explicit){p.token=token();p.disconnectedAt=this.now()-this.grace-1;if(p.status==='racing')p.status='dnf';}
    if(r.phase==='countdown'){r.phase='waiting';r.map=null;r.startAt=0;for(const x of r.players){x.ready=false;x.status='waiting';}}
    if(explicit&&r.phase==='waiting')r.players=r.players.filter(x=>x!==p);this.host(r);this.complete(r);if(!r.players.length)this.rooms.delete(r.code);
  }
  tick(){const now=this.now();for(const r of this.rooms.values()){
    for(const p of r.players)if(!p.client&&now-p.disconnectedAt>this.grace){if(p.status==='racing')p.status='dnf';if(r.phase==='waiting')r.players=r.players.filter(x=>x!==p);}
    this.host(r);if(!r.players.length||r.players.every(p=>!p.client&&now-p.disconnectedAt>this.grace)){this.rooms.delete(r.code);continue;}
    if(r.phase==='countdown'&&now>=r.startAt)r.phase='playing';
    if(r.phase==='playing'){for(const p of r.players)this.move(r,p,now);this.complete(r);}
    if(r.phase==='waiting'&&now-r.created>7200000||r.phase==='finished'&&now-r.finishedAt>1800000){for(const p of r.players)if(p.client){p.client.send({type:'expired',message:'오래 사용하지 않은 방이 종료됐어요.'});p.client.room=p.client.player=null;}this.rooms.delete(r.code);}
  }}
  view(c){const r=c.room;if(!r)return null;const own=c.player,watch=own.status==='racing'?own:r.players.find(p=>p.id===own.watch&&p.status==='racing')||r.players.find(p=>p.status==='racing')||own;
    const arrivals=r.players.filter(p=>p.finishAt!==null).sort((a,b)=>a.finishAt-b.finishAt),rank=p=>p.finishAt===null?null:arrivals.findIndex(x=>x.finishAt===p.finishAt)+1;
    const visible=p=>!r.settings.extreme||r.phase!=='playing'||p.id===watch.id||Math.hypot(p.cell%r.settings.width-watch.cell%r.settings.width,Math.floor(p.cell/r.settings.width)-Math.floor(watch.cell/r.settings.width))<=3.5;
    const map=r.map&&c.mapRound!==r.round?r.map:null;if(map)c.mapRound=r.round;
    return{type:'state',game:'maze',version:1,now:this.now(),code:r.code,phase:r.phase,round:r.round,host:r.host,you:own.id,settings:r.settings,startAt:r.startAt,finishedAt:r.finishedAt,map,watchId:watch.id,focus:watch.cell,consumed:[...watch.consumed],event:own.event,ack:own.seq,players:r.players.map(p=>({id:p.id,name:p.name,color:p.color,ready:p.ready,connected:!!p.client,status:p.status,cell:visible(p)?p.cell:null,steps:p.steps,finishAt:p.finishAt,rank:rank(p)}))};
  }
}
module.exports={MazeRooms};
