import { isValidIsoDate, MAX_SUPPORTED_DATE, MIN_SUPPORTED_DATE } from "./date-utils";

export type BusinessDaysMode = "range" | "offset";
export interface RawBusinessDaysForm { mode: BusinessDaysMode; startDate: string; endDate: string; baseDate: string; businessDays: string }
export interface FieldError { field: keyof RawBusinessDaysForm; message: string }

function dateError(field: keyof RawBusinessDaysForm, value: string, label: string): FieldError | null {
  if (!value) return { field, message: `${label}을 입력해 주세요.` };
  if (!isValidIsoDate(value)) return { field, message: `올바른 ${label}을 입력해 주세요.` };
  if (value < MIN_SUPPORTED_DATE || value > MAX_SUPPORTED_DATE) return { field, message: `${MIN_SUPPORTED_DATE}부터 ${MAX_SUPPORTED_DATE}까지만 계산할 수 있습니다.` };
  return null;
}
export function validateBusinessDaysForm(form: RawBusinessDaysForm) {
  const errors: FieldError[] = [];
  if (form.mode === "range") {
    const start = dateError("startDate", form.startDate, "시작일"); const end = dateError("endDate", form.endDate, "종료일");
    if (start) errors.push(start); if (end) errors.push(end);
    if (!start && !end && form.endDate < form.startDate) errors.push({ field: "endDate", message: "종료일은 시작일보다 빠를 수 없습니다." });
  } else {
    const base = dateError("baseDate", form.baseDate, "기준일"); if (base) errors.push(base);
    if (!/^\d+$/.test(form.businessDays)) errors.push({ field: "businessDays", message: "영업일 수를 0 이상의 정수로 입력해 주세요." });
    else if (Number(form.businessDays) > 750) errors.push({ field: "businessDays", message: "영업일 수는 750일까지 입력할 수 있습니다." });
  }
  return errors;
}
