import { describe, expect, it } from "vitest";
import { calculateLoanInterest } from "./logic";
import type { LoanInterestCalculatorInput } from "./types";

/**
 * Golden Test — tasks/loan-interest-calculator/FORMULA.md "검증 예제 (Golden Test 후보,
 * 13개)"를 `calculateLoanInterest`를 통해 그대로 옮긴다. 예제 번호를 주석에 명시해
 * FORMULA.md와 1:1로 대조할 수 있게 한다.
 *
 * 예제 4(해결됨, 2026-09-06): Builder 구현 시점에는 FORMULA.md가 "fixedMonthlyPayment=
 * 1,687,710원"을 "검증 완료"로 표시하고 있었으나, 이는 calculator.net이 이미 센트 단위로
 * 반올림한 $1,687.71을 1,000배 스케일링한 값이었다(반올림 후 스케일링 ≠ 스케일링 후 반올림).
 * FORMULA.md 자신의 공식을 원금 200,000,000원 스케일에서 직접 계산하면 1,687,714원이 맞다
 * (Builder 발견 → Calculation Auditor가 Python `decimal` 50자리 정밀도로 독립 재확인 →
 * Formula Analyst가 FORMULA.md "검증 예제 4"를 1,687,714원으로 정정 완료). 아래 값은
 * 정정된 FORMULA.md와 일치한다.
 */

function input(overrides: Partial<LoanInterestCalculatorInput>): LoanInterestCalculatorInput {
  return {
    principal: 10_000_000,
    annualRatePercent: 5,
    termMonths: 12,
    repaymentMethod: "equalInstallment",
    ...overrides,
  };
}

