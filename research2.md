# Feature Research 2

작성일: 2026-04-13  
기준: 현재 워크스페이스 코드 + [\.env](/root/2026_project/.env:1) 기준  
운영 가정:

- DB: PostgreSQL
- 업로드 경로: `upload/`
- 프론트: 단일 HTML + 바닐라 JS

이 문서는 "모든 기능"을 기능 단위로 다시 쪼개서 정리한 조사 문서다.  
특히 아래 관점에 맞춰 작성했다.

1. 관련 파일 목록
2. 요청 → 처리 → 저장/응답 흐름
3. 수정이 필요한 후보 지점
4. 리스크와 미확정 사항
5. 내가 결정해야 할 질문

---

## 0. 공통 기반

### 관련 파일 목록

- 앱 엔트리: [app/main.py](/root/2026_project/app/main.py:1)
- 앱 팩토리: [app/app_factory.py](/root/2026_project/app/app_factory.py:1)
- 설정: [app/config.py](/root/2026_project/app/config.py:1)
- DB 연결: [app/db.py](/root/2026_project/app/db.py:1)
- 모델: [app/models.py](/root/2026_project/app/models.py:1)
- 시작 시 초기화: [app/core/lifecycle.py](/root/2026_project/app/core/lifecycle.py:1)
- 경로 상수: [app/core/paths.py](/root/2026_project/app/core/paths.py:1)
- 앱 공통 상수: [app/core/constants.py](/root/2026_project/app/core/constants.py:1)
- 템플릿: [app/templates/index.html](/root/2026_project/app/templates/index.html:1)
- 프론트 로직: [app/static/app.js](/root/2026_project/app/static/app.js:1)
- 스타일: [app/static/app.css](/root/2026_project/app/static/app.css:1)
- 실행 스크립트: [deploy/run.sh](/root/2026_project/deploy/run.sh:1)
- 릴리스 스크립트: [deploy/build_release.sh](/root/2026_project/deploy/build_release.sh:1)

### 요청 → 처리 → 저장/응답 흐름

1. `uvicorn app.main:app` 실행
2. `create_app()`가 라우터 등록
3. startup에서 DB 스키마 생성, 일부 컬럼 보정, 관리자 계정 생성
4. 브라우저가 `/` 접속
5. 서버가 `index.html` 반환
6. 프론트 JS가 로그인 상태 복원 후 각 기능 API 호출

### 수정이 필요한 후보 지점

- [app/core/lifecycle.py](/root/2026_project/app/core/lifecycle.py:1): 런타임 `ALTER TABLE` 제거 필요
- [app/static/app.js](/root/2026_project/app/static/app.js:1): 파일이 너무 커서 기능별 분리 필요
- [app/models.py](/root/2026_project/app/models.py:1): 관계/제약/인덱스 보강 필요

### 리스크와 미확정 사항

- 인증/인가가 서버 경계로 작동하지 않음
- PostgreSQL 사용 전제인데 migration 체계가 약함
- 업로드 파일과 DB 정합성이 원자적으로 보장되지 않음

### 내가 결정해야 할 질문

- 서버 인증을 쿠키 세션으로 할지 JWT로 할지
- PostgreSQL 스키마 관리를 Alembic으로 전환할지
- 프론트를 계속 바닐라 JS로 유지할지, 모듈화 또는 프레임워크 전환할지

---

## 1. 웹 셸/앱 부트스트랩 기능

기능 범위:

- `/` 접속
- `index.html` 반환
- `/api` 기본 정보 제공
- `/health` 헬스체크
- 프론트 앱 초기 로딩

### 1) 관련 파일 목록

- [app/api/web_routes.py](/root/2026_project/app/api/web_routes.py:1)
- [app/templates/index.html](/root/2026_project/app/templates/index.html:1)
- [app/static/app.js](/root/2026_project/app/static/app.js:1)
- [app/static/app.css](/root/2026_project/app/static/app.css:1)
- [app/core/constants.py](/root/2026_project/app/core/constants.py:1)

### 2) 요청 → 처리 → 저장/응답 흐름

