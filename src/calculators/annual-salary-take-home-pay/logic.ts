/**
 * 연봉 실수령액 계산기 — 순수 계산 로직.
 *
 * tasks/annual-salary-take-home-pay/FORMULA.md "계산 순서" 1~9단계를 그대로 구현한다.
 * 4대 보험은 `src/lib/social-insurance.ts`, 세액 조회는 `withholding-table.ts`, 계수는
 * `policy.ts`만 참조하고 매직 넘버를 쓰지 않는다(ARCHITECTURE.md "9. Builder 인수인계 요약").
 *
 * policy.ts의 `highIncomeFormula.brackets` minWon/maxWon 값은 ARCHITECTURE.md 초안의
 * 단위 변환 오류(× 10,000)를 FORMULA.md 원문 기준(× 1,000)으로 정정한 값이다 — 자세한
 * 근거는 policy.ts 주석 참고.
 */

import { calculateEmployeeSocialInsuranceContributions } from "@/src/lib/social-insurance";
import { EARNED_INCOME_WITHHOLDING_POLICY as POLICY } from "./policy";
import type {
  AnnualSalaryTakeHomePayInput,
  AnnualSalaryTakeHomePayResult,
  FamilyCountSource,
  IncomeTaxBracketMode,
  IncomeTaxSource,
} from "./types";
import { lookupWithholdingTaxRow, WITHHOLDING_TABLE_RANGE } from "./withholding-table";

type HighIncomeBracket = (typeof POLICY.highIncomeFormula.brackets)[number];

/**
 * FORMULA.md "계산 순서" 5단계 · "3-4" 절이 명시하는 세 가지 경우(2026-09-06 Formula
 * Analyst 보강판). `resolveBracketMode`가 이 세 경우를 명시적으로 구분한다.
 *
 * - `"table"`: `taxableMonthlyPay < 10,000,000원` → 3-1 표(간이세액표 본문)에서 조회한다.
 * - `"ceilingFixed"`: `taxableMonthlyPay === 10,000,000원`(정확히 일치) → 3-4가 명시한
 *   가족 수별 고정값(`baseAmountAtTableCeilingByFamilyCount`)을 **초과분 계산 없이 그대로**
 *   사용한다. 3-4 산식(고정값 + 초과금액 × 계수 + 가산액)은 적용하지 않는다.
 * - `"formula"`: `taxableMonthlyPay > 10,000,000원` → 3-4 산식을 적용한다.
 *
 * Calculation Auditor 이슈 A(`tasks/annual-salary-take-home-pay/EVALUATION.md`
 * "Calculation Auditor" 참고): 이전 구현은 `taxableMonthlyPay >=
 * WITHHOLDING_TABLE_RANGE.maxWon`이라는 단일 `>=` 조건으로 "정확히 일치"와 "초과"를
 * 뭉뚱그려 `highIncomeFormulaTax`에 넘겼다. 그 결과 정확히 10,000,000원일 때 초과금액이
 * 0원인데도 구간 가산액(예: 25,000원)이 그대로 더해져 세액이 25,000원 과다 계산됐다
 * (FORMULA.md 검증 예제 13 참고). 이 타입/함수는 그 세 경우를 명시적으로 분리해 재발을
 * 막는다.
 *
 * `types.ts`의 `IncomeTaxBracketMode`와 동일한 값 집합이다(Optimizer 라운드 2에서
 * `AnnualSalaryTakeHomePayResult.bracketMode`로 결과에도 노출해, formatting.ts가
 * "정확히 경계값"과 "실제 초과" 문구를 구분할 수 있게 했다 — 계산 로직 자체는 이전
 * 라운드에서 이미 확정됐고 이번엔 값을 그대로 반환값에 포함시켰을 뿐이다).
 */
type BracketMode = IncomeTaxBracketMode;

function resolveBracketMode(taxableMonthlyPay: number): BracketMode {
  if (taxableMonthlyPay > WITHHOLDING_TABLE_RANGE.maxWon) return "formula";
  if (taxableMonthlyPay === WITHHOLDING_TABLE_RANGE.maxWon) return "ceilingFixed";
  return "table";
}

/**
 * FORMULA.md "3-4" 산식으로 특정 가족 수(키 "1"~"11") 열의 세액을 계산한다(10,000천원
 * = 1,000만원 초과 구간). **반드시 `taxableMonthlyPay > WITHHOLDING_TABLE_RANGE.maxWon`인
 * 경우에만 호출해야 한다** — 정확히 경계값(`=== maxWon`)인 경우는 `resolveBracketMode`가
 * `"ceilingFixed"`로 분류해 이 함수를 호출하지 않고 `baseAmountAtTableCeilingByFamilyCount`를
 * 초과분 계산 없이 그대로 반환한다(Calculation Auditor 이슈 A). 이 함수의 브래킷 탐색
 * 로직 자체(`b.minWon`/`b.maxWon` 비교)는 변경하지 않았다 — 호출 시점에 이미
 * `taxableMonthlyPay > maxWon`이 보장되므로 브래킷 탐색의 `>=` 비교가 여전히 유효하다.
 */
