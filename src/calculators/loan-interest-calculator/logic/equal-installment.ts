/**
 * 원리금균등상환(Equal Installment / Annuity) — FORMULA.md "공식 ①" 그대로 구현.
 *
 * 앵커값 `A`(매 회차 고정 상환액)를 연금 현재가치 공식으로 한 번만 계산해 원 단위로
 * 반올림·고정한 뒤, 그 고정값을 클로저로 캡처하는 스텝 함수를 `schedule-common.ts`의 공통
 * 러너에 넘긴다. `r=0`(연이율 0%) 특수 분기는 이 파일에만 존재한다(ARCHITECTURE.md "2. r=0
 * 특수 분기의 위치").
 */

import type { LoanInterestCalculatorInput, LoanInterestCalculatorResult } from "../types";
import { runAmortizationSchedule } from "./schedule-common";

type EqualInstallmentResult = Extract<
  LoanInterestCalculatorResult,
  { repaymentMethod: "equalInstallment" }
>;

export function calculateEqualInstallmentLoan(
  input: LoanInterestCalculatorInput,
): EqualInstallmentResult {
  const { principal, annualRatePercent, termMonths } = input;
  const monthlyRate = annualRatePercent / 100 / 12;

  // FORMULA.md "공식 ①" — A = P×r×(1+r)^n / [(1+r)^n - 1], r=0이면 A = P/n(0/0 NaN 방지).
  const rawAnchor =
    monthlyRate === 0
      ? principal / termMonths
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1);

  // 앵커값은 "한 번만" 반올림해 고정한다(FORMULA.md "앵커 값은 한 번만 반올림한다").
  const fixedMonthlyPayment = Math.round(rawAnchor);

  const { schedule, yearlySummary, totalInterest, totalPayment } = runAmortizationSchedule({
    principal,
    monthlyRate,
    termMonths,
    computeRegularInstallment: (previousBalance, rate) => {
      const interest = Math.round(previousBalance * rate);
      return {
        interest,
        principalPayment: fixedMonthlyPayment - interest,
        payment: fixedMonthlyPayment,
      };
    },
  });

  return {
    repaymentMethod: "equalInstallment",
    principal,
    annualRatePercent,
    termMonths,
    monthlyRate,
    schedule,
    yearlySummary,
    totalInterest,
    totalPayment,
    fixedMonthlyPayment,
  };
}
