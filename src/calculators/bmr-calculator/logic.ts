/**
 * 기초대사량(BMR) 계산기 — 순수 계산 로직.
 *
 * tasks/bmr-calculator/FORMULA.md "공식" / "계산 순서" / "정밀도·반올림 정책" 절을 그대로
 * 구현한다. 공식이나 반올림 정책을 이 파일에서 임의로 바꾸지 않는다.
 *
 * tasks/bmr-calculator/ARCHITECTURE.md "1.", "2."가 정한 구조를 그대로 따른다 —
 * 대표 공식(Mifflin-St Jeor)/보조 공식(Harris-Benedict 개정판)/TDEE 세 계산은 각각 이름
 * 있는 순수 함수로 분리하고, 오케스트레이터(`calculateBmrCalculation`)는 조립만 한다.
 *
 * **핵심 불변식(ARCHITECTURE.md "2.")**: `calculateTdee`의 첫 파라미터는 반드시 반올림 전
 * 완전정밀도 값(`bmr.raw`)이어야 한다. `bmr.display`를 넘기면 FORMULA.md Golden Test #20이
 * 재현하는 정확한 실패 모드(외부 계산기와 1kcal 어긋남)가 그대로 발생한다 — 파라미터 이름을
 * `bmrRaw`로 고정해 이 계약을 시그니처로 드러낸다.
 *
 * 입력은 validation.ts(validateBmrInput)를 통과했다는 전제다 — 이 함수들 자체는 방어적
 * 검증(범위, 형식 등)을 반복하지 않는다(관심사 분리). 단, `activityLevel`이 1~5 범위 밖인
 * 경우(방어적 코딩 대상, FORMULA.md "예외")는 이 파일의 오케스트레이터가 직접 처리한다
 * (ARCHITECTURE.md "6.1" — validation.ts가 아니라 logic.ts의 "계산 순서" 책임).
 *
 * **중요 — Builder는 자신이 만든 계산기가 정확하다고 최종 판정하지 않는다.** 이 파일의
 * Golden Test가 통과한다는 사실은 Calculation Auditor의 독립 재검증을 대체하지 않는다.
 */

import type {
  ActivityLevel,
  BmrCalculationInput,
  BmrCalculationResult,
  BodyMetrics,
  RoundedKcalValue,
  TdeeLevelComparisonRow,
  TdeeValue,
} from "./types";

/**
 * 활동계수 5단계(FORMULA.md "활동계수 5단계" 표). 법령·고시 값이 아니라 여러 독립 출처가
 * 재현하는 학술 표준값이라 `rates-{year}.json`에 두지 않는다(types.ts 주석과 동일 근거).
 */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  1: 1.2,
  2: 1.375,
  3: 1.55,
  4: 1.725,
  5: 1.9,
};

/** `activityLevel`이 방어적 코딩 대상(1~5 밖의 값)인지 판별하는 타입 가드. */
export function isValidActivityLevel(value: unknown): value is ActivityLevel {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/** 정수 kcal로 반올림한다(0.5는 올림 — FORMULA.md "정밀도/반올림 정책", 값이 항상 양수). */
function roundKcal(value: number): number {
  return Math.round(value);
}

/**
 * 대표 공식 — Mifflin-St Jeor(1990). FORMULA.md "공식" 절 그대로.
 *   남성: 10×체중 + 6.25×키 − 5×나이 + 5
 *   여성: 10×체중 + 6.25×키 − 5×나이 − 161
 */
export function calculateBmr(metrics: BodyMetrics): RoundedKcalValue {
  const sexConstant = metrics.sex === "male" ? 5 : -161;
  const raw =
    10 * metrics.weightKg + 6.25 * metrics.heightCm - 5 * metrics.ageYears + sexConstant;
  return { raw, display: roundKcal(raw) };
}

/**
 * 보조 공식(Should Have) — Harris-Benedict 개정판(Roza & Shizgal, 1984). FORMULA.md "공식"
 * 절 그대로. `calculateBmr`을 전혀 참조하지 않는 완전히 독립된 계산이다(ARCHITECTURE.md "1.1").
 *   남성: 88.362 + 13.397×체중 + 4.799×키 − 5.677×나이
 *   여성: 447.593 + 9.247×체중 + 3.098×키 − 4.330×나이
 */
export function calculateBmrAlternative(metrics: BodyMetrics): RoundedKcalValue {
  const raw =
    metrics.sex === "male"
      ? 88.362 + 13.397 * metrics.weightKg + 4.799 * metrics.heightCm - 5.677 * metrics.ageYears
      : 447.593 + 9.247 * metrics.weightKg + 3.098 * metrics.heightCm - 4.33 * metrics.ageYears;
  return { raw, display: roundKcal(raw) };
}

/**
 * TDEE — 활동계수 적용(FORMULA.md "TDEE — 활동계수 적용"). 파라미터 이름 `bmrRaw` 자체가
 * 계약이다(ARCHITECTURE.md "2." 1번) — 호출부는 반드시 반올림 전 완전정밀도 BMR을 넘겨야
 * 한다. `bmrRaw`를 반올림된 값으로 잘못 넘기면 FORMULA.md Golden Test #20이 문서화한 정책
 * 차이(외부 계산기와 1kcal 어긋남)가 재현된다.
 */
export function calculateTdee(bmrRaw: number, activityLevel: ActivityLevel): TdeeValue {
  const activityFactor = ACTIVITY_FACTORS[activityLevel];
  const raw = bmrRaw * activityFactor;
  return { raw, display: roundKcal(raw), activityLevel, activityFactor };
}

/**
 * (Should Have) 활동계수 1~5 전체 비교표. 새 산식이 아니라 `calculateTdee`를 레벨별로 호출한
 * 결과일 뿐이다(ARCHITECTURE.md "1.1" — 표 생성 헬퍼가 계산 로직을 드리프트시키지 않는다).
 */
export function calculateAllTdeeLevels(bmrRaw: number): TdeeLevelComparisonRow[] {
  return ([1, 2, 3, 4, 5] as ActivityLevel[]).map((level) => calculateTdee(bmrRaw, level));
}

/**
 * 오케스트레이터 — 조립만 하고 산식을 갖지 않는다(FORMULA.md "계산 순서" 1~6번,
 * ARCHITECTURE.md "1.2"). `bmrAlternative`는 `bmr`을 전혀 참조하지 않는다 — 두 계산이 같은
 * `metrics`만 공유할 뿐 서로의 결과값을 재사용하지 않는다.
 */
export function calculateBmrCalculation(input: BmrCalculationInput): BmrCalculationResult {
  const metrics: BodyMetrics = input;
  const bmr = calculateBmr(metrics);
  const bmrAlternative = calculateBmrAlternative(metrics);

  let tdee: TdeeValue | undefined;
  if (input.activityLevel !== null && isValidActivityLevel(input.activityLevel)) {
    // FORMULA.md "예외": activityLevel이 1~5 밖의 값이면(방어적 코딩 대상) TDEE를 만들지
    // 않는다. 반드시 bmr.raw(반올림 전)를 전달한다 — bmr.display를 전달하지 않는다.
    tdee = calculateTdee(bmr.raw, input.activityLevel);
  }

  return { input, bmr, bmrAlternative, tdee };
}
