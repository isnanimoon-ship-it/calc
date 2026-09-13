import { describe, expect, it } from "vitest";
import {
  isValidIsoDate,
  MAX_SHIFT_DAYS,
  MAX_SUPPORTED_DATE,
  MIN_SUPPORTED_DATE,
  parseDdayCalculatorShareState,
  validateDateShiftInput,
  validateDdayInput,
} from "./validation";

describe("isValidIsoDate", () => {
  it("정상 날짜는 true", () => {
    expect(isValidIsoDate("2026-09-12")).toBe(true);
  });

  it("존재하지 않는 날짜(2024-02-30)는 false", () => {
    expect(isValidIsoDate("2024-02-30")).toBe(false);
  });

  it("형식이 다른 문자열은 false", () => {
    expect(isValidIsoDate("2026/09/12")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
});

describe("validateDdayInput — 모드 A 입력 검증", () => {
  it("정상 입력은 success:true", () => {
    const result = validateDdayInput({ startDate: "2026-09-12", targetDate: "2026-12-25" });
    expect(result).toEqual({
      success: true,
      data: { startDate: "2026-09-12", targetDate: "2026-12-25" },
    });
  });

  it("시작일이 목표일보다 미래여도(선후관계 제약 없음) 정상 통과한다", () => {
    const result = validateDdayInput({ startDate: "2026-12-25", targetDate: "2026-09-12" });
    expect(result.success).toBe(true);
  });

  it("시작일=목표일도 정상 통과한다(오류 아님)", () => {
    const result = validateDdayInput({ startDate: "2026-09-12", targetDate: "2026-09-12" });
    expect(result.success).toBe(true);
  });

  it("시작일 누락 시 startDate 필드 오류", () => {
    const result = validateDdayInput({ startDate: "", targetDate: "2026-09-12" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "startDate")).toBe(true);
    }
  });

  it("존재하지 않는 목표일(2024-02-30)은 targetDate 필드 오류", () => {
    const result = validateDdayInput({ startDate: "2026-09-12", targetDate: "2024-02-30" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "targetDate")).toBe(true);
    }
  });

  it("지원 범위 초과(2201-01-01)는 오류", () => {
    const result = validateDdayInput({ startDate: "2026-09-12", targetDate: "2201-01-01" });
    expect(result.success).toBe(false);
  });

  it("지원 범위 하한/상한 경계값은 정상 통과한다", () => {
    expect(
      validateDdayInput({ startDate: MIN_SUPPORTED_DATE, targetDate: MIN_SUPPORTED_DATE }).success,
    ).toBe(true);
    expect(
      validateDdayInput({ startDate: MAX_SUPPORTED_DATE, targetDate: MAX_SUPPORTED_DATE }).success,
    ).toBe(true);
  });
});

describe("validateDateShiftInput — 모드 B 입력 검증", () => {
  it("정상 입력은 success:true, days는 number로 변환된다", () => {
    const result = validateDateShiftInput({ baseDate: "2026-09-12", days: "100", direction: "add" });
    expect(result).toEqual({
      success: true,
      data: { baseDate: "2026-09-12", days: 100, direction: "add" },
    });
  });

  it("일수 0은 정상 통과한다(오류 아님)", () => {
    const result = validateDateShiftInput({ baseDate: "2026-09-12", days: "0", direction: "add" });
    expect(result.success).toBe(true);
  });

  it("일수 상한(100,000)은 정상 통과한다", () => {
    const result = validateDateShiftInput({
      baseDate: "2026-09-12",
      days: String(MAX_SHIFT_DAYS),
      direction: "add",
    });
    expect(result.success).toBe(true);
  });

  it("일수 상한 초과(100,001)는 오류", () => {
    const result = validateDateShiftInput({
      baseDate: "2026-09-12",
      days: String(MAX_SHIFT_DAYS + 1),
      direction: "add",
    });
    expect(result.success).toBe(false);
  });

  it("일수에 음수 부호가 들어오면 형식 오류(방향은 별도 토글로만 조절)", () => {
    const result = validateDateShiftInput({ baseDate: "2026-09-12", days: "-5", direction: "add" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "days")).toBe(true);
    }
  });

  it("일수에 소수점이 들어오면 형식 오류", () => {
    const result = validateDateShiftInput({ baseDate: "2026-09-12", days: "1.5", direction: "add" });
    expect(result.success).toBe(false);
  });

  it("일수 누락 시 오류", () => {
    const result = validateDateShiftInput({ baseDate: "2026-09-12", days: "", direction: "add" });
    expect(result.success).toBe(false);
  });

  it("기준일 누락 시 baseDate 필드 오류", () => {
    const result = validateDateShiftInput({ baseDate: "", days: "10", direction: "add" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "baseDate")).toBe(true);
    }
  });
});

describe("parseDdayCalculatorShareState — 공유 링크 복원", () => {
  it("모드 A 공유 상태를 정확히 복원한다", () => {
    const parsed = parseDdayCalculatorShareState({
      mode: "dday",
      startDate: "2026-09-12",
      targetDate: "2026-12-25",
    });
    expect(parsed).toEqual({ mode: "dday", startDate: "2026-09-12", targetDate: "2026-12-25" });
  });

  it("모드 B 공유 상태를 정확히 복원한다(days는 number)", () => {
    const parsed = parseDdayCalculatorShareState({
      mode: "dateShift",
      baseDate: "2026-09-12",
      days: 104,
      direction: "add",
    });
    expect(parsed).toEqual({
      mode: "dateShift",
      baseDate: "2026-09-12",
      days: 104,
      direction: "add",
    });
  });

  it("손상된 페이로드(mode 없음)는 null", () => {
    expect(parseDdayCalculatorShareState({ startDate: "2026-09-12" })).toBeNull();
  });

  it("손상된 페이로드(존재하지 않는 날짜 포함)는 null", () => {
    expect(
      parseDdayCalculatorShareState({
        mode: "dday",
        startDate: "2026-09-12",
        targetDate: "2024-02-30",
      }),
    ).toBeNull();
  });

  it("배열이나 null 입력은 null", () => {
    expect(parseDdayCalculatorShareState(null)).toBeNull();
    expect(parseDdayCalculatorShareState([1, 2, 3])).toBeNull();
  });
});
