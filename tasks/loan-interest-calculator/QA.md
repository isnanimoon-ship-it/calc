# QA: 대출 이자 계산기 (loan-interest-calculator)

검토 대상: `src/calculators/loan-interest-calculator/` 전체(`ui.tsx`, `logic/*`, `validation.ts`,
`formatting.ts`, `content.ts`, `types.ts`), `src/calculators/registry.ts`(등록 상태),
`app/calculators/[slug]/page.tsx`(라우팅). Calculation Auditor(PASS)·UX/UI Critic(PASS, Medium
2건/Low 4건) 완료 후 QA 진행. Edit 권한이 없어 코드를 수정하지 않았고, 아래 이슈는 모두 실행/
정적 검토로 확인한 관찰 사항이다.

### 검증 방법 요약
- 회귀 스위트: `npx vitest run --no-file-parallelism`(전체), `npx tsc --noEmit`, `npm run build`.
- 계산기 전용 스위트: `npx vitest run src/calculators/loan-interest-calculator --no-file-parallelism`.
- 실행 중인 dev 서버(`http://localhost:3000`, 기존 PID 22372, Next 16.3.4 Turbopack)에 대해
  `curl`로 `/calculators/loan-interest-calculator` SSR HTML을 받아 label/aria 연결을 직접 대조.
- 이 환경에는 Playwright/Puppeteer 등 브라우저 자동화 도구가 설치돼 있지 않아(설치 시도 결과
  `npx playwright` 패키지 없음, 설치 승인 없이 진행하지 않음), 실제 브라우저 뷰포트 렌더링·
  DevTools 콘솔은 직접 관찰하지 못했다. 대신 (1) 코드/Tailwind 클래스 정적 분석,
  (2) React Testing Library(jsdom) 기반 임시 프로브 테스트(세션 스크래치패드에서 작성,
  프로젝트 루트에 임시 복사해 실행 후 즉시 삭제 — 소스 트리에 아무 것도 남기지 않음)로
  기능·입력검증·공유 상태 복원·콘솔 경고를 확인했다. 320/375/390/768/1440px 실측은 코드상
  브레이크포인트(`sm:hidden`/`hidden sm:block`, `grid-cols-2`, `sm:grid-cols-3`)와 이미
  프로덕션에 배포된 동일 패턴(four-major-insurance, severance-pay 등)의 선례를 근거로 판단했다
  — 이 부분은 실기기 확인이 추가로 필요하다는 점을 "발견된 이슈"에 Low로 남긴다.

## 기능 테스트
- 계산 전: 입력 폼(원금·연이율·년/개월·상환방식) → `ShareActions`(계산기 모드) → 빈 결과 영역
  순서로 정상 렌더링됨(SPEC.md "화면 구성" 순서와 일치).
- 계산 후: 상환방식별 핵심 결과 카드(원리금균등 "매월 상환액" 단일값 / 원금균등 "첫 회차~마지막
  회차 상환액" 범위 / 만기일시 "매월 이자"+"만기 상환액" 구분) → 연도별 요약표 → 계산 방법
  breakdown → 적용된 입력값 순서로 정상 렌더링됨. 세 방식 모두 프로브 테스트로 실제 렌더링·
  숫자 확인(원리금균등 샘플: 659,956원, 원금균등: 1,120,000원~1,010,000원, 만기일시: 50,000원/
  10,050,000원) — FORMULA.md 검증 예제 값과 일치.
- **상환방식 전환 시 결과 초기화 확인(신규 확인)**: 계산 완료 후 다른 상환방식 라디오를 클릭하면
  이전 결과(핵심 결과 카드 전체)가 즉시 사라짐(`clearResult()`가 `handleRepaymentMethodChange`
  에서 호출됨) — "입력이 바뀌었는데 이전 상환방식 결과가 그대로 보이는" 불일치가 발생하지
  않음을 프로브 테스트로 확인. 문제없음.
- **초기화(Reset)**: 모든 필드가 빈 값으로 돌아가고 결과 영역이 사라짐. 기존 `ui.test.tsx`와
  프로브 테스트 양쪽에서 확인.
- **샘플 값 채우기**: FORMULA.md 검증 예제 5(1억원·연5%·20년·원리금균등) 값 그대로 채워짐 —
  `docs/DESIGN_SYSTEM.md` "Reset/Sample" 권장("가능하면 FORMULA.md 검증 예제 값을 그대로 사용")
  준수.
- **ShareActions — 계산 전/후 URL 및 상태 복원(SPEC 필수 확인 항목)**:
  - 계산 전: `url` prop이 `baseUrl`(쿼리 없는 canonical 주소)이고 `mode="calculator"` —
    공유 문구가 "계산기를 공유해 보세요" 계열 소개 문구로 정상 노출.
  - 계산 후: `buildStateShareUrl(baseUrl, { principal, annualRatePercent, termMonths,
    repaymentMethod })`로 `termMonths`(합산된 단일 정수)만 상태에 포함됨 — SPEC.md "공유
    상태에는... 대출 기간만 저장한다" 요건과 정확히 일치(년/개월 두 필드가 아니라 합산값
    하나만 인코딩).
  - **핵심 확인: "년+개월 합산값이 termMonths로 저장되고, 복원 시 다시 년/개월로 재분해되는가"
    — 정상 동작 확인(프로브 테스트로 실측)**:
    - `termMonths=246` 공유 상태 복원 → 년=20, 개월=6으로 정확히 재분해, 원금 "100,000,000"
      콤마 포맷 복원, 결과 카드도 즉시 함께 계산되어 표시됨.
    - 경계값 `termMonths=1`(0년1개월), `termMonths=480`(40년0개월) 양쪽 모두 정확히 재분해됨.
  - **강건성 확인**: 조작된 공유 상태(연이율 음수, `termMonths=481`처럼 상한을 벗어난 값)를
    담은 URL로 진입해도 `validateLoanInterestCalculatorInput`이 복원 전에 재검증해 실패하면
    `restoreRef.current`를 호출하지 않고 조용히 무시함(폼이 빈 상태 그대로 유지, 크래시·
    콘솔 에러 없음) — 확인 완료. 깨진 Base64(`?s=%%%not-valid-base64%%%`) 진입도 크래시 없이
    무시됨(`decodeShareState`가 `try/catch`로 `null` 반환).
