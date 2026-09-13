# QA: 더치페이 계산기 (bill-split-calculator)

검토 대상: `src/calculators/bill-split-calculator/` 전체(`ui.tsx`, `logic.ts`, `validation.ts`,
`formatting.ts`, `content.ts`, `types.ts`, `RouletteWheel.tsx`, `LadderAnimation.tsx`,
`use-prefers-reduced-motion.ts`), `src/calculators/registry.ts`(등록 상태), `package.json`(신규
의존성 `html-to-image`). Calculation Auditor(PASS, 대량 통계 시뮬레이션 포함) · UX/UI
Critic(라운드 1 재검증 PASS) 완료 후 QA 진행. Edit 권한이 없어 코드를 수정하지 않았다.

### 검증 방법 요약
- 회귀 스위트: `npx vitest run --no-file-parallelism`(전체), `npx tsc --noEmit`, `npm run build`.
- 계산기 전용 스위트: `npx vitest run src/calculators/bill-split-calculator --no-file-parallelism`.
- 기존에 실행 중이던 dev 서버(`http://localhost:3000`, PID 22372, Next 16.3.4)에 `curl`로
  `/calculators/bill-split-calculator` SSR HTML을 받아 aria-live/aria-hidden/label 연결/
  aria-required 등을 직접 카운트했다.
- 이 환경에는 Playwright/Puppeteer 등 브라우저 자동화 도구가 없다(`node_modules`/`bin` 확인
  결과 미설치, 임의 설치는 진행하지 않음) — 실제 브라우저 뷰포트 렌더링, DevTools 콘솔, 실제
  파일 다운로드 트리거는 직접 관찰하지 못했다. 대신 다음 방법으로 보완했다:
  1. **임시 프로브 테스트**(React Testing Library + jsdom, 세션 스크래치패드에서 작성 →
     `src/calculators/bill-split-calculator/`에 `zzz-qa-*.test.tsx`로 잠시 복사해 실행 →
     즉시 삭제, `loan-interest-calculator` QA 선례와 동일 방법론 — 소스 트리에 아무 것도
     남기지 않았다. 삭제 후 전체 스위트를 재실행해 파일 수/테스트 수가 삭제 전과 정확히
     동일함을 확인했다).
  2. **실제(모킹하지 않은) `html-to-image`를 jsdom에서 직접 호출**해 이 환경의 한계를 실측했다
     (아래 "이미지 저장 기능" 참고 — 이 부분이 이번 작업 지시의 핵심 확인 대상이다).
  3. **순수 로직 함수(`pickWinnerIndex`/`fisherYatesShuffle`/`calculateWinnerTakeAll`/
     `calculateLadderSplit`)를 UI 밖에서 직접 반복 호출**해 "매번 결과가 달라지는지"를
     Calculation Auditor와 별개로 QA 레벨에서도 독립 재확인했다.
  - 320/375/390/768/1440px 실측은 코드상 Tailwind 브레이크포인트(`sm:grid-cols-[...]`,
    `h-64 w-64 sm:h-72 sm:w-72`, `preserveAspectRatio="xMidYMid meet"`)를 직접 픽셀 단위로
    재계산해 판단했다(UX/UI Critic 라운드 1 재검증과 동일한 결론에 독립적으로 도달했다) — 이
    부분은 실기기 확인이 추가로 필요하다는 점을 "발견된 이슈"에 남긴다.

## 기능 테스트

- **계산 전 → 후 흐름(세 방식 공통)**: 방식 선택 → 멤버 이름 목록(추가/삭제) → 방식별 입력
  (총 금액 또는 인원별 금액) → `ShareActions`(계산기 모드) → 계산하기 → (몰아주기/사다리타기는
  애니메이션 → ) 핵심 결과 카드 → 이미지 저장 버튼 → `ShareActions`(결과 모드) → 계산 근거
  순서로 정상 렌더링됨(SPEC.md "화면 구성" 순서와 일치). 기존 `ui.test.tsx` 11개 테스트로
  이미 확인돼 있고, 본 QA에서 직접 재실행해 재확인했다.
- **균등 분배**: 샘플 값(3명, 10,000원)으로 계산하면 3,334/3,333/3,333원(FORMULA.md 예제 2)이
  즉시(애니메이션 없이) 표시됨. 초기화 시 결과가 사라짐. 문제없음.
- **한명 몰아주기 — 반복 계산 재현성(작업 지시 핵심 확인 대상)**: 임시 프로브 테스트로 같은
  샘플 값(4명)에서 "계산하기"를 **30회 연속 클릭**했다 — 매 클릭마다 `calculateWinnerTakeAll`이
  다시 호출되어(버튼 클릭 = `runCalculation` 재실행, 캐시된 이전 결과를 재사용하지 않음)
  선정된 멤버 이름을 매번 새로 수집한 결과 **4명 중 2명 이상이 실제로 관측됨**(4명이 30회
  연속 고정될 확률은 `4×(1/4)^30`으로 사실상 0) — 고정된 결과가 아님을 실측으로 확인했다.
  추가로 `calculateWinnerTakeAll`(순수 함수, UI와 독립)을 같은 입력으로 200회 직접 호출한
  결과도 `selectedIndex`가 2가지 이상 관측됨을 확인했다(Calculation Auditor의 100,000회
  카이제곱 검정과 별개로 QA 레벨에서도 독립 재확인). "나머지 멤버는 0원입니다" 문구도 매번
  정상 표시됨. **문제없음.**
