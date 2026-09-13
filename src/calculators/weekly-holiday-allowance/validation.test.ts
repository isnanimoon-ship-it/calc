/**
 * 주휴수당 계산기 — 입력 검증 Edge Case Test.
 *
 * FORMULA.md "입력값" 표 / "예외" 절, SPEC.md "입력 오류/극단값 방어" 대응.
 * 핵심 검증 포인트(FORMULA.md "예외"):
 * - 순수 입력 오류(빈 값 / 0 / 음수 / 숫자 아님 / 상한 초과)만 막는다.
 * - 15시간 미만 / 40시간 초과 / 최저임금 미만은 **오류가 아니다** — 계산 진행(logic 결과 플래그로 경고).
 * - hourlyWage는 정수만, weeklyHours는 소수 허용(0.5 배수 강제 안 함).
 */

import { describe, expect, it } from "vitest";
import {
  MAX_HOURLY_WAGE,
  MAX_WEEKLY_HOURS,
  validateWeeklyHolidayAllowanceInput,
} from "./validation";

describe("validateWeeklyHolidayAllowanceInput — 정상 입력", () => {
  it("정상 입력은 성공하고 숫자로 정규화된 데이터를 반환한다", () => {
    const result = validateWeeklyHolidayAllowanceInput({
      hourlyWage: "10320",
      weeklyHours: "40",
    });
    expect(result).toEqual({
      success: true,
      data: { hourlyWage: 10_320, weeklyHours: 40 },
    });
  });

  it("시급의 실시간 천 단위 콤마를 제거하고 파싱한다", () => {
    const result = validateWeeklyHolidayAllowanceInput({
      hourlyWage: "1,000,000",
      weeklyHours: "20",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.hourlyWage).toBe(1_000_000);
  });

  it("weeklyHours 소수(13.5) 입력을 허용한다", () => {
    const result = validateWeeklyHolidayAllowanceInput({
      hourlyWage: "11000",
      weeklyHours: "13.5",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.weeklyHours).toBe(13.5);
  });

  it("weeklyHours 0.5 배수가 아닌 소수(13.3)도 허용한다(step은 UI 힌트일 뿐)", () => {
    const result = validateWeeklyHolidayAllowanceInput({
      hourlyWage: "11000",
      weeklyHours: "13.3",
    });
    expect(result.success).toBe(true);
  });

  it("weeklyHours 상한(168) 경계값은 통과한다", () => {
    const result = validateWeeklyHolidayAllowanceInput({
      hourlyWage: "10000",
      weeklyHours: String(MAX_WEEKLY_HOURS),
    });
    expect(result.success).toBe(true);
  });

  it("hourlyWage 상한(1,000,000) 경계값은 통과한다", () => {
    const result = validateWeeklyHolidayAllowanceInput({
      hourlyWage: String(MAX_HOURLY_WAGE),
      weeklyHours: "40",
    });
    expect(result.success).toBe(true);
  });
});

describe("validateWeeklyHolidayAllowanceInput — 오류로 막는 입력", () => {
  const cases: Array<{
    name: string;
    hourlyWage: string;
    weeklyHours: string;
    field: "hourlyWage" | "weeklyHours";
    message: string;
  }> = [
    {
      name: "시급 빈 값",
      hourlyWage: "",
      weeklyHours: "40",
      field: "hourlyWage",
      message: "시급을 입력해 주세요.",
    },
    {
      name: "시급 공백 문자열(Number 조용한 0 둔갑 방지)",
      hourlyWage: "   ",
      weeklyHours: "40",
      field: "hourlyWage",
      message: "시급을 입력해 주세요.",
    },
    {
      name: "시급 숫자 아님",
      hourlyWage: "abc",
      weeklyHours: "40",
      field: "hourlyWage",
      message: "시급은 숫자로 입력해 주세요.",
    },
    {
      name: "시급 0",
      hourlyWage: "0",
      weeklyHours: "40",
      field: "hourlyWage",
      message: "시급은 0보다 커야 합니다.",
    },
    {
      name: "시급 음수",
      hourlyWage: "-5000",
      weeklyHours: "40",
      field: "hourlyWage",
      message: "시급은 0보다 커야 합니다.",
    },
    {
      name: "시급 소수(비정수)",
      hourlyWage: "10320.5",
      weeklyHours: "40",
      field: "hourlyWage",
      message: "시급은 정수로 입력해 주세요.",
    },
    {
      name: "시급 상한 초과",
      hourlyWage: "1000001",
      weeklyHours: "40",
      field: "hourlyWage",
      message: "시급은 1,000,000원 이하로 입력해 주세요.",
    },
    {
      name: "시급 16진수 표기 문자열(QA-L3)",
      hourlyWage: "0x10",
      weeklyHours: "40",
      field: "hourlyWage",
      message: "시급은 숫자로 입력해 주세요.",
    },
    {
      name: "시급 지수 표기 문자열(QA-L3)",
      hourlyWage: "1e7",
      weeklyHours: "40",
      field: "hourlyWage",
      message: "시급은 숫자로 입력해 주세요.",
    },
    {
      name: "주 근무시간 빈 값",
      hourlyWage: "10320",
      weeklyHours: "",
      field: "weeklyHours",
      message: "주 근무시간을 입력해 주세요.",
    },
    {
      name: "주 근무시간 숫자 아님",
      hourlyWage: "10320",
      weeklyHours: "풀타임",
      field: "weeklyHours",
      message: "주 근무시간은 숫자로 입력해 주세요.",
    },
    {
      name: "주 근무시간 0",
      hourlyWage: "10320",
      weeklyHours: "0",
      field: "weeklyHours",
      message: "주 근무시간은 0보다 커야 합니다.",
    },
    {
      name: "주 근무시간 음수",
      hourlyWage: "10320",
      weeklyHours: "-10",
      field: "weeklyHours",
      message: "주 근무시간은 0보다 커야 합니다.",
    },
    {
      name: "주 근무시간 168 초과",
      hourlyWage: "10320",
      weeklyHours: "168.5",
      field: "weeklyHours",
      message: "주 근무시간은 168시간 이하로 입력해 주세요. (1주는 168시간입니다)",
    },
    {
      name: "주 근무시간 비현실적으로 큰 값",
      hourlyWage: "10320",
      weeklyHours: "1000",
      field: "weeklyHours",
      message: "주 근무시간은 168시간 이하로 입력해 주세요. (1주는 168시간입니다)",
    },
    {
      name: "주 근무시간 지수 표기 문자열(QA-L3)",
      hourlyWage: "10320",
      weeklyHours: "1e3",
      field: "weeklyHours",
      message: "주 근무시간은 숫자로 입력해 주세요.",
    },
  ];

  for (const c of cases) {
    it(`${c.name} → ${c.field} 오류`, () => {
      const result = validateWeeklyHolidayAllowanceInput({
        hourlyWage: c.hourlyWage,
        weeklyHours: c.weeklyHours,
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      const err = result.errors.find((e) => e.field === c.field);
      expect(err?.message).toBe(c.message);
    });
  }

  it("두 필드가 모두 비어 있으면 두 오류를 모두 반환한다", () => {
    const result = validateWeeklyHolidayAllowanceInput({});
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.map((e) => e.field).sort()).toEqual([
      "hourlyWage",
      "weeklyHours",
    ]);
  });
});

describe("validateWeeklyHolidayAllowanceInput — 오류가 아닌 것(계산 진행)", () => {
  it("15시간 미만은 오류가 아니다(경고는 logic 결과 플래그로)", () => {
    const result = validateWeeklyHolidayAllowanceInput({
      hourlyWage: "10320",
      weeklyHours: "10",
    });
    expect(result.success).toBe(true);
  });

  it("정확히 15시간도 통과한다", () => {
    const result = validateWeeklyHolidayAllowanceInput({
      hourlyWage: "12000",
      weeklyHours: "15",
    });
    expect(result.success).toBe(true);
  });

  it("14.99시간도 통과한다(소수 경계, 오류 아님)", () => {
    const result = validateWeeklyHolidayAllowanceInput({
      hourlyWage: "12000",
      weeklyHours: "14.99",
    });
    expect(result.success).toBe(true);
  });

  it("40시간 초과는 오류가 아니다(logic이 8시간 상한 처리)", () => {
    const result = validateWeeklyHolidayAllowanceInput({
      hourlyWage: "15000",
      weeklyHours: "48",
    });
    expect(result.success).toBe(true);
  });

  it("최저임금 미만 시급은 오류가 아니다(참고 경고만)", () => {
    const result = validateWeeklyHolidayAllowanceInput({
      hourlyWage: "9000",
      weeklyHours: "16",
    });
    expect(result.success).toBe(true);
  });

  it("숫자 타입으로 직접 들어와도(폼 외 호출) 정규화된다", () => {
    const result = validateWeeklyHolidayAllowanceInput({
      hourlyWage: 10_320,
      weeklyHours: 40,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ hourlyWage: 10_320, weeklyHours: 40 });
  });
});
