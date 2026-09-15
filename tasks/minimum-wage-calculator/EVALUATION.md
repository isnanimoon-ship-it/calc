# EVALUATION: 최저임금·시급↔월급 계산기

## Builder 구현 완료

2026-09-14, Builder가 승인된 SPEC.md/FORMULA.md/ARCHITECTURE.md를 그대로 구현했다. 아래는
구현 사실 기록이며 **최종 정확성 판정이 아니다** — 최종 판정은 Calculation Auditor·QA의
몫이다(`.claude/agents/builder.md`). "테스트 통과"라고 적어도 Calculation Auditor·QA는 이를
그대로 신뢰하지 않고 독립적으로 재검증해야 한다.

### 구현 파일

- `src/calculators/minimum-wage-calculator/logic.ts` — ARCHITECTURE.md "8." 함수 분리 그대로
  구현했다: `calculateWeeklyPaidHours`(주휴시간·1주 최저임금 적용기준 시간 수) →
  `calculateMonthlyEquivalentHoursExact`/`calculateMonthlyEquivalentHours`(월 환산 시간 정밀값/
  반올림값, 정밀값은 오케스트레이터 반환값 조립에 전혀 관여하지 않는다) →
  `calculateFromHourlyWage`/`calculateFromMonthlyWage`(모드별 완전 분리 함수, 서로 반대 방향을
  계산할 코드 경로가 각 함수 안에 존재하지 않는다) → `calculateMinimumWageComparison`
  (오케스트레이터, `ui.tsx`가 호출하는 유일한 진입점). 주휴시간 산식은 예외 없이
  `src/lib/labor-standards.ts`의 `calculateWeeklyHolidayHours`를 import해서만 쓰고 로컬로
  재구현한 곳이 없다(아래 "Golden Test"의 `logic.shared-import.test.ts`가 이를 직접
  증명한다). `minWageMonthlyEquivalent`는 `computeSharedComparison` 내부에서 매번
  `minWageHourly × monthlyEquivalentHours`(이 호출의 `weeklyHours` 기준)로 새로 계산하며,
  40시간/209시간/2,156,880원을 상수로 저장해 둔 곳이 코드 어디에도 없다(ARCHITECTURE.md
  "6.", "7.").
- `src/calculators/minimum-wage-calculator/validation.ts` — `MIN_WEEKLY_HOURS=1`
  (ARCHITECTURE.md "4."), `MAX_WEEKLY_HOURS=168`, `DEFAULT_WEEKLY_HOURS=40`(선택 입력, 빈
  값이면 이 값 적용), `MAX_HOURLY_WAGE=1,000,000`, `MAX_MONTHLY_WAGE=1,000,000,000`을 이
  계산기 전용으로 독립 정의했다(weekly-holiday-allowance의 상수를 cross-import하지 않음,
  ARCHITECTURE.md "10." 관례). `mode`가 `"HOURLY"`/`"MONTHLY"`가 아니면 다른 필드를 검사하지
  않고 즉시 오류를 반환한다. `hourlyWage`/`monthlyWage`는 정수만 허용(weekly-holiday-allowance와
  동일 결정).
- `src/calculators/minimum-wage-calculator/formatting.ts` — `formatWon`/`formatHours`는 이
  계산기의 반올림 정책(logic.ts가 이미 최종 반올림을 마친 정수를 반환)에 맞춰 **추가
  반올림을 하지 않는다**(weekly-holiday-allowance의 `roundWon`과 의도적으로 다른 설계 —
  ARCHITECTURE.md "5.2"가 명시한 이 계산기 고유의 차이). `buildMinimumWageBreakdown`은
  `input`을 별도로 받지 않고 `result.displayHourlyWage`/`displayMonthlyPay`만으로 원본
  입력값을 재현한다(HOURLY 모드에서 `displayHourlyWage`가 곧 사용자가 입력한 `hourlyWage`
  그대로이기 때문 — `types.ts` 주석 참고). `buildBelowMinimumWageWarning`은 게이팅 없이
  항상 계산된 결과에서 미충족 항목만 골라 문구를 조립한다.
