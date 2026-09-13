export type BenefitScheme = "general" | "parents-together" | "single-parent";
export type SpouseLeaveStatus = "used" | "planned";
export type ExtensionEligibility = "both-parents" | "single-parent" | "disabled-child";
export type BenefitPolicyId = "general-1-3" | "general-4-6" | "general-7-plus" | "parents-together" | "single-parent-1-3";

export interface ParentalLeaveBenefitInput {
  startDate: string;
  leaveMonths: number;
  ordinaryWageWon: number;
  scheme: BenefitScheme;
  priorLeaveMonths: number;
  childBirthDate?: string;
  spouseStartDate?: string;
  spouseLeaveMonths?: number;
  spouseLeaveStatus?: SpouseLeaveStatus;
  extensionEligibility?: ExtensionEligibility;
}

export interface BenefitMonth {
  benefitMonth: number;
  currentLeaveMonth: number;
  startDate: string;
  endDate: string;
  policyId: BenefitPolicyId;
  policyLabel: string;
  ratePercent: number;
  capWon: number;
  floorWon: number;
  baseWon: number;
  benefitWon: number;
  isConditional: boolean;
}

export interface ParentalLeaveBenefitResult {
  startDate: string;
  endDate: string;
  leaveMonths: number;
  priorLeaveMonths: number;
  totalAccumulatedMonths: number;
  ordinaryWageWon: number;
  scheme: BenefitScheme;
  specialMonths: number;
  months: BenefitMonth[];
  totalBenefitWon: number;
  averageBenefitWon: number;
  generalSubtotalWon: number;
  specialSubtotalWon: number;
  conditional: boolean;
  notices: string[];
}
