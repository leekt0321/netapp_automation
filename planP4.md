# P4 Why Now

작성일: 2026-04-15  
기준:

- [plan.md](/root/2026_project/plan.md:1)
- [research.md](/root/2026_project/research.md:1)
- [research2.md](/root/2026_project/research2.md:1)
- [planP1.md](/root/2026_project/planP1.md:1)
- [planP2.md](/root/2026_project/planP2.md:1)
- [planP3.md](/root/2026_project/planP3.md:1)
- [app/static/app.js](/root/2026_project/app/static/app.js:1)
- [app/static/app.css](/root/2026_project/app/static/app.css:1)
- [app/templates/index.html](/root/2026_project/app/templates/index.html:1)

이 문서는 "P4. 프론트 구조 분리"를 왜 지금 해야 하는지에 집중해서 정리한 문서다.  
핵심은 새 UI를 만드는 것이 아니라, 현재 거대한 단일 프론트 파일 구조를 유지보수 가능한 형태로 분리해 이후 변경 비용과 회귀 위험을 줄이는 데 있다.

---

## 1. 결론

P4를 지금 해야 하는 이유는, 현재 프론트엔드가 기능적으로는 충분히 동작하지만
"한 파일 안에 너무 많은 책임이 섞여 있는 상태"이기 때문이다.

현재 코드 규모만 봐도 신호가 분명하다.

- [app/static/app.js](/root/2026_project/app/static/app.js:1): 약 2,199줄
- [app/static/app.css](/root/2026_project/app/static/app.css:1): 약 1,059줄
- [app/templates/index.html](/root/2026_project/app/templates/index.html:1): 약 848줄

지금 `app.js`는 사실상 아래 역할을 한 번에 하고 있다.

- 로그인/로그아웃/회원가입/비밀번호 변경
- 권한별 UI 노출 제어
- 사이트 목록/사이트 관리
- 로그 목록/상세/summary/특이사항
- 삭제 요청 생성
- 관리자 세션/삭제 요청 검토
- 게시판/버그 게시판 CRUD
- 브라우저 history 상태 관리
- 전역 상태 저장과 렌더링

즉 현재 구조는 "작동하는 단일 파일"이지,
"안전하게 계속 확장할 수 있는 구조"는 아니다.

그래서 P4의 목적은 다음 한 줄로 요약할 수 있다.

- 현재 프론트엔드를 기능별 책임 단위로 나눠, 이후 수정이 국소적으로 끝나고 회귀 위험을 줄일 수 있는 구조로 바꾸는 것

즉 P4는 디자인 작업이 아니라

- 유지보수성 개선
- 변경 영향 범위 축소
- 디버깅 비용 절감

을 위한 구조 작업이다.

---

## 2. 현재 프론트 구조가 왜 문제인가

### 2.1 `app.js` 한 파일에 책임이 너무 많이 몰려 있다

[app/static/app.js](/root/2026_project/app/static/app.js:1) 는 현재 사실상 전체 웹앱의 컨트롤 타워 역할을 하고 있다.

실제로 이 파일 안에는 아래 같은 종류의 함수와 이벤트가 한꺼번에 섞여 있다.

- auth 관련
  - `openApp`
  - `restoreSession`
  - `logoutCurrentUser`
  - `submitChangePassword`
- admin 관련
  - `loadUsers`
  - `loadActiveSessions`
  - `loadDeletionRequests`
  - `reviewDeletionRequest`
- sites/logs 관련
  - `loadSites`
  - `loadLogs`
  - `renderStoragePage`
  - `loadRawLog`
  - `loadSummary`
  - `requestSelectedLogDeletion`
- boards 관련
  - `loadRequestPosts`
  - `loadBugPosts`
  - `deleteRequestPost`
  - `deleteBugPost`
- history/state 관련
  - `showPage`
  - `getHistoryStateSnapshot`
  - `syncHistoryState`
  - `applyHistoryState`

문제는 기능이 많다는 것 자체가 아니라,
이 기능들이 공통 상태와 DOM 참조를 통해 강하게 엮여 있다는 점이다.

즉 한 부분을 바꾸면 다른 부분에 어떤 영향을 주는지
파일만 읽어서는 즉시 파악하기 어렵다.

