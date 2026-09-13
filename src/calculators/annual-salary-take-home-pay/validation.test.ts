import { describe, expect, it } from "vitest";
import {
  MAX_ANNUAL_SALARY,
  MAX_DEPENDENT_FAMILY_COUNT,
  validateAnnualSalaryTakeHomePayInput,
} from "./validation";

const validRaw = {
  annualSalary: "36,000,000",
  monthlyNonTaxablePay: "0",
  dependentFamilyCount: "1",
  childrenAge8to20Count: "0",
};

describe("validateAnnualSalaryTakeHomePayInput — 정상 케이스", () => {
  it("콤마 포함 금액 문자열을 정수로 정규화한다", () => {
    const result = validateAnnualSalaryTakeHomePayInput(validRaw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.annualSalary).toBe(36_000_000);
    }
  });

  it("monthlyNonTaxablePay/childrenAge8to20Count 생략 시 기본값 0을 채운다", () => {
    const result = validateAnnualSalaryTakeHomePayInput({
      annualSalary: "36000000",
      dependentFamilyCount: "1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.monthlyNonTaxablePay).toBe(0);
      expect(result.data.childrenAge8to20Count).toBe(0);
    }
  });
});

describe("validateAnnualSalaryTakeHomePayInput — annualSalary 예외", () => {
  it.each([
    ["", "빈 값"],
    ["0", "0"],
    ["-1", "음수"],
    ["36000000.5", "소수"],
    ["abc", "숫자 아님"],
  ])("%s(%s)는 오류를 반환한다", (value) => {
    const result = validateAnnualSalaryTakeHomePayInput({ ...validRaw, annualSalary: value });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "annualSalary")).toBe(true);
    }
  });

  it("100억 원을 초과하면 오류를 반환한다", () => {
    const result = validateAnnualSalaryTakeHomePayInput({
      ...validRaw,
      annualSalary: String(MAX_ANNUAL_SALARY + 1),
    });
    expect(result.success).toBe(false);
  });

  it("정확히 100억 원은 허용한다", () => {
    const result = validateAnnualSalaryTakeHomePayInput({
      ...validRaw,
      annualSalary: String(MAX_ANNUAL_SALARY),
    });
    expect(result.success).toBe(true);
  });
});

describe("validateAnnualSalaryTakeHomePayInput — monthlyNonTaxablePay 예외", () => {
  it("월 비과세 금액이 세전 월 급여(연봉÷12)보다 크면 오류를 반환한다", () => {
    const result = validateAnnualSalaryTakeHomePayInput({
      annualSalary: "36000000", // 월 3,000,000원
      monthlyNonTaxablePay: "3000001",
      dependentFamilyCount: "1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "monthlyNonTaxablePay")).toBe(true);
    }
  });

  it("월 비과세 금액이 세전 월 급여와 정확히 같으면 허용한다(taxableMonthlyPay=0)", () => {
    const result = validateAnnualSalaryTakeHomePayInput({
      annualSalary: "36000000",
      monthlyNonTaxablePay: "3000000",
      dependentFamilyCount: "1",
    });
    expect(result.success).toBe(true);
  });

  it("음수·소수 비과세 금액은 오류를 반환한다", () => {
    expect(
      validateAnnualSalaryTakeHomePayInput({ ...validRaw, monthlyNonTaxablePay: "-1" }).success,
    ).toBe(false);
    expect(
      validateAnnualSalaryTakeHomePayInput({ ...validRaw, monthlyNonTaxablePay: "1.5" }).success,
    ).toBe(false);
  });
});

describe("validateAnnualSalaryTakeHomePayInput — dependentFamilyCount 예외", () => {
  it.each([
    ["", "빈 값"],
    ["0", "0"],
    ["-1", "음수"],
    ["1.5", "소수"],
  ])("%s(%s)는 오류를 반환한다", (value) => {
    const result = validateAnnualSalaryTakeHomePayInput({ ...validRaw, dependentFamilyCount: value });
    expect(result.success).toBe(false);
  });

  it(`${MAX_DEPENDENT_FAMILY_COUNT}명을 초과하면 오류를 반환한다`, () => {
    const result = validateAnnualSalaryTakeHomePayInput({
      ...validRaw,
      dependentFamilyCount: String(MAX_DEPENDENT_FAMILY_COUNT + 1),
    });
    expect(result.success).toBe(false);
  });

  it(`정확히 ${MAX_DEPENDENT_FAMILY_COUNT}명은 허용한다`, () => {
    const result = validateAnnualSalaryTakeHomePayInput({
      ...validRaw,
      dependentFamilyCount: String(MAX_DEPENDENT_FAMILY_COUNT),
      childrenAge8to20Count: "0",
    });
    expect(result.success).toBe(true);
  });
});

describe("validateAnnualSalaryTakeHomePayInput — childrenAge8to20Count 예외", () => {
  it("자녀 수가 (부양가족 수 - 1)을 초과하면 오류를 반환한다", () => {
    const result = validateAnnualSalaryTakeHomePayInput({
      ...validRaw,
      dependentFamilyCount: "2",
      childrenAge8to20Count: "2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "childrenAge8to20Count")).toBe(true);
    }
  });

  it("자녀 수가 정확히 (부양가족 수 - 1)이면 허용한다", () => {
    const result = validateAnnualSalaryTakeHomePayInput({
      ...validRaw,
      dependentFamilyCount: "2",
      childrenAge8to20Count: "1",
    });
    expect(result.success).toBe(true);
  });

  it("음수 자녀 수는 오류를 반환한다", () => {
    const result = validateAnnualSalaryTakeHomePayInput({ ...validRaw, childrenAge8to20Count: "-1" });
    expect(result.success).toBe(false);
  });
});
