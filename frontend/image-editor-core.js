/* Mongle Studio pixel algorithms. No network or third-party dependencies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ImageStudioCore=api;})(globalThis,()=>{
 'use strict';
 const clamp=(x,a=0,b=255)=>Math.max(a,Math.min(b,Number(x)||0));
 const defaults=()=>({brightness:0,contrast:0,saturation:0,temperature:0,black:0,white:255,gamma:1,curve:[0,64,128,192,255]});
 function adjust(data,settings={}){
  const s={...defaults(),...settings},out=new Uint8ClampedArray(data),lut=new Float32Array(256),xs=[0,64,128,192,255];
  for(let i=0;i<256;i++){let p=0;while(p<3&&i>xs[p+1])p++;lut[i]=s.curve[p]+(s.curve[p+1]-s.curve[p])*(i-xs[p])/(xs[p+1]-xs[p]);}
  const factor=259*(clamp(s.contrast,-100,100)+255)/(255*(259-clamp(s.contrast,-100,100)));
  for(let i=0;i<data.length;i+=4){let r=data[i],g=data[i+1],b=data[i+2];const y=.2126*r+.7152*g+.0722*b,sat=1+s.saturation/100;
   r=y+(r-y)*sat+s.temperature*.65;g=y+(g-y)*sat;b=y+(b-y)*sat-s.temperature*.65;
   [r,g,b].forEach((v,k)=>{v=clamp((v-s.black)*255/Math.max(1,s.white-s.black));v=255*Math.pow(v/255,1/Math.max(.1,s.gamma));v=factor*(v-128)+128+s.brightness;out[i+k]=lut[Math.round(clamp(v))];});
  }return out;
 }
 function blur(data,w,h,radius){
  const r=Math.max(1,Math.min(50,Math.round(radius))),tmp=new Float32Array(data.length),out=new Uint8ClampedArray(data.length);
  // Premultiplication avoids dark halos along transparency.
  for(let y=0;y<h;y++)for(let k=0;k<4;k++){let sum=0;const at=x=>{const i=(y*w+clamp(x,0,w-1))*4;return k===3?data[i+3]:data[i+k]*data[i+3]/255;};for(let d=-r;d<=r;d++)sum+=at(d);for(let x=0;x<w;x++){tmp[(y*w+x)*4+k]=sum/(2*r+1);sum+=at(x+r+1)-at(x-r);}}
  for(let x=0;x<w;x++)for(let k=0;k<4;k++){let sum=0;const at=y=>tmp[(clamp(y,0,h-1)*w+x)*4+k];for(let d=-r;d<=r;d++)sum+=at(d);for(let y=0;y<h;y++){out[(y*w+x)*4+k]=sum/(2*r+1);sum+=at(y+r+1)-at(y-r);}}
  for(let i=0;i<out.length;i+=4)if(out[i+3])for(let k=0;k<3;k++)out[i+k]=out[i+k]*255/out[i+3];return out;
 }
 function filter(data,w,h,type,amount=8){
  if(type==='blur')return blur(data,w,h,amount);
  const out=new Uint8ClampedArray(data);
  if(type==='mosaic'){const block=Math.max(2,Math.round(amount));for(let y=0;y<h;y+=block)for(let x=0;x<w;x+=block){const avg=[0,0,0,0];let n=0;for(let yy=y;yy<Math.min(h,y+block);yy++)for(let xx=x;xx<Math.min(w,x+block);xx++){const i=(yy*w+xx)*4;for(let k=0;k<4;k++)avg[k]+=data[i+k];n++;}for(let yy=y;yy<Math.min(h,y+block);yy++)for(let xx=x;xx<Math.min(w,x+block);xx++){const i=(yy*w+xx)*4;for(let k=0;k<4;k++)out[i+k]=avg[k]/n;}}return out;}
  if(type==='sharpen'){const smooth=blur(data,w,h,1),a=amount/10;for(let i=0;i<data.length;i+=4)for(let k=0;k<3;k++)out[i+k]=data[i+k]+a*(data[i+k]-smooth[i+k]);return out;}
  let seed=123456789;
  for(let i=0;i<data.length;i+=4){if(type==='noise'){seed=(1664525*seed+1013904223)>>>0;const n=(seed/4294967296-.5)*amount*4;for(let k=0;k<3;k++)out[i+k]+=n;}else if(type==='red-eye'&&data[i]>Math.max(data[i+1],data[i+2])*1.35&&data[i]>70){out[i]=(data[i+1]+data[i+2])/2;}else if(type==='grayscale'){out[i]=out[i+1]=out[i+2]=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];}else if(type==='invert'){for(let k=0;k<3;k++)out[i+k]=255-data[i+k];}}
  return out;
 }
 function colorSelect(data,w,h,x,y,tolerance=24,connected=true){
  const mask=new Uint8Array(w*h);x=Math.floor(clamp(x,0,w-1));y=Math.floor(clamp(y,0,h-1));const p=(y*w+x)*4;
  const match=i=>Math.max(...[0,1,2,3].map(k=>Math.abs(data[i*4+k]-data[p+k])))<=tolerance;
  if(!connected){for(let i=0;i<mask.length;i++)if(match(i))mask[i]=255;return mask;}
  const queue=new Int32Array(w*h);let head=0,tail=1;queue[0]=y*w+x;mask[queue[0]]=255;
  while(head<tail){const i=queue[head++],xx=i%w;for(const j of [xx?i-1:-1,xx<w-1?i+1:-1,i-w,i+w])if(j>=0&&j<mask.length&&!mask[j]&&match(j)){mask[j]=255;queue[tail++]=j;}}
  return mask;
 }
 function blendSelection(original,changed,mask){if(!mask)return changed;const out=new Uint8ClampedArray(original);for(let i=0;i<mask.length;i++)if(mask[i])for(let k=0;k<4;k++)out[i*4+k]=original[i*4+k]+(changed[i*4+k]-original[i*4+k])*mask[i]/255;return out;}
 function bounds(mask,w,h){let x=w,y=h,r=-1,b=-1;for(let i=0;i<mask.length;i++)if(mask[i]){const xx=i%w,yy=Math.floor(i/w);x=Math.min(x,xx);y=Math.min(y,yy);r=Math.max(r,xx);b=Math.max(b,yy);}return r<0?null:{x,y,w:r-x+1,h:b-y+1};}
 function validateProject(p){
  if(!p||p.format!=='mongle-image'||p.version!==1||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width>8192||p.height>8192||p.width*p.height>16777216)throw Error('지원하지 않는 프로젝트 또는 캔버스 크기입니다.');
  if(!Array.isArray(p.layers)||p.layers.length>30)throw Error('레이어는 최대 30개까지 지원합니다.');
  if(!Array.isArray(p.groups)||p.groups.length>30)throw Error('그룹 정보가 올바르지 않습니다.');
  const ids=new Set();for(const l of p.layers){if(!l||!['raster','text','shape'].includes(l.type)||typeof l.id!=='string'||ids.has(l.id))throw Error('레이어 정보 오류');ids.add(l.id);for(const key of ['x','y','w','h','rotation','opacity'])if(!Number.isFinite(l[key]))throw Error('레이어 좌표 오류');if(l.w<=0||l.h<=0||l.w>32768||l.h>32768||Math.abs(l.x)>100000||Math.abs(l.y)>100000)throw Error('레이어 크기 오류');if(l.type==='raster'&&!/^data:image\/png;base64,/.test(l.src||''))throw Error('이미지 데이터 오류');if(l.mask&&!/^data:image\/png;base64,/.test(l.mask))throw Error('마스크 데이터 오류');if(l.name&&typeof l.name!=='string')throw Error('레이어 이름 오류');}
  const safeID=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(s);
  for(const g of p.groups)if(!g||!safeID(g.id)||typeof g.name!=='string')throw Error('그룹 정보 오류');
  if(p.guides&&(!Array.isArray(p.guides)||p.guides.length>1000||p.guides.some(g=>!g||!['x','y'].includes(g.axis)||!Number.isFinite(g.value))))throw Error('가이드 정보 오류');
  for(const l of p.layers){
   if(!safeID(l.id)||l.group&&!p.groups.some(g=>g.id===l.group))throw Error('레이어 식별자 오류');
   if(l.w>8192||l.h>8192||l.w*l.h>16777216||l.opacity<0||l.opacity>1)throw Error('레이어 크기 또는 불투명도 오류');
   if(!Array.isArray(l.quad)||l.quad.length!==8||l.quad.some(v=>!Number.isFinite(v)||Math.abs(v)>4096))throw Error('왜곡 정보 오류');
   if(!l.shadow||typeof l.shadow.color!=='string'||['blur','x','y'].some(k=>!Number.isFinite(l.shadow[k])))throw Error('그림자 정보 오류');
   if(l.type==='text'&&(typeof l.text!=='string'||typeof l.fontFamily!=='string'||['fontSize','letterSpacing','lineHeight'].some(k=>!Number.isFinite(l[k]))))throw Error('텍스트 정보 오류');
  }
  return p;
 }
 // ZIP STORE writer for browser batch exports (UTF-8 names).
 function zip(files){const enc=new TextEncoder(),parts=[],central=[];let offset=0;const u16=(a,o,v)=>new DataView(a.buffer).setUint16(o,v,true),u32=(a,o,v)=>new DataView(a.buffer).setUint32(o,v,true);
  const crc=bytes=>{let c=~0;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (~c)>>>0;};
  for(const file of files){const name=enc.encode(file.name),body=file.bytes,hash=crc(body),h=new Uint8Array(30+name.length);u32(h,0,0x04034b50);u16(h,4,20);u16(h,6,0x800);u32(h,14,hash);u32(h,18,body.length);u32(h,22,body.length);u16(h,26,name.length);h.set(name,30);parts.push(h,body);
   const c=new Uint8Array(46+name.length);u32(c,0,0x02014b50);u16(c,4,20);u16(c,6,20);u16(c,8,0x800);u32(c,16,hash);u32(c,20,body.length);u32(c,24,body.length);u16(c,28,name.length);u32(c,42,offset);c.set(name,46);central.push(c);offset+=h.length+body.length;}
  const end=new Uint8Array(22),len=central.reduce((n,x)=>n+x.length,0);u32(end,0,0x06054b50);u16(end,8,files.length);u16(end,10,files.length);u32(end,12,len);u32(end,16,offset);const all=[...parts,...central,end],out=new Uint8Array(all.reduce((n,x)=>n+x.length,0));let pos=0;for(const a of all){out.set(a,pos);pos+=a.length;}return out;
 }
 return {clamp,defaults,adjust,filter,colorSelect,blendSelection,bounds,validateProject,zip};
});
