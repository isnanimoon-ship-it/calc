/**
 * 예금·적금 이자 계산기 — Golden Test.
 *
 * tasks/deposit-savings-interest-calculator/FORMULA.md "검증 예제(Golden Test 후보, 18개)"의
 * 계산 예제(오류 케이스 5종 제외 — validation.test.ts로 분리)를 그대로 옮긴다. 예제 5·6은
 * FORMULA.md 원문이 스스로 "손계산 근사치"라고 명시했으므로, ARCHITECTURE.md "11. 정밀
 * 재계산 확정값"(Node.js Math.pow 직접 계산으로 확정)을 그대로 쓴다.
 */

import { describe, expect, it } from "vitest";
import {
  buildSavingsSchedule,
  calculateDepositCompound,
  calculateDepositSavingsInterest,
  calculateDepositSimple,
  calculateInterestIncomeTax,
  calculateSavings,
  sumScheduleDisplayInterest,
} from "./logic";
import type { DepositInput, SavingsInput } from "./types";

describe("calculateInterestIncomeTax — 공식 4(소득세 14% 사사오입 → 지방소득세 10% 사사오입)", () => {
  it("1pic.kr 실사례(예제 8) — 세전이자 113,750원 → 소득세 15,925원 → 지방소득세 1,593원(사사오입, 1,592 아님)", () => {
    const tax = calculateInterestIncomeTax(113_750);
    expect(tax).toEqual({
      incomeTax: 15_925,
      localIncomeTax: 1_593,
      totalTax: 17_518,
      afterTaxInterest: 96_232,
    });
  });

  it("예제 17 — 극소액(세전이자 10원)에서도 소액부징수 없이 항상 원천징수한다", () => {
    const tax = calculateInterestIncomeTax(10);
    expect(tax).toEqual({ incomeTax: 1, localIncomeTax: 0, totalTax: 1, afterTaxInterest: 9 });
  });
});

