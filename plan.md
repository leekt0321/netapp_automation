# Implementation Plan

작성일: 2026-04-14  
기준 문서:

- [research.md](/root/2026_project/research.md:1)
- [research2.md](/root/2026_project/research2.md:1)

이 문서는 앞으로의 구현 계획을 정리한 문서입니다.
우선순위가 높은 순서로 정리했으며, 각 작업에 대해 가능한 한 실제 실행 가능한 수준까지 상세하게 적었습니다.

핵심 원칙:

- 보안 경계와 데이터 정합성을 기능 추가보다 먼저 해결.
- PostgreSQL 전용 운영을 전제로 설계.
- 파일 시스템과 DB의 책임을 명확히 나눔.
- 한 번에 전부 바꾸지 않고, 단계별로 안전하게 옮김.
- 프론트 리팩토링은 저장 구조와 인증 안정화 이후에 진행.

---

## 0. 현재 전제와 목표

현재 프로젝트의 핵심 문제는 기능 부족이 아니라 "운영 안정성 부족".

따라서 전체 구현 방향은 아래 순서를 따릅니다.

1. 인증/인가 정리
2. PostgreSQL 스키마와 migration 체계 정리
3. 업로드/summary 저장 구조 안정화
4. 테스트 복구
5. 기능별 UI/UX 개선
6. 성능/운영성 보강

즉, 단순히 화면을 다듬는 것보다 먼저 "누가 접근할 수 있는지", "데이터가 안 깨지는지", "배포 후 재현 가능한지"를 잡는 것이 우선.

---

## 1. 우선순위 전체 목록

### P0. 인증/인가 체계 도입

- 상태: 핵심 범위 구현 완료
- 완료 범위
  - 서버가 실제 로그인 상태를 강제하도록 변경
  - 보호 API에 auth dependency 적용
  - 관리자 권한 모델 도입
  - 관리자 승인형 회원가입 도입
  - 로그 삭제 요청 -> 관리자 승인/거부 흐름 적용
  - 비밀번호 변경, 세션 유지시간 24시간 적용
- 보류 범위
  - 세션 강제 종료/세션별 제어
  - 사용자 제한 세분화
  - 로그 외 리소스까지 승인형 삭제 확장

### P1. PostgreSQL 스키마 관리 정리

- Alembic 실사용 시작
- 런타임 `ALTER TABLE` 제거
- FK / unique / index / JSONB 설계

### P2. 로그/summary 저장 구조 재설계

- summary 경로 명시 저장
- 파일 저장과 DB 저장 정합성 보강
- note/manual fields 구조 정리

### P3. 테스트 체계 복구

- 상태: 핵심 범위 구현 완료
- 완료 범위
  - 오래된 테스트를 현재 구조 기준으로 재구성
  - parser 단위 테스트 추가
  - auth/site/log/board/admin 테스트 추가
  - 성공/실패 경로를 포함한 최소 회귀 세트 확보
- 추후 보강 가능 항목
  - PostgreSQL 전용 테스트 DB 전략 강화
  - parser/운영 edge case 테스트 확대
  - CI 자동 실행 연결

### P4. 프론트 구조 분리

- 상태: 핵심 범위 구현 완료
- `app.js` 기능별 모듈화
- API 호출 계층 분리
- 화면 상태 구조 정리

### P5. 기능별 UX 개선

- 상태: 핵심 범위 구현 완료
- 로그 목록 검색/정렬/페이지네이션
- summary 섹션 구조 개선
- 게시판 사용성 강화

### P6. 운영성/관측성 강화

- 상태: P6 1차 구현 완료
- 로그/메트릭/헬스체크 확장
- 장애 대응 도구
- 백업/정리 스크립트 보강

---

## 2. P0. 인증/인가 체계 도입

### 현재 상태

P0는 현재 기준으로 핵심 목표가 구현 완료된 상태다.

완료된 항목:

- 서버 세션 + HttpOnly 쿠키 기반 인증 적용
- `admin` / `user` 2단계 권한 모델 적용
- 보호 API에 인증/권한 체크 적용
- 관리자 전용 회원 관리 화면 및 사용자 활성/비활성 처리
- 일반 사용자의 로그 삭제 요청, 관리자의 승인/거부 처리
- 비밀번호 변경 기능
- 게시판/버그 게시판 공용 수정/삭제 정책 반영
- 스토리지별 권한 노출 정리
- 회원가입 후 `승인 대기 -> 관리자 승인 -> 로그인 가능` 흐름 적용
- 세션 유지시간 24시간 적용

보류된 항목:

- 세션별 강제 종료 // X
- 사용자 제한 사유/기간/세부 권한 모델  // 보류
- 로그 외 다른 리소스까지 승인형 삭제 확대 // X


