/**
 * 더치페이 계산기 — 입력 검증 + 공유 상태 파싱.
 *
 * tasks/bill-split-calculator/FORMULA.md "입력값"/"예외" 절의 범위를 그대로 구현한다(zod
 * 미사용, 손으로 짠 타입가드 — severance-pay/loan-interest-calculator 선례와 동일한 관례,
 * ARCHITECTURE.md "6.").
 */

import type { BillSplitInput, BillSplitMode, BillSplitShareState } from "./types";

// ── 허용 범위(FORMULA.md "입력값") ──────────────────────────────────────────

/** FORMULA.md "입력값" — 멤버 수 허용 범위(ARCHITECTURE.md "7."이 20명 유지를 확정). */
export const MIN_MEMBERS = 2;
export const MAX_MEMBERS = 20;

/** FORMULA.md "입력값" — 총 금액/개별 금액 허용 범위(원). */
export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = 100_000_000;

// ── ui.tsx가 관리하는 "검증 전" 원시 폼 상태 ─────────────────────────────────

export interface RawEqualSplitFormInput {
  mode: "equal";
  /** 콤마 포함 가능(예: "10,000"). */
  totalAmount: string;
  members: string[];
}

export interface RawWinnerTakeAllFormInput {
  mode: "winner-take-all";
  totalAmount: string;
  members: string[];
}

export interface RawLadderSplitFormInput {
  mode: "ladder";
  members: string[];
  /** `members`와 길이가 같아야 한다(멤버 추가/삭제 시 ui.tsx가 함께 동기화). */
  amounts: string[];
}

export type RawBillSplitFormInput =
  | RawEqualSplitFormInput
  | RawWinnerTakeAllFormInput
  | RawLadderSplitFormInput;

/**
 * 필드 식별자. 멤버/금액은 배열이라 인덱스를 붙인 문자열 태그를 쓴다(예: `member-2`,
 * `amount-2`) — ui.tsx가 `errorFor(`member-${index}`)`로 개별 항목 오류를 찾는다.
 */
export type BillSplitValidationField =
  | "totalAmount"
  | "members"
  | "amounts"
  | `member-${number}`
  | `amount-${number}`;

export interface BillSplitValidationFieldError {
  field: BillSplitValidationField;
  message: string;
}

export type BillSplitValidationResult =
  | { success: true; data: BillSplitInput }
  | { success: false; errors: BillSplitValidationFieldError[] };

function parseAmount(raw: string): number | undefined {
  const digits = raw.replace(/,/g, "").trim();
  if (!digits) return undefined;
  if (!/^\d+$/.test(digits)) return NaN;
  return Number(digits);
}

/**
 * 멤버 이름 목록을 검증한다(FORMULA.md "입력값"/"예외" — 길이 2~20, 각 원소 빈 문자열 불가).
 * 문제가 없으면 각 이름을 trim한 배열을 반환하고, 하나라도 실패하면 `errors`에 채워 넣고
 * `undefined`를 반환한다.
 */
function validateMembers(
  members: string[],
  errors: BillSplitValidationFieldError[],
): string[] | undefined {
  let ok = true;
  if (members.length < MIN_MEMBERS || members.length > MAX_MEMBERS) {
    errors.push({
      field: "members",
      message: `멤버는 ${MIN_MEMBERS}명 이상 ${MAX_MEMBERS}명 이하로 입력해 주세요.`,
    });
    ok = false;
  }
  const trimmed = members.map((name) => name.trim());
  trimmed.forEach((name, index) => {
    if (!name) {
      errors.push({ field: `member-${index}`, message: "이름을 입력해 주세요." });
      ok = false;
    }
  });
  return ok ? trimmed : undefined;
}

/** 균등 분배/몰아주기 공용 — 총 금액 검증(FORMULA.md "입력값"/"예외"). */
function validateTotalAmount(
  raw: string,
  errors: BillSplitValidationFieldError[],
): number | undefined {
  const parsed = parseAmount(raw);
  if (parsed === undefined) {
    errors.push({ field: "totalAmount", message: "총 금액을 입력해 주세요." });
    return undefined;
  }
  if (Number.isNaN(parsed)) {
    errors.push({ field: "totalAmount", message: "총 금액은 숫자만 입력해 주세요." });
    return undefined;
  }
  if (parsed < MIN_AMOUNT || parsed > MAX_AMOUNT) {
    errors.push({
      field: "totalAmount",
      message: `총 금액은 ${MIN_AMOUNT.toLocaleString("ko-KR")}원 이상 ${MAX_AMOUNT.toLocaleString("ko-KR")}원 이하로 입력해 주세요.`,
    });
    return undefined;
  }
  return parsed;
}