describe("예금(거치식) 단리 — calculateDepositSimple / calculateDepositSavingsInterest", () => {
  it("예제 1 — 대표 사례(자체 산출, 항등식): 1,000만원·연3%·12개월", () => {
    const input: DepositInput = { mode: "deposit", principal: 10_000_000, annualRatePercent: 3, termMonths: 12, interestType: "simple" };
    const result = calculateDepositSimple(input as DepositInput & { interestType: "simple" });
    expect(result).toMatchObject({
      mode: "deposit",
      interestType: "simple",
      preTaxInterest: 300_000,
      incomeTax: 42_000,
      localIncomeTax: 4_200,
      totalTax: 46_200,
      afterTaxInterest: 253_800,
      afterTaxMaturityAmount: 10_253_800,
    });
    expect(calculateDepositSavingsInterest(input)).toEqual(result);
  });

  it("예제 2 — 공식 계산기 대조①(jptcalc.kr): 1,000만원·연3.5%·12개월", () => {
    const input: DepositInput = { mode: "deposit", principal: 10_000_000, annualRatePercent: 3.5, termMonths: 12, interestType: "simple" };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      preTaxInterest: 350_000,
      incomeTax: 49_000,
      localIncomeTax: 4_900,
      afterTaxInterest: 296_100,
      afterTaxMaturityAmount: 10_296_100,
    });
  });

  it("예제 3 — 공식 계산기 대조②(jptcalc.kr): 5,000만원·연4%·12개월", () => {
    const input: DepositInput = { mode: "deposit", principal: 50_000_000, annualRatePercent: 4, termMonths: 12, interestType: "simple" };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      preTaxInterest: 2_000_000,
      incomeTax: 280_000,
      localIncomeTax: 28_000,
      afterTaxInterest: 1_692_000,
      afterTaxMaturityAmount: 51_692_000,
    });
  });

  it("예제 13 — 매우 긴 기간(60개월=5년): 2,000만원·연5%", () => {
    const input: DepositInput = { mode: "deposit", principal: 20_000_000, annualRatePercent: 5, termMonths: 60, interestType: "simple" };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      preTaxInterest: 5_000_000,
      incomeTax: 700_000,
      localIncomeTax: 70_000,
      afterTaxInterest: 4_230_000,
      afterTaxMaturityAmount: 24_230_000,
    });
  });

  it("예제 15 — 연이율 0%(경계값): 세전 이자·세금 모두 0원, 원금 그대로 반환", () => {
    const input: DepositInput = { mode: "deposit", principal: 5_000_000, annualRatePercent: 0, termMonths: 12, interestType: "simple" };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      preTaxInterest: 0,
      incomeTax: 0,
      localIncomeTax: 0,
      afterTaxInterest: 0,
      afterTaxMaturityAmount: 5_000_000,
    });
  });

  it("예제 17 — 이자소득세 경계값(극소액, 소액부징수 미적용): 10만원·연0.12%·1개월", () => {
    const input: DepositInput = { mode: "deposit", principal: 100_000, annualRatePercent: 0.12, termMonths: 1, interestType: "simple" };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      preTaxInterest: 10,
      incomeTax: 1,
      localIncomeTax: 0,
      afterTaxInterest: 9,
      afterTaxMaturityAmount: 100_009,
    });
  });

  // Calculation Auditor 재검증이 실증한 High 결함(고정 epsilon(1e-6)이 원금 약 20억원 이상에서
  // 뚫리는 문제, tasks/deposit-savings-interest-calculator/EVALUATION.md "## Calculation
  // Auditor (재검증)" "3-A" 절)을 회귀 방지용 Golden Test로 고정한다. 기대값은 Python
  // fractions.Fraction 임의정밀도 연산으로 독립 재계산해 확정했다. 수정 전 구현(고정
  // epsilon)에서는 실패하고(재현 확인됨), 현재 구현(BigInt 유리수 연산)에서는 통과해야 한다.
  it("Calculation Auditor 재검증 반례(High) — 원금이 클 때(약 20억원 이상) epsilon이 뚫려 진짜 정수값을 1원 작게 절사하던 문제 해소: 90억원·연6.27%·113개월", () => {
    // 진짜(유리수) raw는 정확히 5,313,825,000(정수). 수정 전 구현은 부동소수점 절대오차가
    // 원금(90억) 곱셈으로 증폭돼 5,313,824,999로 잘못 절사했다.
    const input: DepositInput = { mode: "deposit", principal: 9_000_000_000, annualRatePercent: 6.27, termMonths: 113, interestType: "simple" };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      preTaxInterest: 5_313_825_000,
      incomeTax: 743_935_500,
      localIncomeTax: 74_393_550,
      afterTaxInterest: 4_495_495_950,
      afterTaxMaturityAmount: 13_495_495_950,
    });
  });
});