### 목표

현재의 localStorage 기반 "화면용 로그인"을 실제 서버 인증/인가 체계로 바꾸고,  
권한 모델을 `admin` / `user` 2단계로 단순화한다.

또한 "삭제 가능 여부"를 단순 role 제한으로 끝내지 않고,  
`user가 삭제 요청을 올리고 admin이 허용/거부하는 승인형 흐름`으로 재설계한다.

현재 구현 결과:

- 위 목표는 로그 삭제 기준으로 구현 완료
- 게시판/버그 게시판은 승인형 삭제 대상에서 제외하고 공용 수정/삭제 방식으로 확정
- 회원가입은 이메일 인증 대신 관리자 승인형으로 확정

### 왜 먼저 해야 하는가

- 지금은 로그인해도 서버 API 보호가 약함.
- 회원 목록/삭제, 로그 삭제, 게시판 수정/삭제 모두 권한 경계가 거의 없음.
- 이후 리팩토링을 해도 보안 경계가 없으면 운영 리스크가 계속 남음.
- 특히 현재 요구사항 기준으로는 다음이 반드시 필요함.
  - 일반 사용자는 회원 관리 목록을 보면 안 됨
  - 일반 사용자는 사이트 추가/수정/삭제를 하면 안 됨
  - 삭제는 바로 실행되면 안 되고 관리자 승인 후 실행되어야 함
  - 관리자는 로그인된 사용자 상태를 보고 제한할 수 있어야 함

현재 상태 메모:

- 앞의 세 가지는 구현 완료
- 마지막 항목은 "세션 목록 확인"까지 구현됐고, 세션별 강제 종료/세밀한 제한은 보류

### 변경 대상 파일

- [app/api/auth_routes.py](/root/2026_project/app/api/auth_routes.py:1)
- [app/services/auth_service.py](/root/2026_project/app/services/auth_service.py:1)
- [app/auth.py](/root/2026_project/app/auth.py:1)
- [app/models.py](/root/2026_project/app/models.py:22)
- [app/db.py](/root/2026_project/app/db.py:1)
- [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- [app/api/site_routes.py](/root/2026_project/app/api/site_routes.py:1)
- [app/api/board_routes.py](/root/2026_project/app/api/board_routes.py:1)
- [app/api/web_routes.py](/root/2026_project/app/api/web_routes.py:1)
- [app/schemas/payloads.py](/root/2026_project/app/schemas/payloads.py:1)
- [app/services/board_service.py](/root/2026_project/app/services/board_service.py:1)
- [app/services/site_service.py](/root/2026_project/app/services/site_service.py:1)
- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:1)
- [app/core/lifecycle.py](/root/2026_project/app/core/lifecycle.py:1)
- [app/core/constants.py](/root/2026_project/app/core/constants.py:1)
- [app/static/app.js](/root/2026_project/app/static/app.js:1)
- [app/static/app.css](/root/2026_project/app/static/app.css:1)
- [app/templates/index.html](/root/2026_project/app/templates/index.html:1)
- Alembic migration 파일

### 설계 방향

#### 권한 모델

- `admin`
  - 회원 목록 조회 가능
  - 사용자 제한 가능
  - 사이트 추가/수정/삭제 가능
  - 삭제 요청 목록 확인 가능
  - 삭제 요청 허용/거부 가능
- `user`
  - 로그인 후 기본 기능 사용 가능
  - 로그 조회, summary 확인, 게시판 사용 가능
  - 직접 삭제는 불가
  - 삭제 요청만 등록 가능
  - 회원 관리 목록 접근 불가
  - 사이트 관리 접근 불가

현재 적용 상태:

- 위 권한 모델은 현재 코드에 반영됨
- 추가 정책 확정 사항:
  - 게시판/버그 게시판은 일반 사용자도 공용 수정/삭제 가능
  - 로그 삭제만 승인형 유지

#### 삭제 정책

- 기존 구조:
  - 삭제 API를 호출하면 바로 삭제
- 목표 구조:
  - 사용자가 삭제 요청 생성
  - 관리자가 요청 목록에서 검토
  - 허용 시 실제 삭제 실행
  - 거부 시 삭제 미실행 + 상태 기록

현재 적용 상태:

- `log` 대상에 대해 구현 완료
- `request_post`, `bug_post`는 승인형 대상에서 제외

#### 사용자 제한 정책

- 관리자는 현재 로그인된 사용자를 볼 수 있어야 함
- 관리자는 이상 사용자에 대해 제한 조치를 할 수 있어야 함
- 제한 상태 사용자는 로그인 불가 또는 주요 기능 사용 제한
- 최소한 `is_active`만으로 끝낼지, 더 세부적인 제한 상태를 둘지 결정 필요

현재 적용 상태:

