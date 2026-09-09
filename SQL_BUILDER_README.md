# SQL 생성기 추가 파일

기존 PDF 편집기와 별개로 `/sql-builder.html`에서 사용하는 브라우저 기반 SQL 생성기입니다.
기존 화면에 이동 메뉴를 추가하지 않으며, 백엔드 요청이나 DB 접속 없이 동작합니다.

## 적용

이 ZIP의 `frontend` 안에 있는 아래 네 파일을 기존 프로젝트의 `frontend`에 추가하세요.
프로젝트 폴더를 삭제하거나 PDF 편집기 파일을 교체할 필요는 없습니다.

- sql-builder.html
- sql-builder.css
- sql-builder.js
- sql-builder-core.js

프로젝트 루트에서 다음 명령을 실행합니다.

```powershell
git add frontend/sql-builder.html frontend/sql-builder.css frontend/sql-builder.js frontend/sql-builder-core.js SQL_BUILDER_README.md
git commit -m "Add visual SQL builder page"
git push origin main
```

Static Site의 배포가 끝나면 다음 주소로 접속합니다.

https://pdf-page-editor.onrender.com/sql-builder.html

별도 npm 설치, Python 패키지 설치, render.yaml 변경은 필요하지 않습니다.
로컬에서는 기존 실행 방법으로 프론트엔드를 실행한 뒤 `/sql-builder.html`을 열거나,
해당 HTML 파일을 브라우저에서 직접 열 수 있습니다. 복사 권한은 브라우저 설정에 따라 다를 수 있습니다.

## 사용 순서

1. DBMS를 선택합니다. 기본은 Tibero입니다.
2. SELECT, UPDATE, INSERT, DELETE 중 작업 종류를 선택합니다.
3. 메인 테이블명과 별칭을 입력합니다.
4. 엑셀의 `컬럼명 / 컬럼 설명` 두 열을 복사해 붙여넣고 `붙여넣은 컬럼 추가`를 누릅니다.
   첫 행이 `컬럼명` 또는 `COLUMN_NAME`이면 헤더로 처리합니다. 탭으로 구분된 Excel 복사 형식을 사용하세요.
5. 기본적으로 모든 컬럼이 선택됩니다. 전체·검색 결과 선택/해제와 컬럼 순서 변경을 지원합니다.
6. SELECT에서는 `동일 표 (JOIN)`로 표를 추가하고 ON 조건의 양쪽 컬럼을 검색 팝업으로 연결합니다.
7. WHERE에 조건과 AND/OR 괄호 그룹을 추가합니다.
8. 오류 안내가 없어지면 오른쪽의 `쿼리 복사`를 누릅니다. 미리보기는 읽기 전용입니다.

`예제`를 누르면 사원·부서 JOIN 조회를 볼 수 있습니다. 현재 구성을 바꾸므로 필요한 내용은 먼저 저장하세요.
`설정 저장`은 테이블·조건 구성을 JSON으로 내려받습니다. `불러오기`로 다시 편집할 수 있습니다.
브라우저를 새로고침하면 저장하지 않은 구성은 초기화됩니다.

## 조건과 하위 조회

- 비교: `=`, `!=`, `>`, `>=`, `<`, `<=` — 직접 입력, 컬럼, 바인드 변수
- LIKE / NOT LIKE — 포함, 시작, 끝, 직접 패턴
- IN / NOT IN — 쉼표·줄바꿈 값 목록 또는 출력 컬럼 하나인 하위 조회
- BETWEEN / NOT BETWEEN — 시작값과 끝값
- IS NULL / IS NOT NULL — 값 입력 없음
- EXISTS / NOT EXISTS — 하위 조회 자동 생성, `SELECT 1` 출력
- AND / OR 및 중첩 괄호 그룹
- ORDER BY — 검색 팝업의 복수 컬럼 선택과 정렬 순서 조정

