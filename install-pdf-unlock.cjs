const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const backend = path.join(root, 'backend/app.py');
const frontend = path.join(root, 'frontend/index.html');
for (const name of ['backend/pdf_unlock.py','frontend/pdf-unlock.js']) {
  if (!fs.existsSync(path.join(root,name))) throw Error('Missing ' + name);
}
let py = fs.readFileSync(backend, 'utf8');
let html = fs.readFileSync(frontend, 'utf8');
if (!py.includes('from pdf_unlock import router as pdf_unlock_router')) {
  if (!/app\s*=\s*FastAPI\(/.test(py)) throw Error('FastAPI app not found');
  py += '\n\nfrom pdf_unlock import router as pdf_unlock_router\napp.include_router(pdf_unlock_router)\n';
}
if (!html.includes('src="./pdf-unlock.js')) {
  if (!html.includes('</body>')) throw Error('HTML body not found');
  html = html.replace('</body>', '<script src="./pdf-unlock.js?v=1.1.0"></script>\n</body>');
}
html = html.replace(/pdf-unlock\.js\?v=[^"']+/g, 'pdf-unlock.js?v=1.1.0');
fs.writeFileSync(backend, py); fs.writeFileSync(frontend, html);
console.log('PDF 잠금 해제 추가 완료. PDF API 서버와 프론트엔드를 모두 배포해주세요.');
