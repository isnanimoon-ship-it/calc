# QA: 연봉 실수령액 계산기

QA 시점: 2026-09-06. Calculation Auditor(재검증 PASS, 1,000만원 경계값 버그 수정 확인 완료) +
UX/UI Critic(PASS, Medium 3건 잔존) 완료 이후 단계. 대상: `src/calculators/annual-salary-take-home-pay/`
전체(`ui.tsx` 메인 화면)와, 이번 작업이 리팩터링한 `src/lib/social-insurance.ts` +
`src/calculators/four-major-insurance/` 회귀 여부.

Edit 권한 없이(코드 미수정) 다음 방법으로 검증했다: (1) 소스 코드 직독,
(2) `npx vitest`/`npx tsc`/`npm run build` 실행, (3) 이미 3000번 포트에 떠 있던 기존
`next dev` 서버에 `curl`로 실제 라우트를 요청해 SSR 렌더링·JSON-LD·에러 바운더리 유무 확인,
(4) `npx tsx`로 `validation.ts`/`logic.ts`/`src/lib/share.ts`를 직접 호출하는 임시 검증
스크립트를 계산기 폴더 안에 **일시적으로 생성해 실행한 뒤 즉시 삭제**(Bash만 사용, 기존
파일은 전혀 수정하지 않았고 스크립트 실행 후 `ls`로 원래 13개 파일만 남았음을 확인).
Playwright 등 실제 브라우저 자동화 도구가 이 환경에 없어, 시각적 스크린샷 확인은 수행하지
못했다 — 모바일/브라우저 항목은 Tailwind 클래스 코드 분석과 컨테이너 폭 계산으로
대체했고, 이 한계를 각 절에 명시한다.

## 기능 테스트

- **계산 전/후 흐름**: `ui.test.tsx` 4개 시나리오(필수 연봉 오류, 샘플 값 계산 후 결과 카드
  3종 노출, 국민연금 하한 안내, 비과세>월급여 오류) 전부 재실행해 통과 확인. 입력을 바꾸면
  `amountChange`/`countChange`가 매번 `setResult(null)`/`setAppliedInput(null)`을 호출해
  이전 결과가 사라지는 것도 코드로 확인(`ui.tsx` 141~158행).
- **초기화**: `handleReset()`이 `emptyForm()`으로 완전히 되돌리고 `errors`/`result`/
  `appliedInput`을 모두 초기화 — `ui.test.tsx` "샘플 값으로 계산하고 초기화한다" 테스트로 확인.
