/**
 * 최저임금·시급↔월급 계산기 — 입력 검증 Edge Case Test + FORMULA.md 입력 오류 예제 F1~F8.
 *
 * FORMULA.md "입력값" 표 / "예외" 절, SPEC.md "입력 오류/극단값 방어" 대응.
 * ARCHITECTURE.md "4."가 결정한 `MIN_WEEKLY_HOURS=1`(FORMULA.md 원안 `>0`보다 좁힌 하한)의
 * 실제 동작을 검증하는 것이 이 파일의 핵심 목적 중 하나다.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEEKLY_HOURS,
  MAX_HOURLY_WAGE,
  MAX_MONTHLY_WAGE,
  MAX_WEEKLY_HOURS,
  MIN_WEEKLY_HOURS,
  validateMinimumWageCalculatorInput,
} from "./validation";

describe("validateMinimumWageCalculatorInput — 정상 입력(HOURLY)", () => {
  it("정상 입력은 성공하고 숫자로 정규화된 데이터를 반환한다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "10320",
      weeklyHours: "40",
    });
    expect(result).toEqual({
      success: true,
      data: { mode: "HOURLY", hourlyWage: 10_320, weeklyHours: 40 },
    });
  });

  it("시급의 실시간 천 단위 콤마를 제거하고 파싱한다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "1,000,000",
      weeklyHours: "20",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ mode: "HOURLY", hourlyWage: 1_000_000, weeklyHours: 20 });
  });

  it("weeklyHours를 비워두면 기본값 40이 적용된다(SPEC '선택, 기본값 40시간')", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "10320",
      weeklyHours: "",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.weeklyHours).toBe(DEFAULT_WEEKLY_HOURS);
    expect(result.data.weeklyHours).toBe(40);
  });

  it("weeklyHours 필드 자체가 없어도(undefined) 기본값 40이 적용된다", () => {
    const result = validateMinimumWageCalculatorInput({ mode: "HOURLY", hourlyWage: "10320" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.weeklyHours).toBe(40);
  });

  it("hourlyWage 상한(1,000,000) 경계값은 통과한다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: String(MAX_HOURLY_WAGE),
      weeklyHours: "40",
    });
    expect(result.success).toBe(true);
  });

  it("weeklyHours 상한(168) 경계값은 통과한다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "10000",
      weeklyHours: String(MAX_WEEKLY_HOURS),
    });
    expect(result.success).toBe(true);
  });

  it("숫자 타입으로 직접 들어와도(폼 외 호출) 정규화된다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: 10_320,
      weeklyHours: 40,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ mode: "HOURLY", hourlyWage: 10_320, weeklyHours: 40 });
  });
});

describe("validateMinimumWageCalculatorInput — 정상 입력(MONTHLY)", () => {
  it("정상 입력은 성공하고 숫자로 정규화된 데이터를 반환한다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "MONTHLY",
      monthlyWage: "2500000",
      weeklyHours: "40",
    });
    expect(result).toEqual({
      success: true,
      data: { mode: "MONTHLY", monthlyWage: 2_500_000, weeklyHours: 40 },
    });
  });

  it("monthlyWage 상한(10억 원) 경계값은 통과한다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "MONTHLY",
      monthlyWage: String(MAX_MONTHLY_WAGE),
      weeklyHours: "40",
    });
    expect(result.success).toBe(true);
  });

  it("monthlyWage 상한 초과(10억 원 + 1원)는 오류다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "MONTHLY",
      monthlyWage: String(MAX_MONTHLY_WAGE + 1),
      weeklyHours: "40",
    });
    expect(result.success).toBe(false);
  });

  it("HOURLY 모드 필드(hourlyWage)를 함께 보내도 MONTHLY 모드에서는 무시하고 monthlyWage만 검증한다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "MONTHLY",
      hourlyWage: "abc", // MONTHLY 모드에서는 검증 대상이 아니므로 무시되어야 한다.
      monthlyWage: "2500000",
      weeklyHours: "40",
    });
    expect(result.success).toBe(true);
  });
});

describe("validateMinimumWageCalculatorInput — mode 오류", () => {
  it("mode가 없으면 mode 필드 오류를 반환한다", () => {
    const result = validateMinimumWageCalculatorInput({ hourlyWage: "10320", weeklyHours: "40" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([
      { field: "mode", message: "계산 방향(시급 또는 월급)을 선택해 주세요." },
    ]);
  });

  it("mode가 HOURLY/MONTHLY가 아닌 임의 문자열이면 오류다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "YEARLY",
      hourlyWage: "10320",
      weeklyHours: "40",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0].field).toBe("mode");
  });
});

describe("validateMinimumWageCalculatorInput — FORMULA.md 입력 오류 예제 F1~F8", () => {
  it("F1: 시급 빈 값 → hourlyWage 오류", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "",
      weeklyHours: "40",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([{ field: "hourlyWage", message: "시급을 입력해 주세요." }]);
  });

  it("F2: 시급 0 → hourlyWage 오류(0보다 커야 함)", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "0",
      weeklyHours: "40",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([{ field: "hourlyWage", message: "시급은 0보다 커야 합니다." }]);
  });

  it("F3: 시급 음수 → hourlyWage 오류", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "-1000",
      weeklyHours: "40",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([{ field: "hourlyWage", message: "시급은 0보다 커야 합니다." }]);
  });

  it("F4: 시급 비현실적으로 큰 값(1억 원/시간) → 상한 초과 오류", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "100000000",
      weeklyHours: "40",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0].field).toBe("hourlyWage");
  });

  it("F5: 주 근무시간 0 → weeklyHours 오류(0시간보다 커야 함)", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "10320",
      weeklyHours: "0",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([
      { field: "weeklyHours", message: "주 근무시간은 0시간보다 커야 합니다." },
    ]);
  });

  it("F6: 주 근무시간 음수 → weeklyHours 오류", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "10320",
      weeklyHours: "-10",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([
      { field: "weeklyHours", message: "주 근무시간은 0시간보다 커야 합니다." },
    ]);
  });

  it("F7: 주 근무시간 168 초과(200) → weeklyHours 상한 오류", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "10320",
      weeklyHours: "200",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0].field).toBe("weeklyHours");
  });

  it("F8: 월급 모드, 월급 음수 → monthlyWage 오류", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "MONTHLY",
      monthlyWage: "-500000",
      weeklyHours: "40",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([{ field: "monthlyWage", message: "월급은 0보다 커야 합니다." }]);
  });
});

describe("validateMinimumWageCalculatorInput — MIN_WEEKLY_HOURS(1) 하한 방어 (ARCHITECTURE.md '4.')", () => {
  it("MIN_WEEKLY_HOURS는 1이다(FORMULA.md 원안 '>0'보다 좁힌 값)", () => {
    expect(MIN_WEEKLY_HOURS).toBe(1);
  });

  it("weeklyHours=1(경계, D1)은 통과한다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "10320",
      weeklyHours: "1",
    });
    expect(result.success).toBe(true);
  });

  it("weeklyHours=0.5(0보다 크지만 MIN_WEEKLY_HOURS 미만)는 오류다 — 0 나눗셈/0 환산 버그 방지", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "10320",
      weeklyHours: "0.5",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0].field).toBe("weeklyHours");
  });

  it("weeklyHours=0.096(Architect가 계산한 붕괴 임계값 부근)도 오류다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "10320",
      weeklyHours: "0.096",
    });
    expect(result.success).toBe(false);
  });
});

describe("validateMinimumWageCalculatorInput — 정수 전용 금액 필드", () => {
  it("hourlyWage 소수(10320.5)는 오류다(정수만 허용 — E1은 logic.ts 직접 호출로만 검증)", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "10320.5",
      weeklyHours: "40",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([{ field: "hourlyWage", message: "시급은 정수로 입력해 주세요." }]);
  });

  it("monthlyWage 소수는 오류다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "MONTHLY",
      monthlyWage: "2500000.5",
      weeklyHours: "40",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([{ field: "monthlyWage", message: "월급은 정수로 입력해 주세요." }]);
  });
});

describe("validateMinimumWageCalculatorInput — 숫자 아닌 문자열 방어", () => {
  it("hourlyWage 16진수 표기 문자열은 숫자 아님 오류다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "0x10",
      weeklyHours: "40",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([{ field: "hourlyWage", message: "시급은 숫자로 입력해 주세요." }]);
  });

  it("hourlyWage 지수 표기 문자열은 숫자 아님 오류다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "1e7",
      weeklyHours: "40",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([{ field: "hourlyWage", message: "시급은 숫자로 입력해 주세요." }]);
  });

  it("weeklyHours 공백 문자열은 빈 값으로 취급해 기본값 40이 적용된다(오류 아님)", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "10320",
      weeklyHours: "   ",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.weeklyHours).toBe(40);
  });

  it("weeklyHours 숫자 아닌 문자열('풀타임')은 오류다", () => {
    const result = validateMinimumWageCalculatorInput({
      mode: "HOURLY",
      hourlyWage: "10320",
      weeklyHours: "풀타임",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors).toEqual([
      { field: "weeklyHours", message: "주 근무시간은 숫자로 입력해 주세요." },
    ]);
  });
});