---

### 2.2 렌더링, 상태, API 호출이 한 곳에 섞여 있다

현재 프론트 로직은 아래 세 층이 명확히 분리되어 있지 않다.

1. API 호출
2. 전역 상태 변경
3. DOM 렌더링/이벤트 처리

예를 들면 한 함수 안에서:

- `fetch()` 호출
- 응답 해석
- 전역 변수 수정
- 여러 DOM 엘리먼트 업데이트

가 연속해서 일어나는 구간이 많다.

이 구조의 문제:

- 테스트나 디버깅이 어려움
- API 계약이 바뀌었을 때 영향 범위가 넓음
- 상태 버그와 렌더링 버그가 같이 섞여서 보임
- 함수 이름만 보고는 책임 범위를 알기 어려움

즉 지금은 기능은 있지만, 구조적 경계가 흐린 상태다.

---

### 2.3 history와 화면 상태가 강하게 얽혀 있다

최근 개선으로 브라우저 뒤로가기/로그 상세 탐색 UX가 좋아졌지만,
그만큼 history/state/UI가 더 밀접하게 연결됐다.

관련 코드:

- [app/static/app.js](/root/2026_project/app/static/app.js:958) `showPage`
- [app/static/app.js](/root/2026_project/app/static/app.js:2086) `getHistoryStateSnapshot`
- [app/static/app.js](/root/2026_project/app/static/app.js:2103) `syncHistoryState`
- [app/static/app.js](/root/2026_project/app/static/app.js:2127) `applyHistoryState`

이 영역은 특히 리팩토링하기 까다로운데,
지금처럼 다른 렌더링 로직과 붙어 있으면
작은 수정이 탐색 UX 전체를 흔들 수 있다.

즉 history는 별도 모듈 책임으로 떼는 편이 훨씬 안전하다.

---

### 2.4 권한별 노출 로직이 여러 기능에 흩어져 있다

P0를 통해 권한 모델은 많이 정리됐지만,
프론트에서는 여전히 `isAdmin()`, `isAuthenticated()`, `applyRolePermissions()` 같은 로직이
여러 기능에 걸쳐 분산돼 있다.

이 구조의 문제:

- 일반 사용자/관리자 화면 차이를 수정할 때 여러 군데를 같이 봐야 함
- 버튼 노출 조건과 실제 동작 조건이 다시 어긋날 위험이 있음
- 스토리지1/2/3처럼 비슷한 화면에서 권한 차이가 일관되지 않게 들어갈 수 있음

즉 권한 정책이 이미 정리된 지금,
프론트도 그 정책을 더 일관된 구조로 맞춰야 한다.

---

## 3. 왜 지금 P4인가

### 3.1 P0, P1, P2, P3가 끝나서 이제 프론트를 나눌 기준이 생겼다

지금까지 진행된 상태:

- P0: 인증/권한 정책 정리
- P1: DB/migration 기준 정리
- P2: 로그/summary 저장 구조 정리
- P3: 핵심 회귀 테스트 체계 확보

즉 지금은 프론트를 나눌 때 기준이 되는 계약이 이전보다 훨씬 명확하다.

예를 들면:

- auth 정책이 확정됨
- 사이트/로그/삭제 요청 API의 기대값이 더 안정됨
- 테스트로 최소 회귀 세트가 생김

이 상태에서 프론트를 나누면
"구조를 바꾸되, 기존 기능을 유지하는 작업"을 더 안전하게 진행할 수 있다.

반대로 이 이전에 P4를 먼저 했으면:

- 권한 정책이 계속 흔들리고
- 저장 구조가 계속 바뀌고
- 테스트도 약한 상태라

리팩토링 비용이 훨씬 더 컸을 가능성이 높다.

즉 P4는 지금이 적기다.

---

### 3.2 다음 단계 UX 개선(P5)을 안전하게 하려면 먼저 구조를 나눠야 한다

P5는 기능별 UX 개선이다.

예를 들면:

- 로그 목록 검색/정렬/페이지네이션
- summary 보기 개선
- 게시판 UX 강화

그런데 지금 구조에서 바로 P5부터 들어가면,
기능 추가가 곧 `app.js` 덩치 증가로 이어질 가능성이 높다.

