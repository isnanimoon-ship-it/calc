import { describe, expect, it } from "vitest";
import {
  buildAllowanceBreakdown,
  buildBelowMinimumWageWarning,
  buildOver2YearsAccrualBreakdown,
  buildServicePeriodBreakdown,
  buildUnder1YearAccrualBreakdown,
  buildUnusedDaysBreakdown,
  buildYear1To2AccrualBreakdown,
  formatDays,
  formatMonths,
  formatWon,
  formatYears,
} from "./formatting";

describe("기본 포맷터", () => {
  it("formatWon — 천 단위 콤마 + '원'", () => {
    expect(formatWon(1_300_000)).toBe("1,300,000원");
    expect(formatWon(0)).toBe("0원");
  });

  it("formatDays — 정수/소수(반차) 모두 표시", () => {
    expect(formatDays(26)).toBe("26일");
    expect(formatDays(11.5)).toBe("11.5일");
    expect(formatDays(0)).toBe("0일");
  });

  it("formatMonths / formatYears", () => {
    expect(formatMonths(6)).toBe("6개월");
    expect(formatYears(3)).toBe("3년");
  });
});

describe("계산 근거 breakdown 문자열", () => {
  it("buildServicePeriodBreakdown — UNDER_1YEAR는 개월수를 함께 표시한다", () => {
    const text = buildServicePeriodBreakdown({
      hireDate: "2025-01-15",
      referenceDate: "2025-07-15",
      completedYears: 0,
      completedMonths: 6,
      regime: "UNDER_1YEAR",
    });
    expect(text).toContain("2025-01-15");
    expect(text).toContain("2025-07-15");
    expect(text).toContain("6개월");
  });

  it("buildServicePeriodBreakdown — OVER_2YEARS는 개월수를 표시하지 않는다", () => {
    const text = buildServicePeriodBreakdown({
      hireDate: "2023-03-10",
      referenceDate: "2026-03-10",
      completedYears: 3,
      regime: "OVER_2YEARS",
    });
    expect(text).not.toContain("개월");
    expect(text).toContain("3년");
  });

  it("buildUnder1YearAccrualBreakdown", () => {
    expect(buildUnder1YearAccrualBreakdown(6, 6)).toBe("개근 6개월 → 발생일수 min(6, 11) = 6일");
  });

  it("buildYear1To2AccrualBreakdown — 26일 고정 문구", () => {
    expect(buildYear1To2AccrualBreakdown(26)).toBe("1년 미만 발생 최대 11일 + 1년 시점 발생 15일 = 26일");
  });

  it("buildOver2YearsAccrualBreakdown — 상한 미적용", () => {
    const text = buildOver2YearsAccrualBreakdown(
      3,
      { baseDays: 15, addedDays: 1, rawTotalDays: 16, cappedAtMax: false },
      16,
    );
    expect(text).toContain("기본 15일");
    expect(text).toContain("가산 1일");
    expect(text).toContain("16일");
    expect(text).not.toContain("상한 적용");
  });

  it("buildOver2YearsAccrualBreakdown — 25일 상한 적용 문구 노출", () => {
    const text = buildOver2YearsAccrualBreakdown(
      23,
      { baseDays: 15, addedDays: 11, rawTotalDays: 26, cappedAtMax: true },
      25,
    );
    expect(text).toContain("26일");
    expect(text).toContain("25일 상한 적용");
    expect(text).toContain("25일");
  });

  it("buildUnusedDaysBreakdown", () => {
    expect(buildUnusedDaysBreakdown(26, 5, 21)).toBe("발생일수 26일 - 사용일수 5일 = 미사용일수 21일");
  });

  it("buildAllowanceBreakdown", () => {
    expect(buildAllowanceBreakdown(26, 50_000, 1_300_000)).toBe(
      "미사용일수 26일 × 1일 통상임금 50,000원 = 1,300,000원",
    );
  });

  it("buildBelowMinimumWageWarning — FORMULA.md 예제 16 수치를 그대로 반영한다", () => {
    const text = buildBelowMinimumWageWarning({
      year: 2026,
      dailyReferenceAmount: 82_560,
      belowMinimumWageReference: true,
    });
    expect(text).toContain("2026년");
    expect(text).toContain("82,560원");
  });
});
