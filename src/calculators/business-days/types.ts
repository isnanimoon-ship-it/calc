export type HolidayKind = "public-holiday" | "substitute-holiday" | "temporary-holiday" | "election-day" | "labor-day" | "labor-substitute-holiday";
export interface HolidayRecord { date: string; name: string; kind: HolidayKind }
export interface BusinessDaySettings {
  excludeSaturday: boolean; excludeSunday: boolean; excludePublicHolidays: boolean;
  excludeSubstituteHolidays: boolean; excludeTemporaryHolidays: boolean;
  excludeElectionDays: boolean; excludeLaborDay: boolean; customHolidays: string[];
}
export interface DayClassification { date: string; weekday: string; isBusinessDay: boolean; reasons: string[]; kinds: string[] }
export interface RangeInput { mode: "range"; startDate: string; endDate: string; includeStart: boolean; includeEnd: boolean; settings: BusinessDaySettings }
export interface OffsetInput { mode: "offset"; baseDate: string; businessDays: number; direction: 1 | -1; includeBase: boolean; settings: BusinessDaySettings }
export type BusinessDaysInput = RangeInput | OffsetInput;
export interface ReasonCounts { saturday: number; sunday: number; holiday: number; custom: number }
export interface RangeResult { mode: "range"; businessDays: number; totalCandidateDays: number; excludedDays: number; reasonCounts: ReasonCounts; days: DayClassification[]; excluded: DayClassification[] }
export interface OffsetResult { mode: "offset"; arrivalDate: string; businessDays: number; direction: 1 | -1; calendarDaysTraversed: number; excludedDays: number; reasonCounts: ReasonCounts; traversed: DayClassification[]; excluded: DayClassification[] }
export type BusinessDaysResult = RangeResult | OffsetResult;
