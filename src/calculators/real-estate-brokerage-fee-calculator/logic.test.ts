/**
 * 부동산 중개수수료(중개보수 상한액) 계산기 — Golden Test / Edge Case Test.
 *
 * tasks/real-estate-brokerage-fee-calculator/FORMULA.md "검증 예제"(28개 — 수치 계산 23개 +
 * 오류 케이스 5개)를 tasks/real-estate-brokerage-fee-calculator/ARCHITECTURE.md "11. Golden
 * Test 배치"가 지정한 대로 describe 그룹으로 나눠 배치한다. 입력 검증 실패 케이스(예제
 * 24~28)는 validation.test.ts로 분리한다.
 *
 * **대조 방법(FORMULA.md 원문 그대로)**: 매매·임대차 요율표 수치는 법제처(easylaw.go.kr)·
 * 서울특별시·경기도 3개 독립 정부/지자체 공식 출처가 완전히 일치한다(확인일 2026-09-18).
 * 예제 9(매매 9억원 → 450만원)·17(전세 6억원 → 240만원)은 서울신문(2021-10-19 보도)의
 * 실제 시행 전후 비교 수치와 정확히 일치하는 언론 실사례 대조 케이스다. 예제 23은 nepla.ai가
 * 인용한 법제처 유권해석 사례의 환산보증금 계산값(29,500,000원)과 정확히 일치하는 공식
 * 유권해석 사례 대조 케이스다(최종 세율 적용은 그 사례의 오피스텔 요율이 아니라 이 계산기의
 * 주택 요율표를 따른다 — FORMULA.md 검증 예제 23 참고).
 */

import { describe, expect, it } from "vitest";
import { REAL_ESTATE_BROKERAGE_FEE_POLICY as POLICY } from "./policy";
import {
  calculateConvertedDeposit,
  calculateFeeFromTier,
  calculateLeaseBrokerageFee,
  calculateRealEstateBrokerageFee,
  calculateSaleBrokerageFee,
  findFeeTier,
} from "./logic";
import type { FeeTier } from "./types";

