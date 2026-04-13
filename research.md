# System Research

작성일: 2026-04-13  
기준 코드베이스: `/root/2026_project` 현재 워크트리 기준  
분석 방식: 로컬 코드 정적 분석, 실행 스크립트/테스트/프론트 소스 검토  

현재 설정 기준:

- 실제 해석 기준은 [\.env](/root/2026_project/.env:1) 이다.
- 현재 `DATABASE_URL`은 `postgresql+psycopg://...` 이므로 사용 DB는 PostgreSQL이다.
- 현재 `UPLOAD_DIR`은 `upload` 이므로 업로드/summary 파일 경로 기준은 `upload/` 이다.
- 운영 기준에서는 SQLite를 사용하지 않는 전제로 보는 것이 맞다.

## 1. 작업 목표

이 문서는 현재 시스템이 어떻게 동작하는지, 어떤 구조적 제약과 운영 리스크가 있는지, 앞으로 어떤 방향으로 개선하면 좋은지를 한 번에 파악하기 위한 기술 조사 문서다.

중점적으로 정리한 범위:

- 시스템 목적과 사용자 흐름
- 백엔드/프론트엔드 구조
- 실행 및 배포 방식
- DB 및 데이터 구조
- 로그 업로드 및 summary 생성 흐름
- 외부 의존성
- 현재 문제점, 병목, 리스크
- 개선 우선순위

## 2. 한 줄 요약

현재 시스템은 `FastAPI + SQLAlchemy + 단일 HTML/JS 프론트엔드 + 로컬 파일 업로드/파싱` 구조의 운영 도구다. 기능은 이미 꽤 많지만, 인증/권한/트랜잭션/마이그레이션/테스트 체계가 얕고, 업로드 파일과 파생 summary를 파일 시스템에 직접 의존하는 구조라서 운영 규모가 커질수록 안정성과 유지보수 비용이 빠르게 올라갈 가능성이 크다.

## 3. 현재 시스템의 역할

이 시스템은 크게 아래 기능을 제공한다.

- 사용자의 로그인/회원가입/회원탈퇴
- 스토리지별 사이트 관리
- NetApp 로그 파일 업로드
- 업로드된 로그의 원본 조회 및 다운로드
- 업로드 로그에서 summary 추출 및 표시
- summary 기반 세부 섹션 조회
- 수동 입력 필드 저장
- 특이사항 이력 저장
- 수정 요청 게시판
- 버그 기록 게시판

실질적으로는 "스토리지 운영 현황 관리용 내부 웹 콘솔"에 가깝다.

## 4. 전체 아키텍처 개요

### 4.1 런타임 구조

- 웹 서버: FastAPI
- ASGI 서버: Uvicorn
- ORM: SQLAlchemy 2.x 스타일
- 설정 로딩: `pydantic-settings`
- 프론트엔드: 서버 렌더링 없이 정적 `index.html + app.js + app.css`
- 저장소:
  - 메타데이터: RDB
  - 원본 로그/summary 파일: 로컬 파일 시스템 `upload/`

### 4.2 진입점

- 앱 엔트리: [app/main.py](/root/2026_project/app/main.py:1)
- 앱 생성: [app/app_factory.py](/root/2026_project/app/app_factory.py:1)

`create_app()`에서 하는 일:

- FastAPI 애플리케이션 생성
- `/static` 정적 파일 마운트
- 라우터 등록
- startup 핸들러 등록

### 4.3 등록된 라우터

