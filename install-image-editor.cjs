const fs=require('node:fs'),path=require('node:path');
const index=path.join(__dirname,'frontend','index.html');
if(!fs.existsSync(index))throw Error('프로젝트 최상위 폴더에 압축을 풀어주세요. frontend/index.html이 필요합니다.');
for(const file of ['image-editor.html','image-editor.css','image-editor.js','image-editor-core.js'])if(!fs.existsSync(path.join(__dirname,'frontend',file)))throw Error('누락된 파일: '+file);
let html=fs.readFileSync(index,'utf8'),before=html;
if(!html.includes('href="image-editor.html"')){
 const marker='<div class="top-actions">';
 if(!html.includes(marker))throw Error('상단 메뉴를 찾지 못했습니다. frontend/index.html에 image-editor.html 링크를 추가해주세요.');
 html=html.replace(marker,marker+'\n      <a href="image-editor.html" class="btn btn-light" style="text-decoration:none">이미지 편집기 ↗</a>');
}
if(!html.includes('이미지 편집기 열기 ↗')&&html.includes('<a id="arcadeWhileLoading"'))html=html.replace(/(<a id="arcadeWhileLoading"[^>]*>)/,'<a href="image-editor.html" style="display:block;margin:12px;color:#805bdf">이미지 편집기 열기 ↗</a>\n      $1');
if(html!==before)fs.writeFileSync(index,html);
console.log('이미지 편집기 연결 완료: /image-editor.html');
