import { describe, expect, it } from "vitest";
import {
  getMaxAllowedDate,
  MAX_ORDINARY_DAILY_WAGE,
  MAX_USED_DAYS,
  MIN_ALLOWED_DATE,
  validateAnnualLeaveAllowanceInput,
} from "./validation";

describe("validateAnnualLeaveAllowanceInput — 정상 입력", () => {
  it("필수값(hireDate)만 입력해도 통과한다(referenceDate도 필수지만 ui.tsx가 기본값 오늘을 채워 넘긴다)", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        hireDate: "2025-01-15",
        referenceDate: "2026-01-15",
        usedDays: undefined,
        ordinaryDailyWage: undefined,
      });
    }
  });

  it("모든 필드를 입력하면 그대로 파싱된다(콤마 포함 금액 허용)", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      usedDays: "4.5",
      ordinaryDailyWage: "50,000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.usedDays).toBe(4.5);
      expect(result.data.ordinaryDailyWage).toBe(50_000);
    }
  });

  it("hireDate === referenceDate(입사 당일 조회)는 오류가 아니다", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-05-01",
      referenceDate: "2025-05-01",
    });
    expect(result.success).toBe(true);
  });

  it("usedDays=0을 명시적으로 입력해도 통과한다(0은 유효한 값)", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      usedDays: "0",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.usedDays).toBe(0);
  });

  it("숫자 타입(문자열이 아님) 입력도 그대로 허용한다", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      usedDays: 3,
      ordinaryDailyWage: 90000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.usedDays).toBe(3);
      expect(result.data.ordinaryDailyWage).toBe(90000);
    }
  });
});

describe("validateAnnualLeaveAllowanceInput — 필수값/형식 오류", () => {
  it("hireDate 미입력", () => {
    const result = validateAnnualLeaveAllowanceInput({ referenceDate: "2026-01-15" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "hireDate")).toBe(true);
    }
  });

  it("referenceDate 미입력", () => {
    const result = validateAnnualLeaveAllowanceInput({ hireDate: "2025-01-15" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "referenceDate")).toBe(true);
    }
  });

  it("존재하지 않는 달력 날짜(2024-02-30)는 거부한다", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2024-02-30",
      referenceDate: "2026-01-15",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "hireDate")).toBe(true);
    }
  });

  it("형식이 아예 다른 문자열은 거부한다", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025/01/15",
      referenceDate: "2026-01-15",
    });
    expect(result.success).toBe(false);
  });
});

describe("validateAnnualLeaveAllowanceInput — 예제 17: 기준일이 입사일보다 이전(입력 오류 경로)", () => {
  it("FORMULA.md 예제 17 — hireDate=2026-06-01, referenceDate=2026-01-01 → 오류", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2026-06-01",
      referenceDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "referenceDate")).toBe(true);
      expect(result.errors.find((e) => e.field === "referenceDate")?.message).toBe(
        "기준일은 입사일 이후여야 합니다.",
      );
    }
  });
});

describe("validateAnnualLeaveAllowanceInput — 날짜 허용 범위(MIN_ALLOWED_DATE/getMaxAllowedDate)", () => {
  it("MIN_ALLOWED_DATE 이전 입사일은 거부한다", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "1969-12-31",
      referenceDate: "2026-01-15",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "hireDate")).toBe(true);
    }
  });

  it("MIN_ALLOWED_DATE 정확히는 허용한다", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: MIN_ALLOWED_DATE,
      referenceDate: "2026-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("getMaxAllowedDate()를 넘는 기준일은 거부한다", () => {
    const tooFar = new Date(getMaxAllowedDate());
    tooFar.setUTCDate(tooFar.getUTCDate() + 1);
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2020-01-01",
      referenceDate: tooFar.toISOString().slice(0, 10),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === "referenceDate")).toBe(true);
    }
  });

  it("getMaxAllowedDate() 정확히는 허용한다(SPEC.md — 미래 시점 조회 자체는 허용)", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2020-01-01",
      referenceDate: getMaxAllowedDate(),
    });
    expect(result.success).toBe(true);
  });
});

describe("validateAnnualLeaveAllowanceInput — usedDays 검증", () => {
  it("음수는 거부한다", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      usedDays: "-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "usedDays")).toBe(true);
  });

  it("숫자가 아닌 값은 거부한다", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      usedDays: "abc",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "usedDays")).toBe(true);
  });

  it(`상한(${MAX_USED_DAYS}일)을 초과하면 거부한다`, () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      usedDays: String(MAX_USED_DAYS + 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "usedDays")).toBe(true);
  });

  it("빈 문자열은 미입력(undefined)으로 처리하고 통과시킨다", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      usedDays: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.usedDays).toBeUndefined();
  });

  it("공백만 있는 문자열도 미입력으로 처리한다(Number('   ')===0 함정 방지)", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      usedDays: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.usedDays).toBeUndefined();
  });
});

describe("validateAnnualLeaveAllowanceInput — ordinaryDailyWage 검증", () => {
  it("음수는 거부한다", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      ordinaryDailyWage: "-1000",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "ordinaryDailyWage")).toBe(true);
  });

  it("숫자가 아닌 값은 거부한다", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      ordinaryDailyWage: "many",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "ordinaryDailyWage")).toBe(true);
  });

  it(`상한(${MAX_ORDINARY_DAILY_WAGE.toLocaleString("ko-KR")}원)을 초과하면 거부한다`, () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      ordinaryDailyWage: String(MAX_ORDINARY_DAILY_WAGE + 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.some((e) => e.field === "ordinaryDailyWage")).toBe(true);
  });

  it("미입력은 undefined로 처리하고 통과시킨다(SPEC.md 부분 입력 허용)", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      ordinaryDailyWage: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ordinaryDailyWage).toBeUndefined();
  });

  it("0원은 유효한 명시적 입력이다(미입력과 다름)", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      ordinaryDailyWage: "0",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ordinaryDailyWage).toBe(0);
  });
});

describe("validateAnnualLeaveAllowanceInput — 여러 필드 동시 오류", () => {
  it("hireDate/usedDays/ordinaryDailyWage가 동시에 잘못되면 3개 오류를 모두 반환한다", () => {
    const result = validateAnnualLeaveAllowanceInput({
      hireDate: "",
      referenceDate: "2026-01-15",
      usedDays: "-5",
      ordinaryDailyWage: "-100",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.errors.map((e) => e.field).sort();
      expect(fields).toEqual(["hireDate", "ordinaryDailyWage", "usedDays"]);
    }
  });
});
