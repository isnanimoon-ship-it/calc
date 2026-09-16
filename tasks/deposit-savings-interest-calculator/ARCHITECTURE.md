# ARCHITECTURE: 예금·적금 이자 계산기 (deposit-savings-interest-calculator)

Architect 구조 결정 메모. 승인된 `SPEC.md` · `FORMULA.md` 기준. 작성일 2026-09-15.
계산 공식 자체는 정의하지 않는다(Formula Analyst 소관, 공식·반올림 정책을 바꾸지 않았다).
여기서는 코드 배치, 타입, 데이터 구조, UI 구조만 정한다.

관련 문서: docs/ARCHITECTURE.md, docs/CALCULATOR_RULES.md, docs/DESIGN_SYSTEM.md.
참고 선례: `tasks/loan-interest-calculator/ARCHITECTURE.md`(판별 유니온 설계, 숫자 정밀도
재계산 방법론, 회차별 스케줄 데이터 처리), `tasks/average-cost-calculator/ARCHITECTURE.md`
(raw/display 경계, "아직 사례 1개뿐이면 승격하지 않는다" 반복 원칙), `tasks/four-major-
insurance/ARCHITECTURE.md`(표 형태 결과의 모바일 카드 전환 선례),
`tasks/minimum-wage-calculator/ARCHITECTURE.md` "1."(계산기 간 코드 공유 판단 기준의 최신
재확인 — 이 문서의 "3."이 그대로 이어받는다).

---

## 0. 레지스트리 상태 확인

`src/calculators/registry.ts` 확인 결과 `deposit-savings-interest-calculator` slug는 아직
등록되어 있지 않다. 기존 관례(loan-interest-calculator·average-cost-calculator 등)와
동일하게 이번 Architect 라운드에서도 등록하지 않는다 — Builder가 UI 구현을 완료하면
`status: "draft"`로 등록한다(아래 "8." 참고).

이번 라운드에서 실제로 만든/수정한 파일은 다음과 같다:

- `src/calculators/deposit-savings-interest-calculator/types.ts` (신규 — 이 계산기 전용
  폴더, 아래 "1."/"4.")
- `src/lib/installment-savings.ts` (신규 — military-salary와 공유, 아래 "3.")
- `src/calculators/military-salary/logic.ts` (수정 — 인라인 닫힌 형 식을 위 공용 함수
  호출로 교체, 로직 자체는 한 글자도 바꾸지 않음, 아래 "3." 회귀 검증 참고)
- `src/data/rates-2026.json` (수정 — `interestIncomeTax` 네임스페이스 신설, 아래 "6.")
- `docs/ARCHITECTURE.md` ("숫자 정밀도 전략" 절, "계산 로직 공용화" 절에 이번 라운드의
  결정 사례 2건 append — 기존 내용 삭제·재배열 없음)
- `tasks/deposit-savings-interest-calculator/ARCHITECTURE.md` (이 문서)

`logic.ts`/`validation.ts`/`formatting.ts`/`content.ts`/`ui.tsx`는 Builder 몫으로 남긴다
(아래 "9. Builder 인수인계 요약").

**회귀 검증**: 위 변경 직후 `npx tsc --noEmit`(클린) · `npx vitest run
--no-file-parallelism`(90개 테스트 파일 · 1,275개 테스트 전부 통과, 특히
`military-salary/logic.test.ts`의 기존 Golden Test — 회귀 없음)을 실행해 확인했다.

---

## 1. 판별 유니온 설계 — `mode`(1차) + `interestType`(예금 내부 2차)

`src/calculators/deposit-savings-interest-calculator/types.ts`를 이번 라운드에서 작성해
확정했다. 핵심 결정:

### 1.1 입력 — `mode`로만 나눈 평평한(flat) 판별 유니온

```ts
export type DepositInput = DepositSavingsInterestCalculatorInputBase & {
  mode: "deposit";
  principal: Won;
  interestType: "simple" | "compound";
};
export type SavingsInput = DepositSavingsInterestCalculatorInputBase & {
  mode: "savings";
  monthlyContribution: Won;
};
export type DepositSavingsInterestCalculatorInput = DepositInput | SavingsInput;
```

`loan-interest-calculator`의 `repaymentMethod` 판별 유니온 선례를 그대로 따라 `mode`를
판별 태그로 쓴다 — SPEC.md "계산 결과 — 모드별로 다른 템플릿"이 예금/적금의 핵심 입력
성격 자체가 다르다고 명시했으므로(예금: 목돈 1회, 적금: 월 반복 납입), 하나의 인터페이스에
`principal?`/`monthlyContribution?`을 옵셔널로 욱여넣지 않는다.

**입력 쪽 `interestType`(단리/월복리)은 중첩 유니온으로 만들지 않고 평평한 enum 필드로
둔다.** `loan-interest-calculator`도 입력(`repaymentMethod`)은 평평한 enum, 결과만 판별
유니온으로 설계했다 — 이유는 동일하다: 입력은 "어떤 필드가 존재하는가"의 문제가 아니라
"어떤 계산 경로를 타는가"의 문제이므로, `interestType` 값과 무관하게 예금 입력 필드
구성(`principal`, `annualRatePercent`, `termMonths`, `interestType`)이 완전히 같다. 필드
구성이 달라지는 것은 **결과** 쪽(월복리에만 `monthlyRate`가 존재)이므로, 타입을 나눠야 할
지점도 결과 쪽이다.

### 1.2 결과 — 예금 내부에서 `interestType`을 2차 판별 태그로 다시 나눈다

```ts
type DepositResultCommon = {
  mode: "deposit";
  principal: Won;
  annualRatePercent: number;
  termMonths: number;
} & InterestTaxBreakdown;

export type DepositResult =
  | (DepositResultCommon & { interestType: "simple" })
  | (DepositResultCommon & { interestType: "compound"; monthlyRate: number });

export type SavingsResult = { mode: "savings"; /* ... */ } & InterestTaxBreakdown;

export type DepositSavingsInterestCalculatorResult = DepositResult | SavingsResult;
```

FORMULA.md 출력값 표가 `monthlyRate`를 "예금 월복리 전용"으로 명시했다 — 단리 결과에
`monthlyRate: undefined`를 옵셔널 필드로 흘리면 "이 필드가 왜 없는지"를 매번 런타임에
`interestType`을 다시 확인해야 하고, `docs/CALCULATOR_RULES.md` "서로 다른 계산 방식을
같은 공식으로 처리하지 않는다"는 원칙이 타입에서 흐려진다 — `loan-interest-calculator`가
세 상환방식의 핵심 결과 필드(`fixedMonthlyPayment`/`firstPayment`~`lastPayment`/
`monthlyInterestBeforeMaturity`+`maturityPayment`)를 판별 유니온으로 나눈 것과 정확히 같은
논리를 예금 내부의 2차 분기에도 그대로 적용했다. **옵션 2(단일 예금 결과 타입 + 옵셔널
`monthlyRate` 필드)는 기각했다** — 위 이유로 이 사이트의 기존 판례와 어긋난다.