- 웹/헬스: [app/api/web_routes.py](/root/2026_project/app/api/web_routes.py:1)
- 인증/회원: [app/api/auth_routes.py](/root/2026_project/app/api/auth_routes.py:1)
- 로그/업로드: [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- 사이트 관리: [app/api/site_routes.py](/root/2026_project/app/api/site_routes.py:1)
- 게시판: [app/api/board_routes.py](/root/2026_project/app/api/board_routes.py:1)

## 5. 현재 동작 요약

### 5.1 사용자가 보는 주요 흐름

1. 브라우저에서 `/` 접속
2. [app/templates/index.html](/root/2026_project/app/templates/index.html:1) 로드
3. [app/static/app.js](/root/2026_project/app/static/app.js:1) 가 로그인/세션 복원 시도
4. 로그인 성공 시 대시보드와 스토리지/회원/버그/요청 화면 사용
5. 사용자가 파일 업로드 시 `/upload` 호출
6. 서버는 원본 파일 저장, 텍스트 디코딩, NetApp 파싱, summary 파일 생성, DB 메타데이터 저장
7. 프론트는 `/logs`, `/logs/{id}/raw`, `/logs/{id}/summary` 등을 호출해 목록/상세를 렌더링

### 5.2 데이터 저장 방식

- DB에는 메타데이터만 저장
  - 파일명
  - 저장 경로
  - storage/site 식별자
  - manual fields JSON
  - 특이사항 JSON
- 원본 로그와 summary 본문은 파일 시스템에 저장

즉, "DB + 파일 시스템 혼합 저장소" 구조다.

## 6. 현재 동작 상세

## 6.1 앱 시작 시 일어나는 일

관련 파일:

- [app/core/lifecycle.py](/root/2026_project/app/core/lifecycle.py:1)
- [app/db.py](/root/2026_project/app/db.py:1)
- [app/config.py](/root/2026_project/app/config.py:1)
- [app/core/constants.py](/root/2026_project/app/core/constants.py:1)

startup 시 처리:

- 앱별 `server_session_id` 생성 후 `app.state`에 저장
- `Base.metadata.create_all(bind=engine)` 수행
- `uploaded_logs` 테이블에 일부 컬럼이 없으면 런타임에서 `ALTER TABLE` 수행
- 관리자 계정 자동 생성 또는 비밀번호/이름 갱신

이 구조의 특징:

- 별도 마이그레이션 실행 없이도 앱이 어느 정도 스스로 스키마를 맞춘다.
- 대신 스키마 관리가 코드 내부에 분산되고, 변경 이력 추적성이 약하다.

## 6.2 프론트엔드 동작 방식

관련 파일:

- [app/templates/index.html](/root/2026_project/app/templates/index.html:1)
- [app/static/app.js](/root/2026_project/app/static/app.js:1)
- [app/static/app.css](/root/2026_project/app/static/app.css:1)

특징:

- React/Vue 같은 프레임워크 없이 바닐라 JS 단일 파일로 상태 관리
- 로그인 화면과 앱 화면을 `hidden` 토글로 전환
- 스토리지별 상태는 `storageState` 객체에 보관
- 최근 변경으로 브라우저 `history.pushState/popstate` 기반 내부 상태 복원 로직이 추가됨
- 데스크톱에서는 로그 목록과 상세를 함께 보는 split-view 구조를 지원

프론트 상태 예시:

- 현재 페이지
- 선택된 스토리지
- 선택된 사이트
- 원본/요약 탭
- 선택된 로그 ID
- 요약 섹션 탭
- 이벤트 로그 필터

즉, 프론트는 "서버에서 JSON 받아서 DOM 직접 갱신"하는 형태다.

## 6.3 인증과 세션 모델

관련 파일:

- [app/services/auth_service.py](/root/2026_project/app/services/auth_service.py:1)
- [app/auth.py](/root/2026_project/app/auth.py:1)
- [app/api/auth_routes.py](/root/2026_project/app/api/auth_routes.py:1)
- [app/static/app.js](/root/2026_project/app/static/app.js:1)

현재 인증 방식:

- 사용자 정보는 `users` 테이블에 저장
- 비밀번호는 PBKDF2-SHA256 해시
- 로그인 성공 시 서버가 토큰이나 쿠키를 발급하지 않음
- 대신 프론트가 아래 값을 `localStorage`에 저장
  - username
  - display name
  - login date
  - server session id

세션 검증 방식:

- 프론트가 `/api` 호출
- 서버의 `server_session_id`가 로컬 저장 값과 같은지 비교
- 날짜가 바뀌면 세션 만료 처리

중요한 의미:

- 실질적인 서버 세션/토큰 인증이 아니라 "프론트 로컬 상태 기반 로그인 UX"에 가깝다.
- 대부분의 API는 로그인 여부를 서버에서 강제하지 않는다.
- 인증은 화면 접근 제어 수준이고, 보안 경계로 보기 어렵다.

## 6.4 사이트 관리

관련 파일:

- [app/services/site_service.py](/root/2026_project/app/services/site_service.py:1)

동작:

- `storage1`, `storage2`, `storage3` 중 하나를 선택해 사이트 생성
- 같은 스토리지 내 중복 사이트명 방지
- 사이트 삭제 시 연결된 로그가 있으면 삭제 불가

특징:

- 외래키 제약보다는 서비스 로직으로 무결성을 관리
- `uploaded_logs.site_id`와 `storage_sites.id` 관계는 사실상 논리적 참조

## 6.5 로그 업로드와 summary 생성

관련 파일:

- [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:1)
- [app/parser_netapp.py](/root/2026_project/app/parser_netapp.py:1)

업로드 흐름:

1. 프론트가 `multipart/form-data`로 `/upload` 호출
2. 서버가 업로드 파일 목록과 save name 목록 정합성 검증
3. 파일명 정규화
4. `upload/` 내 유니크 파일명 확보
5. 원본 파일 저장
6. 바이트를 텍스트로 디코딩
7. NetApp 로그 파싱
8. summary 텍스트 파일 생성
9. `uploaded_logs` 레코드 생성

업로드 시 저장되는 데이터:

- 원본 파일: `upload/<filename>`
- summary 파일: `upload/<stem>_summary.txt`
- DB 행: 파일 메타데이터 + manual fields JSON

현재 구현 특징:

- 업로드와 파싱, 파일 쓰기, DB 저장이 한 함수 흐름 안에 강하게 결합되어 있다.
- summary는 DB가 아니라 별도 텍스트 파일로 저장된다.

## 6.6 summary 조회

관련 파일:

- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:311)
- [app/parser_netapp.py](/root/2026_project/app/parser_netapp.py:1)

