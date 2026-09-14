/**
 * 주택 취득세 계산기 — Golden Test / Edge Case Test.
 *
 * tasks/housing-acquisition-tax/FORMULA.md "검증 예제"(17개)를
 * tasks/housing-acquisition-tax/ARCHITECTURE.md "10. Golden Test 배치 전략"이 지정한 대로
 * describe 그룹으로 나눠 배치한다. 입력 검증 실패 케이스는 validation.test.ts로 분리한다.
 *
 * **대조 방법(FORMULA.md 원문 그대로)**: 이 계산기는 세션 제약상 wetax.go.kr 등 실제 계산기에
 * 대화형으로 값을 입력해 서버 응답을 받지 못했다 — 아래 예제는 법령 산식(지방세법 제11조·
 * 제13조의2·제151조, 농어촌특별세법 제5조)을 Formula Analyst가 직접 대입해 계산한 값이며,
 * 예제 12·14는 그 결과(총부담률 9.0%/13.4%)가 한국 부동산 세금 설명 자료에서 반복 인용되는
 * 벤치마크와 일치함을 최소 3개의 독립 검색 결과로 교차 확인했다(FORMULA.md 참고). Calculation
 * Auditor가 wetax.go.kr 등과 최소 1건 이상 직접 대조할 것을 권고한다(policy.ts `rounding`,
 * `HOUSING_ACQUISITION_TAX_OPEN_QUESTIONS` 참고).
 */

import { describe, expect, it } from "vitest";
import { HOUSING_ACQUISITION_TAX_POLICY as POLICY } from "./policy";
import {
  calculateHousingAcquisitionTax,
  calculateTaxAmounts,
  determineAppliedRate,
  determineStandardRate,
} from "./logic";
import type { HouseCountAfterAcquisition } from "./types";

describe("determineStandardRate — 가격 구간 경계 및 6~9억 구간 반올림 (Golden Test #3~6, #16)", () => {
  it("#3: 정확히 6억원 → low 유지, 표준세율 1%(가목 경계, '이하'에 포함)", () => {
    expect(determineStandardRate(600_000_000)).toEqual({
      priceTier: "low",
      standardRate: 0.01,
    });
  });

  it("#4: 6.5억원 → mid, 0.0133 (ARCHITECTURE.md '2.' 반올림 정정의 핵심 회귀 테스트)", () => {
    expect(determineStandardRate(650_000_000)).toEqual({
      priceTier: "mid",
      standardRate: 0.0133,
    });
  });

  it("#5: 정확히 9억원 → mid 산식 적용(산출값은 다목과 동일 0.03이지만 근거는 나목)", () => {
    expect(determineStandardRate(900_000_000)).toEqual({
      priceTier: "mid",
      standardRate: 0.03,
    });
  });

  it("#6: 9.5억원 → high, 0.03 고정", () => {
    expect(determineStandardRate(950_000_000)).toEqual({
      priceTier: "high",
      standardRate: 0.03,
    });
  });

  it("#16: 8억원 → mid, 0.0233 (ARCHITECTURE.md '2.'의 두 번째 회귀 테스트)", () => {
    expect(determineStandardRate(800_000_000)).toEqual({
      priceTier: "mid",
      standardRate: 0.0233,
    });
  });

  it("경계 완전성 보강: 599,999,999원은 low 유지", () => {
    expect(determineStandardRate(599_999_999).priceTier).toBe("low");
  });

  it("경계 완전성 보강: 600,000,001원은 mid 진입", () => {
    expect(determineStandardRate(600_000_001).priceTier).toBe("mid");
  });

  it("경계 완전성 보강: 899,999,999원은 mid 유지", () => {
    expect(determineStandardRate(899_999_999).priceTier).toBe("mid");
  });

  it("경계 완전성 보강: 900,000,001원은 high 진입", () => {
    expect(determineStandardRate(900_000_001).priceTier).toBe("high");
  });
});