- `GET /`
  - `root()`가 `index.html`을 읽어 `HTMLResponse` 반환
- `GET /api`
  - 앱 환경, `server_session_id`, 스토리지 선택지, 요청 상태 선택지 반환
- `GET /health`
  - DB에 `SELECT 1` 실행
  - `app: ok`, `db: ok/error` 반환
- 프론트 초기화
  - `restoreSession()`
  - 성공 시 `openApp()`
  - 이후 `loadSites()`, `loadLogs()`, `loadRequestPosts()`, `loadBugPosts()`, `loadUsers()`

### 3) 수정이 필요한 후보 지점

- [app/api/web_routes.py](/root/2026_project/app/api/web_routes.py:1)
  - `/`에서 매번 파일을 읽는 대신 템플릿 응답 체계 정리 가능
- [app/static/app.js](/root/2026_project/app/static/app.js:1)
  - 부트스트랩/세션/UI 로딩 분리 필요
- [app/api/web_routes.py](/root/2026_project/app/api/web_routes.py:1)
  - `/health`에 storage, parser, upload dir 상태까지 포함 가능

### 4) 리스크와 미확정 사항

- `/api`가 사실상 세션 검증처럼 쓰이지만 진짜 인증 API는 아님
- `/health`가 DB 이외 나머지 의존성을 충분히 체크하지 않음

### 5) 내가 결정해야 할 질문

- `/health`를 운영 로드밸런서 기준으로 얼마나 엄격하게 만들지
- `/api`를 단순 정보용으로 둘지, 세션 상태용 엔드포인트로 명시 분리할지

---

## 2. 로그인 / 회원가입 / 회원탈퇴 / 회원목록 기능

### 1) 관련 파일 목록

- 라우터: [app/api/auth_routes.py](/root/2026_project/app/api/auth_routes.py:1)
- 서비스: [app/services/auth_service.py](/root/2026_project/app/services/auth_service.py:1)
- 해시: [app/auth.py](/root/2026_project/app/auth.py:1)
- 모델: [app/models.py](/root/2026_project/app/models.py:22)
- 스키마: [app/schemas/payloads.py](/root/2026_project/app/schemas/payloads.py:1)
- 프론트: [app/static/app.js](/root/2026_project/app/static/app.js:1)
- 관리자 생성: [app/core/lifecycle.py](/root/2026_project/app/core/lifecycle.py:1)

### 2) 요청 → 처리 → 저장/응답 흐름

- 회원가입
  - 프론트 `POST /auth/register`
  - `register_user()`
  - 중복 username 확인
  - 비밀번호 해시 저장
  - `users` 테이블 insert
  - 사용자 정보 JSON 반환

- 로그인
  - 프론트 `POST /auth/login`
  - `login_user()`
  - 비밀번호 검증
  - 서버 세션 ID 포함 응답 반환
  - 프론트가 `localStorage` 저장

- 회원탈퇴
  - 프론트 `DELETE /auth/delete`
  - 사용자/비밀번호 검증
  - `users` row 삭제
  - 프론트가 로컬 세션 삭제

- 회원목록
  - 프론트 `GET /users`
  - `list_users()`
  - 생성일 역순 반환

### 3) 수정이 필요한 후보 지점

- [app/services/auth_service.py](/root/2026_project/app/services/auth_service.py:1)
  - 서버 인증 토큰/세션 도입 필요
- [app/api/auth_routes.py](/root/2026_project/app/api/auth_routes.py:1)
  - 보호가 필요한 API에 auth dependency 연결 필요
- [app/core/lifecycle.py](/root/2026_project/app/core/lifecycle.py:1)
  - 관리자 계정 자동 비밀번호 재설정 정책 재검토 필요
- [app/static/app.js](/root/2026_project/app/static/app.js:1)
  - localStorage 기반 세션을 실제 인증 모델로 쓰지 않게 수정 필요

### 4) 리스크와 미확정 사항

