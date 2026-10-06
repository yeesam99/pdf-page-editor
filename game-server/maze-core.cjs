'use strict';
const {randomBytes}=require('node:crypto');
const DIRS=[{dx:0,dy:-1,bit:1,opposite:4},{dx:1,dy:0,bit:2,opposite:8},{dx:0,dy:1,bit:4,opposite:1},{dx:-1,dy:0,bit:8,opposite:2}];
function options(value={}){
  const width=value.width??21,height=value.height??15;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<9||height<9||width>81||height>81)throw Error('가로·세로는 각각 9~81칸의 정수로 입력해주세요.');
  if(value.extreme!==undefined&&typeof value.extreme!=='boolean'||value.items!==undefined&&typeof value.items!=='boolean')throw Error('게임 설정을 확인해주세요.');
  return{width,height,extreme:value.extreme===true,items:value.items===true};
}
function generate(settings,seed=randomBytes(4).readUInt32LE()){
  const {width,height}=options(settings),cells=Array(width*height).fill(0),seen=new Uint8Array(cells.length),stack=[0];let n=seed||1;
  const random=()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};seen[0]=1;
  while(stack.length){const index=stack[stack.length-1],x=index%width,y=Math.floor(index/width),choices=[];
    DIRS.forEach((d,dir)=>{const nx=x+d.dx,ny=y+d.dy;if(nx>=0&&ny>=0&&nx<width&&ny<height&&!seen[ny*width+nx])choices.push(dir);});
    if(!choices.length){stack.pop();continue;}const d=DIRS[choices[Math.floor(random()*choices.length)]],next=index+d.dx+d.dy*width;
    cells[index]|=d.bit;cells[next]|=d.opposite;seen[next]=1;stack.push(next);
  }
  const parents=Array(cells.length).fill(-1),distance=Array(cells.length).fill(-1),queue=[0];distance[0]=0;let exit=0;
  for(let head=0;head<queue.length;head++){const index=queue[head];if(distance[index]>distance[exit])exit=index;for(const d of DIRS)if(cells[index]&d.bit){const next=index+d.dx+d.dy*width;if(distance[next]<0){distance[next]=distance[index]+1;parents[next]=index;queue.push(next);}}}
  // Traps are optional detours: never force a reset on the unique route to the exit.
  const solution=new Set();for(let i=exit;i!==-1;i=parents[i])solution.add(i);
  const candidates=cells.map((v,i)=>i).filter(i=>!solution.has(i)&&distance[i]>6&&(cells[i]&(cells[i]-1))===0);
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  return{width,height,cells,start:0,exit,traps:settings.items?candidates.slice(0,Math.min(24,Math.ceil(cells.length/70))):[],seed};
}
function nextCell(map,index,direction){const d=DIRS[direction];return d&&(map.cells[index]&d.bit)?index+d.dx+d.dy*map.width:index;}
module.exports={DIRS,options,generate,nextCell};
