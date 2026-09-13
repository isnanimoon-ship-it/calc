/**
 * 대출 이자 계산기 타입 — tasks/loan-interest-calculator/FORMULA.md 기준.
 *
 * Architect 스캐폴딩이다 — 공식 자체는 정의하지 않는다(Formula Analyst 영역). 여기서는
 * 입력/출력 "계약"(모양)만 고정한다. 상세 근거는 tasks/loan-interest-calculator/ARCHITECTURE.md
 * "3. 결과 타입 설계"를 참고한다.
 *
 * 설계 근거 요약:
 * - `business-days`의 `mode` 판별 유니온(`RangeInput`/`OffsetInput`, `RangeResult`/
 *   `OffsetResult`) 선례를 그대로 따라 `repaymentMethod`를 판별 태그로 쓰는 discriminated
 *   union으로 결과 타입을 설계했다 — 세 상환방식의 핵심 결과 필드가 서로 다르므로(SPEC.md
 *   "계산 결과 — 상환방식별로 다른 템플릿"), 하나의 인터페이스에 옵션 필드로 욱여넣지 않는다.
 * - 다만 이 계산기는 공통 필드가 business-days보다 훨씬 많다(원금·연이율·기간·월이율·
 *   회차별 스케줄·연도별 요약·총이자·총상환액 7개) — business-days처럼 매 분기에 필드를
 *   반복 나열하지 않고 `LoanCalculationBase`를 교차 타입(&)으로 합성해 반복을 줄였다.
 */

export type Won = number;

export type RepaymentMethod = "equalInstallment" | "equalPrincipal" | "bullet";

export interface LoanInterestCalculatorInput {
  /** 대출 원금(원). FORMULA.md 허용 범위: 10,000 이상 10,000,000,000(100억원) 이하 정수. */
  principal: Won;
  /**
   * 연이율(%, 사용자가 `5`처럼 입력 — 내부 계산에서만 `/100/12`로 변환한다).
   * 0 이상 100 이하, 소수 둘째 자리까지 허용(예: 4.25).
   */
  annualRatePercent: number;
  /**
   * 총 상환 회차 수(개월). 내부 계산은 항상 이 값(정수 개월)으로 통일한다.
   * UI가 "년 + 개월" 조합 입력을 받더라도 폼 레벨에서 이 필드로 환산해 전달한다 — 이 타입
   * 자체는 UI 입력 방식(개월 단독 vs 년+개월)과 무관하다(ARCHITECTURE.md "5. 대출 기간
   * 입력 UX" 참고).
   * FORMULA.md 허용 범위: 1 이상 480(40년) 이하 정수.
   */
  termMonths: number;
  repaymentMethod: RepaymentMethod;
}

/** 회차별 상환 스케줄 한 행. `schedule[]` 길이 = `termMonths`(최대 480). */
export interface LoanScheduleRow {
  /** 회차(1부터 `termMonths`까지). */
  installment: number;
  principalPayment: Won;
  interest: Won;
  /** = `principalPayment + interest`. */
  payment: Won;
  /** 이 회차 상환 후 잔액. 마지막 회차(`installment === termMonths`) 이후 잔액은 항상 0. */
  balance: Won;
}

/**
 * 연도별(12회차 단위, 마지막 해만 나머지 개월) 집계 한 행.
 * SPEC.md Must Have "연도별 상환 스케줄 요약표"용. `year`는 캘린더 연도가 아니라 대출 시작
 * 시점 기준 경과 해차(1부터) — 이 계산기는 대출 시작월을 입력받지 않는다(Should Have로 이관).
 */
export interface LoanYearlySummaryRow {
  /** 대출 시작 후 몇 번째 해인지(1부터). */
  year: number;
  /** 이 해에 포함된 회차 수(마지막 해만 12 미만일 수 있음). */
  monthsInYear: number;
  principalPaymentTotal: Won;
  interestTotal: Won;
  /** 이 해 마지막 회차 상환 후 잔액. */
  endOfYearBalance: Won;
}

/**
 * 세 상환방식이 공통으로 갖는 필드. 이 인터페이스를 그대로 export/사용하지 않고 아래
 * 판별 유니온의 구성 요소로만 쓴다 — 호출부(ui.tsx 등)가 `repaymentMethod`로 분기하지
 * 않고는 방식별 핵심 결과 필드(`fixedMonthlyPayment` 등)에 접근할 수 없도록 강제해
 * docs/CALCULATOR_RULES.md "서로 다른 계산 방식을 같은 공식으로 처리하지 않는다"를 타입
 * 레벨에서도 지킨다.
 */
interface LoanCalculationBase {
  principal: Won;
  annualRatePercent: number;
  termMonths: number;
  /** `annualRatePercent / 100 / 12`. 반올림하지 않은 원시 소수값(무차원). */
  monthlyRate: number;
  /** 길이 = `termMonths`(최대 480) — ARCHITECTURE.md "4. 스케줄 데이터 구조" 참고. */
  schedule: LoanScheduleRow[];
  /** 길이 = `Math.ceil(termMonths / 12)`. */
  yearlySummary: LoanYearlySummaryRow[];
  /** `Σ schedule[i].interest`. */
  totalInterest: Won;
  /** `principal + totalInterest`. */
  totalPayment: Won;
}

export type LoanInterestCalculatorResult =
  | (LoanCalculationBase & {
      repaymentMethod: "equalInstallment";
      /**
       * 매 회차 고정 상환액(연금 산식으로 1회 계산 후 원 단위로 반올림해 고정한 값).
       * 마지막 회차 실제 상환액(`schedule[termMonths - 1].payment`)은 반올림 잔여 처리로
       * 이 값과 근소하게(보통 몇 원 이내) 다를 수 있다 — FORMULA.md "마지막 회차 단수 처리".
       */
      fixedMonthlyPayment: Won;
    })
  | (LoanCalculationBase & {
      repaymentMethod: "equalPrincipal";
      /** 1회차 상환액(`schedule[0].payment`와 동일 — 이자가 가장 커 상환액도 최대인 시점). */
      firstPayment: Won;
      /** 마지막 회차 상환액(`schedule[termMonths - 1].payment`와 동일). */
      lastPayment: Won;
    })
  | (LoanCalculationBase & {
      repaymentMethod: "bullet";
      /** 만기 전(1 ~ termMonths-1 회차) 고정 이자 상환액. */
      monthlyInterestBeforeMaturity: Won;
      /** 마지막 회차 상환액 = 원금 전액 + 마지막 달 이자. */
      maturityPayment: Won;
    });
