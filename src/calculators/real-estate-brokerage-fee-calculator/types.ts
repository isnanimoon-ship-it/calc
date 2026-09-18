/**
 * 부동산 중개수수료(중개보수 상한액) 계산기 — 타입 스캐폴딩만 담당한다 (Architect 산출물).
 * 계산 구현은 logic.ts, 검증은 validation.ts, 표시 포맷팅은 formatting.ts, 소개/FAQ/정책
 * 고지 문구는 content.ts, UI는 ui.tsx — 전부 Builder 단계에서 이 폴더에 추가된다
 * (docs/ARCHITECTURE.md "계산 로직 / UI 분리" 참고).
 *
 * 필드 정의는 tasks/real-estate-brokerage-fee-calculator/FORMULA.md "입력값"/"출력값" 표를
 * 그대로 옮겼다. 구조적 판단(discriminated union, 한도액 없음의 표현, raw/display 분리,
 * 구간 판정 공용 함수 등)의 근거는
 * tasks/real-estate-brokerage-fee-calculator/ARCHITECTURE.md를 참고한다 — 이 파일의 주석은
 * "무엇을 왜 이렇게 선언했는지"만 짧게 남기고, 전체 맥락은 그 문서에 있다.
 *
 * **`Won`/`Rate`는 이 계산기 전용으로 다시 정의한다**(`annual-salary-take-home-pay`
 * 선례와 동일 — 계산기 폴더 간 타입 결합을 만들지 않는다).
 *
 * **`propertyType`(부동산 종류)은 이 입력 타입에 없다.** SPEC.md Must Have "부동산 종류
 * 확인(정보 제공용)"은 입력 화면에는 필요하지만, v1은 "주택" 단 하나만 지원하고 이 값이
 * 계산 분기에 전혀 영향을 주지 않는다(오피스텔 선택 자체가 UI에서 비활성 처리됨) — UI
 * 전용 확인 요소와 계산 입력을 구조적으로 분리한다(ARCHITECTURE.md "10." 참고). Should
 * Have "오피스텔" 승격 시 실제 판별 필드가 새로 필요해진다.
 */

/** 원(₩) 단위 정수 금액. */
export type Won = number;

/** 무차원 소수 요율. 예: 0.006 = 1,000분의 6(0.6%). UI 표시(%) 단계에서만 100을 곱한다. */
export type Rate = number;

/** 거래 유형. `sale`=매매, `lease`=임대차(전세·월세 통합 — SPEC "핵심 스코프 결정 1"). */
export type TransactionType = "sale" | "lease";

/**
 * 매매·임대차 요율표가 공유하는 구간(tier) 하나의 모양(FORMULA.md "1."·"2." 표 공통 구조).
 * `policy.ts`의 `saleTiers`/`leaseTiers` 배열 원소, 그리고 이 파일 결과 타입의
 * `appliedTier` 필드가 이 타입을 쓴다.
 *
 * `policy.ts`는 이 인터페이스를 import하지 않고 구조적으로 호환되는 리터럴 배열(`as const`)
 * 만 정의한다 — `housing-acquisition-tax`/`annual-salary-take-home-pay`의 policy.ts가
 * 세운 관례(정책 데이터는 타입을 직접 import하지 않고 구조적 타이핑에 맡긴다)를 그대로
 * 따른다(ARCHITECTURE.md "1.3" 참고). "하한 포함, 상한 미포함" 판정(FORMULA.md "구간
 * 판정")을 이 타입의 필드 이름 자체가 명시적으로 드러낸다.
 */
export interface FeeTier {
  /** 이 구간의 하한(원, 포함). 최저 구간은 0. */
  lowerBoundInclusive: Won;
  /** 이 구간의 상한(원, 미포함="미만"). 최고 구간(상한 없음)은 `null`. */
  upperBoundExclusive: Won | null;
  /** 이 구간에 적용되는 상한요율(무차원 소수). */
  rate: Rate;
  /**
   * 정액 한도액(원). 한도액이 없는 구간(매매·임대차 각 6단계 중 대다수 고가 구간)은
   * `undefined`(필드 생략)가 아니라 명시적 `null`을 쓴다 — "한도액이 없다는 것을 확인해
   * 명시적으로 기록한 것"과 "설계 누락"을 구분하기 위함이다(ARCHITECTURE.md "3.",
   * `housing-acquisition-tax`의 `heavyRate.rows`가 `rate: null`로 "중과 대상 아님"을
   * 명시한 것과 동일한 관례).
   */
  cap: Won | null;
}

/** 매매 모드 입력. FORMULA.md "입력값" 표 그대로. */
export interface SaleBrokerageFeeInput {
  transactionType: "sale";
  /**
   * 매매가격(원). 필수, 정수, `> 0`. 상·하한은 validation.ts가 정의한다(Formula
   * Analyst·Architect 권고값: 1,000,000원 이상 1,000,000,000,000원(1조원) 이하 —
   * ARCHITECTURE.md "6." 참고, 법적 제약이 아니라 UX 방어값).
   */
  salePrice: Won;
}

/**
 * 임대차 모드 입력. 전세·월세를 별도 모드로 나누지 않는다 — `monthlyRent`가 0(또는
 * 생략)이면 자연히 전세와 동일한 계산이 된다(SPEC "핵심 스코프 결정 1").
 */
