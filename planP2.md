# P2 Why Now

작성일: 2026-04-15  
기준:

- [plan.md](/root/2026_project/plan.md:1)
- [research.md](/root/2026_project/research.md:1)
- [research2.md](/root/2026_project/research2.md:1)
- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:1)
- [app/models.py](/root/2026_project/app/models.py:1)

이 문서는 "P2. 로그/summary 저장 구조 재설계"를 왜 지금 해야 하는지에 집중해서 정리한 문서다.  
핵심은 기능 추가가 아니라, 현재 로그 업로드/조회/삭제 구조가 안고 있는 데이터 정합성 리스크를 줄이고 이후 작업의 기반을 만드는 데 있다.

---

## 1. 결론

P2를 지금 해야 하는 이유는, 현재 시스템에서 가장 큰 운영 리스크가  
"로그 파일, summary 파일, DB 레코드가 서로 느슨하게 연결되어 있다"는 점에 있기 때문이다.

지금 구조는 기능적으로는 잘 동작한다.

- 파일 업로드 가능
- NetApp 로그 파싱 가능
- summary 텍스트 생성 가능
- raw/summary 조회 가능
- manual fields와 special note 저장 가능

하지만 이 흐름이 안정적인 저장 구조 위에 서 있는 것은 아니다.

현재 상태는 대략 이렇다.

1. 원본 파일 저장
2. 텍스트 파싱
3. summary 파일 생성
4. DB에 일부 메타데이터 저장

문제는 이 4단계가 하나의 명확한 저장 단위로 관리되지 않는다는 점이다.

즉 지금은:

- 파일 저장은 성공했는데 DB 저장은 실패할 수 있고
- summary 파일은 만들어졌는데 DB가 그 경로를 직접 모르고 있고
- note/manual fields는 JSON 문자열로 한 row 안에 누적되고 있으며
- 삭제 시에도 raw/summary/DB 상태가 완전히 같은 기준으로 정리된다고 보기 어렵다.

그래서 P2는 "업로드 기능 고도화"가 아니라,

- 파일 시스템과 DB의 책임을 다시 정의하고
- summary 접근 방식을 명시화하고
- 정합성 깨짐을 줄이는 저장 구조로 바꾸는 단계

라고 보는 것이 맞다.

---

## 2. 현재 구조가 왜 위험한가

### 2.1 summary 파일을 DB가 직접 관리하지 않는다

현재 업로드 로직에서는 summary 파일을 생성한다.

관련 코드:

- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:178)

여기서 summary 파일은

- 저장 이름을 기준으로 `_summary.txt` 파일명을 만들어
- 파일 시스템에 별도 저장한다.

문제는 `uploaded_logs` 테이블에 summary 파일 경로가 명시 저장되지 않는다는 점이다.

즉 현재 DB는 아래 정보만 명확히 안다.

- raw 파일 경로 `stored_path`
- storage/site
- size/status
- manual fields
- note

하지만 summary는 사실상 "파일명 규칙을 다시 계산해서 찾아가는 파일"에 가깝다.

이 구조의 문제:

- 파일명 규칙이 바뀌면 과거 데이터 접근이 흔들릴 수 있음
- raw 파일명과 summary 파일명이 언제나 1:1로 안전하다고 보장하기 어려움
- summary 파일만 유실됐을 때 DB 차원에서 이상 상태를 직접 식별하기 어려움
- 운영자가 "이 로그의 summary 파일 위치가 어디냐"를 DB만 보고 바로 알 수 없음

즉 summary는 실제로 중요한 데이터인데도, 현재는 "부가 파일"처럼 다뤄지고 있다.

---

### 2.2 업로드 흐름이 원자적으로 묶여 있지 않다

현재 `upload_log()`는 한 함수 안에서 다음을 순서대로 수행한다.

1. raw 파일 저장
2. 텍스트 디코딩
3. 파싱
4. summary 파일 저장
5. `uploaded_logs` 레코드 생성

관련 코드:

- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:178)

이 순서 자체는 이해 가능하지만, 실패 지점별 보정 전략이 명확히 분리되어 있지는 않다.

예를 들면:

