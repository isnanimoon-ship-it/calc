# ARCHITECTURE: 청약가점 계산기 (housing-subscription-score)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-06.
계산 공식 자체는 정의하지 않는다(FORMULA.md 소관, 배점 구간·상한 값을 바꾸지 않았다).
여기서는 코드 배치, 타입, 데이터 경계, UI 구조만 정한다.

관련 문서: docs/ARCHITECTURE.md, docs/CALCULATOR_RULES.md, docs/DESIGN_SYSTEM.md.
참고 선례: `tasks/four-major-insurance/ARCHITECTURE.md`(정책 데이터 분리, 폴더 구조),
`tasks/weekly-holiday-allowance/ARCHITECTURE.md`(logic/formatting 경계, 경고 처리),
`tasks/parental-leave-benefit/ARCHITECTURE.md`(계산기 전용 policy.ts 선례).

---

## 0. 레지스트리 상태 확인

`src/calculators/registry.ts` 교차 확인 결과 `housing-subscription-score` slug는 아직
등록되어 있지 않다(Product Owner가 SPEC 승인 시점에 등록하지 않은 것으로 보인다). 이번
Architect 라운드에서도 등록하지 않는다 — 아래 "7. 계산기 등록 전략" 참고, Builder가 UI
구현 완료 시 `status: "draft"`로 등록한다.

---

## 1. 숫자 정밀도 전략 — JS `Number`, 스케일링/BigInt/decimal 전혀 불필요 (확정)

FORMULA.md "단위"/"정밀도" 절의 판단을 그대로 확정한다.

- **선택: 일반 `Number`(배정밀도). 스케일링·`BigInt`·`decimal.js`·`big.js` 전혀 쓰지 않는다.**
- **근거**:
  - 이 계산기가 다루는 값은 전부 정수다 — 세 항목 점수(0~32/0~35/0~17, 합산 0~84), 참고
    표시용 연수·개월수, 부양가족 인원수. **금액이 전혀 등장하지 않는다**(severance-pay·
    four-major-insurance·weekly-holiday-allowance와 달리 원 단위 반올림 정책 자체가
    필요 없다).
  - 중간 계산도 정수 연산만 쓴다(`min`/`max`/`floor`, 연도·개월 차 정수 뺄셈). `0.1 + 0.2`
    류 이진 부동소수점 오차가 발생할 나눗셈이나 소수 곱셈이 공식 어디에도 없다
    (`floor(subscriptionMonths / 12)`는 정수 나눗셈 후 절사이므로 JS `Math.floor`가
    항상 정확한 정수를 반환한다 — 입력 자체가 이미 정수 개월수이기 때문).
  - 값의 규모도 극히 작다(최댓값 84) — `Number.isSafeInteger` 범위 논의 자체가 무의미한
    수준이다.
  - `decimal.js`/`big.js`는 이 계산기 규모에서 실익이 전혀 없어 채택하지 않는다
    (docs/ARCHITECTURE.md "모든 계산기에 무조건 무거운 decimal 라이브러리를 쓰지 않는다").
- **날짜 산술(연/월 차)은 부동소수점이 아니라 정수 `Date.UTC` 밀리초 기반**이라 이 절과
  별개로 이미 안전하다 — 아래 "2. 날짜 계산 헬퍼 배치" 참고.

---

## 2. 날짜 계산 헬퍼 배치 — `src/lib/date-calc.ts`에 공용화 (결정 완료, 실제 반영함)

FORMULA.md가 두 가지 선택지를 열어 뒀다: (A) `src/lib/date-calc.ts`(기존 severance-pay/
unemployment-benefit 공용 유틸)에 추가, (B) `age-calculator/date-utils.ts`처럼 계산기
전용 파일에 둔다. **(A)를 선택했고, 실제로 `src/lib/date-calc.ts`에
`calendarFullYearsBetweenUtc`/`calendarFullMonthsBetweenUtc` 두 함수를 추가 구현했다**
(파일: `src/lib/date-calc.ts`, 테스트: `src/lib/date-calc.test.ts` — FORMULA.md 예제
3·4·9·10·11·12를 그대로 옮겨 계약을 고정했다. Golden Test 자체는 아니고 순수 날짜 산술
계약 테스트다).

### 판단 기준 — 기존 "날짜 계산 유틸 공용화" 결정 사례를 어떻게 적용했는가

