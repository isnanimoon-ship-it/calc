# ARCHITECTURE: 부동산 중개수수료(중개보수 상한액) 계산기 (real-estate-brokerage-fee-calculator)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-18.
계산 공식 자체(요율표 수치, 환산보증금 산식, 경계값)는 정의하지 않는다(Formula Analyst
소관) — 이 문서는 그 공식을 정확히·안전하게 구현할 수 있는 코드 구조, 정책 데이터 배치,
타입, 숫자 정밀도 전략, UI 정보 구조를 정한다.

관련 문서: `docs/ARCHITECTURE.md`, `docs/CALCULATOR_RULES.md`, `docs/DESIGN_SYSTEM.md`.
참고 선례: `tasks/housing-acquisition-tax/ARCHITECTURE.md`(계산기 전용 `policy.ts` 배치
기준, raw/display 분리를 함수 경계로 강제하는 방식, 4단 정책 고지 그룹화), `tasks/
loan-interest-calculator/ARCHITECTURE.md`·`tasks/minimum-wage-calculator/ARCHITECTURE.md`
(discriminated union 설계, 공통 필드 교차 타입 합성, "체이닝 금지"류 방어), `tasks/
deposit-savings-interest-calculator/ARCHITECTURE.md`(모드 토글 UI).

---

## 0. 레지스트리 상태 확인

`src/calculators/registry.ts` 확인 결과 `real-estate-brokerage-fee-calculator` slug는
등록되어 있지 않다("중개", "중개보수", "brokerage" 관련 계산기 없음 — SPEC.md 확인과
일치). **이번 Architect 라운드에서도 등록하지 않는다**(`housing-acquisition-tax` 등
기존 관례 — Builder가 UI 구현을 마친 뒤 `status: "draft"`로 등록한다).

이번 라운드에서 실제로 작성한 파일:
- `src/calculators/real-estate-brokerage-fee-calculator/types.ts`: 신규 작성(아래 "2.").
- `src/calculators/real-estate-brokerage-fee-calculator/policy.ts`: 신규 작성(아래 "1.").
- 이 문서.

`logic.ts`/`validation.ts`/`formatting.ts`/`content.ts`/`ui.tsx`는 아직 없다(Builder 몫).
`PROGRESS.md`는 이번 라운드에서 수정하지 않는다 — 해당 행의 "다음 재검토 예정일" 칸이
이미 FORMULA.md의 "조기 재검토 트리거"를 정확히 반영하고 있고, "Build" 칼럼은 아직
Architect 산출물뿐이라 여전히 TODO가 정확하다(housing-acquisition-tax가 Formula 칼럼
오기를 발견해 정정한 것과 달리, 이번엔 정정할 불일치가 없다).

---

## 1. 요율표 데이터 배치 — 계산기 전용 `policy.ts` (완료)

### 1.1 결정: `rates-{year}.json`이 아니라 `src/calculators/real-estate-brokerage-fee-calculator/policy.ts`

`docs/ARCHITECTURE.md` "결정 사례: 정책 데이터를 언제 계산기 전용 `policy.ts`에 두는가"의
두 기준을 그대로 적용한다.

- **1차 기준(재사용 가능성)**: 매매·임대차 중개보수 요율표, 환산보증금 산식 상수를
  재사용할 다른 계산기가 없다(SPEC.md "계산기 중복 금지 검토"가 이미 확인). `four-major-
  insurance`의 사회보험 요율처럼 여러 계산기가 공유하는 성격이 아니다.
- **2차 기준(연도 축 적합성)**: FORMULA.md "기준/출처"가 스스로 명시한다 — "이 값은 연
  1회 고시가 아니라 조례·시행규칙 개정 시에만 바뀌므로, '조기 재검토 트리거'가 더
  중요하다." 실제로 현재 요율표는 2021-10-19 시행규칙 개정 이후 5년째 변경이 없다.
  `rates-2026.json`에 넣으면 "2026년 한정 값"이라는 오해를 준다 — `housing-acquisition-
  tax`(지방세법 수시 개정)·`housing-subscription-score`(「주택공급에 관한 규칙」 수시
  개정)와 정확히 같은 논리다.

**결론**: `housing-acquisition-tax/policy.ts`와 동일한 "단일 최신본" 방식(`lastVerified`/
`nextReviewDue`를 파일 최상단에 한 번만 두고, 항목마다 반복하지 않음)을 채택한다.

### 1.2 스키마와 구조

`docs/CALCULATOR_RULES.md` 데이터 파일 스키마(`value`/`unit`/`source{law,article,
effectiveDate,url}`/`lastVerified`/`nextReviewDue`)의 정신을 따르되, 이 계산기는 "값
하나"가 아니라 "6단계 구간표 2개 + 환산보증금 상수 1세트"를 다루므로 각 표/상수 블록에
`source`를 붙이는 방식을 쓴다(housing-acquisition-tax의 `standardRate`/`heavyRate`/
`localEducationTax`/`ruralSpecialTax` 각 블록에 `source`를 붙인 것과 동일 패턴).

```
REAL_ESTATE_BROKERAGE_FEE_POLICY
  lastVerified / nextReviewDue / earlyReviewTriggers[]   ← FORMULA.md "조기 재검토 트리거" 그대로
  saleTiers: FeeTier[] (6행) + saleTiersSource            ← FORMULA.md "1. 주택 매매·교환..." 표
  leaseTiers: FeeTier[] (6행) + leaseTiersSource          ← FORMULA.md "2. 주택 임대차..." 표
  convertedDepositException: { thresholdExclusiveUpperBound, defaultMultiplier,
                                exceptionMultiplier, source }  ← FORMULA.md "3." 환산보증금 산식

REAL_ESTATE_BROKERAGE_FEE_OPEN_QUESTIONS: string[]       ← FORMULA.md "확인 필요 목록" 6개 그대로
```

이미 작성 완료했다(`npx tsc --noEmit`으로 구문 오류 없음 확인, 아래 "9." 참고). 값은
FORMULA.md "공식 1·2·3"과 "기준/출처"에서 그대로 옮겼다 — 새로 추정한 값은 없다.

### 1.3 `policy.ts`는 `types.ts`를 import하지 않는다 (기존 관례 재확인)

`housing-acquisition-tax/policy.ts`와 `annual-salary-take-home-pay/policy.ts` 둘 다
`types.ts`의 인터페이스를 import하지 않고, `as const` 리터럴 객체만으로 정책 데이터를
정의한다 — 이 계산기도 동일하게 따른다. `saleTiers`/`leaseTiers` 배열의 각 원소는
`types.ts`의 `FeeTier` 인터페이스와 **구조적으로** 호환되므로(TypeScript 구조적 타이핑),
`logic.ts`가 `POLICY.saleTiers`를 `FeeTier[]`가 필요한 자리에 그대로 넘겨도 타입 에러가
나지 않는다 — 명시적 import 없이도 계약이 성립한다. 이 방향을 뒤집어 `types.ts`가
`policy.ts`를 import하는 것은 금지한다(housing-acquisition-tax "7." 원칙 재확인 — 정책
데이터 파생 타입은 `logic.ts` 로컬에 두거나, 이번처럼 `types.ts`가 먼저 범용 shape를
정의하고 정책 데이터가 그 shape을 구조적으로 따르게 한다).