describe("예금(거치식) 월복리 — calculateDepositCompound / calculateDepositSavingsInterest", () => {
  it("예제 4 — 단리 vs 월복리 소규모 정밀 대조(자체 산출, 완전 정밀): 1,000만원·연3%·2개월", () => {
    const simpleInput: DepositInput = { mode: "deposit", principal: 10_000_000, annualRatePercent: 3, termMonths: 2, interestType: "simple" };
    const compoundInput: DepositInput = { ...simpleInput, interestType: "compound" };

    const simple = calculateDepositSavingsInterest(simpleInput);
    const compound = calculateDepositSavingsInterest(compoundInput);

    expect(simple).toMatchObject({ preTaxInterest: 50_000, afterTaxInterest: 42_300, afterTaxMaturityAmount: 10_042_300 });
    expect(compound).toMatchObject({
      preTaxInterest: 50_062,
      incomeTax: 7_009,
      localIncomeTax: 701,
      afterTaxInterest: 42_352,
      afterTaxMaturityAmount: 10_042_352,
      monthlyRate: 0.0025,
    });
  });

  it("예제 5 — 대표 사례(ARCHITECTURE.md '11.' 정밀 재계산 확정값, 근사치 아님): 1,000만원·연3%·12개월", () => {
    const input: DepositInput = { mode: "deposit", principal: 10_000_000, annualRatePercent: 3, termMonths: 12, interestType: "compound" };
    const result = calculateDepositCompound(input as DepositInput & { interestType: "compound" });
    expect(result).toMatchObject({
      preTaxInterest: 304_159,
      incomeTax: 42_582,
      localIncomeTax: 4_258,
      totalTax: 46_840,
      afterTaxInterest: 257_319,
      afterTaxMaturityAmount: 10_257_319,
    });
    // 같은 조건 단리(예제 1)보다 세전 이자가 더 크다 — 복리가 단리보다 항상 크거나 같다는
    // 완료 기준 불변식을 재확인.
    const simple = calculateDepositSavingsInterest({ ...input, interestType: "simple" });
    expect(result.preTaxInterest).toBeGreaterThan(simple.preTaxInterest);
  });

  it("예제 6 — 매우 높은 이율(상한 30%, 극단값): 100만원·연30%·12개월(ARCHITECTURE.md '11.' 정밀 재계산 확정값)", () => {
    const input: DepositInput = { mode: "deposit", principal: 1_000_000, annualRatePercent: 30, termMonths: 12, interestType: "compound" };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      preTaxInterest: 344_888,
      incomeTax: 48_284,
      localIncomeTax: 4_828,
      totalTax: 53_112,
      afterTaxInterest: 291_776,
      afterTaxMaturityAmount: 1_291_776,
    });
  });

  it("예제 12 — 기간 경계값(1개월): 단리·월복리가 정확히 같은 값으로 수렴한다((1+r)^1-1=r)", () => {
    const simpleInput: DepositInput = { mode: "deposit", principal: 5_000_000, annualRatePercent: 6, termMonths: 1, interestType: "simple" };
    const compoundInput: DepositInput = { ...simpleInput, interestType: "compound" };
    const simple = calculateDepositSavingsInterest(simpleInput);
    const compound = calculateDepositSavingsInterest(compoundInput);
    for (const result of [simple, compound]) {
      expect(result).toMatchObject({
        preTaxInterest: 25_000,
        incomeTax: 3_500,
        localIncomeTax: 350,
        afterTaxInterest: 21_150,
        afterTaxMaturityAmount: 5_021_150,
      });
    }
  });

  it("예제 15 보조 — 연이율 0%(경계값)에서 월복리도 세전 이자가 0원이다", () => {
    const input: DepositInput = { mode: "deposit", principal: 5_000_000, annualRatePercent: 0, termMonths: 12, interestType: "compound" };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({ preTaxInterest: 0, afterTaxMaturityAmount: 5_000_000, monthlyRate: 0 });
  });

  // 아래 3건은 Calculation Auditor가 실증한 고정 epsilon(Math.floor(raw + 1e-6)) 방식의
  // High 등급 결함 2건(tasks/deposit-savings-interest-calculator/EVALUATION.md "## Calculation
  // Auditor" "1." 절)을 회귀 방지용 Golden Test로 고정한다. 기대값은 Python
  // fractions.Fraction 임의정밀도 연산으로 독립 재계산해 확정했다(재계산 스크립트·41,706건
  // 브루트포스 검증 결과는 EVALUATION.md "## Optimizer" 절 참고). 세 사례 모두 수정 전
  // 구현에서는 실패하고(재현 확인됨), 현재 구현(BigInt 유리수 연산)에서는 통과해야 한다.
  it("Calculation Auditor 반례 1(High #1) — 진짜 비정수 raw를 epsilon이 잘못 올리던 문제 해소: 100만원·연23.79%·5개월", () => {
    // 진짜(유리수) raw = 103,133.9999991958...(비정수, floor=103,133). 수정 전 고정
    // epsilon(1e-6) 보정은 이를 103,134로 잘못 올렸다(EVALUATION.md "1-C").
    const input: DepositInput = { mode: "deposit", principal: 1_000_000, annualRatePercent: 23.79, termMonths: 5, interestType: "compound" };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      preTaxInterest: 103_133,
      incomeTax: 14_439,
      localIncomeTax: 1_444,
      afterTaxInterest: 87_250,
      afterTaxMaturityAmount: 1_087_250,
    });
  });

  it("Calculation Auditor 반례 2(High #2) — 원금이 클 때(약 30억원 이상) 소거오차로 원래 버그가 재발하던 문제 해소: 90억원·연3%·2개월", () => {
    // 진짜(유리수) raw는 정확히 45,056,250(정수). 수정 전 구현은 Math.pow(1.0025, 2)의
    // 절대오차가 원금(90억) 곱셈으로 증폭돼 45,056,249로 잘못 절사했다(EVALUATION.md "1-D").
    // (EVALUATION.md 원문이 이 원금과 함께 인용한 raw=50,062,499.999998786은 실제로는 원금
    // 100억원 사례의 값이다 — 아래 별도 테스트로 그 정확한 수치도 함께 고정한다.)
    const input: DepositInput = { mode: "deposit", principal: 9_000_000_000, annualRatePercent: 3, termMonths: 2, interestType: "compound" };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      preTaxInterest: 45_056_250,
      incomeTax: 6_307_875,
      localIncomeTax: 630_788,
      afterTaxInterest: 38_117_587,
      afterTaxMaturityAmount: 9_038_117_587,
    });
  });

  it("Calculation Auditor 반례 2 변형(입력 상한 100억원) — EVALUATION.md가 인용한 raw(50,062,499.999998786)의 정확한 원금 재현: 100억원·연3%·2개월", () => {
    // 진짜(유리수) raw는 정확히 50,062,500(정수). 수정 전 구현은 50,062,499로 잘못 절사했다.
    const input: DepositInput = { mode: "deposit", principal: 10_000_000_000, annualRatePercent: 3, termMonths: 2, interestType: "compound" };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      preTaxInterest: 50_062_500,
      incomeTax: 7_008_750,
      localIncomeTax: 700_875,
      afterTaxInterest: 42_352_875,
      afterTaxMaturityAmount: 10_042_352_875,
    });
  });
});

