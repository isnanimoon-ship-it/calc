import type { ServiceGroup, ServicePolicy } from "./types";

export const SERVICE_POLICY_REVIEWED_AT = "2026-09-04";
export const SERVICE_POLICY_SUPPORTED_FROM = "2021-01-01";

export const servicePolicies: ServicePolicy[] = [
  { id: "army", label: "육군", group: "active", months: 18, startLabel: "입영일", endTerm: "전역일", hasRankMilestones: true },
  { id: "navy", label: "해군", group: "active", months: 20, startLabel: "입영일", endTerm: "전역일", hasRankMilestones: true },
  { id: "air-force", label: "공군", group: "active", months: 21, startLabel: "입영일", endTerm: "전역일", hasRankMilestones: true },
  { id: "marine", label: "해병대", group: "active", months: 18, startLabel: "입영일", endTerm: "전역일", hasRankMilestones: true },
  { id: "full-time-reserve", label: "상근예비역", group: "reserve", months: 18, startLabel: "입영일", endTerm: "소집해제일", hasRankMilestones: true },
  { id: "social-service", label: "사회복무요원", group: "alternative", months: 21, startLabel: "소집일", endTerm: "소집해제일", hasRankMilestones: false },
  { id: "arts-sports", label: "예술·체육요원", group: "alternative", months: 34, startLabel: "편입일", endTerm: "복무만료일", hasRankMilestones: false },
  { id: "public-health-doctor", label: "공중보건의사", group: "alternative", months: 36, startLabel: "편입일", endTerm: "복무만료일", hasRankMilestones: false },
  { id: "draft-exam-doctor", label: "병역판정검사전담의사", group: "alternative", months: 36, startLabel: "편입일", endTerm: "복무만료일", hasRankMilestones: false },
  { id: "public-service-lawyer", label: "공익법무관", group: "alternative", months: 36, startLabel: "편입일", endTerm: "복무만료일", hasRankMilestones: false },
  { id: "public-veterinarian", label: "공중방역수의사", group: "alternative", months: 36, startLabel: "편입일", endTerm: "복무만료일", hasRankMilestones: false },
  { id: "ship-reserve", label: "승선근무예비역", group: "alternative", months: 36, startLabel: "편입일", endTerm: "복무만료일", hasRankMilestones: false },
  { id: "research-personnel", label: "전문연구요원", group: "alternative", months: 36, startLabel: "편입일", endTerm: "복무만료일", hasRankMilestones: false },
  { id: "industrial-active", label: "산업기능요원(현역 대상)", group: "alternative", months: 34, startLabel: "편입일", endTerm: "복무만료일", hasRankMilestones: false },
  { id: "industrial-supplement", label: "산업기능요원(보충역 대상)", group: "alternative", months: 23, startLabel: "편입일", endTerm: "복무만료일", hasRankMilestones: false },
  { id: "alternative-service", label: "대체복무요원", group: "alternative", months: 36, startLabel: "소집일", endTerm: "복무만료일", hasRankMilestones: false },
];

export const serviceGroupLabels: Record<ServiceGroup, string> = {
  active: "현역병", reserve: "상근예비역", alternative: "보충역·대체복무",
};

export function getServicePolicy(id: string) {
  return servicePolicies.find((policy) => policy.id === id);
}
