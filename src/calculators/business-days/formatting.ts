export function formatKoreanDate(value: string) { const [y,m,d] = value.split("-").map(Number); return `${y}년 ${m}월 ${d}일`; }
export function formatShortDate(value: string) { return value.replaceAll("-", "."); }