describe("적금(적립식) 단리 후취식 — calculateSavings / calculateDepositSavingsInterest", () => {
  it("예제 7 — 대표 사례(자체 산출 + 독립 외부 서술 교차검증): 월 50만원·연3%·12개월", () => {
    const input: SavingsInput = { mode: "savings", monthlyContribution: 500_000, annualRatePercent: 3, termMonths: 12 };
    const result = calculateSavings(input);
    expect(result).toMatchObject({
      mode: "savings",
      totalPrincipal: 6_000_000,
      preTaxInterest: 97_500,
      incomeTax: 13_650,
      localIncomeTax: 1_365,
      afterTaxInterest: 82_485,
      afterTaxMaturityAmount: 6_082_485,
    });
    expect(result.schedule).toHaveLength(12);
    expect(calculateDepositSavingsInterest(input)).toEqual(result);
  });

  it("예제 8 — 공식 계산기 대조①(1pic.kr, 반올림 정책의 결정적 근거): 월 50만원·연3.5%·12개월", () => {
    const input: SavingsInput = { mode: "savings", monthlyContribution: 500_000, annualRatePercent: 3.5, termMonths: 12 };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      totalPrincipal: 6_000_000,
      preTaxInterest: 113_750,
      incomeTax: 15_925,
      localIncomeTax: 1_593,
      afterTaxInterest: 96_232,
      afterTaxMaturityAmount: 6_096_232,
    });
  });

  it("예제 9 — 공식 계산기 대조②(jptcalc.kr): 월 10만원·연4%·12개월", () => {
    const input: SavingsInput = { mode: "savings", monthlyContribution: 100_000, annualRatePercent: 4, termMonths: 12 };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      totalPrincipal: 1_200_000,
      preTaxInterest: 26_000,
      incomeTax: 3_640,
      localIncomeTax: 364,
      afterTaxInterest: 21_996,
      afterTaxMaturityAmount: 1_221_996,
    });
  });

  it("예제 10 — 공식 계산기 대조③(jptcalc.kr): 월 100만원·연4%·12개월", () => {
    const input: SavingsInput = { mode: "savings", monthlyContribution: 1_000_000, annualRatePercent: 4, termMonths: 12 };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      totalPrincipal: 12_000_000,
      preTaxInterest: 260_000,
      incomeTax: 36_400,
      localIncomeTax: 3_640,
      afterTaxInterest: 219_960,
      afterTaxMaturityAmount: 12_219_960,
    });
  });

  it("예제 11 — 기간 경계값(1개월): 월 50만원·연3%·1개월", () => {
    const input: SavingsInput = { mode: "savings", monthlyContribution: 500_000, annualRatePercent: 3, termMonths: 1 };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      totalPrincipal: 500_000,
      preTaxInterest: 1_250,
      incomeTax: 175,
      localIncomeTax: 18,
      afterTaxInterest: 1_057,
      afterTaxMaturityAmount: 501_057,
    });
    expect(result.mode === "savings" && result.schedule).toHaveLength(1);
  });

  it("예제 14 — 매우 긴 기간(60개월=5년): 월 20만원·연5%", () => {
    const input: SavingsInput = { mode: "savings", monthlyContribution: 200_000, annualRatePercent: 5, termMonths: 60 };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      totalPrincipal: 12_000_000,
      preTaxInterest: 1_525_000,
      incomeTax: 213_500,
      localIncomeTax: 21_350,
      afterTaxInterest: 1_290_150,
      afterTaxMaturityAmount: 13_290_150,
    });
  });

  it("예제 16 — 연이율 0%(경계값): 월 30만원·6개월", () => {
    const input: SavingsInput = { mode: "savings", monthlyContribution: 300_000, annualRatePercent: 0, termMonths: 6 };
    const result = calculateDepositSavingsInterest(input);
    expect(result).toMatchObject({
      totalPrincipal: 1_800_000,
      preTaxInterest: 0,
      incomeTax: 0,
      localIncomeTax: 0,
      afterTaxInterest: 0,
      afterTaxMaturityAmount: 1_800_000,
    });
  });
});