describe("determineAppliedRate — 다주택자·조정대상지역 중과세율표 8행 전체 (Golden Test #9~15)", () => {
  it("policy.ts heavyRate.rows 8행 전체를 이 함수로 스윕해 1:1 일치를 확인한다(완료 기준 불변식)", () => {
    for (const row of POLICY.heavyRate.rows) {
      const dummyStandardRate = 0.01; // rate===null 분기에서 표준세율 통과 여부만 확인하는 더미값
      const result = determineAppliedRate(
        row.isAdjustmentTargetArea,
        row.houseCount,
        dummyStandardRate,
      );
      if (row.rate === null) {
        expect(result).toEqual({ isHeavyRateApplied: false, appliedRate: dummyStandardRate });
      } else {
        expect(result).toEqual({ isHeavyRateApplied: true, appliedRate: row.rate });
      }
    }
  });

  it("#9: 조정·1주택 → 표준세율(조정 여부 무관 재확인)", () => {
    expect(determineAppliedRate(true, 1, 0.01)).toEqual({
      isHeavyRateApplied: false,
      appliedRate: 0.01,
    });
  });

  it("#10: 비조정·2주택 → 표준세율(중과 아님)", () => {
    expect(determineAppliedRate(false, 2, 0.01)).toEqual({
      isHeavyRateApplied: false,
      appliedRate: 0.01,
    });
  });

  it("#11: 비조정·3주택 → 8% 중과", () => {
    expect(determineAppliedRate(false, 3, 0.01)).toEqual({
      isHeavyRateApplied: true,
      appliedRate: 0.08,
    });
  });

  it("#12: 조정·2주택 → 8% 중과(예제11과 값이 완전히 같아야 함)", () => {
    expect(determineAppliedRate(true, 2, 0.01)).toEqual(determineAppliedRate(false, 3, 0.01));
  });

  it("#13: 비조정·4채 이상 → 12% 중과(4구간 설계의 존재 이유를 증명하는 핵심 회귀 테스트)", () => {
    expect(determineAppliedRate(false, 4, 0.01)).toEqual({
      isHeavyRateApplied: true,
      appliedRate: 0.12,
    });
  });

  it("#14: 조정·3주택 → 12% 중과(예제13의 '4채 이상' 결과와 완전히 동일해야 함)", () => {
    expect(determineAppliedRate(true, 3, 0.01)).toEqual(determineAppliedRate(false, 4, 0.01));
  });

  it("#14 보강: 조정·4채 이상도 동일하게 12% 중과", () => {
    expect(determineAppliedRate(true, 4, 0.01)).toEqual({
      isHeavyRateApplied: true,
      appliedRate: 0.12,
    });
  });
});

