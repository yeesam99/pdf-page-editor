/* Shared authoritative simulation and client prediction. No client scores accepted. */
(function(root){
  'use strict';
  const core=typeof module!=='undefined'&&module.exports?require('./block-game-core.js'):root.BlockGameCore;
  const fields=['mode','seed','board','queue','held','canHold','score','lines','level','elapsed','gravity','lockTime','resets','status','reason','lastClear','locks','combo','piece'];
  const ACTIONS=['left','right','down','rotate','ccw','drop','hold'];
  function apply(game,action){if(game.status!=='playing')return;switch(action){case'left':game.move(-1);break;case'right':game.move(1);break;case'down':game.softDrop();break;case'rotate':game.rotate(1);break;case'ccw':game.rotate(-1);break;case'drop':game.hardDrop();break;case'hold':game.hold();break;}}
  function snapshot(game){if(!game)return null;const data={};for(const k of fields)data[k]=game[k];data.rng=game.rng.state();return JSON.parse(JSON.stringify(data));}
  function restore(data){const game=new core.Game({mode:data.mode,seed:data.seed});for(const k of fields)game[k]=JSON.parse(JSON.stringify(data[k]));game.rng.restore(data.rng);return game;}
  function ranking(players){const sorted=players.slice().sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));let rank=0;return sorted.map((p,i)=>{if(i===0||p.score!==sorted[i-1].score)rank=i+1;return{...p,rank};});}
  const api={apply,snapshot,restore,ranking,ACTIONS};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BlockOnlineEngine=api;
})(typeof window!=='undefined'?window:globalThis);
