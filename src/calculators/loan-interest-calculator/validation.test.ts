import { describe, expect, it } from "vitest";
import {
  MAX_ANNUAL_RATE_PERCENT,
  MAX_MONTHS_FIELD,
  MAX_PRINCIPAL,
  MAX_TERM_MONTHS,
  MAX_YEARS_FIELD,
  MIN_ANNUAL_RATE_PERCENT,
  MIN_PRINCIPAL,
  MIN_TERM_MONTHS,
  validateLoanInterestCalculatorInput,
  type RawLoanInterestCalculatorFormInput,
} from "./validation";

function raw(overrides: Partial<RawLoanInterestCalculatorFormInput>): RawLoanInterestCalculatorFormInput {
  return {
    principal: "10,000,000",
    annualRatePercent: "5",
    years: "1",
    months: "0",
    repaymentMethod: "equalInstallment",
    ...overrides,
  };
}

describe("validateLoanInterestCalculatorInput", () => {
  it("유효한 값이면 termMonths를 년×12+개월로 합산해 반환한다", () => {
    const result = validateLoanInterestCalculatorInput(raw({ years: "2", months: "6" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        principal: 10_000_000,
        annualRatePercent: 5,
        termMonths: 30,
        repaymentMethod: "equalInstallment",
      });
    }
  });

  it("콤마가 포함된 원금 문자열을 정상 파싱한다", () => {
    const result = validateLoanInterestCalculatorInput(raw({ principal: "1,234,000" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.principal).toBe(1_234_000);
  });

  // ── 원금 ──────────────────────────────────────────────────────────────────
  it("원금 누락은 오류", () => {
    const result = validateLoanInterestCalculatorInput(raw({ principal: "" }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "principal")).toBe(true);
  });

  it("원금 하한 미만은 오류(경계 바로 아래)", () => {
    const result = validateLoanInterestCalculatorInput(raw({ principal: String(MIN_PRINCIPAL - 1) }));
    expect(result.success).toBe(false);
  });

  it("원금 하한 그대로는 통과(경계값)", () => {
    const result = validateLoanInterestCalculatorInput(raw({ principal: String(MIN_PRINCIPAL) }));
    expect(result.success).toBe(true);
  });

  it("원금 상한 초과는 오류(경계 바로 위)", () => {
    const result = validateLoanInterestCalculatorInput(raw({ principal: String(MAX_PRINCIPAL + 1) }));
    expect(result.success).toBe(false);
  });

  it("원금 상한 그대로는 통과(경계값)", () => {
    const result = validateLoanInterestCalculatorInput(raw({ principal: String(MAX_PRINCIPAL) }));
    expect(result.success).toBe(true);
  });

  it("원금에 숫자가 아닌 문자가 섞이면 오류", () => {
    const result = validateLoanInterestCalculatorInput(raw({ principal: "1000만원" }));
    expect(result.success).toBe(false);
  });

  it("원금 음수(하이픈)는 오류", () => {
    const result = validateLoanInterestCalculatorInput(raw({ principal: "-1000000" }));
    expect(result.success).toBe(false);
  });

  // ── 연이율 ────────────────────────────────────────────────────────────────
  it("연이율 누락은 오류", () => {
    const result = validateLoanInterestCalculatorInput(raw({ annualRatePercent: "" }));
    expect(result.success).toBe(false);
  });

  it("연이율 0%는 정상 경로(경계값, FORMULA.md 예외 참고)", () => {
    const result = validateLoanInterestCalculatorInput(
      raw({ annualRatePercent: String(MIN_ANNUAL_RATE_PERCENT) }),
    );
    expect(result.success).toBe(true);
  });

  it("연이율 상한 그대로는 통과(경계값)", () => {
    const result = validateLoanInterestCalculatorInput(
      raw({ annualRatePercent: String(MAX_ANNUAL_RATE_PERCENT) }),
    );
    expect(result.success).toBe(true);
  });

  it("연이율 상한 초과는 오류(경계 바로 위)", () => {
    const result = validateLoanInterestCalculatorInput(
      raw({ annualRatePercent: String(MAX_ANNUAL_RATE_PERCENT + 1) }),
    );
    expect(result.success).toBe(false);
  });

  it("연이율 음수는 오류", () => {
    const result = validateLoanInterestCalculatorInput(raw({ annualRatePercent: "-1" }));
    expect(result.success).toBe(false);
  });

  it("연이율 소수 둘째 자리(4.25)는 통과한다", () => {
    const result = validateLoanInterestCalculatorInput(raw({ annualRatePercent: "4.25" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.annualRatePercent).toBe(4.25);
  });

  it("연이율 소수 셋째 자리는 오류", () => {
    const result = validateLoanInterestCalculatorInput(raw({ annualRatePercent: "4.255" }));
    expect(result.success).toBe(false);
  });

  // ── 대출기간(년+개월 → termMonths) ───────────────────────────────────────────
  it("대출기간 0개월(년=0, 개월=0)은 오류(회차가 존재하지 않음)", () => {
    const result = validateLoanInterestCalculatorInput(raw({ years: "0", months: "0" }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "termMonths")).toBe(true);
  });

  it("대출기간 1개월(년=0, 개월=1)은 정상 경로(경계값)", () => {
    const result = validateLoanInterestCalculatorInput(raw({ years: "0", months: "1" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.termMonths).toBe(MIN_TERM_MONTHS);
  });

  it("대출기간 합계가 480개월(40년)이면 통과(경계값)", () => {
    const result = validateLoanInterestCalculatorInput(raw({ years: "40", months: "0" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.termMonths).toBe(MAX_TERM_MONTHS);
  });

  it("개별 필드는 유효 범위 안이어도 합산이 480개월을 초과하면 오류(40년 1개월)", () => {
    const result = validateLoanInterestCalculatorInput(raw({ years: "40", months: "1" }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "termMonths")).toBe(true);
  });

  it("'년' 필드 상한 초과는 오류", () => {
    const result = validateLoanInterestCalculatorInput(raw({ years: String(MAX_YEARS_FIELD + 1), months: "0" }));
    expect(result.success).toBe(false);
  });

  it("'개월' 필드 상한(11) 초과는 오류", () => {
    const result = validateLoanInterestCalculatorInput(raw({ years: "0", months: String(MAX_MONTHS_FIELD + 1) }));
    expect(result.success).toBe(false);
  });

  it("'개월' 필드 자체의 범위 오류(0~11)는 'months' 태그를, 년+개월 합산 오류는 'termMonths' 태그를 쓴다(UX/UI Critic Low #5 — 오류 표시 위치 구분용)", () => {
    const fieldOwnError = validateLoanInterestCalculatorInput(
      raw({ years: "0", months: String(MAX_MONTHS_FIELD + 1) }),
    );
    expect(fieldOwnError.success).toBe(false);
    if (!fieldOwnError.success) {
      expect(fieldOwnError.errors.some((e) => e.field === "months")).toBe(true);
      expect(fieldOwnError.errors.some((e) => e.field === "termMonths")).toBe(false);
    }

    const sumError = validateLoanInterestCalculatorInput(raw({ years: "40", months: "1" }));
    expect(sumError.success).toBe(false);
    if (!sumError.success) {
      expect(sumError.errors.some((e) => e.field === "termMonths")).toBe(true);
      expect(sumError.errors.some((e) => e.field === "months")).toBe(false);
      expect(sumError.errors.some((e) => e.field === "years")).toBe(false);
    }
  });

  it("'년'/'개월'에 소수나 문자가 섞이면 오류", () => {
    const result = validateLoanInterestCalculatorInput(raw({ years: "1.5", months: "0" }));
    expect(result.success).toBe(false);
  });

  it("'년'/'개월'을 비워두면 0으로 취급한다", () => {
    const result = validateLoanInterestCalculatorInput(raw({ years: "", months: "6" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.termMonths).toBe(6);
  });

  // ── 상환방식 ──────────────────────────────────────────────────────────────
  it("상환방식 미선택은 오류", () => {
    const result = validateLoanInterestCalculatorInput(raw({ repaymentMethod: "" }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "repaymentMethod")).toBe(true);
  });

  it("세 상환방식 모두 유효한 값으로 통과한다", () => {
    for (const method of ["equalInstallment", "equalPrincipal", "bullet"] as const) {
      const result = validateLoanInterestCalculatorInput(raw({ repaymentMethod: method }));
      expect(result.success).toBe(true);
    }
  });

  it("여러 필드가 동시에 잘못되면 오류를 모두 모아 반환한다", () => {
    const result = validateLoanInterestCalculatorInput(
      raw({ principal: "", annualRatePercent: "", years: "0", months: "0", repaymentMethod: "" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.errors.map((e) => e.field);
      expect(fields).toEqual(
        expect.arrayContaining(["principal", "annualRatePercent", "termMonths", "repaymentMethod"]),
      );
    }
  });
});
