/**
 * 연봉 실수령액 계산기 타입 — tasks/annual-salary-take-home-pay/FORMULA.md,
 * tasks/annual-salary-take-home-pay/ARCHITECTURE.md 기준.
 *
 * `Won`은 이 계산기 전용으로 다시 정의한다(four-major-insurance/types.ts에서 import하지
 * 않음) — 계산기 폴더 간 타입 결합을 만들지 않기 위함이다(ARCHITECTURE.md "6. 타입 결정"
 * 참고). 진짜 공유가 필요한 4대 보험 계산은 src/lib/social-insurance.ts(Builder 작성 예정)
 * 를 통해서만 이뤄진다.
 */

export type Won = number;

/** 사용자가 실제로 입력하는 원시 값. validation.ts가 이 타입으로 정규화한다. */
export interface AnnualSalaryTakeHomePayInput {
  /** 세전 연봉(원). 필수, 정수, 0보다 크고 100억 원 이하. */
  annualSalary: Won;
  /**
   * 월 비과세 금액(원, 식대 등). 선택, 기본 0. 4대 보험·소득세 산정 기준 보수에서
   * 제외한다. `monthlyGrossPay(= floor(annualSalary / 12))`보다 클 수 없다.
   */
  monthlyNonTaxablePay: Won;
  /**
   * 공제대상가족의 수(본인 포함, 배우자도 1명). 필수, 정수, 1 이상 30 이하, 기본 1.
   */
  dependentFamilyCount: number;
  /**
   * 공제대상가족 중 8세 이상 20세 이하 자녀 수. 선택, 정수, 0 이상,
   * `dependentFamilyCount - 1` 이하, 기본 0.
   */
  childrenAge8to20Count: number;
}

/** 근로소득세가 표 조회로 산출됐는지 1천만원 초과 산식으로 산출됐는지. */
export type IncomeTaxSource = "table" | "highIncomeFormula";

/**
 * 근로소득세 산정이 세 갈래(FORMULA.md "계산 순서" 5단계·"3-4") 중 무엇으로 이뤄졌는지를
 * `incomeTaxSource`(2값 유니온)보다 세밀하게 구분한다.
 *
 * - `"table"`: `taxableMonthlyPay < 10,000,000원` → 3-1 표(간이세액표 본문)에서 조회.
 * - `"ceilingFixed"`: `taxableMonthlyPay === 10,000,000원`(정확히 일치) → 3-4가 명시한
 *   가족 수별 고정값을 초과분 계산 없이 그대로 사용(3-4 산식 미적용).
 * - `"formula"`: `taxableMonthlyPay > 10,000,000원` → 3-4 산식(고정값 + 초과금액 × 계수 +
 *   가산액)을 적용.
 *
 * `logic.ts`가 분기 판단에 이미 쓰던 내부 값을 그대로 노출한 것이며, 계산 자체는 바뀌지
 * 않았다. UX/UI Critic이 지적한 `buildHighIncomeFormulaWarning`(formatting.ts) 문구
 * 부정확성(정확히 경계값에도 "초과"/"별도 계산식" 표현을 쓰는 문제)을 이 필드로 구분해
 * 해결한다 — tasks/annual-salary-take-home-pay/EVALUATION.md "Optimizer 수정 (라운드 2)"
 * 참고.
 */
export type IncomeTaxBracketMode = "table" | "ceilingFixed" | "formula";

/** 세액표 조회 시 공제대상가족의 수를 그대로 쓴 열인지 11명 초과 산식을 적용했는지. */
export type FamilyCountSource = "table" | "over11Formula";

/**
 * 계산 결과. FORMULA.md "출력값" 표의 필드에 더해, UI가 재판정 없이 정책 규칙 적용
 * 여부를 표시할 수 있도록 파생 플래그를 포함한다(four-major-insurance의
 * `pensionMinimumApplied` 등과 동일한 패턴, ARCHITECTURE.md "6." 참고).
 */
export interface AnnualSalaryTakeHomePayResult {
  /** 세전 월 급여 = floor(annualSalary / 12) */
  monthlyGrossPay: Won;
  /** 산정 기준 보수 = monthlyGrossPay - monthlyNonTaxablePay */
  taxableMonthlyPay: Won;

  /** 국민연금 기준소득월액(천 원 절사 후 상·하한 적용) */
  pensionStandardMonthlyIncome: Won;
  employeePension: Won;
  employeeHealth: Won;
  employeeLongTermCare: Won;
  employeeEmployment: Won;
  /** 4대 보험 근로자 부담 합계 */
  employeeInsuranceTotal: Won;

  /** 간이세액표(또는 1천만원 초과 산식) 조회값 — 자녀세액공제 반영 전 */
  incomeTaxBeforeChildCredit: Won;
  /** 8~20세 자녀 수에 따른 차감액 */
  childTaxCreditAmount: Won;
  /** 근로소득세(원천징수 예상액, 자녀세액공제 반영 후, 0원 미만 방지) */
  incomeTax: Won;
  /** 지방소득세 = incomeTax의 10% */
  localIncomeTax: Won;

  /** employeeInsuranceTotal + incomeTax + localIncomeTax */
  totalDeductions: Won;
  /** 세후 월 실수령액 = monthlyGrossPay - totalDeductions */
  netMonthlyPay: Won;

  // --- 정책 규칙 적용 여부 플래그 (UI가 문자열/숫자 비교 없이 바로 사용) ---

  /** 국민연금 기준소득월액이 하한(410,000원)에 걸렸는지 */
  pensionMinimumApplied: boolean;
  /** 국민연금 기준소득월액이 상한(6,590,000원)에 걸렸는지 */
  pensionMaximumApplied: boolean;
  /** 건강보험 총보험료가 하한(20,160원)에 걸렸는지 */
  healthMinimumApplied: boolean;
  /** 건강보험 총보험료가 상한(9,183,480원)에 걸렸는지 */
  healthMaximumApplied: boolean;

  /** 근로소득세가 세액표 조회인지 1천만원 초과 산식인지 */
  incomeTaxSource: IncomeTaxSource;
  /** incomeTaxSource보다 세밀한 3갈래 구분(표 조회 / 정확히 상한 고정값 / 상한 초과 산식) */
  bracketMode: IncomeTaxBracketMode;
  /** 세액표 열 선택이 가족 수 그대로인지 11명 초과 산식인지 */
  familyCountSource: FamilyCountSource;
  /** 자녀세액공제 차감 결과가 음수라 0원으로 조정됐는지 */
  childTaxCreditFloorApplied: boolean;
  /** taxableMonthlyPay가 간이세액표 최저구간 미만이라 근로소득세가 0원인지 */
  isBelowTaxableThreshold: boolean;

  /** 적용한 4대 보험 요율·상하한의 기준 연도 */
  appliedRateYear: 2026;
  /** 적용한 4대 보험 요율·상하한의 시행 기간(국민연금 기준소득월액 7월 변경 반영) */
  appliedSocialInsurancePeriod: "2026-07-01/2027-06-30";
  /** 적용한 근로소득 간이세액표(소득세법 시행령 [별표 2])의 시행일 */
  appliedWithholdingTableEffectiveFrom: "2026-03-01";
}
