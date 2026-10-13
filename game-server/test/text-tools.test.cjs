const test=require('node:test');
const assert=require('node:assert/strict');
const T=require('../../frontend/text-tools-core.js');

test('case converter handles upper, lower, title, sentence, swap and whitespace',()=>{
  assert.equal(T.caseConvert('Hello 한글','upper'),'HELLO 한글');
  assert.equal(T.caseConvert('Hello WORLD','lower'),'hello world');
  assert.equal(T.caseConvert('hello-world test','title'),'Hello-World Test');
  assert.equal(T.caseConvert('hello. world\nnext','sentence'),'Hello. World\nNext');
  assert.equal(T.caseConvert('AbC','swap'),'aBc');
  assert.equal(T.caseConvert('  a   b \n c  ','trim'),'a b\nc');
});

test('comparison reports changed, added and removed lines with ignore options',()=>{
  let result=T.compare('A\nB\nC','A\nBX\nC\nD');
  assert.equal(result.differences,2);
  assert.deepEqual(result.rows.map(x=>x.type),['same','change','same','add']);
  result=T.compare('HELLO  WORLD\n\nA','hello world\nA',{ignoreCase:true,ignoreSpace:true,ignoreBlank:true});
  assert.equal(result.differences,0);
});

test('stats counts characters, words and lines',()=>{
  assert.deepEqual(T.stats('ab cd\nef'),{chars:8,charsNoSpace:6,words:3,lines:2});
});

test('blank deletion and inserted SQL are never mislabeled as a modification',()=>{
  const r=T.compare('BEFORE\n\nAFTER','BEFORE\n-- remove assembly\nDROP ASSEMBLY [Example];\nAFTER');
  assert.equal(r.rows.filter(x=>x.type==='change').length,0);
  assert.equal(r.rows.filter(x=>x.type==='add').length,2);
  assert.equal(r.rows.filter(x=>x.type==='remove').length,1);
  assert.equal(r.rows.filter(x=>x.type==='same').length,2);
});

test('merge one modified line in either direction without touching other lines',()=>{
 const left='a\nold\nz',right='a\nnew\nz',rows=T.compare(left,right).rows;
 assert.deepEqual(T.mergeRow(left,right,rows,1,'right'),{left,right:left});
 assert.deepEqual(T.mergeRow(left,right,rows,1,'left'),{left:right,right});
});
test('merge additions and deletions, start/end and empty documents',()=>{
 for(const [left,right] of [['a\nz','a\nnew\nz'],['a','new\na'],['a','a\nnew'],['','new'],['new','']]){
   const rows=T.compare(left,right).rows,index=rows.findIndex(x=>x.type!=='same');
   assert.deepEqual(T.mergeRow(left,right,rows,index,'right'),{left,right:left});
   assert.deepEqual(T.mergeRow(left,right,rows,index,'left'),{left:right,right});
 }
});
test('consecutive changes pair in order and merge only the selected row',()=>{
 const l='start\nold1\nold2\nend',r='start\nnew1\nnew2\nend',rows=T.compare(l,r).rows;
 assert.deepEqual(rows.map(x=>x.type),['same','change','change','same']);
 assert.equal(T.mergeRow(l,r,rows,1,'right').right,'start\nold1\nnew2\nend');
});
test('ignored blank lines retain original positions during merge',()=>{
 const l='a\n\nold\nz',r='a\nnew\n\nz',rows=T.compare(l,r,{ignoreBlank:true}).rows;
 assert.equal(T.mergeRow(l,r,rows,1,'right').right,'a\nold\n\nz');
});
test('large document with an insertion stays aligned',()=>{
 const lines=Array.from({length:3000},(_,i)=>'line '+i),other=[...lines];other.splice(1500,0,'new');
 const r=T.compare(lines.join('\n'),other.join('\n'));
 assert.equal(r.differences,1);assert.equal(r.rows[1500].type,'add');
});
