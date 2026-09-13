# ARCHITECTURE: 주휴수당 계산기

Architect 구조 결정 메모. 승인된 SPEC.md · FORMULA.md 기준. 작성일 2026-09-04.
계산 공식 자체는 정의하지 않는다(FORMULA.md 소관). 여기서는 **어디에 무엇을 두는지**만 정한다.

관련 문서: docs/ARCHITECTURE.md, docs/CALCULATOR_RULES.md, docs/DESIGN_SYSTEM.md.
이 라운드에서 교차 계산기에 영향을 주는 결정(2번 `laborStandards` 스키마)은
docs/ARCHITECTURE.md "숫자 정밀도 전략" 아래가 아니라 "공용 데이터" 근처에
"결정 사례: 주휴수당 계산기" 절로도 기록했다.

---

## 1. 숫자 정밀도 전략 — JS `Number`, 스케일링/BigInt/decimal 없음 (확정)

FORMULA.md "정밀도/반올림 정책"의 제안("JS Number, 전 단위 스케일링·BigInt·decimal 불필요")을
**그대로 확정**한다. docs/ARCHITECTURE.md "숫자 정밀도 전략"의 기존 결정 사례 2건
(severance-pay = 전 단위 ×100 정수 스케일링 / unemployment-benefit = 전 단위 스케일링 없음)과
같은 형식으로 근거를 남긴다.

- **선택: 일반 `Number`(배정밀도). 전 단위(0.01원) 정수 스케일링 안 함, `BigInt`·`decimal.js`·
  `big.js` 안 씀.**
- **근거**:
  - 이 계산기는 근로기준법상 "전"(1/100원) 정밀도가 요구되는 지점이 없다. severance-pay는
    평균임금을 전 단위에서 올림 확정하는 고용노동부 방식을 따라야 해서 스케일링이 필요했지만,
    주휴수당은 통상 임금 항목으로 원 단위로 지급·정산되고 행정해석·온라인 계산기 예시도 모두
    원 단위 정수로 제시된다(FORMULA.md "단위").
  - 다루는 금액이 작다. 최대치를 넉넉히 잡아도 `weeklyHolidayPay ≤ 8 × MAX_HOURLY_WAGE
    (1,000,000) = 8,000,000`, `monthlyTotalPay ≈ (168 × 1,000,000 + 8,000,000) × 365/84
    ≈ 7.6억`으로 `Number.isSafeInteger`(약 9,007조)에 전혀 근접하지 않는다. 곱셈이 2회
    (`× hourlyWage`, `× 365`)를 넘지 않고 그 사이/후에 나눗셈이 1회뿐이라 오차가 누적될
    구조가 아니다.
  - `0.1 + 0.2` 류 이진 부동소수점 오차: 이 계산기의 유일한 위험 지점은 (a) `weeklyHours / 5`
    (예: 13.5/5 = 2.7)를 곱하는 단계와 (b) 월 환산 `× 365 ÷ 84` 뒤의 반올림이다. (a)는
    중간 반올림을 하지 않으므로 배정밀도 그대로 곱해도 표시(원 단위)에 영향이 없다. (b)는
    `roundWon()`에 아주 작은 `EPSILON`(1e-6)을 더해 `125559.9999999 → 125560`처럼 한 단계
    빗나가는 것을 막는다(severance-pay `EPSILON`, unemployment-benefit `TOTAL_BENEFIT_EPSILON`
    선례).
  - `BigInt`는 나눗셈이 정수 나눗셈뿐이라 "완전정밀도 유지 후 마지막 1회 반올림" 흐름과
    상성이 나쁘다. `decimal.js`/`big.js`는 이 금액 규모에서 실익 없이 번들만 키운다
    (docs/ARCHITECTURE.md "모든 계산기에 무조건 무거운 decimal 라이브러리를 쓰지 않는다").

### 코드 구조에 반영된 사항 (Builder 준수)

- **월 환산 `× 365 ÷ 84`**: `amount * daysPerYear / (monthsPerYear * daysPerWeek)` 형태로,
  **곱셈을 먼저 하고 나눗셈을 마지막에 1회만** 수행한다. `4.345`로 미리 반올림한 계수를 쓰지
  않는다. 세 상수(365 / 12 / 7)는 `rates-2026.json`의 `laborStandards.monthlyWeekFactor.value`
  에서 읽는다(아래 2번).