- **사다리타기 — 반복 계산 재현성(작업 지시 핵심 확인 대상)**: 같은 방식으로 샘플 값(3명)에서
  "계산하기"를 **30회 연속 클릭**한 결과, 멤버-금액 매칭 카드의 텍스트 내용이 2가지 이상의
  서로 다른 패턴으로 관측됨(3명이면 3!=6가지 조합, 30회 연속 고정될 확률은 `6×(1/6)^30`으로
  사실상 0). `calculateLadderSplit`을 200회 직접 호출한 결과도 `permutation`이 2가지 이상
  관측됨. 참고 합계(60,000원)는 매 계산에서 항상 동일(금액 목록 자체는 바뀌지 않으므로 정상).
  **문제없음.**
- **ShareActions 왕복(계산 후 공유 → URL 복원, 작업 지시 핵심 확인 대상)**:
  - 몰아주기: `{ mode: "winner-take-all", totalAmount: 40000, members: [민준,서연,도윤,하은],
    selectedIndex: 2 }`를 `encodeShareState`로 인코딩해 `?s=...` 쿼리로 진입 → **3회 독립
    렌더(매번 새 컴포넌트 마운트)** 모두 "도윤"이 선정된 것으로 정확히 복원되고
    "40,000원 전액 부담"이 표시됨(다른 멤버로 잘못 표시되지 않음도 확인). `restoreBillSplitResult`가
    RNG를 호출하지 않으므로 재계산으로 다른 결과가 나오는 사고가 발생하지 않음을 실측으로
    재확인했다(Calculation Auditor가 이미 몽키패치로 확인한 것과 별개로 UI 엔드투엔드 경로에서
    재확인).
  - 사다리타기: `{ mode: "ladder", members: [에이,비,씨], amounts: [1000,2000,3000],
    permutation: [2,0,1] }` 상태로 3회 독립 렌더 — 매번 정확히 "에이-3,000원, 비-1,000원,
    씨-2,000원" 매칭이 복원됨(재계산되어 다른 매칭이 나오는 사례 없음). **문제없음, 작업
    지시가 요구한 핵심 확인 항목 통과.**
- **멤버 추가/삭제**: 최소 2명 미만 삭제 불가(버튼 `disabled`), 최대 20명 초과 추가 불가 —
  기존 테스트 + 코드 대조로 확인. 삭제/추가 시 계산 후 결과가 즉시 숨겨짐(입력 변경 시 이전
  결과 숨김 요건).
- **초기화/샘플 값**: 초기화 시 방식·멤버·금액·오류·결과가 모두 기본 상태(균등, 2명 빈칸)로
  복귀. 샘플 값은 방식별로 FORMULA.md 검증 예제(균등: 예제 2)를 그대로 사용해 `docs/
  DESIGN_SYSTEM.md` "Reset/Sample" 권장을 충족.
- **방식 전환**: 방식 라디오를 바꾸면 이전 결과가 즉시 숨겨지고, 멤버 이름 목록은 유지된 채
  사다리타기 전환 시 금액 입력 필드만 추가로 나타남(재입력 불필요) — 기존 UX/UI Critic Q17과
  동일하게 확인.

## 이미지 저장 기능(작업 지시 핵심 확인 대상)

- **와이어링 확인(모킹 경로)**: 기존 `ui.test.tsx`(실패 케이스, `toPng` 항상 reject)와 본 QA가
  추가한 임시 프로브(성공 케이스, `toPng`이 가짜 데이터 URL로 resolve)로 확인한 결과,
  "결과 이미지 저장" 클릭 → `await import("html-to-image")` 동적 로드 → `toPng(cardRef.current,
  { pixelRatio: 2 })` 호출 → 반환된 데이터 URL을 `<a href download="더치페이-결과.png">`에
  설정 → `.click()` 호출까지 정확히 실행됨을 확인했다(이 흐름 전체에서 `console.error`/
  `console.warn` 0회, 아래 "Console Error" 참고).
- **번들 분리 확인**: `npm run build`(Turbopack) 산출물에서 `toPng` 문자열을 검색한 결과
  `.next/server/chunks/ssr/node_modules_html-to-image_es_index_*.js`처럼 **별도 청크로 분리**
  되어 있음을 확인 — ARCHITECTURE.md "4."가 요구한 "동적 import로 메인 번들에 포함하지
  않는다"는 요건이 실제 빌드 결과물에서도 지�켜짐을 실측으로 확인했다.
