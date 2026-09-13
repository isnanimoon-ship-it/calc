import { describe, expect, it } from "vitest";
import { calculateFourMajorInsurance } from "./logic";
import type { FourMajorInsuranceInput } from "./types";

const base: FourMajorInsuranceInput = {
  monthlyGrossPay: 3_000_000,
  monthlyNonTaxablePay: 0,
  nationalPensionEnabled: true,
  healthInsuranceEnabled: true,
  employmentInsuranceEnabled: true,
  employmentBusinessRateTier: "under150",
};

describe("calculateFourMajorInsurance", () => {
  it("월 300만원 기본 예제를 계산한다", () => {
    const r = calculateFourMajorInsurance(base);
    expect(r.nationalPension.employee).toBe(142_500);
    expect(r.healthInsurance.employee).toBe(107_850);
    expect(r.longTermCareInsurance.employee).toBe(14_170);
    expect(r.employmentInsurance.employee).toBe(27_000);
    expect(r.employeeInsuranceTotal).toBe(291_520);
    expect(r.afterEmployeeInsurance).toBe(2_708_480);
    expect(r.employerInsuranceTotalExcludingWorkersComp).toBe(299_020);
  });

  it("국민연금 하한과 10원 미만 절사를 적용한다", () => {
    const r = calculateFourMajorInsurance({ ...base, monthlyGrossPay: 400_000 });
    expect(r.pensionStandardMonthlyIncome).toBe(410_000);
    expect(r.nationalPension.employee).toBe(19_470);
    expect(r.pensionMinimumApplied).toBe(true);
  });

  it("국민연금 상한을 적용하되 다른 보험에는 공유하지 않는다", () => {
    const r = calculateFourMajorInsurance({ ...base, monthlyGrossPay: 6_600_000 });
    expect(r.pensionStandardMonthlyIncome).toBe(6_590_000);
    expect(r.nationalPension.employee).toBe(313_020);
    expect(r.healthInsurance.employee).toBe(237_270);
    expect(r.pensionMaximumApplied).toBe(true);
  });

  it("국민연금 기준소득월액의 천원 미만을 절사한다", () => {
    const r = calculateFourMajorInsurance({ ...base, monthlyGrossPay: 3_000_999 });
    expect(r.pensionStandardMonthlyIncome).toBe(3_000_000);
    expect(r.nationalPension.employee).toBe(142_500);
  });

  it("비과세 금액은 산정 보수에서만 제외한다", () => {
    const r = calculateFourMajorInsurance({ ...base, monthlyGrossPay: 3_200_000, monthlyNonTaxablePay: 200_000 });
    expect(r.estimatedMonthlyRemuneration).toBe(3_000_000);
    expect(r.employeeInsuranceTotal).toBe(291_520);
    expect(r.afterEmployeeInsurance).toBe(2_908_480);
  });

  it("건강보험을 끄면 장기요양보험도 제외한다", () => {
    const r = calculateFourMajorInsurance({ ...base, healthInsuranceEnabled: false });
    expect(r.healthInsurance.employee).toBe(0);
    expect(r.longTermCareInsurance.exclusionReason).toBe("linkedToHealth");
  });

  it("사업장 규모는 사업주 고용보험만 바꾼다", () => {
    const small = calculateFourMajorInsurance(base);
    const large = calculateFourMajorInsurance({ ...base, employmentBusinessRateTier: "over1000OrGovernment" });
    expect(small.employmentInsurance.employee).toBe(27_000);
    expect(small.employmentInsurance.employer).toBe(34_500);
    expect(large.employmentInsurance.employee).toBe(27_000);
    expect(large.employmentInsurance.employer).toBe(52_500);
  });

  it("산재보험은 계산하지 않는다", () => {
    expect(calculateFourMajorInsurance(base).workersCompensation.exclusionReason).toBe("industryRateRequired");
  });

  it("건강보험 총액 하한을 적용한 뒤 절반을 부담한다", () => {
    const r = calculateFourMajorInsurance({ ...base, monthlyGrossPay: 200_000 });
    expect(r.healthMinimumApplied).toBe(true);
    expect(r.healthInsurance.employee).toBe(10_080);
    expect(r.healthInsurance.employer).toBe(10_080);
  });

  it("월 200만원 공식 대조 예제를 계산한다", () => {
    const r = calculateFourMajorInsurance({ ...base, monthlyGrossPay: 2_000_000 });
    expect(r.nationalPension).toEqual({ employee: 95_000, employer: 95_000 });
    expect(r.employeeInsuranceTotal).toBe(194_340);
    expect(r.afterEmployeeInsurance).toBe(1_805_660);
  });

  it("국민연금 미가입 설정을 합계에 반영한다", () => {
    const r = calculateFourMajorInsurance({ ...base, nationalPensionEnabled: false });
    expect(r.nationalPension.exclusionReason).toBe("disabled");
    expect(r.employeeInsuranceTotal).toBe(149_020);
  });

  it("큰 급여에서 국민연금과 건강보험 상한을 안전하게 적용한다", () => {
    const r = calculateFourMajorInsurance({ ...base, monthlyGrossPay: 1_000_000_000 });
    expect(r.pensionMaximumApplied).toBe(true);
    expect(r.healthMaximumApplied).toBe(true);
    expect(r.healthInsurance.employee + r.healthInsurance.employer).toBe(9_183_480);
    expect(Number.isSafeInteger(r.combinedInsuranceTotalExcludingWorkersComp)).toBe(true);
  });
});
