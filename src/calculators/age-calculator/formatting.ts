import type { CalendarAge } from "./types";
export const weekdayLabels=["일요일","월요일","화요일","수요일","목요일","금요일","토요일"] as const;
export function formatKoreanDate(value:string){const[y,m,d]=value.split("-").map(Number);return `${y}년 ${m}월 ${d}일`;}
export function formatShortDate(value:string){return value.replaceAll("-",".");}
export function formatCalendarAge(value:CalendarAge){return `${value.years}년 ${value.months}개월 ${value.days}일`;}
export function formatDday(days:number){return days===0?"D-0":`D-${days}`;}
