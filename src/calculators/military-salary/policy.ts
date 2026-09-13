import type {MilitaryRank,MilitaryServiceType} from "./types";
export const MILITARY_POLICY_YEAR=2026;
export const MILITARY_POLICY_REVIEWED_AT="2026-09-06";
export const rankPay:Record<MilitaryRank,number>={"private-2":750000,"private-1":900000,corporal:1200000,sergeant:1500000};
export const rankLabels:Record<MilitaryRank,string>={"private-2":"이병","private-1":"일병",corporal:"상병",sergeant:"병장"};
export const servicePolicies:Record<MilitaryServiceType,{label:string;months:number}>={army:{label:"육군",months:18},navy:{label:"해군",months:20},"air-force":{label:"공군",months:21},marine:{label:"해병대",months:18},"full-time-reserve":{label:"상근예비역",months:18}};
export const standardRankMonths=(serviceMonths:number):Record<MilitaryRank,number>=>({"private-2":2,"private-1":6,corporal:6,sergeant:serviceMonths-14});
