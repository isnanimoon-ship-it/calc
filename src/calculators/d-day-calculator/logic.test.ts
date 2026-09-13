import { describe, expect, it } from "vitest";
import { calculateDateShift, calculateDday, computeWeeksBreakdown } from "./logic";

/**
 * FORMULA.md Golden Test 26개 — 3그룹(모드 A #1~15, 모드 B #16~24, 역함수 #25~26)을
 * `describe`로 그대로 옮긴다(tasks/d-day-calculator/ARCHITECTURE.md "6.").
 *
 * 이 계산기는 법령·고시가 아니라 그레고리력 규칙(ISO 8601 윤년 규칙) + Zeller's Congruence
 * (요일) + Howard Hinnant `days_from_civil`/`civil_from_days` 알고리즘(대규모 날짜 이동)으로
 * 교차검증한 값을 출처로 삼는다(FORMULA.md "공식 출처"). 순수 날짜 산술 원자 함수
 * (`addDaysUtc`/`weekdayUtc`/`formatIsoDateUtc`) 자체의 계약 테스트는 이미
 * `src/lib/date-calc.test.ts`에 있으므로, 이 파일이 실패하면 "날짜 산술 자체의 문제"가
 * 아니라 "모드 조립(라벨 분기, 범위 재검증 등) 로직의 문제"로 원인을 좁혀 볼 수 있다.
 */

describe("calculateDday — 모드 A: 날짜 차이 (FORMULA.md Golden Test #1~#15)", () => {
  it("#1 시작일=목표일(2026-09-12) → D-Day, 차이 0", () => {
    const result = calculateDday({ startDate: "2026-09-12", targetDate: "2026-09-12" });
    expect(result.ddayLabel).toBe("D-Day");
    expect(result.diffDays).toBe(0);
    expect(result.weeksBreakdown).toBeNull();
  });

  it("#2 시작일 2026-09-12, 목표일 2026-09-13 → D-1", () => {
    const result = calculateDday({ startDate: "2026-09-12", targetDate: "2026-09-13" });
    expect(result.ddayLabel).toBe("D-1");
    expect(result.diffDays).toBe(1);
  });

  it("#3 시작일 2026-09-12, 목표일 2026-09-11 → D+1", () => {
    const result = calculateDday({ startDate: "2026-09-12", targetDate: "2026-09-11" });
    expect(result.ddayLabel).toBe("D+1");
    expect(result.diffDays).toBe(-1);
  });

  it("#4 시작일 2026-09-12, 목표일 2026-12-25 → D-104, 목표일 요일 금요일, 주 환산 14주 6일 후", () => {
    const result = calculateDday({ startDate: "2026-09-12", targetDate: "2026-12-25" });
    expect(result.ddayLabel).toBe("D-104");
    expect(result.diffDays).toBe(104);
    expect(result.targetWeekday).toBe(5); // 금요일
    expect(result.weeksBreakdown).toEqual({ weeks: 14, remainderDays: 6 });
  });

  it("#5 시작일 2026-09-12, 목표일 2026-01-01 → D+254, 목표일 요일 목요일, 주 환산 36주 2일 전", () => {
    const result = calculateDday({ startDate: "2026-09-12", targetDate: "2026-01-01" });
    expect(result.ddayLabel).toBe("D+254");
    expect(result.diffDays).toBe(-254);
    expect(result.targetWeekday).toBe(4); // 목요일
    expect(result.weeksBreakdown).toEqual({ weeks: 36, remainderDays: 2 });
  });

  it("#6 연말→연초 경계: 시작일 2026-12-31, 목표일 2027-01-01 → D-1", () => {
    const result = calculateDday({ startDate: "2026-12-31", targetDate: "2027-01-01" });
    expect(result.ddayLabel).toBe("D-1");
  });

  it("#7 시작일 1900-02-28, 목표일 1900-03-01 → D-1(1900년은 100년 규칙에 따라 평년)", () => {
    const result = calculateDday({ startDate: "1900-02-28", targetDate: "1900-03-01" });
    expect(result.ddayLabel).toBe("D-1");
  });

  it("#8 시작일 2000-02-28, 목표일 2000-03-01 → D-2(2000년은 400년 규칙에 따라 윤년)", () => {
    const result = calculateDday({ startDate: "2000-02-28", targetDate: "2000-03-01" });
    expect(result.ddayLabel).toBe("D-2");
  });

  it("#9 시작일 2024-02-28, 목표일 2024-03-01 → D-2(윤년)", () => {
    const result = calculateDday({ startDate: "2024-02-28", targetDate: "2024-03-01" });
    expect(result.ddayLabel).toBe("D-2");
  });

  it("#10 시작일 2028-02-28, 목표일 2028-03-01 → D-2(미래 윤년)", () => {
    const result = calculateDday({ startDate: "2028-02-28", targetDate: "2028-03-01" });
    expect(result.ddayLabel).toBe("D-2");
  });

  it("#11 시작일 2025-02-28, 목표일 2025-03-01 → D-1(평년, #9·#10과 대조)", () => {
    const result = calculateDday({ startDate: "2025-02-28", targetDate: "2025-03-01" });
    expect(result.ddayLabel).toBe("D-1");
  });

  it("#12 시작일=목표일=1900-01-01 → D-Day(지원 범위 하한 경계 자체가 유효 입력)", () => {
    const result = calculateDday({ startDate: "1900-01-01", targetDate: "1900-01-01" });
    expect(result.ddayLabel).toBe("D-Day");
  });

  it("#13 시작일=목표일=2200-12-31 → D-Day(지원 범위 상한 경계 자체가 유효 입력)", () => {
    const result = calculateDday({ startDate: "2200-12-31", targetDate: "2200-12-31" });
    expect(result.ddayLabel).toBe("D-Day");
  });

  it("#14 목표일 2201-01-01(지원 범위 초과) → 오류, 계산 거부", () => {
    expect(() =>
      calculateDday({ startDate: "2200-12-31", targetDate: "2201-01-01" }),
    ).toThrow();
  });

  it("#15 목표일 '2024-02-30'(존재하지 않는 날짜) → 오류", () => {
    expect(() =>
      calculateDday({ startDate: "2024-02-01", targetDate: "2024-02-30" }),
    ).toThrow();
  });

  // computeWeeksBreakdown — FORMULA.md "주 단위 환산" 공식 자체의 검증(#4·#5 값 포함).
  it("computeWeeksBreakdown: n=0 → null(당일이므로 표시하지 않음)", () => {
    expect(computeWeeksBreakdown(0)).toBeNull();
  });

  it("computeWeeksBreakdown: 7의 배수(n=14) → remainderDays 0", () => {
    expect(computeWeeksBreakdown(14)).toEqual({ weeks: 2, remainderDays: 0 });
  });

  it("computeWeeksBreakdown: n=6(1주 미만) → weeks 0", () => {
    expect(computeWeeksBreakdown(6)).toEqual({ weeks: 0, remainderDays: 6 });
  });

  it("computeWeeksBreakdown: n=104 → 14주 6일(FORMULA #4)", () => {
    expect(computeWeeksBreakdown(104)).toEqual({ weeks: 14, remainderDays: 6 });
  });

  it("computeWeeksBreakdown: n=254 → 36주 2일(FORMULA #5)", () => {
    expect(computeWeeksBreakdown(254)).toEqual({ weeks: 36, remainderDays: 2 });
  });
});

