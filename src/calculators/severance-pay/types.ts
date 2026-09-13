/**
 * 퇴직금 계산기 — 타입 스캐폴딩만 담당한다 (Architect 산출물).
 * 계산 구현은 logic.ts, 검증은 validation.ts, 표시 포맷팅은 formatting.ts, UI는 ui.tsx —
 * 모두 Builder 단계에서 이 폴더에 추가된다 (docs/ARCHITECTURE.md "계산 로직 / UI 분리" 참고).
 *
 * 필드 정의는 tasks/severance-pay/FORMULA.md의 "입력값" / "출력값" 표를 그대로 반영한다.
 * 이 타입들은 "원(₩) 단위 정수"라는 공개 경계(boundary) 단위를 쓴다 — 즉 logic.ts 내부에서
 * 어떤 정밀도 전략(전 단위 정수 스케일링 등, docs/ARCHITECTURE.md "숫자 정밀도 전략" 참고)을 쓰든
 * 이 입출력 타입 자체는 사용자가 이해하는 단위(원, 원/일, 일)로 유지한다.
 */

/** YYYY-MM-DD 형식의 달력 날짜 문자열. timezone 이동 문제를 피하기 위해 Date 대신 문자열로 다룬다
 *  (docs/CALCULATOR_RULES.md "날짜 계산기" 참고, 실제 파싱/계산은 logic.ts 담당). */
export type IsoDateString = string;

/** 원(₩) 단위 정수 금액. */
export type Won = number;

export interface SeverancePayInput {
  /** 입사일 (계속근로 시작일). retireDate보다 빨라야 한다. */
  hireDate: IsoDateString;
  /** 퇴사일 (근로관계 종료일, 마지막 근무일의 다음날 기준). hireDate보다 늦어야 한다. */
  retireDate: IsoDateString;
  /**
   * 4주 평균 1주간 소정근로시간(시간). 0 이상, 상한은 validation.ts에서 별도 결정(UX 재량,
   * FORMULA.md 예외 참고).
   *
   * (v2, FORMULA.md "주당 소정근로시간 기본값 정책") 필수 → **선택**으로 전환됐다. 실제 숫자를
   * 입력한 경우에만 그 값으로 15시간 기준을 판정하고, 미입력(undefined)이면 이 필드만으로는
   * 판정하지 않는다 — `underFifteenHoursDeclared`와 함께 3단계 우선순위로 판정한다(아래 필드,
   * FORMULA.md "판정 로직 (우선순위)" 참고). 특정 숫자(예: 40시간)를 임의 기본값으로 채워 넣는
   * 방식은 채택하지 않는다(근거 없는 추정값을 만들지 않기 위함, FORMULA.md 동일 절 참고).
   */
  weeklyScheduledHours?: number;
  /**
   * (v2 신규, FORMULA.md "주당 소정근로시간 기본값 정책") "주 15시간 미만 근로자입니다"
   * 자진신고 체크박스(또는 이에 준하는 명시적 토글)의 값. 기본값은 `false`로 간주한다
   * (미입력 시 undefined를 false와 동일하게 취급 — logic.ts/validation.ts 구현 시 이 기본값
   * 처리를 명시적으로 다뤄야 한다).
   *
   * 판정 우선순위(FORMULA.md "판정 로직" 1~3번, 로직 구현 자체는 logic.ts 몫):
   *   1. `true` → weeklyScheduledHours 입력 여부·값과 무관하게 즉시 미충족.
   *   2. `false`(또는 미입력)이고 weeklyScheduledHours에 실제 숫자가 입력됨 → 그 값으로
   *      `>= 15` 판정(종전과 동일).
   *   3. `false`(또는 미입력)이고 weeklyScheduledHours도 미입력 → 판정을 생략하고 충족으로
   *      간주.
   */
  underFifteenHoursDeclared?: boolean;
  /** 퇴사일 이전 3개월간 지급된 임금총액(원). 0 이상 정수. */
  wage3m: Won;
  /** 퇴사일 이전 12개월 상여금 총액(원). 선택 입력, 미입력 시 0으로 처리. */
  bonus12m?: Won;
  /** 퇴사일 이전 12개월 연차수당 총액(원). 선택 입력, 미입력 시 0으로 처리. */
  annualLeavePay12m?: Won;
  /** 1일 통상임금(원). 선택 입력 — 입력 시 평균임금과 비교해 더 큰 값을 기준임금으로 사용. */
  ordinaryDailyWage?: Won;
}

