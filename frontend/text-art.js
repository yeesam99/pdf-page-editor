(function () {
  'use strict';
  const $=id=>document.getElementById(id);
  const canvas=$('drawing'),view=canvas.getContext('2d',{willReadFrequently:true});
  // Keep the fitted source and user edits separately from the filtered preview.
  const source=document.createElement('canvas');source.width=canvas.width;source.height=canvas.height;
  const ctx=source.getContext('2d',{willReadFrequently:true});
  const core=window.TextArtCore;
  let tool='pen',stroke=null,timer=null,lastRun=0,toastTimer,dirty=false;
  let past=[],future=[],importToken=0;
  const MAX_HISTORY=20;
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
  function snapshot(){return ctx.getImageData(0,0,canvas.width,canvas.height);}
  function refreshPreview(){
    const result=core.extractBlack(snapshot(),$('black-threshold').value);
    const pixels=view.createImageData(canvas.width,canvas.height);pixels.data.set(result.data);view.putImageData(pixels,0,0);
    $('black-status').textContent=result.count?`검정 픽셀 ${result.count.toLocaleString()}개 선택됨`:'선택된 검정 픽셀이 없어요. 그림을 그리거나 범위를 높여보세요.';
  }
  function updateBlackRange(){
    $('black-value').value=$('black-threshold').value;
    $('black-rule').textContent=`R·G·B 각각 ${$('black-threshold').value} 이하`;
    refreshPreview();schedule();
  }
  function historyButtons(){$('undo').disabled=!past.length;$('redo').disabled=!future.length;}
  function pushHistory(image=snapshot()){past.push(image);if(past.length>MAX_HISTORY)past.shift();future=[];historyButtons();}
  function dimensions(){return core.dimensions(canvas,$('columns').value);}
  function grid(){const d=dimensions();$('canvas-wrap').style.setProperty('--cell-x',`${100/d.cols}%`);$('canvas-wrap').style.setProperty('--cell-y',`${100/d.rows}%`);}
  function convert(){
    clearTimeout(timer);timer=null;const start=performance.now();refreshPreview();
    const result=core.convert(canvas,{columns:$('columns').value,style:$('style').value,sensitivity:$('sensitivity').value});
    $('result').value=result.text;dirty=false;lastRun=performance.now();
    $('meta').textContent=`${result.cols} × ${result.rows}자 · ${Math.round(lastRun-start)}ms`;
    $('state').textContent=result.nonempty?($('live').checked?'실시간 반영됨':'변환 완료'):'그림을 기다리는 중';grid();
  }
  // Throttle, not debounce: conversion happens even while the pen keeps moving.
  function schedule(){
    if(!$('live').checked){$('state').textContent=dirty?'직접 수정 중 · 자동 변환 멈춤':'자동 변환 멈춤';return;}
    if(timer!==null)return;
    timer=setTimeout(convert,Math.max(0,150-(performance.now()-lastRun)));
  }
  function finalUpdate(){if($('live').checked)convert();else {refreshPreview();schedule();}}
  function point(event){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(canvas.width,(event.clientX-r.left)*canvas.width/r.width)),y:Math.max(0,Math.min(canvas.height,(event.clientY-r.top)*canvas.height/r.height))};}
  function prepareBrush(){ctx.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';ctx.strokeStyle='#000';ctx.fillStyle='#000';ctx.lineWidth=Number($('brush').value)*(tool==='eraser'?3:1);ctx.lineCap='round';ctx.lineJoin='round';}
  function drawTo(p){
    if(!stroke)return;
    prepareBrush();
    if(tool==='pen'||tool==='eraser'){
      ctx.beginPath();ctx.moveTo(stroke.last.x,stroke.last.y);ctx.lineTo(p.x,p.y);ctx.stroke();
    }else{
      ctx.putImageData(stroke.before,0,0);ctx.beginPath();const a=stroke.start;
      if(tool==='line'){ctx.moveTo(a.x,a.y);ctx.lineTo(p.x,p.y);}
      if(tool==='rect')ctx.rect(a.x,a.y,p.x-a.x,p.y-a.y);
      if(tool==='ellipse')ctx.ellipse((a.x+p.x)/2,(a.y+p.y)/2,Math.abs(p.x-a.x)/2,Math.abs(p.y-a.y)/2,0,0,Math.PI*2);
      ctx.stroke();
    }
    stroke.last=p;refreshPreview();schedule();
  }
  canvas.addEventListener('pointerdown',event=>{
    if(stroke||event.button!==0)return;
    importToken++;const p=point(event);stroke={id:event.pointerId,start:p,last:p,before:snapshot()};
    canvas.setPointerCapture(event.pointerId);prepareBrush();
    if(tool==='pen'||tool==='eraser'){ctx.beginPath();ctx.arc(p.x,p.y,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();refreshPreview();schedule();}
  });
  canvas.addEventListener('pointermove',event=>{if(stroke&&stroke.id===event.pointerId)drawTo(point(event));});
  function finish(event,cancel=false){
    if(!stroke||stroke.id!==event.pointerId)return;
    const before=stroke.before;
    if(cancel)ctx.putImageData(before,0,0);else {drawTo(point(event));pushHistory(before);}
    stroke=null;ctx.globalCompositeOperation='source-over';
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    finalUpdate();
  }
  canvas.addEventListener('pointerup',e=>finish(e));
  canvas.addEventListener('pointercancel',e=>finish(e,true));
  canvas.addEventListener('lostpointercapture',e=>finish(e,true));
  document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>{
    if(stroke)return;tool=button.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    canvas.style.cursor=tool==='eraser'?'cell':'crosshair';
  }));
  $('brush').addEventListener('input',()=>$('brush-value').value=$('brush').value);
  $('black-threshold').addEventListener('input',updateBlackRange);
  $('exact-black').addEventListener('click',()=>{$('black-threshold').value='0';updateBlackRange();});
  $('grid').addEventListener('change',()=>{$('canvas-wrap').classList.toggle('grid',$('grid').checked);grid();});
  function undo(){if(stroke||!past.length)return;importToken++;future.push(snapshot());ctx.putImageData(past.pop(),0,0);historyButtons();finalUpdate();}
  function redo(){if(stroke||!future.length)return;importToken++;past.push(snapshot());ctx.putImageData(future.pop(),0,0);historyButtons();finalUpdate();}
  $('undo').addEventListener('click',undo);$('redo').addEventListener('click',redo);
  document.addEventListener('keydown',event=>{
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.target.isContentEditable)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();}
  });
  function replaceDrawing(draw){if(stroke)return;importToken++;pushHistory();ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,canvas.width,canvas.height);draw();finalUpdate();}
  $('clear').addEventListener('click',()=>{replaceDrawing(()=>{});toast('그림을 지웠어요. 실행 취소로 복원할 수 있어요.');});
  function permitReplacement(){return !dirty||window.confirm('직접 수정한 텍스트를 그림 기준으로 다시 변환할까요?');}
  $('live').addEventListener('change',()=>{
    clearTimeout(timer);timer=null;
    if($('live').checked){if(!permitReplacement()){$('live').checked=false;return;}convert();}
    else $('state').textContent='자동 변환 멈춤';
  });
  $('convert').addEventListener('click',()=>{if(permitReplacement())convert();});
  $('result').addEventListener('input',()=>{dirty=true;$('live').checked=false;clearTimeout(timer);timer=null;$('state').textContent='직접 수정 중 · 자동 변환 멈춤';});
  ['style','columns','sensitivity'].forEach(id=>$(id).addEventListener(id==='sensitivity'?'input':'change',()=>{
    $('sensitivity-value').value=$('sensitivity').value;grid();
    if($('live').checked)schedule();else $('state').textContent='설정 변경됨 · 지금 변환을 눌러 적용';
  }));
  $('copy').addEventListener('click',async()=>{
    const text=$('result').value;if(!text.trim()){toast('먼저 그림을 그려주세요.');return;}
    try{
      if(!navigator.clipboard||!window.isSecureContext)throw Error('fallback');
      await navigator.clipboard.writeText(text);toast('텍스트 아트를 복사했어요.');
    }catch{
      const output=$('result');output.focus();output.select();
      try{if(document.execCommand('copy')){toast('텍스트 아트를 복사했어요.');return;}}catch{}
      toast('결과를 선택했어요. Ctrl+C 또는 길게 눌러 복사해주세요.');
    }
  });
  $('save-text').addEventListener('click',()=>{
    if(!$('result').value.trim()){toast('저장할 텍스트 아트가 없어요.');return;}
    const url=URL.createObjectURL(new Blob(['\uFEFF',$('result').value],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='text-art.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  const examples={
    cat(){
      // Draw a source image, then use the exact same conversion as user strokes.
      const d=dimensions(),w=canvas.width/d.cols,h=canvas.height/d.rows;
      const art=[' /\\_/\\','( o.o )',' > ^ <'];
      const x=Math.floor((d.cols-7)/2)*w,y=Math.max(1,Math.floor((d.rows-3)/2))*h;
      ctx.font=`${h}px "Courier New",monospace`;ctx.fillStyle='#000';ctx.textBaseline='alphabetic';
      art.forEach((line,r)=>Array.from(line).forEach((c,k)=>{ctx.fillText(c,x+k*w+(w-ctx.measureText(c).width)/2,y+r*h+h*.75);}));
    },
    heart(){ctx.beginPath();ctx.moveTo(400,405);ctx.bezierCurveTo(85,205,190,55,320,130);ctx.bezierCurveTo(365,155,385,185,400,205);ctx.bezierCurveTo(415,185,435,155,480,130);ctx.bezierCurveTo(610,55,715,205,400,405);ctx.stroke();},
    house(){ctx.beginPath();ctx.moveTo(180,240);ctx.lineTo(400,80);ctx.lineTo(620,240);ctx.moveTo(230,210);ctx.lineTo(230,425);ctx.lineTo(570,425);ctx.lineTo(570,210);ctx.moveTo(350,425);ctx.lineTo(350,310);ctx.lineTo(435,310);ctx.lineTo(435,425);ctx.rect(475,270,55,55);ctx.stroke();}
  };
  document.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>{
    replaceDrawing(()=>{ctx.lineWidth=8;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#000';examples[b.dataset.example]();});
    toast('예제를 넣었어요. 실행 취소로 이전 그림을 복원할 수 있어요.');
  }));
  $('image-open').addEventListener('click',()=>$('image-file').click());
  $('image-file').addEventListener('change',async()=>{
    const file=$('image-file').files[0];$('image-file').value='';if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){toast('10MB 이하의 PNG·JPG·WebP 파일을 선택해주세요.');return;}
    const token=++importToken,url=URL.createObjectURL(file);
    try{
      const img=new Image();img.src=url;await img.decode();
      if(token!==importToken)return;
      if(img.width*img.height>20000000){toast('이미지는 2천만 픽셀 이하로 준비해주세요.');return;}
      replaceDrawing(()=>{
        const scale=Math.min(canvas.width/img.width,canvas.height/img.height);
        const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
        // Nearest-neighbor sampling keeps source RGB values, including exact 0.
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(img,Math.floor((canvas.width-w)/2),Math.floor((canvas.height-h)/2),w,h);
        ctx.imageSmoothingEnabled=true;
      });toast('이미지에서 검정만 추출했어요. 범위를 조절해보세요.');
    }catch{toast('이미지를 읽지 못했어요. 다른 파일을 선택해주세요.');}
    finally{URL.revokeObjectURL(url);}
  });
  convert();
})();