- 현재 로그인은 서버 접근 권한을 실제로 막지 못함
- 회원목록 API가 인증 없이 노출될 가능성이 큼
- 누구나 회원 삭제 API를 호출할 수 있는 구조적 위험이 있음
- 관리자 비밀번호가 설정 파일에 직접 존재

### 5) 내가 결정해야 할 질문

- 로그인한 사용자만 전체 앱 접근 가능하게 만들지
- 관리자만 회원목록/회원삭제를 하게 할지
- 관리자 계정을 유지할지, 별도 운영자 롤을 둘지

---

## 3. 사이트 관리 기능

기능 범위:

- 사이트 목록 조회
- 사이트 생성
- 사이트 수정
- 사이트 삭제

### 1) 관련 파일 목록

- 라우터: [app/api/site_routes.py](/root/2026_project/app/api/site_routes.py:1)
- 서비스: [app/services/site_service.py](/root/2026_project/app/services/site_service.py:1)
- 모델: [app/models.py](/root/2026_project/app/models.py:6)
- 스키마: [app/schemas/payloads.py](/root/2026_project/app/schemas/payloads.py:29)
- 프론트: [app/static/app.js](/root/2026_project/app/static/app.js:933)

### 2) 요청 → 처리 → 저장/응답 흐름

- 목록 조회
  - `GET /sites`
  - storage filter 있으면 필터링
  - 이름 순 정렬
  - 사이트 목록 반환

- 생성
  - `POST /sites`
  - storage 이름 검증
  - 빈 이름/중복 이름 검증
  - `storage_sites` insert
  - 생성된 사이트 반환

- 수정
  - `PUT /sites/{site_id}`
  - 대상 row 조회
  - storage/name 검증
  - 중복 체크
  - row update
  - 결과 반환

- 삭제
  - `DELETE /sites/{site_id}`
  - 대상 row 조회
  - 연결된 `uploaded_logs` 존재 여부 확인
  - 로그가 있으면 삭제 거부
  - 없으면 row 삭제

### 3) 수정이 필요한 후보 지점

- [app/services/site_service.py](/root/2026_project/app/services/site_service.py:1)
  - foreign key 및 cascade 정책 재설계 필요
- [app/models.py](/root/2026_project/app/models.py:6)
  - `storage_name + name` 유니크 제약 DB 레벨 추가 후보
- [app/static/app.js](/root/2026_project/app/static/app.js:948)
  - 사이트 관리 UI 분리 및 권한 처리 필요

### 4) 리스크와 미확정 사항

- 삭제 제한이 서비스 코드에만 존재
- FK 제약이 없어서 DB 직접 변경 시 무결성 깨질 수 있음
- storage는 문자열 enum처럼 쓰지만 DB enum/constraint 없음

### 5) 내가 결정해야 할 질문

- 사이트 삭제를 "로그 있으면 불가"로 유지할지
- 아니면 soft delete나 archive 개념을 넣을지
- 사이트명 중복 허용 범위를 지금처럼 storage 단위로 유지할지

---

## 4. 로그 업로드 기능

기능 범위:

- 파일 선택
- 파일별 저장 이름 지정
- storage/site 선택
- 수동 입력 필드 포함 업로드

### 1) 관련 파일 목록

- 라우터: [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- 서비스: [app/services/log_service.py](/root/2026_project/app/services/log_service.py:1)
- 파서: [app/parser_netapp.py](/root/2026_project/app/parser_netapp.py:1)
- 사이트 검증: [app/services/site_service.py](/root/2026_project/app/services/site_service.py:1)
- 경로 상수: [app/core/paths.py](/root/2026_project/app/core/paths.py:1)
- 모델: [app/models.py](/root/2026_project/app/models.py:14)
- 프론트: [app/static/app.js](/root/2026_project/app/static/app.js:266)

### 2) 요청 → 처리 → 저장/응답 흐름

1. 프론트가 업로드 폼 제출
2. `POST /upload`
3. 서버가 파일 목록/이름 목록 개수 검증
4. `storage_name`, `site_id` 유효성 검증
5. 파일명 정규화
6. 저장 경로 중복 회피
7. 원본 파일을 `upload/`에 저장
8. 로그 바이트를 텍스트로 디코딩
9. `parse_netapp_log()` 실행
10. summary 텍스트 생성
11. summary 파일 저장
12. `uploaded_logs` insert
13. 프론트가 `/logs` 재조회 후 해당 스토리지로 이동

### 3) 수정이 필요한 후보 지점

- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:150)
  - 업로드, 파싱, 파일 저장, DB 저장을 작업 단위로 분리할 필요