/**
 * (v2 신규) `insufficientWeeklyHours`가 어느 판정 경로로 true가 됐는지 구분하는 사유.
 * FORMULA.md "판정 로직 (우선순위)" 1~2번에 대응한다 — 두 경로 모두 "미충족"이라는 결론은
 * 같지만, UI가 서로 다른 안내 문구를 쓸 수 있도록(예: "자진신고하신 내용에 따라..." vs
 * "입력하신 주당 소정근로시간이 기준에 못 미쳐...") 구분해 둔다. 실제 문구 선택은 Builder 몫.
 * - `"declared"`: 사용자가 "주 15시간 미만 근로자입니다"를 직접 선택(자진신고, 우선순위 1번).
 *   `weeklyScheduledHours`에 어떤 값이 입력되어 있어도 이 사유가 우선한다.
 * - `"belowThreshold"`: `weeklyScheduledHours`에 실제 숫자가 입력됐고 그 값이 15시간 미만
 *   (우선순위 2번, 종전과 동일한 숫자 판정 경로).
 * 우선순위 3번(둘 다 미입력)은 "충족으로 간주"이므로 애초에 이 미충족 결과 자체가 생기지 않는다
 * — 따라서 이 유니온에 별도 케이스가 없다.
 */
export type WeeklyHoursIneligibleReason = "declared" | "belowThreshold";

/**
 * 지급요건(계속근로 1년 이상 & 주 15시간 이상, 근로자퇴직급여 보장법 제4조 제1항) 미충족 시
 * 금액 필드 없이 이 형태만 반환한다 — "지급대상 아님" 안내만 표시하고 계산 자체를 수행하지 않는다는
 * SPEC.md/FORMULA.md 규칙을 타입 레벨에서 강제한다 (eligible: false일 때 금액 필드에 접근할 수 없음).
 *
 * (2026-09-02 Optimizer 수정 — UX/UI Critic Medium M1 대응) 두 요건 중 어느 쪽이 미충족인지
 * UI가 구분해 안내할 수 있도록 사유 플래그를 추가한다. 계산 공식(FORMULA.md 1번 "지급요건 판정")
 * 자체는 바꾸지 않는다 — 이미 판정된 결과를 어떤 요건이 원인인지로 분해해 노출할 뿐이다.
 *
 * (v2 갱신, FORMULA.md "주당 소정근로시간 기본값 정책") `weeklyScheduledHours`가 필수 → 선택으로
 * 바뀌면서 "미충족"에 이르는 경로가 두 가지(자진신고 / 숫자 판정)로 늘었다 — 아래
 * `weeklyHoursIneligibleReason`으로 구분한다. "둘 다 미입력 → 충족 간주" 경로는 이 타입 자체가
 * 생성되지 않는 경로이므로 별도 필드가 필요 없다.
 */
export interface SeverancePayIneligibleResult {
  eligible: false;
  /** 계속근로기간 1년(365일) 이상 요건 미충족 여부. 근로자퇴직급여 보장법 제4조 제1항. */
  insufficientServicePeriod: boolean;
  /** 4주 평균 주당 소정근로시간 15시간 이상 요건 미충족 여부. 근로자퇴직급여 보장법 제4조 제1항. */
  insufficientWeeklyHours: boolean;
  /**
   * `insufficientWeeklyHours`가 true일 때만 채워진다(false면 undefined). 어느 우선순위
   * 경로로 미충족 판정이 내려졌는지 — 위 `WeeklyHoursIneligibleReason` 참고.
   */
  weeklyHoursIneligibleReason?: WeeklyHoursIneligibleReason;
}

export interface SeverancePayEligibleResult {
  eligible: true;
  /** 재직일수 = retireDate - hireDate (일). */
  totalServiceDays: number;
  /** 산정기간 총일수 = 퇴사일 이전 3개월의 달력일수 (89~92일). */
  baseDays: number;
  /** 상여금 가산액 = bonus12m × 3/12 (원, 내부는 전 단위 정밀도로 보존). */
  bonusAddition: number;
  /** 연차수당 가산액 = annualLeavePay12m × 3/12 (원, 내부는 전 단위 정밀도로 보존). */
  leavePayAddition: number;
  /**
   * 1일 평균임금 = ceil((wage3m + bonusAddition + leavePayAddition) / baseDays, 전 단위(0.01원)).
   * (2026-09-02 Formula Analyst 재검토로 정책 변경 — moel.go.kr 실제 소스코드 확인 기반)
   * 이 필드는 이미 전 단위(0.01원)에서 올림 확정된 값이다 — 화면 표시값이자 6~7단계
   * (기준임금 비교, 최종 곱셈)에 그대로 재사용되는 계산값이다(FORMULA.md "정밀도/반올림 정책"
   * 참고). 구 정책("완전정밀도 유지, 재사용 금지")은 폐기됐다.
   */
  averageDailyWage: number;
  /**
   * 기준임금 = max(averageDailyWage, ordinaryDailyWage ?? 0).
   * averageDailyWage가 이미 전 단위로 올림 확정된 값이므로, 이 필드도 올림 확정된 값이다.
   */
  baseDailyWage: number;
  /** 퇴직금(최종) = baseDailyWage × 30 × (totalServiceDays / 365), 원 단위 반올림(사사오입). */
  severancePay: Won;
}

export type SeverancePayResult =
  | SeverancePayIneligibleResult
  | SeverancePayEligibleResult;