describe("calculateDateShift — 모드 B: 날짜 계산 (FORMULA.md Golden Test #16~#24)", () => {
  it("#16 기준일 2026-09-12, 일수 0, 더하기 → 결과 2026-09-12(요일 토요일), 정상(오류 아님)", () => {
    const result = calculateDateShift({ baseDate: "2026-09-12", days: 0, direction: "add" });
    expect(result.resultDate).toBe("2026-09-12");
    expect(result.resultWeekday).toBe(6); // 토요일
  });

  it("#17 기준일 2026-09-12, 일수 104, 더하기 → 결과 2026-12-25(요일 금요일)", () => {
    const result = calculateDateShift({ baseDate: "2026-09-12", days: 104, direction: "add" });
    expect(result.resultDate).toBe("2026-12-25");
    expect(result.resultWeekday).toBe(5); // 금요일
  });

  it("#18 기준일 2026-09-12, 일수 254, 빼기 → 결과 2026-01-01(요일 목요일)", () => {
    const result = calculateDateShift({ baseDate: "2026-09-12", days: 254, direction: "subtract" });
    expect(result.resultDate).toBe("2026-01-01");
    expect(result.resultWeekday).toBe(4); // 목요일
  });

  it("#19 기준일 2026-12-31, 일수 1, 더하기 → 결과 2027-01-01(연말→연초 경계)", () => {
    const result = calculateDateShift({ baseDate: "2026-12-31", days: 1, direction: "add" });
    expect(result.resultDate).toBe("2027-01-01");
  });

  it("#20 기준일 2024-02-28, 일수 2, 더하기 → 결과 2024-03-01(윤년 경계)", () => {
    const result = calculateDateShift({ baseDate: "2024-02-28", days: 2, direction: "add" });
    expect(result.resultDate).toBe("2024-03-01");
  });

  it("#21 기준일 2000-01-01, 일수 10,000, 더하기 → 결과 2027-05-19(Hinnant 알고리즘 교차검증)", () => {
    const result = calculateDateShift({ baseDate: "2000-01-01", days: 10_000, direction: "add" });
    expect(result.resultDate).toBe("2027-05-19");
  });

  it("#22 기준일 2200-12-31, 일수 100,000(상한 값), 빼기 → 결과 1927-03-18(지원 범위 안, 정상)", () => {
    const result = calculateDateShift({
      baseDate: "2200-12-31",
      days: 100_000,
      direction: "subtract",
    });
    expect(result.resultDate).toBe("1927-03-18");
  });

  it("#23 기준일 2000-01-01, 일수 100,000(상한 값), 더하기 → 산술 결과 2273-10-16은 지원 범위 초과이므로 오류(상한 통과와 결과 범위 검증은 별개)", () => {
    expect(() =>
      calculateDateShift({ baseDate: "2000-01-01", days: 100_000, direction: "add" }),
    ).toThrow();
  });

  it("#24 일수 100,001(상한 초과, 방향 무관) → 오류", () => {
    expect(() =>
      calculateDateShift({ baseDate: "2026-09-12", days: 100_001, direction: "add" }),
    ).toThrow();
    expect(() =>
      calculateDateShift({ baseDate: "2026-09-12", days: 100_001, direction: "subtract" }),
    ).toThrow();
  });
});