- [app/parser_netapp.py](/root/2026_project/app/parser_netapp.py:1)
  - 포맷 변형 대응과 테스트 강화 필요
- [app/models.py](/root/2026_project/app/models.py:14)
  - summary 경로 컬럼 추가 후보
- [app/static/app.js](/root/2026_project/app/static/app.js:266)
  - 업로드 실패/부분 성공 케이스 UI 개선 필요

### 4) 리스크와 미확정 사항

- 업로드 중 파일 저장 성공, DB 저장 실패 가능
- summary 저장 실패 시 롤백 일관성 없음
- 큰 파일 업로드 제한 정책이 없음
- 악성 파일/비정상 포맷 검증이 약함

### 5) 내가 결정해야 할 질문

- 업로드 최대 크기를 둘지
- 업로드 후 즉시 파싱할지, 비동기 큐로 분리할지
- summary를 파일로만 둘지 DB에도 저장할지

---

## 5. 로그 목록 조회 기능

기능 범위:

- 전체 로그 목록
- storage/site 필터
- 화면용 목록 렌더링

### 1) 관련 파일 목록

- 라우터: [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- 서비스: [app/services/log_service.py](/root/2026_project/app/services/log_service.py:217)
- 모델: [app/models.py](/root/2026_project/app/models.py:14)
- 프론트: [app/static/app.js](/root/2026_project/app/static/app.js:876)

### 2) 요청 → 처리 → 저장/응답 흐름

- 프론트 `GET /logs`
- optional `storage_name`, `site_id`
- 서버가 `uploaded_logs LEFT JOIN storage_sites`
- ID desc 정렬
- 리스트 JSON 반환
- 프론트가 storage별/site별로 메모리 필터링 후 렌더링

### 3) 수정이 필요한 후보 지점

- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:217)
  - 페이지네이션 추가 후보
- [app/static/app.js](/root/2026_project/app/static/app.js:987)
  - 전량 메모리 적재 대신 지연 로딩 가능
- [app/models.py](/root/2026_project/app/models.py:14)
  - 정렬/필터용 인덱스 보강 후보

### 4) 리스크와 미확정 사항

- 로그 수가 늘면 `/logs` 전체 조회 비용 증가
- 프론트 메모리 부담 증가
- 검색/정렬/페이지네이션 부재

### 5) 내가 결정해야 할 질문

- 목록 API를 서버 페이지네이션으로 바꿀지
- 검색 조건을 파일명/사이트/날짜까지 지원할지

---

## 6. 원본 로그 상세 조회 / 다운로드 / 삭제 기능

### 1) 관련 파일 목록

- 라우터: [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- 서비스: [app/services/log_service.py](/root/2026_project/app/services/log_service.py:237)
- 모델: [app/models.py](/root/2026_project/app/models.py:14)
- 프론트: [app/static/app.js](/root/2026_project/app/static/app.js:514)

### 2) 요청 → 처리 → 저장/응답 흐름

- 원본 조회
  - `GET /logs/{id}/raw`
  - DB에서 로그 row 조회
  - 파일 시스템에서 `stored_path` 읽기
  - 원문 텍스트 반환

- 다운로드
  - `GET /logs/{id}/download`
  - DB row 조회
  - 파일 존재 확인
  - `FileResponse` 반환

- 삭제
  - `DELETE /logs/{id}`
  - DB row 조회
  - 원본 파일 삭제
  - `<stem>_summary.txt` 삭제
  - DB row 삭제
  - 삭제 결과 반환

### 3) 수정이 필요한 후보 지점

- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:237)
  - 파일 읽기 범위/미리보기 제한 추가 후보
- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:260)
  - 삭제 작업의 트랜잭션/복구 전략 보완 필요
- [app/static/app.js](/root/2026_project/app/static/app.js:544)
  - 권한 제어 및 삭제 UX 강화 필요

### 4) 리스크와 미확정 사항

- DB row는 있는데 파일이 없는 상태가 이미 생길 수 있음
- 대용량 원문을 그대로 내려주면 응답/렌더링 비용 큼
- 삭제 권한 모델이 없음

### 5) 내가 결정해야 할 질문

- 원본 로그 전체를 계속 브라우저에 보여줄지
- 아니면 다운로드 중심 + 일부 미리보기로 제한할지
- 삭제를 soft delete로 바꿀지

---

## 7. summary 조회 기능

기능 범위:

- summary overview
- 요약 필드 렌더링
- section_contents 생성

### 1) 관련 파일 목록

- 라우터: [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- 서비스: [app/services/log_service.py](/root/2026_project/app/services/log_service.py:278)
- 파서: [app/parser_netapp.py](/root/2026_project/app/parser_netapp.py:1)
- 상수: [app/core/constants.py](/root/2026_project/app/core/constants.py:1)
- 프론트: [app/static/app.js](/root/2026_project/app/static/app.js:1120)

### 2) 요청 → 처리 → 저장/응답 흐름

1. 프론트 `GET /logs/{id}/summary`
2. 서버가 DB row 조회
3. summary 파일 `<stem>_summary.txt` 읽기
4. summary key:value 파싱
5. 원본 파일도 다시 읽기
6. manual fields JSON 파싱
7. display summary 조합
8. 원본에서 section text 추출
9. 특이사항 JSON 파싱
10. summary payload JSON 반환
11. 프론트 overview/section 탭 렌더링

### 3) 수정이 필요한 후보 지점

- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:278)
  - summary path를 filename 규칙 대신 명시 저장하도록 수정 후보
- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:103)
  - display summary 생성 로직과 raw summary 파싱 로직 분리 가능
- [app/static/app.js](/root/2026_project/app/static/app.js:1132)
  - summary 데이터 캐시/재렌더링 최적화 후보

### 4) 리스크와 미확정 사항

- summary 조회 때 원본과 summary 파일을 매번 모두 읽음
- summary 파일이 사라지면 상세 전체가 깨짐
- 표시용 key명과 내부 key명이 섞여 있음

### 5) 내가 결정해야 할 질문

- summary를 파일로 계속 둘지
- summary를 DB JSON 컬럼으로 옮길지
- summary 생성 시점과 조회 시점의 책임을 어디까지 분리할지

---

## 8. summary 섹션 상세 보기 기능

기능 범위:

- Shelf
- Disk
- FCP
- Network Interface
- Network Port
- Volume
- LUN
- Snapmirror
- Event log
- 특이사항

### 1) 관련 파일 목록

- 파서: [app/parser_netapp.py](/root/2026_project/app/parser_netapp.py:321)
- 서비스: [app/services/log_service.py](/root/2026_project/app/services/log_service.py:278)
- 프론트: [app/static/app.js](/root/2026_project/app/static/app.js:1146)
- 템플릿 탭 UI: [app/templates/index.html](/root/2026_project/app/templates/index.html:286)

### 2) 요청 → 처리 → 저장/응답 흐름

- summary API 호출 시 section_contents가 한 번에 만들어짐
- 프론트는 별도 API 추가 호출 없이 탭만 전환
- Event log는 severity별 필터를 프론트 상태에서 토글
- 특이사항은 별도 저장 API와 연결

### 3) 수정이 필요한 후보 지점

- [app/parser_netapp.py](/root/2026_project/app/parser_netapp.py:321)
  - command block 추출 패턴 정교화 필요
- [app/static/app.js](/root/2026_project/app/static/app.js:1146)
  - 섹션별 렌더러 분리 필요
- [app/templates/index.html](/root/2026_project/app/templates/index.html:286)
  - 탭 목록이 하드코딩되어 있어 확장성 낮음

### 4) 리스크와 미확정 사항

