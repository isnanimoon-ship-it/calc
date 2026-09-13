/**
 * 주휴수당 계산기 — 표시 문구(경고·breakdown·보조 고지) 테스트.
 *
 * Optimizer 라운드(2026-09-04)에서 추가. QA 커버리지 갭 대응:
 * - `buildMinHoursWarning` / `buildBelowMinimumWageWarning` 문구(조사·수치·법령) 부분일치
 *   (QA-L1 "…시간는" → "…시간으로" 조사 회귀 방지).
 * - `buildWeeklyHolidayBreakdown` 각 행 label / expression / legalBasis 검증
 *   (UX/UI Critic L1 월 환산 명칭 통일, L3 수식 단위 표기).
 * - `buildKeyResultCaveat` 조건부 한 줄(UX/UI Critic M1).
 *
 * 실제 `logic.ts` 결과 객체를 그대로 넣어 검증한다(mock 결과 구성 안 함).
 */

import { describe, expect, it } from "vitest";
import { calculateWeeklyHolidayAllowance } from "./logic";
import {
  buildBelowMinimumWageWarning,
  buildKeyResultCaveat,
  buildMinHoursWarning,
  buildWeeklyHolidayBreakdown,
  EFFECTIVE_WAGE_NOTE,
  MONTHLY_HOLIDAY_PAY_LABEL,
  MONTHLY_REFERENCE_NOTE,
  MONTHLY_TOTAL_PAY_LABEL,
} from "./formatting";
import type { WeeklyHolidayAllowanceInput } from "./types";

const calc = (input: WeeklyHolidayAllowanceInput) =>
  calculateWeeklyHolidayAllowance(input);

describe("buildMinHoursWarning — 15시간 미만 경고 문구", () => {
  it("조사가 '은/으로'로 붙는다(QA-L1: '…시간는' 회귀 방지)", () => {
    const warning = buildMinHoursWarning({ hourlyWage: 10_320, weeklyHours: 10 });
    expect(warning.body).toContain("입력한 주 근무시간은 10시간으로 15시간 미만입니다.");
    expect(warning.body).not.toContain("10시간는");
  });

  it("소수 시간도 조사가 어색하지 않다(13.5 → '13.5시간으로')", () => {
    const warning = buildMinHoursWarning({ hourlyWage: 11_000, weeklyHours: 13.5 });
    expect(warning.body).toContain("13.5시간으로 15시간 미만입니다.");
  });

  it("법령 근거와 아이콘 종류가 고정돼 있다", () => {
    const warning = buildMinHoursWarning({ hourlyWage: 10_320, weeklyHours: 10 });
    expect(warning.legalBasis).toBe("근로기준법 제18조제3항");
    expect(warning.icon).toBe("info");
    expect(warning.title).toContain("주 15시간 미만");
  });
});

describe("buildBelowMinimumWageWarning — 최저임금 미만 경고 문구", () => {
  it("적용 연도·최저임금액·수습 감액 보조 문구·법령을 담는다", () => {
    const result = calc({ hourlyWage: 9_000, weeklyHours: 16 });
    const warning = buildBelowMinimumWageWarning(result);
    expect(warning.title).toBe("입력한 시급이 2026년 최저임금보다 낮습니다");
    expect(warning.body).toContain("2026년 최저임금은 시간당 10,320원입니다.");
    expect(warning.note).toContain("최저임금의 90%까지 감액이 허용될 수 있으나");
    expect(warning.legalBasis).toBe("최저임금법 제5조제2항 · 같은 법 시행령 제3조");
    expect(warning.icon).toBe("warning");
  });
});

