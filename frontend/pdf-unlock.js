/* PDF unlock add-on: no passwords in storage or URLs. */
(() => {
  'use strict';
  const dialog = document.createElement('dialog');
  dialog.style.cssText = 'width:min(460px,90vw);border:1px solid #d8deea;border-radius:16px;padding:24px;color:#25324a';
  dialog.innerHTML = `<form><h2>PDF 잠금 해제</h2><p data-name style="overflow-wrap:anywhere"></p>
    <p>파일과 비밀번호는 PDF 처리 서버로 전송됩니다. 잠금 해제 과정에서는 서버에 저장하지 않습니다. 편집에 추가하면 기존 편집 세션에 사본이 저장됩니다.</p>
    <p>원본은 그대로 유지됩니다. 전자서명이 있는 문서는 변경 후 서명 유효성이 달라질 수 있습니다.</p>
    <label>PDF 비밀번호 <input type="password" autocomplete="off" required style="display:block;width:100%;box-sizing:border-box;padding:10px;margin:10px 0"></label>
    <p data-status role="status"></p><button type="submit">잠금 해제</button> <button type="button" data-cancel>취소</button></form>`;
  document.body.append(dialog);
  const input = dialog.querySelector('input'), status = dialog.querySelector('[data-status]');
  const originalUpload = uploadFiles;
  let busy = false;
  async function request(path, file, password) {
    const body = new FormData(); body.append('file', file);
    if (password !== undefined) body.append('password', password);
    const response = await fetch(apiUrl('/api/pdf/' + path), { method:'POST', body, cache:'no-store' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(typeof err.detail === 'string' ? err.detail : response.status === 404 ? 'PDF 서버 업데이트가 필요합니다.' : 'PDF 처리에 실패했습니다.');
    }
    return path === 'security' ? response.json() : response.blob();
  }
  function authenticate(file) {
    return new Promise(resolve => {
      let controller = 0;
      input.value = ''; status.textContent = '';
      dialog.querySelector('[data-name]').textContent = file.name;
      const submit = dialog.querySelector('[type=submit]'); submit.disabled = false;
      const finish = value => { controller++; input.value = ''; dialog.close(); resolve(value); };
      dialog.oncancel = event => { event.preventDefault(); finish(null); };
      dialog.querySelector('[data-cancel]').onclick = () => finish(null);
      dialog.querySelector('form').onsubmit = async event => {
        event.preventDefault(); const token = ++controller;
        submit.disabled = true; status.textContent = '잠금을 해제하고 있습니다…';
        const password = input.value; input.value = '';
        try {
          const blob = await request('unlock', file, password);
          if (token === controller) finish(new File([blob], file.name.replace(/\.pdf$/i, '') + '_잠금해제.pdf', {type:'application/pdf'}));
        } catch (err) { if (token === controller) { status.textContent = err.message; submit.disabled = false; input.focus(); } }
      };
      dialog.showModal(); input.focus();
    });
  }
  async function prepare(file) {
    if (file.size > 50 * 1024 * 1024) throw new Error('PDF는 50MB 이하만 지원합니다.');
    const info = await request('security', file);
    return info.protected ? authenticate(file) : file;
  }
  uploadFiles = async function(files) {
    if (busy) return showToast('진행 중인 PDF 처리를 먼저 완료해주세요.');
    busy = true;
    try {
      const ready = [];
      for (const file of files) {
        if (!/\.pdf$/i.test(file.name)) continue;
        uploadStatus.textContent = `${file.name}: 잠금 확인 중…`;
        const result = await prepare(file); if (result) ready.push(result);
      }
      if (ready.length) await originalUpload(ready);
      else uploadStatus.textContent = '추가된 PDF가 없습니다.';
    } catch (err) { uploadStatus.textContent = err.message; showToast(err.message, 5000); }
    finally { busy = false; fileInput.value = ''; }
  };
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'btn'; button.textContent = '🔓 잠금 해제 PDF 다운로드';
  button.style.margin = '8px';
  const picker = document.createElement('input'); picker.type = 'file'; picker.accept = '.pdf,application/pdf'; picker.hidden = true;
  button.onclick = () => { if (!busy) picker.click(); };
  picker.onchange = async () => {
    const file = picker.files[0]; if (!file || busy) return;
    busy = true; button.disabled = true;
    try {
      const result = await prepare(file);
      if (result) {
        const url = URL.createObjectURL(result), a = document.createElement('a');
        a.href = url; a.download = result.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
        showToast(result === file ? '잠금이 없는 PDF입니다. 원본 사본을 다운로드합니다.' : '암호 없는 사본을 다운로드했습니다.');
      }
    } catch (err) { showToast(err.message, 5000); }
    finally { busy = false; button.disabled = false; picker.value = ''; }
  };
  const anchor = fileInput.closest('label') || fileInput;
  anchor.after(button, picker);
})();
