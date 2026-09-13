/**
 * 연봉 실수령액 계산기 — 표시용 포맷팅 + 계산 근거/경고 문구 조립.
 *
 * logic.ts는 숫자·boolean만 반환한다(housing-subscription-score와 동일 경계) — 사람이
 * 읽는 문장(계산 근거·경고)은 이 파일이 `(input, result) => string[] / BreakdownRow[]`
 * 형태로 조립한다.
 */

import type { AnnualSalaryTakeHomePayInput, AnnualSalaryTakeHomePayResult } from "./types";

const won = new Intl.NumberFormat("ko-KR");

export function formatWon(value: number): string {
  return `${won.format(value)}원`;
}

export function formatNumber(value: number): string {
  return won.format(value);
}

/** 계산 근거(계산 방법) 화면용 한 행. housing-subscription-score의 `BreakdownRow`와 같은 형태. */
export interface BreakdownRow {
  label: string;
  legalBasis: string;
  expression: string;
}

/**
 * FORMULA.md "계산 순서" 1~9단계를 실제 대입값과 함께 보여주는 계산 근거 행 목록을
 * 만든다(ARCHITECTURE.md "7. UI 구조" 결과 화면 4번).
 */
export function buildAnnualSalaryCalculationSteps(
  input: AnnualSalaryTakeHomePayInput,
  result: AnnualSalaryTakeHomePayResult,
): BreakdownRow[] {
  const rows: BreakdownRow[] = [
    {
      label: "1. 세전 월 급여 환산",
      legalBasis: "법으로 정해진 계산식이 아니라, 상여금 없이 연봉을 12개월로 똑같이 나눠 받는다고 가정한 방식입니다. 상여를 별도로 받는다면 실제 월급과 다를 수 있습니다.",
      expression: `${formatWon(input.annualSalary)} ÷ 12 = ${formatWon(result.monthlyGrossPay)}(원 미만 절사)`,
    },
    {
      label: "2. 산정 기준 보수 계산",
      legalBasis: "4대 보험·소득세 공통 기준 보수 = 월 급여 − 비과세",
      expression: `${formatWon(result.monthlyGrossPay)} − ${formatWon(input.monthlyNonTaxablePay)} = ${formatWon(result.taxableMonthlyPay)}`,
    },
    {
      label: "3. 국민연금",
      legalBasis: "국민연금법 — 기준소득월액 × 4.75%(천 원 미만 절사, 상·하한 적용)",
      expression: `기준소득월액 ${formatWon(result.pensionStandardMonthlyIncome)} × 4.75% = ${formatWon(result.employeePension)}`,
    },
    {
      label: "4. 건강보험·장기요양보험",
      legalBasis: "국민건강보험법 — 보수월액 × 7.19% ÷ 2, 장기요양보험 = 건강보험료 × 13.14%",
      expression: `건강보험 ${formatWon(result.employeeHealth)} + 장기요양보험 ${formatWon(result.employeeLongTermCare)}`,
    },
    {
      label: "5. 고용보험",
      legalBasis: "고용보험법 — 보수월액 × 0.9%(실업급여, 근로자 부담)",
      expression: `${formatWon(result.taxableMonthlyPay)} × 0.9% = ${formatWon(result.employeeEmployment)}`,
    },
    {
      label: "6. 근로소득세(간이세액표)",
      legalBasis:
        result.bracketMode === "formula"
          ? "소득세법 시행령 [별표 2] 제1호 표 하단 — 세액표 상한 초과 구간 산식"
          : result.bracketMode === "ceilingFixed"
            ? "소득세법 시행령 [별표 2] 제1호 표 하단 — 세액표 상한 금액(1,000만원)과 정확히 일치(상한을 넘어선 것은 아님), 고정 세액을 추가 계산 없이 그대로 적용"
            : "소득세법 시행령 [별표 2] — 근로소득 간이세액표(월급여액 × 공제대상가족의 수)",
      expression:
        result.familyCountSource === "over11Formula"
          ? `부양가족 수(본인 포함) ${input.dependentFamilyCount}명(11명 초과 산식 적용) → ${formatWon(result.incomeTaxBeforeChildCredit)}`
          : `부양가족 수(본인 포함) ${input.dependentFamilyCount}명 조회값 = ${formatWon(result.incomeTaxBeforeChildCredit)}`,
    },
    {
      label: "7. 자녀세액공제",
      legalBasis: "소득세법 시행령 [별표 2] 제3호 — 8세 이상 20세 이하 자녀 세액공제",
      expression:
        input.childrenAge8to20Count > 0
          ? `${formatWon(result.incomeTaxBeforeChildCredit)} − ${formatWon(result.childTaxCreditAmount)} = ${formatWon(result.incomeTax)}${
              result.childTaxCreditFloorApplied ? "(0원 미만이라 0원으로 조정)" : ""
            }`
          : `자녀 0명 → 공제 없음, 근로소득세 ${formatWon(result.incomeTax)}`,
    },
    {
      label: "8. 지방소득세",
      legalBasis: "지방세법 제103조의13 — 원천징수 소득세의 10%",
      expression: `${formatWon(result.incomeTax)} × 10% = ${formatWon(result.localIncomeTax)}`,
    },
    {
      label: "9. 세후 월 실수령액",
      legalBasis: "세전 월 급여 − (4대 보험 + 근로소득세 + 지방소득세)",
      expression: `${formatWon(result.monthlyGrossPay)} − ${formatWon(result.totalDeductions)} = ${formatWon(result.netMonthlyPay)}`,
    },
  ];
  return rows;
}

