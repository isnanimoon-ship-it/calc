/**
 * 부동산 중개수수료(중개보수 상한액) 계산기 — 정책 상수(요율표 + 환산보증금 산식 +
 * 출처 메타데이터).
 *
 * tasks/real-estate-brokerage-fee-calculator/ARCHITECTURE.md "1. 요율표 데이터 배치"
 * 결정 그대로: 계산기 전용 policy.ts(다른 계산기가 재사용할 근거가 없고, 매매·임대차
 * 중개보수 요율표는 "연도" 축이 아니라 「공인중개사법 시행규칙」·지자체 조례 개정
 * 시점에만 바뀌는 성격이라 `rates-{year}.json`에 두면 "이 값이 특정 연도에만 유효하다"는
 * 오해를 준다 — housing-acquisition-tax/housing-subscription-score와 동일한 판단).
 *
 * 값은 tasks/real-estate-brokerage-fee-calculator/FORMULA.md "공식"·"기준/출처" 절에서
 * 그대로 옮겼다 — 새로 추정한 값은 없다. "확인 필요"로 남은 항목은
 * REAL_ESTATE_BROKERAGE_FEE_OPEN_QUESTIONS에 그대로 옮긴다(추정 금지).
 *
 * **이 파일은 `types.ts`를 import하지 않는다.** `saleTiers`/`leaseTiers`의 리터럴 배열은
 * `types.ts`의 `FeeTier`와 구조적으로 호환되며, `housing-acquisition-tax`/
 * `annual-salary-take-home-pay`의 policy.ts가 세운 관례(정책 데이터는 타입을 직접
 * import하지 않고 구조적 타이핑에 맡긴다)를 그대로 따른다(ARCHITECTURE.md "1.3" 참고).
 *
 * logic.ts는 이 파일의 상수만 참조하고 0.006/0.005/50_000_000 같은 매직 넘버를 계산
 * 코드에 직접 쓰지 않는다(SPEC.md Must Have "요율 수치를 계산 코드에 직접 하드코딩하지
 * 않는다").
 */

