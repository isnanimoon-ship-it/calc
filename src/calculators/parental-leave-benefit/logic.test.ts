import { describe, expect, it } from "vitest";
import { calculateParentalLeaveBenefit } from "./logic";
import type { ParentalLeaveBenefitInput } from "./types";

const base: ParentalLeaveBenefitInput = { startDate: "2026-09-04", leaveMonths: 12, ordinaryWageWon: 3_000_000, scheme: "general", priorLeaveMonths: 0 };

describe("육아휴직급여 계산", () => {
  it("일반 12개월의 구간별 상한과 총액", () => {
    const result = calculateParentalLeaveBenefit(base);
    expect(result.months.map((m) => m.benefitWon)).toEqual([2_500_000,2_500_000,2_500_000,2_000_000,2_000_000,2_000_000,1_600_000,1_600_000,1_600_000,1_600_000,1_600_000,1_600_000]);
    expect(result.totalBenefitWon).toBe(23_100_000);
    expect(result.endDate).toBe("2027-09-03");
  });
  it("통상임금 200만원은 첫 3개월에 그대로 지급", () => expect(calculateParentalLeaveBenefit({ ...base, leaveMonths: 3, ordinaryWageWon: 2_000_000 }).totalBenefitWon).toBe(6_000_000));
  it("일반 하한 70만원 적용", () => expect(calculateParentalLeaveBenefit({ ...base, leaveMonths: 7, ordinaryWageWon: 500_000 }).months[6].benefitWon).toBe(700_000));
  it("7개월 이후 통상임금 80%", () => expect(calculateParentalLeaveBenefit({ ...base, leaveMonths: 7, ordinaryWageWon: 1_000_000 }).months[6].benefitWon).toBe(800_000));
  it("부모 함께 6개월 월별 상한", () => {
    const result = calculateParentalLeaveBenefit({ ...base, leaveMonths: 6, ordinaryWageWon: 5_000_000, scheme: "parents-together", childBirthDate: "2026-01-01", spouseStartDate: "2026-03-01", spouseLeaveMonths: 6, spouseLeaveStatus: "used" });
    expect(result.months.map((m) => m.benefitWon)).toEqual([2_500_000,2_500_000,3_000_000,3_500_000,4_000_000,4_500_000]);
    expect(result.totalBenefitWon).toBe(20_000_000);
  });
  it("배우자 3개월이면 특례도 3개월", () => {
    const result = calculateParentalLeaveBenefit({ ...base, leaveMonths: 6, scheme: "parents-together", childBirthDate: "2026-01-01", spouseStartDate: "2026-02-01", spouseLeaveMonths: 3, spouseLeaveStatus: "used" });
    expect(result.specialMonths).toBe(3);
    expect(result.months[3].policyId).toBe("general-4-6");
  });
  it("생후 18개월을 지나 개시하면 일반 기준", () => {
    const result = calculateParentalLeaveBenefit({ ...base, leaveMonths: 1, scheme: "parents-together", childBirthDate: "2025-01-01", spouseStartDate: "2025-02-01", spouseLeaveMonths: 6, spouseLeaveStatus: "used" });
    expect(result.specialMonths).toBe(0);
    expect(result.months[0].policyId).toBe("general-1-3");
  });
  it("한부모 첫 3개월 상한 300만원", () => expect(calculateParentalLeaveBenefit({ ...base, leaveMonths: 3, ordinaryWageWon: 5_000_000, scheme: "single-parent" }).totalBenefitWon).toBe(9_000_000));
  it("선행 6개월 다음은 7개월 일반 기준", () => expect(calculateParentalLeaveBenefit({ ...base, leaveMonths: 1, priorLeaveMonths: 6 }).months[0].benefitWon).toBe(1_600_000));
  it("18개월 연장구간도 7개월 이후 기준", () => expect(calculateParentalLeaveBenefit({ ...base, leaveMonths: 6, priorLeaveMonths: 12, extensionEligibility: "both-parents" }).totalBenefitWon).toBe(9_600_000));
  it("월말 시작일을 보정", () => expect(calculateParentalLeaveBenefit({ ...base, startDate: "2028-02-29", leaveMonths: 1 }).endDate).toBe("2028-03-28"));
});