조회 시 처리:

- summary 파일 읽기
- key:value 줄 단위로 파싱
- `cluster_name`은 프론트 표시에선 `hostname`으로 치환
- manual fields를 함께 merge
- 원본 로그로부터 섹션별 텍스트 추출
- `특이사항`은 DB note JSON을 파싱해 함께 반환

즉, 업로드 시 한 번 파싱하고 끝나는 게 아니라, 조회 시에도 일부 재가공이 계속 일어난다.

## 6.7 특이사항과 수동 입력

특이사항:

- `uploaded_logs.note` 컬럼에 JSON 문자열 저장
- 항목 구조:
  - id
  - content
  - author
  - created_at
  - source_note_id

수동 입력:

- `uploaded_logs.manual_fields_json` 컬럼에 JSON 문자열 저장
- summary 화면에서 표시값과 결합

장점:

- 빠르게 기능 추가 가능

단점:

- JSON 내부 구조를 DB 레벨에서 질의/검증하기 어렵다
- 스키마 진화가 어려워진다

## 6.8 게시판 기능

관련 파일:

- [app/services/board_service.py](/root/2026_project/app/services/board_service.py:1)

구성:

- 수정 요청 게시판 `request_posts`
- 버그 기록 게시판 `bug_posts`

특징:

- CRUD만 존재
- 작성자 권한/수정 권한/감사 로그 없음
- 상태 흐름은 `대기`, `진행중`, `완료` 3개 고정

## 7. 관련 파일/디렉토리

### 7.1 핵심 디렉토리

- `app/`
  - 애플리케이션 코드 전체
- `app/api/`
  - HTTP 라우터
- `app/services/`
  - 비즈니스 로직
- `app/static/`
  - 프론트 JS/CSS/이미지
- `app/templates/`
  - 단일 HTML 템플릿
- `deploy/`
  - 실행/배포 스크립트
- `tests/`
  - 테스트 코드
- `alembic/`
  - Alembic 기본 골격만 존재

### 7.2 핵심 파일

- [app/main.py](/root/2026_project/app/main.py:1): 앱 엔트리
- [app/app_factory.py](/root/2026_project/app/app_factory.py:1): 앱 조립
- [app/db.py](/root/2026_project/app/db.py:1): DB 엔진/세션
- [app/models.py](/root/2026_project/app/models.py:1): ORM 모델
- [app/parser_netapp.py](/root/2026_project/app/parser_netapp.py:1): NetApp 로그 파서
- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:1): 로그 핵심 로직
- [app/static/app.js](/root/2026_project/app/static/app.js:1): 프론트 상태/렌더링/이벤트 처리
- [deploy/run.sh](/root/2026_project/deploy/run.sh:1): 실행 스크립트
- [deploy/build_release.sh](/root/2026_project/deploy/build_release.sh:1): 릴리스 패키징

