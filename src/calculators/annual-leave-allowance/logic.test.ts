import { describe, expect, it } from "vitest";
import { parseIsoDateUtc } from "@/src/lib/date-calc";
import {
  calculateAccruedDays,
  calculateAllowance,
  calculateAnnualLeaveAllowance,
  calculateMinimumWageReference,
  calculateUnusedDays,
  determineContinuousServiceRegime,
} from "./logic";
import type { AnnualLeaveAllowanceInput } from "./types";

function d(iso: string): Date {
  const parsed = parseIsoDateUtc(iso);
  if (!parsed) throw new Error(`invalid date in test: ${iso}`);
  return parsed;
}

/**
 * Golden Test — tasks/annual-leave-allowance/FORMULA.md "검증 예제" 17개(예제 17은 입력
 * 오류 경로라 validation.ts가 담당 — validation.test.ts 참고, logic.ts 자체는 날짜 순서를
 * 검증하지 않는다) 전부 + tasks/annual-leave-allowance/ARCHITECTURE.md "1.6"이 Calculation
 * Auditor 인계용으로 요구한 반례 2건(월말 clamp, 윤년 clamp)을 그대로 구현한다.
 */
describe("calculateAnnualLeaveAllowance — FORMULA.md 검증 예제 1~16", () => {
  it("예제 1 — 입사 1개월차(발생일수만, 부분 입력)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2025-06-01",
      referenceDate: "2025-07-01",
      usedDays: 0,
    });
    expect(result.continuousServiceRegime).toBe("UNDER_1YEAR");
    expect(result.accruedDays).toBe(1);
    expect(result.unusedDays).toBe(1);
    expect(result.allowance).toBeUndefined();
  });

  it("예제 2 — 입사 6개월차", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2025-01-15",
      referenceDate: "2025-07-15",
      usedDays: 1,
    });
    expect(result.accruedDays).toBe(6);
    expect(result.unusedDays).toBe(5);
  });

  it("예제 3 — 입사 11개월차(1년 미만 상한 11일 도달)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2025-01-15",
      referenceDate: "2025-12-15",
      usedDays: 0,
    });
    expect(result.accruedDays).toBe(11);
  });

  it("예제 4 — 만 1년 하루 전에도 11일 유지(아직 26일로 넘어가지 않음)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-14",
      usedDays: 0,
    });
    expect(result.continuousServiceRegime).toBe("UNDER_1YEAR");
    expect(result.accruedDays).toBe(11);
  });

  it("예제 5 — 정확히 1년 시점(핵심 경계: 11+15=26, 제60조③ 삭제 효과)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      usedDays: 0,
      ordinaryDailyWage: 50_000,
    });
    expect(result.continuousServiceRegime).toBe("YEAR_1_TO_2");
    expect(result.accruedDays).toBe(26);
    expect(result.unusedDays).toBe(26);
    expect(result.allowance?.unusedLeaveAllowance).toBe(1_300_000);
  });

  it("예제 6 — 1년 도달 직후(1년+1일)에도 26 유지", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-16",
      usedDays: 0,
    });
    expect(result.continuousServiceRegime).toBe("YEAR_1_TO_2");
    expect(result.accruedDays).toBe(26);
  });

  it("예제 7 — 정확히 2년 시점(26 → 15로 전환되는 경계)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2025-01-15",
      referenceDate: "2027-01-15",
      usedDays: 0,
    });
    expect(result.continuousServiceRegime).toBe("OVER_2YEARS");
    expect(result.accruedDays).toBe(15);
  });

  it("예제 8 — 3년 시점(가산 시작 경계)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2023-03-10",
      referenceDate: "2026-03-10",
      usedDays: 5,
      ordinaryDailyWage: 90_000,
    });
    expect(result.accruedDays).toBe(16);
    expect(result.unusedDays).toBe(11);
    expect(result.allowance?.unusedLeaveAllowance).toBe(990_000);
  });

  it("예제 9 — 5년 시점", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2021-08-01",
      referenceDate: "2026-08-01",
      usedDays: 0,
    });
    expect(result.accruedDays).toBe(17);
  });

  it("예제 10 — 21년 시점(25일 상한 최초 도달)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2005-09-01",
      referenceDate: "2026-09-01",
      usedDays: 0,
    });
    expect(result.accruedDays).toBe(25);
    if (result.continuousServiceRegime === "OVER_2YEARS") {
      expect(result.accrualBreakdown.cappedAtMax).toBe(false);
      expect(result.accrualBreakdown.rawTotalDays).toBe(25);
    }
  });

  it("예제 11 — 22년 시점(상한 유지, 정수 나눗셈 특성상 21년차와 동일값)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2004-09-01",
      referenceDate: "2026-09-01",
      usedDays: 0,
    });
    expect(result.accruedDays).toBe(25);
    if (result.continuousServiceRegime === "OVER_2YEARS") {
      expect(result.accrualBreakdown.cappedAtMax).toBe(false);
    }
  });

  it("예제 12 — 23년 시점(25일 상한 캡이 실제로 작동하는 최초 지점)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2003-09-01",
      referenceDate: "2026-09-01",
      usedDays: 0,
    });
    expect(result.accruedDays).toBe(25);
    if (result.continuousServiceRegime === "OVER_2YEARS") {
      expect(result.accrualBreakdown.rawTotalDays).toBe(26);
      expect(result.accrualBreakdown.cappedAtMax).toBe(true);
    }
  });

  it("예제 13 — 사용일수 = 발생일수(미사용 0)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2023-03-10",
      referenceDate: "2026-03-10",
      usedDays: 16,
      ordinaryDailyWage: 100_000,
    });
    expect(result.accruedDays).toBe(16);
    expect(result.unusedDays).toBe(0);
    expect(result.allowance?.unusedLeaveAllowance).toBe(0);
    expect(result.usedMoreThanAccruedWarning).toBe(false);
  });

  it("예제 14 — 사용일수가 발생일수 초과(음수 방어 + 경고 플래그)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2025-01-15",
      referenceDate: "2027-01-15",
      usedDays: 20,
      ordinaryDailyWage: 80_000,
    });
    expect(result.accruedDays).toBe(15);
    expect(result.unusedDays).toBe(0);
    expect(result.usedMoreThanAccruedWarning).toBe(true);
    expect(result.allowance?.unusedLeaveAllowance).toBe(0);
  });

  it("예제 15 — 1일 통상임금 미입력(부분 입력, 발생일수까지만)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2021-08-01",
      referenceDate: "2026-08-01",
      usedDays: 3,
    });
    expect(result.accruedDays).toBe(17);
    expect(result.unusedDays).toBe(14);
    expect(result.allowance).toBeUndefined();
    expect(result.minimumWageReference).toBeUndefined();
  });

  it("예제 16 — 최저임금 환산 미만 참고 경고(Should Have)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2023-03-10",
      referenceDate: "2026-03-10",
      usedDays: 5,
      ordinaryDailyWage: 60_000,
    });
    expect(result.accruedDays).toBe(16);
    expect(result.unusedDays).toBe(11);
    expect(result.allowance?.unusedLeaveAllowance).toBe(660_000);
    expect(result.minimumWageReference).toEqual({
      year: 2026,
      dailyReferenceAmount: 82_560,
      belowMinimumWageReference: true,
    });
  });
});

