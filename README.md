# PDF 페이지 편집기 — Render 분리 배포 버전

기존 PDF 편집 기능을 유지하면서 Render 무료 서버의 재시작 시간을 안내하도록 프론트엔드와 백엔드를 분리한 버전입니다.

## 포함 기능

- 여러 PDF 업로드 및 추가
- 페이지 삭제, 파일 전체 삭제
- 드래그 순서 변경
- 서로 붙어 있는 여러 페이지 선택 후 한 칸 이동
- 선택 페이지 맨 앞으로/맨 뒤로 이동
- 선택한 한 페이지 또는 붙어 있는 여러 페이지를 왼쪽/오른쪽으로 90도 회전
- 회전 상태를 썸네일, 미리보기, 최종 PDF에 반영
- 페이지 미리보기
- 최종 PDF 병합 및 다운로드
- 서버 연결 중 전체화면 로딩 안내
- 연결 경과 시간 표시
- 연결 완료 후 `시작하기` 버튼 표시
- 브라우저가 열린 동안 5분 간격 health 요청

## 폴더 구조

```text
pdf_page_editor_render_split/
├─ backend/
│  ├─ app.py
│  └─ requirements.txt
├─ frontend/
│  ├─ index.html
│  ├─ style.css
│  ├─ app.js
│  ├─ config.js
│  └─ build-config.mjs
├─ render.yaml
├─ install_local.bat
└─ run_local.bat
```

## Windows에서 먼저 테스트

1. `install_local.bat`을 한 번 실행합니다.
2. 설치가 끝나면 `run_local.bat`을 실행합니다.
3. 브라우저에서 `http://127.0.0.1:5500`이 열립니다.

백엔드는 `http://127.0.0.1:8083`, 프론트엔드는 `http://127.0.0.1:5500`을 사용합니다.

## Render 배포

1. 이 폴더의 **내용 전체**를 GitHub 저장소의 루트에 올립니다.
2. Render Dashboard에서 `New +` → `Blueprint`를 선택합니다.
3. 저장소를 연결합니다.
4. Render가 루트의 `render.yaml`을 읽으면 `pdf-page-editor-api`와 `pdf-page-editor` 두 서비스가 표시됩니다.
5. `Apply`를 눌러 배포합니다.
6. 배포가 끝나면 `pdf-page-editor` Static Site 주소로 접속합니다.

Static Site 빌드 시 Render가 백엔드의 실제 주소를 읽어 `frontend/config.js`를 자동 생성하므로 API 주소를 수동으로 수정할 필요가 없습니다.

## 연결 화면 동작

1. Static Site 화면은 즉시 열립니다.
2. 전체화면 팝업에서 백엔드 `/api/health` 연결을 반복 확인합니다.
3. 연결 중에는 `약 10초~1분` 안내와 실제 경과 시간을 표시합니다.
4. 1분이 지나면 지연 안내를 표시하면서 자동 연결을 계속합니다.
5. 백엔드 연결과 편집 세션 준비가 끝나면 `시작하기` 버튼이 나타납니다.

## 무료 Render 파일 보관 주의사항

코드에는 자동 삭제 스케줄러가 없습니다. 다만 Render Free Web Service의 로컬 파일은 임시 저장소이므로 서비스가 재시작되거나 절전되면 업로드 PDF와 작업 세션이 사라질 수 있습니다. 현재 버전은 업로드 후 편집을 마치고 결과 PDF를 바로 내려받는 용도입니다.

장기 보관이 필요해지면 유료 Persistent Disk 또는 외부 Object Storage 연결이 필요합니다.
