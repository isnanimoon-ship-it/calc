/**
 * 예금·적금 이자 계산기 — 계산 로직.
 *
 * tasks/deposit-savings-interest-calculator/FORMULA.md "공식"·"계산 순서"를 그대로 구현한다.
 * 구조는 tasks/deposit-savings-interest-calculator/ARCHITECTURE.md "7.2 함수 분리"를 그대로
 * 따른다 — 세 분기(예금 단리/예금 월복리/적금)가 각각 매우 짧은 계산이라 `logic/` 디렉터리로
 * 나누지 않고 단일 파일에 분기별 export 함수를 둔다.
 *
 * 이자소득세율은 하드코딩하지 않고 `src/data/rates-2026.json`의 `interestIncomeTax`
 * 네임스페이스를 참조한다(national-pension-benefit-estimate/logic.ts와 동일한 패턴).
 * 적금 세전 이자 총합은 `src/lib/installment-savings.ts`의
 * `calculateInstallmentSimpleInterestTotal`을 그대로 재사용한다(로컬 재구현 금지 —
 * military-salary와 공유하는 함수, ARCHITECTURE.md "3." 참고).
 */

import rates2026 from "@/src/data/rates-2026.json";
import { calculateInstallmentSimpleInterestTotal } from "@/src/lib/installment-savings";
import type {
  DepositInput,
  DepositResult,
  DepositSavingsInterestCalculatorInput,
  DepositSavingsInterestCalculatorResult,
  SavingsInput,
  SavingsResult,
  SavingsScheduleRow,
  Won,
} from "./types";

/** rates-2026.json의 `interestIncomeTax` 네임스페이스 타입(2026년 스키마 기준). */
type InterestIncomeTaxRates = (typeof rates2026)["interestIncomeTax"];
const interestIncomeTaxRates: InterestIncomeTaxRates = rates2026.interestIncomeTax;

/** 소득세율 14%(그 밖의 이자소득) — 소득세법 제129조제1항제1호. */
const INCOME_TAX_RATE = interestIncomeTaxRates.incomeTaxRate.value;
/** 지방소득세율 10%(원천징수하는 소득세액 기준) — 지방세법 제103조의13제1항. */
const LOCAL_INCOME_TAX_RATE = interestIncomeTaxRates.localIncomeTaxRate.value;

export interface InterestIncomeTaxResult {
  incomeTax: Won;
  localIncomeTax: Won;
  totalTax: Won;
  afterTaxInterest: Won;
}

/**
 * 이자소득세(15.4% = 소득세 14% + 지방소득세 1.4%) 계산 — FORMULA.md "공식 4".
 *
 * 반드시 이 순서를 지킨다: 소득세를 세전 이자의 14%로 먼저 사사오입해 정수로 확정한 뒤,
 * 지방소득세는 "세전 이자의 1.4%"가 아니라 "이미 확정된 소득세 정수값의 10%"를 다시
 * 사사오입한다(지방세법 제103조의13제1항 문언 — 원천징수하는 소득세의 10%).
 *
 * 이 계산기 내부에서 3회(예금 단리/예금 월복리/적금) 재사용되므로 별도 함수로 뽑는다
 * (ARCHITECTURE.md "7.2" — 인라인 3벌 복붙 금지, 반올림 정책 드리프트 방지).
 */