- **표시 직전 원 단위 반올림 1회**: logic.ts는 금액 필드를 **완전정밀도(반올림 전)** 로만
  반환한다. 원 단위 반올림은 `formatting.ts`의 `roundWon()` **한 함수**가 표시 직전에 각 값에
  독립적으로 1회 적용한다. 반올림된 값을 다른 값의 계산에 재사용하지 않는다는 FORMULA.md
  정책을, "logic은 exact만 반환 / 반올림은 표시 경로에만 존재"라는 구조로 강제한다.
  - `roundWon()`은 이미 스캐폴딩에 구현해 뒀다(round half up + EPSILON). FORMULA.md가 "확인
    필요"로 남긴 절사/올림 여부가 나중에 바뀌면 **이 함수 본문 한 줄만** 고친다
    (unemployment-benefit `finalizeTotalBenefit` 선례). Calculation Auditor 대조 지점.
- **`weeklyHolidayHours`는 반올림하지 않는다**: 소수 그대로 반환하고(`4.6`, `2.7`),
  `formatting.ts`의 `formatHours()`가 표시할 때만 소수 2자리로 자른다.
- **테스트 검증 규약**(logic.test.ts 골격에 명시): 완전정밀도 중간값은 `toBeCloseTo(exact, 3)`,
  FORMULA "Expected"의 반올림된 원 값은 `roundWon(result.x)` 또는 `formatWon(result.x)`로 검증.

---

## 2. 연도별 데이터 스키마 배치 — 최상위 `laborStandards` 네임스페이스 (안 A 채택)

FORMULA.md "연도별 데이터 파일 스키마"의 열린 질문(안 A: 최상위 `laborStandards` / 안 B: 계산기
전용 네임스페이스)에 대해 **안 A를 채택**하고 `src/data/rates-2026.json`에 실제로 추가했다.

- **근거**:
  - 최저임금(`minimumWage`)이 "여러 계산기가 공유하므로 최상위"에 있는 것과 정확히 같은 논리다.
    40시간·8시간은 향후 **연장근로수당 계산기**(주 40·일 8 초과 가산, 근로기준법 제56조),
    **최저임금 계산기**(주 40 + 주휴 8 → 월 209시간 환산)가 그대로 재사용한다. 15시간은
    severance-pay(퇴직금 지급요건)·unemployment-benefit(초단시간, 이미 `unemploymentBenefit`
    네임스페이스에 `referencePeriodMonths`로 부분 등장)도 개념적으로 공유한다.
  - 안 B(계산기 전용 네임스페이스)는 40/8/15가 여러 계산기에 중복 정의되어 드리프트 위험이
    생긴다. docs/ARCHITECTURE.md "결정 사례: 날짜 계산 유틸 공용화"가 "두 계산기가 별도 사본을
    유지하면 한쪽만 수정되는 드리프트 위험"을 이유로 `date-calc.ts`를 공용화한 것과 같은 판단.
  - `40/8/15/4.345`는 법·관행상 사실상 불변이라 어느 안이든 정확성 차이는 없다. 순수하게
    스키마 통일·SSOT 관점의 결정이다.
- **추가한 필드**(`rates-2026.json` 최상위 `laborStandards`, docs/CALCULATOR_RULES.md
  "데이터 파일 스키마" 준수 — `value`/`unit`/`source`/`lastVerified`/`nextReviewDue`. 값·근거는
  FORMULA.md 초안 그대로):
  - `statutoryWeeklyHours` = 40 (근로기준법 제50조제1항) — 비례식 분모, 40시간 상한
  - `statutoryDailyHours` = 8 (근로기준법 제50조제2항) — 유급주휴시간 상한
  - `ultraShortTimeWeeklyHours` = 15 (근로기준법 제18조제3항) — 게이팅 아님, 경고에만 사용
  - `monthlyWeekFactor` = `{ daysPerYear: 365, monthsPerYear: 12, daysPerWeek: 7 }` — 월 환산
    계수(관행). 계산 시 `365/84` 유리수로 사용.
- **TypeScript 영향 없음**: `unemployment-benefit/logic.ts`가 `typeof rates2026` /
  `Record<number, typeof rates2026>`를 쓰지만 최상위 키 추가는 순수 additive라 기존 타입·
  `RATES_BY_YEAR` 배선이 그대로 유효하다. `npx tsc --noEmit`, `npm run build` 통과 확인함.
