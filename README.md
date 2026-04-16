# netapp_automation

NetApp 로그를 업로드하고, summary를 생성하고, 스토리지별 사이트/로그 현황과 요청 사항을 웹에서 관리하는 내부 운영 콘솔입니다.

현재 프로젝트는 PostgreSQL을 사용하도록 정리되어 있으며, 업로드 파일은 로컬 `upload/` 디렉토리에 저장됩니다.

## 목적

이 프로젝트의 목적은 아래 업무를 한 화면에서 처리하는 것입니다.

- 스토리지별 사이트 관리
- NetApp 로그 업로드
- 원본 로그 조회 및 다운로드
- summary 생성 및 요약 정보 확인
- summary 세부 섹션 탐색
- 수동 입력 필드 관리
- 특이사항 이력 관리
- 수정 요청 게시판 운영
- 버그 기록 게시판 운영
- 회원 관리

즉, "스토리지 운영 로그와 운영 메모를 함께 관리하는 내부 웹 도구"가 현재 목적입니다.

## 현재 기능

### 1. 로그인 / 회원 관련

- 로그인
- 회원가입
- 회원탈퇴
- 회원 목록 조회
- startup 시 관리자 계정 자동 생성

관련 화면:

- 로그인 화면
- 회원 관리 목록

### 2. 사이트 관리

- `storage1`, `storage2`, `storage3` 별 사이트 생성
- 사이트 수정
- 사이트 삭제
- 사이트 목록 조회

### 3. 로그 업로드

- 다중 파일 업로드
- 파일별 저장 이름 지정
- 업로드 시 스토리지 선택
- 업로드 시 사이트 선택
- 수동 입력 필드와 함께 업로드
- 업로드 후 summary 자동 생성

### 4. 로그 조회

- 로그 목록 조회
- 스토리지/사이트 기준 로그 탐색
- 원본 로그 상세 보기
- 원본 로그 다운로드
- 로그 삭제

### 5. summary 조회

- summary overview 확인
- 다음 섹션 확인
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

### 6. 수동 입력 / 특이사항

- 업로드 시 직접 입력 필드 저장
- summary 화면에서 직접 입력 필드 수정
- 특이사항 추가
- 기존 특이사항을 기반으로 수정 이력 추가

### 7. 게시판 기능

- 수정 요청 게시판
  - 등록
  - 수정
  - 삭제
  - 상태 관리
- 버그 기록 게시판
  - 등록
  - 수정
  - 삭제

### 8. UI / 탐색

- 스토리지별 페이지 분리
- 사이트 목록 → 로그 목록 → 상세 구조
- 데스크톱 기준 로그 목록 + 상세 split-view
- 브라우저 뒤로가기와 내부 상태 연동

## 기술 스택

- Backend: FastAPI
- ASGI: Uvicorn
- ORM: SQLAlchemy
- DB: PostgreSQL
- Settings: pydantic-settings
- Upload parsing: Python regex 기반 NetApp parser
- Frontend: HTML + CSS + Vanilla JavaScript

## 디렉토리 구조

```text
app/
  api/            # FastAPI 라우터
  services/       # 비즈니스 로직
  static/         # JS/CSS/이미지
  templates/      # HTML 템플릿
  core/           # 상수, 경로, startup 로직
  models.py       # SQLAlchemy 모델
  db.py           # DB 엔진/세션
  parser_netapp.py# NetApp 로그 파서

deploy/
  run.sh          # 실행 스크립트
  build_release.sh# 릴리스 패키지 생성 스크립트
  .env.example    # 환경변수 예시

alembic/          # Alembic 기본 구조
tests/            # 테스트 코드
upload/           # 업로드 파일 저장 경로
```

## 현재 데이터 저장 방식

이 프로젝트는 DB와 파일 시스템을 함께 사용합니다.

### PostgreSQL에 저장되는 것

- 사용자 정보
- 사이트 정보
- 업로드 로그 메타데이터
- 수동 입력 JSON 문자열
- 특이사항 JSON 문자열
- 수정 요청 게시글
- 버그 게시글

### `upload/` 디렉토리에 저장되는 것

- 원본 로그 파일
- 생성된 summary 텍스트 파일

즉, 현재 구조는 "메타데이터는 DB, 본문 파일은 파일 시스템" 방식입니다.

## 환경변수

주요 환경변수는 아래와 같습니다.

```env
APP_NAME=Storage AI Web
APP_ENV=prod
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost/storage_ai
UPLOAD_DIR=upload
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin1234
ADMIN_FULL_NAME=Baobab Administrator
HOST=0.0.0.0
PORT=8000
```

현재 예시 파일:

- [deploy/.env.example](/root/2026_project/deploy/.env.example:1)

현재 로컬 실행 기준 설정 파일:

- [\.env](/root/2026_project/.env:1)

## 실행 방법

### 1. 기본 실행

```bash
bash deploy/run.sh
```

`deploy/run.sh`는 아래를 수행합니다.

- `.env`가 없으면 `deploy/.env.example` 복사
- `.env` 로드
- `UPLOAD_DIR` 디렉토리 생성
- `.venv`가 없으면 생성
- `requirements.txt` 설치
- `uvicorn app.main:app` 실행

실행 후 기본 주소:

- `http://localhost:8000`

### 2. 직접 실행 예시

가상환경과 의존성이 준비되어 있다면 직접 실행도 가능합니다.

