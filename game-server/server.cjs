'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {performance}=require('node:perf_hooks');
const {WebSocketServer,WebSocket}=require('ws');
const {Rooms}=require('./rooms.cjs');
const base=Date.now()-performance.now();
function createServer({roomOptions={},allowedOrigins=process.env.ALLOWED_ORIGINS||''}={}){
 const manager=new Rooms({now:()=>base+performance.now(),...roomOptions});
 const assets=new Set(['block-online.html','block-online.css','block-online.js','block-online-config.js','block-online-engine.js','block-battle-core.js','block-game-core.js','block-game.html','block-game.css','block-game.js']);
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
 const server=http.createServer((req,res)=>{let url;try{url=new URL(req.url,'http://localhost');}catch{res.writeHead(400).end();return;}
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');
   if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true}));return;}
   const file=url.pathname==='/'?'block-online.html':url.pathname.slice(1);if(!assets.has(file)||!['GET','HEAD'].includes(req.method)){res.writeHead(404).end('Not found');return;}
   fs.readFile(path.join(__dirname,'../frontend',file),(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]});res.end(req.method==='HEAD'?undefined:data);});
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
   const allowed=new Set(allowedOrigins.split(',').map(s=>s.trim()).filter(Boolean));allowed.add('http://'+req.headers.host);allowed.add('https://'+req.headers.host);
   if(req.url!=='/ws'||!allowed.has(req.headers.origin)||wss.clients.size>=400){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
   wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
 });
 function send(ws,value){if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>1024*1024){ws.close(1013,'Slow connection');return;}ws.send(JSON.stringify(value));}}
 function broadcast(room){if(room)for(const p of room.players)if(p.client)p.client.send(manager.view(p.client));}
 wss.on('connection',ws=>{
   const client={room:null,player:null,send:value=>send(ws,value)};let alive=true,windowAt=Date.now(),count=0;
   const helloTimer=setTimeout(()=>{if(!client.room)ws.close(1000,'Join timeout');},30000);
   ws.on('pong',()=>alive=true);ws.checkAlive=()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();};
   ws.on('message',(data,binary)=>{if(binary){ws.close(1003);return;}if(Date.now()-windowAt>=1000){windowAt=Date.now();count=0;}if(++count>100){ws.close(1008,'Too many messages');return;}
     let m;try{m=JSON.parse(data.toString());if(!m||typeof m!=='object'||Array.isArray(m))throw Error();}catch{send(ws,{type:'error',message:'잘못된 요청이에요.'});return;}
     try{
       manager.tick();
       if(m.type==='ping'){send(ws,{type:'pong',sent:m.sent,now:manager.now()});return;}
       if(m.type==='create'||m.type==='join'||m.type==='resume'){
         const battleRequest=m.type==='create'?m.mode==='battle':manager.rooms.get(String(m.code).toUpperCase())?.mode==='battle';
         if(battleRequest&&m.protocol!==2)throw Error('공격 대전은 페이지를 새로고침한 뒤 입장해주세요.');
         if(m.type==='create')manager.create(client,m.name,m.mode);else if(m.type==='join')manager.join(client,m.code,m.name);else manager.resume(client,m.code,m.token);
         clearTimeout(helloTimer);send(ws,{type:'joined',code:client.room.code,you:client.player.id,token:client.player.token});broadcast(client.room);return;
       }
       if(!client.room)throw Error('먼저 방에 입장해주세요.');
       switch(m.type){case'ready':manager.ready(client,m.ready);break;case'start':manager.start(client);break;case'rematch':manager.rematch(client);break;
         case'input':manager.input(client,m);client.send(manager.view(client));return;
         case'leave':{const r=client.room;manager.disconnect(client,true);send(ws,{type:'left'});broadcast(r);return;}
         default:throw Error('지원하지 않는 요청이에요.');}
       broadcast(client.room);
     }catch(e){send(ws,{type:'error',message:e.message});}
   });
   ws.on('close',()=>{clearTimeout(helloTimer);const r=client.room;manager.disconnect(client);broadcast(r);});ws.on('error',()=>{});
 });
 const simulation=setInterval(()=>manager.tick(),16);
 const stateTimer=setInterval(()=>{for(const r of manager.rooms.values())broadcast(r);},100);
 const heartbeat=setInterval(()=>{for(const ws of wss.clients)ws.checkAlive?.();},10000);
 function close(){clearInterval(simulation);clearInterval(stateTimer);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();wss.close();return new Promise(resolve=>server.close(resolve));}
 return{server,wss,manager,close};
}
if(require.main===module){const app=createServer();app.server.listen(Number(process.env.PORT)||3001,'0.0.0.0',()=>console.log('Mongle online server listening on '+app.server.address().port));for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.close().then(()=>process.exit(0)));}
module.exports={createServer};
