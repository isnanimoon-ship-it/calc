/**
 * 국민연금 예상수령액 계산기 — 순수 계산 로직.
 *
 * tasks/national-pension-benefit-estimate/FORMULA.md의 "공식" / "계산 순서" /
 * "정밀도·반올림 정책" 절을 그대로 구현한다. 공식이나 반올림 정책을 이 파일에서 임의로
 * 바꾸지 않는다.
 *
 * tasks/national-pension-benefit-estimate/ARCHITECTURE.md "5.", "6."이 정한 구조를 그대로
 * 따른다 — logic/ 디렉터리로 분할하지 않고, 재사용·독립 검증이 의미 있는 3개 함수만 이름
 * 있는 순수 함수로 분리한다(findPensionableAgeRow / calculateContributionAdjustmentFactor /
 * calculateEarlyOrDeferredAdjustmentRate). clamp와 basicPensionMonthlyRaw 산출은 한 줄
 * 산술이라 오케스트레이터(calculateNationalPensionBenefit) 안에 인라인한다.
 *
 * **중요 — Calculation Auditor에게(published 게이트)**: 이 파일 구현이 완료됐다는 사실이
 * 곧 이 계산기가 published로 전환 가능하다는 뜻은 아니다. tasks/national-pension-benefit-
 * estimate/ARCHITECTURE.md "1. PUBLISHED 전환 게이트" — ÷12 단계·최종 반올림 정책의
 * nps.or.kr(또는 work24.go.kr류) 라이브 계산기 대조가 완료되기 전까지 registry.ts의
 * status는 "draft"를 유지해야 한다(Builder는 이 게이트를 해소할 권한이 없다).
 *
 * 입력은 validation.ts(validateNationalPensionBenefitInput)를 통과했다는 전제다 — 이 함수
 * 자체는 방어적 검증(음수, 형식 등)을 반복하지 않는다(관심사 분리).
 */

import rates2026 from "@/src/data/rates-2026.json";
import type {
  NationalPensionBenefitEligibleResult,
  NationalPensionBenefitFormInput,
  NationalPensionBenefitIneligibleResult,
  NationalPensionBenefitResult,
  Won,
} from "./types";

/** rates-2026.json의 `nationalPensionBenefit` 네임스페이스 타입(2026년 스키마 기준). */
type NationalPensionBenefitRates = (typeof rates2026)["nationalPensionBenefit"];
export type PensionableAgeScheduleRow =
  NationalPensionBenefitRates["pensionableAgeSchedule"]["rows"][number];

const rates = rates2026.nationalPensionBenefit;

/**
 * 10원 미만 절사(내림). FORMULA.md "정밀도/반올림 정책"(2026-09-13 정정) — 국고금관리법
 * 제47조(국고금의 끝수 계산) 및 nps.or.kr "예상연금 간단계산" 라이브 계산기 21개
 * 데이터포인트 실증 대조(21/21 완전 일치, Calculation Auditor 확인) 근거. 원래 "원 단위
 * 반올림(round half up)"이었으나, 21/21 실증 결과에 따라 이 함수로 교체됐다 — 함수가
 * 호출되는 위치·횟수·전후 데이터 흐름(완전정밀도 값을 입력으로 받고, 절사된 값을 다른
 * 계산에 재사용하지 않는다)은 그대로 유지한다.
 */
function truncateTo10(amountWon: number): Won {
  return Math.floor(amountWon / 10) * 10;
}

/**
 * 기준소득월액 상·하한(B값 clamp 상·하한). FORMULA.md "정책 데이터 분리 요구사항"이 지시한
 * 대로 신규 필드를 만들지 않고 기존 `socialInsurance.nationalPension` 값을 그대로 참조한다
 * (ARCHITECTURE.md "2.1").
 */
const STANDARD_MONTHLY_INCOME_MIN =
  rates2026.socialInsurance.nationalPension.standardMonthlyIncomeMin.value;
const STANDARD_MONTHLY_INCOME_MAX =
  rates2026.socialInsurance.nationalPension.standardMonthlyIncomeMax.value;

