/**
 * 원금균등상환(Equal Principal) — FORMULA.md "공식 ②" 그대로 구현.
 *
 * 앵커값 `base = P/n`을 한 번만 계산해 원 단위로 반올림·고정한 뒤, 그 고정값을 클로저로
 * 캡처하는 스텝 함수를 `schedule-common.ts`의 공통 러너에 넘긴다. `P/n`이 정수로 나누어떨어지지
 * 않는 경우(FORMULA.md 검증 예제 9)의 오차는 공통 러너의 마지막 회차 강제 보정이 흡수한다 —
 * 이 파일은 그 보정을 다시 구현하지 않는다.
 */

import type { LoanInterestCalculatorInput, LoanInterestCalculatorResult } from "../types";
import { runAmortizationSchedule } from "./schedule-common";

type EqualPrincipalResult = Extract<
  LoanInterestCalculatorResult,
  { repaymentMethod: "equalPrincipal" }
>;

export function calculateEqualPrincipalLoan(
  input: LoanInterestCalculatorInput,
): EqualPrincipalResult {
  const { principal, annualRatePercent, termMonths } = input;
  const monthlyRate = annualRatePercent / 100 / 12;

  // 앵커값은 "한 번만" 반올림해 고정한다(FORMULA.md "앵커 값은 한 번만 반올림한다").
  const fixedPrincipalPayment = Math.round(principal / termMonths);

  const { schedule, yearlySummary, totalInterest, totalPayment } = runAmortizationSchedule({
    principal,
    monthlyRate,
    termMonths,
    computeRegularInstallment: (previousBalance, rate) => {
      const interest = Math.round(previousBalance * rate);
      return {
        interest,
        principalPayment: fixedPrincipalPayment,
        payment: fixedPrincipalPayment + interest,
      };
    },
  });

  return {
    repaymentMethod: "equalPrincipal",
    principal,
    annualRatePercent,
    termMonths,
    monthlyRate,
    schedule,
    yearlySummary,
    totalInterest,
    totalPayment,
    firstPayment: schedule[0].payment,
    lastPayment: schedule[schedule.length - 1].payment,
  };
}
