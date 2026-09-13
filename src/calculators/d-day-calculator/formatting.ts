/**
 * 디데이 계산기 — 표시용 포맷팅(문장형 설명, 날짜·요일 표기, 주 단위 환산, "오늘" 배지 판정,
 * 계산 근거 조립).
 *
 * tasks/d-day-calculator/ARCHITECTURE.md "10." 5번을 그대로 구현한다. 숫자를 새로 계산하지
 * 않고 logic.ts가 이미 확정한 값만 문자열로 가공한다(housing-subscription-score가 세운
 * "로직 값만, 문장 조립은 formatting.ts" 경계를 그대로 따른다).
 */

import type {
  DateShiftCalculationResult,
  DdayCalculationResult,
  Weekday,
  WeeksBreakdown,
} from "./types";

/**
 * FORMULA.md "요일" — JS `getUTCDay()` 인덱스(0=일~6=토)에 대응하는 한국어 1글자 라벨.
 * `age-calculator/formatting.ts`의 동명 배열과 값은 같지만 공용화하지 않는다(이 계산기
 * 전용 — ARCHITECTURE.md "1.6"과 동일한 이유로 이번 범위 밖).
 */
export const weekdayLabels: Record<Weekday, string> = {
  0: "일",
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
};

/** "YYYY-MM-DD" → "YYYY년 M월 D일"(SPEC.md 표기, 월/일은 0-padding 없이 그대로 표시). */
export function formatKoreanDate(dateIso: string): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

/** "YYYY년 M월 D일 (요일)" — SPEC.md 모드 B 결과 표기(예: "2026년 12월 20일 (일)"). */
export function formatKoreanDateWithWeekday(dateIso: string, weekday: Weekday): string {
  return `${formatKoreanDate(dateIso)} (${weekdayLabels[weekday]})`;
}

/**
 * FORMULA.md "주 단위 환산(Should Have)" 표시 문자열. `breakdown`이 `null`(당일)이면
 * `null`을 반환해 호출부가 렌더링하지 않도록 한다. 방향 어미는 `diffDays` 부호를 따른다
 * (양수="…후", 음수="…전"; 0은 breakdown 자체가 이미 null이라 도달하지 않는다).
 */
export function formatWeeksBreakdown(
  breakdown: WeeksBreakdown | null,
  diffDays: number,
): string | null {
  if (!breakdown) return null;
  const { weeks, remainderDays } = breakdown;
  const base =
    weeks === 0
      ? `${remainderDays}일`
      : remainderDays === 0
        ? `${weeks}주`
        : `${weeks}주 ${remainderDays}일`;
  return `${base} ${diffDays > 0 ? "후" : "전"}`;
}

/** 날짜가 오늘과 같은지 판정한다(SPEC.md "시작일이 오늘이면 `오늘` 배지" 규칙). */
export function isToday(dateIso: string, todayIso: string): boolean {
  return dateIso === todayIso;
}

/** 모드 A 핵심 결과 카드 아래 문장형 설명(SPEC.md 예시 문구 그대로). */
export function formatDdaySentence(result: DdayCalculationResult): string {
  const targetKorean = formatKoreanDate(result.targetDate);
  if (result.diffDays === 0) {
    return `${targetKorean}은 시작일과 같은 날입니다.`;
  }
  if (result.diffDays > 0) {
    return `${targetKorean}까지 ${result.diffDays}일 남았습니다.`;
  }
  return `${targetKorean}로부터 ${-result.diffDays}일 지났습니다.`;
}

/** 모드 B 핵심 결과 카드 아래 문장형 설명. */
export function formatDateShiftSentence(result: DateShiftCalculationResult): string {
  const baseKorean = formatKoreanDate(result.baseDate);
  const resultKorean = formatKoreanDateWithWeekday(result.resultDate, result.resultWeekday);
  const verb = result.direction === "add" ? "더한" : "뺀";
  if (result.days === 0) {
    return `${baseKorean}에서 0일을 ${verb} 날짜는 같은 날인 ${resultKorean}입니다.`;
  }
  return `${baseKorean}에서 ${result.days.toLocaleString("ko-KR")}일을 ${verb} 날짜는 ${resultKorean}입니다.`;
}

export interface BreakdownLine {
  label: string;
  detail: string;
}

/** 모드 A 계산 근거(SPEC.md 화면 구성 "계산 근거" — 실제 값이 대입된 날짜 차이 계산식). */
export function buildDdayBreakdown(result: DdayCalculationResult): BreakdownLine[] {
  const startKorean = formatKoreanDateWithWeekday(result.startDate, result.startWeekday);
  const targetKorean = formatKoreanDateWithWeekday(result.targetDate, result.targetWeekday);
  const weeksText = formatWeeksBreakdown(result.weeksBreakdown, result.diffDays);

  const lines: BreakdownLine[] = [
    {
      label: "날짜 차이",
      detail: `${targetKorean} − ${startKorean} = ${result.diffDays}일 → ${result.ddayLabel}`,
    },
  ];
  if (weeksText) {
    lines.push({ label: "주 단위 환산", detail: weeksText });
  }
  return lines;
}

/** 모드 B 계산 근거(SPEC.md 화면 구성 "계산 근거" — 실제 값이 대입된 날짜 이동 계산식). */
export function buildDateShiftBreakdown(result: DateShiftCalculationResult): BreakdownLine[] {
  const baseKorean = formatKoreanDate(result.baseDate);
  const resultKorean = formatKoreanDateWithWeekday(result.resultDate, result.resultWeekday);
  const sign = result.direction === "add" ? "+" : "−";

  return [
    {
      label: "날짜 이동",
      detail: `${baseKorean} ${sign} ${result.days.toLocaleString("ko-KR")}일 = ${resultKorean}`,
    },
  ];
}

/** 모드 A 결과 공유 텍스트(ShareActions). */
export function formatDdaySummary(result: DdayCalculationResult): string {
  return `${result.ddayLabel} — ${formatDdaySentence(result)}`;
}

/** 모드 B 결과 공유 텍스트(ShareActions). */
export function formatDateShiftSummary(result: DateShiftCalculationResult): string {
  return formatDateShiftSentence(result);
}