export interface LeaseBrokerageFeeInput {
  transactionType: "lease";
  /**
   * 임대차 보증금(원). 필수, 정수, `> 0`. 하한(1,000,000원)은 이 필드에 직접 적용한다 —
   * `convertedDeposit`은 항상 `deposit` 이상이므로(월차임 항이 0 이상) 이 하한만으로
   * 환산보증금의 하한도 자동으로 만족된다(ARCHITECTURE.md "6.2").
   */
  deposit: Won;
  /**
   * 월세(원). 선택, 기본값 0(전세와 동일 처리). `>= 0`(음수 불가).
   *
   * **상한 검증 주의(ARCHITECTURE.md "6.2" 필독)**: 이 필드 자체에는 반드시 지켜야 할
   * 별도 상한이 없을 수 있지만, `deposit + monthlyRent × 100`(환산보증금 기본 산식)으로
   * 계산되는 `convertedDeposit`이 거래금액 상한(1조원 권고)을 넘지 않도록 **환산 후
   * 값을 다시 검증**해야 한다 — `deposit`만 상한 이내라고 확인하는 것으로는 불충분하다.
   */
  monthlyRent: Won;
}

export type RealEstateBrokerageFeeCalculatorInput =
  | SaleBrokerageFeeInput
  | LeaseBrokerageFeeInput;

/**
 * 두 모드가 공유하는 결과 필드. 판별 유니온의 구성 요소로만 쓰고 그 자체를 export하지
 * 않는다(`loan-interest-calculator`의 `LoanCalculationBase`, `minimum-wage-calculator`의
 * `MinimumWageComparisonBase`와 동일한 목적 — 반복 나열 제거 + 호출부가
 * `transactionType`으로 분기하지 않고는 임대차 전용 필드에 접근할 수 없도록 강제).
 *
 * **`rawFee`(반올림 전 완전정밀도 요율 적용 금액)는 의도적으로 이 타입에 없다.**
 * `housing-acquisition-tax`의 `acquisitionTaxRaw` 비노출 패턴과 동일 — logic.ts의
 * `calculateFeeFromTier` 내부 지역 변수로만 존재하고, 한도액 비교(완전정밀도)까지 끝낸
 * 뒤 `maxBrokerageFee` 하나만 원 단위로 반올림해 이 타입에 싣는다(ARCHITECTURE.md "4."
 * 참고). "계산 근거" 화면이 "요율 × 거래금액" 중간값을 보여줘야 할 때는, `formatting.ts`가
 * 이미 노출된 `baseAmount`·`appliedRate`로부터 **표시 전용으로 다시 계산**한다 — 그
 * 재계산값은 어떤 반올림·한도 판정에도 재사용되지 않는 순수 설명용 숫자다
 * (ARCHITECTURE.md "4.2" 참고).
 */
interface BrokerageFeeResultBase {
  /** 이 계산에 실제로 쓰인 거래금액. 매매는 `salePrice`, 임대차는 `convertedDeposit`과 같은 값. */
  baseAmount: Won;
  /** 매칭된 구간(하한·상한·요율·한도액 전체). */
  appliedTier: FeeTier;
  /**
   * 적용된 상한요율. 항상 `appliedTier.rate`와 같다(FORMULA.md "출력값" 표가 별도 필드로
   * 정의 — 계산 근거 화면에서 가장 자주 쓰이는 값이라 편의상 최상위에 둔다). logic.ts는
   * 이 값을 `appliedTier`와 별개로 조회하지 않고 항상 같은 `tier` 인자에서 파생시켜야
   * 드리프트가 생기지 않는다(Builder 계약, ARCHITECTURE.md "2.3" 참고).
   */
  appliedRate: Rate;
  /** `appliedTier.cap`이 존재하고(`!== null`) 완전정밀도 요율 적용 금액이 그 값을 초과했는지. */
  isCapApplied: boolean;
  /**
   * 중개보수 상한액(핵심 결과, 원 단위 사사오입 1회 적용 완료). **"확정 지급액"이
   * 아니다** — 실제 지급액은 이 금액 이내에서 협의로 정해진다(SPEC "핵심 스코프 결정 3").
   */
  maxBrokerageFee: Won;
}

export type RealEstateBrokerageFeeCalculatorResult =
  | (BrokerageFeeResultBase & {
      transactionType: "sale";
    })
  | (BrokerageFeeResultBase & {
      transactionType: "lease";
      /**
       * 환산보증금. `baseAmount`와 값은 같지만 SPEC Must Have("환산보증금을 별도 항목으로
       * 명확히 표시")에 따라 별도 필드로 노출한다.
       */
      convertedDeposit: Won;
      /** 환산보증금 계산 시 5천만원 미만 예외(×70)가 적용됐는지. */
      isLowDepositExceptionApplied: boolean;
    });

/** `transactionType="sale"` 분기만 뽑아낸 타입. `calculateSaleBrokerageFee`의 반환 타입. */
export type SaleBrokerageFeeResult = Extract<
  RealEstateBrokerageFeeCalculatorResult,
  { transactionType: "sale" }
>;

/** `transactionType="lease"` 분기만 뽑아낸 타입. `calculateLeaseBrokerageFee`의 반환 타입. */
export type LeaseBrokerageFeeResult = Extract<
  RealEstateBrokerageFeeCalculatorResult,
  { transactionType: "lease" }
>;