- 현재는 `is_active` 기반 활성/비활성만 적용
- 세분화된 제한 정책은 보류

#### 인증 방식 후보

- 1안. 서버 세션 + HttpOnly 쿠키
  - 내부 관리도구에 더 자연스러움
  - 프론트 localStorage 의존을 줄일 수 있음
  - XSS 대응 측면에서 유리
- 2안. JWT
  - API 중심 확장에는 유리
  - 현재 구조에서는 오히려 복잡도 증가 가능

현재 프로젝트 성격상 1안이 더 적합할 가능성이 높다.

확정 결과:

- 서버 세션 + HttpOnly 쿠키 방식으로 구현 완료
- JWT는 현재 범위에서 채택하지 않음

### 파일별 수정 목적

- `auth_routes.py`
  - 로그인/로그아웃/현재 사용자 조회 API 구조 재정리
  - 세션 생성/해제 API 추가
- `auth_service.py`
  - 인증 처리와 권한 검증 로직 분리
  - 사용자 제한 상태 처리 추가
- `auth.py`
  - 비밀번호 해시 외 세션/쿠키 유틸 추가 후보
- `models.py`
  - `role` 컬럼 추가
  - 필요하면 로그인 세션 테이블 추가
  - 삭제 요청 테이블 추가 후보
- `log_routes.py`
  - 직접 삭제 API 재설계
  - 삭제 요청 생성 API 또는 승인 API 추가 후보
- `site_routes.py`
  - 사이트 쓰기 API를 admin 전용으로 제한
- `board_routes.py`
  - 요청/버그 게시판의 auth 정책 반영
- `web_routes.py`
  - `/api/me` 또는 현재 사용자/권한 확인 endpoint 추가 후보
- `payloads.py`
  - auth, 삭제 요청, 승인/거부 payload 구조 추가
- `board_service.py`
  - 삭제 요청 게시판을 기존 요청 게시판과 합칠지 여부에 따라 역할 변경 가능
- `site_service.py`
  - 권한 체크 보조 로직 추가 가능
- `log_service.py`
  - "즉시 삭제"에서 "승인 후 삭제"로 변경 필요
- `lifecycle.py`
  - admin 초기 계정/role 초기화 정책 정리
- `constants.py`
  - role, 삭제 요청 상태, 사용자 제한 상태 상수화
- `app.js`
  - localStorage 세션 로직 제거 또는 축소
  - 로그인 후 쿠키/세션 기반 상태 확인 구조로 변경
  - admin/user별 메뉴 노출 분리
  - 삭제 요청 UI, 승인 UI, 사용자 제한 UI 반영
- `app.css`
  - 관리자 전용 패널/상태 배지/승인 목록 UI 대응
- `index.html`
  - 권한별 버튼 표시/비표시 대응
  - admin 전용 패널 자리 확보

현재 구현 기준 주요 반영 파일:

- [app/api/auth_routes.py](/root/2026_project/app/api/auth_routes.py:1)
- [app/api/admin_routes.py](/root/2026_project/app/api/admin_routes.py:1)
- [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- [app/api/site_routes.py](/root/2026_project/app/api/site_routes.py:1)
- [app/api/board_routes.py](/root/2026_project/app/api/board_routes.py:1)
- [app/services/auth_service.py](/root/2026_project/app/services/auth_service.py:1)
- [app/services/admin_service.py](/root/2026_project/app/services/admin_service.py:1)
- [app/models.py](/root/2026_project/app/models.py:1)
- [app/core/lifecycle.py](/root/2026_project/app/core/lifecycle.py:1)
- [app/static/app.js](/root/2026_project/app/static/app.js:1)
- [app/templates/index.html](/root/2026_project/app/templates/index.html:1)

현재 이 문단의 나머지 내용은 "당시 설계 후보"로 남겨두되,  
실제 구현은 위 파일들을 기준으로 판단하는 것이 맞다.

### 추가 테이블/컬럼 후보

#### 사용자 관련

- `users.role`
- `users.is_active` 유지
- `users.approved_at`
- 필요 시
  - `users.restricted_reason`
  - `users.last_login_at`

#### 세션 관련

- `user_sessions`
  - `id`
  - `user_id`
  - `session_token_hash`
  - `created_at`
  - `expires_at`
  - `last_seen_at`
  - `ip_address`
  - `user_agent`

#### 삭제 요청 관련

- `deletion_requests`
  - `id`
  - `requester_user_id`
  - `target_type`
  - `target_id`
  - `reason`
  - `status`
  - `reviewed_by_user_id`
  - `review_comment`
  - `created_at`
  - `reviewed_at`

`target_type` 예시:

- `log`
- 필요하면 향후 `site`, `request_post`, `bug_post` 등으로 확장 가능

현재 구현 상태:

- `users.role`, `users.is_active`, `users.approved_at` 반영됨
- `user_sessions` 반영됨
- `deletion_requests` 반영됨
- `target_type` 확장은 아직 하지 않고 `log` 중심으로 운용

`status` 예시:

- `pending`
- `approved`
- `rejected`
- `executed`

### 구현 순서

1. 인증 방식 결정
   - 쿠키 세션
   - JWT
2. 사용자 role 모델 설계
   - `admin`
   - `user`
3. 세션 저장 전략 결정
   - DB 세션 테이블 사용 여부
   - 만료 시간 정책
4. 현재 사용자 조회 dependency 구현
5. 로그인 성공 시 서버가 세션을 발급하도록 변경
6. `/api/me` 또는 동등한 현재 사용자 endpoint 추가
7. 프론트 로그인/복원 로직을 세션 기반으로 전환
8. 회원 목록 API를 admin 전용으로 변경
9. 사이트 쓰기 API를 admin 전용으로 변경
10. 로그 직접 삭제 API를 관리자 승인 흐름으로 재설계
11. 삭제 요청 테이블/서비스/API 추가
12. admin 삭제 요청 목록 UI 추가
13. admin 허용/거부 처리 UI 추가
14. 현재 로그인 사용자 목록/세션 목록 제공 방식 설계 및 구현
15. 사용자 제한 기능 추가
16. 권한별 메뉴/버튼/액션 노출 제어

### 세부 구현 단계

#### 단계 A. 인증 기반 만들기

- 로그인 응답 구조 변경
- 세션 발급
- 현재 사용자 확인 dependency 작성
- 로그아웃 추가

#### 단계 B. 권한 적용

- `admin`만 가능한 API 정리
- 공통 dependency 작성
- 기존 API에 연결

#### 단계 C. 삭제 승인 흐름 만들기

- 삭제 요청 저장 구조 추가
- 사용자는 요청만 생성
- 관리자는 승인/거부
- 실제 삭제는 승인된 요청만 가능

#### 단계 D. 사용자 관리 고도화

- admin이 사용자 목록 확인
- 로그인된 사용자/세션 확인
- 사용자 제한 처리

#### 단계 E. 프론트 반영

- 메뉴 숨김
- admin 패널 추가
- 삭제 요청 UI 추가
- 권한 실패 시 메시지 처리

### 완료 조건

- 인증 없이 보호 API 호출 시 401/403 응답
- 일반 사용자는 관리자 기능 접근 불가
- 새로고침 후에도 서버 기준으로 로그인 상태 유지
- localStorage만 조작해서 권한 우회 불가
- 일반 사용자는 회원 관리 목록 접근 불가
- 일반 사용자는 사이트 추가/수정/삭제 불가
- 삭제는 승인된 요청만 실제 반영
- admin은 삭제 요청 목록을 보고 허용/거부 가능
- admin은 사용자 상태를 확인하고 제한 가능

### 선행 결정 사항

- 쿠키 세션과 JWT 중 무엇을 쓸지
- role을 `admin` / `user` 2단계로 고정할지
- 삭제 요청 기능을 별도 테이블로 둘지, 기존 요청 게시판과 통합할지
- "로그인된 사용자 목록"을 현재 세션 목록으로 볼지, 단순 최근 활동 사용자 목록으로 볼지
- 사용자 제한을 `is_active` 하나로 처리할지, 별도 상태를 둘지

### 리스크

- 프론트 전체 로그인 흐름이 흔들릴 수 있음
- 기존 운영 계정과의 호환성 이슈 가능
- 삭제 승인 흐름을 섣불리 넣으면 UX가 복잡해질 수 있음
- 삭제 요청 테이블을 설계하지 않고 게시판에 얹으면 구조가 금방 꼬일 수 있음
- "로그인된 사용자 보기"는 세션 저장 전략이 명확하지 않으면 구현이 애매함
- 사용자 제한 기능은 관리자 오남용 방지 정책이 없으면 운영 갈등을 만들 수 있음

### 현재 주석 기준으로 보이는 문제점 / 설계상 주의점

#### 1. 삭제 승인 기능은 단순 role 체크보다 범위가 큼

주석 기준 요구사항은 "admin만 삭제 가능"이 아니라 "admin이 허용한 경우만 삭제"이다.  
이건 곧 별도의 승인 워크플로가 필요하다는 뜻이라서, auth 작업만으로 끝나지 않고 데이터 모델과 UI 설계가 같이 필요하다.

즉, P0 안에 아래가 같이 포함된다.

- 삭제 요청 저장 구조
- 요청 상태 관리
- 관리자 검토 UI
- 실제 삭제 실행 시점 분리

이 부분은 생각보다 구현 범위가 넓다.

#### 2. `operator` 제거는 맞지만 admin 책임이 커진다

현재 주석대로면 role은 `admin`, `user`만 남는다.  
이 경우 사이트 관리, 사용자 관리, 삭제 승인, 사용자 제한이 전부 admin에게 몰리므로, admin 화면 복잡도가 커질 수 있다.

문제 가능성:

- admin UI가 과도하게 비대해짐
- 향후 운영자 역할이 다시 필요해질 수 있음

#### 3. "로그인된 사용자 보기"는 현재 구조에서 바로 되지 않는다

현재는 localStorage 기반 로그인 UX라서, 서버는 "누가 로그인 중인지"를 신뢰성 있게 모른다.  
따라서 admin이 로그인된 사용자를 보려면 세션 저장 구조가 반드시 필요하다.

즉, 이 요구사항은 인증 방식을 세션 중심으로 바꾸는 쪽과 더 잘 맞는다.

#### 4. 사용자 제한 기능의 범위를 먼저 정해야 한다

"이상한 사용자 제한"은 표현상 넓다. 실제 구현 전에 아래를 먼저 정의해야 한다.

- 로그인 자체 금지인지
- 읽기만 허용하고 쓰기 금지인지
- 일시 정지인지 영구 비활성인지
- 제한 이유를 저장할지

이게 없으면 구현 후 운영 기준이 흔들린다.

#### 5. 회원 관리 목록 비노출과 API 차단은 별개다

UI에서 숨기는 것만으로는 충분하지 않다.  
반드시 서버 API 차단이 같이 들어가야 한다.

필수:

- 프론트 버튼 숨김
- 백엔드 route 보호
- 서비스 레벨 검증

#### 6. 삭제 요청을 어디까지 승인 대상으로 할지 지금은 불명확하다

현재 주석은 "삭제의 경우"라고 되어 있지만 대상이 명확히 적혀 있지 않다.

해석 후보:

- 로그 삭제만 승인 대상
- 사이트 삭제도 승인 대상
- 게시판 글 삭제도 승인 대상

처음에는 "로그 삭제만 승인형"으로 좁히는 것이 안전하다.

### 추천 정리안

P0는 아래 범위로 고정하는 것이 가장 현실적이다.

1. 인증 방식: 서버 세션 + HttpOnly 쿠키
2. role: `admin`, `user`
3. 관리자만 가능한 것:
   - 회원 목록 조회
   - 사용자 제한/해제
   - 사이트 추가/수정/삭제
   - 삭제 요청 허용/거부
4. 일반 사용자가 가능한 것:
   - 로그인
   - 로그 조회
   - summary 확인
   - 게시판 사용
   - 삭제 요청 등록
5. 승인형 삭제 대상:
   - 우선 `log`만

이렇게 해야 P0 범위가 폭주하지 않는다.

---

## 3. P1. PostgreSQL 스키마 관리 정리

### 목표

현재 startup에서 테이블 생성/컬럼 보정을 하는 방식을 Alembic 중심 정식 마이그레이션 체계로 바꾼다.

### 왜 중요한가

- 현재 PostgreSQL을 쓰는데 migration 관리가 약하다.
- 런타임 `ALTER TABLE`은 추적과 재현성이 떨어진다.
- 운영/배포/롤백이 어려워진다.

### 변경 대상 파일

- [alembic/env.py](/root/2026_project/alembic/env.py:1)
- [alembic.ini](/root/2026_project/alembic.ini:1)
- [app/models.py](/root/2026_project/app/models.py:1)
- [app/core/lifecycle.py](/root/2026_project/app/core/lifecycle.py:1)
- [app/db.py](/root/2026_project/app/db.py:1)
- [deploy/run.sh](/root/2026_project/deploy/run.sh:1)
- 새 파일: `alembic/versions/*.py`

### 파일별 수정 목적

- `alembic/env.py`
  - `target_metadata` 연결
  - 현재 모델과 DB 연결
- `models.py`
  - FK, unique, index, nullable 정책 반영
- `lifecycle.py`
  - `ensure_schema_updates()` 축소 또는 제거
- `run.sh`
  - startup 전 migration 실행 여부 결정
- `alembic/versions/*`
  - 초기 PostgreSQL 기준 스키마 revision 작성

### 구현 순서

1. 현재 PostgreSQL DB 실제 스키마 확인
2. ORM 모델과 실제 스키마 차이 정리
3. Alembic 연결 설정
4. 초기 기준 revision 생성
5. `uploaded_logs`, `storage_sites`, `users`, `request_posts`, `bug_posts` 제약 보강
6. startup `ALTER TABLE` 제거
7. 배포 스크립트에서 migration 실행 절차 추가

### 추가로 넣어야 할 DB 개선 후보

- `storage_sites(storage_name, name)` unique
- `uploaded_logs.site_id -> storage_sites.id` FK
- `users.username` unique는 유지
- 주요 조회 컬럼 인덱스
  - `uploaded_logs.created_at`
  - `uploaded_logs.storage_name`
  - `uploaded_logs.site_id`
- JSON 문자열 필드 재설계

### 완료 조건

- 신규 환경에서 Alembic migration만으로 DB 구성 가능
- startup 시 임시 `ALTER TABLE` 없음
- 스키마 변경 이력이 revision으로 관리됨

### 선행 결정 사항

- 기존 데이터 손상 없이 migration할 전략
- JSONB 전환 여부

### 리스크

- 운영 DB에 이미 있는 데이터와 migration 충돌 가능
- FK 추가 시 과거 데이터 정합성 문제 드러날 수 있음

---

## 4. P2. 로그/summary 저장 구조 재설계

### 목표

현재의 "DB 메타데이터 + 파일명 규칙 기반 summary 파일" 구조를 안정적으로 바꾼다.

### 왜 중요한가

- 현재 가장 큰 데이터 정합성 리스크가 이 영역에 있다.
- 업로드, summary 생성, 삭제가 원자적으로 보장되지 않는다.
- summary 파일을 filename 규칙으로 찾는 구조는 취약하다.

### 변경 대상 파일

- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:1)
- [app/models.py](/root/2026_project/app/models.py:14)
- [app/parser_netapp.py](/root/2026_project/app/parser_netapp.py:1)
- [app/core/paths.py](/root/2026_project/app/core/paths.py:1)
- [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- [app/schemas/payloads.py](/root/2026_project/app/schemas/payloads.py:1)
- Alembic migration 파일

### 파일별 수정 목적

- `models.py`
  - `summary_path` 또는 `summary_text` 저장 구조 추가
  - `manual_fields_json`, `note` 재구조화
- `log_service.py`
  - 업로드/파싱/파일 저장/DB 저장을 단계별 함수로 분리
  - 삭제 작업도 복구 가능한 순서로 정리
- `parser_netapp.py`
  - 파서 결과 구조 표준화
- `payloads.py`
  - manual fields, special notes 구조 명시 강화

### 구현 대안

#### 대안 A. summary 파일 유지 + DB에 summary 경로 저장

장점:

- 현재 구조와 가장 가깝다
- 변경 범위가 상대적으로 작다

단점:

- 여전히 파일 시스템 의존성이 크다

#### 대안 B. summary JSON을 DB에 저장

장점:

- summary 조회가 안정적
- DB 질의와 백업이 쉬워진다

단점:

- DB 용량 증가
- 마이그레이션 난이도 증가

### 추천

중기적으로는 대안 B가 더 낫다.  
하지만 1차 안정화는 대안 A로 들어가고, 이후 JSONB 전환을 2단계로 하는 것도 현실적이다.

### 구현 순서

1. `uploaded_logs`에 summary 메타 컬럼 추가
2. 업로드 함수에서 summary 저장 책임 분리
3. 실패 시 보정/정리 함수 추가
4. 조회 함수가 filename 규칙 대신 컬럼 기반으로 summary 접근
5. 삭제 함수가 DB/파일 정합성 고려하도록 개선
6. orphan 파일 점검 스크립트 설계

### 완료 조건

- summary 파일 위치를 DB가 명확히 알고 있음
- 업로드/삭제 실패 시 정합성 깨짐이 줄어듦
- 조회 시 filename 규칙 의존 제거

### 선행 결정 사항

- summary를 파일로 둘지 DB로 옮길지
- manual fields/note를 JSONB로 바꿀지 별도 테이블로 분리할지

### 리스크

- 과거 데이터 마이그레이션 필요
- 파일과 DB 상태가 이미 불일치한 데이터가 있을 수 있음

---

## 5. P3. 테스트 체계 복구

### 목표

현재 코드와 어긋난 테스트를 정리하고, 핵심 기능을 회귀 테스트로 보호한다.

### 왜 중요한가

- 지금은 리팩토링하기 전에 안전망이 거의 없다.
- parser와 log service는 조금만 건드려도 예상치 못한 회귀가 날 가능성이 크다.

### 변경 대상 파일

- [tests/conftest.py](/root/2026_project/tests/conftest.py:1)
- [tests/test_auth.py](/root/2026_project/tests/test_auth.py:1)
- [tests/test_sites.py](/root/2026_project/tests/test_sites.py:1)
- [tests/test_logs.py](/root/2026_project/tests/test_logs.py:1)
- [tests/test_boards.py](/root/2026_project/tests/test_boards.py:1)
- [tests/test_admin.py](/root/2026_project/tests/test_admin.py:1)
- [tests/test_parser_netapp.py](/root/2026_project/tests/test_parser_netapp.py:1)

### 파일별 수정 목적

- `conftest.py`
  - 분리된 test DB 및 업로드 디렉토리 fixture 구성
- `test_parser_netapp.py`
  - 파서 핵심 케이스 fixture화
- `test_logs.py`
  - 업로드/조회/삭제/summary 생성 및 실패 경로 검증
- `test_auth.py`
  - 로그인/승인/비밀번호 변경 테스트
- `test_sites.py`
  - 사이트 권한 정책 테스트
- `test_boards.py`
  - 게시판 공용 수정/삭제 정책 테스트
- `test_admin.py`
  - 관리자 세션/삭제 요청 reject/비활성화 테스트

### 구현 순서

1. 기존 깨진 테스트를 현행 구조에 맞게 폐기 또는 재작성
2. parser 단위 테스트 작성
3. auth/service/API 테스트 작성
4. 게시판/관리자/실패 경로 테스트 확장
5. 테스트 DB 전략 정리
6. 배포 전 기본 테스트 세트 정의

### 완료 조건

- 핵심 API와 parser에 대해 회귀 테스트 존재
- 리팩토링 전/후 동작 비교 가능

### 선행 결정 사항

- 테스트에서 PostgreSQL 실DB를 쓸지
- 격리된 docker DB를 쓸지

### 리스크

- 테스트 인프라 설계가 늦어지면 이후 작업 속도가 느려짐

---

## 6. P4. 프론트 구조 분리

### 목표

현재 거대한 `app.js`를 기능별 책임으로 나누고 유지보수 가능 상태로 만든다.

### 왜 지금 해야 하는가

- 저장 구조와 인증이 정리된 뒤 프론트를 나누는 것이 안전하다.
- 현재는 상태 변경 포인트가 너무 많다.

### 변경 대상 파일

- [app/static/app.js](/root/2026_project/app/static/app.js:1)
- [app/static/app.css](/root/2026_project/app/static/app.css:1)
- [app/templates/index.html](/root/2026_project/app/templates/index.html:1)
- 새 파일 후보:
  - `app/static/js/auth.js`
  - `app/static/js/logs.js`
  - `app/static/js/sites.js`
  - `app/static/js/boards.js`
  - `app/static/js/history.js`
  - `app/static/js/api.js`
  - `app/static/js/state.js`

### 파일별 수정 목적

- `app.js`
  - 진입점 역할만 남기고 모듈 import/초기화로 축소
- `api.js`
  - fetch 래퍼, auth 에러 처리 공통화
- `state.js`
  - 전역 상태 구조 모듈화
- `logs.js`
  - 로그 목록/상세/summary 탭/이벤트 관리
- `boards.js`
  - 요청/버그 게시판 분리
- `history.js`
  - 브라우저 상태 관리 단독 모듈화

### 구현 순서

1. 상태 정의와 API 호출 분리
2. 인증 관련 이벤트 분리
3. 사이트/로그 렌더링 분리
4. 게시판 분리
5. history 로직 분리
6. 템플릿 내 스크립트 로딩 정리

### 완료 조건

- `app.js`가 더 이상 거대한 단일 파일이 아님
- 기능별 변경 영향 범위가 줄어듦

### 선행 결정 사항

- 계속 바닐라 JS 모듈로 갈지
- 번들러 도입 여부

### 리스크

- DOM selector와 상태 참조가 얽혀 있어 분리 과정에서 회귀 가능

---

## 7. P5. 기능별 UX 개선

### 목표

현재 기능은 있지만 운영자가 빠르게 탐색/관리하기에는 부족한 부분을 보강한다.

### 세부 작업 묶음

#### P5-1. 로그 목록 개선

변경 대상 파일:

- [app/static/app.js](/root/2026_project/app/static/app.js:1)
- [app/static/app.css](/root/2026_project/app/static/app.css:1)
- [app/templates/index.html](/root/2026_project/app/templates/index.html:1)
- [app/api/log_routes.py](/root/2026_project/app/api/log_routes.py:1)
- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:217)