- **읽는 방식**: `weekly-holiday-allowance/logic.ts`는 `rates.laborStandards.*.value`로 읽는다.
  40/8/15/365/12/7을 **계산기 코드에 하드코딩하지 않는다**(docs/ARCHITECTURE.md "공용 데이터",
  severance-pay가 15를 logic.ts에 하드코딩했던 전례를 반복하지 않기 위함).

---

## 3. 날짜 입력이 없는 계산기의 "적용 연도" — 명시적 상수 `APPLICABLE_RATE_YEAR` (확정)

이 계산기는 `hireDate`/`leaveDate` 같은 날짜 입력이 없어 "몇 년도 최저임금을 쓸지"를 입력에서
끌어낼 수 없다.

- **선택: `src/calculators/weekly-holiday-allowance/logic.ts`에 `export const
  APPLICABLE_RATE_YEAR = 2026` 명시적 상수. `getApplicableRates()`가 이 상수로
  `RATES_BY_YEAR` 맵(현재 `{ 2026: rates2026 }`)을 조회한다.**
- **`new Date().getFullYear()` 런타임 방식은 쓰지 않는다.** 2027-01-01이 되면 (아직
  `rates-2027.json`이 없을 때) 런타임에 데이터 조회가 실패해 계산기가 깨진다. 상수로 고정하면
  "데이터가 준비된 연도"와 "계산기가 적용하는 연도"가 항상 일치한다.
- 데이터 없는 연도는 조용히 폴백하지 않고 에러를 던진다(unemployment-benefit
  `getUnemploymentBenefitRatesForYear` 선례, docs/CALCULATOR_RULES.md "정확성 원칙").
- **결과에 연도를 실어 보낸다**: `WeeklyHolidayAllowanceResult.appliedRateYear`,
  `.minimumHourlyWage`. UI는 JSON을 직접 import하지 않고 결과 객체에서 읽어 정책 고지·최저임금
  경고 문구를 만든다(unemployment-benefit이 `minBenefitDailyAmount` 등을 결과에 실은 것과 동일).

### rates-2027.json 은 이번에 만들지 않는다 — 후속 과제

- 2027년 적용 최저임금 시간급 **10,700원**은 이미 고시됐다(FORMULA.md "기준/출처" 확인).
  그러나 검증되지 않은 다른 필드(있다면)까지 담은 `rates-2027.json`을 임의로 생성하지 않는다.
- **후속 과제(Builder 아님, 별도 라운드)**: `rates-2027.json` 생성은 Formula Analyst가
  2027년 적용 수치(최저임금 10,700원 + 필요 시 `laborStandards` 재확인)를 확인한 뒤 진행한다.
  파일이 준비되면 `logic.ts`에서 (a) `import rates2027`, (b) `RATES_BY_YEAR`에 `2027` 추가,
  (c) `APPLICABLE_RATE_YEAR`를 2027로 변경 — 이 **한 파일 세 줄**만 고치면 된다.

---

## 4. `rates-2026.json` `minimumWage.hourly.source` 문구 정정 (완료)

FORMULA.md 권고대로 정정했다(Architect는 데이터 파일 Edit 권한 있음. Formula Analyst는 없음):

- `source.law`: `"최저임금법"` → `"최저임금법 제10조"`
- `source.article`: `"최저임금 고시(2026년 적용)"` →
  `"고용노동부 고시 제2025-47호(2025-08-05 고시, 2026-01-01 시행)"`
- `lastVerified`: `"2026-09-02"` → `"2026-09-04"` (FORMULA.md "기준/출처"가 값 10,320원을
  2026-09-04에 moel.go.kr enewsView로 재확인. 값 자체는 불변).
- `note`에 정정 경위 한 줄 추가. `value`(10320)·`effectiveDate`·`url`·`nextReviewDue`는 불변.
- unemployment-benefit은 `minimumWage.hourly`를 직접 읽지 않고 미리 계산된
  `unemploymentBenefit.minBenefitDailyAmount.value`(66048)를 읽으므로 영향 없음. 빌드/타입 통과.

---

## 5. 폴더 / 파일 구조 — `src/calculators/weekly-holiday-allowance/`

docs/ARCHITECTURE.md "계산 로직 / UI 분리" 표준 6파일. Architect가 이번에 스캐폴딩했다.