describe("calculateLoanInterest — Golden Test (FORMULA.md 검증 예제 13개)", () => {
  it("예제 1 — 원리금균등상환, 대출기간 1개월(경계값)", () => {
    const result = calculateLoanInterest(
      input({ principal: 5_000_000, annualRatePercent: 12, termMonths: 1, repaymentMethod: "equalInstallment" }),
    );
    expect(result.repaymentMethod).toBe("equalInstallment");
    expect(result.monthlyRate).toBeCloseTo(0.01, 10);
    expect(result.schedule).toEqual([
      { installment: 1, principalPayment: 5_000_000, interest: 50_000, payment: 5_050_000, balance: 0 },
    ]);
    expect(result.totalInterest).toBe(50_000);
    expect(result.totalPayment).toBe(5_050_000);
  });

  it("예제 2 — 원리금균등상환, 연이율 0%(경계값, r=0 특수 분기)", () => {
    const result = calculateLoanInterest(
      input({ principal: 6_000_000, annualRatePercent: 0, termMonths: 6, repaymentMethod: "equalInstallment" }),
    );
    if (result.repaymentMethod !== "equalInstallment") throw new Error("unreachable");
    expect(result.fixedMonthlyPayment).toBe(1_000_000);
    for (const row of result.schedule) {
      expect(row.principalPayment).toBe(1_000_000);
      expect(row.interest).toBe(0);
      expect(row.payment).toBe(1_000_000);
    }
    expect(result.totalInterest).toBe(0);
    expect(result.totalPayment).toBe(6_000_000);
  });

  it("예제 3 — 원리금균등상환, 일반 케이스(참고용 근사치 범위 대조)", () => {
    const result = calculateLoanInterest(
      input({ principal: 12_000_000, annualRatePercent: 12, termMonths: 12, repaymentMethod: "equalInstallment" }),
    );
    if (result.repaymentMethod !== "equalInstallment") throw new Error("unreachable");
    expect(result.fixedMonthlyPayment).toBe(1_066_185);
    expect(result.totalInterest).toBeGreaterThanOrEqual(794_220);
    expect(result.totalInterest).toBeLessThanOrEqual(794_232);
    expect(result.totalPayment).toBe(12_000_000 + result.totalInterest);
  });

  it("예제 4 — 원리금균등상환, 공식 계산기 대조(calculator.net) — 위 파일 상단 주석 참고", () => {
    const result = calculateLoanInterest(
      input({ principal: 200_000_000, annualRatePercent: 6, termMonths: 180, repaymentMethod: "equalInstallment" }),
    );
    if (result.repaymentMethod !== "equalInstallment") throw new Error("unreachable");
    // FORMULA.md(정정판) "검증 예제 4"와 일치 — 파일 상단 주석 참고.
    expect(result.fixedMonthlyPayment).toBe(1_687_714);
    expect(result.totalInterest).toBe(103_788_417);
  });

  it("예제 5 — 원리금균등상환, 공식 계산기 대조(토스피드 실사례)", () => {
    const result = calculateLoanInterest(
      input({ principal: 100_000_000, annualRatePercent: 5, termMonths: 240, repaymentMethod: "equalInstallment" }),
    );
    if (result.repaymentMethod !== "equalInstallment") throw new Error("unreachable");
    expect(result.fixedMonthlyPayment).toBe(659_956);
    expect(result.schedule[0]).toEqual({
      installment: 1,
      interest: 416_667,
      principalPayment: 243_289,
      payment: 659_956,
      balance: 99_756_711,
    });
    // 16회차 — FORMULA.md "⚠️" 각주: 원문(토스피드) 원금상환액 258,946원과 우리 구현의
    // 258,947원은 1원 차이가 나지만(원문 표기 반올림 처리 차이 추정, 확인 필요로 남김),
    // 이자(401,009원)와 상환액 합계(=fixedMonthlyPayment)는 항상 정확히 일치해야 한다는
    // 것이 FORMULA.md가 명시한 정상 동작이다.
    const row16 = result.schedule[15];
    expect(row16.interest).toBe(401_009);
    expect(row16.payment).toBe(659_956);
    expect(row16.principalPayment).toBe(659_956 - 401_009);
  });

  it("예제 6 — 원금균등상환, 일반 케이스(정확히 나누어떨어짐, 닫힌 형과 이중 검증)", () => {
    const result = calculateLoanInterest(
      input({ principal: 12_000_000, annualRatePercent: 12, termMonths: 12, repaymentMethod: "equalPrincipal" }),
    );
    if (result.repaymentMethod !== "equalPrincipal") throw new Error("unreachable");
    expect(result.schedule[0]).toEqual({
      installment: 1,
      principalPayment: 1_000_000,
      interest: 120_000,
      payment: 1_120_000,
      balance: 11_000_000,
    });
    expect(result.schedule[11]).toEqual({
      installment: 12,
      principalPayment: 1_000_000,
      interest: 10_000,
      payment: 1_010_000,
      balance: 0,
    });
    // 닫힌 형: totalInterest = r×P×(n+1)/2 = 0.01×12,000,000×13/2 = 780,000.
    expect(result.totalInterest).toBe(780_000);
    expect(result.totalPayment).toBe(12_780_000);
    expect(result.firstPayment).toBe(1_120_000);
    expect(result.lastPayment).toBe(1_010_000);
  });

  it("예제 7 — 원금균등상환, 대출기간 1개월(경계값, 예제 1과 수렴)", () => {
    const result = calculateLoanInterest(
      input({ principal: 5_000_000, annualRatePercent: 12, termMonths: 1, repaymentMethod: "equalPrincipal" }),
    );
    expect(result.schedule).toEqual([
      { installment: 1, principalPayment: 5_000_000, interest: 50_000, payment: 5_050_000, balance: 0 },
    ]);
    expect(result.totalInterest).toBe(50_000);
    expect(result.totalPayment).toBe(5_050_000);
  });

  it("예제 8 — 원금균등상환, 연이율 0%(경계값, 예제 2와 수렴)", () => {
    const result = calculateLoanInterest(
      input({ principal: 6_000_000, annualRatePercent: 0, termMonths: 6, repaymentMethod: "equalPrincipal" }),
    );
    for (const row of result.schedule) {
      expect(row.principalPayment).toBe(1_000_000);
      expect(row.interest).toBe(0);
      expect(row.payment).toBe(1_000_000);
    }
    expect(result.totalInterest).toBe(0);
  });

  it("예제 9 — 원금균등상환, 마지막 회차 단수 처리(나누어떨어지지 않는 케이스, 7행 전체 대조)", () => {
    const result = calculateLoanInterest(
      input({ principal: 10_000_000, annualRatePercent: 6, termMonths: 7, repaymentMethod: "equalPrincipal" }),
    );
    expect(result.schedule).toEqual([
      { installment: 1, principalPayment: 1_428_571, interest: 50_000, payment: 1_478_571, balance: 8_571_429 },
      { installment: 2, principalPayment: 1_428_571, interest: 42_857, payment: 1_471_428, balance: 7_142_858 },
      { installment: 3, principalPayment: 1_428_571, interest: 35_714, payment: 1_464_285, balance: 5_714_287 },
      { installment: 4, principalPayment: 1_428_571, interest: 28_571, payment: 1_457_142, balance: 4_285_716 },
      { installment: 5, principalPayment: 1_428_571, interest: 21_429, payment: 1_450_000, balance: 2_857_145 },
      { installment: 6, principalPayment: 1_428_571, interest: 14_286, payment: 1_442_857, balance: 1_428_574 },
      { installment: 7, principalPayment: 1_428_574, interest: 7_143, payment: 1_435_717, balance: 0 },
    ]);
    const totalPrincipalPayment = result.schedule.reduce((sum, row) => sum + row.principalPayment, 0);
    expect(totalPrincipalPayment).toBe(10_000_000);
    expect(result.totalInterest).toBe(200_000);
    expect(result.totalPayment).toBe(10_200_000);
    // yearlySummary — 7개월 전부가 1년차(마지막 해)로 집계되어야 한다.
    expect(result.yearlySummary).toEqual([
      { year: 1, monthsInYear: 7, principalPaymentTotal: 10_000_000, interestTotal: 200_000, endOfYearBalance: 0 },
    ]);
  });

  it("예제 10 — 만기일시상환, 일반 케이스(공식 계산기 대조, 사담모아)", () => {
    const result = calculateLoanInterest(
      input({ principal: 10_000_000, annualRatePercent: 6, termMonths: 12, repaymentMethod: "bullet" }),
    );
    if (result.repaymentMethod !== "bullet") throw new Error("unreachable");
    expect(result.monthlyInterestBeforeMaturity).toBe(50_000);
    for (const row of result.schedule.slice(0, 11)) {
      expect(row).toMatchObject({ interest: 50_000, payment: 50_000, principalPayment: 0 });
    }
    expect(result.schedule[11]).toEqual({
      installment: 12,
      interest: 50_000,
      principalPayment: 10_000_000,
      payment: 10_050_000,
      balance: 0,
    });
    expect(result.maturityPayment).toBe(10_050_000);
    expect(result.totalInterest).toBe(600_000);
    expect(result.totalPayment).toBe(10_600_000);
  });

  it("예제 11 — 만기일시상환, 대출기간 1개월(경계값, 예제 1·7과 수렴)", () => {
    const result = calculateLoanInterest(
      input({ principal: 5_000_000, annualRatePercent: 12, termMonths: 1, repaymentMethod: "bullet" }),
    );
    expect(result.schedule).toEqual([
      { installment: 1, principalPayment: 5_000_000, interest: 50_000, payment: 5_050_000, balance: 0 },
    ]);
    expect(result.totalInterest).toBe(50_000);
  });

  it("예제 12 — 만기일시상환, 연이율 0%(경계값, 예제 2·8과 수렴)", () => {
    const result = calculateLoanInterest(
      input({ principal: 6_000_000, annualRatePercent: 0, termMonths: 6, repaymentMethod: "bullet" }),
    );
    if (result.repaymentMethod !== "bullet") throw new Error("unreachable");
    expect(result.totalInterest).toBe(0);
    expect(result.maturityPayment).toBe(6_000_000);
  });

  it("예제 13 — 세 방식 총이자 순서 비교(완료 기준 불변식): 만기일시 > 원리금균등 > 원금균등", () => {
    const base = { principal: 12_000_000, annualRatePercent: 12, termMonths: 12 } as const;
    const equalInstallment = calculateLoanInterest(input({ ...base, repaymentMethod: "equalInstallment" }));
    const equalPrincipal = calculateLoanInterest(input({ ...base, repaymentMethod: "equalPrincipal" }));
    const bullet = calculateLoanInterest(input({ ...base, repaymentMethod: "bullet" }));

    expect(bullet.totalInterest).toBe(1_440_000);
    expect(equalPrincipal.totalInterest).toBe(780_000);
    expect(equalInstallment.totalInterest).toBeGreaterThan(equalPrincipal.totalInterest);
    expect(bullet.totalInterest).toBeGreaterThan(equalInstallment.totalInterest);
  });
});