수정 목적:

- 검색
- 정렬
- 날짜/사이트 필터
- 페이지네이션

구현 순서:

1. 서버 API에 페이지/검색 파라미터 추가
2. 프론트 검색창/정렬 UI 추가
3. 페이지네이션 상태 반영

#### P5-2. summary 보기 개선

변경 대상 파일:

- `app.js`
- `app.css`
- `index.html`
- `log_service.py`

수정 목적:

- overview/section 전환 가독성 향상
- Event log 렌더링 일관화
- 큰 텍스트 영역 성능 개선

#### P5-3. 게시판 UX 개선

변경 대상 파일:

- `app.js`
- `app.css`
- `board_service.py`
- `models.py`

수정 목적:

- 필터 강화
- 상태/우선순위/담당자
- 이력 또는 댓글 기능 검토

### 완료 조건

- 운영자가 로그/게시판을 더 빠르게 탐색 가능
- 전체 목록 재조회 비용 완화

### 리스크

- 서버 API 확장과 프론트 상태 변경이 동시에 필요

---

## 8. P6. 운영성/관측성 강화

### 목표

장애 상황을 더 빨리 발견하고, 운영 중 데이터 이상을 더 쉽게 추적할 수 있게 만든다.

### 변경 대상 파일

- [app/api/web_routes.py](/root/2026_project/app/api/web_routes.py:1)
- [app/services/log_service.py](/root/2026_project/app/services/log_service.py:1)
- [deploy/run.sh](/root/2026_project/deploy/run.sh:1)
- 새 파일 후보:
  - `app/core/logging.py`
  - `scripts/check_orphan_files.py`
  - `scripts/validate_uploads.py`