/**
 * 6개 행을 순서대로 순회하며 birthYear가 속하는 첫 구간을 반환한다(FORMULA.md "6. 수급개시연령
 * 스케줄", "계산 순서" 2번). rows는 항상 전체 정수 범위를 빠짐없이 커버하도록 구성돼 있으므로
 * (첫 행 하한 null(=-Infinity), 마지막 행 상한 null(=+Infinity)) 매치 실패는 일어나지 않는다 —
 * 다만 방어적으로 매치 실패 시 에러를 던진다. 이 판정은 최소 가입기간 충족 여부와 무관하게
 * 항상 호출된다(아래 `calculateNationalPensionBenefit` 참고).
 */
export function findPensionableAgeRow(
  birthYear: number,
  rows: readonly PensionableAgeScheduleRow[],
): PensionableAgeScheduleRow {
  for (const row of rows) {
    const min = row.birthYearMin ?? -Infinity;
    const max = row.birthYearMax ?? Infinity;
    if (birthYear >= min && birthYear <= max) return row;
  }
  throw new Error(
    `findPensionableAgeRow: pensionableAgeSchedule에 birthYear=${birthYear}를 커버하는 구간이 없습니다.`,
  );
}

/**
 * 가입기간 보정계수(FORMULA.md "계산 순서" 6단계, "4. 가입기간별 지급률 보정").
 * `months <= baseMonths`(240개월/20년 이하)이면 비례(`months/baseMonths`), 초과하면
 * 초과 1개월당 `excessRate/12`씩 가산(`1 + excessRate*(months-baseMonths)/12`)한다.
 */
export function calculateContributionAdjustmentFactor(
  months: number,
  baseMonths: number,
  excessRate: number,
): number {
  if (months <= baseMonths) return months / baseMonths;
  return 1 + (excessRate * (months - baseMonths)) / 12;
}

/**
 * 조기(-)/연기(+) 조정률(FORMULA.md "7. 조기노령연금·연기연금"). 조기는 1개월당
 * `earlyPension.monthlyReductionRate`만큼 감액(음수), 연기는 1개월당
 * `deferredPension.monthlyIncreaseRate`만큼 가산(양수)한다. `months === 0`이면 0을 반환한다
 * (호출부가 굳이 분기해 이 함수 호출 자체를 생략하지 않아도 안전하다).
 */
export function calculateEarlyOrDeferredAdjustmentRate(
  months: number,
  earlyPension: { monthlyReductionRate: number },
  deferredPension: { monthlyIncreaseRate: number },
): number {
  if (months < 0) return -earlyPension.monthlyReductionRate * -months;
  if (months > 0) return deferredPension.monthlyIncreaseRate * months;
  return 0;
}

/**
 * 국민연금 노령연금 예상수령액 계산 메인 함수. FORMULA.md "계산 순서" 2~10단계를 그대로
 * 구현한다(1번 입력 검증은 validation.ts 책임).
 */
