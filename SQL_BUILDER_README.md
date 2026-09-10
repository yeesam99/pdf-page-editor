# SQL 생성기 추가 파일

기존 PDF 편집기와 별개로 `/sql-builder.html`에서 사용하는 브라우저 기반 SQL 생성기입니다.
기존 화면에 이동 메뉴를 추가하지 않으며, 백엔드 요청이나 DB 접속 없이 동작합니다.

## 적용

이 ZIP의 `frontend` 안에 있는 아래 다섯 파일을 기존 프로젝트의 `frontend`에 추가하세요.
프로젝트 폴더를 삭제하거나 PDF 편집기 파일을 교체할 필요는 없습니다.

- sql-builder.html
- sql-builder.css
- sql-builder.js
- sql-builder-core.js
- sql-builder-preview.js

프로젝트 루트에서 다음 명령을 실행합니다.

```powershell
git add frontend/sql-builder.html frontend/sql-builder.css frontend/sql-builder.js frontend/sql-builder-core.js frontend/sql-builder-preview.js SQL_BUILDER_README.md
git commit -m "Add create table and column comment builder"
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

## CREATE TABLE과 컬럼 한글명 변경 (v6)

상단의 **테이블 생성 CREATE TABLE** 또는 **한글명 변경 COMMENT**를 선택합니다. 기존 SELECT·UPDATE·INSERT·DELETE 구성과 DDL 구성은 설정 JSON 안에 각각 유지되므로 작업 종류를 오가며 사용할 수 있습니다.

### 테이블 생성

1. 테이블명을 먼저 입력합니다. `TB_EMP` 또는 `SCHEMA.TB_EMP` 형식을 사용할 수 있습니다.
2. Excel에서 `컬럼영문 / 컬럼한글` 두 열을 복사해 붙여넣습니다.
3. 필요하면 세 번째와 네 번째 열에 `자료형 / 길이·정밀도`를 함께 붙여넣습니다.
4. 자료형을 생략하면 Oracle·Tibero는 `VARCHAR2(200)`, MSSQL은 `NVARCHAR(200)`, MySQL은 `VARCHAR(200)`을 기본으로 추가합니다.
5. 각 행에서 NULL 허용, 기본값, PK, INDEX, UNIQUE를 설정합니다. 기본값은 `0`, `'Y'`, `CURRENT_TIMESTAMP`처럼 실제 SQL 표현식으로 입력합니다.
6. 여러 컬럼에 PK, INDEX 또는 UNIQUE를 체크하면 화면의 컬럼 순서대로 각각 하나의 복합 키 또는 복합 인덱스를 생성합니다. PK 컬럼은 자동으로 `NOT NULL` 처리됩니다.

붙여넣기 예시:

```text
컬럼영문	컬럼한글	자료형	길이
EMP_ID	사원번호	NUMBER	10
EMP_NM	사원명	VARCHAR2	100
REGT_DTM	등록일시	TIMESTAMP	
```

- Oracle·Tibero는 테이블 생성 뒤 `COMMENT ON TABLE/COLUMN`을 생성합니다.
- MSSQL은 `MS_Description` 확장 속성 구문을 생성하며, 스키마를 생략하면 `dbo`를 사용합니다. 설명 구문을 사용하려면 테이블명은 `TABLE` 또는 `SCHEMA.TABLE`로 입력하세요.
- MySQL은 `CREATE TABLE`의 테이블·컬럼 `COMMENT`와 내부 `INDEX` 구문을 생성합니다.
- 인덱스 이름은 `IX_테이블명_01`, UNIQUE 인덱스는 `UX_테이블명_01`, PK 제약조건은 `PK_테이블명`으로 자동 생성합니다. 실제 프로젝트의 명명 규칙이나 DBMS 식별자 길이 제한에 맞게 복사 후 조정할 수 있습니다.

### 컬럼 한글명 변경

Excel에서 `컬럼영문 / 기존 컬럼한글 / 바뀔 한글명` 세 열을 붙여넣습니다. 바뀔 한글명이 있는 행만 변경 SQL에 포함됩니다. 기존 한글명은 비교·확인용이며 SQL 조건으로 사용하지 않습니다.

```text
컬럼영문	컬럼한글	바뀔한글명
EMP_ID	사원번호	직원번호
EMP_NM	사원명	직원명
```

- Oracle·Tibero는 새 설명으로 `COMMENT ON COLUMN`을 생성합니다.
- MSSQL은 `MS_Description` 존재 여부에 따라 `sp_updateextendedproperty` 또는 `sp_addextendedproperty`를 실행하는 구문을 생성합니다.
- MySQL은 컬럼 설명만 단독으로 변경할 수 없으므로 네 번째와 다섯 번째 Excel 열에 `현재 자료형 / 길이·정밀도`를 추가하고, 화면에서 NULL 허용과 기본값도 현재 정의와 정확히 같게 입력해야 합니다. 생성된 `MODIFY COLUMN`을 실행하면 입력한 정의가 함께 적용되므로 실제 테이블 정의를 먼저 확인하세요.
- DDL은 브라우저에서 문자열로만 생성되며 서버나 DB로 전송·실행되지 않습니다.

`JOIN 예제`를 누르면 사원·부서 JOIN 조회를 볼 수 있습니다. `집계 예제`는 부서별 급여 합계·평균·인원수와 HAVING을 보여줍니다. `분석 함수 예제`는 PARTITION BY 합계와 순위를 보여줍니다. 세 예제에는 예상 결과를 바로 확인할 수 있는 예시 데이터도 들어갑니다. 현재 구성을 바꾸므로 필요한 내용은 먼저 저장하세요.

## 예시 데이터와 예상 결과 (v5)

1. 쿼리 구조에서 일반 테이블을 선택하고 테이블 설정의 **예시 데이터** 버튼을 누릅니다.
2. 팝업의 컬럼 헤더는 현재 테이블 컬럼에서 자동으로 생성됩니다. 같은 원본 컬럼을 출력용으로 복제해도 입력 열은 하나만 표시됩니다.
3. 셀을 직접 입력하거나 Excel 범위를 복사해 첫 셀에 붙여넣습니다. **엑셀 붙여넣기** 영역에 전체 범위를 붙여넣어 기존 값을 교체할 수도 있습니다.
4. 빈 셀 또는 `NULL`은 NULL, 숫자 모양의 값은 숫자, 그 외는 문자로 계산됩니다.
5. 오른쪽 **예상 결과**는 입력 및 쿼리 설정 변경 후 자동 갱신됩니다. 필요하면 자동 계산을 끌 수 있습니다.

- 예시 데이터는 브라우저 메모리와 설정 JSON에서만 사용하며 서버로 전송하지 않습니다.
- 표당 최대 1,000행, 결과는 최대 100행까지 화면에 표시합니다.
- 중간 JOIN 조합이 200,000건을 넘으면 계산을 중단하고 JOIN 조건을 확인하도록 안내합니다.
- SELECT의 WHERE, JOIN, GROUP BY, SUM/COUNT/COUNT DISTINCT/AVG/MIN/MAX, HAVING, ORDER BY, 하위 조회, PARTITION BY와 ROW_NUMBER/RANK/DENSE_RANK를 예상 계산합니다.
- 이것은 생성기 설정을 확인하는 브라우저 계산 결과입니다. DBMS의 암시적 형변환, 문자 정렬 규칙, 대소문자 비교, NULL 정렬, 날짜·시간 함수 등 실제 실행환경 차이는 확인할 수 없습니다.
- UPDATE·INSERT·DELETE는 데이터를 실제 변경하지 않으며 예상 결과 계산 대상이 아닙니다.
`설정 저장`은 테이블·조건 구성을 JSON으로 내려받습니다. `불러오기`로 다시 편집할 수 있습니다.
브라우저를 새로고침하면 저장하지 않은 구성은 초기화됩니다.

## 분석 함수 / PARTITION BY (v4)

1. 출력 컬럼 행의 **분석 함수 설정**을 누릅니다. 설정 패널은 컬럼 표 아래에 표시됩니다.
2. SUM, COUNT, AVG, MIN, MAX, COUNT_ALL(전체 행 개수), ROW_NUMBER, RANK, DENSE_RANK 중 선택합니다.
3. **그룹 컬럼 선택**에서 PARTITION BY 컬럼을 검색·다중 선택합니다. 전체 선택/해제도 가능합니다. 비워 두면 전체 결과를 대상으로 합니다.
4. **정렬 컬럼 선택**에서 분석 함수 내부 ORDER BY 컬럼을 선택합니다. 방향과 우선순위를 변경하거나 삭제할 수 있습니다.
5. 집계 분석 함수는 **그룹 전체** 또는 **첫 행부터 현재 행까지 누적**을 선택합니다. 순위와 누적 계산에는 정렬이 필수입니다.
6. 표에서 출력 별칭을 지정합니다. 원본 컬럼과 분석 결과를 함께 출력하려면 먼저 출력 행을 복제하세요.
7. **분석 해제**는 해당 행의 이전 일반/집계 출력 방식으로 돌아갑니다. **접기**는 설정을 유지합니다.

상단 **분석 함수 예제**는 직원 행을 유지하며 부서별 급여 합계와 부서 내 급여 순위를 보여줍니다.

```sql
SELECT A.EMP_ID
     , A.DEPT_CD
     , A.SALARY
     , SUM(A.SALARY) OVER (PARTITION BY A.DEPT_CD) AS DEPT_TOTAL_SALARY
     , RANK() OVER (PARTITION BY A.DEPT_CD ORDER BY A.SALARY DESC) AS DEPT_SALARY_RANK
  FROM TB_EMP A
 ORDER BY A.DEPT_CD ASC, A.SALARY DESC;
