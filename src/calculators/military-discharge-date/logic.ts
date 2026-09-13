import { getServicePolicy } from "./policy";
import type { CalendarDuration, MilitaryDischargeInput, MilitaryDischargeResult, Milestone } from "./types";

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
export function differenceInDays(from: string, to: string) { return serial(to) - serial(from); }

function calendarDuration(from: string, to: string): CalendarDuration {
  if (differenceInDays(from, to) <= 0) return { years: 0, months: 0, days: 0 };
  let cursor = from;
  let years = 0;
  while (differenceInDays(addCalendarMonthsClamped(cursor, 12), to) >= 0) {
    cursor = addCalendarMonthsClamped(cursor, 12); years += 1;
  }
  let months = 0;
  while (differenceInDays(addCalendarMonthsClamped(cursor, 1), to) >= 0) {
    cursor = addCalendarMonthsClamped(cursor, 1); months += 1;
  }
  return { years, months, days: differenceInDays(cursor, to) };
}

function milestoneState(date: string, referenceDate: string) {
  const diff = differenceInDays(referenceDate, date);
  return diff === 0 ? "today" as const : diff < 0 ? "completed" as const : "upcoming" as const;
}

function makeMilestone(id: string, label: string, date: string, referenceDate: string, kind: Milestone["kind"]): Milestone {
  return { id, label, date, daysFromReference: differenceInDays(referenceDate, date), state: milestoneState(date, referenceDate), kind };
}

export function calculateMilitaryDischarge(input: MilitaryDischargeInput): MilitaryDischargeResult {
  const policy = getServicePolicy(input.serviceType);
  if (!policy) throw new Error("지원하지 않는 복무 유형입니다.");
  const endDate = addCalendarDays(addCalendarMonthsClamped(input.startDate, policy.months), -1);
  const serviceSpanDays = differenceInDays(input.startDate, endDate);
  const remainingDays = differenceInDays(input.referenceDate, endDate);
  const daysUntilStart = Math.max(0, differenceInDays(input.referenceDate, input.startDate));
  const elapsedDays = Math.min(serviceSpanDays, Math.max(0, differenceInDays(input.startDate, input.referenceDate)));
  const status = input.referenceDate < input.startDate ? "upcoming" : input.referenceDate === endDate ? "completion-day" : input.referenceDate > endDate ? "completed" : "serving";
  const progressPercent = status === "completed" || status === "completion-day" ? 100 : status === "upcoming" ? 0 : elapsedDays / serviceSpanDays * 100;
  const progressPoints = [["start", "복무 시작", 0], ["quarter", "25% 달성", .25], ["half", "절반 달성", .5], ["three-quarters", "75% 달성", .75], ["end", policy.endTerm, 1]] as const;
  const milestones = progressPoints.map(([id, label, ratio]) => makeMilestone(id, label, addCalendarDays(input.startDate, Math.round(serviceSpanDays * ratio)), input.referenceDate, "progress"));
  const rankMilestones = policy.hasRankMilestones ? [
    makeMilestone("private", "이병", input.startDate, input.referenceDate, "rank"),
    makeMilestone("private-first-class", "일병 진급 가능 기준일", addCalendarMonthsClamped(input.startDate, 2), input.referenceDate, "rank"),
    makeMilestone("corporal", "상병 진급 가능 기준일", addCalendarMonthsClamped(input.startDate, 8), input.referenceDate, "rank"),
    makeMilestone("sergeant", "병장 진급 가능 기준일", addCalendarMonthsClamped(input.startDate, 14), input.referenceDate, "rank"),
  ] : [];
  return {
    policy, startDate: input.startDate, referenceDate: input.referenceDate, endDate,
    serviceSpanDays, inclusiveServiceDays: serviceSpanDays + 1, remainingDays,
    daysUntilStart, elapsedDays, completedDaysAfterEnd: Math.max(0, -remainingDays),
    progressPercent, remainingCalendar: remainingDays > 0 ? calendarDuration(input.referenceDate, endDate) : { years: 0, months: 0, days: 0 },
    status, milestones, rankMilestones,
  };
}