describe("buildSavingsSchedule — 회차별 breakdown(fencepost 규칙: 잔여개월_i = n-i+1)", () => {
  it("예제 8 조건(월 50만원·연3.5%·12개월)에서 1회차는 12개월분, 마지막 회차는 1개월분 이자를 받는다", () => {
    const schedule = buildSavingsSchedule(500_000, 3.5, 12);
    expect(schedule).toHaveLength(12);
    expect(schedule[0]).toEqual({ installment: 1, contribution: 500_000, remainingMonths: 12, interest: 17_500 });
    expect(schedule[11]).toEqual({ installment: 12, contribution: 500_000, remainingMonths: 1, interest: 1_458 });
  });

  it("각 행의 잔여개월 합계는 등차수열(n부터 1까지)이다", () => {
    const schedule = buildSavingsSchedule(100_000, 4, 5);
    expect(schedule.map((row) => row.remainingMonths)).toEqual([5, 4, 3, 2, 1]);
  });

  // Calculation Auditor 2차 재검증이 실증한 High 결함(행별 반올림이 순수 부동소수점이라
  // 전체 입력 도메인의 약 0.75%에서 정답보다 1원 작게 계산되는 문제,
  // tasks/deposit-savings-interest-calculator/EVALUATION.md "## Calculation Auditor
  // (2차 재검증)" "4-B" 절)을 회귀 방지용 Golden Test로 고정한다. 참값은 정확히 0.5원이고
  // FORMULA.md "계산 순서(적금)" 7단계의 사사오입 정책상 1원이 되어야 한다. 수정 전 구현
  // (`Math.round((10_000 × (0.03/100) × 2) / 12)`)은 부동소수점 표현 오차로 `0`을 반환했다
  // (재현 확인됨) — 현재 구현(BigInt round-half-up)은 `1`을 반환해야 한다.
  it("Calculation Auditor 2차 재검증 반례(High) — 행별 반올림이 부동소수점 오차로 0.5원을 0원으로 잘못 내림하던 문제 해소: 월 10,000원·연0.03%·잔여2개월", () => {
    const schedule = buildSavingsSchedule(10_000, 0.03, 2);
    // 참값: 10,000 × (0.03/100) × 2 / 12 = 0.5원 → 사사오입하면 1원.
    expect(schedule[0]).toEqual({ installment: 1, contribution: 10_000, remainingMonths: 2, interest: 1 });
    // 참값: 10,000 × (0.03/100) × 1 / 12 = 0.25원 → 사사오입하면 0원(타이가 아니므로 영향 없음).
    expect(schedule[1]).toEqual({ installment: 2, contribution: 10_000, remainingMonths: 1, interest: 0 });
  });
});

describe("sumScheduleDisplayInterest — 행별 합계와 preTaxInterest의 근소한 차이(버그 아님)", () => {
  it("예제 8 조건에서 행별 합계를 정확히 재현한다(순수 집계, 재계산 아님)", () => {
    const schedule = buildSavingsSchedule(500_000, 3.5, 12);
    const sum = sumScheduleDisplayInterest(schedule);
    expect(sum).toBe(schedule.reduce((acc, row) => acc + row.interest, 0));
  });
});
