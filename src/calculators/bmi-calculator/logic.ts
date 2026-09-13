import {completedMonths,completedYears} from "./age";
import {BMI_LMS,type BmiLmsRow} from "./lms-data";
import type {BmiCategory,BmiInput,BmiResult} from "./types";

function normalCdf(z:number){const sign=z<0?-1:1;const x=Math.abs(z)/Math.sqrt(2);const t=1/(1+0.3275911*x);const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return .5*(1+sign*erf);}
export function zScoreFromLms(value:number,row:BmiLmsRow){const [,l,m,s]=row;return Math.abs(l)<1e-10?Math.log(value/m)/s:(Math.pow(value/m,l)-1)/(l*s);}
export function percentileFromLms(value:number,row:BmiLmsRow){return Math.max(0,Math.min(100,normalCdf(zScoreFromLms(value,row))*100));}
export function valueFromLmsZ(row:BmiLmsRow,z:number){const[,l,m,s]=row;return Math.abs(l)<1e-10?m*Math.exp(s*z):m*Math.pow(1+l*s*z,1/l);}
function adultCategory(bmi:number):BmiCategory{const value=bmi+Number.EPSILON*Math.max(1,bmi)*8;if(value<18.5)return"저체중";if(value<23)return"정상";if(value<25)return"비만 전단계";if(value<30)return"1단계 비만";if(value<35)return"2단계 비만";return"3단계 비만";}
function childCategory(percentile:number):BmiCategory{if(percentile<5)return"저체중";if(percentile<85)return"정상";if(percentile<95)return"과체중";return"비만";}
export function calculateBmi(input:BmiInput):BmiResult{const bmi=input.weightKg/Math.pow(input.heightCm/100,2);const ageMonths=completedMonths(input.birthDate,input.referenceDate);const ageYears=completedYears(input.birthDate,input.referenceDate);
  if(ageMonths<24)return{...input,bmi,ageMonths,ageYears,ageGroup:"infant",category:"판정하지 않음"};
  if(ageMonths<=227){const row=BMI_LMS[input.sex][ageMonths-24];if(!row||row[0]!==ageMonths)throw new Error("해당 월령의 성장도표 기준을 찾을 수 없습니다.");const zScore=zScoreFromLms(bmi,row),percentile=percentileFromLms(bmi,row);const childBmiCuts={p5:valueFromLmsZ(row,-1.644853627),p85:valueFromLmsZ(row,1.036433389),p95:valueFromLmsZ(row,1.644853627)};const heightM=input.heightCm/100;return{...input,bmi,ageMonths,ageYears,ageGroup:"child",zScore,percentile,childBmiCuts,category:childCategory(percentile),healthyWeightMin:childBmiCuts.p5*heightM*heightM,healthyWeightMax:childBmiCuts.p85*heightM*heightM};}
  const heightM=input.heightCm/100;return{...input,bmi,ageMonths,ageYears,ageGroup:"adult",category:adultCategory(bmi),waistRisk:input.waistCm===undefined?undefined:input.waistCm>=(input.sex==="male"?90:85),healthyWeightMin:18.5*heightM*heightM,healthyWeightMax:23*heightM*heightM};}
