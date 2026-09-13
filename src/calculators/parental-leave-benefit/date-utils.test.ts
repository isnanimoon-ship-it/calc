import { describe, expect, it } from "vitest";
import { addCalendarMonthsClamped, endOfCompleteMonths, isOnOrBefore18MonthBirthday } from "./date-utils";

describe("육아휴직 달력 계산", () => {
  it("31일을 짧은 달 말일로 보정", () => expect(addCalendarMonthsClamped("2026-01-31",1)).toBe("2026-02-28"));
  it("윤년 2월을 보정", () => expect(addCalendarMonthsClamped("2028-01-31",1)).toBe("2028-02-29"));
  it("12개월 종료일은 기념일 전날", () => expect(endOfCompleteMonths("2026-09-04",12)).toBe("2027-09-03"));
  it("출생일로부터 18개월 되는 날 전날까지 허용", () => {
    expect(isOnOrBefore18MonthBirthday("2025-04-02","2026-10-01")).toBe(true);
    expect(isOnOrBefore18MonthBirthday("2025-04-02","2026-10-02")).toBe(false);
  });
  it("연도 경계를 넘겨 월을 더함", () => expect(addCalendarMonthsClamped("2026-11-30",3)).toBe("2027-02-28"));
  it("한 달 완전기간의 종료일", () => expect(endOfCompleteMonths("2026-04-15",1)).toBe("2026-05-14"));
});