describe("buildKeyResultCaveat — 핵심 카드 조건부 한 줄(UX/UI Critic M1)", () => {
  it("두 요건 모두 충족하면 null", () => {
    const result = calc({ hourlyWage: 10_320, weeklyHours: 40 });
    expect(buildKeyResultCaveat(result)).toBeNull();
  });

  it("15시간 미만이면 그 사유만 안내한다", () => {
    const result = calc({ hourlyWage: 10_320, weeklyHours: 14 });
    expect(buildKeyResultCaveat(result)).toBe(
      "주 15시간 미만이라 실제로는 주휴수당이 발생하지 않습니다 — 아래 안내를 확인하세요.",
    );
  });

  it("최저임금 미만이면 그 사유만 안내한다", () => {
    const result = calc({ hourlyWage: 9_000, weeklyHours: 20 });
    expect(buildKeyResultCaveat(result)).toBe(
      "입력한 시급이 2026년 최저임금보다 낮습니다 — 아래 안내를 확인하세요.",
    );
  });

  it("두 사유가 동시면 ' · '로 이어 붙인다", () => {
    const result = calc({ hourlyWage: 9_000, weeklyHours: 10 });
    expect(buildKeyResultCaveat(result)).toBe(
      "주 15시간 미만이라 실제로는 주휴수당이 발생하지 않습니다 · " +
        "입력한 시급이 2026년 최저임금보다 낮습니다 — 아래 안내를 확인하세요.",
    );
  });
});

describe("buildWeeklyHolidayBreakdown — 각 행 label / expression / legalBasis", () => {
  const input: WeeklyHolidayAllowanceInput = { hourlyWage: 10_320, weeklyHours: 40 };
  const rows = buildWeeklyHolidayBreakdown(input, calc(input));

  it("6행이 순서대로 나온다", () => {
    expect(rows.map((r) => r.label)).toEqual([
      "1주 주휴시간",
      "1주치 주휴수당",
      MONTHLY_HOLIDAY_PAY_LABEL,
      "주휴수당 포함 주급",
      MONTHLY_TOTAL_PAY_LABEL,
      "주휴수당 포함 실질 시급",
    ]);
  });

  it("월 환산 명칭이 통일된 상수를 쓴다(UX/UI Critic L1)", () => {
    expect(MONTHLY_HOLIDAY_PAY_LABEL).toBe("월 환산 주휴수당 (참고)");
    expect(MONTHLY_TOTAL_PAY_LABEL).toBe("주휴수당 포함 월급 (참고)");
    expect(rows.some((r) => r.label.includes("(참고액)"))).toBe(false);
  });

  it("1주 주휴시간 행 수식에 단위·기준이 붙는다(UX/UI Critic L3)", () => {
    const row = rows[0];
    expect(row.expression).toBe(
      "40시간 ÷ 주 40시간 × 1일 8시간, 최대 8시간 = 8시간",
    );
    expect(row.legalBasis).toContain("근로기준법 시행령 별표2 제4호");
    expect(row.legalBasis).toContain("근로기준법 제50조(8시간 상한)");
  });

  it("1주치 주휴수당 행은 FORMULA.md 예제 1 값과 일치한다", () => {
    expect(rows[1].expression).toBe("8시간 × 10,320원 = 82,560원");
    expect(rows[1].legalBasis).toBe("근로기준법 제55조제1항");
  });

  it("월 환산 행은 4.345 계수 표기와 반올림된 값을 담는다", () => {
    expect(rows[2].expression).toBe(
      "82,560원 × (365 ÷ 12 ÷ 7 ≈ 4.345주) = 358,743원",
    );
  });

  it("소수 주휴시간(주 16시간 → 3.2시간)도 수식에 그대로 나온다", () => {
    const partTime: WeeklyHolidayAllowanceInput = {
      hourlyWage: 9_000,
      weeklyHours: 16,
    };
    const r = buildWeeklyHolidayBreakdown(partTime, calc(partTime));
    expect(r[0].expression).toBe(
      "16시간 ÷ 주 40시간 × 1일 8시간, 최대 8시간 = 3.2시간",
    );
  });
});

describe("표시 주석 문구", () => {
  it("MONTHLY_REFERENCE_NOTE는 209시간 차이를 순화된 표현으로 고지한다(UX/UI Critic M2b)", () => {
    expect(MONTHLY_REFERENCE_NOTE).toContain("4.345주");
    expect(MONTHLY_REFERENCE_NOTE).toContain("월 209시간");
    expect(MONTHLY_REFERENCE_NOTE).toContain("차이가 날 수 있습니다");
  });

  it("EFFECTIVE_WAGE_NOTE는 '실질 시급' 뜻을 풀어 준다(UX/UI Critic M2a)", () => {
    expect(EFFECTIVE_WAGE_NOTE).toContain("시간당 얼마를 받는 셈인지");
  });
});