### 1.4 조례명 표기 정정 반영

FORMULA.md가 SPEC.md를 정정한 사실("서울특별시 부동산 중개보수 등에 관한 조례"가 아니라
**"서울특별시 주택 중개보수 등에 관한 조례"**, 서울특별시조례 제8585호)을 `policy.ts`
`source.law`/`article` 주석에 정확한 명칭으로 반영했다. Builder가 `content.ts`(정책 고지
문구)를 작성할 때도 이 정정된 명칭을 그대로 써야 한다.

---

## 2. 입력/결과 타입 — discriminated union 설계 (완료)

### 2.1 입력: `transactionType`을 판별 태그로 쓰는 2-way union

`SaleBrokerageFeeInput`(`transactionType: "sale"`, `salePrice`)과
`LeaseBrokerageFeeInput`(`transactionType: "lease"`, `deposit`, `monthlyRent`)로 나눈다 —
`minimum-wage-calculator`의 `HourlyModeInput | MonthlyModeInput`, `loan-interest-
calculator`의 `repaymentMethod` 판별과 동일한 패턴이다. 필드 이름 자체가 겹치지 않는다
(`salePrice` vs `deposit`/`monthlyRent`) — 이는 `docs/CALCULATOR_RULES.md` "서로 다른
계산 방식을 같은 공식으로 처리하지 않는다"를 타입 레벨에서 강제하는 1차 방어선이다
(minimum-wage-calculator "3.2" "입력 타입과 결과 타입의 필드 이름이 겹치지 않는다"와
동일한 방어).

**"체이닝 금지" 방어가 이 계산기에 그대로 적용되지는 않는다는 점을 명시한다.**
`minimum-wage-calculator`(시급↔월급 양방향 환산)와 달리 매매와 임대차는 서로 변환하는
개념이 아니다 — "환산 월급을 다시 시급 입력에 넣는" 것과 같은 왕복 구조 자체가 존재하지
않는다. 따라서 "결과값을 다른 모드의 입력으로 재입력하면 안 된다"는 방어 논리는 이
계산기에 적용할 대상이 없다. 다만 같은 계열의 다른 원칙(함수 시그니처를 모드별로 완전히
분리, 입력/결과 필드명 비중복)은 여전히 유효해 그대로 적용했다.

**UI 규칙(Builder에게 명시적으로 요구)**: 거래 유형 토글을 전환하면 금액 입력 필드(매매
가격, 보증금, 월차임)는 모두 빈 값으로 초기화한다 — `deposit-savings-interest-
calculator`/`minimum-wage-calculator`의 "모드 전환 시 입력값 유지하지 않는다" 관례를
그대로 따른다(체이닝 버그 방지 목적은 아니지만, "매매가격 3억"을 보여준 채로 임대차로
전환했을 때 그 숫자가 보증금 칸에 남아 있으면 사용자가 실수로 그대로 계산 버튼을 누를
위험이 있다 — SPEC.md "부동산 종류 확인" 수준의 사용자 실수 방지와 같은 취지).

### 2.2 결과: 공통 필드 교차 타입 + 판별 유니온

```ts
interface BrokerageFeeResultBase {
  baseAmount: Won;
  appliedTier: FeeTier;
  appliedRate: Rate;
  isCapApplied: boolean;
  maxBrokerageFee: Won;
}

type RealEstateBrokerageFeeCalculatorResult =
  | (BrokerageFeeResultBase & { transactionType: "sale" })
  | (BrokerageFeeResultBase & {
      transactionType: "lease";
      convertedDeposit: Won;
      isLowDepositExceptionApplied: boolean;
    });
```

`convertedDeposit`/`isLowDepositExceptionApplied`는 FORMULA.md "출력값" 표가 명시한 대로
**임대차 전용**이다 — `loan-interest-calculator`의 `LoanCalculationBase`, `minimum-wage-
calculator`의 `MinimumWageComparisonBase`와 동일하게 공통 필드는 비공개 인터페이스로
뽑아 교차 타입(`&`)으로만 합성한다(반복 나열 제거, `호출부가 transactionType으로
분기하지 않고는 임대차 전용 필드에 접근할 수 없다`는 강제 효과도 동일하게 얻는다). 단일
인터페이스에 `convertedDeposit?: Won`처럼 optional 필드로 두지 않는 이유도
`docs/CALCULATOR_RULES.md`가 명시한 원칙과 기존 선례(위 계산기들)를 그대로 따른 것이다.

`SaleBrokerageFeeResult`/`LeaseBrokerageFeeResult`(`Extract<...>` 유틸리티 타입)도
`minimum-wage-calculator`의 `HourlyModeResult`/`MonthlyModeResult` 선례를 따라 함께
export했다 — `calculateSaleBrokerageFee`/`calculateLeaseBrokerageFee`(아래 "5.")의 반환
타입으로 쓴다.

### 2.3 `appliedRate` 필드는 `appliedTier.rate`와 항상 같다 — 드리프트 방지는 구현 계약으로

FORMULA.md "출력값" 표가 `appliedRate`와 `appliedTier`를 별도 출력값으로 정의했다(전자는
계산 근거 화면에서 가장 자주 쓰이는 값이라 최상위에 두는 편의 필드, 후자는 구간 전체
정보). 두 값이 항상 같아야 하는데(같은 `tier` 객체에서 파생), Builder가 실수로
`appliedRate`를 별도 조회 로직으로 채우면 드리프트가 생길 수 있다 — 아래 "5."의
`calculateFeeFromTier(baseAmount, tier)` 함수가 `appliedRate: tier.rate`를 **자신에게
전달된 바로 그 `tier` 인자**에서만 파생시키도록 강제한다(단일 진입점, 별도 조회 없음).
Builder는 이 계약을 지켜야 한다 — Golden Test에 `result.appliedRate === result.appliedTier.rate`
불변식 검증을 포함할 것을 권장한다.

---

## 3. 한도액·상한 없는 구간의 표현 — `null` (완료, `FeeTier`)

```ts
export interface FeeTier {
  lowerBoundInclusive: Won;       // 이 구간 하한(포함). 최저 구간은 0.
  upperBoundExclusive: Won | null; // 이 구간 상한(미포함). 최고 구간(상한 없음)은 null.
  rate: Rate;
  cap: Won | null;                 // 정액 한도액. 한도 없는 구간(대다수 고가 구간)은 null.
}
```

- `undefined`(optional 필드 생략)가 아니라 **명시적 `null`**을 쓴다 — `cap` 필드 자체가
  존재하지 않는 것(설계 누락처럼 보일 수 있음)과 "이 구간은 한도액이 없다는 것을 확인해
  명시적으로 기록한 것"을 구분하기 위함이다. `housing-acquisition-tax`의 `heavyRate.rows`가
  `rate: null`로 "중과 대상 아님"을 명시적으로 표현한 것과 동일한 관례.
  `upperBoundExclusive: null`도 같은 이유로 "최고 구간, 상한 없음"을 명시한다.