| 파일 | 이번 라운드 상태 | Builder가 할 일 |
|---|---|---|
| `types.ts` | **완성** — FORMULA.md 입력값/출력값 표를 실제 타입으로 옮김 | 원칙적으로 수정 불필요(필요 시 파생 필드만) |
| `logic.ts` | 스텁 — `APPLICABLE_RATE_YEAR`/`getApplicableRates()`는 실제 구현(3번 결정), 메인 함수는 `throw` + TODO 주석(공식 1~10단계 나열) | `calculateWeeklyHolidayAllowance` 본문을 FORMULA.md "공식"/"계산 순서"대로 구현 |
| `logic.test.ts` | 골격 — FORMULA.md 검증 예제 7개 + Edge Case를 `it.todo`로, 각 I/O를 주석에 명시 | `it.todo` → 실제 `it()` + `expect()`. 반올림 검증 규약(1번)대로 |
| `validation.ts` | 스텁 — Raw 타입/결과 타입/상수(`MAX_WEEKLY_HOURS`=168, `MAX_HOURLY_WAGE`=1,000,000)는 실제, 함수는 `throw` + TODO | `validateWeeklyHolidayAllowanceInput` 구현. severance-pay의 `toOptionalNumber`/`particle` 헬퍼 패턴 재사용 |
| `formatting.ts` | 부분 완성 — `roundWon`/`formatWon`/`formatHourlyWage`/`formatHours` 구현(기계적 표시 헬퍼 + 반올림 정책) | breakdown "라벨 = 값" 수식 문자열, 경고 문구 조립 추가 |
| `ui.tsx` | 스텁 — `"use client"` + `return null` + 상세 구현 지침 주석 | 전체 화면 구현 (6번) + `calculator-components.ts` 연결 |

- `src/lib/date-calc.ts`는 **쓰지 않는다** — 이 계산기에 날짜 연산이 없다.
- 필요 시 `seo-content.ts`(FAQ SEO 항목)를 Builder가 추가하고 `app/calculators/[slug]/page.tsx`의
  `faqItemsBySlug`에 등록한다(severance-pay 선례, JSON-LD FAQPage). 이번에 스캐폴딩하지 않음
  (콘텐츠 파일이라 6파일 표준 밖).

### 입력 필드 설계 (SPEC이 Architect에 위임한 항목)

- **필드 2개뿐**: `hourlyWage`("시급", 원), `weeklyHours`("주 근무시간", 시간). 순서도 이대로
  (금액 → 시간). 월급 입력 모드 없음(SPEC Could Have).
- **`hourlyWage`: 정수만 허용.** `inputMode="numeric"`, 실시간 천 단위 콤마(severance-pay
  `handleAmountChange` 패턴), placeholder 예 `"10320"`. 근거: 국내 시급·최저임금·채용공고가 전부
  원 단위 정수이고 대상 사용자(알바·시간제)가 시급을 소수로 인지하지 않는다. 공식은 실수도
  처리하지만 입력 UX에서 소수를 막아 "10,320.5원" 같은 혼란을 없앤다. validation이 비정수 거부.
- **`weeklyHours`: 소수 허용, `step=0.5`.** `inputMode="decimal"`, placeholder 예 `"20"`.
  근거: 휴게시간을 뺀 실근로시간이 13.5시간처럼 소수로 떨어지는 게 자연스럽다(FORMULA.md 예제 7).
  `step`은 UI 힌트일 뿐 — validation에서 0.5 배수를 **강제하지 않는다**(13.3 등도 허용). 범위
  `> 0`, `<= 168`. 40 초과·15 미만은 오류 아님(logic이 상한/경고 처리).
- **라벨·순서**(docs/DESIGN_SYSTEM.md "입력 라벨·순서"): 라벨은 일상어("시급", "주 근무시간").
  "소정근로시간" 등 법령 용어는 helpText로. `weeklyHours` helpText 예: "근로계약서상 1주
  소정근로시간이며, 휴게시간은 제외합니다." `hourlyWage` helpText 예: "세금 공제 전, 시간당
  임금을 입력하세요." 같은 개념은 입력·결과·오류 메시지에서 한 용어로 통일("주 근무시간"으로
  정했으면 오류 메시지도 "주 근무시간").
- **Reset / Sample**: SPEC대로 FORMULA.md 검증 예제 값을 샘플로 사용한다. **권장: 예제 1
  (`hourlyWage=10320`, `weeklyHours=40`)** — 두 경고(15시간 미만·최저임금 미만)가 모두 뜨지
  않아 첫인상이 깔끔하고 핵심 결과가 정수(82,560원). 대상 사용자에 더 가까운 예제 2
  (`10000`/`20`, 노동OK·고용노동부 예시)를 쓰고 싶으면 "최저임금 미만 경고가 샘플에서 바로
  보이는" 것을 감수하고 Builder가 선택 가능(SPEC이 문구·샘플을 Builder 재량으로 둠).

