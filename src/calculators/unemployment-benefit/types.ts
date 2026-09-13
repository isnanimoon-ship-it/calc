/**
 * 실업급여(구직급여) 계산기 — 타입 스캐폴딩만 담당한다 (Architect 산출물).
 * 계산 구현은 logic.ts, 검증은 validation.ts, 표시 포맷팅은 formatting.ts, UI는 ui.tsx —
 * 모두 Builder 단계에서 이 폴더에 추가된다 (docs/ARCHITECTURE.md "계산 로직 / UI 분리" 참고).
 *
 * 필드 정의는 tasks/unemployment-benefit/FORMULA.md의 "입력값" / "출력값" 표를 그대로
 * 반영한다. severance-pay/types.ts와 동일한 패턴(discriminated union으로 "지급대상 아님"을
 * 타입 레벨에서 분리)을 그대로 따른다.
 *
 * (2026-09-02 Optimizer 수정 — SPEC.md v2 대응) v1은 "자격 미충족"이 체크박스 미확인
 * (`voluntaryLeaveAcknowledged=false`, UI 게이팅)과 계산 결과 판정(`insuredPeriodDays < 180`)
 * 두 갈래로 갈렸었다. SPEC.md v2가 체크박스 게이팅 자체를 제거함에 따라(설계상 핵심 결정 참고),
 * 이제는 severance-pay와 동일하게 "계산 결과가 판정하는 단일 미충족 상태"만 남는다 — 판별
 * 유니온도 그에 맞춰 단순화했다.
 *
 * 이 타입들은 "원(₩) 단위 정수 / 일(day) 단위 정수"라는 공개 경계(boundary) 단위를 쓴다 —
 * logic.ts 내부에서 어떤 정밀도 전략을 쓰든(docs/ARCHITECTURE.md "숫자 정밀도 전략" 참고,
 * 이 계산기는 severance-pay와 달리 전 단위 스케일링이 필요 없다고 판단했다 — 아래
 * "숫자 정밀도 전략" 절 참고) 이 입출력 타입 자체는 사용자가 이해하는 단위로 유지한다.
 */

/** YYYY-MM-DD 형식의 달력 날짜 문자열. timezone 이동 문제를 피하기 위해 Date 대신 문자열로 다룬다
 *  (docs/CALCULATOR_RULES.md "날짜 계산기" 참고, 실제 파싱/계산은 logic.ts 담당). */
export type IsoDateString = string;

/** 원(₩) 단위 정수 금액. */
export type Won = number;

/**
 * 소정급여일수 표(고용보험법 제50조제1항, 별표1) 조회에 쓰이는 연령 구간.
 * FORMULA.md "출력값" 표의 `ageBandForTable`, "공식" 7단계를 문자열 리터럴 유니온으로
 * 강타입화했다 — 두 값 중 하나만 허용해 오탈자·불일치를 컴파일 타임에 막는다.
 */
export type UnemploymentBenefitAgeBand = "50세 미만" | "50세 이상 및 장애인";

/**
 * 소정급여일수 표 조회에 쓰이는 가입기간(피보험기간) 구간. FORMULA.md "소정급여일수 표"의
 * 5개 행과 1:1 대응한다. `rates-{year}.json`의 `unemploymentBenefit.benefitDaysTable.rows`도
 * 같은 5구간 구조를 쓴다(순서·경계값의 단일 진실 공급원은 데이터 파일 쪽이고, 이 유니온은
 * 그 결과를 타입으로 표현할 뿐이다).
 */
export type UnemploymentBenefitInsuredPeriodBand =
  | "1년 미만"
  | "1년 이상 3년 미만"
  | "3년 이상 5년 미만"
  | "5년 이상 10년 미만"
  | "10년 이상";

/**
 * 계산 폼 전체 입력.
 *
 * (2026-09-02 Optimizer 수정 — SPEC.md v2 대응) v1에 있던 `voluntaryLeaveAcknowledged`(체크박스
 * UI 게이팅 전용 필드)와 `leaveReasonCategory`(이직사유 세부 유형 선택 입력)는 SPEC.md v2
 * "설계상 핵심 결정"·"범위 밖 > 이직사유 선택 입력(v2 갱신, 제거됨)"에 따라 완전히 제거됐다 —
 * 계산 로직(`calculateUnemploymentBenefit`, logic.ts)은 애초에 이 두 필드를 받지 않았으므로
 * 계산 결과는 이 변경으로 전혀 달라지지 않는다. 어떤 사유가 비자발적 이직에 해당하는지는 더 이상
 * 사용자가 고르는 입력이 아니라, 정책 안내 섹션의 설명형 텍스트로만 제공한다(ui.tsx 참고).
 */