- `isCapApplied`/`maxBrokerageFee` 계산 시 `tier.cap !== null`으로 좁혀야 하고,
  `tier.cap == null`(loose equality)로 `undefined`까지 함께 걸러내는 방식은 쓰지 않는다
  (이 필드에 `undefined`가 올 일이 애초에 없으므로 strict `!== null`이 더 정확한 의도
  전달이다).

---

## 4. raw/display 분리 — `rawFee`는 타입에 없다, `calculateFeeFromTier`가 유일한 경계

### 4.1 원칙

FORMULA.md "정밀도/반올림 정책"의 핵심 불변식: **`rawFee`(요율×거래금액, 완전정밀도)와
한도액 비교는 반올림 전 값으로 수행하고, 최종 `maxBrokerageFee` 하나에만 원 단위
사사오입을 1회 적용한다.** `housing-acquisition-tax`가 `acquisitionTaxRaw`를 지역
변수로만 두고 절사 후 값만 타입에 실은 것과 동일한 원칙을 적용한다.

`types.ts`의 `BrokerageFeeResultBase`에는 `rawFee`/`feeBeforeRounding` 같은 필드가
**없다**. 이 값들은 `logic.ts`의 `calculateFeeFromTier` 함수 내부 지역 변수로만
존재해야 한다(Builder 구현 계약, 아래 "5." 참고) — 이 함수 하나가 "raw/display 경계"
전체를 담당하는 유일한 지점이다.

### 4.2 "계산 근거" 화면이 중간값을 보여줘야 할 때 — `formatting.ts`가 표시 전용으로 재계산한다

이 계산기는 `housing-acquisition-tax`와 다른 지점이 있다: 그쪽은 raw와 최종 표시값의
차이가 10원 미만(절사 폭)이라 UI가 raw를 보여줄 필요 자체가 없었지만, 이 계산기는
한도액이 적용되면 `rawFee`와 `maxBrokerageFee`가 **의미 있게 다른 숫자**가 된다(예: 요율
적용 시 270,000원이 나왔지만 한도액 250,000원이 더 낮아 그 금액이 적용됨). SPEC.md/사용자
요구 UI 레이아웃(아래 "8.")은 "한도액 비교" 단계에서 이 두 숫자를 나란히 보여줄 것을
요구한다.

**해결책**: `formatting.ts`(표시 전용 계층)가 이미 결과 타입에 노출된 `baseAmount`와
`appliedRate`(또는 `appliedTier.rate`)로부터 "요율 적용 금액(참고용)"을 **다시 계산해서
표시 문자열만 만든다** — 이 재계산값은,
1. `types.ts`/`logic.ts`의 어떤 필드에도 저장되지 않고,
2. 어떤 반올림·한도 판정에도 재사용되지 않으며(그 판정은 이미 `logic.ts`가 완전정밀도로
   끝낸 뒤 `isCapApplied`/`maxBrokerageFee`로 확정해 넘겨준 상태),
3. 표시 목적으로만 원 단위 반올림해 보여준다(참고용 반올림이며, 완전정밀도 값과
   1원 미만 차이가 날 수 있다는 점은 문제가 되지 않는다 — 어차피 이 숫자 자체가
   "확정 금액"이 아니라 "계산 과정을 보여주는 설명용 숫자"이기 때문이다).

이렇게 하면 `docs/ARCHITECTURE.md` "집계(숫자를 만들어내는 연산)는 formatting.ts가 아니라
logic.ts가 담당한다"는 일반 원칙과 충돌하지 않는가? **충돌하지 않는다** — 그 원칙은
"결과에 실제로 쓰이는 새 숫자(예: 연도별 합계)"를 formatting.ts가 만들어내는 것을
금지하는 것이고, 여기서 재계산하는 값은 애초에 계산 결과의 일부가 아니라 **이미 확정된
`baseAmount`·`appliedRate`를 사용자에게 다시 풀어 설명하는 표시 전용 부산물**이다(엄밀히
말해 "표시 직전 포맷팅"의 연장선 — `baseAmount`와 `appliedRate`라는 두 숫자를 곱해서
보여주는 것은 새로운 도메인 지식을 계산하는 것이 아니라 이미 있는 두 필드를 사람이 읽기
좋게 조합하는 것이다). Builder가 이 재계산 함수를 만들 때 함수명에
`ForDisplay`/`Reference` 등을 넣어(예: `formatRateAppliedAmountForDisplay`) 이 값이
공식 계산 결과가 아님을 코드에서도 드러낼 것을 권장한다.

---

## 5. 구간 판정 로직 — 매매·임대차 공용 함수로 통합 (완료 설계, Builder 구현)

### 5.1 `findFeeTier`: 두 표에 재사용 가능한 단일 함수

FORMULA.md의 매매표·임대차표는 둘 다 "6단계, 하한 포함·상한 미포함" 구조가 완전히
동일하다 — 데이터(요율·한도액 수치)만 다르다. `docs/ARCHITECTURE.md`의 "한 계산기 내부에서
≥2회 재사용되는 것만으로도 공용 함수로 뽑을 이유가 된다"는 기준(`d-day-calculator`
`weekday` 재사용 사례)을 그대로 적용해, 구간 판정을 **단 하나의 함수**로 통합한다.

```ts
// logic.ts (Builder 작성)
function findFeeTier(tiers: readonly FeeTier[], baseAmount: Won): FeeTier {
  const tier = tiers.find(
    (t) =>
      baseAmount >= t.lowerBoundInclusive &&
      (t.upperBoundExclusive === null || baseAmount < t.upperBoundExclusive),
  );
  if (!tier) {
    // 정상 입력이면 도달 불가 — 마지막 구간의 upperBoundExclusive가 항상 null이므로
    // baseAmount > 0인 한 반드시 어느 구간과 매칭된다. 방어적으로만 던진다.
    throw new Error("baseAmount가 어느 요율 구간에도 매칭되지 않았습니다");
  }
  return tier;
}
```

