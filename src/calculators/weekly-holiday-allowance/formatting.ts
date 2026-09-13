/**
 * 주휴수당 계산기 — 표시용 포맷팅 + 표시 직전 반올림 정책.
 *
 * docs/CALCULATOR_RULES.md "금액/숫자 연산": 화면 표시는 `Intl.NumberFormat('ko-KR')`로 통일한다.
 *
 * ⚠️ Architect 스캐폴딩 단계다. 아래 3개 함수(`roundWon`, `formatWon`, `formatHours`,
 * `formatHourlyWage`)는 다른 계산기와 동일한 기계적 표시 헬퍼라 미리 채워 둔다 —
 * 계산 공식이 아니라 표시/반올림 정책이다. breakdown의 "라벨 = 값" 수식 문자열,
 * 경고 문구 조립 등 계산기 고유 표시 로직은 Builder가 이 파일에 추가한다.
 */

import type {
  WeeklyHolidayAllowanceInput,
  WeeklyHolidayAllowanceResult,
} from "./types";

const wonFormatter = new Intl.NumberFormat("ko-KR");

/** 부동소수점 표현 오차 보정용 아주 작은 여유값(원 단위 스케일에서 안전한 크기).
 *  severance-pay/formatting.ts의 EPSILON, unemployment-benefit의 TOTAL_BENEFIT_EPSILON와 같은 이유 —
 *  수학적으로 정수(또는 .5)인 값이 `125559.9999999`처럼 계산돼 반올림이 한 단계 빗나가는 것을 막는다. */
const EPSILON = 1e-6;

/**
 * **표시 직전 원 단위 반올림 정책 함수 (FORMULA.md "정밀도/반올림 정책").**
 *
 * 정책: round half up(사사오입). logic.ts가 반환하는 완전정밀도 금액을 화면에 보여주기
 * 직전에 이 함수로 각 값에 독립적으로 1회만 적용한다 — 반올림된 값을 다른 값의 계산에
 * 재사용하지 않는다.
 *
 * FORMULA.md "정밀도/반올림 정책" (2026-09-04 Calculation Auditor 4-b절 실측): 온라인 계산기
 * 4개의 계산 스크립트 소스를 직접 추출한 결과 최종 원 단위 처리가 2:2로 갈린다 —
 * 알바천국(`toFixed(0)`)·생활계산기 calcava(`Math.round`) = 반올림 / 노동OK(`parseInt`)·
 * 시프티(`Math.floor`) = 절사. 이 계산기는 반올림을 채택했고(4개 중 2개 일치, 편향 없음,
 * 실차이 1주치 ≤1원) 정책 변경은 불요하다. 그래도 정책이 절사/올림으로 바뀔 경우 이
 * **이름 있는 단일 함수** 본문 한 줄만 고치면 되도록 분리해 둔다(unemployment-benefit
 * `finalizeTotalBenefit` 선례).
 */
export function roundWon(amountWon: number): number {
  return Math.round(amountWon + EPSILON);
}

/** 금액(원)을 `roundWon`으로 원 단위 반올림해 "1,234,567원"으로 표시한다. */
export function formatWon(amountWon: number): string {
  return `${wonFormatter.format(roundWon(amountWon))}원`;
}

/** 시급/실질시급(원/시간)을 원 단위 반올림해 "10,320원"으로 표시한다. */
export function formatHourlyWage(wonPerHour: number): string {
  return `${wonFormatter.format(roundWon(wonPerHour))}원`;
}

/**
 * 주휴시간을 "4.6시간" 형태로 표시한다 — 금액이 아니므로 반올림하지 않고 소수 최대 2자리로만
 * 자른다(FORMULA.md "표시 결과(주휴 시간)": 예 "4.6시간", "2.75시간").
 */