export interface UnemploymentBenefitFormInput {
  /** 현재(퇴사일 기준) 만 나이. "만 나이 통일법" 기준(FORMULA.md "입력값" 표 참고). */
  ageAtLeave: number;
  /** 퇴사일(근로관계 종료일). */
  leaveDate: IsoDateString;
  /**
   * 입사일(퇴사일 기준 연속 고용보험 가입 시작일).
   *
   * (2026-09-02 Optimizer 수정 — UX/UI Critic High 대응) FORMULA.md "입력값" 표는 "입사일
   * ~퇴사일" 또는 "총 가입기간 직접 입력" 중 하나를 Architect/Builder 재량으로 선택하도록
   * 명시적으로 위임했다. 종전에는 후자(누적 일수를 사용자가 직접 암산해 입력)를 택했는데,
   * severance-pay(`hireDate`/`retireDate` → 재직일수 자동 계산)와 다른 패턴이었고, 사용자가
   * "4년 3개월"을 "1,551일"로 스스로 환산하다 오차를 만들 위험이 있었다(그 오차가 연도 구간
   * 경계 근처에서 소정급여일수 자체를 바꿀 수 있음). 이번 수정으로 전자(날짜 두 개 입력 → 자동
   * 일수 계산)로 전환해 severance-pay와 입력 패턴을 통일했다 — `validation.ts`가 이 값과
   * `leaveDate`를 `src/lib/date-calc.ts`의 `diffDaysUtc`로 계산해 아래
   * `UnemploymentBenefitCalcInput.insuredPeriodDays`를 만든다. 계산 공식(logic.ts 1~11단계,
   * 365일=1년 고정 환산 등)은 이 변경으로 전혀 바뀌지 않는다 — 오직 사용자가 이 값을
   * 입력하는 방식(입력 변환 계층)만 바뀐다.
   */
  insuredStartDate: IsoDateString;
  /**
   * 초단시간근로자(4주 평균 주 소정근로시간 15시간 미만) 여부. 계산 분기에는 쓰이지 않고
   * "기준기간이 18개월이 아닌 24개월로 연장된다"는 안내 문구 표시 용도로만 쓰인다
   * (FORMULA.md "예외 > 초단시간근로자의 기준기간 연장" 참고). 기본값 false.
   */
  isUltraShortTimeWorker?: boolean;
  /**
   * 장애인 여부(「장애인고용촉진 및 직업재활법」 제2조). true면 소정급여일수 표에서
   * "50세 이상" 그룹과 동일하게 취급된다. 기본값 false.
   */
  isDisabled?: boolean;
  /** 퇴사 전 3개월 임금총액(원). 근로기준법 제2조제1항제6호 평균임금 산정용. */
  wage3m: Won;
}

/**
 * logic.ts의 순수 계산 함수가 실제로 받는 입력 타입. `UnemploymentBenefitFormInput`에서
 * `insuredStartDate`(사용자가 입력하는 원시 날짜)를 제외하고, 대신 `insuredPeriodDays`
 * (일수)를 그대로 유지한다 — **logic.ts의 계산 함수 시그니처·11단계 공식은 이 수정으로 전혀
 * 바뀌지 않는다.** `insuredStartDate → leaveDate` 사이의 일수 변환은 `validation.ts`(입력
 * 변환 계층)가 `date-calc.ts`의 `diffDaysUtc`로 미리 계산해 `insuredPeriodDays`를 채운 뒤
 * 이 타입으로 전달한다 — logic.ts는 날짜 두 개가 아니라 여전히 계산된 일수 하나만 받는다.
 */
export type UnemploymentBenefitCalcInput = Omit<
  UnemploymentBenefitFormInput,
  "insuredStartDate"
