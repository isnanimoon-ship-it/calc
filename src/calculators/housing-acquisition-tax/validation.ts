/**
 * 주택 취득세 계산기 — 입력 검증.
 *
 * tasks/housing-acquisition-tax/FORMULA.md "입력값" 표 / "예외" 절, SPEC.md "오류와 예외
 * 처리"를 그대로 구현한다. zod는 이 프로젝트의 정식 의존성이 아니므로(severance-pay 선례)
 * 순수 TypeScript 검증 함수로 작성한다. bmr-calculator/housing-subscription-score와 동일하게
 * 모든 필드를 검사해 오류를 한 번에 모아 반환한다(첫 오류에서 멈추지 않음).
 *
 * **상·하한 근거(SPEC.md가 Builder 재량으로 위임, ARCHITECTURE.md "8." 참고)**: 정확한 세율
 * 판정 로직 자체와는 무관한 순수 UX 가드(타이핑 실수 방어)다. 취득가액 상한
 * 100,000,000,000원(1,000억원)은 ARCHITECTURE.md "4."가 검토한 "Number로 안전한 최악
 * 조합"을 그대로 따른다. 하한 1,000,000원(100만원)은 실제 주택 매매 시나리오에서 있을 수
 * 없는 값(타이핑 실수·단위 착오)만 걸러내는 넉넉한 값이다.
 */

import type {
  HouseCountAfterAcquisition,
  HousingAcquisitionTaxFormInput,
} from "./types";

/** FORMULA.md "입력값" 표 — 취득가액 하한(원). "비정상적으로 작은 값" 가드(SPEC Must Have). */
export const MIN_ACQUISITION_PRICE = 1_000_000;
/** 취득가액 상한(원) — ARCHITECTURE.md "4." 최악 조합 검토(1,000억원까지 Number로 안전). */
export const MAX_ACQUISITION_PRICE = 100_000_000_000;
/** 전용면적 하한(㎡) — "비정상적으로 작은 값" 가드. */
export const MIN_EXCLUSIVE_AREA = 1;
/** 전용면적 상한(㎡) — ARCHITECTURE.md "8." 권장 넉넉한 상한. */
export const MAX_EXCLUSIVE_AREA = 10_000;

const VALID_HOUSE_COUNTS: HouseCountAfterAcquisition[] = [1, 2, 3, 4];

/**
 * ui.tsx의 form 상태 — 검증 전이라 금액·면적은 문자열이고, 아직 선택하지 않은 라디오는
 * `null`이다(SPEC.md Must Have — "선택하지 않으면 계산하지 않는다", 추정 기본값 금지).
 */
export interface RawHousingAcquisitionTaxFormInput {
  /** 콤마가 포함될 수 있는 금액 문자열(예: "650,000,000"). */
  acquisitionPrice: string;
  exclusiveArea: string;
  /** 미선택 상태를 표현하기 위해 boolean이 아니라 boolean | null을 쓴다. */
  isAdjustmentTargetArea: boolean | null;
  houseCountAfterAcquisition: HouseCountAfterAcquisition | null;
}

export type HousingAcquisitionTaxField = keyof RawHousingAcquisitionTaxFormInput;

export interface ValidationFieldError {
  field: HousingAcquisitionTaxField;
  message: string;
}

export type ValidationResult =
  | { success: true; data: HousingAcquisitionTaxFormInput }
  | { success: false; errors: ValidationFieldError[] };

/** 콤마 등 숫자 이외의 문자를 제거하고 숫자로 정규화한다. 빈 값은 undefined, 숫자가 아니면 NaN. */
function toOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.replace(/,/g, "").trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : NaN;
}

/**
 * 방어적 타입 가드 — `houseCountAfterAcquisition`이 1~4 중 하나인지 확인한다. 정상적인 폼
 * 제출 경로(카드형 라디오)는 이 타입을 벗어날 수 없지만, 공유 URL 복원(`unknown` JSON)
 * 경로에서는 1~4 밖의 값이 들어올 수 있어 `ui.tsx`뿐 아니라 이 파일에서도 재확인한다
 * (`tasks/housing-acquisition-tax/ARCHITECTURE.md "8."`, bmr-calculator `isValidActivityLevel`
 * 선례와 동일한 패턴).
 */
