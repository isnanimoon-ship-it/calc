/**
 * 대출 이자 계산기 — 상환방식 3종이 공유하는 공통 골격.
 *
 * tasks/loan-interest-calculator/ARCHITECTURE.md "2. 계산 로직 분리 방식" 그대로 구현한다.
 * 이 파일은 FORMULA.md "계산 순서" 5~8단계(회차 반복 → 마지막 회차 강제 보정 → 총계 →
 * 연도별 집계)를 전담한다 — 방식별 특수 케이스(r=0 분기 등)는 전혀 알지 못한다. 방식별
 * 앵커값 계산과 회차별 스텝 함수는 `equal-installment.ts`/`equal-principal.ts`/`bullet.ts`가
 * 각각 만들어 이 러너에 콜백으로 주입한다.
 */

import type { LoanScheduleRow, LoanYearlySummaryRow, Won } from "../types";

/** 1~(n-1)회차에서 방식별로 다른 계산을 담당하는 스텝 함수 한 회차 분의 결과. */
export interface RegularInstallmentStep {
  interest: Won;
  principalPayment: Won;
  payment: Won;
}

/**
 * 방식별 스텝 함수 — 직전 잔액과 월이율을 받아 이번 회차의 이자·원금상환액·상환액을 계산한다.
 * `monthlyRate`는 클로저로도 접근 가능하지만, 스텝 함수 시그니처에 명시적으로 포함해 이
 * 함수가 "직전 잔액과 이율만으로 결정되는 순수 계산"임을 드러낸다(ARCHITECTURE.md "2." 참고).
 */
export type ComputeRegularInstallment = (
  previousBalance: Won,
  monthlyRate: number,
) => RegularInstallmentStep;

export interface RunAmortizationScheduleInput {
  principal: Won;
  monthlyRate: number;
  /** 총 회차 수(개월). 1 이상이어야 한다 — 검증은 validation.ts가 이미 끝낸 것을 전제한다. */
  termMonths: number;
  computeRegularInstallment: ComputeRegularInstallment;
}

export interface AmortizationScheduleOutput {
  schedule: LoanScheduleRow[];
  yearlySummary: LoanYearlySummaryRow[];
  totalInterest: Won;
  totalPayment: Won;
}

/**
 * FORMULA.md "계산 순서" 5~8단계.
 *
 * 1~(n-1)회차는 주입받은 `computeRegularInstallment`로 계산하고, 마지막 회차(n)는 세 방식
 * 공통으로 "직전 잔액 전액을 원금상환액으로, 이자는 다른 회차와 동일한 방식(round(직전 잔액 ×
 * 월이율))으로 계산"해 강제 보정한다(FORMULA.md "마지막 회차 단수 처리") — 이 보정 덕분에
 * 만기일시상환도 별도 분기 없이 "원금 전액 + 마지막 달 이자"가 자동으로 나온다
 * (ARCHITECTURE.md "2." 참고: 만기일시는 원금이 만기 전까지 전혀 줄지 않으므로 "직전 잔액"이
 * 곧 원금 전액이다).
 */
export function runAmortizationSchedule(
  input: RunAmortizationScheduleInput,
): AmortizationScheduleOutput {
  const { principal, monthlyRate, termMonths, computeRegularInstallment } = input;
  const schedule: LoanScheduleRow[] = [];
  let balance = principal;

  for (let installment = 1; installment < termMonths; installment += 1) {
    const step = computeRegularInstallment(balance, monthlyRate);
    balance -= step.principalPayment;
    schedule.push({
      installment,
      principalPayment: step.principalPayment,
      interest: step.interest,
      payment: step.payment,
      balance,
    });
  }

  // 마지막 회차(n) 강제 보정 — FORMULA.md "마지막 회차 단수 처리", 세 방식 공통.
  const lastInterest = Math.round(balance * monthlyRate);
  const lastPrincipalPayment = balance;
  schedule.push({
    installment: termMonths,
    principalPayment: lastPrincipalPayment,
    interest: lastInterest,
    payment: lastPrincipalPayment + lastInterest,
    balance: 0,
  });

  const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
  const totalPayment = principal + totalInterest;
  const yearlySummary = buildYearlySummary(schedule);

  return { schedule, yearlySummary, totalInterest, totalPayment };
}

/**
 * FORMULA.md "계산 순서" 8단계 — 12개월 단위(마지막 해는 나머지 개월)로 묶어 원금 합계·이자
 * 합계·연말 잔액을 집계한다. 순수 숫자 집계이며 상환방식과 무관하다(ARCHITECTURE.md "2."
 * "연도별 집계도 완전히 공통이다").
 */
function buildYearlySummary(schedule: LoanScheduleRow[]): LoanYearlySummaryRow[] {
  const yearlySummary: LoanYearlySummaryRow[] = [];
  for (let start = 0; start < schedule.length; start += 12) {
    const rows = schedule.slice(start, start + 12);
    const principalPaymentTotal = rows.reduce((sum, row) => sum + row.principalPayment, 0);
    const interestTotal = rows.reduce((sum, row) => sum + row.interest, 0);
    yearlySummary.push({
      year: yearlySummary.length + 1,
      monthsInYear: rows.length,
      principalPaymentTotal,
      interestTotal,
      endOfYearBalance: rows[rows.length - 1].balance,
    });
  }
  return yearlySummary;
}
