# PDF 잠금 해제 v1.1.0

프로젝트 루트에 압축을 풀고 `node install-pdf-unlock.cjs`를 실행하세요.
설치기는 현재 backend/app.py와 frontend/index.html에 연결만 추가합니다.
기존 파일 전체를 덮어쓰지 않으며 반복 실행해도 연결이 중복되지 않습니다.

## 사용
- PDF 추가/드롭 시 보안 상태를 확인하고 열기 암호가 설정된 파일만 비밀번호를 요청합니다.
- 올바른 비밀번호로 해제한 사본이 기존 편집 세션에 추가됩니다.
- PDF 추가 아래 ‘잠금 해제 PDF 다운로드’는 편집 세션에 추가하지 않고 사본을 다운로드합니다.
- 열기 비밀번호 없이 내용이 보이는 PDF는 소유자 비밀번호 없이 복사·인쇄·편집 제한을 해제합니다. 업로드 시 자동 처리되며 다운로드 버튼으로 사본만 받을 수도 있습니다.
- 잘못된 비밀번호는 재입력, 취소 시 해당 파일은 건너뜁니다.
- 최대 50MB. 원본 파일을 수정하지 않습니다. 비밀번호 추측/복구는 지원하지 않습니다.

## 처리 및 주의
브라우저 전용이 아니라 기존 Python PDF API의 PyMuPDF를 사용합니다.
검사/해제 요청은 메모리에서 처리하고 파일과 비밀번호를 디스크/로그에 저장하지 않습니다.
편집에 추가한 사본은 기존 세션 정책에 따라 서버에 저장됩니다.
운영 서버에서 요청 본문을 기록하는 별도 로깅은 사용하지 마세요.
문서를 이미지로 변환하지 않으므로 텍스트, 목차, 메타데이터를 유지합니다.
전자서명 문서의 저장은 서명 유효성에 영향을 줄 수 있습니다.
특수 보안/DRM 및 손상 PDF는 지원을 보장하지 않습니다.

## 적용 / 배포 (PowerShell)
```powershell
cd C:\project\pdf_page_editor_render_split
node install-pdf-unlock.cjs
git add backend/pdf_unlock.py backend/app.py backend/test_pdf_unlock.py frontend/pdf-unlock.js frontend/index.html install-pdf-unlock.cjs PDF_UNLOCK_README.md
git commit -m "PDF 비밀번호 인증 및 잠금 해제 사본 다운로드 추가"
git push origin main
```
Render의 **pdf-page-editor-api (Python 서버)** 와 **pdf-page-editor (프론트)** 를 모두 배포하세요.
게임 서버 mongle-game-server는 대상이 아닙니다. 배포 완료 후 Ctrl+F5.
운영 의존성은 기존 requirements.txt 그대로 사용합니다.

## 테스트
```powershell
python -m pip install -r backend/requirements.txt httpx
python -m unittest discover -s backend -p test_pdf_unlock.py -v
```
AES-256 사용자/소유자 인증, 잘못된 암호, 권한 제한 PDF, 일반/손상 PDF,
크기 제한, 해제 후 암호 없음/검색 가능한 텍스트/목차/제목 보존을 검증합니다.
실제 Render 운영 배포는 사용자가 위 명령 실행 후 확인해야 합니다.
