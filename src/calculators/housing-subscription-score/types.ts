/**
 * 청약가점 계산기 타입 — tasks/housing-subscription-score/FORMULA.md 기준.
 *
 * Architect 스캐폴딩 단계(tasks/housing-subscription-score/ARCHITECTURE.md "5. 타입 결정"
 * 참고). 계산 공식·검증 로직은 여기 없다 — Builder가 `logic.ts`/`validation.ts`에서
 * 이 타입만 참조해 구현한다.
 */

/** 주택 소유 이력. FORMULA.md "입력값" 표 그대로. */
export type HousingStatus = "never_owned" | "disposed" | "currently_owns";

/**
 * 무주택기간 산정이 시작되지 않거나 중단된 사유. FORMULA.md "예외" 절의 두 조건은
 * 서로 배타적이지 않다(예: 만 30세 미만 미혼이면서 동시에 현재 주택을 소유 중일 수 있음)
 * — 그래서 단일 nullable 값이 아니라 `HousingSubscriptionScoreResult.homelessIneligibleReasons`
 * 배열로 표현한다(0개면 산정 정상 진행).
 */
export type HomelessIneligibleReason = "underAgeUnmarried" | "currentlyOwns";

/**
 * 폼 입력. 조건부 필수 필드(`isMarried`/`housingStatus`/`hasSubscriptionAccount`에 종속)는
 * optional로 표시한다 — `parental-leave-benefit/types.ts`의 `BenefitInput` 선례(조건부
 * 필드에 `| null`이 아니라 `?`를 씀)를 그대로 따른다.
 */
export interface HousingSubscriptionScoreInput {
  /** 세 항목 모두의 산정 기준일. 기본값 오늘. */
  baseDate: string;
  birthDate: string;
  isMarried: boolean;
  /** `isMarried=true`일 때 필수. */
  marriageDate?: string;
  housingStatus: HousingStatus;
  /** `housingStatus === 'disposed'`일 때 필수. */
  mostRecentDisposalDate?: string;
  /**
   * 소형·저가주택 등 무주택 간주 특례(「주택공급에 관한 규칙」 제53조) 요건을 사용자가
   * 스스로 확인했다는 체크. `housingStatus === 'currently_owns'`일 때만 UI에 노출하고,
   * 그 외에는 항상 `false`로 고정한다. **점수 계산에는 반영하지 않는다**(FORMULA.md
   * "알려진 정책 특례" 1번) — logic.ts는 이 값을 읽지 않고, UI가 고지 문구를 조건부로
   * 보여줄 때만 참조한다.
   */
  smallLowValueHomeException: boolean;
  /** `isMarried=true`일 때만 의미 있음. 기본값은 `isMarried`와 동일. */
  hasQualifyingSpouseInHousehold: boolean;
  qualifyingAscendantCount: number;
  qualifyingDescendantCount: number;
  hasSubscriptionAccount: boolean;
  /** `hasSubscriptionAccount=true`일 때 필수. */
  subscriptionAccountOpenDate?: string;
}

/**
 * 순수 계산 결과. 숫자·플래그만 담고, 사람이 읽는 문장(계산 근거·경고 문구·정책 고지)은
 * 여기 넣지 않는다 — `weekly-holiday-allowance`가 확립한 경계(`meetsMinHoursRequirement`
 * 같은 boolean은 logic.ts, 문구 조립은 formatting.ts)를 그대로 따른다(ARCHITECTURE.md
 * "5. 타입 결정" 근거 참고). breakdown 문자열·경고 문자열은 Builder가 `formatting.ts`에
 * `(input, result) => BreakdownRow[] / string[]` 형태 함수로 추가한다.
 */
export interface HousingSubscriptionScoreResult {
  // ── 무주택기간 (상한 32점) ──────────────────────────────────────────
  /** 무주택기간 산정이 "시작된" 상태인지(만 30세 도달 또는 혼인 + 현재 무주택). */
  homelessEligible: boolean;
  /** eligible이면 항상 빈 배열. */
  homelessIneligibleReasons: HomelessIneligibleReason[];
  /**
   * 무주택기간 실제 기산일(ISO). `currentlyHomeless`가 false(현재 주택 소유 중)면 null.
   * 만 30세/혼인신고일에 아직 도달하지 않은 경우에도(= `homelessEligible=false`이지만
   * 현재는 무주택인 경우) Builder는 이 값을 참고용으로 채울지 null로 둘지 FORMULA.md
   * 3~4단계를 따라 결정한다(둘 다 "0점" 표시 결과는 동일).
   */
  homelessStartDate: string | null;
  /** 만 나이 방식 절사 연수. eligible=false면 0. */
  homelessPeriodYears: number;
  homelessPeriodScore: number;
  /** 15년 이상 도달로 32점 상한에 걸렸는지(참고 표시용). */
  homelessPeriodCapped: boolean;

  // ── 부양가족수 (상한 35점) ──────────────────────────────────────────
  dependentCount: number;
  dependentScore: number;
  /** 6명 초과 입력으로 35점 상한에 걸렸는지(참고 표시용). */
  dependentCountCapped: boolean;

  // ── 청약통장 가입기간 (상한 17점) ───────────────────────────────────
  /** 미가입(`hasSubscriptionAccount=false`)이면 0. */
  subscriptionPeriodMonths: number;
  /** `floor(subscriptionPeriodMonths / 12)` — 참고 표시용. */
  subscriptionPeriodYears: number;
  subscriptionPeriodScore: number;
  /** 15년(180개월) 이상 도달로 17점 상한에 걸렸는지(참고 표시용). */
  subscriptionPeriodCapped: boolean;

  // ── 합산 ────────────────────────────────────────────────────────────
  /** 항상 0~84 범위(공식 자체가 보장 — Golden Test로 불변식 고정, SPEC.md 완료 기준). */
  totalScore: number;
}
