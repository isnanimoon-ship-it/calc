import { describe, expect, it } from "vitest";
import {
  buildDateShiftBreakdown,
  buildDdayBreakdown,
  formatDateShiftSentence,
  formatDdaySentence,
  formatKoreanDate,
  formatKoreanDateWithWeekday,
  formatWeeksBreakdown,
  isToday,
  weekdayLabels,
} from "./formatting";
import { calculateDateShift, calculateDday } from "./logic";

describe("formatKoreanDate / formatKoreanDateWithWeekday", () => {
  it("YYYY-MM-DD를 YYYY년 M월 D일로 바꾼다(0-padding 없음)", () => {
    expect(formatKoreanDate("2026-09-12")).toBe("2026년 9월 12일");
    expect(formatKoreanDate("2026-01-01")).toBe("2026년 1월 1일");
  });

  it("요일을 괄호로 병기한다(SPEC.md 예시: '2026년 12월 20일 (일)')", () => {
    expect(formatKoreanDateWithWeekday("2026-12-20", 0)).toBe("2026년 12월 20일 (일)");
  });

  it("weekdayLabels는 0(일)~6(토) 전부를 포함한다", () => {
    expect(weekdayLabels[0]).toBe("일");
    expect(weekdayLabels[6]).toBe("토");
  });
});

describe("formatWeeksBreakdown — FORMULA.md 주 단위 환산 표시 규칙", () => {
  it("null(당일)이면 null을 반환한다", () => {
    expect(formatWeeksBreakdown(null, 0)).toBeNull();
  });

  it("weeks===0이면 '{n}일'만 표시한다", () => {
    expect(formatWeeksBreakdown({ weeks: 0, remainderDays: 6 }, 6)).toBe("6일 후");
  });

  it("remainderDays===0이면 '{n}주'만 표시한다", () => {
    expect(formatWeeksBreakdown({ weeks: 2, remainderDays: 0 }, 14)).toBe("2주 후");
  });

  it("그 외는 '{n}주 {m}일'로 표시한다(FORMULA #4: 14주 6일 후)", () => {
    expect(formatWeeksBreakdown({ weeks: 14, remainderDays: 6 }, 104)).toBe("14주 6일 후");
  });

  it("diffDays 음수면 어미가 '전'이다(FORMULA #5: 36주 2일 전)", () => {
    expect(formatWeeksBreakdown({ weeks: 36, remainderDays: 2 }, -254)).toBe("36주 2일 전");
  });
});

describe("isToday", () => {
  it("두 날짜가 같으면 true", () => {
    expect(isToday("2026-09-12", "2026-09-12")).toBe(true);
  });

  it("두 날짜가 다르면 false", () => {
    expect(isToday("2026-09-12", "2026-09-13")).toBe(false);
  });
});

describe("formatDdaySentence / formatDateShiftSentence — SPEC.md 문장형 설명", () => {
  it("D-Day(diff=0)는 '같은 날' 문장을 만든다", () => {
    const result = calculateDday({ startDate: "2026-09-12", targetDate: "2026-09-12" });
    expect(formatDdaySentence(result)).toBe("2026년 9월 12일은 시작일과 같은 날입니다.");
  });

  it("미래 목표일(D-N)은 '까지 N일 남았습니다' 문장을 만든다(SPEC.md 예시)", () => {
    const result = calculateDday({ startDate: "2026-09-12", targetDate: "2026-12-25" });
    expect(formatDdaySentence(result)).toBe("2026년 12월 25일까지 104일 남았습니다.");
  });

  it("과거 목표일(D+N)은 '로부터 N일 지났습니다' 문장을 만든다(SPEC.md 예시)", () => {
    const result = calculateDday({ startDate: "2026-09-12", targetDate: "2026-01-01" });
    expect(formatDdaySentence(result)).toBe("2026년 1월 1일로부터 254일 지났습니다.");
  });

  it("모드 B 일수 0은 '같은 날' 문장을 만든다", () => {
    const result = calculateDateShift({ baseDate: "2026-09-12", days: 0, direction: "add" });
    expect(formatDateShiftSentence(result)).toContain("같은 날");
  });

  it("모드 B 더하기는 '더한 날짜는' 문장을 만든다", () => {
    const result = calculateDateShift({ baseDate: "2026-09-12", days: 104, direction: "add" });
    expect(formatDateShiftSentence(result)).toBe(
      "2026년 9월 12일에서 104일을 더한 날짜는 2026년 12월 25일 (금)입니다.",
    );
  });

  it("모드 B 빼기는 '뺀 날짜는' 문장을 만든다", () => {
    const result = calculateDateShift({ baseDate: "2026-09-12", days: 254, direction: "subtract" });
    expect(formatDateShiftSentence(result)).toBe(
      "2026년 9월 12일에서 254일을 뺀 날짜는 2026년 1월 1일 (목)입니다.",
    );
  });
});

describe("buildDdayBreakdown / buildDateShiftBreakdown — 계산 근거", () => {
  it("모드 A 계산 근거는 실제 값이 대입된 날짜 차이 식을 포함한다", () => {
    const result = calculateDday({ startDate: "2026-09-12", targetDate: "2026-12-25" });
    const lines = buildDdayBreakdown(result);
    expect(lines[0].label).toBe("날짜 차이");
    expect(lines[0].detail).toContain("104일");
    expect(lines[0].detail).toContain("D-104");
    expect(lines.some((line) => line.label === "주 단위 환산")).toBe(true);
  });

  it("diff=0이면 주 단위 환산 줄이 없다", () => {
    const result = calculateDday({ startDate: "2026-09-12", targetDate: "2026-09-12" });
    const lines = buildDdayBreakdown(result);
    expect(lines.some((line) => line.label === "주 단위 환산")).toBe(false);
  });

  it("모드 B 계산 근거는 실제 값이 대입된 날짜 이동 식을 포함한다", () => {
    const result = calculateDateShift({ baseDate: "2026-09-12", days: 104, direction: "add" });
    const lines = buildDateShiftBreakdown(result);
    expect(lines[0].detail).toBe("2026년 9월 12일 + 104일 = 2026년 12월 25일 (금)");
  });
});