export function calculateNationalPensionBenefit(
  input: NationalPensionBenefitFormInput,
): NationalPensionBenefitResult {
  // 계산 순서 2번 — 수급개시연령 판정. 최소 가입기간 충족 여부와 무관하게 항상 수행한다
  // (SPEC.md "수급개시연령은 기본연금액 계산과 무관한 독립 판정").
  const scheduleRow = findPensionableAgeRow(
    input.birthYear,
    rates.pensionableAgeSchedule.rows,
  );
  const pensionableAge = scheduleRow.age;
  const pensionableYear = input.birthYear + pensionableAge;

  // 계산 순서 3번 — 최소 가입기간 판정(120개월/10년, "이상" 요건이라 경계값 포함).
  const minEligibleMonths = rates.minEligibleMonths.value;
  if (input.totalContributionMonths < minEligibleMonths) {
    const ineligible: NationalPensionBenefitIneligibleResult = {
      eligible: false,
      pensionableAge,
      pensionableYear,
      minEligibleMonths,
      totalContributionMonths: input.totalContributionMonths,
    };
    return ineligible;
  }

  // 계산 순서 4번 — B값 근사 및 기준소득월액 상·하한 clamp.
  const bValueApprox: Won = Math.min(
    Math.max(input.averageMonthlyIncome, STANDARD_MONTHLY_INCOME_MIN),
    STANDARD_MONTHLY_INCOME_MAX,
  );
  const bValueClamped = bValueApprox !== input.averageMonthlyIncome;

  // 계산 순서 5번 — A값·비례상수 조회(정책 데이터 파일에서, 하드코딩 금지).
  const aValue: Won = rates.aValue.value;
  const proportionalConstant = rates.proportionalConstant.value;

  // 계산 순서 6번 — 가입기간 보정계수.
  const contributionAdjustmentFactor = calculateContributionAdjustmentFactor(
    input.totalContributionMonths,
    rates.baseMonthsForFullRate.value,
    rates.excessYearBonusRate.value,
  );

  // 계산 순서 7번 — 기본연금액(완전정밀도). 이 변수만 9번 단계(조기/연기 조정)에 넘긴다 —
  // 절사된 basicPensionMonthly를 재사용하지 않는다(FORMULA.md "정밀도/반올림 정책"의 핵심
  // 불변식, ARCHITECTURE.md "6." 참고). 곱셈을 모두 마친 뒤 마지막에 한 번만 12로 나눈다.
  const basicPensionMonthlyRaw =
    (proportionalConstant * (aValue + bValueApprox) * contributionAdjustmentFactor) / 12;

  // 계산 순서 8번 — 표시용 기본연금액 확정(10원 미만 절사/내림).
  // [2026-09-13 정정] FORMULA.md "정밀도/반올림 정책": 원래 "잠정 round half up"이었으나,
  // Calculation Auditor의 nps.or.kr 라이브 계산기 21개 데이터포인트 실증 대조(21/21 완전
  // 일치, 국고금관리법 제47조 근거) 결과에 따라 "10원 미만 절사"로 교정됐다.
  const basicPensionMonthly: Won = truncateTo10(basicPensionMonthlyRaw);

  // 계산 순서 9번 — 조기/연기연금 반영(승격됨). 반드시 basicPensionMonthlyRaw(절사 전
  // 완전정밀도 값)를 기준으로 별도로 계산한다 — basicPensionMonthly(절사 후)를 재사용하면
  // 결함이다(ARCHITECTURE.md "6." 핵심 불변식).
  let earlyOrDeferredAdjustmentRate: number | undefined;
  let adjustedPensionMonthly: Won | undefined;
  if (input.earlyOrDeferredMonths !== 0) {
    earlyOrDeferredAdjustmentRate = calculateEarlyOrDeferredAdjustmentRate(
      input.earlyOrDeferredMonths,
      rates.earlyPension,
      rates.deferredPension,
    );
    // [2026-09-13 정정] 기본연금액과 동일하게 10원 미만 절사로 교정(위와 동일 지점).
    // FORMULA.md "7."/"정밀도/반올림 정책": 이 절사 규칙이 조기/연기 조정값에도 그대로
    // 적용되는지는 Calculation Auditor의 nps.or.kr 라이브 대조(21개 데이터포인트, 전부
    // 조기/연기 미신청 케이스)가 직접 검증하지 않았다 — 기본연금액과 동일한 절사 규칙을
    // 적용하는 것이 합리적이라는 판단에 따른 것이며, 확정된 사실이 아니라 추정이다.
    adjustedPensionMonthly = truncateTo10(
      basicPensionMonthlyRaw * (1 + earlyOrDeferredAdjustmentRate),
    );
  }

  // 계산 순서 10번 — 결과 breakdown 구성.
  const eligible: NationalPensionBenefitEligibleResult = {
    eligible: true,
    pensionableAge,
    pensionableYear,
    aValue,
    bValueApprox,
    bValueClamped,
    proportionalConstant,
    contributionAdjustmentFactor,
    basicPensionMonthly,
    earlyOrDeferredMonths: input.earlyOrDeferredMonths,
    earlyOrDeferredAdjustmentRate,
    adjustedPensionMonthly,
  };
  return eligible;
}