describe("findFeeTier — 매매·임대차 공용 구간 판정, 하한 포함·상한 미포함 경계", () => {
  describe("매매표(POLICY.saleTiers) 5개 경계", () => {
    it("정확히 5천만원 → 2구간(5천만원 이상~2억원 미만) 진입", () => {
      expect(findFeeTier(POLICY.saleTiers, 50_000_000).rate).toBe(0.005);
    });
    it("5천만원 바로 아래(49,999,999) → 1구간 유지", () => {
      expect(findFeeTier(POLICY.saleTiers, 49_999_999).rate).toBe(0.006);
    });
    it("정확히 2억원 → 3구간(2억원 이상~9억원 미만) 진입", () => {
      expect(findFeeTier(POLICY.saleTiers, 200_000_000).rate).toBe(0.004);
    });
    it("2억원 바로 아래(199,999,999) → 2구간 유지", () => {
      expect(findFeeTier(POLICY.saleTiers, 199_999_999).rate).toBe(0.005);
    });
    it("정확히 9억원 → 4구간(9억원 이상~12억원 미만) 진입", () => {
      expect(findFeeTier(POLICY.saleTiers, 900_000_000).rate).toBe(0.005);
    });
    it("9억원 바로 아래(899,999,999) → 3구간 유지", () => {
      expect(findFeeTier(POLICY.saleTiers, 899_999_999).rate).toBe(0.004);
    });
    it("정확히 12억원 → 5구간(12억원 이상~15억원 미만) 진입", () => {
      expect(findFeeTier(POLICY.saleTiers, 1_200_000_000).rate).toBe(0.006);
    });
    it("12억원 바로 아래(1,199,999,999) → 4구간 유지", () => {
      expect(findFeeTier(POLICY.saleTiers, 1_199_999_999).rate).toBe(0.005);
    });
    it("정확히 15억원 → 6구간(최고구간, 상한 없음) 진입", () => {
      const tier = findFeeTier(POLICY.saleTiers, 1_500_000_000);
      expect(tier.rate).toBe(0.007);
      expect(tier.upperBoundExclusive).toBeNull();
    });
    it("15억원 바로 아래(1,499,999,999) → 5구간 유지", () => {
      expect(findFeeTier(POLICY.saleTiers, 1_499_999_999).rate).toBe(0.006);
    });
  });

  describe("임대차표(POLICY.leaseTiers) 5개 경계", () => {
    it("정확히 5천만원 → 2구간(5천만원 이상~1억원 미만) 진입", () => {
      expect(findFeeTier(POLICY.leaseTiers, 50_000_000).rate).toBe(0.004);
    });
    it("5천만원 바로 아래(49,999,999) → 1구간 유지", () => {
      expect(findFeeTier(POLICY.leaseTiers, 49_999_999).rate).toBe(0.005);
    });
    it("정확히 1억원 → 3구간(1억원 이상~6억원 미만) 진입", () => {
      expect(findFeeTier(POLICY.leaseTiers, 100_000_000).rate).toBe(0.003);
    });
    it("1억원 바로 아래(99,999,999) → 2구간 유지", () => {
      expect(findFeeTier(POLICY.leaseTiers, 99_999_999).rate).toBe(0.004);
    });
    it("정확히 6억원 → 4구간(6억원 이상~12억원 미만) 진입", () => {
      expect(findFeeTier(POLICY.leaseTiers, 600_000_000).rate).toBe(0.004);
    });
    it("6억원 바로 아래(599,999,999) → 3구간 유지", () => {
      expect(findFeeTier(POLICY.leaseTiers, 599_999_999).rate).toBe(0.003);
    });
    it("정확히 12억원 → 5구간(12억원 이상~15억원 미만) 진입", () => {
      expect(findFeeTier(POLICY.leaseTiers, 1_200_000_000).rate).toBe(0.005);
    });
    it("12억원 바로 아래(1,199,999,999) → 4구간 유지", () => {
      expect(findFeeTier(POLICY.leaseTiers, 1_199_999_999).rate).toBe(0.004);
    });
    it("정확히 15억원 → 6구간(최고구간, 상한 없음) 진입", () => {
      const tier = findFeeTier(POLICY.leaseTiers, 1_500_000_000);
      expect(tier.rate).toBe(0.006);
      expect(tier.upperBoundExclusive).toBeNull();
    });
    it("15억원 바로 아래(1,499,999,999) → 5구간 유지", () => {
      expect(findFeeTier(POLICY.leaseTiers, 1_499_999_999).rate).toBe(0.005);
    });
  });

  it("어떤 구간에도 매칭되지 않으면 방어적으로 예외를 던진다", () => {
    const emptyTiers: FeeTier[] = [];
    expect(() => findFeeTier(emptyTiers, 1_000_000)).toThrow();
  });
});

describe("calculateConvertedDeposit — 환산보증금 기본 산식·5천만원 미만 예외", () => {
  it("예제 12: 순수 전세(월차임=0) — 예외 무관성, convertedDeposit=보증금 그대로", () => {
    expect(calculateConvertedDeposit(30_000_000, 0)).toEqual({
      convertedDeposit: 30_000_000,
      isLowDepositExceptionApplied: false,
    });
  });

  it("예제 20: 월세, 환산보증금 5천만원 이상 → 예외 미적용", () => {
    expect(calculateConvertedDeposit(10_000_000, 500_000)).toEqual({
      convertedDeposit: 60_000_000,
      isLowDepositExceptionApplied: false,
    });
  });

  it("예제 21: 환산보증금이 정확히 5천만원 → '미만'이 아니므로 예외 미적용", () => {
    expect(calculateConvertedDeposit(10_000_000, 400_000)).toEqual({
      convertedDeposit: 50_000_000,
      isLowDepositExceptionApplied: false,
    });
  });

  it("예제 22: 환산보증금 5천만원 미만 → 예외 적용(×70)", () => {
    expect(calculateConvertedDeposit(9_000_000, 400_000)).toEqual({
      convertedDeposit: 37_000_000,
      isLowDepositExceptionApplied: true,
    });
  });

  it("예제 23: 환산보증금 5천만원 미만 → 예외 적용, 공식 유권해석 사례 환산값(29,500,000원)과 일치", () => {
    expect(calculateConvertedDeposit(5_000_000, 350_000)).toEqual({
      convertedDeposit: 29_500_000,
      isLowDepositExceptionApplied: true,
    });
  });

  it("월차임=0이면 예외 조건(monthlyRent>0)을 만족하지 않아 항상 예외 미적용", () => {
    // raw100 자체는 5천만원 미만이지만 monthlyRent=0이라 예외 조건 미충족.
    expect(calculateConvertedDeposit(10_000_000, 0)).toEqual({
      convertedDeposit: 10_000_000,
      isLowDepositExceptionApplied: false,
    });
  });
});