기존 결정 사례(docs/ARCHITECTURE.md, unemployment-benefit Architect 라운드)의 근거는
"두 계산기가 **동일한 법적 정의**(근로기준법 제2조제1항제6호 평균임금 산정기간)를 공유하기
때문에 복붙하면 드리프트가 생긴다"였다. 이 기준을 문자 그대로 적용하면 애매하다 —
`housing-subscription-score`를 제외한 어떤 **기존 계산기**도 지금 당장
`calendarFullYearsBetweenUtc`/`calendarFullMonthsBetweenUtc`를 호출하지 않기 때문이다
(대상이 되는 age-calculator는 이미 자체 구현이 있다, 아래 참고).

그래서 판단 기준을 한 단계 더 명확히 세분화했다 — `src/lib/date-calc.ts` 파일 자체의
기존 머리말 주석("이 파일은 UTC 자정 고정 **순수 날짜 산술**만 다룬다 — '월 단위
근속연수 판정'처럼 계산기마다 의미가 달라지는 로직은 개별 계산기에 남긴다")이 이미
"≥2개 계산기가 지금 당장 호출해야 함"을 조건으로 걸지 않는다는 점에 주목했다:

1. **이 함수들 자체에는 도메인 의미가 전혀 없다.** "만 30세부터 산정", "구간 판정" 같은
   무주택기간 고유 규칙은 전부 `logic.ts`(아직 Builder 미작성)가 담당하고, 이 두 함수는
   "두 UTC 날짜 사이의 만 나이 방식 경과 연/개월수"라는 범용 산술만 제공한다 — 기존
   `diffDaysUtc`/`calendarMonthsBeforeUtc`와 정확히 같은 성격(순수 산술, 호출부가 의미를
   부여)이다.
2. **한 계산기 내부에서도 이미 2번 재사용된다** — 무주택기간(`calendarFullYearsBetweenUtc`)과
   청약통장 가입기간(`calendarFullMonthsBetweenUtc`)이 정확히 같은 산술 규칙을 공유한다.
   `logic.ts` 안에 인라인으로 두 번 구현하면 그 자체로 이미 드리프트 위험(한쪽만 수정)이
   생긴다 — 계산기가 1개뿐이어도 "공용 함수로 뽑아 재사용" 결정은 필요하다.
3. **향후 다른 계산기가 재사용할 가능성이 실제로 있다** — "만 나이 방식 경과기간"은
   법적 나이·근속연수·가입기간 등을 다루는 계산기에서 반복적으로 필요할 개념이다(예:
   향후 "연차유급휴가 계산기"의 근속연수 판정도 같은 산술을 쓸 가능성이 높다).
4. **이름 충돌이 없다** — `src/lib/date-calc.ts`에는 이미 `parseIsoDateUtc`,
   `diffDaysUtc`, `lastDayOfMonthUtc`, `calendarMonthsBeforeUtc`,
   `calculateCalendarPeriodDaysBefore`가 있고, 새 함수 두 개는 이름·시그니처·용도가
   전혀 겹치지 않는다(`calendarMonthsBeforeUtc`는 "기준일 - N개월"을 구하는 역방향
   함수, 새 함수들은 "두 날짜 사이의 경과량"을 구하는 정방향 함수).

### 왜 `age-calculator`는 리팩터링하지 않았는가 (의도적 비대칭)

`age-calculator/logic.ts` + `date-utils.ts`가 이미 "만 나이"를 자체 구현하고 있고
(`anniversaryInYear` 기반, 문자열 비교 방식), 개념적으로는 이번에 추가한
`calendarFullYearsBetweenUtc`와 겹친다. **하지만 이번 라운드에서 age-calculator를
`src/lib/date-calc.ts`로 재배선하지 않았다.**

- **근거**:
  - 두 구현은 **윤년 2월 29일 기념일 처리 방식이 다르다.** `age-calculator`의
    `anniversaryInYear`는 기념일 자체를 그 해의 실제 날짜로 clamp한다(윤년이 아닌 해의
    "2월 29일생 기념일"을 2월 28일로 정규화한 뒤 문자열 비교). 반면 새로 추가한
    `calendarFullYearsBetweenUtc`는 (월,일) 튜플을 그대로 비교한다(clamp 없음) — 즉
    2월 29일생이 2월 28일에 도달했을 때 두 구현이 다른 답을 낼 수 있다. 이는 "같은
    함수의 복붙"이 아니라 "설계가 다른 두 구현"이므로, 기존 결정 사례가 전제한
    "복붙 = 동일 로직 유지"라는 안전 조건이 성립하지 않는다.
  - `age-calculator`는 이미 **published 직전 단계**(현재 draft, Calculation
    Auditor/QA 대기 중)이며 그 자체의 Golden Test·법제처 대조 케이스가 이 clamp 동작을
    전제로 작성되어 있다(tasks/age-calculator/ARCHITECTURE.md "테스트 경계" — "2월 29일생의
    윤년·평년 경계"). 지금 이 파일을 건드리면 **이번 작업 범위(housing-subscription-score)
    밖의 회귀 위험**을 새로 만든다 — unemployment-benefit 라운드가 "복붙 대신 추출"을
    선택할 때 지켰던 전제(로직을 한 글자도 바꾸지 않고 이동 + 기존 Golden Test 재실행 확인)를
    이번엔 지킬 수 없다(로직 자체가 다르므로 "그대로 이동"이 불가능하고, 다르게 만들면 새로운
    회귀 검증 라운드가 필요하다).
  - 청약가점 계산기는 age-calculator처럼 "윤년 2월 29일 기념일의 정확한 당일 판정"이 UX
    핵심이 아니다(하루 차이가 배점 구간에 영향을 주는 경우는 이론상 있지만 SPEC/FORMULA
    어디에도 이 엣지케이스가 요구되지 않았다). 따라서 두 구현을 강제로 하나로 합칠
    실익보다, 각자의 검증된 방식을 유지하는 쪽의 리스크가 낮다.
  - **결론**: 지금은 "새 함수를 `src/lib/`에 두되 기존 계산기는 건드리지 않는다"를 채택한다.
    향후 age-calculator가 QA를 통과해 안정화된 뒤, 별도 라운드에서 두 구현의 엣지케이스
    차이를 명시적으로 비교·검증하고 통합 여부를 재논의할 것을 후속 과제로 남긴다(아래
    "남은 리스크" 참고). 이 판단 자체를 `docs/ARCHITECTURE.md`에 결정 사례로 추가해
    "공용화 = 반드시 기존 구현까지 리팩터링"이 아니라 "새 도입 시점에 안전하게 공유
    가능한 범위만 공유"도 유효한 선택지임을 남긴다.

---

## 3. 정책 데이터 스키마 — 계산기 전용 `policy.ts` (rates-2026.json 최상위에 넣지 않음)

FORMULA.md가 `rates-2026.json` 최상위에 `housingSubscriptionScore` 네임스페이스를 추가하는
초안을 제시했으나(`socialInsurance` 패턴 참고), **계산기 전용 `src/calculators/
housing-subscription-score/policy.ts`에 두기로 결정을 바꾼다.**

- **근거**:
  - `socialInsurance`(four-major-insurance)와 `laborStandards`(weekly-holiday-allowance)가
    최상위에 있는 이유는 "**다른 계산기도 같은 값을 쓴다**"였다(국민연금 요율, 근로기준법
    40/8/15시간 등 — 향후 계산기가 명시적으로 재사용을 예고했다). 청약가점 배점표(32/35/17,
    구간 경계, `min(32,2*(years+1))` 같은 폐쇄형 공식의 계수)는 「주택공급에 관한 규칙」
    별표 1에만 등장하는 값으로, 다른 계산기가 재사용할 근거가 없다.
  - 이미 선례가 있다 — `parental-leave-benefit/ARCHITECTURE.md` "정책 데이터" 절: "현재
    계산기에 필요한 수치는 전역 정책 파일을 무리하게 확장하지 않고 계산기 전용 `policy.ts`에
    두되, 공통 재검토 도구가 읽을 수 있는 동일 메타데이터 스키마를 사용한다." 이 계산기도
    똑같은 상황(값이 이 계산기에만 필요, 스키마는 공용 규칙을 따름)이라 같은 선택을 한다.
    `military-discharge-date`도 계산기 전용 `policy.ts`를 쓴 선례다.
  - `rates-2026.json`은 이미 여러 계산기가 공유하는 파일이라, 재사용 근거가 없는
    16행짜리 배점표·조문 확인 필요 각주까지 계속 추가하면 "공유 데이터 파일"이라는
    성격이 흐려지고, 이 계산기만의 재검토 이력(별표 1 원문 미대조, 2026-06-15 시행
    개정 확인 필요 등 FORMULA.md "확인 필요 항목" 다수)이 다른 계산기의 정책 데이터와
    섞여 가독성이 떨어진다.
  - 메타데이터 스키마(`value`/`source`/`lastVerified`/`nextReviewDue`)는 `rates-{year}.json`과
    동일하게 유지해 재검토 자동화 도구가 파일 위치와 무관하게 동작하게 한다
    (docs/CALCULATOR_RULES.md "데이터 파일 스키마" 그대로 준수, 위치만 다름).
- **표(16행 lookup table)는 별도 데이터 구조로 중복 저장하지 않는다.** FORMULA.md가 이미
  "구간표 자체가 절사 정책을 대체한다"고 명시했고, 실제 채점은 폐쇄형 공식
  (`min(32, 2*(years+1))`, `5 + 5*min(count,6)`, 6개월/12개월 임계값 분기 후
  `min(17, floor(months/12)+2)`)으로 수행되므로 표를 두 번째 SSOT로 만들면 공식과 표가
  어긋나는 드리프트 위험만 커진다. 표는 `FORMULA.md` 자체가 근거 문서 역할을 하고,
  `logic.test.ts`의 Golden Test(구간 경계 다수)가 회귀 검증 역할을 한다.
- **`policy.ts`가 담을 것 (Builder가 작성, 값은 FORMULA.md "배점표"/"기준 출처"에서 그대로
  옮김 — 이 문서는 스키마만 확정한다)**:

```ts
// src/calculators/housing-subscription-score/policy.ts (Builder 작성 예정 — 형태만 확정)
export const HOUSING_SUBSCRIPTION_SCORE_POLICY = {
  law: "주택공급에 관한 규칙",
  regulationVersion: "국토교통부령 제1592호 (2026-06-15 시행, 별표 1 개정 여부 확인 필요)",
  lastVerified: "2026-09-06",
  nextReviewDue: "2027-01-01",

  homelessPeriod: {
    maxScore: 32,
    perYearScore: 2, // homelessPeriodScore = min(maxScore, perYearScore * (years + 1))
    source: {
      law: "주택공급에 관한 규칙", article: "별표 1 (호 번호 확인 필요)",
      effectiveDate: "확인 필요", url: "https://www.law.go.kr",
    },
  },
  dependentCount: {
    maxScore: 35,
    baseScore: 5,
    perDependentScore: 5,
    capCount: 6, // dependentScore = baseScore + perDependentScore * min(count, capCount)
    source: { law: "주택공급에 관한 규칙", article: "별표 1 (호 번호 확인 필요)" },
  },
  subscriptionPeriod: {
    maxScore: 17,
    under6MonthsScore: 1,
    under1YearScore: 2,
    perYearScoreAfter1Year: 1,
    baseScoreAfter1Year: 2, // 1년 이상: min(maxScore, floor(months/12) + baseScoreAfter1Year)
    source: { law: "주택공급에 관한 규칙", article: "별표 1 (호 번호 확인 필요)" },
  },
  totalScoreMax: 84,
} as const;
```

  - Builder는 `logic.ts`에서 `32`/`35`/`17`/`6`/`5` 같은 매직 넘버를 직접 쓰지 않고 이
    상수 객체를 통해서만 읽는다(SPEC.md Must Have "기준일자 표시" — 계산 코드에 배점 구간을
    하드코딩하지 않는다는 요구를 만족).
  - 이 계산기가 향후 개정(예: 2026-06-15 시행 국토교통부령 별표 1 변경 여부 확인 결과)으로
    수치가 바뀌면 이 파일 하나만 고친다. 연도가 바뀌어도(정책 자체가 연 단위로 개정되지 않고
    수시 개정되는 특성상) `rates-2027.json` 같은 연도별 파일 분리는 적합하지 않다고 판단했다
    — 대신 `lastVerified`/`nextReviewDue`를 이 파일 안에서 갱신하는 방식을 쓴다(연도별
    파일 스킴이 아니라 "단일 최신본 + 재검토일" 스킴, military-discharge-date의 `policy.ts`와
    같은 패턴).

---

## 4. 폴더 / 파일 구조

```text
src/calculators/housing-subscription-score/
  types.ts          입력·결과 타입 (Architect 완성 — 이번 라운드에 작성함)
  policy.ts         배점 상수 + 출처 메타데이터 (Builder 작성, 위 3번 스키마 그대로)
  logic.ts          순수 계산 함수 (Builder 작성, policy.ts 상수만 참조)
  logic.test.ts     Golden Test 12개(FORMULA.md) + 상한/하한 불변식 테스트
  validation.ts     입력 검증 (Builder 작성, zod 등)
  validation.test.ts
  formatting.ts     breakdown 문자열 + 경고 문구 조립 (아래 "5. 타입 결정" 경계 참고)
  formatting.test.ts
  content.ts        정책 특례 고지 3종 + 소개/사용법/FAQ 콘텐츠 원본
  ui.tsx            입력·결과·계산 근거·정책 안내 UI
  ui.test.tsx
```

`src/lib/date-calc.ts`(공용, 이번에 확장함)와 `src/lib/date-calc.test.ts`도 이 계산기가
사용하는 인프라다(위 "2." 참고). `rates-2026.json`은 이 계산기 때문에 수정하지 않는다(위
"3." 참고).

---

## 5. 타입 결정

`types.ts`를 이번 라운드에 작성해 확정했다(`src/calculators/housing-subscription-score/
types.ts`). 핵심 결정:

- **`HomelessIneligibleReason`을 단일 nullable 값이 아니라 배열(`homelessIneligibleReasons:
  HomelessIneligibleReason[]`)로 설계했다.** FORMULA.md "예외" 절의 두 조건("미혼 & 만 30세
  미만", "housingStatus='currently_owns'")은 서로 배타적이지 않다 — 만 29세 미혼이면서
  동시에 현재 주택을 소유 중인 사용자도 있을 수 있다. 단일 enum(nullable)으로 설계하면
  둘 중 하나만 표현할 수 있어 정보 손실이 생긴다. 이는 FORMULA.md의 공식 자체를 바꾸는
  게 아니라 "동시에 여러 사유가 성립할 수 있다"는 이미 존재하는 사실을 타입에 정확히
  반영하는 것이다.
- **`homelessPeriodCapped`/`dependentCountCapped`/`subscriptionPeriodCapped` 세 boolean을
  추가했다.** FORMULA.md "출력값" 표에는 없지만, `weekly-holiday-allowance`의
  `cappedAtStatutoryLimit` 선례(주 40시간 초과로 8시간 상한에 걸렸는지)와 정확히 같은
  성격 — 이미 `min()`으로 계산된 결과에서 유도되는 부수적 사실이며, breakdown에 "상한
  적용" 고지를 조건부로 보여주기 위해 필요하다(SPEC.md Must Have "계산 근거"). 공식을
  바꾸지 않고 이미 계산된 상태를 UI가 재판정 없이 읽게 하려는 목적이다.
- **`breakdownText`/`warnings`는 `HousingSubscriptionScoreResult`에 넣지 않았다.**
  FORMULA.md "출력값" 표는 이 둘을 계산 결과의 일부로 나열했지만, 기존 코드베이스가 이미
  확립한 경계(`weekly-holiday-allowance/formatting.ts`의 `buildWeeklyHolidayBreakdown`,
  `buildBelowMinimumWageWarning` 등 — logic.ts는 boolean·숫자만 반환하고, 문장 조립은
  `formatting.ts`가 `(input, result) => string[] / BreakdownRow[]` 형태 함수로 담당한다)를
  그대로 따른다. 이렇게 분리하면 (a) `logic.ts`가 항상 문자열이 아닌 값만 비교하는 순수
  Golden Test로 검증되고, (b) 카피 문구 수정(UX/UI Critic 피드백 등)이 계산 로직 재검증
  없이 가능하다. Builder는 `formatting.ts`에 다음 두 함수를 추가한다(이름은 예시, 실제
  네이밍은 Builder 재량):
  - `buildHousingScoreBreakdown(input, result): { label; expression; legalBasis? }[]` —
    3행(무주택기간/부양가족수/가입기간), `weekly-holiday-allowance`의 `BreakdownRow` 형태
    그대로 재사용(단, 공용 컴포넌트로 승격하지 않음 — 아직 사례 2개뿐이라 이번에도
    승격하지 않는다. 3번째 계산기에서 재검토 후보로 남긴다).
  - `buildHousingScoreWarnings(input, result): string[]` — `homelessIneligibleReasons`,
    `!input.hasSubscriptionAccount` 등 boolean/배열 필드로부터 실제 경고 문장을 조립.
- **조건부 필수 입력 필드는 `| null`이 아니라 optional(`?`)로 통일했다** —
  `parental-leave-benefit/types.ts`의 `BenefitInput`(`childBirthDate?`,
  `spouseLeaveMonths?` 등)과 같은 컨벤션이다. 새 컨벤션을 만들지 않고 기존 표기법을
  그대로 따른다.
- **`dependentCount`는 입력 타입에 두지 않고 결과 타입에만 둔다.** FORMULA.md가
  "derived"로 명시한 값(배우자+직계존속+직계비속 합)이라 입력 폼 상태와 계산 결과를
  혼동하지 않도록 결과 전용으로 분리했다.

---

## 6. UI 구조

DESIGN_SYSTEM.md "공통 화면 순서"(소개 → 사용 방법 → 입력 → 결과 → 계산 근거 → 정책 안내
→ FAQ)를 그대로 따른다. 기존 4개 공용 컴포넌트(`SectionCard`, `UsageGuide`, `IntroSection`,
`FaqAccordion`)를 그대로 재사용하고 새 Generic 컴포넌트는 만들지 않는다 — 계산기 성격이
크게 달라 억지로 하나로 묶어야 할 대상도 없다(공유할 게 있다면 "breakdown 행" 형태 정도인데
아직 사례가 2개뿐이라 위 "5."에서 이미 승격을 보류했다).

### 입력 순서 (SPEC.md "핵심 사용자 흐름" 그대로, 3개 그룹 + 공통 기준일)

1. **기준일**(`baseDate`, 기본값 오늘) — 세 항목 모두에 영향을 준다는 설명과 함께 최상단에
   단독 배치.
2. **무주택기간 그룹**: `birthDate` → `isMarried`(토글) → (참이면) `marriageDate` →
   `housingStatus`(라디오/셀렉트) → (`disposed`면) `mostRecentDisposalDate` →
   (`currently_owns`면) `smallLowValueHomeException` 체크박스 + 안내 문구.
3. **부양가족 그룹**: `hasQualifyingSpouseInHousehold`(`isMarried=false`면 비활성화/숨김) →
   `qualifyingAscendantCount` → `qualifyingDescendantCount`. 각 필드 도움말에 FORMULA.md
   "부양가족 인정 범위"의 두 요건(3년 동거+무주택, 30세 이상 1년 동거)을 일상어로 요약.
4. **청약통장 그룹**: `hasSubscriptionAccount`(토글) → (참이면) `subscriptionAccountOpenDate`
   + "전환·변경해도 최초 가입일 그대로" 도움말.

날짜 필드는 전부 `min`/`max` 지정 + validation.ts 재검증(DESIGN_SYSTEM.md "날짜 입력").
법령 용어(세대구성원, 무주택확인서 등)는 라벨이 아니라 helpText에만 노출한다
(DESIGN_SYSTEM.md "라벨 표현").

### 결과 화면

1. **핵심 결과 카드**(`bg-primary`, 계산기당 하나): `totalScore`(0~84)만 크게. 바로 아래
   한 줄로 "무주택 O점 + 부양가족 O점 + 가입기간 O점" 요약.
2. **항목별 카드 3개**(그리드): 무주택기간(점수 + 참고 연수 + eligible 여부),
   부양가족수(점수 + 인원수), 가입기간(점수 + 참고 연/개월). 각 카드에 해당 항목의
   `*Capped` 플래그가 true면 "상한 도달" 배지.
3. **경고 카드**(조건부, `bg-warning-surface`): `homelessIneligibleReasons`가 비어있지
   않으면 무주택기간 카드 바로 아래, `!hasSubscriptionAccount`면 가입기간 카드 바로
   아래 — `weekly-holiday-allowance`의 "경고 카드는 해당 항목 근처에, 여러 개면 독립적으로
   동시 노출" 패턴을 그대로 따른다(전체 결과 상단에 뭉치지 않음 — 어떤 항목이 문제인지
   바로 알 수 있어야 하므로).
4. **계산 근거(`SectionCard`, "계산 방법")**: `buildHousingScoreBreakdown` 3행을
   `weekly-holiday-allowance`와 동일한 리스트 UI(`label`/`expression`/`legalBasis`)로.
5. **정책 안내(`SectionCard` 또는 `bg-surface-subtle`)** — 이 섹션 하나에 세 가지를
   모아 둔다(SPEC.md가 요구한 고지들이 성격은 다르지만 "정책 안내"라는 화면 위치는
   DESIGN_SYSTEM.md가 이미 지정했으므로 섹션은 하나, 내부만 소제목으로 나눈다):
   - **기준일자 배지**: `policy.ts`의 `law`/`regulationVersion`/`lastVerified`/
     `nextReviewDue`를 작은 배지/캡션으로(parental-leave-benefit UI 구성 "1. 계산기 소개와
     정책 기준 배지" 패턴).
   - **적용 범위 고지**(SPEC Must Have): 민영주택 일반공급 가점제 전용, 특별공급/추첨제/
     임대주택 미적용, 자격요건 최종 판정 아님, 서버 미전송.
   - **알려진 정책 특례 미반영 3종**(SPEC Must Have, `content.ts`에 정적 텍스트로 보관):
     소형·저가주택 특례, 배우자 통장 합산, 미성년자 가입기간 상한. **조건부로 숨기지 않고
     항상 3개 모두 표시한다** — FORMULA.md가 이 셋을 "v1 한계" 고지로 규정했고 계산에
     전혀 반영하지 않으므로, 특정 입력값에 따라 골라서 보여주면 오히려 "반영되고 있다"는
     오해를 줄 수 있다(예: 미혼자에게 배우자 합산 고지를 숨기면 "배우자가 생기면 자동
     반영되는구나"라는 잘못된 기대를 줄 수 있음 — 항상 노출해 "v1 자체의 한계"임을
     분명히 한다).
6. **FAQ**: `FaqAccordion`, 콘텐츠는 `content.ts`(Should Have, 시간이 되면).

### 접근성/반응형

SPEC.md 공통 요건 그대로 — 결과 영역 `aria-live="polite"`, 모든 입력 `label` 연결,
320~1440px 무중단. 조건부 필드(혼인신고일, 처분일, 특례 체크, 가입일)가 나타났다 사라질 때
레이아웃 시프트를 최소화하도록 `severance-pay`/`weekly-holiday-allowance`의 조건부 필드
렌더링 패턴을 그대로 따른다.

---

## 7. 계산기 등록 전략

- 이번 Architect 단계에서는 등록하지 않는다(빈 URL 노출 방지, 기존 관례).
- Builder가 UI 구현을 완료하면 `registry.ts`에 다음으로 등록한다(제목/설명은 SPEC.md
  확정값, 아이콘만 이번에 제안):
  ```
  slug: "housing-subscription-score"
  title: "청약가점 계산기"
  category: "tax"
  status: "draft"
  ```
  - **아이콘**: 기존 6개 키(`coins`/`calculator`/`calendar`/`chart`/`heart`/`utility`) 중
    `chart`를 제안한다(아직 아무 계산기도 쓰지 않음 — `severance-pay`=coins,
    `unemployment-benefit`=calculator, `weekly-holiday-allowance`/`military-discharge-date`/
    `business-days`/`age-calculator`=calendar, `four-major-insurance`/`parental-leave-benefit`/
    `bmi-calculator`=heart, `military-salary`=coins. "가점 점수"라는 계산 결과의 성격이
    `chart`와 가장 잘 맞고, 시각적으로도 처음 쓰이는 키라 구분된다). `CalculatorIcon`에
    `chart` SVG 분기가 아직 없으면 Builder가 함께 추가한다(DESIGN_SYSTEM.md "아이콘").
- Calculation Auditor + UX/UI Critic + QA 통과 전에는 `published`로 바꾸지 않는다.

---

## 8. Builder 인수인계 요약

1. `policy.ts` — 위 "3." 스키마 그대로 작성. 값은 FORMULA.md "배점표 (검증 결과)"/
   "기준 / 출처" 절에서 그대로 옮긴다(새 값 추정 금지 — "확인 필요"는 그대로 "확인 필요"로).
2. `logic.ts` — FORMULA.md "공식" 1~9단계를 그대로 구현. 날짜 산술은
   `src/lib/date-calc.ts`의 `parseIsoDateUtc`/`calendarFullYearsBetweenUtc`/
   `calendarFullMonthsBetweenUtc`를 가져다 쓴다(새로 구현하지 않는다). 매직 넘버 대신
   `policy.ts` 상수만 참조.
3. `validation.ts` — FORMULA.md "입력값" 표의 허용 범위·조건부 필수(`isMarried`→
   `marriageDate`, `housingStatus==='disposed'`→`mostRecentDisposalDate`,
   `hasSubscriptionAccount`→`subscriptionAccountOpenDate`)를 검증. 날짜 선후관계
   (`birthDate ≤ marriageDate ≤ baseDate` 등)도 FORMULA.md "예외" 절 그대로.
4. `logic.test.ts` — FORMULA.md 검증 예제 12개를 그대로 Golden Test로. 추가로 총점
   불변식(`0 ≤ totalScore ≤ 84`)과 각 항목 상한 캡 불변식을 property-based 성격으로
   추가(SPEC.md 완료 기준).
5. `formatting.ts` — `buildHousingScoreBreakdown`/`buildHousingScoreWarnings`(이름 예시)
   구현. 위 "5." 경계(logic은 값만, formatting은 문장만) 유지.
6. `content.ts` — 정책 특례 고지 3종 원문(FORMULA.md "알려진 정책 특례" 절 문구를 거의
   그대로), 소개/사용법/FAQ.
7. `ui.tsx` — 위 "6." 화면 구조대로. `ShareActions`는 계산 전·후 동일 위치, 공유 상태에는
   입력값만 Base64URL로.
8. 레지스트리에 `status: "draft"`로 등록 + `calculator-components.ts` 연결.
9. 새 계산기 완료 후 기존 계산기 Smoke Test(docs/EVALUATION.md "회귀 방지") — 특히
   `src/lib/date-calc.ts`를 수정했으므로 severance-pay/unemployment-benefit의
   `logic.test.ts`가 여전히 통과하는지 반드시 확인한다(이번 변경은 기존 함수를 건드리지
   않고 새 함수만 추가했으므로 영향 없어야 하지만, 회귀 방지 원칙상 재확인 필수).

---

## 남은 리스크 / 확인 필요

- **`policy.ts`의 여러 "확인 필요" 항목**(FORMULA.md "확인 필요 항목 총정리" 1~6번 —
  별표 1 원문 최종 대조, 조문 번호, 배우자 합산 계산 방식, 2026-06-15 개정 반영 여부 등)은
  Architect 영역 밖이다. Calculation Auditor 단계에서 재확인을 권고한다(FORMULA.md가
  이미 명시).
- **age-calculator와의 날짜 산술 통합은 이번에 하지 않았다**(위 "2." 참고). age-calculator가
  QA를 통과해 안정화된 뒤, 두 구현(clamp 방식 vs 튜플 비교 방식)의 2월 29일 경계 동작
  차이를 명시적으로 비교하고 통합 여부를 재논의하는 것을 후속 과제로 남긴다.
- **vitest 실행 환경 이슈 — 오케스트레이터가 재확인한 결과 반영**: Architect 라운드는
  `npx vitest run --no-file-parallelism`이 기존 43개 파일 전부에서
  `TypeError: Cannot read properties of undefined (reading 'config')`로 실패했다고
  보고했으나, 같은 명령을 저장소 루트에서 재실행한 결과 **재현되지 않았다** — 42개 파일
  전부 통과, 1개 파일(`src/lib/date-calc.test.ts`)에서 테스트 1건만 실패했다. 원인은
  환경 문제가 아니라 **테스트 자체의 버그**였다: "20년 경과(FORMULA 예제 6)" 케이스가
  기산일(30세가 되는 날 `2006-09-06`, 1976+30) 대신 생년월일(`1976-09-06`)을 그대로
  `calendarFullYearsBetweenUtc`에 넣어 50을 기대해야 할 값을 20으로 잘못 assert하고
  있었다 — "만 30세부터 기산"은 이 순수 함수가 아니라 `logic.ts`가 담당한다는 이 문서
  "2."의 경계 설명과 정확히 일치하는 실수다. 시작일을 `2006-09-06`으로 수정해 14개 전부
  통과를 확인했다(수정 커밋: `src/lib/date-calc.test.ts`). 함수 구현(`calendarFullYearsBetweenUtc`/
  `calendarFullMonthsBetweenUtc`) 자체는 애초에 정확했다. `npx tsc --noEmit`도 정상
  통과. Architect 세션이 겪은 전체 실패는 그 세션 고유의 일시적 문제(동시 실행 충돌 등)로
  보이며, Optimizer의 별도 vitest 환경 조사는 현시점에는 불필요하다.