- raw 파일 저장 성공 후 파싱 실패
- summary 파일 저장 성공 후 DB commit 실패
- DB 저장 성공 후 후속 파일 정리 실패

같은 경우에 어떤 상태를 정상으로 볼지, 무엇을 복구해야 하는지가 코드 레벨에서 명확하게 분리되어 있지 않다.

즉 지금은 "대부분의 경우 잘 된다"에 가깝고,
"중간 실패 시 무엇이 남는가" 관점에서는 약하다.

이건 운영 데이터가 쌓일수록 부담이 커진다.

---

### 2.3 manual fields와 special note가 문자열 JSON으로 누적된다

현재 `uploaded_logs`에는 다음 컬럼이 있다.

- `manual_fields_json`
- `note`

관련 코드:

- [app/models.py](/root/2026_project/app/models.py:17)
- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:72)
- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:86)

현재 문제는 이 정보들이 row 내부의 `TEXT` JSON 문자열로 관리된다는 점이다.

이 방식의 장점:

- 초기에 빠르게 붙이기 쉬움
- 스키마 추가 없이 기능 확장 가능

하지만 지금 단계에서는 단점이 더 커진다.

문제:

- note가 늘어날수록 한 row 크기가 계속 커짐
- note 단건 수정/삭제/검색이 어려움
- JSON 구조가 코드에 묻어 있어 검증이 약함
- DB 쿼리 차원에서 부분 검색이나 통계가 어려움
- manual fields와 special note의 책임이 같은 컬럼 수준으로 취급됨

즉 지금은 "데이터를 저장은 하지만 다루기 좋은 구조는 아닌 상태"다.

---

### 2.4 파일 삭제와 DB 삭제의 책임이 아직 명확히 분리되지 않았다

현재는 P0에서 로그 삭제를 관리자 승인형으로 바꾸면서 접근 권한은 정리됐다.

하지만 삭제 자체의 저장 구조 관점에서는 아직 과제가 남아 있다.

질문은 여전히 남아 있다.

- raw 파일을 먼저 지워야 하나, DB를 먼저 지워야 하나
- summary 파일이 없으면 어떻게 처리할 것인가
- DB에만 남은 레코드, 파일만 남은 orphan 파일을 어떻게 복구할 것인가

즉 P0는 "누가 삭제할 수 있는가"를 해결했고,
P2는 "삭제가 데이터 구조적으로 안전한가"를 해결하는 단계다.

둘은 연결되어 있지만 다른 문제다.

---

## 3. 왜 지금 P2인가

### 3.1 P0와 P1이 끝나서 이제 저장 구조를 건드릴 수 있기 때문

지금까지 진행된 상태:

- P0: 인증/인가, 관리자 승인형 회원가입, 삭제 승인 흐름 정리
- P1: PostgreSQL migration/Alembic 전환

즉 지금은:

- 누가 접근할 수 있는지가 정리됐고
- DB 변경을 revision으로 관리할 기반도 생겼다.

이 두 가지가 없으면 P2를 먼저 하는 건 위험했을 가능성이 크다.

왜냐면 P2는 결국:

- `uploaded_logs` 스키마 수정
- summary 메타 컬럼 추가 가능성
- JSON 필드 구조 변경
- 과거 데이터 migration

을 포함할 수 있기 때문이다.

지금은 P1 덕분에 이런 변경을 Alembic revision으로 안전하게 다룰 수 있다.

즉 P2는 지금이 적기다.

---

### 3.2 현재 시스템의 가장 큰 리스크가 이 영역에 있기 때문

지금 코드베이스에서 가장 위험한 부분을 하나 꼽으면,
보안보다도 저장 정합성 관점에서는 로그/summary 영역이다.

이유:

- 파일 시스템에 중요한 데이터가 저장됨
- DB는 그 메타데이터를 일부만 알고 있음
- 업로드/삭제가 여러 단계를 거침
- summary는 실제 사용자 화면에서 많이 쓰이는데 DB 연결은 약함

즉 장애가 나면 다음과 같은 형태로 나타날 가능성이 높다.

