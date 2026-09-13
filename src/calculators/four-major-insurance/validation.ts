import type { EmploymentBusinessRateTier, FourMajorInsuranceInput } from "./types";

export const MAX_MONTHLY_PAY = 1_000_000_000;
const TIERS: EmploymentBusinessRateTier[] = [
  "under150", "priorityOver150", "between150And999", "over1000OrGovernment",
];

export interface RawFourMajorInsuranceInput {
  monthlyGrossPay?: string | number;
  monthlyNonTaxablePay?: string | number;
  nationalPensionEnabled?: boolean;
  healthInsuranceEnabled?: boolean;
  employmentInsuranceEnabled?: boolean;
  employmentBusinessRateTier?: string;
}

export interface InsuranceValidationError {
  field: keyof RawFourMajorInsuranceInput;
  message: string;
}

export type InsuranceValidationResult =
  | { success: true; data: FourMajorInsuranceInput }
  | { success: false; errors: InsuranceValidationError[] };

function parseAmount(raw: string | number | undefined): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  if (raw == null || raw.trim() === "") return undefined;
  const normalized = raw.replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return NaN;
  return Number(normalized);
}

export function validateFourMajorInsuranceInput(
  raw: RawFourMajorInsuranceInput,
): InsuranceValidationResult {
  const errors: InsuranceValidationError[] = [];
  const gross = parseAmount(raw.monthlyGrossPay);
  const nonTaxable = parseAmount(raw.monthlyNonTaxablePay) ?? 0;

  if (gross === undefined) errors.push({ field: "monthlyGrossPay", message: "세전 월 급여를 입력해 주세요." });
  else if (!Number.isInteger(gross) || gross <= 0 || gross > MAX_MONTHLY_PAY)
    errors.push({ field: "monthlyGrossPay", message: "세전 월 급여는 1원 이상 10억 원 이하의 정수여야 합니다." });
  if (!Number.isInteger(nonTaxable) || nonTaxable < 0)
    errors.push({ field: "monthlyNonTaxablePay", message: "비과세 금액은 0 이상의 정수여야 합니다." });
  if (gross != null && Number.isFinite(gross) && nonTaxable > gross)
    errors.push({ field: "monthlyNonTaxablePay", message: "비과세 금액은 월 급여보다 클 수 없습니다." });

  const tier = raw.employmentBusinessRateTier ?? "under150";
  if (!TIERS.includes(tier as EmploymentBusinessRateTier))
    errors.push({ field: "employmentBusinessRateTier", message: "사업장 규모를 다시 선택해 주세요." });
  if (![raw.nationalPensionEnabled, raw.healthInsuranceEnabled, raw.employmentInsuranceEnabled].some(Boolean))
    errors.push({ field: "nationalPensionEnabled", message: "계산할 보험을 하나 이상 선택해 주세요." });

  if (errors.length) return { success: false, errors };
  const remuneration = (gross as number) - nonTaxable;
  if (remuneration <= 0)
    return { success: false, errors: [{ field: "monthlyNonTaxablePay", message: "보험료 산정 대상 보수가 0원보다 커야 합니다." }] };

  return {
    success: true,
    data: {
      monthlyGrossPay: gross as number,
      monthlyNonTaxablePay: nonTaxable,
      nationalPensionEnabled: raw.nationalPensionEnabled === true,
      healthInsuranceEnabled: raw.healthInsuranceEnabled === true,
      employmentInsuranceEnabled: raw.employmentInsuranceEnabled === true,
      employmentBusinessRateTier: tier as EmploymentBusinessRateTier,
    },
  };
}
