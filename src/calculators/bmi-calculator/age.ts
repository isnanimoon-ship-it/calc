function parts(value:string){const [year,month,day]=value.split("-").map(Number);return {year,month,day};}
export function completedMonths(birthDate:string,referenceDate:string){const b=parts(birthDate),r=parts(referenceDate);return (r.year-b.year)*12+r.month-b.month-(r.day<b.day?1:0);}
export function completedYears(birthDate:string,referenceDate:string){return Math.floor(completedMonths(birthDate,referenceDate)/12);}