- `src/lib/`로 뽑지 않고 이 계산기의 `logic.ts` 로컬 함수로 둔다 — 다른 계산기가 지금
  당장 필요로 하지 않고(재사용 근거 없음), `housing-acquisition-tax`의 세율 구간 판정도
  산식 기반이라 이 함수와 모양이 다르다. 훗날 "구간표 + 하한포함·상한미포함" 패턴을 쓰는
  계산기가 새로 생기면 그때 `src/lib/tier-lookup.ts`로 승격을 검토한다(지금 미리
  일반화하지 않는다 — `docs/ARCHITECTURE.md`가 반복 확인한 "지금 당장 필요한 범위만
  공유한다" 원칙).

### 5.2 `calculateFeeFromTier`: 요율 적용→한도액 비교→반올림도 매매·임대차가 완전히 공유

구간을 찾은 **이후**의 절차(FORMULA.md "계산 순서" 4~6단계: 요율 적용, 한도액 비교,
최종 반올림)도 매매·임대차가 완전히 동일한 로직이다 — 매매/임대차 여부와 무관하게
"baseAmount + 매칭된 tier"만 있으면 결정된다. 이 부분까지 함께 공유 함수로 뽑는다(위
"4.1"의 raw/display 경계와 정확히 일치하는 지점이라 한 번에 설계했다).

```ts
function calculateFeeFromTier(
  baseAmount: Won,
  tier: FeeTier,
): Pick<BrokerageFeeResultBase, "appliedRate" | "isCapApplied" | "maxBrokerageFee"> {
  const rawFee = baseAmount * tier.rate;                      // 완전정밀도, 지역 변수로만 존재
  const isCapApplied = tier.cap !== null && rawFee > tier.cap;
  const feeBeforeRounding = tier.cap !== null ? Math.min(rawFee, tier.cap) : rawFee;
  const maxBrokerageFee = Math.round(feeBeforeRounding);      // 표시 단계 1회 반올림
  return { appliedRate: tier.rate, isCapApplied, maxBrokerageFee };
}
```

### 5.3 오케스트레이션 — 모드별 함수는 "구간표 선택 + 거래금액 산출"만 담당

```ts
function calculateSaleBrokerageFee(input: SaleBrokerageFeeInput): SaleBrokerageFeeResult {
  const baseAmount = input.salePrice;
  const tier = findFeeTier(POLICY.saleTiers, baseAmount);
  return { transactionType: "sale", baseAmount, appliedTier: tier, ...calculateFeeFromTier(baseAmount, tier) };
}

function calculateLeaseBrokerageFee(input: LeaseBrokerageFeeInput): LeaseBrokerageFeeResult {
  const { convertedDeposit, isLowDepositExceptionApplied } =
    calculateConvertedDeposit(input.deposit, input.monthlyRent); // FORMULA.md "계산 순서" 2단계
  const baseAmount = convertedDeposit;
  const tier = findFeeTier(POLICY.leaseTiers, baseAmount);
  return {
    transactionType: "lease",
    baseAmount,
    convertedDeposit,
    isLowDepositExceptionApplied,
    appliedTier: tier,
    ...calculateFeeFromTier(baseAmount, tier),
  };
}

export function calculateRealEstateBrokerageFee(
  input: RealEstateBrokerageFeeCalculatorInput,
): RealEstateBrokerageFeeCalculatorResult {
  return input.transactionType === "sale"
    ? calculateSaleBrokerageFee(input)
    : calculateLeaseBrokerageFee(input);
}
```

`calculateConvertedDeposit(deposit, monthlyRent)`은 FORMULA.md "계산 순서" 2단계
(`raw100` 계산 → 5천만원 미만 예외 판정 → `convertedDeposit` 확정)를 그대로 옮긴 별도
함수로 분리한다 — 임대차 전용이라 공유 대상은 아니지만, Golden Test가 환산보증금
계산만 독립적으로 검증할 수 있어야 하므로(FORMULA.md 검증 예제 20~23) 오케스트레이터에
인라인하지 않는다(`housing-acquisition-tax`의 `determineStandardRate` 분리 이유와 동일).

### 5.4 `logic.ts`는 단일 파일로 충분하다 (디렉터리 분할 아님)

`docs/ARCHITECTURE.md`가 세운 기준("같은 모양의 복잡한 다단계 절차 여러 벌을 공유하면
파일 분할, 짧고 독립적인 연산이면 분기로 충분")을 적용하면 이 계산기는 오히려
`loan-interest-calculator`보다도 통합도가 높다 — 세 상환방식처럼 "같은 골격을 각자 따로
구현"하는 게 아니라, **`findFeeTier`·`calculateFeeFromTier`라는 완전히 동일한 함수 두
개를 매매/임대차가 그대로 재사용**한다(복붙조차 없음). 파일을 나눌 근거가 `bill-split-
calculator`보다도 약하다 — 단일 `logic.ts`로 확정한다.

```
src/calculators/real-estate-brokerage-fee-calculator/logic.ts
  findFeeTier(tiers, baseAmount): FeeTier                         // 5.1, 매매·임대차 공용
  calculateFeeFromTier(baseAmount, tier): {...}                   // 5.2, 매매·임대차 공용, raw/display 경계
  calculateConvertedDeposit(deposit, monthlyRent): {...}          // 5.3, 임대차 전용
  calculateSaleBrokerageFee(input): SaleBrokerageFeeResult        // 5.3
  calculateLeaseBrokerageFee(input): LeaseBrokerageFeeResult      // 5.3
  calculateRealEstateBrokerageFee(input): RealEstateBrokerageFeeCalculatorResult  // 오케스트레이터
```

---

## 6. 입력 상·하한 — FORMULA.md 권고값(100만원~1조원) 채택 + 검증 대상 보정

### 6.1 채택

FORMULA.md가 권고한 "거래금액 100만원(1,000,000원) 이상, 1조원(1,000,000,000,000원)
이하"를 그대로 채택한다 — `loan-interest-calculator`와 같은 논리(법적 제약이 아니라
타이핑 실수 방어용 UX 가드)이고, 아래 "7."에서 이 상한이 숫자 정밀도에 안전함을 재확인
했다. 정확한 검증 로직(`validation.ts`) 구현은 Builder 몫이나, 다음 지점은 Architect가
구조적으로 명시해 둔다.

### 6.2 중요한 보정: 하한은 원시 입력에, 상한은 "계산된 거래금액"에 적용한다

**매매 모드**는 `salePrice` 자체가 곧 `baseAmount`라 하한·상한 모두 `salePrice`에 그대로
적용하면 된다.

**임대차 모드는 다르다.** `deposit`에만 하한(100만원)·상한(1조원)을 적용하면
`monthlyRent`가 큰 경우 `convertedDeposit = deposit + monthlyRent × 100`이 상한을 훌쩍
넘을 수 있다(예: `deposit=1,000,000`, `monthlyRent=100,000,000` → `convertedDeposit=
1,000,000 + 10,000,000,000 = 10,001,000,000`은 아직 1조원 미만이라 괜찮지만,
`monthlyRent`를 더 키우면 쉽게 1조원을 넘는다). 이 계산기가 실제로 요율표에 대입하는
값은 `deposit`이 아니라 `convertedDeposit`(=`baseAmount`)이므로:

- **하한(100만원)은 `deposit`(사용자가 실제로 입력하는 원시 값)에 적용한다** —
  `convertedDeposit`은 `deposit` 이상이므로(월차임 항이 0 이상), `deposit`에 하한을
  걸면 `convertedDeposit`도 자동으로 하한을 만족한다(추가 검증 불필요).
- **상한(1조원)은 `deposit`이 아니라 계산된 `convertedDeposit`(=`baseAmount`)에
  적용한다.** `deposit` 자체가 상한 이내여도 `monthlyRent`가 커서 `convertedDeposit`이
  상한을 넘을 수 있기 때문이다. `validation.ts`는 두 원시 입력을 각각 검증한 뒤,
  **환산까지 마친 값을 다시 한 번** 상한과 비교해야 한다(Builder 구현 지침, 이 문서가
  명시적으로 요구하는 검증 순서).
- `monthlyRent` 자체에도 "명백히 비정상적인 값"(예: 월차임 10억원)을 걸러낼 별도
  상한을 둘지는 Builder 재량이나, 위 "계산된 값 재검증" 규칙이 있으면 굳이 `monthlyRent`
  단독 상한이 없어도 최종 `baseAmount` 상한이 안전망 역할을 한다 — 이 계산기가
  **반드시** 갖춰야 하는 것은 "계산된 값 재검증"이고, `monthlyRent` 단독 상한은
  선택사항이다.

---

## 7. 숫자 정밀도 전략 — 일반 `Number`로 충분 (Architect 직접 재검증)

FORMULA.md "단위" 절은 "Number로 충분하다"고 결론 냈다. 다른 계산기 Architect 라운드의
방법론(Formula Analyst 판단을 그대로 받지 않고 최악 조합과 실제 부동소수점 곱셈 결과를
직접 재계산)을 그대로 적용해 재검증했다.

- **최악 조합(정수 규모)**: 위 "6."에서 채택한 상한(1조원) × 최고 요율(매매 0.7%)
  = `1,000,000,000,000 × 0.007 = 7,000,000,000`(70억원). `Number.MAX_SAFE_INTEGER`
  (약 9.007×10^15)의 약 1/1,286,000 수준으로 압도적으로 안전하다.
- **부동소수점 곱셈 오차를 실제로 측정했다**(Node.js REPL로 FORMULA.md 검증 예제와
  잠재적 "정확히 한도액과 일치하는" 경계값을 직접 계산):
  ```
  45,000,000 × 0.006 = 270000                (정확)
  899,999,999 × 0.004 = 3599999.9960000003   (수학적 정답 3599999.996과 약 3×10⁻¹⁰ 차이)
  160,000,000 × 0.005 = 800000                (정확 — cap=800,000과 정확히 같은 값이 되는 baseAmount)
  75,000,000 × 0.004 = 300000                 (정확 — cap=300,000과 일치하는 baseAmount)
  40,000,000 × 0.005 = 200000                 (정확 — cap=200,000과 일치하는 baseAmount)
  ```
  가장 큰 오차(약 3×10⁻¹⁰)도 `Math.round`의 반올림 임계값(0.5)이나 원 단위 한도액 비교
  임계값(1)보다 9~10자리 작아, **어떤 실제 입력에서도 `isCapApplied` 판정이나 최종
  반올림 방향이 부동소수점 오차 때문에 뒤집힐 수 없다.** "한도액과 정확히 일치하는
  거래금액"(예: 160,000,000원, 75,000,000원, 40,000,000원)에서도 오차 없이 정확한
  정수가 나옴을 직접 확인했다.
- **`four-major-insurance`/`annual-salary-take-home-pay`가 채택한 "정수 분자·분모" 방식은
  이 계산기에 불필요하다고 판단한다** — 그 계산기들은 여러 단계의 백분율이 연쇄되거나
  (예: `98%×35%`) 최종 금액이 세밀한 절사 단위(10원)까지 정확해야 했지만, 이 계산기는
  "곱셈 1회 → 비교 1회 → 반올림 1회"로 연산 횟수가 극히 적고, 위 실측처럼 오차 규모
  자체가 반올림 판정에 전혀 영향을 주지 않는다. 불필요한 구조를 추가하면 오히려 코드
  가독성만 떨어진다(`docs/ARCHITECTURE.md` "모든 계산기에 무조건 무거운 decimal
  라이브러리를 쓰지 않는다"와 같은 절제 원칙을 정수 분자·분모 패턴에도 동일하게
  적용한다).
- **결론: 일반 `Number`, 스케일링·`BigInt`·`decimal.js` 전부 불필요.** `Won`/`Rate`
  모두 `number`로 정의한다(위 "2." types.ts).

---

## 8. UI 레이아웃 — "상한액 ≠ 확정 청구액" 오해 방지가 핵심 과제

### 8.1 화면 순서

SPEC.md/FORMULA.md/사용자 지시가 요구한 순서를 그대로 따른다: 거래 유형 토글 → 입력 →
핵심 결과(+ 협의 고지, 대등한 우선순위) → 계산 근거 → 정책 고지 → 사용안내/소개/FAQ.
`docs/DESIGN_SYSTEM.md` "공통 화면 순서"(입력→결과→계산 근거→소개/사용법→정책 안내→FAQ)와
정책 고지의 위치가 다른데, 이는 `housing-acquisition-tax` Architect 라운드가 이미
확립한 예외와 동일하다 — 이 계산기처럼 정책 고지가 "결과를 오해 없이 이해하기 위한
필수 전제"인 경우 소개/FAQ보다 먼저 배치하는 것이 사용자에게 더 안전하다(그 계산기도
동일하게 계산 근거 바로 다음, 소개/사용법보다 앞에 정책 고지 2개 SectionCard를 뒀다).

