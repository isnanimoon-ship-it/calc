/**
 * 예금·적금 이자 계산기 — 입력 검증 테스트.
 *
 * tasks/deposit-savings-interest-calculator/FORMULA.md "검증 예제 18(입력 오류 케이스)"를
 * 그대로 구현하고, "입력값" 표의 상·하한 경계값도 함께 검증한다.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_ANNUAL_RATE_PERCENT,
  MAX_MONTHLY_CONTRIBUTION,
  MAX_PRINCIPAL,
  MAX_TERM_MONTHS,
  MIN_ANNUAL_RATE_PERCENT,
  MIN_MONTHLY_CONTRIBUTION,
  MIN_PRINCIPAL,
  MIN_TERM_MONTHS,
  validateDepositSavingsInterestCalculatorInput,
  type RawDepositSavingsInterestCalculatorFormInput,
} from "./validation";

const BASE_DEPOSIT_FORM: RawDepositSavingsInterestCalculatorFormInput = {
  mode: "deposit",
  annualRatePercent: "3",
  termMonths: "12",
  principal: "10,000,000",
  interestType: "simple",
  monthlyContribution: "",
};

const BASE_SAVINGS_FORM: RawDepositSavingsInterestCalculatorFormInput = {
  mode: "savings",
  annualRatePercent: "3",
  termMonths: "12",
  principal: "",
  interestType: "",
  monthlyContribution: "500,000",
};

describe("예제 18 — 입력 오류 케이스(계산 자체를 수행하지 않아야 하는 경우)", () => {
  it("Input A — 예치금액 0 이하 불가", () => {
    const result = validateDepositSavingsInterestCalculatorInput({ ...BASE_DEPOSIT_FORM, principal: "0" });
    expect(result.success).toBe(false);
  });

  it("Input B — 연이율 음수 불가", () => {
    const result = validateDepositSavingsInterestCalculatorInput({ ...BASE_DEPOSIT_FORM, annualRatePercent: "-1" });
    expect(result.success).toBe(false);
  });

  it("Input C — 기간 0 이하 불가", () => {
    const result = validateDepositSavingsInterestCalculatorInput({ ...BASE_SAVINGS_FORM, termMonths: "0" });
    expect(result.success).toBe(false);
  });

  it("Input D — 예금 모드에서 계산방식(단리/월복리) 미선택 불가", () => {
    const result = validateDepositSavingsInterestCalculatorInput({ ...BASE_DEPOSIT_FORM, interestType: "" });
    expect(result.success).toBe(false);
  });

  it("Input E — 월 납입액 음수 불가", () => {
    const result = validateDepositSavingsInterestCalculatorInput({
      ...BASE_SAVINGS_FORM,
      monthlyContribution: "-500,000",
    });
    expect(result.success).toBe(false);
  });
});

describe("정상 입력 — success:true 데이터 형태 확인", () => {
  it("예금 모드: 문자열을 숫자로 변환하고 콤마를 제거한다", () => {
    const result = validateDepositSavingsInterestCalculatorInput(BASE_DEPOSIT_FORM);
    expect(result).toEqual({
      success: true,
      data: {
        mode: "deposit",
        principal: 10_000_000,
        annualRatePercent: 3,
        termMonths: 12,
        interestType: "simple",
      },
    });
  });

  it("적금 모드: 문자열을 숫자로 변환하고 콤마를 제거한다", () => {
    const result = validateDepositSavingsInterestCalculatorInput(BASE_SAVINGS_FORM);
    expect(result).toEqual({
      success: true,
      data: {
        mode: "savings",
        monthlyContribution: 500_000,
        annualRatePercent: 3,
        termMonths: 12,
      },
    });
  });
});

describe("경계값(FORMULA.md '입력값' 표) — 유효한 경계는 통과, 초과는 실패", () => {
  it("연이율 0%는 유효한 경계값이다(오류 아님)", () => {
    const result = validateDepositSavingsInterestCalculatorInput({
      ...BASE_DEPOSIT_FORM,
      annualRatePercent: String(MIN_ANNUAL_RATE_PERCENT),
    });
    expect(result.success).toBe(true);
  });

  it("연이율 상한(30%)은 통과, 초과(30.01%)는 실패한다", () => {
    const atMax = validateDepositSavingsInterestCalculatorInput({
      ...BASE_DEPOSIT_FORM,
      annualRatePercent: String(MAX_ANNUAL_RATE_PERCENT),
    });
    expect(atMax.success).toBe(true);

    const overMax = validateDepositSavingsInterestCalculatorInput({
      ...BASE_DEPOSIT_FORM,
      annualRatePercent: "30.01",
    });
    expect(overMax.success).toBe(false);
  });

  it("기간 1개월은 유효한 경계값이다(오류 아님)", () => {
    const result = validateDepositSavingsInterestCalculatorInput({
      ...BASE_DEPOSIT_FORM,
      termMonths: String(MIN_TERM_MONTHS),
    });
    expect(result.success).toBe(true);
  });

  it("기간 상한(120개월)은 통과, 초과(121개월)는 실패한다", () => {
    const atMax = validateDepositSavingsInterestCalculatorInput({
      ...BASE_DEPOSIT_FORM,
      termMonths: String(MAX_TERM_MONTHS),
    });
    expect(atMax.success).toBe(true);

    const overMax = validateDepositSavingsInterestCalculatorInput({
      ...BASE_DEPOSIT_FORM,
      termMonths: String(MAX_TERM_MONTHS + 1),
    });
    expect(overMax.success).toBe(false);
  });

  it("예치금액 하한(10,000원) 미만은 실패, 하한 자체는 통과한다", () => {
    const atMin = validateDepositSavingsInterestCalculatorInput({
      ...BASE_DEPOSIT_FORM,
      principal: String(MIN_PRINCIPAL),
    });
    expect(atMin.success).toBe(true);

    const belowMin = validateDepositSavingsInterestCalculatorInput({
      ...BASE_DEPOSIT_FORM,
      principal: String(MIN_PRINCIPAL - 1),
    });
    expect(belowMin.success).toBe(false);
  });

  it("예치금액 상한(100억원) 초과는 실패, 상한 자체는 통과한다", () => {
    const atMax = validateDepositSavingsInterestCalculatorInput({
      ...BASE_DEPOSIT_FORM,
      principal: String(MAX_PRINCIPAL),
    });
    expect(atMax.success).toBe(true);

    const overMax = validateDepositSavingsInterestCalculatorInput({
      ...BASE_DEPOSIT_FORM,
      principal: String(MAX_PRINCIPAL + 1),
    });
    expect(overMax.success).toBe(false);
  });

  it("월 납입액 하한(10,000원) 미만은 실패, 하한 자체는 통과한다", () => {
    const atMin = validateDepositSavingsInterestCalculatorInput({
      ...BASE_SAVINGS_FORM,
      monthlyContribution: String(MIN_MONTHLY_CONTRIBUTION),
    });
    expect(atMin.success).toBe(true);

    const belowMin = validateDepositSavingsInterestCalculatorInput({
      ...BASE_SAVINGS_FORM,
      monthlyContribution: String(MIN_MONTHLY_CONTRIBUTION - 1),
    });
    expect(belowMin.success).toBe(false);
  });

  it("월 납입액 상한(5천만원) 초과는 실패, 상한 자체는 통과한다", () => {
    const atMax = validateDepositSavingsInterestCalculatorInput({
      ...BASE_SAVINGS_FORM,
      monthlyContribution: String(MAX_MONTHLY_CONTRIBUTION),
    });
    expect(atMax.success).toBe(true);

    const overMax = validateDepositSavingsInterestCalculatorInput({
      ...BASE_SAVINGS_FORM,
      monthlyContribution: String(MAX_MONTHLY_CONTRIBUTION + 1),
    });
    expect(overMax.success).toBe(false);
  });
});

describe("형식 오류", () => {
  it("숫자가 아닌 예치금액은 실패한다", () => {
    const result = validateDepositSavingsInterestCalculatorInput({ ...BASE_DEPOSIT_FORM, principal: "abc" });
    expect(result.success).toBe(false);
  });

  it("빈 값(필수값 누락)은 실패한다", () => {
    const result = validateDepositSavingsInterestCalculatorInput({
      ...BASE_DEPOSIT_FORM,
      annualRatePercent: "",
      termMonths: "",
      principal: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.errors.map((e) => e.field);
      expect(fields).toEqual(expect.arrayContaining(["annualRatePercent", "termMonths", "principal"]));
    }
  });

  it("연이율은 소수 둘째 자리까지만 허용한다", () => {
    const result = validateDepositSavingsInterestCalculatorInput({ ...BASE_DEPOSIT_FORM, annualRatePercent: "3.456" });
    expect(result.success).toBe(false);
  });
});