/**
 * 결과에 영향을 준 정책 규칙 경고 문구(FORMULA.md "예외" 절). ARCHITECTURE.md "7. UI 구조"
 * 결과 화면 3번 — 해당 항목 근처에 개별적으로 표시하기 위해 항목별로 분리한 함수를 둔다.
 */
export function buildPensionLimitWarning(result: AnnualSalaryTakeHomePayResult): string | null {
  if (result.pensionMinimumApplied) {
    return "국민연금 기준소득월액이 하한(410,000원)보다 낮아 하한 금액을 기준으로 계산했습니다.";
  }
  if (result.pensionMaximumApplied) {
    return "국민연금 기준소득월액이 상한(6,590,000원)보다 높아 상한 금액을 기준으로 계산했습니다.";
  }
  return null;
}

export function buildHealthLimitWarning(result: AnnualSalaryTakeHomePayResult): string | null {
  if (result.healthMinimumApplied) {
    return "건강보험 총보험료가 하한(20,160원)보다 낮아 하한 금액을 기준으로 계산했습니다.";
  }
  if (result.healthMaximumApplied) {
    return "건강보험 총보험료가 상한(9,183,480원)보다 높아 상한 금액을 기준으로 계산했습니다.";
  }
  return null;
}

export function buildBelowTaxableThresholdWarning(
  result: AnnualSalaryTakeHomePayResult,
): string | null {
  return result.isBelowTaxableThreshold
    ? "산정 기준 보수가 간이세액표 최저구간 이하라 근로소득세가 0원입니다."
    : null;
}

/**
 * `incomeTaxSource === "highIncomeFormula"`에는 두 가지 서로 다른 경우가 섞여 있다
 * (`bracketMode` "ceilingFixed"/"formula" 참고) — 정확히 세액표 상한(1,000만원)과
 * 일치해 고정 세액을 초과분 계산 없이 그대로 쓴 경우와, 실제로 상한을 초과해 3-4 산식을
 * 적용한 경우다. UX/UI Critic이 지적한 대로 두 경우를 하나의 "초과/별도 계산식" 문구로
 * 뭉뚱그리면 정확히 경계값 케이스(실제로는 "초과"도 "산식 적용"도 아님)에 대해 실제
 * 계산 방식과 반대로 설명하게 된다 — `bracketMode`로 구분해 각각 정확한 문구를 반환한다.
 */
export function buildHighIncomeFormulaWarning(
  result: AnnualSalaryTakeHomePayResult,
): string | null {
  if (result.bracketMode === "ceilingFixed") {
    return "산정 기준 보수가 간이세액표 조회 구간의 상한 금액(1,000만원)과 정확히 일치합니다(상한을 넘어선 것이 아닙니다). 이 지점에 대해 별도로 정해진 고정 세액을 추가 계산 없이 그대로 적용했습니다.";
  }
  if (result.bracketMode === "formula") {
    return "산정 기준 보수가 간이세액표 조회 구간 상한을 초과해 별도 계산식으로 근로소득세를 계산했습니다. 이 구간은 국세청 홈택스 결과와 마지막 원 단위 처리에서 차이가 있을 수 있습니다.";
  }
  return null;
}

export function buildOverElevenFamilyWarning(
  result: AnnualSalaryTakeHomePayResult,
): string | null {
  return result.familyCountSource === "over11Formula"
    ? "부양가족 수(본인 포함)가 11명을 초과해 별도 계산식(11명 세액 기준 보정)으로 근로소득세를 계산했습니다."
    : null;
}

export function buildChildTaxCreditFloorWarning(
  result: AnnualSalaryTakeHomePayResult,
): string | null {
  return result.childTaxCreditFloorApplied
    ? "자녀세액공제를 차감한 금액이 0원보다 작아 근로소득세를 0원으로 조정했습니다."
    : null;
}

/**
 * QA 신규 발견(Medium): 비현실적으로 낮은 연봉(검증은 통과하지만 실질 급여로는 있을 수
 * 없는 값)에서 4대 보험 하한이 실제 급여와 무관하게 적용돼 `netMonthlyPay`가 음수가 될 수
 * 있다. 계산 공식 자체(4대 보험 하한 규정)는 FORMULA.md를 정확히 따른 것이라 바꾸지
 * 않는다 — 이 경고는 표시/설명만 추가해 사용자가 결과를 오인하지 않도록 한다.
 */
export function buildNegativeNetPayWarning(
  result: AnnualSalaryTakeHomePayResult,
): string | null {
  return result.netMonthlyPay < 0
    ? "입력한 급여 수준에서는 4대 보험 최저 보험료가 실제 급여보다 커서 세후 실수령액이 0원 미만으로 계산됩니다. 실제로는 이런 급여 수준에 4대 보험이 그대로 적용되지 않을 가능성이 높으므로, 이 결과는 참고용으로만 확인해 주세요."
    : null;
}

/** 위 경고를 모두 모은 배열(빈 문자열 없이 실제 발생한 것만). 카드 개수 계산 등에 사용. */
export function buildAllPolicyWarnings(result: AnnualSalaryTakeHomePayResult): string[] {
  return [
    buildPensionLimitWarning(result),
    buildHealthLimitWarning(result),
    buildBelowTaxableThresholdWarning(result),
    buildHighIncomeFormulaWarning(result),
    buildOverElevenFamilyWarning(result),
    buildChildTaxCreditFloorWarning(result),
    buildNegativeNetPayWarning(result),
  ].filter((warning): warning is string => warning !== null);
}
