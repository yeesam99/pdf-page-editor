/* SQL Builder: dependency-free model and SQL generation. No SQL is executed. */
(function (root) {
  'use strict';
  let serial = 0;
  const uid = () => 'n' + Date.now().toString(36) + (++serial).toString(36);
  const group = () => ({id:uid(),kind:'group',logic:'AND',items:[]});
  const condition = () => ({id:uid(),kind:'condition',logic:'AND',left:null,op:'=',mode:'literal',type:'text',value:'',second:'',right:null,like:'contains',query:null});
  const column = (name='',description='') => ({id:uid(),name,description,selected:true,output:'',value:'',valueType:'text'});
  const table = (alias='A') => ({id:uid(),name:'',alias,join:'LEFT JOIN',on:group(),columns:[],query:null});
  const query = (alias='A') => ({id:uid(),tables:[table(alias)],where:group(),order:[]});
  const project = () => ({version:1,dialect:'tibero',mode:'SELECT',quote:false,root:query()});
  const ops = ['=','!=','>','>=','<','<=','LIKE','NOT LIKE','IN','NOT IN','BETWEEN','NOT BETWEEN','IS NULL','IS NOT NULL','EXISTS','NOT EXISTS'];
  function children(q) {
    const out=[];
    for(const t of q.tables) { if(t.query)out.push({query:t.query,kind:'derived',owner:t}); walkGroup(t.on,n=>{if(n.query)out.push({query:n.query,kind:n.op,owner:n});}); }
    walkGroup(q.where,n=>{if(n.query)out.push({query:n.query,kind:n.op,owner:n});});
    return out;
  }
  function walkGroup(g,fn){fn(g);if(g.kind==='group')g.items.forEach(n=>walkGroup(n,fn));}
  function findQuery(q,id,ancestors=[]) {
    if(q.id===id)return {query:q,ancestors};
    for(const c of children(q)) { const found=findQuery(c.query,id,c.kind==='derived'?[]:[q,...ancestors]); if(found)return found; }
    return null;
  }
  function findNode(q,id){let found=null; for(const t of q.tables){if(t.id===id)return t;for(const c of t.columns)if(c.id===id)return c;walkGroup(t.on,n=>{if(n.id===id)found=n;});}walkGroup(q.where,n=>{if(n.id===id)found=n;});return found;}
  function exportsOf(t){
    if(!t.query)return t.columns;
    return t.query.tables.flatMap(st=>exportsOf(st).filter(c=>c.selected).map(c=>({...c,name:c.output||c.name,output:'',selected:!t.excluded?.includes(c.id)})));
  }
  function refs(q,ancestors=[]){return [q,...ancestors].flatMap((scope,i)=>scope.tables.flatMap(t=>exportsOf(t).map(c=>({table:t.id,column:c.id,alias:t.alias,tableName:t.name||'하위 조회',name:c.name,description:c.description,outer:i>0}))));}
  function parsePaste(text){
    // Excel TSV supports quoted cells containing tabs, line breaks and double quotes.
    const rows=[];let row=[],cell='',quoted=false;
    const src=String(text).replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    for(let i=0;i<src.length;i++){const ch=src[i];if(ch==='"' && (quoted||cell==='')){if(quoted&&src[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(ch==='\t'||ch==='\n')){row.push(cell);cell='';if(ch==='\n'){rows.push(row);row=[];}}else cell+=ch;}
    row.push(cell);rows.push(row);
    const clean=rows.filter(r=>r.some(c=>c.trim())).map(r=>r.map(c=>c.trim()));
    if(clean.length && /^(컬럼명|컬럼|column_name|column name|column)$/i.test(clean[0][0]))clean.shift();
    return clean.map(r=>column(r[0],r[1]||''));
  }
  function generate(p){
    const errors=[],params=[];
    const err=s=>{if(!errors.includes(s))errors.push(s);};
    const quote=s=>p.dialect==='mysql'?'`'+s.replace(/`/g,'``')+'`':p.dialect==='mssql'?'['+s.replace(/]/g,']]')+']':'"'+s.replace(/"/g,'""')+'"';
    function ident(s,what='이름',path=false){s=String(s||'').trim();if(!s){err(what+'을 입력하세요.');return '__미입력__';}return (path?s.split('.'):[s]).map(part=>{if(!part){err(what+'에 빈 식별자가 있습니다.');return '__미입력__';}if(p.quote)return quote(part);if(!/^[\p{L}_][\p{L}\p{N}_$#]*$/u.test(part)){err(what+': 공백·특수문자는 식별자 따옴표 설정이 필요합니다.');return '__이름확인__';}return part;}).join('.');}
    function ref(r,scope,where){const found=scope.find(x=>x.table===r?.table&&x.column===r?.column);if(!found){err(where+': 컬럼을 선택하거나 삭제된 참조를 다시 연결하세요.');return '__컬럼선택__';}return ident(found.alias,'테이블 별칭')+'.'+ident(found.name,'컬럼명');}
    function value(v,type,where){v=String(v??'');if(type==='null')return 'NULL';if(type==='bind'){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)){err(where+': 변수명은 영문·숫자·밑줄로 입력하세요.');return '__변수명__';}params.push(v);return p.dialect==='mysql'?'?':p.dialect==='mssql'?'@'+v:':'+v;}if(type==='number'){if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v.trim())){err(where+': 숫자 값을 입력하세요.');return '__숫자입력__';}return v.trim();}const escaped=v.replace(/'/g,"''");if(p.dialect==='mysql'&&v.includes('\\')){err(where+': MySQL 문자열의 역슬래시는 SQL 모드에 따라 달라집니다. 바인드 변수를 사용하세요.');}return (p.dialect==='mssql'?'N':'')+"'"+escaped+"'";}
    function conditions(g,scope,depth,label){
      if(g.kind==='group'){if(!g.items.length)return '';return g.items.map((n,i)=>{const s=conditions(n,scope,depth,label);if(n.kind==='group'&&!s)err('빈 괄호 그룹에 조건을 추가하거나 그룹을 삭제하세요.');return(i?' '+(n.logic==='OR'?'OR':'AND')+' ':'')+(n.kind==='group'?'('+(s||'__조건입력__')+')':s);}).join('');}
      if(!ops.includes(g.op)){err('지원하지 않는 연산자입니다.');return '__연산자__';}
      if(g.op.includes('EXISTS')){if(!g.query){err('EXISTS 하위 조회를 추가하세요.');return '__하위조회__';}return g.op+' (\n'+indent(select(g.query,scopeQueries(scope),depth+1,'exists'))+'\n)';}
      const left=ref(g.left,scope,label);
      if(g.op.includes('IS NULL')||g.op==='IS NOT NULL')return left+' '+g.op;
      if(g.op==='IN'||g.op==='NOT IN'){
        if(g.mode==='query'){if(!g.query){err('IN 하위 조회를 추가하세요.');return left+' '+g.op+' (__하위조회__)';}return left+' '+g.op+' (\n'+indent(select(g.query,scopeQueries(scope),depth+1,'in'))+'\n)';}
        const list=String(g.value).split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
        if(!list.length)err('IN에 하나 이상의 값을 입력하세요.');
        return left+' '+g.op+' ('+(list.length?list.map(v=>value(v,g.type,label)).join(', '):'__값입력__')+')';
      }
      if(g.op.includes('BETWEEN'))return left+' '+g.op+' '+value(g.value,g.type,label)+' AND '+value(g.second,g.type,label);
      let right;
      if(g.mode==='column')right=ref(g.right,scope,label);
      else if(g.op.includes('LIKE')&&g.mode!=='bind'){
        const v=String(g.value);const pattern=g.like==='contains'?'%'+v+'%':g.like==='starts'?v+'%':g.like==='ends'?'%'+v:v;
        right=value(pattern,'text',label);
      }else right=value(g.value,g.mode==='bind'?'bind':g.type,label);
      return left+' '+g.op+' '+right;
    }
    // Scope entries retain owning query so nested correlated conditions get the same visibility.
    function scopeRefs(q,anc){return [q,...anc].flatMap(owner=>refs(owner).map(r=>({...r,owner})));}
    function scopeQueries(scope){return [...new Set(scope.map(r=>r.owner))].map(owner=>({...owner,tables:owner.tables.filter(t=>scope.some(r=>r.owner===owner&&r.table===t.id))}));}
    function indent(s){return s.split('\n').map(l=>'    '+l).join('\n');}
    function source(t,depth){if(t.query)return '(\n'+indent(select(t.query,[],depth+1,'derived'))+'\n) '+ident(t.alias,'테이블 별칭');return ident(t.name,'테이블명',true)+' '+ident(t.alias,'테이블 별칭');}
    function select(q,anc=[],depth=0,purpose='normal'){
      if(depth>8){err('하위 조회는 8단계까지 지원합니다.');return '__깊이초과__';}
      const allAliases=[...q.tables.map(t=>t.alias.toUpperCase()),...anc.flatMap(a=>a.tables.map(t=>t.alias.toUpperCase()))];
      if(new Set(allAliases).size!==allAliases.length)err('현재·상위 조회의 테이블 별칭이 중복됩니다.');
      q.tables.forEach(t=>{const names=exportsOf(t).map(c=>c.name.toUpperCase());if(new Set(names).size!==names.length)err(t.alias+'의 컬럼명이 중복됩니다. 컬럼명 또는 하위 조회 출력 별칭을 확인하세요.');});
      const scope=scopeRefs(q,anc);const selected=q.tables.flatMap(t=>exportsOf(t).filter(c=>c.selected).map(c=>({t,c})));
      if(purpose!=='exists'&&!selected.length)err('출력할 컬럼을 하나 이상 선택하세요.');
      if(purpose==='in'&&selected.length!==1)err('IN 하위 조회의 출력 컬럼은 정확히 하나여야 합니다.');
      if(purpose==='derived') {const names=selected.map(({c})=>(c.output||c.name).toUpperCase());if(new Set(names).size!==names.length)err('JOIN 하위 조회의 출력명이 중복됩니다. 출력 별칭을 지정하세요.');}
      const outputs=selected.map(({t,c},i)=>(i?'     , ':'SELECT ')+ident(t.alias,'테이블 별칭')+'.'+ident(c.name,'컬럼명')+(c.output?' AS '+ident(c.output,'출력 별칭'):'')+(c.description?' -- '+c.description.replace(/[\r\n]/g,' '):''));
      let sql=purpose==='exists'?'SELECT 1':outputs.join('\n')||'SELECT __출력컬럼__';
      if(!q.tables.length){err('메인 테이블을 추가하세요.');return sql;}
      sql+='\n  FROM '+source(q.tables[0],depth);
      q.tables.slice(1).forEach((t,i)=>{
        const valid=['INNER JOIN','LEFT JOIN','RIGHT JOIN','FULL JOIN','CROSS JOIN'];if(!valid.includes(t.join))err('지원하지 않는 JOIN입니다.');
        if(t.join==='FULL JOIN'&&p.dialect==='mysql')err('MySQL은 FULL JOIN을 지원하지 않습니다. JOIN 종류를 변경하세요.');
        sql+='\n  '+t.join+' '+source(t,depth);
        if(t.join!=='CROSS JOIN'){
          const ids=new Set(q.tables.slice(0,i+2).map(t=>t.id));const joinScope=scope.filter(r=>ids.has(r.table)||r.owner!==q);
          const on=conditions(t.on,joinScope,depth,'JOIN');if(!on)err(t.alias+'의 JOIN 조건을 추가하세요.');sql+='\n    ON '+(on||'__연결조건__');
        }
      });
      const where=conditions(q.where,scope,depth,'WHERE');if(where)sql+='\n WHERE '+where;
      if(q.order.length && purpose==='normal')sql+='\n ORDER BY '+q.order.map(o=>ref(o.ref,scope,'ORDER BY')+' '+(o.direction==='DESC'?'DESC':'ASC')).join('\n        , ');
      return sql;
    }
    let sql='';
    if(p.mode==='SELECT')sql=select(p.root);
    else{
      const q=p.root,t=q.tables[0];if(q.tables.length!==1||t.query)err('수정·등록·삭제는 일반 테이블 하나를 대상으로 설정하세요. 조회 모드의 JOIN을 먼저 정리하세요.');
      if(p.dialect==='mysql'&&['UPDATE','DELETE'].includes(p.mode)){
        const readsTarget=q2=>q2.tables.some(st=>!st.query&&st.name.toUpperCase()===t.name.toUpperCase())||children(q2).some(c=>readsTarget(c.query));
        if(children(q).some(c=>readsTarget(c.query)))err('MySQL에서 변경 대상 테이블을 다시 읽는 하위 조회는 이 버전에서 지원하지 않습니다.');
      }
      const names=t.columns.map(c=>c.name.toUpperCase());if(new Set(names).size!==names.length)err('대상 테이블의 컬럼명이 중복됩니다.');
      const name=ident(t.name,'테이블명',true),alias=ident(t.alias,'테이블 별칭'),cols=t.columns.filter(c=>c.selected),scope=scopeRefs(q,[]);
      if(p.mode==='INSERT'){
        if(!cols.length)err('등록할 컬럼을 선택하세요.');
        sql='INSERT INTO '+name+' (\n    '+cols.map(c=>ident(c.name,'컬럼명')).join('\n  , ')+'\n)\nVALUES (\n    '+cols.map(c=>value(c.value,c.valueType,c.name)).join('\n  , ')+'\n)';
      }else{
        if(p.mode==='UPDATE'){
          if(!cols.length)err('수정할 컬럼을 선택하세요.');
          sql='UPDATE '+(p.dialect==='mssql'?alias:name+' '+alias)+'\n   SET '+cols.map(c=>ident(c.name,'컬럼명')+' = '+value(c.value,c.valueType,c.name)).join('\n     , ');
          if(p.dialect==='mssql')sql+='\n  FROM '+name+' '+alias;
        }else if(p.mode==='DELETE')sql=(['mssql','mysql'].includes(p.dialect)?'DELETE '+alias+'\n  FROM ':'DELETE FROM ')+name+' '+alias;
        else err('쿼리 종류를 선택하세요.');
        const where=conditions(q.where,scope,0,'WHERE');if(where)sql+='\n WHERE '+where;
      }
    }
    return {sql:sql+';',errors,params};
  }
  function validateProject(p){
    let count=0;const ids=new Set();const id=o=>{if(!o||typeof o.id!=='string'||ids.has(o.id))throw Error('설정 ID가 잘못되었거나 중복됩니다.');ids.add(o.id);};
    const str=v=>{if(typeof v!=='string'||v.length>100000)throw Error('설정 문자열이 잘못되었습니다.');};
    function checkGroup(g,d){if(++count>15000||d>16)throw Error('설정 규모가 너무 큽니다.');id(g);if(!['AND','OR'].includes(g.logic))throw Error('조건 연결을 확인하세요.');if(g.kind==='group'){if(!Array.isArray(g.items))throw Error('조건 목록이 없습니다.');g.items.forEach(n=>checkGroup(n,d+1));}else{if(g.kind!=='condition'||!ops.includes(g.op))throw Error('조건 형식이 잘못되었습니다.');['mode','type','value','second','like'].forEach(k=>str(g[k]));if(!['literal','column','bind','query'].includes(g.mode)||!['text','number','bind','null'].includes(g.type))throw Error('조건 값 종류가 잘못되었습니다.');if(g.query)checkQuery(g.query,d+1);}}
    function checkQuery(q,d){if(++count>15000||d>16)throw Error('하위 조회가 너무 깊습니다.');id(q);if(!Array.isArray(q.tables)||!q.tables.length||!Array.isArray(q.order))throw Error('조회 구성이 잘못되었습니다.');q.tables.forEach(t=>{id(t);['name','alias','join'].forEach(k=>str(t[k]));if(!['LEFT JOIN','INNER JOIN','RIGHT JOIN','FULL JOIN','CROSS JOIN'].includes(t.join))throw Error('JOIN 종류를 확인하세요.');if(!Array.isArray(t.columns))throw Error('컬럼 목록이 없습니다.');if(t.excluded&&!Array.isArray(t.excluded))throw Error('출력 목록이 잘못되었습니다.');t.columns.forEach(c=>{id(c);['name','description','output','value','valueType'].forEach(k=>str(c[k]));if(typeof c.selected!=='boolean'||!['text','number','bind','null'].includes(c.valueType))throw Error('컬럼 설정을 확인하세요.');});checkGroup(t.on,d+1);if(t.query)checkQuery(t.query,d+1);});checkGroup(q.where,d+1);q.order.forEach(o=>{if(!o||!o.ref||!['ASC','DESC'].includes(o.direction))throw Error('정렬 설정을 확인하세요.');});}
    if(!p||p.version!==1||!['tibero','oracle','mssql','mysql'].includes(p.dialect)||!['SELECT','UPDATE','INSERT','DELETE'].includes(p.mode)||typeof p.quote!=='boolean')throw Error('SQL 생성기 설정 파일이 아닙니다.');checkQuery(p.root,0);return p;
  }
  const api={uid,group,condition,column,table,query,project,ops,children,walkGroup,findQuery,findNode,exportsOf,refs,parsePaste,generate,validateProject};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SQLBuilderCore=api;
})(typeof window!=='undefined'?window:globalThis);
