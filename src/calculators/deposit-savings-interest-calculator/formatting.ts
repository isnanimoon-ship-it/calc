/**
 * 예금·적금 이자 계산기 — 표시용 포맷팅 + 계산 근거(breakdown) 조립.
 *
 * `logic.ts`가 이미 원 단위로 절사/반올림해 반환하므로(FORMULA.md "계산 순서") 이 파일은
 * 재반올림하지 않는다 — `Intl.NumberFormat`만 적용한다(loan-interest-calculator/formatting.ts
 * 와 동일 경계).
 */

import { sumScheduleDisplayInterest } from "./logic";
import type {
  DepositInterestType,
  DepositSavingsInterestCalculatorResult,
  SavingsScheduleRow,
  Won,
} from "./types";

const wonFormatter = new Intl.NumberFormat("ko-KR");

/** 금액(원)을 "1,234,567원"으로 표시한다. logic이 이미 정수로 확정해 반환하므로 재반올림하지 않는다. */
export function formatWon(amountWon: number): string {
  return `${wonFormatter.format(amountWon)}원`;
}

/** 연이율(%) 표시 — 입력 그대로("연 3%", "연 3.45%")를 보여준다(내부 계산 표현 0.03과 분리). */
export function formatAnnualRatePercent(annualRatePercent: number): string {
  return `연 ${annualRatePercent}%`;
}

/** "12개월 (1년)", "18개월 (1년 6개월)", "6개월" 형태로 기간을 표시한다. */
export function formatTermMonths(termMonths: number): string {
  const years = Math.floor(termMonths / 12);
  const months = termMonths % 12;
  if (years === 0) return `${termMonths}개월`;
  if (months === 0) return `${termMonths}개월 (${years}년)`;
  return `${termMonths}개월 (${years}년 ${months}개월)`;
}

/**
 * 월이율을 %로 환산해 표시(계산에는 원시 소수값을 그대로 쓰고, 표시에만 반올림). 소수 넷째
 * 자리까지 보여주되 꼬리의 불필요한 0은 잘라낸다(loan-interest-calculator/formatting.ts와
 * 동일 패턴).
 */
export function formatMonthlyRatePercent(monthlyRate: number): string {
  const percent = (monthlyRate * 100).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return `${percent === "" ? "0" : percent}%`;
}

/** 월이율을 소수(무차원) 형태로 표시한다(예: 0.0025→"0.0025"). 계산식에 실제 대입된 값을 그대로 보여줄 때 쓴다. */
export function formatMonthlyRateDecimal(monthlyRate: number): string {
  const decimal = monthlyRate.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return decimal === "" ? "0" : decimal;
}

/** SPEC.md "예금 모드 전용 입력" 라벨. */
export const depositInterestTypeLabels: Record<DepositInterestType, string> = {
  simple: "단리",
  compound: "월복리",
};

export interface SavingsScheduleDisplayRow {
  key: number;
  installment: number;
  contribution: string;
  remainingMonths: string;
  interest: string;
}

/** `schedule[]`를 표 표시용 문자열로 가공한다(재계산하지 않음, 표시 전용). */
export function buildSavingsScheduleDisplayRows(
  schedule: SavingsScheduleRow[],
): SavingsScheduleDisplayRow[] {
  return schedule.map((row) => ({
    key: row.installment,
    installment: row.installment,
    contribution: formatWon(row.contribution),
    remainingMonths: `${row.remainingMonths}개월`,
    interest: formatWon(row.interest),
  }));
}

/**
 * "회차별 표 합계가 세전 이자와 원 단위에서 다를 수 있다"는 현상의 고지 문구
 * (ARCHITECTURE.md "4." 옵션 1 — 실제 차이를 계산해 안내). 각 행이 자신의 완전정밀도
 * 원본에서 독립적으로 반올림되는 정책의 자연스러운 결과이며 버그가 아니다
 * (FORMULA.md "계산 순서" 7단계, average-cost-calculator 선례와 동일한 성격).
 */
export function formatScheduleSumNotice(schedule: SavingsScheduleRow[], preTaxInterest: Won): string {
  const scheduleSum = sumScheduleDisplayInterest(schedule);
  const diff = scheduleSum - preTaxInterest;
  if (diff === 0) {
    return (
      "회차별 이자는 각 회차마다 독립적으로 반올림해 표시합니다. 이번 계산은 표의 합계와 " +
      "세전 이자가 원 단위까지 일치합니다."
    );
  }
  const diffDirection = diff > 0 ? "많습니다" : "적습니다";
  return (
    `회차별 이자는 각 회차마다 독립적으로 반올림해 표시하기 때문에, 이 표의 합계(${formatWon(scheduleSum)})가 ` +
    `세전 이자(${formatWon(preTaxInterest)})보다 ${formatWon(Math.abs(diff))} 더 ${diffDirection}. 계산 오류가 아니라 ` +
    "반올림 정책에 따른 자연스러운 차이입니다."
  );
}

