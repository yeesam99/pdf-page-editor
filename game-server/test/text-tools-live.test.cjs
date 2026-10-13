const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('automatic comparison preserves editor selection; row merge and undo update only destination',()=>{
 const nodes=new Map(),timers=new Map();let tid=0,click;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',selectionStart:0,selectionEnd:0,scrollTop:0,scrollLeft:0,checked:false,style:{},listeners:{},setAttribute(){},addEventListener(k,v){this.listeners[k]=v;},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}});return nodes.get(id);};
 const document={getElementById:node,querySelectorAll:()=>[],documentElement:{style:{setProperty(){}}},addEventListener:(k,f)=>{if(k==='click')click=f;}};
 const core=require('../../frontend/text-tools-core.js');
 const context={document,window:{TextToolsCore:core},localStorage:{getItem:()=>null,setItem(){}},setTimeout:f=>{timers.set(++tid,f);return tid;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:f=>f(),navigator:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../frontend/text-tools-live.js'),'utf8'),context);
 const left=node('left-input'),right=node('right-input');left.value='a\nold\nz';right.value='a\nnew\nz';right.selectionStart=4;right.selectionEnd=5;right.scrollTop=24;
 right.listeners.input();for(const f of [...timers.values()])f();timers.clear();
 assert.equal(node('diff-count').textContent,'차이 1개');assert.equal(right.selectionStart,4);assert.equal(right.selectionEnd,5);assert.equal(right.scrollTop,24);
 const v=node('left-gutter').innerHTML.match(/data-version="(\d+)"/)[1];
 click({target:{closest:()=>({dataset:{merge:'right',index:'1',version:v}})}});
 assert.equal(right.value,'a\nold\nz');assert.equal(left.value,'a\nold\nz');assert.equal(node('diff-count').textContent,'차이 0개');
 node('undo-merge').onclick();assert.equal(right.value,'a\nnew\nz');assert.equal(node('diff-count').textContent,'차이 1개');
 right.listeners.compositionstart();right.value+='한';right.listeners.input();assert.equal(timers.size,1); // toast only; no comparison during IME
 right.listeners.compositionend();assert.equal(node('live-status').textContent,'비교 중…');
});
