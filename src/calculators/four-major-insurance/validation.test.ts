import { describe, expect, it } from "vitest";
import { validateFourMajorInsuranceInput } from "./validation";

const valid = {
  monthlyGrossPay: "3,000,000",
  monthlyNonTaxablePay: "200,000",
  nationalPensionEnabled: true,
  healthInsuranceEnabled: true,
  employmentInsuranceEnabled: true,
  employmentBusinessRateTier: "under150",
};

describe("validateFourMajorInsuranceInput", () => {
  it("콤마 금액을 정규화한다", () => {
    const result = validateFourMajorInsuranceInput(valid);
    expect(result.success && result.data.monthlyGrossPay).toBe(3_000_000);
  });
  it("비과세 금액이 급여보다 크면 실패한다", () => {
    const result = validateFourMajorInsuranceInput({ ...valid, monthlyNonTaxablePay: "4,000,000" });
    expect(result.success).toBe(false);
  });
  it("보험을 모두 끄면 실패한다", () => {
    const result = validateFourMajorInsuranceInput({ ...valid, nationalPensionEnabled: false, healthInsuranceEnabled: false, employmentInsuranceEnabled: false });
    expect(result.success).toBe(false);
  });
  it.each(["", "0", "-1", "1.5", "1000000001", "abc"])("잘못된 월 급여 %s를 거부한다", (monthlyGrossPay) => {
    expect(validateFourMajorInsuranceInput({ ...valid, monthlyGrossPay }).success).toBe(false);
  });
  it("산정 보수가 0원이면 실패한다", () => {
    expect(validateFourMajorInsuranceInput({ ...valid, monthlyGrossPay: "200,000", monthlyNonTaxablePay: "200,000" }).success).toBe(false);
  });
});
