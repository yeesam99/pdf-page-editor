# 몽글 블록 — 3분 온라인 점수 대결

기존 혼자하기에 2~4인 온라인 모드를 추가한 패키지입니다.
각자 PC에서 접속해 내 보드는 크게, 상대 보드는 작게 보며 점수로 겨룹니다.
공격이나 방해 줄은 없습니다.

## 1. 적용할 위치

기존 프로젝트: C:\project\pdf_page_editor_render_split

ZIP 안의 frontend 파일을 기존 frontend에 합치고, game-server 폴더를 프로젝트 루트에 추가하세요.
기존 폴더를 삭제하거나 통째로 교체하지 마세요. PDF 백엔드는 수정하지 않습니다.

- 새 파일: block-online.html / .css / .js / block-online-config.js / block-online-engine.js
- 변경 파일: block-game.html(온라인 입장 링크), block-game-core.js(온라인 복원을 위한 난수 상태 저장)
- 함께 제공한 block-game.css와 block-game.js는 이전 혼자하기 파일 그대로입니다. 이후 수정했다면 기존 파일을 유지하세요.
- block-game.html을 이후 수정했다면 기존 화면을 유지하고 아래 링크만 메뉴에 추가해도 됩니다.

~~~html
<a href="block-online.html">온라인 대전</a>
~~~

## 2. 내 PC에서 실행

Node.js 22 이상이 필요합니다. HTML을 더블클릭하는 대신 아래 서버를 실행하세요.

~~~powershell
cd C:\project\pdf_page_editor_render_split
npm ci --prefix game-server
npm test --prefix game-server
npm start --prefix game-server
~~~

브라우저에서 http://localhost:3001/block-online.html 을 엽니다.
서버가 온라인 페이지와 게임 엔진 파일도 함께 제공합니다.

1. 닉네임 입력 → 방 만들기
2. 다른 브라우저/시크릿 창에서 같은 주소 접속 → 다른 닉네임과 방 코드로 입장
3. 모두 준비 → 방장이 시작
4. 3초 카운트다운 후 3분 대결

localhost는 각자의 PC입니다. 동료의 PC에서 내 localhost 링크로 접속할 수는 없습니다.
각자 자리에서 플레이하려면 공개 서버를 배포하거나 사내에서 접근 가능한 서버 주소를 사용하세요.

## 3. Render에 대전 서버 추가

현재 PDF API와 별개의 Node Web Service를 추가합니다.
코드를 Git에 올린 후 Render에서 같은 저장소로 새 Web Service를 생성하세요.

| 설정 | 값 |
| --- | --- |
| 소스 저장소 | 기존 pdf_page_editor_render_split 저장소 |
| 서비스 이름 | 원하는 대전 서버 이름 |
| Runtime | Node |
| Root Directory | 비워두기 — frontend와 game-server가 모두 필요합니다 |
| Build Command | npm ci --prefix game-server |
| Start Command | npm start --prefix game-server |
| Health Check Path | /health |
| 인스턴스 수 | 1 |
| 환경변수 NODE_VERSION | 22 |
| 환경변수 ALLOWED_ORIGINS | https://pdf-page-editor.onrender.com |

프론트 주소가 다르면 ALLOWED_ORIGINS를 실제 주소로 변경하세요.
여러 주소는 쉼표로 구분하고 경로 또는 끝의 /는 넣지 마세요.
예: https://pdf-page-editor.onrender.com,http://localhost:8080

Render가 제공하는 PORT를 자동으로 사용합니다.
플랜은 본인 계정에서 선택하세요. 무료 서비스는 유휴 후 기동 대기가 발생할 수 있습니다.

배포 후 대전 서버의 /health 가 {"ok":true}를 반환하는지 확인하세요.
대전 서버의 루트 주소 또는 /block-online.html에서 직접 대기실에 접속할 수도 있습니다.

## 4. 기존 PDF 사이트와 연결

frontend/block-online-config.js에서 빈 문자열을 실제 배포된 대전 서버 URL로 바꾸세요.

~~~javascript
window.BLOCK_ONLINE_SERVER = 'https://YOUR-GAME-SERVER.onrender.com';
~~~

YOUR-GAME-SERVER는 예시이므로 그대로 사용하지 마세요.
브라우저 코드가 HTTPS를 WSS로 바꾸고 /ws에 연결합니다.
대전 서버가 제공하는 페이지에서만 사용할 경우 빈 문자열(같은 서버 연결)로 둬도 됩니다.

설정 파일을 수정한 뒤 프론트엔드를 다시 배포하세요.
기존 사이트의 /block-game.html → 온라인 대전, 또는 /block-online.html로 접속하면 됩니다.
직접 접속하는 서버 주소와 기존 사이트 주소가 다르면 재접속용 세션도 따로 저장됩니다.

## 5. Git 명령어

ZIP을 적용한 후 아래 명령어를 순서대로 실행하세요.

~~~powershell
cd C:\project\pdf_page_editor_render_split
git status
git add frontend/block-game.html frontend/block-game-core.js frontend/block-online.html frontend/block-online.css frontend/block-online.js frontend/block-online-config.js frontend/block-online-engine.js game-server ONLINE_GAME_README.md
git diff --cached --stat
git commit -m "몽글 블록 3분 온라인 점수 대전 추가"
git push
~~~

대전 서버를 배포한 뒤 실제 서버 주소를 설정했다면:

