# 몽글 젤리 · Render 웹 업데이트 v1.0.2

온라인 조작을 즉시 화면에 예측 반영하고 서버 결과로 보정하도록 개선했습니다. 자동 낙하는 칸 사이 위치를 보간해 60Hz 화면에서 부드럽게 움직입니다. 상대 화면도 수신 사이를 보간합니다.

온라인 입장 화면을 몽글블록과 같은 전용 로비 구조로 변경했습니다. 방 생성 또는 입장 전에는 게임판을 숨기고, 새 방 만들기/친구 방 입장 카드만 표시합니다.

기존 PDF 사이트용 4색 연결 낙하 퍼즐입니다. 자체 Canvas 캐릭터와 그래픽으로 만들었습니다. 싱글과 2~4명 온라인 개인전을 함께 제공합니다.

## 적용 방법

이 ZIP의 내용을 `C:\project\pdf_page_editor_render_split`에 풀어주세요. `frontend`, `game-server`, `install-puyo.cjs`가 기존 폴더와 같은 위치에 있어야 합니다. 기존 server.cjs 전체를 교체하지 않고 설치 스크립트가 필요한 연결만 추가합니다. 적용 기준은 공개 main의 042eb93(온라인 테트리스 팀전)입니다. 서버 구조가 달라지면 스크립트가 중단하므로 오류 메시지를 확인하세요.

PowerShell에서 한 번에 실행:

```powershell
cd C:\project\pdf_page_editor_render_split
node .\install-puyo.cjs
if ($LASTEXITCODE -ne 0) { throw "젤리 게임 연결에 실패했습니다. 오류를 확인해주세요." }
npm ci --prefix game-server
if ($LASTEXITCODE -ne 0) { throw "의존성 설치 실패" }
npm test --prefix game-server
if ($LASTEXITCODE -ne 0) { throw "테스트 실패: 커밋하지 않았습니다." }
git add frontend/puyo-core.js frontend/puyo-game.html frontend/puyo-game.css frontend/puyo-game.js frontend/arcade.html frontend/index.html frontend/block-game.html frontend/block-online.html frontend/dodge-game.html frontend/text-art.html game-server/puyo-service.cjs game-server/server.cjs game-server/test/puyo.test.cjs game-server/test/puyo-socket.test.cjs install-puyo.cjs PUYO_GAME_README.md
git commit -m "몽글 젤리 싱글 및 온라인 대전 추가"
if ($LASTEXITCODE -ne 0) { throw "커밋 결과를 확인해주세요." }
git push origin main
```

다른 작업의 수정 사항이 위 파일에 있다면 커밋 전에 `git diff --cached`로 함께 확인하세요. 설치 스크립트는 반복 실행해도 연결을 중복 삽입하지 않습니다. 새 게임 파일과 arcade.html은 이 업데이트 버전을 사용합니다.

## Render 배포

**정적 사이트와 게임 서버를 둘 다 같은 커밋으로 배포**해야 합니다.

- 정적 사이트: `pdf-page-editor` (기존 build/publish 설정 유지)
- 게임 서버: `mongle-game-server` (기존 `npm ci --prefix game-server`, `npm start --prefix game-server` 유지)
- 새 서비스 생성, DB, 추가 유료 서비스 또는 새 환경변수는 필요하지 않습니다.
- Auto Deploy가 꺼져 있으면 각 서비스의 Manual Deploy → Deploy latest commit을 실행하세요.
- 프론트 주소: https://pdf-page-editor.onrender.com/puyo-game.html
- 게임 로비: https://pdf-page-editor.onrender.com/arcade.html
- 서버 확인: https://mongle-game-server.onrender.com/health 에 `"puyoProtocol":1`이 있어야 합니다.
- 둘 다 Live가 된 후 Ctrl+F5로 새로고침하세요. 기본 PDF 화면과 블록·닷지·그림판에 로비 링크가 추가됩니다.

현재 배포까지 자동 실행된 것은 아닙니다. 소스 적용과 Git push 후 Render 배포가 필요합니다. 기존 `block-online-config.js`의 `BLOCK_ONLINE_SERVER`를 그대로 읽습니다. 별도 주소가 필요하면 로딩 전에 `window.PUYO_ONLINE_SERVER`를 설정할 수 있습니다.

서버는 기존 `/ws` 테트리스와 새 `/puyo-ws` 젤리 대전을 함께 운영합니다. 기본 사이트 origin은 허용하며 다른 도메인은 기존 `ALLOWED_ORIGINS`에 추가하면 됩니다. 방/경기는 메모리에 보관하므로 게임 서버를 재배포하거나 재시작하면 종료됩니다. **단일 인스턴스**에서 운영하세요. 서버 여러 개로 늘리는 분산 운영은 포함하지 않습니다.

## 플레이