- 목록에는 보이는데 summary가 없음
- raw는 있는데 summary가 깨짐
- DB에는 있는데 파일이 없음
- 파일은 있는데 DB에는 없음
- manual fields나 notes는 남았는데 연결된 파일은 없어짐

이런 종류의 장애는 사용성이 아니라 운영 신뢰성을 직접 깎는다.

그래서 P2는 "있으면 좋은 개선"보다 우선순위가 높다.

---

### 3.3 P3 테스트 복구도 P2의 영향을 강하게 받기 때문

P3에서 테스트 체계를 복구하려면 먼저 저장 구조가 어느 정도 안정돼 있어야 한다.

현재처럼:

- summary 파일 경로가 명시 저장되지 않고
- note/manual fields가 문자열 JSON으로 섞여 있고
- 업로드 흐름이 단계별 책임으로 분리되지 않은 상태

에서는 테스트도 애매해진다.

예를 들면 테스트 관점에서 묻고 싶은 건 이런 것이다.

- 업로드가 성공하면 어떤 파일과 어떤 DB 레코드가 생겨야 하는가
- 실패하면 무엇이 남지 않아야 하는가
- 삭제 후 어떤 파일과 어떤 레코드가 없어져야 하는가

이런 기대값을 정의하려면 저장 구조가 먼저 선명해야 한다.

즉 P2는 테스트를 쉽게 만들기 위한 선행 작업이기도 하다.

---

## 4. 지금 미루면 생기는 문제

### 4.1 legacy 저장 구조가 더 굳어진다

지금 P2를 미루면 앞으로 기능은 계속 그 위에 쌓이게 된다.

예:

- summary 화면이 더 늘어남
- note 사용량이 늘어남
- manual fields가 더 늘어남
- 파일 정합성 문제를 UI 쪽에서 우회하게 됨

그러면 나중에는 단순 구조 개편이 아니라 "이미 많이 쓰이고 있는 비정형 구조의 정리"가 된다.

즉 지금 손보는 것이 가장 싸다.

---

### 4.2 orphan 데이터가 누적될 가능성이 커진다

현재 구조에서 orphan은 크게 두 종류다.

- DB에는 있는데 실제 파일이 없는 경우
- 파일은 있는데 DB에는 없는 경우

지금은 이걸 체계적으로 점검하거나 복구하는 구조가 없다.

시간이 지날수록 이런 데이터는 더 쌓이고,
나중에는 실제 운영 데이터 정리 비용이 커진다.

P2를 통해 최소한

- summary 경로를 DB가 알고
- 업로드/삭제 단계를 더 명확히 나누고
- 점검 기준을 만들면

이 문제를 줄일 수 있다.

---

### 4.3 summary를 계속 "파생 파일"로만 다루게 된다

summary는 실제로 사용자에게 중요한 결과물이다.

사용자 입장에서 summary는:

- 장비 상태를 빠르게 보는 주요 화면이고
- raw보다 더 자주 읽히는 핵심 데이터일 수 있다.

그런데 지금처럼 filename 규칙으로 간접 접근하는 구조를 계속 두면,
summary는 중요한 데이터이면서도 저장 구조상 2등 시민처럼 남게 된다.

P2는 summary를 "명시적으로 추적 가능한 자산"으로 올리는 단계다.

---

## 5. P2가 해결하려는 핵심 문제

P2가 해결하려는 핵심은 아래 다섯 가지다.

1. summary 파일 위치를 DB가 직접 알지 못하는 문제
2. 업로드/삭제 중간 실패 시 파일-DB 정합성이 깨질 수 있는 문제
3. manual fields와 note가 TEXT JSON 문자열에 묻혀 있는 문제
4. 파일과 DB의 책임 경계가 불명확한 문제
5. orphan 상태를 점검/복구하기 어려운 문제

즉 P2의 본질은:

- "로그와 summary를 운영 가능한 저장 단위로 재정의하는 것"

이다.

---

## 6. P2가 끝나면 얻는 것

### 운영 측면

- 특정 로그의 raw/summary 위치를 더 명확히 추적 가능
- 업로드/삭제 실패 시 복구 판단이 쉬워짐
- 파일 정합성 점검 도구를 만들기 쉬워짐