- **실제(모킹하지 않은) `html-to-image`를 jsdom에서 직접 호출한 결과(이번 QA의 핵심 실측)**:
  ```json
  {
    "ok": false,
    "error": "ReferenceError: SVGImageElement is not defined",
    "stack": "...at html-to-image/lib/embed-images.js:117..."
  }
  ```
  jsdom 환경은 `SVGImageElement` 전역 객체 자체를 정의하지 않아(실제 브라우저는 모두 정의함),
  `html-to-image`가 내부적으로 이미지 노드를 임베드하는 단계에서 즉시 실패한다. **이것은
  이 계산기 코드의 결함이 아니라 jsdom(Node 기반 테스트 환경)이 `SVGImageElement`/실제 Canvas
  2D 렌더링(`canvas` 네이티브 패키지 미설치, `node_modules`에 없음을 확인)을 지원하지 않는
  테스트 환경 자체의 한계다** — ARCHITECTURE.md "4. 알려진 한계"가 이미 "iOS Safari 실기기
  스모크 테스트가 QA 단계에서 반드시 필요하다"고 명시한 것과 정확히 같은 종류의 한계다.
  **결론: 이 QA 세션에서는 실제 브라우저에서의 `toPng` 성공적 변환(DOM→SVG
  foreignObject→canvas→PNG data URL)과, 그로부터 이어지는 실제 파일 시스템 다운로드 트리거를
  검증하지 못했다.** ARCHITECTURE.md가 명시적으로 "반드시 포함"하라고 요구한 iOS Safari(또는
  최신 시뮬레이터) 실기기 테스트도 이 환경에는 GUI 브라우저가 없어 수행하지 못했다 — 아래
  "발견된 이슈"에 이 한계를 명시적으로 기록한다(도구 부재로 인한 미검증이며, 코드에서 발견된
  결함은 아니다).
- **다크모드 캡처 색상 정확도**: 실제 렌더링 확인은 위와 같은 이유로 불가능했다. 다만 코드
  검토 결과, 캡처 대상(`cardRef`가 감싼 `<section>`)은 애니메이션 SVG를 포함하지 않고
  Tailwind `dark:` 유틸리티 클래스(`dark:border-primary/25 dark:bg-gradient-to-br
  dark:from-primary-soft dark:via-surface dark:to-surface dark:text-foreground`)만 사용한다
  — `html-to-image`는 캡처 시점에 이미 브라우저가 `var(--primary)` 같은 커스텀 프로퍼티를
  구체적인 `rgb(...)` 값으로 해석해 둔 `getComputedStyle` 결과를 그대로 인라인하므로(
  ARCHITECTURE.md "4." 논증), 코드 구조상 다크모드 캡처가 깨질 특별한 이유는 발견하지 못했다.
  다만 이것은 정적 코드 분석에 근거한 판단이며 **실제 스크린샷 대조로 확인한 것은 아니다** —
  실기기 QA 시 다크모드 토글 상태에서 이미지 저장을 한 번 더 실측할 것을 권장한다.
- **실패 경로**: `toPng`이 실패하면 "이미지를 저장하지 못했습니다. 공유 영역의 '링크 복사'로
  결과를 대신 공유해 보세요."가 표시됨(방향 지시어 없음, UX/UI Critic Q14 수정 재확인). 저장
  진행 중에는 버튼이 "이미지 생성 중…"으로 바뀌고 `disabled` 처리되어 중복 클릭이 되지 않음.
  **문제없음(와이어링 레벨).**

## 애니메이션

- **`prefers-reduced-motion` 생략 경로**: `window.matchMedia`를 `matches: true`로 모킹한 상태
  (기존 `ui.test.tsx` 전체 + 본 QA 프로브 전체가 이 설정을 씀)에서 몰아주기/사다리타기 모두
  애니메이션 대기 없이 결과가 즉시 표시됨을 반복 확인했다 — `RouletteWheel`/`LadderAnimation`
  자체의 기존 단위 테스트(`playAnimation=false`면 마운트 즉시 `onAnimationEnd` 호출, fake
  timers로 결정적 검증)도 재확인했다.
  또한, 애니메이션 생략 여부와 무관하게 **같은 로직(`calculateWinnerTakeAll`/
  `calculateLadderSplit`)의 출력을 그대로 표시**하므로(코드 대조: `ui.tsx`가 결과를 먼저
  확정한 뒤에만 애니메이션 컴포넌트에 넘김, ARCHITECTURE.md "2.3"/"5.4") 애니메이션 유무에
  따라 최종 결과가 달라지는 코드 경로 자체가 존재하지 않음을 확인했다. **문제없음.**
- **애니메이션 SVG는 `aria-hidden="true"`**: `RouletteWheel.test.tsx`/`LadderAnimation.test.tsx`
  기존 테스트와 소스 코드 대조로 확인(장식 요소, 실제 정보는 핵심 결과 카드 텍스트가 전달).

## 모바일 테스트 (320 / 375 / 390 / 768 / 1440px)

실기기/브라우저 뷰포트 자동화 도구가 이 환경에 없어 **코드 정적 분석(직접 재계산, UX/UI
Critic 라운드 1 재검증과 독립적으로 재확인)**으로 판단했다. Critical/High 발견 없음.