describe("완료 기준 불변식(모든 케이스에 대한 회귀 방지)", () => {
  const cases: LoanInterestCalculatorInput[] = [
    input({ principal: 5_000_000, annualRatePercent: 12, termMonths: 1, repaymentMethod: "equalInstallment" }),
    input({ principal: 6_000_000, annualRatePercent: 0, termMonths: 6, repaymentMethod: "equalInstallment" }),
    input({ principal: 12_000_000, annualRatePercent: 12, termMonths: 12, repaymentMethod: "equalInstallment" }),
    input({ principal: 100_000_000, annualRatePercent: 5, termMonths: 240, repaymentMethod: "equalInstallment" }),
    input({ principal: 12_000_000, annualRatePercent: 12, termMonths: 12, repaymentMethod: "equalPrincipal" }),
    input({ principal: 10_000_000, annualRatePercent: 6, termMonths: 7, repaymentMethod: "equalPrincipal" }),
    input({ principal: 10_000_000, annualRatePercent: 6, termMonths: 12, repaymentMethod: "bullet" }),
    // 극단값(ARCHITECTURE.md "1." 부동소수점 분석 재확인 — 연이율 상한 100%, 대출기간 상한 480개월).
    input({ principal: 10_000_000_000, annualRatePercent: 100, termMonths: 480, repaymentMethod: "equalInstallment" }),
    input({ principal: 10_000_000_000, annualRatePercent: 100, termMonths: 480, repaymentMethod: "equalPrincipal" }),
    input({ principal: 10_000_000_000, annualRatePercent: 100, termMonths: 480, repaymentMethod: "bullet" }),
  ];

  it.each(cases)(
    "Σ회차별 원금상환액 = 대출원금, 마지막 회차 이후 잔액 = 0 ($repaymentMethod)",
    (loanInput) => {
      const result = calculateLoanInterest(loanInput);
      const totalPrincipalPayment = result.schedule.reduce((sum, row) => sum + row.principalPayment, 0);
      expect(totalPrincipalPayment).toBe(loanInput.principal);
      expect(result.schedule.at(-1)?.balance).toBe(0);
      expect(result.schedule).toHaveLength(loanInput.termMonths);
      expect(result.totalPayment).toBe(loanInput.principal + result.totalInterest);
      // 부동소수점/반올림 안전성 — 모든 값이 유한한 정수여야 한다.
      for (const row of result.schedule) {
        expect(Number.isInteger(row.principalPayment)).toBe(true);
        expect(Number.isInteger(row.interest)).toBe(true);
        expect(Number.isFinite(row.payment)).toBe(true);
      }
    },
  );
});
