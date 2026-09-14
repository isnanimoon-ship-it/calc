/**
 * 연차수당 계산기 — 타입 스캐폴딩만 담당한다 (Architect 산출물).
 * 계산 구현은 logic.ts(+date-utils.ts), 검증은 validation.ts, 표시 포맷팅은 formatting.ts,
 * UI는 ui.tsx — 모두 Builder 단계에서 이 폴더에 추가된다
 * (docs/ARCHITECTURE.md "계산 로직 / UI 분리" 참고).
 *
 * 필드 정의는 tasks/annual-leave-allowance/FORMULA.md의 "입력값"/"출력값" 표를 그대로
 * 반영하되, FORMULA.md가 flat하게 나열한 출력값 표를 두 지점에서 구조로 재정리했다(값 자체는
 * 전혀 바뀌지 않는다 — tasks/annual-leave-allowance/ARCHITECTURE.md "3.", "4." 참고):
 *   1. `continuousServiceRegime`(3구간)을 판별 태그로 쓰는 discriminated union으로 결과를
 *      나눴다 — `loan-interest-calculator`의 `repaymentMethod` 판별 유니온(`RepaymentMethod`
 *      3종)과 동일한 이유다. 구간마다 의미 있는 breakdown 필드가 다르므로(1년 미만은
 *      `completedMonths`, 2년 이상은 `accrualBreakdown`, 1~2년차는 둘 다 없음) 하나의
 *      인터페이스에 optional 필드로 욱여넣지 않는다.
 *   2. `unusedLeaveAllowance`/`belowMinimumWageReference` 등 "1일 통상임금을 입력했을 때만
 *      의미 있는" 필드들을 `allowance?`/`minimumWageReference?` 두 개의 선택적 중첩 객체로
 *      묶었다 — `bmr-calculator`의 `tdee?: TdeeValue` 패턴과 동일한 근거다(판별 유니온으로
 *      결과 모양 전체를 또 나눌 만큼 두 경우의 구조가 다르지 않고, optional 객체가 더
 *      단순하고 정확하다).
 *
 * raw(반올림 전) 값은 이 타입에 노출하지 않는다 — `unusedLeaveAllowance`는 이미 원 단위로
 * 반올림된 최종 표시값이고, 절사 전 완전정밀도 곱은 logic.ts 내부 지역 변수로만 존재한다
 * (severance-pay의 최종 `severancePay`/national-pension-benefit-estimate의
 * `basicPensionMonthly`와 동일한 관례 — "raw는 타입에 노출하지 않는다").
 */

/** YYYY-MM-DD 형식의 달력 날짜 문자열. timezone 이동 문제를 피하기 위해 Date 대신 문자열로
 *  다룬다(docs/CALCULATOR_RULES.md "날짜 계산기" 참고, 실제 파싱/계산은 logic.ts/date-utils.ts
 *  담당). */
export type IsoDateString = string;

/** 원(₩) 단위 정수 금액. */
export type Won = number;

/**
 * 근속기간 3구간(FORMULA.md "연차 발생일수 정의"). 아래 판별 유니온의 태그로 쓴다.
 * - `UNDER_1YEAR`: 계속근로기간 1년 미만 — 개근한 달 수만큼 최대 11일.
 * - `YEAR_1_TO_2`: 1년 이상 2년 미만 — 11+15=26일 고정(근로기준법 제60조③ 삭제 효과,
 *   FORMULA.md "왜 구간 2에서만 26인가" 참고).
 * - `OVER_2YEARS`: 2년 이상 — `15 + floor((N-1)/2)`, 25일 상한.
 */
export type ContinuousServiceRegime =
  | "UNDER_1YEAR"
  | "YEAR_1_TO_2"
  | "OVER_2YEARS";