describe("모드 A ↔ 모드 B 역함수 불변식 (FORMULA.md Golden Test #25~#26, 완료 기준)", () => {
  it("#25 기준일 2026-09-12에 일수 104 더하기 → 2026-12-25, 모드 A(시작일=2026-09-12, 목표일=결과)에 넣으면 정확히 D-104(#4·#17과 값 일치)", () => {
    const shifted = calculateDateShift({ baseDate: "2026-09-12", days: 104, direction: "add" });
    expect(shifted.resultDate).toBe("2026-12-25");
    const dday = calculateDday({ startDate: "2026-09-12", targetDate: shifted.resultDate });
    expect(dday.ddayLabel).toBe("D-104");
  });

  it("#26 기준일 2026-09-12에서 일수 254 빼기 → 2026-01-01, 모드 A(시작일=2026-09-12, 목표일=결과)에 넣으면 정확히 D+254(#5·#18과 값 일치)", () => {
    const shifted = calculateDateShift({ baseDate: "2026-09-12", days: 254, direction: "subtract" });
    expect(shifted.resultDate).toBe("2026-01-01");
    const dday = calculateDday({ startDate: "2026-09-12", targetDate: shifted.resultDate });
    expect(dday.ddayLabel).toBe("D+254");
  });

  it("완료 기준 불변식: 임의의 N에 대해 add 후 diff는 항상 +N, subtract 후 diff는 항상 -N", () => {
    const base = "2050-06-15";
    for (const n of [0, 1, 7, 30, 365, 1000, 50_000]) {
      const added = calculateDateShift({ baseDate: base, days: n, direction: "add" });
      expect(calculateDday({ startDate: base, targetDate: added.resultDate }).diffDays).toBe(n);

      const subtracted = calculateDateShift({ baseDate: base, days: n, direction: "subtract" });
      // n=0일 때 -n은 부동소수점 음수 0(-0)이지만 diffDays는 항상 양의 0을 반환하므로
      // (Object.is 기반 toBe가 -0 !== 0으로 구분), 0은 그대로 0과 비교한다.
      expect(
        calculateDday({ startDate: base, targetDate: subtracted.resultDate }).diffDays,
      ).toBe(n === 0 ? 0 : -n);
    }
  });

  it("완료 기준 불변식: 시작일=목표일이면 항상 D-Day, 목표일이 미래면 D-N, 과거면 D+N", () => {
    expect(calculateDday({ startDate: "2030-05-05", targetDate: "2030-05-05" }).ddayLabel).toBe(
      "D-Day",
    );
    expect(calculateDday({ startDate: "2030-05-05", targetDate: "2030-05-10" }).ddayLabel).toBe(
      "D-5",
    );
    expect(calculateDday({ startDate: "2030-05-05", targetDate: "2030-04-30" }).ddayLabel).toBe(
      "D+5",
    );
  });
});
