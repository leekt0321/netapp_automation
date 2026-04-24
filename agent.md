# Agent Guide

## 역할

이 에이전트는 프로젝트의 기능 구현, 버그 수정, 디자인 레이아웃 개선을 도와주는 **코딩 에이전트** 역할을 수행한다.
에이전트는 사용자의 요구사항을 바탕으로 소스코드를 분석하고, 필요한 파일을 수정하며, 기능이 정상 동작하도록 구현한다.

## 프로젝트 개요

- 프로젝트명: `netapp_automation`
- 목적: NetApp 로그 업로드, summary 생성, 사이트/운영 이슈/관리자 기능을 제공하는 내부 운영 콘솔
- 주요 사용자: Baobab Technology 내부 스토리지 운영 담당자
- 제품 성격: 장시간 사용하는 업무용 콘솔이므로 화려함보다 안정성, 가독성, 저피로 UI가 더 중요하다

## 기술 스택

- Backend: FastAPI
- ASGI: Uvicorn
- ORM: SQLAlchemy 2.x
- Migration: Alembic
- DB: PostgreSQL
- Settings: `pydantic-settings`
- Frontend: Jinja 템플릿 + Vanilla JavaScript + CSS
- Test: `pytest`, `fastapi.testclient`

## 현재 구조

```text
app/
  api/        HTTP 라우터
  services/   비즈니스 로직
  core/       설정, 경로, lifecycle, 로깅
  static/     프런트엔드 JS/CSS
  templates/  HTML 템플릿
  config.py   환경변수 로딩
  db.py       SQLAlchemy 엔진/세션
  models.py   DB 모델
  parser_netapp.py

alembic/      DB 마이그레이션
deploy/       실행/릴리스 스크립트
tests/        회귀 테스트
upload/       원본 로그 + summary 파일 저장 경로
```

## 핵심 동작 방식

- 앱 진입점은 `app/main.py`이며 실제 앱 구성은 `app/app_factory.py`에서 수행한다.
- 정적 파일은 `/static`으로 마운트된다.
- 앱 startup 시 lifecycle 초기화가 수행된다.
- 데이터는 DB와 파일 시스템을 함께 사용한다.
- 로그 업로드 시 원본 로그와 summary 파일은 `UPLOAD_DIR` 아래에 저장되고, 메타데이터는 DB에 저장된다.
- `app/core/paths.py`에서 `UPLOAD_DIR`를 즉시 생성하므로 경로 관련 변경은 신중해야 한다.

## 실행 방법

기본 실행:

```bash
bash deploy/run.sh
```

직접 실행:

```bash
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`deploy/run.sh`는 다음을 처리한다.

- `.env`가 없으면 `deploy/.env.example`를 복사
- 가상환경 또는 portable runtime 사용
- `requirements.txt` 설치
- Alembic 마이그레이션 실행
- Uvicorn 서버 기동

## 테스트 방법

전체 테스트:

```bash
pytest
```

대표 테스트:

```bash
pytest tests/test_logs.py
pytest tests/test_auth.py
pytest tests/test_admin.py
```

테스트 특성:

- 기본 테스트 DB는 임시 SQLite를 사용한다.
- `tests/conftest.py`에서 환경변수를 monkeypatch로 주입한다.
- 테스트는 실제 업로드 디렉토리 대신 임시 `upload` 경로를 사용한다.
- 로그 업로드, summary 생성, 삭제 요청, 관리자 승인 흐름까지 회귀 테스트가 있다.

## 환경변수

중요 값:

- `DATABASE_URL`
- `UPLOAD_DIR`
- `ALLOWED_UPLOAD_EXTENSIONS`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_FULL_NAME`
- `HOST`
- `PORT`

실행 전 기준 파일:

- `deploy/.env.example`

## 작업 원칙

- 변경 전 `README.md`, 관련 router/service/test를 함께 확인한다.
- API 수정 시 라우터만 보지 말고 대응하는 `services/`와 `schemas/`를 함께 본다.
- 업로드/삭제/summary 관련 수정은 DB 저장값과 파일 시스템 정리 로직을 동시에 검토한다.
- `upload/`와 운영 데이터는 실제 업무 데이터일 수 있으므로 임의 삭제를 피한다.
- 프런트엔드는 Vanilla JS 구조이므로 작은 함수 단위로 수정하고 전역 상태 흐름을 먼저 파악한다.
- 디자인 관련 작업을 수행할 때는 `impeccable` 스킬을 기본 기준으로 사용한다.
- UI는 내부 운영 콘솔 톤을 유지한다. 과한 장식보다 빠른 스캔과 안정적인 정보 위계를 우선한다.
- 한글 문구가 많으므로 사용자 노출 문자열은 의미와 톤을 유지하면서 수정한다.

## 변경 시 체크포인트

백엔드 변경 시:

- 관련 API 테스트가 있는지 먼저 확인한다.
- 권한/세션/관리자 전용 기능 여부를 함께 검토한다.
- Alembic이 필요한 스키마 변경인지 판단한다.

로그 처리 변경 시:

- 업로드 성공 시 raw 파일과 summary 파일이 모두 생성되는지 확인한다.
- 실패 시 중간 파일 정리가 되는지 확인한다.
- 사이트와 스토리지의 소속 검증이 유지되는지 확인한다.

프런트엔드 변경 시:

- `app/templates/index.html`
- `app/static/app.js`
- `app/static/js/*.js`
- `app/static/app.css`

위 파일들이 함께 맞물리는 구조인지 먼저 확인한다.

디자인 작업 기준:

- 새로운 화면, 컴포넌트, 레이아웃, 시각 리프레시가 필요하면 `impeccable`을 사용한다.
- 단, 이 프로젝트의 디자인 컨텍스트는 `.impeccable.md`를 우선 기준으로 삼는다.
- 결과물은 "내부 운영 콘솔", "저피로", "빠른 스캔", "차분한 정보 위계"를 해치지 않아야 한다.

## 배포 / 릴리스

- 실행 스크립트: `deploy/run.sh`
- 릴리스 패키징: `deploy/build_release.sh <version> [git-ref]`

릴리스 스크립트는 테스트, 업로드 데이터, 개발용 디렉토리를 제외하고 portable runtime을 포함한 배포 아카이브를 생성한다.

## 추천 작업 순서

1. `README.md`로 기능 의도 확인
2. 관련 API router 확인
3. 연결된 service와 model 확인
4. 기존 테스트 확인
5. 코드 수정
6. 최소 관련 테스트 실행
7. 파일 저장 경로와 DB 영향 다시 점검

## 빠른 참조

- 앱 진입점: `app/main.py`
- 앱 조립: `app/app_factory.py`
- 설정: `app/config.py`
- DB 세션: `app/db.py`
- 경로/업로드 디렉토리: `app/core/paths.py`
- 배포 실행: `deploy/run.sh`
- 테스트 설정: `tests/conftest.py`

## 주의 사항

- 현재 프로젝트는 PostgreSQL 기준으로 운영되지만 테스트는 SQLite 기반으로도 돌아간다. DB 종속 SQL을 넣을 때는 테스트 호환성을 먼저 확인한다.
- 파일 시스템과 DB를 함께 쓰는 구조라서 한쪽만 수정하면 orphan 데이터가 생기기 쉽다.
- 내부 운영 도구이므로 신규 기능보다 안정적인 동작, 명확한 오류 메시지, 관리자 검토 흐름 보존이 더 중요하다.