### 개발 측면

- `log_service.py` 책임이 더 선명해짐
- 조회/삭제/수정 로직이 filename 규칙에 덜 의존하게 됨
- 이후 summary 구조 변경이나 JSONB 전환이 쉬워짐

### 테스트 측면

- 업로드 결과에 대한 기대값을 더 명확히 정의 가능
- raw/summary/DB 상태를 검증하기 쉬워짐
- 실패/복구 시나리오 테스트가 가능해짐

### 다음 단계 연계

- P3 테스트 복구 기반 강화
- P4 프론트 구조 분리 시 API 계약이 더 안정화됨
- P6 운영 점검/복구 스크립트로 연결 가능

---

## 7. P2는 무엇을 하지 않는가

P2의 범위를 분명히 할 필요가 있다.

P2는 주로 아래를 다룬다.

- summary 경로 명시 저장 또는 동등한 summary 식별 구조
- 업로드/삭제 작업 단위 정리
- manual fields / note 구조 재정리
- 파일-DB 정합성 보강

반면 아래는 P2의 핵심 목표가 아니다.

- parser 알고리즘 자체를 전면 교체
- summary UI 디자인 전면 개편
- 게시판 기능 확장
- 전체 성능 최적화

이 구분이 필요한 이유는, P2가 저장 구조 안정화라는 본래 목표를 벗어나면  
작업 범위가 너무 커지고 마감 판단이 어려워지기 때문이다.

---

## 8. 현재 코드 기준 P2 필요성을 가장 잘 보여주는 파일

### [app/services/log_service.py](/root/2026_project/app/services/log_service.py:1)

이 파일이 P2 필요성의 가장 직접적인 근거다.

이유:

- raw 저장
- summary 생성
- DB insert
- manual fields 인코딩
- special notes 처리
- 삭제/조회

가 한 서비스 안에 강하게 묶여 있다.

특히 [app/services/log_service.py](/root/2026_project/app/services/log_service.py:178) 의 `upload_log()`는
"현재 저장 구조가 어떻게 되어 있는지"를 가장 직접적으로 보여준다.

즉 P2가 끝나면 이 파일은 다음 방향으로 바뀌어야 한다.

- 업로드 단계 분리
- 저장 책임 분리
- 정합성 보정 함수 분리
- summary 접근 방식 명시화

### [app/models.py](/root/2026_project/app/models.py:17)

현재 `uploaded_logs`는 많은 책임을 한 row에 담고 있다.

- raw 파일 메타
- 저장 위치
- manual fields 문자열
- note 문자열

이 상태는 빠르게 기능을 붙이기엔 좋았지만, 장기 운영 구조로는 한계가 있다.

P2는 결국 `uploaded_logs`가 무엇을 직접 저장하고, 무엇을 별도 구조로 분리할지 정리하는 작업이다.

### [research.md](/root/2026_project/research.md:722)

이미 조사 문서에서도 파일-DB 정합성 리스크가 핵심 과제로 정리돼 있다.

즉 P2는 새로 생긴 아이디어가 아니라, 현재 프로젝트 상태를 분석했을 때 반복적으로 드러난 우선 과제다.

---

## 9. 최종 판단

P2를 지금 해야 하는 이유는 명확하다.

- P0로 접근 권한을 정리했고
- P1로 스키마 관리 체계를 정리했다.
- 이제 남은 가장 큰 운영 리스크는 로그/summary 저장 정합성이다.

이 상태에서 P2를 미루면:

- 파일-DB 구조 문제는 계속 누적되고
- 이후 테스트/리팩토링 비용이 커지고
- summary는 계속 암묵적 규칙에 기대는 상태로 남는다.

따라서 P2는 "업로드 기능 개선"이 아니라,

- 운영 데이터 신뢰성을 높이고
- 다음 단계 개발을 안전하게 만들기 위한
- 저장 구조 안정화 작업

으로 봐야 한다.

한 줄로 요약하면:

P2는 지금 프로젝트에서 "파일이 먼저고 DB는 뒤에서 따라가는 구조"를 끝내고,  
"DB와 파일이 같은 기준으로 추적되는 저장 구조"로 넘어가기 위해 반드시 필요한 단계다.

