import type { CalendarDuration } from "./types";

export function formatKoreanDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}
export function formatShortDate(value: string) { return value.replaceAll("-", "."); }
export function formatDuration(value: CalendarDuration) {
  const parts = [];
  if (value.years) parts.push(`${value.years}년`);
  if (value.months) parts.push(`${value.months}개월`);
  if (value.days || parts.length === 0) parts.push(`${value.days}일`);
  return parts.join(" ");
}
export function formatDday(days: number) { return days === 0 ? "D-Day" : days > 0 ? `D-${days.toLocaleString("ko-KR")}` : `D+${Math.abs(days).toLocaleString("ko-KR")}`; }
export function formatPercent(value: number) { return `${value.toFixed(1)}%`; }