EXISTS와 IN의 하위 조회에서는 자기 조회와 상위 조회의 컬럼을 선택할 수 있습니다.
JOIN의 하위 조회표는 독립된 조회입니다. 내부에서는 상위 테이블을 참조하지 않으며,
바깥 ON 조건에서는 하위 조회가 출력한 컬럼만 선택할 수 있습니다.
ON 조건에는 해당 JOIN까지 등장한 테이블의 컬럼만 표시합니다.
표·컬럼 삭제로 참조가 사라지면 해당 조건을 다시 연결해야 복사할 수 있습니다.

UPDATE·INSERT·DELETE는 일반 테이블 하나를 대상으로 지원합니다.
UPDATE와 INSERT에서는 체크한 컬럼의 값 종류(문자·숫자·바인드·NULL)와 값을 설정합니다.
INSERT는 화면에 입력한 한 행을 생성하며, WHERE는 적용하지 않습니다.
UPDATE와 DELETE에서 WHERE를 비우면 전체 행 대상이라는 안내가 나옵니다.
이 도구는 SQL을 실행하지 않습니다.

## DBMS별 처리와 범위

| DBMS | 바인드 표기 | 식별자 따옴표 옵션 |
| --- | --- | --- |
| Oracle | `:name` | `"NAME"` |
| Tibero | `:name` | `"NAME"` |
| MSSQL | `@name` | `[NAME]` |
| MySQL | `?` | `` `NAME` `` |

바인드 변수는 실행하는 DB 도구·드라이버에서 별도로 연결해야 합니다.
MySQL에서는 미리보기 아래에 물음표 순서와 변수명을 표시합니다.
MSSQL 문자 상수는 `N'문자'`를 사용하고, UPDATE와 DELETE는 별칭을 지원하는 FROM 형태로 생성합니다.
MySQL FULL JOIN 및 변경 대상 테이블을 다시 읽는 UPDATE/DELETE 하위 조회는 지원하지 않는 설정으로 표시합니다.
MySQL에서 역슬래시가 포함된 문자열은 SQL 모드에 영향을 받으므로 바인드 변수로 입력하도록 안내합니다.

식별자 따옴표 옵션은 실제 DB에서 사용한 대소문자와 일치하는 이름으로 입력해야 합니다.
예약어 컬럼은 이 옵션을 켜서 사용하세요. 테이블명은 `스키마.테이블`처럼 점으로 구분할 수 있습니다.
문자 값은 작은따옴표 없이 입력하며, 문자열 내부 작은따옴표는 자동 처리합니다.
IN 값 목록은 쉼표 또는 줄바꿈을 구분자로 사용하므로 값 자체에 쉼표가 필요하면 바인드 변수를 사용하세요.

현재 범위에는 집계 함수, GROUP BY/HAVING, UNION, MERGE, 다중 테이블 변경, 임의 SQL 입력과 SQL 역변환이 포함되지 않습니다.
실제 DB에 접속하지 않으므로 테이블 존재 여부, 실제 컬럼 자료형, 권한, DB 버전별 동작은 검증하지 않습니다.

## 검증

생성 모델 검사 50개와 SELECT·JOIN·괄호·EXISTS·NOT EXISTS·IN·NOT IN·하위 조회·BETWEEN의
공통 SQL 9개를 SQLite 테스트 데이터로 검증했습니다. 네 DBMS 서버에 직접 연결한 통합 검증이나 브라우저 조작 테스트는 수행하지 않았습니다.
HTML의 로컬 자산 경로와 JavaScript 문법을 검사했습니다.

문법 확인에 사용한 공식 문서:

- [Oracle SELECT](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/SELECT.html)
- [Oracle 바인드 변수](https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/bind-variables.html)
- [MSSQL UPDATE](https://learn.microsoft.com/en-us/sql/t-sql/queries/update-transact-sql?view=sql-server-ver17)
- [MSSQL 상수](https://learn.microsoft.com/en-us/sql/t-sql/data-types/constants-transact-sql?view=sql-server-ver17)
- [MySQL DELETE](https://dev.mysql.com/doc/refman/8.0/en/delete.html)
- [MySQL 매개변수 표기](https://dev.mysql.com/doc/c-api/8.0/en/mysql-stmt-prepare.html)