~~~powershell
cd C:\project\pdf_page_editor_render_split
git add frontend/block-online-config.js
git commit -m "온라인 대전 서버 주소 연결"
git push
~~~

이 패키지 제작 과정에서는 원격 저장소 push나 Render 배포를 실행하지 않았습니다.

## 6. 경기 규칙

- 2~4명이 같은 방에서 모두 준비하면 방장이 시작합니다.
- 서버 기준 3초 카운트다운 후 공통 180초 타이머가 시작됩니다.
- 모두 같은 7-bag 블록 순서를 받습니다. 보관 사용이나 진행 속도 때문에 현재 보이는 블록은 달라질 수 있습니다.
- 기존 혼자하기의 줄 제거·콤보·드롭 점수와 레벨 상승 규칙을 그대로 사용합니다.
- 공격, 방해 줄, 다른 사람의 보드 변경은 없습니다.
- 점수 내림차순 순위입니다. 동점은 공동 순위(예: 1, 1, 3위)입니다.
- 먼저 블록이 끝까지 쌓이면 점수를 확정하고 상대를 관전합니다.
- 모두 먼저 종료되면 3분이 남아 있어도 결과를 표시합니다.
- 결과 화면에서 방장이 대기실로 돌아가면 다시 준비해 재대결할 수 있습니다.
- 게임 중 신규 입장은 막고, 기존 참가자의 재접속만 허용합니다.
- 방장이 끊기면 연결된 다른 참가자에게 방장을 넘깁니다.

## 7. 조작·연결

- ← →: 이동 / ↑ 또는 X: 회전 / Z: 반대 회전
- ↓: 내리기 / Space: 바로 놓기 / C 또는 Shift: 보관
- 터치 환경에서는 내 보드 아래 조작 버튼을 사용합니다.
- 온라인은 일시정지되지 않습니다. 탭 이탈·연결 끊김에도 서버의 시간과 낙하는 계속됩니다.
- 일시적인 끊김은 자동 재연결을 시도합니다. 서버가 끊김을 인식한 뒤 20초 동안 복귀할 수 있습니다.
- 새로고침 시 같은 탭의 세션 정보를 이용해 복귀합니다. 세션 저장이 차단되면 새로고침 복귀는 제한됩니다.
- 20초를 넘기면 해당 참가자의 플레이는 종료되고 당시 점수를 유지합니다.
- 직접 나가기도 현재 점수로 종료됩니다. 경기 결과의 점수는 퇴장 후에도 남습니다.
- 서버 재시작/재배포 시 방과 경기는 사라집니다. 영구 랭킹이나 회원 기능은 없습니다.

## 8. 구현과 운영 범위

- 서버가 블록 엔진을 실행해 점수·충돌·종료를 판정합니다. 클라이언트가 보낸 점수/보드는 사용하지 않습니다.
- 클라이언트는 입력을 즉시 미리 반영하고 서버의 입력 확인 번호로 상태를 맞춥니다.
- 상대 보드는 기본 초당 10회 갱신합니다. 내 입력 후에는 서버가 즉시 확인 상태를 보냅니다.
- 서버 시계는 단조 증가 시간 기준입니다. 클라이언트 시계를 조작해도 경기 시간을 늘릴 수 없습니다.
- 방은 메모리에 저장합니다. 단일 인스턴스로 운영하세요. 여러 인스턴스로 확장하려면 공유 방 저장소/라우팅이 필요합니다.
- 최대 100개 방, 연결 400개, 요청 크기·빈도 제한과 연결 상태 확인을 넣었습니다. 이 숫자는 부하 테스트로 보장한 수용량이 아닙니다.
- 방 코드를 아는 사람이 입장하며 계정 인증은 없습니다. 완전한 부정행위 방지나 경쟁 서비스 운영 수준을 보장하지 않습니다.
- 서버가 심하게 지연되면 낙하 따라잡기는 한 번에 최대 1초로 제한하지만 경기 종료 시간은 연장하지 않습니다.

## 9. 검증 결과

- npm test: 7개 검사 통과.
- 서버: 정원, 준비/방장 권한, 동시 카운트다운, 동일 블록, 180초 마감, 입력 중복·종료 후 입력 무시, 동점, 관전, 재접속, 방장 이전, 재대결.
- 실제 WebSocket 연결 4개로 입장 → 준비 → 시작 → 보드/점수 전달 → 재접속 → 결과 → 재대결 확인.
- DOM 환경 4개와 실제 서버를 연결해 화면 이벤트, 상대 Canvas 3개, 키보드 드롭/보관, 순위 갱신, 자동 재접속, 결과/대기실 전환을 확인했습니다.
- 실제 Canvas 라이브러리로 내 보드 렌더링을 확인했습니다.
- 기존 혼자하기 엔진의 이동/회전/보관/점수/3분 타이머/충돌 검사를 통과했습니다.
- 실제 Chrome 전체 CSS 배치, 모바일 실기기, 여러 PC의 인터넷 지연 환경, Render 배포 후 동작은 아직 검증하지 못했습니다. 브라우저 설치 파일 다운로드가 실패해 DOM/Canvas 검사로 대체했습니다.

배포 후 실제 PC 2대에서 한 경기를 끝까지 진행해 조작 지연과 화면 배치를 확인하세요.

공식 참고: [Render WebSocket 설정](https://render.com/docs/websocket), [Render 무료 서비스 제한](https://render.com/docs/free), [ws 공식 문서](https://github.com/websockets/ws).