`mode`(1차) → `interestType`(2차, deposit에서만) 두 판별 태그를 가진 3-분기 유니온
(`simple`/`compound`/`savings`)이 이 계산기의 최종 결과 타입 모양이다. TypeScript는 이런
다단 판별 유니온의 exhaustiveness 체크를 문제없이 지원한다(`switch(result.mode)` →
`case "deposit"` 블록 안에서 다시 `switch(result.interestType)`).

### 1.3 세금 breakdown은 별도 타입으로 뽑아 교차(&)로만 합성

`preTaxInterest`/`incomeTax`/`localIncomeTax`/`totalTax`/`afterTaxInterest`/
`afterTaxMaturityAmount` 6개 필드는 예금·적금 두 모드가 완전히 동일한 공식(FORMULA.md
"공식 4")·반올림 순서를 공유한다 — `InterestTaxBreakdown` 인터페이스로 뽑아 세 분기 타입
모두에 교차 타입으로만 합성했다(export하지 않음). `loan-interest-calculator`의
`LoanCalculationBase`가 공통 필드 반복을 줄인 것과 같은 이유이며, `schedule`/
`yearlySummary`처럼 배열 타입을 세 번 반복 정의하는 오타·드리프트 위험이 여기서는
6개 스칼라 필드 반복 위험으로 나타난다 — 교차 타입 하나로 이 위험을 없앤다.

---

## 2. 숫자 정밀도 전략 — 일반 `Number`, 스케일링/`BigInt`/`decimal.js` 전혀 불필요 (확정)

FORMULA.md "숫자 표현" 절의 의견을 그대로 받지 않고, `loan-interest-calculator`가 세운
방법론(최악 조합을 직접 재계산)을 그대로 적용해 확정한다.

- **최악 조합 재계산(Node `Math.pow` 직접 계산, 확인일 2026-09-15)**:
  - 예금 월복리, 원금 상한(100억 원) × 연이율 상한(30%) × 기간 상한(120개월):
    `월이율 = 0.30/12 = 0.025`, `(1.025)^120 = 19.358149833777777`(정확한 배정밀도 값).
    `세전 이자(raw) = 10,000,000,000 × (19.358149833777777 − 1) ≈ 183,581,498,337.78원`.
    `Number.MAX_SAFE_INTEGER`(약 9.007×10^15)의 약 1/49,000 수준으로 압도적으로 안전하다.
  - 적금, 월 납입액 상한(5천만 원) × 연이율 상한(30%) × 기간 상한(120개월):
    `n(n+1)/2 = 120×121/2 = 7,260`. `세전 이자(raw) = 50,000,000 × 0.30 × 7,260 / 12 =
    9,075,000,000원`. 마찬가지로 안전 정수 범위에 전혀 근접하지 않는다.
  - `loan-interest-calculator`(최대 지수 480, 최악 조합에서 `(1+r)^n ≈ 5×10^16`까지
    커졌던 사례)와 비교하면, 이 계산기는 지수 상한이 120으로 훨씬 작고(FORMULA.md
    "입력값" 표 — 기간 상한 10년) 최대 배수(`(1.025)^120 ≈ 19.36`)도 훨씬 작아 부동소수점
    상대오차(~2.2×10^-16)가 원 단위 반올림에 영향을 줄 여지가 loan-interest-calculator보다
    한층 더 작다. 별도의 "분모·분자 양쪽에 지배적 항으로 등장해 상쇄된다"는 정교한 분석
    없이도(loan-interest-calculator "1."이 필요로 했던 수준의 분석) 안전성이 자명하다.
- **`BigInt`**: 이 계산기에는 나눗셈에서 정수 나눗셈만 지원하는 제약이 문제 되는 지점
  (사사오입 반올림 2단계)이 있어 오히려 `loan-interest-calculator`와 같은 이유로 부적합하다
  — 애초에 안전 정수 범위 문제가 없으므로 도입할 이유 자체가 없다.
