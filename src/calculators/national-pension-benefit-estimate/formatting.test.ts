/**
 * 국민연금 예상수령액 계산기 — 표시용 포맷팅 테스트.
 */

import { describe, expect, it } from "vitest";
import type {
  NationalPensionBenefitEligibleResult,
  NationalPensionBenefitFormInput,
} from "./types";
import {
  EARLY_OR_DEFERRED_OPTIONS,
  buildBValueClampNotice,
  buildCalculationSteps,
  formatAge,
  formatContributionAdjustmentFactor,
  formatContributionPeriod,
  formatMonths,
  formatProportionalConstant,
  formatSignedRate,
  formatWon,
  formatYear,
} from "./formatting";

describe("기본 포맷터", () => {
  it("formatWon", () => {
    expect(formatWon(1_234_567)).toBe("1,234,567원");
    expect(formatWon(665_802.4325)).toBe("665,802원"); // 표시 시 반올림
  });

  it("formatAge / formatYear / formatMonths", () => {
    expect(formatAge(65)).toBe("65세");
    expect(formatYear(2026)).toBe("2026년");
    expect(formatMonths(300)).toBe("300개월");
  });

  it("formatContributionPeriod", () => {
    expect(formatContributionPeriod(300)).toBe("25년 0개월(총 300개월)");
    expect(formatContributionPeriod(125)).toBe("10년 5개월(총 125개월)");
  });

  it("formatProportionalConstant", () => {
    expect(formatProportionalConstant(1.29)).toBe("1.29");
  });

  it("formatContributionAdjustmentFactor", () => {
    expect(formatContributionAdjustmentFactor(1)).toBe("100.0%");
    expect(formatContributionAdjustmentFactor(0.5)).toBe("50.0%");
    expect(formatContributionAdjustmentFactor(2)).toBe("200.0%");
  });

  it("formatSignedRate", () => {
    expect(formatSignedRate(-0.3)).toBe("-30.0%");
    expect(formatSignedRate(0.36)).toBe("+36.0%");
    expect(formatSignedRate(0)).toBe("0.0%");
  });
});

describe("EARLY_OR_DEFERRED_OPTIONS — 11개 옵션, FORMULA.md '7.' 수치와 일치", () => {
  it("총 11개 옵션을 -60~60(12의 배수) 오름차순으로 갖는다", () => {
    expect(EARLY_OR_DEFERRED_OPTIONS).toHaveLength(11);
    expect(EARLY_OR_DEFERRED_OPTIONS.map((o) => o.value)).toEqual([
      -60, -48, -36, -24, -12, 0, 12, 24, 36, 48, 60,
    ]);
  });

  it("최대 조기(-60개월) 라벨에 -30.0%가, 최대 연기(+60개월) 라벨에 +36.0%가 표시된다", () => {
    const maxEarly = EARLY_OR_DEFERRED_OPTIONS.find((o) => o.value === -60);
    const maxDeferred = EARLY_OR_DEFERRED_OPTIONS.find((o) => o.value === 60);
    expect(maxEarly?.label).toContain("-30.0%");
    expect(maxDeferred?.label).toContain("+36.0%");
  });

  it("0개월 옵션은 '그대로'로 표시된다", () => {
    const none = EARLY_OR_DEFERRED_OPTIONS.find((o) => o.value === 0);
    expect(none?.label).toBe("그대로(법정 수급개시연령)");
  });

  // [2026-09-13 Optimizer 추가] QA.md "select 최장 라벨이 320px에서만 잘림" — 라벨을
  // 축약한 뒤 가장 긴 라벨도 QA가 실측한 표시 가능 폭(약 19자)보다 짧아야 한다.
  it("모든 라벨이 15자 이내로 축약되어 320px에서 잘리지 않는다(QA 실측 표시 가능 폭 약 19자)", () => {
    for (const option of EARLY_OR_DEFERRED_OPTIONS) {
      expect(option.label.length).toBeLessThanOrEqual(15);
    }
  });

  it("축약된 라벨은 '앞당김'/'연기'로 표시되고, 이전의 긴 표현('앞당겨 받기' 등)을 쓰지 않는다", () => {
    const maxEarly = EARLY_OR_DEFERRED_OPTIONS.find((o) => o.value === -60);
    const maxDeferred = EARLY_OR_DEFERRED_OPTIONS.find((o) => o.value === 60);
    expect(maxEarly?.label).toBe("5년 앞당김(-30.0%)");
    expect(maxDeferred?.label).toBe("5년 연기(+36.0%)");
    for (const option of EARLY_OR_DEFERRED_OPTIONS) {
      expect(option.label).not.toContain("받기");
    }
  });
});

