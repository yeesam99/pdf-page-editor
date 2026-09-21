# 몽글 블록 온라인 팀전 업데이트

기존 온라인 블록 게임에 `빨강 vs 파랑` 팀 공격 대전을 추가하는 업데이트입니다.

## 팀전 규칙

- 2~4명이 참가할 수 있습니다.
- 빨강팀과 파랑팀에 최소 1명씩 있으면 시작할 수 있습니다.
- 팀 인원은 같지 않아도 됩니다. `1 대 3`, `1 대 2`, `2 대 1` 경기도 가능합니다.
- 입장할 때 인원이 적은 팀으로 자동 배정되며, 대기실에서 각자 팀을 바꿀 수 있습니다.
- 팀을 바꾸면 준비 상태가 해제됩니다.
- 줄 공격은 살아 있는 상대 팀원에게만 순환 전송됩니다.
- 같은 팀원에게는 방해 줄을 보내지 않습니다.
- 한 팀의 모든 선수가 탈락하면 상대 팀이 승리합니다.
- 승리 팀은 먼저 탈락한 팀원도 함께 승리 처리됩니다.
- 양 팀의 마지막 선수가 같은 서버 판정 시점에 탈락하면 무승부입니다.

## 적용 방법

ZIP을 프로젝트 최상위 폴더에 덮어쓴 뒤 아래 명령을 실행합니다.

```powershell
cd C:\project\pdf_page_editor_render_split
npm test --prefix game-server
git add frontend/block-online.html frontend/block-online.css frontend/block-online.js game-server/rooms.cjs game-server/server.cjs game-server/test/battle.test.cjs TEAM_BATTLE_UPDATE_README.md
git commit -m "온라인 테트리스 빨강 파랑 팀전 추가"
git push
```

프론트와 `mongle-game-server` 배포가 모두 완료된 뒤 브라우저에서 `Ctrl + Shift + R`을 누릅니다.

서버 적용 여부는 다음 주소의 `modes` 값에 `team`이 있는지 확인하면 됩니다.

```text
https://mongle-game-server.onrender.com/health
```