/**
 * logic.ts(순수 계산 함수)가 받는 입력. UI 폼의 "기본값 오늘"·"기본값 0" 같은 defaulting은
 * 이 경계 이전에 이미 끝나 있어야 하는 것과, 이 경계 이후에 logic.ts 내부에서 처리하는 것을
 * 필드별로 구분한다(아래 각 필드 주석 참고).
 *
 * `referenceDate`가 optional이 아닌 이유: `military-discharge-date` Architect 라운드가 세운
 * "현재 날짜를 순수 계산 함수에서 직접 읽지 않고 입력으로 전달한다"(docs/ARCHITECTURE.md
 * "날짜 계산") 원칙을 그대로 따른다. "오늘"을 채워 넣는 지점은 ui.tsx의 폼 초기값(날짜
 * `<input>`의 초기 `value`)이며, logic.ts와 validation.ts는 `Date.now()`/`new Date()`를
 * 직접 호출하지 않는다 — Golden Test가 임의의 "오늘"을 주입해 결정적으로 재현할 수 있어야
 * 하기 때문이다(예: FORMULA.md 검증 예제들은 모두 `referenceDate`를 구체적 날짜로 명시한다).
 */
export interface AnnualLeaveAllowanceInput {
  /** 입사일(계속근로 시작일). `referenceDate`보다 빠르거나 같아야 한다(validation.ts가 검증). */
  hireDate: IsoDateString;
  /**
   * 연차 산정 기준일. "오늘"을 기본값으로 채우는 것은 ui.tsx의 책임이다(위 인터페이스 주석
   * 참고) — 이 타입 경계에서는 항상 구체적인 날짜 문자열이다.
   */
  referenceDate: IsoDateString;
  /**
   * 이미 사용한 연차일수. 선택 입력 — 미입력 시 **logic.ts가 `?? 0`으로 처리**한다
   * (severance-pay의 `bonus12m?: Won` 관례와 동일하게, validation.ts가 미리 0으로 채워
   * 넘기지 않는다). 반차 등 0.5 단위 소수를 허용한다(정수로 제한하지 않음, FORMULA.md
   * "단위").
   */
  usedDays?: number;
  /**
   * 1일 통상임금(원). 미입력 시 금액 계산(FORMULA.md 5~6단계)을 생략한다 — SPEC.md "부분
   * 입력 허용". 이 필드의 존재 여부가 결과 타입의 `allowance`/`minimumWageReference` 두
   * 선택적 필드의 존재 여부를 그대로 결정한다(logic.ts는 `input.ordinaryDailyWage != null`
   * 한 곳만 분기하면 된다).
   */
  ordinaryDailyWage?: Won;
}

/**
 * (Should Have) `OVER_2YEARS` 구간의 가산 연차 상세.
 * FORMULA.md "계산 순서" 7단계: `"근속 {N}년차 → 기본 15일 + 가산 {floor((N-1)/2)}일 =
 * 총 {yearlyGrant(N)}일{25일 상한 적용 시 문구 추가}"`. `{N}`은 이 인터페이스에 중복해서
 * 담지 않는다 — 판별 유니온의 형제 필드인 `completedYears`(base, 아래)가 이미 그 값이므로,
 * 두 필드가 서로 어긋날 여지를 원천 차단한다(단일 진실 공급원).
 */
export interface AccrualBreakdownDetail {
  /**
   * 기본 일수. 근로기준법 제60조①. 항상 15로 고정된 리터럴 타입 — 값이 아니라 "이 필드가
   * 가리키는 것이 법정 기본값임"을 타입 레벨에서도 드러낸다.
   */
  baseDays: 15;
  /** 가산일수 = `floor((completedYears - 1) / 2)`. 근로기준법 제60조④. */
  addedDays: number;
  /** 25일 상한 적용 **전** 합계 = `baseDays + addedDays`. */
  rawTotalDays: number;
  /**
   * 25일 상한이 실제로 이 값을 깎았는지(`rawTotalDays > 25`) — "상한 적용" 문구 노출 조건.
   * 상한 적용 후 최종값은 이 객체가 아니라 판별 유니온 형제 필드인 base의 `accruedDays`다
   * (중복 필드를 만들지 않는다).
   */
  cappedAtMax: boolean;
}

/**
 * (Should Have) 최저임금 환산 참고 경고 상세. 아래 base의 `minimumWageReference?` 필드
 * 주석이 설명하는 두 조건을 모두 만족할 때만 존재한다.
 */
