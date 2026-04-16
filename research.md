# System Research

작성일: 2026-04-16  
기준 코드베이스: `/root/2026_project`

## 1. 문서 목적

이 문서는 현재 프로그램에 이미 구현되어 있는 기능과 구조를 코드 기준으로 다시 정리한 기술 문서다.  
앞으로 `v1.0` UI 정리 릴리즈와 `v1.1+` 기능 확장을 진행하기 전에, 지금 시스템이 무엇을 하는 프로그램인지, 어떤 흐름으로 동작하는지, 어디에 어떤 데이터가 저장되는지 한 번에 파악할 수 있도록 작성했다.

정리 범위:

- 프로그램의 목적
- 현재 구현된 기능
- 화면 구성과 사용자 흐름
- 백엔드 실행 구조
- API/서비스 동작 흐름
- 로그 업로드 및 summary 생성 방식
- DB 테이블과 데이터 구조
- 파일 저장 구조
- 운영/배포/테스트 구조

## 2. 프로그램 목적

이 프로그램은 NetApp 스토리지 장비 로그를 업로드하고, 그 로그를 요약(summary) 형태로 정리해서 운영자가 웹에서 확인할 수 있게 하는 내부 운영 콘솔이다.

단순 로그 보관 도구가 아니라 아래 업무를 한 화면에서 함께 처리하는 것이 목적이다.

- 스토리지별 사이트 등록 및 관리
- 사이트별 로그 업로드와 보관
- 원본 로그 조회 및 다운로드
- 로그에서 추출한 summary 확인
- summary 기반 장비 상태 파악
- 운영자가 직접 입력하는 수기 정보 관리
- 특이사항 이력 관리
- 수정 요청 게시판 운영
- 버그 모음 게시판 운영
- 회원 승인 및 관리자 제어

즉, 이 시스템의 성격은 "스토리지 운영 로그와 운영 메모, 사용자 작업 흐름을 같이 관리하는 내부 웹 운영 포털"이다.

## 3. 기술 스택과 실행 구조

### 3.1 백엔드

- FastAPI
- SQLAlchemy ORM
- PostgreSQL
- Pydantic payload schema
- Uvicorn 실행

### 3.2 프론트엔드

- 서버 템플릿 1장: `app/templates/index.html`
- 정적 CSS: `app/static/app.css`
- 바닐라 JavaScript 기반 SPA 스타일 화면 제어
- 상태 모듈:
  - `app/static/js/state.js`
  - `app/static/js/api.js`
  - `app/static/js/history.js`
  - `app/static/js/dom.js`
  - `app/static/js/utils.js`
  - `app/static/js/constants.js`

### 3.3 저장 방식

- 메타데이터: PostgreSQL
- 원본 로그 파일: `UPLOAD_DIR`
- 생성된 summary 텍스트 파일: `UPLOAD_DIR`

현재 구조는 DB와 파일 시스템을 함께 쓰는 혼합 저장 구조다.

## 4. 애플리케이션 실행 흐름

### 4.1 진입점

- 앱 생성: [app/app_factory.py](/root/2026_project/app/app_factory.py:1)
- 런타임 진입: [app/main.py](/root/2026_project/app/main.py:1)

`create_app()`에서 수행하는 일:

- FastAPI 앱 생성
- HTTP 요청 로깅 미들웨어 등록
- `/static` 정적 파일 마운트
- 웹/API 라우터 등록
- startup 이벤트 등록

### 4.2 startup 시 수행되는 작업

관련 파일:

- [app/core/lifecycle.py](/root/2026_project/app/core/lifecycle.py:1)

앱 시작 시 수행되는 핵심 작업:

- 서버 세션 식별자 생성 후 `app.state.server_session_id`에 보관
- DB 스키마 준비 상태 확인
- 필수 테이블 누락 시 앱 시작 실패
- 관리자 계정 자동 생성 또는 관리자 속성 보정

현재는 앱 시작 전에 `alembic upgrade head`가 끝나 있어야 정상 실행된다.

## 5. 라우터 구성

등록된 라우터:

- 웹/상태: [app/api/web_routes.py](/root/2026_project/app/api/web_routes.py:1)
- 인증: [app/api/auth_routes.py](/root/2026_project/app/api/auth_routes.py:1)
- 로그: [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- 사이트: [app/api/site_routes.py](/root/2026_project/app/api/site_routes.py:1)
- 게시판: [app/api/board_routes.py](/root/2026_project/app/api/board_routes.py:1)
- 관리자: [app/api/admin_routes.py](/root/2026_project/app/api/admin_routes.py:1)

## 6. 현재 구현된 기능

### 6.1 인증과 회원 관리

현재 구현 완료된 기능:

- 회원가입
- 로그인
- 로그아웃
- 현재 로그인 사용자 조회
- 비밀번호 변경
- 회원탈퇴
- 관리자 계정 자동 생성
- 관리자에 의한 사용자 승인/비활성화
- 관리자 전용 회원 목록 조회
- 활성 세션 목록 조회

동작 방식:

- 회원가입 직후 계정은 `is_active=False`, `approved_at=None` 상태로 생성
- 관리자가 승인하면 `is_active=True`와 `approved_at`이 설정됨
- 로그인 성공 시 서버는 세션 토큰을 발급하고 HttpOnly 쿠키에 저장
- 세션은 DB `user_sessions` 테이블에 저장됨
- 세션 유효시간은 24시간

권한 모델:

- `admin`: 회원 관리, 삭제 요청 처리, 사이트 관리 가능
- `user`: 일반 기능 사용 가능

### 6.2 사이트 관리

현재 구현 완료된 기능:

- 사이트 목록 조회
- 사이트 생성
- 사이트 수정
- 사이트 삭제

규칙:

- 스토리지는 `storage1`, `storage2`, `storage3`만 허용
- 같은 스토리지 안에서 사이트명 중복 불가
- 사이트에 업로드 로그가 연결되어 있으면 삭제 불가

### 6.3 로그 업로드와 관리

현재 구현 완료된 기능:

- 단일/다중 로그 파일 업로드
- 파일별 저장 이름 지정
- 스토리지 선택 후 업로드
- 사이트 선택 후 업로드
- 업로드 시 직접 입력 항목(manual fields) 함께 저장
- 업로드 직후 summary 자동 생성
- 로그 목록 조회
- 원본 로그 조회
- 원본 로그 다운로드
- 관리자 직접 로그 삭제
- 일반 사용자 로그 삭제 요청 등록
- 관리자 삭제 요청 승인/거부

업로드 실패 처리도 구현되어 있다.

- 빈 파일 업로드 차단
- 사이트/스토리지 불일치 차단
- DB 저장 실패 시 업로드된 파일 정리
- 파싱 실패 시 생성 파일 정리

### 6.4 summary 조회

현재 구현 완료된 기능:

- summary 원문 텍스트 조회
- 파싱된 overview 값 조회
- summary 주요 섹션 분리 조회
- 수동 입력값과 summary 값을 합쳐서 overview 표시

현재 제공되는 요약/섹션 범위:

- overview
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

### 6.5 manual fields와 특이사항

현재 구현 완료된 기능:

- 업로드 시 manual fields 입력
- summary 화면에서 manual fields 수정
- 특이사항 추가
- 기존 특이사항을 source로 참조하는 추가 메모 저장

manual fields 항목:

- 설치 날짜
- 워런티
- 유지보수
- 국사명
- 설치 상면
- 서비스
- 담당자(연락처)
- ID/PW
- ASUP
- maxraidsize, diskcount override

### 6.6 게시판

현재 구현 완료된 기능:

- 수정 요청 게시판 목록/등록/수정/삭제
- 요청 상태 관리: `대기`, `진행중`, `완료`
- 버그 모음 게시판 목록/등록/수정/삭제
- 작성자 이름 자동 기록
- 검색/필터 UI

### 6.7 관리자 운영 기능

현재 구현 완료된 기능:

- 활성 세션 목록 조회
- 사용자 활성/비활성 처리
- 로그 삭제 요청 목록 조회
- 로그 삭제 요청 승인/거부
- 무결성 점검 리포트 제공
- 헬스 체크 제공

관련 엔드포인트:

- `/health`
- `/admin/sessions`
- `/admin/deletion-requests`
- `/admin/operations/integrity`

## 7. 프론트엔드 화면 구조

기본 화면은 단일 HTML 안에서 페이지를 전환하는 구조다.

주요 페이지:

- `dashboard`
- `storage1`
- `storage2`
- `storage3`
- `members`
- `bugs`
- `requests`

UI 특징:

- 로그인 화면과 앱 화면을 토글
- 좌측 사이드바 네비게이션
- 대시보드 업로드 카드
- 스토리지별 사이트/로그 탐색 화면
- 데스크톱 로그 split-view 지원
- 회원/세션/삭제 요청 관리자 페이지
- 브라우저 뒤로가기와 내부 상태 동기화

프론트 상태는 `app/static/js/state.js`에서 초기화된다.

저장되는 주요 상태:

- 전체 로그 목록
- 사이트 목록
- 요청 게시글 목록
- 버그 게시글 목록
- 사용자 목록
- 활성 세션 목록
- 삭제 요청 목록
- 현재 페이지
- 현재 로그인 사용자
- 스토리지별 선택 사이트
- 스토리지별 raw/summary 선택 상태
- summary 활성 섹션
- 이벤트 로그 필터
- 현재 수동 입력값

## 8. 상세 동작 흐름

### 8.1 로그인 흐름

1. 사용자가 `/` 접속
2. `index.html`과 정적 JS/CSS 로드
3. 프론트가 `/auth/me`로 현재 쿠키 세션 확인
4. 로그인 화면에서 `/auth/login` 호출
5. 서버가 세션 생성 후 쿠키 발급
6. 프론트가 사용자 정보 기준으로 앱 화면 오픈

### 8.2 회원가입과 승인 흐름

1. 사용자가 `/auth/register` 호출
2. 계정은 비활성 상태로 생성
3. 관리자가 회원 목록에서 활성화
4. 승인 후 로그인 가능

### 8.3 로그 업로드 흐름

1. 대시보드에서 스토리지와 사이트 선택
2. 파일 선택 후 파일별 저장 이름 입력
3. 필요 시 직접 입력 항목 입력
4. 프론트가 `multipart/form-data`로 `/upload` 호출
5. 서버가 파일명 정규화 및 중복 없는 저장명 생성
6. 서버가 원본 파일을 `UPLOAD_DIR`에 저장
7. 파일 바이트를 텍스트로 디코딩
8. NetApp 파서가 summary 데이터 추출
9. summary 텍스트 파일 생성
10. DB에 `uploaded_logs` 메타데이터 저장
11. 프론트가 최신 로그/summary를 다시 불러와 화면 갱신

### 8.4 summary 조회 흐름

1. 사용자가 특정 로그의 summary 보기 선택
2. 프론트가 `/logs/{id}/summary` 호출
3. 서버가 summary 텍스트 파일 읽기
4. summary key-value 파싱
5. 원본 로그에서 섹션별 텍스트 재추출
6. manual fields와 합쳐 화면용 overview 구성
7. overview, raw summary text, section contents를 함께 반환

### 8.5 삭제 요청 흐름

1. 일반 사용자가 특정 로그에 대해 삭제 요청 생성
2. 요청은 `deletion_requests` 테이블에 `pending`으로 저장
3. 관리자가 요청 목록 확인
4. 승인 시 실제 로그 삭제 수행
5. DB 메타데이터 삭제 후 원본 로그/summary 파일 정리
6. 요청 상태를 `executed` 또는 `rejected`로 마감

## 9. 데이터 구조

모델 정의 파일:

- [app/models.py](/root/2026_project/app/models.py:1)

### 9.1 `storage_sites`

용도:

- 스토리지별 사이트 관리

주요 컬럼:

- `id`
- `storage_name`
- `name`
- `created_at`
- `updated_at`

### 9.2 `uploaded_logs`

용도:

- 업로드 로그 메타데이터와 summary 경로 저장

주요 컬럼:

- `id`
- `filename`
- `stored_path`
- `summary_path`
- `content_type`
- `size`
- `status`
- `storage_name`
- `site_id`
- `manual_fields_json`
- `note`
- `created_at`

실제 raw log 본문과 summary 본문은 DB가 아니라 파일로 저장된다.

### 9.3 `users`

용도:

- 사용자 계정 저장

주요 컬럼:

- `id`
- `username`
- `password_hash`
- `full_name`
- `role`
- `is_active`
- `approved_at`
- `created_at`

### 9.4 `user_sessions`

용도:

- 로그인 세션 추적

주요 컬럼:

- `id`
- `user_id`
- `session_token_hash`
- `ip_address`
- `user_agent`
- `created_at`
- `expires_at`
- `last_seen_at`

### 9.5 `request_posts`

용도:

- 수정 요청 게시판

주요 컬럼:

- `id`
- `title`
- `content`
- `status`
- `author`
- `created_at`
- `updated_at`

### 9.6 `bug_posts`

용도:

- 버그 모음 게시판

주요 컬럼:

- `id`
- `title`
- `content`
- `author`
- `created_at`
- `updated_at`

### 9.7 `deletion_requests`

용도:

- 로그 삭제 승인 워크플로우 저장

주요 컬럼:

- `id`
- `target_type`
- `target_id`
- `target_label`
- `requester_user_id`
- `requester_name`
- `reason`
- `status`
- `review_comment`
- `reviewed_by_user_id`
- `reviewed_by_name`
- `created_at`
- `reviewed_at`
- `executed_at`

## 10. 파일 저장 구조

관련 파일:

- [app/core/paths.py](/root/2026_project/app/core/paths.py:1)

파일 시스템에 저장되는 것:

- 업로드 원본 로그 파일
- 생성된 summary 텍스트 파일

동작 규칙:

- 업로드 파일명은 정규화
- 같은 이름이 있으면 `(1)`, `(2)` 형태로 충돌 회피
- summary 파일은 원본 파일명 기준 `_summary.txt` 생성
- DB에는 raw/summary 경로를 문자열로 저장

## 11. NetApp 파싱 구조

관련 파일:

- [app/parser_netapp.py](/root/2026_project/app/parser_netapp.py:1)

현재 파서가 추출하는 대표 정보:

- vendor
- hostname
- model_name
- ontap_version
- sp_ip_version
- mgmt
- shelf_count
- disk_count
- spare_count
- used_protocols
- snapmirror_in_use
- expansion_slots
- aggr_diskcount_maxraidsize
- volume_count
- lun_count
- controller_serial

추가로 원본 로그에서 아래 섹션을 다시 잘라서 summary 상세 탭에 사용한다.

- Shelf
- Disk
- FCP
- Network Interface
- Network Port
- Volume
- LUN
- Snapmirror
- Event log

## 12. 운영/배포 구조

관련 파일:

- [deploy/run.sh](/root/2026_project/deploy/run.sh:1)
- [deploy/build_release.sh](/root/2026_project/deploy/build_release.sh:1)

기본 실행 개념:

- `.env` 로드
- `UPLOAD_DIR` 준비
- 가상환경 준비
- 의존성 설치
- Uvicorn 실행

운영 전제:

- PostgreSQL 접속 가능
- Alembic migration 적용 완료
- 업로드 디렉토리 쓰기 가능

## 13. 테스트 구조

테스트 디렉토리:

- `tests/test_auth.py`
- `tests/test_admin.py`
- `tests/test_boards.py`
- `tests/test_logs.py`
- `tests/test_sites.py`
- `tests/test_operations.py`
- `tests/test_parser_netapp.py`

현재 테스트가 검증하는 대표 범위:

- 로그인/회원가입/승인 흐름
- 관리자 권한
- 사이트 생성/수정/삭제
- 로그 업로드/summary 생성
- 업로드 실패 시 정리 동작
- 삭제 요청 승인 흐름
- 게시판 CRUD
- health/integrity 동작
- NetApp 파서 주요 추출 결과

## 14. 현재 시스템 요약

현재 프로그램은 이미 아래 범위를 수행할 수 있다.

- 인증과 관리자 승인 기반 사용자 운영
- 스토리지/사이트 관리
- 로그 업로드와 summary 생성
- 원본/요약 로그 탐색
- 수기 정보와 특이사항 저장
- 수정 요청 게시판
- 버그 모음 게시판
- 삭제 요청 승인 워크플로우
- 운영 점검용 health/integrity 기능

즉, 현재 버전은 "운영용 기본 뼈대와 실사용 핵심 기능은 이미 갖춰진 상태"이며, 다음 단계는 UI 완성도 개선과 기능 확장이다.