### 파일별 수정 목적

- `web_routes.py`
  - health check 확장
- `log_service.py`
  - 업로드/삭제/파싱 실패 로그 추가
- 새 스크립트
  - DB-파일 정합성 점검 도구
  - orphan 파일 탐지

### 구현 순서

1. 구조화 로그 포맷 도입
2. 업로드/삭제 실패 로그 추가
3. health check 확장
4. 파일 정합성 점검 스크립트 작성
5. 운영 문서 보강

### 완료 조건

- 장애 시 확인 경로가 분명함
- upload 디렉토리와 DB 상태를 점검할 수 있음

### 리스크

- 로그만 늘고 실제 활용 체계가 없으면 효과가 적음

---

## 9. 기능별 상세 구현 순서 제안

아래는 실제 작업을 진행할 때의 추천 순서다.

### 1단계. 인증 설계 확정

- 쿠키 세션 or JWT 결정
- role 정책 결정
- 관리자 정책 결정

### 2단계. DB 마이그레이션 기반 마련

- Alembic 연결
- PostgreSQL 스키마 확정
- migration 초안 생성

### 3단계. auth 서버 구현

- 로그인/로그아웃/현재 사용자
- 보호 API 연결

### 4단계. 업로드/summary 저장 구조 개선

- summary 경로 저장
- manual fields/note 구조 개선
- 삭제/복구 전략 적용

