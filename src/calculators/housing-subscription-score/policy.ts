/**
 * 청약가점 계산기 — 정책 상수(배점 계수 + 출처 메타데이터).
 *
 * tasks/housing-subscription-score/ARCHITECTURE.md "3. 정책 데이터 스키마" 결정 그대로:
 * 계산기 전용 policy.ts(4대보험/근로기준법처럼 다른 계산기가 재사용할 근거가 없는 값이라
 * `rates-2026.json` 최상위에 두지 않는다). 값은 tasks/housing-subscription-score/FORMULA.md
 * "배점표 (검증 결과)" / "기준 / 출처" 절에서 그대로 옮겼다 — 새로 추정한 값은 없다.
 * "확인 필요"로 남은 항목은 그대로 문자열로 남긴다(추정 금지).
 *
 * logic.ts는 이 파일의 상수만 참조하고 32/35/17/6/5 같은 매직 넘버를 직접 쓰지 않는다
 * (SPEC.md Must Have "기준일자 표시" — 배점 구간을 계산 코드에 하드코딩하지 않는다).
 */

export const HOUSING_SUBSCRIPTION_SCORE_POLICY = {
  law: "주택공급에 관한 규칙",
  regulationVersion:
    "국토교통부령 제1592호 (2026-06-15 시행, 별표 1 개정 여부 확인 필요)",
  lastVerified: "2026-09-06",
  nextReviewDue: "2027-01-01",

  /** 무주택기간 배점(상한 32점). FORMULA.md "배점표" 1번. */
  homelessPeriod: {
    maxScore: 32,
    /** homelessPeriodScore = min(maxScore, perYearScore * (years + 1)) */
    perYearScore: 2,
    source: {
      law: "주택공급에 관한 규칙",
      article: "별표 1 (호 번호 확인 필요)",
      effectiveDate: "확인 필요",
      url: "https://www.law.go.kr",
    },
  },

  /** 부양가족수 배점(상한 35점). FORMULA.md "배점표" 2번. */
  dependentCount: {
    maxScore: 35,
    baseScore: 5,
    perDependentScore: 5,
    /** dependentScore = baseScore + perDependentScore * min(count, capCount) */
    capCount: 6,
    source: {
      law: "주택공급에 관한 규칙",
      article: "별표 1 (호 번호 확인 필요)",
      effectiveDate: "확인 필요",
      url: "https://www.law.go.kr",
    },
  },

  /** 청약통장 가입기간 배점(상한 17점). FORMULA.md "배점표" 3번. */
  subscriptionPeriod: {
    maxScore: 17,
    /** 6개월 미만 */
    under6MonthsScore: 1,
    /** 6개월 이상 ~ 1년 미만 */
    under1YearScore: 2,
    perYearScoreAfter1Year: 1,
    /** 1년 이상: min(maxScore, floor(months/12) + baseScoreAfter1Year) */
    baseScoreAfter1Year: 2,
    source: {
      law: "주택공급에 관한 규칙",
      article: "별표 1 (호 번호 확인 필요)",
      effectiveDate: "확인 필요",
      url: "https://www.law.go.kr",
    },
  },

  /** 세 항목 상한의 합(32+35+17). FORMULA.md "배점표 (검증 결과)" 총점 확인 문구. */
  totalScoreMax: 84,
} as const;

/**
 * FORMULA.md "확인 필요 항목 총정리"를 결과 화면 정책 안내에 그대로 노출하기 위한 요약.
 * 값 자체를 판정하지 않고 원문 그대로 옮긴다.
 */
export const HOUSING_SUBSCRIPTION_SCORE_OPEN_QUESTIONS = [
  "「주택공급에 관한 규칙」 별표 1 원문(law.go.kr)과의 최종 1:1 대조는 완료하지 못했습니다(2개 이상 독립 2차 출처의 완전 일치로 배점표를 검증했습니다).",
  "부양가족 인정요건(직계존속 3년 동거·무주택 요건, 미혼자녀 30세 이상 1년 요건)의 정확한 조항 번호는 확인하지 못했습니다.",
  "2026-06-15 시행 국토교통부령 제1592호가 별표 1 배점표 자체를 개정했는지 여부는 확정하지 못했습니다.",
] as const;