- FAQ 아코디언: 클릭 시 개별 항목만 펼쳐지고 나머지는 접힌 상태 유지(단일 오픈), 재클릭 시
  접힘 — 정상.

## 모바일 테스트 (320 / 375 / 390 / 768 / 1440px)
실기기/브라우저 뷰포트 자동화 도구가 이 환경에 없어 **코드 정적 분석 + 동일 패턴의 기배포
계산기 선례 대조**로 판단했다(위 "검증 방법 요약" 참고). 아래는 Critical 발견 없음.
- 대출 기간 "년"/"개월" 입력: `grid-cols-2 gap-4`로 뷰포트와 무관하게 항상 2열 — 320px에서도
  각 입력이 라벨·placeholder가 잘리지 않을 만큼의 폭(대략 130px 이상)을 확보. 문제없음.
- 상환방식 선택: `grid gap-2 sm:grid-cols-3` — 640px 미만(320/375/390)에서는 암묵적 1열
  세로 스택, 640px 이상(768/1440)에서 3열. 각 버튼에 라벨+한 줄 요약이 모두 줄바꿈 가능한
  텍스트라 폭 부족으로 잘리는 요소 없음. 문제없음.
- 연도별 상환 스케줄 요약표: `sm:hidden` 카드 블록 / `hidden sm:block overflow-x-auto` 표로
  명확히 분기(`four-major-insurance` 선례와 동일 패턴). 320~390px는 카드(연차·원금합계·
  이자합계를 `grid-cols-2` dl로, 연말잔액은 상단 우측)로 전환되어 표 자체가 렌더링되지 않으므로
  가로 스크롤 유발 요소가 없음. 768/1440px는 표가 렌더링되되 `overflow-x-auto` 래퍼 안에
  있어 표 내용(`min-w-[520px]`)이 넘쳐도 컨테이너 내부 스크롤로 처리되고 페이지 레벨 가로
  스크롤은 유발하지 않음. **최대 40행(40년 만기) 렌더링도 확인** — `yearlySummary` 길이는
  `Math.ceil(termMonths/12)`이므로 `termMonths=480`일 때 정확히 40행이며, `schedule-common.ts`
  가 480회차를 12개씩 묶어 정확히 40개 그룹으로 나눔(코드 로직 확인, 480/12=40 정수 나눗셈이라
  나머지 그룹 없음).
- "적용된 입력값" `dl`은 `grid-cols-1 sm:grid-cols-2` 패턴을 쓴다 — `docs/DESIGN_SYSTEM.md`
  "모바일" 절이 명시한 "카드 그리드는 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`"과 브레이크
  포인트가 다르다(`sm` vs `md`). 다만 확인 결과 이는 이 계산기만의 이탈이 아니라
  `severance-pay`/`weekly-holiday-allowance`/`unemployment-benefit`/`housing-subscription-score`
  모두 동일하게 "결과 요약 `dl`"에는 `sm:grid-cols-2`를 쓰고, DESIGN_SYSTEM의 `md:.../lg:...`
  패턴은 카드 목록(`CalculatorCard` 그리드류)에만 적용되는 기존 사이트 전역 관행이다 — 이
  계산기가 새로 만든 이탈이 아니므로 이슈로 기록하지 않는다(정보성 확인).
- 전체 페이지 좌우 패딩은 `px-5 sm:px-8`로 320px에서도 최소 20px 여백 확보, 컨테이너는
  `max-w-6xl`이라 1440px에서도 과도하게 늘어나지 않음. 문제없음.

## 브라우저 테스트
- 사용 API: `Intl.NumberFormat`, `URL`/`URLSearchParams`, `TextEncoder`/`TextDecoder`,
  `btoa`/`atob`(`src/lib/share.ts`, 공용 코드, 이번 작업에서 신규 도입되지 않음),
  `navigator.clipboard.writeText`(폴백으로 `document.execCommand('copy')` 포함, 공용
  `ShareActions.tsx`). 모두 현재 지원 대상 브라우저(Chrome/Edge/Firefox/Safari 최신)에서
  표준으로 동작하며, 이 계산기가 새로 도입한 브라우저 API는 없음(기존 계산기와 동일한 공용
  인프라만 재사용).