```
[스코프 배너 — 입력 폼 바로 위, 결과와 무관하게 항상 노출]
  "이 계산기는 주택의 매매·임대차 중개보수 상한액만 계산합니다. 오피스텔 등 주택 외
   부동산, 토지·상가 등 상한요율 규제가 없는 부동산은 지원하지 않습니다."

[거래 유형 토글 — 세그먼트 버튼, 매매 / 임대차, 필수]
  전환 시 금액 입력 필드 초기화(위 "2.1" UI 규칙)

[입력 폼 — 모드별 분기]
  매매: 매매가격(원, 필수, 천 단위 콤마) + 부동산 종류 확인(라디오: "주택"만 선택 가능,
        "오피스텔 등(준비 중)" 비활성 표시)
  임대차: 보증금(원, 필수) + 월차임(원, 선택, helpText "월세가 없는 전세라면 비워두거나
        0을 입력하세요") + 부동산 종류 확인(동일)

[결과 영역 — aria-live="polite"로 전체를 감싼다. 두 카드가 하나의 시각적 단위를 이룬다]
  1) 핵심 결과 카드(`bg-primary`, 최대 강조)
     라벨: "중개수수료"가 아니라 **"중개보수 상한액"**(SPEC Must Have)
     값: maxBrokerageFee, 가장 크게
     (임대차 모드만) 이 카드 안, 핵심 숫자 바로 아래에 보조 라인으로 "환산보증금
     NNN원" 표시 — 계산 근거로 미루지 않는다(SPEC Must Have "환산보증금을 별도 항목으로
     명확히 표시" — 핵심 결과와 같은 화면에서 바로 보여야 계산 근거까지 스크롤하지 않아도
     확인된다)
  2) **경고 톤 고지 카드**(`rounded-2xl border border-warning-border bg-warning-surface
     p-6`, 핵심 결과 카드와 같은 폭, 바로 아래, 사이에 다른 콘텐츠 없음)
     문구(굵게): "이 금액은 법으로 정한 상한선입니다. 실제로 지급할 금액은 이 한도 안에서
     중개의뢰인과 공인중개사가 서로 협의해서 정합니다."
     이 카드는 하단 "정책 고지" 그룹(아래)과 절대 합치지 않는다 — SPEC Must Have가
     "작은 각주가 아니라 핵심 결과와 같은 화면 우선순위"를 요구했으므로, 스크롤 없이
     핵심 카드와 함께 눈에 들어와야 한다. `docs/DESIGN_SYSTEM.md`의 경고 카드 패턴을
     "지급대상 아님" 같은 부정적 판정이 아니라 "성격 오해 방지" 목적으로 재사용하는
     첫 사례다 — 색상 톤(경고)은 "이 계산기가 뭔가 잘못됐다"가 아니라 "이 숫자의 성격을
     반드시 알아야 한다"는 주의 환기 목적임을 Builder가 문구 톤으로 분명히 해야 한다.

[SectionCard "계산 근거"]
  (임대차만) 보증금 + 월차임 → 환산보증금 계산 과정
    - 기본 산식 표시: "보증금 {deposit}원 + 월차임 {monthlyRent}원 × 100 = {raw100}원"
    - `isLowDepositExceptionApplied=true`이면 추가로: "환산보증금이 5천만원 미만이라
      월차임에 100 대신 70을 곱하는 예외가 적용되어 최종 환산보증금은 {convertedDeposit}
      원입니다"
    - `isLowDepositExceptionApplied=false`이면 예외 언급 없이 기본 산식 결과가 곧
      최종값임을 표시
  → 거래금액(baseAmount) 확정값 표시(매매는 "매매가격 그대로", 임대차는 "환산보증금
    그대로"라고 명시해 두 라벨이 왜 같은 값인지 혼동 없게)
  → 적용 구간(`appliedTier`의 하한·상한을 "OO원 이상 ~ OO원 미만"으로, 최고구간은
    "OO원 이상"으로 상한 생략) · 적용 요율(%) 표시
  → 요율 적용 금액(표시 전용 재계산값, 위 "4.2") 표시: "거래금액 × 요율 = 참고 금액"
  → 한도액 비교(`appliedTier.cap`이 있으면 "한도액 {cap}원과 비교 → {isCapApplied ?
    "한도액이 더 낮아 한도액 적용" : "요율 적용 금액이 한도액 이내라 그대로 적용"}"
    문구, cap이 없으면 이 줄 자체를 생략)
  → 최종 상한액(`maxBrokerageFee`) 재확인

[SectionCard "이 결과가 포함하지 않는 것"]
  - 부가가치세 별도 가능(SPEC "핵심 스코프 결정 4" — 상한액에는 부가세가 포함되어 있지
    않으며, 공인중개사가 일반과세사업자면 10%가 별도로 추가될 수 있다는 고지)
  - 오피스텔 등 주택 외 부동산, 토지·상가 등 상한요율 규제가 없는 부동산은 지원하지 않음
  - 중개보수 외 취득세·인지세·법무사 등기 비용 등은 계산하지 않음(Should Have 교차 안내:
    "취득세는 housing-acquisition-tax에서 확인하세요" 링크 — housing-acquisition-tax의
    "이 결과가 반영하지 않는 것" SectionCard와 같은 정보 구조 역할)

[표준 법적 고지 footer]
  - 전국 공통 표준요율(서울·경기 조례 기준) 기준이며, 실제 상한은 관할 지자체 조례에
    따라 다를 수 있음 — 정확한 상한은 해당 지자체 또는 한국공인중개사협회 확인 권고
  - 법정 상한액 추정치이며, 확정 계약 금액이나 공인중개사협회의 공식 산정 결과가 아님
  - 데이터 마지막 검토일(`policy.ts` `lastVerified`) 표시
  - 입력값은 브라우저에서만 계산하고 서버로 전송·저장하지 않음

[IntroSection] [UsageGuide] [FaqAccordion]
```

