/**
 * 주택 취득세 계산기 — 표시 포맷팅 및 "계산 근거" 문자열 조립.
 *
 * 계산 로직(logic.ts)과 분리한다(docs/ARCHITECTURE.md "계산 로직 / UI 분리"). 이 파일은
 * 문자열 조립만 담당하고 세율·경계값을 새로 판정하지 않는다.
 *
 * **`buildTaxCalculationBreakdown`의 정확성 노트(중요)**: 이 함수는 절사 전 raw 금액을 화면에
 * 보여주기 위해 `input.acquisitionPrice`(사용자 입력값)와 `result.appliedRate`(logic.ts가
 * 이미 확정한 최종 적용 세율)를 다시 곱한다. 이것은 취득세 계산 로직을 "다시 구현"하는 것이
 * 아니다 — 두 값 모두 logic.ts가 실제로 사용한 것과 완전히 같은 값이므로(같은 입력 × 같은
 * 세율은 항상 같은 부동소수점 결과를 낸다), logic.ts 내부의 `acquisitionTaxRaw`를 그대로
 * 재현한다. 세율 판정(가격 구간·중과 여부)은 이 파일에서 전혀 하지 않는다 — `result`가 이미
 * 확정한 값만 조합한다.
 */

import { HOUSING_ACQUISITION_TAX_POLICY as POLICY } from "./policy";
import type {
  HouseCountAfterAcquisition,
  HousingAcquisitionTaxFormInput,
  HousingAcquisitionTaxResult,
  PriceTier,
  Won,
} from "./types";

const wonFormatter = new Intl.NumberFormat("ko-KR");

export function formatWon(value: Won): string {
  return `${wonFormatter.format(value)}원`;
}

/** 절사 전 raw 금액처럼 소수점이 남을 수 있는 값을 표시용으로 포맷한다(소수 둘째 자리까지). */
export function formatWonPrecise(value: number): string {
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`;
}

/** 세율을 퍼센트 문자열로 표시한다. 세율 자체(fraction)를 반올림하지 않고 표시만 담당한다. */
export function formatPercent(rate: number): string {
  return `${(rate * 100).toLocaleString("ko-KR", { maximumFractionDigits: 4 })}%`;
}

export function formatArea(value: number): string {
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}㎡`;
}

/**
 * 취득가액처럼 큰 원화 금액을 "7억 5,000만원"처럼 한글 단위로 환산해 보여준다. 자릿수(억/만원)
 * 오입력을 사용자가 입력 즉시 알아챌 수 있도록 돕는 **표시 전용 보조 텍스트**이며(UX/UI Critic
 * Q7 Medium), 계산에는 전혀 쓰이지 않는다 — 세율·경계값 판정과 무관하다.
 */
export function formatWonInKoreanUnits(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";

  const eok = Math.floor(value / 100_000_000);
  const man = Math.floor((value % 100_000_000) / 10_000);
  const won = Math.round(value % 10_000);

  const segments: string[] = [];
  if (eok > 0) segments.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man > 0) segments.push(`${man.toLocaleString("ko-KR")}만`);
  if (won > 0 || segments.length === 0) segments.push(`${won.toLocaleString("ko-KR")}`);

  return `${segments.join(" ")}원`;
}

export const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  low: "6억원 이하",
  mid: "6억원 초과 ~ 9억원 이하",
  high: "9억원 초과",
};

export const PRICE_TIER_LEGAL_BASIS: Record<PriceTier, string> = {
  low: "「지방세법」제11조제1항제8호가목",
  mid: "「지방세법」제11조제1항제8호나목",
  high: "「지방세법」제11조제1항제8호다목",
};

export const HOUSE_COUNT_LABELS: Record<HouseCountAfterAcquisition, string> = {
  1: "1채",
  2: "2채",
  3: "3채",
  4: "4채 이상",
};

