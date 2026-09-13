/**
 * 국민연금 예상수령액 계산기 — 표시용 포맷팅 + 계산 근거/선택지 라벨 조립.
 *
 * docs/CALCULATOR_RULES.md "금액/숫자 연산": 화면 표시는 Intl.NumberFormat('ko-KR')로 통일한다.
 * logic.ts는 숫자/boolean만 반환한다 — 사람이 읽는 문장(계산 근거·조기/연기 select 라벨)은
 * 이 파일이 조립한다(annual-salary-take-home-pay/formatting.ts와 동일한 경계).
 */

import rates2026 from "@/src/data/rates-2026.json";
import type {
  NationalPensionBenefitEligibleResult,
  NationalPensionBenefitFormInput,
} from "./types";

const numberFormatter = new Intl.NumberFormat("ko-KR");

/** 원 단위 금액을 "1,234,567원" 형태로 표시한다. */
export function formatWon(amountWon: number): string {
  return `${numberFormatter.format(Math.round(amountWon))}원`;
}

/** 나이를 "65세" 형태로 표시한다. */
export function formatAge(age: number): string {
  return `${numberFormatter.format(age)}세`;
}

/** 연도를 "2026년" 형태로 표시한다(연도는 4자리 숫자를 그대로 붙일 뿐, 천 단위 콤마를 넣지 않는다). */
export function formatYear(year: number): string {
  return `${year}년`;
}

/** 개월수를 "300개월" 형태로 표시한다. */
export function formatMonths(months: number): string {
  return `${numberFormatter.format(months)}개월`;
}

/**
 * 총 가입개월수를 "25년 0개월(총 300개월)" 형태로 사람이 읽기 쉽게 보여준다. FORMULA.md
 * "단위": "가입기간: 개월(정수) 단위로 내부 처리. 화면 표시는 'N년 M개월' 등으로 변환 가능."
 */
export function formatContributionPeriod(months: number): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return `${years}년 ${remainingMonths}개월(총 ${formatMonths(months)})`;
}

/** 비례상수(무차원 소수)를 "1.29" 형태로 표시한다(소수 둘째 자리까지). */
export function formatProportionalConstant(value: number): string {
  return value.toFixed(2);
}

/**
 * 가입기간 보정계수를 "100.0%"(20년 가입 기준 대비 비율) 형태로 표시한다. FORMULA.md "4." —
 * 결과 화면에 "20년 가입 기준 대비 {비율}% 수준으로 계산됨" 등을 표시하라는 요구를 반영한다.
 */
export function formatContributionAdjustmentFactor(factor: number): string {
  return `${(factor * 100).toFixed(1)}%`;
}

/** 조기/연기 조정률 등 부호 있는 비율을 "+36.0%"/"-30.0%" 형태로 표시한다. */
export function formatSignedRate(rate: number): string {
  const percent = rate * 100;
  const sign = percent > 0 ? "+" : percent < 0 ? "-" : "";
  return `${sign}${Math.abs(percent).toFixed(1)}%`;
}

/** 조기/연기 select 옵션 하나(값=개월수, 라벨=사람이 읽는 설명). */
export interface EarlyOrDeferredOption {
  value: number;
  label: string;
}

const { earlyPension, deferredPension } = rates2026.nationalPensionBenefit;

/**
 * "5년 앞당김(-30.0%)" ~ "그대로(법정 수급개시연령)" ~ "5년 연기(+36.0%)" 11개 옵션
 * (개월수 오름차순: -60,-48,...,0,...,+48,+60).
 * FORMULA.md "7.", ARCHITECTURE.md "8.1"이 확정한 값(개월수·감액/가산율)을 그대로
 * 반영한다 — 비율을 하드코딩하지 않고 rates2026에서 읽어 라벨을 동적으로 계산한다.
 *
 * [2026-09-13 Optimizer 수정] 원래 라벨("5년 앞당겨 받기(조기노령연금, -30.0%)")은 320px
 * 뷰포트에서 QA가 실측 확인한 대로 select 닫힘 상태에서 조정률 숫자 부분이 잘렸다
 * (tasks/national-pension-benefit-estimate/QA.md "select 최장 라벨이 320px에서만 잘림"
 * 참고, `getBoundingClientRect` 실측 기준 select 표시 가능 폭 내에 약 19자까지만 표시됨).
 * "조기노령연금"/"연기연금"이라는 용어는 select 바로 아래 helpText(ui.tsx)에서 이미
 * 설명하므로, 옵션 라벨 자체는 "N년 앞당김/연기(조정률)"로 축약해도 의미 손실이 없다 —
 * 축약 후 가장 긴 라벨도 14자로 QA가 실측한 표시 가능 폭(약 19자)에 여유 있게 들어간다.
 */
