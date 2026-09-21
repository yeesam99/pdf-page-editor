const assert=require('node:assert/strict');
const {Game,SHAPES}=require('../../frontend/block-game-core.js');
function sequence(seed){const g=new Game({seed});const out=[];for(let i=0;i<100;i++){out.push(g.piece.type);g.spawn();}return out;}
assert.deepEqual(sequence('FRIENDS'),sequence('FRIENDS'));
assert.notDeepEqual(sequence('FRIENDS'),sequence('OTHER'));
const seq=sequence('FRIENDS');for(let i=0;i<91;i+=7)assert.equal(new Set(seq.slice(i,i+7)).size,7,'every bag contains all 7 shapes');
let g=new Game();for(let i=0;i<20;i++)g.move(-1);assert.equal(g.collides(),false);assert.equal(g.move(-1),false);for(let i=0;i<20;i++)g.move(1);assert.equal(g.collides(),false);
for(let i=0;i<4;i++)g.rotate();assert.equal(g.collides(),false);
g=new Game();const first=g.piece.type;assert.ok(g.hold());assert.equal(g.held,first);assert.equal(g.hold(),false);const gy=g.ghostY(),startY=g.piece.y;g.hardDrop();assert.equal(g.locks,1);assert.ok(g.canHold);assert.equal(g.score,(gy-startY)*2);assert.ok(g.hold());assert.equal(g.piece.type,first);
g=new Game();g.piece={type:'O',m:SHAPES.O,x:4,y:20};for(let y=20;y<22;y++)g.board[y]=Array.from({length:10},(_,x)=>x===4||x===5?null:'I');g.lock();assert.equal(g.lines,2);assert.equal(g.score,300);assert.ok(g.board.every(r=>r.every(v=>!v)));
g=new Game();g.lines=9;g.piece={type:'I',m:[[1,1,1,1]],x:3,y:21};g.board[21]=Array.from({length:10},(_,x)=>x>=3&&x<=6?null:'T');g.lock();assert.equal(g.level,2);assert.equal(g.lines,10);assert.equal(g.score,100);
g=new Game();g.piece={type:'O',m:SHAPES.O,x:4,y:20};g.update(240);g.update(240);assert.equal(g.locks,0);g.move(1);g.update(240);assert.equal(g.locks,0);g.update(240);g.update(21);assert.equal(g.locks,1,'500ms lock delay');
g=new Game({mode:'challenge'});g.update(1000);g.pause();const elapsed=g.elapsed,piece=JSON.stringify(g.piece);g.update(999999);g.move(1);g.rotate();g.hardDrop();g.hold();assert.equal(g.elapsed,elapsed);assert.equal(JSON.stringify(g.piece),piece);g.resume();g.update(179000);assert.equal(g.status,'over');assert.equal(g.reason,'time');assert.equal(g.elapsed,180000);
g=new Game();g.board[1].fill('I');g.spawn('O');assert.equal(g.status,'over');assert.equal(g.reason,'topout');
g=new Game();g.piece={type:'O',m:SHAPES.O,x:4,y:0};g.lock();assert.equal(g.status,'over','hidden row lock topout');
// Random action runs exercise collision/lock invariants at walls and tall stacks.
for(let k=0;k<20;k++){g=new Game({seed:'fuzz'+k});for(let i=0;i<1000&&g.status==='playing';i++){const a=(i*17+k*3)%7;if(a<2)g.move(a===0?-1:1);else if(a===2)g.rotate();else if(a===3)g.rotate(-1);else if(a===4)g.hold();else if(a===5)g.softDrop();else g.hardDrop();g.update(33);if(g.status==='playing')assert.equal(g.collides(),false);assert.equal(g.board.length,22);assert.ok(g.board.every(r=>r.length===10));}}
console.log('PASS engine: seeded 7-bag, movement/wall rotation, hold limit, ghost/drop, clears/scoring/levels, lock delay, challenge timer/pause, topout, 20 randomized action runs');
