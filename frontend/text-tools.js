(()=>{'use strict';
  const $=id=>document.getElementById(id),C=window.TextToolsCore;
  let diffTimer,current=-1,diffNodes=[];
  const toast=msg=>{const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,1800);};
  const copy=async text=>{try{await navigator.clipboard.writeText(text);toast('클립보드에 복사했습니다.');}catch{const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();document.execCommand('copy');t.remove();toast('클립보드에 복사했습니다.');}};
  const statText=text=>{const s=C.stats(text);return `${s.chars.toLocaleString()}자 · 공백 제외 ${s.charsNoSpace.toLocaleString()}자 · ${s.words.toLocaleString()}단어 · ${s.lines.toLocaleString()}줄`;};
  function setTab(tab){const diff=tab==='diff';$('case-tab').setAttribute('aria-selected',String(!diff));$('diff-tab').setAttribute('aria-selected',String(diff));$('case-panel').hidden=diff;$('diff-panel').hidden=!diff;if(diff)runDiff();}
  $('case-tab').onclick=()=>setTab('case');$('diff-tab').onclick=()=>setTab('diff');
  $('case-input').oninput=()=>{$('input-stats').textContent=statText($('case-input').value);};
  document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-case]').forEach(x=>x.classList.toggle('active',x===b));$('case-output').value=C.caseConvert($('case-input').value,b.dataset.case);$('output-stats').textContent=statText($('case-output').value);});
  $('copy-case').onclick=()=>copy($('case-output').value);
  document.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{const el=$(b.dataset.clear);el.value='';el.dispatchEvent(new Event('input'));el.focus();});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function charMarkup(a,b){
    let start=0;const aa=Array.from(a),bb=Array.from(b);while(start<aa.length&&start<bb.length&&aa[start]===bb[start])start++;
    let ae=aa.length-1,be=bb.length-1;while(ae>=start&&be>=start&&aa[ae]===bb[be]){ae--;be--;}
    const mark=(arr,end)=>esc(arr.slice(0,start).join(''))+(end>=start?`<mark class="char-change">${esc(arr.slice(start,end+1).join(''))}</mark>`:'')+esc(arr.slice(end+1).join(''));
    return [mark(aa,ae),mark(bb,be)];
  }
  const cell=(item,kind,html)=>`<div class="diff-cell ${kind}"><span class="line-no">${item?.no??''}</span><span class="line-text">${html??esc(item?.text??'')}</span></div>`;
  function runDiff(){
    const opt={ignoreCase:$('ignore-case').checked,ignoreSpace:$('ignore-space').checked,ignoreBlank:$('ignore-blank').checked};
    const result=C.compare($('left-input').value,$('right-input').value,opt),parts=[];
    result.rows.forEach((row,i)=>{
      let l='',r='';
      if(row.type==='same'){l=cell(row.left,'',null);r=cell(row.right,'',null);}
      else if(row.type==='remove'){l=cell(row.left,'remove',null);r=cell(null,'','');}
      else if(row.type==='add'){l=cell(null,'','');r=cell(row.right,'add',null);}
      else{const chars=charMarkup(row.left.text,row.right.text);l=cell(row.left,'change-left',chars[0]);r=cell(row.right,'change-right',chars[1]);}
      parts.push(`<div class="diff-row${row.type==='same'?' same-context':' difference'}" data-row="${i}">${l}${r}</div>`);
    });
    $('diff-rows').innerHTML=parts.join('')||'<div class="empty">비교할 텍스트를 입력해주세요.</div>';
    if($('toggle-same').getAttribute('aria-pressed')==='true')document.querySelectorAll('.same-context').forEach(row=>row.hidden=true);
    $('diff-count').textContent=`차이 ${result.differences.toLocaleString()}개`;
    diffNodes=[...document.querySelectorAll('.difference')];current=-1;
  }
  function schedule(){clearTimeout(diffTimer);diffTimer=setTimeout(runDiff,180);}
  ['left-input','right-input'].forEach(id=>$(id).addEventListener('input',schedule));
  ['ignore-case','ignore-space','ignore-blank'].forEach(id=>$(id).onchange=runDiff);
  $('run-diff').onclick=runDiff;
  function moveDiff(step){if(!diffNodes.length){toast('차이점이 없습니다.');return;}diffNodes.forEach(x=>x.classList.remove('current'));current=(current+step+diffNodes.length)%diffNodes.length;diffNodes[current].classList.add('current');diffNodes[current].scrollIntoView({behavior:'smooth',block:'center'});}
  $('prev-diff').onclick=()=>moveDiff(-1);$('next-diff').onclick=()=>moveDiff(1);
  $('toggle-same').onclick=()=>{const b=$('toggle-same'),hide=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(hide));b.textContent=hide?'동일 줄 보이기':'동일 줄 숨기기';document.querySelectorAll('.same-context').forEach(row=>row.hidden=hide);};
  $('left-to-right').onclick=()=>{$('right-input').value=$('left-input').value;runDiff();};$('right-to-left').onclick=()=>{$('left-input').value=$('right-input').value;runDiff();};
  $('save-diff').onclick=()=>{const text=`[원본]\n${$('left-input').value}\n\n[변경본]\n${$('right-input').value}\n\n[비교 결과] ${$('diff-count').textContent}\n`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));a.download=`텍스트-비교-${new Date().toISOString().slice(0,10)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);};
  runDiff();
})();
