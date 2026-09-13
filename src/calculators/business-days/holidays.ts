import data2025 from "@/src/data/holidays/2025.json";
import data2026 from "@/src/data/holidays/2026.json";
import data2027 from "@/src/data/holidays/2027.json";
import { weekdayIndex, weekdayLabel } from "./date-utils";
import type { BusinessDaySettings, DayClassification, HolidayKind, HolidayRecord } from "./types";

const snapshots = [data2025, data2026, data2027];
export const HOLIDAY_DATA_REVIEWED_AT = "2026-09-04";
export const HOLIDAY_DATA_YEARS = "2025~2027";
export const holidayRecords: HolidayRecord[] = snapshots.flatMap((snapshot) => snapshot.holidays.map(([date,name,kind]) => ({ date, name, kind: kind as HolidayKind })));
const byDate = new Map<string, HolidayRecord[]>();
for (const item of holidayRecords) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);

function holidayEnabled(kind: HolidayKind, settings: BusinessDaySettings) {
  if (kind === "public-holiday") return settings.excludePublicHolidays;
  if (kind === "substitute-holiday") return settings.excludePublicHolidays && settings.excludeSubstituteHolidays;
  if (kind === "temporary-holiday") return settings.excludePublicHolidays && settings.excludeTemporaryHolidays;
  if (kind === "election-day") return settings.excludePublicHolidays && settings.excludeElectionDays;
  if (kind === "labor-day") return settings.excludeLaborDay;
  return settings.excludeLaborDay && settings.excludeSubstituteHolidays;
}

export function classifyDay(date: string, settings: BusinessDaySettings): DayClassification {
  const reasons: string[] = []; const kinds: string[] = [];
  const weekday = weekdayIndex(date);
  if (weekday === 6 && settings.excludeSaturday) { reasons.push("토요일"); kinds.push("saturday"); }
  if (weekday === 0 && settings.excludeSunday) { reasons.push("일요일"); kinds.push("sunday"); }
  for (const holiday of byDate.get(date) ?? []) if (holidayEnabled(holiday.kind, settings)) { reasons.push(holiday.name); kinds.push(holiday.kind); }
  if (settings.customHolidays.includes(date)) { reasons.push("사용자 지정 휴무일"); kinds.push("custom"); }
  return { date, weekday: weekdayLabel(date), isBusinessDay: reasons.length === 0, reasons, kinds };
}