describe("calculateAnnualLeaveAllowance — Architect 반례 2건(Calculation Auditor 인계, ARCHITECTURE.md '1.6')", () => {
  it("반례 A — hireDate=2025-01-31, referenceDate=2025-02-28 → completedMonths=1 (월말 clamp 검증, 기존 공용 유틸 재사용 시 0이 나오는 것과 다름을 증명)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2025-01-31",
      referenceDate: "2025-02-28",
      usedDays: 0,
    });
    expect(result.continuousServiceRegime).toBe("UNDER_1YEAR");
    if (result.continuousServiceRegime === "UNDER_1YEAR") {
      expect(result.completedMonths).toBe(1);
    }
    expect(result.accruedDays).toBe(1);
  });

  it("반례 B — hireDate=2024-02-29(윤년), referenceDate=2025-02-28 → completedYears=1, regime=YEAR_1_TO_2, accruedDays=26 (평년 anniversary clamp 검증)", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2024-02-29",
      referenceDate: "2025-02-28",
      usedDays: 0,
    });
    expect(result.completedYears).toBe(1);
    expect(result.continuousServiceRegime).toBe("YEAR_1_TO_2");
    expect(result.accruedDays).toBe(26);
  });
});

describe("determineContinuousServiceRegime", () => {
  it("경계값 0/1/2년을 정확히 분류한다", () => {
    expect(determineContinuousServiceRegime(d("2025-01-15"), d("2025-01-15"))).toEqual({
      continuousServiceRegime: "UNDER_1YEAR",
      completedYears: 0,
    });
    expect(determineContinuousServiceRegime(d("2025-01-15"), d("2026-01-15"))).toEqual({
      continuousServiceRegime: "YEAR_1_TO_2",
      completedYears: 1,
    });
    expect(determineContinuousServiceRegime(d("2025-01-15"), d("2027-01-15"))).toEqual({
      continuousServiceRegime: "OVER_2YEARS",
      completedYears: 2,
    });
  });
});