- 6열 × 화면에 보이는 12행, 위쪽 숨김 1행. 같은 색을 상하좌우 4개 이상 연결하면 제거됩니다. 대각선은 연결되지 않습니다.
- 두 젤리는 착지 후 각각 아래로 떨어집니다. 제거 후 중력으로 새 연결이 생기면 연쇄가 이어집니다.
- ← → 이동 / ↑ 또는 X 시계 방향 / Z 반시계 방향 / ↓ 빠르게 / Space 즉시 착지
- 싱글: 시간 제한 없이 점수 도전. 시간이 지나면 낙하가 빨라집니다. P/Esc로 일시정지, Enter로 시작/계속/다시하기. 탭 이동 시 자동 일시정지합니다.
- 최고 점수·최대 연쇄는 브라우저 localStorage에 저장합니다. 현재 진행 판은 새로고침 시 사라집니다. 싱글은 페이지 로딩 이후 게임 서버 연결 없이 실행됩니다. 설치형 오프라인 캐시/PWA를 추가한 것은 아닙니다.
- 온라인: 방 생성 → 코드/링크 공유 → 2~4명 입장 → 모두 준비 → 방장 시작 → 3초 카운트다운
- 같은 시드로 같은 색 순서를 받으며 마지막 생존자가 승리합니다. 동시에 모두 탈락하면 무승부입니다. 시간 제한은 없습니다.
- 탈락하면 상대 미니 게임판을 관전할 수 있습니다. 경기 종료 후 방장이 새 대결 준비를 누르면 모두 다시 준비하고 시작합니다.
- 온라인은 탭 이동/연결 끊김에도 계속 진행됩니다. 진행 중 연결이 끊기면 15초 내 자동 재접속하며 경과 시 탈락합니다. 대기실에서 연결이 끊긴 사람은 제거되므로 다시 입장하세요. 방장이 나가면 연결된 참가자에게 방장 권한이 넘어갑니다.
- 진행 중 새 참가자 입장은 막고, 원래 참가자의 비밀 토큰으로 재접속만 허용합니다. 토큰은 본인에게만 전송되며 sessionStorage에 저장됩니다.

## 점수와 공격 규칙

기본 점수는 제거한 색 젤리 수 × 10 × 배율입니다. 배율은 연쇄 보너스 + 동시에 지운 색 수 보너스 + 큰 그룹 보너스이며 최소 1입니다. 연쇄 보너스는 1연쇄 0 / 2연쇄 8 / 3연쇄 16 / 4연쇄 32 / 이후 점증, 최대 512입니다. 소프트 드롭 칸당 1점, 하드 드롭 칸당 2점입니다.

온라인 공격은 **제거 점수 70점당 방해 1개**, 나머지 점수는 다음 공격에 누적합니다. 내려놓기 점수는 공격에 포함되지 않습니다. 필드를 완전히 비우면 +2,100점과 방해 30개입니다. 발생한 공격은 자신의 대기 방해부터 상쇄하고 남은 수를 살아 있는 상대에게 순서대로 보냅니다. 한 공격을 모든 상대에게 복제하지 않습니다.

회색 방해는 같은 색 그룹으로 지워지지 않습니다. 색 젤리가 터질 때 상하좌우에 붙은 방해가 함께 사라집니다. 상대 공격은 즉시 대기 수로 표시하며 자기 연쇄가 끝난 후 최대 30개씩 고르게 내려옵니다. 넘치면 탈락합니다. 대기 방해는 최대 180개입니다.

## 구현 및 검증

- `frontend/puyo-core.js`: 브라우저와 서버가 공유하는 결정적 엔진
- `frontend/puyo-game.*`: 싱글/대전 UI, Canvas, 키/터치, 재접속, 최고 기록
- `frontend/arcade.html`: 게임 로비
- `game-server/puyo-service.cjs`: 서버 권위 판정, 방, 카운트다운, 공격, 승패, 재접속
- `install-puyo.cjs`: 기존 서버/사이트 연결
- `game-server/test/puyo*.test.cjs`: 규칙 및 실제 WebSocket 통합 테스트

서버는 클라이언트의 점수나 보드를 신뢰하지 않고 입력만 받아 직접 계산합니다. 라운드·입력 순번 검증, 프레임 크기/메시지 수 제한, origin 확인을 적용했습니다.

기존 테트리스 회귀 테스트 포함 25개 자동 테스트 통과. 실제 4개 WebSocket 접속, 연쇄·공격 상쇄·승패·재접속·재대결을 검증했습니다. Chromium에서는 싱글 조작/일시정지, 2인 방 생성/입장/카운트다운/상대 게임판/재접속/승리/재대결과 화면 오류 여부를 확인했습니다. 실제 Render 배포 후 서로 다른 PC에서 한 번씩 접속해 최종 확인하세요.
