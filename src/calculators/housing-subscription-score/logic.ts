/**
 * 청약가점 계산기 — 순수 계산 로직.
 *
 * tasks/housing-subscription-score/FORMULA.md "공식" 1~9단계를 그대로 구현한다. 배점 계수는
 * 전부 `policy.ts`에서 읽으며 매직 넘버를 직접 쓰지 않는다(ARCHITECTURE.md "3." 결정).
 * 날짜 산술은 `src/lib/date-calc.ts`의 `parseIsoDateUtc`/`calendarFullYearsBetweenUtc`/
 * `calendarFullMonthsBetweenUtc`를 그대로 재사용한다(새로 구현하지 않는다).
 *
 * 이 파일은 문자열(breakdown/경고 문구)을 반환하지 않는다 — 숫자·boolean만 반환하고, 사람이
 * 읽는 문장 조립은 `formatting.ts`가 담당한다(ARCHITECTURE.md "5. 타입 결정" 경계).
 */

import {
  calendarFullMonthsBetweenUtc,
  calendarFullYearsBetweenUtc,
  lastDayOfMonthUtc,
  parseIsoDateUtc,
} from "@/src/lib/date-calc";
import { HOUSING_SUBSCRIPTION_SCORE_POLICY as POLICY } from "./policy";
import type {
  HomelessIneligibleReason,
  HousingSubscriptionScoreInput,
  HousingSubscriptionScoreResult,
} from "./types";

/** UTC 자정 Date를 "YYYY-MM-DD"로 되돌린다(결과 표시용). */
function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * `birthDate`로부터 "만 30세가 되는 날"(생일 그대로, 연도만 +30)을 구한다(FORMULA.md 공식
 * 1단계, 2026-09-06 Formula Analyst 보완 — 윤년 2월 29일 clamp 규칙).
 *
 * 생일이 2월 29일이고 30세가 되는 해(`birthDate.year + 30`)가 평년이면, `Date.UTC`의 표준
 * 정규화(월 오버플로 → 3월 1일로 밀림)에 맡기지 않고 그 해의 2월 28일로 명시적으로
 * clamp한다(민법 제160조제3항, FORMULA.md "공식" 1단계 근거 그대로). 이 계산기의 "+30년"
 * 산식 특성상 2월 29일 출생연도는 반드시 4의 배수여야 하고 30은 4의 배수가 아니므로,
 * "출생연도+30"은 결코 4의 배수(윤년)가 될 수 없다 — 즉 이 clamp은 2월 29일생 전원에게
 * 예외 없이 매번 적용된다(FORMULA.md 공식 1단계 "참고" 문단, 검증 예제 13·14).
 *
 * `age-calculator/date-utils.ts`의 `anniversaryInYear`(`Math.min(day, daysInMonth(year,
 * month))`)와 개념적으로 동일한 월말 clamp 패턴이지만, 파일을 공유(import)하지 않고 이
 * 계산기 자체 헬퍼로 독립 구현한다(ARCHITECTURE.md "2." 결정 — 두 계산기의 날짜 헬퍼를
 * 통합하지 않기로 이미 확정됨). 단, `lastDayOfMonthUtc`는 계산기 도메인 의미가 전혀 없는
 * 순수 산술 유틸(`src/lib/date-calc.ts`, "월의 마지막 날짜")이라 공유해도 되는 것으로 이미
 * 판단됐다(ARCHITECTURE.md "2." 참고) — 이를 재사용한다.
 */
function ageThirtyDate(birthDate: Date): Date {
  const year = birthDate.getUTCFullYear() + 30;
  const month = birthDate.getUTCMonth();
  const day = Math.min(birthDate.getUTCDate(), lastDayOfMonthUtc(year, month));
  return new Date(Date.UTC(year, month, day));
}

function requireDate(iso: string, label: string): Date {
  const parsed = parseIsoDateUtc(iso);
  if (!parsed) {
    throw new Error(`calculateHousingSubscriptionScore: 유효하지 않은 ${label} (${iso})`);
  }
  return parsed;
}

