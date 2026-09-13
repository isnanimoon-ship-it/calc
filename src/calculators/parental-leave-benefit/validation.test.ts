import { describe, expect, it } from "vitest";
import { validateParentalLeaveBenefitInput } from "./validation";

const valid = { startDate: "2026-09-04", leaveMonths: "12", ordinaryWageWon: "3,000,000", scheme: "general", priorLeaveMonths: "0" };
describe("육아휴직급여 입력 검증", () => {
  it("정상 입력을 변환", () => expect(validateParentalLeaveBenefitInput(valid)).toMatchObject({ success: true, data: { ordinaryWageWon: 3_000_000, leaveMonths: 12 } }));
  it("정책 시작일 이전 거부", () => expect(validateParentalLeaveBenefitInput({ ...valid, startDate: "2025-02-22" }).success).toBe(false));
  it("누적 18개월 초과 거부", () => expect(validateParentalLeaveBenefitInput({ ...valid, leaveMonths: 7, priorLeaveMonths: 12, extensionEligibility: "both-parents" }).success).toBe(false));
  it("12개월 초과는 연장 요건 필수", () => expect(validateParentalLeaveBenefitInput({ ...valid, leaveMonths: 13 }).success).toBe(false));
  it("부모 함께 조건부 입력 필수", () => expect(validateParentalLeaveBenefitInput({ ...valid, scheme: "parents-together" }).success).toBe(false));
});
