/* Browser-only sample-data evaluator. It never sends rows to a server. */
(function(root){
  'use strict';
  const C=root.SQLBuilderCore||(typeof require!=='undefined'?require('./sql-builder-core.js'):null);
  const key=r=>r?.table+':'+r?.column;
  const isNull=v=>v===null||v===undefined;
  const scalar=v=>{const s=String(v??'').trim();if(!s||/^null$/i.test(s))return null;if(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))return Number(s);return v;};
  const cmp=(a,b)=>isNull(a)||isNull(b)?null:(typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b)));
  const eq=(a,b)=>isNull(a)||isNull(b)?null:a===b||(typeof a==='number'&&typeof b==='number'&&a===b);
  const val=(n)=>n.mode==='bind'?scalar(n.value):scalar(n.value);
  function raw(row,r){return row?.[key(r)];}
  function aggregate(rows,t,c){
    const values=c.aggregate==='COUNT_ALL'||c.window?.fn==='COUNT_ALL'?rows.map(()=>1):rows.map(r=>raw(r,{table:t.id,column:c.id}));
    const fn=c.window?.fn||c.aggregate;
    if(fn==='COUNT_ALL')return rows.length;
    const present=values.filter(v=>!isNull(v));
    if(fn==='COUNT')return present.length;
    if(fn==='COUNT_DISTINCT')return new Set(present.map(v=>typeof v+':'+String(v))).size;
    if(['SUM','AVG'].includes(fn)&&present.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error(C.outputName(c)+': SUM·AVG 대상에 숫자가 아닌 예시 값이 있습니다.');
    if(fn==='SUM')return present.length?present.reduce((a,b)=>a+b,0):null;
    if(fn==='AVG')return present.length?present.reduce((a,b)=>a+b,0)/present.length:null;
    if(fn==='MIN')return present.length?present.reduce((a,b)=>cmp(a,b)<=0?a:b):null;
    if(fn==='MAX')return present.length?present.reduce((a,b)=>cmp(a,b)>=0?a:b):null;
    return null;
  }
  function condition(n,row,output,evaluateQuery){
    if(n.kind==='group'){
      if(!n.items.length)return true;
      let result=condition(n.items[0],row,output,evaluateQuery);
      for(let i=1;i<n.items.length;i++)result=n.items[i].logic==='OR'?result||condition(n.items[i],row,output,evaluateQuery):result&&condition(n.items[i],row,output,evaluateQuery);
      return !!result;
    }
    if(n.op.includes('EXISTS')){const yes=n.query&&evaluateQuery(n.query,row).rows.length>0;return n.op==='EXISTS'?yes:!yes;}
    const left=n.left?.outputRef?output?.[key(n.left)]:raw(row,n.left);
    if(n.op==='IS NULL')return isNull(left);if(n.op==='IS NOT NULL')return !isNull(left);
    if(n.op==='IN'||n.op==='NOT IN'){
      let values;if(n.mode==='query')values=n.query?evaluateQuery(n.query,row).rows.map(r=>r[0]):[];else values=String(n.value).split(/[,\n]/).map(s=>scalar(s.trim())).filter(v=>!isNull(v));
      if(isNull(left))return false;const yes=values.some(v=>eq(left,v)===true);return n.op==='IN'?yes:!yes;
    }
    if(n.op==='BETWEEN'||n.op==='NOT BETWEEN'){const a=cmp(left,scalar(n.value)),b=cmp(left,scalar(n.second));if(a===null||b===null)return false;const yes=a>=0&&b<=0;return n.op==='BETWEEN'?yes:!yes;}
    const right=n.mode==='column'?(n.right?.outputRef?output?.[key(n.right)]:raw(row,n.right)):val(n);
    if(n.op==='='||n.op==='!='){const same=eq(left,right);if(same===null)return false;return n.op==='='?same:!same;}
    const comparison=cmp(left,right);if(comparison===null)return false;
    if(n.op==='>')return comparison>0;if(n.op==='>=')return comparison>=0;if(n.op==='<')return comparison<0;if(n.op==='<=')return comparison<=0;
    if(n.op.includes('LIKE')){if(isNull(left))return false;let pattern=String(n.value);if(n.like==='contains')pattern='%'+pattern+'%';if(n.like==='starts')pattern+='%';if(n.like==='ends')pattern='%'+pattern;const re=new RegExp('^'+pattern.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/%/g,'.*').replace(/_/g,'.')+'$','s');const yes=re.test(String(left));return n.op==='LIKE'?yes:!yes;}
    return false;
  }
  function evaluate(project,limit=100){
    const errors=[],warnings=[];let scanned=0;
    const data=project.sampleData||{};
    function source(t,outer){
      if(t.query){const result=run(t.query,outer,true),selected=t.query.tables.flatMap(st=>C.exportsOf(st).filter(c=>c.selected).map(c=>({t:st,c})));
        return result.rows.map(values=>{const r={};selected.forEach(({c},i)=>{const exposed=C.exportsOf(t).find(x=>x.id===c.id);if(exposed)r[key({table:t.id,column:exposed.id})]=values[i];});return r;});}
      const cols=t.columns.filter(c=>c.aggregate!=='COUNT_ALL'&&c.name!=='*'),names=[];cols.forEach(c=>{if(!names.some(n=>n.toUpperCase()===c.name.toUpperCase()))names.push(c.name);});
      return (data[t.id]||[]).map(values=>{const r={};cols.forEach(c=>{const i=names.findIndex(n=>n.toUpperCase()===c.name.toUpperCase());r[key({table:t.id,column:c.id})]=scalar(values[i]);});return r;});
    }
    function merge(a,b){return Object.assign({},a,b);}
    function run(q,outer={},nested=false){
      const selected=q.tables.flatMap(t=>C.exportsOf(t).filter(c=>c.selected).map(c=>({t,c})));
      if(!q.tables.length)return {columns:[],rows:[]};
      let rows=source(q.tables[0],outer).map(r=>merge(outer,r));scanned+=rows.length;
      for(const t of q.tables.slice(1)){
        const right=source(t,outer),next=[],matched=new Set();
        if(t.join==='CROSS JOIN'){for(const l of rows)for(const r of right)next.push(merge(l,r));}
        else{
          rows.forEach(l=>{let hit=false;right.forEach((r,i)=>{const m=merge(l,r);if(condition(t.on,m,null,(sq,o)=>run(sq,o,true))){next.push(m);hit=true;matched.add(i);}});if(!hit&&['LEFT JOIN','FULL JOIN'].includes(t.join))next.push(l);});
          if(['RIGHT JOIN','FULL JOIN'].includes(t.join))right.forEach((r,i)=>{if(!matched.has(i))next.push(merge(outer,r));});
        }
        rows=next;scanned+=rows.length;if(scanned>200000)throw Error('예상 조인 계산량이 200,000건을 넘었습니다. 예시 행을 줄이거나 JOIN 조건을 확인하세요.');
      }
      rows=rows.filter(r=>condition(q.where,r,null,(sq,o)=>run(sq,o,true)));
      const hasAgg=selected.some(({c})=>c.aggregate&&!c.window),normal=selected.filter(({c})=>!c.aggregate&&!c.window);
      let records=[];
      if(hasAgg){
        const groups=new Map();rows.forEach(r=>{const k=JSON.stringify(normal.map(({t,c})=>raw(r,{table:t.id,column:c.id})));if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
        if(!normal.length&&!rows.length)groups.set('[]',[]);
        groups.forEach(group=>{const base=group[0]||outer,out={};selected.forEach(({t,c})=>out[key({table:t.id,column:c.id})]=c.aggregate?aggregate(group,t,c):raw(base,{table:t.id,column:c.id}));if(condition(q.having,base,out,(sq,o)=>run(sq,o,true)))records.push({base,out,group});});
      }else records=rows.map(r=>({base:r,out:{},group:[r]}));
      const windows=selected.filter(({c})=>c.window);
      for(const {t,c} of windows){
        const w=c.window,parts=new Map();records.forEach((record,i)=>{const k=JSON.stringify(w.partition.map(r=>raw(record.base,r)));if(!parts.has(k))parts.set(k,[]);parts.get(k).push({record,i});});
        parts.forEach(part=>{
          const ordered=[...part].sort((a,b)=>{for(const o of w.order){const d=cmp(raw(a.record.base,o.ref),raw(b.record.base,o.ref));if(d)return o.direction==='DESC'?-d:d;}return a.i-b.i;});
          ordered.forEach((entry,index)=>{
            let result;if(C.ranking(w.fn)){
              if(w.fn==='ROW_NUMBER')result=index+1;else{let rank=1,dense=1;for(let j=1;j<=index;j++){const changed=w.order.some(o=>cmp(raw(ordered[j-1].record.base,o.ref),raw(ordered[j].record.base,o.ref))!==0);if(changed){rank=j+1;dense++;}}result=w.fn==='RANK'?rank:dense;}
            }else result=aggregate(w.frame==='running'?ordered.slice(0,index+1).map(x=>x.record.base):ordered.map(x=>x.record.base),t,c);
            entry.record.out[key({table:t.id,column:c.id})]=result;
          });
        });
      }
      records.forEach(record=>selected.forEach(({t,c})=>{const k=key({table:t.id,column:c.id});if(!(k in record.out))record.out[k]=raw(record.base,{table:t.id,column:c.id});}));
      if(q.order?.length)records.sort((a,b)=>{for(const o of q.order){const chosen=selected.find(({t,c})=>t.id===o.ref?.table&&c.id===o.ref?.column),useOutput=o.ref.outputRef||chosen?.c.aggregate||chosen?.c.window,av=useOutput?a.out[key(o.ref)]:raw(a.base,o.ref),bv=useOutput?b.out[key(o.ref)]:raw(b.base,o.ref),d=cmp(av,bv);if(d)return o.direction==='DESC'?-d:d;}return 0;});
      return {columns:selected.map(({c})=>C.outputName(c)),rows:records.map(r=>selected.map(({t,c})=>r.out[key({table:t.id,column:c.id})])),total:records.length};
    }
    try{const result=run(project.root);if(result.total>limit)warnings.push('전체 '+result.total+'건 중 앞의 '+limit+'건만 표시합니다.');result.rows=result.rows.slice(0,limit);return {...result,errors,warnings};}
    catch(e){return {columns:[],rows:[],total:0,errors:[e.message],warnings};}
  }
  const api={scalar,evaluate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SQLBuilderPreview=api;
})(typeof window!=='undefined'?window:globalThis);