---

## 6. 공통 컴포넌트 재사용 — 새 Generic 컴포넌트 만들지 않음

- **그대로 재사용**(`components/calculator/`): `SectionCard`, `UsageGuide`, `IntroSection`,
  `FaqAccordion`. 새로 만들지 않는다(docs/DESIGN_SYSTEM.md "공통 화면 순서"·"참고 구현").
- **핵심 결과 카드**(1주치 주휴수당): docs/DESIGN_SYSTEM.md "핵심 결과 카드" 패턴
  (`rounded-2xl bg-primary p-6 text-primary-foreground ...`)을 `ui.tsx`에 인라인. 계산기당 하나.
  severance-pay/unemployment-benefit도 인라인이라 컴포넌트화하지 않는다. (b) 월 환산액, (c) 총
  급여, (d) 실질 시급은 계산 근거(breakdown) `SectionCard`에 배치.
- **경고 카드 2종**(독립 조건): docs/DESIGN_SYSTEM.md "경고/미충족 카드" 패턴
  (`rounded-2xl border border-warning-border bg-warning-surface p-6`)을 `ui.tsx`에 인라인.
  - `result.meetsMinHoursRequirement === false` → "15시간 미만이면 주휴수당이 발생하지 않습니다
    (근로기준법 제18조제3항)" (FORMULA.md 문구)
  - `result.belowMinimumWage === true` → "입력한 시급이 {result.appliedRateYear}년 최저임금
    시간당 {result.minimumHourlyWage}원보다 낮습니다" + 수습 감액 보조 문구(FORMULA.md "최저임금
    경고 문구")
  - 두 카드는 서로 독립이라 동시에 뜰 수 있다. 마크업이 겹치면 `ui.tsx` 내부 지역 서브
    컴포넌트로 묶는 정도는 허용(공용 컴포넌트로 승격하지 않음 — 아직 사례 1개).
- **`result.cappedAtStatutoryLimit === true`** → breakdown에 "주 40시간을 초과한 시간은 주휴수당
  산정에 포함되지 않습니다 / 연장근로 가산수당은 계산하지 않습니다" 고지.
- `date-calc.ts` 불필요(날짜 연산 없음).
- `aria-live="polite"`(결과 영역), 입력-오류 `aria-describedby` 연결 등 접근성은
  docs/DESIGN_SYSTEM.md "접근성" + severance-pay/ui.tsx 패턴 그대로.

---

## 7. 레지스트리 등록 (완료) — `status: "draft"`

`src/calculators/registry.ts`에 추가함:

```
slug: "weekly-holiday-allowance"
title: "주휴수당 계산기"
description: "시급과 1주 근무시간만 입력하면 1주치 주휴수당, 월 환산 참고액, 주휴수당을 포함한 총 급여를 계산 과정과 함께 알려줍니다."
icon: "calendar"
category: "labor"
status: "draft"
lastModified: "2026-09-04"
```

- **아이콘 `calendar`**: severance-pay=`coins`, unemployment-benefit=`calculator`가 이미
  쓰는 중이라 남은 키 중 `calendar`를 골랐다("유급 주휴일" = 주 1회 쉬는 날 개념과도 부합).
  `calendar`는 이미 `CalculatorMeta.icon` 유니온에 있으므로 타입 변경은 없고,
  `components/calculator/CalculatorCard.tsx`의 `CalculatorIcon`에 `calendar` SVG 분기를
  **함께 추가**했다(기존엔 `coins`/`calculator`만 분기, 나머지는 기본 문서 아이콘으로 fallback
  → 시각적 구분이 안 되므로). 달력 그리드 + 상단 고리 + 강조 칸 글리프, 기존 stroke 스타일 동일.
- **`calculator-components.ts`는 이번에 건드리지 않음**: `ui.tsx`가 아직 빈 컴포넌트라 지금
  연결하면 URL 직접 접근 시 빈 화면이 라우팅된다. Builder가 `ui.tsx`를 구현하면서 같은 커밋에서
  `calculatorComponents["weekly-holiday-allowance"] = WeeklyHolidayAllowanceCalculatorUi` 추가.
