export type MilitaryServiceType="army"|"navy"|"air-force"|"marine"|"full-time-reserve";
export type MilitaryRank="private-2"|"private-1"|"corporal"|"sergeant";
export type SalaryMode="full-service"|"to-reference-date";
export interface SavingsInput{enabled:boolean;monthlyContributionWon:number;contributionMonths:number;expectedAnnualRatePercent:number}
export interface MilitarySalaryInput{serviceType:MilitaryServiceType;enlistmentDate:string;mode:SalaryMode;referenceDate?:string;promotionDates?:{private1:string;corporal:string;sergeant:string};savings:SavingsInput}
export interface RankSalarySegment{rank:MilitaryRank;months:number;monthlyPayWon:number;subtotalWon:number}
export interface SavingsResult{principalWon:number;estimatedInterestWon:number;matchingSupportWon:number;estimatedMaturityWon:number}
export interface MilitarySalaryResult extends MilitarySalaryInput{serviceMonths:number;calculatedMonths:number;estimatedDischargeDate:string;segments:RankSalarySegment[];grossSalaryWon:number;availableDuringServiceWon:number;savingsResult?:SavingsResult}