export function formatHours(hours: number): string {
  return `${wonFormatter.format(Math.round(hours * 100) / 100)}시간`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 계산 근거(계산 방법) 화면용 "라벨 = 값" 수식 문자열 빌더 + 경고/고지 문구 조립.
 *
 * unemployment-benefit v2 "계산 근거 화면 표현 원칙"을 따른다 — 서술형 내레이션이나 내부
 * 구현(반올림·정밀도) 설명을 넣지 않고, 수식·숫자 위주로 간결하게 쓴다(SPEC "결과 화면
 * breakdown"). 근거 법령 라벨을 병기한다.
 * 표시값은 formatting 헬퍼(`roundWon` 경유)를 쓰므로 이 문자열들은 "표시 전용"이며 계산에
 * 재사용되지 않는다.
 * ──────────────────────────────────────────────────────────────────────────── */

/** 월 환산 계수 표기(FORMULA.md "월 환산 계수": 내부 계산은 365/84, 화면 표기는 "약 4.345주"). */
const MONTHLY_FACTOR_LABEL = "365 ÷ 12 ÷ 7 ≈ 4.345주";

/**
 * 월 환산 값의 화면 명칭 — 헤더·사용 안내·계산 상세·breakdown 어디서나 이 표기 하나로 통일한다
 * (UX/UI Critic L1: "월 환산 참고액" vs "월 환산 주휴수당 (참고액)" 흔들림 제거).
 */
export const MONTHLY_HOLIDAY_PAY_LABEL = "월 환산 주휴수당 (참고)";
export const MONTHLY_TOTAL_PAY_LABEL = "주휴수당 포함 월급 (참고)";

/**
 * 월 환산액이 "참고" 금액임을 알리는 주석(FORMULA.md "월 환산 계수" — 209시간 관례와의 미세한
 * 불일치를 사용자가 의아해할 수 있으므로 명시). UX/UI Critic M2(b): 알바 대상이 이해할 수 있게
 * "월 209시간 환산" 표현을 순화한다.
 */
export const MONTHLY_REFERENCE_NOTE =
  "월 환산액은 한 달을 4주보다 조금 긴 4.345주(365 ÷ 12 ÷ 7)로 보고 계산한 참고 금액입니다. " +
  "회사가 '월 209시간' 기준으로 급여를 계산하면 실제 지급액과 몇 천 원 정도 차이가 날 수 있습니다.";

/**
 * "주휴수당 포함 실질 시급"의 뜻 풀이 한 줄(UX/UI Critic M2(a)) — "실질 시급"은 법령어가 아닌
 * 조어라 개념 설명이 필요하다.
 */
export const EFFECTIVE_WAGE_NOTE =
  "'주휴수당 포함 실질 시급'은 주휴수당까지 포함하면 실제로 시간당 얼마를 받는 셈인지를 나타냅니다.";

/**
 * 주 40시간 초과 입력 시 breakdown에 함께 노출하는 고지(FORMULA.md "예외" `weeklyHours` 40 초과,
 * SPEC FAQ 5) — `result.cappedAtStatutoryLimit === true`일 때만 표시한다.
 */
export const STATUTORY_LIMIT_NOTICE =
  "주 40시간을 초과한 시간은 소정근로시간이 아니므로 주휴수당 산정에 포함되지 않습니다(주휴시간 8시간 상한). " +
  "40시간 초과분(연장근로)에 대한 가산수당은 이 계산기에서 계산하지 않습니다.";

export interface BreakdownRow {
  /** 항목 이름(입력·결과·오류와 같은 용어). */
  label: string;
  /** 근거 법령/관행 라벨. */
  legalBasis: string;
  /** "라벨 = 값" 수식 문자열. */
  expression: string;
}

/**
 * 계산 방법(계산 근거) 화면용 단계별 수식 목록. FORMULA.md "공식" 1~6단계를
 * `(주 근무시간 ÷ 40) × 8` 관행 표기로 옮긴다.
 */
export function buildWeeklyHolidayBreakdown(
  input: WeeklyHolidayAllowanceInput,
  result: WeeklyHolidayAllowanceResult,
): BreakdownRow[] {
  const wage = formatHourlyWage(input.hourlyWage);
  const hours = formatHours(input.weeklyHours);
  const holidayHours = formatHours(result.weeklyHolidayHours);
  const holidayPay = formatWon(result.weeklyHolidayPay);
  const weeklyTotal = formatWon(result.weeklyTotalPay);

  return [
    {
      label: "1주 주휴시간",
      legalBasis:
        "근로기준법 시행령 별표2 제4호(단시간근로자 유급휴일수당) · 근로기준법 제50조(8시간 상한)",
      // UX/UI Critic L3: 맨숫자(÷ 40, × 8, 상한 8)의 의미가 섞이지 않도록 단위·기준을 붙인다.
      expression: `${hours} ÷ 주 40시간 × 1일 8시간, 최대 8시간 = ${holidayHours}`,
    },
    {
      label: "1주치 주휴수당",
      legalBasis: "근로기준법 제55조제1항",
      expression: `${holidayHours} × ${wage} = ${holidayPay}`,
    },
    {
      label: MONTHLY_HOLIDAY_PAY_LABEL,
      legalBasis: "월 평균 주 수 (고용노동부 최저임금 월 환산 관행)",
      expression: `${holidayPay} × (${MONTHLY_FACTOR_LABEL}) = ${formatWon(result.monthlyHolidayPay)}`,
    },
    {
      label: "주휴수당 포함 주급",
      legalBasis: "입력 시급 × 입력 시간 + 1주치 주휴수당",
      expression: `${hours} × ${wage} + ${holidayPay} = ${weeklyTotal}`,
    },
    {
      label: MONTHLY_TOTAL_PAY_LABEL,
      legalBasis: "월 평균 주 수 (고용노동부 최저임금 월 환산 관행)",
      expression: `${weeklyTotal} × (${MONTHLY_FACTOR_LABEL}) = ${formatWon(result.monthlyTotalPay)}`,
    },
    {
      label: "주휴수당 포함 실질 시급",
      legalBasis: "주휴수당 포함 주급 ÷ 주 근무시간",
      expression: `${weeklyTotal} ÷ ${hours} = ${formatHourlyWage(result.effectiveHourlyWage)}`,
    },
  ];
}

export interface WarningCardContent {
  title: string;
  body: string;
  /** 보조 문구(선택). */
  note?: string;
  legalBasis: string;
  /**
   * 카드 아이콘 종류(UX/UI Critic L2: 두 경고 카드를 제목 안 읽어도 구분되게).
   * "info" = 제도가 적용되지 않는다는 설명형 안내(15시간 미만), "warning" = 지급액에 문제가
   * 있다는 경고(최저임금 미만).
   */
  icon: "info" | "warning";
}

/**
 * 15시간 미만 경고(FORMULA.md "계산 순서" 10, "예외") — `result.meetsMinHoursRequirement === false`
 * 일 때만 표시한다. 계산을 막지 않는다.
 */
export function buildMinHoursWarning(
  input: WeeklyHolidayAllowanceInput,
): WarningCardContent {
  return {
    title: "주 15시간 미만 — 실제로는 주휴수당이 발생하지 않습니다",
    body:
      // QA-L1: formatHours 반환값은 항상 "…시간"으로 끝나므로 조사는 "은/으로"로 고정한다
      // ("10시간는" → "10시간으로").
      `입력한 주 근무시간은 ${formatHours(input.weeklyHours)}으로 15시간 미만입니다. ` +
      "4주 동안을 평균하여 1주 소정근로시간이 15시간 미만인 초단시간 근로자에게는 " +
      "주휴일(주휴수당)과 연차유급휴가가 적용되지 않습니다. 아래 금액은 요건을 충족한다고 " +
      "가정했을 때의 참고 금액입니다.",
    legalBasis: "근로기준법 제18조제3항",
    icon: "info",
  };
}

/**
 * 최저임금 미만 경고(FORMULA.md "계산 순서" 10, "최저임금 경고 문구") —
 * `result.belowMinimumWage === true`일 때만 표시한다. 계산을 막지 않는다.
 */
export function buildBelowMinimumWageWarning(
  result: WeeklyHolidayAllowanceResult,
): WarningCardContent {
  return {
    title: `입력한 시급이 ${result.appliedRateYear}년 최저임금보다 낮습니다`,
    body:
      `${result.appliedRateYear}년 최저임금은 시간당 ${formatHourlyWage(result.minimumHourlyWage)}입니다. ` +
      "입력한 시급이 이보다 낮습니다.",
    note:
      "일부 수습근로자는 최저임금의 90%까지 감액이 허용될 수 있으나(1년 이상 근로계약 · 수습 시작 후 " +
      "3개월 이내 · 단순노무 종사자가 아닐 것을 모두 충족하는 경우), 그 밖에는 최저임금 전액을 " +
      "지급해야 합니다. 이 계산기는 감액 허용 여부를 판정하지 않습니다.",
    legalBasis: "최저임금법 제5조제2항 · 같은 법 시행령 제3조",
    icon: "warning",
  };
}

/**
 * 핵심 결과 카드(1주치 주휴수당) 안에 조건부로 넣는 한 줄 보조 고지(UX/UI Critic M1).
 * 큰 숫자만 보고 아래 경고 카드를 스크롤로 지나치는 사용자도 전제를 알게 한다
 * (unemployment-benefit 핵심 카드의 "가정했을 때의 예상 금액입니다" 한 줄과 같은 취지).
 * 두 경고가 동시에 뜰 수 있으므로 함께 이어 붙인다. 경고가 없으면 null.
 */
export function buildKeyResultCaveat(
  result: WeeklyHolidayAllowanceResult,
): string | null {
  const parts: string[] = [];
  if (!result.meetsMinHoursRequirement) {
    parts.push("주 15시간 미만이라 실제로는 주휴수당이 발생하지 않습니다");
  }
  if (result.belowMinimumWage) {
    parts.push(`입력한 시급이 ${result.appliedRateYear}년 최저임금보다 낮습니다`);
  }
  if (parts.length === 0) return null;
  return `${parts.join(" · ")} — 아래 안내를 확인하세요.`;
}