- **사다리타기 멤버 입력 행(Optimizer가 수정한 부분, 이번 QA의 중점 확인 대상)**:
  `grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start`.
  320px 기준: 페이지 컨테이너 `px-5`(40px) + 폼 컨테이너 `p-5`(40px)를 뺀 실사용 폭
  240px에서, `grid-cols-1`(640px 미만)이므로 이름 입력·금액 입력·삭제 버튼이 각각 별도 행에서
  240px 전체 폭을 씀 — 입력 좌우 패딩(28px)을 빼도 실제 텍스트 표시 폭 약 212px 확보(과거
  "필드당 약 54px" 문제 해소, Critic 라운드 1 결론과 동일하게 재확인). 삭제 버튼은
  `justify-self-start`로 콘텐츠 크기만큼만 차지. **문제없음(중복 검증 완료).**
- **균등/몰아주기 멤버 입력 행**: `flex items-start gap-2` + 두 `flex-1`(이름 입력 하나만) —
  320px에서도 삭제 버튼을 제외한 전체 폭을 이름 입력 하나가 차지하므로 문제없음.
- **룰렛 SVG**: `viewBox="0 0 260 260"` 고정, 렌더 크기 `h-64 w-64 max-w-full sm:h-72 sm:w-72`
  (256px 정사각형, 640px 미만은 유지). 320px 화면에서 페이지 컨테이너 패딩(40px)을 뺀 가용
  폭이 280px이므로 256px 원이 여유 있게 들어간다(`max-w-full`이 이중 안전장치) — 잘리지
  않음. 부채꼴 라벨은 N≤10이면 이름, N>10이면 번호만 표시(ARCHITECTURE.md "7." 가이드라인),
  범례는 N>10일 때만 시각적으로 노출되고(2열/3열 그리드) 그 외엔 `sr-only`로 전환되어 중복
  표시가 없다(UX/UI Critic Q14 Low 해소 재확인).
- **사다리타기 SVG**: `viewBox="0 0 {width} {246}"`(`width`는 멤버 수에 비례, N=20이면 808)를
  `preserveAspectRatio="xMidYMid meet"`로 `h-64 w-full max-w-full sm:h-72` 박스 안에 렌더링 —
  `meet` 모드는 뷰박스 전체가 항상 박스 안에 들어가도록 축소 스케일링하므로(레터박싱 발생
  가능하나 넘치지 않음), N=20에서도 페이지 가로 스크롤을 유발하지 않는다. 세로줄 위 라벨도
  N>10이면 번호만 표시. **문제없음.**
- **페이지 전체**: `mx-auto w-full max-w-6xl px-5 sm:px-8` — 320px에서 좌우 20px 여백, 1440px
  에서도 `max-w-6xl`로 과도하게 넓어지지 않음. 소개/사용법 2단 그리드는 `lg:grid-cols-2`(1440px
  에서 2열, 그 아래는 1열). 방식 선택 라디오 3개는 `grid gap-3 sm:grid-cols-3`(640px 미만 1열
  세로 스택, 그 이상 3열) — 라벨+설명 문구 모두 줄바꿈 가능한 텍스트라 폭 부족으로 잘리는
  요소 없음.
- 이 절의 모든 판단은 코드/치수 계산에 근거하며, **실제 픽셀 렌더링·실기기 확인은 수행하지
  못했다**(도구 부재, 아래 "발견된 이슈" Low 참고).

## 브라우저 테스트

- 사용 API: `Intl.NumberFormat`, `useSyncExternalStore`(`prefers-reduced-motion` 구독,
  `matchMedia.addEventListener` 우선·구형 Safari `addListener` 폴백 포함), 동적 `import()`,
  `html-to-image`의 `toPng`(SVG `foreignObject`→canvas 변환, `SVGImageElement`/Canvas 2D
  컨텍스트 필요 — 모든 최신 evergreen 브라우저에서 표준 지원), `navigator.clipboard.writeText`
  +`execCommand('copy')` 폴백(공용 `ShareActions.tsx`, 이번 작업에서 수정되지 않음),
  `URL`/`URLSearchParams`/`TextEncoder`/`TextDecoder`/`btoa`/`atob`(공용 `src/lib/share.ts`,
  수정 없음).
- Turbopack 프로덕션 빌드 성공, TypeScript 오류 없음.
- **실제 Chrome/Firefox/Safari/모바일 Safari 개별 기동 테스트, 특히 ARCHITECTURE.md "4."가
  "반드시 포함"하라고 명시한 iOS Safari(실기기/최신 시뮬레이터) 이미지 저장 스모크 테스트는
  이 환경에 GUI 브라우저가 없어 수행하지 못했다.** 이는 이번 QA가 발견한 코드 결함이 아니라
  환경 도구의 한계이며, 이 계산기의 핵심 신규 기능(이미지 저장)에 대한 실기기 검증이 아직
  완료되지 않았다는 점을 명확히 남긴다(아래 "발견된 이슈" 참고).

## 입력 검증
- **빈 입력**: 멤버 이름 전부 비우고 계산 → "이름을 입력해 주세요."가 각 필드에 표시, 총
  금액도 비우면 "총 금액을 입력해 주세요." 동시 표시(기존 `ui.test.tsx` + 본 QA 재확인).
  사다리타기에서 금액 하나라도 비우면 "금액을 입력해 주세요."가 해당 인덱스에 표시
  (`validation.test.ts` 기존 커버리지).
