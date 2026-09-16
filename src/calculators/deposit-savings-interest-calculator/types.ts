/**
 * 예금·적금 이자 계산기 타입 — tasks/deposit-savings-interest-calculator/FORMULA.md 기준.
 *
 * Architect 스캐폴딩이다 — 공식 자체는 정의하지 않는다(Formula Analyst 영역). 여기서는
 * 입력/출력 "계약"(모양)만 고정한다. 상세 근거는
 * tasks/deposit-savings-interest-calculator/ARCHITECTURE.md를 참고한다.
 *
 * 설계 근거 요약(자세한 내용은 ARCHITECTURE.md "1."~"4."):
 * - `mode`("deposit"/"savings")를 1차 판별 태그로 쓰는 discriminated union이다
 *   (`loan-interest-calculator`의 `repaymentMethod` 판별 유니온 선례 그대로 — SPEC.md
 *   "계산 결과 — 모드별로 다른 템플릿"이 예금/적금 결과 템플릿을 명시적으로 다르게 요구한다).
 * - 예금(deposit) 결과는 `interestType`("simple"/"compound")을 2차 판별 태그로 다시 나눈다 —
 *   월복리에서만 존재하는 `monthlyRate`를 단리 결과에 `undefined` optional 필드로 흘리지
 *   않기 위함이다(`docs/CALCULATOR_RULES.md` "서로 다른 계산 방식을 같은 공식으로 처리하지
 *   않는다"를 타입 레벨에서도 지킨다). 입력(`DepositInput`)은 `interestType`이 있어도 값에
 *   따라 필드 구성이 달라지지 않으므로(월복리 여부와 무관하게 입력 필드는 동일) 굳이 중첩
 *   유니온으로 만들지 않고 평평한 enum 필드로 둔다 — `loan-interest-calculator`도 입력
 *   (`repaymentMethod`)은 평평하게, 결과만 판별 유니온으로 설계한 것과 동일한 패턴.
 * - 세전/세후 이자·세금 4종(소득세·지방소득세·합계·세후이자)은 두 모드가 완전히 동일한
 *   공식(FORMULA.md "공식 4")·반올림 순서를 공유하므로 `InterestTaxBreakdown`으로 뽑아 세
 *   분기 타입 모두에 교차(&)한다 — `loan-interest-calculator`의 `LoanCalculationBase`가
 *   공통 필드 반복을 줄인 것과 같은 이유.
 * - `preTaxInterest`는 이미 원 단위 미만 절사(floor)가 끝난 확정값이다("raw" 전체정밀도
 *   중간값은 타입에 노출하지 않는다 — logic.ts 내부 계산 단계일 뿐이며, 이 절사 자체가
 *   FORMULA.md가 명시한 도메인 규칙이라 "표시 직전 재반올림"이 아니라 로직 단계에서 이미
 *   확정된다. `loan-interest-calculator`가 회차별 반올림을 로직 단계에서 이미 끝내고
 *   `formatting.ts`가 재반올림하지 않는 것과 동일한 경계).
 * - 적금 `schedule[]`의 각 행(`interest`)도 이미 개별 반올림이 끝난 표시값이다. 이 표의
 *   합계가 `preTaxInterest`(전체 정밀도 합산 후 1회만 절사)와 원 단위에서 근소하게 다를 수
 *   있다는 사실은 타입이 아니라 UI 고지 문구(content.ts, `average-cost-calculator` 선례)로
 *   다룬다 — 필요하면 `schedule[]`을 합산해 차이를 보여주는 것은 순수 집계이므로 그 집계
 *   함수는 `formatting.ts`가 아니라 `logic.ts`에 둔다(`loan-interest-calculator`의
 *   `yearlySummary` 집계 배치 원칙과 동일, ARCHITECTURE.md "4." 참고).
 */

export type Won = number;

export type DepositSavingsInterestCalculatorMode = "deposit" | "savings";
export type DepositInterestType = "simple" | "compound";

/** 예금·적금 공통 입력. FORMULA.md "입력값" 표 기준 허용 범위를 주석에 남긴다. */
export interface DepositSavingsInterestCalculatorInputBase {
  /**
   * 연이율(%, 사용자가 `3`처럼 입력 — 내부 계산에서만 `/100`(월복리는 추가로 `/12`)으로
   * 변환한다). 우대금리까지 반영된 "최종 적용금리"를 사용자가 직접 입력한다(정책 데이터
   * 아님 — loan-interest-calculator와 동일 패턴).
   * FORMULA.md 허용 범위: 0 이상 30 이하, 소수 둘째 자리까지(예: 3.45).
   */
  annualRatePercent: number;
  /**
   * 예치/적립 기간(개월). UI가 "년+개월" 등 다른 입력 방식을 쓰더라도 폼 레벨에서 이
   * 필드로 환산해 전달한다 — 이 타입 자체는 UI 입력 방식과 무관하다.
   * FORMULA.md 허용 범위: 1 이상 120(10년) 이하 정수.
   */
  termMonths: number;
}

export interface DepositInput extends DepositSavingsInterestCalculatorInputBase {
  mode: "deposit";
  /** 예치금액(원). FORMULA.md 허용 범위: 10,000 이상 10,000,000,000(100억원) 이하 정수. */
  principal: Won;
  /** 단리(`simple`) / 월복리(`compound`). 필수 — 미선택 시 계산하지 않는다(FORMULA.md "예외"). */
  interestType: DepositInterestType;
}