## 8. 실행 흐름

## 8.1 서버 실행 흐름

1. `bash deploy/run.sh`
2. `.env` 없으면 `deploy/.env.example` 복사
3. `.env`를 먼저 읽고, `UPLOAD_DIR` 디렉토리를 생성
4. `vendor/` 있으면 vendor 우선 사용
5. 없으면 `.venv` 생성 후 `requirements.txt` 설치
6. 환경변수 로드
7. `uvicorn app.main:app` 실행

관련 파일:

- [deploy/run.sh](/root/2026_project/deploy/run.sh:1)
- [deploy/.env.example](/root/2026_project/deploy/.env.example:1)

## 8.2 페이지 접속 흐름

1. `GET /`
2. 서버가 정적 `index.html` 반환
3. 브라우저가 `app.css`, `app.js` 로드
4. JS가 로컬 세션 복원 시도
5. 성공 시 초기 데이터 로딩
6. 아래 API 다수를 호출
   - `/sites`
   - `/logs`
   - `/requests`
   - `/bugs`
   - `/users`

## 8.3 로그 업로드 흐름

1. 사용자가 업로드 폼 제출
2. `storage_name`, `site_id`, `manual_fields_json`, 파일 목록 전송
3. 서버가 스토리지/사이트 유효성 확인
4. 파일 저장
5. NetApp summary 생성
6. DB 저장
7. 프론트가 로그 목록 재조회
8. 선택 스토리지 페이지로 이동

## 8.4 로그 조회 흐름

원본 조회:

1. `/logs`
2. 특정 로그 선택
3. `/logs/{id}/raw`
4. 원본 파일 읽어서 그대로 텍스트 응답

summary 조회:

1. `/logs/{id}/summary`
2. summary 파일 읽기
3. 원본 파일도 다시 읽기
4. summary, manual fields, 섹션 텍스트, 특이사항을 합성
5. 프론트가 overview/section UI로 렌더링

## 9. 데이터 구조와 DB 구조

## 9.1 설정 값

관련 파일: [app/config.py](/root/2026_project/app/config.py:1)

환경변수:

- `APP_NAME`
- `APP_ENV`
- `DATABASE_URL`
- `UPLOAD_DIR`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_FULL_NAME`
- `HOST`
- `PORT`

현재 워크스페이스의 [\.env](/root/2026_project/.env:1) 는 PostgreSQL 기준 설정이다. 예시 파일과 실행 스크립트도 이 기준과 맞아야 한다.

## 9.2 ORM 테이블

관련 파일: [app/models.py](/root/2026_project/app/models.py:1)

### `storage_sites`

- `id`
- `storage_name`
- `name`
- `created_at`
- `updated_at`

의미:

- 스토리지별 논리 사이트 정의

### `uploaded_logs`

- `id`
- `filename`
- `stored_path`
- `content_type`
- `size`
- `status`
- `storage_name`
- `site_id`
- `manual_fields_json`
- `note`
- `created_at`

의미:

- 업로드 파일 메타데이터 및 부가정보

주의점:

- summary 자체는 컬럼이 아니라 파일 시스템에 존재
- `site_id`는 외래키 선언이 없음
- `note`, `manual_fields_json`은 JSON 문자열

### `users`

- `id`
- `username`
- `password_hash`
- `full_name`
- `is_active`
- `created_at`

### `request_posts`

- `id`
- `title`
- `content`
- `status`
- `author`
- `created_at`
- `updated_at`

### `bug_posts`

- `id`
- `title`
- `content`
- `author`
- `created_at`
- `updated_at`

## 9.3 파서 출력 구조

관련 파일: [app/parser_netapp.py](/root/2026_project/app/parser_netapp.py:1)

`parse_netapp_log()`는 아래 키를 반환한다.

- `vendor`
- `hostname`
- `model_name`
- `ontap_version`
- `sp_ip_version`
- `mgmt`
- `shelf_count`
- `disk_count`
- `spare_count`
- `used_protocols`
- `snapmirror_in_use`
- `expansion_slots`
- `aggr_diskcount_maxraidsize`
- `volume_count`
- `lun_count`
- `controller_serial`

summary 파일은 이 값을 줄 단위 텍스트로 저장한다.

예:

```text
vendor: NetApp
hostname: mycluster
model_name: FAS2750
...
```

## 9.4 프론트 상태 구조

관련 파일: [app/static/app.js](/root/2026_project/app/static/app.js:1)

핵심 전역 상태:

- `allLogs`
- `allSites`
- `allRequestPosts`
- `allBugPosts`
- `allUsers`
- `storageState[storageKey]`

`storageState` 내부 주요 필드:

- `rawId`
- `summaryId`
- `activeSiteId`
- `activeView`
- `activeLogView`
- `activeSummarySection`
- `activeEventLogFilter`
- `currentSummarySections`
- `currentSpecialNotes`
- `currentManualFields`

## 10. 외부 의존성

관련 파일:

- [requirements.txt](/root/2026_project/requirements.txt:1)
- [requirements-dev.txt](/root/2026_project/requirements-dev.txt:1)

런타임 의존성:

- `fastapi`
- `uvicorn[standard]`
- `sqlalchemy`
- `psycopg[binary]`
- `pydantic`
- `pydantic-settings`
- `python-multipart`

개발 의존성:

- `pytest`

추가 외부 요소:

- Python 3
- 로컬 파일 시스템 쓰기 권한
- PostgreSQL
- Google Fonts
  - [app/static/app.css](/root/2026_project/app/static/app.css:1) 에서 원격 폰트 import 사용

의미:

- 인터넷이 막힌 서버에서는 폰트 로딩이 실패할 수 있다.
- `vendor/` 패키지 포함 배포는 오프라인 설치를 보완한다.

## 11. 제약 조건

### 11.1 구조적 제약

- 프론트가 단일 `app.js`에 과도하게 집중
- 로그 처리 로직이 `log_service.py`에 집중
- parser가 정규식 기반이라 입력 포맷 변화에 취약
- summary가 파일 시스템에만 존재
- 인증이 실질적인 서버 권한 모델이 아님

### 11.2 운영 제약

- 단일 프로세스/단일 인스턴스 가정이 강함
- 로컬 디스크 의존성이 큼
- 파일 경로와 DB 레코드 정합성이 깨질 수 있음
- 스키마 변경 관리 체계가 약함

### 11.3 테스트 제약

현재 테스트 파일 [tests/test_upload_summary.py](/root/2026_project/tests/test_upload_summary.py:1) 는 현행 코드와 불일치하는 흔적이 많다.

추가로, 이 테스트 파일에는 과거 SQLite 기반 테스트 설정 흔적도 남아 있다. 현재 운영 기준과 테스트 기준이 분리되어 있다는 뜻이므로, 테스트를 다시 살릴 때도 PostgreSQL 기준으로 재정비하는 것이 맞다.

예시:

- `main_module.upload_log(...)` 직접 호출을 기대하지만 현재 공개 엔트리 구조와 맞지 않음
- `parse_netapp_log()` 결과에서 `cluster_name`을 기대하지만 현재 코드는 `hostname` 사용
- 템플릿 JS 버전 문자열도 현재 파일과 맞지 않음
- 업로드 함수 시그니처에서 `site_id`가 필요한 현재 구현과 맞지 않음

즉, 테스트는 사실상 신뢰 가능한 회귀 방어막 역할을 못 하고 있을 가능성이 높다.

## 12. 문제점과 병목

## 12.1 인증/권한 모델이 약함

가장 큰 문제 중 하나다.

- 로그인해도 서버가 세션 쿠키/JWT를 검증하지 않음
- 대부분 API가 인증 없이 호출 가능
- 사용자별 권한 구분 없음
- 게시글/버그/로그 삭제 권한 제한 없음

운영 의미:

- 내부망 도구라 해도 보안 경계가 약하다
- "로그인 UI가 있다"와 "보호된 시스템이다"는 현재 동일하지 않다

## 12.2 파일 시스템과 DB의 원자성 부족

업로드 시:

- 파일 저장
- summary 생성
- DB 저장

삭제 시:

- 파일 삭제
- summary 삭제
- DB 삭제

이 순서가 트랜잭션으로 묶여 있지 않다.

가능한 문제:

- 파일은 있는데 DB는 없는 상태
- DB는 있는데 파일은 없는 상태
- 원본 삭제는 됐지만 summary는 남는 상태
- summary 생성 실패 후 일부 상태만 남는 경우

## 12.3 summary를 파일명 규칙으로 역추적

[app/services/log_service.py](/root/2026_project/app/services/log_service.py:278) 기준으로 summary 파일은 `<stem>_summary.txt` 규칙에 기대고 있다.

문제:

- summary 파일 경로를 DB에 정규 저장하지 않음
- 파일명 규칙이 바뀌면 과거 데이터와 호환성 문제가 생김
- 파일 시스템 정리 시 orphan 파일 관리가 어려움

## 12.4 파서가 규칙 기반 정규식에 강하게 의존

관련 파일: [app/parser_netapp.py](/root/2026_project/app/parser_netapp.py:1)

문제:

- 로그 형식이 조금만 달라져도 추출 실패 가능
- 다른 ONTAP 버전/언어/포맷 변형 대응이 어려움
- 일부 추출은 헤더/표 구조 전제에 강하게 묶여 있음
- 에러가 나도 부분 추출 실패가 조용히 지나갈 수 있음

즉, 파서 안정성이 제품 품질을 좌우하는데, 현재는 관측성과 회귀 검증이 부족하다.

## 12.5 런타임 스키마 변경 방식

관련 파일: [app/core/lifecycle.py](/root/2026_project/app/core/lifecycle.py:1)

현재는 앱 시작 때 컬럼이 없으면 직접 `ALTER TABLE` 한다.

문제:

- 마이그레이션 이력이 남지 않음
- 복잡한 스키마 변경에는 대응이 어려움
- 다중 인스턴스 환경에서 경쟁 상태 가능
- 실제 Alembic 디렉토리가 있지만 거의 비어 있음

즉, "마이그레이션 도구 골격은 있으나 실사용은 런타임 핫픽스" 상태다.

## 12.6 프론트엔드 유지보수성 저하

[app/static/app.js](/root/2026_project/app/static/app.js:1) 하나에 다음이 몰려 있다.

- 로그인
- 회원 관리
- 업로드
- 스토리지 페이지 렌더링
- 게시판 렌더링
- 모달 관리
- history 상태 관리

문제:

- 기능 추가 시 회귀 가능성 증가
- 상태 변경 포인트가 너무 많음
- DOM 기반 렌더링이라 추적이 어려움

## 12.7 성능 병목 가능성

현재 규모에서는 크게 문제 없을 수 있지만, 아래 지점은 병목이 될 수 있다.

- 큰 로그 파일을 매 조회마다 디스크에서 읽음
- summary 조회 시 summary 파일과 원본 파일을 모두 다시 읽음
- 원본 전체 텍스트를 그대로 브라우저로 내려줌
- 로그 목록, 게시판 목록 등에 페이지네이션 없음
- `/logs` 전체 목록을 한 번에 불러옴

## 13. 리스크

## 13.1 보안 리스크

심각도: 높음

- 서버 측 인증/인가 부재
- API 보호 미흡
- 관리자 계정 기본값 존재
- `.env.example` 기본 관리자 비밀번호가 약함
- 로컬 스토리지 세션 방식은 변조 가능성이 큼

## 13.2 데이터 정합성 리스크

심각도: 높음

- 파일 시스템과 DB 간 불일치 가능
- JSON 문자열 필드의 구조 일관성 보장 약함
- foreign key 미사용

## 13.3 운영 리스크

심각도: 중간~높음

- 다중 서버/컨테이너 스케일아웃 부적합
- 공유 스토리지 없으면 파일 일관성 깨짐
- startup 시 스키마 변경 로직 의존

## 13.4 품질 리스크

심각도: 높음

- 테스트 코드가 현재 코드와 어긋나 있을 가능성 큼
- 실제 회귀 테스트 안전망 약함
- 파서 변경 시 예상치 못한 데이터 왜곡 가능

## 13.5 사용자 경험 리스크

심각도: 중간

- 원본 로그/summary가 커지면 렌더링 지연
- 페이지네이션/검색/정렬 부재
- 게시판/로그 권한 모델이 없어 협업 충돌 가능

## 14. 앞으로 개선할 만한 방향

## 14.1 1순위: 보안 경계 정리

가장 먼저 추천하는 개선이다.

- 서버 측 인증 도입
  - 세션 쿠키 또는 JWT
- API별 인증 의존성 추가
- 역할 기반 권한
  - 일반 사용자
  - 운영자
  - 관리자
- 게시글/버그/사이트/로그 삭제 권한 분리
- 관리자 기본 비밀번호 강제 변경 또는 초기화 절차 도입

## 14.2 2순위: 저장 구조 안정화

- `uploaded_logs`에 summary 파일 경로 명시 저장
- 가능하면 summary를 DB에도 일부 캐시
- 파일 저장/DB 저장을 명시적 작업 단위로 정리
- orphan 파일 점검용 정리 스크립트 추가
- 삭제 실패 시 복구/재시도 전략 추가

## 14.3 3순위: 마이그레이션 체계 정상화

- Alembic 실제 사용 시작
- `target_metadata` 연결
- 스키마 변경은 migration revision으로 관리
- startup의 `ALTER TABLE` 보정 로직은 점진 제거

## 14.4 4순위: 파서 신뢰성 강화

- 다양한 샘플 로그 fixture 확보
- 파서 함수별 단위 테스트 작성
- 파싱 실패/누락 필드 로깅
- summary 생성 시 품질 점수나 누락 필드 목록 저장
- 로그 포맷 버전별 파서 분리 검토

## 14.5 5순위: 프론트 구조 분리

- `app.js`를 기능별 모듈로 분리
  - auth
  - logs
  - sites
  - boards
  - ui/history
- API 호출 래퍼 공통화
- DOM 선택자/렌더 함수 분리
- 장기적으로는 작은 SPA 구조 도입 검토

## 14.6 6순위: 운영 UX 개선

- 로그 목록 검색/정렬/필터
- 페이지네이션 또는 무한 스크롤
- 큰 파일 미리보기 제한
- summary 비교 보기
- 업로드 진행 상태/실패 리포트
- 게시판 댓글/첨부/이력

## 14.7 7순위: 관측성 추가

- 구조화 로그
- 업로드/파싱 실패 로그
- health check 확장
- 메트릭
  - 업로드 수
  - 파싱 성공률
  - 평균 파일 크기
  - API 응답 시간

## 15. 추천 우선순위 로드맵

### 단기

- 서버 인증/인가 추가
- 관리자 계정/비밀번호 정책 정리
- 테스트 깨진 부분 정리
- 파서 핵심 케이스 fixture 기반 테스트 보강
- summary 경로를 DB에 명시 저장

### 중기

- Alembic 마이그레이션 정착
- 파일/DB 정합성 복구 도구 추가
- 프론트 JS 모듈화
- 로그 목록 검색/정렬/페이지네이션

### 장기

- 비동기 작업 큐 기반 업로드/파싱 분리
- 오브젝트 스토리지 또는 공유 스토리지 도입
- 역할/감사 로그/운영 메트릭 강화
- 멀티 인스턴스 배포 가능 구조로 전환

## 16. 즉시 확인이 필요한 항목

실제 운영 전에 우선 확인하면 좋은 체크리스트다.

1. 현재 운영 PostgreSQL 인스턴스의 백업/복구 정책이 있는지
2. 실제 업로드 로그 평균 크기와 최대 크기
3. 동시에 사용하는 사용자 수
4. API가 내부망에서만 접근 가능한지
5. 현재 테스트가 CI에서 실제로 도는지
6. 운영 서버에서 `upload/` 백업 정책이 있는지
7. summary 파일 유실 사례가 있었는지
8. 관리자 계정이 기본값 그대로 배포된 적이 있는지

## 17. 결론

이 시스템은 이미 내부 운영 도구로서 충분한 기능 밀도를 가지고 있다. 다만 현재는 "빠르게 성장한 단일 프로세스형 내부 도구"의 전형적인 상태에 가깝고, 특히 인증/권한, 파일-DB 정합성, 마이그레이션, 테스트, 파서 검증 체계가 다음 단계의 핵심 과제다.

가장 먼저 손대야 할 축은 아래 3개다.

- 서버 측 인증/인가 강화
- 저장 구조와 스키마 관리 안정화
- 테스트 및 파서 회귀 검증 체계 복구

이 3개만 정리해도, 이후 UX 개선이나 기능 확장이 훨씬 안전해질 가능성이 크다.
