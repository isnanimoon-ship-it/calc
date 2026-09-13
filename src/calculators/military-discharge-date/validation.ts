import { SERVICE_POLICY_SUPPORTED_FROM, getServicePolicy } from "./policy";
import type { MilitaryDischargeInput } from "./types";

export interface RawMilitaryDischargeInput { serviceType: string; startDate: string; referenceDate: string }
export type ValidationResult = { success: true; data: MilitaryDischargeInput } | { success: false; errors: { field: keyof RawMilitaryDischargeInput; message: string }[] };

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function validateMilitaryDischargeInput(raw: RawMilitaryDischargeInput): ValidationResult {
  const errors: { field: keyof RawMilitaryDischargeInput; message: string }[] = [];
  if (!getServicePolicy(raw.serviceType)) errors.push({ field: "serviceType", message: "복무 유형을 선택해 주세요." });
  if (!raw.startDate) errors.push({ field: "startDate", message: "복무 시작일을 입력해 주세요." });
  else if (!isValidIsoDate(raw.startDate)) errors.push({ field: "startDate", message: "올바른 날짜를 입력해 주세요." });
  else if (raw.startDate < SERVICE_POLICY_SUPPORTED_FROM || raw.startDate > "2100-12-31") errors.push({ field: "startDate", message: `${SERVICE_POLICY_SUPPORTED_FROM} 이후 날짜만 계산할 수 있습니다.` });
  if (!raw.referenceDate || !isValidIsoDate(raw.referenceDate)) errors.push({ field: "referenceDate", message: "올바른 기준일을 입력해 주세요." });
  else if (raw.referenceDate < "2020-01-01" || raw.referenceDate > "2200-12-31") errors.push({ field: "referenceDate", message: "기준일은 2020년부터 2200년 사이로 입력해 주세요." });
  return errors.length ? { success: false, errors } : { success: true, data: raw };
}