describe("calculateFeeFromTier — 요율 적용·한도액 비교·반올림 (raw/display 경계 검증)", () => {
  const saleTier1 = POLICY.saleTiers[0]; // 5천만원 미만, rate 0.006, cap 250,000
  const saleTier3 = POLICY.saleTiers[2]; // 2억~9억, rate 0.004, cap null

  it("예제 1: 저가 구간, 한도액 미적용", () => {
    const result = calculateFeeFromTier(30_000_000, saleTier1);
    expect(result).toEqual({ appliedRate: 0.006, isCapApplied: false, maxBrokerageFee: 180_000 });
  });

  it("예제 2: 저가 구간, 한도액 적용", () => {
    const result = calculateFeeFromTier(45_000_000, saleTier1);
    expect(result).toEqual({ appliedRate: 0.006, isCapApplied: true, maxBrokerageFee: 250_000 });
  });

  it("예제 4: 5천만원 바로 아래(49,999,999) — 한도액 적용", () => {
    const result = calculateFeeFromTier(49_999_999, saleTier1);
    expect(result).toEqual({ appliedRate: 0.006, isCapApplied: true, maxBrokerageFee: 250_000 });
  });

  it("예제 8: 9억원 바로 아래(899,999,999) — 한도 없는 구간, 소수점 반올림", () => {
    const result = calculateFeeFromTier(899_999_999, saleTier3);
    expect(result).toEqual({ appliedRate: 0.004, isCapApplied: false, maxBrokerageFee: 3_600_000 });
  });

  it("불변식: appliedRate는 항상 전달된 tier.rate와 같다(드리프트 방지 계약)", () => {
    const result = calculateFeeFromTier(1_000_000, saleTier1);
    expect(result.appliedRate).toBe(saleTier1.rate);
  });
});

describe("calculateSaleBrokerageFee — 매매 모드 오케스트레이션 (Golden Test 예제 1~11)", () => {
  it("예제 1: 30,000,000원", () => {
    const result = calculateSaleBrokerageFee({ transactionType: "sale", salePrice: 30_000_000 });
    expect(result.maxBrokerageFee).toBe(180_000);
    expect(result.isCapApplied).toBe(false);
  });

  it("예제 2: 45,000,000원", () => {
    const result = calculateSaleBrokerageFee({ transactionType: "sale", salePrice: 45_000_000 });
    expect(result.maxBrokerageFee).toBe(250_000);
    expect(result.isCapApplied).toBe(true);
  });

  it("예제 3: 정확히 50,000,000원(경계, 2구간 진입)", () => {
    const result = calculateSaleBrokerageFee({ transactionType: "sale", salePrice: 50_000_000 });
    expect(result.appliedTier.rate).toBe(0.005);
    expect(result.maxBrokerageFee).toBe(250_000);
    expect(result.isCapApplied).toBe(false);
  });

  it("예제 4: 49,999,999원(경계 바로 아래)", () => {
    const result = calculateSaleBrokerageFee({ transactionType: "sale", salePrice: 49_999_999 });
    expect(result.maxBrokerageFee).toBe(250_000);
    expect(result.isCapApplied).toBe(true);
  });

  it("예제 5: 180,000,000원", () => {
    const result = calculateSaleBrokerageFee({ transactionType: "sale", salePrice: 180_000_000 });
    expect(result.maxBrokerageFee).toBe(800_000);
    expect(result.isCapApplied).toBe(true);
  });

  it("예제 6: 100,000,000원", () => {
    const result = calculateSaleBrokerageFee({ transactionType: "sale", salePrice: 100_000_000 });
    expect(result.maxBrokerageFee).toBe(500_000);
    expect(result.isCapApplied).toBe(false);
  });

  it("예제 7: 정확히 200,000,000원(경계, 연속성 확인 — 예제5의 800,000원과 이어짐)", () => {
    const result = calculateSaleBrokerageFee({ transactionType: "sale", salePrice: 200_000_000 });
    expect(result.appliedTier.rate).toBe(0.004);
    expect(result.maxBrokerageFee).toBe(800_000);
  });

  it("예제 8: 899,999,999원", () => {
    const result = calculateSaleBrokerageFee({ transactionType: "sale", salePrice: 899_999_999 });
    expect(result.maxBrokerageFee).toBe(3_600_000);
  });

  it("예제 9: 정확히 900,000,000원 — 서울신문 실사례 대조(9억원 매매 중개보수 450만원)", () => {
    const result = calculateSaleBrokerageFee({ transactionType: "sale", salePrice: 900_000_000 });
    expect(result.appliedTier.rate).toBe(0.005);
    expect(result.maxBrokerageFee).toBe(4_500_000);
  });

  it("예제 10: 정확히 1,200,000,000원", () => {
    const result = calculateSaleBrokerageFee({
      transactionType: "sale",
      salePrice: 1_200_000_000,
    });
    expect(result.appliedTier.rate).toBe(0.006);
    expect(result.maxBrokerageFee).toBe(7_200_000);
  });

  it("예제 11: 정확히 1,500,000,000원(최고구간)", () => {
    const result = calculateSaleBrokerageFee({
      transactionType: "sale",
      salePrice: 1_500_000_000,
    });
    expect(result.appliedTier.rate).toBe(0.007);
    expect(result.appliedTier.upperBoundExclusive).toBeNull();
    expect(result.maxBrokerageFee).toBe(10_500_000);
  });
});