### 8.2 "상한액 ≠ 확정 청구액" 오해 방지 — 반복 강조 지점 정리

이 계산기의 UX 핵심 과제이므로, 위 레이아웃에서 이 메시지가 나타나는 지점을 명시적으로
모아 둔다(Builder가 빠뜨리지 않도록, UX/UI Critic이 검증할 체크리스트도 겸함).

1. 핵심 결과 카드의 라벨 자체("중개보수 상한액", "중개수수료"라는 단어를 단독으로 쓰지
   않는다).
2. 핵심 결과 카드 바로 아래 경고 톤 고지 카드(위 "8.1"의 2번 카드) — 가장 중요한 지점.
3. "계산 근거" 섹션 제목 자체가 "확정 계산" 대신 "근거"라는 단어를 씀으로써 "이 결과가
   어떻게 나왔는지 설명하는 것이지 청구서가 아니다"는 톤을 유지한다.
4. 표준 법적 고지 footer의 "확정 계약 금액이나 공인중개사협회의 공식 산정 결과가 아님"
   문구(마지막 재확인).
5. `<title>`/메타 description·OG 문구에도 "상한액", "최대"라는 단어를 포함해 검색
   결과 단계에서부터 성격을 드러낼 것을 Builder에게 권장한다(Should Have 수준, Must
   Have는 아님).

### 8.3 아이콘 — SPEC의 "utility" 제안을 재검토해 "trend"로 정정 권고

SPEC.md "슬러그/카테고리"는 `icon: "utility"`를 제안하며 근거로 "tax 카테고리에서
`utility`가 쓰인 적이 없다"를 들었다. `components/calculator/CalculatorCard.tsx`의
`CalculatorIcon`을 직접 확인한 결과, 이 근거에 사실 오류가 있다.

- **`utility`는 전용 SVG 분기가 없다** — `coins`/`calculator`/`calendar`/`chart`/`trend`
  다섯 키만 전용 분기가 있고, 그 외 모든 키(`heart` 포함)는 동일한 fallback(문서/그리드
  아이콘)으로 렌더링된다. 즉 `utility`를 고르면 시각적으로 `heart`와 **완전히 동일한
  아이콘**이 된다.
- 그런데 `heart`는 이미 `tax` 카테고리에서 `four-major-insurance`가 쓰고 있다(SPEC.md
  자신도 이 사실을 언급했다: "이미 heart(four-major-insurance)... 쓰이고 있다"). 즉
  `utility`를 채택하면 카테고리 목록에서 이 계산기와 `four-major-insurance`가 **구분되지
  않는 같은 아이콘**으로 보인다 — SPEC.md가 의도한 "시각적으로 구분됨"이라는 목적을
  달성하지 못한다.
- 이는 `minimum-wage-calculator` Architect 라운드가 `labor` 카테고리에서 이미 한 번
  겪은 동일한 함정이다(그 라운드도 SPEC의 `utility` 제안이 `heart`의 fallback과 겹치는
  것을 발견하고 `trend`로 바꿨다) — 이번에도 같은 판단을 적용한다.
