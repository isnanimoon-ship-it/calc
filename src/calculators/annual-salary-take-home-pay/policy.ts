/**
 * 연봉 실수령액 계산기 — 근로소득세(간이세액표) 정책 상수(자녀세액공제, 11명 초과 산식,
 * 1천만원 초과 구간별 계수, 지방소득세율) + 출처 메타데이터.
 *
 * tasks/annual-salary-take-home-pay/ARCHITECTURE.md "3. 정책 데이터 스키마" 결정 그대로:
 * 계산기 전용 policy.ts(다른 계산기가 재사용할 근거가 없는 값이라 `rates-2026.json` 최상위에
 * 두지 않는다 — housing-subscription-score와 동일한 판단). 값은
 * tasks/annual-salary-take-home-pay/FORMULA.md "3-2"~"3-4", "정책 데이터 파일 스키마 초안"에서
 * 그대로 옮겼다 — 새로 추정한 값은 없다. "확인 필요"로 남은 항목은 그대로 문자열로 남긴다
 * (docs/CALCULATOR_RULES.md "확실하지 않은 수치는 추정하지 않는다" 원칙).
 *
 * logic.ts는 이 파일의 상수만 참조하고 20830/98/1,507,400 같은 매직 넘버를 직접 쓰지 않는다
 * (SPEC.md Must Have "계산 코드에 요율표·세액표를 직접 하드코딩하지 않는다").
 */

