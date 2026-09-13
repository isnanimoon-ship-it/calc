/**
 * 만기일시상환(Bullet Repayment) — FORMULA.md "공식 ③" 그대로 구현.
 *
 * 앵커값 `I = P×r`을 한 번만 계산해 원 단위로 반올림·고정한다. 만기 전 매 회차는 이
 * 고정값을 그대로 재사용하고(원금 상환 없음, 잔액 불변) 원금 상환은 0으로 둔다.
 * `schedule-common.ts`의 마지막 회차 강제 보정이 "직전 잔액 전액"을 원금상환액으로 만들기
 * 때문에 — 만기일시상환은 원금이 만기 전까지 전혀 줄지 않아 "직전 잔액"이 곧 원금 전액이므로
 * — 이 파일은 "원금 전액 + 마지막 달 이자"를 별도로 다시 구현하지 않는다(ARCHITECTURE.md
 * "2." 참고).
 */

import type { LoanInterestCalculatorInput, LoanInterestCalculatorResult } from "../types";
import { runAmortizationSchedule } from "./schedule-common";

type BulletResult = Extract<LoanInterestCalculatorResult, { repaymentMethod: "bullet" }>;

export function calculateBulletLoan(input: LoanInterestCalculatorInput): BulletResult {
  const { principal, annualRatePercent, termMonths } = input;
  const monthlyRate = annualRatePercent / 100 / 12;

  // 앵커값은 "한 번만" 반올림해 고정한다(FORMULA.md "앵커 값은 한 번만 반올림한다").
  const fixedInterest = Math.round(principal * monthlyRate);

  const { schedule, yearlySummary, totalInterest, totalPayment } = runAmortizationSchedule({
    principal,
    monthlyRate,
    termMonths,
    // 잔액이 만기까지 불변이므로 이자는 재계산 없이 항상 `fixedInterest`(FORMULA.md "계산
    // 순서" 5단계 — 만기일시 분기).
    computeRegularInstallment: () => ({
      interest: fixedInterest,
      principalPayment: 0,
      payment: fixedInterest,
    }),
  });

  return {
    repaymentMethod: "bullet",
    principal,
    annualRatePercent,
    termMonths,
    monthlyRate,
    schedule,
    yearlySummary,
    totalInterest,
    totalPayment,
    monthlyInterestBeforeMaturity: fixedInterest,
    maturityPayment: schedule[schedule.length - 1].payment,
  };
}
