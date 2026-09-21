/* Battle-only rotation, spin detection and attack rules. Solo/score mode unchanged. */
(function(root){
 'use strict';
 const core=typeof module!=='undefined'&&module.exports?require('./block-game-core.js'):root.BlockGameCore;
 // Kick coordinates use x right, y up; convert y to board coordinates on use.
 const JL={
 '01':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],'10':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
 '12':[[0,0],[1,0],[1,-1],[0,2],[1,2]],'21':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
 '23':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],'32':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
 '30':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],'03':[[0,0],[1,0],[1,1],[0,-2],[1,-2]]};
 const IK={
 '01':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],'10':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
 '12':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],'21':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
 '23':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],'32':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
 '30':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],'03':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]]};
 function attackFor(lines,spin,allClear){if(allClear&&lines>0)return 10;if(spin==='full')return [0,2,4,6][lines]||0;if(spin==='mini')return lines?1:0;return [0,0,1,2,4][lines]||0;}
 class BattleGame extends core.Game{
  constructor(options={}){super(options);this.rules='battle';this.lastMove='';this.lastKick=0;this.events=[];this.lastAttack=null;}
  spawn(type){super.spawn(type);this.piece.rot=0;this.lastMove='';this.lastKick=0;}
  move(dx){const ok=super.move(dx);if(ok)this.lastMove='move';return ok;}
  softDrop(){const ok=super.softDrop();if(ok)this.lastMove='drop';return ok;}
  hardDrop(){if(this.status!=='playing')return;if(this.ghostY()!==this.piece.y)this.lastMove='drop';super.hardDrop();}
  rotate(direction=1){if(this.status!=='playing'||this.piece.type==='O')return false;const p=this.piece,n=p.m.length,old=p.m,from=p.rot||0,to=(from+(direction===1?1:3))%4;
   const m=old.map((r,y)=>r.map((_,x)=>direction===1?old[n-1-x][y]:old[x][n-1-y]));const ground=this.grounded(),kicks=(p.type==='I'?IK:JL)[''+from+to];
   for(let i=0;i<kicks.length;i++){const [dx,uy]=kicks[i];if(!this.collides(dx,-uy,m)){p.m=m;p.x+=dx;p.y-=uy;p.rot=to;this.resetLock(ground);this.lastMove='rotate';this.lastKick=i;return true;}}return false;
  }
  spin(){const p=this.piece;if(p.type!=='T'||this.lastMove!=='rotate')return '';
   const occupied=(x,y)=>x<0||x>=10||y<0||y>=22||!!this.board[y][x];
   const c=[[0,0],[2,0],[2,2],[0,2]].map(([x,y])=>occupied(p.x+x,p.y+y));if(c.filter(Boolean).length<3)return '';
   const front=[[0,1],[1,2],[2,3],[3,0]][p.rot||0];
   return c[front[0]]&&c[front[1]]||this.lastKick===4?'full':'mini';
  }
  lock(){if(this.status!=='playing')return;const spin=this.spin(),before=this.locks;super.lock();if(this.locks===before)return;
   const lines=this.lastClear,allClear=lines>0&&this.board.every(row=>row.every(v=>!v));
   // A three-line spin is full; mini without a clear sends zero.
   const detected=spin==='mini'&&lines>=2?'full':spin,attack=attackFor(lines,detected,allClear);
   const label=allClear?'PERFECT CLEAR':detected==='full'?'T-SPIN '+['','SINGLE','DOUBLE','TRIPLE'][lines]:detected==='mini'?'T-SPIN MINI':['','SINGLE','DOUBLE','TRIPLE','TETRIS'][lines];
   this.lastAttack={lock:this.locks,lines,spin:detected,allClear,attack,label};this.events.push({...this.lastAttack});
  }
  update(dt){let remaining=Math.max(0,Number(dt)||0);while(remaining>0&&this.status==='playing'){const step=Math.min(16,remaining),locks=this.locks,y=this.piece.y;super.update(step);if(this.locks===locks&&this.piece.y!==y)this.lastMove='fall';remaining-=step;}}
  addGarbage(holes){if(this.status!=='playing')return;let overflow=false;for(const hole of holes){if(this.board.shift().some(Boolean))overflow=true;this.board.push(Array.from({length:10},(_,x)=>x===hole?null:'G'));}
   if(overflow||this.collides())this.end('garbage');
  }
 }
 const api={BattleGame,attackFor};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BlockBattleCore=api;
})(typeof window!=='undefined'?window:globalThis);
