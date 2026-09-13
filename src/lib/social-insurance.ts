/**
 * 근로자 부담분 사회보험료 계산 — `four-major-insurance`와 `annual-salary-take-home-pay`가
 * 공유하는 순수 산술 계산.
 *
 * tasks/annual-salary-take-home-pay/ARCHITECTURE.md "1. 핵심 결정 — 4대 보험 근로자 부담분
 * 재사용 방식"이 정한 계약대로, `src/calculators/four-major-insurance/logic.ts`에 있던
 * 근로자 부담분 계산(기준소득월액 clamp, 국민연금 기여금, 건강보험 총액 clamp 후 50% 분할,
 * 장기요양보험 유도, 고용보험 근로자 부담)을 한 글자도 바꾸지 않고 그대로 옮겼다.
 *
 * 이 파일은 "근로자 부담분 산정"이라는 좁고 도메인 의미가 고정된 계산만 다루고, 가입
 * 여부 on/off·사업주 부담·사업장 규모 같은 `four-major-insurance` 고유 개념은 다루지
 * 않는다(위 ARCHITECTURE.md 문서 참고). `date-calc.ts`가 순수 날짜 산술만 다루고 도메인
 * 판정은 호출부에 남기는 것과 같은 원칙이다.
 */

import rates2026 from "@/src/data/rates-2026.json";

const rates = rates2026.socialInsurance;

type IntegerRate = { numerator: number; denominator: number };

export interface EmployeeSocialInsuranceInput {
  /** 세전 월 급여(원). */
  monthlyGrossPay: number;
  /** 월 비과세 금액(원). */
  monthlyNonTaxablePay: number;
}

export interface EmployeeSocialInsuranceCoreResult {
  /** monthlyGrossPay - monthlyNonTaxablePay */
  estimatedMonthlyRemuneration: number;
  /** 상하한 적용 후 국민연금 기준소득월액 */
  pensionStandardMonthlyIncome: number;
  employeePension: number;
  /**
   * 건강보험 상하한 적용 후 "근로자+사업주 합계". `four-major-insurance`가
   * `employer = healthTotalClamped - employeeHealth`로 역산할 때만 필요하다 —
   * `annual-salary-take-home-pay`는 이 필드를 쓰지 않는다.
   */
  healthTotalClamped: number;
  employeeHealth: number;
  employeeLongTermCare: number;
  /** 고용보험 실업급여 근로자 부담(사업장 규모 무관, 항상 확정) */
  employeeEmployment: number;
  /** 위 네 값의 합 */
  employeeInsuranceTotal: number;
  pensionMinimumApplied: boolean;
  pensionMaximumApplied: boolean;
  healthMinimumApplied: boolean;
  healthMaximumApplied: boolean;
  appliedRateYear: 2026;
  appliedRatePeriod: "2026-07-01/2027-06-30";
}

export function truncateTo10Won(value: number): number {
  return Math.floor(value / 10) * 10;
}

function applyRate(amount: number, rate: IntegerRate): number {
  return truncateTo10Won((amount * rate.numerator) / rate.denominator);
}

export function calculateEmployeeSocialInsuranceContributions(
  input: EmployeeSocialInsuranceInput,
): EmployeeSocialInsuranceCoreResult {
  const remuneration = input.monthlyGrossPay - input.monthlyNonTaxablePay;
  const pensionRaw =
    Math.floor(remuneration / rates.nationalPension.standardMonthlyIncomeUnit.value) *
    rates.nationalPension.standardMonthlyIncomeUnit.value;
  const pensionBase = Math.min(
    rates.nationalPension.standardMonthlyIncomeMax.value,
    Math.max(rates.nationalPension.standardMonthlyIncomeMin.value, pensionRaw),
  );

  const employeePension = applyRate(pensionBase, rates.nationalPension.employeeRate);

  const rawHealthTotal = applyRate(remuneration, rates.healthInsurance.totalRate);
  const healthTotal = Math.min(
    rates.healthInsurance.monthlyPremiumMax.value,
    Math.max(rates.healthInsurance.monthlyPremiumMin.value, rawHealthTotal),
  );
  const employeeHealth = truncateTo10Won(healthTotal / 2);

  const employeeLongTermCare = truncateTo10Won(
    (employeeHealth * rates.healthInsurance.longTermCareRate.numerator *
      rates.healthInsurance.totalRate.denominator) /
      (rates.healthInsurance.longTermCareRate.denominator *
        rates.healthInsurance.totalRate.numerator),
  );

  const employeeEmployment = applyRate(
    remuneration,
    rates.employmentInsurance.employeeUnemploymentRate,
  );

  const employeeInsuranceTotal =
    employeePension + employeeHealth + employeeLongTermCare + employeeEmployment;

  return {
    estimatedMonthlyRemuneration: remuneration,
    pensionStandardMonthlyIncome: pensionBase,
    employeePension,
    healthTotalClamped: healthTotal,
    employeeHealth,
    employeeLongTermCare,
    employeeEmployment,
    employeeInsuranceTotal,
    pensionMinimumApplied: pensionRaw < rates.nationalPension.standardMonthlyIncomeMin.value,
    pensionMaximumApplied: pensionRaw > rates.nationalPension.standardMonthlyIncomeMax.value,
    healthMinimumApplied: rawHealthTotal < rates.healthInsurance.monthlyPremiumMin.value,
    healthMaximumApplied: rawHealthTotal > rates.healthInsurance.monthlyPremiumMax.value,
    appliedRateYear: 2026,
    appliedRatePeriod: "2026-07-01/2027-06-30",
  };
}