- **정정: `icon: "trend"`를 권고한다.** `trend`는 전용 SVG(등락 지그재그+화살표)가 있고,
  `tax` 카테고리(`heart`/`chart`/`coins`/`calculator`)에서 아직 쓰인 적이 없어 실제로
  시각적으로 구분된다. 의미상으로도 "협의 가능 범위 안에서 상한이 오르내리는 요율 구간"
  이라는 성격이 `average-cost-calculator`(평단가 변동)·`minimum-wage-calculator`(기준
  이상/미만 비교)가 `trend`를 택한 맥락과 크게 다르지 않다.
- title(`부동산 중개수수료 계산기`)·category(`tax`)·초기 status(`draft`)는 SPEC.md
  그대로 승인한다 — 이 절에서 바꾸는 것은 아이콘 키 하나뿐이다. 실제 `registry.ts` 등록은
  이번 라운드에서 하지 않는다(위 "0.").

---

## 9. 공통 컴포넌트 재사용 검토

- **`ShareActions`**: 그대로 재사용한다. 공유 상태(`RealEstateBrokerageFeeCalculatorInput`)는
  `transactionType`(문자열 리터럴)·`salePrice`/`deposit`/`monthlyRent`(number) 전부
  원시 타입이라 JSON 직렬화 문제가 없다(`housing-acquisition-tax`와 동일 판단).
- **`SectionCard`/`UsageGuide`/`IntroSection`/`FaqAccordion`**: 그대로 재사용한다.
- **핵심 결과 카드**: 새 컴포넌트를 만들지 않는다 — 기존 `bg-primary` 카드 패턴을
  `ui.tsx`에서 직접 구현한다.
- **경고 톤 고지 카드**(위 "8.1"): 새 컴포넌트를 만들지 않는다 — `docs/DESIGN_SYSTEM.md`
  "경고/미충족 카드" 클래스(`border-warning-border bg-warning-surface`)를 `ui.tsx`에서
  직접 적용한다. 이 클래스가 지금까지 "지급대상 아님"류 부정적 판정에만 쓰였는데, 이번이
  "판정은 정상이지만 성격을 반드시 알려야 하는 정보"에 쓰는 첫 사례다 — 재사용 자체는
  스타일 클래스 재사용이라 문제 없지만, UX/UI Critic이 "이 카드가 마치 오류나 미충족
  상태처럼 보이지 않는지"(사용자가 "뭔가 잘못됐다"고 오해할 위험)를 검토해야 한다.
- **거래 유형 토글**: 새 공용 컴포넌트 불필요 — `loan-interest-calculator`의
  `repaymentMethod` 세그먼트 버튼, `deposit-savings-interest-calculator`의 `mode` 토글
  마크업 패턴을 그대로 재사용한다.
- **부동산 종류 확인 라디오**("주택"만 선택 가능, "오피스텔 등(준비 중)" 비활성)**:
  새 컴포넌트 불필요 — `housing-acquisition-tax`의 카드형 라디오 패턴을 참고하되, 이번엔
  비활성(disabled) 옵션을 포함해야 한다는 점만 다르다. **이 입력은 계산 로직에 영향을
  주지 않는 UI 전용 요소다** — v1이 "주택"만 지원하므로 `RealEstateBrokerageFeeCalculatorInput`
  에 `propertyType` 필드를 두지 않았다(아래 "10." 참고). Should Have "오피스텔" 승격 시
  실제 판별 필드가 새로 필요해진다.

---

## 10. `propertyType`을 입력 타입에 넣지 않은 이유 (v1 범위 결정 사항 재확인)

SPEC.md Must Have "부동산 종류 확인(필수, 정보 제공용)"은 입력 **화면**에는 필요하지만,
v1이 "주택" 단 하나의 값만 지원하고 그 값이 계산 분기에 전혀 영향을 주지 않으므로(오피스텔
선택 자체가 불가능하게 비활성 처리됨) `types.ts`의 `RealEstateBrokerageFeeCalculatorInput`
에는 이 필드를 추가하지 않는다 — 실질적으로 계산에 관여하지 않는 값을 타입에 넣으면
"이 필드가 분기에 쓰이는가?"를 읽는 사람이 매번 확인해야 하는 불필요한 인지 부담이
생긴다. 이는 SPEC.md의 요구를 축소하는 것이 아니라 "UI 전용 확인 요소"와 "계산 입력"을
구조적으로 분리하는 것이다(`ui.tsx`가 이 라디오의 존재·비활성 상태·helpText를 담당).

**Should Have "오피스텔" 승격 시 확장 지점**: 그때는 `propertyType: "house" | "officetel"`
같은 판별 필드가 실제로 필요해지고(오피스텔 요건 체크박스 등도 함께), 이는 `types.ts`의
**호환성 있는 확장**(기존 `"sale"`/`"lease"` 판별에 두 번째 판별 축을 추가하는 형태)이 될
가능성이 높다 — 지금 미리 `propertyType: "house"` 리터럴 하나짜리 필드를 추가해 두는 것도
검토했으나, "지금 쓰이지 않는 필드를 미리 추가하지 않는다"는 사이트 전반의 절제 원칙과
일치하지 않아 채택하지 않았다.

---

## 11. Golden Test 배치 — Builder 가이드

FORMULA.md 검증 예제 28개(수치 23 + 오류 5)를 `logic.test.ts`/`validation.test.ts`로
나눈다.

```
// logic.test.ts
describe("findFeeTier — 매매·임대차 공용 구간 판정, 하한 포함·상한 미포함 경계")
  // 매매 5개 경계(5천만/2억/9억/12억/15억) + 임대차 5개 경계(5천만/1억/6억/12억/15억)를
  // 이 함수 하나로 스윕해 검증할 수 있다(매매표·임대차표 둘 다 넣어 총 10개 경계 테스트).

describe("calculateConvertedDeposit — 환산보증금 기본 산식·5천만원 미만 예외")
  // 예제 12(전세, 예외 무관성), 20(예외 미적용), 21("미만" 경계, 예외 미적용),
  // 22~23(예외 적용) 그대로.

describe("calculateFeeFromTier — 요율 적용·한도액 비교·반올림 (raw/display 경계 검증)")
  // 예제 1~11(매매), 12~19(전세) 중 findFeeTier로 구간을 미리 확정한 뒤 이 함수만
  // 독립적으로 검증. cap 적용/미적용 각 방향, cap이 없는 고가 구간 포함.
  // 불변식 검증: result.appliedRate === tier.rate(위 "2.3").

describe("calculateSaleBrokerageFee / calculateLeaseBrokerageFee / calculateRealEstateBrokerageFee")
  // 오케스트레이터 조립 확인 — 예제 9·17(언론 실사례 대조), 23(공식 유권해석 환산값 대조)을
  // 여기서 End-to-End로 재확인(Golden Test 최소 2개 "공식 자료 대조" 요건 충족 지점).

// validation.test.ts
describe("입력 검증 실패")
  // 예제 24~28(transactionType 미선택, salePrice/deposit 0 이하·비숫자, monthlyRent 음수).
  // 추가 권장(FORMULA.md 예제엔 없음): deposit은 하한 이내이지만 monthlyRent가 커서
  // convertedDeposit이 상한(1조원)을 넘는 경우 — 위 "6.2"가 요구하는 "계산된 값
  // 재검증" 규칙의 회귀 테스트로 반드시 포함할 것.
```