export function isValidHouseCount(
  value: unknown,
): value is HouseCountAfterAcquisition {
  return (
    typeof value === "number" &&
    VALID_HOUSE_COUNTS.includes(value as HouseCountAfterAcquisition)
  );
}

export function validateHousingAcquisitionTaxInput(
  raw: RawHousingAcquisitionTaxFormInput,
): ValidationResult {
  const errors: ValidationFieldError[] = [];

  // ── acquisitionPrice(취득가액) ────────────────────────────────────────────────
  const acquisitionPrice = toOptionalNumber(raw.acquisitionPrice);
  if (acquisitionPrice === undefined) {
    errors.push({ field: "acquisitionPrice", message: "매매가(취득가액)를 입력해 주세요." });
  } else if (Number.isNaN(acquisitionPrice)) {
    errors.push({ field: "acquisitionPrice", message: "매매가(취득가액)는 숫자로 입력해 주세요." });
  } else if (acquisitionPrice <= 0) {
    errors.push({ field: "acquisitionPrice", message: "매매가(취득가액)는 0보다 커야 합니다." });
  } else if (acquisitionPrice < MIN_ACQUISITION_PRICE) {
    errors.push({
      field: "acquisitionPrice",
      message: `매매가(취득가액)가 너무 작습니다. ${MIN_ACQUISITION_PRICE.toLocaleString("ko-KR")}원 이상인지 확인해 주세요.`,
    });
  } else if (acquisitionPrice > MAX_ACQUISITION_PRICE) {
    errors.push({
      field: "acquisitionPrice",
      message: `매매가(취득가액)가 너무 큽니다. ${MAX_ACQUISITION_PRICE.toLocaleString("ko-KR")}원 이하로 입력해 주세요.`,
    });
  }

  // ── exclusiveArea(전용면적) ───────────────────────────────────────────────────
  const exclusiveArea = toOptionalNumber(raw.exclusiveArea);
  if (exclusiveArea === undefined) {
    errors.push({ field: "exclusiveArea", message: "전용면적을 입력해 주세요." });
  } else if (Number.isNaN(exclusiveArea)) {
    errors.push({ field: "exclusiveArea", message: "전용면적은 숫자로 입력해 주세요." });
  } else if (exclusiveArea <= 0) {
    errors.push({ field: "exclusiveArea", message: "전용면적은 0보다 커야 합니다." });
  } else if (exclusiveArea < MIN_EXCLUSIVE_AREA) {
    errors.push({
      field: "exclusiveArea",
      message: `전용면적이 너무 작습니다. ${MIN_EXCLUSIVE_AREA}㎡ 이상인지 확인해 주세요.`,
    });
  } else if (exclusiveArea > MAX_EXCLUSIVE_AREA) {
    errors.push({
      field: "exclusiveArea",
      message: `전용면적이 너무 큽니다. ${MAX_EXCLUSIVE_AREA.toLocaleString("ko-KR")}㎡ 이하로 입력해 주세요.`,
    });
  }

  // ── isAdjustmentTargetArea(조정대상지역 여부) — 미선택 시 계산하지 않음(SPEC Must Have) ──
  if (raw.isAdjustmentTargetArea === null) {
    errors.push({
      field: "isAdjustmentTargetArea",
      message: "이 지역이 규제지역(조정대상지역)인지 선택해 주세요.",
    });
  }

  // ── houseCountAfterAcquisition(취득 후 보유 주택 수) — 미선택 시 계산하지 않음 ──────────
  if (raw.houseCountAfterAcquisition === null) {
    errors.push({
      field: "houseCountAfterAcquisition",
      message: "이 집을 포함해서 총 몇 채를 갖게 되는지 선택해 주세요.",
    });
  } else if (!isValidHouseCount(raw.houseCountAfterAcquisition)) {
    // 정상적인 폼 제출 경로에서는 도달하지 않는다 — 공유 URL 복원 등 방어적 코드.
    errors.push({
      field: "houseCountAfterAcquisition",
      message: "보유 주택 수 값이 올바르지 않습니다. 다시 선택해 주세요.",
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      acquisitionPrice: acquisitionPrice as number,
      exclusiveArea: exclusiveArea as number,
      isAdjustmentTargetArea: raw.isAdjustmentTargetArea as boolean,
      houseCountAfterAcquisition: raw.houseCountAfterAcquisition as HouseCountAfterAcquisition,
    },
  };
}