- Turbopack 프로덕션 빌드(`npm run build`) 성공, TypeScript 컴파일 오류 없음 — 특정 브라우저
  타깃에서만 깨지는 트랜스파일 이슈 소지가 낮음.
- 실제 Chrome/Firefox/Safari/모바일 Safari 개별 기동 테스트는 이 환경에 GUI 브라우저/원격
  디버깅 도구가 없어 수행하지 못했다(도구 한계, 아래 "발견된 이슈"에 Low로 기록).

## 입력 검증
- **빈 입력**: 원금/연이율/상환방식 모두 비우고 제출 → 각각 "대출 원금을 입력해 주세요.",
  "연이율을 입력해 주세요.", "상환방식을 선택해 주세요." 동시 표시(`ui.test.tsx` 기존 테스트 +
  본 QA 재확인). 년/개월은 비우면 각각 0으로 취급(친절한 기본값 처리, `validation.ts`
  `parseNonNegativeInteger` 참고) — 다만 년/개월 **둘 다** 비우면(둘 다 0) "대출 기간은 최소
  1개월 이상이어야 합니다" 오류로 정상 차단됨(`validation.test.ts`로 이미 검증).
- **음수**: `validateLoanInterestCalculatorInput`에 직접 음수 문자열("-1000000", "-1"(연이율))을
  넣으면 정규식(`/^\d+.../`)이 하이픈을 거부해 정상적으로 오류 처리됨(`validation.test.ts`
  기존 커버리지 재확인). **실제 UI 입력 경로로는 애초에 음수를 입력할 수 없음** — 신규 확인:
  원금 입력에 `-1000000`을 붙여넣어도 `handlePrincipalChange`가 `replace(/[^0-9]/g, "")`로
  실시간 필터링해 `1,000,000`만 남음(마이너스 기호 자체가 즉시 제거됨), 연이율(`handleRateChange`,
  `/[^0-9.]/g` 필터)·년/개월(`handleYearsChange`/`handleMonthsChange`, `/\D/g` 필터) 모두
  동일하게 하이픈이 실시간으로 걸러진다. 즉 검증 단계의 "음수 거부"는 실사용 경로(직접 타이핑/
  붙여넣기)에서는 발동할 일이 거의 없고, 주로 조작된 공유 URL 복원 시의 방어선 역할을 한다 —
  두 경로 모두 안전하게 동작함을 확인. 문제없음.
- **0**: 원금 0("대출 원금을 입력해 주세요" 또는 하한 미만 오류로 이어짐 — 원금 0은
  `MIN_PRINCIPAL`(10,000) 미만이라 하한 오류), 연이율 0%는 **정상 계산 경로**(FORMULA.md
  경계값 정책과 일치) — 실측: 원금 6,000,000원·연이율 0%·6개월·원리금균등 → 매월 상환액
  1,000,000원(이자 0원)으로 정확히 계산됨(프로브 테스트로 재확인, 예제 2와 일치). 대출기간
  0개월(년=0, 개월=0)은 오류로 정상 차단(위 "빈 입력" 참고). 문제없음.
- **매우 큰 값**: 원금 10,000,000,001원(상한 100억원 초과, +1원)으로 제출 시 "대출 원금은
  10,000원 이상 10,000,000,000원 이하로 입력해 주세요." 오류가 정확히 표시됨(프로브 테스트로
  실측, `ui.test.tsx`에는 없던 케이스라 신규 확인). 연이율 100% 초과, 대출기간 480개월 초과
  (40년 1개월 등)도 기존 `ui.test.tsx`/`validation.test.ts`에서 이미 확인됨. 원금 입력에
  극단적으로 긴 숫자열(예: 20자리 이상)을 넣어도 `handlePrincipalChange`가 실시간으로 숫자만
  남기고, 최종 검증에서 상한 초과로 안전하게 거부됨 — 부동소수점 오버플로우나 크래시 없음.
- **소수**: 연이율 "4.25"(소수 둘째 자리) 정상 통과, "4.255"(셋째 자리)는 정규식
  (`/^\d+(\.\d{1,2})?$/`)이 거부해 오류 처리(`validation.test.ts` 기존 커버리지). 원금·년·개월
  필드에 소수점을 입력하면 `handlePrincipalChange`/`handleYearsChange`/`handleMonthsChange`가
  각각 숫자만 남기는 필터(`[^0-9]`/`\D`)를 적용해 소수점 자체가 실시간으로 제거됨 — 예를 들어
  "1.5"를 년 필드에 입력하면 "15"로 즉시 정규화됨. 소수 입력이 부분적으로만 걸러지는 사각지대는
  발견되지 않았다. 연이율 필드에 소수점을 여러 개(`"5..5.5"`) 붙여넣어도 `handleRateChange`가
  첫 소수점만 유지하고 나머지 점을 제거해 `"5.55"`로 정규화됨(신규 확인, 정상 동작).
