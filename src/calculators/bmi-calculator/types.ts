export type Sex = "male" | "female";
export type AgeGroup = "infant" | "child" | "adult";
export type BmiCategory = "저체중" | "정상" | "비만 전단계" | "1단계 비만" | "2단계 비만" | "3단계 비만" | "과체중" | "비만" | "판정하지 않음";

export interface BmiInput { birthDate:string; referenceDate:string; sex:Sex; heightCm:number; weightKg:number; waistCm?:number }
export interface BmiResult extends BmiInput { bmi:number; ageYears:number; ageMonths:number; ageGroup:AgeGroup; category:BmiCategory; percentile?:number; zScore?:number; childBmiCuts?:{p5:number;p85:number;p95:number}; waistRisk?:boolean; healthyWeightMin?:number; healthyWeightMax?:number }