- **`decimal.js`/`big.js`**: 위 분석대로 정밀도 문제가 실재하지 않아 번들 크기·의존성만
  늘린다(`docs/ARCHITECTURE.md` "모든 계산기에 무조건 무거운 decimal 라이브러리를 쓰지
  않는다").
- **회차별 반올림 재사용에 따른 오차 축적도 없다** — FORMULA.md "계산 순서"가 이미
  명시했듯 `preTaxInterest`는 전체 정밀도로 한 번만 계산한 뒤 1회 절사하고, 회차별
  `schedule[].interest`도 각 행이 자신의 완전정밀도 원본에서 독립적으로 1회만 반올림된다
  — 반복적으로 반올림값을 다음 계산에 재사용하는 구조가 아니므로 오차가 누적될 지점
  자체가 없다.
- 상세 근거는 `docs/ARCHITECTURE.md` "결정 사례: 예금·적금 이자 계산기"에도 동일 내용을
  요약해 append했다.

---

## 3. 적금 단리 후취식 산식의 코드 위치 — `src/lib/installment-savings.ts`로 공용화 (확정)

### 3.1 결론

`military-salary/logic.ts`의 인라인 닫힌 형(`Math.floor(monthlyContributionWon×(rate/100)×
(n×(n+1)/2)/12)`)을 **`src/lib/installment-savings.ts`의
`calculateInstallmentSimpleInterestTotal(monthlyContributionWon, annualRatePercent,
months)`로 추출해 두 계산기가 같은 구현을 import해 쓴다.** `military-salary/logic.ts`도
이번 라운드에서 즉시 이 함수를 쓰도록 리팩터링했다(뒤로 미루지 않음 — `date-calc.ts`/
`social-insurance.ts`/`labor-standards.ts` 추출 선례와 동일한 절차).

### 3.2 판단 기준 — "동일한 법적 정의"가 아니라 "동일한 수식·동일한 반올림 정책의 확정적
동시 재사용"으로 일반화

이 프로젝트가 지금까지 세운 공용화 기준은 "두 계산기가 **동일한 법적 정의**를 공유하는
순수 계산이면 `src/lib/`로 추출한다"(4대 보험 근로자 부담분, 주휴시간 산식)였다. 이번
사례는 그 기준을 문자 그대로 적용하기 애매하다 — `military-salary`의 적금은
"장병내일준비적금"이라는 특정 정책 상품(법적 근거: 관련 정책 고시)이고, 이 계산기는
"일반 시중 적금"으로 **법적 근거 자체가 다르다.**

- **직접 확인**: 양쪽 FORMULA.md를 대조한 결과, 이 산식 자체는 애초에 어느 쪽도 "법령이
  강제하는 계산법"으로 문서화하지 않았다. `military-salary/FORMULA.md`는 "은행이자는
  상품·은행·우대조건·납입일에 따라 달라진다. v1은 사용자가 입력한 연 금리를 이용해...
  월 단위 단리로 추정한다"고 명시한다 — 즉 **표준 재무수학을 각자의 상품에 적용해 추정한
  값**이라는 점에서 둘 다 "정책형이 아니다"(deposit-savings-interest-calculator FORMULA.md도
  동일하게 "재무수학 공식 부분은 정책형 아님"이라고 스스로 밝혔다).
- **결론: 판단 기준을 세분화한다.** "법적 정의를 공유하는가"는 공용화가 안전한 이유 중
  하나(발산 위험이 낮다는 신호)일 뿐, 유일한 필요조건은 아니다. 진짜 필요조건은
  **"완전히 동일한 수식·완전히 동일한 상수·완전히 동일한 반올림 정책을, 지금 당장 두
  계산기가 동시에 필요로 하는가"**다(`minimum-wage-calculator` ARCHITECTURE.md "1.2"가
  주휴시간 산식 공용화를 정당화하며 강조한 세 가지 동일성 — 수식·상수·법적 근거 — 중
  "법적 근거"만 이번엔 성립하지 않지만, 나머지 둘(수식·반올림 정책)은 완전히 일치하고,
  게다가 "왜 같은가"에 대한 설명(둘 다 표준 재무수학의 추정치)까지 일치한다. 이 정도의
  일치는 우연한 표면적 유사(예: annual-leave-allowance가 겪은 clamp 발산)와 구별하기에
  충분하다고 판단했다.
- **공유 범위를 의도적으로 좁게 잡았다** — 옮긴 것은 "닫힌 형 총합(및 그 절사)" 단 하나의
  연산뿐이다. military-salary의 원금·매칭지원금·만기예상액 계산, 이 계산기의 세전/세후
  이자·이자소득세 계산은 각자 로컬에 그대로 둔다 — "여러 계산기가 실제로 공유하는 최소한의
  순수 계산 단위만 골라 추출한다"는 4대 보험 근로자 부담분 공용화 원칙을 그대로 따른다.
- **회차별 breakdown(`schedule[]`)은 공유 대상이 아니다.** military-salary는 회차별
  이자를 전혀 계산하지 않는다(최종 합계 하나만 필요) — 따라서 이 계산기가 필요로 하는
  "각 회차의 `interest_i`를 개별적으로 반올림해 배열로 만드는" 로직은 대응물이 없는 이
  계산기 전용 코드다. `src/lib/installment-savings.ts`는 "닫힌 형 총합"이라는 도메인 의미
  없는 순수 산술 하나만 알고, 회차별 표 생성은 이 계산기의 `logic.ts`가 로컬로 구현한다
  (아래 "7." 참고).

### 3.3 함수 시그니처(확정, 이미 구현 완료)

```ts
// src/lib/installment-savings.ts
export function calculateInstallmentSimpleInterestTotal(
  monthlyContributionWon: number,
  annualRatePercent: number,
  months: number,
): number; // 원 단위 미만 절사(Math.floor)된 정수
```

이 함수는 `Math.floor`까지 책임진다(두 계산기 모두 이 절사 정책을 채택 — military-salary가
이미 확정한 선례를 deposit-savings-interest-calculator FORMULA.md가 그대로 재사용한다).
Builder는 이 시그니처를 임의로 바꾸지 않는다(military-salary가 이미 이 시그니처에 의존하는
호출부를 갖고 있다).

### 3.4 회귀 검증 결과

- `military-salary/logic.ts`의 인라인 식을 **한 글자도 바꾸지 않고** 그대로 함수 본문으로
  옮겼다(추출 = 순수 이동, 재작성 아님). 호출부는 동일한 인자 3개(`s.monthlyContributionWon`,
  `s.expectedAnnualRatePercent`, `s.contributionMonths`)를 그대로 전달하는 얇은 교체다.
- `npx tsc --noEmit`: 클린.
- `npx vitest run --no-file-parallelism`: **90개 테스트 파일 · 1,275개 테스트 전부 통과**
  (리팩터링 전후 회귀 없음). 특히 `military-salary/logic.test.ts`의 기존 Golden Test
  (`monthlyContributionWon=550,000`, `contributionMonths=18`, `expectedAnnualRatePercent=5`
  → `estimatedInterestWon: 391875`)가 그대로 통과함을 확인했다 — 직접 재계산으로도
  `550,000×0.05×(18×19/2)/12 = 550,000×0.05×171/12 = 391,875`(정수, 절사 불필요)로
  일치한다.
- `src/calculators/military-salary/`의 다른 파일(`types.ts`/`policy.ts`/`date-utils.ts`/
  `validation.ts`/`ui.tsx`)은 전혀 건드리지 않았다.

---

## 4. raw/display 분리 — logic 내부 구현 세부사항으로만 두고 타입에는 노출하지 않는다

FORMULA.md가 명시한 raw(전체 정밀도) vs 확정값(절사/반올림 완료) 구분은 **`types.ts`에
별도 필드로 노출하지 않는다.**

- `preTaxInterest`는 이미 "전체 정밀도로 계산 → 1회 절사"가 끝난 확정값이다. 이 절사는
  FORMULA.md가 명시한 **도메인 규칙**(세금 계산의 입력이 되는 값)이지 "표시 직전 재반올림"이
  아니다 — `loan-interest-calculator`가 회차별 금액을 로직 단계에서 이미 정수로 확정하고
  `formatting.ts`가 재반올림하지 않는 것과 동일한 경계(`docs/ARCHITECTURE.md` "계산 로직 /
  UI 분리": logic=계산, formatting=표시 포맷). raw 전체정밀도 값은 `logic.ts` 함수 본문
  안의 지역 변수로만 존재하고 반환 타입에는 나타나지 않는다 — `loan-interest-calculator`의
  `LoanInterestCalculatorResult`도 회차별 반올림 이전의 raw 값을 타입으로 노출하지 않는
  것과 같은 선례를 따른다.
- `SavingsScheduleRow.interest`도 이미 개별 반올림이 끝난 표시값이다. 행별 raw 값
  (`interest_i(raw)`)은 `logic.ts`가 각 행을 만드는 계산 과정에서만 쓰고 타입에는 노출하지
  않는다 — Golden Test(`logic.test.ts`)는 `calculateDepositSavingsInterest(input)`의
  최종 출력(`schedule[].interest`)을 FORMULA.md 검증 예제와 대조하므로, 중간 raw 값을
  타입으로 노출할 필요가 없다.

### "회차별 표 합계가 세전 이자와 원 단위에서 다를 수 있다"는 현상의 고지 방식

FORMULA.md가 명시한 이 현상(각 출력이 자신의 완전정밀도 원본에서 독립적으로 반올림되는
정책의 자연스러운 결과)을 사용자에게 고지하는 방법으로 두 가지를 검토했다:

1. **타입에 `scheduleInterestSum`처럼 미리 계산된 합계 필드를 추가**하고 그 값과
   `preTaxInterest`를 UI가 직접 비교해 다를 때만 안내 문구를 보여준다.
2. **항상 정적 고지 문구만 보여주고, 실제 차이 유무는 계산하지 않는다**(`average-cost-
   calculator`가 채택한 방식과 유사하게 "차이가 있을 수 있다"는 사실 자체를 안내).

**1번을 채택하되, 이 합계 함수는 `formatting.ts`가 아니라 `logic.ts`에 순수 집계 함수로
둘 것을 Builder에게 권고한다**(강제는 아님 — 차이가 항상 몇 원 이내로 작고 사용자
의사결정에 영향이 없어, 2번(정적 문구만)도 충분히 합리적인 선택지다). 1번을 택할 경우
`docs/ARCHITECTURE.md` "결과 확정 후..." 및 `loan-interest-calculator`의 `yearlySummary`
집계 배치 원칙("집계는 logic이, 표시는 formatting이 담당")을 그대로 따라 예:
`sumScheduleDisplayInterest(schedule: SavingsScheduleRow[]): Won`처럼 **로직 단계의
순수 함수**로 구현하고, `formatting.ts`는 이 결과를 문자열로 바꾸는 역할만 한다. 이 함수는
`SavingsResult` 타입에 필드로 추가하지 않는다(파생 가능한 값을 결과 타입에 중복 저장하면
"타입이 이미 알고 있는 사실"과 "재계산한 사실"이 어긋날 위험이 생긴다 — `schedule[]`
자체가 이미 SSOT이므로 필요할 때 그 배열로부터 다시 합산하면 된다).

---

## 5. `interestIncomeTax` 정책 데이터 스키마 — `rates-2026.json`에 신설 완료 (URL 오류 정정 포함)

FORMULA.md가 제안한 4개 필드(`incomeTaxRate`/`localIncomeTaxRate`/
`combinedRateForDisplay`/`minorWithholdingExemptionApplies`) 구조를 그대로 채택했다 —
`docs/CALCULATOR_RULES.md` "데이터 파일 스키마"(`value`/`unit`/`source`/`lastVerified`/
`nextReviewDue`)를 그대로 지키고, `combinedRateForDisplay`(파생값, `source` 없음)와
`minorWithholdingExemptionApplies`(boolean 플래그, `four-major-insurance`의
`workersCompensation.calculationSupported: false`처럼 boolean 값도 이 스키마 안에서
표현 가능함이 이미 검증됨)도 기존 관례와 충돌하지 않는다.

### 5.1 URL 오류 정정

FORMULA.md 초안의 `localIncomeTaxRate.source.url`이
`https://casenote.kr/법령/지방세법/제103조의29`(법인지방소득세 조항)로 잘못 적혀 있었다 —
FORMULA.md 본문("공식 4", "기준/출처")도 "제103조의29는 법인지방소득세 조항이라 개인
이자소득에는 제103조의13이 정확한 근거임을 재확인"이라고 스스로 정정했으나 이 URL 필드만
누락돼 있었다. 실제 파일에는 **`https://casenote.kr/법령/지방세법/제103조의13`**으로
정정해 반영했다(`article` 필드는 애초에 "제103조의13제1항"으로 올바르게 적혀 있었다 —
URL만 어긋난 상태였음을 재확인).

### 5.2 최상위 배치(`policy.ts`가 아니라 `rates-2026.json`) 근거

`docs/ARCHITECTURE.md` "정책 데이터를 언제 계산기 전용 `policy.ts`에 두는가"의 기준
("이 값을 다른 계산기가 재사용할 근거가 실제로 있는가")을 문자 그대로 적용하면, 현재
이 세율을 쓰는 계산기가 이것 하나뿐이므로 `policy.ts`(military-discharge-date,
parental-leave-benefit, housing-subscription-score 방식)가 더 정합적으로 보일 수 있다.
그럼에도 **`rates-2026.json` 최상위에 두기로 확정한다** — 이미 이 파일에 정확히 같은
성격의 선례(`nationalPensionBenefit` 네임스페이스)가 있다: 그 네임스페이스도 도입 당시
"`national-pension-benefit-estimate` 전용"이라고 스스로 명시하면서도 최상위에 배치됐다.
즉 이 프로젝트는 이미 "지금은 계산기 1개만 쓰지만 향후 같은 세율/상수를 재사용할 계산기가
나올 수 있는 정책 데이터"를 최상위에 두는 관례를 갖고 있다 — 이자소득세율(15.4%)도
장래에 배당소득·채권 이자 등 다른 금융소득 계산기가 등장하면 그대로 재사용될 가능성이
`nationalPensionBenefit`의 A값·비례상수보다 특별히 낮지 않다고 판단했다. 또한 이 세율은
매년 정기 점검 대상(`nextReviewDue: 2027-01-01`)이라는 점에서 "연도별 파일 축이 자연스러운
정책"(최저임금류)과 같은 갱신 주기 패턴을 따른다 — "「주택공급에 관한 규칙」처럼 수시
개정이라 연도 축이 어색한 정책"에 해당하지 않으므로 `policy.ts`의 "단일 최신본" 방식이
필요하지도 않다.

### 5.3 정책형 계산기 재검토 트리거 — `PROGRESS.md`에 이미 반영됨

FORMULA.md가 명시한 "실질적 트리거는 매년 말 세법개정안 국회 통과 여부"라는 문구는 이미
`PROGRESS.md`의 이 계산기 행 "다음 재검토 예정일" 열에 반영되어 있음을 확인했다(Product
Owner/Formula Analyst 단계에서 이미 기록됨) — Architect 라운드에서 추가로 손댈 것이
없었다.

---

## 6. 입력 상한/하한 — FORMULA.md 제안값을 그대로 채택 (조정 없음)

FORMULA.md가 제시한 값(예치금액 10,000원~100억원, 월 납입액 10,000원~5,000만원, 연이율
0~30%, 기간 1~120개월)을 검토한 결과 조정 없이 그대로 채택한다.

- 위 "2."에서 확인했듯 이 상한 조합에서도 `Number` 안전 정수 범위에 전혀 근접하지 않아
  숫자 정밀도 관점의 조정 필요성이 없다.
- UX 관점에서도 `loan-interest-calculator`(원금 상·하한 동일 근거 재사용)·`military-salary`
  (월 납입액 상한 비교 대상)와 비교했을 때 자기 완결적인 근거를 이미 갖추고 있다(FORMULA.md
  "입력 상한/하한 근거" 참고) — Architect가 재조정할 결정적 근거를 찾지 못했다.
- 유일하게 재확인이 필요했던 지점은 "예금 100억원 vs 적금 월 5천만원"이라는 비대칭인데,
  이는 "거치식 목돈 1회 입력"과 "적립식 월 반복 입력"이라는 서로 다른 현실적 저축
  패턴(목돈 예치는 자산 이전, 적금 납입은 소득에서 매달 떼는 금액이라 구조적으로 훨씬
  작다)을 반영한 것으로 타당하다고 판단했다.

---

## 7. 폴더 구조 — 단일 `logic.ts` (디렉터리 분할 아님)

### 7.1 판단

`loan-interest-calculator`가 세운 기준("여러 변형이 짧고 독립적인 연산의 나열이면 분기로
충분, 같은 모양의 복잡한 다단계 절차 여러 벌을 공유하면 파일 분할")과
`bill-split-calculator`가 재확인한 기준("방식이 여러 개라는 사실만으로 분할하지 않는다 —
실제 코드 길이·반복 구조를 먼저 본다")을 적용한다.

이 계산기는 세 분기(예금 단리/예금 월복리/적금)를 갖지만, 각 분기의 실제 계산은 매우
짧다:

- **예금 단리**: 한 줄(`principal × rate × months/12`) + 절사 + 세금 계산.
- **예금 월복리**: 한 줄(`principal × ((1+monthlyRate)^months − 1)`) + 절사 + 세금 계산.
- **적금**: `src/lib/installment-savings.ts` 호출(닫힌 형 총합, 이미 절사됨) + 세금 계산
  + 회차별 표 생성(단일 `for` 루프, 회차마다 `remainingMonths`·`interest`를 계산해 배열에
  push하는 것뿐 — `loan-interest-calculator`처럼 "직전 잔액을 다음 회차로 이어받아 갱신"하는
  상태 누적이 없다. 각 행이 독립적으로 계산 가능하다).

세 분기가 공유하는 "다단계 알고리즘 골격"(loan-interest-calculator의 "앵커값 계산 → 회차
반복 → 마지막 회차 강제 보정 → 연도별 집계") 자체가 존재하지 않는다 — 적금의 회차별
루프는 상태를 이어받지 않는 단순 매핑이라 "골격 공유"라고 부를 만한 복잡도가 없다. 따라서
`logic/` 디렉터리로 분할할 근거가 없다 — 단일 `logic.ts`에 분기별로 독립적인 export 함수를
두는 것으로 충분하다(`bill-split-calculator`의 결론과 동일한 성격).

### 7.2 함수 분리 (Builder가 그대로 구현)

```
src/calculators/deposit-savings-interest-calculator/logic.ts

calculateInterestIncomeTax(preTaxInterest: Won): Pick<InterestTaxBreakdown,
  "incomeTax" | "localIncomeTax" | "totalTax" | "afterTaxInterest">
  // FORMULA.md "공식 4" — 세 분기가 완전히 동일하게 재사용(이 계산기 내부에서 3회
  // 재사용되는 순수 계산이므로 로컬 공용 함수로 뽑는다. docs/ARCHITECTURE.md "결정 사례:
  // 순수 날짜 산술 함수의 공용화 범위 재확인" 2번 "한 계산기 내부에서 ≥2회 재사용되는
  // 것만으로도 공용 함수로 뽑을 이유가 된다"를 이 계산기 안에서도 그대로 적용).
  // 다른 계산기가 아직 이자소득세를 다루지 않으므로 src/lib/로 승격하지 않는다(위
  // "5.2"와 같은 논리를 반대로 적용 — 지금은 이 계산기 하나뿐이라 로컬에 둔다. 장래에
  // 이자소득세를 다루는 계산기가 하나 더 생기면 그때 공용화를 재검토한다).

calculateDepositSimple(input: DepositInput & { interestType: "simple" }): DepositResult
calculateDepositCompound(input: DepositInput & { interestType: "compound" }): DepositResult
  // FORMULA.md "공식 1"/"공식 2". 둘 다 세전 이자(raw)를 지역 변수로 계산 → floor →
  // calculateInterestIncomeTax 호출 → 결과 조립.

buildSavingsSchedule(monthlyContribution: Won, annualRatePercent: number, months: number):
  SavingsScheduleRow[]
  // FORMULA.md "계산 순서(적금)" 7단계. i=1..months 각각 remainingMonths=months-i+1,
  // interest=round(monthlyContribution×(annualRatePercent/100)×remainingMonths/12).
  // 도메인 의미가 있는 함수라(회차·잔여개월 개념) src/lib/installment-savings.ts로
  // 옮기지 않고 이 계산기 로컬에 둔다(위 "3.2" 마지막 문단).

calculateSavings(input: SavingsInput): SavingsResult
  // src/lib/installment-savings.ts의 calculateInstallmentSimpleInterestTotal로
  // preTaxInterest 확정 → calculateInterestIncomeTax 호출 → buildSavingsSchedule로
  // schedule[] 생성 → 결과 조립.

calculateDepositSavingsInterest(input: DepositSavingsInterestCalculatorInput):
  DepositSavingsInterestCalculatorResult
  // 공개 진입점. mode(및 deposit일 때 interestType)로 위 함수들에 분기.
```

`sumScheduleDisplayInterest(schedule): Won`(위 "4." 권고)을 추가한다면 이 파일에 함께
둔다.

---

## 8. UI 레이아웃

### 8.1 화면 순서 — `docs/DESIGN_SYSTEM.md` "공통 화면 순서"를 따르며 SPEC.md 순서를 정렬한다

`docs/DESIGN_SYSTEM.md`는 2026-09-07(loan-interest-calculator 라운드)에 "소개를 입력보다
앞에 두라"는 구버전 서술을 **정정**해 현재는 "입력 → 결과 → 계산 근거(수식 breakdown) →
소개·사용 방법 → 정책 안내(계산 전제 고지) → FAQ"를 공식 순서로 명시한다. SPEC.md "화면
구성" 절이 "1. 소개"를 맨 앞에 나열한 것은 이 정정 이전 관례를 그대로 옮긴 것으로 보이며,
`docs/DESIGN_SYSTEM.md`가 site-wide 최신 규칙이므로 이를 따른다(정정 배경은
`docs/ARCHITECTURE.md` "결정 사례: 페이지 구조 공용 컴포넌트" 참고). 최종 순서:

1. **헤더**: h1 + eyebrow 라벨(카테고리 라벨 "금융", `registry.ts` `categoryLabels.finance`
   그대로).
2. **모드 토글**(세그먼트 버튼, "예금 계산" / "적금 계산") — 입력 섹션의 맨 위. 모드 전환
   시 아래 필드 구성 자체가 바뀐다(SPEC.md "입력 모델").
3. **입력 폼**: 공통(연이율 → 기간) + 모드 전용 필드. 예금은 추가로 이자 계산 방식
   라디오(단리/월복리, 각 옵션에 한 줄 요약 helpText — SPEC.md 제시 문구 그대로
   `content.ts`에 보관), 적금은 월 납입액 하나만(계산 방식 선택지 없음, helpText로 이유
   안내).
4. **공유 액션**(`ShareActions`, Should Have) — 계산 전·후 동일 위치, 공유 상태는
   `mode`·금액(`principal` 또는 `monthlyContribution`)·`annualRatePercent`·`termMonths`·
   (deposit만) `interestType`.
5. **계산 버튼**.
6. **핵심 결과 카드**(`bg-primary` 강조 카드, `aria-live="polite"`): **세후 만기수령액**
   하나만 크게. `result.mode`(및 deposit이면 `result.interestType`)로 분기해 방식별
   보조 정보를 함께 표시(TypeScript exhaustiveness 체크의 도움을 받는 `switch` — 세 분기
   추가/삭제 시 컴파일 타임에 누락을 잡는다):
   - 예금: 원금·세전 이자·이자소득세·세후 이자·적용 연이율·기간·계산방식(단리/월복리).
   - 적금: 납입원금 합계·세전 이자·이자소득세·세후 이자·월 납입액·적용 연이율·기간.
   - 공통 하단 고지: "실제 세후 수령액은 참고용 추정치입니다"(SPEC.md "공통" 요건).
7. **(적금 모드) 회차별 breakdown 표** — 아래 "8.2" 참고.
8. **계산 근거(수식 breakdown)**(`SectionCard`): 세전 이자 산출 → 이자소득세 계산(소득세
   14% 사사오입 → 지방소득세 10% 사사오입) → 세후 결과, "라벨 = 값" 형태로 단계별 표시
   (`weekly-holiday-allowance`의 `BreakdownRow` 형태 재사용, `legalBasis` 자리에는 예금
   단리/월복리는 "표준 재무수학", 이자소득세 단계만 실제 법령 조문을 넣는다 — 이 계산기가
   "재무수학 공식(정책형 아님)"과 "이자소득세율(정책형)"이라는 두 성격을 섞어 갖는다는
   FORMULA.md의 구분을 breakdown 표시에도 그대로 반영).
9. **소개**(`IntroSection`) + **사용 방법**(`UsageGuide`): SPEC.md "목적" 요약, 예금/적금
   중 무엇을 선택할지 안내.
10. **정책 안내**(`bg-surface-subtle`): 이자소득세율(15.4%) 근거(소득세법 제129조·지방세법
    제103조의13), 우대금리 자가 입력 안내("최종 적용금리를 직접 입력하세요"), "은행 실제
    계산과 다를 수 있다"는 고지(이자 지급주기·일할계산·원 단위 처리 차이), 금융소득종합과세
    비대상 고지(SPEC.md "핵심 스코프 결정 3").
11. **FAQ**(`FaqAccordion`, SPEC.md가 정의한 7문항 + JSON-LD).

### 8.2 적금 회차별 breakdown 표(최대 120행)의 모바일 표현

SPEC.md는 이 표를 v1 Must Have로 명시하면서 구체적인 모바일 표현(표 vs 카드 전환)을
Architect/Builder 재량으로 위임했다. `loan-interest-calculator`는 정확히 이 문제
(회차별 스케줄이 길다)를 "월별 원본 배열을 아예 화면에 렌더링하지 않고 연도별 요약
(≤40행)만 보여준다"는 방식으로 Should Have로 미뤄 피해 갔지만, 이 계산기는 회차별 표
자체가 Must Have라 같은 회피가 불가능하다.

**결정: `<table>`을 유지하되(카드 전환 없음), 데스크톱·모바일 공통으로 `sticky` 헤더 +
세로 스크롤이 있는 고정 높이 컨테이너(예: `max-h-[420px] overflow-y-auto`) 안에 넣는다.**
근거:

- **열 구성이 four-major-insurance보다 훨씬 가볍다.** four-major-insurance가 카드 전환을
  택한 이유는 열에 "산정 기준"류의 긴 텍스트가 섞여 있었기 때문이다. 이 표의 4개 열
  (회차·납입액·잔여개월·세전 이자)은 전부 짧은 숫자(회차 1~3자리, 금액 최대 8자리+콤마,
  잔여개월 1~3자리)라 `text-sm tabular-nums`와 좁은 padding만으로 320px에서도 가로
  스크롤 없이 들어갈 여지가 크다 — 카드로 쪼개면 오히려 4개 값을 위해 카드 하나당 4줄을
  써서 120행일 때 스크롤 총량이 표보다 훨씬 길어진다.
- **세로 스크롤 컨테이너가 "전체 페이지 길이 폭증"과 "Must Have인 전체 데이터 노출"을
  동시에 만족한다.** `loan-interest-calculator`처럼 원본 배열을 아예 숨기는 선택지가
  없는 상황에서, 페이지를 120행만큼 길게 늘어뜨리지 않으면서도 사용자가 스크롤해 전체
  회차를 확인할 수 있게 하는 절충안이다. 클릭으로 펼쳐야 하는 `<details>` 방식(카테고리
  메뉴가 쓰는 패턴)은 Must Have 콘텐츠를 기본적으로 숨기는 셈이라 채택하지 않는다.
- **DOM 규모 자체는 문제가 아니다** — 최대 120행 × 4열 = 480개 셀로,
  `loan-interest-calculator`가 "480행 원본을 그대로 렌더링하면 위험하다"고 판단한 것과
  같은 규모이지만, 그 판단의 핵심 근거는 "페이지 전체가 480행만큼 길어진다"는 것이었지
  "480개 DOM 노드 자체가 렌더링 성능을 해친다"는 것이 아니었다(`docs/ARCHITECTURE.md`
  "계산 결과 데이터 규모" 참고 — "진짜 위험은... 그대로 480개 DOM 행으로 렌더링하는
  것"). 고정 높이 스크롤 컨테이너를 쓰면 "페이지가 길어지는 문제"는 해결되고, 480개
  셀이라는 규모 자체는 웹이 일상적으로 다루는 수준(수천~수만 항목에 한참 못 미침)이라
  성능 문제로 이어지지 않는다.
- **실측 필요 시 대안**: 320px 실기기 확인에서 표가 여전히 너무 빽빽하면(예: 세로
  스크롤 컨테이너 안에서도 열 너비가 부족), UX/UI Critic 단계에서 four-major-insurance
  방식(모바일 전용 카드 리스트로 전환)으로 바꾸는 것을 재검토할 수 있다 — 이 문서는
  "표를 기본으로 시도한다"는 우선순위만 확정하고, 실기기 검증에서 실패하면 대안이 이미
  있다는 점을 남겨 둔다.
- **행별 반올림 고지 문구**(위 "4." 참고)는 이 표 바로 아래 캡션으로 둔다(`text-sm
  text-muted`), 항상 노출한다(조건부 계산 없이 정적 문구 — 위 "4."의 옵션 2에 해당하는
  최소 구현도 허용하되, 옵션 1(`sumScheduleDisplayInterest` 실제 비교)을 구현하면 이
  캡션을 "차이가 있을 때만" 보여주도록 조건부로 바꿀 수 있다).

### 8.3 접근성/반응형

SPEC.md 공통 요건 그대로 — 결과 영역(핵심 카드 + 회차별 표 전체) `aria-live="polite"`,
모든 입력(연이율·기간·예치금액 또는 월 납입액·계산방식) `label` 연결, 320/375/390/768/1440px
무중단. 모드 토글 전환 시 입력 필드 구성 자체가 바뀌므로(다른 계산기의 "조건부 필드
등장/소멸"보다 변화 폭이 큼) `loan-interest-calculator`의 상환방식 전환과 동일하게 핵심
결과 카드의 최소 높이를 두 모드 간 크게 차이 나지 않도록 맞춘다.

---

## 9. 계산기 등록 전략

- 이번 Architect 라운드에서는 등록하지 않는다(위 "0." 참고, 기존 관례).
- Builder가 UI 구현을 완료하면 `registry.ts`에 다음으로 등록한다:
  ```
  slug: "deposit-savings-interest-calculator"
  title: "예금·적금 이자 계산기"
  category: "finance"
  status: "draft"
  ```
  - **아이콘**: `calculator`를 제안한다. `finance` 카테고리에는 이미 `coins`
    (military-salary)·`chart`(loan-interest-calculator)·`trend`(average-cost-calculator)
    세 키가 쓰이고 있어 네 번째 계산기는 이 셋과 구분되는 키가 필요하다. `calculator`는
    이미 `unemployment-benefit`(labor)·`housing-acquisition-tax`(tax)가 쓰고 있지만
    서로 다른 카테고리 섹션에 노출되므로 문제되지 않는다(기존 관례 — `coins`/`chart`도
    카테고리를 넘어 중복 사용 중). "예금·적금 이자를 계산해 주는 범용 금융 계산 도구"라는
    성격이 `heart`(건강/보험 계열에 주로 쓰임)·`utility`보다 `calculator`와 더 잘 맞는다.
- Calculation Auditor + UX/UI Critic + QA 통과 전에는 `published`로 바꾸지 않는다.

---

## 10. Builder 인수인계 요약

1. `types.ts` — 이미 작성 완료(위 "1." 그대로). 새 필드가 필요하면 이 문서의 설계 원칙
   (판별 유니온 2단계, `InterestTaxBreakdown` 교차 타입)을 유지한 채 추가한다.
2. `src/lib/installment-savings.ts` — 이미 작성 완료. `calculateInstallmentSimpleInterestTotal`
   시그니처를 그대로 가져다 쓴다(임의로 바꾸지 않는다 — military-salary가 이미 의존).
3. `logic.ts` — 위 "7.2" 함수 분리를 그대로 구현. FORMULA.md "계산 순서"를 함수별로 옮긴다.
   `calculateInterestIncomeTax`는 이 계산기 내부에서 3회(예금 단리/월복리/적금) 재사용되므로
   반드시 별도 함수로 뽑는다(인라인 3벌 복붙 금지 — 반올림 정책이 세 곳에 흩어지면 드리프트
   위험이 생긴다).
4. `validation.ts` — FORMULA.md "입력값" 표의 범위(예치금액 10,000~10,000,000,000, 월
   납입액 10,000~50,000,000, 연이율 0~30, `termMonths` 1~120) + 예금 모드 `interestType`
   필수 선택 검증.
5. `logic.test.ts` — FORMULA.md 검증 예제 18개(오류 케이스 5종 포함)를
   `calculateDepositSavingsInterest`로 그대로 Golden Test로 옮긴다. **예제 5·6은 아래
   "11. 정밀 재계산 확정값"으로 교체해 사용한다**(FORMULA.md 원문은 손계산 근사치라고
   스스로 명시했다).
6. `formatting.ts` — `preTaxInterest`/`schedule[].interest` 등은 이미 정수이므로
   `Intl.NumberFormat('ko-KR')`만 적용한다(재반올림 없음 — 위 "4." 참고). 방식별 계산
   근거(breakdown) 문자열 조립, `sumScheduleDisplayInterest` 도입 시 그 표시 문자열.
7. `content.ts` — SPEC.md가 제시한 FAQ 7문항 질문 + FORMULA.md "FAQ 답변 근거"를 그대로
   답변으로 옮긴다. 계산방식 라디오 helpText(단리/월복리 한 줄 요약), 계산 전제 고지 문구.
8. `ui.tsx` — 위 "8." 화면 구조. 모드 토글, 예금 계산방식 라디오, 적금 회차별 표(스크롤
   컨테이너, 위 "8.2"), `ShareActions`.
9. 레지스트리에 `status: "draft"`로 등록 + 아이콘 `calculator` (위 "9.").
10. 새 계산기 완료 후 기존 계산기 Smoke Test(`docs/EVALUATION.md` "회귀 방지") — 이번
    Architect 라운드에서 이미 `military-salary`와 공용 코드(`src/lib/installment-savings.ts`)
    변경에 대한 회귀 검증을 마쳤으므로(위 "0."/"3.4"), Builder는 자신이 새로 추가하는
    코드(레지스트리 등록 시 아이콘 등)에 대해서만 추가로 확인하면 된다.

---

## 11. 정밀 재계산 확정값 — FORMULA.md 예제 5·6(월복리 12개월)

FORMULA.md가 "손계산 근사치, Builder/Calculation Auditor가 정밀 재계산 필요"로 명시한
두 예제를 Node.js `Math.pow`(배정밀도 부동소수점, 반복 곱셈이 아니라 거듭제곱 직접 계산)로
정밀 재계산해 확정한다(확인일 2026-09-15). Builder는 이 값을 `logic.test.ts` Golden Test
Expected로 그대로 사용한다.

### 예제 5 — 예금 월복리, `principal=10,000,000`, `annualRatePercent=3`, `termMonths=12`

```
월이율 = 0.03/12 = 0.0025
(1.0025)^12 = 1.0304159569135067   (Math.pow(1.0025, 12) 직접 계산, 배정밀도 그대로)
세전 이자(raw) = 10,000,000 × (1.0304159569135067 − 1) = 304,159.569135067...
preTaxInterest = floor(304,159.569...) = 304,159
incomeTax = round(304,159 × 0.14) = round(42,582.26) = 42,582
localIncomeTax = round(42,582 × 0.10) = round(4,258.2) = 4,258
totalTax = 42,582 + 4,258 = 46,840
afterTaxInterest = 304,159 − 46,840 = 257,319
afterTaxMaturityAmount = 10,000,000 + 257,319 = 10,257,319
```

**Expected(확정, 근사 아님)**: `preTaxInterest=304,159`, `incomeTax=42,582`,
`localIncomeTax=4,258`, `totalTax=46,840`, `afterTaxInterest=257,319`,
`afterTaxMaturityAmount=10,257,319원`.

(참고: 같은 조건 단리는 예제 1과 동일하게 `preTaxInterest=300,000`,
`afterTaxMaturityAmount=10,253,800원` — 월복리가 세전 4,159원, 세후 3,519원 더 많다.
FORMULA.md 프로즈가 예상한 "세전 이자 약 4,160원 차이"와 거의 정확히 일치한다.)

### 예제 6 — 예금 월복리, `principal=1,000,000`, `annualRatePercent=30`, `termMonths=12`

```
월이율 = 0.30/12 = 0.025
(1.025)^12 = 1.3448888242462971   (Math.pow(1.025, 12) 직접 계산)
세전 이자(raw) = 1,000,000 × (1.3448888242462971 − 1) = 344,888.8242462971...
preTaxInterest = floor(344,888.824...) = 344,888
incomeTax = round(344,888 × 0.14) = round(48,284.32) = 48,284
localIncomeTax = round(48,284 × 0.10) = round(4,828.4) = 4,828
totalTax = 48,284 + 4,828 = 53,112
afterTaxInterest = 344,888 − 53,112 = 291,776
afterTaxMaturityAmount = 1,000,000 + 291,776 = 1,291,776
```

**Expected(확정, 근사 아님)**: `preTaxInterest=344,888`, `incomeTax=48,284`,
`localIncomeTax=4,828`, `totalTax=53,112`, `afterTaxInterest=291,776`,
`afterTaxMaturityAmount=1,291,776원`.

(참고: 같은 조건 단리는 `preTaxInterest=300,000`, `afterTaxMaturityAmount=1,253,800원` —
월복리가 세전 44,888원 더 많아, 예제 5(이율 3%, 차이 4,159원)보다 이율이 10배 높을 때
격차가 10배보다 더 크게 벌어짐을 확인할 수 있다 — "이율이 높을수록 단리·복리 격차가
커진다"는 FORMULA.md의 재무수학 일반 성질과 정합적이다.)

### 재계산 방법

```js
function calc(principal, annualRatePercent, months) {
  const monthlyRate = annualRatePercent / 100 / 12;
  const raw = principal * (Math.pow(1 + monthlyRate, months) - 1);
  const preTax = Math.floor(raw);
  const incomeTax = Math.round(preTax * 0.14);
  const localTax = Math.round(incomeTax * 0.10);
  const afterTax = preTax - incomeTax - localTax;
  return { preTax, incomeTax, localTax, afterTax, maturity: principal + afterTax };
}
```

Node.js(V8, IEEE 754 배정밀도)로 직접 실행해 확인했다 — `Math.pow`의 결과가 배정밀도
범위 안에서 완전히 결정적이므로(위 "2." 안전 정수 범위 분석 참고, 지수 12는 훨씬 더 큰
지수(120)에서도 안전하다고 확인된 것보다 작아 오차 여지가 더욱 적다), 이 값들은 근사치가
아니라 **Node.js/브라우저 어디서 실행해도 동일하게 재현되는 확정값**이다.

---

## 12. 남은 리스크 / 확인 필요

- FORMULA.md "확인 필요 목록"(세전 이자 원 단위 절사의 완전한 법적 근거, 이자소득세
  반올림 방향의 완전한 1차 근거, 은행연합회·금감원 공식 계산기 실제 숫자 미확인, 소득세법
  제129조·지방세법 제103조의13 정확한 최초 시행일)은 Architect 영역 밖이다 — Calculation
  Auditor 단계에서 재확인을 권고한다(FORMULA.md가 이미 명시).
- 위 "8.2"의 회차별 표 모바일 표현(고정 높이 스크롤 컨테이너)은 이 사이트 최초의 접근
  방식이다(기존 계산기는 "숨기고 요약만 보여주기"(loan-interest-calculator) 또는 "카드로
  전환"(four-major-insurance) 둘 중 하나였다) — UX/UI Critic이 실제 구현 후 320px 실기기
  에서 가독성을 재확인할 것을 권장한다. 표가 예상보다 빽빽하면 four-major-insurance
  방식(모바일 카드 전환)으로 전환하는 대안이 이미 이 문서에 근거와 함께 남아 있다.
- `src/lib/installment-savings.ts` 공용화는 "동일한 법적 정의"가 아니라 "동일한 수식·
  반올림 정책의 확정적 동시 재사용"이라는 다소 넓어진 기준을 처음 적용한 사례다(위 "3.2") —
  다음에 유사하게 "법적 근거는 다르지만 표준 공식이 우연히 완전히 같은" 사례가 생기면 이
  문서를 참고 판례로 삼는다.
- `interestIncomeTax`를 `rates-2026.json` 최상위에 둔 결정(위 "5.2")은 `nationalPensionBenefit`
  선례에 기댄 것이다 — 만약 향후 이 세율을 재사용하는 두 번째 계산기가 끝내 나타나지
  않는다면(추측성 재사용 근거였음이 드러나면), 이는 향후 Architect가 "재사용 근거가 실제로
  있는가" 기준을 정책 데이터 배치에 더 엄격하게 적용해야 한다는 반례로 남을 수 있다.