- **음수**: 실사용 경로(직접 타이핑)에서는 `handleTotalAmountChange`/`handleAmountChange`가
  `replace(/[^0-9]/g, "")`로 숫자 외 문자(하이픈 포함)를 실시간으로 제거해 애초에 음수를
  입력할 수 없다. `validateBillSplitInput`/`parseBillSplitShareState`를 직접 호출하는
  경로(조작된 공유 URL 등)에서는 `MIN_AMOUNT=1` 미만이 정상적으로 거부된다
  (`validation.test.ts`). 문제없음.
- **0**: 총 금액 0원 → "총 금액은 1원 이상 100,000,000원 이하로 입력해 주세요." 오류로
  정상 차단(`MIN_AMOUNT=1`이라 0은 하한 미만). 사다리타기 개별 금액 0원도 동일하게 차단.
  참고로 **균등 분배의 계산 결과값(배분액)이 0원이 되는 경우**(총 금액 < 인원수, 예:
  1원/2명)는 오류가 아니라 정상 경로다(FORMULA.md 예제 5) — `logic.test.ts`가 이미 골든
  테스트로 커버. 문제없음.
- **매우 큰 값**: 총 금액/개별 금액 상한(100,000,000원) 초과 시 정확한 한도가 명시된 오류
  메시지 표시(`validation.test.ts` 경계값 테스트로 확인: 상한 그대로는 통과, 상한+1은 거부).
  상한을 훨씬 초과하는 극단적으로 긴 숫자열(예: `99999999999999999999999`)을 붙여넣어도
  `parseAmount`가 `Number()` 변환 후 `> MAX_AMOUNT` 비교로 안전하게 거부되어 크래시나
  `Infinity`/`NaN` 노출 없이 동일한 상한 오류 메시지가 표시됨(본 QA에서 실측 확인 —
  `"99999999999999-.abc"` 같은 뒤섞인 값을 총 금액 필드에 넣어도 실시간 숫자 필터가 먼저
  적용되어 `console.error` 없이 정상적으로 처리됨).
- **소수**: 총 금액/개별 금액 입력 필드는 `onChange` 필터가 숫자 외 문자(소수점 포함)를
  즉시 제거하므로 "10.5" 같은 입력은 타이핑 즉시 "105"로 정규화된다 — 사용자가 소수를
  직접 입력해 잘못된 결과를 얻는 경로가 존재하지 않는다. `validateBillSplitInput`을 직접
  호출하는 경로(공유 상태 복원 등)에서도 `/^\d+$/` 정규식이 소수점을 거부해
  "금액은 숫자만 입력해 주세요."로 안전하게 처리된다.
- **잘못된 문자**: 한글·특수문자도 실시간 필터로 제거되어 필드에 남을 수 없다(위와 동일한
  메커니즘). 직접 검증 함수 호출 경로에서는 "OO은 숫자만 입력해 주세요." 오류로 처리.
- **멤버 2명 미만/20명 초과**: UI에서는 삭제/추가 버튼이 각각 경계에서 `disabled`되어 애초에
  도달 불가. `validateBillSplitInput`/`parseBillSplitShareState`를 직접 호출하는 경로(조작된
  공유 URL 등)에서는 "멤버는 2명 이상 20명 이하로 입력해 주세요." 오류로 정상 차단
  (`validation.test.ts` 경계값 2/20/21명 테스트로 확인).
- **사다리타기 금액 개수 불일치**: `raw.amounts.length !== raw.members.length`일 때
  "금액 목록 개수가 멤버 수와 일치하지 않습니다. 새로고침 후 다시 시도해 주세요." 오류로
  차단(`validation.test.ts`). UI 정상 사용 흐름에서는 멤버 추가/삭제 시 `handleAddMember`/
  `handleRemoveMember`가 `members`/`amounts` 배열을 항상 함께 갱신하므로 실사용자가 이
  불일치 상태에 직접 도달하기는 어렵고, 주로 방어적 코드(조작된 공유 URL 등)로 도달하는
  경로다 — `parseBillSplitShareState`도 `amounts.length !== n`이면 `null`을 반환해 이중으로
  방어한다. 문제없음.

## Copy / Reset
- **Reset(초기화)**: 방식이 균등으로 되돌아가고 멤버 2명(빈칸)/금액/총 금액/오류/결과가 모두
  초기 상태로 복귀(`handleReset` 코드 대조 + 기존 테스트로 확인).
- **Copy(링크 복사)**: `ShareActions`의 "링크 복사" 버튼은 공용 컴포넌트(`copyText`,
  `navigator.clipboard.writeText` 우선, `execCommand('copy')` 폴백)를 그대로 사용하며 이번
  계산기가 수정하지 않았다 — 다른 계산기에서 이미 검증된 공용 코드를 재사용. 계산 후
  "링크 복사"의 URL이 `buildStateShareUrl(baseUrl, toShareState(result))`로 만들어지고, 이
  URL이 실제로 원래 결과를 재현함은 위 "기능 테스트 — ShareActions 왕복"에서 확인했다.