- **잘못된 문자**: 원금에 "1000만원"처럼 한글이 섞이면 오류(`validation.test.ts` 기존
  커버리지). 실사용 경로에서는 애초에 숫자 외 문자가 `onChange` 필터에서 제거되므로(원금·
  년·개월은 `\D` 계열, 연이율은 `[^0-9.]`) 한글·특수문자가 필드에 남을 수 없음 — 검증 단계의
  "숫자만 입력해 주세요" 오류는 주로 `validateLoanInterestCalculatorInput`을 직접 호출하는
  경로(공유 상태 복원 등)에서만 실제로 도달 가능하다는 점까지 확인.
- **년+개월 합산이 480개월을 초과하는 조합(40년 1개월)**: `ui.test.tsx` 기존 테스트 +
  `validation.test.ts`에서 이미 확인. 오류 메시지가 "대출 기간 합계는 480개월(40년) 이하로
  입력해 주세요."로 명확히 "합계" 표현을 포함함(UX/UI Critic이 이미 Low로 지적한 "오류가
  '개월' 필드 아래에만 표시되는" 표시 위치 이슈는 본 QA에서도 동일하게 재확인되나, 신규
  이슈로 별도 등재하지 않고 기존 Low 이슈로 갈음).
- **상환방식 미선택**: 원금·연이율·기간을 모두 채워도 상환방식을 고르지 않으면 "상환방식을
  선택해 주세요." 오류만 표시되고 계산이 실행되지 않음(`result`/`appliedInput` 모두 `null`
  유지) — 확인 완료.
- **개월 필드 12 이상(예: 18)**: 자동으로 "1년 6개월"로 정규화되지 않고 그대로 "11개월 이하로
  입력해 주세요(그 이상은 '년'으로 입력해 주세요)." 오류를 표시함(UX/UI Critic이 이미 Medium
  으로 지적한 사항을 QA 레벨에서 실행 결과로 재확인 — 신규 이슈 아님, 기존 Medium 유지).

## Copy / Reset
- **Reset(초기화)**: 폼 전체가 `EMPTY_FORM`으로 리셋되고 `result`/`appliedInput`/`errors`가
  모두 초기화됨 — 확인 완료(기존 테스트 + 본 QA 재확인).
- **Copy(링크 복사)**: `ShareActions`의 "링크 복사" 버튼은 공용 컴포넌트(`copyText`)를 그대로
  사용하며 이번 작업에서 수정되지 않았다. `navigator.clipboard.writeText` 우선 사용, 미지원
  환경은 `document.execCommand('copy')` 폴백 — 기존 `ShareActions.test.tsx`(전체 회귀 스위트
  포함, 통과 확인)로 이미 커버됨. 계산 후 복사 시 `resolvedUrl`이 `buildStateShareUrl`로 만든
  결과 복원 URL(원금·연이율·termMonths·상환방식 포함)이 되는지는 위 "기능 테스트 — ShareActions"
  절에서 확인.

## Console Error
- 이 환경에 헤드리스/GUI 브라우저 자동화 도구가 없어 실제 브라우저 DevTools 콘솔을 직접
  관찰하지는 못했다(위 "검증 방법 요약" 참고, 아래 "발견된 이슈"에 Low로 기록).
- 대체 확인: React Testing Library(jsdom) 프로브 테스트에서 `console.error`/`console.warn`을
  스파이로 감시하며 다음 시나리오를 수행 — 샘플 채우기 → 상환방식 3종 순회하며 각각 계산 →
  초기화, 그리고 유효/무효(음수 연이율, 480개월 초과) 공유 상태 복원, 깨진 Base64 공유 상태
  진입. **모든 시나리오에서 `console.error`/`console.warn` 호출 없음**(React 자체 개발 경고,
  key 중복 경고, PropTypes/hydration 경고 등 전혀 발생하지 않음).
- 기존에 실행 중이던 dev 서버 로그(`​.next/dev/logs/next-development.log`)에서 두 가지
  Server/Browser 오류가 발견됐으나, **둘 다 이 계산기 코드와 무관한 것으로 판단**해 이슈로
  등재하지 않고 참고로만 남긴다:
  1. `Failed to generate static paths for /calculators/[slug]: SyntaxError: Unexpected end of
     JSON input` — 공유 라우트 파일(`app/calculators/[slug]/page.tsx`)의 `generateStaticParams`
     에서 간헐적으로(로그상 수십 분 간격) 발생. 이 함수는 `getPublishedCalculators()`만 호출하는
     순수 배열 필터라 JSON을 직접 파싱하지 않으므로, Turbopack/Next dev 내부 매니페스트 캐시를
     읽는 과정의 레이스 컨디션으로 추정된다(이번 작업 파일 어디에서도 `JSON.parse`를 직접
     호출하지 않음). "/calculators/[slug]" 라우트 전체에 걸친 문제라 loan-interest-calculator
     한 계산기만의 결함이 아니다.
  2. `A tree hydrated but some attributes of the server rendered HTML didn't match...` —
     로그 메시지 자체가 원인을 `body` 태그에 `ap-style=""` 속성이 붙는 것으로 명시하며, "브라우저
     확장 프로그램이 React 로드 전에 HTML을 건드렸을 수 있다"고 안내한다. 이 오류는 `/`(홈)
     경로에서도 동일하게 발생해(`pathname="/"`), loan-interest-calculator 페이지 특유의
     결함이 아니라 이전에 그 dev 서버에 연결됐던 브라우저의 확장 프로그램에 의한 것으로 판단.
  두 항목 모두 이번 작업(신규 계산기 코드)이 원인이 아니라는 근거가 로그 메시지 자체에 있어
  Critical/High로 분류하지 않으며, 재발 시 별도 인프라 이슈로 추적할 것을 권장(Low, 정보성).
