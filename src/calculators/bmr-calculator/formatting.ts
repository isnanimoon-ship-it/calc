/**
 * 기초대사량(BMR) 계산기 — 표시용 포맷팅 + 계산 근거/선택지 라벨 조립.
 *
 * docs/CALCULATOR_RULES.md "금액/숫자 연산": 화면 표시는 Intl.NumberFormat('ko-KR')로
 * 통일한다. logic.ts는 숫자만 반환한다 — 사람이 읽는 문장(계산 근거·활동량 카드 라벨)은
 * 이 파일이 조립한다(national-pension-benefit-estimate/formatting.ts와 동일한 경계).
 */

import type { ActivityLevel, BodyMetrics, RoundedKcalValue, TdeeValue } from "./types";

const numberFormatter = new Intl.NumberFormat("ko-KR");
const preciseFormatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 4 });

/** 정수 kcal을 "1,649kcal" 형태로 표시한다. */
export function formatKcal(value: number): string {
  return `${numberFormatter.format(Math.round(value))}kcal`;
}

/** 반올림 전 완전정밀도 kcal을 "1,648.75kcal" 형태로 표시한다(계산 근거 breakdown용). */
export function formatKcalPrecise(value: number): string {
  return `${preciseFormatter.format(value)}kcal`;
}

/** 나이를 "30세" 형태로 표시한다. */
export function formatAge(age: number): string {
  return `${numberFormatter.format(age)}세`;
}

/** cm 값을 소수 첫째 자리까지 "175.0cm" 형태로 표시한다. */
export function formatHeight(heightCm: number): string {
  return `${heightCm.toFixed(1)}cm`;
}

/** kg 값을 소수 첫째 자리까지 "70.0kg" 형태로 표시한다. */
export function formatWeight(weightKg: number): string {
  return `${weightKg.toFixed(1)}kg`;
}

/** 활동계수를 "1.55" 형태로 표시한다(소수 셋째 자리까지, 불필요한 trailing zero 유지 안 함). */
export function formatActivityFactor(factor: number): string {
  return factor.toString();
}

/** 활동량 라디오 카드 옵션 하나(값=레벨, 제목=굵게 표시, 설명=작게 표시). */
export interface ActivityLevelOption {
  value: ActivityLevel | null;
  title: string;
  description: string;
}

/**
 * "선택 안 함" + 5단계, FORMULA.md "활동계수 5단계" 표 그대로(ARCHITECTURE.md "7.2" 옵션
 * 구성). 활동계수 실수값은 여기 노출하지 않는다 — SPEC.md Must Have "전문 용어(활동계수
 * 1.375 같은 숫자)가 아니라 일상어 설명으로 표시".
 */
export const ACTIVITY_LEVEL_OPTIONS: ActivityLevelOption[] = [
  { value: null, title: "선택 안 함", description: "BMR(기초대사량)만 확인할게요" },
  { value: 1, title: "1. 거의 운동을 안 함", description: "주로 앉아서 생활" },
  { value: 2, title: "2. 가벼운 활동", description: "주 1~3일 정도 가벼운 운동" },
  { value: 3, title: "3. 보통 활동", description: "주 3~5일 정도 적당한 강도의 운동" },
  { value: 4, title: "4. 활발한 활동", description: "주 6~7일 강도 높은 운동" },
  { value: 5, title: "5. 매우 활발함", description: "매일 하는 고강도 운동 또는 육체노동" },
];

/** 레벨 번호만으로 "거의 운동을 안 함(주로 앉아서 생활)" 같은 사람이 읽는 라벨을 만든다. */
export function activityLevelLabel(level: ActivityLevel): string {
  const option = ACTIVITY_LEVEL_OPTIONS.find((item) => item.value === level);
  if (!option) return "";
  const title = option.title.replace(/^\d+\.\s*/, "");
  return `${title}(${option.description})`;
}

/**
 * 대표 공식(Mifflin-St Jeor) 계산 근거 문자열 — 실제 입력값을 대입한 수식.
 * FORMULA.md "공식" 절과 정확히 같은 연산 순서를 문자열로 재현한다(logic.ts의 실제 계산과
 * 별개로, 표시만을 위해 같은 수식을 다시 조립한다 — 연산 자체는 logic.ts 결과값만 쓴다).
 */
export function buildBmrBreakdown(metrics: BodyMetrics, bmr: RoundedKcalValue): string {
  const sexTerm = metrics.sex === "male" ? "+ 5" : "− 161";
  return (
    `10 × ${formatWeight(metrics.weightKg)} + 6.25 × ${formatHeight(metrics.heightCm)} − ` +
    `5 × ${formatAge(metrics.ageYears)} ${sexTerm} = ${formatKcalPrecise(bmr.raw)}(반올림 전) ` +
    `→ ${formatKcal(bmr.display)}`
  );
}

/** 보조 공식(Harris-Benedict 개정판) 계산 근거 문자열. */
export function buildBmrAlternativeBreakdown(
  metrics: BodyMetrics,
  bmrAlternative: RoundedKcalValue,
): string {
  const expression =
    metrics.sex === "male"
      ? `88.362 + 13.397 × ${formatWeight(metrics.weightKg)} + 4.799 × ${formatHeight(metrics.heightCm)} − 5.677 × ${formatAge(metrics.ageYears)}`
      : `447.593 + 9.247 × ${formatWeight(metrics.weightKg)} + 3.098 × ${formatHeight(metrics.heightCm)} − 4.330 × ${formatAge(metrics.ageYears)}`;
  return `${expression} = ${formatKcalPrecise(bmrAlternative.raw)}(반올림 전) → ${formatKcal(bmrAlternative.display)}`;
}

/** TDEE 계산 근거 문자열 — 반드시 bmr.raw(반올림 전)를 곱했음을 문구로도 드러낸다. */
export function buildTdeeBreakdown(bmr: RoundedKcalValue, tdee: TdeeValue): string {
  return (
    `${formatKcalPrecise(bmr.raw)}(반올림 전 BMR) × ${formatActivityFactor(tdee.activityFactor)}` +
    ` = ${formatKcalPrecise(tdee.raw)}(반올림 전) → ${formatKcal(tdee.display)}`
  );
}