```bash
source .venv/bin/activate
export $(grep -v '^#' .env | xargs)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 사용 방법

### 1. 로그인

- `/` 접속
- 계정으로 로그인
- 필요 시 로그인 화면에서 회원가입

### 2. 사이트 생성

- 스토리지 페이지로 이동
- 사이트 관리 영역에서 사이트 추가

### 3. 로그 업로드

- 대시보드에서 업로드 폼 사용
- 스토리지 선택
- 사이트 선택
- 파일 선택
- 파일별 저장 이름 입력
- 필요하면 직접 입력 항목 입력
- 업로드 실행

### 4. 로그 탐색

- 스토리지 페이지에서 사이트 선택
- 원본 로그 또는 요약 로그 탭 선택
- 목록에서 로그 선택
- 상세 보기 / 다운로드 / 삭제 수행

### 5. summary 확인

- 요약 로그 선택
- overview 확인
- 필요한 섹션 탭 선택
- Event log는 severity 필터 사용
- 특이사항 탭에서 메모 추가

### 6. 게시판 사용

- 수정 요청 게시판에서 요청 등록/수정/삭제
- 버그 게시판에서 버그 기록 등록/수정/삭제

## API 개요

### 웹/기본

- `GET /`
- `GET /api`
- `GET /health`

### 인증/회원

- `POST /auth/register`
- `POST /auth/login`
- `DELETE /auth/delete`
- `GET /users`

### 사이트

- `GET /sites`
- `POST /sites`
- `PUT /sites/{site_id}`
- `DELETE /sites/{site_id}`

### 로그

- `POST /upload`
- `GET /logs`
- `GET /logs/{log_id}/raw`
- `GET /logs/{log_id}/download`
- `DELETE /logs/{log_id}`
- `GET /logs/{log_id}/summary`
- `POST /logs/{log_id}/special-notes`
- `PUT /logs/{log_id}/manual-fields`

### 게시판

- `GET /requests`
- `POST /requests`
- `PUT /requests/{post_id}`
- `DELETE /requests/{post_id}`
- `GET /bugs`
- `POST /bugs`
- `PUT /bugs/{post_id}`
- `DELETE /bugs/{post_id}`

### 관리자/운영

- `GET /admin/sessions`
- `GET /admin/deletion-requests`
- `PUT /admin/deletion-requests/{request_id}/review`
- `PUT /admin/users/{user_id}/status`
- `GET /admin/operations/integrity`

## 운영 확인 지점

문제가 생겼을 때는 아래 순서로 보면 됩니다.

1. `GET /health`
   - 앱 응답
   - DB 연결
   - 업로드 디렉토리 접근 가능 여부
   - Alembic revision / 필수 테이블 누락 여부
2. 서버 로그
   - 요청 단위 로그
   - 업로드/삭제/summary 조회 실패 로그
3. 정합성 점검
   - 관리자 API: `GET /admin/operations/integrity`
   - CLI: `python scripts/check_integrity.py`

CLI 예시:

```bash
/root/2026_project/.venv/bin/python scripts/check_integrity.py --json
/root/2026_project/.venv/bin/python scripts/check_integrity.py --fail-on-issues
```

## 릴리스 패키지 생성

현재 릴리스는 `내장 Python + site-packages + 실행 스크립트`를 포함하는 실용 포터블 패키지로 생성합니다.

```bash
bash deploy/build_release.sh 0.5 HEAD
```

생성 결과:

- `dist/netapp_automation-0.5/`
- `dist/netapp_automation-0.5.tar.gz`

포함되는 것:

- 프로젝트 소스코드
- `runtime/`
  - 내장 Python 실행 파일
  - Python 표준 라이브러리
  - 프로젝트 의존 패키지
- `deploy/run.sh`
- `deploy/.env.example`

다른 서버에서 실행 예시:

```bash
tar -xzf netapp_automation-0.5.tar.gz
cd netapp_automation-0.5
bash deploy/run.sh
```

주의:

- 이 패키지는 `완전 범용 바이너리`가 아니라 `같은 계열 Linux 서버용 실용 포터블`입니다.
- 즉 Python 설치 없이 실행할 수 있도록 묶지만, 운영체제 계열과 아키텍처는 크게 다르지 않은 환경을 전제로 합니다.

## GitHub 릴리스

현재 릴리스 예시:

- `0.5`: P0 인증/권한 흐름과 내장 Python 기반 포터블 패키지 적용 버전

이후에도 같은 방식으로 버전을 올려 릴리스 패키지와 GitHub release를 만들 수 있습니다.

## 개발 관련 문서

현재 프로젝트 상태를 이해하려면 아래 문서를 먼저 보는 것을 권장합니다.

- [research.md](/root/2026_project/research.md:1)
  - 시스템 전체 구조, 리스크, 개선 방향
- [research2.md](/root/2026_project/research2.md:1)
  - 기능별 파일/흐름/리스크/결정 질문
- [plan.md](/root/2026_project/plan.md:1)
  - 우선순위 기반 구현 계획

## 현재 주의사항

현재 코드 기준으로 아래는 꼭 알고 있어야 합니다.

- 인증/인가가 아직 강하지 않음
- PostgreSQL을 사용하지만 migration 체계는 아직 정리 중
- 업로드 파일과 summary는 로컬 파일 시스템에 저장됨
- `manual_fields_json`, `note`는 문자열 기반 JSON 저장
- 테스트는 현행 코드와 일부 불일치 가능성이 있음

즉, 기능은 동작하지만 운영 안정화 작업이 아직 필요한 상태입니다.

## 향후 개선 우선순위

현재 계획 기준 우선순위는 아래와 같습니다.

1. 인증/인가 체계 도입
2. PostgreSQL migration/Alembic 정리
3. 로그/summary 저장 구조 안정화
4. 테스트 복구
5. 프론트 구조 분리
6. UX 개선
7. 운영성/관측성 강화

자세한 구현 계획은 [plan.md](/root/2026_project/plan.md:1)을 참고하세요.