/** 계산 근거 화면에서 "어떤 조합에서 이 세율이 나왔는지"를 일상어 한 문장으로 설명한다. */
export function describeAppliedRateBasis(
  input: HousingAcquisitionTaxFormInput,
  result: HousingAcquisitionTaxResult,
): string {
  const areaLabel = input.isAdjustmentTargetArea ? "규제지역(조정대상지역)" : "비규제지역";
  const houseLabel = HOUSE_COUNT_LABELS[input.houseCountAfterAcquisition];

  if (!result.isHeavyRateApplied) {
    return `${areaLabel} · 이 집을 포함해 ${houseLabel} 보유 → 다주택자 중과 대상이 아니라 표준세율을 그대로 적용합니다.`;
  }
  return `${areaLabel} · 이 집을 포함해 ${houseLabel} 보유 → 다주택자 중과세율 ${formatPercent(result.appliedRate)}가 적용됩니다.`;
}

export interface TaxBreakdownRow {
  label: string;
  legalBasis: string;
  expression: string;
}

/**
 * "계산 근거" SectionCard의 세목별(취득세/지방교육세/농어촌특별세) raw→절사 과정을 조립한다.
 * ARCHITECTURE.md "9.1"이 요구하는 "세목별 raw→절사 과정(실제 대입값)"에 대응한다.
 */
export function buildTaxCalculationBreakdown(
  input: HousingAcquisitionTaxFormInput,
  result: HousingAcquisitionTaxResult,
): TaxBreakdownRow[] {
  // logic.ts가 실제로 사용한 것과 동일한 두 값(acquisitionPrice, appliedRate)을 다시 곱해
  // 절사 전 raw를 재현한다(위 파일 상단 주석 참고 — 세율을 다시 판정하지 않는다).
  const acquisitionTaxRaw = input.acquisitionPrice * result.appliedRate;

  const rows: TaxBreakdownRow[] = [
    {
      label: "취득세",
      legalBasis: result.isHeavyRateApplied
        ? "「지방세법」제13조의2"
        : PRICE_TIER_LEGAL_BASIS[result.priceTier],
      expression:
        `${formatWon(input.acquisitionPrice)} × ${formatPercent(result.appliedRate)} = ` +
        `${formatWonPrecise(acquisitionTaxRaw)}(절사 전) → 10원 미만 절사 → ${formatWon(result.acquisitionTax)}`,
    },
  ];

  if (result.isHeavyRateApplied) {
    const localEducationTaxRaw =
      input.acquisitionPrice * POLICY.localEducationTax.heavyRateFixedFactor;
    rows.push({
      label: "지방교육세",
      legalBasis: "「지방세법」제151조제1항제1호(중과세율 케이스, 세율과 무관하게 0.4% 고정)",
      expression:
        `${formatWon(input.acquisitionPrice)} × 0.4% = ${formatWonPrecise(localEducationTaxRaw)}(절사 전) → ` +
        `10원 미만 절사 → ${formatWon(result.localEducationTax)}`,
    });
  } else {
    const localEducationTaxRaw =
      acquisitionTaxRaw * POLICY.localEducationTax.standardRateFactor;
    rows.push({
      label: "지방교육세",
      legalBasis: "「지방세법」제151조제1항제1호(표준세율 케이스, 취득세액의 10%)",
      expression:
        `취득세(절사 전) ${formatWonPrecise(acquisitionTaxRaw)} × 10% = ${formatWonPrecise(localEducationTaxRaw)}(절사 전) → ` +
        `10원 미만 절사 → ${formatWon(result.localEducationTax)}`,
    });
  }

  if (result.isRuralSpecialTaxExempt) {
    rows.push({
      label: "농어촌특별세",
      legalBasis: "「농어촌특별세법」제4조(비과세)",
      expression: "전용면적 85㎡ 이하 — 국민주택규모 비과세 요건 충족, 0원",
    });
  } else {
    const ruralRateFactor = !result.isHeavyRateApplied
      ? POLICY.ruralSpecialTax.standardRateFactor
      : result.appliedRate === 0.08
        ? POLICY.ruralSpecialTax.heavy8PercentFactor
        : POLICY.ruralSpecialTax.heavy12PercentFactor;
    const ruralSpecialTaxRaw = input.acquisitionPrice * ruralRateFactor;
    rows.push({
      label: "농어촌특별세",
      legalBasis: "「농어촌특별세법」제5조제1항제6호",
      expression:
        `${formatWon(input.acquisitionPrice)} × ${formatPercent(ruralRateFactor)} = ${formatWonPrecise(ruralSpecialTaxRaw)}(절사 전) → ` +
        `10원 미만 절사 → ${formatWon(result.ruralSpecialTax)}`,
    });
  }

  return rows;
}
