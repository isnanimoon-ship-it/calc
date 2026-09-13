import rates2026 from "@/src/data/rates-2026.json";
import {
  calculateEmployeeSocialInsuranceContributions,
  truncateTo10Won,
} from "@/src/lib/social-insurance";
import type {
  EmploymentBusinessRateTier,
  FourMajorInsuranceInput,
  FourMajorInsuranceResult,
  InsuranceContribution,
} from "./types";

// tasks/annual-salary-take-home-pay/ARCHITECTURE.md "1." 결정: 근로자 부담분 산정 자체는
// src/lib/social-insurance.ts로 이동했다(재작성 금지, 리팩터링만). truncateTo10Won은 이
// 계산기 밖에서 import하는 곳이 없음을 확인했지만(grep 결과 이 파일/logic.test.ts만) 기존
// 공개 이름을 보존하기 위해 그대로 재노출한다.
export { truncateTo10Won } from "@/src/lib/social-insurance";

const rates = rates2026.socialInsurance;

type IntegerRate = { numerator: number; denominator: number };

function applyRate(amount: number, rate: IntegerRate): number {
  return truncateTo10Won((amount * rate.numerator) / rate.denominator);
}

function excluded(reason: "disabled" | "linkedToHealth" | "industryRateRequired"): InsuranceContribution {
  return { employee: 0, employer: 0, exclusionReason: reason };
}

export function calculateFourMajorInsurance(
  input: FourMajorInsuranceInput,
): FourMajorInsuranceResult {
  const core = calculateEmployeeSocialInsuranceContributions({
    monthlyGrossPay: input.monthlyGrossPay,
    monthlyNonTaxablePay: input.monthlyNonTaxablePay,
  });
  const remuneration = core.estimatedMonthlyRemuneration;

  const nationalPension = input.nationalPensionEnabled
    ? {
        employee: core.employeePension,
        employer: applyRate(core.pensionStandardMonthlyIncome, rates.nationalPension.employerRate),
      }
    : excluded("disabled");

  const healthTotal = core.healthTotalClamped;
  const healthEmployee = core.employeeHealth;
  const healthInsurance = input.healthInsuranceEnabled
    ? { employee: healthEmployee, employer: healthTotal - healthEmployee }
    : excluded("disabled");
  const longTermCareInsurance = input.healthInsuranceEnabled
    ? {
        employee: core.employeeLongTermCare,
        employer: truncateTo10Won(
          (healthInsurance.employer * rates.healthInsurance.longTermCareRate.numerator *
            rates.healthInsurance.totalRate.denominator) /
            (rates.healthInsurance.longTermCareRate.denominator *
              rates.healthInsurance.totalRate.numerator),
        ),
      }
    : excluded("linkedToHealth");

  const extraRate = rates.employmentInsurance.employerExtraRates[
    input.employmentBusinessRateTier
  ] as IntegerRate;
  const employmentInsurance = input.employmentInsuranceEnabled
    ? {
        employee: core.employeeEmployment,
        employer:
          applyRate(remuneration, rates.employmentInsurance.employerUnemploymentRate) +
          applyRate(remuneration, extraRate),
      }
    : excluded("disabled");
  const workersCompensation = excluded("industryRateRequired");

  const contributions = [
    nationalPension,
    healthInsurance,
    longTermCareInsurance,
    employmentInsurance,
  ];
  const employeeInsuranceTotal = contributions.reduce((sum, item) => sum + item.employee, 0);
  const employerInsuranceTotalExcludingWorkersComp = contributions.reduce(
    (sum, item) => sum + item.employer,
    0,
  );

  return {
    estimatedMonthlyRemuneration: remuneration,
    pensionStandardMonthlyIncome: core.pensionStandardMonthlyIncome,
    nationalPension,
    healthInsurance,
    longTermCareInsurance,
    employmentInsurance,
    workersCompensation,
    employeeInsuranceTotal,
    employerInsuranceTotalExcludingWorkersComp,
    combinedInsuranceTotalExcludingWorkersComp:
      employeeInsuranceTotal + employerInsuranceTotalExcludingWorkersComp,
    afterEmployeeInsurance: input.monthlyGrossPay - employeeInsuranceTotal,
    pensionMinimumApplied: core.pensionMinimumApplied,
    pensionMaximumApplied: core.pensionMaximumApplied,
    healthMinimumApplied: core.healthMinimumApplied,
    healthMaximumApplied: core.healthMaximumApplied,
    appliedRateYear: 2026,
    appliedRatePeriod: "2026-07-01/2027-06-30",
    employmentBusinessRateTier: input.employmentBusinessRateTier,
  };
}

export const employmentTierLabels: Record<EmploymentBusinessRateTier, string> = {
  under150: "150인 미만 기업",
  priorityOver150: "150인 이상 우선지원대상기업",
  between150And999: "150인 이상 1,000인 미만 기업",
  over1000OrGovernment: "1,000인 이상 기업·국가·지자체",
};
