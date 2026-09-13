export type ServiceGroup = "active" | "reserve" | "alternative";
export type EndDateTerm = "전역일" | "소집해제일" | "복무만료일";

export interface ServicePolicy {
  id: string;
  label: string;
  group: ServiceGroup;
  months: number;
  startLabel: "입영일" | "소집일" | "편입일";
  endTerm: EndDateTerm;
  hasRankMilestones: boolean;
}

export interface MilitaryDischargeInput {
  serviceType: string;
  startDate: string;
  referenceDate: string;
}

export type ServiceStatus = "upcoming" | "serving" | "completion-day" | "completed";
export type MilestoneState = "completed" | "today" | "upcoming";

export interface CalendarDuration { years: number; months: number; days: number }
export interface Milestone {
  id: string;
  label: string;
  date: string;
  daysFromReference: number;
  state: MilestoneState;
  kind: "progress" | "rank";
}

export interface MilitaryDischargeResult {
  policy: ServicePolicy;
  startDate: string;
  referenceDate: string;
  endDate: string;
  serviceSpanDays: number;
  inclusiveServiceDays: number;
  remainingDays: number;
  daysUntilStart: number;
  elapsedDays: number;
  completedDaysAfterEnd: number;
  progressPercent: number;
  remainingCalendar: CalendarDuration;
  status: ServiceStatus;
  milestones: Milestone[];
  rankMilestones: Milestone[];
}
