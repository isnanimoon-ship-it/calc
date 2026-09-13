export const won=(value:number)=>`${Math.round(value).toLocaleString("ko-KR")}원`;
export const koreanDate=(value:string)=>{const[y,m,d]=value.split("-").map(Number);return `${y}년 ${m}월 ${d}일`;};