- `src/calculators/minimum-wage-calculator/content.ts` — FORMULA.md "FAQ 콘텐츠"(질문 1~7)와
  "소개 문구"를 그대로 옮겼다. SPEC.md "최저임금 산입범위 — v1은 단순화한다" 원문을
  `MINIMUM_WAGE_INCLUSION_SCOPE_NOTICE`로 별도 상수화해, 다른 정책 고지 목록
  (`MINIMUM_WAGE_POLICY_NOTICES`)과 분리했다 — `ui.tsx`가 이 상수를 일반 정책 고지보다 시각적
  으로 강조된 독립 카드(`border-primary/30 bg-primary-soft`)에 배치한다(SPEC Must Have "작은
  각주가 아니라 정책 안내 카드 수준으로").
- `src/calculators/minimum-wage-calculator/ui.tsx` — ARCHITECTURE.md "12." 레이아웃 순서
  그대로: 모드 토글(라디오 2개, 세그먼트 컨트롤 스타일) → 금액 입력(모드에 따라 시급/월급
  중 하나만 렌더링) → 주 근무시간(공통, 기본값 "40") → 핵심 결과 카드(환산값 +
  최저임금 이상/미만 배지, "직접 입력한 값이 아니라 계산된 환산값입니다" 캡션 포함) →
  시급·월급 비교 보조 카드(항상 두 값 모두 노출, `ValueSourceBadge`로 입력값/환산값 구분) →
  미충족 경고 카드(조건부, 게이팅 아님) → 계산 근거(5행: 1주 주휴시간 → 월 환산 시간 → 환산
  결과 → 시급 비교 → 월급 비교) → 적용된 입력값 → 최저임금 산입범위 안내(강조 카드) →
  사용안내/소개 → 정책 고지 → FAQ. **모드 전환 시 `hourlyWage`/`monthlyWage` 두 필드를 모두
  빈 문자열로 초기화**하고 `weeklyHours`는 유지한다(`handleModeChange`, ARCHITECTURE.md "3.3"
  체이닝 방지 UX 규칙 그대로). 샘플 값은 FORMULA.md 예제 A1(`hourlyWage=10,320,
  weeklyHours=40`)을 그대로 썼다 — 정확히 최저임금 경계라 "이상" 판정이라서 경고 카드 없이
  깔끔한 첫인상을 준다(weekly-holiday-allowance 샘플 선정 기준과 동일).
- `src/calculators/registry.ts` — `minimum-wage-calculator` 신규 등록(`title: "최저임금·
  시급↔월급 계산기"`, `category: "labor"`, `icon: "trend"`, **`status: "draft"`**). 아이콘
  선정 근거는 아래 "판단이 필요했던 애매한 지점" 참고.
- `src/calculators/calculator-components.ts`, `app/calculators/[slug]/page.tsx` — UI 컴포넌트
  연결 및 FAQPage JSON-LD용 `minimumWageCalculatorFaqSeoItems` 매핑 추가(다른 계산기와 동일한
  패턴).
- `src/calculators/minimum-wage-calculator/types.ts`, `src/lib/labor-standards.ts`,
  `tasks/minimum-wage-calculator/ARCHITECTURE.md`는 Architect 라운드에서 이미 작성 완료된
  상태였고 이번 Builder 라운드에서 타입·공유 함수를 임의로 바꾸지 않았다(그대로 구현만
  채웠다). `src/data/rates-2026.json`도 수정하지 않았다(ARCHITECTURE.md "6." 결정 그대로).

### Golden Test / Edge Case Test

- `logic.test.ts` — FORMULA.md 검증 예제 19개 중 로직 레벨 11개(A1~A3, B1~B3, C1~C2, D1~D2,
  E1)를 `calculateFromHourlyWage`/`calculateFromMonthlyWage`로 전부 구현했다. 추가로:
  - **A1↔B1 교차검증**: A1의 `convertedMonthlyPay`(2,156,880원)를 B1의 `monthlyWage` 입력으로
    직접 넣어 `convertedHourlyWage`가 정확히 A1의 원본 `hourlyWage`(10,320원)로 복원되는지
    별도 테스트로 확인했다(SPEC "완료 기준" — 시급↔월급 왕복 일치).
  - **C1·C2 하드코딩 방지 회귀 테스트**: `minWageMonthlyEquivalent`가 20시간(1,073,280원)·
    30시간(1,609,920원)·40시간(2,156,880원)에서 서로 다른 값을 내는지, `new Set(values).size
    === 3`으로 "혹시 세 값이 우연히 같은 상수로 굳어 있지 않은지"까지 명시적으로 검증했다.
  - **Architect가 발견한 극단값 버그 재현**: `weeklyHours=0.05`(검증을 우회해 `calculateWeeklyPaidHours`/
    `calculateMonthlyEquivalentHours`를 직접 호출)로 `monthlyEquivalentHours`가 실제로 0으로
    붕괴하는 것을 재현한 뒤, `validation.ts`의 `MIN_WEEKLY_HOURS(1)`이 이 붕괴 구간과 10배 이상
    떨어져 있어 정상 흐름에서는 절대 발생하지 않음을 D1(`weeklyHours=1`)로 재확인했다.
  - **체이닝 금지 구조 검증**: `"convertedHourlyWage" in result`/`"hourlyWage" in result`/
    `"monthlyWage" in result`를 각 모드 결과에 대해 확인해, 반대 방향 필드나 원본 입력 필드명이
    결과 객체에 전혀 존재하지 않음을 런타임으로도 재확인했다(타입 레벨 방어의 런타임 대응).
  - E1(소수 시급 10,320.5원)은 ARCHITECTURE.md "10." 지침대로 `validation.ts`를 거치지 않고
    `calculateFromHourlyWage`를 직접 호출해 검증했다.
  - F1~F8(입력 오류 8개)은 `validation.test.ts`에 구현했다(logic.ts는 검증된 입력을 전제하므로
    — 관심사 분리, ARCHITECTURE.md "10.").
- `logic.shared-import.test.ts`(신규, 별도 파일) — "주휴시간 산식이 `src/lib/labor-standards.ts`
  에서 실제로 import되어 쓰이는지, 로컬 재구현이 아닌지"를 확인하라는 지시에 대응한다. 단순
  숫자 비교로는 "우연히 같은 산식을 로컬에 다시 베꼈을 가능성"을 배제하지 못하므로,
  `vi.mock("@/src/lib/labor-standards", ...)`으로 그 모듈 자체를 의도적으로 다른 값(999)을
  반환하도록 모킹한 뒤 `calculateWeeklyPaidHours`가 그 모킹된 값을 그대로 반영하는지(로컬
  재구현이었다면 모킹의 영향을 받지 않아 이 테스트가 실패한다), 그리고 모킹된 함수가 실제로
  올바른 인자로 호출됐는지(`toHaveBeenCalledWith`)까지 확인했다. `vi.mock`은 파일 전체에
  호이스팅되므로 다른 Golden Test와 섞이지 않게 별도 파일로 분리했다.
- `validation.test.ts` — F1~F8을 FORMULA.md 예제 그대로 구현했고, `MIN_WEEKLY_HOURS(1)` 하한이
  실제로 동작하는지(0.5시간·0.096시간 모두 거부, 정확히 1시간은 통과) 별도 describe로
  검증했다. `weeklyHours` 빈 값/공백 문자열이 기본값 40으로 처리되는지, `mode` 누락/오탐 문자열
  방어, 정수 전용 금액 필드(소수 거부), 16진수·지수 표기 문자열 방어, MONTHLY 모드에서
  `hourlyWage` 필드가 함께 와도 무시되는지도 확인했다.
- `formatting.test.ts` — `formatWon`/`formatHours` 기본 동작과, `buildMinimumWageBreakdown`이
  모드별로 올바른 행("환산 월급"/"환산 시급")을 포함하고 실제 계산값을 정확히 대입하는지,
  `buildBelowMinimumWageWarning`이 게이팅 없이 조건부로만 문구를 만드는지 확인했다.

### 실행 결과

- `npx vitest run --no-file-parallelism`(전체 스위트) — **90개 파일, 1,267개 테스트 전부
  통과**(이번 라운드에서 신규 4개 파일·68개 테스트 추가, 기존 86개 파일·1,199개 테스트
  회귀 없음 — Architect ARCHITECTURE.md "14."가 확인한 베이스라인과 일치, 특히
  `weekly-holiday-allowance/logic.test.ts`의 Golden Test 7개 + Edge Case가 그대로 통과함을
  재확인했다).
- `npx tsc --noEmit` — 오류 없음.
- `npm run build`(Next.js 16, Turbopack) — 성공(정적 페이지 39개 생성 포함, 기존 20개 published
  경로 그대로). `status: "draft"`라 sitemap/홈/카테고리 목록에는 노출되지 않지만
  `calculatorComponents` 매핑은 연결해 두어 라우팅 자체는 동작한다.
- `npx eslint src/calculators/minimum-wage-calculator "app/calculators/[slug]/page.tsx"
  src/calculators/registry.ts src/calculators/calculator-components.ts` — 오류·경고 0건.
- **런타임 스모크 확인**: 이미 떠 있던 로컬 dev 서버(`localhost:3000`)에 curl로
  `/calculators/minimum-wage-calculator`를 직접 요청해 HTTP 200과 제목·모드 토글 라벨·FAQ
  섹션·`FAQPage` JSON-LD가 실제로 렌더링됨을 확인했다(이 경로는 draft 상태라
  `generateStaticParams`에 포함되지 않아 빌드 시 정적 생성 검증을 받지 않으므로, 별도로 런타임
  렌더링까지 직접 확인했다). dev 서버 로그의 하이드레이션 오류 1건은 `pathname:"/"`(홈)에서
  브라우저 확장 프로그램이 주입한 것으로 보이는 `ap-style` 속성 관련이며, `minimum-wage`
  경로와는 무관함을 로그 문자열 검색으로 확인했다.

### 판단이 필요했던 애매한 지점 (다음 역할이 참고할 것)

- **아이콘 선택("trend") — ARCHITECTURE.md "16."이 "남은 키는 utility뿐"이라 적어 둔 것과
  다르게 판단했다.** registry.ts를 직접 확인한 결과 labor 카테고리는 coins/calculator/
  calendar/heart/chart 5개를 이미 쓰고 있어 실제로는 `utility`·`trend` 두 키가 모두 비어
  있었다. 그런데 `CalculatorCard.tsx`의 `CalculatorIcon`을 읽어 보니 `"utility"`는 전용 SVG
  분기가 없어 fallback(문서/그리드 아이콘)으로 렌더링되고, 이 fallback은 이미 labor 카테고리의
  `heart`(parental-leave-benefit, 마찬가지로 전용 분기가 없음)와 완전히 같은 모양이라 두
  계산기가 카테고리 목록에서 시각적으로 구분되지 않는다. 반면 `trend`는 전용 SVG(등락 지그재그
  + 화살표)가 있어 확실히 구분되고, "최저임금 이상/미만" 비교·판정이라는 이 계산기의 핵심
  결과 성격과도 의미적으로 잘 맞는다고 판단해 `trend`를 선택했다. Architect의 메모를 무시한
  것이 아니라, 실제 렌더링 결과(fallback 중복)까지 확인한 뒤 내린 추가 판단이다 — UX/UI
  Critic이 실제 화면에서 이 선택이 적절한지 재검토할 것을 권고한다.
- **`calculateFromHourlyWage`/`calculateFromMonthlyWage`가 공유하는 `computeSharedComparison`
  헬퍼를 export하지 않았다.** ARCHITECTURE.md "8."은 두 모드 함수 각각의 시그니처만 명시했고
  공유 조각을 어떻게 나눌지는 Builder 재량으로 남겨 뒀다. Builder는 `weeklyHours`/
  `weeklyHolidayHours`/`weeklyPaidHours`/`monthlyEquivalentHours`/`cappedAtStatutoryLimit`/
  `minWageHourly`/`minWageMonthlyEquivalent`(FORMULA.md "출력값" 표의 공통 필드 7개)를 묶는
  내부 전용 함수(`computeSharedComparison`, export 안 함)로 분리했다 — `calculateWeeklyPaidHours`
  /`calculateMonthlyEquivalentHours`(ARCHITECTURE.md가 이름까지 지정한 두 함수)는 그대로
  독립 export해 Golden Test가 개별적으로 호출할 수 있게 했다. Calculation Auditor가 "체이닝
  금지" 요건을 재검증할 때, `computeSharedComparison` 자체는 어느 방향으로도 변환을 수행하지
  않는(주휴시간·월 환산 시간·최저임금 조회만 하는) 순수 조회 함수이며 `hourlyWage`/
  `monthlyWage` 중 어느 것도 인자로 받지 않는다는 점을 코드로 확인해 주기를 권고한다.
- **핵심 결과 카드의 "최저임금 이상/미만" 배지 판정 기준.** ARCHITECTURE.md "12."가 명시한
  대로 HOURLY 모드는 `monthlyMeetsMinimumWage`, MONTHLY 모드는 `hourlyMeetsMinimumWage`를
  핵심 카드 배지 판정에 썼다(즉 "환산된 값"의 최저임금 충족 여부를 강조). 다만 보조 카드
  ("시급·월급 비교")에서는 시급 행에 `hourlyMeetsMinimumWage`, 월급 행에
  `monthlyMeetsMinimumWage`를 각각 그대로 써서, 사용자가 스크롤 한 번이면 "핵심 카드가 보여주는
  판정과 다른 쪽(입력값 자체)의 판정"도 놓치지 않고 볼 수 있게 했다. 이 이중 노출이 오히려
  헷갈릴 수 있는지(같은 화면에 같은 개념의 배지가 두 번 등장) UX/UI Critic이 재검토할 것을
  권고한다.
- **미충족 경고 카드의 문구를 `buildBelowMinimumWageWarning` 하나로 통합했다.** FORMULA.md/
  ARCHITECTURE.md는 "시급/월급 중 어느 쪽이 미달인지 구체적으로 명시"만 요구했고 문구를
  하나로 합칠지 둘로 나눌지는 정하지 않았다. Builder는 weekly-holiday-allowance처럼 조건별로
  독립된 경고 카드 두 개를 만드는 대신, 최저임금 미만이라는 하나의 사건에 대해 시급·월급 두
  근거를 한 카드 안에 `·`로 이어붙이는 방식을 택했다(이 계산기는 두 판정이 항상 같은 근거
  — 시급이 같으면 월 환산액도 같은 비율로 비례 — 에서 나오므로 대부분 동시에 참/거짓이 된다).
  `formatting.test.ts`에 이 조합 케이스를 하나 남겨 뒀다.

### Calculation Auditor 인수인계 — 최우선 체크리스트

FORMULA.md가 이미 "여전히 남아있는 확인 필요 항목"으로 정직하게 남긴 것 + Builder가 구현 중
발견한 사항을 합쳐 우선순위대로 정리한다. 아래 항목은 Builder 테스트 통과로 "해결됨"이 아니라
**Calculation Auditor가 독립적으로 재검증해야 할 대상**이다.

1. **[FORMULA.md 인계, 최우선] 최저임금법 시행령 제5조 원문 전체 미열람.** law.go.kr·CaseNote
   렌더링 실패로 준1차 출처(법제처 생활법령정보의 계산 예시)와 WebSearch 요약으로만 확인했다.
   조문의 정확한 호별 문언(제1호~제3호)을 정부 원문 그대로 대조하는 작업이 남아 있다 —
   Calculation Auditor가 Bash(curl) 등으로 law.go.kr 원문에 접근 가능하면 최우선으로 재확인할
   것을 권고한다.
2. **[FORMULA.md 인계] 월 환산 시간 반올림(정수화) 정책의 법적 강제성 부재.** 이 계산기가
   채택한 "정수 반올림 후 곱셈" 방식(FORMULA.md "정밀도/반올림 정책")은 법령 문언이 아니라
   정부의 실제 계산 예시(생활법령정보 "약 209시간")를 재현한 행정 관행이라는 점을 FORMULA.md
   스스로 밝혔다. 이 정책이 40시간이 아닌 비표준 `weeklyHours`(예: C1의 20시간, D1의 1시간)
   에도 정부가 실제로 같은 방식을 쓰는지 보여주는 공식 예시는 FORMULA.md도 찾지 못했다 —
   Formula Analyst가 "추론한 일반화"임을 정직하게 밝힌 지점이므로, 가능하면 정부 자료로 재확인
   할 것을 권고한다(FORMULA.md "여전히 남아있는 확인 필요 항목" 5번).
3. **[FORMULA.md 인계] 최저임금법 제6조제4항 산입범위 "2024년 전면 산입"의 정부 1차 출처
   (시행령 개정문·관보) 미열람.** 다수 2차 출처(HR 블로그) 교차확인으로 신뢰도는 높으나 정부
   개정이유서 원문은 확인하지 못했다. 이 계산기의 FAQ 5번 답변과 SPEC "산입범위 단순화" 근거의
   일부이므로 확인이 필요하다.
4. **[Builder 발견, 신규] `weeklyHours` 극단값 버그(0.096 미만 붕괴)의 방어가 `validation.ts`
   에만 있고 `logic.ts` 자체에는 없다는 점.** ARCHITECTURE.md "4."가 명시적으로 "logic.ts
   자체는 방어하지 않고 validation.ts 하한으로만 막는다"고 결정했으므로 이는 설계대로다. 다만
   Calculation Auditor는 `calculateMinimumWageComparison`을 `validation.ts`를 거치지 않고
   직접 호출하는 코드 경로(예: 향후 다른 계산기가 이 오케스트레이터를 재사용하려는 시도, 또는
   `ShareActions`의 공유 URL 복원 로직)가 이 하한을 우회할 수 있는지 코드 리딩으로 재확인할
   것을 권고한다 — 현재 `ui.tsx`의 공유 상태 복원(`useCalculatorShare`)도 반드시
   `validateMinimumWageCalculatorInput`을 거친 뒤에만 `calculateMinimumWageComparison`을
   호출하도록 구현했음을 Builder가 코드 작성 시 확인했으나, 재검증을 권고한다.
5. **[Builder 발견, 신규] `logic.shared-import.test.ts`의 모킹 기반 검증이 실제로 "로컬
   재구현이 없음"을 완전히 증명하는지.** 이 테스트는 `calculateWeeklyPaidHours`가 모킹된
   `calculateWeeklyHolidayHours`를 호출한다는 것만 증명하며, `computeSharedComparison`이나
   오케스트레이터 다른 경로에 별도의 "숨겨진 로컬 재구현"이 없다는 것까지는 보장하지 않는다.
   Calculation Auditor가 `logic.ts` 전체를 코드 리딩으로 훑어, `min(`·`/40*8`·`/ 40 \* 8` 같은
   패턴의 두 번째 구현이 없는지 직접 확인할 것을 권고한다(annual-leave-allowance Calculation
   Auditor가 `date-utils.ts`에 대해 했던 것과 같은 방식의 코드 리딩 재확인).
6. **[Builder 발견, 신규] "핵심 결과 카드가 환산값의 최저임금 판정만, 보조 카드가 양쪽 모두"인
   이중 배지 구조가 실제로 사용자에게 혼란을 주는지.** 계산 정확성 문제는 아니지만, QA가 실제
   화면에서 두 배지가 다른 값을 보여주는 경우(예: 시급은 최저임금 이상인데 월급은 미만인 조합이
   이 산식상 실제로 가능한지)를 직접 입력해 확인할 것을 권고한다 — Builder가 확인한 바로는 시급
   기준 배수 관계상 `hourlyMeetsMinimumWage`와 `monthlyMeetsMinimumWage`가 항상 같은 값이
   되어야 정상이지만(반올림 손실로 인한 아주 좁은 경계 구간에서는 서로 다를 수도 있다), 이를
   수학적으로 완전히 증명하지는 않았다.

---

## Calculation Auditor

**검증일**: 2026-09-14
**검증 방법**: (1) 코드 리딩(`logic.ts`/`validation.ts`/`ui.tsx`/`formatting.ts`/`types.ts`/
`src/lib/labor-standards.ts` 전체), (2) 프로젝트 코드를 import하지 않는 독립 Python 스크립트로
FORMULA.md 19개 예제 재계산, (3) 독립 Python 스크립트로 이중 배지 수학적 증명 + 전수 스윕,
(4) `curl`/law.go.kr Open API(`DRF/lawSearch.do`, `DRF/lawService.do`, `OC=test`)로 법령 원문
직접 열람, (5) `curl`로 고용노동부 공식 PDF(2026년 적용 최저임금 고시)·공식 웹 계산기
(`moel.go.kr/miniWageMain.do`) JS 소스 직접 확인, (6) `npx vitest run`으로 전체 회귀 테스트
재실행.

### 최종 판정: **공식 재검토 요청** (Formula Analyst) — Builder 구현 자체는 FORMULA.md에
정확히 부합하며 FAIL 아님

우선순위 6개 항목 중 5개는 FORMULA.md/Builder의 주장이 그대로 확인되거나(1, 3, 4, 5)
계산 정확성 문제가 아닌 것으로 결론 났다(6, 다만 UX 후속 조치 권고). 그러나 **2번
항목(월 환산 시간 반올림 정책)에서, FORMULA.md 자신이 채택 근거로 든 "정부의 실제
계산 관행"이 실제로는 균일하지 않다는 새로운 반증을 발견했다** — 같은 고용노동부가 운영하는
**실시간 최저임금 위반 여부 판정 도구(`moel.go.kr/miniWageMain.do`)는 월 환산 시간을
정수(209)로 반올림하지 않고 소수점 2자리(≈208.57)로 유지한 채 실제 판정을 계산한다.**
이는 FORMULA.md가 인용한 "약 209시간" 예시(생활법령정보·보도자료의 **단순화된 홍보용
참고 수치**)와 이 계산기가 실제로 채택해야 할 **"실제 판정 로직"**의 근거가 다를 수 있다는
뜻이므로, docs/EVALUATION.md "역할 간 이견 조정" 절에 따라 Builder FAIL이 아니라 Formula
Analyst에게 **공식 재검토 요청**으로 반려한다. 아래 "우선순위 항목 2" 참고.

---

### 표준 검증 결과

#### 1) FORMULA.md 19개 예제 독립 재계산 (프로젝트 코드 미import, Python)

`FORMULA.md`의 공식·계산 순서·반올림 정책 문장만 보고 별도로 작성한 Python 스크립트로
A1~A3, B1~B3, C1~C2, D1~D2, E1(로직 레벨 11개 전부)을 재계산했다. **11개 전부
`logic.test.ts`의 기대값과 정확히 일치**했다(`monthlyEquivalentHours`, `convertedMonthlyPay`,
`convertedHourlyWage`, `minWageMonthlyEquivalent`, `hourlyMeetsMinimumWage`,
`monthlyMeetsMinimumWage` 전 필드 대조). F1~F8(입력 오류)은 `validation.test.ts` 코드
리딩으로 FORMULA.md "예외" 절과 1:1 대응함을 확인했다.

- A1↔B1 교차검증(시급→월급→시급 왕복)도 독립 스크립트에서 정확히 10,320원으로 복원됨을
  재확인했다 — `logic.test.ts`의 "A1↔B1 교차검증" 테스트와 일치.
- C1(주 20시간)·C2(주 30시간)의 `minWageMonthlyEquivalent`가 각각 1,073,280원/1,609,920원으로,
  40시간 기준 2,156,880원과 다른 값임을 독립 계산으로 재확인했다 — **코드 리딩으로
  `computeSharedComparison` 내부에 `weeklyHours=40`을 대입하는 자리가 단 한 곳도 없음을
  확인**했다(`statutoryWeeklyHours`는 오직 `calculateWeeklyHolidayHours`의 분모로만 쓰이고,
  `monthlyEquivalentHours` 계산 경로에는 이 호출의 실제 `weeklyHours`만 흐른다). 하드코딩
  없음을 확인.

#### 2) raw/display 분리 원칙

`types.ts`의 `MinimumWageComparisonBase`에 `monthlyEquivalentHoursExact` 필드가 없음을 직접
확인했다(코드 리딩). `logic.ts`의 `calculateMonthlyEquivalentHoursExact`는 `computeSharedComparison`
내부에서 `calculateMonthlyEquivalentHours`(반올림 버전)를 만들 때 한 번 거치는 지역 계산으로만
쓰이고, 그 반환값 자체는 `computeSharedComparison`의 리턴 객체에 포함되지 않는다 — 이후 모든
계산(`convertedMonthlyPay`/`convertedHourlyWage`/`minWageMonthlyEquivalent`)이 전부
`shared.monthlyEquivalentHours`(반올림된 정수)만 참조함을 `logic.ts` 176~222행에서 직접
확인했다. **선언대로 구현됨.**

#### 3) weekly-holiday-allowance 회귀 방지

`npx vitest run src/calculators/weekly-holiday-allowance src/calculators/minimum-wage-calculator
src/lib/labor-standards --no-file-parallelism` → **8개 파일, 137개 테스트 전부 통과**.
전체 스위트 재실행(`npx vitest run --no-file-parallelism`) → **90개 파일, 1,267개 테스트
전부 통과**(Builder 보고와 일치). `weekly-holiday-allowance/logic.ts`를 직접 읽어
`calculateWeeklyHolidayHours` 호출부가 리팩터링 전 인라인 수식(`Math.min((weeklyHours /
statutoryWeeklyHours) * statutoryDailyHours, statutoryDailyHours)`)과 완전히 동일한 인자
3개를 그대로 전달하는 얇은 위임임을 확인했다 — 로직 변경 없음, 회귀 없음.

---

### 우선순위 항목 1 — 최저임금법 시행령 제5조 원문 전체 미열람 → **해결(전문 확보)**

`www.law.go.kr`의 일반 HTML 페이지는 FORMULA.md가 보고한 대로 프레임(`iframe`) 구조라
WebFetch/단순 curl로는 본문이 나오지 않았다. 그러나 **law.go.kr이 공개 제공하는 Open API**
(`https://www.law.go.kr/DRF/lawService.do?OC=test&target=law&MST=206564&type=XML`, 게스트
키 `OC=test`로 접근 가능)로 **최저임금법 시행령 전체 조문을 원문 그대로** 받아왔다(같은
domain, 같은 법제처 데이터베이스 — "law.go.kr 접근"이라는 지시를 충족한다). 조문번호
`MST=206564`(최저임금법 시행령, 시행 2019-01-01)로 확인한 제5조 전문:

```
제5조(최저임금의 적용을 위한 임금의 환산)
① 근로자의 임금을 정하는 단위가 된 기간이 그 근로자에게 적용되는 최저임금액을 정할 때의
   단위가 된 기간과 다른 경우에는 그 근로자에 대한 임금을 다음 각 호의 구분에 따라 시간에
   대한 임금으로 환산한다. <개정 2018.12.31>
   1. 일(日) 단위로 정해진 임금: 그 금액을 1일의 소정근로시간 수로 나눈 금액
   2. 주(週) 단위로 정해진 임금: 그 금액을 1주의 최저임금 적용기준 시간 수(1주 동안의
      소정근로시간 수와 「근로기준법」 제55조제1항에 따라 유급으로 처리되는 시간 수를
      합산한 시간 수를 말한다)로 나눈 금액
   3. 월(月) 단위로 정해진 임금: 그 금액을 1개월의 최저임금 적용기준 시간 수(제2호에 따른
      1주의 최저임금 적용기준 시간 수에 1년 동안의 평균의 주의 수를 곱한 시간을 12로 나눈
      시간 수를 말한다)로 나눈 금액
   4. 시간ㆍ일ㆍ주 또는 월 외의 일정 기간을 단위로 정해진 임금: 제1호부터 제3호까지의
      규정에 준하여 산정(算定)한 금액
② 생산고에 따른 임금지급제나 그 밖의 도급제로 정해진 임금은 ... (도급제 특례, 이 계산기와
   무관)
③ 근로자가 받는 임금이 제1항이나 제2항에서 정한 둘 이상의 임금으로 되어 있는 경우 ...
④ 근로자의 임금을 정한 단위가 된 기간의 소정근로시간 수가 ... 제1항 각 호의 구분에 따라
   환산한다.
```

**결론**: FORMULA.md가 WebSearch 요약으로 재구성한 제1호~제3호 문언은 정부 원문과
**정확히 일치**한다(자구 하나까지 동일). 다만 다음 두 가지를 보정한다.

- **조문 제목 오기 정정(Low)**: FORMULA.md "기준/출처"는 이 조문 제목을 "임금의 시간급
  환산"이라고 적었으나, 정부 원문 제목은 **"최저임금의 적용을 위한 임금의 환산"**이다.
  계산 로직에는 영향 없는 인용 라벨 오류이므로 Low로 분류한다.
- **추가 발견(긍정적) — 제5조의2(월 환산액의 산정)**: FORMULA.md·Builder 누구도 언급하지
  않은 조문을 발견했다:
  > 제5조의2(월 환산액의 산정) 법 제6조제4항제2호 및 같은 항 제3호나목에 따른 월
  > 환산액은 해당 연도 시간급 최저임금액에 제5조제1항제3호에 따른 1개월의 최저임금
  > 적용기준 시간 수를 곱하여 산정한다. (2018.12.31 신설, 2019.1.1 시행)

  이 조문은 (산입범위 판정 맥락이긴 하지만) "월 환산액 = 시간급 × 1개월의 최저임금
  적용기준 시간 수"라는 **명문화된 계산식**을 제공한다 — FORMULA.md "공식 5"의 결론
  ("월 환산액은 별도 고시가 아니라 계산 산출값")과 정확히 부합하고, `minWageMonthlyEquivalent
  = minWageHourly × monthlyEquivalentHours` 산식 자체가 법령 문언과 구조적으로 일치함을
  더 강하게 뒷받침한다. **중요**: 이 조문도 제5조제1항제3호를 그대로 인용할 뿐 반올림
  방법을 별도로 규정하지 않는다 — 아래 "우선순위 항목 2"의 근거로 이어진다.
- 법령 전체 텍스트(제1조~부칙)를 훑어 **"반올림"·"사사오입"·"올림"·"버림"·"절사"라는
  단어가 시행령·법 어디에도 단 한 번도 등장하지 않음**을 확인했다(`grep -c` 결과 0).
  FORMULA.md의 "법령이 반올림 방식을 강제하지 않는다"는 주장은 요약이 아니라 전문 검색으로
  **완전히 확인**된다.

### 우선순위 항목 2 — 월 환산 시간 반올림 정책의 법적 강제성 부재 → **공식 재검토 요청 (High)**

FORMULA.md의 근거는 "정부의 실제 계산 예시(생활법령정보)가 209시간으로 반올림한 뒤 곱한다"는
것이었다. 이를 검증하기 위해 (a) 정부가 실제로 배포하는 **실행 가능한 계산 도구**의 소스코드,
(b) 2026년 고시 원문 PDF를 직접 확인했다.

**(a) 2026년 적용 최저임금 고시 원문(고용노동부 고시 제2025-47호) PDF 직접 확인** —
law.go.kr Open API(`target=admrul`, `ID=2100000262710`)로 찾은 첨부파일을 curl로 내려받아
직접 읽었다:

> ◈ 월 환산액 2,156,880원: 주 소정근로 40시간을 근무할 경우, 월 환산 기준시간 수
> 209시간(주당 유급주휴 8시간 포함) 기준

FORMULA.md의 인용이 **정확함을 1차 출처로 재확인**했다. 다만 이 문구 자체가 "주
소정근로 40시간을 근무할 경우"라는 **조건부 예시**임을 명시하고 있어, "40시간이 아닌
경우에도 정수 반올림 관행이 이어진다"는 일반화의 근거로 쓰기엔 이 고시 자체는 침묵한다
(FORMULA.md도 이를 "확인 필요 5번"으로 이미 정직하게 인정한 부분).

**(b) 고용노동부 공식 "최저임금 모의계산기"(`https://www.moel.go.kr/miniWageMain.do`)의
실제 배포 JavaScript 소스 직접 확인** — 이것이 이번 감사에서 가장 중요한 신규 발견이다.
`curl`로 페이지 원본을 내려받아 실제로 "최저임금 위반 여부 확인" 버튼(`id="vioResult"`,
`onclick="wageResultNew();"`)에 연결된 **현재 살아있는 함수** `wageResultNew()`의 로직을
그대로 읽었다:

```js
// moel.go.kr/miniWageMain.do 실제 배포 JS, wageResultNew() 함수 내부 (2026-09-14 확인)
workingHour = (parseInt(weekTime) + parseInt(paidTime)) * 365/84;
workingHour = workingHour.toFixed(2);          // ← 정수(209)가 아니라 소수 둘째 자리까지!
MonthlyConversionAmount = hourlyWage * workingHour;
...
resultValue = sum / workingHour;               // 환산 시급
...
if (resultValue > minWageCash) { /* 정상 */ }
else if (resultValue == minWageCash) { /* 정상 */ }
else { /* 위반 */ }
```

`weekTime + paidTime`(1주 소정근로시간 + 유급주휴시간)에 `× 365/84`를 곱하는 산식 자체는
이 계산기의 `monthlyEquivalentHoursExact`와 완전히 동일하다. 그런데 정부의 이 도구는
**그 결과를 정수로 반올림하지 않고 `toFixed(2)`(소수 둘째 자리, 사실상 근사 정밀값)로만
잘라** 실제 최저임금 위반 여부 판정(`resultValue`, `minWageCash` 비교)에 그대로 쓴다.
(참고로 같은 파일에 정의만 되어 있고 어떤 버튼에도 연결되지 않은 구버전 함수
`wageResult()`도 있는데, 그 함수 역시 `Math.round(yearWorkingHours*100)/100`으로 **2자리
반올림**만 하지 정수 반올림은 어디에도 없었다 — 즉 이 페이지의 신구 버전 모두 "정수
209시간 반올림 후 곱셈"이라는 방식을 쓴 적이 없다.)

**실증 반례(독립 Python 재계산)**: 주 40시간, 월급 **2,154,000원**을 예로 들면,

| 판정 방식 | 환산/비교 값 | 판정 |
|---|---|---|
| 이 계산기(FORMULA.md 채택, `monthlyEquivalentHours=209` 정수 반올림) | `minWageMonthlyEquivalent = 10,320×209 = 2,156,880원` → `2,154,000 < 2,156,880` | **최저임금 미만(위반)** |
| 고용노동부 공식 모의계산기(`workingHour=208.57`, 반올림 없음) | `resultValue = 2,154,000/208.57 ≈ 10,327.47원 ≥ 10,320원` | **정상(위반 아님)** |

**같은 고용노동부가 운영하는 두 도구가 동일한 입력에서 반대되는 최저임금 위반 판정을
내린다.** 이 계산기가 "최저임금 준수 여부 판정"을 핵심 목적으로 삼는다는 점(SPEC.md
"목적")을 고려하면, FORMULA.md가 정수 반올림을 채택한 근거("정부의 실제 계산 관행이
그렇다")는 **정부 홍보용 요약 수치(보도자료·생활법령정보의 "약 209시간")에는 맞지만,
정부 자신의 실제 판정 로직(모의계산기)과는 다르다**는 것이 이번에 새로 확인됐다. 이는
FORMULA.md 자체의 근거 오류이며 Builder 구현 문제가 아니다 — **공식 재검토 요청**으로
Formula Analyst에게 반려한다.

- 등급: **High** (계산 결과가 아니라 "최저임금 준수 판정"이라는 이 계산기의 존재
  이유 자체가 뒤바뀌는 경계 구간이 실재하고, 위 표의 2,154,000원처럼 현실적인 월급
  액수에서 발생한다).
- 참고로 이 발견은 FORMULA.md "정밀도/반올림 정책" 근거 2번이 스스로 계산했던 차이
  (40시간 기준 정밀값 정책 대비 4,423원 차이 구간)와 정확히 같은 성격의 문제이지만,
  FORMULA.md는 "정수 반올림 정책이 정부 관행과 일치해 이 문제를 피한다"고 결론 냈던
  것이 이번 조사로 뒤집힌 것이다 — 오히려 **정밀값(반올림 없음 또는 2자리 반올림)
  정책이 정부의 실제 판정 도구와 더 가깝다.**
- Formula Analyst에게 요청하는 재검토 범위: (1) 정수 반올림 정책을 유지할지, 근사
  정밀값(2자리 등) 정책으로 바꿀지 재결정, (2) 만약 유지한다면 "정부 관행"이라는
  근거 문구를 "정부의 홍보용 요약 수치와 일치하지만, 정부의 실시간 판정 도구와는
  다르다"로 정정, (3) Golden Test A1(209시간, 2,156,880원)은 유명한 참고 수치라
  유지하되, 경계 판정 예제를 하나 추가해 이 트레이드오프를 문서화할 것을 권고한다.

### 우선순위 항목 3 — 최저임금법 제6조제4항 산입범위 "2024년 전면 산입" → **해결(정부 1차 출처 확보)**

law.go.kr Open API로 최저임금법 원문(`MST=218303`)을 확보해 제6조제4항과 그 **부칙**을
직접 읽었다. 제6조제4항 본문은 상여금 25%, 복리후생비 7% 초과분만 산입한다고 되어 있지만,
**부칙(법률 제15666호, 2018.6.12 공포, 2019.1.1 시행) 제2조(최저임금의 효력에 관한 적용
특례)**가 이 비율을 연도별로 낮추도록 명시한다:

```
제2조(최저임금의 효력에 관한 적용 특례)
① 제6조제4항제2호의 "100분의 25"는 다음 각 호에 따른 비율로 한다.
   1. 2020년은 100분의 20   2. 2021년은 100분의 15   3. 2022년은 100분의 10
   4. 2023년은 100분의 5    5. 2024년부터는 100분의 0
② 제6조제4항제3호나목의 "100분의 7"은 다음 각 호에 따른 비율로 한다.
   1. 2020년은 100분의 5    2. 2021년은 100분의 3     3. 2022년은 100분의 2
   4. 2023년은 100분의 1    5. 2024년부터는 100분의 0
```

**"2024년부터는 100분의 0"** — FORMULA.md/Builder가 2차 출처(HR 블로그)로 교차확인했던
"2024년 전면 산입 완료"가 **정부 1차 출처(법률 부칙 원문)로 완전히 확인됐다.** FORMULA.md
FAQ 5번·"공식의 전제조건" 절의 서술은 정확하다. 이 항목은 **완전 해결**로 종결한다.

### 우선순위 항목 4 — `weeklyHours` 극단값 버그 방어 위치 검증 → **안전 확인(방어 우회 경로 없음)**

코드 리딩 결과:
- `MIN_WEEKLY_HOURS=1`은 `validation.ts` 62행에만 정의되어 있고, `logic.ts`에는 별도의
  하한 방어가 없다(ARCHITECTURE.md "4."가 명시한 설계 그대로).
- `calculateMinimumWageComparison`(오케스트레이터)을 호출하는 곳은 프로젝트 전체에서
  `ui.tsx` 156행(`useCalculatorShare` 콜백)과 202행(`handleSubmit`) **두 곳뿐**임을
  `grep`으로 확인했다(다른 계산기·라이브러리에서 이 함수를 재사용하는 코드 없음).
- 두 호출 모두 직전에 반드시 `validateMinimumWageCalculatorInput(...)`을 호출하고
  `if (!validation.success) return;`(공유 URL 복원) / `if (!validation.success) { ...
  return; }`(폼 제출)로 실패 시 `calculateMinimumWageComparison`을 호출하지 않고
  종료함을 직접 확인했다 — **공유 URL 복원 로직도 검증을 우회하지 않는다.**
- `logic.test.ts`가 `calculateWeeklyPaidHours`/`calculateMonthlyEquivalentHours`를
  검증 없이 직접 호출해 극단값 붕괴(0.05시간 → `monthlyEquivalentHours=0`)를 재현하는
  테스트는 **의도적으로 검증을 우회하는 단위 테스트**이지 실제 UI/공유 경로가 아니다.

**결론**: Builder가 EVALUATION.md에 남긴 우려("재검증 권고")는 **기우였음을 코드
리딩으로 확인**했다. 실제 우회 경로는 없다. 이 항목은 Low 등급의 참고 메모만 남긴다 —
`calculateMinimumWageComparison`이 향후 다른 파일에서 직접 import될 경우를 대비해
함수 JSDoc에 "반드시 `validateMinimumWageCalculatorInput`을 통과한 입력만 전달할 것"이라는
경고를 추가하면 좋겠으나, 현재 동작에는 문제가 없다(Low, 선택적 권고).

### 우선순위 항목 5 — `logic.shared-import.test.ts`의 모킹 검증 한계 → **코드 리딩으로 보완 확인**

`logic.ts` 전체(236행)를 처음부터 끝까지 읽고 다음 패턴을 검색했다:
`min(`, `Math.min(`, `/ ?40`, `\* ?8`, `weeklyHours\s*/\s*40` 등. **`calculateWeeklyHolidayHours`
호출 지점(86~90행) 외에는 주휴시간을 계산하는 코드가 단 한 곳도 없다** — `computeSharedComparison`
(143~165행)은 `calculateWeeklyPaidHours`가 반환한 `weeklyHolidayHours`/`weeklyPaidHours`를
그대로 구조분해해 전달만 할 뿐 자체적으로 재계산하지 않는다. `calculateFromHourlyWage`/
`calculateFromMonthlyWage`도 `shared`를 스프레드(`...shared`)해 그대로 반환할 뿐이다.
`grep`으로 재확인한 결과(위 "표준 검증" 스크린샷 참고), `min(`·`/40*8`·`365/84` 패턴은
주석(JSDoc)과 `logic.test.ts`의 테스트 설명 문자열에만 등장하고 **실행 코드 경로에는
`src/lib/labor-standards.ts`와 `computeSharedComparison`의 `× 365/(12×7)` 한 곳만
존재**한다.

**결론**: `logic.shared-import.test.ts`의 모킹 테스트가 증명하지 못하는 부분(오케스트레이터
전체에 걸친 "숨은 재구현 없음")을 코드 리딩으로 보완 확인했다 — **숨겨진 로컬 재구현
없음.** annual-leave-allowance 선례와 동일한 방식으로 검증 완료.

### 우선순위 항목 6 — 이중 배지 구조의 수학적 일관성 → **반례 발견, 수학적으로 증명 완료 (Medium)**

독립 Python 스크립트로 (1) 수학적 증명, (2) 전수 스윕(주 근무시간 0.5시간 단위 1~168시간 ×
경계 부근 월급/시급 전수)을 수행했다.

**증명 — HOURLY 모드는 절대 갈리지 않는다**: `validation.ts`가 `hourlyWage`를 정수로만
허용하고, `monthlyEquivalentHours`(=M)도 항상 정수이므로, `convertedMonthlyPay =
round(hourlyWage × M) = hourlyWage × M`(정수×정수라 반올림이 항상 무연산)이고
`minWageMonthlyEquivalent = minWageHourly × M`도 정수×정수다. 따라서
`monthlyMeetsMinimumWage = (hourlyWage×M ≥ minWageHourly×M) ⇔ (hourlyWage ≥ minWageHourly)
= hourlyMeetsMinimumWage`가 **M>0인 한 항상 참**이다 — HOURLY 모드에서는 두 배지가
수학적으로 절대 갈릴 수 없다(스윕 결과 0건, 이론과 일치).

**반례 — MONTHLY 모드는 실제로 갈린다, 그것도 "아주 좁지" 않다**: MONTHLY 모드는
`convertedHourlyWage = round(monthlyWage / M)`에서 진짜 반올림이 일어난다. 증명:
`monthlyMeetsMinimumWage=true ⟹ hourlyMeetsMinimumWage=true`는 항상 성립하지만(역은
아니다), `monthlyWage ∈ [M×(minWageHourly−0.5), M×minWageHourly)` 구간(폭 `0.5×M`)에서는
`convertedHourlyWage`가 반올림으로 `minWageHourly`까지 올라가 **`hourlyMeetsMinimumWage=true`
이면서 `monthlyMeetsMinimumWage=false`인 반례가 존재**한다. 방향은 이 한쪽뿐이며
(스윕 66,572건 전부 `(hourlyMeets=True, monthlyMeets=False)`, 반대 방향 0건), Builder가
"아주 좁은 경계 구간"이라 표현한 것과 달리 **폭이 `M/2`(주 40시간이면 104개의 정수 월급
값)**로 결코 무시할 수 없는 크기다.

**구체적 반례(Golden Test 후보)**:
```
mode=MONTHLY, weeklyHours=40, monthlyWage=2,156,776 ~ 2,156,879원(104개 값, 예: 2,156,800원)
→ convertedHourlyWage = round(monthlyWage/209) = 10,320원 → hourlyMeetsMinimumWage=true
→ monthlyWage(예: 2,156,800원) < minWageMonthlyEquivalent(2,156,880원)
  → monthlyMeetsMinimumWage=false
```
이 입력을 넣으면 화면에서 **핵심 결과 카드는 "최저임금 이상"(초록/강조 배지, MONTHLY
모드는 `hourlyMeetsMinimumWage` 기준)을 보여주는 동시에, 바로 아래 "미충족 경고
카드"가 조건부로 나타나 "월급 2,156,800원은(는) ... 낮습니다"라고 표시**한다 —
같은 화면에서 "이상"과 "미만"이 동시에 노출되는 실제로 재현 가능한 모순이다.

- **등급: Medium.** 개별 계산값(`convertedHourlyWage=10,320`, `minWageMonthlyEquivalent=
  2,156,880`)은 각각 FORMULA.md 공식대로 **정확**하다 — 계산 오류가 아니라 ARCHITECTURE.md
  "12."가 정한 "핵심 카드는 환산값 기준 배지, 보조 카드는 원본 기준 배지"라는 **디자인
  선택이 초래한 표시 모순**이다. FORMULA.md 오류가 아니므로 "공식 재검토 요청"으로
  분류하지 않고, Medium 등급의 UX/설계 이슈로 UX/UI Critic·QA·Architect에게 넘긴다.
- **권고**: (a) 핵심 카드 배지를 `monthlyMeetsMinimumWage`와 `hourlyMeetsMinimumWage`
  모두를 고려해 "둘 중 하나라도 미만이면 경고"로 바꾸거나, (b) 위 반례를
  `logic.test.ts`/`formatting.test.ts`에 Golden Test로 추가해 최소한 이 현상이 회귀
  없이 안정적으로 재현됨을 문서화할 것. (c) 참고로 우선순위 항목 2의 재검토 결과
  정수 반올림 정책이 근사 정밀값 정책으로 바뀐다면 이 반례의 폭(`M/2`)도 크게
  줄어든다(정밀값 정책에서는 반올림 단위가 1원 수준이 되어 폭이 사실상 0.5원으로
  축소) — 두 이슈는 같은 근본 원인(중간 반올림)에서 갈라져 나온 것이므로 함께 재검토를
  권고한다.

---

### 종합 이슈 목록

| 등급 | 항목 | 요약 |
|---|---|---|
| High | 항목 2 | FORMULA.md의 "정수 반올림이 정부 관행" 근거가 정부의 실시간 판정 도구(moel.go.kr 모의계산기)와 배치됨 — 공식 재검토 요청 |
| Medium | 항목 6 | MONTHLY 모드에서 `hourlyMeetsMinimumWage`/`monthlyMeetsMinimumWage`가 갈리는 실제 반례(폭 104개 값, weeklyHours=40 기준) 존재 — UX 재검토 권고 |
| Low | 항목 1 | FORMULA.md가 인용한 시행령 제5조 "조문 제목"이 실제 정부 원문과 다름("임금의 시간급 환산" → 실제는 "최저임금의 적용을 위한 임금의 환산") — 인용 라벨 정정 권고 |
| Low | 항목 4 | `calculateMinimumWageComparison`에 "검증된 입력만 전달할 것" JSDoc 경고가 없음(현재 실질적 위험은 없음) — 선택적 권고 |
| 정보(해결) | 항목 1 | 시행령 제5조 전문 확보, FORMULA.md 인용과 완전 일치 확인. 제5조의2(월 환산액의 산정) 신규 발견 — FORMULA.md "공식 5" 결론을 추가로 뒷받침 |
| 정보(해결) | 항목 3 | 2024년 전면 산입 부칙 원문(법률 제15666호 부칙 제2조) 확보, FORMULA.md 서술과 완전 일치 확인 |
| 정보(해결) | 항목 5 | `logic.ts` 전체 코드 리딩으로 주휴시간 산식의 숨은 로컬 재구현 없음을 재확인 |

### 결론

- **구현(Builder) 관점**: FAIL 사유 없음. FORMULA.md/ARCHITECTURE.md에 정의된 공식·구조·
  반올림 정책을 정확히, 임의 변경 없이 구현했다. 19개 Golden Test 전부 독립 재계산과
  일치했고, 회귀 테스트(90파일/1,267개) 전부 통과, 체이닝 금지·raw/display 분리·
  weeklyHours 하드코딩 방지 요구사항 모두 코드로 확인됐다.
- **공식(FORMULA.md) 관점**: 항목 2에서 FORMULA.md가 스스로 든 핵심 근거("정부의 실제
  계산 관행")가 정부의 또 다른 공식 도구(moel.go.kr 모의계산기)와 정면으로 배치되는
  구체적 반증을 새로 발견했다. 이는 Builder의 잘못이 아니라 **FORMULA.md 단계의 조사
  공백**이므로, 이 계산기의 전체 판정을 **"공식 재검토 요청"**으로 Formula Analyst에게
  반려한다. 나머지 5개 우선순위 항목은 모두 해소되었거나(1, 3, 4, 5) 계산 정확성과
  무관한 Medium UX 이슈(6)로 별도 트랙에 넘긴다.
- Formula Analyst가 항목 2를 재검토해 정책을 유지하거나 변경하기로 확정하면(코드 변경이
  필요 없는 "근거 문구 수정"이든, `logic.ts`의 반올림 방식 변경이든), 그 결정을 반영한
  뒤 Calculation Auditor가 재검증한다. 그 전까지 이 계산기는 QA 단계로 진행하지 않는다.

---

## Builder (v2 재구현)

**작업일**: 2026-09-14. FORMULA.md v2(Calculation Auditor "공식 재검토 요청" 반영,
`monthlyEquivalentHours`를 정수 반올림에서 소수 둘째 자리 반올림으로 교체)와 Architect가
이미 수정한 `types.ts`(v2, `minimumWageJudgmentMismatch` 필드 신규 추가)를 그대로 구현했다.
**이 절도 위 "Builder 구현 완료"와 마찬가지로 최종 정확성 판정이 아니다** — Calculation
Auditor의 재검증이 다시 필요하다(아래 "재검증이 필요한 지점" 참고).

### 시작 시점 확인 — Architect가 남긴 tsc 에러 2건

`npx tsc --noEmit`을 먼저 실행해 ARCHITECTURE.md "v2 개정 > 7." Builder 인계 체크리스트가
예고한 에러 2건(`logic.ts`의 두 반환 객체에 `minimumWageJudgmentMismatch` 누락)이 정확히
그대로 재현됨을 확인한 뒤 작업을 시작했다.

### 무엇을 어떻게 고쳤는가

1. **`logic.ts`**
   - `round2(value) = Math.round(value * 100) / 100` 로컬 헬퍼를 추가하고,
     `calculateMonthlyEquivalentHours`의 반환식을 `Math.round(...)`(정수)에서
     `round2(...)`(소수 둘째 자리)로 교체했다. `weeklyHours=40`이면 이제 `208.57`을
     반환한다(과거 `209`가 아니다).
   - `computeSharedComparison`의 `minWageMonthlyEquivalent = minWageHourly *
     monthlyEquivalentHours` 줄에 `Math.round(...)`를 명시적으로 추가했다(v1은 정수×정수라
     반올림이 무연산이었지만, v2는 실제 반올림이 필요하다 — ARCHITECTURE.md "v2 개정 > 3."
     그대로).
   - `calculateFromHourlyWage`/`calculateFromMonthlyWage` 각각에서
     `hourlyMeetsMinimumWage`/`monthlyMeetsMinimumWage`를 지역 변수로 먼저 확정한 뒤,
     `minimumWageJudgmentMismatch: hourlyMeetsMinimumWage !== monthlyMeetsMinimumWage`를
     반환 객체에 추가했다(tsc 에러 2건 해소). 두 모드 모두 상수로 하드코딩하지 않고 실제
     비교 결과를 계산한다 — `types.ts`의 JSDoc이 요구한 대로 HOURLY 모드도 매번 실제로
     비교한다(수학적으로 항상 `false`가 되어야 하지만 그 사실 자체를 로직에 새기지 않는다).
   - `calculateMonthlyEquivalentHoursExact`, `calculateWeeklyPaidHours`, 오케스트레이터
     구조(`calculateFromHourlyWage`/`calculateFromMonthlyWage`/
     `calculateMinimumWageComparison`)는 전혀 건드리지 않았다 — 이번 개정은 반올림 자릿수와
     신규 파생 필드 계산에 국한된다.
2. **`formatting.ts`**
   - `buildMinimumWageBreakdown`의 "월 환산 시간" 행과 "환산 월급"/"환산 시급" 행이
     `${result.monthlyEquivalentHours}시간` 템플릿 리터럴로 직접 출력하던 것을
     `formatHours(result.monthlyEquivalentHours)` 호출로 교체했다(ARCHITECTURE.md "v2 개정
     > Builder 체크리스트 2." 그대로) — 부동소수점 표현 오차·후행 0 들쭉날쭉 문제를
     `formatHours`의 `Math.round(hours*100)/100` + `Intl.NumberFormat` 조합으로 흡수한다.
     "월 환산 시간" 행의 "반올림" 라벨도 "반올림(소수 둘째 자리)"로 구체화했다.
   - `buildJudgmentMismatchNotice(result)` 신규 함수를 추가했다(ARCHITECTURE.md "v2 개정 >
     4." Builder 구현 지침 그대로). `result.minimumWageJudgmentMismatch`가 `false`면
     `null`, `true`면 "반올림 손실 때문에 발생하는 정상적인 현상"이라는 취지의 안내 문구를
     반환한다.
3. **`content.ts`**
   - FAQ 1번("올해 최저임금은 얼마인가요?")·2번("시급과 월급은 어떻게 서로 환산되나요?")
     답변을 FORMULA.md v2 "FAQ 콘텐츠" 절이 이미 제공한 갱신 문구로 그대로 교체했다 — "약
     209시간"만 언급하던 v1 문구를 "약 209시간(홍보용 참고 수치)"과 "약 208.57시간(이
     계산기의 실제 계산값)"을 함께 설명하고 4,438원 차이를 명시하는 문구로 바꿨다. 새로운
     법적 주장을 이 파일에서 만들지 않고 FORMULA.md 원문을 그대로 옮겼다(other FAQ 3~7은
     반올림 정책과 무관해 변경하지 않았다).
   - `MINIMUM_WAGE_INTRO_PARAGRAPHS`(소개 문구) 첫 문단에 "이 계산기는 월 환산 시간을 '약
     209시간'으로 반올림하지 않고 소수 둘째 자리(약 208.57시간)까지 그대로 사용합니다"라는
     문장을 FORMULA.md v2 "소개 문구" 절 그대로 추가했다.
   - `MINIMUM_WAGE_INTRO_HIGHLIGHTS`에 같은 취지의 하이라이트 항목을 1개 추가했다(FORMULA.md가
     강제하지 않았지만 "필요하면 추가해라"는 작업 지시에 따른 Builder 판단 — 검증 필요 항목으로
     아래에 남긴다).
4. **`ui.tsx`**
   - `buildJudgmentMismatchNotice`를 import해 "시급·월급 비교" `SectionCard` 안, 기존 "월급
     비교는 주 {…} 기준…" 안내문 바로 아래에 조건부로 렌더링했다(`result.minimumWageJudgmentMismatch`가
     `true`일 때만) — ARCHITECTURE.md가 권고한 위치·"새 공용 컴포넌트로 승격하지 않는다"는
     방침 그대로.
   - 그 외 레이아웃·모드 전환·체이닝 방지 로직은 전혀 건드리지 않았다.
5. **`validation.ts`** — Architect의 "MIN_WEEKLY_HOURS=1은 v2에서도 안전하다" 판단을 그대로
   받아들여 **한 글자도 바꾸지 않았다**.
6. **테스트 전면 갱신**
   - `logic.test.ts`: FORMULA.md v2가 재계산한 로직 레벨 12개 Golden Test(A1~A3, B1~B4,
     C1~C2, D1~D2, E1)로 전부 교체했다 — v1의 정수 기준 기댓값(`209`, `2,156,880` 등)은
     하나도 남기지 않았다. 신규 B4(월급 2,154,000원)는 Calculation Auditor의 반례가 v2에서
     실제로 "정상"으로 해소되는지, 그리고 "v1 기준이었다면 위반으로 오판했을 것"이라는
     회귀 방지 어서션까지 함께 검증한다. A1↔B1 교차검증(왕복 계산)도 새 값(2,152,442원)으로
     갱신해 재확인했다. `calculateMonthlyEquivalentHours`의 정밀값 검증 describe도 "정수를
     반환한다"에서 "소수 둘째 자리로 반환한다"로 제목·기댓값을 함께 고쳤다.
   - **극단값 버그(ARCHITECTURE.md "4.")의 재현 조건이 바뀐 것을 반영했다**: v1에서
     `weeklyHours=0.05`가 `monthlyEquivalentHours=0`으로 붕괴하는 것을 보여주던 테스트가
     v2(소수 둘째 자리 반올림, 붕괴 임계값이 약 100배 낮아짐)에서는 그대로 실행하면 실패한다
     (0.05는 이제 `0.26`으로 안전하게 계산된다) — 이를 "v2가 v1보다 안전해졌다"는 정방향
     테스트로 바꾸고, 실제 v2 붕괴를 재현하는 훨씬 작은 값(`weeklyHours=0.0005`)에 대한
     테스트를 새로 추가했다(ARCHITECTURE.md "v2 개정 > 6."이 계산한 임계값 약 0.00096과
     일관됨을 확인).
   - **`minimumWageJudgmentMismatch` 신규 describe 블록**을 추가해 (a) HOURLY 모드는 여러
     입력에서 항상 `false`임을, (b) MONTHLY 모드에서 실제로 `true`가 되는 구체적인 반례
     (`monthlyWage=2,152,400원`, `weeklyHours=40`)를 직접 계산해 재현했다 — FORMULA.md v2가
     유도한 반례 구간(`[2,152,339, 2,152,441]`) 안의 값을 손으로 다시 계산해 검증한 것이다
     (아래 "재검증이 필요한 지점" 1번 참고).
   - `formatting.test.ts`: breakdown 문자열 기댓값을 "209시간"/"2,156,880원" 등에서
     "208.57시간"/"2,152,442원" 등으로 교체했고, `formatHours`가 소수 둘째 자리 값과 우연히
     정수로 떨어지는 값(`365`) 모두 자연스럽게 표시하는지 테스트를 추가했다.
     `buildJudgmentMismatchNotice`에 대한 신규 describe(정상/반례 각 1개)도 추가했다.
   - `validation.test.ts`/`logic.shared-import.test.ts`는 **전혀 수정하지 않았다** —
     반올림 정책과 무관한 입력 검증·공유 함수 import 검증이라 ARCHITECTURE.md도 변경
     불필요라고 명시했고, 실제로 값 하나도 손대지 않았다.

### 실행 결과

- `npx tsc --noEmit`: 클린(에러 0건, Architect가 예고한 2건 모두 해소 확인).
- `npx vitest run --no-file-parallelism`: **90개 파일 · 1,275개 테스트 전부 통과**(v1
  Builder 라운드의 1,267개 대비 +8 — B4, 극단값 붕괴 재구성, `minimumWageJudgmentMismatch`
  신규 테스트 6개분 순증분). `weekly-holiday-allowance`·`src/lib/labor-standards`를 별도로
  좁혀 재실행해도(`npx vitest run src/calculators/weekly-holiday-allowance
  src/calculators/minimum-wage-calculator src/lib/labor-standards --no-file-parallelism`)
  8개 파일·145개 테스트 전부 통과 — 이번 라운드는 `logic.ts`/`formatting.ts`/`content.ts`/
  `ui.tsx`/두 테스트 파일만 수정했고 `src/lib/labor-standards.ts`나
  `weekly-holiday-allowance` 쪽은 전혀 건드리지 않았으므로 회귀가 있을 이유가 없다(실제로도
  없음을 확인).
- `npm run build`(Next.js 16, Turbopack): 성공(정적 페이지 39개, 기존과 동일한 경로 구성 —
  `status: "draft"` 유지라 sitemap/카테고리 목록에는 여전히 노출되지 않는다).
- `npx eslint src/calculators/minimum-wage-calculator "app/calculators/[slug]/page.tsx"
  src/calculators/registry.ts src/calculators/calculator-components.ts`: 오류·경고 0건.
- `registry.ts`의 `minimum-wage-calculator` 항목은 `status: "draft"`를 그대로 유지했다(수정
  없음) — Calculation Auditor 재검증 전이라는 EVALUATION.md 결론을 그대로 따른 것이다.

### 재검증이 필요한 지점 (정직하게 남긴다 — Builder 스스로 "정확하다"고 판정하지 않는다)

1. **`minimumWageJudgmentMismatch` 반례(`monthlyWage=2,152,400원`)의 정확성.** 이 구체적인
   입력값은 Builder가 FORMULA.md v2 "[신규] Calculation Auditor 항목 6..." 절이 유도한
   반례 구간(`monthlyWage ∈ [2,152,339, 2,152,441]`)에서 대표값 하나를 고르고, 손으로
   `round(2,152,400/208.57)=10,320`(→ `hourlyMeets=true`)과
   `2,152,400 < minWageMonthlyEquivalent(2,152,442)`(→ `monthlyMeets=false`)를 재계산해
   테스트에 반영한 것이다. FORMULA.md·EVALUATION.md 어느 문서도 이 정확한 숫자
   `2,152,400`을 예시로 명시하지는 않았다(구간만 제시했다) — Builder가 그 구간 안에서
   새로 골라 계산한 값이므로, Calculation Auditor가 독립적으로(예: 이전 라운드처럼 별도
   Python 스크립트로) 이 구간 전체를 다시 스윕해 103개 반례가 실제로 그 경계와 정확히
   일치하는지, 그리고 이 테스트 값이 정말 그 안에 속하는지 재확인해 주기를 권고한다.
2. **`round2` 구현의 부동소수점 경계 재검증.** ARCHITECTURE.md "v2 개정 > 3."이 이미
   "`Math.round(x*100)/100`과 `Number(x.toFixed(2))`가 극단적 경계값에서 드물게 다른
   반올림 방향을 낼 수 있다"고 경고했고, "`weeklyHours` 유효 범위(1~168)에서 실제로 문제가
   되는 값이 있는지는 Builder가 별도 부동소수점 회귀 테스트로 확인할 것을 권고"했다. 이번
   라운드는 FORMULA.md가 제시한 12개 Golden Test 지점 + 극단값(0.05, 0.0005) 몇 개만
   확인했을 뿐, `weeklyHours` 1~168 전 구간(0.5 단위 등)을 자동으로 스윕해 `round2`와
   moel.go.kr의 `toFixed(2)`가 완전히 일치하는지 전수 검증하지는 못했다 — Calculation
   Auditor가 이전 라운드에서 이미 쓴 것과 같은 독립 스크립트(Python 등) 방식의 전수 스윕을
   권고한다.
3. **`monthlyEquivalentHours`를 이제 소수로 노출하는 breakdown/UI 문자열의 실제 화면
   렌더링을 브라우저로 직접 확인하지 않았다.** `formatting.test.ts`의 문자열 단위 테스트와
   `npm run build` 정적 생성 성공은 확인했지만, `minimumWageJudgmentMismatch` 안내 문구가
   실제 브라우저에서 반례 입력(예: 월급 2,152,400원, 주 40시간, MONTHLY 모드) 시 정확히
   그 위치에 나타나는지는 이번 라운드에서 dev 서버로 직접 클릭해 확인하지 않았다(v1
   Builder 라운드는 이런 런타임 스모크 확인을 했었다 — 이번엔 코드/빌드 레벨 확인에
   그쳤다). QA 단계에서 실제 화면 확인을 권고한다.
4. **`MINIMUM_WAGE_INTRO_HIGHLIGHTS`에 추가한 4번째 하이라이트 문구는 FORMULA.md가 강제한
   문구가 아니라 작업 지시의 "필요하면 추가해라"에 따른 Builder의 판단이다.** 문구
   자체("월 환산 시간은... 소수 둘째 자리(약 208.57시간)까지 정밀하게 계산합니다")가
   과도하게 기술적이어서 일반 사용자에게 오히려 혼란을 줄 수 있는지 UX/UI Critic이 톤을
   재검토해 주기를 권고한다.
5. **content.ts의 정책 고지 문구("최저임금법 제5조·제6조, 같은 법 시행령 제5조(임금의
   시간급 환산)")에 남아 있는 조문 제목 오기는 이번 라운드에서 고치지 않았다.**
   Calculation Auditor가 이미 "Low, 인용 라벨 정정 권고"로 남긴 항목(정부 원문 제목은
   "최저임금의 적용을 위한 임금의 환산")이며, 이번 작업 지시 범위(반올림 정책 v2 반영)에
   포함되지 않아 손대지 않았다 — 별도 라운드에서 정리할 것을 권고한다.
6. **이 Builder(v2) 라운드는 위 "Golden Test/Edge Case Test" 항목에서 재계산한 모든
   수치를 손으로(그리고 이 답변 작성 과정에서 단계별 곱셈·나눗셈으로) 재검증했지만, 이는
   FORMULA.md 저자·Builder 자신의 계산일 뿐 독립적인 제3의 재계산이 아니다.** Calculation
   Auditor가 v1 라운드에서 했던 것과 동일한 수준(프로젝트 코드를 import하지 않는 독립
   스크립트로 전 예제 재계산, moel.go.kr 재확인)의 재검증이 이번 v2 값에도 다시 필요하다 —
   특히 B4(반례 해소)와 신규 `minimumWageJudgmentMismatch` 필드가 이번 라운드의 핵심
   변경이므로 최우선으로 재검증할 것을 권고한다.

---

## Calculation Auditor (v2 재검증)

**검증일**: 2026-09-14
**검증 방법**: (1) `curl`로 `moel.go.kr/miniWageMain.do` 실제 배포 페이지를 다시 내려받아
`wageResultNew()`/레거시 `wageResult()` 함수 전문을 재확인, (2) Node.js(프로젝트 코드를 import하지
않는 독립 스크립트)로 `round2`(`Math.round(x*100)/100`) vs `Number(x.toFixed(2))`를
`weeklyHours ∈ [1, 168]` 전 구간(step 0.0001, 약 167만 개 지점)에서 전수 스윕, (3) 같은 방식의
독립 스크립트로 FORMULA.md v2 Golden Test 12개(A1~A3, B1~B4, C1~C2, D1~D2, E1)를 재계산해
`logic.test.ts`의 실제 기댓값과 대조, (4) `minimumWageJudgmentMismatch` 반례 구간(`[2,152,339,
2,152,441]`, 103개)을 독립 스크립트로 재유도, (5) 코드 리딩으로 `ui.tsx`의 조건부 렌더링 경로,
`content.ts` 문구, 조문 제목 오기 잔존 여부 확인, (6) `npx tsc --noEmit` · `npx vitest run
--no-file-parallelism` 재실행.

### 최종 판정: **PASS** — Builder 구현·FORMULA.md v2 모두 이번 재검증에서 계산 정확성 결함
발견되지 않음(Critical 0, High 0). QA 단계로 진행 가능.

---

### 1) v2 정책이 moel.go.kr 실제 판정 도구와 일치하는지 재확인

**(a) `wageResultNew()` 재확인(curl, 2026-09-14 재요청)** — 이전 라운드가 인용한 코드가 지금도
그대로 배포 중임을 재확인했다:

```js
// moel.go.kr/miniWageMain.do 실제 배포 JS, wageResultNew() 함수 내부(오늘 재확인)
workingHour = (parseInt(weekTime) + parseInt(paidTime)) * 365/84;
workingHour = workingHour.toFixed(2);              // 정수 아님 — 소수 둘째 자리(문자열)
MonthlyConversionAmount = hourlyWage * workingHour; // 문자열이지만 곱셈에서 숫자로 강제 변환됨
...
sum = normalCash + sanYuCash + sanYuCashMonPayN + bogRiCash + otherCash;
resultValue = sum / workingHour;                    // 환산 시급, 반올림 없이 그대로 비교에 사용
...
if (resultValue > minWageCash) { /* 정상 */ }
else if (resultValue == minWageCash) { /* 정상 */ }
else { /* 위반 */ }
```

레거시 `wageResult()`도 여전히 `Math.round(yearWorkingHours*100)/100.0`(2자리 반올림, 정수
아님)만 쓴다 — 신·구 버전 모두 정수 반올림을 쓴 적이 없다는 이전 라운드의 결론이 오늘도 그대로
재현됨을 확인했다. 비교 연산자도 `>` 또는 `==`(즉 `>=`)로, 이 계산기의
`displayHourlyWage >= minWageHourly` 방향과 정확히 일치한다.

**(b) `round2` vs `toFixed(2)` 부동소수점 전수 스윕(Node.js, 프로젝트 코드 미import)** —
`weeklyHours ∈ [1, 168]`를 `step=0.0001`로 스캔(1,670,001개 지점, 사실상 UI가 허용하는 모든
소수 입력을 촘촘히 커버)해 `monthlyEquivalentHoursExact`를 구한 뒤 `Math.round(x*100)/100`과
`Number(x.toFixed(2))`를 비교했다:

```
Swept 1,670,001 points in [1, 168] with step 0.0001
Mismatches found: 0
0.5-step sweep (UI 힌트 step) mismatches: 0
```

추가로 "반올림 경계에 가장 가까운"(즉 `exact*100`의 소수부가 0.5에 가장 근접한, 부동소수점
오차로 반올림 방향이 갈릴 위험이 가장 큰) 1,041개 지점을 별도로 뽑아 두 방식을 대조했으나
여기서도 불일치 0건이었다. **결론: 이 계산기의 유효 입력 범위 전체(`weeklyHours` 1~168)에서
`round2`는 moel.go.kr의 `toFixed(2)`와 완전히 동일한 결과를 낸다.** ARCHITECTURE.md "v2 개정 >
3."이 우려했던 "`Math.round(x*100)/100`과 `Number(x.toFixed(2))`가 경계값에서 다르게 반올림할
수 있다"는 이론적 위험은 이 계산기의 실제 입력 도메인에서는 실현되지 않는다(두 값 모두 정수×상수
연산으로 만들어지는 값이라 정확히 `*.*x5`가 되는 병적 사례가 나오지 않는다).

**결론**: 최우선 검증 항목 1 — **v2 정책은 moel.go.kr 실제 판정 도구와 정확히 일치하며,
`round2` 구현 자체에도 부동소수점 결함이 없다.**

---

### 2) Builder가 남긴 5가지 재검증 요청 (지시된 순서 그대로)

**① `monthlyWage=2,152,400`이 반례 구간 `[2,152,339, 2,152,441]`(103개) 안에 있는지, 그 구간
자체가 정확한지 — 독립 재계산으로 완전히 확인.**

```
minWageMonthlyEquivalent = round(10,320 x 208.57) = 2,152,442
반례 구간(hourlyMeets=true, monthlyMeets=false): [2,152,339, 2,152,441]
개수: 103
2,152,400 이 구간 안에 있음: True
round(2,152,400 / 208.57) = 10,320 (hourlyMeets=true) / 2,152,400 < 2,152,442 (monthlyMeets=false)
```

FORMULA.md v2·Builder·`logic.test.ts`의 주장과 정확히 일치한다. 구간 경계(`2,152,339` 하한,
`2,152,441` 상한)와 개수(103개) 모두 별도 스크립트로 재유도해 재확인했다.

**② `round2` vs `toFixed(2)` 전 구간 스윕 — 위 "1) (b)"에서 이미 수행, 불일치 0건.**

**③ `ui.tsx`에서 `minimumWageJudgmentMismatch=true`일 때 안내 문구가 실제로 렌더링되는 코드
경로 확인.** `ui.tsx`를 코드 리딩한 결과:

```ts
const judgmentMismatchNotice = result ? buildJudgmentMismatchNotice(result) : null;
...
{judgmentMismatchNotice && (
  <p className="mt-3 rounded-xl border border-border bg-surface-subtle p-3 text-xs leading-6 text-muted">
    {judgmentMismatchNotice}
  </p>
)}
```

`buildJudgmentMismatchNotice`는 `result.minimumWageJudgmentMismatch`가 `false`면 `null`을
반환하므로(`formatting.ts`), 이 문구는 정확히 그 플래그가 `true`일 때만 "시급·월급 비교"
`SectionCard` 안, "월급 비교는 주 ... 시간 기준..." 캡션 바로 아래에 조건부로 렌더링된다 —
ARCHITECTURE.md "v2 개정 > 4."가 지정한 위치·조건과 정확히 일치한다. 코드 경로 자체는 올바르게
연결되어 있음을 확인했다(실제 브라우저 렌더링 확인은 Builder도 이미 QA 몫으로 남겼고, 이번
Auditor 재검증 범위도 "코드 경로 연결"까지다).

**④ `content.ts`의 208.57시간 정밀도 관련 신규 문구의 계산 정확성.** FAQ 1번·소개 문구·
하이라이트 문구를 모두 대조했다:
- "2,156,880원과 4,438원 정도 차이" — `2,156,880 - 2,152,442 = 4,438` **정확**.
- "소수 둘째 자리(약 208.57시간)까지 그대로 사용" — `weeklyHours=40` 기준
  `monthlyEquivalentHours=208.57` **정확**(위 Golden Test 재계산과 일치).
- "고용노동부가 실제로 최저임금 위반 여부를 판정할 때 쓰는 방식과 일치" — 위 "1) (a)"에서
  재확인한 `wageResultNew()` 코드와 부합하는 서술. **오류 없음.**

**⑤ 법령 조문 제목 오기("임금의 시간급 환산" vs "최저임금의 적용을 위한 임금의 환산") 잔존
여부 — grep으로 확인, 여전히 남아있다(Low, 미해결).**

```
grep -rn "임금의 시간급 환산" src/calculators/minimum-wage-calculator
src/calculators/minimum-wage-calculator/content.ts:26:
  "이 계산은 최저임금법 제5조·제6조, 같은 법 시행령 제5조(임금의 시간급 환산)를 근거로 합니다."
```

Builder가 "이번 라운드 범위(반올림 정책 v2 반영) 밖이라 손대지 않았다"고 이미 정직하게 남긴
그대로다. 계산 로직에는 영향이 없는 인용 라벨 오류이므로 등급은 이전과 동일하게 **Low**로
유지한다 — PASS 판정을 막지 않지만, 다음 라운드(콘텐츠 정리)에서 정정할 것을 재권고한다.

---

### 3) FORMULA.md v2 Golden Test 20개 중 로직 레벨 12개 — 독립 재계산 대조

Node.js(프로젝트 코드 미import) 스크립트로 FORMULA.md "공식"·"계산 순서" 서술만 보고
A1~A3·B1~B4·C1~C2·D1~D2·E1을 재구현해 재계산했다. **12개 전부 `logic.test.ts`의 실제 기댓값과
정확히 일치**했다:

| 예제 | 독립 재계산 | `logic.test.ts` 기댓값 | 일치 |
|---|---|---|---|
| A1 | M=208.57, convertedMonthlyPay=2,152,442, minWageMonthlyEquivalent=2,152,442 | 동일 | 일치 |
| A2 | convertedMonthlyPay=2,502,840 | 동일 | 일치 |
| A3 | convertedMonthlyPay=1,981,415 | 동일 | 일치 |
| B1 | convertedHourlyWage=10,320(A1과 왕복 정확 복원) | 동일 | 일치 |
| B2 | convertedHourlyWage=11,986 | 동일 | 일치 |
| B3 | convertedHourlyWage=9,589 | 동일 | 일치 |
| B4 | convertedHourlyWage=10,327, 두 판정 모두 true("정상") | 동일 | 일치 |
| C1 | M=104.29, convertedMonthlyPay=1,076,273 | 동일 | 일치 |
| C2 | M=156.43, convertedHourlyWage=10,867, minWageMonthlyEquivalent=1,614,358 | 동일 | 일치 |
| D1 | M=5.21, convertedMonthlyPay=53,767 | 동일 | 일치 |
| D2 | M=764.76, convertedMonthlyPay=7,892,323 | 동일 | 일치 |
| E1 | convertedMonthlyPay=2,152,547 | 동일 | 일치 |

- **A1↔B1 왕복 교차검증**: 독립 스크립트에서도 A1의 `convertedMonthlyPay`(2,152,442원)를 B1의
  `monthlyWage`로 넣으면 정확히 원래 시급 10,320원이 복원됨을 재확인했다 —
  `monthlyEquivalentHours`가 소수(208.57)라도 이 방향의 왕복이 항상 정확하다는 FORMULA.md
  v2의 수학적 증명이 실측으로도 성립한다.
- **B4(Calculation Auditor 반례)**: 독립 스크립트로 `resultValue = 2,154,000 / 208.57 =
  10,327.468...`(moel.go.kr 방식 raw 값)을 재계산해 `10,320` 이상임을 확인했고, 이 계산기의
  `hourlyMeetsMinimumWage`·`monthlyMeetsMinimumWage` 둘 다 `true`("정상")로 판정됨을
  재확인했다 — **v1이었다면 "위반"으로 오판했을 사례가 v2에서 정확히 해소됨을 독립적으로
  재증명**했다.
- F1~F8(입력 오류)은 `validation.test.ts` 코드 리딩으로 FORMULA.md "예외" 절과 여전히 1:1
  대응함을 확인했다(반올림 정책과 무관해 Builder가 손대지 않았고, 실제로도 값 변경이 없다).

---

### 4) 회귀 확인

- `npx tsc --noEmit` -> **클린(에러 0건)**.
- `npx vitest run --no-file-parallelism`(전체 스위트) -> **90개 파일, 1,275개 테스트 전부
  통과**(Builder v2 라운드 보고와 정확히 일치).
- `npx vitest run src/calculators/minimum-wage-calculator src/calculators/weekly-holiday-allowance
  src/lib/labor-standards --no-file-parallelism` -> **8개 파일, 145개 테스트 전부 통과**.
- `git diff -- src/calculators/weekly-holiday-allowance/logic.ts`를 직접 확인해, 이번 v2
  라운드에서 `weekly-holiday-allowance`가 전혀 수정되지 않았음을(이 파일의
  `calculateWeeklyHolidayHours` 위임 리팩터링은 v1 Architect 라운드에서 이미 끝난 것이고, 이번
  v2 라운드는 `minimum-wage-calculator`의 `logic.ts`/`formatting.ts`/`content.ts`/`ui.tsx`와
  테스트 2개 파일만 건드렸음) 재확인했다 — **회귀 위험 자체가 구조적으로 없다.**

---

### 5) 이전 라운드 미해결 3개 항목에 v2가 영향을 주지 않았는지 — 영향 없음 확인

- **시행령 제5조 원문**: FORMULA.md v2 "기준/출처"가 이전 라운드가 확보한 원문 인용을 그대로
  유지하고 있고(조문 제목 정정도 유지), 새로 왜곡되거나 삭제된 부분이 없음을 확인했다.
- **2024년 산입범위 정부 1차 출처(부칙 제2조)**: FORMULA.md v2 "여전히 남아있는 확인 필요
  항목" 6번이 "[v2: 해결]"로 그대로 유지하고 있고, FAQ 5번 답변도 이전 라운드 확인 내용과
  동일한 서술을 유지한다.
- **`weeklyHours` 극단값 방어**: v2로 반올림 자릿수가 바뀌면서 0 붕괴 임계값이 오히려
  100배 낮아져(약 0.096 -> 약 0.00096) `MIN_WEEKLY_HOURS=1`과의 안전 여유가 더 커졌다는
  ARCHITECTURE.md "v2 개정 > 6."의 계산을 `logic.test.ts`의 신규 회귀 테스트(0.05는 더 이상
  붕괴하지 않음/0.0005는 여전히 붕괴함)로도 재확인했다 — 결론에 영향 없음, 오히려 더 안전해짐.

---

### 6) 참고 — 항목 6(이중 배지 불일치)에 대한 보강 관찰(등급 변경 없음)

기존 Medium 항목(MONTHLY 모드에서 `hourlyMeetsMinimumWage`/`monthlyMeetsMinimumWage`가 갈리는
반례, 폭 103개)을 재검토하는 과정에서, moel.go.kr `wageResultNew()`의 실제 비교 방식이 "원 단위로
반올림한 값끼리 비교"가 아니라 "반올림하지 않은 raw 비율(`resultValue = sum/workingHour`)을
그대로 `minWageCash`와 비교"한다는 점을 다시 확인했다. 이 계산기는 FORMULA.md의 투명성 요구
("화면에 보이는 값 = 실제 비교에 쓰인 값")에 따라 **원 단위로 반올림한 `displayHourlyWage`를
기준으로 비교**하므로, `monthlyWage`가 정확히 이 반올림 경계(폭 약 `M/2`, 40시간 기준 약 104원
단위 구간)에 걸리는 극히 좁은 경우에는 이 계산기의 `hourlyMeetsMinimumWage`가 moel.go.kr의 실제
raw-비교 판정과도 다를 수 있다. 이는 **새로운 결함이 아니라 FORMULA.md v2가 이미 "화폐 반올림
자체에서 나오는 구조적 현상"으로 정확히 진단하고 UX/Architect에게 위임한 것과 동일한 현상의
다른 단면**이므로 등급을 올리지 않는다 — 다만 다음 UX/Architect 라운드가 이 문제를 재설계할 때
"내부 두 배지 간 불일치"뿐 아니라 "moel.go.kr 실제 판정과의 잔여 불일치 폭(약 `M/2`)"까지 함께
참고 자료로 남겨 둔다.

---

### 종합 이슈 목록 (v2 재검증 라운드)

| 등급 | 항목 | 요약 |
|---|---|---|
| Medium(유지, 신규 아님) | 이중 배지 불일치 | v2로도 반례 폭(103개)이 거의 줄지 않음 - FORMULA.md v2가 이미 진단, UX/Architect 재설계 필요(위 "6)" 보강 관찰 포함) |
| Low(유지, 미해결) | 조문 제목 오기 | `content.ts:26`에 "임금의 시간급 환산"이 여전히 남아있음(정부 원문은 "최저임금의 적용을 위한 임금의 환산") |
| 정보(확인 완료) | moel.go.kr 정합성 | `wageResultNew()` 오늘 재확인, `round2` 부동소수점 전수 스윕(167만 지점) 불일치 0건 |
| 정보(확인 완료) | 20개 Golden Test 중 12개 | 독립 재계산 전부 일치, B4 반례 해소 재증명 |
| 정보(확인 완료) | 회귀 | tsc 클린, vitest 90파일/1,275개 전부 통과 |

### 결론

- **Builder(v2 재구현) 관점**: FAIL 사유 없음. ARCHITECTURE.md "v2 개정" 체크리스트를 정확히
  구현했고, 5가지 재검증 요청 전부 독립적으로 확인되었다.
- **FORMULA.md v2 관점**: 이번 재검증에서 새로운 오류를 발견하지 못했다 - v1을 무너뜨렸던
  moel.go.kr 반증이 v2로 실제로 해소됨을 독립 재계산으로 재확인했고, v2가 새로 도입한 반올림
  자릿수(`round2`) 자체도 moel.go.kr의 `toFixed(2)`와 유효 입력 전 구간에서 완전히 일치한다.
  **"공식 재검토 요청"을 다시 낼 사유가 없다.**
- **최종 판정: PASS.** 계산 정확성 Critical/High 이슈 0건. Medium(이중 배지, 기존 이슈 유지)·
  Low(조문 제목 오기, 기존 이슈 유지) 두 건은 PASS 기준(`docs/EVALUATION.md`)상 전체 판정을
  막지 않으며 UX/UI Critic·QA·다음 콘텐츠 정리 라운드로 각각 인계한다. 이 계산기는 QA 단계로
  진행할 수 있다.

---

## UX/UI Critic

**검토일**: 2026-09-14
**검토 방법**: 코드 리딩(`ui.tsx`/`content.ts`/`validation.ts`/`types.ts`/`formatting.ts`
전체), `tasks/minimum-wage-calculator/SPEC.md`·`ARCHITECTURE.md`(UI 레이아웃 절, "v2 개정"
절)·`EVALUATION.md`(Builder/Calculation Auditor 전 라운드) 대조, `docs/DESIGN_SYSTEM.md`
"입력 라벨·순서"·"공통 화면 순서"·"카드/표면 패턴" 기준 대조, `src/calculators/registry.ts`의
`categoryLabels`와 화면 eyebrow 라벨 대조. Edit 권한이 없어 코드를 수정하지 않았다. 실제
브라우저 렌더링(반응형 breakpoint, 실제 클릭 동작)은 이 역할의 권한 밖이며 QA가 별도로 확인해야
한다 — 아래 판정은 코드/레이아웃 구조 검토에 근거한다.

### 자체 평가 질문 (10개 이상, 7개 평가 항목 전부 커버, 필수 질문 포함)

| # | 질문 | 대응 평가 항목 | 필수 질문 |
|---|---|---|---|
| Q1 | 모드 토글("시급으로 계산"/"월급으로 계산")의 존재와 사용법이 직관적인가? 처음 보는 사용자가 헷갈리지 않는가? | 계산법을 몰라도 사용 가능한지 | |
| Q2 | 모든 입력 라벨을 `severance-pay/ui.tsx`의 `FIELDS` 패턴과 대조했을 때, 법령·전문 용어를 그대로 쓰거나 `FORMULA.md`/`SPEC.md` 용어를 그대로 복사한 라벨이 있는가? | 입력 라벨 표현 | **필수** |
| Q3 | 입력 필드 순서가 논리적 시간/작업 순서인가? 하나의 개념 단위(모드→금액→공통 옵션) 사이에 성격이 다른 필드가 끼어 있지 않은가? | 입력 순서·그룹핑 | **필수** |
| Q4 | 같은 개념이 폼·결과·오류 메시지·FAQ 전체에서 한 용어로 통일돼 있는가? | 입력 라벨/일관성 | **필수** |
| Q5 | 입력 필드 수가 최소인가? 다른 입력에서 유도 가능한 값을 중복으로 묻지 않는가? | 입력 순서·그룹핑 | **필수** |
| Q6 | 입력값과 환산값이 화면에서 명확히 구분되는가(SPEC Must Have)? 모드를 전환하면 금액 입력 필드가 실제로 비워지는가(체이닝 방지)? | 결과 가독성 | |
| Q7 | "약 209시간"과 이 계산기의 "208.57시간"의 차이가 결과 화면에서 그 숫자가 처음 등장하는 지점 가까이에서, 충분히·신뢰감 있게 설명되는가? | 결과 가독성 / 계산 근거 이해 | |
| Q8 | `minimumWageJudgmentMismatch` 안내 문구가 실제로 사용자를 안심시키는가, 아니면 더 혼란스럽게 만드는가? | 계산 근거 이해 | |
| Q9 | 최저임금 산입범위 단순화 고지가 실제로 각주 수준이 아니라 눈에 띄게 배치됐는가? | 결과 가독성 | |
| Q10 | 최저임금 미만 판정 시 경고 카드가 게이팅처럼 느껴지지 않고 참고 안내로 잘 읽히는가? | 오류 메시지/안내 이해 용이성 | |
| Q11 | 계산 근거(breakdown)에서 208.57시간·4.6시간·4.345주 같은 소수 숫자가 나열될 때 비전문가가 이해하기 부담스럽지 않은가? | 계산 근거 이해 | |
| Q12 | 주 근무시간을 40시간이 아닌 값으로 바꿨을 때 월 환산 최저임금이 바뀌는 것을 사용자가 눈치챌 수 있는가? | 계산 근거 이해 | |
| Q13 | 모바일에서 모드 토글 + 입력 2개 + breakdown이 레이아웃상 잘 읽히는가(가로 스크롤·잘림 없이)? | 모바일 사용성 | |
| Q14 | 유사 계산기(weekly-holiday-allowance 등)와 톤·카드 스타일·eyebrow 라벨이 일관되는가(`categoryLabels.labor`와 정확히 일치하는지 포함)? | 결과 가독성/일관성 | |
| Q15 | 경계값 입력(주 근무시간 0·168 초과, 금액 음수 등) 오류 메시지가 이해하기 쉬운가? | 오류 메시지 이해 용이성 | |
| Q16 | 핵심 결과 카드(환산값 기준 배지)와 보조 카드(입력값·환산값 양쪽 배지)가 같은 화면에 배지를 두 번 노출하는 것이 불필요한 UI 중복인가, 아니면 의도된 정보 제공인가? | 불필요한 UI 요소 여부 | |
| Q17 | Calculation Auditor가 Low로 남긴 "법령 조문 제목 오기"(`content.ts`)가 내부 문서 인용인지, 실제 화면에 노출되는 텍스트인지? | 오류 메시지/정확성(참고용) | |

---

### 답변 및 등급

**Q1. 모드 토글 직관성 — 문제없음(참고: Low 개선 여지)**
`ui.tsx` 278~311행: `<fieldset>`에 `legend`로 "계산 방향"을 명시하고, "시급으로 계산"/
"월급으로 계산" 두 옵션을 세그먼트 컨트롤(선택된 쪽은 `border-primary bg-primary-soft
text-primary`로 강조)로 배치했다. 실제 `<input type="radio">`는 `sr-only`로 숨기고
`<label>` 전체를 클릭 영역으로 써서 터치 영역도 넉넉하다. 바로 아래 캡션("아는 값 하나만
입력하면 나머지는 계산기가 채워 줍니다. 방향을 바꾸면 입력했던 금액은 새로 입력해야
합니다.")이 동작 방식(체이닝 방지 포함)을 사전에 정직하게 안내한다 — 이 사이트에 처음
등장하는 UI 패턴(ARCHITECTURE.md "13.")이지만 라디오 그룹의 시각적 변형이라 특별한 학습
비용이 없다. **등급: 문제없음.**

**Q2. [필수] 라벨의 법령/전문용어 여부 — 문제없음**
실제 라벨 3개: "시급"(placeholder "예: 10,320"), "월급"(placeholder "예: 2,500,000"),
"주 근무시간"(placeholder "예: 40"). 모두 일상어다. `FORMULA.md`/`SPEC.md`가 쓰는 "1주
소정근로시간", "1개월의 최저임금 적용기준 시간 수" 같은 법령 문언은 라벨에 노출되지 않고
helpText("1주 소정근로시간(휴게시간 제외)입니다...")에만 등장한다 — `docs/DESIGN_SYSTEM.md`
"입력 라벨·순서"가 요구하는 "라벨은 일상어, 법령 용어는 helpText로"를 정확히 지킨다. 이
계산기에는 `severance-pay`의 `FIELDS` 배열 같은 명시적 상수가 없고 `amountField` 객체 +
인라인 JSX로 구성되지만, 실제 렌더링되는 라벨 텍스트 자체는 그 패턴을 그대로 따른다.
**등급: 문제없음.**

**Q3. [필수] 입력 순서·그룹핑 — 문제없음**
이 계산기는 날짜 쌍처럼 "시간 순서"가 존재하는 필드가 없다(시급↔월급은 대칭적 양방향
환산이지 시퀀스가 아니다). 실제 순서는 "① 계산 방향 선택 → ② 그 방향에 해당하는 금액 1개
→ ③ 공통 옵션(주 근무시간, 기본값 있음)"으로, "먼저 무엇을 할지 정하고, 그다음 그것에
필요한 값을 채우고, 마지막에 선택적 보정값을 준다"는 논리적 순서를 따른다. 방향 선택과
금액 입력 사이, 금액과 주 근무시간 사이에 성격이 다른 필드가 끼어들지 않는다. **등급:
문제없음.**

**Q4. [필수] 용어 통일 — 문제없음**
"시급"/"월급"이 폼 라벨, 핵심 결과 카드, 보조 비교 카드, breakdown, 경고 카드, FAQ, 정책
고지 전체에서 예외 없이 동일하게 쓰인다. "최저임금 이상/미만"·"환산값"/"입력값" 배지
문구도 모든 위치에서 동일하다. 법령 인용이 필요한 곳(breakdown의 `legalBasis`, FAQ 근거
줄, 정책 고지)에서만 "1주의 최저임금 적용기준 시간 수" 같은 정확한 법령 표현이 등장하는데,
이는 "근거" 표시 목적이지 사용자에게 그 개념을 새 용어로 학습시키는 것이 아니므로 용어
혼선을 일으키지 않는다. **등급: 문제없음.**

**Q5. [필수] 입력 필드 수 최소화 — 문제없음**
필수 입력은 모드 선택 + 금액 1개뿐이고, 주 근무시간은 선택(기본값 40)이다. 시급과 월급을
동시에 입력받아 상호 검증하는 방식을 쓰지 않고(SPEC이 명시적으로 금지한 패턴), 다른
입력에서 유도 가능한 값을 중복으로 묻지 않는다. **등급: 문제없음.**

**Q6. 입력값/환산값 구분 및 모드 전환 시 필드 초기화 — 문제없음**
핵심 결과 카드에 "직접 입력한 값이 아니라 계산된 환산값입니다"라는 캡션이 명시적으로
붙어 있고(449행), 보조 "시급·월급 비교" 카드에서는 `ValueSourceBadge`가 각 행마다
"입력값"/"환산값" 배지를 `result.mode` 기준으로 정확히 렌더링한다(462~479행). `handleModeChange`
(165~169행)는 모드 변경 시 `hourlyWage`/`monthlyWage`를 모두 빈 문자열로 리셋하고
`weeklyHours`는 유지한다 — ARCHITECTURE.md "3.3" 체이닝 방지 규칙과 SPEC Must Have를 코드
레벨에서 정확히 만족한다. **등급: 문제없음.**

**Q7. "약 209시간" vs "208.57시간" 설명의 위치·신뢰감 — Medium (이번 평가의 핵심 발견)**
설명 콘텐츠 자체(FAQ 1·2번, `MINIMUM_WAGE_INTRO_PARAGRAPHS`)는 훌륭하다 — "계산이 틀린
것이 아니라 반올림 시점을 정부의 실제 판정 도구에 맞춘 결과"라고 명확히 밝히고 4,438원
차이까지 정확히 명시한다(content.ts 81, 88행). **문제는 위치다.** `208.57시간`이라는 숫자가
사용자 눈에 처음 들어오는 지점은 (a) 핵심 결과 카드의 "월 환산 2,152,442원(208.57시간
기준)" 문장(452~454행), (b) 계산 근거의 "월 환산 시간" 행이다 — 둘 다 페이지 상단부다.
반면 "왜 209가 아니라 208.57인가"를 설명하는 콘텐츠(IntroSection, FAQ)는 `mt-16`으로
한참 아래, 사용안내/소개 섹션과 FAQ 아코디언(기본 접힘 상태로 추정)에만 존재한다.
결과적으로 "약 209시간"을 알고 있는 사용자가 결과 화면 최상단에서 "208.57시간"을 먼저
마주쳤을 때, 그 자리에는 설명으로 이어지는 어떤 단서(각주 기호, "왜 다른가요?" 링크 등)도
없다 — 스크롤을 몇 차례 더 내리거나 FAQ를 펼쳐야만 해명을 찾을 수 있다. 이는 작업 지시가
"이번 평가의 핵심"이라고 명시한 리스크("이 계산기가 틀린 거 아냐?")를 완전히 해소하지
못한다. 계산 자체는 이미 Calculation Auditor가 PASS했으므로 Critical/High가 아니라,
`docs/EVALUATION.md` "Issue 등급" 정의상 "설명 부족"에 해당하는 **Medium**으로 분류한다.
**권고**: 핵심 결과 카드 또는 계산 근거의 "월 환산 시간" 행 옆에 "왜 209시간이 아닌가요?"
같은 짧은 인라인 캡션 또는 FAQ 앵커 링크를 추가해, 숫자가 처음 등장하는 자리에서 바로
해명에 닿을 수 있게 할 것을 Optimizer에게 권고한다.

**Q8. `minimumWageJudgmentMismatch` 안내 문구의 안심 효과 — Medium**
문구 자체(`buildJudgmentMismatchNotice`)는 어조가 차분하고 "계산이 잘못된 것이 아니라...
정상적인 현상"이라고 명시적으로 안심시키며, "두 값 중 하나만 보지 말고 함께 참고하라"는
실행 가능한 조언까지 준다 — 텍스트 품질 자체는 좋다. 렌더링 위치도 "시급·월급 비교" 카드
안, 두 값이 나란히 보이는 바로 아래라 맥락과 가깝다. **다만 구조적 문제가 남는다**:
이 안내가 트리거되는 상황(MONTHLY 모드, 반례 구간)에서는 핵심 결과 카드가 이미 "최저임금
이상"(강조 배지, 초록/파랑 톤)을 보여준 뒤, 몇 줄 아래 별도의 주황색 "미충족 경고 카드"가
독립적으로 나타나 "월급 ...보다 낮습니다"라고 말한다. 안내 문구는 그 사이(비교 카드 안)에
끼어 있어 사용자가 실제로 "경고 카드"까지 도달하기 전에 이 설명을 먼저 읽으리라는 보장이
없다(경고 카드는 그 자체로 독립된 색상·아이콘을 가진 별도 `<section>`이라 시선을 끌기
때문에, 사용자가 안내 문구를 건너뛰고 바로 경고 카드로 시선이 갈 수 있다). Calculation
Auditor도 이 이중 배지 구조 자체를 이미 Medium으로 남기고 UX 재설계를 권고했다(EVALUATION.md
"우선순위 항목 6", ARCHITECTURE.md "v2 개정 > 4."가 "최소 침습" 대응임을 스스로 인정).
이번 검토로도 이 안내 문구 하나만으로는 "핵심 카드 배지 vs 경고 카드"의 시각적 모순을
완전히 해소하지 못한다고 판단한다. **등급: Medium(기존 Calculation Auditor Medium 이슈와
동일 근본 원인, 문구 추가로는 부분 완화에 그침 — 구조적 재설계는 다음 라운드 권고).**

**Q9. 산입범위 고지의 가시성 — 문제없음**
`ui.tsx` 558~564행: 별도 `<section>`으로 분리해 `border-primary/30 bg-primary-soft` 배경을
쓰고("최저임금 산입범위 안내" 제목), 위치도 "적용된 입력값" 카드 바로 다음, 일반 "정책
고지"(`bg-surface-subtle`, 무채색)보다 앞쪽·결과에 더 가깝게 배치했다. 다른 일반 정책 고지
목록과 시각적으로 명확히 구분되어 SPEC Must Have("작은 각주가 아니라 정책 안내 카드
수준으로")를 충족한다. **등급: 문제없음.**

**Q10. 미충족 경고 카드가 게이팅처럼 느껴지지 않는지 — 문제없음**
경고 카드(494~512행)는 이미 계산되어 표시된 핵심 카드·비교 카드 **아래**에 조건부로만
추가되며, 카드 안에 "이 계산은 게이팅하지 않으며, 위 결과는 이미 모두 계산·표시된
상태입니다"라는 문장을 직접 명시한다. 스타일도 기존 `bg-warning-surface`/`border-warning-border`
패턴(다른 계산기와 동일)이라 "차단"이 아니라 "참고 안내"로 읽히는 이 사이트의 기존 관례를
그대로 따른다. **등급: 문제없음.**

**Q11. breakdown의 소수 숫자 밀도 — Low**
"1주 주휴시간"·"월 환산 시간" 행에 `4.6시간`, `48시간`, `365 ÷ 12 ÷ 7 ≈ 4.345주`,
`208.57시간` 같은 소수·계수가 한 문장에 여러 개 나열된다("48시간 × (365 ÷ 12 ÷ 7 ≈
4.345주) → 반올림(소수 둘째 자리) = 208.57시간"). 비전문가에게는 다소 밀도가 높지만,
SPEC이 명시적으로 요구한 "라벨 = 값 형태, 서술형 내레이션 금지"(severance-pay·
weekly-holiday-allowance와 동일 스타일)를 그대로 따른 결과이며, 이 사이트의 다른 계산기도
동일한 표기 밀도를 쓴다 — 이 계산기만의 회귀가 아니라 하우스 스타일의 일반적 특성이다.
**등급: Low(개선 여지는 있으나 이 계산기 고유의 결함이 아님).**

**Q12. 주 근무시간 변경이 결과에 반영됨을 사용자가 인지할 수 있는지 — 문제없음**
핵심 결과 카드("월 환산 2,152,442원(208.57시간 기준)"), 비교 카드 캡션("월급 비교는 주
{시간} 기준 월 환산 최저임금(...)과 비교한 것입니다"), breakdown의 "월급 비교" 행
(`({weeklyHours}시간 기준)` 병기)까지 최소 3곳에서 매번 실제 `weeklyHours` 값을 함께
표시한다 — ARCHITECTURE.md "7."이 요구한 "40시간 고정이 아님을 매번 상기시킨다"는 방침이
그대로 지켜졌다. **등급: 문제없음.**

**Q13. 모바일 레이아웃(코드 리딩 기준) — 문제없음(단, 실기기 확인은 QA 권고)**
모드 토글은 `grid-cols-2 gap-2 sm:max-w-md`로 작은 화면에서도 2열을 유지하면서 폭을
제한하고, 금액·주 근무시간 입력은 `w-full`, 핵심 결과 카드 폰트는 `text-4xl sm:text-5xl`·
패딩은 `p-6 sm:p-8`로 반응형이다. 비교 카드의 `dl` 행은 `flex-wrap items-center
justify-between gap-2`로 좁은 화면에서 줄바꿈된다. 고정 폭(`w-[...]px` 등)이나 가로 스크롤을
유발할 만한 요소는 코드상 발견되지 않았고, 다른 이미 배포된 계산기와 동일한 컴포넌트
(`SectionCard` 등)를 재사용한다. **등급: 문제없음(코드 리딩 기준) — 다만 실제 320px~390px
기기 렌더링 확인은 이 역할의 권한 밖이므로 QA가 재확인할 것.**

**Q14. 유사 계산기와의 톤·스타일·eyebrow 일관성 — 문제없음(아이콘은 Low 참고)**
`ui.tsx` 258~262행의 eyebrow "노동/근로"는 `registry.ts`의 `categoryLabels.labor`("노동/근로")와
문자 그대로 정확히 일치한다. 카드 스타일(`SectionCard`, `bg-primary` 핵심 카드,
`bg-warning-surface` 경고 카드)도 기존 계산기와 동일한 공용 클래스를 그대로 재사용했다.
카피 톤("계산해 드립니다", "알려드립니다")도 확정적 어투로 SPEC이 요구한 기준과 일치한다.
다만 Builder가 스스로 재검토를 권고한 아이콘("trend")은, "등락 지그재그+화살표" 모양이
"시세 변동/증가 추세"를 연상시켜 "기준 충족 여부 판정"이라는 이 계산기의 성격과 완벽히
맞아떨어지진 않는다 — 그러나 이미 겹치는 아이콘(heart)보다는 시각적으로 구분되고, 카테고리
목록에서 다른 계산기와 혼동될 위험은 낮다. **등급: Low(선택적 재검토 권고, 필수 수정
아님).**

**Q15. 경계값 오류 메시지 이해도 — 문제없음**
"주 근무시간은 168시간 이하로 입력해 주세요. (1주는 168시간입니다)"처럼 상한 이유까지
괄호로 설명하고, "시급은 0보다 커야 합니다"/"시급은 정수로 입력해 주세요"처럼 조사(을/를,
은/는)를 라벨 받침에 맞춰 자동 교정해 자연스러운 한국어 문장을 만든다. 0과 0.5~0.99 사이
값에 대해 메시지가 "0시간보다 커야 합니다"/"1시간 이상 입력해 주세요"로 갈리지만 각각의
경계를 정확히 설명하므로 혼란을 주지 않는다. 법령 용어 없이 일반 사용자가 바로 이해할 수
있는 문장이다. **등급: 문제없음.**

**Q16. 이중 배지 노출이 불필요한 UI 중복인지 — Medium(Q8과 동일 근본 원인, 별도 관점)**
핵심 카드의 배지 1개 + 비교 카드의 배지 2개(시급 행·월급 행)는 SPEC Must Have("시급 얼마/
월급 얼마를 항상 함께 보여준다", "입력값/환산값을 구분 표시")를 만족하기 위한 **의도된
중복**이지 불필요한 장식 요소는 아니다. 대부분의 입력(수학적으로 HOURLY 모드는 항상, MONTHLY
모드도 대다수 구간)에서는 두 배지가 같은 결론을 보여줘 오히려 "이중 확인"으로 신뢰를
강화하는 효과가 있다. 문제는 이 중복 자체가 아니라, Q8에서 다룬 것처럼 **극히 일부 구간
(MONTHLY 모드, 폭 M/2)에서 이 중복된 신호가 서로 다른 결론을 낼 때**다 — 이는 "불필요한 UI
요소"가 아니라 "필요한 중복이 드물게 모순되는 값을 보여주는" 별개의 문제이므로 이 항목
자체는 UI 정리 문제로 보지 않는다. **등급: 문제없음(중복 자체는 필요), 단 Q8의 Medium
이슈를 참고.**

**Q17. 법령 조문 제목 오기의 노출 범위 — Low(실제 화면에 노출되는 사용자 대상 텍스트임을 확인)**
`content.ts` 26행의 `MINIMUM_WAGE_POLICY_NOTICES` 배열 첫 항목("이 계산은 최저임금법 제5조·
제6조, 같은 법 시행령 제5조(임금의 시간급 환산)를 근거로 합니다.")은 **내부 참고 주석이
아니라 실제 화면 텍스트다** — `ui.tsx` 583~589행이 이 배열을 그대로 `.map()`해 "정책 고지"
`<section>`에 렌더링한다. 다만 이 섹션은 페이지 최하단(FAQ 바로 위)에 있고, 일반 사용자가
법령 조문 제목 자체를 정부 원문과 대조할 가능성은 낮아 실질적 혼란 유발 가능성은 작다.
그러나 사용자에게 노출되는 텍스트인 이상 법적 정확성을 위해 수정이 필요하다 — Calculation
Auditor가 이미 남긴 Low 등급을 그대로 유지하되, "내부 문서 인용이 아니라 실제 화면 텍스트"
라는 점을 명확히 기록해 다음 콘텐츠 정리 라운드(Optimizer)가 `content.ts:26`의
"(임금의 시간급 환산)"을 "(최저임금의 적용을 위한 임금의 환산)"으로 정정하도록 우선순위를
분명히 한다. **등급: Low(수정 권고, PASS를 막지 않음).**

---

### 발견 이슈 등급별 표

| 등급 | 항목 | 요약 | 권고 대상 |
|---|---|---|---|
| Critical | 없음 | — | — |
| High | 없음 | — | — |
| Medium | Q7 | "약 209시간" vs "208.57시간" 설명이 콘텐츠상으로는 충분하지만, 그 숫자가 처음 등장하는 핵심 결과 카드/계산 근거 근처에는 설명으로 이어지는 단서가 없어 스크롤을 많이 내리거나 FAQ를 펼쳐야만 해명에 닿을 수 있음 | Optimizer(인라인 캡션/앵커 링크 추가) |
| Medium | Q8/Q16 | `minimumWageJudgmentMismatch` 안내 문구 자체는 양호하나, 핵심 카드 배지와 별도 경고 카드가 같은 화면에서 상반된 신호를 줄 때 문구 하나로는 시각적 모순을 완전히 해소하지 못함(Calculation Auditor 기존 Medium 이슈와 동일 근본 원인) | Architect/Optimizer(구조 재검토, 이번 라운드 필수 아님) |
| Low | Q11 | breakdown의 소수·계수 밀도가 비전문가에게 다소 부담(하우스 스타일 공통 특성, 이 계산기 고유 결함 아님) | 선택적 |
| Low | Q14 | 아이콘("trend")이 "판정" 성격과 완전히 들어맞지는 않음(Builder가 이미 재검토 요청) | 선택적 |
| Low | Q17 | `content.ts:26` 법령 조문 제목 오기가 실제 화면(정책 고지 섹션)에 노출됨 — Calculation Auditor Low를 재확인, "화면 텍스트"임을 명확화 | Optimizer(문구 정정) |

---

### 최종 판정: **PASS**

- Critical 0, High 0 — `docs/EVALUATION.md` PASS 기준의 "Critical 0, High 0"을 충족한다.
- SPEC.md Must Have(모드 토글, 입력값/환산값 구분, 체이닝 방지, 게이팅 없는 상시 계산,
  산입범위 고지의 시각적 강조, breakdown "라벨=값" 형식, 기준 연도 표기)는 코드 리딩으로
  전부 구현 확인됨.
- `docs/DESIGN_SYSTEM.md` "입력 라벨·순서"(일상어 라벨, helpText에 법령 용어, 용어 통일,
  필드 수 최소화) 기준 위반 없음.
- Medium 2건(Q7 설명 위치, Q8/Q16 이중 배지 모순)은 `docs/EVALUATION.md` "Issue 등급"
  정의상 "일부 UX 문제, 설명 부족"에 해당하며 PASS 기준(총점·Critical/High 0)을 막지
  않는다. 다만 **Q7은 이번 평가가 명시적으로 핵심 리스크로 지목한 항목이므로, QA 통과와
  무관하게 다음 Optimizer 라운드에서 우선 반영할 것을 강하게 권고한다** — 계산 자체는 이미
  정확하다고 검증됐지만(Calculation Auditor PASS), "왜 다른 숫자가 나오는지"를 결과 화면
  상단 가까이에서 즉시 안심시키지 못하면 이 계산기의 신뢰도가 실사용자 사이에서 불필요하게
  훼손될 수 있다.
- Low 3건(Q11, Q14, Q17)은 선택적 개선 사항으로 남긴다.

**QA 단계로 진행 가능.** Optimizer 라운드에서 Medium 2건(특히 Q7)을 우선 반영하고,
Calculation Auditor가 이미 남긴 Low(조문 제목 오기, Q17에서 "실제 화면 텍스트"로 재확인)도
함께 정리할 것을 권고한다.

---

## Optimizer

**작업일**: 2026-09-14
**작업 범위**: UX/UI Critic 절이 남긴 Medium 2건 + Low 1건(Q17)을 문구·배치만으로 수정했다.
계산 로직(`logic.ts`/`types.ts`/반올림 정책)은 이번 라운드 지시대로 전혀 건드리지 않았다 —
Calculation Auditor가 이미 v2로 PASS했기 때문이다. Low 2건 중 Q11(소수 밀도)·Q14(아이콘)은
지시문이 "여력이 되면"이라 명시한 선택 항목이라 이번 라운드에서는 보류했다(하우스 스타일
범위 내로 이미 판정됨, 별도 회귀 위험을 만들지 않기 위해 최소 변경 원칙을 지켰다).

### 1) [Medium, Q7] "약 209시간 vs 208.57시간" 설명을 핵심 결과 카드 근처로 이동

- `src/calculators/minimum-wage-calculator/content.ts`에 `MINIMUM_WAGE_HOURS_HINT` 상수를
  신규 추가했다. 새로운 법적 주장을 만들지 않고, FAQ 1번 답변("계산이 틀린 것이 아니라,
  반올림 시점을 정부의 실제 판정 도구에 맞춘 결과")과 소개 문단(`MINIMUM_WAGE_INTRO_PARAGRAPHS`)
  의 핵심 문장을 한 줄로 축약해 인용했다.
- `src/calculators/minimum-wage-calculator/ui.tsx`의 핵심 결과 카드(널리 알려진
  "2,156,880원"과 다른 "월 환산 {minWageMonthlyEquivalent}원"이 사용자 눈에 처음 들어오는
  자리, 기존 "{appliedRateYear}년 최저임금 시간당 ... 기준으로 비교합니다" 문장 바로 아래)에
  `text-xs italic opacity-70` 수준의 보조 캡션으로 이 문구를 추가했다(카드 레이아웃·폰트
  크기·배지 구조는 변경하지 않음 — 결과 카드가 복잡해지지 않도록 캡션 한 줄만 추가).
- 계산값·필드는 전혀 건드리지 않았다. `formatWon`/`formatHours` 호출부, `result` 필드 접근
  방식 모두 기존 그대로다.

### 2) [Medium, Q8/Q16] 이중 배지 모순 안내를 두 배지 직후로 이동 + 시각적으로 강조

- `judgmentMismatchNotice`가 렌더링되던 위치를 "시급·월급 비교" 카드 안에서 캡션
  문단("월급 비교는 주 ... 기준 월 환산 최저임금과 비교한 것입니다") **뒤**에서 시급·월급
  두 배지가 있는 `<dl>` **직후**로 옮겼다 — Critic이 명시한 "두 배지 사이(또는 그 직후)"
  요건을 그대로 따랐다.
- 스타일을 `border-border bg-surface-subtle text-muted`(다른 무채색 안내와 구분 안 됨)에서
  `border-primary/30 bg-primary-soft text-zinc-700`(라이트) /
  `dark:border-primary/25 dark:text-zinc-300`(다크)로 바꾸고, 원형 정보(`i`) 아이콘을
  `text-primary` 색으로 함께 배치했다 — 아래쪽의 주황색 "미충족 경고 카드"(경고 아이콘,
  `bg-warning-surface`)와 색·아이콘이 뚜렷이 구분되어 "이건 오류/경고가 아니라 반올림
  손실에 대한 참고 설명"이라는 것이 한눈에 보이도록 했다. 이 카드 스타일은 이 계산기의
  기존 "최저임금 산입범위 안내" 섹션(`border-primary/30 bg-primary-soft`)과 동일한 톤을
  재사용해 새로운 색상 토큰을 도입하지 않았다.
- `SectionIcon` 컴포넌트에 `"info"` 키(원형 `i` 아이콘, 기존 `warning`의 삼각형 느낌표
  아이콘과 형태로 구분됨)를 추가했다 — 이 계산기 파일 로컬 컴포넌트이며 다른 계산기에
  영향을 주지 않는다.
- 판정 로직(`minimumWageJudgmentMismatch`, `hourlyMeetsMinimumWage`,
  `monthlyMeetsMinimumWage`)과 안내 문구 텍스트(`buildJudgmentMismatchNotice`) 자체는
  전혀 변경하지 않았다 — 오직 배치·강조 방식만 조정했다(지시 범위 그대로).

### 3) [Low, Q17/Calculation Auditor 항목 1] 법령 조문 제목 오기 정정

- `src/calculators/minimum-wage-calculator/content.ts`의
  `MINIMUM_WAGE_POLICY_NOTICES[0]`에서 "시행령 제5조(임금의 시간급 환산)"를 "시행령
  제5조(최저임금의 적용을 위한 임금의 환산)"으로 정정했다 — Calculation Auditor가
  law.go.kr Open API(`MST=206564`)로 확인한 정부 원문 제목 그대로다. 이 문자열은 UX/UI
  Critic이 Q17에서 확인한 대로 실제 화면(정책 고지 섹션, `ui.tsx`가 이 배열을 그대로
  `.map()`해 렌더링)에 노출되는 텍스트다.

### 보류한 항목(지시문상 선택 사항)

- Q11(breakdown 소수 밀도)·Q14(아이콘 "trend" 재검토): 지시문이 "여력이 되면 처리하고,
  아니면 건너뛰어도 된다(하우스 스타일 범위 내라고 이미 판정됨)"고 명시한 선택 항목이다.
  이번 라운드는 Medium 2건 + Low 1건(필수 정정)에 집중하고, 회귀 위험을 늘리지 않기 위해
  두 항목은 그대로 두었다 — 다음 Optimizer 라운드에서 UX/UI Critic이 재차 지적하면 그때
  처리한다.
- Calculation Auditor Low 항목 4("`calculateMinimumWageComparison`에 JSDoc 경고 추가")는
  이번 UX/UI Critic 보고서가 재확인 항목으로 넘기지 않았고, 이번 지시문의 수정 범위(문구/
  배치)에도 포함되지 않아 손대지 않았다.

### 완료 조건 재확인

- `npx tsc --noEmit` — 오류 없음.
- `npx vitest run src/calculators/minimum-wage-calculator --no-file-parallelism` — 4개
  파일, 76개 테스트 전부 통과(수정 전과 동일한 개수 — 로직 변경이 없으므로 Golden Test
  기대값도 전혀 바뀌지 않았음을 재확인).
- `npx vitest run --no-file-parallelism`(전체 스위트) — **90개 파일, 1,275개 테스트 전부
  통과**(회귀 없음).
- `npx eslint src/calculators/minimum-wage-calculator` — 오류·경고 0건.
- `npm run build`(Next.js 16, Turbopack) — 성공(정적 페이지 39개 생성).

### 다음 단계

이 문서는 다음 라운드에서 UX/UI Critic이 Q7·Q8/Q16·Q17 수정 결과를 재검증하고, 통과하면
QA로 넘어가는 것을 전제로 작성했다 — Optimizer가 직접 재검증 단계를 수행하지 않는다
(docs/EVALUATION.md 개선 Loop).

---

## UX/UI Critic (재검증)

**검토일**: 2026-09-14
**검토 방법**: (1) 위 "UX/UI Critic"(1차 판정, Q1~Q17)과 "Optimizer" 절 코드 리딩으로 수정
범위·의도 확인. (2) 실제 코드 `src/calculators/minimum-wage-calculator/{ui.tsx,content.ts,
formatting.ts,logic.ts,types.ts,validation.ts}` 전체를 다시 읽어 Optimizer가 보고한 수정이
실제로 반영됐는지 라인 단위로 대조. (3) `Grep`으로 프로젝트 전역의 `SectionIcon`/`Icon`
"info"/"warning" 아이콘 관례(weekly-holiday-allowance, unemployment-benefit, housing-
acquisition-tax, national-pension-benefit-estimate, bmr-calculator, annual-leave-allowance
등 15개 이상 계산기)와 `bg-primary-soft`/`border-primary/30` 톤 사용례를 대조해 이번
추가가 "새로운 패턴 발명"이 아니라 "기존 하우스 스타일 재사용"인지 확인. (4) `docs/
DESIGN_SYSTEM.md` "입력 라벨·순서"/"카드·표면 패턴"/"아이콘" 절과 재대조. Edit 권한이 없어
코드를 수정하지 않았다. 실행형 검증(vitest 재실행, 브라우저 렌더링)은 이 역할의 권한 밖이며
Calculation Auditor·QA가 이미 수행했거나 수행할 몫이다 — 아래 판정은 코드 리딩에 근거한다.

### 자체 평가 질문 (14개, 7개 평가 항목 전부 커버, 필수 질문 포함) — 재검증 관점

| # | 질문 | 대응 평가 항목 | 필수 질문 |
|---|---|---|---|
| R1 | [필수] Optimizer가 손댄 범위(content.ts/ui.tsx 결과 화면)가 기존 입력 라벨·placeholder·helpText를 변경하지 않았는가? 새로 노출된 문구가 법령·전문 용어를 라벨처럼 쓰지 않는가? | 입력 라벨 표현 | **필수** |
| R2 | [필수] 입력 폼(모드 토글 → 금액 → 주 근무시간)의 순서·그룹핑이 이번 라운드에서 변경되지 않았는가? | 입력 순서·그룹핑 | **필수** |
| R3 | [필수] 새로 추가된 캡션(`MINIMUM_WAGE_HOURS_HINT`)과 재배치된 안내(`judgmentMismatchNotice`)가 기존 용어(시급/월급/환산값/입력값/최저임금 이상·미만)와 충돌 없이 통일되어 있는가? | 용어 통일 | **필수** |
| R4 | [필수] 이번 수정이 입력 필드 개수(모드+금액+주근무시간=3개)에 영향을 주지 않았는가? | 입력 필드 최소화 | **필수** |
| R5 | (Medium 1 재검증) `MINIMUM_WAGE_HOURS_HINT`가 실제로 핵심 결과 카드 안, "놀라운 숫자"(월 환산 최저임금)가 처음 등장하는 지점 근처에 렌더링되는가? FAQ/소개로 자연스럽게 유도하는가? | 결과 가독성 / 계산 근거 이해 | |
| R6 | (Medium 2 재검증 — 위치) `judgmentMismatchNotice`가 실제로 두 배지(`<dl>`) 직후로 이동했는가? | 계산 근거 이해 | |
| R7 | (Medium 2 재검증 — 아이콘) 새 `info` 아이콘이 기존 `warning`(삼각형) 아이콘과 시각적으로 명확히 구분되는가? 사이트 전역의 info/warning 아이콘 관례와 일치하는가? | 불필요한 UI 요소 여부 / 일관성 | |
| R8 | (Medium 2 재검증 — 톤) `bg-primary-soft`/`border-primary/30` 스타일이 같은 계산기의 "최저임금 산입범위 안내" 카드 및 다른 계산기의 "정책 안내"류 카드와 일관되는가? | 결과 가독성 | |
| R9 | (Low 재검증) `content.ts`의 법령 조문 제목이 정부 원문("최저임금의 적용을 위한 임금의 환산")으로 정확히 수정됐는가? | 계산 근거/정확성(참고용) | |
| R10 | `logic.ts`/`types.ts`가 이번 라운드에서 실제로 변경되지 않았는가? 화면에 표시되는 v2 Golden Test 값(208.57시간, 2,152,442원 등)이 Calculation Auditor(v2 재검증) PASS 시점 값과 일치하는가? | 계산 근거 이해 | |
| R11 | 새 `SectionIcon` "info" 키가 다른 계산기의 로컬 아이콘 컴포넌트와 충돌하거나 코드 품질 문제를 일으키는가? | 불필요한 UI 요소 여부 | |
| R12 | 새로 추가된 캡션(hero 카드 내 italic 텍스트)과 info 박스가 좁은 화면(모바일)에서 레이아웃이 깨지지 않는가? | 모바일 사용성 | |
| R13 | `MINIMUM_WAGE_HOURS_HINT` 문구 자체가 계산법을 몰라도 이해할 수 있는 평이한 문장인가? | 계산법을 몰라도 사용 가능한지 | |
| R14 | 이번 변경이 기존 오류 메시지(`validation.ts`)나 오류 처리 흐름에 영향을 주지 않았는가(회귀 없음)? | 오류 메시지 이해 용이성 | |

---

### 답변 및 등급

**R1. [필수] 라벨·전문용어 회귀 여부 — 문제없음**
`ui.tsx`의 `amountField`(시급/월급 라벨·placeholder, 227~241행), `weeklyHours` 라벨·
helpText(354~379행)를 1차 판정 시점과 대조한 결과 한 글자도 바뀌지 않았다. Optimizer의
수정은 결과 화면(핵심 결과 카드, 시급·월급 비교 카드, 정책 고지 배열)에만 있었다(작업
범위 자체가 "문구·배치"로 한정됨, Optimizer 절 명시). 새로 노출된 `MINIMUM_WAGE_HOURS_HINT`/
`judgmentMismatchNotice`도 입력 라벨이 아니라 결과 설명 텍스트이므로 이 항목과 무관하다.
**등급: 문제없음.**

**R2. [필수] 입력 순서·그룹핑 회귀 여부 — 문제없음**
`ui.tsx` 283~386행(계산 방향 → 금액 → 주 근무시간)의 마크업 구조가 1차 판정 때와 동일하다.
Optimizer는 이 구간을 전혀 건드리지 않았다(수정 파일 목록에 폼 섹션 관련 diff 없음).
**등급: 문제없음.**

**R3. [필수] 신규/재배치 문구의 용어 일관성 — 문제없음**
`MINIMUM_WAGE_HOURS_HINT`는 "시급/월급/최저임금" 같은 기존 용어를 새로 발명하지 않고
FAQ 1번 답변("계산이 틀린 것이 아니라... 정부의 실제 최저임금 판정 방식에 맞춘 결과")의
핵심 문장을 그대로 축약 인용한다("계산이 틀린 것이 아니라, 월 환산 시간을 반올림하지 않는
고용노동부의 실제 최저임금 판정 방식에 맞춘 결과입니다"). `judgmentMismatchNotice`의 실제
문구(`formatting.ts`의 `buildJudgmentMismatchNotice`)는 이번 라운드에 전혀 수정되지
않았음을 확인했다("시급 기준 판정과 월급 기준 판정이 서로 다르게 나왔습니다..." — Optimizer
절이 "판정 로직·문구 자체는 변경하지 않았다"고 명시한 그대로). 두 문구 모두 "시급"/"월급"/
"최저임금"/"환산" 용어를 폼·결과 다른 곳과 동일하게 사용한다. **등급: 문제없음.**

**R4. [필수] 입력 필드 수 회귀 여부 — 문제없음**
모드(1) + 금액(1, 모드별 배타) + 주 근무시간(1, 선택) = 3개 그대로다. Optimizer의 변경은
결과 화면에 국한되어 입력 필드 수·구성에 전혀 영향을 주지 않았다. **등급: 문제없음.**

**R5. Medium 1 재검증 — 해결 확인**
`ui.tsx` 448~466행을 직접 대조했다:
```
448  <p ...>{formatWon(convertedMonthlyPay 또는 convertedHourlyWage)}</p>   // 큰 숫자
453  <p ...>직접 입력한 값이 아니라 계산된 환산값입니다.</p>
456~460  <p ...>{appliedRateYear}년 최저임금 시간당 {minWageHourly} · 월 환산
         {minWageMonthlyEquivalent}({weeklyHours} 기준) 기준으로 비교합니다.</p>
464~466  <p className="mt-2 text-xs italic ...">{MINIMUM_WAGE_HOURS_HINT}</p>
```
"놀라운 숫자"(널리 알려진 2,156,880원과 다른 `minWageMonthlyEquivalent`, 예: 2,152,442원)가
문장으로 처음 등장하는 자리(456~460행) 바로 다음 줄에 캡션이 붙는다 — 1차 판정 Q7이
요구한 "숫자가 처음 등장하는 지점 가까이"를 정확히 만족한다. 캡션 텍스트 자체도 "왜 흔히
알려진 '약 209시간·2,156,880원'과 다른가요? 계산이 틀린 것이 아니라... 아래 소개와 자주
묻는 질문에서 자세히 설명합니다"로 끝나, 명시적으로 아래 IntroSection·FAQ로 시선을
유도한다 — Q7이 제시한 두 대안("인라인 캡션 또는 FAQ 앵커 링크") 중 캡션 방식을 정확히
택해 반영했다. 클릭 가능한 `<a href="#faq">` 앵커는 아니지만, Q7 권고 문구 자체가 "인라인
캡션 **또는** FAQ 앵커 링크"라고 양자택일로 제시했으므로 이는 권고 불이행이 아니다.
**등급: 문제없음(Medium 1 해결 확인).**

**R6. Medium 2 재검증(위치) — 해결 확인**
`ui.tsx` 470~509행을 직접 대조했다:
```
471~492  <dl ...> (시급 행 + 월급 행, 각 행에 ValueSourceBadge + MeetsBadge) </dl>
497~504  {judgmentMismatchNotice && (<div ...>...</div>)}
505~508  <p>월급 비교는 주 {…} 기준 월 환산 최저임금(…)과 비교한 것입니다.</p>
```
`judgmentMismatchNotice` 블록이 `</dl>`(492행) 바로 다음, 기존 캡션 문단(505행) 이전으로
정확히 옮겨졌다 — 1차 판정 Q8/Q16이 지목한 "두 배지가 다른 판정을 보여줄 수 있는 바로 그
지점(두 배지 직후)"에 정확히 위치한다. **등급: 문제없음(위치 요건 해결 확인).**

**R7. Medium 2 재검증(아이콘 구분) — 문제없음, 오히려 하우스 스타일과의 정합성이 강화됨**
`ui.tsx` 85~113행의 `SectionIcon`에서 `warning`(삼각형+느낌표, `M10.29 3.86 1.82 18a2 2 0
0 0 1.71 3h16.94...`)과 `info`(원+세로선+점, `M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12
11v5M12 8h.01`)는 형태가 뚜렷이 다르다. `Grep`으로 프로젝트 전역을 조사한 결과, 동일한
"info=원형, warning=삼각형" 2분류 관례가 `weekly-holiday-allowance`, `unemployment-
benefit`, `housing-acquisition-tax`, `national-pension-benefit-estimate` 등 최소 4개
계산기에 이미 존재하고, `bmr-calculator`/`annual-leave-allowance`/`average-cost-calculator`/
`d-day-calculator`/`loan-interest-calculator`/`bill-split-calculator`/`housing-subscription-
score`/`bmi-calculator`/`age-calculator`/`military-salary`/`parental-leave-benefit` 등
11개 이상 계산기가 "info" 원형 아이콘만 단독으로도 쓴다 — 이번 추가는 새로운 시각 언어를
발명한 것이 아니라 **이미 15개 이상의 계산기가 쓰는 확립된 하우스 컨벤션을 그대로 재사용**한
것이다. 실제로 `weekly-holiday-allowance/ui.tsx`(133~147행)는 이 계산기와 똑같이 `info`/
`warning` 두 키를 한 파일 안에 함께 쓰며 "두 경고 카드 2종 구분용"이라는 동일한 목적의
주석을 달아 뒀다 — 이 계산기의 용도(경고 아님을 구분)와 정확히 같은 선례다. **등급:
문제없음.** (참고: `info` 아이콘의 SVG path 좌표 값 자체는 다른 파일과 한 자도 다르지 않게
복사된 것은 아니지만 — 각 파일이 각자 로컬로 "원+세로선+점" 모양을 독립적으로 그린
것 — 이는 이 프로젝트가 공용 아이콘 컴포넌트를 두지 않고 파일마다 로컬 `SectionIcon`/`Icon`을
독립 정의하는 기존 관례 자체이며, `docs/DESIGN_SYSTEM.md` "아이콘" 절도 "새 아이콘이
필요하면 같은 stroke 스타일의 SVG를 직접 추가한다"고 명시해 이 방식을 허용한다 — 새로운
결함이 아니다.)

**R8. Medium 2 재검증(톤 일관성) — 문제없음**
새 `judgmentMismatchNotice` 박스(`ui.tsx` 498행, `border-primary/30 bg-primary-soft`)는
같은 파일 577행의 "최저임금 산입범위 안내" 카드(`border-primary/30 bg-primary-soft`)와
완전히 동일한 톤 조합을 재사용한다. `Grep` 결과 `bmr-calculator/ui.tsx`(433행)도 같은
`border-primary/30 bg-primary-soft` 조합을 "정책/설명" 톤으로 쓴다 — 이 계산기만의 임의
색상이 아니라 사이트에 이미 존재하는 "경고(주황, `bg-warning-surface`)와 대비되는
참고 설명(파랑/프라이머리, `bg-primary-soft`)" 2분류 색 체계를 그대로 따른다. `docs/
DESIGN_SYSTEM.md` "디자인 토큰" 표의 `bg-primary-soft`("강조 텍스트... 아이콘 배지 배경")
정의와도 부합한다. **등급: 문제없음.**

**R9. Low 재검증 — 해결 확인**
`content.ts` 26행을 직접 읽은 결과: `"이 계산은 최저임금법 제5조·제6조, 같은 법 시행령
제5조(최저임금의 적용을 위한 임금의 환산)를 근거로 합니다."` — Calculation Auditor가
law.go.kr Open API로 확보한 정부 원문 제목("제5조(최저임금의 적용을 위한 임금의 환산)")과
자구 하나까지 정확히 일치한다. `Grep`으로 "임금의 시간급 환산"(구 오기 문구)이 이
계산기 디렉터리 어디에도 더 이상 남아있지 않음을 확인했다. **등급: 문제없음(Low 해결
확인).**

**R10. 계산 로직 불변 확인 — 문제없음**
`logic.ts`(279행 전체)와 `types.ts`(239행 전체)를 다시 읽어 Calculation Auditor(v2
재검증)가 PASS 판정한 시점의 서술(round2 헬퍼, `minWageMonthlyEquivalent`의 명시적
`Math.round`, `minimumWageJudgmentMismatch` 파생 필드, raw/display 분리 주석 등)과 문장
단위로 대조한 결과 **차이가 없다** — Optimizer 절이 "계산 로직은 전혀 건드리지 않았다"고
밝힌 것과 정확히 일치한다. `content.ts`에 새로 추가된 `MINIMUM_WAGE_HOURS_HINT`가 인용하는
구체적 수치(예: "약 2,152,442원", "4,438원 정도 차이")도 Calculation Auditor(v2 재검증)가
독립 재계산으로 이미 확인한 A1 값(M=208.57, `minWageMonthlyEquivalent=2,152,442`,
`2,156,880−2,152,442=4,438`)과 정확히 일치한다 — 새 문구가 계산값과 어긋나는 새로운
오류를 만들지 않았다. (이 역할은 vitest를 직접 재실행할 권한/도구가 없어 "76개 테스트
전부 통과"라는 Optimizer의 실행 결과 자체는 코드 리딩만으로 재확인하지 못했으나, 코드
내용이 문자 그대로 동일하므로 테스트 결과가 달라질 이유가 없다.) **등급: 문제없음.**

**R11. `SectionIcon` "info" 키의 충돌·코드 품질 — 문제없음**
`SectionIcon`은 `ui.tsx` 파일 내부의 비export 로컬 함수라서 다른 계산기 파일의 동명 로컬
컴포넌트와 애초에 같은 모듈 스코프를 공유하지 않는다(`Grep` 결과 최소 15개 계산기가 각자
파일-로컬 `SectionIcon`/`Icon`을 독립적으로 정의하고 있음을 재확인했다) — 이는 이 코드베이스
전반의 의도된 아키텍처(공용 아이콘 컴포넌트를 두지 않음)이며, 이번 "info" 키 추가가 이
관례를 깨거나 새로운 충돌 위험을 만들지 않는다. `paths` 객체에 키를 하나 추가하고 `name`
유니온 타입에 `"info"`를 포함시킨 변경은 기존 `warning`/`chart`/`document`/`formula`
분기와 동일한 패턴을 따른다(타입 안전성 유지, 사용하지 않는 브랜치 없음). **등급:
문제없음.**

**R12. 모바일 레이아웃 영향(코드 리딩 기준) — 문제없음**
새 캡션(`ui.tsx` 464~466행)은 폭 제약이 있는 hero 카드(`p-6 sm:p-8`) 안의 평범한 `<p>`
요소로 `text-xs` 텍스트가 자연스럽게 줄바꿈된다(고정 너비·`whitespace-nowrap` 없음). 새
`judgmentMismatchNotice` 박스(497~504행)는 `flex items-start gap-2.5 ... p-3`로, 아이콘에
`shrink-0`을 줘 좁은 화면에서 아이콘이 찌그러지지 않고 텍스트만 자연스럽게 줄바꿈되도록
했다 — 바로 아래의 기존 "미충족 경고 카드"(514행 이하)와 동일한 flex 패턴을 재사용한
구조라 이미 검증된 반응형 동작과 같다. 고정 폭·가로 스크롤 유발 요소는 발견되지 않았다.
**등급: 문제없음(코드 리딩 기준) — 실기기 확인은 QA 권고, 1차 판정 Q13과 동일한 유보).**

**R13. 신규 캡션의 평이함 — 문제없음(참고 Low)**
`MINIMUM_WAGE_HOURS_HINT` 문구("왜 흔히 알려진 '약 209시간·2,156,880원'과 다른가요? 계산이
틀린 것이 아니라, 월 환산 시간을 반올림하지 않는 고용노동부의 실제 최저임금 판정 방식에
맞춘 결과입니다...")는 법령 조번호나 수식을 쓰지 않고 "계산이 틀린 게 아니다"라는 안심
메시지를 평이하게 전달한다. 다만 이 문구는 "약 209시간·2,156,880원이 널리 알려져 있다"는
것을 사용자가 이미 알고 있다는 전제로 쓰였다 — 그 숫자를 한 번도 들어본 적 없는 완전
초심자에게는 "묻지도 않은 질문에 먼저 답하는" 것처럼 다소 뜬금없게 느껴질 수 있다. 그러나
이는 Q7이 이미 "이 계산기가 명시적으로 선제 대응해야 할 핵심 리스크"로 지목한 사용자군
(기존에 "약 209시간"을 알고 있는 사용자)을 위한 의도된 설계이고, 모르는 사용자에게는
읽지 않아도 무방한 부가 정보이므로 실질적 해가 되지 않는다. **등급: 문제없음(선택적 톤
개선 여지만 Low로 참고).**

**R14. 오류 메시지·검증 로직 회귀 여부 — 문제없음**
`validation.ts`(244행 전체)를 다시 읽어 1차 판정 Q15가 확인한 오류 메시지 문구(조사 자동
교정, 상한/하한 설명 등)와 완전히 동일함을 확인했다 — Optimizer의 수정 파일 목록(content.ts,
ui.tsx)에 `validation.ts`가 포함되지 않았고, 실제 파일 내용도 결과 화면 변경과 무관하게
그대로다. **등급: 문제없음.**

---

### 발견 이슈 등급별 표 (재검증 라운드)

| 등급 | 항목 | 요약 |
|---|---|---|
| Critical | 없음 | — |
| High | 없음 | — |
| Medium | 없음(전부 해결 확인) | 1차 Medium 2건(Q7 설명 위치, Q8/Q16 이중 배지 안내 배치·구분) 모두 Optimizer 수정 사항이 코드에 정확히 반영됨을 확인했다(R5, R6, R7, R8) |
| Low | 없음(정정 대상 해결 확인) | 1차 Low 중 Q17(법령 조문 제목 오기)이 정확히 수정됨을 확인했다(R9) |
| Low(참고, 선택적, 신규 아님) | R13 | `MINIMUM_WAGE_HOURS_HINT`가 "약 209시간"을 모르는 초심자에게는 다소 맥락 없이 느껴질 수 있음(실질적 해는 없음, 선택적 톤 개선) |
| Low(참고, 이번 라운드 지시 대상 아님) | 1차 Q11/Q14 | breakdown 소수 밀도, 아이콘("trend") — Optimizer가 "선택 사항"으로 명시적으로 보류, 이번 재검증 범위 밖 |

---

### 최종 판정: **PASS (재검증 통과)**

- **Medium 2건 모두 실제 코드에서 해결이 확인됐다.** Q7("208.57시간" 설명 위치)은 핵심
  결과 카드 안, 놀라운 숫자가 처음 등장하는 문장 바로 다음 줄에 캡션이 추가되어 FAQ/소개로
  시선을 유도한다(R5). Q8/Q16(이중 배지 모순 안내)은 두 배지(`<dl>`) 직후로 정확히
  재배치되었고, 새 `info` 원형 아이콘이 기존 `warning` 삼각형 아이콘·주황 경고 카드와
  색·형태 모두 뚜렷이 구분되며, 이 구분법(`info` 원형 vs `warning` 삼각형, `bg-primary-soft`
  vs `bg-warning-surface`)은 이 사이트에 이미 15개 이상 계산기가 쓰는 확립된 하우스
  컨벤션과 정확히 일치한다(R6, R7, R8).
- **Low 1건(법령 조문 제목 오기)도 정부 원문과 자구 단위로 일치하도록 정정됨을 확인했다**
  (R9).
- **새로운 문제를 만들지 않았다.** 입력 라벨·순서·용어 통일·필드 수(4개 필수 질문 R1~R4)
  모두 이번 수정의 영향을 받지 않고 그대로 유지된다. `logic.ts`/`types.ts`는 문자 그대로
  변경되지 않았고, 새 문구가 인용하는 수치도 이미 Calculation Auditor(v2 재검증)가 검증한
  값과 정확히 일치한다(R10). 새 아이콘 키는 로컬 스코프라 충돌 위험이 없고 기존 코드
  패턴을 그대로 따른다(R11). 모바일 레이아웃에 영향을 줄 만한 고정 폭/오버플로 요소도
  발견되지 않았다(R12). 오류 메시지·검증 로직도 완전히 그대로다(R14).
- 남은 항목은 전부 **선택적(Low, 신규 아님)**이며 이전 라운드에서 이미 "지시문상 선택
  사항"으로 명시적으로 보류된 것들이다(1차 Q11 breakdown 소수 밀도, Q14 아이콘 "trend") —
  이번 재검증 지시 범위에도 포함되지 않았으므로 PASS 판정에 영향을 주지 않는다.

**Critical 0, High 0, Medium 0(모두 해결 확인), Low 0(수정 대상 전부 해결) — `docs/
EVALUATION.md` PASS 기준을 충족한다. QA 단계로 진행 가능.**

---

## QA

**검증일 2026-09-15. 판정: PASS.** 상세 보고서는 `tasks/minimum-wage-calculator/QA.md` 참고.
기존에 떠 있던 dev 서버(D:\유틸\cal, 3000포트)를 재사용하고, 격리된 `--user-data-dir`
프로파일의 Chrome·Edge(CDP)로 실제 브라우저 테스트를 진행했다(사용자 실제 브라우저·다른
프로젝트 dev 서버는 전혀 건드리지 않음, 세션 전용 프로파일 프로세스만 확인 후 종료). FORMULA.md
v2의 골든 테스트 대표 사례(A1: 208.57시간·2,152,442원, B4: 월급 2,154,000원 moel.go.kr 반례
해소, A1↔B1 왕복, C1: 주 20시간 하드코딩 없음 재계산)가 화면 표시값과 전부 일치했다. Optimizer의
두 핵심 수정(`MINIMUM_WAGE_HOURS_HINT` 캡션, 이중 배지 모순 안내 재배치+info 아이콘)이 실제
렌더링에서 확인됐고, 이중 배지 모순 반례(월급 2,152,400원)도 실제로 재현하되 안내가 정확한
위치에 표시됨을 확인했다(이는 기존에 Medium으로 남긴 설계 트레이드오프의 재확인이지 새 결함이
아니다). 입력 검증(모드 전환 시 필드 초기화, 경계값, 오류 메시지)이 명확하게 동작. 모바일 5개
뷰포트(320~1440px) 오버플로 0건. 접근성 트리에서 라디오 그룹 role/이름/checked 정상(단, CDP
키보드 이벤트 시뮬레이션 자체가 이 세션 환경에서 브라우저에 전달되지 않아 라이브 키보드 종단
테스트는 완료하지 못함 — Low, 환경 한계로 정직하게 기록). **weekly-holiday-allowance 회귀
없음**(이번 라운드에서 `src/lib/labor-standards.ts`로 코드를 공유하도록 리팩터링됐던 계산기,
82,560원 등 정상 재확인) — severance-pay·annual-leave-allowance도 회귀 없음. 신규 발견
Critical/High/Medium 결함 **0건**.

---

## 점수 (오케스트레이터, 2026-09-15)

| 항목 | 배점 | 획득 | 근거 |
|---|---|---|---|
| 계산 정확성 | 35 | **33** | Calculation Auditor가 v1을 "공식 재검토 요청"으로 정확히 반려했다 — 고용노동부 실제 배포 최저임금 모의계산기(`wageResultNew()`)의 JS를 curl로 직접 받아, "정수 209시간 반올림"이 대중 홍보 수치일 뿐 정부의 실시간 판정 로직(소수 둘째 자리 208.57시간)과 다르다는 것을 실제 코드로 증명해낸 것은 이 프로젝트에서도 드문 수준의 발견이다. Formula Analyst가 v2로 재조사·반영했고, v2 재검증에서 `round2` vs `toFixed(2)`를 `weeklyHours` 1~168 전 구간(167만 지점) 부동소수점 스윕으로 불일치 0건 확인, B4 반례 해소, A1↔B1 교차검증까지 전부 재확인했다. 시행령 제5조 원문(law.go.kr Open API)·2024년 산입범위 부칙 원문도 1차 확인 완료. 잔여 리스크(이중 배지 모순이 산술적으로 남아있음 — 다만 계산 오류가 아니라 반올림 손실에 따른 구조적 현상으로 이해 확인됨, 비표준 근무시간에 대한 정부의 명시적 반올림 관행 예시 부재)로 −2. |
| 예외/경계값 처리 | 15 | **15** | 모드 미선택, 금액 빈값/0/음수/비현실적 큰 값, 주 근무시간 0/음수/168 초과, 극단값(0.096→0.00096 미만 붕괴 방어) 전부 코드·QA 실측 양쪽으로 확인. 모드 전환 시 필드 초기화(체이닝 방지)까지 포함. |
| UX/사용 편의성 | 15 | **14** | UX/UI Critic 1차 PASS(Medium 2건 자발적 개선 권고) → Optimizer 반영 → 재검증 PASS(신규 이슈 0건). 이 계산기 고유의 신뢰도 리스크("대중이 아는 209시간과 다르다")를 핵심 결과 카드 근처 캡션 + FAQ/소개 3중 설명으로 해소했고, 이중 배지 모순도 시각적으로 명확히 구분되는 info 카드로 안내했다. 잔여 Low(breakdown 소수 밀도 등 하우스 스타일 범위 내)로 −1. |
| 모바일/반응형 | 10 | **10** | QA가 CDP로 320/375/390/768/1440px 5개 뷰포트 실측, 모드 토글·2개 입력 필드·이중 배지 안내 카드 전부 오버플로 없음 확인. |
| 접근성 | 5 | **4** | 라디오 그룹 role/이름/checked/focusable 접근성 트리로 실측 확인, aria-describedby/aria-invalid 정상 연결. CDP 키보드 이벤트 시뮬레이션이 이 세션 환경에서 전달되지 않아 라이브 키보드 종단 테스트를 완료하지 못해 −1(환경 한계, 코드 자체의 결함 아님). |
| 성능/안정성 | 5 | **5** | Console Error 0건, `npx tsc --noEmit` 클린, 이 계산기 76개 테스트 통과(전체 스위트 90파일/1275테스트, weekly-holiday-allowance 리팩터링 포함 회귀 없음). |
| 설명/계산 근거 | 5 | **5** | 입력값→월 환산 시간 산출→환산식→비교식까지 각 단계 실제 수식·숫자를 노출하고, 이 계산기의 가장 까다로운 신뢰도 문제("왜 209시간이 아닌가")를 핵심 카드 캡션+FAQ+소개 문구 3중으로 설명. |
| SEO/페이지 완성도 | 5 | **5** | registry 등록(`status: draft`→이번에 `published`로 전환), 카테고리 말머리 링크(`/categories/labor`), FAQPage JSON-LD 매핑, `app/calculators/[slug]/page.tsx` 배선 완료. |
| 코드 품질/유지보수성 | 5 | **5** | weekly-holiday-allowance와 주휴시간 산식을 `src/lib/labor-standards.ts`로 공유 추출(동일 법적 정의를 공유하는 순수 계산이라는 명확한 기준 적용), 모드별 함수 분리로 "환산값 재입력 금지" 설계 제약을 코드 구조로 강제, raw/display 분리 원칙을 v2 반올림 정책 변경에도 일관되게 유지. |
| **총점** | 100 | **96** | |

## 최종 판정

PASS 기준(docs/EVALUATION.md): 총점 92+, 계산정확성 33/35+, Critical 0, High 0, Golden Test 100%, Console/TS Error 0, Mobile Critical 0

| 기준 | 결과 |
|---|---|
| 총점 92+ | 96 ✅ |
| 계산 정확성 33/35+ | 33 ✅ |
| Critical 0 / High 0 | Auditor 1차 "공식 재검토 요청"(v1) → Formula Analyst v2 개정 → Architect/Builder v2 재구현 → Auditor v2 재검증 PASS(0) · UX Critic PASS(Medium 2건 자발 개선) → Optimizer 반영 → 재검증 PASS(0) · QA PASS(0) ✅ |
| Golden Test 100% | 20/20(Auditor v2 독립 재계산 + moel.go.kr 실제 배포 JS 라이브 대조) + 대표 사례 QA 실제 UI 재현 ✅ |
| Console Error 0 / TypeScript Error 0 | ✅ (실제 headless 브라우저 실측 포함) |
| Mobile Critical 0 | ✅ (실제 Chrome/Edge 5개 breakpoint 실측) |

**판정: PASS — registry.ts `status`를 `published`로 전환한다.**
개선 Loop 횟수: 2/5 (1차: Calculation Auditor의 "공식 재검토 요청"(월 환산 시간 반올림 정책이 정부 실제 판정 도구와 불일치, v1→v2 전면 개정) 처리 — 재검증 PASS, 2차: UX/UI Critic의 Medium 2건(핵심 신뢰도 설명 위치, 이중 배지 모순 안내) 처리 — 재검증 PASS)

### 남은 후속 과제 (발행 비차단, 전부 Low 이하)
- 이중 배지(`hourlyMeetsMinimumWage`/`monthlyMeetsMinimumWage`) 모순 구간이 v2 정책으로도 완전히 해소되지 않는다 — 월급 모드에서 원 단위 반올림 손실로 인해 시급 기준 판정과 월급 기준 판정이 서로 다르게 나오는 좁은 구간(주 40시간 기준 약 103개 정수 월급값)이 수학적으로 항상 존재한다. `minimumWageJudgmentMismatch` 안내로 사용자에게 이유를 설명하고 있으나, 근본적으로 판정 방식 자체를 재설계(예: 시급 기준 판정을 단일 진실로 채택)하지 않는 한 구조적으로 남는 현상이다.
- 최저임금법 시행령 제5조가 40시간이 아닌 비표준 근무시간(20시간, 30시간 등)에도 "정수가 아닌 소수 둘째 자리 반올림"을 실제로 적용한다는 정부의 명시적 예시는 찾지 못했다 — moel.go.kr의 실제 배포 JS(`wageResultNew()`가 `weekTime`을 하드코딩하지 않음)로 강하게 뒷받침되지만, 정부가 이 케이스에 대해 명시적으로 설명한 자료는 없다.
- CDP 기반 키보드 종단(Tab 이동) 라이브 테스트는 이 세션 환경의 구조적 한계로 완료하지 못했다(정적 구조 검증으로 대체, 표준 시맨틱 라디오 그룹이라 위험 낮음).
- 다음 재검토 트리거: `PROGRESS.md`에 기록(2027-01-01 최저임금 연 1회 고시 갱신).
