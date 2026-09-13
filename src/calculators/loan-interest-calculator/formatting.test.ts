import { describe, expect, it } from "vitest";
import {
  buildLoanInterestBreakdown,
  buildYearlySummaryDisplayRows,
  formatAnnualRatePercent,
  formatLoanTerm,
  formatMonthlyRateDecimal,
  formatMonthlyRatePercent,
  formatWon,
} from "./formatting";
import { calculateLoanInterest } from "./logic";
import type { LoanInterestCalculatorInput } from "./types";

describe("formatWon", () => {
  it("원 단위 콤마 표시(재반올림 없음 — logic이 이미 정수를 반환)", () => {
    expect(formatWon(1_234_567)).toBe("1,234,567원");
    expect(formatWon(0)).toBe("0원");
  });
});

describe("formatAnnualRatePercent", () => {
  it("연이율을 '연 N%'로 표시한다", () => {
    expect(formatAnnualRatePercent(5)).toBe("연 5%");
    expect(formatAnnualRatePercent(4.25)).toBe("연 4.25%");
  });
});

describe("formatMonthlyRatePercent", () => {
  it("월이율을 %로 환산해 표시하고 꼬리의 0을 잘라낸다", () => {
    expect(formatMonthlyRatePercent(0.005)).toBe("0.5%");
    expect(formatMonthlyRatePercent(0)).toBe("0%");
  });

  it("소수점 이하 값이 있으면 최대 넷째 자리까지 보여준다", () => {
    expect(formatMonthlyRatePercent(5 / 100 / 12)).toBe("0.4167%");
  });
});

describe("formatMonthlyRateDecimal", () => {
  it("월이율을 무차원 소수로 표시하고 꼬리의 0을 잘라낸다", () => {
    expect(formatMonthlyRateDecimal(0.005)).toBe("0.005");
    expect(formatMonthlyRateDecimal(0)).toBe("0");
  });

  it("소수점 이하 값이 있으면 최대 여섯째 자리까지 보여준다(연 5%→월 0.004167)", () => {
    expect(formatMonthlyRateDecimal(5 / 100 / 12)).toBe("0.004167");
  });
});

describe("formatLoanTerm", () => {
  it("년+개월 조합을 함께 표시한다", () => {
    expect(formatLoanTerm(246)).toBe("20년 6개월 (총 246개월)");
  });

  it("개월이 0이면 년만 표시한다", () => {
    expect(formatLoanTerm(240)).toBe("20년 (총 240개월)");
  });

  it("1년 미만이면 개월만 표시한다", () => {
    expect(formatLoanTerm(7)).toBe("7개월");
  });
});

describe("buildYearlySummaryDisplayRows", () => {
  it("마지막 해(개월 수 12 미만)에는 개월 수를 함께 표시한다", () => {
    const input: LoanInterestCalculatorInput = {
      principal: 10_000_000,
      annualRatePercent: 6,
      termMonths: 7,
      repaymentMethod: "equalPrincipal",
    };
    const result = calculateLoanInterest(input);
    const rows = buildYearlySummaryDisplayRows(result.yearlySummary);
    expect(rows).toEqual([
      {
        key: 1,
        yearLabel: "1년차 (7개월)",
        principalPaymentTotal: "10,000,000원",
        interestTotal: "200,000원",
        endOfYearBalance: "0원",
      },
    ]);
  });

  it("만 12개월인 해는 개월 수 없이 'N년차'로만 표시한다", () => {
    const input: LoanInterestCalculatorInput = {
      principal: 12_000_000,
      annualRatePercent: 12,
      termMonths: 12,
      repaymentMethod: "equalPrincipal",
    };
    const result = calculateLoanInterest(input);
    const rows = buildYearlySummaryDisplayRows(result.yearlySummary);
    expect(rows).toHaveLength(1);
    expect(rows[0].yearLabel).toBe("1년차");
  });
});

describe("buildLoanInterestBreakdown", () => {
  const baseInput: LoanInterestCalculatorInput = {
    principal: 100_000_000,
    annualRatePercent: 5,
    termMonths: 240,
    repaymentMethod: "equalInstallment",
  };

  it("원리금균등상환은 '매월 상환액(고정) 계산' 단계를 포함한다", () => {
    const result = calculateLoanInterest(baseInput);
    const rows = buildLoanInterestBreakdown(baseInput, result);
    expect(rows.map((row) => row.label)).toEqual([
      "월이율 계산",
      "매월 상환액(고정) 계산",
      "1회차 상환 계산 예시",
      "총 이자",
      "총 상환금액",
    ]);
    expect(rows[1].expression).toContain("659,956원");
  });

  it("원금균등상환은 '매회차 원금상환액(기준값) 계산' 단계를 포함한다", () => {
    const input: LoanInterestCalculatorInput = { ...baseInput, repaymentMethod: "equalPrincipal" };
    const result = calculateLoanInterest(input);
    const rows = buildLoanInterestBreakdown(input, result);
    expect(rows[1].label).toBe("매회차 원금상환액(기준값) 계산");
  });

  it("만기일시상환은 '매월 이자(만기 전, 고정) 계산' 단계를 포함한다", () => {
    const input: LoanInterestCalculatorInput = { ...baseInput, repaymentMethod: "bullet" };
    const result = calculateLoanInterest(input);
    const rows = buildLoanInterestBreakdown(input, result);
    expect(rows[1].label).toBe("매월 이자(만기 전, 고정) 계산");
  });

  it("원리금균등상환(r>0)의 앵커값 수식에서 지수항의 r이 실제 월이율 값으로 치환된다(UX/UI Critic Medium #11)", () => {
    const result = calculateLoanInterest(baseInput);
    const rows = buildLoanInterestBreakdown(baseInput, result);
    const expression = rows[1].expression;
    // 연 5% → 월이율 5/100/12 = 0.004167(반올림 표시)이 지수 밑에 두 번(분자·분모) 그대로
    // 나타나야 하고, 기호 "r"이 남아 있으면 안 된다.
    expect(expression).toContain("(1+0.004167)^240");
    expect(expression).not.toMatch(/\(1\+r\)/);
  });

  it("연이율 0%(r=0)이면 원리금균등 앵커 계산식이 나눗셈 형태로 표시된다", () => {
    const input: LoanInterestCalculatorInput = { ...baseInput, annualRatePercent: 0 };
    const result = calculateLoanInterest(input);
    const rows = buildLoanInterestBreakdown(input, result);
    expect(rows[1].expression).toContain("÷");
    expect(rows[1].expression).not.toContain("^");
  });

  it("총 이자·총 상환금액 단계가 result 값과 정확히 일치한다", () => {
    const result = calculateLoanInterest(baseInput);
    const rows = buildLoanInterestBreakdown(baseInput, result);
    const totalInterestRow = rows.find((row) => row.label === "총 이자");
    const totalPaymentRow = rows.find((row) => row.label === "총 상환금액");
    expect(totalInterestRow?.expression).toBe(formatWon(result.totalInterest));
    expect(totalPaymentRow?.expression).toContain(formatWon(result.totalPayment));
  });
});
