import { describe, expect, it } from "vitest";
import { calculateEmployeeSocialInsuranceContributions, truncateTo10Won } from "./social-insurance";

describe("calculateEmployeeSocialInsuranceContributions", () => {
  it(
    // tasks/annual-salary-take-home-pay/FORMULA.md 예제 1 == tasks/four-major-insurance/FORMULA.md
    // 예제 1과 동일 값이므로 두 계산기의 4대 보험 근로자 부담분 계산이 교차 검증된다.
    "월급여 3,000,000원 → 국민연금 142,500 / 건강보험 107,850 / 장기요양 14,170 / 고용보험 27,000, 합계 291,520원",
    () => {
      const r = calculateEmployeeSocialInsuranceContributions({
        monthlyGrossPay: 3_000_000,
        monthlyNonTaxablePay: 0,
      });
      expect(r.employeePension).toBe(142_500);
      expect(r.employeeHealth).toBe(107_850);
      expect(r.employeeLongTermCare).toBe(14_170);
      expect(r.employeeEmployment).toBe(27_000);
      expect(r.employeeInsuranceTotal).toBe(291_520);
    },
  );

  it("truncateTo10Won은 10원 미만을 절사한다", () => {
    expect(truncateTo10Won(19_476)).toBe(19_470);
    expect(truncateTo10Won(19_470)).toBe(19_470);
  });
});