> & {
  /**
   * 퇴사일 기준 누적 고용보험 가입기간(일). 180일 요건 판정과 소정급여일수 표 조회에
   * 동일하게 쓰인다 — FORMULA.md "예외 > 피보험기간과 피보험단위기간의 개념 차이"가 설명하는
   * v1 단순화(달력 기준 단일 값 사용)를 그대로 따른다. `validation.ts`가
   * `insuredStartDate`/`leaveDate` 두 날짜로부터 자동 계산해 채운다(사용자가 이 숫자를 직접
   * 입력하지 않는다).
   */
  insuredPeriodDays: number;
};

/**
 * 피보험기간(가입기간) 180일 미만으로 인한 "수급자격 요건 미충족" — FORMULA.md "공식" 단락
 * 및 "예외 > 피보험단위기간 요건 미충족"이 정의하는, 계산이 실제로 수행된 뒤에 판정되는
 * 결과다.
 *
 * (2026-09-02 Optimizer 수정 — SPEC.md v2 대응) v1은 이 결과 외에도 체크박스 미확인
 * (`voluntaryLeaveAcknowledged=false`)이라는 별도의 "자격 미충족" 갈래가 UI 레벨에 있었다.
 * SPEC.md v2가 그 체크박스 게이팅을 제거하면서, 이제 "자격 미충족"은 이 결과 하나로
 * 통일됐다 — severance-pay의 `SeverancePayIneligibleResult`와 동일한 단일 판정 패턴이다.
 */
export interface UnemploymentBenefitInsuredPeriodIneligibleResult {
  eligible: false;
  /** 항상 false — 이 타입이 만들어지는 유일한 이유(insuredPeriodDays < 180). */
  eligibleByInsuredPeriod: false;
}

export interface UnemploymentBenefitEligibleResult {
  eligible: true;
  /** 피보험기간 180일 이상 요건 충족 여부. 이 타입에서는 항상 true. */
  eligibleByInsuredPeriod: true;
  /** 평균임금 산정기간 총일수(89~92일). severance-pay와 동일한 baseDays 규칙(FORMULA.md 참고). */
  baseDays: number;
  /** 1일 평균임금 = wage3m ÷ baseDays (원/일). */
  averageDailyWage: number;
  /** 상한/하한 적용 전 구직급여일액 = averageDailyWage × 0.6 (원/일). */
  baseBenefitDailyAmount: number;
  /** 해당 연도 최저구직급여일액(원/일, rates-{year}.json에서 조회). */
  minBenefitDailyAmount: number;
  /** 해당 연도 구직급여일액 상한액(원/일, rates-{year}.json에서 조회). */
  maxBenefitDailyAmount: number;
  /** 구직급여일액(최종) = clamp(baseBenefitDailyAmount, min, max) (원/일). */
  benefitDailyAmount: number;
  /** 소정급여일수 표 조회에 쓰인 연령 구간. */
  ageBandForTable: UnemploymentBenefitAgeBand;
  /** 소정급여일수 표 조회에 쓰인 가입기간 구간. */
  insuredPeriodBand: UnemploymentBenefitInsuredPeriodBand;
  /** 소정급여일수(별표1 조회 결과, 일). */
  prescribedBenefitDays: number;
  /** 총 예상 지급액 = benefitDailyAmount × prescribedBenefitDays (원). */
  totalExpectedBenefit: Won;
  /** 대기기간(안내용 상수, 일). rates-{year}.json의 waitingPeriodDays를 그대로 노출한다. */
  waitingPeriodDays: number;
}

/**
 * logic.ts(`calculateUnemploymentBenefit`)의 반환 타입. severance-pay의
 * `SeverancePayResult`와 동일한 discriminated union 패턴이다 — `eligible: false`일 때
 * 금액 필드에 타입 레벨에서 접근할 수 없다.
 *
 * (2026-09-02 Optimizer 수정 — SPEC.md v2 대응) v1은 이 타입 외에 UI 전용 `UnemploymentBenefitOutcome`
 * 래퍼 타입을 따로 두어 "체크박스 미확인" 상태까지 함께 표현했다. 체크박스 게이팅이 제거되면서
 * 그 래퍼가 더 필요 없어졌다 — ui.tsx는 이제 severance-pay와 동일하게 이 타입을 결과 상태로
 * 직접 사용한다(`result.eligible`로 분기).
 */
export type UnemploymentBenefitResult =
  | UnemploymentBenefitInsuredPeriodIneligibleResult
  | UnemploymentBenefitEligibleResult;
