/**
 * 대출 이자 계산기 — 표시용 포맷팅 + 계산 근거(breakdown) 조립.
 *
 * ARCHITECTURE.md "9. Builder 인수인계 요약" 7번: `logic`이 이미 회차마다 원 단위로 반올림해
 * 반환하므로(FORMULA.md "계산 순서" 4~6단계) 이 파일은 `weekly-holiday-allowance`처럼 "표시
 * 직전 재반올림"이 필요 없다 — `formatWon`은 `Intl.NumberFormat`만 적용한다.
 */

import type {
  LoanInterestCalculatorInput,
  LoanInterestCalculatorResult,
  LoanYearlySummaryRow,
  RepaymentMethod,
} from "./types";

const wonFormatter = new Intl.NumberFormat("ko-KR");

/** 금액(원)을 "1,234,567원"으로 표시한다. logic이 이미 정수로 반올림해 반환하므로 재반올림하지 않는다. */
export function formatWon(amountWon: number): string {
  return `${wonFormatter.format(amountWon)}원`;
}

/** 연이율(%) 표시 — 입력 그대로("연 5%", "연 4.25%")를 보여준다(내부 계산 표현 0.05와 분리). */
export function formatAnnualRatePercent(annualRatePercent: number): string {
  return `연 ${annualRatePercent}%`;
}

/**
 * 월이율을 %로 환산해 표시(계산에는 원시 소수값을 그대로 쓰고, 표시에만 반올림).
 * 소수 넷째 자리까지 보여주되 꼬리의 불필요한 0은 잘라낸다(예: 0.0041666...→"0.4167%",
 * 0.005→"0.5%").
 */
export function formatMonthlyRatePercent(monthlyRate: number): string {
  const percent = (monthlyRate * 100).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return `${percent === "" ? "0" : percent}%`;
}

/**
 * 월이율을 소수(무차원) 형태로 표시한다(예: 0.0041666...→"0.004167"). 원리금균등상환 앵커값
 * 수식 `(1+r)^n`의 `r`을 실제 값으로 치환할 때 쓴다(UX/UI Critic Medium #11 — "실제 값이
 * 대입된 계산 근거" 요건, SPEC.md). `(1+연 0.4167%)`처럼 퍼센트 기호를 그대로 지수 밑에
 * 넣으면 수학적으로 오해를 부를 수 있어(퍼센트는 100분의 1 표기일 뿐 그대로 더할 수 있는
 * 값이 아님) 공식이 실제로 쓰는 무차원 소수값을 그대로 보여준다.
 */
export function formatMonthlyRateDecimal(monthlyRate: number): string {
  const decimal = monthlyRate.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return decimal === "" ? "0" : decimal;
}

/** "20년 6개월 (총 246개월)" 형태로 대출 기간을 표시한다. */
export function formatLoanTerm(termMonths: number): string {
  const years = Math.floor(termMonths / 12);
  const months = termMonths % 12;
  if (years > 0 && months > 0) return `${years}년 ${months}개월 (총 ${termMonths}개월)`;
  if (years > 0) return `${years}년 (총 ${termMonths}개월)`;
  return `${months}개월`;
}

/** SPEC.md "상환방식 선택" 라벨. */
export const repaymentMethodLabels: Record<RepaymentMethod, string> = {
  equalInstallment: "원리금균등상환",
  equalPrincipal: "원금균등상환",
  bullet: "만기일시상환",
};

/**
 * 원리금균등·원금균등상환 결과 화면에 붙이는 안내(FORMULA.md "마지막 회차 단수 처리" 권장
 * 문구). 만기일시상환은 이 문제가 없어(FORMULA.md 참고) 붙이지 않는다.
 */
export const LAST_INSTALLMENT_ROUNDING_NOTE =
  "마지막 회차는 반올림 잔여 정산으로 다른 회차와 금액이 근소하게(보통 몇 원 이내) 다를 수 있습니다.";

export interface LoanYearlySummaryDisplayRow {
  key: number;
  yearLabel: string;
  principalPaymentTotal: string;
  interestTotal: string;
  endOfYearBalance: string;
}

