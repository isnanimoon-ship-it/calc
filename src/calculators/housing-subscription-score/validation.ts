/**
 * 청약가점 계산기 — 입력 검증.
 *
 * tasks/housing-subscription-score/FORMULA.md "입력값" 표의 허용 범위와 조건부 필수 필드,
 * "예외" 절의 날짜 논리 검증을 그대로 구현한다. zod는 이 프로젝트의 정식 의존성이 아니라서
 * (severance-pay/validation.ts 선례) 순수 TypeScript 검증 함수로 작성한다.
 */

import type { HousingStatus, HousingSubscriptionScoreInput } from "./types";

/** ui.tsx의 form 상태 — 검증 전이라 날짜/개수가 문자열일 수 있다. */
export interface RawHousingSubscriptionScoreFormInput {
  baseDate: string;
  birthDate: string;
  isMarried: boolean;
  marriageDate?: string;
  /** 빈 문자열은 "아직 선택 안 함"을 의미한다. */
  housingStatus: HousingStatus | "";
  mostRecentDisposalDate?: string;
  smallLowValueHomeException: boolean;
  hasQualifyingSpouseInHousehold: boolean;
  qualifyingAscendantCount: string | number;
  qualifyingDescendantCount: string | number;
  hasSubscriptionAccount: boolean;
  subscriptionAccountOpenDate?: string;
}

export type HousingScoreField = keyof RawHousingSubscriptionScoreFormInput;

export interface ValidationFieldError {
  field: HousingScoreField;
  message: string;
}

export type ValidationResult =
  | { success: true; data: HousingSubscriptionScoreInput }
  | { success: false; errors: ValidationFieldError[] };

/** FORMULA.md "입력값" 표: `birthDate` 허용 범위 하한. */
export const MIN_BIRTH_DATE = "1900-01-01";

/** FORMULA.md "입력값" 표: `baseDate`는 "오늘+5년 이내"까지만 허용한다. */
export const MAX_FUTURE_YEARS_FOR_BASE_DATE = 5;

/** FORMULA.md "입력값" 표: 인정 직계존속 수 "상식적 상한(예: 4)". */
export const MAX_ASCENDANT_COUNT = 4;

/** FORMULA.md "입력값" 표: 인정 미혼 직계비속 수 "상식적 상한(예: 10)". */
export const MAX_DESCENDANT_COUNT = 10;

const HOUSING_STATUSES: HousingStatus[] = ["never_owned", "disposed", "currently_owns"];

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

/** 오늘로부터 `years`년 뒤의 ISO 날짜 문자열(문자열 비교로 상한 검사에 사용). */
function todayPlusYearsIso(years: number): string {
  const now = new Date();
  const future = new Date(
    Date.UTC(now.getUTCFullYear() + years, now.getUTCMonth(), now.getUTCDate()),
  );
  return future.toISOString().slice(0, 10);
}

/** 문자열/숫자 입력을 정수로 정규화한다. 빈 값은 undefined, 숫자가 아니면 NaN. */
function toOptionalInt(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (!/^\d+$/.test(trimmed)) return NaN;
  return Number(trimmed);
}