- `npx tsc --noEmit`: 오류 0건. `npm run build`: 경고 없이 성공.

## Accessibility
- **label 연결**: SSR HTML에서 `for="{id}-principal"`/`for="{id}-annualRatePercent"`/
  `for="{id}-years"`/`for="{id}-months"`가 각각 대응하는 `id`를 가진 input과 정확히 매칭됨을
  `curl` 응답에서 직접 확인. 상환방식은 `<fieldset><legend>` + 각 옵션을 `<label>`이 감싸
  숨겨진(`sr-only`) `radio` input과 연결(네이티브 라벨-포함 패턴, 별도 `for` 불필요).
- **오류 = role="alert" + aria-describedby**: 모든 필드 오류 `<p role="alert">`이며, 입력에는
  `aria-invalid`/`aria-describedby`가 오류 존재 시에만 설정됨(SSR HTML에서 `aria-` 속성 다수
  확인). 상환방식 오류만 `aria-describedby` 연결 없이 `role="alert"`만 있음(라디오 그룹 특성상
  개별 input에 연결할 단일 대상이 없어 다른 계산기들의 관례와 동일 — Critical 아님).
- **aria-live**: 결과 영역 전체가 `<div aria-live="polite">`로 감싸짐(SSR HTML에서 확인,
  2개의 `aria-live="polite"` 발견 — 결과 영역 + `ShareActions`의 피드백 문구).
- **FaqAccordion**: 각 질문 버튼에 `aria-expanded`/`aria-controls`, 패널에 `role="region"` +
  `aria-labelledby`(SSR HTML에서 6쌍의 `aria-expanded`/`aria-controls` 확인 — FAQ 6개 항목과
  일치). 아이콘 회전만이 아니라 `aria-expanded` boolean으로도 상태 전달 — `docs/DESIGN_SYSTEM.md`
  요건 충족.
- **키보드 포커스**: 상환방식 라디오는 네이티브 `<input type="radio">`(시각적으로만
  `sr-only`)라 Tab/화살표 키 네이티브 동작이 그대로 유지되고, 감싸는 `<label>`에
  `focus-within:ring-2 focus-within:ring-primary`로 포커스 시 시각적 피드백을 제공함(색상
  대비만으로 상태를 표현하지 않음 — 전역 `:focus-visible` 스타일과 별개로 이중 안전장치).
  FaqAccordion 버튼은 네이티브 `<button>`이라 Enter/Space로 토글 가능.
- **필수 표시**: `*`가 `aria-hidden="true"`로 장식 처리되고, 실제 필수 여부는 입력의
  `aria-required="true"`로 스크린리더에 전달됨(원금/연이율 확인, 대출기간/상환방식은
  `aria-required` 속성이 없음 — 다만 두 필드 모두 라벨에 시각적 `*`는 있으나 `aria-required`가
  누락되어 있다. 아래 "발견된 이슈"에 Low로 기록).

## 반응형
- `docs/DESIGN_SYSTEM.md` "모바일" 절의 `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` 패턴은 이
  계산기에서 카드 목록형 그리드로 쓰이는 곳이 없다(원래 이 패턴은 홈/카테고리의
  `CalculatorCard` 그리드용). 계산기 내부 "결과 요약 dl" 그리드는 사이트 전역 관례대로
  `grid-cols-1 sm:grid-cols-2`를 쓰며 이는 이 계산기만의 이탈이 아님(위 "모바일 테스트" 참고).
- 폼 컨테이너(`rounded-2xl border ... p-5 shadow-... sm:p-8`), 핵심 결과 카드(`bg-primary p-6
  ... sm:p-8`), `SectionCard` 전부 `docs/DESIGN_SYSTEM.md` "카드/표면 패턴"과 일치하는 클래스를
  그대로 재사용함(신규 스타일 없음).
- 소개/사용법 2단 그리드(`grid gap-5 lg:grid-cols-2`)는 1440px에서 2열, 그 아래(320~768px)는
  1열 — 다른 계산기의 동일 패턴과 일치.

## 발견된 이슈 (등급별)

| 등급 | 개수 | 내용 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | (UX/UI Critic이 이미 보고한 Medium 2건 — 개월 필드 자동 정규화 없음, breakdown 지수항 `r` 미치환 — 은 QA 실행으로 재확인만 했고 신규 Medium은 발견하지 못했다) |
| Low | 3 | 아래 참고 |

**Low 상세**
1. **실제 브라우저(Chrome/Firefox/Safari) 및 실기기 뷰포트에서의 시각적 확인 미실시** — 이
   환경에 Playwright 등 브라우저 자동화 도구가 없어(설치 시도 결과 패키지 부재, 임의 설치는
   진행하지 않음) 320/375/390/768/1440px를 코드 정적 분석 + 기배포 계산기 선례 대조로만
   검증했다. 실제 픽셀 단위 잘림·줄바꿈은 추가로 실기기/에뮬레이터 확인이 필요하다(UX/UI
   Critic도 동일한 한계를 이미 기록함 — Q9). 계산 정확성과 무관하며, Critical한 레이아웃 붕괴
   징후는 코드 상에서 발견되지 않았다.