/**
 * 예금 단리 세전 이자 `principal × (annualRatePercent/100) × (termMonths/12)`를
 * 부동소수점(IEEE 754 double) 오차 없이 **정확한 유리수 연산**(BigInt)으로 계산하고, 그
 * 결과를 곧바로 절사(버림)한 정수로 반환한다.
 *
 * **왜 부동소수점 대신 BigInt 유리수 연산인가 — 두 번째 라운드에서 교체됨**: 최초 구현은
 * `Math.floor(rawInterest + 1e-6)`(고정 epsilon 보정)을 썼다. Calculation Auditor
 * 1차 감사는 "예금 단리는 나눗셈·곱셈만 있고 지수 연산이 없어 구조적으로 안전하다"(진짜
 * 유리수의 최소 소수부가 항상 `1/120,000`보다 크다는 이론적 근거)고 PASS 판정했지만, 이는
 * "참값의 분수 구조"에 대한 사실일 뿐 "부동소수점 연산 자체가 참값에서 얼마나 벗어나는가"에
 * 대한 사실이 아니었다. 실제로 원금이 커지면(약 20억원 이상) `principal × (annualRatePercent
 * /100) × (termMonths/12)`의 곱셈·나눗셈 절대오차가 원금 크기에 비례해 커지면서 고정
 * epsilon(1e-6)을 넘어서, 진짜 정수값을 1원 작게 절사하는 반례가 실제로 존재함을 Calculation
 * Auditor 재검증이 브루트포스로 실증했다(예: `principal=9,000,000,000, annualRatePercent=
 * 6.27, termMonths=113` → 옛 구현 `5,313,824,999`, 정답 `5,313,825,000`.
 * `tasks/deposit-savings-interest-calculator/EVALUATION.md` "## Calculation Auditor
 * (재검증)" "3-A" 절). 예금 월복리(`calculateCompoundPreTaxInterestExact`, 아래)가 이미
 * BigInt 정확 연산으로 이 문제를 해소했으므로, 동일한 철학을 예금 단리에도 적용한다 — 이
 * 산식은 지수 연산이 없어 오히려 더 간단하다.
 *
 * **유도**: `annualRatePercent`는 소수 둘째 자리까지이므로 `annualRatePercent × 100`은
 * 항상 정수다(`rateHundredths`). `annualRatePercent/100 = rateHundredths/10000`이므로
 * ```
 * 세전 이자 = principal × (rateHundredths/10000) × (termMonths/12)
 *          = principal × rateHundredths × termMonths / 120000
 * ```
 * 분자·분모 모두 0 이상의 정수이고(연이율·원금·기간 모두 0 이상), BigInt 나눗셈(0 방향
 * 절삭)이 그대로 `Math.floor`와 같은 결과를 낸다 — 근사가 아니라 수학적으로 엄밀한 값이므로
 * epsilon 자체가 필요 없다.
 */
function calculateSimplePreTaxInterestExact(
  principal: Won,
  annualRatePercent: number,
  termMonths: number,
): Won {
  // 아래 calculateCompoundPreTaxInterestExact와 동일한 이유(부동소수점 표현 오차 제거)로
  // Math.round를 거쳐 rateHundredths를 정수로 스냅한다.
  const rateHundredths = BigInt(Math.round(annualRatePercent * 100));
  const denominator = 120000n; // 100(퍼센트 환산) × 100(rateHundredths 환산) × 12(개월)

  const numerator = BigInt(principal) * rateHundredths * BigInt(termMonths);

  return Number(numerator / denominator);
}

/**
 * 예금 월복리 세전 이자 `principal × (1+월이율)^개월수 − principal`를 부동소수점(IEEE 754
 * double) 오차 없이 **정확한 유리수 연산**(BigInt)으로 계산하고, 그 결과를 곧바로 절사(버림)한
 * 정수로 반환한다.
 *
 * **왜 부동소수점 대신 BigInt 유리수 연산인가**: Calculation Auditor가 고정 epsilon(1e-6)
 * 보정이 월복리 경로에서 두 방향 모두 뚫리는 것을 실증했다(위 `calculateSimplePreTaxInterestExact`
 * 설명 참고). FORMULA.md "핵심 결정 3"이 대안으로 제시한 소거오차(catastrophic cancellation)
 * 완화 기법(`Math.expm1(n×Math.log1p(r))`) 역시 여전히 부동소수점 근사이므로 "절대 반례
 * 없음"을 보장하지 못한다. 반면 이 계산기의 입력(`annualRatePercent`는 소수 둘째 자리까지,
 * `termMonths`·`principal`은 정수 — FORMULA.md "입력값")은 그 자체로 항상 **유리수**이므로,
 * 부동소수점으로 근사하지 않고 BigInt 정수 연산만으로 완전히 정확하게 계산할 수 있다 —
 * 근사가 아니라 수학적으로 엄밀한 값이므로 epsilon 자체가 필요 없다.
 *
 * **유도**: `annualRatePercent`는 소수 둘째 자리까지이므로 `annualRatePercent × 100`은
 * 항상 정수다(`rateHundredths`). 월이율 `annualRatePercent/100/12 = rateHundredths/120000`
 * 이므로 `1+월이율 = (120000+rateHundredths)/120000 = base/denom`(기약분수 여부는 무관 —
 * 아래 나눗셈에서 자동으로 상쇄된다). 따라서
 * ```
 * 세전 이자 = principal × [(base/denom)^n − 1] = principal × (base^n − denom^n) / denom^n
 * ```
 * 이며, `base ≥ denom ≥ 0`(연이율 0% 이상)이므로 분자·분모 모두 0 이상의 정수이고, BigInt
 * 나눗셈(0 방향으로 절삭)이 그대로 `Math.floor`와 같은 결과를 낸다.
 *
 * **안전 범위**: FORMULA.md 입력 상한(원금 100억원, 연이율 30%, 기간 120개월)에서도 세전
 * 이자의 이론적 최댓값은 약 1,840억원 수준으로 `Number.MAX_SAFE_INTEGER`(약 900조)보다
 * 훨씬 작아, 최종 `Number()` 변환에서 정밀도 손실이 없다(브루트포스 검증 결과는
 * `tasks/deposit-savings-interest-calculator/EVALUATION.md` "## Optimizer" 참고).
 */