### 5단계. 테스트 복구

- parser
- auth
- logs
- boards

### 6단계. 프론트 리팩토링

- API/state 분리
- auth/logs/boards/sites/history 모듈화

### 7단계. UX 개선

- 검색/정렬/페이지네이션
- summary 개선
- 게시판 개선

### 8단계. 운영 도구 강화

- health 확장
- 정합성 점검 스크립트
- 운영 문서 업데이트

---

## 10. 작업 묶음별 예상 영향 범위

### 영향도가 매우 큰 작업

- 인증 구조 도입
- Alembic 전환
- `uploaded_logs` 스키마 변경
- `app.js` 분리

### 영향도가 중간인 작업

- summary 렌더링 개선
- 게시판 필드 확장
- 사이트 제약 강화

### 영향도가 낮은 작업

- health check 확장
- 운영 스크립트 추가
- 로그 메시지 보강

---

## 11. 먼저 결정해야 하는 항목

구현을 시작하기 전에 아래는 꼭 결정하는 것이 좋다.

1. 인증 방식은 무엇인가
2. role 모델을 어디까지 세분화할 것인가
3. summary를 파일 중심으로 둘지 DB 중심으로 둘지
4. `manual_fields_json` / `note`를 JSONB로 갈지 별도 테이블로 갈지
5. migration을 언제부터 강제할지
6. 테스트 DB 전략을 무엇으로 할지
7. 프론트 리팩토링을 바닐라 모듈 수준에서 끝낼지

---

## 12. 구현 시작 시 권장 첫 작업

가장 먼저 실제 구현에 들어간다면 이 순서를 권장한다.

1. `plan.md` 승인
2. 인증 방식 결정
3. DB 스키마 목표안 작성
4. Alembic 연결
5. auth skeleton 구현
6. 테스트 scaffold 생성

이 순서로 가면 가장 위험한 부분부터 줄이면서 이후 기능 개선을 안전하게 이어갈 수 있다.

---

## 13. 한 줄 결론

이 프로젝트의 다음 구현은 "기능 추가"보다 "운영 안정화"가 먼저다.  
가장 높은 우선순위는 인증/인가, PostgreSQL migration, 로그/summary 저장 구조 안정화이며, 프론트 개선은 그 이후에 진행하는 것이 전체 리스크를 가장 낮춘다.