- **샘플 값 채우기**: `SAMPLE_FORM`이 FORMULA.md 검증 예제 8(연봉 3,600만원, 비과세 20만원,
  가족 3명, 자녀 1명)과 동일 — DESIGN_SYSTEM.md "Reset/Sample" 권장("FORMULA.md 검증 예제
  값을 그대로 사용")을 그대로 따른다.
- **조건부 필드(비과세 금액 등)**: 이 계산기는 조건부로 나타나거나 숨겨지는 필드가 없다(4개
  필드 모두 항상 노출, 비과세 금액과 자녀 수는 "(선택)"으로만 표시됨) — SPEC/ARCHITECTURE
  어디에도 조건부 노출 요구가 없으므로 정상.
- **ShareActions(계산 전/후 URL, Base64URL 상태 복원)**: `src/lib/share.ts`의
  `buildStateShareUrl`/`decodeShareState`를 임시 스크립트로 직접 호출해 왕복 검증했다.
  - 계산 전: `url` prop이 `baseUrl`(쿼리 없는 계산기 URL)로 전달됨(`ui.tsx` 342행).
  - 계산 후: `buildStateShareUrl(baseUrl, { f: form })`으로 인코딩. 샘플과 동일한 폼
    (연봉 3,600만원 등)을 인코딩(URL 길이 242자, 허용 상한 12,000자 대비 여유 충분)→
    디코딩→`validateAnnualSalaryTakeHomePayInput` 재검증 성공→
    `calculateAnnualSalaryTakeHomePay` 재계산 결과 `netMonthlyPay=2,723,135원`으로 정상
    산출.
  - 손상된 `s` 파라미터(`decodeShareState("")`, `decodeShareState("!!!not-valid-base64!!!")`),
    형태가 다른 JSON(`{ random: 1 }`을 인코딩), 유효한 봉투이지만 값이 잘못된 페이로드
    (`{ f: { annualSalary: "not-a-number" } }`) 모두 `null` 반환 또는
    `validateAnnualSalaryTakeHomePayInput` 실패로 안전하게 무시됨(예외로 화면이 깨지지
    않음) — 확인.
  - `useCalculatorShare` 훅 자체(`components/calculator/useCalculatorShare.ts`)는 공용
    컴포넌트라 `ShareActions.test.tsx`/`calculator-sharing.test.tsx`가 이미 별도로
    검증하며, 이번 QA는 이 계산기의 통합 지점(`ui.tsx`의 `useCalculatorShare` 콜백이
    `validateAnnualSalaryTakeHomePayInput`을 거쳐야만 `setResult`를 호출하는 것)만
    추가로 재확인했다.
- **(신규 발견) 비현실적으로 낮은 연봉 입력 시 세후 월 실수령액이 음수로 표시됨**: 아래
  "발견된 이슈" 표 참고(Medium).

## 모바일 테스트 (320 / 375 / 390 / 768 / 1440px)

브라우저 스크린샷 도구가 없어 Tailwind 클래스와 컨테이너 폭 계산으로 대체 확인했다(한계
명시).

- **입력 폼**: 페이지 컨테이너 `px-5`(320~639px 구간, 좌우 각 20px) → 폼 컨테이너 `p-5`
  (좌우 각 20px 추가) → 320px 뷰포트 기준 폼 내부 컨텐츠 폭 약 240px 확보. 부양가족 수·
  자녀 수 필드(`grid gap-5 sm:grid-cols-2`, `sm`=640px 미만이라 1열로 자동 전환)는 각각
  240px 전체 폭을 쓰므로 잘림 없음. 버튼 3개(`flex flex-wrap gap-3`)는 좁은 화면에서
  자동 줄바꿈된다.
- **공제 내역 카드(4대 보험 4개 + 소득세 + 지방소득세, 총 6개 항목)**: `docs/DESIGN_SYSTEM.md`
  카드 그리드 패턴(`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)이 적용되는 "여러 카드 병렬
  배치" 구조가 **아니다** — `SectionCard` 하나 안에 `DeductionRow`(`flex items-baseline
  justify-between gap-3`) 6개가 세로로 쌓이는 리스트/표 구조다(`ui.tsx` 369~403행). 각
  행의 라벨(최대 6자 "장기요양보험")과 값("1,507,400원"류, 최대 약 11자)이 `flex
  justify-between`으로 좌우에 배치되므로, 320px 기준 `SectionCard`(`p-6`, 좌우 각 24px)
  내부 컨텐츠 폭 약 232px에서도 두 텍스트가 겹치거나 잘릴 위험이 낮다(계산 근거: 라벨
  텍스트 폭 추정 약 90px + 값 텍스트 폭 추정 약 100px + `gap-3`(12px) = 약 202px, 232px
  이내). 각 항목 아래 조건부 경고 문구(`InlineNotice`)는 `flex items-start gap-1.5`로
  줄바꿈을 허용해 좁은 화면에서도 겹치지 않는다. **"6개 항목이 모바일에서 카드 그리드로
  전환되는지"는 애초에 카드 그리드 구조가 아니므로 해당 사항 없음** — 세로 리스트 구조는
  모든 뷰포트에서 동일하게 유지되며 별도 브레이크포인트 전환이 필요하지 않다.
- **핵심 결과 카드**: `netMonthlyPay` 숫자가 `text-4xl sm:text-5xl`이라 320px에서는 `text-4xl`
  (36px)로 표시된다. 8~9자리 숫자("7,532,100원", 최대 약 13자)가 `p-6`(좌우 24px 제외 시
  컨텐츠 폭 약 232px) 안에 36px 폰트로 들어가는지 폭 계산 시 여유가 크지 않으나(1자당
  약 20~24px 추정 시 13자 약 260~310px로 232px를 초과할 가능성), 폰트가 `tabular-nums`
  숫자 전용이고 한글이 아니라 숫자+콤마+"원"이라 실제 렌더링 폭은 추정보다 좁을 수 있다
  (아래 이슈 참고 — 실기기 확인 권고).
- **정책 안내 배지**: `flex flex-wrap items-center gap-2`로 두 배지("4대 보험 기준일
  2026-07-01 ~ 2027-06-30", "간이세액표 시행일 2026-03-01")가 줄바꿈 가능. 배지 자체
  텍스트에 공백이 포함돼 있어(날짜 구간 표기) 배지 내부에서도 자동 줄바꿈되며, 고정 폭
  요소가 아니라 페이지 가로 스크롤을 유발하지 않는다.
- **`w-[...]`/고정 픽셀 폭/`overflow-x` 클래스**: `ui.tsx` 전체를 grep한 결과 없음(232행
  주변 `overflow-hidden`은 핵심 결과 카드 자체 그림자/그라디언트를 자르는 용도로 가로
  스크롤과 무관).
- **768px(`md`, `sm` 이상)**: 부양가족 수/자녀 수 필드가 `sm:grid-cols-2`(640px 이상)로
  이미 2열 전환. 폼 컨테이너가 `sm:p-8`로 패딩이 늘어나 여유 폭이 오히려 커진다.
- **1440px**: 페이지 컨테이너가 `max-w-6xl`(1152px)로 상한이 걸려 있어 큰 화면에서도
  좌우 여백만 늘어나고 레이아웃이 과도하게 늘어지지 않는다.
- **실기기/실브라우저 스크린샷 미실시(한계)**: 위 결론은 코드/치수 계산에 근거한 것이며,
  실제 폰트 렌더링 폭(특히 위에서 지적한 320px 핵심 결과 숫자)까지 반영한 것은 아니다.
  배포 전 실제 브라우저 DevTools 반응형 모드로 320px에서 핵심 결과 숫자가 잘리지 않는지
  최소 1회 육안 확인할 것을 권고한다(아래 이슈 Low 참고).

## 브라우저 테스트

실제 다중 브라우저(Chromium/Firefox/Safari) 구동 도구가 없어 코드 레벨의 브라우저 호환성
위험 요소만 점검했다.

- 이 계산기 파일 전체(`ui.tsx`/`formatting.ts`/`logic.ts`/`policy.ts`/`withholding-table.ts`/
  `validation.ts`/`content.ts`)를 grep한 결과 사용하는 브라우저 API는 `Intl.NumberFormat`
  (`formatting.ts` 11행) 하나뿐이다 — 전 브라우저 표준 지원, 이미 이 저장소의 모든 published
  계산기가 동일하게 사용 중인 패턴이라 새로운 호환성 위험이 없다.
- `backdrop-filter`/`oklch`/`color-mix`/`@supports` 등 최신 CSS 기능은 이 계산기 코드에도
  `app/globals.css`에도 없음(grep 결과 없음).
- `ShareActions`(클립보드 복사, `navigator.share`)는 이 계산기가 직접 구현한 것이 아니라
  공용 컴포넌트를 그대로 재사용하며, 그 자체의 브라우저 호환 폴백은
  `ShareActions.test.tsx`가 이미 검증한다.
- **실제 다중 브라우저 구동 미실시(한계)**: Chromium/Firefox/Safari 실제 렌더링 차이는
  육안 확인하지 못했다. 배포 전 최소 Chrome·Firefox 최신 버전에서 폼 제출·공유·다크모드
  전환을 1회씩 수동 확인할 것을 권고한다.

## 입력 검증

`validateAnnualSalaryTakeHomePayInput`/`calculateAnnualSalaryTakeHomePay`를 임시 스크립트로
직접 호출해 아래 케이스를 확인했다(전부 기대대로 동작, 소스 미변경).

- **빈 입력**: `annualSalary`/`dependentFamilyCount` 빈 값 → "세전 연봉을 입력해 주세요."/
  "부양가족 수(본인 포함)를 입력해 주세요." 각각 개별 오류. 공백 문자열(`"   "`)도 빈 값과
  동일하게 처리됨(확인).
- **음수**: `annualSalary="-1000000"`, `monthlyNonTaxablePay="-1"`,
  `dependentFamilyCount="-1"`, `childrenAge8to20Count="-1"` 전부 "0(또는 1) 이상/보다 큰
  정수로 입력해 주세요." 오류로 안전하게 차단됨. 실제 UI 입력창(`amountChange`가
  `event.target.value.replace(/\D/g, "")`로 즉시 숫자만 남김, `countChange`가
  `/^[0-9]*$/` 정규식으로 숫자 아닌 입력 자체를 거부)에서는 "-" 기호가 타이핑 즉시
  제거되어 음수를 아예 입력할 수 없다 — 검증 로직과 UI 정제 로직이 이중으로 차단.
- **0**: `annualSalary="0"`(오류), `dependentFamilyCount="0"`(오류, 최소 1명)은 정확히
  차단됨. `monthlyNonTaxablePay="0"`(기본값, 정상), `childrenAge8to20Count="0"`(기본값,
  정상)은 정상 통과 — FORMULA.md "기본값 0" 요구와 일치.
- **매우 큰 값**: `annualSalary` 100억 초과(`10,000,000,001`) → "100억 원 이하로 입력해
  주세요." 오류. **정확히 100억(`10,000,000,000`)은 경계값으로 정상 허용**됨(FORMULA.md
  "annualSalary <= 10,000,000,000"과 일치, `validation.test.ts`에도 이미 이 경계 테스트가
  있음을 재확인). `dependentFamilyCount` 31명(오류)/정확히 30명(정상 허용) 경계도 동일하게
  확인. 천문학적으로 큰 문자열(`"99999999999999999999999999"`)이나 `annualSalary` 12자리
  숫자(`999,999,999,999`)도 NaN/오버플로 없이 "100억 원 이하로" 오류로 안전하게 처리됨
  (예외 발생 없음).
- **소수**: `annualSalary="36000000.5"`, `monthlyNonTaxablePay="1.5"`,
  `dependentFamilyCount="1.5"`, `childrenAge8to20Count="1.5"` 전부 "정수로 입력해
  주세요." 오류로 정확히 차단. 다만 실제 UI 입력창에서는 아래 참고 사항대로 소수점이
  조용히 제거된 뒤 정수로 합쳐지는 동작이 있다(설계상 허용된 패턴, 아래 참고).
- **잘못된 문자**: `annualSalary="abc원"`, `"36000000원"`, `"+36000000"`(플러스 부호),
  `"3.6e7"`(과학적 표기), 전각(全角) 숫자(`"３６０００００００"`) 전부 "정수로 입력해
  주세요." 오류로 안전하게 차단(콤마 포함 정상 표기 `"36,000,000"`은 정상 파싱, 앞자리
  0(`"000036000000"`)도 정상 파싱되어 36,000,000으로 처리 — 사용자 실수에 대한 관용적
  처리로 문제 없음).
- **비과세 금액이 월급여 초과**: `annualSalary=12,000,000`(월급여 1,000,000원),
  `monthlyNonTaxablePay=2,000,000` → "월 비과세 금액은 세전 월 급여(연봉 ÷ 12)보다 클 수
  없습니다." 오류(정확히 확인). **월급여와 정확히 같은 경우(`monthlyNonTaxablePay=
  1,000,000`)는 경계값으로 정상 허용**되어 `taxableMonthlyPay=0`으로 계산됨(FORMULA.md
  "예외" 절 "taxableMonthlyPay=0 → 4대 보험 산정 대상 보수가 없다는 안내와 함께 소득세도
  0원" 요구와 일치, `isBelowTaxableThreshold=true`로 정확히 표시됨을 확인).
- **자녀 수가 부양가족 수-1 초과**: `dependentFamilyCount=3`, `childrenAge8to20Count=3` →
  "8세~20세 자녀 수는 부양가족 수(본인 포함) - 1명을 초과할 수 없습니다..." 오류.
  **정확히 경계(`childrenAge8to20Count=2`)는 정상 허용**됨(FORMULA.md
  "childrenAge8to20Count <= dependentFamilyCount - 1" 요구와 일치).
- **참고(신규 발견, Low)**: 금액 필드(`amountChange`)는 `replace(/\D/g, "")`로 숫자가
  아닌 모든 문자(소수점 포함)를 제거하고 남은 숫자를 그대로 이어붙인다 — 예:
  "36000000.5" 타이핑 시 실제 상태는 "360000005"(소수점이 사라지고 자릿수가 밀림)가
  된다. 다만 이는 이 계산기만의 결함이 아니라 `docs/DESIGN_SYSTEM.md`가 명시적으로
  지정한 **저장소 전체 표준 패턴**("금액 입력은... severance-pay의 `handleAmountChange`
  패턴")을 그대로 따른 것이며, `four-major-insurance`를 포함한 기존 금액 입력 필드
  전부가 동일하게 동작한다 — 이 계산기의 새로운 결함이 아니므로 등급을 매기지 않고
  참고로만 기록한다(개수 필드 `countChange`는 `/^[0-9]*$/` 정규식으로 애초에 소수점
  입력 자체를 거부해 이 문제가 없음 — 개수 필드가 금액 필드보다 더 엄격하게 설계됨).

## Copy / Reset

- **Reset(초기화)**: `handleReset()`이 폼을 `emptyForm()`(비과세 0, 가족 1명, 자녀 0명,
  연봉 빈 값)으로, `errors`/`result`/`appliedInput`을 전부 초기 상태로 되돌림 — 기존
  `ui.test.tsx` "샘플 값으로 계산하고 초기화한다" 테스트로 확인(초기화 후 "세후 월
  실수령액(예상)" 텍스트가 사라짐).
- **Copy(링크 복사)**: 계산기 자체 구현이 아니라 공용 `ShareActions`의 "링크 복사" 버튼을
  그대로 재사용한다. 이 계산기 통합에서 확인한 것: `url` prop이 계산 전에는 `baseUrl`
  (쿼리 없는 계산기 URL), 계산 후에는 `buildStateShareUrl(baseUrl, { f: form })`(Base64URL
  상태 포함 결과 URL)로 정확히 전환됨(위 "기능 테스트" ShareActions 절 참고). 공용
  컴포넌트 자체의 복사 성공/실패 피드백은 `ShareActions.test.tsx`가 이미 검증하므로
  중복 검증하지 않았다.

## Console Error

- **`npm run build`(next build, Turbopack)**: 성공, 컴파일·TypeScript·정적 페이지 생성
  전부 오류 없음(16개 페이지 생성). `draft` 상태라 정적 프리렌더 목록(`generateStaticParams`)
  에는 없지만, `calculator-components.ts`/`page.tsx`의 `faqItemsBySlug` 매핑으로 URL 직접
  접근 시 요청 시점 렌더링되는 기존 draft 계산기 선례와 동일하게 동작 확인.
- **개발 서버 구동 확인**: 이미 실행 중이던 `next dev`(포트 3000, PID 22372)에
  `/calculators/annual-salary-take-home-pay`를 curl로 요청 → HTTP 200. 응답 HTML을
  `error`/`errorStyles`/`errorScripts` 문자열로 grep한 결과 Next.js 프레임워크의 정적
  에러 바운더리 보일러플레이트(`"error":"$undefined"`)만 존재 — 실제 런타임 에러 아님.
  응답 HTML에 "연봉 실수령액 계산기" 제목과 `"@type":"FAQPage"` JSON-LD가 정상 포함됨을
  확인.
- **개발 서버 로그(`​.next/dev/logs/next-development.log`) 확인**: 이 로그 파일에 과거
  세션에서 남은 것으로 보이는 하이드레이션 경고 1건이 있었으나(`body`에 `ap-style=""`
  속성이 붙어 서버/클라이언트 HTML이 불일치한다는 React 경고 — 메시지 자체가 "브라우저
  확장 프로그램이 React 로드 전 HTML을 변경했을 수 있다"고 명시), 이 계산기의 slug나
  라우트를 전혀 언급하지 않고(`grep -c "annual-salary-take-home-pay"` = 0) `layout.tsx`
  일반 레이아웃 트리만 언급한다. 이 계산기 코드(`ui.tsx` 등) 전체를 grep한 결과
  `typeof window`/`Date.now()`/`Math.random()`/`localStorage` 등 하이드레이션 불일치를
  유발할 수 있는 패턴이 전혀 없음을 확인했다 — 이 경고는 이 계산기가 원인이 아니라 이
  개발 서버에 이전에 연결됐던 실제 브라우저 세션의 확장 프로그램 노이즈로 판단한다
  (참고로만 기록, 이 계산기의 결함으로 분류하지 않음).
- **`ui.test.tsx` 재실행(`--reporter=verbose`)**: 4개 시나리오 전부 통과, 터미널에
  React의 key 누락·controlled/uncontrolled 전환·act() 경고 등 `console.error`/
  `console.warn`이 전혀 출력되지 않음(정상 계산, 국민연금 하한 경고, 비과세 초과 오류
  케이스 포함).
- 결론: 이 계산기에 기인한 Console Error 0건.

## Accessibility

- **label 연결**: 4개 입력(`annualSalary`/`monthlyNonTaxablePay`/`dependentFamilyCount`/
  `childrenAge8to20Count`) 전부 `htmlFor`/`id` 쌍이 `useId()` 기반 고유 접두사로 존재—
  확인.
- **aria-live**: 결과 영역 전체가 `aria-live="polite"`(347행)로 감싸여 있음 — 확인.
- **role="alert" + aria-describedby 연결(모범 사례)**: 4개 필드 전부
  `aria-describedby={`${formId}-{field}-help${error ? ` ${formId}-{field}-error` : ""}`}`
  패턴으로 help id와 error id를 동적으로 join한다(`severance-pay/ui.tsx`가 이미 세운
  올바른 해법과 동일) — 오류 발생 시 스크린리더가 도움말과 오류 사유를 모두 안내받을 수
  있다. 이는 `housing-subscription-score`가 QA 1라운드에서 지적받았던 "오류 id 미연결"
  결함이 이 계산기에는 **처음부터 없다**는 뜻이다(Builder가 이미 올바른 패턴으로 구현).
- **aria-required/aria-invalid**: 필수 필드(`annualSalary`, `dependentFamilyCount`)에
  `aria-required="true"`, 오류 시에만 `aria-invalid={true}`(정상일 때는 속성 자체가
  렌더링되지 않아 "invalid 아님" 상태와 동일 — 유효한 패턴) — 확인.
- **키보드 포커스**: 이 계산기는 라디오/체크박스 토글 그룹이 전혀 없고(4개 필드 모두
  일반 `<input type="text">`류) 버튼 3개도 일반 `<button>`이다 — 전역 `:focus-visible`
  (`globals.css`, `outline: 2px solid var(--primary)`)이 그대로 적용되며, 커스텀 `sr-only`
  라디오 패턴에서 자주 발생하는 "포커스 표시 누락"(예: `housing-subscription-score` M-1
  이슈) 위험이 이 계산기에는 구조적으로 존재하지 않는다.
- **FaqAccordion**: 공용 컴포넌트 코드 확인 — 버튼 `aria-expanded`/`aria-controls`, 패널
  `role="region"`+`aria-labelledby`, 펼침 상태를 아이콘 회전(`aria-hidden`)과
  `aria-expanded` 양쪽으로 전달 — 이 계산기 고유의 커스터마이징 없이 그대로 재사용해
  문제 없음.
- **명도 대비**: 새 색상 토큰을 임의로 추가하지 않고 기존 시맨틱 토큰(`text-muted`,
  `text-danger`, `text-primary`, `bg-warning-surface` 미사용/`bg-surface-subtle` 등)과
  다른 published 계산기가 이미 쓰는 `text-zinc-700 dark:text-zinc-300`(계산 근거 본문)
  관행을 그대로 재사용 — 이 계산기만의 새로운 대비 위험 없음.
- **결론**: 이 계산기에서 접근성 Critical/High/Medium 이슈를 발견하지 못했다(UX/UI
  Critic이 이미 별도 관점에서 지적한 Medium 3건은 용어 통일성·고지 강조·경계값 문구
  정확성 문제이며 접근성 자체의 문제는 아니다 — 아래 "참고" 절 재확인).

## 반응형

- `docs/DESIGN_SYSTEM.md`의 카드 그리드 표준 패턴(`grid-cols-1 md:grid-cols-2
  lg:grid-cols-3`)이 적용되는 "여러 결과 카드를 나란히 배치"하는 구조가 이 계산기에는
  없다(공제 내역은 카드 그리드가 아니라 단일 `SectionCard` 내부 세로 리스트) — 해당
  패턴 위반 여부를 판단할 대상 자체가 존재하지 않는다.
- **입력 필드 그리드**(`grid gap-5 sm:grid-cols-2`, 부양가족 수·자녀 수)와 **하단
  UsageGuide/IntroSection 그리드**(`grid gap-5 lg:grid-cols-2`, 450행)를 다른 계산기와
  대조한 결과, 후자는 `severance-pay/ui.tsx`(792행)·`housing-subscription-score/ui.tsx`
  (961행)와 **정확히 동일한 클래스**(`mt-16 grid gap-5 lg:grid-cols-2`)로 이 저장소가
  "2개짜리 카드 쌍"에 이미 확립한 표준 패턴을 그대로 따른다 — 새로운 편차가 아니다.
- **가로 스크롤**: 고정 픽셀 폭(`w-[...]`)이나 `overflow-x` 관련 위험 클래스가 이 계산기
  파일에 전혀 없음(grep 확인) — 320~1440px 전 구간에서 가로 스크롤을 유발할 코드 레벨
  요인 없음.

## 회귀 테스트 (`four-major-insurance` / `src/lib/social-insurance.ts`, CLAUDE.md 필수 확인)

이번 작업이 `four-major-insurance/logic.ts`의 근로자 부담분 계산을
`src/lib/social-insurance.ts`로 추출했으므로, 아래를 직접 재확인했다.

- **`four-major-insurance/ui.tsx` 코드 직독**: 이번 리팩터링 대상인 `logic.ts`를 import해
  쓰는 방식(`calculateFourMajorInsurance`, `employmentTierLabels` 등)이 리팩터링 전과
  동일한 공개 시그니처를 그대로 호출하고 있어, UI 코드 자체는 전혀 수정되지 않았음을
  확인했다(`formatWon`/`contributionFormula`/결과 카드 3종/`계산 방법` breakdown 전부
  기존 그대로).
- **`four-major-insurance` 페이지 실제 렌더링**: 개발 서버에 `/calculators/four-major-insurance`를
  curl로 요청 → HTTP 200 정상 응답.
- **테스트 재실행**: `npx vitest run --no-file-parallelism src/calculators/four-major-insurance
  src/lib/social-insurance.test.ts --reporter=verbose` → **4개 파일, 28개 테스트 전부
  통과**(`four-major-insurance/logic.test.ts` 12개 Golden/경계 테스트, `ui.test.tsx` 4개,
  `validation.test.ts` 9개, `social-insurance.test.ts` 2개, 전부 개별 테스트명까지 확인).
  국민연금 하한/상한, 건강보험 상한, 장기요양보험 유도, 고용보험 사업장 규모별 계산 등
  계산 결과가 리팩터링 전과 1원도 달라지지 않았음을 재확인.
- **전체 스위트**: `npx vitest run --no-file-parallelism` → **53개 파일, 537개 테스트 전부
  통과**.
- **`npx tsc --noEmit`**: 오류 0.
- **`npm run build`**: 성공(Compiled successfully, TypeScript 통과, 16개 페이지 생성).
- **결론**: `four-major-insurance` 계산기 자체의 UI·계산 결과에 회귀 없음을 확인했다.

## 참고 — 이전 단계에서 이미 식별되고 QA 범위 밖으로 재확인만 한 항목

아래는 QA가 새로 발견한 이슈가 아니라, Calculation Auditor/UX·UI Critic이 이미 등급을
매긴 항목을 QA 관점에서 코드 존재 여부만 재확인한 것이다(등급 재조정 없음).

- UX/UI Critic Medium 3건(용어 불일치 "부양가족 수"↔"공제대상가족", 연말정산 미반영
  고지의 낮은 시각적 강조, `buildHighIncomeFormulaWarning` 문구가 정확히 1,000만원
  경계값에서 부정확)은 여전히 코드에 남아있음을 확인했다(`formatting.ts`/`content.ts`
  grep으로 재확인) — 이미 PASS 판정을 받은 상태이며 QA가 다시 등급을 매기지 않는다.
- `withholding-table.ts`/`policy.ts`/`logic.ts`의 "1억원" 주석 표기(실제로는 "1,000만원"
  의 오기, Calculation Auditor Low 이슈로 이미 기록됨)가 여전히 남아있음을 grep으로
  재확인했다 — 계산값·사용자 화면에는 영향 없음(기존 판정 그대로).

## 발견된 이슈 (등급별)

| 등급 | 이슈 | 위치 | 비고 |
|---|---|---|---|
| Critical | 없음 | — | — |
| High | 없음 | — | — |
| **Medium (신규)** | `annualSalary`가 매우 낮을 때(예: 100,000원/년, 정상 검증을 통과하는 값) 4대 보험 하한(국민연금 기준소득월액 최소 410,000원 등)이 실제 월급여와 무관하게 적용되어 `netMonthlyPay`(세후 월 실수령액)가 **음수**로 계산·표시된다(예: 연봉 100,000원 → 월급여 8,333원인데 공제 합계 30,940원 → 실수령액 **-22,607원**). `formatWon`이 `Intl.NumberFormat`으로 "-22,607원"을 그대로 렌더링하며, 이 상태에 대한 별도 경고 문구나 하한 안내가 전혀 없다. 손익분기 경계는 약 연봉 **373,000~374,000원**(월급여 약 31,150원)이다 | `src/calculators/annual-salary-take-home-pay/validation.ts`(annualSalary 하한이 `> 0`뿐, 현실적 최저 임금 하한 없음), `logic.ts`(netMonthlyPay에 0 하한 없음), `ui.tsx`(음수 결과에 대한 경고 문구 없음) | 실사용자가 실수로 도달할 가능성은 낮다(정상적인 연봉이라면 절대 이 범위에 들어오지 않음 — 한국 실질 최저연봉은 이보다 수십~수백 배 큼). 다만 SPEC/FORMULA.md 어디에도 이 케이스에 대한 처리 규칙이 없어 "확인 필요" 상태로 방치돼 있고, 입력 자체는 현재 검증 규칙(`annualSalary > 0`)을 100% 통과하는 "유효한" 값이므로 Edge Case Test로 명시적으로 다뤄야 한다. 권고: (a) `netMonthlyPay`를 0 이상으로 clamp하고 "산정 기준 보수가 4대 보험 최저 기준보다 낮아 실수령액이 0원 미만이 될 수 있습니다" 류 경고 추가, 또는 (b) `annualSalary`에 현실적 최저 하한(예: 국민연금 하한 기준소득월액 × 12) 검증 추가 |
| Low | 320px 뷰포트에서 핵심 결과 카드의 `netMonthlyPay` 숫자(`text-4xl`, 최대 약 13자 "7,532,100원")가 카드 내부 컨텐츠 폭(약 232px) 대비 폭 여유가 크지 않아(코드/치수 계산상 근접, 실제 폰트 렌더링에 따라 달라질 수 있음) 실기기 확인이 필요하다 | `ui.tsx` 351~366행(핵심 결과 카드) | 실제 잘림 여부는 코드 리뷰 한계상 확정할 수 없음(위 "모바일 테스트" 참고) — 배포 전 320px 실기기/DevTools 육안 확인 권고 |
| Low | 금액 입력 필드(`amountChange`)가 소수점을 조용히 제거하고 남은 숫자를 이어붙인다(예: "36000000.5" → "360000005") | `ui.tsx`(`amountChange`, 141~148행) | 이 계산기만의 결함이 아니라 `docs/DESIGN_SYSTEM.md`가 명시한 저장소 전체 표준 패턴(`severance-pay`의 `handleAmountChange` 그대로 재사용) — 새로운 이슈로 등급을 매기지 않고 참고로만 기록 |

## 판정

**PASS**

- Critical 0, High 0 — `docs/EVALUATION.md` PASS 기준("Critical 0, High 0")을 충족한다.
- 신규 발견 Medium 1건(비현실적으로 낮은 연봉 입력 시 세후 월 실수령액 음수 표시)은 계산
  공식 자체의 오류가 아니라(4대 보험 하한 규정을 FORMULA.md/Calculation Auditor가 이미
  검증한 그대로 충실히 적용한 결과), 실사용자가 도달할 가능성이 낮은 극단적 Edge Case에서
  발생하는 "안내 부족/가드레일 부재" 성격의 UX 문제로 판단해 Medium으로 분류했다 — PASS
  기준(Critical 0, High 0)을 막는 사유가 아니다.
- Low 2건(320px 핵심 숫자 폭 여유, 금액 입력 소수점 무음 처리 — 후자는 저장소 전체
  표준 패턴이라 이 계산기 고유 결함 아님)도 PASS를 막지 않는다.
- Console Error 0건(이 계산기 기인), TypeScript Error 0건, 전체 Vitest 스위트(53개 파일
  537개 테스트) 및 이 계산기 전용 스위트(5개 파일 68개 테스트, Golden Test 1~13 포함)
  전부 통과, `npm run build` 성공 — Golden Test 100% PASS 포함 확인.
- **회귀 방지 확인**: `four-major-insurance`(28개 테스트, 페이지 렌더링 포함)와
  `src/lib/social-insurance.ts` 공유 계약 전부 리팩터링 전과 동일하게 통과 — 이번
  `src/lib/social-insurance.ts` 추출 리팩터링으로 인한 회귀 없음.
- Mobile Critical Issue 0건(코드/치수 계산 기준, 실기기 스크린샷 확인은 하지 못한 한계
  있음 — 위 Low 이슈의 320px 핵심 숫자 폭만 배포 전 수동 확인 권고).
- 다음 라운드(Optimizer 유휴 시간 또는 정기 정비)에서 신규 Medium 1건(음수 실수령액
  가드레일)의 해결을 권고하되, 이번 QA 판정 자체는 PASS로 종료한다.

## QA 재검증 (라운드 1)

QA 재검증 시점: 2026-09-06. 지시 배경: 위 "판정(PASS, Medium 1건 신규 발견 — 비현실적으로
낮은 연봉에서 세후 실수령액이 음수로 표시되나 경고 없음)"을 Optimizer가
`tasks/annual-salary-take-home-pay/EVALUATION.md` "## Optimizer 수정 (라운드 2)"에서
수정했다고 보고했다(`netMonthlyPay < 0`일 때 조건부 경고 카드 `buildNegativeNetPayWarning`
추가, 계산 로직·검증 범위는 변경 없음이라는 주장). 이번 라운드는 **Optimizer의 자체
보고를 그대로 신뢰하지 않고** 소스 코드 재독해 + 실제 함수/컴포넌트 실행으로 독립
재현했다. Edit 권한 없이 코드는 전혀 수정하지 않았다.

### 0. 검증 방법 요약

1. `src/calculators/annual-salary-take-home-pay/{ui.tsx, formatting.ts, types.ts, logic.ts,
   validation.ts}`를 전문 재독해해 수정 내역이 실제로 반영됐는지 확인했다.
2. **독립 재현 테스트를 별도로 작성해 실행**했다 — 기존 `formatting.test.ts`/`ui.test.tsx`에
   이미 있는 회귀 테스트를 그대로 신뢰하지 않고, 계산기 폴더 안에 임시 파일
   `__qa_reverify_round1__.test.ts`를 새로 작성해(QA가 최초 보고했던 재현값 `annualSalary=
   100,000원`, 정상 급여 `annualSalary=36,000,000원`, 손익분기 경계 부근 `373,000원`/
   `20,000,000원` 4개 케이스) `calculateAnnualSalaryTakeHomePay`와
   `buildNegativeNetPayWarning`을 직접 호출한 뒤 `npx vitest run`으로 실행하고, 검증이 끝나는
   즉시 `rm`으로 삭제했다(Bash만 사용, 기존 소스 파일은 전혀 수정하지 않았다 — 삭제 후 `ls`로
   원래 13개 파일만 남았음을 확인).
3. Optimizer가 추가했다고 보고한 `ui.test.tsx`의 실제 컴포넌트 렌더링 테스트("비현실적으로
   낮은 연봉 입력 시 세후 실수령액 음수 경고 카드를 표시한다", "정상 범위 계산에서는
   실수령액 음수 경고 카드가 나오지 않는다")를 재실행해 실제 화면 렌더링 경로(순수 함수
   호출이 아니라 `render`+`fireEvent`+`screen.getByText`)로도 재확인했다.
4. 전체 회귀 스위트(`--no-file-parallelism`), 계산기 전용 스위트, `four-major-insurance`/
   `social-insurance` 회귀 스위트, `tsc --noEmit`, `npm run build`를 모두 재실행했다.
5. `validation.ts`를 다시 읽어 "계산 로직·검증 범위는 변경 없음"이라는 Optimizer 주장을
   직접 대조했다.

### 1. 수정 반영 여부 — 소스 코드 재확인

**보고된 수정이 실제로 반영돼 있음을 확인했다.**

- `formatting.ts` L165-177에 `buildNegativeNetPayWarning(result)` 함수가 신설돼 있다.
  ```ts
  export function buildNegativeNetPayWarning(
    result: AnnualSalaryTakeHomePayResult,
  ): string | null {
    return result.netMonthlyPay < 0
      ? "입력한 급여 수준에서는 4대 보험 최저 보험료가 실제 급여보다 커서 세후 실수령액이 0원 미만으로 계산됩니다. 실제로는 이런 급여 수준에 4대 보험이 그대로 적용되지 않을 가능성이 높으므로, 이 결과는 참고용으로만 확인해 주세요."
      : null;
  }
  ```
  `buildAllPolicyWarnings`(L180-190)의 배열에도 포함돼 있다.
- `ui.tsx`에 `WarningCard({ title, body })` 컴포넌트가 신설돼(L88-102, `docs/DESIGN_SYSTEM.md`
  "경고/미충족 카드" 토큰 `border-warning-border bg-warning-surface` 그대로 사용, 새 색상
  토큰 추가 없음) 결과 영역(`aria-live="polite"` 블록) 맨 위, **핵심 결과 카드보다 먼저**
  조건부로 렌더링된다(L373-378):
  ```tsx
  {buildNegativeNetPayWarning(result) && (
    <WarningCard
      title="세후 실수령액이 0원 미만으로 계산됨"
      body={buildNegativeNetPayWarning(result) as string}
    />
  )}
  ```
  경고 카드가 핵심 결과 카드(`netMonthlyPay` 숫자)보다 먼저 배치돼 있어, 사용자가 음수
  숫자를 보기 전에 맥락을 먼저 인지할 수 있는 위치다(계산 결과 자체를 가리지 않음도
  확인).
- `logic.ts`/`validation.ts`를 재확인한 결과, 지시문의 "계산 로직·검증 범위는 변경 없음"
  주장이 정확했다. `logic.ts`의 `calculateAnnualSalaryTakeHomePay`는 `netMonthlyPay =
  monthlyGrossPay - totalDeductions`를 그대로 반환하며 0 이상으로 clamp하지 않는다(즉
  이번 수정은 QA 권고 (a)만 채택했다 — "표시 경고 추가", 계산값 자체는 건드리지 않음).
  `validation.ts`도 `annualSalary`의 하한이 여전히 `annualSalary <= 0`일 때만 오류이고
  (L55), 현실적 최저 연봉 하한은 추가되지 않았다 — QA가 재현했던 `annualSalary=100,000원`
  입력이 이번에도 검증을 100% 통과한다는 뜻이며, 그래야 경고 카드 자체가 실제로 노출될
  조건(검증 통과 → `calculateAnnualSalaryTakeHomePay` 호출 → `netMonthlyPay < 0`)이
  성립한다.
- `types.ts`에 `IncomeTaxBracketMode`/`bracketMode` 필드가 추가돼 UX/UI Critic Medium
  3(경계값 문구 부정확)도 함께 반영됐음을 확인했다(이번 라운드의 직접 지시 대상은
  아니지만, 지시문 3번 "정상 급여에서 오탐 없음" 확인 과정에서 `formatting.ts` 전체를
  재독해하며 자연스럽게 함께 확인됨) — 이 QA 재검증의 범위 밖이므로 별도 등급을 매기지
  않는다.

### 2. 재현 케이스 재테스트 — 실제 함수 실행 + 실제 컴포넌트 렌더링

**두 가지 독립 경로 모두에서 경고 카드가 실제로 노출됨을 확인했다.**

**(a) 순수 함수 직접 호출(임시 테스트 파일, 실행 후 삭제)**

| 케이스 | `annualSalary` | `netMonthlyPay` | `buildNegativeNetPayWarning` 반환값 |
|---|---|---|---|
| QA가 최초 재현했던 극단값 | 100,000원 | **-22,607원** | "입력한 급여 수준에서는 4대 보험 최저 보험료가 실제 급여보다 커서 세후 실수령액이 0원 미만으로 계산됩니다..."(문자열 반환, `not.toBeNull()` 통과) |
| 정상 급여(SAMPLE_FORM과 동일: 3,600만원/비과세 20만원/가족3/자녀1) | 36,000,000원 | **2,723,135원** | `null`(오탐 없음) |
| 손익분기 경계 바로 아래(참고용) | 373,000원 | -57원(여전히 음수) | — |
| 명백히 정상 범위 | 20,000,000원 | 1,491,324원 | `null` |

3개 테스트(`describe("QA 재검증(라운드 1) - buildNegativeNetPayWarning")`)를
`npx vitest run`으로 실행해 전부 통과했다(`netMonthlyPay=-22,607원`은 이전 QA 보고서의
재현값과 1원도 다르지 않게 일치 — 이번 라운드에서 계산 로직이 전혀 바뀌지 않았음을
재확인). 실행 후 파일을 즉시 삭제했고 `ls`로 디렉터리가 원래 13개 파일로 복원됐음을
확인했다.

**(b) 실제 컴포넌트 렌더링(기존 `ui.test.tsx`, 새로 실행)**

Optimizer가 추가한 아래 두 테스트를 재실행해 실제 화면 렌더링 결과로도 확인했다(순수
함수 호출이 아니라 `render(<AnnualSalaryTakeHomePayUi />)` → `fireEvent.change`/
`fireEvent.click` → `screen.getByText`로 DOM을 직접 조회하는 통합 테스트다):

```tsx
it("비현실적으로 낮은 연봉 입력 시 세후 실수령액 음수 경고 카드를 표시한다", () => {
  render(<AnnualSalaryTakeHomePayUi />);
  fireEvent.change(screen.getByLabelText(/세전 연봉/), { target: { value: "100000" } });
  fireEvent.click(screen.getByRole("button", { name: "실수령액 계산하기" }));
  expect(screen.getByText("세후 실수령액이 0원 미만으로 계산됨")).toBeInTheDocument();
  expect(screen.getByText(/4대 보험 최저 보험료가 실제 급여보다 커서/)).toBeInTheDocument();
});

it("정상 범위 계산에서는 실수령액 음수 경고 카드가 나오지 않는다", () => {
  render(<AnnualSalaryTakeHomePayUi />);
  fireEvent.click(screen.getByRole("button", { name: "샘플 값 채우기" }));
  fireEvent.click(screen.getByRole("button", { name: "실수령액 계산하기" }));
  expect(screen.queryByText("세후 실수령액이 0원 미만으로 계산됨")).not.toBeInTheDocument();
});
```

두 테스트 모두 통과했다(아래 "회귀 테스트 재확인" 표 참고). 실제 사용자가 폼에
"100000"을 입력하고 버튼을 클릭하는 것과 동일한 경로(입력 필드 변경 → 검증 →
`calculateAnnualSalaryTakeHomePay` → `setResult` → 조건부 렌더링)로 경고 카드 제목
텍스트("세후 실수령액이 0원 미만으로 계산됨")와 본문 일부가 실제 DOM에 나타남을
확인했다 — "함수만 올바르고 화면에는 실제로 안 뜨는" 괴리가 없음을 렌더링 테스트로
직접 검증했다.

### 3. 오탐(false positive) 여부 재확인 — 정상 급여 수준

- 위 (a)/(b) 두 경로 모두에서 정상 급여(연봉 3,600만원, SAMPLE_FORM) 입력 시
  `buildNegativeNetPayWarning`이 `null`을 반환하고, 화면에도 경고 카드 제목 텍스트가
  전혀 나타나지 않음을 확인했다.
- 추가로 명백히 정상 범위인 연봉 2,000만원(`netMonthlyPay=1,491,324원`, 4대 보험 하한과
  전혀 무관한 구간)도 함께 확인해, 경고가 "netMonthlyPay가 조금이라도 낮으면 뜨는"
  과민 반응이 아니라 정확히 `netMonthlyPay < 0` 조건에서만 발동함을 재확인했다.
- **결론: 오탐 없음.** 정상적인 급여 수준에서는 새 경고 카드가 노출되지 않는다.

### 4. `formatting.test.ts` 회귀 테스트 재확인(소스 재독해)

Optimizer가 추가했다고 보고한 회귀 테스트(`formatting.test.ts` L98-113
`describe("buildNegativeNetPayWarning — QA 신규 발견(Medium) 회귀 테스트")`)를 직접 읽고
대조한 결과, 이번 QA가 독립적으로 재현한 값(`annualSalary=100,000원` →
`netMonthlyPay=-22,607원`)과 정확히 동일한 케이스를 다루고 있음을 확인했다 — 테스트
설명 자체에 "QA.md: annualSalary=100,000원(연) → netMonthlyPay=-22,607원(음수)"라고
이 QA 보고서를 직접 인용한 주석이 있다.

### 5. 회귀 테스트 재확인 (전체 재실행, Optimizer 자체 보고를 신뢰하지 않고 직접 재실행)

| 스위트 | 결과 |
|---|---|
| `annual-salary-take-home-pay` 전용(`--reporter=verbose`) | **5개 파일, 73개 테스트 전부 통과**(기존 68개 + 이번 라운드 신규 5개: `formatting.test.ts` 3개, `ui.test.tsx` 2개 — 위 2절에서 인용한 렌더링 테스트 포함). Golden Test 1~13 전부 포함, 전부 통과. |
| 전체 스위트 `npx vitest run --no-file-parallelism` | **53개 파일, 542개 테스트 전부 통과**(라운드 0 대비 +5, 이번 라운드 신규분과 정확히 일치) |
| `four-major-insurance` + `social-insurance` 회귀(`--reporter=verbose`) | **4개 파일, 28개 테스트 전부 통과** — 라운드 0과 테스트 개수·결과 동일, `four-major-insurance`/`src/lib/social-insurance.ts`는 이번 라운드에서 전혀 건드리지 않았음을 코드 diff 관찰(파일 자체 미변경) + 테스트 재실행 양쪽으로 확인 |
| `npx tsc --noEmit` | 오류 없음 |
| `npm run build` | 성공(Compiled successfully, TypeScript 통과, 16개 페이지 정적 생성 완료) |

### 6. 발견된 이슈 (등급별, 재검증 기준)

| 등급 | 이슈 | 위치 | 상태 |
|---|---|---|---|
| 없음 | 신규 Medium(비현실적으로 낮은 연봉에서 `netMonthlyPay` 음수, 경고 없음) | `formatting.ts`/`ui.tsx` | **해소 확인** — `buildNegativeNetPayWarning` + `WarningCard`로 조건부 경고 노출을 순수 함수 호출과 실제 컴포넌트 렌더링 양쪽에서 재현 완료, 오탐 없음도 확인 |
| Low(유지, 이번 라운드 지시 범위 밖) | 320px 핵심 결과 숫자 폭 여유 부족 가능성 | `ui.tsx` 351~366행 | 이번 라운드에서 `ui.tsx`의 핵심 결과 카드 마크업 구조 자체는 재확인했으나(연말정산 고지 문구 스타일만 `text-xs opacity-75` → `text-sm font-semibold opacity-100`로 변경됨, 숫자 크기 클래스 `text-4xl sm:text-5xl`는 불변) 실기기 확인은 여전히 하지 못함 — 기존 판정 유지 |
| Low(유지, 이번 라운드 지시 범위 밖) | 금액 입력 필드 소수점 무음 제거 | `ui.tsx`(`amountChange`) | 이번 라운드에서 `amountChange` 함수 자체(L164-171)를 재확인한 결과 변경 없음 — 기존 판정(저장소 표준 패턴, 이 계산기 고유 결함 아님) 유지 |

### 7. 최종 판정

**판정: PASS**

- 근거: `docs/EVALUATION.md` PASS 기준(Critical 0, High 0)을 충족한다. 라운드 0의 유일한
  신규 Medium 이슈(비현실적으로 낮은 연봉에서 세후 실수령액 음수 표시, 경고 없음)가
  Optimizer의 표시 레이어 수정(`buildNegativeNetPayWarning` + `WarningCard`)으로 실제로
  해소됐음을 두 가지 독립 경로(순수 함수 직접 호출, 실제 컴포넌트 렌더링 테스트)로
  재현해 확인했다.
  - 재현 케이스(연봉 100,000원, QA가 최초 보고한 값 그대로) → `netMonthlyPay=-22,607원`
    (라운드 0과 1원도 다르지 않음, 계산 로직 불변 확인) → 경고 카드 제목·본문 텍스트가
    실제 DOM에 렌더링됨을 확인.
  - 정상 급여(연봉 3,600만원 등 2개 케이스) → 경고 카드가 뜨지 않음(오탐 없음)을 확인.
  - `logic.ts`/`validation.ts` 재확인 결과 "계산 로직·검증 범위는 변경 없음"이라는
    Optimizer 주장이 정확했다(표시 레이어에만 조건부 경고를 추가한 것이 맞다).
- 회귀: 전체 스위트 53개 파일 542개 테스트, 계산기 전용 5개 파일 73개 테스트(Golden Test
  1~13 포함), `four-major-insurance`/`social-insurance` 4개 파일 28개 테스트(라운드 0과
  동일, 미변경 확인) 전부 통과. `npx tsc --noEmit` 오류 0. `npm run build` 성공(16개
  페이지).
- 라운드 0에서 남겨둔 Low 2건(320px 핵심 숫자 폭, 금액 입력 소수점 무음 처리)은 이번
  라운드 지시 범위 밖이라 재검증만 하고 등급을 그대로 유지했다 — PASS 판정을 막는
  사유가 아니다.
- 신규로 발견된 회귀나 새로운 결함은 없다.