describe("calculateAccruedDays", () => {
  it("UNDER_1YEAR — min(completedMonths, 11)", () => {
    expect(calculateAccruedDays("UNDER_1YEAR", 0, 0)).toEqual({
      continuousServiceRegime: "UNDER_1YEAR",
      completedMonths: 0,
      accruedDays: 0,
    });
    expect(calculateAccruedDays("UNDER_1YEAR", 11, 0)).toEqual({
      continuousServiceRegime: "UNDER_1YEAR",
      completedMonths: 11,
      accruedDays: 11,
    });
  });

  it("YEAR_1_TO_2 — 항상 26 고정", () => {
    expect(calculateAccruedDays("YEAR_1_TO_2", 0, 1)).toEqual({
      continuousServiceRegime: "YEAR_1_TO_2",
      accruedDays: 26,
    });
  });

  it("OVER_2YEARS — N=2..23 전체 스윕으로 yearlyGrant(N)=min(15+floor((N-1)/2),25) 검증", () => {
    const expected: Record<number, number> = {
      2: 15,
      3: 16,
      4: 16,
      5: 17,
      6: 17,
      7: 18,
      8: 18,
      9: 19,
      10: 19,
      11: 20,
      12: 20,
      13: 21,
      14: 21,
      15: 22,
      16: 22,
      17: 23,
      18: 23,
      19: 24,
      20: 24,
      21: 25,
      22: 25,
      23: 25,
    };
    for (const [yearsStr, accruedDays] of Object.entries(expected)) {
      const years = Number(yearsStr);
      const calc = calculateAccruedDays("OVER_2YEARS", 0, years);
      expect(calc.accruedDays, `N=${years}`).toBe(accruedDays);
      if (calc.continuousServiceRegime === "OVER_2YEARS") {
        expect(calc.accrualBreakdown.cappedAtMax, `N=${years} cappedAtMax`).toBe(years >= 23);
      }
    }
  });
});

