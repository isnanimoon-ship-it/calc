/**
 * 최저임금·시급↔월급 계산기 — 표시용 포맷팅 + 계산 근거(breakdown) 문자열 빌더.
 *
 * docs/CALCULATOR_RULES.md "금액/숫자 연산": 화면 표시는 `Intl.NumberFormat('ko-KR')`로 통일한다.
 *
 * **이 계산기는 weekly-holiday-allowance와 달리 "표시 직전 반올림" 정책을 쓰지 않는다.**
 * `convertedMonthlyPay`/`convertedHourlyWage`/`minWageMonthlyEquivalent`는 logic.ts가 이미
 * FORMULA.md "최종 표시 반올림" 규칙대로 정수(원)로 반환한다(ARCHITECTURE.md "5.2" — 이
 * 계산기의 반올림 정책 자체가 "중간 계산 단계에서 이미 반올림"이기 때문). 따라서 이 파일의
 * `formatWon`은 반올림을 다시 적용하지 않고 그대로 천 단위 콤마만 붙인다.
 *
 * **[v2, FORMULA.md 개정]** `monthlyEquivalentHours`(월 환산 시간)는 더 이상 항상 정수가
 * 아니다 — logic.ts가 소수 둘째 자리까지 반올림해 반환한다(예: `208.57`). 이 값을 화면에
 * 노출할 때는 반드시 `formatHours()`를 거친다 — `${value}시간` 템플릿 리터럴로 직접 이어
 * 붙이면 부동소수점 표현 오차(예: `208.57000000000001`)가 그대로 노출되거나, 정수로 딱
 * 떨어지는 값(예: `365`)과 소수 값(예: `208.57`)의 자릿수가 들쭉날쭉해 보일 위험이 있다
 * (ARCHITECTURE.md "v2 개정" Builder 체크리스트 "2.").
 */

import type { MinimumWageCalculatorResult } from "./types";

const numberFormatter = new Intl.NumberFormat("ko-KR");

/** 금액(원, 이미 정수)을 "1,234,567원"으로 표시한다. logic.ts가 반환한 값을 추가로 반올림하지 않는다. */
export function formatWon(amountWon: number): string {
  return `${numberFormatter.format(amountWon)}원`;
}

/**
 * 시간을 "4.6시간" 형태로 표시한다 — 금액이 아니므로 반올림하지 않고 소수 최대 2자리로만
 * 자른다(weekly-holiday-allowance formatting.ts의 `formatHours`와 동일한 표시 규칙).
 */
export function formatHours(hours: number): string {
  return `${numberFormatter.format(Math.round(hours * 100) / 100)}시간`;
}

/**
 * "약 4.345주"로 화면에 표시하는 월 환산 계수 라벨(weekly-holiday-allowance formatting.ts와
 * 동일 문구 — 두 계산기가 같은 `laborStandards.monthlyWeekFactor` 데이터를 쓴다).
 */
const MONTHLY_FACTOR_LABEL = "365 ÷ 12 ÷ 7 ≈ 4.345주";

export interface BreakdownRow {
  /** 항목 이름(입력·결과·오류와 같은 용어). */
  label: string;
  /** 근거 법령 라벨. */
  legalBasis: string;
  /** "라벨 = 값" 수식 문자열. */
  expression: string;
}

/**
 * 계산 근거(계산 방법) 화면용 단계별 수식 목록. SPEC.md "결과 화면 breakdown" — (1) 입력값은
 * 별도 "적용된 입력값" 카드에서 보여주고, 이 배열은 (2) 월 환산 시간 산출 과정, (3) 환산식,
 * (4) 최저임금 비교식만 담는다(서술형 내레이션 금지, "라벨 = 값" 형태).
 *
 * `result.displayHourlyWage`/`displayMonthlyPay`는 HOURLY 모드에서는 입력값(hourlyWage) 그대로,
 * MONTHLY 모드에서는 입력값(monthlyWage) 그대로이므로(`types.ts` 참고), 환산식 3단계에서
 * 별도로 `input`을 전달받지 않고 이 두 필드만으로 원본 입력값을 재현한다.
 */