function calculateCompoundPreTaxInterestExact(
  principal: Won,
  annualRatePercent: number,
  termMonths: number,
): Won {
  // annualRatePercent는 검증 단계에서 소수 둘째 자리까지로 제한되지만, 부동소수점 표현 자체는
  // "23.79" 같은 값을 정확히 저장하지 못할 수 있다(예: 23.79×100이
  // 2378.9999999999995처럼 나올 수 있음). Math.round로 가장 가까운 정수에 스냅해 이 표현
  // 오차를 제거한다 — 실제 오차 크기(~1e-13 상대오차)는 0.5보다 훨씬 작아 항상 안전하게
  // 올바른 정수로 복원된다.
  const rateHundredths = BigInt(Math.round(annualRatePercent * 100));
  const denom = 120000n; // annualRatePercent/100/12 의 분모(100 × 100 × 12)
  const base = denom + rateHundredths; // (1+월이율)의 분자, 분모는 denom과 동일
  const n = BigInt(termMonths);

  const numerator = BigInt(principal) * (base ** n - denom ** n);
  const denominator = denom ** n;

  return Number(numerator / denominator);
}

/**
 * BigInt 정수 나눗셈으로 `numerator / denominator`를 반올림(사사오입, round-half-up)한다.
 * `numerator`·`denominator` 모두 0 이상인 경우에만 정확하다(이 파일에서 다루는 원금·연이율·
 * 개월수가 전부 0 이상이므로 항상 성립).
 *
 * 유도: `(numerator×2 + denominator) / (denominator×2)`를 BigInt 나눗셈(0 방향 절삭 —
 * 비음수에서는 floor와 동일)하면, `x = numerator/denominator`라 할 때 좌변은 `floor(x + 0.5)`와
 * 정확히 같다 — 즉 정확한 유리수 값을 실제로 반올림한 정수를 부동소수점 없이 얻는다. 정확히
 * .5인 타이는 위(올림)로 반올림된다(FORMULA.md "사사오입"과 일치).
 */
