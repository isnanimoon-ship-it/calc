export function formatWon(value: number) { return `${Math.round(value).toLocaleString("ko-KR")}원`; }
export function formatKoreanDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}
export function formatShortDate(value: string) { return value.replaceAll("-", "."); }