2. **대출 기간·상환방식 입력에 `aria-required="true"`가 없음** — 원금·연이율 입력에는
   `aria-required="true"`가 있지만, "년"/"개월" 입력과 상환방식 라디오 그룹에는 이 속성이
   없다. 라벨에 시각적 `*`(필수 표시)는 모두 붙어 있고 제출 시 오류가 `role="alert"`로
   전달되므로 스크린리더 사용자가 결국 필수 여부를 알 수는 있으나(오류 발생 후), 포커스
   시점에 미리 "필수 입력"임을 안내받지 못하는 사소한 접근성 개선 여지가 있다.
3. **개발 서버 로그의 사전 존재 이슈 2건은 이 계산기와 무관함을 확인** — (1)
   `generateStaticParams`의 간헐적 `SyntaxError: Unexpected end of JSON input`(공유 라우트
   `[slug]/page.tsx` 인프라 이슈로 추정, 이 계산기 파일에 JSON.parse 직접 호출 없음), (2)
   `body`에 `ap-style=""` 속성이 주입되는 브라우저 확장 프로그램발 hydration mismatch(`/`
   홈 경로에서도 동일 발생, 이 계산기 특유 결함 아님). 둘 다 Critical/High로 분류하지 않되,
   향후 다른 계산기 QA에서도 반복 관찰되면 별도 인프라 이슈로 조사할 것을 권장(정보성 기록).

## 회귀 테스트 (CLAUDE.md 필수 규칙)
- `npx vitest run --no-file-parallelism`(전체 스위트): **58개 파일, 618개 테스트 전부 통과**
  (Calculation Auditor 보고와 동일 수치로 재확인 — `four-major-insurance`/
  `src/lib/social-insurance.ts`, `annual-salary-take-home-pay` 포함 기존 계산기 회귀 없음).
- `npx vitest run src/calculators/loan-interest-calculator --no-file-parallelism`: **5개 파일,
  73개 테스트 전부 통과**(FORMULA.md Golden Test 13개 포함).
- `npx tsc --noEmit`: 오류 0건.
- `npm run build`: Next.js 16.3.4(Turbopack) 프로덕션 빌드 성공, 정적 페이지 생성 포함(경고
  없음). `loan-interest-calculator`는 `registry.ts`에 `status: "draft"`로 등록돼 있어
  `generateStaticParams`(published만 대상) 목록에는 없지만, `app/calculators/[slug]/page.tsx`
  가 `getCalculatorBySlug()`로 draft도 라우팅을 허용하도록 이미 설계돼 있어 `curl`로 직접 접근
  시 200 응답 확인(의도된 동작 — Builder/Architect 설계 그대로).
- 임시 QA 프로브 테스트(13개, 세션 스크래치패드 작성 → 실행 확인용으로만 프로젝트 루트에
  잠시 복사해 실행 → 즉시 삭제)는 모두 통과했으며 프로젝트 소스 트리에는 아무 파일도 남기지
  않았다(삭제 후 전체 스위트 재실행으로 파일 수·테스트 수가 삭제 전과 동일함을 확인 — 58개
  파일/618개 테스트).

## 판정
**PASS**

- Critical 0, High 0, Medium 0(신규), Low 3(모두 계산 정확성과 무관, 도구 한계 1건 + 접근성
  사소 개선 여지 1건 + 인프라 사전 이슈 무관 확인 1건).
- Golden Test 13/13 통과, 전체 회귀 스위트 618/618 통과, TypeScript 오류 0, 빌드 성공.
- Calculation Auditor(PASS) · UX/UI Critic(PASS, Medium 2건은 기존 보고 유지, 신규 Critical/
  High 없음) · QA(PASS) 모두 통과 — `docs/EVALUATION.md` PASS 기준(총점 92+, 계산정확성
  33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0) 충족.
- 남은 Low 이슈(브라우저 자동화 도구 부재로 인한 실기기 미확인, `aria-required` 누락 2곳)는
  Optimizer가 여유가 될 때 처리할 수 있는 사소한 개선 사항이며, `published` 전환을 막을 사유는
  아니라고 판단한다.

## QA 재검증 (라운드 1)

Optimizer 수정(`tasks/loan-interest-calculator/EVALUATION.md` "## Optimizer 수정 (라운드 1)")
이후 재검증. Edit 권한이 없어 코드를 수정하지 않았고, 아래는 재실행/재대조로 확인한 결과다.

### 1. `aria-required` 반영 확인

`src/calculators/loan-interest-calculator/ui.tsx`를 다시 읽고 확인한 결과, 라운드 0에서
지적한 Low #2(대출 기간·상환방식 입력에 `aria-required` 누락)가 정확히 해소됐다.

- "년" input(343행 부근)·"개월" input에 각각 `aria-required="true"` 추가됨.
- 상환방식 라디오 3개(`equalInstallment`/`equalPrincipal`/`bullet`) 각각의 `<input
  type="radio">`에 `aria-required="true"` 추가됨.
