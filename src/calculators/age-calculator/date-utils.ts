const DAY_MS = 86_400_000;
type Parts = { year: number; month: number; day: number };
export function parseIso(value: string): Parts { const [year,month,day] = value.split("-").map(Number); return { year,month,day }; }
function pad(value: number) { return String(value).padStart(2,"0"); }
export function toIso(value: Parts) { return `${value.year}-${pad(value.month)}-${pad(value.day)}`; }
export function daysInMonth(year: number, month: number) { return new Date(Date.UTC(year,month,0)).getUTCDate(); }
export function daySerial(value: string) { const p=parseIso(value); return Math.floor(Date.UTC(p.year,p.month-1,p.day)/DAY_MS); }
export function differenceInDays(from: string, to: string) { return daySerial(to)-daySerial(from); }
export function anniversaryInYear(birthDate: string, year: number) { const p=parseIso(birthDate); return toIso({year,month:p.month,day:Math.min(p.day,daysInMonth(year,p.month))}); }
export function addMonthsFromBase(value: string, months: number) { const p=parseIso(value); const total=p.year*12+p.month-1+months; const year=Math.floor(total/12); const month=total-year*12+1; return toIso({year,month,day:Math.min(p.day,daysInMonth(year,month))}); }
export function weekday(value: string) { const p=parseIso(value); return new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay(); }