function highIncomeFormulaTax(taxableMonthlyPay: number, familyCountKey: string): number {
  const brackets = POLICY.highIncomeFormula.brackets;
  const bracket: HighIncomeBracket =
    brackets.find(
      (b) => taxableMonthlyPay >= b.minWon && (b.maxWon === null || taxableMonthlyPay < b.maxWon),
    ) ?? brackets[brackets.length - 1];

  const base = POLICY.highIncomeFormula.baseAmountAtTableCeilingByFamilyCount[familyCountKey] ?? 0;
  const excessWon = taxableMonthlyPay - bracket.minWon;
  const extra = (excessWon * bracket.extraRate.numerator) / bracket.extraRate.denominator;

  // FORMULA.md "정밀도/반올림 정책": 1,000만원 초과 산식은 "최종 합산 후 1원 미만만 절사"를
  // 잠정안으로 삼는다(확인 필요, Golden Test 12 참고) — 중간에 미리 반올림하지 않는다.
  return Math.floor(base + extra + bracket.addWon);
}

/**
 * 특정 가족 수 키(1~11)의 근로소득세(자녀세액공제 반영 전)를 조회한다. `bracketMode`에 따라
 * 표 조회(`"table"`), 정확히 경계값 고정값(`"ceilingFixed"`), 1,000만원 초과 산식
 * (`"formula"`) 세 가지 중 하나를 적용한다(FORMULA.md "계산 순서" 5단계, 3-4 참고).
 * (세액표 하한 미만은 `lookupWithholdingTaxRow`가 `null`을 반환해 자연스럽게 0원으로
 * 처리되므로 별도 분기 없이도 안전하다.)
 */
function baseIncomeTaxForFamilyKey(
  taxableMonthlyPay: number,
  familyCountKey: string,
  bracketMode: BracketMode,
): number {
  if (bracketMode === "formula") return highIncomeFormulaTax(taxableMonthlyPay, familyCountKey);
  if (bracketMode === "ceilingFixed") {
    // FORMULA.md 3-4 "정확히 10,000,000원": 가족 수별 고정값을 초과분 계산 없이 그대로
    // 사용한다 — highIncomeFormulaTax를 호출하지 않는다(가산액이 잘못 더해지는 것을 방지).
    return POLICY.highIncomeFormula.baseAmountAtTableCeilingByFamilyCount[familyCountKey] ?? 0;
  }
  const row = lookupWithholdingTaxRow(taxableMonthlyPay);
  return row ? (row.taxByFamilyCount[familyCountKey] ?? 0) : 0;
}

/** FORMULA.md "3-2" 자녀세액공제 차감액. */
function calculateChildTaxCreditAmount(childrenAge8to20Count: number): number {
  if (childrenAge8to20Count <= 0) return 0;
  if (childrenAge8to20Count === 1) return POLICY.childTaxCredit.oneChild;
  if (childrenAge8to20Count === 2) return POLICY.childTaxCredit.twoChildren;
  return (
    POLICY.childTaxCredit.twoChildren +
    POLICY.childTaxCredit.perAdditionalChildOverTwo * (childrenAge8to20Count - 2)
  );
}

