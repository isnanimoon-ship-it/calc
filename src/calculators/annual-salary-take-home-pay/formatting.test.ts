import { describe, expect, it } from "vitest";
import {
  buildAllPolicyWarnings,
  buildAnnualSalaryCalculationSteps,
  buildBelowTaxableThresholdWarning,
  buildChildTaxCreditFloorWarning,
  buildHealthLimitWarning,
  buildHighIncomeFormulaWarning,
  buildNegativeNetPayWarning,
  buildOverElevenFamilyWarning,
  buildPensionLimitWarning,
  formatWon,
} from "./formatting";
import { calculateAnnualSalaryTakeHomePay } from "./logic";
import type { AnnualSalaryTakeHomePayInput } from "./types";

function calc(overrides: Partial<AnnualSalaryTakeHomePayInput> = {}) {
  const input: AnnualSalaryTakeHomePayInput = {
    annualSalary: 36_000_000,
    monthlyNonTaxablePay: 0,
    dependentFamilyCount: 1,
    childrenAge8to20Count: 0,
    ...overrides,
  };
  return { input, result: calculateAnnualSalaryTakeHomePay(input) };
}

describe("formatWon", () => {
  it("천 단위 콤마와 '원'을 붙인다", () => {
    expect(formatWon(2_626_695)).toBe("2,626,695원");
    expect(formatWon(0)).toBe("0원");
  });
});

describe("buildAnnualSalaryCalculationSteps", () => {
  it("FORMULA.md 예제 1의 9단계를 실제 대입값과 함께 만든다", () => {
    const { input, result } = calc();
    const steps = buildAnnualSalaryCalculationSteps(input, result);
    expect(steps).toHaveLength(9);
    expect(steps[0].expression).toContain("36,000,000원 ÷ 12 = 3,000,000원");
    expect(steps[8].expression).toContain("2,626,695원");
  });

  it("정확히 세액표 상한(1,000만원) 경계값이면 근로소득세 단계 legalBasis가 '초과'가 아니라 고정 세액 문구다(UX/UI Critic 재검증 라운드 1 Medium)", () => {
    // taxableMonthlyPay = floor(120,000,000/12) = 10,000,000원(정확히 상한, bracketMode="ceilingFixed")
    const { input, result } = calc({ annualSalary: 120_000_000 });
    expect(result.bracketMode).toBe("ceilingFixed");
    const steps = buildAnnualSalaryCalculationSteps(input, result);
    const incomeTaxStep = steps[5];
    expect(incomeTaxStep.label).toBe("6. 근로소득세(간이세액표)");
    expect(incomeTaxStep.legalBasis).not.toContain("초과");
    expect(incomeTaxStep.legalBasis).toContain("정확히 일치");
    expect(incomeTaxStep.legalBasis).toContain("고정 세액");
  });

  it("세액표 상한을 실제로 초과하면 근로소득세 단계 legalBasis가 '상한 초과 구간 산식' 문구다", () => {
    // taxableMonthlyPay = floor(144,000,000/12) = 12,000,000원(상한 초과, bracketMode="formula")
    const { input, result } = calc({ annualSalary: 144_000_000 });
    expect(result.bracketMode).toBe("formula");
    const steps = buildAnnualSalaryCalculationSteps(input, result);
    const incomeTaxStep = steps[5];
    expect(incomeTaxStep.label).toBe("6. 근로소득세(간이세액표)");
    expect(incomeTaxStep.legalBasis).toContain("상한 초과 구간 산식");
    expect(incomeTaxStep.legalBasis).not.toContain("정확히 일치");
  });

  it("경계값과 초과 케이스의 legalBasis 문구는 서로 달라야 한다(같은 화면 내 모순 방지)", () => {
    const ceiling = calc({ annualSalary: 120_000_000 });
    const exceeding = calc({ annualSalary: 144_000_000 });
    const ceilingLegalBasis = buildAnnualSalaryCalculationSteps(ceiling.input, ceiling.result)[5]
      .legalBasis;
    const exceedingLegalBasis = buildAnnualSalaryCalculationSteps(
      exceeding.input,
      exceeding.result,
    )[5].legalBasis;
    expect(ceilingLegalBasis).not.toBe(exceedingLegalBasis);
  });
});