export function validateHousingSubscriptionScoreInput(
  raw: RawHousingSubscriptionScoreFormInput,
): ValidationResult {
  const errors: ValidationFieldError[] = [];

  // ── baseDate ────────────────────────────────────────────────────────────────
  const baseDateFormatValid = !!raw.baseDate && isValidIsoDate(raw.baseDate);
  if (!raw.baseDate) {
    errors.push({ field: "baseDate", message: "기준일을 입력해 주세요." });
  } else if (!baseDateFormatValid) {
    errors.push({ field: "baseDate", message: "올바른 기준일을 입력해 주세요." });
  } else if (raw.baseDate > todayPlusYearsIso(MAX_FUTURE_YEARS_FOR_BASE_DATE)) {
    errors.push({
      field: "baseDate",
      message: `기준일은 오늘로부터 ${MAX_FUTURE_YEARS_FOR_BASE_DATE}년 이내로 입력해 주세요.`,
    });
  }

  // ── birthDate ───────────────────────────────────────────────────────────────
  const birthDateFormatValid = !!raw.birthDate && isValidIsoDate(raw.birthDate);
  if (!raw.birthDate) {
    errors.push({ field: "birthDate", message: "생년월일을 입력해 주세요." });
  } else if (!birthDateFormatValid) {
    errors.push({ field: "birthDate", message: "올바른 생년월일을 입력해 주세요." });
  } else if (raw.birthDate < MIN_BIRTH_DATE) {
    errors.push({
      field: "birthDate",
      message: `생년월일은 ${MIN_BIRTH_DATE} 이후로 입력해 주세요.`,
    });
  }

  if (baseDateFormatValid && birthDateFormatValid && raw.birthDate > raw.baseDate) {
    errors.push({
      field: "birthDate",
      message: "생년월일은 기준일보다 늦을(미래일) 수 없습니다.",
    });
  }

  // ── housingStatus ───────────────────────────────────────────────────────────
  const housingStatusValid = HOUSING_STATUSES.includes(raw.housingStatus as HousingStatus);
  if (!housingStatusValid) {
    errors.push({ field: "housingStatus", message: "주택 소유 이력을 선택해 주세요." });
  }

  // ── isMarried → marriageDate(조건부 필수) ─────────────────────────────────────
  if (raw.isMarried) {
    if (!raw.marriageDate) {
      errors.push({ field: "marriageDate", message: "혼인신고일을 입력해 주세요." });
    } else if (!isValidIsoDate(raw.marriageDate)) {
      errors.push({ field: "marriageDate", message: "올바른 혼인신고일을 입력해 주세요." });
    } else {
      if (birthDateFormatValid && raw.marriageDate < raw.birthDate) {
        errors.push({
          field: "marriageDate",
          message: "혼인신고일은 생년월일보다 빠를 수 없습니다.",
        });
      }
      if (baseDateFormatValid && raw.marriageDate > raw.baseDate) {
        errors.push({
          field: "marriageDate",
          message: "혼인신고일은 기준일보다 늦을(미래일) 수 없습니다.",
        });
      }
    }
  }

  // ── housingStatus==='disposed' → mostRecentDisposalDate(조건부 필수) ──────────
  if (raw.housingStatus === "disposed") {
    if (!raw.mostRecentDisposalDate) {
      errors.push({
        field: "mostRecentDisposalDate",
        message: "최근 처분일을 입력해 주세요.",
      });
    } else if (!isValidIsoDate(raw.mostRecentDisposalDate)) {
      errors.push({
        field: "mostRecentDisposalDate",
        message: "올바른 최근 처분일을 입력해 주세요.",
      });
    } else {
      if (birthDateFormatValid && raw.mostRecentDisposalDate < raw.birthDate) {
        errors.push({
          field: "mostRecentDisposalDate",
          message: "최근 처분일은 생년월일보다 빠를 수 없습니다.",
        });
      }
      if (baseDateFormatValid && raw.mostRecentDisposalDate > raw.baseDate) {
        errors.push({
          field: "mostRecentDisposalDate",
          message: "최근 처분일은 기준일보다 늦을(미래일) 수 없습니다.",
        });
      }
    }
  }

  // ── qualifyingAscendantCount / qualifyingDescendantCount ─────────────────────
  const ascendant = toOptionalInt(raw.qualifyingAscendantCount);
  if (ascendant === undefined) {
    errors.push({
      field: "qualifyingAscendantCount",
      message: "인정되는 직계존속 수를 입력해 주세요.",
    });
  } else if (Number.isNaN(ascendant) || ascendant < 0 || !Number.isInteger(ascendant)) {
    errors.push({
      field: "qualifyingAscendantCount",
      message: "인정되는 직계존속 수는 0 이상의 정수로 입력해 주세요.",
    });
  } else if (ascendant > MAX_ASCENDANT_COUNT) {
    errors.push({
      field: "qualifyingAscendantCount",
      message: `인정되는 직계존속 수는 ${MAX_ASCENDANT_COUNT}명 이하로 입력해 주세요.`,
    });
  }

  const descendant = toOptionalInt(raw.qualifyingDescendantCount);
  if (descendant === undefined) {
    errors.push({
      field: "qualifyingDescendantCount",
      message: "인정되는 미혼 직계비속 수를 입력해 주세요.",
    });
  } else if (Number.isNaN(descendant) || descendant < 0 || !Number.isInteger(descendant)) {
    errors.push({
      field: "qualifyingDescendantCount",
      message: "인정되는 미혼 직계비속 수는 0 이상의 정수로 입력해 주세요.",
    });
  } else if (descendant > MAX_DESCENDANT_COUNT) {
    errors.push({
      field: "qualifyingDescendantCount",
      message: `인정되는 미혼 직계비속 수는 ${MAX_DESCENDANT_COUNT}명 이하로 입력해 주세요.`,
    });
  }

  // ── hasSubscriptionAccount → subscriptionAccountOpenDate(조건부 필수) ─────────
  if (raw.hasSubscriptionAccount) {
    if (!raw.subscriptionAccountOpenDate) {
      errors.push({
        field: "subscriptionAccountOpenDate",
        message: "청약통장 최초 가입일을 입력해 주세요.",
      });
    } else if (!isValidIsoDate(raw.subscriptionAccountOpenDate)) {
      errors.push({
        field: "subscriptionAccountOpenDate",
        message: "올바른 청약통장 최초 가입일을 입력해 주세요.",
      });
    } else {
      if (birthDateFormatValid && raw.subscriptionAccountOpenDate < raw.birthDate) {
        errors.push({
          field: "subscriptionAccountOpenDate",
          message: "청약통장 최초 가입일은 생년월일보다 빠를 수 없습니다.",
        });
      }
      if (baseDateFormatValid && raw.subscriptionAccountOpenDate > raw.baseDate) {
        errors.push({
          field: "subscriptionAccountOpenDate",
          message: "청약통장 최초 가입일은 기준일보다 늦을(미래일) 수 없습니다.",
        });
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      baseDate: raw.baseDate,
      birthDate: raw.birthDate,
      isMarried: raw.isMarried,
      marriageDate: raw.isMarried ? raw.marriageDate : undefined,
      housingStatus: raw.housingStatus as HousingStatus,
      mostRecentDisposalDate:
        raw.housingStatus === "disposed" ? raw.mostRecentDisposalDate : undefined,
      smallLowValueHomeException:
        raw.housingStatus === "currently_owns" ? raw.smallLowValueHomeException : false,
      hasQualifyingSpouseInHousehold: raw.isMarried
        ? raw.hasQualifyingSpouseInHousehold
        : false,
      qualifyingAscendantCount: ascendant as number,
      qualifyingDescendantCount: descendant as number,
      hasSubscriptionAccount: raw.hasSubscriptionAccount,
      subscriptionAccountOpenDate: raw.hasSubscriptionAccount
        ? raw.subscriptionAccountOpenDate
        : undefined,
    },
  };
}
