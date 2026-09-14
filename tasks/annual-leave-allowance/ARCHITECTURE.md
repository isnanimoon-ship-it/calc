# ARCHITECTURE: 연차수당 계산기 (annual-leave-allowance)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-14.
계산 공식 자체(3구간 발생일수 산식, 26일 고정, 25일 상한, 반올림 정책)는 정의하지 않는다
(Formula Analyst 소관) — 이 문서는 그 공식을 "그대로 구현 가능한 구조"로 옮기는 작업만
한다. 다만 조사 과정에서 **"기존 공용 날짜 유틸을 그대로 재사용하면 조용히 틀린 값을 낸다"는
구현 정확성 문제 1건**을 직접 재계산으로 발견했다(아래 "1." — 이 문서에서 가장 먼저, 가장
비중 있게 다룬다).

관련 문서: docs/ARCHITECTURE.md, docs/CALCULATOR_RULES.md, docs/DESIGN_SYSTEM.md.
참고 선례: `tasks/loan-interest-calculator/ARCHITECTURE.md`(판별 유니온 vs 단일 인터페이스
판단 기준, `LoanCalculationBase` 교차 타입 합성 패턴), `tasks/bmr-calculator/ARCHITECTURE.md`
(선택 입력에 따른 결과 일부 생략 — `tdee?` optional 객체 패턴), `tasks/national-pension-
benefit-estimate/ARCHITECTURE.md`(raw/display 분리, "지급대상 아님"에도 공통 필드를 남기는
판단), `tasks/housing-acquisition-tax/ARCHITECTURE.md`(문서 형식, "ineligible 분기가 없는
계산기" 판단 기준), `docs/ARCHITECTURE.md` "결정 사례: 순수 날짜 산술 함수의 공용화 범위
재확인"(age-calculator/housing-subscription-score, 날짜 유틸을 억지로 통합하지 않는 기준).

---

## 0. 레지스트리 상태 확인

`src/calculators/registry.ts`에 `annual-leave-allowance` slug는 아직 등록되어 있지 않다
("연차", "연차수당", "연차계산기" 이름의 계산기도 없음 — SPEC.md "계산기 중복 금지 검토"와
일치). **이번 라운드에서도 등록하지 않는다** — `housing-acquisition-tax`·`d-day-calculator`·
`national-pension-benefit-estimate`·`bmr-calculator` Architect 라운드와 동일한 기존 관례다
(아래 "13." 참고).

이번 라운드에서 실제로 작성/확인한 것:
- `src/calculators/annual-leave-allowance/types.ts`: 신규 작성(아래 "3.", "4.").
- `policy.ts`는 작성하지 않는다(아래 "7." — 이 계산기는 정책형 요소가 최저임금 하나뿐이고,
  그 값은 이미 `rates-2026.json` 최상위에 있어 직접 참조로 충분하다).
- `PROGRESS.md`의 `annual-leave-allowance` 행은 이미 Formula=PASS, Build=TODO, "IN
  PROGRESS"로 정확히 반영돼 있어 수정하지 않는다.
- `npx tsc --noEmit`(클린) · `npx vitest run`(82개 테스트 파일 · 1,109개 테스트 전부 통과,
  기존 계산기 회귀 없음, 아래 "14." 참고).
- 이 문서.

`logic.ts`/`date-utils.ts`/`validation.ts`/`formatting.ts`/`content.ts`/`ui.tsx` 등 실제
구현 파일은 아직 없다(Builder 몫).

---

## 1. 가장 중요한 결정 — `monthAnniversary`/`yearAnniversary`를 새로 작성해야 한다(기존 공용 유틸 재사용 금지)

### 1.1 결론

FORMULA.md가 정의한 `monthAnniversary(H,k)`/`yearAnniversary(H,k)`(원본 날짜 기준 독립
계산 + 명시적 월말/윤년 clamp)는 **이 계산기 전용으로 새로 작성**한다. `src/lib/date-calc.ts`에
이미 있는, 겉보기에 똑같은 목적처럼 보이는 `calendarFullMonthsBetweenUtc`/
`calendarFullYearsBetweenUtc`를 **재사용하면 안 된다** — 직접 재계산해보니 이 두 기존 함수는
FORMULA.md가 명시적으로 요구하는 clamp 규칙을 구현하지 않고 있고, 그 결과 이 계산기가 가장
신경 써서 다루는 바로 그 경계(월말 29~31일 입사일, 2월 29일 입사일)에서 **조용히 틀린 값**을
낸다.

### 1.2 왜 착각하기 쉬운가

`src/lib/date-calc.ts`는 이미 "완료된 연수/개월수"를 계산하는 함수를 갖고 있다
(`calendarFullYearsBetweenUtc`/`calendarFullMonthsBetweenUtc`, housing-subscription-score
Architect 라운드가 추가). 이름과 시그니처(`(start: Date, end: Date) => number`)만 보면
FORMULA.md의 `completedYears`/`completedMonths`와 정확히 같은 일을 하는 것처럼 보여, Builder가
"이미 있는 걸 왜 또 만드나"라며 그대로 가져다 쓰기 쉽다. 실제로 두 구현의 알고리즘이 다르다.

```
calendarFullYearsBetweenUtc(start, end):
  (start.월,start.일) vs (end.월,end.일) 튜플을 직접 비교해 아직 "생일"이
  안 지났으면 1을 뺀다. — clamp/투영이 전혀 없다.

FORMULA.md의 yearAnniversary(H,k):
  H의 (연+k, 월)로 실제 날짜를 만들고, 그 날짜가 그 달에 존재하지 않으면
  그 달의 마지막 날로 명시적으로 보정(clamp)한 뒤 그 "투영된 날짜" 자체를 R과 비교한다.
```

두 방식은 **H가 월말(29~31일)이거나 2월 29일일 때만** 다른 답을 낸다(그 외 모든 날짜에서는
결과가 동일하다 — 그래서 아래 "1.3"에서 보듯 FORMULA.md가 제공한 17개 검증 예제는 전부
day 1·10·15에 몰려 있어 이 발산을 단 하나도 잡아내지 못한다).

### 1.3 직접 재계산으로 확인한 구체적 발산 사례 (FORMULA.md 17개 예제에는 없음)

**사례 A — 월말 clamp 발산(입사일 1/31, 완료 개월수)**

- Input: `hireDate=2025-01-31`, `referenceDate=2025-02-28`, `usedDays=0`.
- **올바른 계산(`monthAnniversary`, FORMULA.md 정의)**: `monthAnniversary(H,1)` = 2025년
  2월로 이동, 1월 31일은 2월에 없으므로 그 달의 마지막 날인 **2월 28일**로 clamp →
  `2025-02-28`. 이는 `referenceDate`(2025-02-28)와 같으므로 `monthAnniversary(H,1) <= R`은
  **참**이다. `monthAnniversary(H,2)`(2025-03-31)는 R보다 미래라 거짓. →
  **`completedMonths = 1`, `accruedDays = 1`.**
- **`calendarFullMonthsBetweenUtc`를 그대로 재사용했다면**: `end.getUTCDate()`(28) <
  `start.getUTCDate()`(31)이므로 "아직 그달 기념일에 도달하지 않았다"고 판단해 1개월을
  차감 → **`completedMonths = 0`, `accruedDays = 0`.**
- 즉 입사 후 정확히 1개월이 지난(1/31→2/28) 근로자의 연차 발생일수가 **1일 vs 0일**로
  갈린다 — 매월 말일 입사자(달마다 흔한 케이스)에게 실제로 영향을 주는 사례다.

**사례 B — 윤년 2/29 clamp 발산(완료 연수, 훨씬 더 큰 폭)**

- Input: `hireDate=2024-02-29`(윤년), `referenceDate=2025-02-28`, `usedDays=0`.
- **올바른 계산(`yearAnniversary`)**: `yearAnniversary(H,1)` = 2025년 2월로 이동, 29일은
  2025년(평년) 2월에 없으므로 **2월 28일**로 clamp → `2025-02-28`. `referenceDate`와 같아
  참. `yearAnniversary(H,2)`(2026-02-28)는 미래라 거짓. → **`completedYears = 1`**,
  regime = `YEAR_1_TO_2`, **`accruedDays = 26`.**
- **`calendarFullYearsBetweenUtc`를 그대로 재사용했다면**: (월,일) 튜플 비교
  `(1,28) < (1,29)`(0-based 월 인덱스 기준)이므로 1년을 차감 → **`completedYears = 0`**,
  regime이 `UNDER_1YEAR`로 잘못 떨어진다. 이어서 `completedMonths`도 같은 계열의 함수
  (`calendarFullMonthsBetweenUtc`)로 계산하면 11(상한)이 나와 **`accruedDays = 11`.**
- 즉 입사 정확히 1년 뒤(윤년 생일자)의 발생일수가 **26일 vs 11일**로 갈리고, regime 자체가
  통째로 잘못 분류된다 — `unusedLeaveAllowance`까지 계산한다면 금액이 최대 15일치만큼
  차이 난다.

### 1.4 결정과 근거

- **로컬로 새로 작성한다.** `src/calculators/annual-leave-allowance/date-utils.ts`(신규,
  Builder 작성)에 FORMULA.md의 `monthAnniversary`/`yearAnniversary`/`completedMonths`/
  `completedYears` 의사코드를 문자 그대로 옮긴다. `src/lib/date-calc.ts`의 기존
  `calendarFullMonthsBetweenUtc`/`calendarFullYearsBetweenUtc`는 **호출하지 않는다**(단순히
  "안 쓴다"가 아니라 위 1.3의 구체적 반례 때문에 "쓰면 안 된다").
- **"이 함수를 필요로 하는 계산기가 지금 하나뿐이면 로컬로 둔다"는 원칙**(작업 지시,
  docs/ARCHITECTURE.md "결정 사례: 순수 날짜 산술 함수의 공용화 범위 재확인"의 "≥2회
  재사용" 기준과 같은 계열)을 적용한 결과이기도 하지만, 이번 사례는 그보다 더 강한 이유가
  있다 — **같은 파일(`date-calc.ts`) 안에 이름도 비슷하고("완료된 연/개월수") 목적도
  비슷하지만 동작이 다른 함수 두 벌을 나란히 두면, 미래의 어떤 Builder/Architect가 실수로
  잘못된 쪽을 호출할 위험이 이미 존재하는 함수를 재사용하는 것보다 더 크다.** 이는
  `docs/ARCHITECTURE.md`가 age-calculator의 `anniversaryInYear`(clamp 기반)를
  `calendarFullYearsBetweenUtc`(비-clamp 기반)와 통합하지 않기로 한 것과 정확히 같은 계열의
  판단이다 — "설계가 근본적으로 다른 두 구현은 억지로 하나로 합치지 않는다."
- **이미 이 프로젝트에 "월 단위 이동 + clamp" 로직이 최소 2번(각각 다른 계산기에) 독립
  구현되어 있다** — `age-calculator/date-utils.ts`의 `addMonthsFromBase`,
  `parental-leave-benefit/date-utils.ts`의 `addCalendarMonthsClamped`(둘 다 문자열 `Parts`
  기반, 완전히 같은 알고리즘). 이 계산기가 세 번째 독립 구현이 되는 셈이지만, 앞의 두
  계산기 모두 이미 `published`고 자체 Golden Test를 가진 상태라 지금 소급 통합하면 이번
  작업 범위 밖의 회귀 위험을 새로 만든다(housing-subscription-score 라운드가
  age-calculator를 통합하지 않은 것과 동일한 판단, docs/ARCHITECTURE.md "결정 사례: 순수
  날짜 산술 함수의 공용화 범위 재확인" 참고). **이 세 번째 반복이 이미 드리프트 신호이므로,
  향후 네 번째 계산기가 같은 "월/연 anniversary + clamp" 로직을 필요로 하면 그때는
  `src/lib/date-calc.ts`로의 공용화를 최우선으로 재검토할 것을 다음 Architect 라운드에
  명시적으로 권고한다.**
- **재사용하는 것**: `src/lib/date-calc.ts`의 `parseIsoDateUtc`(문자열→UTC Date 파싱)와
  `lastDayOfMonthUtc(year, monthIndex0)`(월의 마지막 날짜, 이미 export된 순수 산술 —
  `monthAnniversary`/`yearAnniversary`의 clamp 계산에 정확히 필요한 조각이다)는 그대로
  import해서 쓴다. 이 두 함수는 도메인 의미가 전혀 없는 순수 달력 산술이라 재사용에 아무
  문제가 없다(오히려 `lastDayOfMonthUtc`를 새로 베끼면 그것대로 드리프트다).

### 1.5 Builder에게 요구하는 구현 시그니처

```ts
// src/calculators/annual-leave-allowance/date-utils.ts (신규, Builder 작성)
import { parseIsoDateUtc, lastDayOfMonthUtc } from "@/src/lib/date-calc";

// FORMULA.md "날짜 유틸" 의사코드를 그대로 구현. 항상 원본 H(hire) 기준으로 k를
// 독립적으로 계산한다 — 이전 회차의 clamp 결과에 다시 더하는 "연쇄 계산" 금지.
export function monthAnniversary(hire: Date, k: number): Date { /* ... */ }
export function yearAnniversary(hire: Date, k: number): Date { /* ... */ }

// completedMonths: k ∈ [0,11] 중 monthAnniversary(H,k) <= R을 만족하는 최댓값.
// completedYears: k ∈ [0,∞) 중 yearAnniversary(H,k) <= R을 만족하는 최댓값.
// FORMULA.md 의사코드 그대로 선형 탐색으로 구현해도 성능 문제가 없다(개월 0~11, 연수
// 최대 수십~1백 년 수준 — 반복 비용이 무시할 만하다). O(1) 폐쇄형 계산으로 최적화하고
// 싶다면 위 "1.1"~"1.3"의 clamp 반례를 반드시 재현하는 별도 함수로 새로 유도해야 하며,
// 절대로 `calendarFullMonthsBetweenUtc`/`calendarFullYearsBetweenUtc`의 튜플 비교
// 알고리즘을 그대로 가져오면 안 된다.
export function completedMonths(hire: Date, reference: Date): number { /* ... */ }
export function completedYears(hire: Date, reference: Date): number { /* ... */ }
```

- 파일을 `logic.ts`와 분리한 이유: `age-calculator`/`parental-leave-benefit`이 이미 확립한
  "계산기 전용 날짜 산술은 `date-utils.ts`로 분리, 도메인 판정은 `logic.ts`에 남긴다"는
  국지적 관례를 그대로 따른다. 이 계산기는 "이 프로젝트에서 날짜 산정 로직이 가장 복잡한
  축"(작업 지시)이라 Calculation Auditor가 `date-utils.test.ts`(신규) 하나로 날짜 산술만
  독립적으로 스윕 검증할 수 있게 하는 이점이 특히 크다.

### 1.6 Calculation Auditor에게 권고하는 추가 Golden Test 2건

FORMULA.md의 17개 검증 예제는 전부 `day`가 1·10·15인 날짜만 쓰고 있어 위 "1.3"의 발산을
하나도 검증하지 못한다(이 두 예제로는 **틀린 구현도 17개를 전부 통과한다**는 뜻이다). 아래
2건을 `logic.test.ts`/`date-utils.test.ts`에 반드시 추가할 것을 권고한다(Architect가 직접
재계산, FORMULA.md 문서를 수정하는 것이 아니라 보강 제안).

| # | hireDate | referenceDate | 기대 결과 | 검증 대상 |
|---|---|---|---|---|
| A | 2025-01-31 | 2025-02-28 | `completedMonths=1`, `accruedDays=1` | 월말(1/31) clamp, `monthAnniversary` |
| B | 2024-02-29 | 2025-02-28 | `completedYears=1`, regime=`YEAR_1_TO_2`, `accruedDays=26` | 윤년(2/29) clamp, `yearAnniversary` |

---

## 2. 3구간 판정 결과 타입 — discriminated union 채택

### 2.1 결정

`continuousServiceRegime`(`UNDER_1YEAR`/`YEAR_1_TO_2`/`OVER_2YEARS`)을 판별 태그로 쓰는
3-way discriminated union으로 `AnnualLeaveAllowanceResult`를 설계했다(이미
`types.ts`에 작성 완료).

### 2.2 근거

- **선례**: `loan-interest-calculator`의 `RepaymentMethod`(3종) 판별 유니온을 그대로
  적용했다 — "세 방식의 핵심 결과 필드가 서로 다르므로 하나의 인터페이스에 옵션 필드로
  욱여넣지 않는다"는 그 문서의 판단 기준이 이 계산기에도 그대로 들어맞는다. 이 계산기도
  구간마다 의미 있는 필드가 실제로 다르다 — `UNDER_1YEAR`는 `completedMonths`,
  `OVER_2YEARS`는 `accrualBreakdown`(Should Have)이 있고, `YEAR_1_TO_2`는 둘 다 없다(26일
  고정값 자체가 조건부 계산이 아니라서).
- **왜 optional 필드 방식(단일 인터페이스)을 채택하지 않았는가**: `completedMonths`는
  `UNDER_1YEAR`가 아닐 때 값 자체가 존재하지 않는 것이 아니라 "의미가 없다"(FORMULA.md
  출력값 표: "UNDER_1YEAR 구간에서만 의미 있음") — 계산은 할 수 있지만 그 값이 계산 근거로
  잘못 쓰이면 안 된다. optional 필드(`completedMonths?: number`)로 두면 TypeScript가
  "이 필드는 `continuousServiceRegime`이 무엇일 때 채워지는지"를 강제하지 못해, Builder가
  실수로 `YEAR_1_TO_2` 결과에도 `completedMonths`를 채워 넣거나 UI가 regime 확인 없이
  `completedMonths`를 렌더링하는 버그가 나도 컴파일 타임에 잡히지 않는다. 판별 유니온은
  `result.continuousServiceRegime === "UNDER_1YEAR"`로 좁히지 않으면 `completedMonths`
  자체에 접근할 수 없게 만들어 이 실수를 원천 차단한다(`docs/CALCULATOR_RULES.md` "서로
  다른 계산 방식을 같은 공식으로 처리하지 않는다"를 타입 레벨로 강제하는 것과 같은 효과 —
  housing-acquisition-tax `types.ts`의 명시적 표현).
- **공통 필드(`accruedDays`/`unusedDays`/`usedMoreThanAccruedWarning`/`allowance`/
  `minimumWageReference` 등)는 세 구간에서 완전히 동일한 모양이므로 판별 유니온의 각
  분기에 반복 나열하지 않고 `AnnualLeaveAllowanceBase`(비공개 인터페이스) 교차 타입으로
  합성했다** — `LoanCalculationBase`(원금·이율·스케줄 등 7개 공통 필드)와 동일한 목적의
  반복 제거 패턴이다.
- **`YEAR_1_TO_2` 분기에 별도 breakdown 객체를 만들지 않은 이유**: 이 구간의 26일은
  "11(1년 미만 상한, 상수) + 15(1년 시점 발생, 상수)"라는 조건 없는 고정 상수 합이다(입력에
  따라 달라지는 계산이 아니다) — `OVER_2YEARS`의 `accrualBreakdown`(입력에 따라
  `addedDays`/`cappedAtMax`가 달라짐)과 성격이 다르다. `severance-pay/ui.tsx`가 법정 상수
  30(제8조)·365를 타입 필드가 아니라 화면 문구에 직접 하드코딩한 선례를 그대로 따라, 11과
  15는 Builder가 `content.ts`/`ui.tsx`에 정적 문구("1년 미만 발생 최대 11일 + 1년 시점
  15일 = 26일")로 직접 쓰면 된다(FORMULA.md "왜 구간 2에서만 26인가"의 설명을 그대로
  옮기면 됨) — 타입에 억지로 구조를 만들 필요가 없다.
- **`accruedDays: 26`을 `YEAR_1_TO_2` 분기에서 리터럴 타입으로 좁혔다** — 이 구간은 계산
  결과가 항상 정확히 26이라는 불변식이 있으므로, `number`가 아니라 `26` 리터럴로 선언해
  Builder가 실수로 다른 값을 반환하면 컴파일 타임에 잡히게 했다(`AccrualBreakdownDetail.
  baseDays: 15`도 같은 방식).

### 2.3 "부분 입력"(1일 통상임금 미입력) 축과는 별도로 다룬다

`continuousServiceRegime`(3구간)과 "1일 통상임금 입력 여부"는 서로 독립적인 두 축이다. 만약
이 둘을 모두 최상위 판별 유니온으로 만들면 3×2=6개 분기가 되어 오케스트레이터와 UI 모두
과도하게 복잡해진다 — 아래 "4."에서 설명하듯 "임금 입력 여부" 축은 판별 유니온이 아니라
`allowance?`/`minimumWageReference?` optional 필드로 처리해 이 조합 폭발을 피한다.

---

## 3. raw/display 분리 — 이 프로젝트 표준 관례를 그대로 따른다

FORMULA.md는 `accruedDays`가 "반올림 대상이 아닌 항상 정수"라고 명시했고, `unusedLeaveAllowance`
(금액)만 "최종 1회 원 단위 반올림"이 필요하다고 정의했다. 이 계산기는 `bmr-calculator`처럼
raw/display 쌍 타입(`RoundedKcalValue`)이 **필요 없다** — 그 계산기는 SPEC.md가 "1648.75kcal
→ 1649kcal"처럼 반올림 **전** 숫자를 화면 수식에 직접 대입해 보여줄 것을 요구했지만, 이
계산기의 breakdown 문장("미사용일수 × 1일 통상임금 = 미사용 연차수당")은 곱셈의 두 피연산자
(`unusedDays`, `ordinaryDailyWage`)가 이미 결과 타입에 원래 값 그대로 존재하므로, UI가 별도
"raw" 필드 없이도 "11.5일 × 90,000원 = 1,035,000원"을 그대로 조립할 수 있다.

- **`unusedLeaveAllowance`는 이미 반올림된 최종 표시값을 담는다**(severance-pay의 최종
  `severancePay`, national-pension의 `basicPensionMonthly`와 동일한 "터미널 값은 logic.ts가
  직접 반올림해 반환한다" 관례 — weekly-holiday-allowance처럼 서로 파생 관계에 있는 금액
  여러 개를 한꺼번에 다루는 계산기와 달리, 이 계산기는 반올림이 필요한 금액이 이 하나뿐이고
  이 값을 재사용하는 후속 계산이 없어 "표시 직전에만 반올림"이라는 별도 장치가 굳이 필요
  없다).
- **절사 전 완전정밀도 곱은 `types.ts`에 노출하지 않는다** — logic.ts 내부 지역 변수
  (`unusedLeaveAllowanceRaw` 같은 이름 권장, national-pension의 `basicPensionMonthlyRaw`
  네이밍 관례)로만 존재한다.
- Builder 구현 시 반올림 함수는 `Math.round`(사사오입, FORMULA.md "정밀도/반올림 정책"이
  명시)를 그대로 쓰면 된다. `usedDays`가 소수(반차)일 때만 반올림이 실제 효과를 낸다
  (FORMULA.md가 이미 설명).

---

## 4. 부분 입력(1일 통상임금 미입력) — 판별 유니온이 아니라 optional 중첩 객체

### 4.1 결정

`ordinaryDailyWage` 미입력 시 결과 타입을 완전히 다른 shape으로 분기하지 않는다. 대신
`allowance?: UnusedLeaveAllowanceDetail`(금액 계산 결과) 하나의 optional 필드로 표현한다.

### 4.2 근거 — 이 사이트의 기존 패턴과 비교

- **`bmr-calculator`의 `tdee?: TdeeValue`**: "활동량을 선택했을 때만 TDEE 섹션이 존재"를
  판별 유니온이 아니라 optional 필드로 처리했다. 그 문서의 판단 기준을 그대로 인용하면
  "판별 유니온으로 결과 모양 전체를 두 갈래로 나눌 만큼 두 경우의 구조가 다르지 않고
  (TDEE가 있는지만 다르고 나머지 필드는 항상 동일한 모양), optional 필드가 더 단순하고
  정확하다" — 이 계산기도 정확히 같은 상황이다. `ordinaryDailyWage` 입력 여부와 무관하게
  `accruedDays`/`unusedDays`/`completedYears`/(구간별 breakdown)는 완전히 동일한 모양으로
  계산되고, 오직 "미사용수당 금액을 추가로 보여줄지"만 달라진다.
- **`national-pension-benefit-estimate`의 `adjustedPensionMonthly?`**: "조기/연기를
  선택하지 않으면(0개월) 이 필드 자체가 없다"는 동일 패턴을 이미 이 사이트가 채택하고 있다.
- **왜 판별 유니온(예: `{hasWage: true, ...} | {hasWage: false, ...}`)을 만들지
  않았는가**: 위 "2.3"에서 설명했듯, 이미 `continuousServiceRegime` 3구간 판별 유니온이
  있는 상태에서 "임금 입력 여부"까지 또 다른 최상위 판별 축으로 추가하면 3×2=6개 조합을
  Builder/UI가 전부 명시적으로 다뤄야 한다 — 실제로 이 두 축은 서로 완전히 독립적이라(어느
  구간이든 임금을 입력할 수도, 안 할 수도 있다) 교차 판별이 주는 안전성 이득이 크지 않은
  반면 코드 복잡도만 커진다.

### 4.3 최저임금 참고 경고(`minimumWageReference?`)는 별도 optional 필드로 분리

`allowance`(금액)와 `minimumWageReference`(최저임금 참고 경고)를 하나의 optional 객체로
합치지 않고 **둘로 분리**했다 — 이 둘은 "존재 조건"이 서로 다르기 때문이다.

- `allowance`는 오직 "`ordinaryDailyWage`를 입력했는가" 하나의 조건에만 의존한다.
- `minimumWageReference`는 "`ordinaryDailyWage`를 입력했는가" **그리고** "`referenceDate`
  연도의 `rates-{year}.json`이 존재하는가" 두 조건 모두에 의존한다(아래 "6." 참고).

만약 이 둘을 하나의 `allowance` 객체 안에 합쳤다면, `belowMinimumWageReference` 같은
필드가 "`allowance`는 존재하는데 최저임금 데이터가 없어서 이 하위 필드만 비어 있는" 어중간한
상태(`boolean | undefined`가 객체 안에 섞여 있는 상태)를 만들어야 했을 것이다 — 두 필드를
분리하면 이런 혼합 상태 자체가 생기지 않는다(각 optional 필드는 "전부 있거나 전부 없거나"만
가능).

---

## 5. boolean 플래그 노출 방식 — `usedMoreThanAccruedWarning`은 공통 필드, `belowMinimumWageReference`는 중첩 객체 안으로

- **`usedMoreThanAccruedWarning`**: 세 구간·임금 입력 여부와 무관하게 항상 의미가 있는
  판정("사용일수가 발생일수보다 많은가")이라 `AnnualLeaveAllowanceBase`의 평범한
  `boolean` 필드로 뒀다(`weekly-holiday-allowance`의 `belowMinimumWage`/
  `meetsMinHoursRequirement`처럼 "게이팅이 아니라 항상 계산되는 참고 플래그"는 최상위
  평범한 boolean으로 노출하는 기존 관례와 동일).
- **`belowMinimumWageReference`**: 위 "4.3"에서 설명한 대로 독립적인 두 조건에 의존하므로
  최상위 평범한 boolean이 아니라 `MinimumWageReferenceDetail.belowMinimumWageReference`로
  중첩시켰다 — `undefined`(참고 경고 자체를 표시할 수 없음)와 `false`(참고 경고를
  계산했는데 기준보다 높음)를 명확히 구분해야 하기 때문이다. 최상위 평범한
  `boolean | undefined`로 뒀다면 이 구분이 "그냥 optional한 boolean"으로 뭉개져, UI가
  "최저임금 데이터가 없어서 확인 못 함"과 "확인했는데 문제없음"을 구분해 안내하기 어려워진다.

---

## 6. 최저임금 연도별 데이터 조회 — severance-pay/unemployment-benefit의 "연도 없으면 throw" 정책을 이 필드에 한해 따르지 않는다

### 6.1 배경

FORMULA.md 6단계는 `referenceDate`의 연도로 `rates-{year}.json`을 조회해 최저임금×8시간
환산액과 비교하라고 정의한다. 기존 계산기(unemployment-benefit)는 `RATES_BY_YEAR[year]`가
없으면 **에러를 던져 계산 자체를 막는다**("최저임금·구직급여 상한액은 실제로 매년 바뀌는
고시값이라 없는 연도 데이터로 조용히 계산하면 위험하다"는 근거).

### 6.2 이 계산기에서는 그 정책을 그대로 가져오지 않는다

- `referenceDate`는 SPEC.md Must Have가 "과거/미래 특정 시점으로 바꿔볼 수 있게" 명시적으로
  요구한 핵심 입력이고, `getMaxAllowedDate()`(오늘+1년)까지 미래로 조회할 수 있다(FORMULA.md
  "예외"). 반면 `rates-{year}.json`은 현재 2026년치만 존재한다 — 즉 정상적인 Must Have
  사용 범위 안에서도 "최저임금 데이터가 없는 연도"가 자연스럽게 발생한다(예: 2027년
  1월 이후 시점을 조회하면 `rates-2027.json`이 아직 없을 수 있다).
- 최저임금 참고 경고는 SPEC.md가 **Should Have + 명시적 비차단**("계산을 막지 않는 참고
  안내")으로 규정한 기능이다 — unemployment-benefit의 구직급여일액처럼 그 연도 데이터
  없이는 핵심 계산 자체가 불가능한 경우와 다르다. 여기서는 핵심 계산(`accruedDays`,
  `unusedDays`, `unusedLeaveAllowance`)이 최저임금 데이터에 전혀 의존하지 않는다.
- **결론**: `referenceDate` 연도의 rates 데이터가 없으면 에러를 던지지 않고 **그냥
  `minimumWageReference`를 만들지 않는다(`undefined`)**. Should Have 기능이 조용히
  생략될 뿐 Must Have 계산은 항상 완주한다.

### 6.3 구현 가이드 (Builder)

```ts
// logic.ts 로컬 (unemployment-benefit의 RATES_BY_YEAR 패턴을 참고하되 throw하지 않는 버전)
const RATES_BY_YEAR: Record<number, typeof rates2026> = { 2026: rates2026 };

function getRatesForYearOrNull(year: number): typeof rates2026 | null {
  return RATES_BY_YEAR[year] ?? null; // throw하지 않는다 — 위 "6.2" 근거.
}
```

- `MIN_ALLOWED_DATE`/`getMaxAllowedDate()`는 이 계산기의 `validation.ts`에 **독립적으로
  새로 정의**한다 — severance-pay/validation.ts를 import하지 않는다.
  unemployment-benefit이 이미 세운 관례(같은 상수·같은 근거를 각 계산기 `validation.ts`에
  "패턴 재사용"으로 독립 재정의, 파일 간 cross-import는 하지 않음 — `src/calculators/{slug}/`
  폴더 하나만 수정해도 다른 계산기에 영향이 없어야 한다는 원칙 때문)을 그대로 따른다.

---

## 7. 정책 데이터 배치 — 계산기 전용 `policy.ts`를 만들지 않는다

`docs/ARCHITECTURE.md` "결정 사례: 정책 데이터를 언제 계산기 전용 `policy.ts`에 두는가"의
기준을 적용한다.

- 이 계산기가 참조하는 값은 최저임금 시급(`minimumWage.hourly.value`)과 소정근로시간
  (`laborStandards.statutoryDailyHours.value`) 둘뿐이며, **둘 다 weekly-holiday-allowance
  Architect 라운드가 이미 `rates-2026.json` 최상위에 만들어 둔 필드를 그대로 읽기만 한다**
  — 이 계산기가 새로 도입하는 정책 데이터가 전혀 없다.
- 11/15/25/2(년)처럼 발생일수 산식 자체에 등장하는 숫자는 「근로기준법」 조문이 직접 정한
  고정 법정 상수이지, 매년 갱신되는 고시값이 아니다 — severance-pay가 30(제8조 30일분)·365를
  `policy.ts`가 아니라 `logic.ts` 로컬 `const`로 둔 것과 동일한 성격이다(둘 다 "법 조문
  자체가 상수" vs "행정 고시가 매년 바뀌는 값"의 구분). 따라서 이 숫자들도 `logic.ts`
  로컬 상수(`UNDER_ONE_YEAR_MAX_DAYS = 11`, `FIRST_YEAR_GRANT_DAYS = 15`,
  `MAX_ACCRUED_DAYS = 25`, `ACCRUAL_INTERVAL_YEARS = 2`)로 Builder가 정의하면 된다.
- **결론: `policy.ts` 없음.** `rates-2026.json` 직접 참조(import) + `logic.ts` 로컬 법정
  상수만으로 충분하다.

---

## 8. 숫자 정밀도 전략 — 일반 `Number`, 스케일링/BigInt/decimal 전부 불필요

FORMULA.md "단위"가 이미 "전 단위 스케일링이 필요 없다"고 결론 냈다. 다른 Architect
라운드의 방법론(Formula Analyst의 "충분하다" 의견을 그대로 받지 않고 최악 조합을 직접
재계산)을 동일하게 적용해 재검증한다.

- 이 계산기가 다루는 유일한 금액 연산은 `unusedLeaveAllowance = unusedDays ×
  ordinaryDailyWage`다. `unusedDays`의 상한은 `accruedDays`의 최댓값인 **25**(사용일수가
  0일 때)로 사실상 고정되어 있다 — 이 사이트의 다른 어떤 계산기보다도 곱셈의 한쪽 항이
  극단적으로 작은 값(최대 두 자리 정수)으로 묶여 있는 사례다.
- 극단적으로 큰 `ordinaryDailyWage`(예: 100억 원 = 10^10)를 대입해도
  `25 × 10^10 = 2.5×10^11`으로, `Number.MAX_SAFE_INTEGER`(약 9.007×10^15)와 비교해
  **4자리(10^4배) 이상 여유**가 있다 — `average-cost-calculator`가 `BigInt`를 채택해야
  했던 "정상 입력 범위에서 이미 Number가 틀릴 수 있는" 상황과 전혀 다르다.
- 반올림은 최종 곱셈 결과 1회만(FORMULA.md "정밀도/반올림 정책") 수행하므로 반복 연산에
  따른 부동소수점 오차 누적도 없다.
- 날짜 산술(`monthAnniversary`/`yearAnniversary`)은 전부 `Date.UTC` 기반 정수 밀리초
  연산이라(`src/lib/date-calc.ts`의 기존 관례와 동일) 부동소수점 오차와 무관하다.
- **결론: 일반 `Number`. `BigInt`/`decimal.js`/`big.js` 전부 불필요.**

---

## 9. 계산 로직 분리 방식 — 단일 `logic.ts` + `date-utils.ts` 분리 (디렉터리 분할 아님)

`loan-interest-calculator`/`housing-acquisition-tax`가 세운 기준("여러 변형이 짧고
독립적인 연산의 나열이면 분기로 충분, 같은 모양의 복잡한 다단계 절차 여러 벌을 공유하면
파일 분할")을 적용한다. FORMULA.md "계산 순서" 8단계는 표면적으로 단계가 많아 보이지만
반복 루프나 회차별 보정 같은 "공유 가능한 복잡한 절차"가 없다 — `logic/` 디렉터리로 분할할
근거가 없다.

다만 **날짜 산술만은 `date-utils.ts`로 분리한다**(위 "1.5") — 이는 "복잡한 다단계 절차의
공유"가 아니라 "이 계산기에서 가장 버그에 취약한 지점을 독립적으로 검증 가능하게 만드는"
목적의 분리로, `age-calculator`/`parental-leave-benefit`의 기존 파일 분리 관례와 같다.

```
src/calculators/annual-leave-allowance/
  date-utils.ts
    monthAnniversary, yearAnniversary, completedMonths, completedYears  (위 "1.5")

  logic.ts
    determineContinuousServiceRegime(hireDate, referenceDate)
      // FORMULA.md 2단계. completedYears로 3구간 중 하나를 판정.
      // date-utils.ts의 completedYears/completedMonths만 호출하고 그 외 로직 없음 —
      // Calculation Auditor가 이 함수 하나만으로 구간 경계값(정확히 1년/2년 등)을 검증 가능.

    calculateAccruedDays(regime, completedMonths, completedYears)
      // FORMULA.md 3단계(3구간 정의) + "가산 연차" 계산. 리터럴 유니온 타입과 맞물려
      // 각 분기가 정확히 어떤 필드를 채워야 하는지 타입이 강제한다(위 "2.").

    calculateUnusedDays(accruedDays, usedDays)
      // FORMULA.md 4단계. max(accruedDays-usedDays,0) + usedMoreThanAccruedWarning.

    calculateAllowance(unusedDays, ordinaryDailyWage)
      // FORMULA.md 5단계(선택). ordinaryDailyWage가 없으면 호출하지 않는다(오케스트레이터가
      // 분기) — 위 "3."의 raw 지역 변수 규칙을 이 함수 스코프 안에서 지킨다.

    calculateMinimumWageReference(ordinaryDailyWage, referenceDate)
      // FORMULA.md 6단계(선택, Should Have). getRatesForYearOrNull이 null이면 undefined 반환
      // (위 "6.").

    calculateAnnualLeaveAllowance(input: AnnualLeaveAllowanceInput): AnnualLeaveAllowanceResult
      // 오케스트레이터. 위 함수들을 순서대로 호출해 판별 유니온을 조립한다.
```

- `determineContinuousServiceRegime`/`calculateAccruedDays`를 분리한 이유: FORMULA.md의
  핵심 경계 테스트(정확히 1년, 정확히 2년, 21/22/23년차 25일 상한 등)를 오케스트레이터
  전체를 거치지 않고 이 두 함수만 직접 호출해 검증할 수 있게 하기 위함이다
  (national-pension-benefit-estimate의 `findPensionableAgeRow` 분리와 같은 근거).

---

## 10. 파일 구조 (Builder 인수인계)

```
src/calculators/annual-leave-allowance/
  types.ts              # 입력·결과 타입 (Architect 완성 — 위 "2.", "3.", "4.", "5.")
  date-utils.ts          # monthAnniversary/yearAnniversary/completedMonths/completedYears (위 "1.")
  date-utils.test.ts      # 위 "1.6" 추가 권장 Golden Test 2건 포함
  logic.ts               # 위 "9." 5+1 함수, 단일 파일
  logic.test.ts          # FORMULA.md 검증 예제 17개 + 위 "1.6" 2건
  validation.ts          # 입력 검증(아래 "11."), MIN_ALLOWED_DATE/getMaxAllowedDate 독립 재정의(위 "6.3")
  validation.test.ts
  formatting.ts          # 날짜/일수/금액 표시 포맷팅
  formatting.test.ts
  content.ts              # 소개/사용법/FAQ, 정책 고지 문구(FORMULA.md "정책 고지 문구" 5개)
  ui.tsx                  # 아래 "12." 레이아웃
```

`policy.ts` 없음(위 "7.").

---

## 11. 입력 검증 — 개요 (상세는 Builder 재량, FORMULA.md "예외" 그대로)

- `hireDate <= referenceDate`, `usedDays >= 0`(입력됐다면), `ordinaryDailyWage >= 0`(입력됐다면).
  하나라도 위반하면 계산하지 않고 오류 안내 — severance-pay의 `retireDate > hireDate` 검증과
  동일한 배치(검증 실패는 `AnnualLeaveAllowanceResult`의 분기가 아니라 validation.ts가
  결과 자체를 만들지 않는다, 위 "2." 타입 주석 참고).
- `MIN_ALLOWED_DATE = "1970-01-01"`(hireDate 하한), `getMaxAllowedDate()`(오늘+1년,
  referenceDate 상한) — 이 계산기 `validation.ts`에 독립적으로 재정의한다(위 "6.3").
- `usedDays` 상한: FORMULA.md가 "상식적 범위(예: 365일)"를 제안했다 — 계산 정확성에
  영향을 주지 않는 순수 UX 가드이므로 Architect가 특정 숫자를 강제하지 않는다. Builder는
  365 또는 그 이상의 넉넉한 상한(예: 1000)을 "제출 차단이 아니라 확인 안내 수준"으로 두는
  것을 권장한다(national-pension-benefit-estimate 선례와 같은 톤).
- `ordinaryDailyWage` 상한: 위 "8."의 최악 조합 검토(100억 원까지도 안전)를 참고해
  Builder가 명백히 비정상적인 값만 걸러내는 넉넉한 상한을 둘 것을 권장한다.

---

## 12. UI 레이아웃

`docs/DESIGN_SYSTEM.md` "공통 화면 순서"(입력 → 결과 → 계산 근거 → 소개·사용 방법 →
정책 안내 → FAQ)를 그대로 따른다.

```
[입력 폼]
  입사일(필수) → 연차 산정 기준일(선택, 기본값 오늘, helpText) →
  이미 사용한 연차일수(선택, 기본값 0, helpText) →
  1일 통상임금(선택, helpText — "비우면 금액 계산 없이 발생일수까지만 보여드립니다")
  (SPEC.md "입력 라벨·순서" — 날짜 두 개 인접 배치 그대로)

[결과 — 핵심 카드] (bg-primary 강조, 계산기당 하나)
  allowance가 있으면 → "미사용 연차수당" 금액
  allowance가 없으면 → "연차 발생일수" (SPEC.md Must Have "핵심 결과 카드")

[결과 — 보조 정보]
  발생일수 · 미사용일수를 핵심 카드 아래 작은 카드/텍스트로 항상 함께 표시
  (allowance 유무와 무관하게 두 값은 항상 계산되므로 항상 노출)
  usedMoreThanAccruedWarning === true면 "입력한 사용일수가 발생일수보다 많습니다" 인라인 경고

[SectionCard "계산 근거"] — SPEC.md "서술형 내레이션 금지, 라벨=값" 그대로, 단계별 카드/아이콘으로
  1단계 근속기간 판정: "입사일 {hireDate} ~ 기준일 {referenceDate} → 근속 {completedYears}년
    {UNDER_1YEAR면 completedMonths}개월"
  2단계 발생일수 산출 (regime으로 분기, 각 구간 문구가 다름):
    - UNDER_1YEAR: "개근 {completedMonths}개월 → 발생일수 {accruedDays}일(최대 11일)"
    - YEAR_1_TO_2: "1년 미만 발생 최대 11일 + 1년 시점 15일 = 26일" (정적 문구, 위 "2.2")
    - OVER_2YEARS: "근속 {completedYears}년차 → 기본 {accrualBreakdown.baseDays}일 + 가산
      {accrualBreakdown.addedDays}일 = {accrualBreakdown.rawTotalDays}일
      {accrualBreakdown.cappedAtMax && '→ 25일 상한 적용'}"
  3단계 미사용일수: "발생일수 {accruedDays}일 - 사용일수 {usedDays}일 = 미사용일수 {unusedDays}일"
  4단계 수당금액(allowance가 있을 때만): "미사용일수 {unusedDays}일 × 1일 통상임금
    {allowance.ordinaryDailyWage}원 = {allowance.unusedLeaveAllowance}원"

[SectionCard "정책 고지"] (FORMULA.md "정책 고지 문구" 1~5, 항상 노출)
  1. 근거 법령(제60조·제61조)
  2. 연차 사용촉진 고지 — unemployment-benefit v2의 "게이팅 없이 항상 계산, 고지 문구로
     대체" 패턴 그대로: 체크박스·관문 없이 위 결과를 항상 보여주고 이 문구를 항상 병기한다.
  3. 입사일 기준 개별 산정 한계(회계연도 기준과 다를 수 있음)
  4. 1~2년차 26일 구간의 한계(소멸시효 미반영)
  5. minimumWageReference가 있고 belowMinimumWageReference === true일 때만: 최저임금
     참고 경고(weekly-holiday-allowance 패턴과 동일한 비차단 안내)
  5-정책형 고지: "매년 갱신되는 고시값을 사용" 문구 + 마지막 검토일

[IntroSection] [UsageGuide] [FaqAccordion]
  FAQ 6문항(SPEC.md "소개 콘텐츠 + FAQ 섹션" 그대로, 답변은 FORMULA.md "FAQ 콘텐츠" 그대로 옮김)
```

- **연차 사용촉진 고지는 "결과가 이미 계산된 것"을 전제로 문구만 덧붙인다** — 체크박스나
  조건 분기로 결과 표시 여부를 바꾸지 않는다(SPEC.md "설계상 핵심 결정" 그대로,
  unemployment-benefit v2/weekly-holiday-allowance 선례 재확인).
- **카드/시각적 계층(SPEC.md Must Have)**: "계산 근거" 4단계는 번호가 매겨진 단계 카드로
  표현한다(loan-interest-calculator의 상환방식 카드, housing-acquisition-tax의 "가격
  구간→중과 여부→세목별" 단계 나열과 같은 톤) — 정확한 아이콘·색상은 UX/UI Critic이
  화면으로 재검토한다.

---

## 13. 공통 컴포넌트 재사용 검토

- **`ShareActions`**: 그대로 재사용한다. `AnnualLeaveAllowanceInput`은 전부 원시 타입
  (`string`/`number`)이라 직렬화 문제가 없다(average-cost-calculator류의 `BigInt` 직렬화
  문제, bill-split-calculator류의 RNG 재현 문제가 애초에 없음).
- **`SectionCard`/`UsageGuide`/`IntroSection`/`FaqAccordion`**: 그대로 재사용한다.
- **핵심 결과 카드**: 새 컴포넌트를 만들지 않는다 — 기존 `bg-primary` 강조 카드 패턴을
  `ui.tsx`에서 직접 구현한다. 다만 이 계산기는 national-pension/bmr-calculator처럼 "핵심
  카드 자체가 입력 상태에 따라 다른 값을 보여준다"(allowance 유무에 따라 발생일수 ↔
  미사용수당 금액 전환) — 완전히 새로운 패턴은 아니고, bmr-calculator가 "tdee 유무에 따라
  섹션 하나가 나타나거나 사라진다"를 처리한 것의 변형(이번엔 섹션이 사라지는 게 아니라
  핵심 카드의 "내용"이 바뀐다)이다. 새 컴포넌트 승격은 아직 이르다(사례 1개뿐).
- **계산 근거 단계 카드**: 새 공용 컴포넌트로 승격하지 않는다 — `housing-acquisition-tax`가
  이미 유사 패턴(가격구간→중과여부→세목별)을 로컬로 구현했으므로 그 마크업 스타일을
  참고해 이 계산기도 로컬로 구현한다(두 번째 사례가 생겼지만, 세부 단계 수·문구가 계산기마다
  크게 달라 아직은 로컬 구현이 낫다는 기존 판단 유지).

---

## 14. 회귀 방지 확인

**공용 코드 — 전혀 수정하지 않음**: `src/lib/`, `rates-2026.json` 등 다른 계산기와 공유하는
파일을 하나도 건드리지 않았다(위 "1."에서 `src/lib/date-calc.ts`의 기존 함수를 의도적으로
재사용하지 않기로 한 결정 참고 — 그 파일 자체도 수정하지 않았다). 이번 라운드에 작성한
파일은 `src/calculators/annual-leave-allowance/types.ts` 하나뿐이고, 다른 어떤 계산기도
이 폴더를 import하지 않는다.

- `npx tsc --noEmit`: 클린(에러 없음).
- `npx vitest run`: 기존 82개 테스트 파일 · 1,109개 테스트 전부 통과(회귀 없음).

---

## 15. registry.ts 등록 계획 (다음 라운드)

- 이번 Architect 라운드에서는 등록하지 않는다(위 "0.", 기존 관례).
- Builder가 구현을 완료하면 다음으로 등록한다(SPEC.md "슬러그/카테고리" 그대로):
  ```
  slug: "annual-leave-allowance"
  title: "연차수당 계산기"
  category: "labor"
  status: "draft"
  ```
- **아이콘**: `labor` 카테고리에 이미 `severance-pay`(`coins`)·`unemployment-benefit`
  (`calculator`)·`weekly-holiday-allowance`·`parental-leave-benefit`이 있다 — Builder가
  실제 등록 시점에 `registry.ts`를 다시 확인해 중복을 피할 것(Architect가 지금 미리
  단정하지 않는다, 이번 라운드~Builder 완료 사이 다른 계산기가 먼저 등록될 수 있으므로).

---

## 16. Builder 체크리스트 (요약)

1. `date-utils.ts`를 FORMULA.md 의사코드 그대로 새로 작성한다 — `src/lib/date-calc.ts`의
   `calendarFullMonthsBetweenUtc`/`calendarFullYearsBetweenUtc`를 **호출하지 않는다**(위
   "1.", 조용히 틀린 값을 낸다). `parseIsoDateUtc`/`lastDayOfMonthUtc`만 재사용한다.
2. 위 "1.6"의 추가 Golden Test 2건(월말 clamp, 윤년 clamp)을 FORMULA.md의 17개 예제에
   더해 반드시 포함한다 — 17개만으로는 이 발산을 검증하지 못한다.
3. `types.ts`의 discriminated union을 그대로 따른다 — `continuousServiceRegime`으로
   좁히지 않고는 `completedMonths`/`accrualBreakdown`에 접근할 수 없다(타입이 강제).
4. `unusedLeaveAllowance`/`belowMinimumWageReference`는 `allowance?`/
   `minimumWageReference?` 두 개의 독립적인 optional 객체로 채운다(위 "4.", "5.") — 하나로
   합치지 않는다.
5. 최저임금 참고 데이터가 없는 연도(`referenceDate`)를 만나면 에러를 던지지 않고
   `minimumWageReference`를 그냥 `undefined`로 둔다(위 "6.").
6. `policy.ts`를 만들지 않는다 — 법정 상수는 `logic.ts` 로컬 `const`, 최저임금은
   `rates-2026.json` 직접 참조(위 "7.").
7. `MIN_ALLOWED_DATE`/`getMaxAllowedDate()`는 이 계산기 `validation.ts`에 독립적으로
   재정의한다(severance-pay import 금지, 위 "6.3").
8. `ui.tsx`: 위 "12." 순서(입력 → 핵심 카드 → 계산 근거 4단계 → 정책 고지 5종 → 소개·
   사용법·FAQ). 연차 사용촉진 고지는 게이팅 없이 항상 노출.
9. 새 계산기 완료 후 기존 계산기 Smoke Test 실행(docs/EVALUATION.md "회귀 방지").