export const EARLY_OR_DEFERRED_OPTIONS: EarlyOrDeferredOption[] = [
  ...[5, 4, 3, 2, 1].map((years) => {
    const months = -(years * 12);
    const rate = -(earlyPension.monthlyReductionRate * years * 12);
    return {
      value: months,
      label: `${years}년 앞당김(${formatSignedRate(rate)})`,
    };
  }),
  { value: 0, label: "그대로(법정 수급개시연령)" },
  ...[1, 2, 3, 4, 5].map((years) => {
    const months = years * 12;
    const rate = deferredPension.monthlyIncreaseRate * years * 12;
    return {
      value: months,
      label: `${years}년 연기(${formatSignedRate(rate)})`,
    };
  }),
];

/** 계산 근거(계산 방법) 화면용 한 행. housing-subscription-score/annual-salary와 같은 형태. */
export interface BreakdownRow {
  label: string;
  legalBasis: string;
  expression: string;
}

/**
 * logic.ts `calculateNationalPensionBenefit`의 7번째 계산 순서(기본연금액, 완전정밀도)를
 * 표시 전용으로 재현한다 — **logic.ts의 실제 계산·반올림 정책을 바꾸지 않는다.** logic.ts는
 * 이 절사 전 완전정밀도 값(`basicPensionMonthlyRaw`)을 결과 타입에 노출하지 않으므로(지역
 * 변수로만 유지, types.ts 참고), "계산 방법" 화면에 실제 대입값을 보여주기 위해(SPEC.md
 * Must Have "각 단계의 실제 대입값") 이미 결과에 공개된 필드(aValue/bValueApprox/
 * proportionalConstant/contributionAdjustmentFactor)만으로 logic.ts와 정확히 동일한 수식을
 * 다시 계산한다 — 연산 순서·피연산자를 logic.ts 158행과 문자 그대로 동일하게 맞춰(부동소수점
 * 결과까지 동일) 화면 표시값이 실제 계산과 어긋나지 않도록 한다.
 */
function recomputeBasicPensionMonthlyRaw(
  result: NationalPensionBenefitEligibleResult,
): number {
  return (
    (result.proportionalConstant *
      (result.aValue + result.bValueApprox) *
      result.contributionAdjustmentFactor) /
    12
  );
}

/**
 * FORMULA.md "계산 순서" 4~9단계를 실제 대입값과 함께 보여주는 계산 근거 행 목록을 만든다
 * (SPEC.md Must Have "기본연금액 산출 근거를 계산 근거 섹션에서 단계별로 보여준다", "각
 * 단계의 실제 대입값"). [2026-09-13 Optimizer 수정] 4~5단계가 "비례상수 × (A값 + B값근사)"
 * 처럼 변수 기호만 나열하던 것을 실제 숫자를 그대로 대입한 문자열로 교체했다
 * (average-cost-calculator의 `buildAverageCostBreakdown` 패턴 참고).
 */