- 섹션 종류 변경 시 프론트/백엔드 동시 수정 필요
- Event log 구조는 일부 severity에서만 카드형 렌더링
- section text가 크면 프론트 렌더링 부담 커짐

### 5) 내가 결정해야 할 질문

- 섹션 목록을 서버 정의 기반으로 동적으로 만들지
- Event log를 별도 API로 분리할지

---

## 9. 수동 입력 필드 기능

기능 범위:

- 업로드 시 직접 입력
- summary 화면에서 수정

### 1) 관련 파일 목록

- 스키마: [app/schemas/payloads.py](/root/2026_project/app/schemas/payloads.py:33)
- 서비스: [app/services/log_service.py](/root/2026_project/app/services/log_service.py:51)
- 라우터: [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- 상수: [app/core/constants.py](/root/2026_project/app/core/constants.py:5)
- 프론트 모달: [app/static/app.js](/root/2026_project/app/static/app.js:176)

### 2) 요청 → 처리 → 저장/응답 흐름

- 업로드 시
  - 프론트가 `manual_fields_json` 문자열을 multipart로 전송
  - 서버가 JSON 파싱/정규화
  - `uploaded_logs.manual_fields_json`에 저장

- 수정 시
  - 프론트 `PUT /logs/{id}/manual-fields`
  - 서버가 `normalize_manual_fields()`
  - DB update
  - 수정된 manual fields JSON 반환

### 3) 수정이 필요한 후보 지점

- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:51)
  - manual fields를 JSON 문자열이 아니라 JSONB 컬럼으로 바꾸는 후보
- [app/core/constants.py](/root/2026_project/app/core/constants.py:5)
  - 필드 정의/표시 라벨/순서를 더 체계적으로 관리 가능

### 4) 리스크와 미확정 사항

- DB 질의/통계에 불리
- 필드가 늘어날수록 마이그레이션 정책이 애매함
- 값 검증이 거의 없음

### 5) 내가 결정해야 할 질문

- 필드를 계속 자유 입력으로 둘지
- 날짜/전화번호/선택값 등 타입 검증을 넣을지

---

## 10. 특이사항 기능

기능 범위:

- 특이사항 추가
- 기존 특이사항 기반 수정 이력 추가
- 특이사항 표시

### 1) 관련 파일 목록

- 스키마: [app/schemas/payloads.py](/root/2026_project/app/schemas/payloads.py:37)
- 서비스: [app/services/log_service.py](/root/2026_project/app/services/log_service.py:333)
- 라우터: [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- 프론트: [app/static/app.js](/root/2026_project/app/static/app.js:579)

### 2) 요청 → 처리 → 저장/응답 흐름

- 프론트 `POST /logs/{id}/special-notes`
- 서버가 `uploaded_logs.note` JSON 배열 파싱
- 신규 note 객체 생성
- 배열 맨 앞에 삽입
- JSON 문자열로 다시 저장
- 업데이트된 notes 반환
- 프론트가 특이사항 이력 재렌더링

### 3) 수정이 필요한 후보 지점

- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:333)
  - note를 별도 테이블로 분리하는 후보
- [app/static/app.js](/root/2026_project/app/static/app.js:1175)
  - 히스토리 UI와 작성 폼 분리 필요

### 4) 리스크와 미확정 사항

- note가 JSON 문자열이라 row 크기가 계속 커질 수 있음
- 작성자 검증이 없음
- note 단건 삭제/수정/이력 조회가 어려움

### 5) 내가 결정해야 할 질문

- 특이사항을 단순 메모로 둘지
- 아니면 감사 가능한 이력 테이블로 승격할지

---

## 11. 수정 요청 게시판 기능

### 1) 관련 파일 목록

- 라우터: [app/api/board_routes.py](/root/2026_project/app/api/board_routes.py:1)
- 서비스: [app/services/board_service.py](/root/2026_project/app/services/board_service.py:1)
- 모델: [app/models.py](/root/2026_project/app/models.py:34)
- 상수: [app/core/constants.py](/root/2026_project/app/core/constants.py:4)
- 프론트: [app/static/app.js](/root/2026_project/app/static/app.js:324)

