/**
 * 국민연금 예상수령액 계산기 — 타입 스캐폴딩만 담당한다 (Architect 산출물).
 * 계산 구현은 logic.ts, 검증은 validation.ts, 표시 포맷팅은 formatting.ts, UI는 ui.tsx —
 * 모두 Builder 단계에서 이 폴더에 추가된다 (docs/ARCHITECTURE.md "계산 로직 / UI 분리" 참고).
 *
 * 필드 정의는 tasks/national-pension-benefit-estimate/FORMULA.md의 "입력값" / "출력값" 표를
 * 그대로 반영한다. severance-pay/unemployment-benefit과 동일한 패턴(discriminated union으로
 * "지급대상 아님"을 타입 레벨에서 분리)을 따르되, 이 계산기는 **수급개시연령 판정이 최소
 * 가입기간 충족 여부와 무관하게 항상 수행된다**는 FORMULA.md "계산 순서" 2번 규칙 때문에
 * severance-pay/unemployment-benefit의 ineligible 타입(필드가 거의 없음)과 달리
 * `pensionableAge`/`pensionableYear`를 ineligible 결과에도 포함한다 — 아래
 * `NationalPensionBenefitIneligibleResult` 참고. tasks/national-pension-benefit-estimate/
 * ARCHITECTURE.md "9. 최소 가입기간 미달 시 결과 타입" 참고.
 *
 * **중요 — Calculation Auditor에게**: 이 계산기는 tasks/national-pension-benefit-estimate/
 * FORMULA.md가 "이 항목이 해소되기 전에는 이 계산기를 published 상태로 전환하지 않는다"고
 * 명시한 게이트(÷12 단계·최종 반올림 정책의 nps.or.kr 라이브 계산기 대조, "확인 필요 목록" 1번)를
 * 갖고 있다. Builder 구현 완료 후에도 이 게이트가 해소됐는지 반드시 확인할 것 —
 * tasks/national-pension-benefit-estimate/ARCHITECTURE.md "1. PUBLISHED 전환 게이트" 참고.
 */

/** 원(₩) 단위 정수 금액. */
export type Won = number;

/**
 * 계산 폼 전체 입력(FORMULA.md "입력값" 표 그대로).
 * `earlyOrDeferredMonths`는 UI에서 자유 숫자 입력이 아니라 "그대로/N년 앞당김/N년 늦춤" 선택형
 * 컨트롤로 받을 것을 FORMULA.md·ARCHITECTURE.md가 권고한다(값 자체는 -60~60 사이 12의 배수
 * 11개 중 하나가 되지만, 타입 레벨에서 리터럴 유니온으로 강제하지는 않는다 — FORMULA.md
 * "예외"가 이 범위를 벗어나는 임의 정수 입력 자체는 유효한 입력 오류 케이스로 별도 취급하므로,
 * 검증은 validation.ts가 담당하고 이 타입은 `number`로 넓게 받는다).
 */
export interface NationalPensionBenefitFormInput {
  /** 출생연도(연도만, 생년월일 아님 — FORMULA.md "설계 결정: 출생연도만 받는다" 참고). */
  birthYear: number;
  /** 총 가입기간(이미 납부 + 납부 예정 합산), 개월. */
  totalContributionMonths: number;
  /** 평균 월소득 근사치(B값 근사 입력), 원. */
  averageMonthlyIncome: Won;
  /**
   * 조기(-)/연기(+) 개월수. 기본값 0(법정 수급개시연령 그대로).
   * `-60 <= n <= 60`, 검증은 validation.ts.
   */
  earlyOrDeferredMonths: number;
}

/**
 * 노령연금 법정 최소 가입기간(120개월) 미충족 결과.
 *
 * severance-pay/unemployment-benefit의 ineligible 타입과 달리 `pensionableAge`/
 * `pensionableYear`를 포함한다 — FORMULA.md "계산 순서" 2번이 "이 판정은 최소 가입기간
 * 충족 여부와 무관하게 항상 수행"하도록 명시했기 때문이다(SPEC.md "수급개시연령은 기본연금액
 * 계산과 무관한 독립 판정"). 반면 금액 관련 필드(aValue, basicPensionMonthly 등)는 전혀
 * 포함하지 않는다 — "지급대상 아님" 안내만 표시하고 금액 계산 자체를 수행하지 않는다는
 * SPEC.md/FORMULA.md 규칙을 타입 레벨에서 강제한다.
 */