function roundHalfUpBigInt(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

export function calculateInterestIncomeTax(preTaxInterest: Won): InterestIncomeTaxResult {
  const incomeTax = Math.round(preTaxInterest * INCOME_TAX_RATE);
  const localIncomeTax = Math.round(incomeTax * LOCAL_INCOME_TAX_RATE);
  const totalTax = incomeTax + localIncomeTax;
  const afterTaxInterest = preTaxInterest - totalTax;
  return { incomeTax, localIncomeTax, totalTax, afterTaxInterest };
}

/**
 * 예금(거치식) 단리 — FORMULA.md "공식 1". 세전 이자는
 * `calculateSimplePreTaxInterestExact`가 BigInt 유리수 연산으로 한 번만 정확히 계산한 뒤
 * 그 결과를 그대로 쓴다(중간에 재계산하지 않음 — FORMULA.md "앵커 값 재계산 금지").
 */
export function calculateDepositSimple(
  input: DepositInput & { interestType: "simple" },
): DepositResult {
  const { principal, annualRatePercent, termMonths } = input;
  const preTaxInterest = calculateSimplePreTaxInterestExact(principal, annualRatePercent, termMonths);
  const tax = calculateInterestIncomeTax(preTaxInterest);

  return {
    mode: "deposit",
    interestType: "simple",
    principal,
    annualRatePercent,
    termMonths,
    preTaxInterest,
    ...tax,
    afterTaxMaturityAmount: principal + tax.afterTaxInterest,
  };
}

/**
 * 예금(거치식) 월복리 — FORMULA.md "공식 2". 월이율은 연이율 단순 12분할(실효월이율 환산
 * 아님). 세전 이자는 `calculateCompoundPreTaxInterestExact`가 BigInt 유리수 연산으로 한
 * 번만 정확히 계산한 뒤 그 결과를 그대로 쓴다(중간에 재계산하지 않음 — FORMULA.md "앵커 값
 * 재계산 금지"). `monthlyRate`는 표시 전용 값이라 기존처럼 부동소수점 나눗셈으로 계산한다
 * (절사 로직에 관여하지 않으므로 정밀도 문제와 무관).
 */
export function calculateDepositCompound(
  input: DepositInput & { interestType: "compound" },
): DepositResult {
  const { principal, annualRatePercent, termMonths } = input;
  const monthlyRate = annualRatePercent / 100 / 12;
  const preTaxInterest = calculateCompoundPreTaxInterestExact(principal, annualRatePercent, termMonths);
  const tax = calculateInterestIncomeTax(preTaxInterest);

  return {
    mode: "deposit",
    interestType: "compound",
    principal,
    annualRatePercent,
    termMonths,
    monthlyRate,
    preTaxInterest,
    ...tax,
    afterTaxMaturityAmount: principal + tax.afterTaxInterest,
  };
}

/**
 * 적금 회차별 breakdown 표 — FORMULA.md "계산 순서(적금)" 7단계. i=1..months 각각
 * `잔여개월_i = months - i + 1`, `interest_i(raw) = contribution × (연이율/100) ×
 * 잔여개월_i ÷ 12`를 계산해 행마다 독립적으로 반올림(사사오입)한다. 각 행이 독립적으로 계산
 * 가능하므로(직전 회차 상태를 이어받지 않음) 단순 반복문으로 충분하다
 * (ARCHITECTURE.md "7.1").
 *
 * 도메인 의미(회차·잔여개월)가 있는 함수라 `src/lib/installment-savings.ts`(도메인 의미
 * 없는 순수 산술만 담는 파일)로 옮기지 않고 이 계산기 로컬에 둔다(ARCHITECTURE.md "3.2").
 *
 * **왜 부동소수점 대신 BigInt 유리수 연산인가 — Calculation Auditor 2차 재검증에서 발견됨**:
 * 최초 구현은 `Math.round((monthlyContribution × (annualRatePercent/100) × remainingMonths) /
 * 12)`를 순수 부동소수점으로 계산했다. 이는 예금 단리·월복리·적금 총합 세 곳에서 이미 두
 * 차례에 걸쳐 BigInt로 교체된 것과 완전히 같은 구조(원금류 값 × (연이율/100) × 개월/12)임에도
 * 그 전환에서 누락되어 있었다. Calculation Auditor 2차 재검증이 전체 입력 도메인의 약 0.75%
 * (360만 개 전수 격자 스윕 중 26,930건)에서 정답보다 정확히 1원 작게 계산되는 것을 실증했다
 * (예: `monthlyContribution=10,000, annualRatePercent=0.03, remainingMonths=2` → 참값은
 * 정확히 0.5원의 사사오입인 `1`원인데, `10,000×(0.03/100)`이 부동소수점 표현 오차로
 * `2.9999999999999996`(참값 `3`보다 미세하게 작음)이 되면서 최종 `rawInterest`가 정확한
 * 타이(0.5)보다 살짝 작아져 `Math.round`가 `0`으로 잘못 내림했다.
 * `tasks/deposit-savings-interest-calculator/EVALUATION.md` "## Calculation Auditor (2차
 * 재검증)" "4-B" 절 참고).
 *
 * **유도**: 예금 단리(`calculateSimplePreTaxInterestExact`)와 동일하게
 * `annualRatePercent × 100`은 항상 정수(`rateHundredths`)이므로
 * ```
 * interest_i(raw) = monthlyContribution × rateHundredths × remainingMonths_i / 120000
 * ```
 * 이 대수적으로 성립한다. 다만 이 값은 `preTaxInterest`(절사, `Math.floor`)와 달리 FORMULA.md
 * "계산 순서(적금)" 7단계가 명시적으로 "사사오입"(반올림)으로 정했으므로, 단순 BigInt 나눗셈
 * (0 방향 절삭)이 아니라 `roundHalfUpBigInt`로 반올림한다 — 근사가 아니라 수학적으로 엄밀한
 * 값을 정확히 반올림하므로 epsilon이 필요 없다.
 */
export function buildSavingsSchedule(
  monthlyContribution: Won,
  annualRatePercent: number,
  months: number,
): SavingsScheduleRow[] {
  // calculateSimplePreTaxInterestExact와 동일한 이유(부동소수점 표현 오차 제거)로
  // Math.round를 거쳐 rateHundredths를 정수로 스냅한다.
  const rateHundredths = BigInt(Math.round(annualRatePercent * 100));
  const denominator = 120000n; // 100(퍼센트 환산) × 100(rateHundredths 환산) × 12(개월)

  const rows: SavingsScheduleRow[] = [];
  for (let installment = 1; installment <= months; installment++) {
    const remainingMonths = months - installment + 1;
    const numerator = BigInt(monthlyContribution) * rateHundredths * BigInt(remainingMonths);
    rows.push({
      installment,
      contribution: monthlyContribution,
      remainingMonths,
      interest: Number(roundHalfUpBigInt(numerator, denominator)),
    });
  }
  return rows;
}

/**
 * `schedule[]`의 행별 표시 이자 합계 — 순수 집계(재계산 아님). 이 표의 합계가
 * `preTaxInterest`(전체 정밀도 합산 후 1회만 절사)와 원 단위에서 근소하게 다를 수 있다는
 * 사실을 UI가 안내할 때 쓴다(ARCHITECTURE.md "4." 권고 — 집계는 logic이, 표시는 formatting이
 * 담당). `SavingsResult`에 필드로 추가하지 않는다 — `schedule[]` 자체가 이미 SSOT이므로
 * 필요할 때 이 함수로 다시 합산한다.
 */
export function sumScheduleDisplayInterest(schedule: SavingsScheduleRow[]): Won {
  return schedule.reduce((sum, row) => sum + row.interest, 0);
}

/**
 * 적금(적립식) 단리 후취식 — FORMULA.md "공식 3". 세전 이자 총합은
 * `calculateInstallmentSimpleInterestTotal`(military-salary와 공유, 절사까지 포함)을 그대로
 * 재사용한다 — 로컬로 다시 구현하지 않는다(ARCHITECTURE.md "3.").
 */
export function calculateSavings(input: SavingsInput): SavingsResult {
  const { monthlyContribution, annualRatePercent, termMonths } = input;
  const totalPrincipal = monthlyContribution * termMonths;
  const preTaxInterest = calculateInstallmentSimpleInterestTotal(
    monthlyContribution,
    annualRatePercent,
    termMonths,
  );
  const tax = calculateInterestIncomeTax(preTaxInterest);
  const schedule = buildSavingsSchedule(monthlyContribution, annualRatePercent, termMonths);

  return {
    mode: "savings",
    monthlyContribution,
    annualRatePercent,
    termMonths,
    totalPrincipal,
    schedule,
    preTaxInterest,
    ...tax,
    afterTaxMaturityAmount: totalPrincipal + tax.afterTaxInterest,
  };
}

/** 공개 진입점 — `mode`(및 예금이면 `interestType`)로 위 함수들에 분기한다. */
export function calculateDepositSavingsInterest(
  input: DepositSavingsInterestCalculatorInput,
): DepositSavingsInterestCalculatorResult {
  if (input.mode === "savings") {
    return calculateSavings(input);
  }
  // `DepositInput`은 ARCHITECTURE.md "1.1"이 의도적으로 평평한(non-nested) 유니온으로 설계했다
  // (interestType 값과 무관하게 입력 필드 구성이 동일하므로). 그 결과 TypeScript는
  // `input.interestType === "simple"` 비교만으로 `input` 전체를 교차 타입으로 좁혀주지 않는다
  // (판별 프로퍼티가 유니온 태그가 아니라 단일 인터페이스의 리터럴 유니온 필드이기 때문) —
  // 바로 위 조건에서 실제로 확인했으므로 단언(as)으로 알려준다.
  if (input.interestType === "simple") {
    return calculateDepositSimple(input as DepositInput & { interestType: "simple" });
  }
  return calculateDepositCompound(input as DepositInput & { interestType: "compound" });
}
