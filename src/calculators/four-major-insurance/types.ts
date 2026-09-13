/** 4대 보험 계산기 타입 — tasks/four-major-insurance/FORMULA.md 기준. */

export type Won = number;

export type EmploymentBusinessRateTier =
  | "under150"
  | "priorityOver150"
  | "between150And999"
  | "over1000OrGovernment";

export interface FourMajorInsuranceInput {
  monthlyGrossPay: Won;
  monthlyNonTaxablePay: Won;
  nationalPensionEnabled: boolean;
  healthInsuranceEnabled: boolean;
  employmentInsuranceEnabled: boolean;
  employmentBusinessRateTier: EmploymentBusinessRateTier;
}

export type InsuranceExclusionReason =
  | "disabled"
  | "linkedToHealth"
  | "industryRateRequired";

export interface InsuranceContribution {
  employee: Won;
  employer: Won;
  /** 계산에서 제외된 경우에만 존재한다. */
  exclusionReason?: InsuranceExclusionReason;
}

export interface FourMajorInsuranceResult {
  estimatedMonthlyRemuneration: Won;
  pensionStandardMonthlyIncome: Won;
  nationalPension: InsuranceContribution;
  healthInsurance: InsuranceContribution;
  longTermCareInsurance: InsuranceContribution;
  employmentInsurance: InsuranceContribution;
  workersCompensation: InsuranceContribution;
  employeeInsuranceTotal: Won;
  employerInsuranceTotalExcludingWorkersComp: Won;
  combinedInsuranceTotalExcludingWorkersComp: Won;
  afterEmployeeInsurance: Won;
  pensionMinimumApplied: boolean;
  pensionMaximumApplied: boolean;
  healthMinimumApplied: boolean;
  healthMaximumApplied: boolean;
  appliedRateYear: 2026;
  appliedRatePeriod: "2026-07-01/2027-06-30";
  employmentBusinessRateTier: EmploymentBusinessRateTier;
}

