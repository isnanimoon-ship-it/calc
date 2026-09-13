import { describe, expect, it } from "vitest";
import { classifyDay } from "./holidays";
import { calculateBusinessDays } from "./logic";
import type { BusinessDaySettings } from "./types";

const settings: BusinessDaySettings = { excludeSaturday: true, excludeSunday: true, excludePublicHolidays: true, excludeSubstituteHolidays: true, excludeTemporaryHolidays: true, excludeElectionDays: true, excludeLaborDay: true, customHolidays: [] };
const offset = (baseDate: string, businessDays = 1, direction: 1|-1 = 1, overrides = {}) => calculateBusinessDays({ mode: "offset", baseDate, businessDays, direction, includeBase: false, settings: { ...settings, ...overrides } });

describe("영업일 계산", () => {
  it("설 연휴 전체를 제외한다", () => {
    const result = calculateBusinessDays({ mode: "range", startDate: "2026-02-14", endDate: "2026-02-18", includeStart: true, includeEnd: true, settings });
    expect(result.mode).toBe("range"); if (result.mode === "range") { expect(result.businessDays).toBe(0); expect(result.excludedDays).toBe(5); }
  });
  it.each([
    ["2026-02-13", "2026-02-19"], ["2026-08-14", "2026-08-18"], ["2026-05-22", "2026-05-26"],
    ["2025-06-02", "2025-06-04"], ["2026-06-02", "2026-06-04"], ["2027-02-05", "2027-02-10"],
  ])("%s에서 1영업일 후는 %s다", (base, expected) => { const result = offset(base); expect(result.mode === "offset" && result.arrivalDate).toBe(expected); });
  it("근로자의 날 토글을 적용한다", () => {
    expect(classifyDay("2026-05-01", settings).isBusinessDay).toBe(false);
    expect(classifyDay("2026-05-01", { ...settings, excludeLaborDay: false }).isBusinessDay).toBe(true);
  });
  it("주말과 공휴일이 겹쳐도 날짜는 한 번만 제외한다", () => {
    const result = calculateBusinessDays({ mode: "range", startDate: "2026-08-15", endDate: "2026-08-15", includeStart: true, includeEnd: true, settings });
    if (result.mode === "range") { expect(result.excludedDays).toBe(1); expect(result.excluded[0].reasons).toEqual(["토요일", "광복절"]); }
  });
  it("사용자 휴무일 중복도 한 번만 제외한다", () => {
    const result = calculateBusinessDays({ mode: "range", startDate: "2026-08-15", endDate: "2026-08-15", includeStart: true, includeEnd: true, settings: { ...settings, customHolidays: ["2026-08-15"] } });
    if (result.mode === "range") { expect(result.excludedDays).toBe(1); expect(result.excluded[0].reasons).toContain("사용자 지정 휴무일"); }
  });
  it.each([[true,true,3],[false,true,2],[true,false,2],[false,false,1]])("포함 설정 %s/%s를 적용한다", (includeStart,includeEnd,total) => {
    const result = calculateBusinessDays({ mode: "range", startDate: "2026-09-01", endDate: "2026-09-03", includeStart, includeEnd, settings: { ...settings, excludeSaturday:false, excludeSunday:false, excludePublicHolidays:false, excludeLaborDay:false } });
    if (result.mode === "range") expect(result.totalCandidateDays).toBe(total);
  });
  it("0영업일은 휴일인 기준일도 그대로 반환한다", () => { const result = offset("2026-08-15",0); expect(result.mode === "offset" && result.arrivalDate).toBe("2026-08-15"); });
  it("이전 방향을 계산한다", () => { const result = offset("2026-08-18",1,-1); expect(result.mode === "offset" && result.arrivalDate).toBe("2026-08-14"); });
  it("기준일 포함 옵션을 적용한다", () => { const result = calculateBusinessDays({ mode:"offset", baseDate:"2026-09-01", businessDays:1, direction:1, includeBase:true, settings }); expect(result.mode === "offset" && result.arrivalDate).toBe("2026-09-01"); });
  it("지원 범위를 넘는 탐색을 거부한다", () => expect(() => offset("2027-12-31",1)).toThrow("지원 범위"));
});
