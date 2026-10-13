const fs=require('node:fs'),path=require('node:path');
const root=__dirname,index=path.join(root,'frontend','index.html');
if(!fs.existsSync(index))throw Error('frontend/index.html을 찾을 수 없습니다. 프로젝트 최상위 폴더에서 실행해주세요.');
let html=fs.readFileSync(index,'utf8');
let changed=false;
if(!html.includes('href="text-tools.html"')){
  const marker='<div class="top-actions">';
  if(!html.includes(marker))throw Error('PDF 편집기 상단 메뉴 위치를 찾지 못했습니다. index.html 구조를 확인해주세요.');
  html=html.replace(marker,marker+'\n      <a href="text-tools.html" class="btn btn-light" style="text-decoration:none">텍스트 도구 ↗</a>');
  changed=true;
}
if(!html.includes('텍스트 도구 열기 ↗')&&html.includes('<a id="arcadeWhileLoading"')){
  html=html.replace(/(<a id="arcadeWhileLoading"[^>]*>)/,'<a href="text-tools.html" style="display:block;margin:12px;color:#2563eb">텍스트 도구 열기 ↗</a>\n      $1');
  changed=true;
}
if(changed)fs.writeFileSync(index,html);
console.log('텍스트 도구 연결 완료: frontend/text-tools.html');
