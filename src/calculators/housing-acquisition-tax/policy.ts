/**
 * 주택 취득세 계산기 — 정책 상수(세율표 + 출처 메타데이터).
 *
 * tasks/housing-acquisition-tax/ARCHITECTURE.md "3. 정책 데이터 배치" 결정 그대로: 계산기
 * 전용 policy.ts(다른 계산기가 재사용할 근거가 없고, 세율 개정이 "연도" 축이 아니라 지방세법
 * 개정 시점에 수시로 발생하는 성격이라 `rates-{year}.json`에 두면 "이 값이 2026년 한정"이라는
 * 오해를 준다 — housing-subscription-score의 「주택공급에 관한 규칙」과 동일한 판단).
 * 값은 tasks/housing-acquisition-tax/FORMULA.md "공식" / "기준 / 출처" 절에서 그대로 옮겼다 —
 * 새로 추정한 값은 없다. "확인 필요"로 남은 항목은 HOUSING_ACQUISITION_TAX_OPEN_QUESTIONS에
 * 그대로 옮긴다(추정 금지).
 *
 * logic.ts는 이 파일의 상수만 참조하고 0.01/0.08/0.12/300_000_000 같은 매직 넘버를 계산
 * 코드에 직접 쓰지 않는다(SPEC.md Must Have "세율 수치를 계산 코드에 직접 하드코딩하지
 * 않는다").
 */

export const HOUSING_ACQUISITION_TAX_POLICY = {
  lastVerified: "2026-09-13",
  nextReviewDue: "2027-01-01",
  /**
   * 정기 재검토(2027-01-01) 이전이라도 즉시 재검토해야 하는 조건. UI 정책 고지 문구가 아니라
   * PROGRESS.md/Formula Analyst 재검토 트리거용 메타데이터다(FORMULA.md "조기 재검토 트리거"
   * 그대로).
   */
  earlyReviewTriggers: [
    "조정대상지역 지정·해제 고시가 새로 발생하는 경우(계산 로직 자체엔 영향 없음, helpText·샘플 값 스냅샷만 갱신 대상)",
    "다주택자 취득세 중과세율(8%/12%) 완화 또는 표준세율 구간 자체를 변경하는 지방세법 개정안이 국회 본회의를 통과·공포되는 경우",
    "생애최초 주택 구입 감면(지방세특례제한법 제36조의3) 일몰기한(2028-12-31) 임박 시",
    "위택스(wetax.go.kr) 등과의 실제 대조 결과, 10원 미만 절사 잠정 채택이 틀린 것으로 확인되는 경우",
  ] as const,

  /**
   * 주택 유상취득 표준세율 — 「지방세법」제11조제1항제8호.
   * mid 구간 세율 = round(((acquisitionPrice / midFormula.divisor) * midFormula.multiplier
   *   - midFormula.subtract) / midFormula.percentDivisor, midFormula.roundDecimalPlaces)
   *
   * **반올림 대상 주의(ARCHITECTURE.md "2. FORMULA.md 내부 정합성 이슈" 필독)**: 위 나눗셈
   * 결과(예 0.0166667, "세율"을 소수로 나타낸 값 그 자체)를 소수 4자리로 반올림한다
   * (`Math.round(rate * 10000) / 10000`). FORMULA.md 프로즈 설명의 "7억원 → 1.6667%"라는
   * 표현을 문자 그대로 따라 퍼센트 표기 단계(예 1.66667)에서 반올림하면 0.016667이 되어
   * FORMULA.md 자신의 검증 예제 4·16(6.5억→0.0133, 8억→0.0233)과 어긋난다 — 반드시 소수
   * 형태(0.0133, 0.0233) 자체를 4자리로 반올림해야 검증 예제와 일치한다.
   */
  standardRate: {
    lowTier: {
      maxPrice: 600_000_000,
      rate: 0.01,
      source: {
        law: "지방세법",
        article: "제11조제1항제8호가목",
        effectiveDate: "2020-08-12",
        url: "https://casenote.kr",
      },
    },
    midTier: {
      minPriceExclusive: 600_000_000,
      maxPrice: 900_000_000,
      divisor: 300_000_000,
      multiplier: 2,
      subtract: 3,
      percentDivisor: 100,
      roundDecimalPlaces: 4,
      source: {
        law: "지방세법",
        article: "제11조제1항제8호나목",
        effectiveDate: "2020-08-12",
        url: "https://casenote.kr",
      },
    },
    highTier: {
      minPriceExclusive: 900_000_000,
      rate: 0.03,
      source: {
        law: "지방세법",
        article: "제11조제1항제8호다목",
        effectiveDate: "2020-08-12",
        url: "https://casenote.kr",
      },
    },
    note:
      "전용면적 85㎡ 초과 여부는 이 표준세율 자체에 영향을 주지 않는다(농어촌특별세 비과세 판정에만 사용). 경계값은 각 구간의 '이하'에 포함(가목 6억원, 나목 9억원 모두 이하 구간에 귀속 — FORMULA.md '예외' 참고).",
  },

  /**
   * 다주택자·조정대상지역 중과세율표 — 「지방세법」제13조의2.
   * rate가 null이면 "중과 대상 아님(표준세율 적용)"을 의미한다. Architect가 4구간으로
   * 확정한 근거는 types.ts `HouseCountAfterAcquisition` 주석 및 ARCHITECTURE.md "1." 참고.
   */
  heavyRate: {
    rows: [
      { houseCount: 1, isAdjustmentTargetArea: true, rate: null },
      { houseCount: 1, isAdjustmentTargetArea: false, rate: null },
      { houseCount: 2, isAdjustmentTargetArea: true, rate: 0.08 },
      { houseCount: 2, isAdjustmentTargetArea: false, rate: null },
      { houseCount: 3, isAdjustmentTargetArea: true, rate: 0.12 },
      { houseCount: 3, isAdjustmentTargetArea: false, rate: 0.08 },
      { houseCount: 4, isAdjustmentTargetArea: true, rate: 0.12 },
      { houseCount: 4, isAdjustmentTargetArea: false, rate: 0.12 },
    ] as const,
    source: {
      law: "지방세법",
      article: "제13조의2",
      effectiveDate: "2020-08-12",
      url: "https://casenote.kr",
    },
    note:
      "일시적 2주택 특례, 지방 저가주택(공시가격 2억원 이하) 중과 제외 특례, 법인 취득(12% 일괄, Should Have 참고용)은 이 표에 반영하지 않는다 — v1 입력만으로 판정 불가(FORMULA.md '예외' 참고).",
  },

  /**
   * 지방교육세율 — 「지방세법」제151조제1항제1호(※ 별도 "지방교육세법" 아님, FORMULA.md
   * "사전 고지" 1번 — SPEC.md의 법령명 표기 오류를 정정).
   */
  localEducationTax: {
    /** 표준세율 케이스: localEducationTax = acquisitionTax(raw) × standardRateFactor. */
    standardRateFactor: 0.1,
    /** 중과세율 케이스(8%든 12%든 무관, 고정): localEducationTax = acquisitionPrice × heavyRateFixedFactor. */
    heavyRateFixedFactor: 0.004,
    source: {
      law: "지방세법",
      article: "제151조제1항제1호",
      effectiveDate: "2026-01-01",
      url: "https://casenote.kr",
    },
  },

  /**
   * 농어촌특별세율과 국민주택규모(85㎡) 비과세 기준 — 「농어촌특별세법」제4조·제5조제1항제6호.
   */
  ruralSpecialTax: {
    /** 전용면적이 이 값 이하이면 비과세("이하"에 경계값 포함). */
    exemptAreaThresholdSqm: 85,
    /** 표준세율 케이스(가격 구간 무관 고정): acquisitionPrice × standardRateFactor. */
    standardRateFactor: 0.002,
    /** 8% 중과 케이스: acquisitionPrice × heavy8PercentFactor. */
    heavy8PercentFactor: 0.006,
    /** 12% 중과 케이스: acquisitionPrice × heavy12PercentFactor. */
    heavy12PercentFactor: 0.01,
    source: {
      law: "농어촌특별세법",
      article: "제4조(비과세), 제5조제1항제6호(과세표준과 세율)",
      effectiveDate: "확인 필요(제4조 비과세 조항 시행일 미확정)",
      url: "https://casenote.kr",
    },
    note:
      "중과세율 케이스(0.6%/1.0%)는 법 조문이 제13조의2를 명시적으로 규정하지 않아 '부분 확인'이다 — 정황·수치 일치(총부담률 9.0%/13.4% 벤치마크)로 교차검증했다(FORMULA.md '4.' 참고). Calculation Auditor 우선 검증 대상.",
  },

  /**
   * 세목별 10원 미만 절사(내림) — 「지방세기본법」제59조(「국고금 관리법」제47조 준용).
   * **FORMULA.md 스스로 "확인 필요"로 남긴 잠정 정책이다** — Calculation Auditor가
   * 위택스(wetax.go.kr) 모의계산과 직접 대조해 확정할 것을 권고한다(ARCHITECTURE.md "6." 및
   * PROGRESS.md 조기 재검토 트리거 참고). 각 세목(acquisitionTax/localEducationTax/
   * ruralSpecialTax) 독립적으로 1회만 적용하고, 절사된 값을 다른 세목 계산에 재사용하지 않는다.
   */
  rounding: {
    unit: 10,
    method: "truncate" as const,
    source: {
      law: "지방세기본법",
      article: "제59조(「국고금 관리법」제47조제1항 준용)",
      effectiveDate: "확인 필요",
      url: "https://casenote.kr",
    },
  },
} as const;