describe("calculateUnusedDays", () => {
  it("정상 케이스 — 발생일수 - 사용일수", () => {
    expect(calculateUnusedDays(15, 5)).toEqual({ unusedDays: 10, usedMoreThanAccruedWarning: false });
  });

  it("사용일수가 발생일수와 정확히 같으면 0, 경고 없음", () => {
    expect(calculateUnusedDays(10, 10)).toEqual({ unusedDays: 0, usedMoreThanAccruedWarning: false });
  });

  it("사용일수가 발생일수를 초과하면 0으로 방어하고 경고 플래그를 세운다", () => {
    expect(calculateUnusedDays(10, 12)).toEqual({ unusedDays: 0, usedMoreThanAccruedWarning: true });
  });

  it("반차 등 소수 사용일수를 그대로 반영한다", () => {
    expect(calculateUnusedDays(15, 4.5)).toEqual({ unusedDays: 10.5, usedMoreThanAccruedWarning: false });
  });
});

describe("calculateAllowance", () => {
  it("정수 곱셈은 그대로 반환한다", () => {
    expect(calculateAllowance(26, 50_000)).toEqual({ ordinaryDailyWage: 50_000, unusedLeaveAllowance: 1_300_000 });
  });

  it("unusedDays=0이면 금액도 0이다", () => {
    expect(calculateAllowance(0, 100_000)).toEqual({ ordinaryDailyWage: 100_000, unusedLeaveAllowance: 0 });
  });

  it("반차(소수 unusedDays) 입력 시 최종 1회 사사오입한다", () => {
    // 10.5일 × 33,333원 = 349,996.5원 → 반올림 349,997원.
    expect(calculateAllowance(10.5, 33_333)).toEqual({
      ordinaryDailyWage: 33_333,
      unusedLeaveAllowance: 349_997,
    });
  });
});

describe("calculateMinimumWageReference", () => {
  it("2026년 rates 데이터로 최저임금 환산액(10,320원 × 8시간 = 82,560원)을 계산한다", () => {
    expect(calculateMinimumWageReference(60_000, d("2026-03-10"))).toEqual({
      year: 2026,
      dailyReferenceAmount: 82_560,
      belowMinimumWageReference: true,
    });
  });

  it("최저임금 이상이면 belowMinimumWageReference=false", () => {
    expect(calculateMinimumWageReference(100_000, d("2026-03-10"))).toEqual({
      year: 2026,
      dailyReferenceAmount: 82_560,
      belowMinimumWageReference: false,
    });
  });

  it("데이터가 없는 연도는 에러를 던지지 않고 undefined를 반환한다(ARCHITECTURE.md '6.' — Should Have 비차단 정책)", () => {
    expect(calculateMinimumWageReference(60_000, d("2030-01-01"))).toBeUndefined();
    expect(calculateMinimumWageReference(60_000, d("1999-01-01"))).toBeUndefined();
  });
});

describe("calculateAnnualLeaveAllowance — 부분 입력/기본값 처리", () => {
  it("usedDays 미입력 시 0으로 처리한다", () => {
    const input: AnnualLeaveAllowanceInput = { hireDate: "2025-06-01", referenceDate: "2025-07-01" };
    const result = calculateAnnualLeaveAllowance(input);
    expect(result.usedDays).toBe(0);
    expect(result.unusedDays).toBe(result.accruedDays);
  });

  it("ordinaryDailyWage=0을 명시적으로 입력하면(미입력이 아니라 0원) allowance가 존재하되 금액은 0이다", () => {
    const result = calculateAnnualLeaveAllowance({
      hireDate: "2025-01-15",
      referenceDate: "2026-01-15",
      ordinaryDailyWage: 0,
    });
    expect(result.allowance).toBeDefined();
    expect(result.allowance?.unusedLeaveAllowance).toBe(0);
  });

  it("hireDate === referenceDate(입사 당일 조회)는 정상 계산 경로다(completedMonths=0, accruedDays=0)", () => {
    const result = calculateAnnualLeaveAllowance({ hireDate: "2025-05-01", referenceDate: "2025-05-01" });
    expect(result.continuousServiceRegime).toBe("UNDER_1YEAR");
    if (result.continuousServiceRegime === "UNDER_1YEAR") {
      expect(result.completedMonths).toBe(0);
    }
    expect(result.accruedDays).toBe(0);
    expect(result.unusedDays).toBe(0);
  });
});