- draft라서 sitemap/robots/홈/카테고리 목록에 노출되지 않고(`getPublishedCalculators()` 필터),
  `calculator-components.test.ts`(published만 검사)·`registry.test.ts`에 영향 없음. `npm run build`
  결과에 `/calculators/weekly-holiday-allowance` 라우트가 나타나지 않는 것을 확인함(정상).
- **published 전환**은 Builder 권한 밖 — Calculation Auditor + UX/UI Critic + QA 통과 후
  별도 절차(docs/EVALUATION.md).

---

## Builder 인수인계 요약 (해야 할 일)

1. `logic.ts` — `calculateWeeklyHolidayAllowance` 구현. FORMULA.md "공식" 1~10단계. 상수는
   `getApplicableRates().laborStandards.*` / `.minimumWage.hourly.value`에서 읽기(하드코딩 금지).
   금액은 완전정밀도로 반환(반올림은 `roundWon`이 표시에서만).
2. `validation.ts` — `validateWeeklyHolidayAllowanceInput` 구현. hourlyWage 정수/`>0`/`≤1,000,000`,
   weeklyHours 소수허용/`>0`/`≤168`. 15미만·40초과·최저임금미만은 오류 아님.
3. `logic.test.ts` — `it.todo` 7개 + Edge Case를 실제 테스트로. 반올림 검증 규약(1번) 준수.
4. `formatting.ts` — breakdown 수식 문자열·경고 문구 조립 추가.
5. `ui.tsx` — 전체 화면(6번 지침) + `calculator-components.ts` 연결. 소개/FAQ 카피는
   FORMULA.md "소개 문구"/"FAQ 콘텐츠" 원문 그대로.
6. `seo-content.ts` 신규 + `app/calculators/[slug]/page.tsx` `faqItemsBySlug` 등록(JSON-LD).
7. 새 계산기 완료 후 기존 계산기 Smoke Test(docs/EVALUATION.md "회귀 방지").

## 남은 리스크 / 확인 필요

- **기본 `npm test`(= `vitest run`)가 이 샌드박스에서 실패함**(Architect 스캐폴딩 무관, 선재
  환경 이슈): 파일 병렬 실행 시 10개 테스트 파일 전부 `TypeError: Cannot read properties of
  undefined (reading 'config')`로 죽는다(내가 손대지 않은 `severance-pay` 테스트도 동일 → 내
  변경이 원인 아님). **`npx vitest run --no-file-parallelism`로 실행하면 전부 통과한다** —
  기존 9개 파일 102 테스트 pass, 새 `logic.test.ts`는 16 todo(스킵). docs/ARCHITECTURE.md가
  적어 둔 "Windows 샌드박스에서 자식 프로세스 생성 실패"와 같은 계열의 문제로 보인다.
  `npx tsc --noEmit`·`npx eslint`·`npm run build`는 병렬과 무관하게 모두 통과.
  Builder/QA는 이 환경에서 `--no-file-parallelism`을 쓰거나, Optimizer가 `vitest.config.mts`에
  `test.fileParallelism: false`를 넣는 것을 검토(모든 계산기에 영향 → Architect가 단독으로
  바꾸지 않음).
- **반올림 방향(반올림/절사/올림)**: FORMULA.md "확인 필요" 1번. `roundWon`을 단일 함수로
  분리해 뒀으니 Calculation Auditor가 노동OK/알바천국에 예제 1·2를 넣어 최종 표시값을 대조한 뒤
  이 함수만 조정하면 된다.
- **월 환산 4.345 직접 곱셈 vs 209시간 관례**: FORMULA.md "확인 필요" 2번. 주 40시간
  근로자의 `monthlyTotalPay`가 최저임금 고시상 최저월급과 약 4,423원 차이. 이 계산기는
  4.345(365/84) 직접 곱셈 채택. UI가 월 환산액을 "참고액"으로 명확히 라벨링하고 필요 시
  주석(FORMULA.md "월 환산 계수" 절)을 달 것.
- **`laborStandards` `source`에 `effectiveDate` 없음**: FORMULA.md 초안을 그대로 따랐고 기존
  `unemploymentBenefit.insuredUnitPeriodRequiredDays`도 `law`+`article`만 있어 선례와 일치한다.
  정부 원문(별표1/별표2) 직접 대조는 FORMULA.md "확인 필요" 5번으로 남아 있음(Architect 영역
  밖).
