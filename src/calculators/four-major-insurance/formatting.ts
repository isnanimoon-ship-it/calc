const won = new Intl.NumberFormat("ko-KR");
export function formatWon(value: number): string { return `${won.format(value)}원`; }
export function formatPercent(value: number): string { return `${(value * 100).toLocaleString("ko-KR", { maximumFractionDigits: 4 })}%`; }