즉 지금 구조를 유지한 채 UX만 계속 붙이면,
앞으로는 수정이 더 어렵고 회귀가 더 많아진다.

그래서 P4는 P5를 하기 전의 구조 정리 단계로 보는 것이 맞다.

---

### 3.3 현재는 "기능 추가 비용"보다 "이해 비용"이 더 커지고 있다

프론트 코드가 커지면 보통 두 종류의 비용이 생긴다.

1. 구현 비용
- 기능을 실제로 만드는 시간

2. 이해 비용
- 어디를 고쳐야 하는지 찾는 시간
- 이 수정이 어디를 건드리는지 파악하는 시간

지금은 후자가 점점 커지는 단계다.

예를 들어 작은 UI 수정 하나를 하더라도:

- 어느 전역 상태를 보는지
- 어떤 렌더 함수가 관련 있는지
- 어느 이벤트 리스너가 함께 작동하는지

를 먼저 파악해야 한다.

즉 P4는 "코드를 예쁘게 만드는 작업"이 아니라,
"이해 비용이 구현 비용보다 커지기 전에 구조를 정리하는 작업"이다.

---

## 4. 지금 미루면 생기는 문제

### 4.1 `app.js`가 더 커지고 더 나누기 어려워진다

현재도 이미 2천 줄이 넘는다.

이 상태에서:

- P5 UX 개선
- 관리자 기능 추가
- 로그 보기 개선

이 계속 같은 파일에 붙으면,
나중에는 분리가 아니라 거의 재작성에 가까운 비용이 들 수 있다.

즉 지금 손보는 것이 가장 싸다.

---

### 4.2 권한/UI 회귀가 다시 늘어날 수 있다

최근에도 스토리지1/2/3에서

- 사이트 목록이 보이느냐
- 사이트 관리가 관리자 전용으로 숨겨지느냐

같은 정책이 화면별로 엇갈리면서 여러 번 조정됐다.

이건 단순 실수가 아니라,
구조상 비슷한 로직이 여러 위치에 퍼져 있어서 생기기 쉬운 문제다.

즉 P4를 미루면 앞으로도 같은 종류의 UI 권한 회귀가 반복될 가능성이 있다.

---

### 4.3 버그 수정이 점점 부분 수리가 아니라 전체 수리가 된다

현재처럼 로직이 강하게 얽힌 상태에서는
작은 버그도 고치기 전에 전체 흐름을 넓게 읽어야 한다.

그러면:

- 수정 속도가 느려지고
- 자신 있게 고치기 어려워지고
- 같은 버그가 다른 화면에서 반복되기 쉽다.

즉 구조를 나누지 않으면
버그 수정조차 점점 비싸진다.

---

## 5. P4가 해결하려는 핵심 문제

P4가 해결하려는 핵심은 아래 다섯 가지다.

1. `app.js` 단일 파일 과대화
2. API 호출/상태/렌더링 책임 혼재
3. 권한/UI 로직의 분산
4. history와 화면 상태의 결합
5. 기능 수정 시 영향 범위가 지나치게 넓은 문제

즉 P4의 본질은:

- "프론트 기능을 기능별 모듈 계약으로 다시 나누는 것"

이다.

---

## 6. P4가 끝나면 얻는 것

### 개발 측면

- 기능별 수정 범위가 줄어듦
- 코드 탐색 속도가 빨라짐
- 버그 위치를 찾기 쉬워짐
- 신규 기능 추가가 덜 부담스러워짐

### 품질 측면

- 권한/UI 회귀 가능성 감소
- 같은 종류의 화면이 더 일관되게 동작
- API 응답 변경 시 대응 위치가 더 명확해짐

### 다음 단계 연계

- P5 UX 개선 작업이 더 안전해짐
- P6 운영성/관측성 관련 프론트 확장도 쉬워짐
- 필요하면 나중에 번들러/프레임워크 도입 판단도 쉬워짐

---

## 7. P4는 무엇을 하지 않는가

P4 범위를 분명히 할 필요가 있다.

P4는 아래를 주로 다룬다.

- 프론트 JS 책임 분리
- 공통 API 호출 계층 정리
- 전역 상태 구조 정리
- history 로직 분리
- 기능별 렌더링/이벤트 분리

