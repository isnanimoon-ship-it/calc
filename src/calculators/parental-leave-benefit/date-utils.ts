const DAY_MS = 86_400_000;
type DateParts = { year: number; month: number; day: number };

function parseIso(value: string): DateParts {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}
function pad(value: number) { return String(value).padStart(2, "0"); }
function toIso(parts: DateParts) { return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`; }
function serial(value: string) {
  const { year, month, day } = parseIso(value);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}
function fromSerial(value: number) {
  const date = new Date(value * DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
function daysInMonth(year: number, month: number) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }

export function addCalendarMonthsClamped(value: string, months: number) {
  const source = parseIso(value);
  const total = source.year * 12 + source.month - 1 + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  return toIso({ year, month, day: Math.min(source.day, daysInMonth(year, month)) });
}
export function addCalendarDays(value: string, days: number) { return fromSerial(serial(value) + days); }
export function endOfCompleteMonths(startDate: string, months: number) { return addCalendarDays(addCalendarMonthsClamped(startDate, months), -1); }
export function isOnOrBefore18MonthBirthday(childBirthDate: string, leaveStartDate: string) {
  return leaveStartDate <= addCalendarDays(addCalendarMonthsClamped(childBirthDate, 18), -1);
}
