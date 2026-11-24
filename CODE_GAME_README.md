# 몽글 코드 v1.1.0
2–6인 온라인 숫자 추리 게임. 흑백 0–11 숫자 타일 24개 + 흑백 조커 각 1개, 총 26타일의 확장 규칙.
2–3인은 4장, 4–6인은 3장으로 시작합니다. 모두 초기 배치 완료 후 시작합니다. 턴 시작 자동 드로우 후 삽입 위치를 선택하며,
정답 후 추가 추리/멈추기, 실패 시 드로우 타일 공개. 덱 소진 시 가장 왼쪽 숨긴 타일 공개.
60초 턴 제한, 연결 종료 60초 유예, 마지막 생존자 승리, 방장 재대결.
상대 비공개 숫자와 재접속 토큰은 다른 참가자에게 전송하지 않습니다.
DB 없이 서버 메모리 사용: 서버 재시작 시 방은 사라집니다.

## 설치
GitHub main e879662 기준 변경 파일 패키지입니다. 프로젝트 루트에 압축을 풀어 덮어쓰세요.
server.cjs와 arcade.html에 별도 미반영 수정이 있다면 먼저 백업/병합하세요.
기존 block-online-config.js의 게임 서버 주소를 공유합니다.
Render 게임 서버 ALLOWED_ORIGINS에 PDF 프론트 주소가 있어야 합니다(기존 온라인 설정).

```powershell
cd C:\project\pdf_page_editor_render_split
npm ci --prefix game-server
node --test game-server/test/code.test.cjs game-server/test/code-joker.test.cjs
git add game-server/server.cjs game-server/code-service.cjs game-server/code-core.cjs game-server/test/code.test.cjs game-server/test/code-joker.test.cjs frontend/code-game.html frontend/code-game.js frontend/arcade.html CODE_GAME_README.md
git commit -m "몽글 코드 흑백 조커 및 위치 선택 추가"
git push origin main
```
Render mongle-game-server와 PDF 프론트엔드 배포 후 /code-game.html 접속.
PDF Python API 변경은 없습니다. 로비 arcade.html에도 카드가 추가됩니다.

## 검증 및 제한
실제 WebSocket으로 6명 입장/정원 초과/개인별 숫자 비공개/턴 검증 테스트 통과.
서버/규칙 테스트 총 12개 통과. 브라우저 실행은 환경 제한으로 차단되어 실제 화면 클릭 검증은 미완료. 실제 Render 배포는 미수행.
공식 제품의 이미지나 UI를 사용하지 않은 독립 디자인이며 6인 확장 규칙입니다.

## v1.1.0 변경 사항
- 조커를 처음 받으면 내 줄에서 화살표로 위치를 조정하고 배치 완료를 누릅니다.
- 초기 배치 중 상대에게는 타일 개수/완료 여부만 보입니다. 이동 경로로 조커를 추측할 수 없게 구성했습니다.
- 조커를 게임 도중 뽑으면 내 줄의 어느 틈에나 넣을 수 있습니다.
- 숫자 타일도 넣을 위치를 고릅니다. 숫자 오름차순/동일 숫자 검정 우선은 지켜야 하며, 기존 조커의 상대적 순서는 유지됩니다.
- 배치 완료한 조커는 이동할 수 없습니다. 상대 타일 선택 후 ‘조커’로 추리합니다.
- 조커를 뽑은 턴에 틀리면 그 조커가 공개됩니다. 덱 소진 시 기존대로 가장 왼쪽 숨긴 타일 공개입니다.
- 초기 배치는 60초 후 현재 배치로 자동 확정됩니다. 턴 배치 중 시간 초과는 가능한 첫 틈에 배치한 뒤 해당 타일 공개/차례 종료입니다.
- 조커/숫자 여부를 다른 참가자에게 알려주지 않도록 모든 드로우에 같은 배치 절차를 사용합니다.
- 재접속 시 진행 중인 배치 상태도 유지됩니다. 배포 후 기존 방은 종료되므로 새 방을 만들고 Ctrl+F5 해주세요.
- 이번 ZIP은 v1.0 설치 없이도 적용할 수 있는 누적 추가 패키지입니다. 게임 서버와 프론트엔드를 함께 업데이트하세요.