```

- 분석 출력 때문에 GROUP BY를 추가하지 않습니다.
- 집계 분석에 정렬을 추가해도 '그룹 전체' 선택은 전체 합계를 유지합니다. 명시적인 ROWS 범위를 생성해 정렬 추가만으로 누적 계산으로 바뀌지 않게 합니다.
- ROW_NUMBER와 행 단위 누적 계산의 동점 순서는 고유번호 같은 추가 정렬 기준이 있어야 일정합니다. RANK는 동순위 다음 순위를 건너뛰고 DENSE_RANK는 건너뛰지 않습니다.
- 분석 함수 내 ORDER BY와 최종 출력 순서는 별개입니다. 최종 순서는 조회의 ORDER BY에서 설정하세요.
- 같은 조회의 WHERE/ON은 원본 컬럼을 대상으로 합니다. 분석 결과를 필터링하려면 하위 조회표에서 분석 결과를 출력하고 상위 WHERE에서 별칭 컬럼을 선택하세요. HAVING에서 분석 결과를 직접 선택할 수 없습니다.
- 일반 GROUP BY 집계와 함께 쓸 경우 분석 대상·PARTITION·분석 ORDER BY는 그룹 컬럼이어야 합니다. 집계 결과에 대한 분석은 하위 조회에서 집계한 뒤 상위 조회에 분석 함수를 적용하세요.
- COUNT(DISTINCT ...) OVER, 사용자 지정 ROWS/RANGE 범위, LAG/LEAD는 이번 버전에 포함하지 않습니다. 기존 COUNT DISTINCT 행에서 분석 설정을 시작하면 COUNT로 시작하므로 함수를 확인하세요.
- MySQL은 분석 함수를 지원하는 8.0 이상을 대상으로 합니다. 실제 DB 버전·자료형·NULL 정렬 규칙은 사용 DB에서 확인하세요.
- 기존 JSON 설정은 그대로 불러올 수 있습니다. 분석 설정 역시 JSON에 저장됩니다.

## 집계 출력 (v3)

컬럼 표의 `출력 방식`에서 다음 항목을 선택합니다.

| 출력 방식 | 생성 예시 |
| --- | --- |
| 일반 컬럼 | `A.DEPT_CD` |
| SUM · 합계 | `SUM(A.SALARY)` |
| COUNT · 값 개수 | `COUNT(A.EMP_ID)` |
| COUNT · 중복 제외 | `COUNT(DISTINCT A.EMP_ID)` |
| AVG · 평균 | `AVG(A.SALARY)` |
| MIN · 최솟값 | `MIN(A.SALARY)` |
| MAX · 최댓값 | `MAX(A.SALARY)` |

- `전체 행 개수 COUNT(*)` 버튼으로 특정 컬럼 없이 행 개수를 출력합니다.
- `복제`로 같은 컬럼의 출력 행을 추가하고 함수와 출력 별칭을 바꿀 수 있습니다.
- 집계와 일반 컬럼을 함께 출력하면 일반 출력 컬럼이 자동으로 GROUP BY에 들어갑니다.
- 같은 일반 컬럼을 여러 번 출력해도 GROUP BY에는 한 번만 들어갑니다.
- 일반 출력 컬럼이 없으면 전체 조회 결과를 하나로 집계합니다.
- GROUP BY 설정 영역에서 현재 그룹 기준을 확인할 수 있습니다.
- HAVING에서 출력으로 선택한 집계값 또는 그룹 컬럼을 검색해 비교합니다.
- HAVING은 숫자·문자·바인드·다른 출력값 비교와 AND/OR 괄호 조건을 지원합니다.
- HAVING의 IN은 값 목록만 지원하며, HAVING 내부 하위 조회는 이번 범위에 포함되지 않습니다.
- WHERE와 ON의 컬럼 찾기는 원본 컬럼을 참조합니다. HAVING과 집계 정렬은 집계식을 참조합니다.
- 정렬에서 선택한 집계식을 오름차순·내림차순으로 사용할 수 있습니다.
- 집계 조회에서 그룹에 속하지 않는 일반 컬럼을 정렬하면 수정 안내가 나옵니다.
- 집계 별칭을 비우면 `SUM_SALARY`, `COUNT_EMP_ID` 같은 이름을 자동으로 생성합니다.
- 하위 조회의 집계 출력도 별칭으로 상위 조회에 전달됩니다. 상위 조회에서 다시 집계하거나 출력 행을 복제할 수 있습니다.
- 이전 버전에서 저장한 설정 파일에는 일반 출력과 빈 HAVING을 기본값으로 적용합니다.

예시:

```sql
SELECT A.DEPT_CD
     , SUM(A.SALARY) AS TOTAL_SALARY
     , AVG(A.SALARY) AS AVG_SALARY
     , COUNT(*) AS EMP_CNT
  FROM TB_EMP A
 GROUP BY A.DEPT_CD