export const EARNED_INCOME_WITHHOLDING_POLICY = {
  effectiveFrom: "2026-03-01",
  source: {
    law: "소득세법 시행령 [별표 2]",
    article: "제189조제1항 관련, 2026. 2. 27. 개정",
    effectiveDate: "2026-03-01",
    url: "https://www.law.go.kr/LSW/flDownload.do?flSeq=164357181&bylClsCd=110201",
  },
  lastVerified: "2026-09-06",
  nextReviewDue: "2027-01-01",
  tableDataRef: "withholding-tax-table-2026.json", // src/data/, ARCHITECTURE.md "2." 스키마

  /** FORMULA.md "3-2. 8세 이상 20세 이하 자녀세액공제 (별표 2 제3호, 원문 확인)". */
  childTaxCredit: {
    oneChild: 20_830,
    twoChildren: 45_830,
    perAdditionalChildOverTwo: 33_330,
    /** "공제한 금액이 음수인 경우의 세액은 0원으로 함"(별표 2 제3호 단서). */
    floorAtZero: true,
  },

  /** FORMULA.md "3-3. 공제대상가족의 수가 11명을 초과하는 경우 (별표 2 제4호, 원문 확인)". */
  familyCountOverEleven: {
    // tax(11) - (tax(10) - tax(11)) * (n - 11), n = dependentFamilyCount
    // FORMULA.md 그대로 옮김 — Architect/Builder가 임의로 확정하지 않는다.
    negativeResultHandling: "확인 필요",
  },

  /**
   * FORMULA.md "3-4. 월급여 10,000천원(1천만원) 초과 구간 (별표 2 제1호 표 하단, 원문 확인)".
   *
   * **Builder 수정 사항(원 단위 변환 오류 정정, "SPEC/FORMULA/ARCHITECTURE와 다르게 판단한 부분"):**
   * FORMULA.md 3-4의 구간 표는 "월급여액(천원)" 단위로 10,000/14,000/28,000/30,000/45,000/87,000을
   * 적어 두었다 — 이를 "원" 단위로 바꾸려면 **× 1,000**을 해야 한다(예: 10,000천원 = 10,000,000원).
   * 실제로 `src/data/withholding-tax-table-2026.json`의 `range.maxWon`도 10,000,000이고,
   * FORMULA.md Golden Test 10(월급여 12,000,000원)의 "초과금액" 계산도
   * `12,000,000 - 10,000,000 = 2,000,000`으로 이 값(10,000,000원)을 직접 사용한다.
   * 그런데 ARCHITECTURE.md "3. policy.ts 스키마 초안"은 이 값들을 **× 10,000**으로 잘못
   * 환산해(`minWon: 100_000_000` 등, "천원"을 "만원"으로 착각한 것으로 보임) 실제보다 10배 큰
   * 값을 적어 두었다 — 이 스키마를 그대로 쓰면 Golden Test 10·12(월급여 1천만원대)가 전부
   * 어떤 구간에도 걸리지 않아 계산이 깨진다. FORMULA.md 원문 표 값과 그 표를 실제로 사용하는
   * Golden Test 10·12를 근거로, 아래 `minWon`/`maxWon`을 FORMULA.md 원문의 "천원 × 1,000"
   * 변환값(10,000,000/14,000,000/28,000,000/30,000,000/45,000,000/87,000,000)으로 정정했다.
   * 공식(계수·가산액)은 ARCHITECTURE.md 초안 그대로이며 바꾸지 않았다 — 구간 경계값의 단위
   * 변환 오류만 정정했다. 또한 FORMULA.md·ARCHITECTURE.md 본문이 이 지점을 "1억원"이라고
   * 반복해서 표기한 것도 같은 착오로 보인다(10,000천원 = 1천만원이지 1억원이 아니다) —
   * Calculation Auditor가 FORMULA.md/ARCHITECTURE.md의 이 라벨링 자체도 함께 정정할 것을
   * 권고한다(값 자체는 이미 정정 완료, 문서 표기만 남은 문제).
   */
  highIncomeFormula: {
    // 세액표 상한 시점(10,000,000원 = 10,000천원, FORMULA.md 표현으로는 "10,000천원") 세액,
    // 가족 수(1~11)별 고정값. 원 단위.
    baseAmountAtTableCeilingByFamilyCount: {
      "1": 1_507_400,
      "2": 1_431_570,
      "3": 1_200_840,
      "4": 1_170_840,
      "5": 1_140_840,
      "6": 1_110_840,
      "7": 1_080_840,
      "8": 1_050_840,
      "9": 1_020_840,
      "10": 990_840,
      "11": 960_840,
    } as Record<string, number>,
    // minWon/maxWon은 원 단위로 통일(withholding-table.ts와 동일 원칙). 위 주석 참고 —
    // FORMULA.md 원문 "천원" 표 값 × 1,000으로 정정한 값이다(ARCHITECTURE.md 초안의
    // × 10,000 오기를 따르지 않았다).
    brackets: [
      {
        minWon: 10_000_000,
        maxWon: 14_000_000,
        extraRate: { numerator: 98 * 35, denominator: 100 * 100 },
        addWon: 25_000,
      },
      {
        minWon: 14_000_000,
        maxWon: 28_000_000,
        extraRate: { numerator: 98 * 38, denominator: 100 * 100 },
        addWon: 1_397_000,
      },
      {
        minWon: 28_000_000,
        maxWon: 30_000_000,
        extraRate: { numerator: 98 * 40, denominator: 100 * 100 },
        addWon: 6_610_600,
      },
      {
        minWon: 30_000_000,
        maxWon: 45_000_000,
        extraRate: { numerator: 40, denominator: 100 },
        addWon: 7_394_600,
      },
      {
        minWon: 45_000_000,
        maxWon: 87_000_000,
        extraRate: { numerator: 42, denominator: 100 },
        addWon: 13_394_600,
      },
      {
        minWon: 87_000_000,
        maxWon: null,
        extraRate: { numerator: 45, denominator: 100 },
        addWon: 31_034_600,
      },
    ] as {
      minWon: number;
      maxWon: number | null;
      extraRate: { numerator: number; denominator: number };
      addWon: number;
    }[],
    // Golden Test 12, Calculation Auditor 확정 대기 — FORMULA.md "정밀도/반올림 정책"
    // 잠정안("최종 합산 후 1원 미만만 절사")을 logic.ts가 그대로 구현하되, 이 필드 자체는
    // 값을 추정해 채우지 않고 "확인 필요"로 남긴다.
    roundingUnit: "확인 필요",
  },

  /** FORMULA.md "4. 지방소득세" — 지방세법 제103조의13. */
  localIncomeTaxRate: {
    numerator: 1,
    denominator: 10,
    source: {
      law: "지방세법",
      article: "제103조의13",
      url: "https://www.law.go.kr/LSW//lsLawLinkInfo.do?lsJoLnkSeq=1000226093&lsId=001649&chrClsCd=010202",
    },
    lastVerified: "2026-09-06",
    nextReviewDue: "2027-01-01",
  },
} as const;
