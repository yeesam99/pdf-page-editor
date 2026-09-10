/* SQL Builder: dependency-free model and SQL generation. No SQL is executed. */
(function (root) {
  'use strict';
  let serial = 0;
  const uid = () => 'n' + Date.now().toString(36) + (++serial).toString(36);
  const group = () => ({id:uid(),kind:'group',logic:'AND',items:[]});
  const condition = () => ({id:uid(),kind:'condition',logic:'AND',left:null,op:'=',mode:'literal',type:'text',value:'',second:'',right:null,like:'contains',query:null});
  const column = (name='',description='') => ({id:uid(),name,description,selected:true,output:'',value:'',valueType:'text',aggregate:''});
  const table = (alias='A') => ({id:uid(),name:'',alias,join:'LEFT JOIN',on:group(),columns:[],query:null});
  const query = (alias='A') => ({id:uid(),tables:[table(alias)],where:group(),having:group(),order:[]});
  const ddlColumn = (name='',description='',newDescription='',dataType='',size='') => ({id:uid(),name,description,newDescription,dataType,size,nullable:true,defaultValue:'',pk:false,index:false,unique:false});
  const ddlConfig = () => ({tableName:'',tableDescription:'',columns:[]});
  const project = () => ({version:1,dialect:'tibero',mode:'SELECT',quote:false,sampleData:{},ddl:ddlConfig(),root:query()});
  const ops = ['=','!=','>','>=','<','<=','LIKE','NOT LIKE','IN','NOT IN','BETWEEN','NOT BETWEEN','IS NULL','IS NOT NULL','EXISTS','NOT EXISTS'];
  const aggregates=['','SUM','COUNT','COUNT_DISTINCT','AVG','MIN','MAX','COUNT_ALL'];
  const windowFunctions=['SUM','COUNT','AVG','MIN','MAX','COUNT_ALL','ROW_NUMBER','RANK','DENSE_RANK'];
  const ranking=fn=>['ROW_NUMBER','RANK','DENSE_RANK'].includes(fn);
  const windowSpec=(fn='SUM')=>({fn,partition:[],order:[],frame:'full'});
  const havingOps=['=','!=','>','>=','<','<=','IN','NOT IN','BETWEEN','NOT BETWEEN','IS NULL','IS NOT NULL'];
  function children(q) {
    const out=[];
    for(const t of q.tables) { if(t.query)out.push({query:t.query,kind:'derived',owner:t}); walkGroup(t.on,n=>{if(n.query)out.push({query:n.query,kind:n.op,owner:n});}); }
    walkGroup(q.where,n=>{if(n.query)out.push({query:n.query,kind:n.op,owner:n});});
    if(q.having)walkGroup(q.having,n=>{if(n.query)out.push({query:n.query,kind:n.op,owner:n});});
    return out;
  }
  function walkGroup(g,fn){fn(g);if(g.kind==='group')g.items.forEach(n=>walkGroup(n,fn));}
  function findQuery(q,id,ancestors=[]) {
    if(q.id===id)return {query:q,ancestors};
    for(const c of children(q)) { const found=findQuery(c.query,id,c.kind==='derived'?[]:[q,...ancestors]); if(found)return found; }
    return null;
  }
  // Structural parent, distinct from SQL correlation scope (derived queries have no outer scope).
  function queryParent(q,id){
    for(const edge of children(q)){
      if(edge.query.id===id){
        let tableId=q.tables[0].id;
        if(edge.kind==='derived')tableId=edge.owner.id;
        else q.tables.forEach(t=>walkGroup(t.on,n=>{if(n===edge.owner)tableId=t.id;}));
        return {...edge,parent:q,tableId};
      }
      const found=queryParent(edge.query,id);if(found)return found;
    }
    return null;
  }
  function removeConditionBranch(g,id){
    const at=g.items.findIndex(n=>n.id===id);
    if(at>=0){g.items.splice(at,1);return true;}
    for(let i=0;i<g.items.length;i++){
      const n=g.items[i];
      if(n.kind==='group'&&removeConditionBranch(n,id)){
        if(!n.items.length)g.items.splice(i,1);
        return true;
      }
    }
    return false;
  }
  function deleteSubquery(root,id){
    const link=queryParent(root,id);if(!link)throw Error('삭제할 하위 조회를 찾을 수 없습니다.');
    const {parent,owner,kind}=link;
    if(kind==='derived'){
      const index=parent.tables.indexOf(owner);
      if(index<=0)throw Error('메인 조회표는 삭제할 수 없습니다.');
      parent.tables.splice(index,1);
    }else{
      let removed=removeConditionBranch(parent.where,owner.id);
      if(!removed&&parent.having)removed=removeConditionBranch(parent.having,owner.id);
      if(!removed)for(const t of parent.tables){if(removeConditionBranch(t.on,owner.id)){removed=true;break;}}
      if(!removed)throw Error('하위 조회를 연결한 조건을 찾을 수 없습니다.');
    }
    // Other filters/order references stay explicit so deletion never silently widens them.
    return {query:parent,table:parent.tables.find(t=>t.id===link.tableId)||parent.tables[0]};
  }
  function findNode(q,id){let found=null; for(const t of q.tables){if(t.id===id)return t;for(const c of t.columns)if(c.id===id)return c;walkGroup(t.on,n=>{if(n.id===id)found=n;});}walkGroup(q.where,n=>{if(n.id===id)found=n;});if(q.having)walkGroup(q.having,n=>{if(n.id===id)found=n;});return found;}
  function outputName(c){return c.output||(c.window?(c.window.fn==='COUNT_ALL'?'ROW_COUNT':ranking(c.window.fn)?c.window.fn:c.window.fn+'_'+c.name)+'_OVER':c.aggregate==='COUNT_ALL'?'ROW_COUNT':c.aggregate?c.aggregate+'_'+c.name:c.name);}
  function exportsOf(t){
    if(!t.query)return t.columns;
    const base=t.query.tables.flatMap(st=>exportsOf(st).filter(c=>c.selected).map(c=>({id:c.id,name:outputName(c),description:c.description,output:'',aggregate:'',value:'',valueType:'text',selected:!t.excluded?.includes(c.id)})));
    const projected=base.map(c=>({...c,...(Object.hasOwn(t.outputSettings||{},c.id)?t.outputSettings[c.id]:{})}));
    const extras=t.columns.map(c=>{
      if(c.aggregate==='COUNT_ALL')return c;
      const source=base.find(s=>s.id===c.sourceColumnId);
      return {...c,name:source?.name||'',description:source?.description||'',sourceMissing:!source};
    });
    return [...projected,...extras];
  }
  function refs(q,ancestors=[]){return [q,...ancestors].flatMap((scope,i)=>scope.tables.flatMap(t=>exportsOf(t).filter(c=>c.aggregate!=='COUNT_ALL'&&!c.sourceMissing).map(c=>({table:t.id,column:c.id,alias:t.alias,tableName:t.name||'하위 조회',name:c.name,description:c.description,outer:i>0}))));}
  function outputExpression(t,c){const raw=t.alias+'.'+c.name;if(c.window)return (ranking(c.window.fn)?c.window.fn+'()':c.window.fn==='COUNT_ALL'?'COUNT(*)':c.window.fn+'('+raw+')')+' OVER (…)';return c.aggregate==='COUNT_ALL'?'COUNT(*)':c.aggregate==='COUNT_DISTINCT'?'COUNT(DISTINCT '+raw+')':c.aggregate?c.aggregate+'('+raw+')':raw;}
  function outputRefs(q){return q.tables.flatMap(t=>exportsOf(t).filter(c=>c.selected).map(c=>({table:t.id,column:c.id,alias:t.alias,tableName:t.name||'하위 조회',name:outputExpression(t,c),description:outputName(c)+(c.description?' · '+c.description:''),outer:false,outputRef:true})));}
  function setOutput(t,id,key,value){
    if(!['aggregate','output','selected','window'].includes(key))throw Error('지원하지 않는 출력 설정입니다.');
    const own=t.columns.find(c=>c.id===id);if(own){own[key]=value;return;}
    if(!t.query||!exportsOf(t).some(c=>c.id===id))throw Error('출력 컬럼을 찾을 수 없습니다.');
    t.outputSettings=t.outputSettings||{};t.outputSettings[id]={...(t.outputSettings[id]||{}),[key]:value};
  }
  function duplicateOutput(t,id){
    const original=exportsOf(t).find(c=>c.id===id);if(!original)throw Error('복제할 출력 컬럼이 없습니다.');
    const copy={...original,window:original.window?JSON.parse(JSON.stringify(original.window)):null,id:uid(),selected:true};delete copy.sourceMissing;
    if(t.query&&copy.aggregate!=='COUNT_ALL')copy.sourceColumnId=original.sourceColumnId||original.id;
    const names=new Set(exportsOf(t).map(c=>outputName(c).toUpperCase()));let index=2,alias=outputName(original)+'_'+index;while(names.has(alias.toUpperCase()))alias=outputName(original)+'_'+(++index);copy.output=alias;
    const at=t.columns.findIndex(c=>c.id===id);t.columns.splice(at<0?t.columns.length:at+1,0,copy);return copy;
  }
  function addCountAll(t){const c=column('*','전체 행 개수');c.aggregate='COUNT_ALL';const names=new Set(exportsOf(t).map(c=>outputName(c).toUpperCase()));let alias='ROW_COUNT',i=1;while(names.has(alias.toUpperCase()))alias='ROW_COUNT_'+(++i);c.output=alias;t.columns.push(c);return c;}
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
  function parseDdlPaste(text,dialect='tibero',change=false){
    const rows=[];let row=[],cell='',quoted=false;
    const src=String(text).replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    for(let i=0;i<src.length;i++){const ch=src[i];if(ch==='"'&&(quoted||cell==='')){if(quoted&&src[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(ch==='\t'||ch==='\n')){row.push(cell);cell='';if(ch==='\n'){rows.push(row);row=[];}}else cell+=ch;}
    row.push(cell);rows.push(row);
    const clean=rows.filter(r=>r.some(c=>c.trim())).map(r=>r.map(c=>c.trim()));
    if(clean.length&&/^(컬럼영문|영문컬럼|컬럼명|column_name|column name|column)$/i.test(clean[0][0]))clean.shift();
    const defaultType=dialect==='mssql'?'NVARCHAR':dialect==='mysql'?'VARCHAR':'VARCHAR2';
    return clean.map(r=>change?ddlColumn(r[0],r[1]||'',r[2]||'',r[3]||'',r[4]||''):ddlColumn(r[0],r[1]||'','',r[2]||defaultType,r[3]||(r[2]?'':'200')));
  }
  function generate(p){
    const errors=[],params=[];
    const err=s=>{if(!errors.includes(s))errors.push(s);};
    const quote=s=>p.dialect==='mysql'?'`'+s.replace(/`/g,'``')+'`':p.dialect==='mssql'?'['+s.replace(/]/g,']]')+']':'"'+s.replace(/"/g,'""')+'"';
    function ident(s,what='이름',path=false){s=String(s||'').trim();if(!s){err(what+'을 입력하세요.');return '__미입력__';}return (path?s.split('.'):[s]).map(part=>{if(!part){err(what+'에 빈 식별자가 있습니다.');return '__미입력__';}if(p.quote)return quote(part);if(!/^[\p{L}_][\p{L}\p{N}_$#]*$/u.test(part)){err(what+': 공백·특수문자는 식별자 따옴표 설정이 필요합니다.');return '__이름확인__';}return part;}).join('.');}
    const literal=s=>(p.dialect==='mssql'?'N':'')+"'"+String(s??'').replace(/'/g,"''")+"'";
    function ddlType(c,required=true){
      const type=String(c.dataType||'').trim().toUpperCase(),size=String(c.size||'').trim();
      if(!type){if(required)err(c.name+': 자료형을 입력하세요.');return '__자료형__';}
      if(!/^[A-Z][A-Z0-9_]*(?:\s+[A-Z0-9_]+)*$/.test(type)){err(c.name+': 자료형은 괄호 없이 입력하고 길이·정밀도는 별도 칸에 입력하세요.');return '__자료형확인__';}
      if(size&&!/^\d+(?:\s*,\s*\d+)?$/.test(size)){err(c.name+': 길이는 200 또는 10,2처럼 입력하세요.');return type+'(__길이확인__)';}
      return type+(size?'('+size.replace(/\s/g,'')+')':'');
    }
    function ddlDefault(c){
      const v=String(c.defaultValue||'').trim();
      if(!v)return '';
      if(/[;\r\n]/.test(v)||/--|\/\*/.test(v)){err(c.name+': 기본값에는 세미콜론·주석·줄바꿈을 사용할 수 없습니다.');return ' DEFAULT __기본값확인__';}
      return ' DEFAULT '+v;
    }
    function mssqlParts(raw){
      const parts=String(raw||'').trim().split('.');
      if(parts.length>2){err('MSSQL 설명 구문은 테이블명을 TABLE 또는 SCHEMA.TABLE 형식으로 입력하세요.');return {schema:'dbo',table:parts.at(-1)||'__미입력__'};}
      return parts.length===2?{schema:parts[0],table:parts[1]}:{schema:'dbo',table:parts[0]||'__미입력__'};
    }
    function mssqlProperty(raw,columnName,description,change){
      const names=mssqlParts(raw),args=`N'MS_Description', N'SCHEMA', ${literal(names.schema)}, N'TABLE', ${literal(names.table)}, N'COLUMN', ${literal(columnName)}`;
      const call=verb=>`EXEC sys.sp_${verb}extendedproperty\n     @name = N'MS_Description'\n   , @value = ${literal(description)}\n   , @level0type = N'SCHEMA', @level0name = ${literal(names.schema)}\n   , @level1type = N'TABLE',  @level1name = ${literal(names.table)}\n   , @level2type = N'COLUMN', @level2name = ${literal(columnName)};`;
      if(!change)return call('add');
      return `IF EXISTS (SELECT 1 FROM sys.fn_listextendedproperty(${args}))\nBEGIN\n    ${call('update').replace(/\n/g,'\n    ')}\nEND\nELSE\nBEGIN\n    ${call('add').replace(/\n/g,'\n    ')}\nEND;`;
    }
    function generateDdl(){
      const d=p.ddl||ddlConfig(),rawName=String(d.tableName||'').trim(),name=ident(rawName,'테이블명',true),cols=d.columns||[];
      if(!cols.length)err('컬럼을 하나 이상 추가하세요.');
      const names=cols.map(c=>String(c.name||'').trim().toUpperCase());
      cols.forEach(c=>ident(c.name,'컬럼명'));
      if(new Set(names).size!==names.length)err('컬럼명이 중복됩니다.');
      if(p.mode==='COMMENT'){
        const targets=cols.filter(c=>String(c.newDescription||'').trim());
        if(!targets.length)err('바뀔 한글명을 하나 이상 입력하세요.');
        return targets.map(c=>{
          const col=ident(c.name,'컬럼명');
          if(p.dialect==='mssql')return mssqlProperty(rawName,c.name,c.newDescription,true);
          if(p.dialect==='mysql')return `ALTER TABLE ${name}\n MODIFY COLUMN ${col} ${ddlType(c)}${c.nullable?'':' NOT NULL'}${ddlDefault(c)} COMMENT ${literal(c.newDescription)};`;
          return `COMMENT ON COLUMN ${name}.${col} IS ${literal(c.newDescription)};`;
        }).join('\n\n')||'-- 바뀔 한글명을 입력하세요.';
      }
      const pk=cols.filter(c=>c.pk),indexes=cols.filter(c=>c.index),uniques=cols.filter(c=>c.unique),base=rawName.split('.').pop().replace(/[^\p{L}\p{N}_]/gu,'_')||'TABLE';
      const definitions=cols.map(c=>{const required=c.nullable&&!c.pk?'':' NOT NULL',fallback=ddlDefault(c);return ident(c.name,'컬럼명')+' '+ddlType(c)+(p.dialect==='mssql'||p.dialect==='mysql'?required+fallback:fallback+required)+(p.dialect==='mysql'&&c.description?' COMMENT '+literal(c.description):'');});
      if(pk.length)definitions.push('CONSTRAINT '+ident('PK_'+base,'PK 제약조건명')+' PRIMARY KEY ('+pk.map(c=>ident(c.name,'컬럼명')).join(', ')+')');
      if(p.dialect==='mysql'&&uniques.length)definitions.push('UNIQUE KEY '+ident('UX_'+base+'_01','UNIQUE 인덱스명')+' ('+uniques.map(c=>ident(c.name,'컬럼명')).join(', ')+')');
      if(p.dialect==='mysql'&&indexes.length)definitions.push('INDEX '+ident('IX_'+base+'_01','인덱스명')+' ('+indexes.map(c=>ident(c.name,'컬럼명')).join(', ')+')');
      let sql='CREATE TABLE '+name+' (\n    '+definitions.join('\n  , ')+'\n)'+(p.dialect==='mysql'&&d.tableDescription?' COMMENT='+literal(d.tableDescription):'')+';';
      if(p.dialect!=='mysql'&&uniques.length)sql+='\n\nCREATE UNIQUE INDEX '+ident('UX_'+base+'_01','UNIQUE 인덱스명')+' ON '+name+' ('+uniques.map(c=>ident(c.name,'컬럼명')).join(', ')+');';
      if(p.dialect!=='mysql'&&indexes.length)sql+='\n\nCREATE INDEX '+ident('IX_'+base+'_01','인덱스명')+' ON '+name+' ('+indexes.map(c=>ident(c.name,'컬럼명')).join(', ')+');';
      if(p.dialect==='mssql'){
        if(d.tableDescription){const n=mssqlParts(rawName);sql+=`\n\nEXEC sys.sp_addextendedproperty\n     @name = N'MS_Description'\n   , @value = ${literal(d.tableDescription)}\n   , @level0type = N'SCHEMA', @level0name = ${literal(n.schema)}\n   , @level1type = N'TABLE',  @level1name = ${literal(n.table)};`;}
        cols.filter(c=>c.description).forEach(c=>{sql+='\n\n'+mssqlProperty(rawName,c.name,c.description,false);});
      }else if(p.dialect!=='mysql'){
        if(d.tableDescription)sql+='\n\nCOMMENT ON TABLE '+name+' IS '+literal(d.tableDescription)+';';
        cols.filter(c=>c.description).forEach(c=>{sql+='\nCOMMENT ON COLUMN '+name+'.'+ident(c.name,'컬럼명')+' IS '+literal(c.description)+';';});
      }
      return sql;
    }
    function expression(t,c,scope=[]){
      if(c.window){
        const w=c.window;
        if(!windowFunctions.includes(w.fn)){err('지원하지 않는 분석 함수입니다.');return '__분석함수__';}
        const raw=r=>ref(r,scope,'분석 함수 원본');
        const body=ranking(w.fn)?w.fn+'()':w.fn==='COUNT_ALL'?'COUNT(*)':w.fn+'('+raw({table:t.id,column:c.id})+')';
        const parts=[];
        if(w.partition.length)parts.push('PARTITION BY '+w.partition.map(raw).join(', '));
        if(w.order.length)parts.push('ORDER BY '+w.order.map(o=>raw(o.ref)+' '+(o.direction==='DESC'?'DESC':'ASC')).join(', '));
        if((ranking(w.fn)||w.frame==='running')&&!w.order.length)err('순위·누적 분석 함수에는 ORDER BY 컬럼을 선택하세요.');
        if(!ranking(w.fn)&&w.order.length)parts.push('ROWS BETWEEN UNBOUNDED PRECEDING AND '+(w.frame==='running'?'CURRENT ROW':'UNBOUNDED FOLLOWING'));
        return body+' OVER ('+parts.join(' ')+')';
      }
      if(!aggregates.includes(c.aggregate||'')){err('지원하지 않는 집계 함수입니다.');return '__집계함수__';}
      if(c.sourceMissing){err('하위 조회의 원본 출력 컬럼이 삭제되었습니다. 출력 행을 다시 설정하세요.');return '__출력참조__';}
      if(c.aggregate==='COUNT_ALL')return 'COUNT(*)';
      const raw=ident(t.alias,'테이블 별칭')+'.'+ident(c.name,'컬럼명');
      return c.aggregate==='COUNT_DISTINCT'?'COUNT(DISTINCT '+raw+')':c.aggregate?c.aggregate+'('+raw+')':raw;
    }
    function ref(r,scope,where){
      const found=scope.find(x=>x.table===r?.table&&x.column===r?.column);
      if(!found||found.c.sourceMissing){err(where+': 컬럼을 선택하거나 삭제된 참조를 다시 연결하세요.');return '__컬럼선택__';}
      if(where==='HAVING'||(where==='ORDER BY'&&(r.outputRef||found.c.selected))){
        if(where==='HAVING'&&found.c.window){err('분석 함수 결과 조건은 하위 조회로 감싼 후 상위 WHERE에서 설정하세요.');return '__분석결과조건__';}
        if(!found.c.selected){err(where+': 선택한 출력이 해제되었습니다. 출력 컬럼을 다시 선택하세요.');return '__출력선택__';}
        return expression(found.t,found.c,scope);
      }
      if(r.outputRef||found.c.aggregate==='COUNT_ALL'){err(where+': 집계 결과 대신 원본 컬럼을 선택하세요.');return '__원본컬럼__';}
      return ident(found.alias,'테이블 별칭')+'.'+ident(found.name,'컬럼명');
    }
    function value(v,type,where){v=String(v??'');if(type==='null')return 'NULL';if(type==='bind'){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)){err(where+': 변수명은 영문·숫자·밑줄로 입력하세요.');return '__변수명__';}params.push(v);return p.dialect==='mysql'?'?':p.dialect==='mssql'?'@'+v:':'+v;}if(type==='number'){if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v.trim())){err(where+': 숫자 값을 입력하세요.');return '__숫자입력__';}return v.trim();}const escaped=v.replace(/'/g,"''");if(p.dialect==='mysql'&&v.includes('\\')){err(where+': MySQL 문자열의 역슬래시는 SQL 모드에 따라 달라집니다. 바인드 변수를 사용하세요.');}return (p.dialect==='mssql'?'N':'')+"'"+escaped+"'";}
    function conditions(g,scope,depth,label){
      if(g.kind==='group'){if(!g.items.length)return '';return g.items.map((n,i)=>{const s=conditions(n,scope,depth,label);if(n.kind==='group'&&!s)err('빈 괄호 그룹에 조건을 추가하거나 그룹을 삭제하세요.');return(i?' '+(n.logic==='OR'?'OR':'AND')+' ':'')+(n.kind==='group'?'('+(s||'__조건입력__')+')':s);}).join('');}
      if(!ops.includes(g.op)){err('지원하지 않는 연산자입니다.');return '__연산자__';}
      if(label==='HAVING'&&(!havingOps.includes(g.op)||g.query)){err('HAVING은 출력값 비교 조건만 지원합니다.');return '__집계조건__';}
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
    function scopeRefs(q,anc){return [q,...anc].flatMap(owner=>owner.tables.flatMap(t=>exportsOf(t).map(c=>({table:t.id,column:c.id,alias:t.alias,name:c.name,owner,t,c}))));}
    function scopeQueries(scope){return [...new Set(scope.map(r=>r.owner))].map(owner=>({...owner,tables:owner.tables.filter(t=>scope.some(r=>r.owner===owner&&r.table===t.id))}));}
    function indent(s){return s.split('\n').map(l=>'    '+l).join('\n');}
    function source(t,depth){if(t.query)return '(\n'+indent(select(t.query,[],depth+1,'derived'))+'\n) '+ident(t.alias,'테이블 별칭');return ident(t.name,'테이블명',true)+' '+ident(t.alias,'테이블 별칭');}
    function select(q,anc=[],depth=0,purpose='normal'){
      if(depth>8){err('하위 조회는 8단계까지 지원합니다.');return '__깊이초과__';}
      const allAliases=[...q.tables.map(t=>t.alias.toUpperCase()),...anc.flatMap(a=>a.tables.map(t=>t.alias.toUpperCase()))];
      if(new Set(allAliases).size!==allAliases.length)err('현재·상위 조회의 테이블 별칭이 중복됩니다.');
      const scope=scopeRefs(q,anc);const selected=q.tables.flatMap(t=>exportsOf(t).filter(c=>c.selected).map(c=>({t,c})));
      const hasAggregate=selected.some(({c})=>!!c.aggregate&&!c.window);
      const grouped=[...new Set(selected.filter(({c})=>!c.aggregate&&!c.window).map(({t,c})=>expression(t,c,scope)))];
      if(hasAggregate)selected.filter(({c})=>c.window).forEach(({t,c})=>{
        const w=c.window,inputs=[...w.partition,...w.order.map(o=>o.ref)];
        if(!ranking(w.fn)&&w.fn!=='COUNT_ALL')inputs.push({table:t.id,column:c.id});
        if(inputs.some(r=>!grouped.includes(ref(r,scope,'분석 함수 원본'))))err('집계와 분석 함수를 함께 사용할 때 분석 대상·그룹·정렬은 GROUP BY 컬럼이어야 합니다. 집계 결과 분석은 하위 조회로 분리하세요.');
      });
      const hasHaving=!!q.having?.items.length;
      if(hasHaving&&!hasAggregate)err('HAVING을 사용하려면 출력 컬럼에 집계 함수를 선택하세요.');
      if(purpose!=='exists'&&!selected.length)err('출력할 컬럼을 하나 이상 선택하세요.');
      if(purpose==='in'&&selected.length!==1)err('IN 하위 조회의 출력 컬럼은 정확히 하나여야 합니다.');
      if(purpose==='derived') {const names=selected.map(({c})=>outputName(c).toUpperCase());if(new Set(names).size!==names.length)err('JOIN 하위 조회의 출력명이 중복됩니다. 출력 별칭을 지정하세요.');}
      const outputs=selected.map(({t,c},i)=>(i?'     , ':'SELECT ')+expression(t,c,scope)+(c.output||c.aggregate||c.window?' AS '+ident(outputName(c),'출력 별칭'):'')+(c.description?' -- '+c.description.replace(/[\r\n]/g,' '):''));
      // Keep aggregate projections in EXISTS: a global aggregate still yields a row on empty input.
      let sql=purpose==='exists'&&!hasAggregate?'SELECT 1':outputs.join('\n')||'SELECT __출력컬럼__';
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
      if(hasAggregate&&grouped.length)sql+='\n GROUP BY '+grouped.join('\n        , ');
      if(hasHaving){const having=conditions(q.having,scope.filter(r=>r.owner===q),depth,'HAVING');if(having)sql+='\nHAVING '+having;}
      if(q.order.length && purpose==='normal')sql+='\n ORDER BY '+q.order.map(o=>{
        const result=ref(o.ref,scope,'ORDER BY');const found=scope.find(r=>r.table===o.ref?.table&&r.column===o.ref?.column);
        if(hasAggregate&&!(found?.c.selected&&(found.c.aggregate||found.c.window))&&!grouped.includes(result))err('ORDER BY: 집계 조회에서는 그룹 기준 또는 선택한 집계 출력을 정렬하세요.');
        return result+' '+(o.direction==='DESC'?'DESC':'ASC');
      }).join('\n        , ');
      return sql;
    }
    let sql='';
    if(['CREATE','COMMENT'].includes(p.mode))sql=generateDdl();
    else if(p.mode==='SELECT')sql=select(p.root);
    else{
      const q=p.root,t=q.tables[0];if(q.tables.length!==1||t.query)err('수정·등록·삭제는 일반 테이블 하나를 대상으로 설정하세요. 조회 모드의 JOIN을 먼저 정리하세요.');
      if(p.dialect==='mysql'&&['UPDATE','DELETE'].includes(p.mode)){
        const readsTarget=q2=>q2.tables.some(st=>!st.query&&st.name.toUpperCase()===t.name.toUpperCase())||children(q2).some(c=>readsTarget(c.query));
        if(children(q).some(c=>readsTarget(c.query)))err('MySQL에서 변경 대상 테이블을 다시 읽는 하위 조회는 이 버전에서 지원하지 않습니다.');
      }
      const targetColumns=t.columns.filter(c=>c.selected);
      const names=targetColumns.map(c=>c.name.toUpperCase());if(new Set(names).size!==names.length)err('대상 테이블의 선택한 컬럼명이 중복됩니다.');
      if(targetColumns.some(c=>c.aggregate||c.window)||q.having?.items.length)err('집계·분석 출력과 HAVING은 SELECT에서만 사용하세요.');
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
    return {sql:sql+(['CREATE','COMMENT'].includes(p.mode)?'':';'),errors,params};
  }
  function validateProject(p){
    let count=0;const ids=new Set();const id=o=>{if(!o||typeof o.id!=='string'||ids.has(o.id))throw Error('설정 ID가 잘못되었거나 중복됩니다.');ids.add(o.id);};
    const str=v=>{if(typeof v!=='string'||v.length>100000)throw Error('설정 문자열이 잘못되었습니다.');};
    function checkWindow(w){
      if(w==null)return;
      if(!windowFunctions.includes(w.fn)||!['full','running'].includes(w.frame)||!Array.isArray(w.partition)||!Array.isArray(w.order)||w.partition.length>2000||w.order.length>2000)throw Error('분석 함수 설정을 확인하세요.');
      const reference=r=>{if(!r||r.outputRef)throw Error('분석 함수에는 원본 컬럼을 선택하세요.');str(r.table);str(r.column);};
      w.partition.forEach(reference);w.order.forEach(o=>{if(!o||!['ASC','DESC'].includes(o.direction))throw Error('분석 정렬을 확인하세요.');reference(o.ref);});
    }
    function checkGroup(g,d){if(++count>15000||d>16)throw Error('설정 규모가 너무 큽니다.');id(g);if(!['AND','OR'].includes(g.logic))throw Error('조건 연결을 확인하세요.');if(g.kind==='group'){if(!Array.isArray(g.items))throw Error('조건 목록이 없습니다.');g.items.forEach(n=>checkGroup(n,d+1));}else{if(g.kind!=='condition'||!ops.includes(g.op))throw Error('조건 형식이 잘못되었습니다.');['mode','type','value','second','like'].forEach(k=>str(g[k]));if(!['literal','column','bind','query'].includes(g.mode)||!['text','number','bind','null'].includes(g.type))throw Error('조건 값 종류가 잘못되었습니다.');if(g.query)checkQuery(g.query,d+1);}}
    function checkQuery(q,d){
      if(++count>15000||d>16)throw Error('하위 조회가 너무 깊습니다.');
      id(q);if(!Array.isArray(q.tables)||!q.tables.length||!Array.isArray(q.order))throw Error('조회 구성이 잘못되었습니다.');
      q.tables.forEach(t=>{
        id(t);['name','alias','join'].forEach(k=>str(t[k]));
        if(!['LEFT JOIN','INNER JOIN','RIGHT JOIN','FULL JOIN','CROSS JOIN'].includes(t.join))throw Error('JOIN 종류를 확인하세요.');
        if(!Array.isArray(t.columns))throw Error('컬럼 목록이 없습니다.');
        if(t.excluded&&!Array.isArray(t.excluded))throw Error('출력 목록이 잘못되었습니다.');
        t.columns.forEach(c=>{
          id(c);['name','description','output','value','valueType'].forEach(k=>str(c[k]));
          if(typeof c.selected!=='boolean'||!['text','number','bind','null'].includes(c.valueType))throw Error('컬럼 설정을 확인하세요.');
          if(c.aggregate===undefined)c.aggregate='';
          if(!aggregates.includes(c.aggregate))throw Error('지원하지 않는 집계 함수입니다.');
          if(c.aggregate==='COUNT_ALL'&&c.name!=='*')throw Error('전체 행 개수 설정을 확인하세요.');
          if(c.sourceColumnId!==undefined)str(c.sourceColumnId);
          checkWindow(c.window);
        });
        if(t.outputSettings!==undefined){
          if(!t.outputSettings||typeof t.outputSettings!=='object'||Array.isArray(t.outputSettings))throw Error('출력 설정을 확인하세요.');
          Object.values(t.outputSettings).forEach(s=>{
            if(!s||typeof s!=='object'||Object.keys(s).some(k=>!['aggregate','output','selected','window'].includes(k)))throw Error('출력 설정 항목이 잘못되었습니다.');
            checkWindow(s.window);
            if(s.aggregate!==undefined&&(!aggregates.includes(s.aggregate)||s.aggregate==='COUNT_ALL'))throw Error('하위 조회 컬럼의 집계 함수를 확인하세요.');
            if(s.output!==undefined)str(s.output);
            if(s.selected!==undefined&&typeof s.selected!=='boolean')throw Error('출력 선택을 확인하세요.');
          });
        }
        checkGroup(t.on,d+1);if(t.query)checkQuery(t.query,d+1);
      });
      checkGroup(q.where,d+1);
      if(q.having===undefined)q.having=group();
      checkGroup(q.having,d+1);
      q.order.forEach(o=>{if(!o||!o.ref||!['ASC','DESC'].includes(o.direction))throw Error('정렬 설정을 확인하세요.');});
    }
    if(!p||p.version!==1||!['tibero','oracle','mssql','mysql'].includes(p.dialect)||!['SELECT','UPDATE','INSERT','DELETE','CREATE','COMMENT'].includes(p.mode)||typeof p.quote!=='boolean')throw Error('SQL 생성기 설정 파일이 아닙니다.');
    if(p.ddl===undefined)p.ddl=ddlConfig();
    if(!p.ddl||typeof p.ddl!=='object'||Array.isArray(p.ddl)||!Array.isArray(p.ddl.columns)||p.ddl.columns.length>2000)throw Error('테이블 생성 설정을 확인하세요.');
    ['tableName','tableDescription'].forEach(k=>str(p.ddl[k]??''));p.ddl.tableName=p.ddl.tableName??'';p.ddl.tableDescription=p.ddl.tableDescription??'';
    p.ddl.columns.forEach(c=>{id(c);['name','description','newDescription','dataType','size','defaultValue'].forEach(k=>{if(c[k]===undefined)c[k]='';str(c[k]);});['nullable','pk','index','unique'].forEach(k=>{if(c[k]===undefined)c[k]=k==='nullable';if(typeof c[k]!=='boolean')throw Error('DDL 컬럼 설정을 확인하세요.');});});
    if(p.sampleData===undefined)p.sampleData={};
    if(!p.sampleData||typeof p.sampleData!=='object'||Array.isArray(p.sampleData))throw Error('예시 데이터 설정을 확인하세요.');
    let sampleCells=0;Object.entries(p.sampleData).forEach(([tableId,rows])=>{str(tableId);if(!Array.isArray(rows)||rows.length>1000)throw Error('예시 데이터는 표당 최대 1,000행입니다.');rows.forEach(row=>{if(!Array.isArray(row)||row.length>2000)throw Error('예시 데이터 행을 확인하세요.');row.forEach(cell=>{if(++sampleCells>200000)throw Error('예시 데이터 규모가 너무 큽니다.');if(cell!==null&&typeof cell!=='string'&&typeof cell!=='number')throw Error('예시 데이터 값 형식을 확인하세요.');});});});
    checkQuery(p.root,0);return p;
  }
  const api={uid,group,condition,column,ddlColumn,ddlConfig,table,query,project,ops,aggregates,windowFunctions,ranking,windowSpec,havingOps,children,walkGroup,findQuery,queryParent,deleteSubquery,findNode,exportsOf,refs,outputRefs,outputName,outputExpression,setOutput,duplicateOutput,addCountAll,parsePaste,parseDdlPaste,generate,validateProject};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SQLBuilderCore=api;
})(typeof window!=='undefined'?window:globalThis);