HAVING COUNT(*) >= 10
 ORDER BY SUM(A.SALARY) DESC;
```

COUNT(*)는 NULL을 포함한 전체 행을 셉니다. COUNT(컬럼)과 COUNT(DISTINCT 컬럼)은 NULL을 제외합니다.
SUM·AVG는 실제 DB에서 숫자형인 컬럼을 선택해야 합니다. 결과 자료형과 정밀도는 DBMS 및 원본 컬럼 자료형을 따릅니다.
집계 설정은 SELECT 전용입니다. UPDATE·INSERT·DELETE로 바꾸려면 집계 출력과 HAVING을 해제하거나 새 쿼리를 만드세요.

## 조건과 하위 조회

### 하위 조회 삭제 개선 (v2)

- 왼쪽 트리의 각 하위 조회 제목 옆에 `삭제` 버튼이 있습니다.
- 하위 조회 편집 화면 상단에서 `이 하위 조회 삭제` 또는 `상위 설정`을 사용할 수 있습니다.
- EXISTS/IN 조건의 연결 영역에도 `조건·하위 조회 삭제` 버튼이 있습니다.
- JOIN 하위 조회는 해당 JOIN 표와 내부 조회 전체를 삭제합니다.
- EXISTS/NOT EXISTS/IN/NOT IN은 해당 조건과 내부 조회를 함께 삭제합니다.
- 삭제로 비게 된 조건의 괄호 그룹은 정리됩니다. 다른 조건과 정렬은 유지합니다.
- 삭제 후 상위 조회로 돌아갑니다. 삭제한 JOIN 컬럼을 다른 조건이 참조하면 다시 연결해야 복사할 수 있습니다.
- 메인 쿼리는 하위 조회 삭제로 제거되지 않습니다.

업데이트할 때 ZIP의 네 프론트엔드 파일을 함께 덮어쓰고 배포하세요.
배포 후 `Ctrl + F5`로 새로고침하면 새 삭제 버튼을 볼 수 있습니다.

- 비교: `=`, `!=`, `>`, `>=`, `<`, `<=` — 직접 입력, 컬럼, 바인드 변수
- LIKE / NOT LIKE — 포함, 시작, 끝, 직접 패턴
- IN / NOT IN — 쉼표·줄바꿈 값 목록 또는 출력 컬럼 하나인 하위 조회
- BETWEEN / NOT BETWEEN — 시작값과 끝값
- IS NULL / IS NOT NULL — 값 입력 없음
- EXISTS / NOT EXISTS — 하위 조회 자동 생성, 일반 조회에서는 `SELECT 1` 출력
- AND / OR 및 중첩 괄호 그룹
- ORDER BY — 검색 팝업의 복수 컬럼 선택과 정렬 순서 조정

EXISTS와 IN의 하위 조회에서는 자기 조회와 상위 조회의 컬럼을 선택할 수 있습니다.
JOIN의 하위 조회표는 독립된 조회입니다. 내부에서는 상위 테이블을 참조하지 않으며,
바깥 ON 조건에서는 하위 조회가 출력한 컬럼만 선택할 수 있습니다.
EXISTS 하위 조회에 집계를 설정한 경우에는 집계 출력과 GROUP BY/HAVING을 유지합니다.
집계 결과의 행 존재 여부를 정확하게 반영하기 위해, 이 경우에는 SELECT 1로 대체하지 않습니다.
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

현재 범위에는 CASE, 사용자 지정 그룹 컬럼, UNION, MERGE, 다중 테이블 변경, 임의 SQL 입력과 SQL 역변환이 포함되지 않습니다.
실제 DB에 접속하지 않으므로 테이블 존재 여부, 실제 컬럼 자료형, 권한, DB 버전별 동작은 검증하지 않습니다.

## 검증

생성 모델 검사 50개와 SELECT·JOIN·괄호·EXISTS·NOT EXISTS·IN·NOT IN·하위 조회·BETWEEN의
공통 SQL 9개를 SQLite 테스트 데이터로 검증했습니다. 네 DBMS 서버에 직접 연결한 통합 검증이나 브라우저 조작 테스트는 수행하지 않았습니다.
HTML의 로컬 자산 경로와 JavaScript 문법을 검사했습니다.

v2에서는 JOIN·중첩 하위 조회 삭제, EXISTS/IN 조건 삭제, 빈 괄호 정리,
ON 조건에서 상위 표로 복귀, 삭제된 컬럼 참조 감지, 메인 쿼리 보호 등 삭제 모델 검사 10개를 추가로 통과했습니다.

v3에서는 집계 모델·생성기 검사 54개와 집계 SQL 실행 사례 18개를 검증했습니다.
실행 사례에는 NULL, 중복값, COUNT(*), 빈 집계, HAVING, 집계 정렬, 하위 조회의 집계값 전달,
상위 조회에서 재집계, EXISTS 및 IN 집계가 포함됩니다. 실행 검증은 SQLite로 수행했으며 네 DBMS 서버에 직접 연결하지 않았습니다.

문법 확인에 사용한 공식 문서:

- [Oracle COUNT](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/COUNT.html)
- [MSSQL GROUP BY](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-group-by-transact-sql?view=sql-server-ver17)
- [MySQL 집계 함수](https://dev.mysql.com/doc/refman/8.4/en/aggregate-functions.html)

- [Oracle SELECT](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/SELECT.html)
- [Oracle 바인드 변수](https://docs.oracle.com/en/database/oracle/oracle-database/26/mlejs/bind-variables.html)
- [MSSQL UPDATE](https://learn.microsoft.com/en-us/sql/t-sql/queries/update-transact-sql?view=sql-server-ver17)
- [MSSQL 상수](https://learn.microsoft.com/en-us/sql/t-sql/data-types/constants-transact-sql?view=sql-server-ver17)
- [MySQL DELETE](https://dev.mysql.com/doc/refman/8.0/en/delete.html)
- [MySQL 매개변수 표기](https://dev.mysql.com/doc/c-api/8.0/en/mysql-stmt-prepare.html)

 v4에서는 분석 함수 모델·생성기 검사 37개와 SQLite 실행 사례 15개를 확인했습니다. 기존 집계 검사 54개도 통과했습니다. 실제 Oracle/Tibero/MSSQL/MySQL 연결 및 브라우저 조작 테스트는 수행하지 않았습니다.

v6에서는 CREATE TABLE, 복합 PK·INDEX·UNIQUE, 테이블·컬럼 한글명, 컬럼 한글명 변경, Excel 헤더 인식, 기존 v5 JSON 보정 사례를 생성 모델에서 검사했습니다. HTML 자산 경로와 JavaScript 문법도 확인했습니다. 실제 Oracle·Tibero·MSSQL·MySQL 서버에 연결한 DDL 실행 검증과 자동 브라우저 조작 검증은 수행하지 않았습니다.

분석 함수 문법 참고:
- https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/Analytic-Functions.html
- https://learn.microsoft.com/en-us/sql/t-sql/queries/select-over-clause-transact-sql?view=sql-server-ver17
- https://docs.oracle.com/cd/E17952_01/mysql-8.0-en/window-functions-frames.html
