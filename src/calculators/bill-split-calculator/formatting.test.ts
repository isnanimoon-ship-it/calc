import { describe, expect, it } from "vitest";
import { buildBillSplitBreakdown, formatResultSummary, formatWon, sumAmounts } from "./formatting";
import { calculateEqualSplit, calculateLadderSplit, calculateWinnerTakeAll } from "./logic";

describe("formatWon", () => {
  it("천 단위 구분과 '원' 단위를 붙인다", () => {
    expect(formatWon(1_234_567)).toBe("1,234,567원");
    expect(formatWon(0)).toBe("0원");
  });
});

describe("sumAmounts", () => {
  it("금액 배열의 합을 반환한다", () => {
    expect(sumAmounts([1000, 2000, 3000])).toBe(6000);
    expect(sumAmounts([])).toBe(0);
  });
});

describe("formatResultSummary — 숫자를 새로 계산하지 않고 logic.ts 결과만 문자열로 가공한다", () => {
  it("균등 분배 요약", () => {
    const result = calculateEqualSplit({ mode: "equal", totalAmount: 10_000, members: ["A", "B", "C"] });
    const summary = formatResultSummary(result);
    expect(summary).toContain("3명");
    expect(summary).toContain(formatWon(result.totalAmount));
    expect(summary).toContain(formatWon(result.baseShare));
  });

  it("몰아주기 요약 — 선정된 이름과 전액을 포함한다", () => {
    const result = calculateWinnerTakeAll(
      { mode: "winner-take-all", totalAmount: 30_000, members: ["A", "B", "C"] },
      () => 0.5, // floor(0.5*3)=1 → B
    );
    const summary = formatResultSummary(result);
    expect(summary).toContain("B");
    expect(summary).toContain(formatWon(30_000));
  });

  it("사다리타기 요약 — 합계 금액을 포함한다", () => {
    const result = calculateLadderSplit({ mode: "ladder", members: ["A", "B", "C"], amounts: [100, 200, 300] });
    const summary = formatResultSummary(result);
    expect(summary).toContain(formatWon(600));
  });
});

describe("buildBillSplitBreakdown", () => {
  it("균등 분배 — 나머지가 있으면 앞쪽 N명 이름을 포함한 설명을 만든다", () => {
    const result = calculateEqualSplit({ mode: "equal", totalAmount: 10_000, members: ["A", "B", "C"] });
    const lines = buildBillSplitBreakdown(result);
    const remainderLine = lines.find((line) => line.label === "나머지 배분");
    expect(remainderLine?.detail).toContain("A");
    expect(remainderLine?.detail).not.toContain("B");
  });

  it("균등 분배 — 나머지가 없으면 '나누어떨어져'라고 설명한다", () => {
    const result = calculateEqualSplit({ mode: "equal", totalAmount: 10_000, members: ["A", "B"] });
    const lines = buildBillSplitBreakdown(result);
    const remainderLine = lines.find((line) => line.label === "나머지 배분");
    expect(remainderLine?.detail).toContain("나누어떨어져");
  });

  it("몰아주기 — 확률 1/N과 선정 결과를 설명한다", () => {
    const result = calculateWinnerTakeAll({ mode: "winner-take-all", totalAmount: 10_000, members: ["A", "B"] }, () => 0);
    const lines = buildBillSplitBreakdown(result);
    expect(lines.some((line) => line.detail.includes("1/2"))).toBe(true);
    expect(lines.some((line) => line.detail.includes("A"))).toBe(true);
  });

  it("사다리타기 — Fisher-Yates와 N! 표현을 설명한다", () => {
    const result = calculateLadderSplit({ mode: "ladder", members: ["A", "B", "C"], amounts: [100, 200, 300] });
    const lines = buildBillSplitBreakdown(result);
    expect(lines.some((line) => line.detail.includes("Fisher-Yates"))).toBe(true);
    expect(lines.some((line) => line.detail.includes("3!"))).toBe(true);
  });
});