describe("buildCalculationSteps — 실제 대입값이 수식 문자열에 그대로 노출된다(2026-09-13 Optimizer 추가)", () => {
  // Golden Test 예제 2(240개월, 평균소득 300만원)와 동일한 조건.
  const input: NationalPensionBenefitFormInput = {
    birthYear: 1965,
    totalContributionMonths: 240,
    averageMonthlyIncome: 3_000_000,
    earlyOrDeferredMonths: 0,
  };
  const baseResult: NationalPensionBenefitEligibleResult = {
    eligible: true,
    pensionableAge: 65,
    pensionableYear: 2030,
    aValue: 3_193_511,
    bValueApprox: 3_000_000,
    bValueClamped: false,
    proportionalConstant: 1.29,
    contributionAdjustmentFactor: 1,
    basicPensionMonthly: 665_800,
    earlyOrDeferredMonths: 0,
    earlyOrDeferredAdjustmentRate: undefined,
    adjustedPensionMonthly: undefined,
  };

  it("4단계에 비례상수·A값·B값·보정계수·절사 전/후 금액이 실제 숫자로 대입된다", () => {
    const steps = buildCalculationSteps(input, baseResult);
    const step4 = steps.find((s) => s.label.startsWith("4."));
    expect(step4?.expression).toBe(
      "1.29 × (3,193,511원 + 3,000,000원) × 100.0% ÷ 12 = 665,802원(절사 전) → 665,800원",
    );
    // 더 이상 변수 기호만 나열하지 않는다(회귀 방지).
    expect(step4?.expression).not.toContain("A값 + B값근사");
    expect(step4?.expression).not.toContain("비례상수 × ");
  });

  it("5단계(조기/연기 조정)도 절사 전 완전정밀도 값을 실제 숫자로 대입한다(예제 13, -60개월)", () => {
    const result: NationalPensionBenefitEligibleResult = {
      ...baseResult,
      earlyOrDeferredMonths: -60,
      earlyOrDeferredAdjustmentRate: -0.3,
      adjustedPensionMonthly: 466_060,
    };
    const steps = buildCalculationSteps(
      { ...input, earlyOrDeferredMonths: -60 },
      result,
    );
    const step5 = steps.find((s) => s.label.startsWith("5."));
    expect(step5?.expression).toBe(
      "기본연금액(절사 전 완전정밀도) 665,802원 × (1 -30.0%) = 466,062원(절사 전) → 466,060원",
    );
  });
});

describe("buildBValueClampNotice", () => {
  it("clamp가 없으면 null을 반환한다", () => {
    expect(
      buildBValueClampNotice(3_000_000, { bValueApprox: 3_000_000, bValueClamped: false }),
    ).toBeNull();
  });

  it("상한 초과로 clamp되면 '상한을 초과' 문구를 반환한다", () => {
    const notice = buildBValueClampNotice(8_000_000, {
      bValueApprox: 6_590_000,
      bValueClamped: true,
    });
    expect(notice).toContain("상한을 초과");
    expect(notice).toContain("6,590,000원");
  });

  it("하한 미달로 clamp되면 '하한에 못 미쳐' 문구를 반환한다", () => {
    const notice = buildBValueClampNotice(300_000, {
      bValueApprox: 410_000,
      bValueClamped: true,
    });
    expect(notice).toContain("하한에 못 미쳐");
    expect(notice).toContain("410,000원");
  });
});