### 2) 요청 → 처리 → 저장/응답 흐름

- 목록
  - `GET /requests`
  - 전체 row를 ID desc로 반환
  - 프론트가 상태 필터/검색 수행

- 등록
  - `POST /requests`
  - 제목/내용/상태 검증
  - `request_posts` insert

- 수정
  - `PUT /requests/{id}`
  - 대상 row 조회
  - 검증 후 update

- 삭제
  - `DELETE /requests/{id}`
  - 대상 row 삭제

### 3) 수정이 필요한 후보 지점

- [app/services/board_service.py](/root/2026_project/app/services/board_service.py:1)
  - author/권한/감사 정보 보강 필요
- [app/static/app.js](/root/2026_project/app/static/app.js:1460)
  - 프론트에서 전체 목록 재조회 대신 증분 갱신 가능

### 4) 리스크와 미확정 사항

- 아무나 수정/삭제 가능
- 댓글/담당자/우선순위/첨부 개념 없음
- 상태 이력 추적이 불가

### 5) 내가 결정해야 할 질문

- 요청 글을 단순 게시판으로 둘지
- 아니면 티켓 시스템 형태로 발전시킬지

---

## 12. 버그 기록 게시판 기능

### 1) 관련 파일 목록

- 라우터: [app/api/board_routes.py](/root/2026_project/app/api/board_routes.py:1)
- 서비스: [app/services/board_service.py](/root/2026_project/app/services/board_service.py:86)
- 모델: [app/models.py](/root/2026_project/app/models.py:45)
- 프론트: [app/static/app.js](/root/2026_project/app/static/app.js:354)

### 2) 요청 → 처리 → 저장/응답 흐름

- `GET /bugs`
- `POST /bugs`
- `PUT /bugs/{id}`
- `DELETE /bugs/{id}`

흐름은 수정 요청 게시판과 동일하되 상태 필드가 없는 단순 구조다.

### 3) 수정이 필요한 후보 지점

- [app/services/board_service.py](/root/2026_project/app/services/board_service.py:86)
  - severity, status, assignee 추가 후보
- [app/models.py](/root/2026_project/app/models.py:45)
  - 버그 테이블 구조 확장 필요 가능

### 4) 리스크와 미확정 사항

- 버그와 요청 게시판의 경계가 모호함
- 상태 추적 기능이 없어 운영성 낮음

### 5) 내가 결정해야 할 질문

- 버그와 요청 게시판을 합칠지
- 아니면 버그 전용 워크플로를 분리할지

---

## 13. 로그 탐색 UI / 뒤로가기 / split-view 기능

기능 범위:

- 스토리지 탭 이동
- 사이트 → 로그 목록 → 상세
- 브라우저 뒤로가기 연동
- 데스크톱 split-view

### 1) 관련 파일 목록

- 템플릿: [app/templates/index.html](/root/2026_project/app/templates/index.html:176)
- 프론트: [app/static/app.js](/root/2026_project/app/static/app.js:796)
- 스타일: [app/static/app.css](/root/2026_project/app/static/app.css:656)

### 2) 요청 → 처리 → 저장/응답 흐름

- 사용자가 스토리지/사이트/로그 클릭
- 프론트가 상태 객체 갱신
- `showPage()`, `renderStoragePage()`, `renderSummarySectionView()` 실행
- 필요 시 `/logs`, `/raw`, `/summary` API 호출
- 현재 상태를 `history.pushState()`에 반영
- 브라우저 뒤로가기로 `popstate` 복원

### 3) 수정이 필요한 후보 지점

- [app/static/app.js](/root/2026_project/app/static/app.js:1741)
  - history 로직을 별도 모듈로 분리 가능
- [app/templates/index.html](/root/2026_project/app/templates/index.html:176)
  - storage 블록 반복 구조를 템플릿화할 필요
- [app/static/app.css](/root/2026_project/app/static/app.css:916)
  - 데스크톱/모바일 반응형 레이아웃 정리 가능