===============

## 진행 후 해결된 부분

P2 1차 작업을 통해 아래 문제가 실제 코드/스키마 수준에서 해소되었다.

### 1. summary 파일 경로를 DB가 직접 알 수 있게 됨

이전에는 summary 파일을 항상 `원본파일명_stem + _summary.txt` 규칙으로 계산해서 찾았다.

즉 DB는 raw 파일 경로만 알고 있었고, summary는 간접적으로 추론해야 했다.

지금은:

- [app/models.py](/root/2026_project/app/models.py:17) 의 `uploaded_logs.summary_path` 컬럼 추가
- [alembic/versions/20260415_03_p2_log_summary_paths.py](/root/2026_project/alembic/versions/20260415_03_p2_log_summary_paths.py:1) 로 기존 데이터도 summary 경로 백필
- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:32) 의 `resolve_summary_path()`를 통해 DB 경로를 우선 사용

즉 이제 summary는 "파일명 규칙으로 추론하는 부가 파일"이 아니라  
"DB가 직접 추적하는 파일 자산"이 되었다.

### 2. 업로드 중간 실패 시 raw/summary 파일 찌꺼기 정리가 추가됨

이전에는 업로드 함수가

- raw 저장
- summary 저장
- DB commit

을 한 흐름으로 처리했지만, DB 저장 실패나 예외 발생 시 남은 파일 정리 책임이 약했다.

지금은 [app/services/log_service.py](/root/2026_project/app/services/log_service.py:43) 의 `cleanup_generated_files()`를 추가했고,  
[app/services/log_service.py](/root/2026_project/app/services/log_service.py:178) 의 `upload_log()`에서

- `HTTPException`
- `SQLAlchemyError`
- 기타 예외

모두에 대해 DB rollback 후 raw/summary 파일 정리를 수행한다.

즉 최소한 "파일은 남았는데 DB 저장은 실패한 상태"를 줄이는 방향으로 보강되었다.

### 3. 삭제 시 summary 파일도 DB 기준으로 정리함

이전에는 삭제 시 summary 파일 경로도 다시 filename 규칙으로 계산했다.

지금은 [app/services/log_service.py](/root/2026_project/app/services/log_service.py:307) 의 `delete_log()`가  
`log.summary_path`를 우선 사용해서 summary 파일을 정리한다.

또한 순서도 개선되었다.

- 먼저 DB에서 레코드를 삭제하고 commit
- 이후 raw/summary 파일 삭제는 best-effort cleanup으로 수행

즉 삭제 작업이 "DB 기준 정리"로 한 단계 더 명확해졌다.

### 4. 로그 목록/summary 응답도 명시 경로를 함께 반환함

이전에는 summary 경로가 업로드 직후 응답에서만 임시적으로 드러나고, 목록 DB 기준 구조에는 반영되지 않았다.

지금은:

- `list_logs()`가 `summary_stored_path`를 포함
- `upload_log()`가 DB에 저장된 summary 경로를 응답으로 사용
- `get_log_summary()`도 DB 경로 기준으로 summary 파일을 연다

즉 프론트/API 모두 "summary 경로는 DB에 있다"는 전제를 가질 수 있게 됐다.

### 5. P2의 핵심 목표 중 현재 해결된 범위

현재 해결된 것:

- summary 경로 명시 저장
- 업로드 중간 실패 시 파일 정리 보강
- 삭제 시 summary 경로의 DB 기준 처리
- raw/summary/DB 연결 고리 강화

아직 남아 있는 것:

- `manual_fields_json`, `note`를 TEXT JSON에서 더 구조화된 저장 방식으로 옮기는 작업
- orphan 파일/레코드 점검 및 복구 스크립트
- 업로드/삭제를 더 세밀한 작업 단위로 쪼개는 리팩토링
- summary를 파일 유지로 갈지, DB(JSON/JSONB) 저장으로 2단계 전환할지 결정

즉 이번 P2 작업은 "정합성의 핵심 위험을 먼저 낮추는 1차 정리"까지 완료된 상태라고 보는 것이 정확하다.