export interface SavingsInput extends DepositSavingsInterestCalculatorInputBase {
  mode: "savings";
  /**
   * 월 납입액(원). 매월 동일 금액을 정상 납입하는 표준 정기적금만 다룬다(자유적립식·
   * 선납이연·미납회차는 범위 밖 — SPEC.md "핵심 스코프 결정 4").
   * FORMULA.md 허용 범위: 10,000 이상 50,000,000(5천만원) 이하 정수.
   */
  monthlyContribution: Won;
  // 적금 모드는 이자 계산 방식 선택지를 두지 않는다(단리 후취식 고정 — SPEC.md "핵심 스코프
  // 결정 2"). 그래서 이 인터페이스에는 `interestType`이 없다.
}

export type DepositSavingsInterestCalculatorInput = DepositInput | SavingsInput;

/**
 * 이자소득세 15.4%(소득세 14% + 지방소득세 1.4%) breakdown. 예금·적금 두 모드가 공식
 * (FORMULA.md "공식 4")·반올림 순서(소득세를 먼저 사사오입으로 확정 → 그 확정된 정수의
 * 10%를 다시 사사오입)를 완전히 공유하므로 별도로 뽑아 아래 세 결과 타입에 교차 타입(&)으로만
 * 합성한다 — export하지 않아 호출부가 `mode`(및 `interestType`)로 분기하지 않고는 이 값들이
 * 어느 모드의 결과인지 알 수 없게 한다(`loan-interest-calculator`의 `LoanCalculationBase`와
 * 동일한 의도).
 */
interface InterestTaxBreakdown {
  /**
   * 세전 이자. 전체 정밀도로 계산한 뒤 원 단위 미만을 절사(`Math.floor`)해 이미 확정된
   * 정수값이다 — 이후 모든 세금 계산의 입력이 된다(FORMULA.md "계산 순서").
   */
  preTaxInterest: Won;
  /** `round(preTaxInterest × 0.14)` — 사사오입. */
  incomeTax: Won;
  /** `round(incomeTax × 0.10)` — preTaxInterest가 아니라 위에서 이미 확정된 incomeTax 정수 기준으로 다시 사사오입. */
  localIncomeTax: Won;
  /** `incomeTax + localIncomeTax`. */
  totalTax: Won;
  /** `preTaxInterest - totalTax`. */
  afterTaxInterest: Won;
  /** 예금: `principal + afterTaxInterest` / 적금: `totalPrincipal + afterTaxInterest`. */
  afterTaxMaturityAmount: Won;
}

/** 예금 결과 두 분기(`simple`/`compound`)가 공유하는 필드. export하지 않고 아래 판별 유니온 안에서만 합성한다. */
type DepositResultCommon = {
  mode: "deposit";
  principal: Won;
  annualRatePercent: number;
  termMonths: number;
} & InterestTaxBreakdown;

export type DepositResult =
  | (DepositResultCommon & {
      interestType: "simple";
    })
  | (DepositResultCommon & {
      interestType: "compound";
      /** `annualRatePercent / 100 / 12`(단순 12분할, 실효월이율 환산 아님 — FORMULA.md "공식 2"). 반올림하지 않은 원시 소수값(무차원). */
      monthlyRate: number;
    });

/**
 * 적금 회차별 breakdown 표 한 행(`schedule[]`, 길이 = `termMonths`, 최대 120행).
 * UI 표시 + Golden Test 대조용(FORMULA.md 검증 예제 8이 이 표의 개별 행 산식으로 원 단위까지
 * 검증됨).
 */
export interface SavingsScheduleRow {
  /** 회차(1부터 `termMonths`까지). */
  installment: number;
  /**
   * 이 회차 납입액. v1은 항상 `monthlyContribution`과 같다(자유적립식은 범위 밖 — SPEC.md
   * "핵심 스코프 결정 4"). 상수를 매 행 반복하는 대신 필드로 남겨 두는 이유는, 훗날
   * 자유적립식(Could Have)으로 확장될 때 이 필드만 회차별로 달라지면 되고 `schedule[]`의
   * 모양 자체는 바뀌지 않게 하기 위함이다.
   */
  contribution: Won;
  /**
   * 잔여개월_i = `termMonths - installment + 1`. 1회차가 가장 길고(=termMonths), 마지막
   * 회차가 가장 짧다(=1, 0이 아니다 — FORMULA.md "fencepost 규칙").
   */
  remainingMonths: number;
  /**
   * `round(contribution × (annualRatePercent/100) × remainingMonths ÷ 12)` — 이 행만
   * 독립적으로 반올림한 표시값. 이 표의 행별 합계(`Σ interest`)가 `preTaxInterest`(전체
   * 정밀도로 합산한 뒤 1회만 절사한 값)와 원 단위에서 근소하게(대체로 0~수 원) 다를 수
   * 있다 — 버그가 아니라 "각 출력이 자신의 완전정밀도 원본에서 독립적으로 반올림된다"는
   * 정책의 자연스러운 결과다(FORMULA.md "계산 순서" 7단계, `average-cost-calculator` 선례와
   * 동일한 성격).
   */
  interest: Won;
}

export type SavingsResult = {
  mode: "savings";
  monthlyContribution: Won;
  annualRatePercent: number;
  termMonths: number;
  /** `monthlyContribution × termMonths`. */
  totalPrincipal: Won;
  /** 길이 = `termMonths`(최대 120). */
  schedule: SavingsScheduleRow[];
} & InterestTaxBreakdown;

export type DepositSavingsInterestCalculatorResult = DepositResult | SavingsResult;