/** `yearlySummary[]`를 표/카드 표시용 문자열로 가공한다(재계산하지 않음, 표시 전용). */
export function buildYearlySummaryDisplayRows(
  rows: LoanYearlySummaryRow[],
): LoanYearlySummaryDisplayRow[] {
  return rows.map((row) => ({
    key: row.year,
    yearLabel: row.monthsInYear < 12 ? `${row.year}년차 (${row.monthsInYear}개월)` : `${row.year}년차`,
    principalPaymentTotal: formatWon(row.principalPaymentTotal),
    interestTotal: formatWon(row.interestTotal),
    endOfYearBalance: formatWon(row.endOfYearBalance),
  }));
}

export interface BreakdownRow {
  /** 항목 이름. */
  label: string;
  /** 근거 라벨(법령이 아니라 표준 재무수학 출처 — ARCHITECTURE.md "7." 참고). */
  legalBasis: string;
  /** "라벨 = 값" 수식 문자열. */
  expression: string;
}

/**
 * 계산 방법(계산 근거) 화면용 단계별 수식 목록 — 월이율 계산 → 앵커값 계산(방식별) → 1회차
 * 계산 예시 → 총 이자/총 상환금액(ARCHITECTURE.md "7. UI 구조" 순서 그대로).
 */
export function buildLoanInterestBreakdown(
  input: LoanInterestCalculatorInput,
  result: LoanInterestCalculatorResult,
): BreakdownRow[] {
  const first = result.schedule[0];
  const rows: BreakdownRow[] = [
    {
      label: "월이율 계산",
      legalBasis: "표준 재무수학(연이율 12분할 — FORMULA.md \"월이율 산정 방식\")",
      expression: `${formatAnnualRatePercent(input.annualRatePercent)} ÷ 12 = ${formatMonthlyRatePercent(result.monthlyRate)}`,
    },
  ];

  if (result.repaymentMethod === "equalInstallment") {
    const monthlyRateDecimal = formatMonthlyRateDecimal(result.monthlyRate);
    rows.push({
      label: "매월 상환액(고정) 계산",
      legalBasis: "표준 재무수학(연금 현재가치 공식)",
      expression:
        result.monthlyRate === 0
          ? `${formatWon(input.principal)} ÷ ${input.termMonths}회 = ${formatWon(result.fixedMonthlyPayment)}`
          : `${formatWon(input.principal)} × ${formatMonthlyRatePercent(result.monthlyRate)} × (1+${monthlyRateDecimal})^${input.termMonths} ÷ [(1+${monthlyRateDecimal})^${input.termMonths} − 1] = ${formatWon(result.fixedMonthlyPayment)}`,
    });
  } else if (result.repaymentMethod === "equalPrincipal") {
    rows.push({
      label: "매회차 원금상환액(기준값) 계산",
      legalBasis: "표준 재무수학(균등분할)",
      expression: `${formatWon(input.principal)} ÷ ${input.termMonths}회 = ${formatWon(Math.round(input.principal / input.termMonths))}`,
    });
  } else {
    rows.push({
      label: "매월 이자(만기 전, 고정) 계산",
      legalBasis: "표준 재무수학(만기일시상환)",
      expression: `${formatWon(input.principal)} × ${formatMonthlyRatePercent(result.monthlyRate)} = ${formatWon(result.monthlyInterestBeforeMaturity)}`,
    });
  }

  rows.push({
    label: "1회차 상환 계산 예시",
    legalBasis: "회차별 스케줄 공통 규칙(FORMULA.md \"계산 순서\" 5단계)",
    expression: `이자 ${formatWon(first.interest)} + 원금상환액 ${formatWon(first.principalPayment)} = 상환액 ${formatWon(first.payment)}`,
  });

  rows.push({
    label: "총 이자",
    legalBasis: "Σ 회차별 이자",
    expression: formatWon(result.totalInterest),
  });

  rows.push({
    label: "총 상환금액",
    legalBasis: "대출 원금 + 총 이자",
    expression: `${formatWon(input.principal)} + ${formatWon(result.totalInterest)} = ${formatWon(result.totalPayment)}`,
  });

  return rows;
}