describe("calculateLeaseBrokerageFee — 임대차 모드(순수 전세, Golden Test 예제 12~19)", () => {
  it("예제 12: 30,000,000원, 월차임 0", () => {
    const result = calculateLeaseBrokerageFee({
      transactionType: "lease",
      deposit: 30_000_000,
      monthlyRent: 0,
    });
    expect(result.convertedDeposit).toBe(30_000_000);
    expect(result.isLowDepositExceptionApplied).toBe(false);
    expect(result.maxBrokerageFee).toBe(150_000);
  });

  it("예제 13: 49,999,999원, 월차임 0", () => {
    const result = calculateLeaseBrokerageFee({
      transactionType: "lease",
      deposit: 49_999_999,
      monthlyRent: 0,
    });
    expect(result.maxBrokerageFee).toBe(200_000);
  });

  it("예제 14: 정확히 50,000,000원(경계, 연속성 확인)", () => {
    const result = calculateLeaseBrokerageFee({
      transactionType: "lease",
      deposit: 50_000_000,
      monthlyRent: 0,
    });
    expect(result.appliedTier.rate).toBe(0.004);
    expect(result.maxBrokerageFee).toBe(200_000);
  });

  it("예제 15: 80,000,000원, 월차임 0", () => {
    const result = calculateLeaseBrokerageFee({
      transactionType: "lease",
      deposit: 80_000_000,
      monthlyRent: 0,
    });
    expect(result.maxBrokerageFee).toBe(300_000);
  });

  it("예제 16: 정확히 100,000,000원(경계, 연속성 확인)", () => {
    const result = calculateLeaseBrokerageFee({
      transactionType: "lease",
      deposit: 100_000_000,
      monthlyRent: 0,
    });
    expect(result.appliedTier.rate).toBe(0.003);
    expect(result.maxBrokerageFee).toBe(300_000);
  });

  it("예제 17: 정확히 600,000,000원 — 서울신문 실사례 대조(전세 6억원 240만원)", () => {
    const result = calculateLeaseBrokerageFee({
      transactionType: "lease",
      deposit: 600_000_000,
      monthlyRent: 0,
    });
    expect(result.appliedTier.rate).toBe(0.004);
    expect(result.maxBrokerageFee).toBe(2_400_000);
  });

  it("예제 18: 정확히 1,200,000,000원", () => {
    const result = calculateLeaseBrokerageFee({
      transactionType: "lease",
      deposit: 1_200_000_000,
      monthlyRent: 0,
    });
    expect(result.appliedTier.rate).toBe(0.005);
    expect(result.maxBrokerageFee).toBe(6_000_000);
  });

  it("예제 19: 정확히 1,500,000,000원(최고구간)", () => {
    const result = calculateLeaseBrokerageFee({
      transactionType: "lease",
      deposit: 1_500_000_000,
      monthlyRent: 0,
    });
    expect(result.appliedTier.rate).toBe(0.006);
    expect(result.appliedTier.upperBoundExclusive).toBeNull();
    expect(result.maxBrokerageFee).toBe(9_000_000);
  });
});

