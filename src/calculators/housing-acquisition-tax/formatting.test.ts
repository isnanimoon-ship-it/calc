import { describe, expect, it } from "vitest";
import {
  buildTaxCalculationBreakdown,
  describeAppliedRateBasis,
  formatArea,
  formatPercent,
  formatWon,
  formatWonInKoreanUnits,
  formatWonPrecise,
  HOUSE_COUNT_LABELS,
  PRICE_TIER_LABELS,
} from "./formatting";
import { calculateHousingAcquisitionTax } from "./logic";
import type { HousingAcquisitionTaxFormInput } from "./types";

describe("formatWon / formatWonPrecise / formatPercent / formatArea", () => {
  it("formatWon: 천 단위 콤마 + '원'", () => {
    expect(formatWon(3_333_330)).toBe("3,333,330원");
    expect(formatWon(0)).toBe("0원");
  });

  it("formatWonPrecise: 절사 전 소수 금액도 표시한다", () => {
    expect(formatWonPrecise(3_333_333.33)).toBe("3,333,333.33원");
  });

  it("formatPercent: mid 구간처럼 4자리까지 남는 세율도 정확히 표시한다", () => {
    expect(formatPercent(0.0133)).toBe("1.33%");
    expect(formatPercent(0.0233)).toBe("2.33%");
    expect(formatPercent(0.01)).toBe("1%");
    expect(formatPercent(0.08)).toBe("8%");
    expect(formatPercent(0.12)).toBe("12%");
  });

  it("formatArea: ㎡ 단위 표시", () => {
    expect(formatArea(59)).toBe("59㎡");
    expect(formatArea(84.9)).toBe("84.9㎡");
  });
});

describe("formatWonInKoreanUnits(UX/UI Critic Q7 — 자릿수 실시간 환산 보조 텍스트)", () => {
  it("억+만 단위가 모두 있으면 둘 다 표시한다", () => {
    expect(formatWonInKoreanUnits(650_000_000)).toBe("6억 5,000만원");
    expect(formatWonInKoreanUnits(750_000_000)).toBe("7억 5,000만원");
  });

  it("만 단위가 0이면 억만 표시한다", () => {
    expect(formatWonInKoreanUnits(800_000_000)).toBe("8억원");
  });

  it("억 단위가 0이면 만 단위만 표시한다 — 자릿수(0 하나) 누락을 알아챌 수 있어야 한다", () => {
    // 6억5천만원을 6,500만원으로 잘못 입력한 경우(자릿수 하나 누락) 사용자가 즉시 알아챌 수 있다.
    expect(formatWonInKoreanUnits(65_000_000)).toBe("6,500만원");
  });

  it("취득가액 하한(100만원)·상한(1,000억원) 경계값도 올바르게 표시한다", () => {
    expect(formatWonInKoreanUnits(1_000_000)).toBe("100만원");
    expect(formatWonInKoreanUnits(100_000_000_000)).toBe("1,000억원");
  });

  it("0 이하이거나 유한하지 않은 값은 빈 문자열을 반환한다(입력 전 상태 방어)", () => {
    expect(formatWonInKoreanUnits(0)).toBe("");
    expect(formatWonInKoreanUnits(-1)).toBe("");
    expect(formatWonInKoreanUnits(NaN)).toBe("");
  });
});

describe("PRICE_TIER_LABELS / HOUSE_COUNT_LABELS", () => {
  it("가격 구간 3종 라벨이 모두 존재한다", () => {
    expect(PRICE_TIER_LABELS.low).toBe("6억원 이하");
    expect(PRICE_TIER_LABELS.mid).toBe("6억원 초과 ~ 9억원 이하");
    expect(PRICE_TIER_LABELS.high).toBe("9억원 초과");
  });

  it("보유 주택 수 4구간 라벨이 모두 존재하고 '3채 이상'으로 뭉뚱그리지 않는다", () => {
    expect(HOUSE_COUNT_LABELS[1]).toBe("1채");
    expect(HOUSE_COUNT_LABELS[2]).toBe("2채");
    expect(HOUSE_COUNT_LABELS[3]).toBe("3채");
    expect(HOUSE_COUNT_LABELS[4]).toBe("4채 이상");
  });
});