export function validateBillSplitInput(raw: RawBillSplitFormInput): BillSplitValidationResult {
  const errors: BillSplitValidationFieldError[] = [];
  const members = validateMembers(raw.members, errors);

  if (raw.mode === "equal" || raw.mode === "winner-take-all") {
    const totalAmount = validateTotalAmount(raw.totalAmount, errors);
    if (errors.length > 0 || members === undefined || totalAmount === undefined) {
      return { success: false, errors };
    }
    return { success: true, data: { mode: raw.mode, totalAmount, members } };
  }

  // ── 사다리타기 ──────────────────────────────────────────────────────────
  if (raw.amounts.length !== raw.members.length) {
    errors.push({
      field: "amounts",
      message: "금액 목록 개수가 멤버 수와 일치하지 않습니다. 새로고침 후 다시 시도해 주세요.",
    });
  }
  const amounts: number[] = [];
  let amountsOk = true;
  raw.amounts.forEach((rawAmount, index) => {
    const parsed = parseAmount(rawAmount);
    if (parsed === undefined) {
      errors.push({ field: `amount-${index}`, message: "금액을 입력해 주세요." });
      amountsOk = false;
      return;
    }
    if (Number.isNaN(parsed)) {
      errors.push({ field: `amount-${index}`, message: "금액은 숫자만 입력해 주세요." });
      amountsOk = false;
      return;
    }
    if (parsed < MIN_AMOUNT || parsed > MAX_AMOUNT) {
      errors.push({
        field: `amount-${index}`,
        message: `금액은 ${MIN_AMOUNT.toLocaleString("ko-KR")}원 이상 ${MAX_AMOUNT.toLocaleString("ko-KR")}원 이하로 입력해 주세요.`,
      });
      amountsOk = false;
      return;
    }
    amounts.push(parsed);
  });

  if (errors.length > 0 || members === undefined || !amountsOk) {
    return { success: false, errors };
  }
  return { success: true, data: { mode: "ladder", members, amounts } };
}

// ── 공유 상태(BillSplitShareState) 파싱(ARCHITECTURE.md "6.") ───────────────

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function isValidMemberCount(length: number): boolean {
  return length >= MIN_MEMBERS && length <= MAX_MEMBERS;
}

function isValidAmount(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_AMOUNT && value <= MAX_AMOUNT;
}

/** `permutation`이 `0..n-1`의 완전한 순열(bijection)인지 확인한다(손상된 공유 링크 방어). */
function isValidPermutation(value: number[], n: number): boolean {
  if (value.length !== n) return false;
  const sorted = [...value].sort((a, b) => a - b);
  return sorted.every((v, index) => v === index);
}

/**
 * `decodeShareState`가 반환한 `unknown` 페이로드를 `BillSplitShareState`로 파싱한다.
 * `mode` 필드와 분기별 필수 필드를 확인하고, 하나라도 어긋나면 `null`을 반환한다(기존
 * `decodeShareState`의 "손상된 상태는 화면 오류 대신 null" 원칙과 동일한 층위).
 */
export function parseBillSplitShareState(data: unknown): BillSplitShareState | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const mode = record.mode as BillSplitMode | undefined;

  if (mode === "equal") {
    if (typeof record.totalAmount !== "number" || !isStringArray(record.members)) return null;
    if (!isValidAmount(record.totalAmount) || !isValidMemberCount(record.members.length)) return null;
    return { mode: "equal", totalAmount: record.totalAmount, members: record.members };
  }

  if (mode === "winner-take-all") {
    if (
      typeof record.totalAmount !== "number" ||
      !isStringArray(record.members) ||
      typeof record.selectedIndex !== "number"
    ) {
      return null;
    }
    if (!isValidAmount(record.totalAmount) || !isValidMemberCount(record.members.length)) return null;
    if (!Number.isInteger(record.selectedIndex) || record.selectedIndex < 0 || record.selectedIndex >= record.members.length) {
      return null;
    }
    return {
      mode: "winner-take-all",
      totalAmount: record.totalAmount,
      members: record.members,
      selectedIndex: record.selectedIndex,
    };
  }

  if (mode === "ladder") {
    if (
      !isStringArray(record.members) ||
      !isFiniteNumberArray(record.amounts) ||
      !isFiniteNumberArray(record.permutation)
    ) {
      return null;
    }
    const n = record.members.length;
    if (!isValidMemberCount(n)) return null;
    if (record.amounts.length !== n || !record.amounts.every(isValidAmount)) return null;
    if (!isValidPermutation(record.permutation, n)) return null;
    return {
      mode: "ladder",
      members: record.members,
      amounts: record.amounts,
      permutation: record.permutation,
    };
  }

  return null;
}