describe("calculateTaxAmounts — 세목별 계산·85㎡ 비과세 경계·10원 미만 절사 (Golden Test #1~2, #7~8, #17)", () => {
  it("#1: 비조정·1주택, 3억원, 59㎡(85 이하) → 농특세 비과세", () => {
    const result = calculateTaxAmounts(300_000_000, 59, 0.01, false);
    expect(result).toEqual({
      acquisitionTax: 3_000_000,
      localEducationTax: 300_000,
      isRuralSpecialTaxExempt: true,
      ruralSpecialTax: 0,
      totalTax: 3_300_000,
    });
  });

  it("#2: 비조정·1주택, 3억원, 100㎡(85 초과) → 농특세 부과", () => {
    const result = calculateTaxAmounts(300_000_000, 100, 0.01, false);
    expect(result).toEqual({
      acquisitionTax: 3_000_000,
      localEducationTax: 300_000,
      isRuralSpecialTaxExempt: false,
      ruralSpecialTax: 600_000,
      totalTax: 3_900_000,
    });
  });

  it("#7: 정확히 85㎡ → 농특세 비과세 경계('이하'에 포함)", () => {
    const result = calculateTaxAmounts(500_000_000, 85, 0.01, false);
    expect(result.isRuralSpecialTaxExempt).toBe(true);
    expect(result.ruralSpecialTax).toBe(0);
    expect(result.totalTax).toBe(5_500_000);
  });

  it("#8: 85.01㎡ → 농특세 과세 시작", () => {
    const result = calculateTaxAmounts(500_000_000, 85.01, 0.01, false);
    expect(result.isRuralSpecialTaxExempt).toBe(false);
    expect(result.ruralSpecialTax).toBe(1_000_000);
    expect(result.totalTax).toBe(6_500_000);
  });

  it("#17: 10원 미만 절사 규칙 검증(잠정, 확인 필요 — policy.ts rounding 참고). " +
    "비정형 금액(333,333,333원)에서 취득세 raw(3,333,333.33) → 절사 3,333,330, " +
    "지방교육세 raw(333,333.333) → 절사 333,330이 되어야 한다.", () => {
    const result = calculateTaxAmounts(333_333_333, 59, 0.01, false);
    expect(result).toEqual({
      acquisitionTax: 3_333_330,
      localEducationTax: 333_330,
      isRuralSpecialTaxExempt: true,
      ruralSpecialTax: 0,
      totalTax: 3_666_660,
    });
  });

  it(
    "핵심 불변식 회귀 테스트: 지방교육세 표준세율 분기는 절사 전 acquisitionTaxRaw를 참조해야 " +
      "한다(ARCHITECTURE.md '6.'). 참고: standardRateFactor가 정확히 0.1이고 절사 단위가 10원 " +
      "이라 floor(floor(raw/10)/10)===floor(raw/100)라는 수학적 항등식이 성립해, 이 특정 계수 " +
      "조합에서는 '절사 후 값을 재사용'해도 최종 표시값이 우연히 같게 나온다는 것을 직접 확인했다 " +
      "(아래에서 두 방식을 모두 계산해 비교). 그럼에도 FORMULA.md/ARCHITECTURE.md가 명시한 계약은 " +
      "절사 전 값 참조이므로 logic.ts는 그 계약대로 구현했다 — Calculation Auditor는 이 테스트의 " +
      "통과 여부만으로 계약 준수를 판정하지 말고 logic.ts 소스에서 acquisitionTaxRaw(절사 전) " +
      "변수를 실제로 참조하는지 코드로 직접 확인할 것을 권고한다.",
    () => {
      const acquisitionPrice = 333_333_333;
      const appliedRate = 0.01;
      const acquisitionTaxRaw = acquisitionPrice * appliedRate;
      const acquisitionTaxTruncated = Math.floor(acquisitionTaxRaw / 10) * 10;

      const correctLocalEducationTax =
        Math.floor((acquisitionTaxRaw * 0.1) / 10) * 10;
      const wrongLocalEducationTax =
        Math.floor((acquisitionTaxTruncated * 0.1) / 10) * 10;

      // 이 특정 입력값에서는 두 계산 방식이 우연히 같은 표시값을 낸다(위 주석 참고).
      expect(correctLocalEducationTax).toBe(wrongLocalEducationTax);

      const result = calculateTaxAmounts(acquisitionPrice, 59, appliedRate, false);
      expect(result.localEducationTax).toBe(correctLocalEducationTax);
    },
  );

  it("중과세율(8%) 케이스 — 예제11: 비조정·3주택, 5억원, 100㎡", () => {
    const result = calculateTaxAmounts(500_000_000, 100, 0.08, true);
    expect(result).toEqual({
      acquisitionTax: 40_000_000,
      localEducationTax: 2_000_000,
      isRuralSpecialTaxExempt: false,
      ruralSpecialTax: 3_000_000,
      totalTax: 45_000_000,
    });
  });

  it("중과세율(12%) 케이스 — 예제13/14: 5억원, 100㎡", () => {
    const result = calculateTaxAmounts(500_000_000, 100, 0.12, true);
    expect(result).toEqual({
      acquisitionTax: 60_000_000,
      localEducationTax: 2_000_000,
      isRuralSpecialTaxExempt: false,
      ruralSpecialTax: 5_000_000,
      totalTax: 67_000_000,
    });
  });

  it("중과세율(12%) + 85㎡ 이하 — 예제15 후반부: 농특세 0원이어도 지방교육세는 고정 0.4%", () => {
    const result = calculateTaxAmounts(500_000_000, 59, 0.12, true);
    expect(result).toEqual({
      acquisitionTax: 60_000_000,
      localEducationTax: 2_000_000,
      isRuralSpecialTaxExempt: true,
      ruralSpecialTax: 0,
      totalTax: 62_000_000,
    });
  });
});