### 4) 리스크와 미확정 사항

- 프론트 단일 파일 구조라 상태 변경 회귀 가능성 큼
- 리스트/상세 동시 렌더링이 커질수록 성능 비용 증가

### 5) 내가 결정해야 할 질문

- 지금 UI 구조를 계속 확장할지
- 아니면 프론트 구조를 먼저 나눌지

---

## 14. DB 구조 요약

### 관련 테이블

- `storage_sites`
- `uploaded_logs`
- `users`
- `request_posts`
- `bug_posts`

관련 파일:

- [app/models.py](/root/2026_project/app/models.py:1)

### 수정이 필요한 후보 지점

- FK 추가
- unique/index 제약 추가
- JSON 문자열 필드를 PostgreSQL `JSONB`나 별도 테이블로 전환
- audit column 추가

### 리스크와 미확정 사항

- FK 부재
- JSON 문자열 저장
- summary 경로 미보관
- migration 관리 미흡

### 내가 결정해야 할 질문

- PostgreSQL 기능(JSONB, enum, FK, partial index 등)을 적극 쓸지
- 단순 이식성보다 운영 안정성을 우선할지

---

## 15. 외부 의존성 요약

### 관련 파일 목록

- [requirements.txt](/root/2026_project/requirements.txt:1)
- [requirements-dev.txt](/root/2026_project/requirements-dev.txt:1)
- [deploy/run.sh](/root/2026_project/deploy/run.sh:1)

### 의존성

- `fastapi`
- `uvicorn[standard]`
- `sqlalchemy`
- `psycopg[binary]`
- `pydantic`
- `pydantic-settings`
- `python-multipart`
- 개발용 `pytest`

추가 의존:

- PostgreSQL 서버
- 로컬 또는 서버 파일 시스템
- Google Fonts 접근 가능 여부

### 수정이 필요한 후보 지점

- 의존성 잠금 파일 부재
- 운영/개발 의존성 분리가 약함
- parser 테스트용 fixture 관리 체계 필요

### 리스크와 미확정 사항

- 환경별 패키지 버전 차이 가능
- PostgreSQL 스키마/권한 설정 문서 부족

### 내가 결정해야 할 질문

- `requirements.txt`만 유지할지
- 아니면 Poetry/uv/pip-tools 등 잠금 체계를 도입할지

---

## 16. 공통 수정 후보 우선순위

### 1순위

- 서버 인증/인가 도입
- PostgreSQL 스키마를 Alembic 기반으로 정리
- 업로드/삭제의 파일-DB 정합성 보강

### 2순위

- summary/특이사항/manual fields 저장 구조 개선
- 로그 목록 페이지네이션/검색 추가
- 테스트 재정비

### 3순위

- 프론트 `app.js` 기능별 분리
- 게시판 기능 고도화
- 운영 메트릭/로깅 추가

---

## 17. 최종적으로 내가 결정해야 할 핵심 질문

1. 로그인은 실제 보안 경계가 되어야 하나, 내부망 편의 기능 수준이면 충분한가?
2. summary, 특이사항, manual fields를 계속 파일/문자열 기반으로 둘 것인가?
3. 로그 업로드/파싱을 동기 처리로 유지할 것인가?
4. 사이트/로그/게시판 삭제는 hard delete로 유지할 것인가?
5. 게시판은 단순 메모형으로 둘 것인가, 티켓형으로 키울 것인가?
6. 프론트는 현재 바닐라 JS를 유지할 것인가, 모듈화 또는 프레임워크 전환을 할 것인가?
7. PostgreSQL 전용 기능을 적극 사용해 운영 안정성을 높일 것인가?

---

## 18. 한 줄 결론

현재 시스템은 기능은 이미 충분히 많지만, "각 기능이 동작한다"와 "운영에 안전하게 유지된다" 사이의 간격이 아직 크다. `research2.md` 기준으로 보면, 다음 작업의 핵심은 기능 추가보다도 인증, 저장 구조, 마이그레이션, 테스트를 기능별 책임 단위로 다시 정리하는 것이다.