반면 아래는 P4의 핵심 목표가 아니다.

- UI 디자인 전면 교체
- CSS 디자인 시스템 전면 재설계
- React/Vue 같은 프레임워크 즉시 도입
- 빌드 파이프라인 전면 재작성

즉 P4는 "프론트를 새로 만드는 단계"가 아니라,
"현재 바닐라 JS 구조를 유지보수 가능한 단위로 나누는 단계"다.

---

## 8. 현재 코드 기준 P4 필요성을 가장 잘 보여주는 파일

### [app/static/app.js](/root/2026_project/app/static/app.js:1)

이 파일이 P4 필요성의 가장 직접적인 근거다.

이유:

- auth
- sites
- logs
- boards
- admin
- history
- global state

가 모두 여기에 섞여 있기 때문이다.

즉 P4는 사실상 이 파일을
"진입점 + 기능별 모듈" 구조로 바꾸는 작업이라고 봐도 된다.

### [app/templates/index.html](/root/2026_project/app/templates/index.html:1)

현재 템플릿도 큰 단일 구조라,
프론트 분리 시 어떤 DOM 영역이 어떤 모듈 책임인지 함께 정리할 필요가 있다.

즉 JS 분리와 템플릿 책임 구분은 같이 가야 한다.

### [app/static/app.css](/root/2026_project/app/static/app.css:1)

현재 CSS도 상당히 큰 편이고,
화면별 스타일과 공통 스타일의 경계가 계속 중요해질 수 있다.

P4의 주 대상은 JS지만,
필요하면 CSS도 공통/기능별 책임을 같이 정리할 수 있다.

---

## 9. 최종 판단

P4를 지금 해야 하는 이유는 명확하다.

- 백엔드의 권한/스키마/저장 구조는 어느 정도 정리됐고
- 테스트 기반도 생겼다.
- 이제 남은 큰 병목은 프론트 단일 파일 구조다.

이 상태에서 P4를 미루면:

- 이후 UX 개선이 전부 `app.js` 비대화로 이어지고
- 권한/UI 회귀가 반복되고
- 작은 수정도 점점 비싸진다.

따라서 P4는 단순 리팩토링이 아니라,

- 이후 기능 작업 속도를 유지하고
- 프론트 변경을 안전하게 만들기 위한
- 구조 안정화 작업

으로 보는 것이 맞다.

한 줄로 요약하면:

P4는 지금 프로젝트에서 "동작은 하지만 너무 많은 책임이 한 파일에 몰린 프론트"를 끝내고,  
"기능별로 고칠 수 있는 프론트 구조"로 넘어가기 위해 반드시 필요한 단계다.

===============

## 진행 후 해결된 부분

P4 1차 작업을 통해 아래 항목이 실제 코드 수준에서 정리되었다.

### 1. 프론트 공통 상수를 별도 모듈로 분리함

[app/static/js/constants.js](/root/2026_project/app/static/js/constants.js:1) 를 추가해서 아래를 별도 관리하게 했다.

- `STORAGE_KEYS`
- `MANUAL_FIELD_KEYS`
- `SESSION_USER_STORAGE_KEY`
- `ADMIN_REFRESH_INTERVAL_MS`
- `pageMeta`

즉 이제 스토리지 종류, 수동 입력 필드, 페이지 메타 정보 같은 전역 상수가
더 이상 `app.js` 본문 중간에 섞여 있지 않다.

### 2. 공통 유틸 함수를 별도 모듈로 분리함

[app/static/js/utils.js](/root/2026_project/app/static/js/utils.js:1) 를 추가해서 아래 함수들을 분리했다.

- `escapeHtml`
- `formatBytes`
- `formatDate`
- `toStorageLabel`
- `getStatusBadgeClass`
- `createEmptyManualFields`
- `isDesktopLogSplitView`

이 함수들은 UI 여러 곳에서 공통으로 쓰이는데,
이제 렌더링 본문과 섞여 있지 않고 재사용 가능한 유틸 계층으로 분리됐다.

### 3. DOM 참조와 스토리지 뷰 구성을 별도 모듈로 분리함

[app/static/js/dom.js](/root/2026_project/app/static/js/dom.js:1) 를 추가해서
페이지 전역 DOM 참조와 스토리지별 DOM 매핑 로직을 분리했다.

