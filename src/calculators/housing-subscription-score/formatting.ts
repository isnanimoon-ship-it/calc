/**
 * 청약가점 계산기 — 표시용 포맷팅 + breakdown/경고 문구 조립.
 *
 * logic.ts는 숫자·boolean만 반환한다(ARCHITECTURE.md "5. 타입 결정" 경계) — 사람이 읽는
 * 문장(계산 근거·경고)은 이 파일이 `(input, result) => string[] / BreakdownRow[]` 형태로
 * 조립한다(weekly-holiday-allowance `buildWeeklyHolidayBreakdown` 선례).
 */

import type {
  HousingSubscriptionScoreInput,
  HousingSubscriptionScoreResult,
} from "./types";

/** "YYYY-MM-DD" → "YYYY년 M월 D일"(parental-leave-benefit/formatting.ts와 동일 패턴). */
export function formatKoreanDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

/** "YYYY-MM-DD" → "YYYY.MM.DD"(짧은 표시용). */
export function formatShortDate(value: string): string {
  return value.replaceAll("-", ".");
}

/** 계산 근거(계산 방법) 화면용 한 행. weekly-holiday-allowance의 `BreakdownRow`와 같은 형태. */
export interface BreakdownRow {
  label: string;
  legalBasis: string;
  expression: string;
}

/**
 * 무주택기간/청약통장 가입기간 "N년 이상 ~ (N+1)년 미만" 구간 라벨.
 * years=0이면 "1년 미만", years가 상한 경계(capYears) 이상이면 "{capYears}년 이상"으로
 * 표시한다(FORMULA.md "배점표" 1·3번 표의 구간 표현 그대로).
 */
function yearRangeLabel(years: number, capYears: number): string {
  if (years <= 0) return "1년 미만";
  if (years >= capYears) return `${capYears}년 이상`;
  return `${years}년 이상 ~ ${years + 1}년 미만`;
}

/** 무주택기간 행(계산 근거). 산정 미시작/미충족이면 사유를 그대로 설명한다. */
function buildHomelessRow(
  input: HousingSubscriptionScoreInput,
  result: HousingSubscriptionScoreResult,
): BreakdownRow {
  const legalBasis = "「주택공급에 관한 규칙」 별표 1 (무주택기간)";

  if (!result.homelessEligible) {
    const reasonTexts: string[] = [];
    if (result.homelessIneligibleReasons.includes("underAgeUnmarried")) {
      reasonTexts.push("아직 만 30세 생일 또는 혼인신고일 전이라 무주택기간 산정이 시작되지 않았습니다");
    }
    if (result.homelessIneligibleReasons.includes("currentlyOwns")) {
      reasonTexts.push("현재 주택을 소유하고 있어 무주택 요건을 충족하지 못했습니다");
    }
    return {
      label: "무주택기간",
      legalBasis,
      expression: `${reasonTexts.join(" · ")} → 0점`,
    };
  }

  const startLabel = result.homelessStartDate
    ? formatKoreanDate(result.homelessStartDate)
    : "산정 기산일";
  const rangeLabel = yearRangeLabel(result.homelessPeriodYears, 15);
  const capNote = result.homelessPeriodCapped ? "(15년 이상 상한 적용)" : "";
  return {
    label: "무주택기간",
    legalBasis,
    expression:
      `${startLabel}부터 ${input.baseDate ? formatKoreanDate(input.baseDate) : ""}까지 ` +
      `${result.homelessPeriodYears}년 경과 → ${rangeLabel} 구간 → ${result.homelessPeriodScore}점${capNote}`,
  };
}

/** 부양가족수 행(계산 근거). */
function buildDependentRow(
  input: HousingSubscriptionScoreInput,
  result: HousingSubscriptionScoreResult,
): BreakdownRow {
  const spouseCount = input.hasQualifyingSpouseInHousehold ? 1 : 0;
  const cappedNote = result.dependentCountCapped ? "(6명 이상 상한 적용)" : "";
  return {
    label: "부양가족수",
    legalBasis: "「주택공급에 관한 규칙」 별표 1 (부양가족수)",
    expression:
      `배우자 ${spouseCount}명 + 직계존속 ${input.qualifyingAscendantCount}명 + ` +
      `직계비속 ${input.qualifyingDescendantCount}명 = ${result.dependentCount}명 → ` +
      `5점 + 5점 × ${Math.min(result.dependentCount, 6)}명 = ${result.dependentScore}점${cappedNote}`,
  };
}