/** FORMULA.md 공식 1~9단계를 그대로 구현한 메인 계산 함수. */
export function calculateHousingSubscriptionScore(
  input: HousingSubscriptionScoreInput,
): HousingSubscriptionScoreResult {
  const baseDate = requireDate(input.baseDate, "기준일");
  const birthDate = requireDate(input.birthDate, "생년월일");

  // 1. 무주택기간 기산일 후보 산정 ------------------------------------------------
  const ageStartDate = ageThirtyDate(birthDate);
  const marriageDate =
    input.isMarried && input.marriageDate
      ? requireDate(input.marriageDate, "혼인신고일")
      : null;
  const homelessStartCandidate =
    input.isMarried && marriageDate && marriageDate.getTime() < ageStartDate.getTime()
      ? marriageDate
      : ageStartDate;

  // 2. 무주택 요건 판정 ------------------------------------------------------------
  const currentlyHomeless = input.housingStatus !== "currently_owns";

  // 3. 무주택기간 실제 기산일(처분일 이후 재기산) ------------------------------------
  const disposalDate =
    input.housingStatus === "disposed" && input.mostRecentDisposalDate
      ? requireDate(input.mostRecentDisposalDate, "최근 처분일")
      : null;
  const homelessStartDate =
    disposalDate && disposalDate.getTime() > homelessStartCandidate.getTime()
      ? disposalDate
      : homelessStartCandidate;

  // 4. 무주택기간 연수 --------------------------------------------------------------
  const homelessEligible =
    baseDate.getTime() >= homelessStartCandidate.getTime() && currentlyHomeless;

  const homelessIneligibleReasons: HomelessIneligibleReason[] = [];
  if (baseDate.getTime() < homelessStartCandidate.getTime()) {
    homelessIneligibleReasons.push("underAgeUnmarried");
  }
  if (!currentlyHomeless) {
    homelessIneligibleReasons.push("currentlyOwns");
  }

  const homelessPeriodYears = homelessEligible
    ? calendarFullYearsBetweenUtc(homelessStartDate, baseDate)
    : 0;

  // 5. 무주택기간 점수 --------------------------------------------------------------
  const rawHomelessScore =
    POLICY.homelessPeriod.perYearScore * (homelessPeriodYears + 1);
  const homelessPeriodScore = homelessEligible
    ? Math.min(POLICY.homelessPeriod.maxScore, rawHomelessScore)
    : 0;
  const homelessPeriodCapped =
    homelessEligible && rawHomelessScore > POLICY.homelessPeriod.maxScore;

  // 6. 부양가족수 --------------------------------------------------------------------
  const dependentCount =
    (input.hasQualifyingSpouseInHousehold ? 1 : 0) +
    input.qualifyingAscendantCount +
    input.qualifyingDescendantCount;
  const cappedDependentCount = Math.min(dependentCount, POLICY.dependentCount.capCount);
  const dependentScore =
    POLICY.dependentCount.baseScore +
    POLICY.dependentCount.perDependentScore * cappedDependentCount;
  const dependentCountCapped = dependentCount > POLICY.dependentCount.capCount;

  // 7. 청약통장 가입기간(개월수) ------------------------------------------------------
  const subscriptionOpenDate =
    input.hasSubscriptionAccount && input.subscriptionAccountOpenDate
      ? requireDate(input.subscriptionAccountOpenDate, "청약통장 최초 가입일")
      : null;
  const subscriptionMonthsRaw =
    input.hasSubscriptionAccount && subscriptionOpenDate
      ? calendarFullMonthsBetweenUtc(subscriptionOpenDate, baseDate)
      : -1;

  // 8. 청약통장 가입기간 점수 ---------------------------------------------------------
  let subscriptionPeriodScore = 0;
  let subscriptionPeriodCapped = false;
  if (subscriptionMonthsRaw < 0) {
    subscriptionPeriodScore = 0;
  } else if (subscriptionMonthsRaw < 6) {
    subscriptionPeriodScore = POLICY.subscriptionPeriod.under6MonthsScore;
  } else if (subscriptionMonthsRaw < 12) {
    subscriptionPeriodScore = POLICY.subscriptionPeriod.under1YearScore;
  } else {
    const rawScore =
      Math.floor(subscriptionMonthsRaw / 12) +
      POLICY.subscriptionPeriod.baseScoreAfter1Year;
    subscriptionPeriodScore = Math.min(POLICY.subscriptionPeriod.maxScore, rawScore);
    subscriptionPeriodCapped = rawScore > POLICY.subscriptionPeriod.maxScore;
  }

  const subscriptionPeriodMonths = subscriptionMonthsRaw < 0 ? 0 : subscriptionMonthsRaw;
  const subscriptionPeriodYears = Math.floor(subscriptionPeriodMonths / 12);

  // 9. 총점 --------------------------------------------------------------------------
  const totalScore = homelessPeriodScore + dependentScore + subscriptionPeriodScore;

  return {
    homelessEligible,
    homelessIneligibleReasons,
    // "currentlyHomeless=false"(현재 주택 소유 중)면 무주택기간 기산일 자체가 의미 없어
    // null로 둔다(types.ts 주석). 그 외(만 30세 미도달 포함)에는 참고용으로 값을 채운다.
    homelessStartDate: currentlyHomeless ? toIsoDate(homelessStartDate) : null,
    homelessPeriodYears,
    homelessPeriodScore,
    homelessPeriodCapped,

    dependentCount,
    dependentScore,
    dependentCountCapped,

    subscriptionPeriodMonths,
    subscriptionPeriodYears,
    subscriptionPeriodScore,
    subscriptionPeriodCapped,

    totalScore,
  };
}
