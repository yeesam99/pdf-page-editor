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
