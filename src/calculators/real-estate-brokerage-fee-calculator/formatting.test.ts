/**
 * 부동산 중개수수료(중개보수 상한액) 계산기 — 표시 포맷팅 테스트.
 *
 * 이 파일은 계산 정확성(Golden Test)이 아니라 문자열 조립이 의도한 대로 되는지만
 * 확인한다(logic.test.ts와 역할 분리, docs/ARCHITECTURE.md "계산 로직 / UI 분리").
 */

import { describe, expect, it } from "vitest";
import {
  describeCapComparison,
  describeConvertedDepositCalculation,
  formatPercent,
  formatRateAppliedAmountForDisplay,
  formatTierRangeLabel,
  formatWon,
} from "./formatting";
import { calculateLeaseBrokerageFee } from "./logic";
import type { FeeTier } from "./types";

describe("formatWon / formatPercent", () => {
  it("formatWon: 천 단위 콤마와 '원' 접미사를 붙인다", () => {
    expect(formatWon(4_500_000)).toBe("4,500,000원");
  });

  it("formatPercent: 0.005 → '0.5%'", () => {
    expect(formatPercent(0.005)).toBe("0.5%");
  });

  it("formatPercent: 0.006 → '0.6%'", () => {
    expect(formatPercent(0.006)).toBe("0.6%");
  });
});

describe("formatTierRangeLabel", () => {
  it("최저 구간(하한 0)은 '~미만'만 표시하고 '0원 이상'을 생략한다", () => {
    const tier: FeeTier = { lowerBoundInclusive: 0, upperBoundExclusive: 50_000_000, rate: 0.006, cap: 250_000 };
    expect(formatTierRangeLabel(tier)).toBe("50,000,000원 미만");
  });

  it("중간 구간은 'OO원 이상 ~ OO원 미만'으로 표시한다", () => {
    const tier: FeeTier = {
      lowerBoundInclusive: 50_000_000,
      upperBoundExclusive: 200_000_000,
      rate: 0.005,
      cap: 800_000,
    };
    expect(formatTierRangeLabel(tier)).toBe("50,000,000원 이상 ~ 200,000,000원 미만");
  });

  it("최고 구간(상한 없음)은 'OO원 이상'만 표시한다", () => {
    const tier: FeeTier = {
      lowerBoundInclusive: 1_500_000_000,
      upperBoundExclusive: null,
      rate: 0.007,
      cap: null,
    };
    expect(formatTierRangeLabel(tier)).toBe("1,500,000,000원 이상");
  });
});

describe("formatRateAppliedAmountForDisplay — 표시 전용 재계산(ARCHITECTURE.md '4.2')", () => {
  it("baseAmount × appliedRate를 반올림해 원 단위로 표시한다", () => {
    expect(formatRateAppliedAmountForDisplay(45_000_000, 0.006)).toBe("270,000원");
  });

  it("소수점이 남는 경우도 원 단위로 반올림해 표시한다", () => {
    // 899,999,999 × 0.004 = 3,599,999.996 → 반올림 3,600,000
    expect(formatRateAppliedAmountForDisplay(899_999_999, 0.004)).toBe("3,600,000원");
  });
});

describe("describeCapComparison", () => {
  const tierWithCap: FeeTier = {
    lowerBoundInclusive: 0,
    upperBoundExclusive: 50_000_000,
    rate: 0.006,
    cap: 250_000,
  };
  const tierWithoutCap: FeeTier = {
    lowerBoundInclusive: 200_000_000,
    upperBoundExclusive: 900_000_000,
    rate: 0.004,
    cap: null,
  };

  it("한도액이 없는 구간은 null을 반환한다(줄 자체 생략)", () => {
    expect(describeCapComparison(tierWithoutCap, false)).toBeNull();
  });

  it("한도액이 적용된 경우 문구를 반환한다", () => {
    expect(describeCapComparison(tierWithCap, true)).toBe(
      "한도액 250,000원과 비교 → 한도액이 더 낮아 한도액이 적용됩니다.",
    );
  });

  it("한도액이 있지만 적용되지 않은 경우 문구를 반환한다", () => {
    expect(describeCapComparison(tierWithCap, false)).toBe(
      "한도액 250,000원과 비교 → 요율 적용 금액이 한도액 이내라 그대로 적용됩니다.",
    );
  });
});

describe("describeConvertedDepositCalculation", () => {
  it("예외 미적용 케이스(순수 전세)는 기본 산식 결과가 최종값임을 설명한다", () => {
    const input = { transactionType: "lease" as const, deposit: 30_000_000, monthlyRent: 0 };
    const result = calculateLeaseBrokerageFee(input);
    const lines = describeConvertedDepositCalculation(input, result);
    expect(lines[0]).toBe("보증금 30,000,000원 + 월차임 0원 × 100 = 30,000,000원");
    expect(lines[1]).toContain("그대로 최종 환산보증금");
  });

  it("예외 적용 케이스는 70배 산식과 최종 환산보증금을 설명한다", () => {
    const input = { transactionType: "lease" as const, deposit: 9_000_000, monthlyRent: 400_000 };
    const result = calculateLeaseBrokerageFee(input);
    const lines = describeConvertedDepositCalculation(input, result);
    expect(lines[0]).toBe("보증금 9,000,000원 + 월차임 400,000원 × 100 = 49,000,000원");
    expect(lines[1]).toContain("70을 곱하는 예외");
    expect(lines[1]).toContain("37,000,000원");
  });
});