/**
 * FORMULA.md가 "확인 필요"로 남긴 항목을 결과 화면 정책 안내(또는 개발 문서)에 그대로
 * 노출하기 위한 요약. 값 자체를 임의로 판정하지 않고 원문 취지를 그대로 옮긴다.
 */
export const HOUSING_ACQUISITION_TAX_OPEN_QUESTIONS = [
  "세목별 10원 미만 절사(내림) 규칙이 실제 위택스(wetax.go.kr) 모의계산 결과와 정확히 일치하는지 아직 직접 대조하지 못했습니다. 정확한 금액은 위택스(wetax.go.kr) 등 공식 채널로 최종 확인하시기 바랍니다.",
  "농어촌특별세 중과세율(8% 중과 시 0.6%, 12% 중과 시 1.0%) 산정 방식은 법 조문이 제13조의2를 명시적으로 규정하지 않아 정황·수치 일치로 교차검증한 부분 확인입니다.",
  "국민주택규모의 읍·면 지역 100㎡ 특례(전국 공통 85㎡ 기준의 예외)는 관련 법령 1차 출처로 확정하지 못해 이 계산기에는 반영하지 않았습니다.",
  "지방 저가주택(공시가격 2억원 이하, 수도권 외) 중과 제외 특례와 일시적 2주택 특례는 입력 항목(취득가액·전용면적·조정대상지역·보유 주택 수)만으로는 해당 여부를 판정할 수 없어 반영하지 않았습니다.",
] as const;