export interface BreakdownRow {
  /** 항목 이름. */
  label: string;
  /** 근거 라벨 — 재무수학 공식 단계는 "표준 재무수학", 이자소득세 단계는 실제 법령 조문. */
  legalBasis: string;
  /** "라벨 = 값" 수식 문자열. */
  expression: string;
}

/**
 * 계산 근거 화면용 단계별 수식 목록 — 세전 이자 산출 → 이자소득세 계산(소득세 14% 사사오입 →
 * 지방소득세 10% 사사오입) → 세후 결과(ARCHITECTURE.md "8.1" 8번 순서 그대로).
 */
export function buildDepositSavingsInterestBreakdown(
  result: DepositSavingsInterestCalculatorResult,
): BreakdownRow[] {
  const rows: BreakdownRow[] = [];

  if (result.mode === "deposit") {
    if (result.interestType === "simple") {
      rows.push({
        label: "세전 이자 계산(단리)",
        legalBasis: "표준 재무수학(FORMULA.md \"공식 1\")",
        expression: `${formatWon(result.principal)} × ${formatAnnualRatePercent(result.annualRatePercent)} × (${result.termMonths}개월 ÷ 12) = ${formatWon(result.preTaxInterest)}`,
      });
    } else {
      const monthlyRateDecimal = formatMonthlyRateDecimal(result.monthlyRate);
      rows.push({
        label: "월이율 계산",
        legalBasis: "표준 재무수학(연이율 12분할 — FORMULA.md \"월이율 산정 방식\")",
        expression: `${formatAnnualRatePercent(result.annualRatePercent)} ÷ 12 = ${formatMonthlyRatePercent(result.monthlyRate)}`,
      });
      rows.push({
        label: "세전 이자 계산(월복리)",
        legalBasis: "표준 재무수학(FORMULA.md \"공식 2\")",
        expression: `${formatWon(result.principal)} × [(1+${monthlyRateDecimal})^${result.termMonths} − 1] = ${formatWon(result.preTaxInterest)}`,
      });
    }
  } else {
    rows.push({
      label: "납입원금 합계",
      legalBasis: "표준 산술",
      expression: `${formatWon(result.monthlyContribution)} × ${result.termMonths}회 = ${formatWon(result.totalPrincipal)}`,
    });
    const n = result.termMonths;
    rows.push({
      label: "세전 이자 계산(적금 단리 후취식)",
      legalBasis: "표준 재무수학(회차별 잔여개월 합산의 닫힌 형 — FORMULA.md \"공식 3\", military-salary와 공유하는 산식)",
      expression: `${formatWon(result.monthlyContribution)} × ${formatAnnualRatePercent(result.annualRatePercent)} × [${n}×(${n}+1)/2] ÷ 12 = ${formatWon(result.preTaxInterest)}`,
    });
  }

  rows.push({
    label: "이자소득세(국세분) 계산",
    legalBasis: "소득세법 제129조제1항제1호(그 밖의 이자소득 14%)",
    expression: `${formatWon(result.preTaxInterest)} × 14% = ${formatWon(result.incomeTax)} (사사오입)`,
  });

  rows.push({
    label: "지방소득세 계산",
    legalBasis: "지방세법 제103조의13제1항(원천징수하는 소득세의 10%)",
    expression: `${formatWon(result.incomeTax)} × 10% = ${formatWon(result.localIncomeTax)} (사사오입, 세전 이자가 아니라 확정된 소득세액 기준)`,
  });

  rows.push({
    label: "세후 이자",
    legalBasis: "세전 이자 − 소득세 − 지방소득세",
    expression: `${formatWon(result.preTaxInterest)} − ${formatWon(result.incomeTax)} − ${formatWon(result.localIncomeTax)} = ${formatWon(result.afterTaxInterest)}`,
  });

  const principalLabel = result.mode === "deposit" ? "원금" : "납입원금 합계";
  const principalAmount = result.mode === "deposit" ? result.principal : result.totalPrincipal;
  rows.push({
    label: "세후 만기수령액",
    legalBasis: `${principalLabel} + 세후 이자`,
    expression: `${formatWon(principalAmount)} + ${formatWon(result.afterTaxInterest)} = ${formatWon(result.afterTaxMaturityAmount)}`,
  });

  return rows;
}
