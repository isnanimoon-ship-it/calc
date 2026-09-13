const DAY_MS = 86_400_000;
export const MIN_SUPPORTED_DATE = "2025-01-01";
export const MAX_SUPPORTED_DATE = "2027-12-31";

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}
export function toSerial(value: string) { const [y,m,d] = value.split("-").map(Number); return Math.floor(Date.UTC(y,m-1,d) / DAY_MS); }
export function fromSerial(value: number) { const d = new Date(value * DAY_MS); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`; }
export function addDays(value: string, days: number) { return fromSerial(toSerial(value) + days); }
export function differenceInDays(from: string, to: string) { return toSerial(to) - toSerial(from); }
export function weekdayIndex(value: string) { return new Date(toSerial(value) * DAY_MS).getUTCDay(); }
export function weekdayLabel(value: string) { return ["일","월","화","수","목","금","토"][weekdayIndex(value)]; }
export function datesBetween(start: string, end: string) { const result: string[] = []; for (let n=toSerial(start); n<=toSerial(end); n++) result.push(fromSerial(n)); return result; }
