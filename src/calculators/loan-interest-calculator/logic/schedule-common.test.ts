import { describe, expect, it } from "vitest";
import { runAmortizationSchedule } from "./schedule-common";

/**
 * `schedule-common.ts` 좁은 단위 테스트(ARCHITECTURE.md "9." 3번 권장) — 합성(가짜) 스텝
 * 함수로 이 파일 자체의 책임(마지막 회차 강제 보정, 연도별 집계)만 독립적으로 검증한다.
 * 실제 세 상환방식 공식의 정확성은 `logic.test.ts`(FORMULA.md 검증 예제)가 검증한다.
 */
describe("runAmortizationSchedule", () => {
  it("마지막 회차를 강제 보정해 잔액을 정확히 0으로 만든다(스텝 함수가 매 회차 1원씩 남기는 경우)", () => {
    // 합성 스텝 함수: 원금상환액을 항상 실제보다 1원 적게 계산하는 "일부러 어긋난" 함수로,
    // 마지막 회차 보정이 없으면 잔액이 0으로 끝나지 않음을 반증한다.
    const result = runAmortizationSchedule({
      principal: 1000,
      monthlyRate: 0,
      termMonths: 5,
      computeRegularInstallment: () => ({ interest: 0, principalPayment: 199, payment: 199 }),
    });

    expect(result.schedule).toHaveLength(5);
    // 1~4회차는 스텝 함수 그대로(199원씩).
    for (let i = 0; i < 4; i += 1) {
      expect(result.schedule[i].principalPayment).toBe(199);
    }
    // 4×199=796, 남은 잔액 204원 — 마지막 회차가 199가 아니라 204로 강제 보정되어야 한다.
    expect(result.schedule[4].principalPayment).toBe(204);
    expect(result.schedule[4].balance).toBe(0);
    // Σ원금상환액 = 대출원금 불변식.
    const totalPrincipalPayment = result.schedule.reduce((sum, row) => sum + row.principalPayment, 0);
    expect(totalPrincipalPayment).toBe(1000);
  });

  it("n=1이면 유일한 회차가 곧 마지막 회차로 강제 보정된다(원금 전액 상환)", () => {
    const result = runAmortizationSchedule({
      principal: 5_000_000,
      monthlyRate: 0.01,
      termMonths: 1,
      computeRegularInstallment: () => {
        throw new Error("n=1이면 1~(n-1)회차 루프가 실행되지 않아야 한다");
      },
    });

    expect(result.schedule).toEqual([
      { installment: 1, principalPayment: 5_000_000, interest: 50_000, payment: 5_050_000, balance: 0 },
    ]);
    expect(result.totalInterest).toBe(50_000);
    expect(result.totalPayment).toBe(5_050_000);
  });

  it("만기일시상환처럼 원금상환액이 항상 0인 스텝 함수도 마지막 회차에서 원금 전액+마지막 이자로 자동 보정된다", () => {
    const result = runAmortizationSchedule({
      principal: 10_000_000,
      monthlyRate: 0.005,
      termMonths: 12,
      computeRegularInstallment: () => ({ interest: 50_000, principalPayment: 0, payment: 50_000 }),
    });

    // 1~11회차는 이자만 50,000원, 원금상환액 0.
    for (let i = 0; i < 11; i += 1) {
      expect(result.schedule[i]).toEqual({
        installment: i + 1,
        principalPayment: 0,
        interest: 50_000,
        payment: 50_000,
        balance: 10_000_000,
      });
    }
    // 12회차(마지막) — 방식별 특수 케이스 없이 "직전 잔액 전액"이 원금 전액이 된다.
    expect(result.schedule[11]).toEqual({
      installment: 12,
      principalPayment: 10_000_000,
      interest: 50_000,
      payment: 10_050_000,
      balance: 0,
    });
    expect(result.totalInterest).toBe(600_000);
    expect(result.totalPayment).toBe(10_600_000);
  });

  it("연도별 요약(yearlySummary)이 12개월 단위로 집계되고 마지막 해는 나머지 개월만 묶는다", () => {
    const result = runAmortizationSchedule({
      principal: 15 * 100_000,
      monthlyRate: 0,
      termMonths: 15,
      computeRegularInstallment: () => ({ interest: 0, principalPayment: 100_000, payment: 100_000 }),
    });

    expect(result.yearlySummary).toHaveLength(2);
    expect(result.yearlySummary[0]).toEqual({
      year: 1,
      monthsInYear: 12,
      principalPaymentTotal: 1_200_000,
      interestTotal: 0,
      endOfYearBalance: 300_000,
    });
    expect(result.yearlySummary[1]).toEqual({
      year: 2,
      monthsInYear: 3,
      principalPaymentTotal: 300_000,
      interestTotal: 0,
      endOfYearBalance: 0,
    });
  });
});