## Console Error
- 실제 브라우저 DevTools 콘솔은 이 환경에 GUI 브라우저가 없어 직접 관찰하지 못했다.
- 대체 확인(임시 프로브 테스트, `console.error`/`console.warn` 스파이): 빈 입력 제출 → 균등
  분배 샘플/계산/초기화 → 몰아주기 샘플/계산/이미지 저장 시도(성공 모킹) → 사다리타기
  샘플/계산/멤버 추가·삭제 → 균등 분배로 복귀 후 뒤섞인 문자열("99999999999999-.abc")을 총
  금액 필드에 입력 후 재계산까지 이어지는 종합 시나리오에서 **`console.error`/`console.warn`
  호출 0회**를 확인했다(React key 중복 경고, act() 경고, hydration 경고 등 전혀 발생하지
  않음). 이 과정에서 실제 anchor `.click()`이 호출되는 지점(이미지 저장)에서 jsdom 자체의
  가상 콘솔이 "Not implemented: navigation to another Document"를 출력했으나, 이는
  애플리케이션의 `console.error` 호출이 아니라 jsdom이 `<a download>`의 다운로드 동작을
  지원하지 않아 대신 문서 탐색을 시도하려다 나는 jsdom 내부 알림이다(실제 브라우저는
  `download` 속성이 있으면 탐색 대신 파일 다운로드를 수행) — 애플리케이션 코드의 오류가
  아니라 테스트 환경(jsdom)의 한계로 판단한다.
- 기존에 실행 중이던 dev 서버 로그(`.next/dev/logs/next-development.log`)를 확인한 결과,
  `loan-interest-calculator` QA가 이미 "이 계산기와 무관"으로 판정한 두 가지(홈 경로의
  브라우저 확장 프로그램발 `ap-style` hydration mismatch, `generateStaticParams`의 간헐적
  `SyntaxError: Unexpected end of JSON input`)만 반복 관찰되고, **bill-split-calculator
  경로나 이 계산기 코드와 관련된 신규 오류는 로그에서 발견되지 않았다**(로그 전체에서
  "bill-split" 문자열 자체가 등장하지 않음 — 이 계산기 관련 오류가 기록된 적이 없다는 뜻).
- `npx tsc --noEmit`: 오류 0건. `npm run build`: 경고 없이 성공.

## Accessibility
- **label 연결**: SSR HTML에서 멤버 이름 입력(`sr-only` 라벨 2개, 기본 상태 2명 기준)과 총
  금액 입력(`htmlFor`) 등 `for="{id}"` 3개가 각각 대응하는 `id`의 input과 정확히 매칭됨을
  `curl` 응답으로 확인. 사다리타기 모드로 전환하면 금액 입력마다 `sr-only` 라벨이 추가로
  붙는 것도 코드 대조로 확인(`ui.tsx` 437~439행).
- **오류 = role="alert"**: 모든 필드 오류가 `<p role="alert">`로 표시되고, 이름/금액 입력에는
  `aria-invalid`/`aria-describedby`가 오류 존재 시에만 연결됨(코드 대조). SSR HTML의
  `role="alert"` 카운트는 초기 상태(오류 없음)라 0건으로 정상.
- **aria-live**: 결과 영역 전체가 `<div aria-live="polite">`로 감싸짐. SSR HTML에서
  `aria-live="polite"` 2건 확인(결과 영역 + `ShareActions` 피드백 문구) — 애니메이션이
  생략되는 경우(reduced-motion) 결과가 사실상 즉시 스크린리더에 전달됨.
- **애니메이션 SVG `aria-hidden`**: `RouletteWheel`/`LadderAnimation` 모두 최상위 `<svg
  aria-hidden="true">`(기존 컴포넌트 테스트로 재확인). 실제 정보(참여 멤버 이름, 금액 후보)는
  SVG 밖 `sr-only` 목록으로 별도 제공(UX/UI Critic Q15 조치 확인 — `RouletteWheel`은 N≤10일
  때 이름-번호 범례가 `sr-only`로, `LadderAnimation`도 참여 멤버·금액 후보 `sr-only` 목록을
  추가로 갖고 있음을 코드로 재확인).
- **필수 표시**: 시각적 `*`(`RequiredMark`)는 `aria-hidden="true"`로 장식 처리됨. 총 금액
  입력에는 `aria-required="true"`가 있으나(SSR HTML에서 1건 확인), **멤버 이름 입력과
  사다리타기 금액 입력에는 `aria-required` 속성이 없다** — 라벨이 `sr-only`(시각적 `*` 자체가
  없음)라 필수 여부를 스크린리더가 사전에 안내받지 못한다. `loan-interest-calculator` QA가
  이미 유사한 패턴(대출기간/상환방식에 `aria-required` 누락)을 Low로 지적했던 것과 같은
  종류의 사소한 개선 여지다(아래 "발견된 이슈" Low 참고).
