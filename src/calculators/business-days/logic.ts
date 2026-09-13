import { addDays, datesBetween, differenceInDays, MAX_SUPPORTED_DATE, MIN_SUPPORTED_DATE } from "./date-utils";
import { classifyDay } from "./holidays";
import type { BusinessDaysInput, BusinessDaysResult, DayClassification, ReasonCounts } from "./types";

function reasonCounts(days: DayClassification[]): ReasonCounts {
  return {
    saturday: days.filter((day) => day.kinds.includes("saturday")).length,
    sunday: days.filter((day) => day.kinds.includes("sunday")).length,
    holiday: days.filter((day) => day.kinds.some((kind) => kind !== "saturday" && kind !== "sunday" && kind !== "custom")).length,
    custom: days.filter((day) => day.kinds.includes("custom")).length,
  };
}

export function calculateBusinessDays(input: BusinessDaysInput): BusinessDaysResult {
  if (input.mode === "range") {
    let dates = datesBetween(input.startDate, input.endDate);
    if (!input.includeStart) dates = dates.slice(1);
    if (!input.includeEnd && dates.at(-1) === input.endDate) dates = dates.slice(0,-1);
    const days = dates.map((date) => classifyDay(date, input.settings));
    const excluded = days.filter((day) => !day.isBusinessDay);
    return { mode: "range", businessDays: days.length - excluded.length, totalCandidateDays: days.length, excludedDays: excluded.length, reasonCounts: reasonCounts(excluded), days, excluded };
  }
  if (input.businessDays === 0) return { mode: "offset", arrivalDate: input.baseDate, businessDays: 0, direction: input.direction, calendarDaysTraversed: 0, excludedDays: 0, reasonCounts: reasonCounts([]), traversed: [], excluded: [] };
  const traversed: DayClassification[] = [];
  let cursor = input.baseDate; let counted = 0;
  if (input.includeBase) { const base = classifyDay(cursor, input.settings); traversed.push(base); if (base.isBusinessDay) counted++; }
  while (counted < input.businessDays) {
    cursor = addDays(cursor, input.direction);
    if (cursor < MIN_SUPPORTED_DATE || cursor > MAX_SUPPORTED_DATE) throw new RangeError("공휴일 데이터 지원 범위를 벗어났습니다.");
    const day = classifyDay(cursor, input.settings); traversed.push(day); if (day.isBusinessDay) counted++;
  }
  const excluded = traversed.filter((day) => !day.isBusinessDay);
  return { mode: "offset", arrivalDate: cursor, businessDays: input.businessDays, direction: input.direction, calendarDaysTraversed: Math.abs(differenceInDays(input.baseDate, cursor)), excludedDays: excluded.length, reasonCounts: reasonCounts(excluded), traversed, excluded };
}
