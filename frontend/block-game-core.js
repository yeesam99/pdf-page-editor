/* Original falling-block game engine. Browser + Node; no external dependencies. */
(function(root){
  'use strict';
  const SHAPES={I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],O:[[1,1],[1,1]],T:[[0,1,0],[1,1,1],[0,0,0]],S:[[0,1,1],[1,1,0],[0,0,0]],Z:[[1,1,0],[0,1,1],[0,0,0]],J:[[1,0,0],[1,1,1],[0,0,0]],L:[[0,0,1],[1,1,1],[0,0,0]]};
  const TYPES=Object.keys(SHAPES);
  function hash(text){let n=2166136261;for(const c of String(text)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
  function random(seed){let n=hash(seed);return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
  class Game{
    constructor({mode='classic',seed='CLOUD'}={}){
      this.mode=mode;this.seed=String(seed);this.rng=random(this.seed);this.board=Array.from({length:22},()=>Array(10).fill(null));
      this.queue=[];this.held=null;this.canHold=true;this.score=0;this.lines=0;this.level=1;this.elapsed=0;this.gravity=0;this.lockTime=0;this.resets=0;this.status='playing';this.reason='';this.lastClear=0;this.locks=0;this.combo=-1;
      this.fillQueue();this.spawn();
    }
    fillQueue(){while(this.queue.length<8){const bag=TYPES.slice();for(let i=bag.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}this.queue.push(...bag);}}
    spawn(type){this.fillQueue();const t=type||this.queue.shift(),m=SHAPES[t].map(r=>r.slice());this.piece={type:t,m,x:Math.floor((10-m.length)/2),y:1};this.gravity=0;this.lockTime=0;this.resets=0;if(this.collides())this.end('topout');}
    collides(dx=0,dy=0,m=this.piece.m){const p=this.piece;return m.some((r,y)=>r.some((v,x)=>v&&(p.x+x+dx<0||p.x+x+dx>=10||p.y+y+dy>=22||p.y+y+dy<0||this.board[p.y+y+dy][p.x+x+dx])));}
    grounded(){return this.collides(0,1);}
    resetLock(wasGrounded){if(wasGrounded&&this.resets<15){this.lockTime=0;this.resets++;}}
    move(dx){if(this.status!=='playing')return false;const ground=this.grounded();if(this.collides(dx,0))return false;this.piece.x+=dx;this.resetLock(ground);return true;}
    rotate(direction=1){if(this.status!=='playing'||this.piece.type==='O')return false;const old=this.piece.m,n=old.length;const m=old.map((r,y)=>r.map((_,x)=>direction===1?old[n-1-x][y]:old[x][n-1-y]));const ground=this.grounded();
      // Simple documented wall/floor kicks, not an official rotation ruleset.
      for(const [dx,dy]of [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[-1,-1],[1,-1],[0,-2]])if(!this.collides(dx,dy,m)){this.piece.m=m;this.piece.x+=dx;this.piece.y+=dy;this.resetLock(ground);return true;}return false;
    }
    softDrop(){if(this.status!=='playing'||this.collides(0,1))return false;this.piece.y++;this.score++;this.gravity=0;return true;}
    ghostY(){let d=0;while(!this.collides(0,d+1))d++;return this.piece.y+d;}
    hardDrop(){if(this.status!=='playing')return;const y=this.ghostY();this.score+=(y-this.piece.y)*2;this.piece.y=y;this.lock();}
    hold(){if(this.status!=='playing'||!this.canHold)return false;const t=this.piece.type;if(this.held){const h=this.held;this.held=t;this.spawn(h);}else{this.held=t;this.spawn();}this.canHold=false;return true;}
    lock(){if(this.status!=='playing')return;const p=this.piece;p.m.forEach((r,y)=>r.forEach((v,x)=>{if(v)this.board[p.y+y][p.x+x]=p.type;}));
      const left=this.board.filter(row=>!row.every(Boolean)),count=22-left.length;while(left.length<22)left.unshift(Array(10).fill(null));this.board=left;this.lastClear=count;this.locks++;
      if(count){this.combo++;this.score+=([0,100,300,500,800][count]+50*Math.max(0,this.combo))*this.level;this.lines+=count;this.level=1+Math.floor(this.lines/10);}else this.combo=-1;
      this.canHold=true;if(this.board.slice(0,2).some(r=>r.some(Boolean))){this.end('topout');return;}this.spawn();
    }
    update(dt){if(this.status!=='playing')return;dt=Math.max(0,Number(dt)||0);this.elapsed+=dt;
      if(this.mode==='challenge'&&this.elapsed>=180000){this.elapsed=180000;this.end('time');return;}
      // Count full active elapsed time; cap simulation catch-up after a long stall.
      let remaining=Math.min(dt,250);
      while(remaining>0&&this.status==='playing'){const step=Math.min(remaining,16);remaining-=step;
        if(this.grounded()){this.lockTime+=step;if(this.lockTime>=500){this.lock();continue;}}else this.lockTime=0;
        this.gravity+=step;const interval=Math.max(75,850*Math.pow(.8,this.level-1));
        if(this.gravity>=interval){this.gravity%=interval;if(!this.collides(0,1))this.piece.y++;}
      }
    }
    pause(){if(this.status==='playing')this.status='paused';}
    resume(){if(this.status==='paused')this.status='playing';}
    end(reason){this.status='over';this.reason=reason;}
  }
  const api={Game,SHAPES,TYPES,random};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BlockGameCore=api;
})(typeof window!=='undefined'?window:globalThis);
