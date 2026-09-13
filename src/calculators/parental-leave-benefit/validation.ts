import { MAX_TOTAL_MONTHS, PARENTAL_LEAVE_POLICY_SUPPORTED_FROM } from "./policy";
import type { BenefitScheme, ExtensionEligibility, ParentalLeaveBenefitInput, SpouseLeaveStatus } from "./types";

export interface RawParentalLeaveBenefitInput {
  startDate: string; leaveMonths: string | number; ordinaryWageWon: string | number;
  scheme: string; priorLeaveMonths: string | number; childBirthDate?: string;
  spouseStartDate?: string; spouseLeaveMonths?: string | number; spouseLeaveStatus?: string;
  extensionEligibility?: string;
}
type Field = keyof RawParentalLeaveBenefitInput;
export type ValidationResult = { success: true; data: ParentalLeaveBenefitInput } | { success: false; errors: { field: Field; message: string }[] };

function parseInteger(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const normalized = value.replace(/,/g, "").trim();
  return /^\d+$/.test(normalized) ? Number(normalized) : NaN;
}
export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function validateParentalLeaveBenefitInput(raw: RawParentalLeaveBenefitInput): ValidationResult {
  const errors: { field: Field; message: string }[] = [];
  const leaveMonths = parseInteger(raw.leaveMonths);
  const priorLeaveMonths = parseInteger(raw.priorLeaveMonths);
  const ordinaryWageWon = parseInteger(raw.ordinaryWageWon);
  const schemes = ["general", "parents-together", "single-parent"];
  if (!raw.startDate) errors.push({ field: "startDate", message: "육아휴직 시작일을 입력해 주세요." });
  else if (!isValidIsoDate(raw.startDate)) errors.push({ field: "startDate", message: "올바른 시작일을 입력해 주세요." });
  else if (raw.startDate < PARENTAL_LEAVE_POLICY_SUPPORTED_FROM) errors.push({ field: "startDate", message: `${PARENTAL_LEAVE_POLICY_SUPPORTED_FROM} 이후 시작하는 육아휴직만 계산할 수 있습니다.` });
  if (!Number.isInteger(leaveMonths) || leaveMonths < 1 || leaveMonths > MAX_TOTAL_MONTHS) errors.push({ field: "leaveMonths", message: "이번 육아휴직 기간은 1~18개월의 정수로 입력해 주세요." });
  if (!Number.isInteger(priorLeaveMonths) || priorLeaveMonths < 0 || priorLeaveMonths > 17) errors.push({ field: "priorLeaveMonths", message: "이전에 사용한 기간은 0~17개월의 정수로 입력해 주세요." });
  if (Number.isInteger(leaveMonths) && Number.isInteger(priorLeaveMonths) && leaveMonths + priorLeaveMonths > MAX_TOTAL_MONTHS) errors.push({ field: "leaveMonths", message: "이전 사용기간과 이번 기간을 합해 18개월을 넘을 수 없습니다." });
  if (!Number.isInteger(ordinaryWageWon) || ordinaryWageWon < 1 || ordinaryWageWon > 1_000_000_000) errors.push({ field: "ordinaryWageWon", message: "월 통상임금은 1원 이상 10억 원 이하의 정수로 입력해 주세요." });
  if (!schemes.includes(raw.scheme)) errors.push({ field: "scheme", message: "적용 유형을 선택해 주세요." });
  if (priorLeaveMonths + leaveMonths > 12 && !["both-parents", "single-parent", "disabled-child"].includes(raw.extensionEligibility ?? "")) errors.push({ field: "extensionEligibility", message: "12개월을 초과하려면 연장 사용 요건을 확인해 주세요." });

  if (raw.scheme === "parents-together") {
    if (!raw.childBirthDate || !isValidIsoDate(raw.childBirthDate)) errors.push({ field: "childBirthDate", message: "자녀 생년월일을 입력해 주세요." });
    else if (raw.startDate && isValidIsoDate(raw.startDate) && raw.childBirthDate > raw.startDate) errors.push({ field: "childBirthDate", message: "자녀 생년월일은 육아휴직 시작일보다 늦을 수 없습니다." });
    if (!raw.spouseStartDate || !isValidIsoDate(raw.spouseStartDate)) errors.push({ field: "spouseStartDate", message: "배우자의 육아휴직 시작일을 입력해 주세요." });
    const spouseMonths = parseInteger(raw.spouseLeaveMonths ?? "");
    if (!Number.isInteger(spouseMonths) || spouseMonths < 1 || spouseMonths > 18) errors.push({ field: "spouseLeaveMonths", message: "배우자의 육아휴직 기간은 1~18개월로 입력해 주세요." });
    if (!["used", "planned"].includes(raw.spouseLeaveStatus ?? "")) errors.push({ field: "spouseLeaveStatus", message: "배우자의 사용 상태를 선택해 주세요." });
    if (raw.childBirthDate && isValidIsoDate(raw.childBirthDate) && raw.spouseStartDate && isValidIsoDate(raw.spouseStartDate) && raw.spouseStartDate < raw.childBirthDate) errors.push({ field: "spouseStartDate", message: "배우자의 시작일은 자녀 생년월일보다 빠를 수 없습니다." });
  }
  if (errors.length) return { success: false, errors };
  return { success: true, data: {
    startDate: raw.startDate, leaveMonths, ordinaryWageWon, scheme: raw.scheme as BenefitScheme,
    priorLeaveMonths, childBirthDate: raw.childBirthDate || undefined, spouseStartDate: raw.spouseStartDate || undefined,
    spouseLeaveMonths: raw.scheme === "parents-together" ? parseInteger(raw.spouseLeaveMonths!) : undefined,
    spouseLeaveStatus: raw.spouseLeaveStatus as SpouseLeaveStatus | undefined,
    extensionEligibility: raw.extensionEligibility as ExtensionEligibility | undefined,
  } };
}
