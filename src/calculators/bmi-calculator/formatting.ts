export const formatNumber=(value:number,digits=1)=>value.toLocaleString("ko-KR",{minimumFractionDigits:digits,maximumFractionDigits:digits});
export function formatAge(years:number,months:number){return `만 ${years}세 ${months%12}개월`;}
export function formatPercentile(value:number){return value<0.1?"0.1 미만":value>99.9?"99.9 초과":formatNumber(value,1);}