export function buildCalculationSteps(
  input: NationalPensionBenefitFormInput,
  result: NationalPensionBenefitEligibleResult,
): BreakdownRow[] {
  const basicPensionMonthlyRaw = recomputeBasicPensionMonthlyRaw(result);

  const rows: BreakdownRow[] = [
    {
      label: "1. B값 근사 및 기준소득월액 상·하한 조정",
      legalBasis: "국민연금법 시행령 — 기준소득월액 상·하한",
      expression: result.bValueClamped
        ? `입력값 ${formatWon(input.averageMonthlyIncome)} → 상·하한 조정 후 ${formatWon(result.bValueApprox)}`
        : `입력하신 평균 월소득 ${formatWon(result.bValueApprox)}을 그대로 사용(상·하한 안쪽)`,
    },
    {
      label: "2. A값·비례상수 조회",
      legalBasis: "국민연금법 제51조제1항제1호(A값), 제51조제1항(비례상수, 2025-12-16 법률 제21203호 일부개정)",
      expression: `A값 ${formatWon(result.aValue)}, 비례상수 ${formatProportionalConstant(result.proportionalConstant)}(소득대체율 43%에 해당)`,
    },
    {
      label: "3. 가입기간 보정계수 산출",
      legalBasis: "국민연금법 제51조제1항(20년 기준 비례/가산)",
      expression: `총 가입기간 ${formatMonths(input.totalContributionMonths)} → 보정계수 ${formatContributionAdjustmentFactor(result.contributionAdjustmentFactor)}(20년 가입 기준 대비)`,
    },
    {
      label: "4. 기본연금액(법정 수급개시연령 기준) 산출",
      legalBasis: "국민연금법 제51조제1항",
      expression: `${formatProportionalConstant(result.proportionalConstant)} × (${formatWon(result.aValue)} + ${formatWon(result.bValueApprox)}) × ${formatContributionAdjustmentFactor(result.contributionAdjustmentFactor)} ÷ 12 = ${formatWon(basicPensionMonthlyRaw)}(절사 전) → ${formatWon(result.basicPensionMonthly)}`,
    },
  ];

  if (result.earlyOrDeferredMonths !== 0 && result.adjustedPensionMonthly !== undefined) {
    const isEarly = result.earlyOrDeferredMonths < 0;
    const adjustedPensionMonthlyRaw =
      basicPensionMonthlyRaw * (1 + (result.earlyOrDeferredAdjustmentRate ?? 0));
    rows.push({
      label: "5. 조기/연기연금 조정",
      legalBasis: isEarly
        ? "국민연금법 제61조제2항(요건), 제63조(감액 산정) — 1개월당 0.5% 감액"
        : "국민연금법 제62조, 부칙(법률 제11143호 제6조, 법률 제13100호 제4조) — 1개월당 0.6% 가산",
      expression: `기본연금액(절사 전 완전정밀도) ${formatWon(basicPensionMonthlyRaw)} × (1 ${formatSignedRate(result.earlyOrDeferredAdjustmentRate ?? 0)}) = ${formatWon(adjustedPensionMonthlyRaw)}(절사 전) → ${formatWon(result.adjustedPensionMonthly)}`,
    });
  }

  return rows;
}

/**
 * SPEC.md Must Have "clamp가 발생하면 결과 화면에 '입력하신 소득이 국민연금 기준소득월액
 * 상한/하한을 초과해 {상한/하한}원으로 조정되어 계산되었습니다'라고 고지한다"(FORMULA.md
 * "1-b")를 구현한다. 방향(상한 초과 vs 하한 미달)은 clamp 후 값(`bValueApprox`)이 원래
 * 입력값보다 작아졌는지/커졌는지로 판정한다.
 */
export function buildBValueClampNotice(
  averageMonthlyIncomeInput: number,
  result: { bValueApprox: number; bValueClamped: boolean },
): string | null {
  if (!result.bValueClamped) return null;
  const isAboveMax = result.bValueApprox < averageMonthlyIncomeInput;
  return isAboveMax
    ? `입력하신 소득이 국민연금 기준소득월액 상한을 초과해 ${formatWon(result.bValueApprox)}으로 조정되어 계산되었습니다.`
    : `입력하신 소득이 국민연금 기준소득월액 하한에 못 미쳐 ${formatWon(result.bValueApprox)}으로 조정되어 계산되었습니다.`;
}