export function buildMinimumWageBreakdown(result: MinimumWageCalculatorResult): BreakdownRow[] {
  const weeklyHoursLabel = formatHours(result.weeklyHours);
  const holidayHoursLabel = formatHours(result.weeklyHolidayHours);
  const paidHoursLabel = formatHours(result.weeklyPaidHours);

  const rows: BreakdownRow[] = [
    {
      label: "1주 주휴시간",
      legalBasis: "최저임금법 시행령 제5조제2호 · 근로기준법 제55조제1항",
      expression: `${weeklyHoursLabel} ÷ 주 40시간 × 1일 8시간, 최대 8시간 = ${holidayHoursLabel}`,
    },
    {
      label: "월 환산 시간",
      legalBasis: "최저임금법 시행령 제5조제2호·제3호",
      expression:
        `${weeklyHoursLabel} + ${holidayHoursLabel} = ${paidHoursLabel} → ` +
        `${paidHoursLabel} × (${MONTHLY_FACTOR_LABEL}) → 반올림(소수 둘째 자리) = ${formatHours(result.monthlyEquivalentHours)}`,
    },
  ];

  if (result.mode === "HOURLY") {
    rows.push({
      label: "환산 월급",
      legalBasis: "최저임금법 시행령 제5조제3호",
      expression: `시급 ${formatWon(result.displayHourlyWage)} × ${formatHours(result.monthlyEquivalentHours)} = ${formatWon(result.convertedMonthlyPay)}`,
    });
  } else {
    rows.push({
      label: "환산 시급",
      legalBasis: "최저임금법 시행령 제5조제3호",
      expression: `월급 ${formatWon(result.displayMonthlyPay)} ÷ ${formatHours(result.monthlyEquivalentHours)} = ${formatWon(result.convertedHourlyWage)}`,
    });
  }

  rows.push({
    label: "시급 비교",
    legalBasis: `최저임금법 제6조제1항 · ${result.appliedRateYear}년 최저임금`,
    expression: `${formatWon(result.displayHourlyWage)} vs ${formatWon(result.minWageHourly)} → ${result.hourlyMeetsMinimumWage ? "이상" : "미만"}`,
  });
  rows.push({
    label: "월급 비교",
    legalBasis: `최저임금법 제6조제1항 · 월 환산 최저임금(${weeklyHoursLabel} 기준)`,
    expression: `${formatWon(result.displayMonthlyPay)} vs ${formatWon(result.minWageMonthlyEquivalent)} (${weeklyHoursLabel} 기준) → ${result.monthlyMeetsMinimumWage ? "이상" : "미만"}`,
  });

  return rows;
}

/**
 * 미충족 경고 카드에 넣을 문구 조립(SPEC "게이팅 없이 항상 계산, 판정은 결과 화면의 비차단
 * 안내로만 전달"). `hourlyMeetsMinimumWage`/`monthlyMeetsMinimumWage` 중 하나라도 false면
 * ui.tsx가 이 함수의 결과를 경고 카드에 표시한다. 둘 다 충족이면 `null`.
 */
export function buildBelowMinimumWageWarning(result: MinimumWageCalculatorResult): string | null {
  const parts: string[] = [];
  if (!result.hourlyMeetsMinimumWage) {
    parts.push(
      `시급 ${formatWon(result.displayHourlyWage)}은(는) ${result.appliedRateYear}년 최저임금 ${formatWon(result.minWageHourly)}보다 낮습니다`,
    );
  }
  if (!result.monthlyMeetsMinimumWage) {
    parts.push(
      `월급 ${formatWon(result.displayMonthlyPay)}은(는) ${formatHours(result.weeklyHours)} 기준 월 환산 최저임금 ${formatWon(result.minWageMonthlyEquivalent)}보다 낮습니다`,
    );
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

/**
 * [v2 신규] `result.minimumWageJudgmentMismatch`가 `true`일 때(시급 기준 판정과 월급 기준
 * 판정이 서로 다를 때)만 노출하는 설명 문구. `null`이면 ui.tsx는 아무것도 표시하지 않는다.
 *
 * FORMULA.md v2 "[신규] Calculation Auditor 항목 6(이중 배지 불일치)이 이번 정책 변경으로
 * 해소되는가 — 아니다, 거의 그대로 남는다" 절, ARCHITECTURE.md "v2 개정 > 4." 참고: 이
 * 불일치는 계산 오류가 아니라 "월급을 시급으로 환산할 때 원 단위로 반올림한다"는 화폐 반올림
 * 자체에서 나오는 구조적 현상이며, `monthlyEquivalentHours`의 반올림 자릿수를 정수에서 소수
 * 둘째 자리로 바꾼 v2로도 해소되지 않는다(반례 구간 폭이 104개 → 103개로 사실상 그대로).
 */
export function buildJudgmentMismatchNotice(result: MinimumWageCalculatorResult): string | null {
  if (!result.minimumWageJudgmentMismatch) return null;
  return (
    "시급 기준 판정과 월급 기준 판정이 서로 다르게 나왔습니다. 이는 계산이 잘못된 것이 아니라, " +
    "월급을 시급으로 환산할 때(또는 그 반대) 원 단위로 반올림하기 때문에 두 임계값 근처에서 " +
    "발생할 수 있는 정상적인 현상입니다. 두 값 중 하나만 보지 말고 시급·월급 비교 결과를 함께 " +
    "참고해 주세요."
  );
}