- 원금·연이율 입력은 기존대로 유지(`aria-required="true"`, 변경 없음).
- **실행 확인**: `ui.test.tsx`의 신규 테스트("필수 입력에는 aria-required가 붙는다(대출
  기간·상환방식 포함)")가 년/개월/라디오 3개 전체를 `toHaveAttribute("aria-required",
  "true")`로 검증하며 통과함을 재실행으로 확인.
- **SSR HTML 재확인**: 실행 중인 dev 서버(`http://localhost:3000`, PID 22372 유지)에
  `curl`로 `/calculators/loan-interest-calculator`를 받아 `aria-required="true"` 개수를
  세어보니 정확히 **7개**(원금 1 + 연이율 1 + 년 1 + 개월 1 + 상환방식 라디오 3)로, 원금·
  연이율 2개뿐이던 라운드 0 대비 5개가 늘었다 — 코드 변경이 실제 렌더링 결과에도 반영됨을
  직접 확인했다.
- 판정: **Low #2 해소 확인**. 신규 접근성 결함 발견 없음.

### 2. 회귀 확인 — 개월 자동 정규화, `termMonths` 필드 재태깅, 캡션 축소

- **개월 자동 정규화(`handleMonthsChange`)**: 코드를 다시 읽고 로직을 대조했다 — 입력값이
  12 미만이면 그대로 반영하고, 12 이상이면 기존 "년" 값에 `Math.floor(monthsValue / 12)`를
  더하고 "개월"을 `monthsValue % 12`로 갱신한다. `ui.test.tsx`의 3개 신규 테스트(18→년1/개월6,
  기존 년=2에서 개월=30→년4/개월6, 개월=11 이하는 정규화 없음)를 재실행해 모두 통과 확인.
  이 정규화는 `setForm`으로 UI 상태만 바꿀 뿐 `validateLoanInterestCalculatorInput`(합산값
  1~480 범위 검증) 로직 자체를 건드리지 않으므로, 기존에 확인했던 "년+개월 둘 다 0 → 오류",
  "40년 1개월(481개월) → 오류" 등 검증 동작에 영향이 없음을 아래 "3."의 프로브 테스트로 재확인.
