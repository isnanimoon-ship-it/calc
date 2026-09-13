import { describe, expect, it } from "vitest";
import { calculateAnnualSalaryTakeHomePay } from "./logic";
import type { AnnualSalaryTakeHomePayInput } from "./types";

function input(overrides: Partial<AnnualSalaryTakeHomePayInput> = {}): AnnualSalaryTakeHomePayInput {
  return {
    annualSalary: 36_000_000,
    monthlyNonTaxablePay: 0,
    dependentFamilyCount: 1,
    childrenAge8to20Count: 0,
    ...overrides,
  };
}

describe("calculateAnnualSalaryTakeHomePay — FORMULA.md 검증 예제(Golden Test)", () => {
  it("예제 1 — 연봉 3,600만원, 가족 1명, 자녀 0명", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 36_000_000 }));
    expect(r.monthlyGrossPay).toBe(3_000_000);
    expect(r.employeeInsuranceTotal).toBe(291_520);
    expect(r.incomeTax).toBe(74_350);
    expect(r.localIncomeTax).toBe(7_435);
    expect(r.netMonthlyPay).toBe(2_626_695);
  });

  it("예제 2 — 연봉 4,800만원, 가족 1명, 자녀 0명", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 48_000_000 }));
    expect(r.monthlyGrossPay).toBe(4_000_000);
    expect(r.employeeInsuranceTotal).toBe(388_690);
    expect(r.incomeTax).toBe(195_960);
    expect(r.localIncomeTax).toBe(19_596);
    expect(r.netMonthlyPay).toBe(3_395_754);
  });

  it("예제 3 — 연봉 6,000만원, 가족 1명, 자녀 0명", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 60_000_000 }));
    expect(r.monthlyGrossPay).toBe(5_000_000);
    expect(r.employeeInsuranceTotal).toBe(485_870);
    expect(r.incomeTax).toBe(335_470);
    expect(r.localIncomeTax).toBe(33_547);
    expect(r.netMonthlyPay).toBe(4_145_113);
  });

  it("예제 4 — 연봉 2,400만원, 가족 1명, 자녀 0명 (four-major-insurance 교차 검증)", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 24_000_000 }));
    expect(r.monthlyGrossPay).toBe(2_000_000);
    expect(r.employeeInsuranceTotal).toBe(194_340);
    expect(r.incomeTax).toBe(19_520);
    expect(r.localIncomeTax).toBe(1_952);
    expect(r.netMonthlyPay).toBe(1_784_188);
  });

  it("예제 5 — 연봉 1,260만원, 가족 1명 (간이세액표 0원 구간)", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 12_600_000 }));
    expect(r.monthlyGrossPay).toBe(1_050_000);
    expect(r.employeeInsuranceTotal).toBe(102_010);
    expect(r.incomeTax).toBe(0);
    expect(r.localIncomeTax).toBe(0);
    expect(r.isBelowTaxableThreshold).toBe(true);
    expect(r.netMonthlyPay).toBe(947_990);
  });

  it("예제 6 — 연봉 1,272만원, 가족 1명 (0원→과세 전환 경계값)", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 12_720_000 }));
    expect(r.monthlyGrossPay).toBe(1_060_000);
    expect(r.employeeInsuranceTotal).toBe(102_990);
    expect(r.incomeTax).toBe(1_040);
    expect(r.localIncomeTax).toBe(104);
    expect(r.isBelowTaxableThreshold).toBe(false);
    expect(r.netMonthlyPay).toBe(955_866);
  });

  it("예제 7 — 연봉 3,600만원, 가족 2명, 자녀 0명 (가족 수 열 변경 검증)", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 36_000_000, dependentFamilyCount: 2 }));
    expect(r.employeeInsuranceTotal).toBe(291_520);
    expect(r.incomeTax).toBe(56_850);
    expect(r.localIncomeTax).toBe(5_685);
    expect(r.netMonthlyPay).toBe(2_645_945);
  });

  it("예제 8 — 연봉 3,600만원, 가족 3명, 자녀 1명(8~20세) (자녀세액공제 정상 차감)", () => {
    const r = calculateAnnualSalaryTakeHomePay(
      input({ annualSalary: 36_000_000, dependentFamilyCount: 3, childrenAge8to20Count: 1 }),
    );
    expect(r.incomeTaxBeforeChildCredit).toBe(31_940);
    expect(r.childTaxCreditAmount).toBe(20_830);
    expect(r.incomeTax).toBe(11_110);
    expect(r.localIncomeTax).toBe(1_111);
    expect(r.childTaxCreditFloorApplied).toBe(false);
    expect(r.netMonthlyPay).toBe(2_696_259);
  });

  it("예제 9 — 연봉 3,600만원, 가족 4명, 자녀 2명(8~20세) (자녀세액공제로 0원 floor)", () => {
    const r = calculateAnnualSalaryTakeHomePay(
      input({ annualSalary: 36_000_000, dependentFamilyCount: 4, childrenAge8to20Count: 2 }),
    );
    expect(r.incomeTaxBeforeChildCredit).toBe(26_690);
    expect(r.childTaxCreditAmount).toBe(45_830);
    expect(r.incomeTax).toBe(0);
    expect(r.localIncomeTax).toBe(0);
    expect(r.childTaxCreditFloorApplied).toBe(true);
    expect(r.netMonthlyPay).toBe(2_708_480);
  });

  it("예제 10 — 연봉 1억 4,400만원, 가족 1명 (1천만원 초과 산식 검증)", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 144_000_000 }));
    expect(r.monthlyGrossPay).toBe(12_000_000);
    expect(r.pensionMaximumApplied).toBe(true);
    expect(r.employeePension).toBe(313_020);
    expect(r.employeeHealth).toBe(431_400);
    expect(r.employeeLongTermCare).toBe(56_680);
    expect(r.employeeEmployment).toBe(108_000);
    expect(r.employeeInsuranceTotal).toBe(909_100);
    expect(r.incomeTaxSource).toBe("highIncomeFormula");
    expect(r.bracketMode).toBe("formula");
    expect(r.incomeTax).toBe(2_218_400);
    expect(r.localIncomeTax).toBe(221_840);
    expect(r.netMonthlyPay).toBe(8_650_660);
  });

  it("예제 11 — 연봉 4,800만원, 가족 12명 (11명 초과 산식 검증)", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 48_000_000, dependentFamilyCount: 12 }));
    expect(r.employeeInsuranceTotal).toBe(388_690);
    expect(r.familyCountSource).toBe("over11Formula");
    expect(r.incomeTax).toBe(17_820);
    expect(r.localIncomeTax).toBe(1_782);
    expect(r.netMonthlyPay).toBe(3_591_708);
  });

  // 예제 12 — 1천만원 초과 산식의 원 단위 절사 확인 필요 사례(미확정, 플래그용).
  // FORMULA.md "3-4"·"정밀도/반올림 정책"이 이미 "확인 필요"로 남긴 잠정값이다 — 국세청
  // 홈택스 원천징수세액 자동계산 결과와 실측 대조 전까지는 이 값이 최종 확정값이 아니다.
  // 확인 필요 — Calculation Auditor 실측 대조 후 값이 바뀔 수 있음.
  it("예제 12 — 월급여 10,003,000원, 가족 1명 (1천만원 초과 산식 절사 단위 미확정, 잠정값)", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 120_036_000 }));
    expect(r.monthlyGrossPay).toBe(10_003_000);
    expect(r.incomeTaxSource).toBe("highIncomeFormula");
    expect(r.incomeTax).toBe(1_533_429);
    expect(r.localIncomeTax).toBe(153_342);
  });

  // 예제 13 — taxableMonthlyPay가 정확히 10,000,000원인 경계값(Calculation Auditor 이슈 A
  // 재발 방지 Golden Test). 근로소득세는 3-4의 가족 1명 고정값(1,507,400원)을 초과분 계산
  // 없이 그대로 사용해야 하며, 3-4 산식의 가산액(25,000원)이 잘못 더해지면 1,532,400원이
  // 되는 회귀를 이 테스트가 잡아낸다.
  it("예제 13 — 연봉 1억 2천만원, 가족 1명 (taxableMonthlyPay 정확히 10,000,000원 경계값)", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 120_000_000 }));
    expect(r.monthlyGrossPay).toBe(10_000_000);
    expect(r.taxableMonthlyPay).toBe(10_000_000);
    expect(r.pensionMaximumApplied).toBe(true);
    expect(r.employeePension).toBe(313_020);
    expect(r.employeeHealth).toBe(359_500);
    expect(r.employeeLongTermCare).toBe(47_240);
    expect(r.employeeEmployment).toBe(90_000);
    expect(r.employeeInsuranceTotal).toBe(809_760);
    expect(r.incomeTaxSource).toBe("highIncomeFormula");
    expect(r.bracketMode).toBe("ceilingFixed"); // UX/UI Critic Medium 3 — "formula"가 아님
    expect(r.incomeTax).toBe(1_507_400); // 1,532,400원(가산액 25,000원 오적용)이 아님
    expect(r.localIncomeTax).toBe(150_740);
    expect(r.netMonthlyPay).toBe(7_532_100);
  });
});

describe("calculateAnnualSalaryTakeHomePay — 경계값/예외 동작", () => {
  it("비과세 금액이 월 급여 전액과 같으면 산정 기준 보수가 0원이 되고 소득세도 0원이다", () => {
    const r = calculateAnnualSalaryTakeHomePay(
      input({ annualSalary: 36_000_000, monthlyNonTaxablePay: 3_000_000 }),
    );
    expect(r.taxableMonthlyPay).toBe(0);
    expect(r.incomeTax).toBe(0);
    expect(r.isBelowTaxableThreshold).toBe(true);
  });

  it("국민연금 하한 미만이면 하한이 적용된다", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 4_800_000 }));
    expect(r.pensionStandardMonthlyIncome).toBe(410_000);
    expect(r.pensionMinimumApplied).toBe(true);
  });

  it("annualSalary가 12로 나누어떨어지지 않으면 월 급여를 절사한다", () => {
    const r = calculateAnnualSalaryTakeHomePay(input({ annualSalary: 36_000_001 }));
    expect(r.monthlyGrossPay).toBe(3_000_000);
  });
});
