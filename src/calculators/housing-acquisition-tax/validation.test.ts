/**
 * 주택 취득세 계산기 — 입력 검증 실패 케이스(SPEC.md "오류와 예외 처리",
 * FORMULA.md "예외" 절 그대로). Golden Test(정상 계산값)는 logic.test.ts 참고
 * (tasks/housing-acquisition-tax/ARCHITECTURE.md "10." 배치 전략).
 */

import { describe, expect, it } from "vitest";
import {
  isValidHouseCount,
  MAX_ACQUISITION_PRICE,
  MAX_EXCLUSIVE_AREA,
  MIN_ACQUISITION_PRICE,
  MIN_EXCLUSIVE_AREA,
  validateHousingAcquisitionTaxInput,
  type RawHousingAcquisitionTaxFormInput,
} from "./validation";

function baseValidInput(): RawHousingAcquisitionTaxFormInput {
  return {
    acquisitionPrice: "500,000,000",
    exclusiveArea: "84.9",
    isAdjustmentTargetArea: false,
    houseCountAfterAcquisition: 1,
  };
}

describe("정상 입력 — 성공 케이스", () => {
  it("모든 필드가 유효하면 성공하고 파싱된 숫자를 반환한다", () => {
    const result = validateHousingAcquisitionTaxInput(baseValidInput());
    expect(result).toEqual({
      success: true,
      data: {
        acquisitionPrice: 500_000_000,
        exclusiveArea: 84.9,
        isAdjustmentTargetArea: false,
        houseCountAfterAcquisition: 1,
      },
    });
  });

  it("콤마가 포함된 금액 문자열도 정상 파싱한다", () => {
    const result = validateHousingAcquisitionTaxInput({
      ...baseValidInput(),
      acquisitionPrice: "1,234,567,000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.acquisitionPrice).toBe(1_234_567_000);
    }
  });

  it("경계값(하한/상한) 자체는 유효하다", () => {
    expect(
      validateHousingAcquisitionTaxInput({
        ...baseValidInput(),
        acquisitionPrice: String(MIN_ACQUISITION_PRICE),
        exclusiveArea: String(MIN_EXCLUSIVE_AREA),
      }).success,
    ).toBe(true);
    expect(
      validateHousingAcquisitionTaxInput({
        ...baseValidInput(),
        acquisitionPrice: String(MAX_ACQUISITION_PRICE),
        exclusiveArea: String(MAX_EXCLUSIVE_AREA),
      }).success,
    ).toBe(true);
  });
});

describe("acquisitionPrice(취득가액) 검증", () => {
  it("빈 값이면 실패한다", () => {
    const result = validateHousingAcquisitionTaxInput({
      ...baseValidInput(),
      acquisitionPrice: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "acquisitionPrice")).toBe(true);
    }
  });

  it("0이면 실패한다", () => {
    const result = validateHousingAcquisitionTaxInput({
      ...baseValidInput(),
      acquisitionPrice: "0",
    });
    expect(result.success).toBe(false);
  });

  it("음수면 실패한다", () => {
    const result = validateHousingAcquisitionTaxInput({
      ...baseValidInput(),
      acquisitionPrice: "-500000000",
    });
    expect(result.success).toBe(false);
  });

  it("숫자가 아니면 실패한다", () => {
    const result = validateHousingAcquisitionTaxInput({
      ...baseValidInput(),
      acquisitionPrice: "오억원",
    });
    expect(result.success).toBe(false);
  });

  it("하한 미만이면 실패한다", () => {
    const result = validateHousingAcquisitionTaxInput({
      ...baseValidInput(),
      acquisitionPrice: String(MIN_ACQUISITION_PRICE - 1),
    });
    expect(result.success).toBe(false);
  });

  it("상한 초과면 실패한다", () => {
    const result = validateHousingAcquisitionTaxInput({
      ...baseValidInput(),
      acquisitionPrice: String(MAX_ACQUISITION_PRICE + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("exclusiveArea(전용면적) 검증", () => {
  it("빈 값이면 실패한다", () => {
    expect(
      validateHousingAcquisitionTaxInput({ ...baseValidInput(), exclusiveArea: "" }).success,
    ).toBe(false);
  });

  it("0이면 실패한다", () => {
    expect(
      validateHousingAcquisitionTaxInput({ ...baseValidInput(), exclusiveArea: "0" }).success,
    ).toBe(false);
  });

  it("음수면 실패한다", () => {
    expect(
      validateHousingAcquisitionTaxInput({ ...baseValidInput(), exclusiveArea: "-10" }).success,
    ).toBe(false);
  });

  it("숫자가 아니면 실패한다", () => {
    expect(
      validateHousingAcquisitionTaxInput({ ...baseValidInput(), exclusiveArea: "삼십평" })
        .success,
    ).toBe(false);
  });

  it("상한 초과면 실패한다", () => {
    expect(
      validateHousingAcquisitionTaxInput({
        ...baseValidInput(),
        exclusiveArea: String(MAX_EXCLUSIVE_AREA + 1),
      }).success,
    ).toBe(false);
  });

  it("소수(예: 84.9㎡)는 유효하다", () => {
    expect(
      validateHousingAcquisitionTaxInput({ ...baseValidInput(), exclusiveArea: "84.9" }).success,
    ).toBe(true);
  });
});

describe("isAdjustmentTargetArea(조정대상지역 여부) — 미선택 시 계산하지 않음(SPEC Must Have)", () => {
  it("null(미선택)이면 실패한다", () => {
    const result = validateHousingAcquisitionTaxInput({
      ...baseValidInput(),
      isAdjustmentTargetArea: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "isAdjustmentTargetArea")).toBe(true);
    }
  });

  it("false를 명시적으로 선택하면 성공한다(추정 기본값이 아니라 실제 선택)", () => {
    expect(
      validateHousingAcquisitionTaxInput({ ...baseValidInput(), isAdjustmentTargetArea: false })
        .success,
    ).toBe(true);
  });
});

describe("houseCountAfterAcquisition(보유 주택 수) — 미선택·범위 밖 방어", () => {
  it("null(미선택)이면 실패한다", () => {
    const result = validateHousingAcquisitionTaxInput({
      ...baseValidInput(),
      houseCountAfterAcquisition: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "houseCountAfterAcquisition")).toBe(true);
    }
  });

  it("1~4 각각은 유효하다(4구간 전체 확인)", () => {
    for (const count of [1, 2, 3, 4] as const) {
      expect(
        validateHousingAcquisitionTaxInput({
          ...baseValidInput(),
          houseCountAfterAcquisition: count,
        }).success,
      ).toBe(true);
    }
  });

  it("공유 URL 복원 등으로 1~4 밖의 값이 들어오면 방어적으로 실패 처리한다", () => {
    const result = validateHousingAcquisitionTaxInput({
      ...baseValidInput(),
      // @ts-expect-error 방어적 처리 검증을 위해 타입을 벗어난 값을 의도적으로 주입한다.
      houseCountAfterAcquisition: 5,
    });
    expect(result.success).toBe(false);
  });
});

describe("isValidHouseCount — 타입 가드", () => {
  it("1~4는 true, 그 외 숫자·타입은 false", () => {
    expect(isValidHouseCount(1)).toBe(true);
    expect(isValidHouseCount(4)).toBe(true);
    expect(isValidHouseCount(0)).toBe(false);
    expect(isValidHouseCount(5)).toBe(false);
    expect(isValidHouseCount(null)).toBe(false);
    expect(isValidHouseCount(undefined)).toBe(false);
    expect(isValidHouseCount("1")).toBe(false);
  });
});

describe("여러 필드 동시 오류", () => {
  it("모든 필드가 잘못되면 오류를 한 번에 모아 반환한다(첫 오류에서 멈추지 않음)", () => {
    const result = validateHousingAcquisitionTaxInput({
      acquisitionPrice: "",
      exclusiveArea: "",
      isAdjustmentTargetArea: null,
      houseCountAfterAcquisition: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveLength(4);
    }
  });
});