주요 내용:

- 로그인/회원/게시판/업로드 관련 DOM 참조 export
- `createStorageViews()`로 스토리지별 화면 요소 구성

즉 이제 `app.js`가 직접 수십 개의 `document.getElementById` 와
스토리지별 요소 맵 생성 코드를 떠안고 있지 않게 됐다.

### 4. `app.js`를 모듈 기반 진입점으로 전환함

[app/static/app.js](/root/2026_project/app/static/app.js:1) 는 이제

- 상수 import
- 유틸 import
- DOM 참조 import

를 통해 동작하는 진입점 성격으로 바뀌었다.

이번 1차 작업으로 `app.js`에서 제거된 대표 영역:

- 상수 정의 블록
- DOM 참조 선언 블록
- 공통 유틸 함수 블록

즉 `app.js`는 여전히 큰 파일이지만,
최소한 "모든 기초 요소를 한 파일 안에 직접 정의하는 상태"는 벗어났다.

### 5. 상태 초기화 로직도 별도 모듈로 분리함

[app/static/js/state.js](/root/2026_project/app/static/js/state.js:1) 를 추가해서

- 스토리지별 기본 상태
- 앱 전역 기본 상태

를 생성하는 로직을 분리했다.

즉 이제 `storageState`, 앱 전역 상태의 초기값 정의가
`app.js` 본문 내부에 직접 박혀 있지 않다.

### 6. 공통 API 호출 래퍼를 별도 모듈로 분리함

[app/static/js/api.js](/root/2026_project/app/static/js/api.js:1) 를 추가해서

- `getJson`
- `postJson`
- `putJson`
- `deleteJson`
- `postForm`

을 공통화했다.

지금은 `app.js`의 여러 auth/admin/site/log/board 호출이 이 래퍼를 사용하도록 바뀌었다.

즉 fetch 옵션과 JSON 파싱 세부 구현이
개별 기능 코드에서 조금씩 빠져나오기 시작했다.

### 7. history 로직을 별도 모듈로 분리함

[app/static/js/history.js](/root/2026_project/app/static/js/history.js:1) 를 추가해서

- history snapshot 생성
- `pushState` / `replaceState` 동기화
- popstate 적용

의 핵심 로직을 분리했다.

즉 최근 복잡도가 높아졌던 브라우저 뒤로가기/상태 복원 로직도
이제 `app.js` 안의 직접 구현에서 한 단계 분리된 상태가 되었다.

### 8. 템플릿 스크립트 로딩도 모듈 기준으로 정리함

[app/templates/index.html](/root/2026_project/app/templates/index.html:846) 의 스크립트 로딩을
`type="module"` 기준으로 변경했고, 버전 문자열도 갱신했다.

즉 브라우저가 새 모듈 구조를 정상적으로 읽을 수 있는 기반이 마련됐다.

### 9. 기존 회귀 테스트는 유지됨

검증 결과:

- `.venv` 기준 `pytest` 실행 성공
- 총 `12 passed`

즉 이번 P4 1차 분리 작업이 기존 백엔드 핵심 흐름을 깨뜨리지 않았다는 점까지는 확인했다.

### 10. 현재 해결된 범위와 남은 범위

현재 해결된 것:

- 공통 상수 분리
- 공통 유틸 분리
- DOM 참조/스토리지 뷰 구성 분리
- 상태 초기화 로직 분리
- 공통 API 호출 래퍼 분리
- history 로직 분리
- `app.js` 모듈 기반 진입점 전환
- 템플릿 스크립트 모듈 로딩 전환

아직 남아 있는 것:

- auth/site/log/board/admin 렌더링과 이벤트 로직을 기능별 모듈로 더 세분화하는 작업
- 전역 상태 업데이트 자체를 모듈 경계에 맞게 더 줄이는 작업
- 필요 시 CSS도 공통/기능별 책임 단위로 정리

즉 이번 P4 작업은 "프론트 분리를 시작할 수 있는 모듈 기반 뼈대 마련"을 넘어서,
"공통 기반 계층(constants/utils/dom/state/api/history) 정리"까지 완료된 상태라고 보는 것이 정확하다.