describe("calculateLeaseBrokerageFee — 월세(환산보증금 계산 필요, Golden Test 예제 20~23)", () => {
  it("예제 20: 환산보증금 5천만원 이상(예외 미적용)", () => {
    const result = calculateLeaseBrokerageFee({
      transactionType: "lease",
      deposit: 10_000_000,
      monthlyRent: 500_000,
    });
    expect(result.convertedDeposit).toBe(60_000_000);
    expect(result.isLowDepositExceptionApplied).toBe(false);
    expect(result.maxBrokerageFee).toBe(240_000);
  });

  it("예제 21: 환산보증금이 정확히 5천만원(예외 미적용 경계)", () => {
    const result = calculateLeaseBrokerageFee({
      transactionType: "lease",
      deposit: 10_000_000,
      monthlyRent: 400_000,
    });
    expect(result.convertedDeposit).toBe(50_000_000);
    expect(result.isLowDepositExceptionApplied).toBe(false);
    expect(result.maxBrokerageFee).toBe(200_000);
  });

  it("예제 22: 환산보증금 5천만원 미만(예외 적용)", () => {
    const result = calculateLeaseBrokerageFee({
      transactionType: "lease",
      deposit: 9_000_000,
      monthlyRent: 400_000,
    });
    expect(result.convertedDeposit).toBe(37_000_000);
    expect(result.isLowDepositExceptionApplied).toBe(true);
    expect(result.maxBrokerageFee).toBe(185_000);
  });

  it("예제 23: 환산보증금 5천만원 미만(예외 적용) — 공식 유권해석 사례 환산값 대조", () => {
    const result = calculateLeaseBrokerageFee({
      transactionType: "lease",
      deposit: 5_000_000,
      monthlyRent: 350_000,
    });
    expect(result.convertedDeposit).toBe(29_500_000);
    expect(result.isLowDepositExceptionApplied).toBe(true);
    expect(result.maxBrokerageFee).toBe(147_500);
  });
});

describe("calculateRealEstateBrokerageFee — 오케스트레이터(End-to-End, 언론·유권해석 대조)", () => {
  it("예제 9(매매 9억원, 서울신문 실사례 대조)를 오케스트레이터로 재확인", () => {
    const result = calculateRealEstateBrokerageFee({
      transactionType: "sale",
      salePrice: 900_000_000,
    });
    expect(result.transactionType).toBe("sale");
    expect(result.maxBrokerageFee).toBe(4_500_000);
  });

  it("예제 17(전세 6억원, 서울신문 실사례 대조)를 오케스트레이터로 재확인", () => {
    const result = calculateRealEstateBrokerageFee({
      transactionType: "lease",
      deposit: 600_000_000,
      monthlyRent: 0,
    });
    expect(result.transactionType).toBe("lease");
    if (result.transactionType === "lease") {
      expect(result.convertedDeposit).toBe(600_000_000);
    }
    expect(result.maxBrokerageFee).toBe(2_400_000);
  });

  it("예제 23(공식 유권해석 사례 환산값 대조)를 오케스트레이터로 재확인", () => {
    const result = calculateRealEstateBrokerageFee({
      transactionType: "lease",
      deposit: 5_000_000,
      monthlyRent: 350_000,
    });
    expect(result.transactionType).toBe("lease");
    if (result.transactionType === "lease") {
      expect(result.convertedDeposit).toBe(29_500_000);
      expect(result.isLowDepositExceptionApplied).toBe(true);
    }
    expect(result.maxBrokerageFee).toBe(147_500);
  });

  it("findFeeTier/calculateFeeFromTier가 매매·임대차 양쪽에서 실제로 재사용됨을 확인 — " +
    "같은 baseAmount·rate 조합이면 매매 함수와 공용 함수 직접 호출 결과가 완전히 같다", () => {
    const baseAmount = 900_000_000;
    const tier = findFeeTier(POLICY.saleTiers, baseAmount);
    const direct = calculateFeeFromTier(baseAmount, tier);
    const viaOrchestrator = calculateSaleBrokerageFee({
      transactionType: "sale",
      salePrice: baseAmount,
    });
    expect(viaOrchestrator.appliedRate).toBe(direct.appliedRate);
    expect(viaOrchestrator.isCapApplied).toBe(direct.isCapApplied);
    expect(viaOrchestrator.maxBrokerageFee).toBe(direct.maxBrokerageFee);
  });
});
