/* Run from repository root: node install-puyo.cjs. Only adds integration hooks. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),root=__dirname;
const serverFile=path.join(root,'game-server/server.cjs'),indexFile=path.join(root,'frontend/index.html');
let server=fs.readFileSync(serverFile,'utf8'),index=fs.readFileSync(indexFile,'utf8');
if(!server.includes('/* MONGLE_PUYO_SERVICE */')){
 const upgrade="server.on('upgrade',(req,socket,head)=>{";
 const close='function close(){';
 const asset=/const assets=new Set\(\[/;
 if(!server.includes(upgrade)||!server.includes(close)||!asset.test(server))throw Error('서버 구조가 다릅니다. 기존 서버는 수정하지 않았습니다. server.cjs에 attachPuyo 연동이 필요합니다.');
 server="'use strict';\nconst {attachPuyo}=require('./puyo-service.cjs'); /* MONGLE_PUYO_SERVICE */\n"+server;
 server=server.replace(asset,"const assets=new Set(['puyo-game.html','puyo-game.css','puyo-game.js','puyo-core.js','arcade.html',");
 server=server.replace(upgrade,"const puyoService=attachPuyo(server,{allowedOrigins});\n "+upgrade+"\n   if(req.url==='/puyo-ws')return;");
 server=server.replace(close,close+'puyoService.close();');
 server=server.replace('ok:true,protocol:', 'ok:true,puyoProtocol:1,protocol:');
 server=server.replace('return{server,wss,manager,close};','return{server,wss,manager,puyoService,close};');
}
if(!index.includes('href="arcade.html"'))index=index.replace('<div class="top-actions">','<div class="top-actions">\n      <a href="arcade.html" class="btn btn-light" style="text-decoration:none">몽글 아케이드 ↗</a>');
if(!index.includes('id="arcadeWhileLoading"'))index=index.replace('<h2 id="startupTitle">','<a id="arcadeWhileLoading" href="arcade.html" style="display:block;margin:12px;color:#8874c8">기다리는 동안 몽글 아케이드 ↗</a>\n      <h2 id="startupTitle">');
fs.writeFileSync(serverFile,server);fs.writeFileSync(indexFile,index);
for(const name of ['block-game.html','block-online.html','dodge-game.html','text-art.html']){const file=path.join(root,'frontend',name);if(!fs.existsSync(file))continue;let s=fs.readFileSync(file,'utf8');if(!s.includes('href="arcade.html"'))s=s.replace(/(<nav\b[^>]*>)/,'$1<a href="arcade.html">게임 로비</a><a href="puyo-game.html">몽글 젤리</a>');fs.writeFileSync(file,s);}
console.log('몽글 젤리 연결 완료: frontend/puyo-game.html + /puyo-ws. 기존 게임 서버와 정적 사이트를 모두 배포해주세요.');
