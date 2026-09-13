import { describe, expect, it } from "vitest";
import { addCalendarMonthsClamped, calculateMilitaryDischarge, differenceInDays } from "./logic";

const calculate = (serviceType: string, startDate = "2026-09-04", referenceDate = "2026-09-04") => calculateMilitaryDischarge({ serviceType, startDate, referenceDate });

describe("calculateMilitaryDischarge", () => {
  it.each([
    ["army", "2028-03-03", 18], ["marine", "2028-03-03", 18],
    ["navy", "2028-05-03", 20], ["air-force", "2028-06-03", 21],
    ["full-time-reserve", "2028-03-03", 18], ["social-service", "2028-06-03", 21],
    ["industrial-supplement", "2028-08-03", 23], ["industrial-active", "2029-07-03", 34],
    ["arts-sports", "2029-07-03", 34], ["research-personnel", "2029-09-03", 36],
    ["alternative-service", "2029-09-03", 36],
  ])("%s의 표준 종료일을 계산한다", (serviceType, endDate, months) => {
    const result = calculate(serviceType as string);
    expect(result.endDate).toBe(endDate);
    expect(result.policy.months).toBe(months);
  });

  it("첨부 예시의 육군 18개월과 546일을 계산한다", () => {
    const result = calculate("army");
    expect(result.endDate).toBe("2028-03-03");
    expect(result.serviceSpanDays).toBe(546);
    expect(result.remainingDays).toBe(546);
    expect(result.progressPercent).toBe(0);
  });
  it("월말과 윤년을 넘침 없이 처리한다", () => {
    expect(addCalendarMonthsClamped("2024-02-29", 18)).toBe("2025-08-29");
    expect(calculate("army", "2024-02-29", "2024-02-29").endDate).toBe("2025-08-28");
    expect(calculate("army", "2026-01-31", "2026-01-31").endDate).toBe("2027-07-30");
  });
  it("입영 전 상태와 D-day를 계산한다", () => {
    const result = calculate("army", "2026-10-01", "2026-09-01");
    expect(result.status).toBe("upcoming"); expect(result.daysUntilStart).toBe(30); expect(result.progressPercent).toBe(0);
  });
  it("종료일과 종료 다음 날 상태를 구분한다", () => {
    expect(calculate("army", "2026-09-04", "2028-03-03").status).toBe("completion-day");
    const completed = calculate("army", "2026-09-04", "2028-03-04");
    expect(completed.status).toBe("completed"); expect(completed.completedDaysAfterEnd).toBe(1); expect(completed.progressPercent).toBe(100);
  });
  it("현역에만 계급 진급 가능 기준일을 만든다", () => {
    expect(calculate("army").rankMilestones.map((item) => item.date)).toEqual(["2026-09-04", "2026-11-04", "2027-05-04", "2027-11-04"]);
    expect(calculate("social-service").rankMilestones).toEqual([]);
  });
  it("중간 기준일의 진행률과 달력 잔여기간을 계산한다", () => {
    const result = calculate("army", "2026-09-04", "2027-09-04");
    expect(result.status).toBe("serving"); expect(result.elapsedDays).toBe(365); expect(result.remainingCalendar).toEqual({ years: 0, months: 5, days: 28 });
  });
  it("날짜 차이를 시간대와 무관한 날짜 경계로 계산한다", () => expect(differenceInDays("2026-12-31", "2027-01-01")).toBe(1));
  it("지원하지 않는 유형을 거부한다", () => expect(() => calculate("unknown")).toThrow("지원하지 않는"));
});