describe("경고 문구 빌더 — 해당 조건에서만 문구를 반환한다", () => {
  it("국민연금 하한 적용 시에만 경고가 나온다", () => {
    const { result } = calc({ annualSalary: 4_800_000 });
    expect(buildPensionLimitWarning(result)).toContain("하한");
  });

  it("정상 범위에서는 모든 경고가 null이다", () => {
    const { result } = calc();
    expect(buildPensionLimitWarning(result)).toBeNull();
    expect(buildHealthLimitWarning(result)).toBeNull();
    expect(buildBelowTaxableThresholdWarning(result)).toBeNull();
    expect(buildHighIncomeFormulaWarning(result)).toBeNull();
    expect(buildOverElevenFamilyWarning(result)).toBeNull();
    expect(buildChildTaxCreditFloorWarning(result)).toBeNull();
    expect(buildNegativeNetPayWarning(result)).toBeNull();
    expect(buildAllPolicyWarnings(result)).toHaveLength(0);
  });

  it("간이세액표 최저구간 이하면 경고가 나온다", () => {
    const { result } = calc({ annualSalary: 12_600_000 });
    expect(buildBelowTaxableThresholdWarning(result)).not.toBeNull();
  });

  it("1천만원 초과 산식 적용 시 경고가 나온다", () => {
    const { result } = calc({ annualSalary: 144_000_000 });
    expect(result.bracketMode).toBe("formula");
    const warning = buildHighIncomeFormulaWarning(result);
    expect(warning).not.toBeNull();
    expect(warning).toContain("초과");
  });

  it("정확히 세액표 상한(1,000만원) 경계값이면 '초과' 문구 대신 고정 세액 문구가 나온다(UX/UI Critic Medium 3)", () => {
    // taxableMonthlyPay = floor(120,000,000/12) = 10,000,000원(정확히 상한)
    const { result } = calc({ annualSalary: 120_000_000 });
    expect(result.bracketMode).toBe("ceilingFixed");
    expect(result.incomeTax).toBe(1_507_400);
    const warning = buildHighIncomeFormulaWarning(result);
    expect(warning).not.toBeNull();
    expect(warning).not.toContain("초과");
    expect(warning).toContain("고정 세액");
  });

  it("11명 초과 산식 적용 시 경고가 나온다", () => {
    const { result } = calc({ annualSalary: 48_000_000, dependentFamilyCount: 12 });
    expect(buildOverElevenFamilyWarning(result)).not.toBeNull();
  });

  it("자녀세액공제로 0원 조정 시 경고가 나온다", () => {
    const { result } = calc({ dependentFamilyCount: 4, childrenAge8to20Count: 2 });
    expect(buildChildTaxCreditFloorWarning(result)).not.toBeNull();
  });
});

describe("buildNegativeNetPayWarning — QA 신규 발견(Medium) 회귀 테스트", () => {
  it("비현실적으로 낮은 연봉(검증은 통과하지만 4대 보험 하한이 급여를 초과) 입력 시 경고가 나온다", () => {
    // QA.md: annualSalary=100,000원(연) → netMonthlyPay=-22,607원(음수)
    const { result } = calc({ annualSalary: 100_000 });
    expect(result.netMonthlyPay).toBeLessThan(0);
    const warning = buildNegativeNetPayWarning(result);
    expect(warning).not.toBeNull();
    expect(warning).toContain("0원 미만");
  });

  it("정상 범위(netMonthlyPay가 0 이상)에서는 null이다", () => {
    const { result } = calc();
    expect(result.netMonthlyPay).toBeGreaterThanOrEqual(0);
    expect(buildNegativeNetPayWarning(result)).toBeNull();
  });
});