---

## 12. 폴더/파일 구조 및 Builder 인수인계 요약

```
src/calculators/real-estate-brokerage-fee-calculator/
  types.ts          # 입력·결과 타입, FeeTier (Architect 완성 — 위 "2.", "3.")
  policy.ts         # 매매·임대차 요율표, 환산보증금 상수, 출처 메타데이터 (Architect 완성 — 위 "1.")
  logic.ts          # findFeeTier, calculateFeeFromTier, calculateConvertedDeposit,
                     # calculateSaleBrokerageFee, calculateLeaseBrokerageFee,
                     # calculateRealEstateBrokerageFee (위 "5.", 단일 파일)
  logic.test.ts     # Golden Test 28개(위 "11.")
  validation.ts     # 입력 검증, 상·하한 가드(위 "6.", 특히 "6.2" 계산된 값 재검증)
  validation.test.ts
  formatting.ts     # 금액 천단위 콤마, 요율 %표시, 구간 경계 문구, "요율 적용 금액(표시
                     # 전용 재계산)"(위 "4.2"), 계산 근거 문자열 조립
  formatting.test.ts
  content.ts        # 소개/사용법/FAQ, 정책 고지 문구 3단 그룹(위 "8.1"), 조례 정정 명칭
                     # 반영(위 "1.4"), REAL_ESTATE_BROKERAGE_FEE_OPEN_QUESTIONS 소비
  ui.tsx            # 거래 유형 토글 + 입력 폼(부동산 종류 라디오 포함) + 핵심 카드 +
                     # 경고 톤 고지 카드 + 계산 근거 SectionCard + 정책 고지 SectionCard +
                     # 표준 법적 고지 footer + 소개/사용법/FAQ(위 "8.1")
```

Builder 체크리스트:
1. `logic.ts`: `findFeeTier`/`calculateFeeFromTier`를 매매·임대차가 **그대로 공유**한다
   (복붙 금지). `policy.ts`의 상수만 참조하고 0.006/50_000_000 같은 매직 넘버를 직접
   쓰지 않는다.
2. `rawFee`/`feeBeforeRounding`은 `calculateFeeFromTier` 내부 지역 변수로만 존재한다 —
   `types.ts`에 필드를 추가하지 않는다(위 "4.1").
3. "계산 근거" 화면의 "요율 적용 금액" 표시는 `formatting.ts`가 `baseAmount`·
   `appliedRate`로부터 표시 전용으로 재계산한다(위 "4.2") — 이 재계산값을 로직/타입에
   역으로 추가하지 않는다.
4. `appliedRate`는 항상 `appliedTier.rate`와 같은 `tier` 인자에서 파생시킨다(위 "2.3"
   드리프트 방지 계약).
5. `validation.ts`: 임대차 모드에서 하한은 `deposit`에, 상한은 **계산된
   `convertedDeposit`**에 적용한다(위 "6.2" — 놓치기 쉬운 지점, Calculation Auditor
   최우선 확인 항목으로 인계).
6. 거래 유형 토글 전환 시 금액 입력 필드를 초기화한다(위 "2.1").
7. 핵심 결과 카드 바로 아래 경고 톤 고지 카드를 배치하고, 다른 정책 고지 그룹과
   합치지 않는다(위 "8.1"·"8.2" — UX/UI Critic 최우선 검증 항목).
8. `icon: "trend"`로 등록한다(SPEC의 `utility` 제안 대신, 위 "8.3").
9. 레지스트리에 `status: "draft"`로 등록(위 "0.").
10. 새 계산기 완료 후 기존 계산기 Smoke Test 실행(`docs/EVALUATION.md` "회귀 방지") —
    이번 라운드는 신규 파일 2개만 추가했고 공용 코드를 전혀 건드리지 않아 회귀 위험이
    없지만 관례대로 재확인을 권장한다.

---

## 13. 회귀 방지 확인

**공용 코드 — 전혀 수정하지 않음**: `src/lib/`, `rates-2026.json`, `components/calculator/`
등 다른 계산기와 공유하는 파일을 하나도 건드리지 않았다(아이콘 정정은 "8.3"에서 Builder
등록 단계의 권고로만 남겼고, `CalculatorCard.tsx`에 새 SVG 분기를 추가하지 않았다 — `trend`
는 이미 전용 분기가 있어 추가 작업이 필요 없다). `npx tsc --noEmit`, `npx vitest run`을
재실행해 신규 파일 2개(`types.ts`, `policy.ts`)가 기존 스위트에 영향을 주지 않음을
확인했다(결과는 이번 라운드 작업 로그 참고) — 다른 계산기가 이 폴더를 import하지 않으므로
회귀 위험이 구조적으로 없다.

---

## 14. 남은 리스크 / 확인 필요 (Architect가 해소하지 않고 그대로 인계)

- FORMULA.md 자신이 "확인 필요"로 남긴 6개 항목(시행규칙 제20조 항·호 번호 부분확인,
  서울시 조례 조·별표 번호 미확인, 17개 광역자치단체 전수조사 미완료, 절사·반올림 법적
  근거 미확인, 부가세 관련 조항 미확인, 준주택 취급 미검토)은 Architect가 임의로
  해소하지 않았다 — `policy.ts`의 `REAL_ESTATE_BROKERAGE_FEE_OPEN_QUESTIONS`에 그대로
  옮겨 Calculation Auditor·Builder가 놓치지 않게 했다.
- 위 "7."의 부동소수점 재검증은 이번 라운드에서 직접 수치를 계산해 확인한 것이지만,
  Calculation Auditor가 `calculateFeeFromTier`의 실제 구현에 대해 동일한 경계값으로
  회귀 테스트를 돌려 재확인할 것을 권고한다.
- "8.1"의 경고 톤 고지 카드 배치는 정보 구조까지만 확정했다 — 정확한 문구 톤, 아이콘
  사용 여부, 실제 색상 대비 등은 Builder 구현 후 UX/UI Critic이 화면으로 재검토해야
  한다(특히 "8.1"이 언급한 "오류처럼 보이지 않는지" 우려).
- Should Have "환산보증금 5천만원 미만 예외" 관련 시행규칙 조·항 번호가 "부분확인"
  상태이므로, Calculation Auditor가 가능하면 law.go.kr 원문 직접 열람으로 항·호 번호를
  재확인할 것을 권고한다(수치 자체의 신뢰도와는 별개 사안 — FORMULA.md도 동일하게
  구분해 서술했다).
