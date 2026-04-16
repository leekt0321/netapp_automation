# netapp_automation

NetApp 로그를 업로드하고 summary를 생성한 뒤, `스토리지1팀`, `스토리지2팀`, `스토리지3팀` 기준으로 사이트/로그/운영 이슈를 웹에서 관리하는 내부 운영 콘솔입니다.

현재 `1.0v`는 "로그 업로드와 요약 확인, 운영 메모와 요청 관리가 가능한 내부 운영 도구의 첫 안정 릴리즈"를 목표로 정리된 버전입니다.

## 사용 목적

이 프로젝트는 아래 업무를 한 화면에서 처리하기 위해 만들어졌습니다.

- 팀별 스토리지 사이트 관리
- NetApp 원본 로그 업로드
- summary 자동 생성 및 개요 확인
- 원본 로그 / 요약 로그 탐색
- 수동 입력 항목 보정
- 특이사항 기록
- 수정 요청 게시판 운영
- 버그 기록 게시판 운영
- 회원 및 관리자 기능 운영

즉, "스토리지 운영 로그와 운영 메모를 함께 관리하는 내부 웹 콘솔"이 현재 목적입니다.

## 1.0v 주요 기능

### 인증 / 계정

- 로그인
- 회원가입
- 회원탈퇴
- 비밀번호 변경
- 관리자 계정 자동 생성

### 스토리지 / 사이트 관리

- `storage1`, `storage2`, `storage3` 키 기반 팀 분리
- 팀별 사이트 생성 / 수정 / 삭제
- 사이트 목록 조회

화면 표시명은 현재 `스토리지1팀`, `스토리지2팀`, `스토리지3팀`으로 노출됩니다.

### 로그 업로드 / 조회

- 다중 파일 업로드
- 파일별 저장 이름 지정
- 업로드 시 팀 선택
- 업로드 시 사이트 선택
- 직접 입력 항목과 함께 업로드
- 업로드 후 summary 자동 생성
- 원본 로그 조회 / 다운로드 / 삭제 요청

### Summary 확인

- 요약 개요(overview) 표시
- 상세 섹션 탐색
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
- Event log severity 필터
- 직접 입력 수정
- 특이사항 추가 / 이력 관리

### 운영 게시판

- 수정 요청 게시판
  - 등록 / 수정 / 삭제
  - 상태 관리
- 버그 모음 게시판
  - 등록 / 수정 / 삭제

### 관리자 기능

- 가입 계정 목록 조회
- 계정 활성/비활성 처리
- 현재 로그인 세션 확인
- 로그 삭제 요청 검토
- 운영 정합성 점검 API

## 현재 UI / 사용 흐름

현재 UI는 아래 흐름을 중심으로 동작합니다.

1. 로그인
2. 대시보드에서 업로드 또는 팀 페이지 이동
3. 팀 페이지에서 사이트 선택
4. 원본 로그 / 요약 로그 탭 선택
5. 로그 목록에서 파일 선택
6. 상세 내용 확인, 다운로드, 직접 입력 수정, 특이사항 기록

데스크톱 기준으로는 로그 목록과 상세를 함께 보는 split-view 구조를 사용합니다.

## 기술 스택

- Backend: FastAPI
- ASGI: Uvicorn
- ORM: SQLAlchemy
- DB: PostgreSQL
- Settings: pydantic-settings
- Parser: Python regex 기반 NetApp parser
- Frontend: HTML + CSS + Vanilla JavaScript

## 디렉토리 구조

```text
app/
  api/             # FastAPI 라우터
  core/            # 상수, 경로, startup 로직
  services/        # 비즈니스 로직
  static/          # JS/CSS/이미지
  templates/       # HTML 템플릿
  models.py        # SQLAlchemy 모델
  db.py            # DB 엔진/세션
  parser_netapp.py # NetApp 로그 파서

deploy/
  run.sh           # 실행 스크립트
  build_release.sh # 릴리스 패키지 생성 스크립트
  .env.example     # 환경변수 예시

alembic/           # Alembic 기본 구조
tests/             # 테스트 코드
upload/            # 업로드 파일 저장 경로
```

## 데이터 저장 방식

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
ALLOWED_UPLOAD_EXTENSIONS=.log,.txt
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin1234
ADMIN_FULL_NAME=Baobab Administrator
HOST=0.0.0.0
PORT=8000
```

예시 파일:

- [deploy/.env.example](/root/2026_project/deploy/.env.example:1)

## 실행 방법

### 기본 실행

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

실행 주소:

- `http://localhost:8000`

### 직접 실행

```bash
source .venv/bin/activate
export $(grep -v '^#' .env | xargs)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API 개요

### 기본

- `GET /`
- `GET /api`
- `GET /health`

### 인증 / 회원

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

### 관리자

- `GET /admin/sessions`
- `GET /admin/deletion-requests`
- `PUT /admin/deletion-requests/{request_id}/review`
- `PUT /admin/users/{user_id}/status`
- `GET /admin/operations/integrity`

## 운영 점검 포인트

문제가 생겼을 때는 아래 순서로 확인하면 됩니다.

1. `GET /health`
2. 서버 로그
3. 정합성 점검
   - `GET /admin/operations/integrity`
   - `python scripts/check_integrity.py`

CLI 예시:

```bash
/root/2026_project/.venv/bin/python scripts/check_integrity.py --json
/root/2026_project/.venv/bin/python scripts/check_integrity.py --fail-on-issues
```

## 릴리스 패키지 생성

현재 릴리스는 `내장 Python + site-packages + 실행 스크립트`를 포함하는 포터블 패키지로 생성합니다.

```bash
bash deploy/build_release.sh 1.0v HEAD
```

예상 결과:

- `dist/netapp_automation-1.0v/`
- `dist/netapp_automation-1.0v.tar.gz`

## 문서

- [research.md](/root/2026_project/research.md:1)
  현재 구현 구조, 흐름, 데이터 구조 정리
- [plan.md](/root/2026_project/plan.md:1)
  이후 버전 계획 및 기능 확장 방향

## 현재 주의사항

- 인증/인가 체계는 아직 단순한 편입니다.
- 업로드 파일과 summary는 로컬 파일 시스템에 저장됩니다.
- 일부 데이터는 문자열 기반 JSON으로 저장됩니다.
- 테스트 커버리지는 아직 충분하지 않습니다.

## 1.0v 릴리즈 의미

`1.0v`는 아래를 만족하는 첫 릴리즈입니다.

- 팀별 스토리지 운영 화면 구성 완료
- 원본/요약 로그 흐름 안정화
- 수동 입력 / 특이사항 / 게시판 기능 연결
- 관리자 운영 기능 포함
- 기본 다크 네이비 + 블루 포인트 UI 정리
