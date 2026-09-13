import { describe, expect, it } from "vitest";
import { isValidIsoDate } from "./date-utils";
import { classifyDay, holidayRecords } from "./holidays";
import type { BusinessDaySettings } from "./types";

const settings: BusinessDaySettings = { excludeSaturday:true, excludeSunday:true, excludePublicHolidays:true, excludeSubstituteHolidays:true, excludeTemporaryHolidays:true, excludeElectionDays:true, excludeLaborDay:true, customHolidays:[] };

describe("공휴일 스냅샷", () => {
  it("모든 날짜와 연도가 유효하다", () => { for (const item of holidayRecords) { expect(isValidIsoDate(item.date)).toBe(true); expect(Number(item.date.slice(0,4))).toBeGreaterThanOrEqual(2025); expect(Number(item.date.slice(0,4))).toBeLessThanOrEqual(2027); } });
  it("동일한 날짜·이름·분류가 중복되지 않는다", () => { const keys = holidayRecords.map((item) => `${item.date}|${item.name}|${item.kind}`); expect(new Set(keys).size).toBe(keys.length); });
  it.each(["2026-03-02","2026-05-25","2026-08-17","2026-10-05","2027-02-09","2027-07-19","2027-08-16","2027-10-04","2027-10-11","2027-12-27"])("공식 대체공휴일 %s를 제외한다", (date) => expect(classifyDay(date, settings).isBusinessDay).toBe(false));
  it("공휴일 토글을 끄면 선거일과 일반 대체공휴일도 영업일로 본다", () => { const custom = { ...settings, excludePublicHolidays:false }; expect(classifyDay("2026-06-03", custom).isBusinessDay).toBe(true); expect(classifyDay("2026-08-17", custom).isBusinessDay).toBe(true); });
  it("노동절 대체공휴일은 노동절 설정에 독립적으로 연동한다", () => { expect(classifyDay("2027-05-03", settings).isBusinessDay).toBe(false); expect(classifyDay("2027-05-03", { ...settings, excludeLaborDay:false }).isBusinessDay).toBe(true); });
});
