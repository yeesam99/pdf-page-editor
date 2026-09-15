/* No network, model, or third-party dependencies. Glyph matching uses the same
   fixed-width font as the output. Braille uses standard Unicode dot positions. */
(function (root) {
  'use strict';
  const W = 8, H = 16;
  const FONT = '16px "Courier New", monospace';
  const CHARSETS = {
    ascii: " /\\|_-.,:;'`^~()[]{}<>+*=!oxv",
    line: " /\\|_-.,:;'`^~()[]{}<>+*=!oxv─│┌┐└┘├┤┬┴┼╱╲⌒"
  };
  const cache = new Map();
  function soften(a) {
    const out = new Float32Array(W * H);
    for (let y=0;y<H;y++) for(let x=0;x<W;x++) {
      let sum=0, n=0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
        if(x+dx<0||x+dx>=W||y+dy<0||y+dy>=H) continue;
        const weight=dx===0&&dy===0?4:1;
        sum+=a[(y+dy)*W+x+dx]*weight;n+=weight;
      }
      out[y*W+x]=sum/n;
    }
    return out;
  }
  function templates(style) {
    if(cache.has(style)) return cache.get(style);
    const c=document.createElement('canvas');c.width=W;c.height=H;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    const result=Array.from(CHARSETS[style]).map(char=>{
      ctx.clearRect(0,0,W,H);ctx.font=FONT;ctx.textBaseline='alphabetic';
      ctx.fillStyle='#000';ctx.fillText(char,(W-ctx.measureText(char).width)/2,12);
      const rgba=ctx.getImageData(0,0,W,H).data;
      const raw=Float32Array.from({length:W*H},(_,i)=>rgba[i*4+3]/255);
      return {char,data:soften(raw)};
    });
    cache.set(style,result);return result;
  }
  function darkness(rgba,i) {
    return (1-(rgba[i]*.2126+rgba[i+1]*.7152+rgba[i+2]*.0722)/255)*(rgba[i+3]/255);
  }
  function dimensions(canvas,columns) {
    const cols=Math.max(16,Math.min(80,Math.round(Number(columns)||48)));
    return {cols,rows:Math.max(1,Math.round(cols*canvas.height/canvas.width/2))};
  }
  function brailleMask(dots) {
    const bits=[0,3,1,4,2,5,6,7];
    let mask=0;dots.forEach((v,i)=>{if(v)mask|=1<<bits[i];});return mask;
  }
  function convert(canvas,options={}) {
    const {cols,rows}=dimensions(canvas,options.columns);
    const style=CHARSETS[options.style]?options.style:options.style==='braille'?'braille':'line';
    const sensitivity=Math.max(20,Math.min(85,Number(options.sensitivity)||55));
    const cw=style==='braille'?2:W,ch=style==='braille'?4:H;
    const small=document.createElement('canvas');small.width=cols*cw;small.height=rows*ch;
    const ctx=small.getContext('2d',{willReadFrequently:true});
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(canvas,0,0,small.width,small.height);
    const rgba=ctx.getImageData(0,0,small.width,small.height).data;
    const glyphs=style==='braille'?null:templates(style);
    const lines=[];let nonempty=0;
    for(let row=0;row<rows;row++) {
      let line='';
      for(let col=0;col<cols;col++) {
        let char=' ';
        if(style==='braille') {
          const dots=[];
          for(let y=0;y<ch;y++)for(let x=0;x<cw;x++) {
            const i=((row*ch+y)*small.width+col*cw+x)*4;
            dots.push(darkness(rgba,i)>(.19-(sensitivity-20)*.0024));
          }
          const mask=brailleMask(dots);char=mask?String.fromCharCode(0x2800+mask):'⠀';
          if(mask)nonempty++;
        } else {
          const raw=new Float32Array(W*H);let ink=0;
          for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
            const i=((row*H+y)*small.width+col*W+x)*4;
            const d=darkness(rgba,i);raw[y*W+x]=d;ink+=d;
          }
          if(ink>1.4-(sensitivity-20)*.016) {
            const data=soften(raw);const gain=.6+sensitivity/65;
            let best=Infinity;
            for(const glyph of glyphs) {
              let error=0;
              for(let k=0;k<data.length;k++) {
                const target=Math.min(1,data[k]*gain),d=target-glyph.data[k];
                error+=d*d;
              }
              if(error<best){best=error;char=glyph.char;}
            }
          }
          if(char!==' ')nonempty++;
        }
        line+=char;
      }
      lines.push(line.replace(/[ ⠀]+$/u,''));
    }
    // Keep the top/left position, trim only trailing blank lines.
    while(lines.length&&!lines[lines.length-1])lines.pop();
    return {text:lines.join('\n'),cols,rows,nonempty};
  }
  // Test all three channels independently; saturated dark colors are not black.
  // Do not mutate the source so changing the threshold can recover removed pixels.
  function extractBlack(source, threshold=50) {
    const n=Number(threshold),limit=Number.isFinite(n)?Math.max(0,Math.min(255,Math.round(n))):50;
    const data=new Uint8ClampedArray(source.data.length);let count=0;
    for(let i=0;i<data.length;i+=4){
      if(source.data[i+3]>0&&source.data[i]<=limit&&source.data[i+1]<=limit&&source.data[i+2]<=limit){
        data[i+3]=source.data[i+3];count++;
      }
    }
    return {data,width:source.width,height:source.height,count};
  }
  root.TextArtCore={convert,dimensions,brailleMask,extractBlack};
})(typeof window==='undefined'?globalThis:window);
