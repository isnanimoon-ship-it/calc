import { describe, expect, it } from "vitest";
import { MAX_PRICE, MAX_QTY, parseAverageCostShareState, validateAverageCostInput } from "./validation";

/**
 * ARCHITECTURE.md "4."가 정한 4단계 검증 흐름(형식 → 자릿수 ≤8 → 0 초과 → 상한)의
 * Edge Case Test(docs/CALCULATOR_RULES.md "Edge Case Test" — 0, 음수, 소수, 매우 작은 값,
 * 매우 큰 값, 빈 입력, 숫자가 아닌 문자열, 경계값 포함).
 */

const VALID: Parameters<typeof validateAverageCostInput>[0] = {
  holdingQty: "10",
  holdingPrice: "10000",
  additionalQty: "10",
  additionalPrice: "5000",
};

describe("validateAverageCostInput — 정상 입력", () => {
  it("4개 필드가 모두 유효하면 success:true를 반환한다", () => {
    const result = validateAverageCostInput(VALID);
    expect(result).toEqual({ success: true, data: VALID });
  });

  it("소수 입력(코인 대응)도 통과한다", () => {
    const result = validateAverageCostInput({
      holdingQty: "0.00012345",
      holdingPrice: "90000000",
      additionalQty: "0.00007656",
      additionalPrice: "80000000",
    });
    expect(result.success).toBe(true);
  });

  it("상한 경계값(수량 10^15, 단가 100억원)은 통과한다", () => {
    const result = validateAverageCostInput({
      holdingQty: "1000000000000000",
      holdingPrice: "10000000000",
      additionalQty: "1000000000000000",
      additionalPrice: "10000000000",
    });
    expect(result.success).toBe(true);
  });

  it("소수 8자리 경계는 통과한다", () => {
    const result = validateAverageCostInput({ ...VALID, holdingQty: "0.12345678" });
    expect(result.success).toBe(true);
  });
});

describe("validateAverageCostInput — Edge Case", () => {
  it("빈 값은 모두 오류를 낸다", () => {
    const result = validateAverageCostInput({
      holdingQty: "",
      holdingPrice: "",
      additionalQty: "",
      additionalPrice: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveLength(4);
    }
  });

  it("0은 오류(0보다 커야 함)", () => {
    const result = validateAverageCostInput({ ...VALID, holdingQty: "0" });
    expect(result.success).toBe(false);
  });

  it("음수는 형식 오류(부호 없는 십진수만 허용)", () => {
    const result = validateAverageCostInput({ ...VALID, holdingPrice: "-10000" });
    expect(result.success).toBe(false);
  });

  it("숫자가 아닌 문자열은 형식 오류", () => {
    const result = validateAverageCostInput({ ...VALID, additionalQty: "abc" });
    expect(result.success).toBe(false);
  });

  it("소수 9자리(8자리 초과)는 오류", () => {
    const result = validateAverageCostInput({ ...VALID, holdingQty: "0.123456789" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0].message).toContain("8자리");
    }
  });

  it("수량 상한(10^15) 초과는 오류", () => {
    const result = validateAverageCostInput({ ...VALID, holdingQty: "1000000000000001" });
    expect(result.success).toBe(false);
  });

  it("단가 상한(100억원) 초과는 오류", () => {
    const result = validateAverageCostInput({ ...VALID, additionalPrice: "10000000001" });
    expect(result.success).toBe(false);
  });

  it("매우 작은 값(0.00000001)은 정상 통과(오류 아님)", () => {
    const result = validateAverageCostInput({ ...VALID, holdingQty: "0.00000001" });
    expect(result.success).toBe(true);
  });

  it("여러 필드가 동시에 잘못되면 각각 오류를 보고한다", () => {
    const result = validateAverageCostInput({
      holdingQty: "0",
      holdingPrice: "-1",
      additionalQty: "abc",
      additionalPrice: "0.123456789",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.errors.map((e) => e.field).sort();
      expect(fields).toEqual(["additionalPrice", "additionalQty", "holdingPrice", "holdingQty"]);
    }
  });

  it("상한 상수는 FORMULA.md 입력값 표와 일치한다", () => {
    expect(MAX_QTY).toBe(10n ** 15n);
    expect(MAX_PRICE).toBe(10n ** 10n);
  });
});

describe("parseAverageCostShareState — 공유 링크 복원 방어", () => {
  it("유효한 페이로드는 그대로 파싱한다", () => {
    expect(parseAverageCostShareState(VALID)).toEqual(VALID);
  });

  it("null/객체가 아닌 값은 null", () => {
    expect(parseAverageCostShareState(null)).toBeNull();
    expect(parseAverageCostShareState("문자열")).toBeNull();
    expect(parseAverageCostShareState(42)).toBeNull();
    expect(parseAverageCostShareState([])).toBeNull();
  });

  it("필드가 누락되면 null", () => {
    expect(parseAverageCostShareState({ holdingQty: "10" })).toBeNull();
  });

  it("필드 값이 숫자 타입이면 null(DecimalString은 항상 string)", () => {
    expect(
      parseAverageCostShareState({ holdingQty: 10, holdingPrice: "10000", additionalQty: "10", additionalPrice: "5000" }),
    ).toBeNull();
  });

  it("범위를 벗어난 값이 포함되면 null(조작된 공유 링크 방어)", () => {
    expect(parseAverageCostShareState({ ...VALID, holdingQty: "-10" })).toBeNull();
  });
});