export interface MinimumWageReferenceDetail {
  /** 이 참고값 산출에 적용된 연도(= `referenceDate`의 연도). */
  year: number;
  /**
   * 해당 연도 최저임금 시급 × 소정근로시간(원/일). `rates-{year}.json`의
   * `minimumWage.hourly.value` × `laborStandards.statutoryDailyHours.value`
   * (FORMULA.md "계산 순서" 6단계, 두 필드 모두 weekly-holiday-allowance Architect 라운드가
   * 이미 도입한 기존 최상위 필드를 그대로 재사용한다 — 신규 정책 데이터 아님).
   */
  dailyReferenceAmount: Won;
  /** `ordinaryDailyWage < dailyReferenceAmount`. FORMULA.md `belowMinimumWageReference`. */
  belowMinimumWageReference: boolean;
}

/** `ordinaryDailyWage`를 입력했을 때만 존재하는 금액 계산 결과(FORMULA.md 5단계). */
export interface UnusedLeaveAllowanceDetail {
  /**
   * 입력된 1일 통상임금(원) — breakdown 문장("미사용일수 × 1일 통상임금 = 미사용
   * 연차수당")을 이 객체 하나만으로 조립할 수 있도록 에코한다(별도로 최상위 입력을 다시
   * 참조하지 않아도 되게 하기 위함 — bmr-calculator의 `input` 에코와 같은 자기완결성
   * 근거).
   */
  ordinaryDailyWage: Won;
  /**
   * = `round(unusedDays × ordinaryDailyWage)`, 원 단위 사사오입 최종 1회
   * (FORMULA.md `unusedLeaveAllowance`, "정밀도/반올림 정책"). 절사 전 완전정밀도 곱은 이
   * 타입에 노출하지 않고 logic.ts 내부 지역 변수로만 존재한다.
   */
  unusedLeaveAllowance: Won;
}

/**
 * 세 구간이 공통으로 갖는 필드. `loan-interest-calculator`의 `LoanCalculationBase`와 같은
 * 목적(교차 타입으로 합성해 반복을 줄임)이라 이 인터페이스 자체는 export하지 않고 아래
 * 판별 유니온 구성에만 쓴다.
 */
interface AnnualLeaveAllowanceBase {
  /**
   * `hireDate`~`referenceDate` 사이 완료된 근속연수(anniversary 비교, 정수). 구간과 무관하게
   * 항상 계산된다 — `UNDER_1YEAR`면 0, `YEAR_1_TO_2`면 1, `OVER_2YEARS`면 2 이상.
   */
  completedYears: number;
  /** 연차 발생일수. 항상 정수, 반올림 대상이 아니다(FORMULA.md "단위"). */
  accruedDays: number;
  /**
   * 이미 사용한 연차일수(해석된 값 — 미입력 시 0). 원시 입력을 그대로 옮기는 것이 아니라
   * "기본값이 이미 적용된" 값을 에코한다(national-pension-benefit-estimate의
   * `earlyOrDeferredMonths` 에코와 같은 근거) — breakdown 문장("발생일수 - 사용일수 =
   * 미사용일수")을 이 결과 하나만으로 조립할 수 있게 하기 위함이다.
   */
  usedDays: number;
  /** = `max(accruedDays - usedDays, 0)`. `usedDays`가 소수(반차)면 그대로 소수일 수 있다. */
  unusedDays: number;
  /** `usedDays > accruedDays` 여부(안내 문구 노출용). FORMULA.md `usedMoreThanAccruedWarning`. */
  usedMoreThanAccruedWarning: boolean;
  /**
   * `ordinaryDailyWage`를 입력한 경우에만 존재한다. `undefined`면 "부분 입력"(발생일수·
   * 미사용일수까지만 결과로 제시, SPEC.md Must Have "부분 입력 허용") — 핵심 결과 카드가
   * 무엇을 보여줄지도 이 필드의 존재 여부로 그대로 갈린다.
   */
  allowance?: UnusedLeaveAllowanceDetail;
  /**
   * (Should Have) `ordinaryDailyWage`가 입력됐고, **그리고** `referenceDate` 연도의
   * 최저임금 데이터(`rates-{year}.json`)가 존재할 때만 존재한다. 두 조건 중 하나라도
   * 아니면 `undefined`다 — "1일 통상임금을 안 입력해 애초에 판정 대상이 아님"과 "판정하고
   * 싶었지만 그 연도 데이터가 아직 없음"을 타입 레벨에서 구분하지 않고 둘 다 "이 참고
   * 경고는 표시하지 않는다"로 처리한다.
   *
   * 이 계산기는 severance-pay/unemployment-benefit이 확립한 "연도 데이터가 없으면
   * 에러를 던진다"(`RATES_BY_YEAR` 조회 실패 시 throw) 정책을 **이 필드에 한해 의도적으로
   * 따르지 않는다** — `referenceDate`는 SPEC.md에 따라 과거/미래 임의 시점을 자유롭게
   * 조회할 수 있어야 하는 핵심(Must Have) 입력인 반면, 최저임금 참고 경고는 그중 완전히
   * 독립적인 Should Have 비차단 안내에 불과하다. `referenceDate`가 rates 데이터가 아직
   * 없는 연도(예: 먼 미래)를 가리킨다는 이유로 core 계산(accruedDays 등)까지 막으면 안 된다
   * (tasks/annual-leave-allowance/ARCHITECTURE.md "6." 참고).
   */
  minimumWageReference?: MinimumWageReferenceDetail;
}

