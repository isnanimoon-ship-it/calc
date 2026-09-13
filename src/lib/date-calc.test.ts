import { describe, expect, it } from "vitest";
import {
  addDaysUtc,
  calendarFullMonthsBetweenUtc,
  calendarFullYearsBetweenUtc,
  diffDaysUtc,
  formatIsoDateUtc,
  parseIsoDateUtc,
  weekdayUtc,
} from "./date-calc";

/**
 * `calendarFullYearsBetweenUtc` / `calendarFullMonthsBetweenUtc` 계약 테스트.
 *
 * housing-subscription-score(청약가점 계산기) FORMULA.md가 제시한 예제 3·4·9·10·11·12를
 * 그대로 옮겼다 — 이 두 함수는 순수 날짜 산술이라 계산기 로직(logic.ts)과 독립적으로
 * 검증할 수 있고, 여기서 먼저 고정해 두면 Builder의 logic.test.ts Golden Test가 실패할 때
 * "날짜 산술 문제"와 "배점 로직 문제"를 바로 구분할 수 있다.
 */
function d(iso: string): Date {
  const parsed = parseIsoDateUtc(iso);
  if (!parsed) throw new Error(`invalid date: ${iso}`);
  return parsed;
}

describe("calendarFullYearsBetweenUtc", () => {
  it("정확히 1년 경계(FORMULA 예제 3): 만 1년 지났으면 1", () => {
    expect(calendarFullYearsBetweenUtc(d("2025-09-06"), d("2026-09-06"))).toBe(1);
  });

  it("만 1년 하루 전(FORMULA 예제 4): 아직 0", () => {
    expect(calendarFullYearsBetweenUtc(d("2025-09-06"), d("2026-09-05"))).toBe(0);
  });

  it("같은 날이면 0 (FORMULA 예제 1과 동일 성격)", () => {
    expect(calendarFullYearsBetweenUtc(d("2026-09-06"), d("2026-09-06"))).toBe(0);
  });

  it("6년 경과(FORMULA 예제 5): 6", () => {
    expect(calendarFullYearsBetweenUtc(d("2020-01-01"), d("2026-09-06"))).toBe(6);
  });

  it("20년 경과(FORMULA 예제 6, 상한 캡은 logic.ts 몫): 20", () => {
    // FORMULA 예제 6의 start는 생년월일(1976-09-06)이 아니라 "30세가 되는 날"(1976+30=2006-09-06)이다 —
    // "만 30세부터 기산"은 logic.ts 도메인 규칙이라 이 순수 함수 테스트는 이미 계산된 기산일을 넣는다.
    expect(calendarFullYearsBetweenUtc(d("2006-09-06"), d("2026-09-06"))).toBe(20);
  });

  it("start가 end보다 미래면 음수 대신 0", () => {
    expect(calendarFullYearsBetweenUtc(d("2027-01-01"), d("2026-01-01"))).toBe(0);
  });

  it("FORMULA 예제 12: 혼인신고일(2019-05-01) 기준 7년", () => {
    expect(calendarFullYearsBetweenUtc(d("2019-05-01"), d("2026-09-06"))).toBe(7);
  });
});

describe("calendarFullMonthsBetweenUtc", () => {
  it("6개월 미만 경계(FORMULA 예제 9-A): 5개월", () => {
    expect(calendarFullMonthsBetweenUtc(d("2026-03-07"), d("2026-09-06"))).toBe(5);
  });

  it("정확히 6개월 경계(FORMULA 예제 9-B): 6개월", () => {
    expect(calendarFullMonthsBetweenUtc(d("2026-03-06"), d("2026-09-06"))).toBe(6);
  });

  it("정확히 12개월 경계(FORMULA 예제 10): 12개월", () => {
    expect(calendarFullMonthsBetweenUtc(d("2025-09-06"), d("2026-09-06"))).toBe(12);
  });

  it("15년 이상(FORMULA 예제 11, 상한 캡 이전 원값): 248개월", () => {
    expect(calendarFullMonthsBetweenUtc(d("2006-01-01"), d("2026-09-06"))).toBe(248);
  });

  it("FORMULA 예제 12: 청약통장 최초가입일(2016-01-10) 기준 127개월", () => {
    expect(calendarFullMonthsBetweenUtc(d("2016-01-10"), d("2026-09-06"))).toBe(127);
  });

  it("같은 날이면 0", () => {
    expect(calendarFullMonthsBetweenUtc(d("2026-09-06"), d("2026-09-06"))).toBe(0);
  });

  it("start가 end보다 미래면 음수 대신 0", () => {
    expect(calendarFullMonthsBetweenUtc(d("2027-01-01"), d("2026-01-01"))).toBe(0);
  });
});

