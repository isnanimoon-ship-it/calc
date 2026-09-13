function parse(value:string){const[y,m,d]=value.split("-").map(Number);return{y,m,d};}
function pad(n:number){return String(n).padStart(2,"0");}
export function isIsoDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const{y,m,d}=parse(value),date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;}
export function addMonths(value:string,months:number){const{y,m,d}=parse(value);const total=y*12+m-1+months,year=Math.floor(total/12),month=total%12+1,last=new Date(Date.UTC(year,month,0)).getUTCDate();return `${year}-${pad(month)}-${pad(Math.min(d,last))}`;}
export function addDays(value:string,days:number){const{y,m,d}=parse(value),date=new Date(Date.UTC(y,m-1,d+days));return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`;}
export function completedServiceMonths(start:string,end:string){const s=parse(start),e=parse(end);return Math.max(0,(e.y-s.y)*12+e.m-s.m-(e.d<s.d?1:0));}
