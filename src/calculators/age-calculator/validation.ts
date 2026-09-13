import type { AgeCalculatorInput } from "./types";
export interface RawAgeCalculatorInput { birthDate:string; referenceDate:string }
export type ValidationResult={success:true;data:AgeCalculatorInput}|{success:false;errors:{field:keyof RawAgeCalculatorInput;message:string}[]};
export function isValidIsoDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const[y,m,d]=value.split("-").map(Number);const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()+1===m&&date.getUTCDate()===d;}
export function validateAgeInput(raw:RawAgeCalculatorInput):ValidationResult{const errors:{field:keyof RawAgeCalculatorInput;message:string}[]=[];
  if(!raw.birthDate)errors.push({field:"birthDate",message:"생년월일을 입력해 주세요."});else if(!isValidIsoDate(raw.birthDate))errors.push({field:"birthDate",message:"올바른 생년월일을 입력해 주세요."});else if(raw.birthDate<"1900-01-01"||raw.birthDate>"2200-12-31")errors.push({field:"birthDate",message:"생년월일은 1900년부터 2200년 사이로 입력해 주세요."});
  if(!raw.referenceDate||!isValidIsoDate(raw.referenceDate))errors.push({field:"referenceDate",message:"올바른 기준일을 입력해 주세요."});else if(raw.referenceDate<"1900-01-01"||raw.referenceDate>"2200-12-31")errors.push({field:"referenceDate",message:"기준일은 1900년부터 2200년 사이로 입력해 주세요."});
  if(isValidIsoDate(raw.birthDate)&&isValidIsoDate(raw.referenceDate)&&raw.birthDate>raw.referenceDate)errors.push({field:"birthDate",message:"생년월일은 기준일보다 늦을 수 없습니다."});
  return errors.length?{success:false,errors}:{success:true,data:raw};}