/**
 * logic.ts(`calculateAnnualLeaveAllowance`)의 반환 타입. `continuousServiceRegime`을 판별
 * 태그로 쓰는 3-way discriminated union이다(`loan-interest-calculator`의 `repaymentMethod`
 * 판별 유니온과 동일한 패턴) — 구간마다 의미 있는 breakdown 필드가 다르므로(1년 미만은
 * `completedMonths`, 2년 이상은 `accrualBreakdown`, 1~2년차는 둘 다 없음) 하나의
 * 인터페이스에 optional 필드로 욱여넣지 않는다.
 *
 * severance-pay/unemployment-benefit/national-pension-benefit-estimate와 달리 "지급대상
 * 아님"에 준하는 ineligible 분기가 없다 — `housing-acquisition-tax`와 같은 이유로, 이
 * 계산기는 입력이 검증(validation.ts)을 통과하면 항상 발생일수 이상을 계산할 수 있다.
 * `hireDate > referenceDate` 같은 입력 순서 오류는 결과 타입의 분기가 아니라
 * validation.ts가 결과 자체를 만들지 않고 막는다(FORMULA.md "예외", severance-pay의
 * `retireDate > hireDate` 검증과 동일한 배치).
 */
export type AnnualLeaveAllowanceResult =
  | (AnnualLeaveAllowanceBase & {
      continuousServiceRegime: "UNDER_1YEAR";
      /**
       * `hireDate`~`referenceDate` 사이 완료된 개월수(anniversary-of-month 비교, 0~11).
       * 이 구간에서만 의미가 있다(FORMULA.md "출력값" 표: "UNDER_1YEAR 구간에서만 의미
       * 있음").
       */
      completedMonths: number;
    })
  | (AnnualLeaveAllowanceBase & {
      continuousServiceRegime: "YEAR_1_TO_2";
      /**
       * 항상 26(11+15 고정, 근로기준법 제60조③ 삭제 효과) — 리터럴 타입으로 이 불변식을
       * 타입 레벨에서도 강제한다. 이 구간은 "1년 미만 최대 11일 + 1년 시점 15일"이라는
       * 법정 상수 두 개의 합일 뿐 조건부 분기가 없어(FORMULA.md "왜 구간 2에서만 26인가"),
       * `OVER_2YEARS`의 `accrualBreakdown`과 달리 별도 구조화 필드가 필요 없다 —
       * severance-pay가 30(제8조)/365 같은 법정 상수를 타입 필드가 아니라 화면 문구에 직접
       * 쓰는 것과 같은 이유(tasks/annual-leave-allowance/ARCHITECTURE.md "2.3" 참고).
       */
      accruedDays: 26;
    })
  | (AnnualLeaveAllowanceBase & {
      continuousServiceRegime: "OVER_2YEARS";
      /** 가산 연차 상세(Should Have). */
      accrualBreakdown: AccrualBreakdownDetail;
    });