- **`termMonths` 필드 재태깅**: `validation.ts`의 `ValidationFieldError.field`에 `"termMonths"`
  태그가 신설되고, 합산값 자체에 대한 두 오류("최소 1개월 이상", "480개월 이하")만 이 태그를
  쓰도록 바뀌었다(개별 필드 범위 오류는 여전히 `"years"`/`"months"`). `ui.tsx`는 이 오류를
  "년"·"개월" 입력 그룹 아래에 별도로 렌더링하고 `describedBy()` 헬퍼로 양쪽 입력의
  `aria-describedby`에 모두 연결한다. `validation.test.ts` 재실행 결과, 기존에 `field ===
  "months"`를 기대하던 3개 테스트가 `field === "termMonths"`로 갱신돼 있고, "개별 필드 오류
  vs 합산 오류 태그 구분" 신규 테스트와 `ui.test.tsx`의 "aria-describedby 그룹 연결" 신규
  테스트 모두 통과 확인. **UI 레벨에서 사용자가 보는 오류 메시지 문구 자체(예: "대출 기간
  합계는 480개월(40년) 이하로 입력해 주세요.")는 그대로이므로, 라운드 0에서 확인한 "입력
  검증" 절의 관찰(문구는 명확, 표시 위치만 개선)이 여전히 유효하고, 오히려 표시 위치가
  개선되었다(년/개월 그룹 레벨로 이동, UX/UI Critic Low #5 해소).**
- **핵심 결과 카드 캡션 축소**: 기존 "대출원금 …원 · 연이율 …% · 대출기간 … · 상환방식 …"
  형태의 캡션이 "OO상환 기준"(예: "원리금균등상환 기준")으로 축소됐다. "적용된 입력값"
  `SectionCard`는 그대로 유지되어 4개 값(원금·연이율·기간·상환방식)을 여전히 보여주므로,
  **정보 손실은 없다** — 단지 중복 노출(UX/UI Critic Low #12)이 제거된 것이다. 코드 대조
  결과 캡션이 이제 `repaymentMethodLabels[result.repaymentMethod]}기준`만 렌더링하는 것을
  확인했고, `ui.test.tsx` 기존 테스트(`keyResultCard.textContent).toContain("원리금균등상환")`)
  가 여전히 통과함을 재실행으로 확인 — 상환방식 이름이 캡션에서 사라지지 않았다.

### 3. 핵심 재확인 — 년+개월 합산 검증 및 ShareActions 왕복(공유 URL 복원 시 년/개월 재분해)

지시사항에 따라 이 두 가지를 가장 중점적으로 재검증했다. 세션 스크래치패드에서 작성한 임시
프로브 테스트 파일(`React Testing Library`, jsdom)을 이번 QA 재검증 시점에만 계산기 폴더에
잠시 복사해 실행한 뒤 즉시 삭제했다(라운드 0과 동일한 방법론 — 소스 트리에는 남기지 않음).

- **ShareActions 왕복(공유 URL → 년/개월 재분해) — 3개 시나리오, 모두 정상 동작 확인**:
  - `termMonths=246`(일반값) 공유 상태로 진입 → 년="20", 개월="6"으로 정확히 재분해, 원금
    "100,000,000" 복원, 핵심 결과 카드("매월 상환액")도 즉시 함께 렌더링됨.
  - `termMonths=1`(하한 경계값) → 년="0", 개월="1"로 정확히 재분해.
  - `termMonths=480`(상한 경계값) → 년="40", 개월="0"으로 정확히 재분해.
  - **강건성**: `termMonths=481`(상한 초과, 조작된 공유 상태) 진입 시
    `validateLoanInterestCalculatorInput`이 재검증에서 실패해 복원이 조용히 무시됨(폼이
    빈 상태 그대로, 크래시 없음, `console.error` 호출 0회) — 재확인.
  - 이 경로(`ui.tsx`의 `useCalculatorShare` 콜백, `components/calculator/useCalculatorShare.ts`)
    는 이번 Optimizer 라운드에서 **전혀 수정되지 않은 파일**임을 코드 대조로 확인했다 — 회귀
    위험이 애초에 낮은 영역이었고, 실행 결과로도 회귀가 없음을 확인했다.
- **년+개월 합산 검증 — 2개 시나리오, 모두 정상 동작 확인**:
  - 년=40·개월=1(합산 481개월, 상한 초과) 제출 → "대출 기간 합계는 480개월(40년) 이하로
    입력해 주세요." 그룹 오류 표시, 계산 미실행("매월 상환액" 헤딩 없음) 확인.
  - 년/개월 모두 비움(합산 0개월) 제출 → "대출 기간은 최소 1개월 이상이어야 합니다." 오류
    표시 확인.
  - 두 시나리오 모두 `termMonths` 필드 재태깅 이후에도 동일한 사용자 관찰 결과(오류 문구·
    계산 차단)를 유지함 — 필드 태그 변경이 검증 로직의 실제 동작(범위 수치, 차단 여부)을
    바꾸지 않았다는 EVALUATION.md의 주장을 실행으로 재확인했다.
- 프로브 테스트 6개 전부 통과 후 파일을 즉시 삭제했고, 삭제 후 전체 스위트를 재실행해 파일
  수·테스트 수가 삭제 전(58개 파일/628개 테스트)과 정확히 동일함을 확인했다 — 소스 트리에
  아무 흔적도 남기지 않았다.

### 4. 전체 회귀 스위트 재실행

- `npx vitest run --no-file-parallelism`(전체 스위트): **58개 파일, 628개 테스트 전부 통과**
  (라운드 0의 618개 대비 Optimizer가 추가한 회귀 테스트 10개 순증 — EVALUATION.md "검증 결과"
  절 수치와 정확히 일치).
- `npx vitest run src/calculators/loan-interest-calculator --no-file-parallelism`: **5개 파일,
  83개 테스트 전부 통과**(라운드 0의 73개 + 신규 10개).
- `npx tsc --noEmit`: 오류 0건.
- `npm run build`: Next.js 16.3.4(Turbopack) 프로덕션 빌드 성공, 정적 페이지 생성 포함(경고
  없음) — 라운드 0과 동일하게 성공.
- dev 서버 로그(`.next/dev/logs/next-development.log`) 재확인: 라운드 0에서 이미 "이 계산기와
  무관"으로 판정한 두 항목(`generateStaticParams`의 간헐적 `SyntaxError`, 브라우저 확장
  프로그램발 `ap-style` hydration mismatch)만 반복 관찰되고, **이번 Optimizer 변경과 관련된
  신규 오류·경고는 발견되지 않았다**.

### 5. 재검증 결론

- 항목 1(`aria-required` 반영): **확인 완료(Low #2 해소)**.
- 항목 2(개월 자동 정규화·`termMonths` 재태깅·캡션 축소가 기존 기능에 회귀를 일으키지 않는지):
  **회귀 없음 확인**. 세 변경 모두 코드 대조 + 관련 테스트 재실행으로 의도한 동작만 바뀌었고
  부작용이 없음을 확인했다.
- 항목 3(년+개월 합산 검증, ShareActions 왕복 — 지시사항이 지목한 중점 확인 대상): **회귀
  없음 확인**. 신규 프로브 테스트 6개(경계값 3종 + 강건성 1종 + 합산 검증 2종)로 실측
  재확인했고, 전부 통과했다.
- 신규 Critical/High/Medium 이슈 없음. 라운드 0에서 남긴 Low 3건 중 1건(`aria-required` 누락)
  은 이번 라운드에서 해소됐고, 나머지 2건(브라우저 자동화 도구 부재로 인한 실기기 미검증,
  개발 서버 로그의 계산기 무관 사전 이슈)은 도구·인프라 한계로 여전히 남아 있으나 계산
  정확성·published 전환을 막을 사유가 아니다(라운드 0과 동일 판단 유지).
- 전체 회귀 스위트(628/628), 계산기 전용 스위트(83/83), TypeScript(0 오류), 빌드(성공) 모두
  통과 — `docs/EVALUATION.md` PASS 기준(총점 92+, 계산정확성 33/35+, Critical 0, High 0,
  Golden Test 100%, Console/TS Error 0, Mobile Critical 0)을 라운드 1에서도 계속 충족한다.

**QA 재검증(라운드 1) 최종 판정: PASS**