export const REAL_ESTATE_BROKERAGE_FEE_POLICY = {
  lastVerified: "2026-09-18",
  /**
   * FORMULA.md "기준/출처": 이 값은 연 1회 정기 고시가 아니라 조례·시행규칙 개정 시에만
   * 바뀌므로, 이 날짜보다 아래 `earlyReviewTriggers`가 훨씬 중요하다.
   */
  nextReviewDue: "2027-01-01",
  /**
   * 정기 재검토(2027-01-01) 이전이라도 즉시 재검토해야 하는 조건. FORMULA.md "조기
   * 재검토 트리거" 그대로(housing-acquisition-tax의 `earlyReviewTriggers` 배치 관례
   * 재사용).
   */
  earlyReviewTriggers: [
    "국토교통부가 「공인중개사법 시행규칙」 제20조(별표1·별표2)를 개정하는 관보 고시가 있는 경우 — 2021-10-19 개정처럼 전국 요율 구조 자체가 바뀔 수 있다.",
    "서울특별시(또는 경기도·부산·대구·경상남도·인천 등 이 문서가 대조 기준으로 삼은 지자체)가 중개보수 조례를 개정하는 경우 — 국가 시행규칙 [별표 1]을 그대로 인용하는 구조라 해도, 조례가 인용 방식 자체를 바꾸거나 인용을 중단할 가능성은 남아 있다(FORMULA.md v2 정정 — 시행규칙이 0.9%/0.8% 절대 상한만 정하고 조례가 세분화하는 구조가 아니다).",
    "부동산 중개보수 체계 개편이 국회·국토교통부 차원에서 논의되어 구체적 개정안이 발의·통과되는 경우.",
    "17개 광역자치단체 전수 조사가 완료되어 '전국 공통 표준요율' 전제 자체가 무너지는 경우.",
  ] as const,

  /**
   * 주택 매매·교환 중개보수 상한요율표 — 6단계, 하한 포함·상한 미포함("미만").
   * FORMULA.md "1. 주택 매매·교환 중개보수 상한요율표" 표 그대로.
   *
   * 법적 근거(FORMULA.md v2 정정 반영, 2026-09-18 — 이전 버전은 "시행규칙이 0.9%/0.8%
   * 절대 상한만 정하고 실제 세분화 표는 시·도 조례가 정한다"고 서술했으나 이는 틀린
   * 서술이었다. 시행규칙 원문 어디에도 "1천분의 8"은 등장하지 않고, "1천분의 9"는
   * 주택이 아니라 주택 외 부동산(제20조제4항제2호)에만 적용되는 별개 규정이다):
   * 「공인중개사법」제32조제4항(위임) → 「공인중개사법 시행규칙」제20조제1항·[별표 1]이
   * 이 매매 6단계 요율표 자체를 국가 법령 수준에서 직접 규정한다(law.go.kr 원문
   * MST=288753, Calculation Auditor 확인 2026-09-18). 「서울특별시 주택 중개보수 등에
   * 관한 조례」(제2조제1항·별표1, 서울특별시조례 제8585호, 시행 2022-12-30 — SPEC.md의
   * 구 명칭 "부동산 중개보수 등에 관한 조례"를 FORMULA.md가 정정) 및 「경기도 주택
   * 중개보수 등에 관한 조례」등 각 시·도 조례는 이 국가 표를 독자적으로 세분화한 것이
   * 아니라 그대로 인용/참조한다. 시행일 2021-10-19(9억원 이상 구간을 3단계로 세분화하고
   * 요율을 인하한 「공인중개사법 시행규칙」개정).
   */
  saleTiers: [
    { lowerBoundInclusive: 0, upperBoundExclusive: 50_000_000, rate: 0.006, cap: 250_000 },
    { lowerBoundInclusive: 50_000_000, upperBoundExclusive: 200_000_000, rate: 0.005, cap: 800_000 },
    { lowerBoundInclusive: 200_000_000, upperBoundExclusive: 900_000_000, rate: 0.004, cap: null },
    { lowerBoundInclusive: 900_000_000, upperBoundExclusive: 1_200_000_000, rate: 0.005, cap: null },
    { lowerBoundInclusive: 1_200_000_000, upperBoundExclusive: 1_500_000_000, rate: 0.006, cap: null },
    { lowerBoundInclusive: 1_500_000_000, upperBoundExclusive: null, rate: 0.007, cap: null },
  ] as const,
  saleTiersSource: {
    law: "공인중개사법 시행규칙",
    article:
      "제20조제1항·별표1(이 매매 6단계 요율표를 국가 법령 수준에서 직접 규정함 — '시행규칙이 0.9%/0.8% 절대 상한만 정하고 조례가 세분화한다'는 서술은 틀린 서술로 FORMULA.md v2에서 정정됨. 「서울특별시 주택 중개보수 등에 관한 조례」(제2조제1항·별표1, 서울특별시조례 제8585호) 등 각 시·도 조례는 이 국가 표를 그대로 인용/참조함)",
    effectiveDate: "2021-10-19",
    url: "https://easylaw.go.kr",
  },

  /**
   * 주택 임대차(전세·월세) 중개보수 상한요율표 — 환산보증금 기준 6단계.
   * FORMULA.md "2. 주택 임대차 중개보수 상한요율표" 표 그대로. 법적 근거는 매매표와
   * 동일한 위임 구조 — 「공인중개사법 시행규칙」제20조제1항·[별표 1]이 이 임대차
   * 6단계 요율표까지 함께 국가 법령 수준에서 직접 규정한다(FORMULA.md v2 정정,
   * 2026-09-18). "임대차 등 거래금액의 1,000분의 8(0.8%) 이내"라는 절대 상한 서술은
   * 시행규칙 원문에 존재하지 않는 착오였다 — 시행규칙 전체에 "1천분의 8"이라는 문구
   * 자체가 등장하지 않는다(위 saleTiers 주석 및 FORMULA.md "법적 구조 요약" 참고).
   */
  leaseTiers: [
    { lowerBoundInclusive: 0, upperBoundExclusive: 50_000_000, rate: 0.005, cap: 200_000 },
    { lowerBoundInclusive: 50_000_000, upperBoundExclusive: 100_000_000, rate: 0.004, cap: 300_000 },
    { lowerBoundInclusive: 100_000_000, upperBoundExclusive: 600_000_000, rate: 0.003, cap: null },
    { lowerBoundInclusive: 600_000_000, upperBoundExclusive: 1_200_000_000, rate: 0.004, cap: null },
    { lowerBoundInclusive: 1_200_000_000, upperBoundExclusive: 1_500_000_000, rate: 0.005, cap: null },
    { lowerBoundInclusive: 1_500_000_000, upperBoundExclusive: null, rate: 0.006, cap: null },
  ] as const,
  leaseTiersSource: {
    law: "공인중개사법 시행규칙",
    article:
      "제20조제1항·별표1(매매표와 동일하게 이 임대차 6단계 요율표를 국가 법령 수준에서 직접 규정함 — '0.8% 절대 상한' 서술은 시행규칙 원문에 없는 착오로 FORMULA.md v2에서 정정됨. 「서울특별시 주택 중개보수 등에 관한 조례」(제2조제1항·별표1, 서울특별시조례 제8585호) 등 각 시·도 조례는 이 국가 표를 그대로 인용/참조함)",
    effectiveDate: "2021-10-19",
    url: "https://easylaw.go.kr",
  },

  /**
   * 환산보증금 계산 — 기본 산식과 5천만원 미만 예외(FORMULA.md "3.").
   *
   * 기본 산식: convertedDeposit = deposit + monthlyRent × defaultMultiplier(100)
   * 예외(monthlyRent > 0 이고, 기본 산식으로 계산한 값이 thresholdExclusiveUpperBound
   *      (5천만원) "미만"인 경우에만 적용): convertedDeposit = deposit + monthlyRent ×
   *      exceptionMultiplier(70)
   *
   * "5천만원 미만"은 `<` 이지 `<=`가 아니다 — 정확히 5천만원이면 예외를 적용하지 않고
   * 기본 산식(×100) 결과를 그대로 쓴다(FORMULA.md 검증 예제 21).
   *
   * 법적 근거: 「공인중개사법 시행규칙」제20조(정확한 항·호 번호는 "부분확인" —
   * FORMULA.md "확인 필요 목록" 1번, 아래 REAL_ESTATE_BROKERAGE_FEE_OPEN_QUESTIONS 1번
   * 참고). 수치(100배·70배·5천만원 기준) 자체는 법제처 easylaw.go.kr·서울시·경기도·
   * nepla.ai(법률 유권해석 위키) 4개 독립 출처가 완전히 일치해 신뢰도가 높다.
   */
  convertedDepositException: {
    /** 이 값 "미만"이면 예외 적용(포함 아님 — FORMULA.md 검증 예제 21). */
    thresholdExclusiveUpperBound: 50_000_000,
    /** 기본 산식의 월차임 배수. */
    defaultMultiplier: 100,
    /** 예외 적용 시 월차임 배수. */
    exceptionMultiplier: 70,
    source: {
      law: "공인중개사법 시행규칙",
      article: "제20조 (정확한 항·호 번호 부분확인 — 확인 필요 목록 1번 참고)",
      effectiveDate: "확인 필요",
      url: "https://easylaw.go.kr",
    },
  },
} as const;

