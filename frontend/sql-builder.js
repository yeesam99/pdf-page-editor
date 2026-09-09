/* Page-local interface; no imports from the PDF editor and no server requests. */
(() => {
  'use strict';
  const C=window.SQLBuilderCore, $=id=>document.getElementById(id);
  let p=C.project(), currentQ=p.root.id, currentT=p.root.tables[0].id, filter='', toastTimer, pickerState=null, focusedRef=null, renderedTable='';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const opt=(v,label,selected)=>`<option value="${esc(v)}"${v===selected?' selected':''}>${esc(label)}</option>`;
  const options=(list,selected)=>list.map(x=>opt(Array.isArray(x)?x[0]:x,Array.isArray(x)?x[1]:x,selected)).join('');
  const btn=(action,label,data='',cls='')=>`<button type="button" data-action="${action}" ${data} class="${cls}">${label}</button>`;
  const input=(node,key,value,extra='')=>`<input data-node="${esc(node.id)}" data-key="${key}" value="${esc(value)}" ${extra}>`;
  const select=(node,key,list,value)=>`<select data-node="${esc(node.id)}" data-key="${key}" aria-label="${esc(key)}">${options(list,value)}</select>`;
  const valueTypes=[['text','문자'],['number','숫자'],['bind','바인드 변수'],['null','NULL']];
  const aggregateOptions=[['','일반 컬럼'],['SUM','SUM · 합계'],['COUNT','COUNT · 값 개수'],['COUNT_DISTINCT','COUNT · 중복 제외'],['AVG','AVG · 평균'],['MIN','MIN · 최솟값'],['MAX','MAX · 최댓값']];
  let windowColumn=null;
  function ctx(){return C.findQuery(p.root,currentQ)||{query:p.root,ancestors:[]};}
  function table(){return ctx().query.tables.find(t=>t.id===currentT)||ctx().query.tables[0];}
  function mode(){return currentQ===p.root.id?p.mode:'SELECT';}
  function node(id){return C.findNode(ctx().query,id);}
  function notice(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3300);}
  function allQueries(q=p.root){return[q,...C.children(q).flatMap(c=>allQueries(c.query))];}
  function nextAlias(){const used=new Set(allQueries().flatMap(q=>q.tables.map(t=>t.alias.toUpperCase())));for(let i=0;;i++){const a=i<26?String.fromCharCode(65+i):'T'+(i+1);if(!used.has(a))return a;}}
  function navigate(q,t){currentQ=q.id;currentT=t.id;filter='';windowColumn=null;render();}
  function deleteQuery(id){
    const link=C.queryParent(p.root,id);if(!link){notice('삭제할 하위 조회를 찾을 수 없습니다.');return;}
    const label=link.kind==='derived'?`JOIN 하위 조회표 ${link.owner.alias}`:`${link.kind} 조건과 하위 조회`;
    const warning=link.kind==='derived'?'다른 조건에서 이 표를 참조했다면 삭제 후 다시 연결해야 합니다.':'해당 조건도 함께 삭제됩니다. 남은 조회 조건을 확인하세요.';
    if(!confirm(`${label}를 삭제할까요?\n내부 테이블과 더 아래의 하위 조회도 함께 삭제됩니다.\n${warning}`))return;
    try{const next=C.deleteSubquery(p.root,id);focusedRef=null;navigate(next.query,next.table);notice('하위 조회를 삭제하고 상위 설정으로 돌아왔습니다.');}catch(e){notice(e.message);}
  }
  function refLabel(r){const found=(r?.outputRef?C.outputRefs(ctx().query):C.refs(ctx().query,ctx().ancestors)).find(x=>x.table===r?.table&&x.column===r?.column);return found?`${found.outputRef?'':found.alias+'.'}${found.name}${found.description?' · '+found.description:''}`:r?'다시 선택 (참조 없음)':'컬럼 찾기';}
  function isHaving(id){let found=false;if(ctx().query.having)C.walkGroup(ctx().query.having,n=>{if(n.id===id)found=true;});return found;}
  function renderTree(){
    function draw(q,depth=0,label='메인 조회'){
      return `<div class="tree-query"><div class="tree-heading"><div class="tree-label">${esc(label)}</div>${depth?`<button type="button" class="tree-delete" data-delete-query="${esc(q.id)}" aria-label="${esc(label)} 삭제" title="이 하위 조회 전체 삭제">삭제</button>`:''}</div>${q.tables.map((t,i)=>`<button class="tree-node ${q.id===currentQ&&t.id===currentT?'selected':''}" data-q="${esc(q.id)}" data-t="${esc(t.id)}"><strong>${esc(t.alias||'?')}</strong> · ${esc(t.query?'하위 조회표':t.name||'테이블명 입력')}<small>${i?esc(t.join):'MAIN'} · ${C.exportsOf(t).length}개 컬럼</small></button>`).join('')}${C.children(q).map(c=>draw(c.query,depth+1,c.kind==='derived'?`JOIN 하위 조회 · ${c.owner.alias}`:c.kind+' 하위 조회')).join('')}</div>`;
    }
    $('tree').innerHTML=draw(p.root);$('table-count').textContent=allQueries().reduce((n,q)=>n+q.tables.length,0)+'개';
  }
  function selectedColumns(t){return C.exportsOf(t).filter(c=>c.selected);}
  function visibleColumns(t){const f=filter.toLowerCase();return C.exportsOf(t).filter(c=>(c.name+' '+c.description+' '+C.outputName(c)+' '+(c.window?.fn||c.aggregate||'')).toLowerCase().includes(f));}
  function columnSection(t){
    const m=mode(),values=m==='UPDATE'||m==='INSERT',readonly=!!t.query;
    return `<div class="section"><div class="section-title"><h3>${values?'대상 컬럼과 값':m==='DELETE'?'테이블 컬럼':'출력 컬럼'}</h3><span class="muted" id="selection-info">전체 ${C.exportsOf(t).length}개 중 ${selectedColumns(t).length}개 선택</span></div>
      ${readonly?`<p class="hint">하위 조회에서 출력한 컬럼입니다. 컬럼명은 하위 조회에서 수정하세요.</p>${btn('edit-derived','하위 조회 편집')}`:`<p class="hint">엑셀의 <b>컬럼명 / 컬럼 설명</b> 두 열을 복사해 붙여넣으세요. 표의 셀에 직접 붙여넣을 수도 있습니다.</p><textarea id="paste-columns" class="paste" placeholder="EMP_ID&#9;사원번호&#10;EMP_NM&#9;사원명" aria-label="엑셀 컬럼 붙여넣기"></textarea><div class="toolbar">${btn('paste-add','붙여넣은 컬럼 추가')}${btn('column-add','+ 빈 행 추가')}</div>`}
      ${m==='SELECT'?`<div class="toolbar">${btn('count-all-add','+ 전체 행 개수 COUNT(*)')}<span class="muted">같은 컬럼에 다른 함수를 적용하려면 출력 행을 복제하세요.</span></div>`:''}
      <div class="toolbar">${btn('all','전체 선택')}${btn('none','전체 해제')}${btn('filtered-all','검색 결과 선택')}${btn('filtered-none','검색 결과 해제')}<input id="column-filter" type="search" placeholder="컬럼명·설명·함수 검색" value="${esc(filter)}" aria-label="컬럼 목록 검색"></div>
      <div class="table-wrap"><table class="output-table"><thead><tr><th><input id="all-check" type="checkbox" aria-label="모든 컬럼 선택" ${C.exportsOf(t).length&&selectedColumns(t).length===C.exportsOf(t).length?'checked':''}></th><th>컬럼명</th><th>설명</th>${m==='SELECT'?'<th>출력 방식</th>':''}${values?'<th>값 종류</th><th>값</th>':'<th>출력 별칭</th>'}<th>출력 행</th></tr></thead><tbody id="column-rows">${columnRows(t)}</tbody></table></div>
      ${values?'<p class="hint">체크한 컬럼만 '+(m==='UPDATE'?'SET':'INSERT')+'에 포함됩니다. 바인드 변수에는 접두사 없이 변수명만 입력하세요.</p>':m==='SELECT'?'<p class="hint">COUNT(*)는 전체 행, COUNT(컬럼)은 NULL이 아닌 값, COUNT(DISTINCT 컬럼)은 중복을 제외한 값의 개수입니다. SUM·AVG에는 숫자형 컬럼을 선택하세요.</p>':''}</div>`;
  }
  function columnRows(t){
    const values=['UPDATE','INSERT'].includes(mode()),readonly=!!t.query,m=mode();
    return visibleColumns(t).map(c=>{
      const own=t.columns.some(x=>x.id===c.id),all=c.aggregate==='COUNT_ALL';
      const attrs=`data-output-id="${esc(c.id)}"`;
      return `<tr data-col="${esc(c.id)}" class="${c.window?'window-row':c.aggregate?'aggregate-row':''}"><td><input type="checkbox" data-col-select="${esc(c.id)}" aria-label="${esc(C.outputName(c))} 선택" ${c.selected?'checked':''}></td><td>${all?'<span class="badge">전체 행 *</span>':readonly?esc(c.sourceMissing?'원본 출력 없음':c.name):input(c,'name',c.name,'aria-label="컬럼명" data-cell="0"')}</td><td>${readonly?esc(c.description):input(c,'description',c.description,'aria-label="컬럼 설명" data-cell="1"')}</td>
        ${m==='SELECT'?`<td><select ${attrs} data-output-key="aggregate" aria-label="${esc(c.name)} 출력 방식" ${all||c.window?'disabled':''}>${c.window?opt('window',c.window.fn+' OVER','window'):all?opt('COUNT_ALL','COUNT(*) · 전체 행','COUNT_ALL'):options(aggregateOptions,c.aggregate||'')}</select>${btn('window-edit',c.window?'분석 설정 수정':'분석 함수 설정',`data-id="${esc(c.id)}"`)}</td>`:''}
        ${values?`<td>${select(c,'valueType',valueTypes,c.valueType)}</td><td>${input(c,'value',c.value,`aria-label="입력 값" ${c.valueType==='null'?'disabled':''}`)}</td>`:`<td><input ${attrs} data-output-key="output" value="${esc(c.output)}" placeholder="${esc(C.outputName({...c,output:''}))}" aria-label="출력 별칭"></td>`}
        <td><div class="row-buttons">${m==='SELECT'?btn('col-duplicate','복제',`data-id="${esc(c.id)}" aria-label="출력 행 복제"`):''}${own?`${btn('col-up','↑',`data-id="${esc(c.id)}" aria-label="위로"`)}${btn('col-down','↓',`data-id="${esc(c.id)}" aria-label="아래로"`)}${btn('col-delete','×',`data-id="${esc(c.id)}" aria-label="출력 행 삭제"`,'danger')}`:''}</div></td></tr>`;
    }).join('')||'<tr><td colspan="7" class="empty">컬럼을 붙여넣거나 검색어를 변경하세요.</td></tr>';
  }
  function groupSummary(q){
    const rows=q.tables.flatMap(t=>C.exportsOf(t).filter(c=>c.selected).map(c=>({t,c})));
    if(!rows.some(({c})=>c.aggregate&&!c.window))return '<p class="hint">일반 집계를 선택하면 GROUP BY가 자동 생성됩니다. 분석 함수 OVER는 행을 유지하며 GROUP BY를 추가하지 않습니다.</p>';
    const groups=[...new Set(rows.filter(({c})=>!c.aggregate&&!c.window).map(({t,c})=>C.outputExpression(t,c)))];
    return groups.length?`<div class="group-chips">${groups.map(g=>'<span class="badge">'+esc(g)+'</span>').join('')}</div><p class="hint">현재 조회의 일반 출력 컬럼 기준으로 묶습니다. 그룹에서 빼려면 해당 출력을 해제하세요.</p>`:'<p class="hint">일반 출력 컬럼이 없어 전체 조회 결과를 하나로 집계합니다.</p>';
  }
  function renderAggregation(q){return `<div class="section"><div class="section-title"><h3>그룹 기준 GROUP BY</h3><span class="badge">자동 설정</span></div><div id="group-summary">${groupSummary(q)}</div></div><div class="section"><div class="section-title"><h3>집계 결과 조건 HAVING</h3></div><p class="hint">예: COUNT(*) ≥ 10. 출력으로 선택한 집계값 또는 그룹 컬럼을 검색해 조건을 설정하세요.</p>${renderGroup(q.having,'HAVING')}</div>`;}
  function renderWindow(t){
    const c=C.exportsOf(t).find(c=>c.id===windowColumn);if(!c?.window)return '';
    const w=c.window;
    return `<section class="section window-settings" aria-label="분석 함수 설정"><div class="section-title"><h3>분석 함수 · ${esc(c.name)}</h3><div class="row-buttons">${btn('window-off','분석 해제')}${btn('window-close','접기')}</div></div>
      <p class="hint">행을 유지하면서 그룹별 합계·순위를 계산합니다. 결과 조건은 하위 조회로 감싼 뒤 상위 WHERE에서 지정하세요.</p>
      <div class="fields"><label class="field">함수<select data-window-key="fn">${options(c.name==='*'?['COUNT_ALL','ROW_NUMBER','RANK','DENSE_RANK']:C.windowFunctions,w.fn)}</select></label>${!C.ranking(w.fn)?`<label class="field">계산 범위<select data-window-key="frame">${options([['full','그룹 전체'],['running','첫 행부터 현재 행까지 누적']],w.frame)}</select></label>`:''}</div>
      <div class="section-title"><h4>PARTITION BY</h4>${btn('window-partition','그룹 컬럼 선택')}</div><div class="group-chips">${w.partition.map((r,i)=>`<span class="badge">${esc(refLabel(r))}${btn('window-partition-remove','×',`data-index="${i}" aria-label="그룹 컬럼 삭제"`)}</span>`).join('')||'<span class="muted">미선택 시 조회 결과 전체를 기준으로 계산합니다.</span>'}</div>
      <div class="section-title"><h4>분석 함수 내 ORDER BY</h4>${btn('window-order','정렬 컬럼 선택')}</div>${w.order.map((o,i)=>`<div class="order-row"><span>${i+1}. ${esc(refLabel(o.ref))}</span><select data-window-order="${i}" aria-label="분석 정렬 방향">${options([['ASC','오름차순'],['DESC','내림차순']],o.direction)}</select>${btn('window-order-up','↑',`data-index="${i}" aria-label="정렬 우선순위 올리기"`)}${btn('window-order-remove','×',`data-index="${i}" aria-label="정렬 컬럼 삭제"`)}</div>`).join('')}
      <p class="hint">순위·누적 계산은 정렬이 필요합니다. ROW_NUMBER와 누적 계산은 동점 순서가 일정하도록 고유번호 등 추가 정렬 컬럼을 선택하세요. 최종 행 표시 순서는 아래 정렬 ORDER BY에서 설정합니다.</p></section>`;
  }
  function pickButton(n,key){return btn('pick',esc(refLabel(n[key])),`data-id="${esc(n.id)}" data-ref="${key}"`,'pick');}
  function renderGroup(g,label='WHERE'){
    return `<div class="condition-group"><div class="section-title"><span class="badge">${esc(label)}${label==='괄호 그룹'?' ( … )':''}</span><div class="row-buttons">${btn('condition-add','+ 조건',`data-id="${esc(g.id)}"`)}${btn('group-add','+ 괄호 그룹',`data-id="${esc(g.id)}"`)}</div></div>${g.items.map((n,i)=>`<div class="condition-row"><div class="condition-controls">${i?select(n,'logic',['AND','OR'],n.logic):'<span class="muted">조건</span>'}${n.kind==='group'?'':renderCondition(n)}${btn('condition-remove','×',`data-id="${esc(n.id)}" aria-label="조건 삭제"`,'remove')}</div>${n.kind==='group'?renderGroup(n,'괄호 그룹'):renderConditionDetails(n)}</div>`).join('')}${!g.items.length?'<p class="hint">조건을 추가하세요. 비워 두면 이 절은 생성되지 않습니다.</p>':''}</div>`;
  }
  function renderCondition(n){return `${n.op.includes('EXISTS')?'':pickButton(n,'left')}${select(n,'op',isHaving(n.id)?C.havingOps:C.ops,n.op)}`;}
  function renderConditionDetails(n){
    if(n.op==='IS NULL'||n.op==='IS NOT NULL')return '';
    if(n.op.includes('EXISTS'))return subLink(n);
    if(n.op==='IN'||n.op==='NOT IN')return `<div class="condition-controls condition-details">${select(n,'mode',isHaving(n.id)?[['literal','값 목록']]:[['literal','값 목록'],['query','하위 조회']],n.mode)}${n.mode==='query'?'':select(n,'type',valueTypes.filter(x=>x[0]!=='null'),n.type)}</div>${n.mode==='query'?subLink(n):`<div class="condition-controls condition-details"><textarea data-node="${esc(n.id)}" data-key="value" placeholder="쉼표 또는 줄바꿈으로 구분. 따옴표 없이 입력" aria-label="IN 값 목록">${esc(n.value)}</textarea></div>`}`;
    if(n.op.includes('BETWEEN'))return `<div class="condition-controls condition-details">${select(n,'type',valueTypes.filter(x=>x[0]!=='null'),n.type)}${input(n,'value',n.value,'placeholder="시작값" aria-label="시작값"')}<span>AND</span>${input(n,'second',n.second,'placeholder="끝값" aria-label="끝값"')}</div>`;
    const isLike=n.op.includes('LIKE');
    return `<div class="condition-controls condition-details">${select(n,'mode',[['literal','직접 입력'],['column','컬럼 가져오기'],['bind','바인드 변수']],n.mode)}${n.mode==='column'?pickButton(n,'right'):n.mode==='bind'?input(n,'value',n.value,'placeholder="변수명" aria-label="바인드 변수명"'):isLike?`${select(n,'like',[['contains','포함'],['starts','시작 일치'],['ends','끝 일치'],['pattern','패턴 직접 입력']],n.like)}${input(n,'value',n.value,'placeholder="검색어" aria-label="검색어"')}`:`${select(n,'type',valueTypes.filter(x=>!['bind','null'].includes(x[0])),n.type)}${input(n,'value',n.value,'placeholder="값 입력" aria-label="비교값"')}`}</div>`;
  }
  function subLink(n){return `<div class="sub-link"><span>${esc(n.op)} · ${n.query?esc(n.query.tables[0].name||'테이블 설정 필요'):'하위 조회 없음'}</span><div class="row-buttons">${btn('open-sub','하위 조회 편집',`data-id="${esc(n.id)}"`)}${n.query?`<button type="button" class="danger" data-delete-query="${esc(n.query.id)}">조건·하위 조회 삭제</button>`:''}</div></div>`;}
  function renderOrder(q){return `<div class="section"><div class="section-title"><h3>정렬 ORDER BY</h3>${btn('order-add','+ 컬럼 선택')}</div>${q.order.map((o,i)=>`<div class="order-row"><span class="muted">${i+1}.</span>${btn('order-pick',esc(refLabel(o.ref)),`data-index="${i}"`,'pick')}<select data-order="${i}" aria-label="정렬 방향">${options([['ASC','오름차순'],['DESC','내림차순']],o.direction)}</select>${btn('order-up','↑',`data-index="${i}" aria-label="정렬 우선순위 올리기"`)}${btn('order-delete','×',`data-index="${i}" aria-label="정렬 삭제"`)}</div>`).join('')||'<p class="hint">출력 여부와 관계없이 정렬할 컬럼을 선택할 수 있습니다.</p>'}</div>`;}
  function renderEditor(){
    const {query:q}=ctx(),t=table(),index=q.tables.indexOf(t),m=mode();
    const isRoot=q.id===p.root.id,parentLink=isRoot?null:C.queryParent(p.root,q.id);
    $('editor').innerHTML=`${parentLink?`<div class="sub-navigation"><span>${esc(parentLink.kind==='derived'?'JOIN 하위 조회 · '+parentLink.owner.alias:parentLink.kind+' 하위 조회')}</span><div class="row-buttons">${btn('parent-query','← 상위 설정')}<button type="button" class="danger" data-delete-query="${esc(q.id)}">이 하위 조회 삭제</button></div></div>`:''}<div class="breadcrumb">${isRoot?'메인 쿼리':'하위 조회'} / ${esc(t.alias||'별칭 입력')}</div><div class="editor-title"><h2>${esc(t.query?'JOIN 하위 조회표':t.name||'테이블 설정')}</h2>${m==='SELECT'?`<div class="row-buttons">${btn('table-add','+ 동일 표 (JOIN)')}${btn('derived-add','+ 하위 조회표')}</div>`:''}</div>
      <div class="section"><div class="section-title"><h3>${index?'JOIN 테이블':'메인 테이블'}</h3>${index?btn('table-delete','표 삭제','','danger'):'<span class="badge">MAIN</span>'}</div><div class="fields">${!t.query?`<label class="field">테이블명${input(t,'name',t.name,'placeholder="TB_EMP 또는 SCHEMA.TB_EMP"')}</label>`:''}<label class="field">별칭${input(t,'alias',t.alias,'placeholder="A"')}</label>${index?`<label class="field">JOIN 종류${select(t,'join',['INNER JOIN','LEFT JOIN','RIGHT JOIN','FULL JOIN','CROSS JOIN'],t.join)}</label>`:''}</div>${index&&t.join!=='CROSS JOIN'?renderGroup(t.on,'ON'):''}</div>
      ${columnSection(t)}
      ${m==='SELECT'?renderWindow(t):''}
      ${m!=='INSERT'?`<div class="section"><div class="section-title"><h3>조건 WHERE</h3><span class="muted">현재 조회 전체에 적용</span></div>${renderGroup(q.where)}${['UPDATE','DELETE'].includes(m)&&!q.where.items.length?'<p class="danger-hint">현재 WHERE가 없어 모든 행을 대상으로 하는 쿼리입니다.</p>':''}</div>`:''}
      ${m==='SELECT'?renderAggregation(q):''}
      ${m==='SELECT'&&isRoot?renderOrder(q):''}
      ${m==='SELECT'&&!isRoot?'<p class="hint">하위 조회를 설정한 뒤 왼쪽 트리에서 상위 테이블로 돌아가세요.</p>':''}`;
  }
  function highlight(sql){return sql.split(/(--[^\n]*|'(?:''|[^'])*'|\b(?:SELECT|FROM|WHERE|AS|ON|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|AND|OR|NOT|IN|EXISTS|BETWEEN|IS|NULL|LIKE|ORDER|OVER|PARTITION|ROWS|UNBOUNDED|PRECEDING|FOLLOWING|CURRENT|ROW|ROW_NUMBER|RANK|DENSE_RANK|GROUP|HAVING|SUM|COUNT|AVG|MIN|MAX|DISTINCT|BY|ASC|DESC|INSERT|INTO|VALUES|UPDATE|SET|DELETE)\b)/g).map(s=>s.startsWith('--')?`<span class="comment">${esc(s)}</span>`:s.startsWith("'")?`<span class="string">${esc(s)}</span>`:/^(SELECT|FROM|WHERE|AS|ON|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|AND|OR|NOT|IN|EXISTS|BETWEEN|IS|NULL|LIKE|ORDER|OVER|PARTITION|ROWS|UNBOUNDED|PRECEDING|FOLLOWING|CURRENT|ROW|ROW_NUMBER|RANK|DENSE_RANK|GROUP|HAVING|SUM|COUNT|AVG|MIN|MAX|DISTINCT|BY|ASC|DESC|INSERT|INTO|VALUES|UPDATE|SET|DELETE)$/.test(s)?`<span class="keyword">${s}</span>`:esc(s)).join('');}
  function preview(){
    let result;try{result=C.generate(p);}catch(e){result={sql:'-- 설정을 확인하세요.',errors:['쿼리 구성 오류: '+e.message],params:[]};}
    $('sql').firstElementChild.innerHTML=result.sql.split('\n').map(line=>`<span class="${focusedRef&&line.includes(focusedRef)?'highlight':''}">${highlight(line)}</span>`).join('\n');$('copy').disabled=!!result.errors.length;
    $('issues').innerHTML=result.errors.length?'<ul>'+result.errors.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'';
    $('sql-meta').textContent=p.dialect.toUpperCase()+' · 읽기 전용';$('line-count').textContent=result.sql.split('\n').length+' lines';
    $('parameters').textContent=result.params.length?(p.dialect==='mysql'?'? 바인드 순서: '+result.params.map((s,i)=>(i+1)+'. '+s).join(' / '):'바인드 변수: '+[...new Set(result.params)].join(', '))+' · 실행 도구에서 값을 연결하세요.':'';
    const t=table();if($('selection-info'))$('selection-info').textContent=`전체 ${C.exportsOf(t).length}개 중 ${selectedColumns(t).length}개 선택`;
    if($('group-summary'))$('group-summary').innerHTML=groupSummary(ctx().query);
    if($('all-check')){const total=C.exportsOf(t).length,n=selectedColumns(t).length;$('all-check').checked=total>0&&total===n;$('all-check').indeterminate=n>0&&n<total;}
  }
  function render(){
    const wrap=document.querySelector('.table-wrap'),position=renderedTable===currentT&&wrap?{top:wrap.scrollTop,left:wrap.scrollLeft}:null;
    $('dialect').value=p.dialect;$('quote').checked=p.quote;
    $('modes').innerHTML=[['SELECT','조회'],['UPDATE','수정'],['INSERT','등록'],['DELETE','삭제']].map(([v,s])=>`<button data-mode="${v}" class="${p.mode===v?'active-mode':''}" aria-pressed="${p.mode===v}">${s} <b>${v}</b></button>`).join('');
    renderTree();renderEditor();preview();
    renderedTable=currentT;const nextWrap=document.querySelector('.table-wrap');if(position&&nextWrap){nextWrap.scrollTop=position.top;nextWrap.scrollLeft=position.left;}
  }
  function availableRefs(targetId){
    if(targetId&&isHaving(targetId))return C.outputRefs(ctx().query).filter(r=>!C.exportsOf(ctx().query.tables.find(t=>t.id===r.table)).find(c=>c.id===r.column).window);
    const {query:q,ancestors}=ctx();let list=C.refs(q,ancestors);
    q.tables.forEach((t,index)=>{let found=false;C.walkGroup(t.on,n=>{if(n.id===targetId)found=true;});if(found){const allowed=new Set(q.tables.slice(0,index+1).map(t=>t.id));list=list.filter(r=>allowed.has(r.table)||r.outer);}});
    return list;
  }
  const refKey=r=>r.table+':'+r.column;
  function orderRefs(){const q=ctx().query,outputs=C.outputRefs(q),selectedKeys=new Set(outputs.map(refKey));return q.tables.some(t=>selectedColumns(t).some(c=>c.aggregate))?outputs:[...outputs,...C.refs(q).filter(r=>!selectedKeys.has(refKey(r)))];}
  function openPicker({multi=false,initial=[],targetId='',onApply,title='컬럼 찾기',rows=null,allowEmpty=false}){
    pickerState={multi,allowEmpty,selected:new Set(initial.filter(Boolean).map(refKey)),refs:rows||availableRefs(targetId),onApply};
    $('picker-title').textContent=title;$('picker-search').value='';
    const tables=[...new Map(pickerState.refs.map(r=>[r.table,r])).values()];
    $('picker-table').innerHTML=opt('','전체 테이블','')+tables.map(r=>opt(r.table,`${r.outer?'상위 · ':''}${r.alias} · ${r.tableName}`,'')).join('');
    $('picker-actions').innerHTML=multi?'<button id="picker-all" type="button">검색 결과 전체 선택</button><button id="picker-none" type="button">전체 해제</button>':'';
    if(multi){$('picker-all').onclick=()=>{pickerFiltered().forEach(r=>pickerState.selected.add(refKey(r)));renderPicker();};$('picker-none').onclick=()=>{pickerState.selected.clear();renderPicker();};}
    renderPicker();$('picker').showModal();$('picker-search').focus();
  }
  function pickerFiltered(){const s=$('picker-search').value.toLowerCase(),t=$('picker-table').value;return pickerState.refs.filter(r=>(!t||r.table===t)&&(r.alias+' '+r.name+' '+r.description+' '+r.tableName).toLowerCase().includes(s));}
  function renderPicker(){
    const rows=pickerFiltered();$('picker-results').innerHTML=`<table><thead><tr><th>선택</th><th>테이블</th><th>컬럼명</th><th>설명</th></tr></thead><tbody>${rows.map(r=>{const k=refKey(r),checked=pickerState.selected.has(k);return `<tr data-pick-key="${esc(k)}" class="${checked?'chosen':''}"><td><input type="${pickerState.multi?'checkbox':'radio'}" name="column-pick" value="${esc(k)}" aria-label="${esc(r.alias+'.'+r.name)} 선택" ${checked?'checked':''}></td><td>${r.outer?'<span class="badge">상위</span> ':''}${esc(r.alias)}<br><span class="muted">${esc(r.tableName)}</span></td><td class="column-name">${esc(r.name)}</td><td>${esc(r.description)}</td></tr>`;}).join('')||'<tr><td colspan="4" class="empty">해당 컬럼이 없습니다. 먼저 테이블에 컬럼을 입력하세요.</td></tr>'}</tbody></table>`;
    $('picker-count').textContent=rows.length+'개 검색 · '+pickerState.selected.size+'개 선택';$('picker-apply').disabled=!pickerState.allowEmpty&&!pickerState.selected.size;
  }
  $('picker-search').oninput=renderPicker;$('picker-table').onchange=renderPicker;
  $('picker-results').onclick=e=>{const row=e.target.closest('[data-pick-key]');if(!row)return;const k=row.dataset.pickKey;if(!pickerState.multi)pickerState.selected.clear();if(pickerState.selected.has(k))pickerState.selected.delete(k);else pickerState.selected.add(k);renderPicker();};
  $('picker-apply').onclick=()=>{const ps=pickerState;const chosen=ps.refs.filter(r=>ps.selected.has(refKey(r))).map(r=>({table:r.table,column:r.column,...(r.outputRef?{outputRef:true}:{})}));$('picker').close();ps.onApply(chosen);render();};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('tree').onclick=e=>{const remove=e.target.closest('[data-delete-query]');if(remove){deleteQuery(remove.dataset.deleteQuery);return;}const b=e.target.closest('[data-q]');if(!b)return;const q=C.findQuery(p.root,b.dataset.q)?.query;if(q)navigate(q,q.tables.find(t=>t.id===b.dataset.t));};
  $('modes').onclick=e=>{const b=e.target.closest('[data-mode]');if(!b)return;if(b.dataset.mode!=='SELECT'&&(p.root.tables.length>1||p.root.tables[0].query)){notice('수정·등록·삭제는 메인 일반 테이블 하나일 때 사용할 수 있습니다.');return;}if(b.dataset.mode!=='SELECT'&&(selectedColumns(p.root.tables[0]).some(c=>c.aggregate||c.window)||p.root.having?.items.length)){notice('집계 출력·HAVING을 해제한 뒤 변경하거나 새 쿼리를 만들어 주세요.');return;}p.mode=b.dataset.mode;navigate(p.root,p.root.tables[0]);};
  $('dialect').onchange=()=>{p.dialect=$('dialect').value;preview();};$('quote').onchange=()=>{p.quote=$('quote').checked;preview();};
  function setSelected(t,c,on){C.setOutput(t,c.id,'selected',on);}
  function removeCondition(g,id){const i=g.items.findIndex(n=>n.id===id);if(i>=0){g.items.splice(i,1);return true;}return g.items.some(n=>n.kind==='group'&&removeCondition(n,id));}
  function ensureSub(n){if(!n.query){if(allQueries().length>=40){notice('하위 조회는 최대 40개까지 추가할 수 있습니다.');return false;}n.query=C.query(nextAlias());}return true;}
  function changeOperator(n,op){n.op=op;n.mode='literal';n.type='text';n.right=null;n.value='';n.second='';if(op.includes('EXISTS')){n.left=null;ensureSub(n);}else n.query=null;}
  $('editor').addEventListener('focusin',e=>{const el=e.target.closest('[data-node],[data-id]');const n=el?node(el.dataset.node||el.dataset.id):null;const r=n?.left;focusedRef=r?refLabel(r).split(' · ')[0]:n?.name&&table().columns.includes(n)?table().alias+'.'+n.name:null;preview();});
  $('editor').addEventListener('input',e=>{
    if(e.target.id==='column-filter'){filter=e.target.value;$('column-rows').innerHTML=columnRows(table());return;}
    const el=e.target;
    if(el.dataset.outputId&&el.tagName!=='SELECT'){C.setOutput(table(),el.dataset.outputId,el.dataset.outputKey,el.value);renderTree();preview();return;}
    if(!el.dataset.node||el.tagName==='SELECT')return;
    const n=node(el.dataset.node);if(!n)return;n[el.dataset.key]=el.value;renderTree();preview();
  });
  $('editor').addEventListener('change',e=>{
    const el=e.target;
    if(el.dataset.windowKey||el.dataset.windowOrder!==undefined){const c=C.exportsOf(table()).find(c=>c.id===windowColumn);if(!c?.window)return;const w=JSON.parse(JSON.stringify(c.window));if(el.dataset.windowKey)w[el.dataset.windowKey]=el.value;else w.order[+el.dataset.windowOrder].direction=el.value;C.setOutput(table(),c.id,'window',w);render();return;}
    if(el.dataset.outputId&&el.tagName==='SELECT'){C.setOutput(table(),el.dataset.outputId,el.dataset.outputKey,el.value);render();return;}
    if(el.dataset.colSelect){const t=table(),c=C.exportsOf(t).find(c=>c.id===el.dataset.colSelect);setSelected(t,c,el.checked);preview();return;}
    if(el.id==='all-check'){const t=table();C.exportsOf(t).forEach(c=>setSelected(t,c,el.checked));renderEditor();preview();return;}
    if(el.dataset.order!==undefined){ctx().query.order[+el.dataset.order].direction=el.value;preview();return;}
    if(el.tagName!=='SELECT'||!el.dataset.node)return;
    const n=node(el.dataset.node),key=el.dataset.key;if(!n)return;
    if(key==='op'){changeOperator(n,el.value);if(isHaving(n.id))n.type='number';}else{n[key]=el.value;if(key==='mode'){if(el.value==='query')ensureSub(n);else n.query=null;if(el.value==='bind')n.value='';}}
    render();
  });
  $('editor').addEventListener('paste',e=>{
    const cell=e.target.closest('[data-cell]');if(!cell)return;const text=e.clipboardData.getData('text');if(!/[\t\n]/.test(text))return;
    e.preventDefault();const t=table(),at=t.columns.findIndex(c=>c.id===cell.dataset.node),start=+cell.dataset.cell;
    const rows=C.parsePaste(text);if(rows.length>2000){notice('한 번에 최대 2,000행까지 붙여넣을 수 있습니다.');return;}
    rows.forEach((r,i)=>{if(!t.columns[at+i])t.columns.push(C.column());const c=t.columns[at+i];if(start===0){if(c.aggregate==='COUNT_ALL'){c.aggregate='';c.output='';}c.name=r.name;c.description=r.description;}else c.description=r.name;});render();
  });
  $('editor').onclick=e=>{
    const remove=e.target.closest('[data-delete-query]');if(remove){deleteQuery(remove.dataset.deleteQuery);return;}
    const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,{query:q}=ctx(),t=table(),id=b.dataset.id,n=id?node(id):null;
    if(a==='parent-query'){const link=C.queryParent(p.root,q.id);if(link)navigate(link.parent,link.parent.tables.find(t=>t.id===link.tableId)||link.parent.tables[0]);return;}
    if(a==='table-add'||a==='derived-add'){
      const nt=C.table(nextAlias());if(a==='derived-add'){q.tables.push(nt);nt.query=C.query(nextAlias());navigate(nt.query,nt.query.tables[0]);}else{q.tables.push(nt);navigate(q,nt);}return;
    }
    if(a==='table-delete'){if(t.query){deleteQuery(t.query.id);return;}if(!confirm('이 표를 삭제할까요? 연결된 조건은 다시 선택해야 합니다.'))return;q.tables=q.tables.filter(x=>x.id!==t.id);navigate(q,q.tables[0]);return;}
    if(a==='edit-derived'){navigate(t.query,t.query.tables[0]);return;}
    if(a==='paste-add'){const rows=C.parsePaste($('paste-columns').value);if(!rows.length){notice('컬럼 정보를 붙여넣어 주세요.');return;}if(t.columns.length+rows.length>2000){notice('표당 최대 2,000개 컬럼까지 추가할 수 있습니다.');return;}const names=new Set(t.columns.map(c=>c.name.toUpperCase()));const unique=rows.filter(c=>{if(names.has(c.name.toUpperCase()))return false;names.add(c.name.toUpperCase());return true;});t.columns.push(...unique);notice(unique.length+'개 컬럼 추가'+(rows.length!==unique.length?' (중복 제외)':''));}
    if(a==='column-add')t.columns.push(C.column());
    if(a==='window-edit'){const c=C.exportsOf(t).find(c=>c.id===id);windowColumn=id;if(!c.window)C.setOutput(t,id,'window',C.windowSpec(c.aggregate==='COUNT_DISTINCT'?'COUNT':c.aggregate||'SUM'));render();document.querySelector('.window-settings')?.scrollIntoView({block:'nearest'});return;}
    if(a.startsWith('window-')){
      const c=C.exportsOf(t).find(c=>c.id===windowColumn);if(!c?.window)return;
      const w=JSON.parse(JSON.stringify(c.window)),save=()=>C.setOutput(t,c.id,'window',w);
      if(a==='window-close'){windowColumn=null;render();return;}
      if(a==='window-off'){C.setOutput(t,c.id,'window',null);windowColumn=null;render();return;}
      if(a==='window-partition'||a==='window-order'){
        const partition=a==='window-partition';
        openPicker({multi:true,allowEmpty:true,title:partition?'PARTITION BY 그룹 컬럼 선택':'분석 함수 정렬 컬럼 선택',rows:C.refs(q),initial:partition?w.partition:w.order.map(o=>o.ref),onApply:rs=>{if(partition)w.partition=rs;else{const keys=new Set(rs.map(refKey));w.order=w.order.filter(o=>keys.has(refKey(o.ref)));rs.forEach(r=>{if(!w.order.some(o=>refKey(o.ref)===refKey(r)))w.order.push({ref:r,direction:'ASC'});});}save();}});return;
      }
      const i=+b.dataset.index;
      if(a==='window-partition-remove')w.partition.splice(i,1);
      if(a==='window-order-remove')w.order.splice(i,1);
      if(a==='window-order-up'&&i>0)[w.order[i-1],w.order[i]]=[w.order[i],w.order[i-1]];
      save();render();return;
    }
    if(a==='count-all-add')C.addCountAll(t);
    if(a==='col-duplicate')C.duplicateOutput(t,id);
    if(['all','none','filtered-all','filtered-none'].includes(a)){const list=a.startsWith('filtered')?visibleColumns(t):C.exportsOf(t);list.forEach(c=>setSelected(t,c,a==='all'||a==='filtered-all'));}
    if(a==='col-delete')t.columns=t.columns.filter(c=>c.id!==id);
    if(a==='col-up'||a==='col-down'){const i=t.columns.findIndex(c=>c.id===id),j=i+(a==='col-up'?-1:1);if(j>=0&&j<t.columns.length)[t.columns[i],t.columns[j]]=[t.columns[j],t.columns[i]];}
    if(a==='condition-add'){const c=C.condition();if(isHaving(n.id))c.type='number';n.items.push(c);}
    if(a==='group-add')n.items.push(C.group());
    if(a==='condition-remove'){if(n.query){deleteQuery(n.query.id);return;}removeCondition(q.where,id);if(q.having)removeCondition(q.having,id);q.tables.forEach(t=>removeCondition(t.on,id));}
    if(a==='open-sub'){if(!ensureSub(n))return;navigate(n.query,n.query.tables[0]);return;}
    if(a==='pick'){openPicker({targetId:n.id,title:isHaving(n.id)?'집계 출력·그룹 컬럼 선택':'원본 컬럼 찾기',initial:[n[b.dataset.ref]],onApply:rs=>{n[b.dataset.ref]=rs[0];}});return;}
    if(a==='order-add'){openPicker({multi:true,title:'정렬 컬럼·집계 출력 선택',rows:orderRefs(),initial:q.order.map(o=>o.ref),onApply:rs=>{const keys=new Set(rs.map(refKey));q.order=q.order.filter(o=>keys.has(refKey(o.ref)));rs.forEach(r=>{const found=q.order.find(o=>refKey(o.ref)===refKey(r));if(found)found.ref=r;else q.order.push({ref:r,direction:'ASC'});});}});return;}
    if(a==='order-pick'){const o=q.order[+b.dataset.index];openPicker({rows:orderRefs(),initial:[o.ref],onApply:rs=>o.ref=rs[0]});return;}
    if(a==='order-delete')q.order.splice(+b.dataset.index,1);
    if(a==='order-up'){const i=+b.dataset.index;if(i>0)[q.order[i-1],q.order[i]]=[q.order[i],q.order[i-1]];}
    render();
  };
  $('copy').onclick=async()=>{
    const result=C.generate(p);if(result.errors.length)return;
    try{await navigator.clipboard.writeText(result.sql);notice('쿼리가 복사되었습니다.');}
    catch(_){const text=document.createElement('textarea');text.value=result.sql;text.style.position='fixed';text.style.opacity='0';document.body.append(text);text.select();const ok=document.execCommand('copy');text.remove();notice(ok?'쿼리가 복사되었습니다.':'복사 권한을 확인하거나 미리보기에서 직접 복사하세요.');}
  };
  $('save').onclick=()=>{
    const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='sql-builder-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('설정 파일을 저장했습니다.');
  };
  $('load').onclick=()=>$('load-file').click();
  $('load-file').onchange=async()=>{const file=$('load-file').files[0];if(!file)return;try{if(file.size>3000000)throw Error('설정 파일은 3MB 이하만 불러올 수 있습니다.');const loaded=C.validateProject(JSON.parse(await file.text()));if(!confirm('현재 구성을 불러온 설정으로 바꿀까요?'))return;p=loaded;navigate(p.root,p.root.tables[0]);notice('설정을 불러왔습니다.');}catch(e){notice(e.message);}$('load-file').value='';};
  $('reset').onclick=()=>{if(!confirm('새 쿼리를 만들까요? 필요한 설정은 먼저 저장하세요.'))return;p=C.project();navigate(p.root,p.root.tables[0]);};
  $('example').onclick=()=>{
    if(!confirm('현재 구성을 사원·부서 조회 예제로 바꿀까요?'))return;
    p=C.project();const q=p.root,a=q.tables[0];a.name='TB_EMP';a.columns=[C.column('EMP_ID','사원번호'),C.column('EMP_NM','사원명'),C.column('DEPT_CD','부서코드'),C.column('USE_YN','사용 여부')];a.columns[2].selected=false;a.columns[3].selected=false;
    const b=C.table('B');b.name='TB_DEPT';b.columns=[C.column('DEPT_CD','부서코드'),C.column('DEPT_NM','부서명')];b.columns[0].selected=false;q.tables.push(b);
    const on=C.condition();on.left={table:a.id,column:a.columns[2].id};on.mode='column';on.right={table:b.id,column:b.columns[0].id};b.on.items.push(on);
    const w=C.condition();w.left={table:a.id,column:a.columns[3].id};w.value='Y';q.where.items.push(w);q.order.push({ref:{table:a.id,column:a.columns[0].id},direction:'ASC'});
    navigate(q,a);
  };
  $('aggregate-example').onclick=()=>{
    if(!confirm('현재 구성을 부서별 급여 집계 예제로 바꿀까요?'))return;
    p=C.project();const q=p.root,a=q.tables[0];a.name='TB_EMP';
    a.columns=[C.column('DEPT_CD','부서코드'),C.column('SALARY','급여')];
    a.columns[1].aggregate='SUM';a.columns[1].output='TOTAL_SALARY';
    const avg=C.duplicateOutput(a,a.columns[1].id);avg.aggregate='AVG';avg.output='AVG_SALARY';
    const count=C.addCountAll(a);count.output='EMP_CNT';
    const h=C.condition();h.left={table:a.id,column:count.id,outputRef:true};h.op='>=';h.type='number';h.value='10';q.having.items.push(h);
    q.order.push({ref:{table:a.id,column:a.columns[1].id,outputRef:true},direction:'DESC'});
    navigate(q,a);
  };
  $('window-example').onclick=()=>{
    if(!confirm('현재 구성을 부서별 합계·급여 순위 예제로 바꿀까요?'))return;
    p=C.project();const q=p.root,t=q.tables[0];t.name='TB_EMP';
    t.columns=[C.column('EMP_ID','사원번호'),C.column('DEPT_CD','부서코드'),C.column('SALARY','급여')];
    const department={table:t.id,column:t.columns[1].id},salary={table:t.id,column:t.columns[2].id};
    const total=C.duplicateOutput(t,t.columns[2].id);total.output='DEPT_TOTAL_SALARY';total.window=C.windowSpec('SUM');total.window.partition=[department];
    const rank=C.duplicateOutput(t,t.columns[2].id);rank.output='DEPT_SALARY_RANK';rank.window=C.windowSpec('RANK');rank.window.partition=[department];rank.window.order=[{ref:salary,direction:'DESC'}];
    q.order=[{ref:department,direction:'ASC'},{ref:salary,direction:'DESC'}];navigate(q,t);
  };
  render();
})();
