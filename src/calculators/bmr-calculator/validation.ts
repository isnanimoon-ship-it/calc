/**
 * 기초대사량(BMR) 계산기 — 입력 검증.
 *
 * tasks/bmr-calculator/FORMULA.md "입력값" 표 / "예외" 절, tasks/bmr-calculator/
 * ARCHITECTURE.md "6."을 그대로 반영한다. severance-pay/bmi-calculator와 동일한 순수
 * TypeScript 검증 함수 패턴을 따른다(zod 미사용 — 이 프로젝트에 zod가 정식 의존성이 아니다).
 *
 * 검증 순서(FORMULA.md "예외"가 나열한 순서 그대로): 성별 → 나이 → 키 → 체중.
 * `activityLevel`은 이 파일이 검증하지 않는다 — UI의 라디오 그룹이 고정된 값 집합(`null`,
 * `1`~`5`)으로만 전달하므로 문자열 파싱을 거치지 않고, "1~5 밖의 값"(방어적 코딩 대상)은
 * FORMULA.md 자신이 "계산 순서"(검증이 아니라 계산 단계) 안에서 설명하므로 logic.ts가
 * 처리한다(ARCHITECTURE.md "6.1").
 *
 * `bmi-calculator/validation.ts`의 관례(모든 필드를 검사해 오류를 한 번에 모아 반환, 첫
 * 오류에서 멈추지 않음)를 그대로 재사용한다.
 */

import type { ActivityLevel, BmrCalculationInput, Sex } from "./types";

/** FORMULA.md "유효 연령 범위 근거" — Mifflin-St Jeor 원 논문 피험자 연령대. */
export const MIN_AGE = 19;
export const MAX_AGE = 78;

/** FORMULA.md "키/체중 입력 범위 근거" — 실무적 guard-rail. */
export const MIN_HEIGHT_CM = 100.0;
export const MAX_HEIGHT_CM = 230.0;
export const MIN_WEIGHT_KG = 20.0;
export const MAX_WEIGHT_KG = 300.0;

/**
 * ui.tsx의 form 상태 — 아직 검증 전이라 대부분 문자열이다. `activityLevel`은 라디오
 * 그룹에서 고정된 값 집합으로 직접 들어오므로(문자열 파싱 없음) 여기서도 이미 좁혀진
 * 타입으로 받는다(ARCHITECTURE.md "6.1", "9.").
 */
export interface RawBmrFormInput {
  sex: Sex | "";
  ageYears: string;
  heightCm: string;
  weightKg: string;
  activityLevel: ActivityLevel | null;
}

export interface FormError {
  field: "sex" | "ageYears" | "heightCm" | "weightKg";
  message: string;
}

export type BmrValidationResult =
  | { success: true; data: BmrCalculationInput }
  | { success: false; errors: FormError[] };

/** 문자열을 숫자로 정규화한다. 빈 문자열/공백만 있는 값은 undefined로 취급한다. */
function toOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : NaN;
}

/**
 * 한국어 조사(을/를, 은/는)는 앞 글자의 받침(종성) 유무로 정해진다 — "체중"(받침 있음)은
 * "체중을"/"체중은", "키"(받침 없음)는 "키를"/"키는"이 맞다(QA 발견, 순수 오탈자 수정).
 * `label`을 라벨별로 하드코딩하지 않고 받침 유무를 직접 계산해 두 라벨 모두에서 항상
 * 문법적으로 맞는 조사를 고르게 한다.
 */
function hasFinalConsonant(label: string): boolean {
  const lastChar = label.charCodeAt(label.length - 1);
  const isHangulSyllable = lastChar >= 0xac00 && lastChar <= 0xd7a3;
  if (!isHangulSyllable) return true;
  return (lastChar - 0xac00) % 28 !== 0;
}

function validateHeightOrWeight(
  raw: string,
  field: "heightCm" | "weightKg",
  label: string,
  unit: string,
  min: number,
  max: number,
  errors: FormError[],
): number | undefined {
  const objectParticle = hasFinalConsonant(label) ? "을" : "를";
  const topicParticle = hasFinalConsonant(label) ? "은" : "는";
  const value = toOptionalNumber(raw);
  if (value === undefined) {
    errors.push({ field, message: `${label}${objectParticle} 입력해 주세요.` });
    return undefined;
  }
  if (Number.isNaN(value)) {
    errors.push({ field, message: `${label}${topicParticle} 숫자여야 합니다.` });
    return undefined;
  }
  if (value < min || value > max) {
    errors.push({
      field,
      message: `${label}${topicParticle} ${min}~${max}${unit} 사이여야 합니다.`,
    });
    return undefined;
  }
  return value;
}

/**
 * 기초대사량(BMR) 계산기 입력값을 검증한다. 성공 시 logic.ts(calculateBmrCalculation)가
 * 바로 받을 수 있는 BmrCalculationInput을 반환한다.
 */
export function validateBmrInput(raw: RawBmrFormInput): BmrValidationResult {
  const errors: FormError[] = [];

  // 1. 성별 — 필수.
  if (raw.sex !== "male" && raw.sex !== "female") {
    errors.push({ field: "sex", message: "성별을 선택해 주세요." });
  }

  // 2. 나이 — 정수만 허용(소수·문자·공백 모두 거부), 19~78.
  //    "30.5"·"삼십" 모두 거부해야 하므로(Golden Test #24) `/^\d+$/` 형태의 순수 정수
  //    문자열 검사를 먼저 하고, 그 다음 범위(19~78)를 검사한다.
  const ageTrimmed = raw.ageYears.trim();
  if (ageTrimmed === "") {
    errors.push({ field: "ageYears", message: "나이를 입력해 주세요." });
  } else if (!/^\d+$/.test(ageTrimmed)) {
    errors.push({ field: "ageYears", message: "나이는 정수(세)로 입력해 주세요." });
  } else {
    const age = Number(ageTrimmed);
    if (age < MIN_AGE || age > MAX_AGE) {
      errors.push({
        field: "ageYears",
        message: `나이는 ${MIN_AGE}~${MAX_AGE}세 사이여야 합니다.`,
      });
    }
  }

  // 3. 키 — 100.0~230.0cm(경계값 포함, 소수 자릿수 제한 없음).
  const height = validateHeightOrWeight(
    raw.heightCm,
    "heightCm",
    "키",
    "cm",
    MIN_HEIGHT_CM,
    MAX_HEIGHT_CM,
    errors,
  );

  // 4. 체중 — 20.0~300.0kg(경계값 포함, 소수 자릿수 제한 없음).
  const weight = validateHeightOrWeight(
    raw.weightKg,
    "weightKg",
    "체중",
    "kg",
    MIN_WEIGHT_KG,
    MAX_WEIGHT_KG,
    errors,
  );

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      sex: raw.sex as Sex,
      ageYears: Number(ageTrimmed),
      heightCm: height as number,
      weightKg: weight as number,
      activityLevel: raw.activityLevel,
    },
  };
}
