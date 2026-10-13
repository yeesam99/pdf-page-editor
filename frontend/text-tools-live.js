(()=>{'use strict';
 const $=id=>document.getElementById(id),C=window.TextToolsCore,sides=['left','right'];
 const editors=Object.fromEntries(sides.map(s=>[s,$(s+'-input')]));
 let result={rows:[],differences:0},version=0,renderedVersion=-1,timer,current=-1,composing=false,scrollLock=false,mode=null;
 const history=[];
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function toast(msg){$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,2300);}
 let size=14;try{size=Math.max(10,Math.min(24,Number(localStorage.getItem('text-tools-font'))||14));}catch{}
 function setSize(value){size=Math.max(10,Math.min(24,value));document.documentElement.style.setProperty('--editor-size',size+'px');$('font-size').textContent=size+'px';$('font-minus').disabled=size===10;$('font-plus').disabled=size===24;try{localStorage.setItem('text-tools-font',size);}catch{}sides.forEach(syncLayer);}
 $('font-minus').onclick=()=>setSize(size-1);$('font-plus').onclick=()=>setSize(size+1);$('font-reset').onclick=()=>setSize(14);
 function stats(id,output){const s=C.stats($(id).value);$(output).textContent=`${s.chars.toLocaleString()}자 · 공백 제외 ${s.charsNoSpace.toLocaleString()}자 · ${s.words.toLocaleString()}단어 · ${s.lines.toLocaleString()}줄`;}
 function convert(){stats('case-input','input-stats');if(mode){$('case-output').value=C.caseConvert($('case-input').value,mode);stats('case-output','output-stats');}}
 $('case-input').oninput=convert;$('case-output').oninput=()=>stats('case-output','output-stats');
 document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>{mode=b.dataset.case;document.querySelectorAll('[data-case]').forEach(x=>x.classList.toggle('active',x===b));convert();});
 $('copy-case').onclick=async()=>{try{await navigator.clipboard.writeText($('case-output').value);toast('복사했습니다.');}catch{$('case-output').focus();$('case-output').select();toast('Ctrl+C를 눌러 복사해주세요.');}};
 function tab(diff){$('case-panel').hidden=diff;$('diff-panel').hidden=!diff;$('case-tab').setAttribute('aria-selected',!diff);$('diff-tab').setAttribute('aria-selected',diff);if(diff)compare();}
 $('case-tab').onclick=()=>tab(false);$('diff-tab').onclick=()=>tab(true);
 const rowHeight=()=>size*1.6;
 function syncLayer(side){const e=editors[side];$(side+'-highlight').style.transform=`translate(${-e.scrollLeft}px,${-e.scrollTop}px)`;$(side+'-gutter').style.transform=`translateY(${-e.scrollTop}px)`;}
 function scrollPair(side){syncLayer(side);if(scrollLock)return;const other=side==='left'?'right':'left',e=editors[side],o=editors[other],line=Math.floor(e.scrollTop/rowHeight())+1;
   let mapped=line;const index=result.rows.findIndex(r=>r[side]?.no===line);
   if(index>=0){const r=result.rows[index];const target=r[other]||result.rows.slice(index+1).find(x=>x[other])?.[other];if(target)mapped=target.no;}
   scrollLock=true;o.scrollTop=Math.max(0,(mapped-1)*rowHeight()+e.scrollTop%rowHeight());o.scrollLeft=e.scrollLeft;syncLayer(other);requestAnimationFrame(()=>scrollLock=false);
 }
 function marks(a,b){let p=0,q=0;while(p<a.length&&p<b.length&&a[p]===b[p])p++;while(q<a.length-p&&q<b.length-p&&a[a.length-1-q]===b[b.length-1-q])q++;
   return [a,b].map(s=>escape(s.slice(0,p))+(s.length-q>p?'<mark>'+escape(s.slice(p,s.length-q))+'</mark>':'')+escape(q?s.slice(-q):''));
 }
 const differences=()=>result.rows.map((r,i)=>r.type!=='same'?i:-1).filter(i=>i>=0);
 function label(row,direction){const target=direction==='right'?'오른쪽':'왼쪽',source=direction==='right'?row.left:row.right,dest=row[direction];return `${source?(dest?'이 줄로 바꾸기':'이 줄 추가'):'이 줄 삭제'} · ${target}에 반영`;}
 function render(){
   const maps={left:new Map(),right:new Map()};result.rows.forEach((r,i)=>sides.forEach(s=>{if(r[s])maps[s].set(r[s].no,{row:r,index:i});}));
   sides.forEach(side=>{
     const text=editors[side].value,lines=C.splitLines(text),paint=[],gutter=[];
     lines.forEach((line,i)=>{const match=maps[side].get(i+1),r=match?.row,idx=match?.index;let cls='',html=escape(line);
       if(r?.type==='change'){cls='changed';html=marks(r.left.text,r.right.text)[side==='left'?0:1];}
       else if(r?.type==='add')cls='added';else if(r?.type==='remove')cls='removed';
       const active=idx===current?' active':'';
       paint.push(`<span class="highlight-line ${cls}${active}">${html||' '}</span>`);
       const direction=side==='left'?'right':'left';
       gutter.push(`<div class="gutter-line${active}"><span>${i+1}</span>${r&&r.type!=='same'?`<button type="button" data-merge="${direction}" data-index="${idx}" data-version="${version}" title="${label(r,direction)}" aria-label="${i+1}번 줄 ${label(r,direction)}">${side==='left'?'→':'←'}</button>`:'<span style="width:26px"></span>'}</div>`);
     });
     $(side+'-highlight').innerHTML=paint.join('');$(side+'-gutter').innerHTML=gutter.join('');syncLayer(side);
   });
   $('change-items').innerHTML=differences().map(i=>{const r=result.rows[i];return `<div class="change-item${current===i?' current':''}"><span>${r.type==='add'?'추가':r.type==='remove'?'삭제':'변경'} ${r.left?.no??'−'} / ${r.right?.no??'−'}</span><code>${escape(r.left?.text??r.right?.text??'')}</code><div><button data-merge="left" data-index="${i}" data-version="${version}" title="${label(r,'left')}">←</button><button data-merge="right" data-index="${i}" data-version="${version}" title="${label(r,'right')}">→</button></div></div>`;}).join('')||'<p style="padding:10px">차이가 없습니다.</p>';
   $('diff-count').textContent=`차이 ${result.differences.toLocaleString()}개`;$('list-count').textContent=`(${result.differences})`;
 }
 function compare(){if(composing)return;clearTimeout(timer);result=C.compare(editors.left.value,editors.right.value,{ignoreCase:$('ignore-case').checked,ignoreSpace:$('ignore-space').checked,ignoreBlank:$('ignore-blank').checked});renderedVersion=version;current=-1;render();$('live-status').textContent='자동 비교 완료';}
 function input(){version++;current=-1;history.length=0;$('undo-merge').disabled=true;$('live-status').textContent='비교 중…';clearTimeout(timer);if(!composing)timer=setTimeout(compare,200);}
 sides.forEach(side=>{const e=editors[side];e.addEventListener('input',input);e.addEventListener('scroll',()=>scrollPair(side));e.addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});e.addEventListener('compositionend',()=>{composing=false;input();});});
 ['ignore-case','ignore-space','ignore-blank'].forEach(id=>$(id).onchange=()=>{version++;compare();});
 document.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{const e=$(b.dataset.clear);e.value='';e.dispatchEvent(new Event('input'));e.focus();});
 function remember(){history.push({left:editors.left.value,right:editors.right.value});if(history.length>50)history.shift();$('undo-merge').disabled=false;}
 function apply(values){sides.forEach(s=>{const e=editors[s];if(e.value===values[s])return;const start=e.selectionStart,end=e.selectionEnd,top=e.scrollTop,left=e.scrollLeft;e.value=values[s];e.setSelectionRange(Math.min(start,e.value.length),Math.min(end,e.value.length));e.scrollTop=top;e.scrollLeft=left;});version++;compare();}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-merge]');if(!b)return;if(composing)return;if(Number(b.dataset.version)!==version||renderedVersion!==version){compare();toast('최신 비교 결과로 갱신했습니다. 화살표를 다시 눌러주세요.');return;}const i=Number(b.dataset.index),row=result.rows[i];remember();apply(C.mergeRow(editors.left.value,editors.right.value,result.rows,i,b.dataset.merge));toast(label(row,b.dataset.merge)+' 완료');});
 $('undo-merge').onclick=()=>{const value=history.pop();if(value)apply(value);$('undo-merge').disabled=!history.length;};
 $('left-to-right').onclick=()=>{remember();apply({left:editors.left.value,right:editors.left.value});};$('right-to-left').onclick=()=>{remember();apply({left:editors.right.value,right:editors.right.value});};
 function move(step){if(renderedVersion!==version)compare();const list=differences();if(!list.length)return;const position=list.indexOf(current);current=list[position<0?(step>0?0:list.length-1):(position+step+list.length)%list.length];render();scrollLock=true;sides.forEach(side=>{const r=result.rows[current],item=r[side]||result.rows.slice(current+1).find(x=>x[side])?.[side];if(item)editors[side].scrollTop=Math.max(0,(item.no-3)*rowHeight());syncLayer(side);});requestAnimationFrame(()=>scrollLock=false);}
 $('prev-diff').onclick=()=>move(-1);$('next-diff').onclick=()=>move(1);
 $('save-diff').onclick=()=>{compare();const body=`[원본]\n${editors.left.value}\n\n[변경본]\n${editors.right.value}\n\n[차이: ${result.differences}]\n`+result.rows.filter(r=>r.type!=='same').map(r=>`${r.type} L${r.left?.no??'-'} R${r.right?.no??'-'}\n- ${r.left?.text??''}\n+ ${r.right?.text??''}`).join('\n');const a=document.createElement('a'),url=URL.createObjectURL(new Blob([body],{type:'text/plain;charset=utf-8'}));a.href=url;a.download='텍스트-비교.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 setSize(size);compare();
})();