/** 청약통장 가입기간 행(계산 근거). */
function buildSubscriptionRow(
  input: HousingSubscriptionScoreInput,
  result: HousingSubscriptionScoreResult,
): BreakdownRow {
  const legalBasis = "「주택공급에 관한 규칙」 별표 1 (청약통장 가입기간)";

  if (!input.hasSubscriptionAccount) {
    return {
      label: "청약통장 가입기간",
      legalBasis,
      expression: "청약통장 미가입 → 0점",
    };
  }

  const months = result.subscriptionPeriodMonths;
  const years = result.subscriptionPeriodYears;
  const remMonths = months % 12;
  const capNote = result.subscriptionPeriodCapped ? "(15년 이상 상한 적용)" : "";

  let rangeLabel: string;
  if (months < 6) rangeLabel = "6개월 미만";
  else if (months < 12) rangeLabel = "6개월 이상 ~ 1년 미만";
  else rangeLabel = yearRangeLabel(years, 15);

  return {
    label: "청약통장 가입기간",
    legalBasis,
    expression:
      `${years}년 ${remMonths}개월(총 ${months}개월) → ${rangeLabel} 구간 → ` +
      `${result.subscriptionPeriodScore}점${capNote}`,
  };
}

/**
 * 계산 방법(계산 근거) 화면용 3행. FORMULA.md "계산 순서" 7단계
 * ("각 항목에 대해 실제 입력값을 대입한 설명 문자열 생성")를 그대로 구현한다.
 */
export function buildHousingScoreBreakdown(
  input: HousingSubscriptionScoreInput,
  result: HousingSubscriptionScoreResult,
): BreakdownRow[] {
  return [
    buildHomelessRow(input, result),
    buildDependentRow(input, result),
    buildSubscriptionRow(input, result),
  ];
}

/**
 * 무주택기간 항목 전용 경고 문구(FORMULA.md "예외" 절 문구를 그대로 옮김). ui.tsx가 이
 * 경고를 "무주택기간 카드 바로 아래"에 배치할 수 있도록 항목별로 분리했다(ARCHITECTURE.md
 * "6. UI 구조" 결과 화면 3번 — 경고 카드는 해당 항목 근처에 독립적으로 노출).
 */
export function buildHomelessIneligibleWarnings(
  result: HousingSubscriptionScoreResult,
): string[] {
  const warnings: string[] = [];
  if (result.homelessIneligibleReasons.includes("underAgeUnmarried")) {
    warnings.push(
      "만 30세 미만 미혼은 무주택기간 점수가 0점입니다(만 30세 생일 또는 혼인신고일부터 산정 시작).",
    );
  }
  if (result.homelessIneligibleReasons.includes("currentlyOwns")) {
    warnings.push(
      "현재 주택을 소유하고 있어 무주택기간 점수를 산정할 수 없습니다. 민영주택 일반공급 가점제 자격 자체도 충족하지 못할 수 있습니다.",
    );
  }
  return warnings;
}

/** 청약통장 가입기간 항목 전용 경고 문구(미가입일 때만). 위와 같은 이유로 분리했다. */
export function buildSubscriptionNotRegisteredWarning(
  input: HousingSubscriptionScoreInput,
): string | null {
  return input.hasSubscriptionAccount
    ? null
    : "청약통장 미가입 상태에서는 가입기간 점수가 0점입니다.";
}

/**
 * 결과 경고 문구 전체(FORMULA.md "예외" 절 문구를 그대로 옮김). 계산을 막지 않는다 — 사유
 * 안내 목적이다. 3개 조건은 서로 배타적이지 않아 동시에 여러 개가 나올 수 있다.
 */
export function buildHousingScoreWarnings(
  input: HousingSubscriptionScoreInput,
  result: HousingSubscriptionScoreResult,
): string[] {
  const subscriptionWarning = buildSubscriptionNotRegisteredWarning(input);
  return [
    ...buildHomelessIneligibleWarnings(result),
    ...(subscriptionWarning ? [subscriptionWarning] : []),
  ];
}