- **키보드 포커스**: 방식 선택 라디오는 네이티브 `<input type="radio">`(시각적으로만
  `sr-only`)라 Tab/화살표 키 네이티브 동작이 유지되고, 감싸는 `<label>`에
  `focus-within:ring-2 focus-within:ring-primary`로 포커스 시 시각적 피드백 제공(전역
  `:focus-visible` 스타일과 별개의 이중 안전장치). "삭제"/"+ 멤버 추가"/"계산하기"/"초기화"/
  "샘플 값 채우기"/"결과 이미지 저장" 모두 네이티브 `<button>`이라 Enter/Space로 조작 가능.

## 반응형
- `docs/DESIGN_SYSTEM.md` "모바일" 절의 요건(입력 필드 잘림 없음, 숫자 키패드, 결과 한눈에
  보임, 가로 스크롤 없음)을 위 "모바일 테스트" 절에서 코드 치수 계산으로 확인했다.
- 금액 입력(`totalAmount`, `amounts[i]`)은 모두 `inputMode="numeric"`으로 모바일 숫자 키패드가
  뜨도록 설정되어 있음(코드 대조).
- 카드/표면 패턴(`SectionCard`, 핵심 결과 카드 `bg-primary`)이 `docs/DESIGN_SYSTEM.md`와 동일한
  클래스를 그대로 재사용함(신규 스타일 없음).

## 발견된 이슈 (등급별)

| 등급 | 개수 | 내용 |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 0 | — |
| Low | 4 | 아래 참고 |

**Low 상세**

1. **이미지 저장 기능의 실제 브라우저(특히 ARCHITECTURE.md가 "반드시" 요구한 iOS Safari
   실기기/시뮬레이터) 스모크 테스트를 이 QA 세션에서 수행하지 못함** — 이 환경에 GUI
   브라우저 자동화 도구가 없어(Playwright/Puppeteer 미설치), `html-to-image`의 `toPng`이
   실제 DOM→SVG→canvas→PNG 변환에 성공하는지, 그리고 그 결과가 실제로 파일 시스템에
   다운로드되는지를 직접 관찰하지 못했다. 실제(모킹하지 않은) `toPng`을 jsdom에서 직접
   호출해 본 결과 `ReferenceError: SVGImageElement is not defined`로 즉시 실패했는데, 이는
   jsdom이 이 전역 객체와 실제 Canvas 2D 렌더링(네이티브 `canvas` 패키지 미설치)을 지원하지
   않기 때문이며 **애플리케이션 코드의 결함이 아니라 테스트 환경의 근본적 한계**다(실제
   Chrome/Firefox/Safari는 모두 `SVGImageElement`를 정의하며, `html-to-image`는 이미 널리
   쓰이는 검증된 라이브러리다). 코드 레벨(동적 import, `toPng` 호출 인자, 캡처 대상 컨테이너,
   실패 시 대체 경로, 다크모드 `getComputedStyle` 인라인 원리)은 모두 정확히 구현돼 있음을
   확인했지만, **published 전환 전에 실기기(또는 최신 iOS 시뮬레이터) 스모크 테스트를 한 번은
   반드시 거칠 것을 강하게 권장한다** — 이는 ARCHITECTURE.md 자신이 이미 "QA 단계에서 반드시
   포함"이라고 명시한 항목이며, 이 계산기의 핵심 신규 기능(이 사이트 최초의 이미지 저장)에
   대한 실사용자 검증이 아직 도구 한계로 완료되지 않았다는 점을 투명하게 남긴다. (도구
   부재로 인한 미검증이며, 이번 QA에서 코드 결함이 발견된 것은 아니므로 Critical/High로
   분류하지 않는다 — 다만 항목의 중요도를 고려해 "발견된 이슈" 최상단에 기록한다.)
2. **멤버 이름 입력·사다리타기 금액 입력에 `aria-required` 속성 없음** — 두 입력 모두 실제로
   필수값이고(SPEC.md "빈 이름으로는 계산을 실행할 수 없다"), 제출 시 `role="alert"` 오류로
   결국 필수 여부를 알 수 있지만, 포커스 시점에 스크린리더가 "필수 입력"임을 미리 안내하지
   못한다. 총 금액 입력에는 이미 `aria-required="true"`가 있어 다른 필드도 동일하게 맞추면
   일관성이 개선된다(loan-interest-calculator QA가 이미 지적한 것과 같은 종류의 사소한 개선
   여지, 신규 결함이 아니라 일반적 관례 차이).
3. **실제 브라우저(Chrome/Firefox/Safari)·실기기 뷰포트에서의 시각적 확인 미실시** — 위
   "모바일 테스트"/"브라우저 테스트" 절 전체가 코드/치수 계산 기반 판단이다. UX/UI Critic도
   동일한 한계를 이미 기록했고(라운드 1 재검증까지), 본 QA도 독립적으로 같은 방식(직접 재계산)
   으로 재확인해 Critical한 레이아웃 붕괴 징후는 발견하지 못했지만, 픽셀 단위 실측은 여전히
   남아 있는 과제다.