describe("describeAppliedRateBasis", () => {
  it("표준세율 케이스는 '중과 대상 아님'을 설명한다", () => {
    const input: HousingAcquisitionTaxFormInput = {
      acquisitionPrice: 500_000_000,
      exclusiveArea: 59,
      isAdjustmentTargetArea: false,
      houseCountAfterAcquisition: 2,
    };
    const result = calculateHousingAcquisitionTax(input);
    expect(describeAppliedRateBasis(input, result)).toContain("중과 대상이 아니라");
  });

  it("중과세율 케이스는 조합과 적용 세율을 설명한다", () => {
    const input: HousingAcquisitionTaxFormInput = {
      acquisitionPrice: 500_000_000,
      exclusiveArea: 100,
      isAdjustmentTargetArea: true,
      houseCountAfterAcquisition: 2,
    };
    const result = calculateHousingAcquisitionTax(input);
    const description = describeAppliedRateBasis(input, result);
    expect(description).toContain("규제지역(조정대상지역)");
    expect(description).toContain("2채");
    expect(description).toContain("8%");
  });
});

describe("buildTaxCalculationBreakdown", () => {
  it("표준세율(mid 구간) 케이스 — 예제4(6.5억원, 59㎡, 비조정·1주택)와 정확히 일치한다", () => {
    const input: HousingAcquisitionTaxFormInput = {
      acquisitionPrice: 650_000_000,
      exclusiveArea: 59,
      isAdjustmentTargetArea: false,
      houseCountAfterAcquisition: 1,
    };
    const result = calculateHousingAcquisitionTax(input);
    const rows = buildTaxCalculationBreakdown(input, result);

    expect(rows).toHaveLength(3);
    expect(rows[0].label).toBe("취득세");
    expect(rows[0].expression).toContain("650,000,000원");
    expect(rows[0].expression).toContain("1.33%");
    expect(rows[0].expression).toContain("8,645,000원");
    expect(rows[1].label).toBe("지방교육세");
    expect(rows[1].expression).toContain("864,500원");
    expect(rows[2].label).toBe("농어촌특별세");
    expect(rows[2].expression).toContain("비과세");
  });

  it(
    "예제17(333,333,333원, 59㎡) — 절사 전 raw(3,333,333.33원)가 화면에 그대로 보이고, " +
      "절사 후 값(3,333,330원)과 다르다는 것을 확인한다(raw→절사 과정 노출 요건)",
    () => {
      const input: HousingAcquisitionTaxFormInput = {
        acquisitionPrice: 333_333_333,
        exclusiveArea: 59,
        isAdjustmentTargetArea: false,
        houseCountAfterAcquisition: 1,
      };
      const result = calculateHousingAcquisitionTax(input);
      const rows = buildTaxCalculationBreakdown(input, result);

      expect(rows[0].expression).toContain("3,333,333.33원");
      expect(rows[0].expression).toContain("3,333,330원");
      expect(result.acquisitionTax).toBe(3_333_330);
    },
  );

  it("중과세율(8%) 케이스 — 지방교육세는 취득가액 × 0.4% 고정 문구를 보여준다", () => {
    const input: HousingAcquisitionTaxFormInput = {
      acquisitionPrice: 500_000_000,
      exclusiveArea: 100,
      isAdjustmentTargetArea: true,
      houseCountAfterAcquisition: 2,
    };
    const result = calculateHousingAcquisitionTax(input);
    const rows = buildTaxCalculationBreakdown(input, result);

    expect(rows[1].expression).toContain("0.4%");
    expect(rows[1].expression).toContain("2,000,000원");
    expect(rows[2].expression).toContain("3,000,000원");
  });

  it("농어촌특별세 비과세 케이스는 세율 계산식 없이 비과세 사유만 보여준다", () => {
    const input: HousingAcquisitionTaxFormInput = {
      acquisitionPrice: 500_000_000,
      exclusiveArea: 85,
      isAdjustmentTargetArea: false,
      houseCountAfterAcquisition: 1,
    };
    const result = calculateHousingAcquisitionTax(input);
    const rows = buildTaxCalculationBreakdown(input, result);
    expect(rows[2].expression).toBe("전용면적 85㎡ 이하 — 국민주택규모 비과세 요건 충족, 0원");
  });
});
