(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TextToolsCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const normalize=(text,opt={})=>{
    let value=String(text??'');
    if(opt.ignoreCase)value=value.toLocaleLowerCase();
    if(opt.ignoreSpace)value=value.replace(/\s+/g,' ').trim();
    return value;
  };
  const splitLines=text=>String(text??'').replace(/\r\n?/g,'\n').split('\n');
  function lcsDiff(left,right,key){
    const n=left.length,m=right.length;
    if(n*m>1500000){
      const out=[];
      for(let i=0;i<Math.max(n,m);i++){
        if(i<n&&i<m&&key(left[i])===key(right[i]))out.push({type:'same',left:left[i],right:right[i]});
        else{
          if(i<n)out.push({type:'remove',left:left[i]});
          if(i<m)out.push({type:'add',right:right[i]});
        }
      }
      return out;
    }
    const dp=Array.from({length:n+1},()=>new Uint32Array(m+1));
    for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
      dp[i][j]=key(left[i])===key(right[j])?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
    const out=[];let i=0,j=0;
    while(i<n||j<m){
      if(i<n&&j<m&&key(left[i])===key(right[j])){out.push({type:'same',left:left[i++],right:right[j++]});continue;}
      if(j<m&&(i===n||dp[i][j+1]>=dp[i+1][j]))out.push({type:'add',right:right[j++]});
      else out.push({type:'remove',left:left[i++]});
    }
    return out;
  }
  function compare(leftText,rightText,opt={}){
    let left=splitLines(leftText).map((text,index)=>({text,no:index+1}));
    let right=splitLines(rightText).map((text,index)=>({text,no:index+1}));
    if(opt.ignoreBlank){left=left.filter(x=>x.text.trim());right=right.filter(x=>x.text.trim());}
    const key=x=>normalize(x.text,opt);
    const raw=lcsDiff(left,right,key),rows=[];
    for(let i=0;i<raw.length;i++){
      const cur=raw[i],next=raw[i+1];
      if(cur.type==='remove'&&next?.type==='add'){
        rows.push({type:'change',left:cur.left,right:next.right});i++;continue;
      }
      if(cur.type==='add'&&next?.type==='remove'){
        rows.push({type:'change',left:next.left,right:cur.right});i++;continue;
      }
      rows.push(cur);
    }
    return {rows,differences:rows.filter(x=>x.type!=='same').length};
  }
  function caseConvert(text,mode){
    const value=String(text??'');
    if(mode==='upper')return value.toLocaleUpperCase();
    if(mode==='lower')return value.toLocaleLowerCase();
    if(mode==='title')return value.toLocaleLowerCase().replace(/(^|[\s\-_([{])([a-z\p{L}])/gu,(m,p,c)=>p+c.toLocaleUpperCase());
    if(mode==='sentence')return value.toLocaleLowerCase().replace(/(^|[.!?]\s+|\n+)([a-z\p{L}])/gu,(m,p,c)=>p+c.toLocaleUpperCase());
    if(mode==='swap')return Array.from(value).map(c=>c===c.toLocaleUpperCase()?c.toLocaleLowerCase():c.toLocaleUpperCase()).join('');
    if(mode==='trim')return value.split(/\r?\n/).map(x=>x.trim().replace(/[\t ]+/g,' ')).join('\n').trim();
    return value;
  }
  function stats(text){
    const value=String(text??'');
    return {chars:value.length,charsNoSpace:value.replace(/\s/g,'').length,words:(value.trim().match(/\S+/g)||[]).length,lines:value?splitLines(value).length:0};
  }
  return {normalize,splitLines,compare,caseConvert,stats};
});
