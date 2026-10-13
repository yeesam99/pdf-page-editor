# PDF 편집기 텍스트 도구

## 설치

배포 묶음을 `pdf_page_editor_render_split` 프로젝트 최상위 폴더에 덮어쓴 다음 실행합니다.

```powershell
node .\install-text-tools.cjs
```

설치 스크립트는 `frontend/index.html`에 텍스트 도구 버튼이 없는 경우에만 한 번 추가하므로 반복 실행해도 중복되지 않습니다.

## 제공 기능

- 모두 대문자·모두 소문자·단어 첫 글자·문장 첫 글자 변환
- 대·소문자 반전과 앞뒤·연속 공백 정리
- 글자 수, 공백 제외 글자 수, 단어 수, 줄 수 표시
- 원본/변경본 줄 단위 비교 및 변경된 글자 강조
- 대소문자·공백·빈 줄 차이 무시
- 이전/다음 차이점 이동, 좌우 복사, 비교 내용 TXT 저장
- 입력 내용은 서버로 전송하지 않고 브라우저 내부에서만 처리

## 접속 주소

배포 후 `https://pdf-page-editor.onrender.com/text-tools.html`에서 바로 사용할 수 있습니다.

## 확인

```powershell
node --test game-server/test/text-tools.test.cjs
```