4. **개발 서버 로그의 사전 존재 이슈 2건은 이 계산기와 무관함을 재확인** — `loan-interest-
   calculator` QA가 이미 "무관"으로 판정한 두 로그 이슈(홈 경로 hydration mismatch, 공유 라우트
   `generateStaticParams`의 간헐적 JSON 파싱 오류)가 이번에도 동일하게 관찰되나, 로그 전체에
   "bill-split" 문자열이 전혀 등장하지 않아 이 계산기 자체가 원인이 아님을 재확인했다(정보성
   기록).

## 회귀 테스트 (CLAUDE.md 필수 규칙)
- `npx vitest run --no-file-parallelism`(전체 스위트): **64개 파일, 698개 테스트 전부 통과**
  (Calculation Auditor·Optimizer 보고와 동일 수치 — 기존 계산기 회귀 없음).
- `npx vitest run src/calculators/bill-split-calculator --no-file-parallelism`: **6개 파일,
  70개 테스트 전부 통과**(Optimizer 라운드 1 수치와 일치).
- `npx tsc --noEmit`: 오류 0건.
- `npm run build`: Next.js 16.3.4(Turbopack) 프로덕션 빌드 성공. `bill-split-calculator`는
  `registry.ts`에 `status: "draft"`로 남아 있어 `generateStaticParams`(published만 대상)
  목록에는 없지만, `app/calculators/[slug]/page.tsx`가 draft도 라우팅을 허용하도록 설계돼
  있어(다른 draft 계산기와 동일한 기존 관례) `curl`로 직접 접근 시 200 응답을 확인했다.
- **`html-to-image` 신규 의존성이 다른 계산기 빌드에 영향을 주는지**: 전체 빌드가 경고 없이
  성공했고, 전체 vitest 스위트(64개 파일)도 모두 통과했다 — 다른 계산기가 이 패키지를
  import하지 않으며(동적 import가 `ui.tsx`의 클릭 핸들러 안에만 있음), 빌드 산출물에서도
  별도 청크로 분리되어 있어(위 "이미지 저장 기능" 참고) 다른 계산기의 번들/로딩에 영향을
  주지 않는다.
- 임시 QA 프로브 테스트(3개 파일, 총 11개 테스트 — 순수 로직/UI 반복 계산 4개, ShareActions
  왕복 2개, 실제 toPng 관찰 1개, console 미발생 확인 1개 등, 세션 스크래치패드 작성 → 계산기
  폴더에 잠시 복사해 실행 확인용으로만 사용 → 즉시 삭제)는 모두 통과(또는 관찰 목적 자체
  통과)했으며, 삭제 후 전체 스위트를 재실행해 파일 수·테스트 수가 삭제 전(64개 파일/698개
  테스트)과 정확히 동일함을 확인해 소스 트리에 아무 흔적도 남기지 않았음을 검증했다.

## 판정
**PASS**

- Critical 0, High 0, Medium 0, Low 4(모두 계산 정확성과 무관 — 도구/환경 한계 2건 + 접근성
  사소 개선 여지 1건 + 인프라 사전 이슈 무관 재확인 1건).
- Golden Test 13/13(logic.test.ts) 통과, 전체 회귀 스위트 698/698 통과, 계산기 전용 스위트
  70/70 통과, TypeScript 오류 0, 빌드 성공 — `docs/EVALUATION.md` PASS 기준(Critical 0, High 0,
  Golden Test 100%, Console/TS Error 0, Mobile Critical 0) 충족.
- **작업 지시가 요구한 핵심 확인 항목 결론**:
  - 몰아주기·사다리타기는 반복 계산(UI 30회 클릭 + 순수 함수 200회 직접 호출)에서 실제로
    결과가 매번 달라질 수 있음을 실측 확인했다(고정된 결과 아님).
  - ShareActions 왕복은 몰아주기(선정된 사람)·사다리타기(매칭 결과) 모두 재계산 없이 항상
    같은 결과로 정확히 재현됨을 3회 반복 렌더로 확인했다.
  - 이미지 저장 기능은 코드 레벨 와이어링(동적 import, `toPng` 호출, 캡처 대상, 실패 대체
    경로)을 전부 확인했지만, **실제 브라우저에서의 최종 PNG 변환 성공 여부와 실제 파일
    다운로드 트리거, 그리고 ARCHITECTURE.md가 명시한 iOS Safari 실기기 테스트는 이 환경의
    도구 한계로 검증하지 못했다** — 이 한계를 "발견된 이슈" Low #1에 명확히 남겼으며,
    Critical/High로 분류할 만한 코드 결함은 발견하지 못했다.
- Calculation Auditor(PASS) · UX/UI Critic(재검증 PASS) · QA(PASS, 단 이미지 저장 실기기
  검증은 미완료로 명시) — `published` 전환 전에 최소 1회의 실제 브라우저(가능하면 iOS Safari
  포함) 이미지 저장 스모크 테스트를 수행할 것을 권장하지만, 이는 이번 QA 라운드를 FAIL로
  만드는 사유는 아니라고 판단한다(코드 결함이 아니라 이 환경의 도구 한계이며, 기능 자체의
  구조적 정확성은 코드 레벨에서 충분히 확인됐다).
