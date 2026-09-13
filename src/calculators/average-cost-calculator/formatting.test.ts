import { describe, expect, it } from "vitest";
import { calculateAverageCost } from "./logic";
import {
  directionLabels,
  formatDecimalString,
  formatPercent,
  formatQty,
  formatResultSummary,
  formatWon,
  ROUNDED_TO_ZERO_BUT_CHANGED_NOTE,
  buildAverageCostBreakdown,
} from "./formatting";

describe("formatDecimalString / formatWon / formatQty", () => {
  it("정수부에 천 단위 콤마를 삽입한다", () => {
    expect(formatDecimalString("1000000")).toBe("1,000,000");
    expect(formatWon("10000")).toBe("10,000원");
  });
  it("소수부는 그대로 붙이고 반올림하지 않는다", () => {
    expect(formatDecimalString("0.00012345")).toBe("0.00012345");
    expect(formatQty("0.75")).toBe("0.75");
  });
  it("음수 부호를 보존한다", () => {
    expect(formatWon("-2500")).toBe("-2,500원");
  });
  it("BigInt 정수부가 안전 정수 범위(2^53)를 넘어도 손실 없이 표시한다(검증 예제 10 규모)", () => {
    expect(formatDecimalString("10000000001000000000000000")).toBe("10,000,000,001,000,000,000,000,000");
  });
});

describe("formatPercent", () => {
  it("양수는 +, 음수는 -, 0은 부호 없이 표시한다", () => {
    expect(formatPercent(25)).toBe("+25.00%");
    expect(formatPercent(-25)).toBe("-25.00%");
    expect(formatPercent(0)).toBe("0.00%");
  });
});

describe("directionLabels", () => {
  it("SPEC.md가 정한 세 방향 라벨을 그대로 노출한다", () => {
    expect(directionLabels["하락"]).toBe("평단가 하락");
    expect(directionLabels["상승"]).toBe("평단가 상승");
    expect(directionLabels["변동없음"]).toBe("변동 없음");
  });
});

describe("buildAverageCostBreakdown / formatResultSummary", () => {
  it("FORMULA.md 예제 1의 실제 값이 대입된 계산 근거를 조립한다", () => {
    const result = calculateAverageCost({
      holdingQty: "10",
      holdingPrice: "10000",
      additionalQty: "10",
      additionalPrice: "5000",
    });
    const breakdown = buildAverageCostBreakdown(result);
    expect(breakdown[0].detail).toBe("(10 × 10,000원 + 10 × 5,000원) ÷ (10 + 10) = 7,500원");
    expect(formatResultSummary(result)).toContain("7,500원");
    expect(formatResultSummary(result)).toContain("평단가 하락");
  });

  it('예제 7 — isRoundedToZeroButChanged일 때 보조 설명 상수가 존재한다', () => {
    const result = calculateAverageCost({
      holdingQty: "100000",
      holdingPrice: "10000",
      additionalQty: "1",
      additionalPrice: "9000",
    });
    expect(result.isRoundedToZeroButChanged).toBe(true);
    expect(ROUNDED_TO_ZERO_BUT_CHANGED_NOTE.length).toBeGreaterThan(0);
  });
});