/**
 * FORMULA.md가 "확인 필요"로 남긴 항목을 결과 화면 정책 안내(또는 개발 문서)에 그대로
 * 노출하기 위한 요약. 값 자체를 임의로 판정하지 않고 원문 취지를 그대로 옮긴다
 * (`housing-acquisition-tax`의 `HOUSING_ACQUISITION_TAX_OPEN_QUESTIONS`와 동일한 패턴).
 */
export const REAL_ESTATE_BROKERAGE_FEE_OPEN_QUESTIONS = [
  "「공인중개사법 시행규칙」 제20조의 정확한 항·호 번호(예: 환산보증금 규정의 항·호)는 국가법령정보센터 원문을 이번 조사에서 직접 렌더링하지 못해 2차 출처의 교차 확인으로 재구성했습니다. 요율·금액 수치 자체의 신뢰도와는 별개 사안입니다.",
  "「서울특별시 주택 중개보수 등에 관한 조례」의 정확한 조·별표 번호는 명칭과 시행일(2022-12-30, 조례 제8585호)만 확인했고 조문 본문까지는 확인하지 못했습니다.",
  "서울특별시·경기도 2개 광역자치단체만 직접 확인했으며, 나머지 15개 시·도의 실제 조례 수치가 완전히 동일한지는 확인하지 못했습니다(이 계산기는 이 두 지자체가 대표하는 전국 공통 표준요율을 기준으로 합니다).",
  "중개보수 금액의 절사·반올림에 대한 명시적 법적 근거(취득세의 국고금 관리법 준용 규정 같은 조항)를 찾지 못해, 이 계산기는 사이트 공통 원칙(원 단위 사사오입, 최종 표시 단계 1회)을 잠정 채택했습니다.",
  "부가가치세 관련 「부가가치세법」의 정확한 조항은 확인하지 못했습니다(v1 계산에는 반영하지 않으며, 부가가치세가 별도로 붙을 수 있다는 점만 고지합니다).",
  "오피스텔 외 준주택(도시형생활주택 등)이 이 계산기의 '주택' 범위에 포함되는지는 이번 조사에서 다루지 않았습니다.",
] as const;