/**
 * `addDaysUtc`/`weekdayUtc`/`formatIsoDateUtc` 계약 테스트.
 *
 * `d-day-calculator`(디데이 계산기) FORMULA.md Golden Test(모드 B, #16~#24)와 "요일 계산
 * 검증" 표를 그대로 옮겼다 — 이 세 함수는 도메인 의미가 없는 순수 날짜 산술이라
 * `calculateDateShift` 같은 계산기 로직과 독립적으로 먼저 검증해 둔다(위 두 함수와 동일한
 * 목적 — Builder의 logic.test.ts가 실패할 때 "날짜 산술 문제"와 "모드 조립 문제"를 바로
 * 구분할 수 있게 한다).
 */
describe("addDaysUtc / formatIsoDateUtc (d-day-calculator FORMULA.md 모드 B 예제)", () => {
  it("0일 이동은 같은 날짜(FORMULA #16)", () => {
    expect(formatIsoDateUtc(addDaysUtc(d("2026-09-12"), 0))).toBe("2026-09-12");
  });

  it("104일 이동(FORMULA #17): 2026-09-12 + 104일 = 2026-12-25", () => {
    expect(formatIsoDateUtc(addDaysUtc(d("2026-09-12"), 104))).toBe("2026-12-25");
  });

  it("음수 이동(FORMULA #18): 2026-09-12 - 254일 = 2026-01-01", () => {
    expect(formatIsoDateUtc(addDaysUtc(d("2026-09-12"), -254))).toBe("2026-01-01");
  });

  it("연말→연초 경계(FORMULA #19): 2026-12-31 + 1일 = 2027-01-01", () => {
    expect(formatIsoDateUtc(addDaysUtc(d("2026-12-31"), 1))).toBe("2027-01-01");
  });

  it("윤년 2월 말 경계(FORMULA #20): 2024-02-28 + 2일 = 2024-03-01", () => {
    expect(formatIsoDateUtc(addDaysUtc(d("2024-02-28"), 2))).toBe("2024-03-01");
  });

  it("대규모 이동(FORMULA #21, Howard Hinnant 알고리즘 손계산 교차검증 완료): 2000-01-01 + 10,000일 = 2027-05-19", () => {
    expect(formatIsoDateUtc(addDaysUtc(d("2000-01-01"), 10_000))).toBe("2027-05-19");
  });

  it("지원 범위 하한 경계에서 최대 이동(FORMULA #22): 2200-12-31 - 100,000일 = 1927-03-18", () => {
    expect(formatIsoDateUtc(addDaysUtc(d("2200-12-31"), -100_000))).toBe("1927-03-18");
  });

  it("addDaysUtc는 diffDaysUtc의 역함수다(모드 A/B 역함수 불변식, FORMULA #25 근거)", () => {
    const base = d("2026-09-12");
    const shifted = addDaysUtc(base, 104);
    expect(diffDaysUtc(base, shifted)).toBe(104);
  });
});

describe("weekdayUtc (d-day-calculator FORMULA.md 요일 계산 검증 표)", () => {
  it("2000-01-01은 토요일(6) — 앵커 교차검증", () => {
    expect(weekdayUtc(d("2000-01-01"))).toBe(6);
  });

  it("1900-01-01은 월요일(1) — 지원 범위 하한", () => {
    expect(weekdayUtc(d("1900-01-01"))).toBe(1);
  });

  it("2024-02-29(윤년)는 목요일(4)", () => {
    expect(weekdayUtc(d("2024-02-29"))).toBe(4);
  });

  it("2028-02-29(미래 윤년)는 화요일(2)", () => {
    expect(weekdayUtc(d("2028-02-29"))).toBe(2);
  });

  it("2026-09-12(FORMULA.md 작성일)는 토요일(6)", () => {
    expect(weekdayUtc(d("2026-09-12"))).toBe(6);
  });

  it("2026-12-25는 금요일(5)", () => {
    expect(weekdayUtc(d("2026-12-25"))).toBe(5);
  });
});
