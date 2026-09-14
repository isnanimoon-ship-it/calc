/**
 * 주택 취득세 계산기 — 타입 스캐폴딩만 담당한다 (Architect 산출물).
 * 계산 구현은 logic.ts, 검증은 validation.ts, 표시 포맷팅은 formatting.ts, UI는 ui.tsx —
 * 모두 Builder 단계에서 이 폴더에 추가된다 (docs/ARCHITECTURE.md "계산 로직 / UI 분리" 참고).
 *
 * 필드 정의는 tasks/housing-acquisition-tax/FORMULA.md의 "입력값" / "출력값" 표를 그대로
 * 반영한다. 이 계산기는 severance-pay/unemployment-benefit/national-pension-benefit-estimate와
 * 달리 "지급대상 아님" 같은 판별 유니온이 필요 없다 — 입력이 검증을 통과하면 항상 세액이
 * 계산된다(대상 자체가 없는 경우는 validation.ts가 걸러내고 결과 자체를 만들지 않는다).
 *
 * **중요 — Builder/Calculation Auditor에게(tasks/housing-acquisition-tax/ARCHITECTURE.md
 * 필독)**:
 * 1. "1. 입력 설계 재검토" — `houseCountAfterAcquisition`은 SPEC.md 예시(3구간)가 아니라
 *    **4구간(1/2/3/4채 이상)으로 확정**했다. 이 유니온 타입이 그 강제 장치다.
 * 2. "2. FORMULA.md 내부 정합성 이슈" — 6~9억 구간 세율의 "소수점 넷째자리 반올림"은
 *    **세율을 소수(예 0.0133)로 나타낸 값 자체를 반올림**해야 한다(FORMULA.md 프로즈 예시
 *    문구 "1.6667%"를 그대로 믿고 퍼센트 표기 단계에서 반올림하면 Golden Test와 어긋난다).
 * 3. "6." — 10원 미만 절사(내림)는 FORMULA.md 스스로 "확인 필요"로 남긴 잠정 정책이다.
 *    `acquisitionTax`/`localEducationTax`/`ruralSpecialTax`는 이미 절사된 표시값만 담고,
 *    절사 전 raw 값은 이 타입에 노출하지 않는다(national-pension-benefit-estimate 선례와
 *    동일 — raw는 logic.ts 내부 변수로만 존재).
 */

/** 원(₩) 단위 정수 금액. */
export type Won = number;

/** 무차원 소수 세율. 예: 0.01 = 1%, 0.08 = 8%. */
export type Rate = number;

/** 가격 구간 판정 결과. FORMULA.md "1. 주택 유상취득 표준세율" 표 그대로. */
export type PriceTier = "low" | "mid" | "high";

/**
 * 취득 후 보유하게 되는 주택 수 구간.
 *
 * **4구간으로 확정한다(ARCHITECTURE.md "1. 입력 설계 재검토").** SPEC.md Must Have는
 * "예: 1채/2채/3채 이상"이라는 3구간 예시를 들었으나, FORMULA.md가 확정한 중과세율표는
 * 비조정대상지역에서 3주택(8%)과 4주택 이상(12%)의 세율이 다르다 — "3채 이상"으로 뭉뚱그리면
 * 이 두 세율을 구분할 수 없어 세액이 최대 수천만원 단위로 틀린다(FORMULA.md 검증 예제 13,
 * 5억원 주택 기준 8% vs 12% 차이 22,000,000원). SPEC.md 원문이 "예:"로 시작하는 예시였다는
 * 점, 그리고 이 항목이 SPEC.md 자신이 Must Have로 못박은 핵심 가치("다주택자·조정대상지역
 * 중과세율 반영")를 정확히 구현하기 위해 반드시 필요한 구체화라는 점에서, Architect는 이를
 * 범위 변경이 아니라 정확도 교정으로 판단하고 4구간을 채택한다(이견 없음, Product Owner
 * 재검토로 넘기지 않는다 — 근거는 ARCHITECTURE.md "1." 참고).
 *
 * `4`는 "4채 이상"을 의미한다(그 이상 세분화하지 않음 — 5주택과 4주택은 세율이 동일하므로
 * 추가 구간이 필요 없다).
 */
export type HouseCountAfterAcquisition = 1 | 2 | 3 | 4;

/** 계산 폼 전체 입력 (FORMULA.md "입력값" 표 그대로). */
export interface HousingAcquisitionTaxFormInput {
  /** 취득가액(매매가), 원. */
  acquisitionPrice: Won;
  /** 전용면적, ㎡(소수 허용). 취득세율 자체에는 영향 없음 — 농특세 비과세 판정에만 사용. */
  exclusiveArea: number;
  /** 이 주택이 조정대상지역(규제지역)인지 여부. 사용자 자가 입력(자동 판정 없음). */
  isAdjustmentTargetArea: boolean;
  /** 이 집을 포함해 취득 후 보유하게 되는 주택 수. */
  houseCountAfterAcquisition: HouseCountAfterAcquisition;
}

/**
 * logic.ts(`calculateHousingAcquisitionTax`)의 반환 타입. FORMULA.md "출력값" 표 그대로.
 *
 * `acquisitionTax`/`localEducationTax`/`ruralSpecialTax`는 전부 **10원 미만 절사(내림) 후의
 * 표시값**이다 — 절사 전 raw 값(중간 계산 완전정밀도)은 이 타입에 노출하지 않고 logic.ts
 * 내부 변수로만 존재한다(national-pension-benefit-estimate의 `basicPensionMonthlyRaw` 비노출
 * 패턴과 동일). `totalTax`는 이 세 절사값의 합이며, 합계 자체를 다시 절사하지 않는다
 * (FORMULA.md "정밀도/반올림 정책" — 중간 절사 금지 원칙).
 */
export interface HousingAcquisitionTaxResult {
  /** 가격 구간 판정 결과. */
  priceTier: PriceTier;
  /**
   * 표준세율. 중과 대상 여부와 무관하게 **항상** 계산해 계산 근거 화면에 노출한다
   * (FORMULA.md "출력값" 표 — "중과 여부와 무관하게 항상 계산해 근거 화면에 표시").
   */
  standardRate: Rate;
  /** 조정대상지역×보유주택수 조합으로 판정된 다주택자 중과세율 적용 여부. */
  isHeavyRateApplied: boolean;
  /** 실제 적용된 취득세율. 중과 대상이면 0.08/0.12, 아니면 standardRate와 동일한 값. */
  appliedRate: Rate;
  /** 취득세액(원). 10원 미만 절사 후. */
  acquisitionTax: Won;
  /** 지방교육세액(원). 10원 미만 절사 후. */
  localEducationTax: Won;
  /** 농어촌특별세 비과세 여부(exclusiveArea <= 85). */
  isRuralSpecialTaxExempt: boolean;
  /** 농어촌특별세액(원). 비과세면 0, 아니면 10원 미만 절사 후. */
  ruralSpecialTax: Won;
  /** 총 납부액(원) = acquisitionTax + localEducationTax + ruralSpecialTax. */
  totalTax: Won;
}
