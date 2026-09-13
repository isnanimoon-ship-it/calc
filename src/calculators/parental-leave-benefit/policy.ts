import type { BenefitPolicyId } from "./types";

export const PARENTAL_LEAVE_POLICY_SUPPORTED_FROM = "2025-02-23";
export const PARENTAL_LEAVE_POLICY_REVIEWED_AT = "2026-09-04";
export const PARENTAL_LEAVE_POLICY_NEXT_REVIEW = "2027-01-01";
export const MONTHLY_FLOOR_WON = 700_000;
export const MAX_TOTAL_MONTHS = 18;

export interface BenefitPolicy {
  id: BenefitPolicyId;
  label: string;
  ratePercent: number;
  capWon: number;
  floorWon: number;
}

export const generalPolicies = {
  first: { id: "general-1-3", label: "일반 1~3개월", ratePercent: 100, capWon: 2_500_000, floorWon: MONTHLY_FLOOR_WON },
  middle: { id: "general-4-6", label: "일반 4~6개월", ratePercent: 100, capWon: 2_000_000, floorWon: MONTHLY_FLOOR_WON },
  later: { id: "general-7-plus", label: "일반 7개월 이후", ratePercent: 80, capWon: 1_600_000, floorWon: MONTHLY_FLOOR_WON },
} as const satisfies Record<string, BenefitPolicy>;

export const parentsTogetherCaps = [2_500_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000, 4_500_000] as const;

export const singleParentPolicy: BenefitPolicy = {
  id: "single-parent-1-3",
  label: "한부모 특례 1~3개월",
  ratePercent: 100,
  capWon: 3_000_000,
  floorWon: MONTHLY_FLOOR_WON,
};

export function getGeneralPolicy(benefitMonth: number): BenefitPolicy {
  if (benefitMonth <= 3) return generalPolicies.first;
  if (benefitMonth <= 6) return generalPolicies.middle;
  return generalPolicies.later;
}

export function getParentsTogetherPolicy(benefitMonth: number): BenefitPolicy {
  return {
    id: "parents-together",
    label: `부모 함께 특례 ${benefitMonth}개월`,
    ratePercent: 100,
    capWon: parentsTogetherCaps[benefitMonth - 1],
    floorWon: MONTHLY_FLOOR_WON,
  };
}