describe("calculateHousingAcquisitionTax — 오케스트레이터 조립 (나머지 조합, #5·#6 등)", () => {
  function input(overrides: {
    acquisitionPrice: number;
    exclusiveArea: number;
    isAdjustmentTargetArea: boolean;
    houseCountAfterAcquisition: HouseCountAfterAcquisition;
  }) {
    return overrides;
  }

  it("#5: 비조정·1주택, 정확히 9억원, 100㎡ → 나목(0.03), 농특세 부과", () => {
    const result = calculateHousingAcquisitionTax(
      input({
        acquisitionPrice: 900_000_000,
        exclusiveArea: 100,
        isAdjustmentTargetArea: false,
        houseCountAfterAcquisition: 1,
      }),
    );
    expect(result).toEqual({
      priceTier: "mid",
      standardRate: 0.03,
      isHeavyRateApplied: false,
      appliedRate: 0.03,
      acquisitionTax: 27_000_000,
      localEducationTax: 2_700_000,
      isRuralSpecialTaxExempt: false,
      ruralSpecialTax: 1_800_000,
      totalTax: 31_500_000,
    });
  });

  it("#6: 비조정·1주택, 9.5억원, 100㎡ → 다목(9억 초과, 3% 고정)", () => {
    const result = calculateHousingAcquisitionTax(
      input({
        acquisitionPrice: 950_000_000,
        exclusiveArea: 100,
        isAdjustmentTargetArea: false,
        houseCountAfterAcquisition: 1,
      }),
    );
    expect(result).toEqual({
      priceTier: "high",
      standardRate: 0.03,
      isHeavyRateApplied: false,
      appliedRate: 0.03,
      acquisitionTax: 28_500_000,
      localEducationTax: 2_850_000,
      isRuralSpecialTaxExempt: false,
      ruralSpecialTax: 1_900_000,
      totalTax: 33_250_000,
    });
  });

  it("#9: 조정·1주택, 5억원, 59㎡ → 1주택은 조정 여부 무관(표준세율 재확인)", () => {
    const result = calculateHousingAcquisitionTax(
      input({
        acquisitionPrice: 500_000_000,
        exclusiveArea: 59,
        isAdjustmentTargetArea: true,
        houseCountAfterAcquisition: 1,
      }),
    );
    expect(result.isHeavyRateApplied).toBe(false);
    expect(result.appliedRate).toBe(0.01);
    expect(result.totalTax).toBe(5_500_000);
  });

  it("#10: 비조정·2주택, 5억원, 100㎡ → 표준세율 유지(중과 아님)", () => {
    const result = calculateHousingAcquisitionTax(
      input({
        acquisitionPrice: 500_000_000,
        exclusiveArea: 100,
        isAdjustmentTargetArea: false,
        houseCountAfterAcquisition: 2,
      }),
    );
    expect(result.isHeavyRateApplied).toBe(false);
    expect(result.totalTax).toBe(6_500_000);
  });

  it("#11 vs #12: 비조정·3주택과 조정·2주택은 완전히 동일한 결과(둘 다 8% 중과)", () => {
    const a = calculateHousingAcquisitionTax(
      input({
        acquisitionPrice: 500_000_000,
        exclusiveArea: 100,
        isAdjustmentTargetArea: false,
        houseCountAfterAcquisition: 3,
      }),
    );
    const b = calculateHousingAcquisitionTax(
      input({
        acquisitionPrice: 500_000_000,
        exclusiveArea: 100,
        isAdjustmentTargetArea: true,
        houseCountAfterAcquisition: 2,
      }),
    );
    expect(a).toEqual(b);
    expect(a.totalTax).toBe(45_000_000);
  });

  it(
    "#13 vs #14: 비조정·4채 이상과 조정·3주택은 완전히 동일한 결과(둘 다 12% 중과), " +
      "예제11(45,000,000원)과 22,000,000원 차이가 실제로 재현된다(4구간 설계의 핵심 근거)",
    () => {
      const nonAdjustmentFourPlus = calculateHousingAcquisitionTax(
        input({
          acquisitionPrice: 500_000_000,
          exclusiveArea: 100,
          isAdjustmentTargetArea: false,
          houseCountAfterAcquisition: 4,
        }),
      );
      const adjustmentThree = calculateHousingAcquisitionTax(
        input({
          acquisitionPrice: 500_000_000,
          exclusiveArea: 100,
          isAdjustmentTargetArea: true,
          houseCountAfterAcquisition: 3,
        }),
      );
      expect(nonAdjustmentFourPlus).toEqual(adjustmentThree);
      expect(nonAdjustmentFourPlus.totalTax).toBe(67_000_000);

      const nonAdjustmentThree = calculateHousingAcquisitionTax(
        input({
          acquisitionPrice: 500_000_000,
          exclusiveArea: 100,
          isAdjustmentTargetArea: false,
          houseCountAfterAcquisition: 3,
        }),
      );
      expect(nonAdjustmentFourPlus.totalTax - nonAdjustmentThree.totalTax).toBe(22_000_000);
    },
  );

  it("#15: 조정·1주택 대 조정·3주택 이상 배수 비교(약 11.27배, SPEC 필수 대조 케이스)", () => {
    const oneHouse = calculateHousingAcquisitionTax(
      input({
        acquisitionPrice: 500_000_000,
        exclusiveArea: 59,
        isAdjustmentTargetArea: true,
        houseCountAfterAcquisition: 1,
      }),
    );
    const threeOrMoreHouses = calculateHousingAcquisitionTax(
      input({
        acquisitionPrice: 500_000_000,
        exclusiveArea: 59,
        isAdjustmentTargetArea: true,
        houseCountAfterAcquisition: 3,
      }),
    );
    expect(oneHouse.totalTax).toBe(5_500_000);
    expect(threeOrMoreHouses.totalTax).toBe(62_000_000);
    expect(threeOrMoreHouses.totalTax / oneHouse.totalTax).toBeCloseTo(11.27, 2);
    // 취득세만 비교하면 정확히 12배(FORMULA.md 명시).
    expect(threeOrMoreHouses.acquisitionTax / oneHouse.acquisitionTax).toBe(12);
  });

  it("standardRate는 중과 케이스에서도 항상 채워진다(FORMULA.md '출력값' 표 요건)", () => {
    const result = calculateHousingAcquisitionTax(
      input({
        acquisitionPrice: 500_000_000,
        exclusiveArea: 100,
        isAdjustmentTargetArea: true,
        houseCountAfterAcquisition: 3,
      }),
    );
    expect(result.isHeavyRateApplied).toBe(true);
    expect(result.appliedRate).toBe(0.12);
    // 5억원은 low 구간(6억 이하)이라 표준세율은 1%여야 한다 — 중과와 무관하게 항상 계산됨.
    expect(result.standardRate).toBe(0.01);
    expect(result.priceTier).toBe("low");
  });

  it("#17 오케스트레이터 종단 검증: 333,333,333원, 59㎡, 비조정·1주택", () => {
    const result = calculateHousingAcquisitionTax(
      input({
        acquisitionPrice: 333_333_333,
        exclusiveArea: 59,
        isAdjustmentTargetArea: false,
        houseCountAfterAcquisition: 1,
      }),
    );
    expect(result).toEqual({
      priceTier: "low",
      standardRate: 0.01,
      isHeavyRateApplied: false,
      appliedRate: 0.01,
      acquisitionTax: 3_333_330,
      localEducationTax: 333_330,
      isRuralSpecialTaxExempt: true,
      ruralSpecialTax: 0,
      totalTax: 3_666_660,
    });
  });

  it("#4/#16 오케스트레이터 종단 검증: mid 구간 반올림이 최종 세액까지 정확히 반영된다", () => {
    const example4 = calculateHousingAcquisitionTax(
      input({
        acquisitionPrice: 650_000_000,
        exclusiveArea: 59,
        isAdjustmentTargetArea: false,
        houseCountAfterAcquisition: 1,
      }),
    );
    expect(example4.totalTax).toBe(9_509_500);

    const example16 = calculateHousingAcquisitionTax(
      input({
        acquisitionPrice: 800_000_000,
        exclusiveArea: 100,
        isAdjustmentTargetArea: false,
        houseCountAfterAcquisition: 1,
      }),
    );
    expect(example16.totalTax).toBe(22_104_000);
  });
});