export function calculateAnnualSalaryTakeHomePay(
  input: AnnualSalaryTakeHomePayInput,
): AnnualSalaryTakeHomePayResult {
  // 1. 월 환산 (방식 A) -------------------------------------------------------------
  const monthlyGrossPay = Math.floor(input.annualSalary / 12);
  const taxableMonthlyPay = monthlyGrossPay - input.monthlyNonTaxablePay;

  // 2. 4대 보험 근로자 부담분 (src/lib/social-insurance.ts 그대로 재사용) -------------
  const core = calculateEmployeeSocialInsuranceContributions({
    monthlyGrossPay,
    monthlyNonTaxablePay: input.monthlyNonTaxablePay,
  });

  // 3. 근로소득세 — 세액표 조회 / 정확히 경계값 고정값 / 1,000만원 초과 산식 ------------
  // FORMULA.md "계산 순서" 5단계 · "3-4"가 명시한 세 가지 경우를 명시적으로 구분한다
  // (Calculation Auditor 이슈 A 재발 방지 — 상세 근거는 위 BracketMode/resolveBracketMode
  // 주석 참고).
  const bracketMode = resolveBracketMode(taxableMonthlyPay);
  // incomeTaxSource(UI 표시용 분류, IncomeTaxSource 타입은 "table"/"highIncomeFormula" 둘뿐):
  // 정확히 경계값(`ceilingFixed`)은 3-1 표 조회(`lookupWithholdingTaxRow`)로 얻은 값이
  // 아니라 3-4 절의 `baseAmountAtTableCeilingByFamilyCount` 고정값을 그대로 쓴 것이므로
  // "table"이 아니라 "highIncomeFormula"로 분류한다 — 실제로 `taxableMonthlyPay ===
  // maxWon`일 때 `lookupWithholdingTaxRow`는 범위 밖(`< maxWon`이 아님)이라 `null`을
  // 반환한다(isWithinWithholdingTableRange 참고). 근거와 대안 검토는
  // tasks/annual-salary-take-home-pay/EVALUATION.md "Optimizer 수정 (라운드 1)" 참고.
  const incomeTaxSource: IncomeTaxSource = bracketMode === "table" ? "table" : "highIncomeFormula";

  const familyCountSource: FamilyCountSource =
    input.dependentFamilyCount <= 11 ? "table" : "over11Formula";

  let incomeTaxBeforeChildCredit: number;
  // FORMULA.md "예외": "taxableMonthlyPay가 간이세액표 최저 구간(1,060천원, 가족 1명 기준)
  // 미만 → 근로소득세 0원"이며, 이 임계값은 가족 수마다 다르다(공제대상가족의 수 열마다
  // 0원 구간의 상한이 다름, FORMULA.md 3-1). 즉 이 플래그는 "taxableMonthlyPay가
  // 770,000원 미만"이라는 표 전체의 절대 하한이 아니라, "선택한 가족 수 열에서 실제로 0원
  // 구간에 속하는지"를 뜻한다 — 11명 초과 산식(별도 고지)에는 적용하지 않는다.
  let isBelowTaxableThreshold = false;
  if (input.dependentFamilyCount <= 11) {
    incomeTaxBeforeChildCredit = baseIncomeTaxForFamilyKey(
      taxableMonthlyPay,
      String(input.dependentFamilyCount),
      bracketMode,
    );
    isBelowTaxableThreshold = bracketMode === "table" && incomeTaxBeforeChildCredit === 0;
  } else {
    // FORMULA.md "3-3": tax(n>11) = tax(11) - (tax(10) - tax(11)) * (n - 11)
    const tax11 = baseIncomeTaxForFamilyKey(taxableMonthlyPay, "11", bracketMode);
    const tax10 = baseIncomeTaxForFamilyKey(taxableMonthlyPay, "10", bracketMode);
    const overCount = input.dependentFamilyCount - 11;
    const rawOverElevenTax = tax11 - (tax10 - tax11) * overCount;
    // FORMULA.md "3-3": 원문에 음수 처리 명문 근거가 없다 — v1은 "세액은 음수가 될 수 없다"는
    // 일반 원칙에 따라 0원으로 floor한다(확인 필요, policy.ts familyCountOverEleven 참고).
    incomeTaxBeforeChildCredit = Math.max(rawOverElevenTax, 0);
  }

  // 4. 자녀세액공제 반영 ------------------------------------------------------------
  const childTaxCreditAmount = calculateChildTaxCreditAmount(input.childrenAge8to20Count);
  const incomeTaxRaw = incomeTaxBeforeChildCredit - childTaxCreditAmount;
  const childTaxCreditFloorApplied = incomeTaxRaw < 0;
  const incomeTax = Math.max(incomeTaxRaw, 0);

  // 5. 지방소득세 -------------------------------------------------------------------
  const localIncomeTax = Math.floor(
    (incomeTax * POLICY.localIncomeTaxRate.numerator) / POLICY.localIncomeTaxRate.denominator,
  );

  // 6. 합계와 최종 실수령액 ---------------------------------------------------------
  const totalDeductions = core.employeeInsuranceTotal + incomeTax + localIncomeTax;
  const netMonthlyPay = monthlyGrossPay - totalDeductions;

  return {
    monthlyGrossPay,
    taxableMonthlyPay,

    pensionStandardMonthlyIncome: core.pensionStandardMonthlyIncome,
    employeePension: core.employeePension,
    employeeHealth: core.employeeHealth,
    employeeLongTermCare: core.employeeLongTermCare,
    employeeEmployment: core.employeeEmployment,
    employeeInsuranceTotal: core.employeeInsuranceTotal,

    incomeTaxBeforeChildCredit,
    childTaxCreditAmount,
    incomeTax,
    localIncomeTax,

    totalDeductions,
    netMonthlyPay,

    pensionMinimumApplied: core.pensionMinimumApplied,
    pensionMaximumApplied: core.pensionMaximumApplied,
    healthMinimumApplied: core.healthMinimumApplied,
    healthMaximumApplied: core.healthMaximumApplied,

    incomeTaxSource,
    bracketMode,
    familyCountSource,
    childTaxCreditFloorApplied,
    isBelowTaxableThreshold,

    appliedRateYear: 2026,
    appliedSocialInsurancePeriod: "2026-07-01/2027-06-30",
    appliedWithholdingTableEffectiveFrom: "2026-03-01",
  };
}