export interface NationalPensionBenefitIneligibleResult {
  eligible: false;
  /** 법정 수급개시연령(세). 최소 가입기간 미충족과 무관하게 항상 계산된다. */
  pensionableAge: number;
  /** 수급개시연도(참고) = birthYear + pensionableAge. */
  pensionableYear: number;
  /** 노령연금 법정 최소 가입기간(개월). 안내 문구("최소 120개월 필요")에 사용, rates에서 조회. */
  minEligibleMonths: number;
  /** 사용자가 입력한 총 가입기간(개월) 에코 — 안내 문구("입력하신 가입기간은 N개월입니다")용. */
  totalContributionMonths: number;
}

export interface NationalPensionBenefitEligibleResult {
  eligible: true;
  /** 법정 수급개시연령(세). */
  pensionableAge: number;
  /** 수급개시연도(참고) = birthYear + pensionableAge. */
  pensionableYear: number;
  /** 적용된 A값(원, 계산 시점 최신 고시치, rates에서 조회). */
  aValue: Won;
  /** 적용된 B값 근사치(clamp 후, 원). */
  bValueApprox: Won;
  /** `averageMonthlyIncome`이 기준소득월액 상·하한 밖이라 clamp가 발생했는지 여부. */
  bValueClamped: boolean;
  /** 적용된 비례상수(무차원, 계산 시점 최신 고시치, rates에서 조회). */
  proportionalConstant: number;
  /** 가입기간 보정계수(무차원). 240개월 이하는 비례, 초과는 가산. */
  contributionAdjustmentFactor: number;
  /**
   * 기본연금액(법정 수급개시연령 기준 월액, 세전, 현재가치). 10원 미만 절사(내림) 1회
   * 적용된 표시값 — FORMULA.md "정밀도/반올림 정책"(2026-09-13 정정, nps.or.kr 라이브
   * 계산기 21/21 실증 대조 근거)에 따라 이 절사된 값은 `adjustedPensionMonthly` 계산에
   * 재사용되지 않는다(logic.ts 내부에서 완전정밀도 값을 별도로 유지해 조기/연기 조정에 쓴다 —
   * 이 타입에는 그 완전정밀도 값을 노출하지 않는다, 필요시 breakdown 필드로 별도 검토).
   */
  basicPensionMonthly: Won;
  /** 사용자가 입력한 조기/연기 개월수 에코(기본 0). */
  earlyOrDeferredMonths: number;
  /**
   * 조기/연기 조정률. `earlyOrDeferredMonths === 0`이면 undefined(조정 자체가 없음 — UI가
   * "조기/연기 반영 금액" 카드를 아예 렌더링하지 않는 판단 기준으로 쓴다).
   * 조기: 음수(최대 -0.30), 연기: 양수(최대 +0.36).
   */
  earlyOrDeferredAdjustmentRate?: number;
  /**
   * 조기/연기 반영 후 월 예상연금액(원). `earlyOrDeferredMonths === 0`이면 undefined —
   * `basicPensionMonthly`와 별도로 완전정밀도 기본연금액에서 독립적으로 10원 미만 절사한
   * 값이다(FORMULA.md "계산 순서" 9번, 두 절사는 서로의 계산에 재사용되지 않는다). 이
   * 절사 규칙이 조기/연기 조정값에도 그대로 적용되는지는 라이브로 직접 검증되지 않은
   * 합리적 추정이다(FORMULA.md "7.", "정밀도/반올림 정책" 참고).
   */
  adjustedPensionMonthly?: Won;
}

/**
 * logic.ts(`calculateNationalPensionBenefit`)의 반환 타입. severance-pay의
 * `SeverancePayResult`와 같은 discriminated union 패턴이되, 위에서 설명한 대로
 * `pensionableAge`/`pensionableYear`는 양쪽 분기에 공통으로 존재한다.
 */
export type NationalPensionBenefitResult =
  | NationalPensionBenefitIneligibleResult
  | NationalPensionBenefitEligibleResult;
